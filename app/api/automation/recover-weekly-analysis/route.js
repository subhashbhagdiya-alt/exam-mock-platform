import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getWeeklyTaskRecoveryEligibility,
  validateWeeklyRecoveryRequest,
} from "../../../../lib/weekly-task-recovery.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

function dbClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }) : null;
}

/**
 * Explicitly preview or requeue a small list of failed transient weekly tasks.
 * This endpoint never invokes the worker; the scheduled worker handles queued work.
 */
export async function POST(request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const requestCheck = validateWeeklyRecoveryRequest(body);
  if (!requestCheck.ok) return NextResponse.json({ error: requestCheck.reason }, { status: 400 });

  const db = dbClient();
  if (!db) return NextResponse.json({ error: "Server database credentials are not configured." }, { status: 503 });

  const { data: tasks, error: readError } = await db
    .from("background_manager_tasks")
    .select("id,task_type,status,error_message,payload")
    .in("id", requestCheck.taskIds);

  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });

  const taskById = new Map((tasks || []).map((task) => [task.id.toLowerCase(), task]));
  const eligibility = requestCheck.taskIds.map((id) => {
    const task = taskById.get(id.toLowerCase());
    return { id, ...getWeeklyTaskRecoveryEligibility(task) };
  });
  const rejected = eligibility.filter((item) => !item.ok);

  // Validate the entire batch before attempting a write; mixed valid/invalid
  // batches are rejected so an operator can review and retry an exact list.
  if (rejected.length) {
    return NextResponse.json({
      ok: false,
      error: "No tasks were changed because one or more selected tasks are not eligible.",
      rejected,
    }, { status: 409 });
  }

  if (requestCheck.dryRun) {
    return NextResponse.json({
      ok: true,
      dry_run: true,
      eligible_tasks: eligibility.map(({ id, retryCount }) => ({ id, retry_count: retryCount })),
      note: "Preview only. No database rows were changed. Set dry_run=false with the same explicit IDs to requeue.",
    });
  }

  // Preserve payload, result, started_at, priority and provider_retry_count.
  // Only clear terminal state markers and return selected tasks to the queue.
  const { data: updated, error: updateError } = await db
    .from("background_manager_tasks")
    .update({ status: "queued", completed_at: null, error_message: null })
    .in("id", requestCheck.taskIds)
    .eq("task_type", "weekly_exam_analysis")
    .eq("status", "failed")
    .select("id");

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  const requeuedIds = (updated || []).map((task) => task.id);
  return NextResponse.json({
    ok: requeuedIds.length === requestCheck.taskIds.length,
    dry_run: false,
    requested: requestCheck.taskIds.length,
    requeued: requeuedIds,
    not_requeued: requestCheck.taskIds.filter((id) => !requeuedIds.some((saved) => saved.toLowerCase() === id.toLowerCase())),
    note: "The worker was not invoked. Requeued tasks retain their checkpoints and retry counters and will be handled by the scheduled worker.",
  }, { status: requeuedIds.length === requestCheck.taskIds.length ? 200 : 409 });
}
