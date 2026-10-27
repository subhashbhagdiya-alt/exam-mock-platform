import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { publicDbError } from "../../../../lib/api-errors.mjs";
import { MAX_MANUAL_RECOVERY_TASKS, planManualTaskRecovery } from "../../../../lib/manual-task-recovery.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

function dbClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }) : null;
}

export async function GET(request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = dbClient();
  if (!db) return NextResponse.json({ error: "Server database credentials are not configured" }, { status: 503 });

  const { data, error } = await db.from("background_manager_tasks")
    .select("id,task_type,status,priority,payload,result,error_message,created_at")
    .eq("task_type", "weekly_exam_analysis")
    .eq("status", "failed")
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) return publicDbError("Manual recovery preview", error);

  const candidates = (data || []).map((task) => {
    const plan = planManualTaskRecovery(task);
    return {
      id: task.id,
      created_at: task.created_at,
      eligible: plan.eligible,
      reason: plan.reason || null,
      ...(plan.eligible ? plan.summary : {})
    };
  });
  return NextResponse.json({
    ok: true,
    mode: "read_only_preview",
    note: "This GET request does not change task records. Only explicitly selected, checkpointed weekly-analysis tasks can be requeued by POST.",
    max_tasks_per_request: MAX_MANUAL_RECOVERY_TASKS,
    failed_weekly_analysis_tasks: candidates.length,
    eligible_count: candidates.filter((task) => task.eligible).length,
    candidates
  });
}

export async function POST(request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = dbClient();
  if (!db) return NextResponse.json({ error: "Server database credentials are not configured" }, { status: 503 });

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Send a JSON body with an explicit task_ids array." }, { status: 400 });
  }
  const taskIds = Array.isArray(body?.task_ids) ? [...new Set(body.task_ids.filter(id => typeof id === "string" && id.trim()))] : [];
  if (!taskIds.length || taskIds.length > MAX_MANUAL_RECOVERY_TASKS) {
    return NextResponse.json({ error: `Select between 1 and ${MAX_MANUAL_RECOVERY_TASKS} task IDs.` }, { status: 400 });
  }

  const { data, error } = await db.from("background_manager_tasks")
    .select("id,task_type,status,priority,payload,result")
    .in("id", taskIds)
    .eq("task_type", "weekly_exam_analysis")
    .eq("status", "failed");
  if (error) return publicDbError("Manual recovery selection", error);

  const found = new Set((data || []).map(task => task.id));
  const missingOrIneligible = taskIds.filter(id => !found.has(id));
  const plans = (data || []).map(task => ({ task, plan: planManualTaskRecovery(task) }));
  const rejected = plans.filter(item => !item.plan.eligible).map(item => ({ id: item.task.id, reason: item.plan.reason }));
  const eligible = plans.filter(item => item.plan.eligible);
  const requeued = [];

  for (const { task, plan } of eligible) {
    // Conditional status guard prevents overwriting a task another operator/worker changed.
    const { data: updated, error: updateError } = await db.from("background_manager_tasks")
      .update(plan.update)
      .eq("id", task.id)
      .eq("task_type", "weekly_exam_analysis")
      .eq("status", "failed")
      // Optimistic guards: if the checkpoint identity changed since selection, do not requeue stale work.
      .eq("result->>phase", task.result?.phase)
      .eq("payload->>exam_id", task.payload?.exam_id)
      .select("id")
      .maybeSingle();
    if (updateError) return publicDbError("Manual recovery update", updateError);
    if (updated?.id) requeued.push(plan.summary);
    else rejected.push({ id: task.id, reason: "task_status_changed" });
  }

  return NextResponse.json({
    ok: true,
    mode: "explicit_manual_requeue",
    note: "Only selected tasks with saved generated/needs_more checkpoints were requeued. Saved results were preserved, retry counters reset, and recovered tasks remain unverified drafts.",
    requeued,
    rejected: [...missingOrIneligible.map(id => ({ id, reason: "not_found_or_not_failed_weekly_analysis" })), ...rejected]
  });
}
