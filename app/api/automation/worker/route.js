import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildWeeklyEvidence, dedupeGeneratedQuestions, normalizeQuestionText, takeWeeklyReviewBatch, validateGeneratedQuestion } from "../../../../lib/weekly-exam-analysis.mjs";
import { classifyWorkerFailure, resetWorkerRetryCount, MAX_TRANSIENT_PROVIDER_RETRIES } from "../../../../lib/background-task-retry.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

function dbClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }) : null;
}

function extractGeminiText(body) {
  return (body.candidates?.[0]?.content?.parts || []).map((part) => part.text || "").join("");
}

async function callModel(apiKey, prompt, maxOutputTokens = 16000) {
  // Free-tier provider only: never fall back to a paid provider or a paid model.
  const model = "gemini-3.6-flash";
  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", maxOutputTokens }
        }),
        // Keep one worker invocation short; the durable task queue handles later retries.
        signal: AbortSignal.timeout(12000)
      });
      if (!response.ok) {
        const failure = new Error(`Gemini API returned HTTP ${response.status}; no paid-provider fallback was attempted.`);
        failure.status = response.status;
        if (response.status === 429) failure.code = "FREE_QUOTA_EXHAUSTED";
        // Retry transient service errors only. Rate/quota limits are deferred to the
        // next scheduled worker run instead of consuming the entire function budget.
        if ([500, 502, 503, 504].includes(response.status) && attempt < maxAttempts) {
          const delay = (500 * (2 ** (attempt - 1))) + Math.floor(Math.random() * 300);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw failure;
      }
      const body = await response.json();
      const text = extractGeminiText(body).replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
      try { return JSON.parse(text); } catch { throw new Error("Gemini response was not valid JSON; no questions were published."); }
    } catch (error) {
      const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
      const retryableStatus = [500, 502, 503, 504].includes(error?.status);
      if (attempt < maxAttempts && (timedOut || retryableStatus)) {
        const delay = (500 * (2 ** (attempt - 1))) + Math.floor(Math.random() * 300);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      if (timedOut) {
        const timeoutError = new Error(`Gemini request timed out after ${maxAttempts} bounded attempts; no paid-provider fallback was attempted.`);
        timeoutError.status = 504;
        timeoutError.code = "GEMINI_TRANSIENT_FAILURE";
        throw timeoutError;
      }
      throw error;
    }
  }
  throw new Error("Gemini request failed after bounded retries; no paid-provider fallback was attempted.");
}

async function generateCandidates(task, db) {
  const apiKey = (process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY);
  if (!apiKey) return { blocked: true, reason: "Neither GEMINI_API_KEY_2 nor GEMINI_API_KEY is configured. No AI-generated question was created." };
  const { data: exams, error } = await db.from("exams").select("id,name,description").eq("is_active", true).order("name").limit(8);
  if (error) throw error;
  const prompt = `Create 5 high-quality Indian competitive-exam practice MCQs for ExamPrep. Return JSON only: {"questions":[{"subject":"...","topic":"...","question_hi":"...","question_en":"...","options":["...","...","...","..."],"answer_index":0,"explanation_hi":"...","explanation_en":"...","difficulty":"easy|medium|hard"}]}. Do not label questions PYQ or official. Exams: ${JSON.stringify(exams)}. Task: ${JSON.stringify(task.payload)}.`;
  const parsed = await callModel(apiKey, prompt, 5000);
  const valid = (Array.isArray(parsed.questions) ? parsed.questions : []).filter(validateGeneratedQuestion);
  return { blocked: false, candidates: valid, generated: valid.length, note: "Legacy small-batch candidates." };
}

