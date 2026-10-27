import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { publicDbError } from "../../../../lib/api-errors.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Server database credentials are not configured" }, { status: 503 });

  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const now = new Date().toISOString();
  const tasks = [];
  const recentCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentTasks } = await db
    .from("background_manager_tasks")
    .select("task_type,status,created_at")
    .gte("created_at", recentCutoff)
    .in("status", ["queued", "running"]);

  const staleCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const [
    { count: questions },
    { count: stagedAiQuestions },
    { count: exams },
    { count: tracks },
    { count: sources },
    { data: failedTasks },
    { data: staleTasks }
  ] = await Promise.all([
    db.from("question_bank").select("*", { count: "exact", head: true }).eq("active", true).eq("verified", true),
    db.from("question_bank").select("*", { count: "exact", head: true }).eq("active", false).eq("verified", false).or("source_name.like.ExamPrep weekly AI pattern batch%,source_name.like.ExamPrep AI daily expansion%"),
    db.from("exams").select("*", { count: "exact", head: true }).eq("is_active", true),
    db.from("job_tracks").select("*", { count: "exact", head: true }).eq("active", true),
    db.from("exam_sources").select("*", { count: "exact", head: true }).eq("active", true),
    db.from("background_manager_tasks").select("id,task_type,status,created_at").eq("status", "failed").gte("created_at", recentCutoff).order("created_at", { ascending: false }).limit(10),
    db.from("background_manager_tasks").select("id,task_type,status,started_at").eq("status", "running").lt("started_at", staleCutoff).limit(10)
  ]);

  const { data: expansionExams, error: expansionExamError } = await db.from("exams")
    .select("id,name,description").eq("is_active", true).order("name").limit(1);
  if (expansionExamError) return publicDbError("Question expansion exam selection", expansionExamError);

  const pendingQuestions = (questions || 0) + (stagedAiQuestions || 0);
  if (pendingQuestions < 500) {
    tasks.push({ task_type: "question_bank_expansion", priority: 90, payload: { exam_id: expansionExams?.[0]?.id || null, exam_name: expansionExams?.[0]?.name || null, verified_active: questions || 0, awaiting_review: stagedAiQuestions || 0, target: 500, daily_target: 10, note: "Generate up to 10 unique bilingual practice questions per daily run, save inactive/unverified for human review, and never claim they are official/PYQ." } });
  }

  if ((failedTasks || []).length || (staleTasks || []).length) {
    tasks.push({
      task_type: "security_review",
      priority: 100,
      payload: {
        checked_at: now,
        failed_task_count: (failedTasks || []).length,
        stale_running_task_count: (staleTasks || []).length,
        failed_tasks: (failedTasks || []).map(({ id, task_type, created_at }) => ({ id, task_type, created_at })),
        stale_tasks: (staleTasks || []).map(({ id, task_type, started_at }) => ({ id, task_type, started_at })),
        note: "Operational task-health signals only; this is not a Supabase Auth sign-in audit."
      }
    });
  }

  const { data: changedSources } = await db
    .from("exam_sync_runs")
    .select("source_id,status,change_summary,finished_at")
    .in("status", ["changed", "failed"])
    .order("finished_at", { ascending: false })
    .limit(20);

  if ((changedSources || []).some(item => item.status === "changed")) {
    tasks.push({ task_type: "source_review", priority: 100, payload: { reason: "Official source changed.", runs: changedSources.filter(item => item.status === "changed").slice(0, 5) } });
  }
  if ((changedSources || []).some(item => item.status === "failed")) {
    tasks.push({ task_type: "source_health", priority: 95, payload: { reason: "Official source check failed.", runs: changedSources.filter(item => item.status === "failed").slice(0, 5) } });
  }

  const dedupedTasks = tasks.filter(task => !(recentTasks || []).some(item => item.task_type === task.task_type));
  const { data: inserted, error } = dedupedTasks.length
    ? await db.from("background_manager_tasks").insert(dedupedTasks).select("id,task_type,priority,status")
    : { data: [], error: null };

  if (error) return publicDbError("Background manager queue", error);
  return NextResponse.json({
    ok: true,
    manager: "ExamPrep Background Manager",
    checked_at: now,
    metrics: {
      verified_active_questions: questions || 0,
      ai_questions_awaiting_review: stagedAiQuestions || 0,
      active_exams: exams || 0,
      active_tracks: tracks || 0,
      active_sources: sources || 0,
      failed_tasks_last_24h: (failedTasks || []).length,
      stale_running_tasks_over_30m: (staleTasks || []).length
    },
    tasks_created: inserted?.length || 0,
    tasks_considered: tasks.length,
    deduped_recent: tasks.length - dedupedTasks.length,
    tasks: inserted || [],
    error: null
  });
}
