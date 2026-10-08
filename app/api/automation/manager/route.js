import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
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

  const [{ count: questions }, { count: exams }, { count: tracks }, { count: sources }] = await Promise.all([
    db.from("question_bank").select("*", { count: "exact", head: true }).eq("active", true).eq("verified", true),
    db.from("exams").select("*", { count: "exact", head: true }).eq("is_active", true),
    db.from("job_tracks").select("*", { count: "exact", head: true }).eq("active", true),
    db.from("exam_sources").select("*", { count: "exact", head: true }).eq("active", true)
  ]);

  if ((questions || 0) < 500) {
    tasks.push({ task_type: "question_bank_expansion", priority: 90, payload: { current: questions || 0, target: 500 } });
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

  return NextResponse.json({
    ok: !error,
    manager: "ExamPrep Background Manager",
    checked_at: now,
    metrics: { verified_active_questions: questions || 0, active_exams: exams || 0, active_tracks: tracks || 0, active_sources: sources || 0 },
    tasks_created: inserted?.length || 0,
    tasks_considered: tasks.length,
    deduped_recent: tasks.length - dedupedTasks.length,
    tasks: inserted || [],
    error: error?.message || null
  });
}
