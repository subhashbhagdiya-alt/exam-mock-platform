import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { publicDbError } from "../../../../lib/api-errors.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

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
  const now = new Date();
  const cutoff = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: exams, error: examsError }, { data: analyses, error: analysisError }, { data: questions, error: questionsError }, { data: recentTasks, error: taskError }] = await Promise.all([
    db.from("exams").select("id,name,slug,description").eq("is_active", true).order("name"),
    db.from("exam_analysis").select("exam_id,generated_at").order("generated_at", { ascending: false }),
    db.from("question_bank").select("exam_id,active,verified,source_type").eq("active", true),
    db.from("background_manager_tasks").select("id,status,created_at,payload").eq("task_type", "weekly_exam_analysis").gte("created_at", cutoff).in("status", ["queued", "running", "done"])
  ]);

  const dbError = examsError || analysisError || questionsError || taskError;
  if (dbError) return publicDbError("Weekly analysis", dbError);
  if (!exams?.length) return NextResponse.json({ ok: true, queued: false, reason: "No active exams found." });

  const recentExamIds = new Set((recentTasks || []).map((task) => task.payload?.exam_id).filter(Boolean));
  const lastAnalysis = new Map();
  for (const row of analyses || []) {
    if (!lastAnalysis.has(row.exam_id)) lastAnalysis.set(row.exam_id, row.generated_at);
  }
  const counts = new Map();
  for (const row of questions || []) {
    const item = counts.get(row.exam_id) || { active: 0, verified: 0, pyq: 0, official: 0 };
    item.active += 1;
    if (row.verified) item.verified += 1;
    if (row.source_type === "pyq") item.pyq += 1;
    if (row.source_type === "official") item.official += 1;
    counts.set(row.exam_id, item);
  }

  const candidates = exams.filter((exam) => !recentExamIds.has(exam.id)).sort((a, b) => {
    const aDate = lastAnalysis.get(a.id) ? Date.parse(lastAnalysis.get(a.id)) : 0;
    const bDate = lastAnalysis.get(b.id) ? Date.parse(lastAnalysis.get(b.id)) : 0;
    if (aDate !== bDate) return aDate - bDate;
    return (counts.get(a.id)?.active || 0) - (counts.get(b.id)?.active || 0);
  });

  const selected = candidates[0];
  if (!selected) return NextResponse.json({ ok: true, queued: false, reason: "All active exams already have a weekly task in the last 6 days." });

  const stats = counts.get(selected.id) || { active: 0, verified: 0, pyq: 0, official: 0 };
  const payload = {
    exam_id: selected.id,
    exam_name: selected.name,
    exam_slug: selected.slug,
    description: selected.description || "",
    target_new_questions: 50,
    selection_reason: "Oldest/missing analysis first; tie-breaker is the smallest active question bank.",
    selected_at: now.toISOString(),
    existing_active_questions: stats.active,
    existing_verified_questions: stats.verified,
    available_pyq_or_official_questions: stats.pyq + stats.official,
    note: stats.pyq + stats.official > 0
      ? "Analyze stored PYQ/official-tagged questions as pattern evidence."
      : "No stored PYQ/official-tagged questions are available; clearly disclose limited previous-paper evidence and use exam description plus official-source references where available."
  };

  const { data: inserted, error } = await db.from("background_manager_tasks").insert({
    task_type: "weekly_exam_analysis",
    status: "queued",
    priority: 110,
    payload
  }).select("id,task_type,status,priority").single();

  if (error) return publicDbError("Weekly analysis", error);
  return NextResponse.json({ ok: true, queued: true, task: inserted, selected_exam: selected.name, selection_reason: payload.selection_reason, target_new_questions: 50 });
}