async function loadWeeklyContext(db, examId) {
  const [{ data: exam, error: examError }, { data: allQuestions, error: questionsError }, { data: officialSources, error: sourcesError }] = await Promise.all([
    db.from("exams").select("id,name,slug,description,total_questions,duration_minutes,marks_per_question,negative_marks").eq("id", examId).single(),
    db.from("question_bank").select("id,subject,topic,question_hi,question_en,options,answer_index,explanation_hi,explanation_en,difficulty,source_type,source_name,source_url,active,verified").eq("exam_id", examId).order("created_at", { ascending: false }).limit(500),
    db.from("exam_sources").select("board,name,url,active").eq("active", true).limit(50)
  ]);
  const error = examError || questionsError || sourcesError;
  if (error) throw error;
  const existing = allQuestions || [];
  const active = existing.filter((q) => q.active);
  const historicalEvidence = existing.filter((q) => ["pyq", "official"].includes(q.source_type)).slice(0, 80);
  const topicCounts = {};
  const difficultyCounts = { easy: 0, medium: 0, hard: 0 };
  for (const q of active) {
    const topicKey = `${q.subject || "Unclassified"} — ${q.topic || "Unclassified"}`;
    topicCounts[topicKey] = (topicCounts[topicKey] || 0) + 1;
    if (Object.hasOwn(difficultyCounts, q.difficulty)) difficultyCounts[q.difficulty] += 1;
  }
  return {
    exam, existing, active, historicalEvidence, topicCounts, difficultyCounts,
    sources: (officialSources || []).map(({ board, name, url }) => ({ board, name, url })).slice(0, 25)
  };
}


async function generateWeeklyDraft(apiKey, task, context, previousDraft = [], includeAnalysis = true) {
  const target = Math.max(50, Math.min(100, Number(task.payload?.target_new_questions) || 50));
  const need = target - previousDraft.length;
  const batchSize = 5;
  const requested = Math.min(batchSize, Math.max(need, 1));
  const questionSchema = { subject: "...", topic: "...", question_hi: "...", question_en: "...", options: ["...", "...", "...", "..."], answer_index: 0, explanation_hi: "...", explanation_en: "...", difficulty: "easy|medium|hard" };
  const responseShape = includeAnalysis
    ? { analysis: { trend_summary: "...", subjects: [{ name: "...", weight_estimate: "...", evidence: "..." }], topic_breakdown: [{ subject: "...", topic: "...", priority: "high|medium|low", reason: "..." }], difficulty_breakdown: { easy: "...", medium: "...", hard: "..." }, confidence_notes: "...", source_evidence: [{ title: "...", url: "...", source_type: "official_syllabus|official_paper|other", what_it_supports: "..." }] }, questions: [questionSchema] }
    : { questions: [questionSchema] };
  const evidenceLine = includeAnalysis
    ? "Analyze the supplied evidence and include a concise pattern analysis. Evidence: " + JSON.stringify(buildWeeklyEvidence(context))
    : "Use the already saved analysis and same exam evidence; do not return another analysis object.";
  const previousLine = JSON.stringify(previousDraft.slice(-15).map((q) => ({
    question_hi: String(q.question_hi || "").slice(0, 140),
    question_en: String(q.question_en || "").slice(0, 140),
    subject: q.subject,
    topic: q.topic
  })));
  const prompt = [
    "You are ExamPrep's exam-pattern analyst and question writer. Create NEW bilingual practice MCQs.",
    "Return valid JSON only with shape " + JSON.stringify(responseShape) + ".",
    "Target exam: " + JSON.stringify(context.exam) + ".",
    "Request only " + requested + " NEW questions in this resumable batch. Do not generate the full " + target + "-question target in one request.",
    evidenceLine,
    "Previously generated questions from this task (do not duplicate): " + previousLine,
    "Do not claim to browse websites. Treat source URLs as metadata, not proof that their contents were inspected. Do not invent citations, paper contents, exact frequencies, official status, or guarantees. When authentic past-paper content is absent, say frequency estimates are weak. All generated questions are curated practice, not PYQs. Check each answer and explanation. Every question needs four distinct options, a 0-based answer_index, Hindi/English versions, and concise explanations. Avoid questions already present in the bank and vary difficulty."
  ].join("\n");
  const parsed = await callModel(apiKey, prompt, includeAnalysis ? 7000 : 5000);
  if (includeAnalysis && (!parsed.analysis || typeof parsed.analysis.trend_summary !== "string" || !Array.isArray(parsed.analysis.topic_breakdown))) {
    throw new Error("Weekly exam-pattern analysis failed schema validation.");
  }
  const questions = Array.isArray(parsed.questions) ? parsed.questions.filter(validateGeneratedQuestion) : [];
  return { analysis: parsed.analysis || null, questions };
}

