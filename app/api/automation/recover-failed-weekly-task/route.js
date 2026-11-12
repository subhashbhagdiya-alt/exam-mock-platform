import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  buildFailedWeeklyTaskRecoveryPayload,
  isRecoverableWeeklyAnalysisTask,
  parseFailedWeeklyTaskRecoveryRequest,
} from "../../../../lib/failed-weekly-task-recovery.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

function dbClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key
    ? createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
    : null;
}

export async function POST(request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > 2048) {
    return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
  }

  const body = await request.json().catch(() => null);
  const parsed = parseFailedWeeklyTaskRecoveryRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const db = dbClient();
  if (!db) {
    return NextResponse.json({ error: "Server database credentials are not configured." }, { status: 503 });
  }

  const { data: task, error: readError } = await db
    .from("background_manager_tasks")
    .select("id,task_type,status,payload")
    .eq("id", parsed.taskId)
    .maybeSingle();

  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 500 });
  }
  if (!task) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }
  if (!isRecoverableWeeklyAnalysisTask(task)) {
    return NextResponse.json({
      error: "Only failed weekly_exam_analysis tasks can be manually recovered.",
      task_status: task.status,
      task_type: task.task_type,
    }, { status: 409 });
  }

  // Conditional update makes the action one-shot under concurrent requests.
  // Do not clear task.result: any saved analysis/draft checkpoint must survive.
  const { data: updated, error: updateError } = await db
    .from("background_manager_tasks")
    .update({
      status: "queued",
      started_at: null,
      completed_at: null,
      error_message: null,
      payload: buildFailedWeeklyTaskRecoveryPayload(task.payload),
    })
    .eq("id", parsed.taskId)
    .eq("task_type", "weekly_exam_analysis")
    .eq("status", "failed")
    .select("id,status")
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json({
      error: "Task state changed before recovery; refresh the task status and try again.",
    }, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    task: updated,
    checkpoint_preserved: true,
    provider_retry_counter_reset: true,
    note: "One failed task was queued for a later worker run. Only the configured free-tier Gemini provider is used; generated questions remain inactive and unverified until human approval.",
  });
}
