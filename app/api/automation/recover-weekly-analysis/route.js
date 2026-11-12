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
  return Boolean(secret && request.headers.get("authorization") === "Bearer " + secret);
}

function dbClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }) : null;
}

/**
 * Explicitly preview or requeue one failed transient weekly task.
 * A single-row conditional update avoids partial batch recovery when a worker
 * claims the task concurrently. This endpoint never invokes the worker.
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

  const requestedId = requestCheck.taskIds[0];
  const { data: task, error: readError } = await db
    .from("background_manager_tasks")
    .select("id,task_type,status,error_message,payload")
    .eq("id", requestedId)
    .maybeSingle();

  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });

  const eligibility = { id: requestedId, ...getWeeklyTaskRecoveryEligibility(task) };
  if (!eligibility.ok) {
    return NextResponse.json({
      ok: false,
      error: "The selected task is not eligible for recovery.",
      rejected: [eligibility],
    }, { status: 409 });
  }

  if (requestCheck.dryRun) {
    return NextResponse.json({
      ok: true,
      dry_run: true,
      eligible_task: { id: eligibility.id, retry_count: eligibility.retryCount },
      note: "Preview only. No database rows were changed. Set dry_run=false with the same explicit ID to requeue.",
    });
  }

  // Compare the exact state inspected above. If a worker or another operator
  // changed it meanwhile, the conditional update affects zero rows.
  const { data: updated, error: updateError } = await db
    .from("background_manager_tasks")
    .update({ status: "queued", completed_at: null, error_message: null })
    .eq("id", task.id)
    .eq("task_type", task.task_type)
    .eq("status", task.status)
    .eq("error_message", task.error_message)
    .eq("payload", task.payload)
    .select("id")
    .maybeSingle();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  if (!updated) {
    return NextResponse.json({
      ok: false,
      dry_run: false,
      requeued: false,
      error: "The task changed after preview. Nothing was requeued; inspect it again before retrying.",
    }, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    dry_run: false,
    requeued: updated.id,
    note: "The worker was not invoked. The task retains its result checkpoint and retry counter and will be handled by the scheduled worker.",
  });
}