async function stageWeeklyExamQuestions(task, db, context, analysis, pool) {
  const records = pool.map((q) => ({
    exam_id: context.exam.id,
    subject: q.subject.trim(),
    topic: q.topic.trim(),
    question_hi: q.question_hi.trim(),
    question_en: q.question_en.trim(),
    options: q.options.map((option) => option.trim()),
    answer_index: q.answer_index,
    explanation_hi: q.explanation_hi.trim(),
    explanation_en: q.explanation_en.trim(),
    difficulty: q.difficulty,
    source_type: "curated",
    source_year: new Date().getUTCFullYear(),
    frequency_score: 0.5,
    recency_score: 0.5,
    topic_score: 0.7,
    prediction_score: 0.5,
    verified: false,
    active: false,
    source_name: "ExamPrep weekly AI pattern batch (awaiting human approval)",
    source_url: null,
    fingerprint: createHash("sha256").update(normalizeQuestionText(q.question_en)).digest("hex")
  }));
  const { data: inserted, error: insertError } = await db.from("question_bank")
    .upsert(records, { onConflict: "exam_id,fingerprint", ignoreDuplicates: true })
    .select("id,subject,topic,difficulty");
  if (insertError) throw insertError;

  const subjects = [...new Set((inserted || []).map((q) => q.subject))].map((name) => ({ name }));
  const generatedTopics = {};
  const generatedDifficulties = { easy: 0, medium: 0, hard: 0 };
  for (const q of inserted || []) {
    const key = q.subject + " — " + (q.topic || "Unclassified");
    generatedTopics[key] = (generatedTopics[key] || 0) + 1;
    if (Object.hasOwn(generatedDifficulties, q.difficulty)) generatedDifficulties[q.difficulty] += 1;
  }
  const trendSummary = [
    analysis.trend_summary,
    "Confidence/evidence note: " + (analysis.confidence_notes || "No confidence note supplied."),
    "Registered source references (metadata only; not live-verified): " + JSON.stringify(analysis.source_evidence || []),
    "Actual stored PYQ/official evidence count: " + context.historicalEvidence.length + ". New questions are curated practice, not official past questions."
  ].join("\n\n");
  const { error: analysisError } = await db.from("exam_analysis").insert({
    exam_id: context.exam.id,
    source_year: new Date().getUTCFullYear(),
    question_count: context.active.length,
    subjects,
    topic_breakdown: analysis.topic_breakdown,
    difficulty_breakdown: { ...analysis.difficulty_breakdown, generated_batch: generatedDifficulties, generated_topic_counts: generatedTopics },
    trend_summary: trendSummary
  });

  return {
    deferred: false,
    blocked: false,
    exam: context.exam.name,
    exam_slug: context.exam.slug,
    analysis_saved: !analysisError,
    analysis_error: analysisError?.message || null,
    analysis_summary: analysis.trend_summary,
    confidence_notes: analysis.confidence_notes || "Not supplied",
    actual_past_paper_evidence_count: context.historicalEvidence.length,
    approved_for_human_review: (inserted || []).length,
    note: "Staged as inactive and unverified after separate small-batch review, bilingual schema checks, and deduplication. A human must approve the questions before they enter the live bank; no AI-generated question was auto-published."
  };
}

