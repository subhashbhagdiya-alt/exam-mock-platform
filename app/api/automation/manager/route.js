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
  const recentCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const historyCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const staleCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const [
    { data: expansionExams, error: expansionExamError },
    { count: questions, error: questionsError },
    { count: stagedAiQuestions, error: stagedError },
    { count: tracks, error: tracksError },
    { count: sources, error: sourcesError },
    { data: failedTasks, error: failedError },
    { data: staleTasks, error: staleError },
    { data: activeQueue, error: activeQueueError },
    { data: recentCompleted, error: recentCompletedError },
    { data: expansionHistory, error: expansionHistoryError },
    { data: changedSources, error: changedSourcesError }
  ] = await Promise.all([
    db.from("exams").select("id,name,description,slug").eq("is_active", true).order("name").limit(500),
    db.from("question_bank").select("id", { count: "exact", head: true }).eq("active", true).eq("verified", true),
    db.from("question_bank").select("id", { count: "exact", head: true }).eq("active", false).eq("verified", false)
      .or("source_name.like.ExamPrep weekly AI pattern batch%,source_name.like.ExamPrep AI daily expansion%"),
    db.from("job_tracks").select("id", { count: "exact", head: true }).eq("active", true),
    db.from("exam_sources").select("id", { count: "exact", head: true }).eq("active", true),
    db.from("background_manager_tasks").select("id,task_type,status,created_at").eq("status", "failed").gte("created_at", recentCutoff).order("created_at", { ascending: false }).limit(10),
    db.from("background_manager_tasks").select("id,task_type,status,started_at").eq("status", "running").lt("started_at", staleCutoff).limit(10),
    db.from("background_manager_tasks").select("id,task_type,status,created_at,payload").in("status", ["queued", "running"]).order("created_at", { ascending: false }).limit(500),
    db.from("background_manager_tasks").select("task_type,status,created_at,payload").gte("created_at", recentCutoff).in("status", ["done", "blocked"]).order("created_at", { ascending: false }).limit(500),
    db.from("background_manager_tasks").select("task_type,created_at,payload").eq("task_type", "question_bank_expansion").gte("created_at", historyCutoff).order("created_at", { ascending: false }).limit(500),
    db.from("exam_sync_runs").select("source_id,status,change_summary,finished_at").in("status", ["changed", "failed"]).order("finished_at", { ascending: false }).limit(20)
  ]);

  const queryError = expansionExamError || questionsError || stagedError || tracksError || sourcesError ||
    failedError || staleError || activeQueueError || recentCompletedError || expansionHistoryError || changedSourcesError;
  if (queryError) return publicDbError("Background manager checks", queryError);

  const activeTasks = activeQueue || [];
  const completedRecently = recentCompleted || [];
  const recentTasks = [...activeTasks, ...completedRecently];
  const hasRecentType = (taskType) => recentTasks.some((item) => item.task_type === taskType);
  const tasks = [];

  // Select the least-covered active exam, not alphabetically the first exam.
  // Count only live verified items plus AI-generated review candidates for that exam.
  const coverage = [];
  for (let offset = 0; offset < (expansionExams || []).length; offset += 5) {
    const batch = expansionExams.slice(offset, offset + 5);
    const results = await Promise.all(batch.map(async (exam) => {
      const [{ count: activeVerified, error: activeError }, { count: awaitingReview, error: stagedExamError }] = await Promise.all([
        db.from("question_bank").select("id", { count: "exact", head: true }).eq("exam_id", exam.id).eq("active", true).eq("verified", true),
        db.from("question_bank").select("id", { count: "exact", head: true }).eq("exam_id", exam.id).eq("active", false).eq("verified", false)
          .or("source_name.like.ExamPrep weekly AI pattern batch%,source_name.like.ExamPrep AI daily expansion%")
      ]);
      return { exam, activeVerified: activeVerified || 0, awaitingReview: awaitingReview || 0, error: activeError || stagedExamError };
    }));
    const failedCoverageQuery = results.find((item) => item.error);
    if (failedCoverageQuery) return publicDbError("Question expansion exam coverage", failedCoverageQuery.error);
    coverage.push(...results);
  }

  const lastExpansionByExam = new Map();
  for (const task of expansionHistory || []) {
    const examId = task.payload?.exam_id;
    if (examId && !lastExpansionByExam.has(examId)) lastExpansionByExam.set(examId, task.created_at);
  }

  const expansionCandidates = coverage
    .map((item) => ({ ...item, total: item.activeVerified + item.awaitingReview, lastExpansion: lastExpansionByExam.get(item.exam.id) || "" }))
    .filter((item) => item.total < 500)
    .sort((a, b) => a.total - b.total ||
      (a.lastExpansion ? Date.parse(a.lastExpansion) : 0) - (b.lastExpansion ? Date.parse(b.lastExpansion) : 0) ||
      a.exam.name.localeCompare(b.exam.name));

  if (!hasRecentType("question_bank_expansion") && expansionCandidates.length) {
    const selected = expansionCandidates[0];
    tasks.push({
      task_type: "question_bank_expansion",
      priority: 90,
      payload: {
        exam_id: selected.exam.id,
        exam_name: selected.exam.name,
        verified_active: selected.activeVerified,
        awaiting_review: selected.awaitingReview,
        exam_total_toward_target: selected.total,
        target: 500,
        daily_target: 10,
        selection_reason: "Choose the active exam with the smallest verified bank plus staged AI review pool; ties rotate toward exams expanded least recently.",
        note: "Generate up to 10 unique bilingual practice questions, save them for the configured quality gate, and never label generated questions as official/PYQ."
      }
    });
  }

  const unhealthyTasks = (failedTasks || []).length || (staleTasks || []).length;
  if (unhealthyTasks && !hasRecentType("security_review")) {
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

  if ((changedSources || []).some((item) => item.status === "changed") && !hasRecentType("source_review")) {
    tasks.push({
      task_type: "source_review",
      priority: 100,
      payload: { reason: "Official source changed.", runs: changedSources.filter((item) => item.status === "changed").slice(0, 5) }
    });
  }
  if ((changedSources || []).some((item) => item.status === "failed") && !hasRecentType("source_health")) {
    tasks.push({
      task_type: "source_health",
      priority: 95,
      payload: { reason: "Official source check failed.", runs: changedSources.filter((item) => item.status === "failed").slice(0, 5) }
    });
  }

  const { data: inserted, error: insertError } = tasks.length
    ? await db.from("background_manager_tasks").insert(tasks).select("id,task_type,priority,status")
    : { data: [], error: null };

  if (insertError) return publicDbError("Background manager queue", insertError);
  const selectedCoverage = expansionCandidates[0] || null;

  return NextResponse.json({
    ok: true,
    manager: "ExamPrep Background Manager",
    checked_at: now,
    metrics: {
      verified_active_questions: questions || 0,
      ai_questions_awaiting_review: stagedAiQuestions || 0,
      active_exams: (expansionExams || []).length,
      active_tracks: tracks || 0,
      active_sources: sources || 0,
      failed_tasks_last_24h: (failedTasks || []).length,
      stale_running_tasks_over_30m: (staleTasks || []).length,
      selected_exam: selectedCoverage?.exam?.name || null,
      selected_exam_verified_questions: selectedCoverage?.activeVerified || 0,
      selected_exam_staged_questions: selectedCoverage?.awaitingReview || 0,
      selected_exam_total_toward_target: selectedCoverage?.total ?? null
    },
    tasks_created: inserted?.length || 0,
    tasks_considered: tasks.length,
    skipped_because_queue_or_recent_completion: recentTasks.map((item) => item.task_type),
    tasks: inserted || [],
    error: null
  });
}