async function runWeeklyExamAnalysis(task, db) {
  const apiKey = (process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY);
  if (!apiKey) return { blocked: true, reason: "Neither GEMINI_API_KEY_2 nor GEMINI_API_KEY is configured; weekly analysis and question generation did not run." };
  const examId = task.payload?.exam_id;
  if (!examId) throw new Error("Weekly task is missing exam_id.");
  const target = Math.max(50, Math.min(100, Number(task.payload?.target_new_questions) || 50));
  const context = await loadWeeklyContext(db, examId);
  const previousResult = task.result && typeof task.result === "object" ? task.result : {};
  const phase = previousResult.phase || "start";
  const existingEnglish = context.existing.map((q) => q.question_en);
  const existingHindi = context.existing.map((q) => q.question_hi);
  const reviewedDraft = Array.isArray(previousResult.draft_questions) ? previousResult.draft_questions : [];
  const savedAnalysis = previousResult.analysis || null;

  if (phase === "start") {
    const draft = await generateWeeklyDraft(apiKey, task, context, [], true);
    const unique = dedupeGeneratedQuestions(draft.questions, existingEnglish, existingHindi);
    if (!unique.length) {
      return {
        deferred: true, phase: "needs_more", exam_id: examId, exam_name: context.exam.name,
        target_new_questions: target, analysis: draft.analysis, draft_questions: [],
        empty_generation_batches: 1,
        actual_past_paper_evidence_count: context.historicalEvidence.length,
        note: "The model returned no valid unique questions in this batch. The next worker run will try a fresh batch."
      };
    }
    return {
      deferred: true, phase: "review_batch", exam_id: examId, exam_name: context.exam.name,
      target_new_questions: target, analysis: draft.analysis, draft_questions: [],
      pending_review_questions: unique,
      empty_generation_batches: 0,
      actual_past_paper_evidence_count: context.historicalEvidence.length,
      note: "Saved " + unique.length + " candidate questions. The next worker run will independently review only this small batch. Nothing is published automatically."
    };
  }

  if (phase === "generated") {
    const legacyPending = Array.isArray(previousResult.pending_review_questions)
      ? previousResult.pending_review_questions
      : (Array.isArray(previousResult.draft_questions) ? previousResult.draft_questions : []);
    const { batch, remainder } = takeWeeklyReviewBatch(legacyPending);
    if (!batch.length) {
      return {
        deferred: true, phase: "needs_more", exam_id: examId, exam_name: context.exam.name,
        target_new_questions: target, analysis: savedAnalysis, draft_questions: reviewedDraft,
        empty_generation_batches: 0,
        actual_past_paper_evidence_count: context.historicalEvidence.length,
        note: "The legacy draft had no remaining review candidates. Continuing with a fresh gap-filling batch."
      };
    }
    return {
      deferred: true, phase: "review_batch", exam_id: examId, exam_name: context.exam.name,
      target_new_questions: target, analysis: savedAnalysis,
      draft_questions: reviewedDraft,
      pending_review_questions: batch,
      remaining_review_questions: remainder,
      empty_generation_batches: 0,
      actual_past_paper_evidence_count: context.historicalEvidence.length,
      note: "Migrated a legacy draft into a review batch of " + batch.length + "; remaining candidates are checkpointed for later review."
    };
  }

  if (phase === "review_batch") {
    const pending = Array.isArray(previousResult.pending_review_questions) ? previousResult.pending_review_questions : [];
    const { batch, remainder } = takeWeeklyReviewBatch(pending);
    if (!batch.length) {
      const pool = reviewedDraft.slice(0, target);
      if (pool.length >= target) return stageWeeklyExamQuestions(task, db, context, savedAnalysis, pool);
      return {
        deferred: true, phase: "needs_more", exam_id: examId, exam_name: context.exam.name,
        target_new_questions: target, analysis: savedAnalysis, draft_questions: pool,
        empty_generation_batches: 0,
        actual_past_paper_evidence_count: context.historicalEvidence.length,
        note: "Reviewed " + pool.length + "/" + target + " unique questions. The next worker run will generate a small gap-filling batch."
      };
    }

    const reviewPrompt = [
      "Independently review this batch of " + batch.length + " bilingual competitive-exam practice questions for factual correctness, correct answer index, ambiguity, translation agreement, and explanation accuracy.",
      "Fix errors without adding or removing questions. Return JSON only: {\"questions\":[same question schema]}.",
      "Do not label any question official or PYQ. If a fact is uncertain, replace that question with a reliable syllabus-level question.",
      "Exam: " + context.exam.name + ". Candidates: " + JSON.stringify(batch)
    ].join("\n");
    const reviewed = await callModel(apiKey, reviewPrompt, 6000);
    const reviewedQuestions = Array.isArray(reviewed.questions) ? reviewed.questions.filter(validateGeneratedQuestion) : [];
    const uniqueBatch = dedupeGeneratedQuestions(
      reviewedQuestions,
      existingEnglish.concat(reviewedDraft.map((q) => q.question_en)),
      existingHindi.concat(reviewedDraft.map((q) => q.question_hi))
    );
    const pool = dedupeGeneratedQuestions(reviewedDraft.concat(uniqueBatch), existingEnglish, existingHindi).slice(0, target);

    if (remainder.length) {
      return {
        deferred: true, phase: "review_batch", exam_id: examId, exam_name: context.exam.name,
        target_new_questions: target, analysis: savedAnalysis,
        draft_questions: pool,
        pending_review_questions: remainder,
        empty_generation_batches: 0,
        actual_past_paper_evidence_count: context.historicalEvidence.length,
        note: "Reviewed " + uniqueBatch.length + " candidates; " + remainder.length + " candidates remain in the review queue."
      };
    }
    if (pool.length >= target) return stageWeeklyExamQuestions(task, db, context, savedAnalysis, pool);
    return {
      deferred: true, phase: "needs_more", exam_id: examId, exam_name: context.exam.name,
      target_new_questions: target, analysis: savedAnalysis, draft_questions: pool,
      empty_generation_batches: 0,
      actual_past_paper_evidence_count: context.historicalEvidence.length,
      note: "Independently reviewed " + pool.length + "/" + target + " unique questions. The next worker run will generate a small gap-filling batch."
    };
  }

  if (phase === "needs_more") {
    const emptyCount = Number(previousResult.empty_generation_batches || 0);
    const draft = await generateWeeklyDraft(apiKey, task, context, reviewedDraft, !savedAnalysis);
    const uniqueNew = dedupeGeneratedQuestions(
      draft.questions,
      existingEnglish.concat(reviewedDraft.map((q) => q.question_en)),
      existingHindi.concat(reviewedDraft.map((q) => q.question_hi))
    );
    if (!uniqueNew.length) {
      const nextEmptyCount = emptyCount + 1;
      if (nextEmptyCount >= 3) {
        return {
          blocked: true,
          reason: "AI produced no valid unique questions in " + nextEmptyCount + " consecutive gap-filling batches. The task was stopped for manual review.",
          phase: phase, exam_id: examId, exam_name: context.exam.name,
          reviewed_question_count: reviewedDraft.length
        };
      }
      return {
        deferred: true, phase: "needs_more", exam_id: examId, exam_name: context.exam.name,
        target_new_questions: target, analysis: savedAnalysis || draft.analysis,
        draft_questions: reviewedDraft, empty_generation_batches: nextEmptyCount,
        actual_past_paper_evidence_count: context.historicalEvidence.length,
        note: "No new valid unique questions in this batch (" + nextEmptyCount + "/3); one later retry remains before stopping."
      };
    }
    return {
      deferred: true, phase: "review_batch", exam_id: examId, exam_name: context.exam.name,
      target_new_questions: target, analysis: savedAnalysis || draft.analysis,
      draft_questions: reviewedDraft,
      pending_review_questions: uniqueNew,
      empty_generation_batches: 0,
      actual_past_paper_evidence_count: context.historicalEvidence.length,
      note: "Saved " + uniqueNew.length + " new candidates. The next worker run will review only this batch, then continue toward " + target + "."
    };
  }

  return { blocked: true, reason: "Unknown weekly analysis phase " + String(phase) + "; manual review is required." };
}

export async function GET(request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = dbClient();
  if (!db) return NextResponse.json({ error: "Server database credentials are not configured" }, { status: 503 });

  // Resume-first scheduling: finish multi-phase tasks before starting another one.
  // Deferred analysis tasks preserve their original started_at, so their draft/review
  // steps run on the next scheduled invocation instead of waiting behind the entire queue.
  const { data: task, error: claimError } = await db.from("background_manager_tasks").select("*").eq("status", "queued")
    .order("started_at", { ascending: true, nullsFirst: false })
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (claimError) return NextResponse.json({ error: claimError.message }, { status: 500 });
  if (!task) return NextResponse.json({ ok: true, processed: false, message: "No queued task." });

  const { data: claimedRows, error: markError } = await db.from("background_manager_tasks").update({
    status: "running", started_at: task.started_at ?? new Date().toISOString(), error_message: null
  }).eq("id", task.id).eq("status", "queued").select("id");
  if (markError) return NextResponse.json({ error: markError.message }, { status: 500 });
  if (!claimedRows?.length) return NextResponse.json({ ok: true, processed: false, message: "Task was claimed by another worker." });

  try {
    let result;
    if (task.task_type === "question_bank_expansion") result = await generateCandidates(task, db);
    else if (task.task_type === "weekly_exam_analysis") result = await runWeeklyExamAnalysis(task, db);
    else if (task.task_type === "source_review") result = { note: "Source review task staged. Official source changes require verification before publication.", payload: task.payload };
    else if (task.task_type === "source_health") result = { note: "Source health alert recorded for follow-up.", payload: task.payload };
    else if (task.task_type === "security_review") {
      const snapshot = task.payload || {};
      const deterministic = {
        review_type: "operational_task_health",
        checked_at: snapshot.checked_at || new Date().toISOString(),
        failed_task_count: Number(snapshot.failed_task_count || 0),
        stale_running_task_count: Number(snapshot.stale_running_task_count || 0),
        failed_tasks: Array.isArray(snapshot.failed_tasks) ? snapshot.failed_tasks.slice(0, 10) : [],
        stale_tasks: Array.isArray(snapshot.stale_tasks) ? snapshot.stale_tasks.slice(0, 10) : [],
        automated_changes_made: false,
        note: "This review monitors background task health only. It does not inspect Supabase Auth sign-in logs, prove that an account was hacked, rotate secrets, disable accounts, or change production data."
      };
      const apiKey = (process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY);
      if (apiKey) {
        try {
          const assessment = await callModel(apiKey,
            `Summarize this operational task-health snapshot as JSON only: {"severity":"low|medium|high","summary":"...","recommended_checks":["..."]}. Do not claim an account compromise; do not recommend automatic destructive actions. No changes are authorized. Snapshot: ${JSON.stringify(deterministic)}`,
            1200
          );
          deterministic.ai_assessment = {
            severity: ["low", "medium", "high"].includes(assessment.severity) ? assessment.severity : "medium",
            summary: typeof assessment.summary === "string" ? assessment.summary.slice(0, 800) : "AI assessment was not in the expected format.",
            recommended_checks: Array.isArray(assessment.recommended_checks) ? assessment.recommended_checks.filter(x => typeof x === "string").slice(0, 5).map(x => x.slice(0, 240)) : []
          };
        } catch {
          deterministic.ai_assessment = null;
          deterministic.ai_note = "AI triage unavailable; deterministic task-health findings were retained.";
        }
      } else {
        deterministic.ai_assessment = null;
        deterministic.ai_note = "Neither GEMINI_API_KEY_2 nor GEMINI_API_KEY is configured; deterministic task-health findings were retained.";
      }
      result = deterministic;
    }
    else result = { note: "Unknown task type; no mutation performed." };

    const deferred = Boolean(result?.deferred);
    const blocked = Boolean(result?.blocked);
    await db.from("background_manager_tasks").update({
      status: deferred ? "queued" : blocked ? "blocked" : "done",
      ...(deferred ? { payload: resetWorkerRetryCount(task.payload) } : {}),
      result,
      error_message: blocked ? result.reason : null,
      completed_at: deferred ? null : new Date().toISOString()
    }).eq("id", task.id);
    return NextResponse.json({ ok: true, processed: true, task_id: task.id, task_type: task.task_type, status: deferred ? "queued" : blocked ? "blocked" : "done", result });
  } catch (err) {
    const retryDecision = classifyWorkerFailure(err, task.payload);
    await db.from("background_manager_tasks").update({
      status: retryDecision.deferred ? "queued" : "failed",
      ...(retryDecision.payload !== task.payload ? { payload: retryDecision.payload } : {}),
      // A free-tier 429 is not actionable until quota recovers. Clear the resume-first
      // timestamp so this task yields to other queued work while preserving result
      // checkpoints; never switch to a paid provider or discard the saved draft.
      ...(retryDecision.reason === "free_quota" ? {
        started_at: null,
        // Yield behind normal queued work too; otherwise a high-priority quota-
        // limited task could remain first even after its resume marker is cleared.
        priority: Math.min(Number(task.priority ?? 0), 0)
      } : {}),
      error_message: err?.message || "Task failed",
      completed_at: retryDecision.deferred ? null : new Date().toISOString()
    }).eq("id", task.id);
    const retryMessage = retryDecision.reason === "free_quota"
      ? "Free-tier quota is exhausted; the next scheduled worker run will retry. No paid-provider fallback is used."
      : retryDecision.deferred
        ? `Transient provider error; the next scheduled worker run will retry (${retryDecision.retryCount}/${MAX_TRANSIENT_PROVIDER_RETRIES}). No paid-provider fallback is used.`
        : undefined;
    return NextResponse.json({
      ok: retryDecision.deferred,
      processed: true,
      task_id: task.id,
      status: retryDecision.deferred ? "queued" : "failed",
      error: err?.message || "Task failed",
      retry: retryMessage
    }, { status: retryDecision.deferred ? 202 : 500 });
  }
}