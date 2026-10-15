import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { dedupeGeneratedQuestions, normalizeQuestionText, validateGeneratedQuestion } from "../../../../lib/weekly-exam-analysis.mjs";

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

async function callModel(apiKey, prompt, maxOutputTokens = 16000, enableWebSearch = false) {
  // Free-tier provider only: never fall back to a paid provider or a paid model.
  const model = "gemini-2.5-flash";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", maxOutputTokens },
      ...(enableWebSearch ? { tools: [{ google_search: {} }] } : {})
    }),
    signal: AbortSignal.timeout(50000)
  });
  if (!response.ok) {
    const failure = new Error(`Gemini API returned HTTP ${response.status}; no paid-provider fallback was attempted.`);
    if (response.status === 429) failure.code = "FREE_QUOTA_EXHAUSTED";
    throw failure;
  }
  const body = await response.json();
  const text = extractGeminiText(body).replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  try { return JSON.parse(text); } catch { throw new Error("Gemini response was not valid JSON; no questions were published."); }
}

async function generateCandidates(task, db) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { blocked: true, reason: "GEMINI_API_KEY is not configured. No AI-generated question was created." };
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

function patternEvidence(context) {
  return {
    active_question_count: context.active.length,
    topic_counts: context.topicCounts,
    difficulty_counts: context.difficultyCounts,
    actual_pyq_or_official_question_count: context.historicalEvidence.length,
    actual_past_question_sample: context.historicalEvidence.map((q) => ({
      subject: q.subject, topic: q.topic, question_hi: q.question_hi, question_en: q.question_en,
      options: q.options, answer_index: q.answer_index, source_type: q.source_type,
      source_name: q.source_name, source_url: q.source_url
    })),
    official_source_references: context.sources
  };
}

async function generateWeeklyDraft(apiKey, task, context, previousDraft = []) {
  const target = Math.max(50, Math.min(100, Number(task.payload?.target_new_questions) || 50));
  const need = target - previousDraft.length;
  const requested = Math.min(100, Math.max(need + 10, 10));
  const prompt = `You are ExamPrep's exam-pattern analyst and question writer. Analyze the exam evidence and create NEW bilingual practice MCQs.
Return valid JSON only with shape {"analysis":{"trend_summary":"...","subjects":[{"name":"...","weight_estimate":"...","evidence":"..."}],"topic_breakdown":[{"subject":"...","topic":"...","priority":"high|medium|low","reason":"..."}],"difficulty_breakdown":{"easy":"...","medium":"...","hard":"..."},"confidence_notes":"...","source_evidence":[{"title":"...","url":"...","source_type":"official_syllabus|official_paper|other","what_it_supports":"..."}]},"questions":[{"subject":"...","topic":"...","question_hi":"...","question_en":"...","options":["...","...","...","..."],"answer_index":0,"explanation_hi":"...","explanation_en":"...","difficulty":"easy|medium|hard"}]}.
Target exam: ${JSON.stringify(context.exam)}.
Request ${requested} questions to ensure a full batch of ${target} unique questions remains after deduplication.
Evidence from existing bank and stored official/PYQ questions: ${JSON.stringify(patternEvidence(context))}.
Previously generated questions from this same task (do not duplicate): ${JSON.stringify(previousDraft.map((q) => ({ question_hi: q.question_hi, question_en: q.question_en, subject: q.subject, topic: q.topic })))}
Use web search to find current official syllabus/past-paper material for this exam where available; prioritize the exam board's own domain. Include only sources actually opened/used in analysis.source_evidence and state what each supports. Rules: use stored PYQ/official questions as past-paper evidence only when actually present. If no authentic past-paper evidence can be found, explicitly state that frequency estimates are weak and use syllabus/description/topic coverage to recommend practice priorities. Never invent exact past-paper frequency, source citations, official status, or guarantee a question will appear. All generated questions are curated practice, not PYQs. Check each answer and explanation before returning it. Each question needs four distinct options, 0-based answer_index, Hindi/English versions, and concise explanations. Avoid all concepts/questions already in the bank; favor coverage gaps and varied easy/medium/hard difficulty.`;
  const parsed = await callModel(apiKey, prompt, 16000, previousDraft.length === 0);
  if (!parsed.analysis || typeof parsed.analysis.trend_summary !== "string" || !Array.isArray(parsed.analysis.topic_breakdown)) {
    throw new Error("Weekly exam-pattern analysis failed schema validation.");
  }
  const questions = Array.isArray(parsed.questions) ? parsed.questions.filter(validateGeneratedQuestion) : [];
  return { analysis: parsed.analysis, questions };
}

async function runWeeklyExamAnalysis(task, db) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { blocked: true, reason: "GEMINI_API_KEY is not configured; weekly analysis and question generation did not run." };
  const examId = task.payload?.exam_id;
  if (!examId) throw new Error("Weekly task is missing exam_id.");
  const target = Math.max(50, Math.min(100, Number(task.payload?.target_new_questions) || 50));
  const context = await loadWeeklyContext(db, examId);
  const previous = task.result?.phase === "needs_more" ? (task.result.draft_questions || []) : [];

  if (!["generated", "needs_more"].includes(task.result?.phase)) {
    const draft = await generateWeeklyDraft(apiKey, task, context, []);
    const unique = dedupeGeneratedQuestions(draft.questions, context.existing.map((q) => q.question_en), context.existing.map((q) => q.question_hi));
    return {
      deferred: true,
      phase: "generated",
      exam_id: examId,
      exam_name: context.exam.name,
      target_new_questions: target,
      analysis: draft.analysis,
      draft_questions: unique,
      actual_past_paper_evidence_count: context.historicalEvidence.length,
      note: "Analysis and candidate batch saved. The next scheduled worker run will independently review, deduplicate, and publish only a complete batch."
    };
  }

  if (task.result?.phase === "generated") {
    const reviewPrompt = `Independently review these bilingual competitive-exam practice questions for factual correctness, correct answer index, ambiguity, translation agreement, and explanation accuracy. Fix errors; do not add or remove questions. Return JSON only: {"questions":[same question schema]}. Do not label them official or PYQ. If a fact is uncertain, replace the question with a reliable syllabus-level question. Exam: ${context.exam.name}. Pattern analysis: ${JSON.stringify(task.result.analysis)}. Questions: ${JSON.stringify(task.result.draft_questions)}`;
    const reviewed = await callModel(apiKey, reviewPrompt, 16000);
    const reviewedQuestions = Array.isArray(reviewed.questions) ? reviewed.questions.filter(validateGeneratedQuestion) : [];
    const unique = dedupeGeneratedQuestions(reviewedQuestions, context.existing.map((q) => q.question_en), context.existing.map((q) => q.question_hi));
    const pool = unique.slice(0, target);
    if (pool.length < target) {
      return {
        deferred: true,
        phase: "needs_more",
        exam_id: examId,
        exam_name: context.exam.name,
        target_new_questions: target,
        analysis: task.result.analysis,
        draft_questions: pool,
        actual_past_paper_evidence_count: context.historicalEvidence.length,
        note: `Independent review left ${pool.length}/${target} unique questions. The next scheduled run will generate a gap-filling batch.`
      };
    }

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
      verified: true,
      active: true,
      source_name: "ExamPrep weekly AI pattern batch (independently reviewed)",
      source_url: null,
      fingerprint: createHash("sha256").update(normalizeQuestionText(q.question_en)).digest("hex")
    }));
    const { data: inserted, error: insertError } = await db.from("question_bank").insert(records).select("id,subject,topic,difficulty");
    if (insertError) throw insertError;

    const subjects = [...new Set((inserted || []).map((q) => q.subject))].map((name) => ({ name }));
    const generatedTopics = {};
    const generatedDifficulties = { easy: 0, medium: 0, hard: 0 };
    for (const q of inserted || []) {
      const key = `${q.subject} — ${q.topic || "Unclassified"}`;
      generatedTopics[key] = (generatedTopics[key] || 0) + 1;
      if (Object.hasOwn(generatedDifficulties, q.difficulty)) generatedDifficulties[q.difficulty] += 1;
    }
    const analysis = task.result.analysis;
    const trendSummary = [
      analysis.trend_summary,
      `Confidence/evidence note: ${analysis.confidence_notes || "No confidence note supplied."}`,
      `Source evidence from web search: ${JSON.stringify(analysis.source_evidence || [])}`,
      `Actual stored PYQ/official evidence count: ${context.historicalEvidence.length}. New questions are curated practice, not official past questions.`
    ].join("\n\n");
    const { error: analysisError } = await db.from("exam_analysis").insert({
      exam_id: context.exam.id,
      source_year: new Date().getUTCFullYear(),
      question_count: context.active.length + (inserted || []).length,
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
      inserted_questions: (inserted || []).length,
      note: "Inserted after bilingual schema checks, deduplication, and a separate AI review pass. These are curated practice questions; exam appearance is not guaranteed."
    };
  }

  const gapDraft = await generateWeeklyDraft(apiKey, task, context, previous);
  const merged = dedupeGeneratedQuestions(
    [...previous, ...gapDraft.questions],
    context.existing.map((q) => q.question_en),
    context.existing.map((q) => q.question_hi)
  ).slice(0, target + 10);
  return {
    deferred: true,
    phase: "generated",
    exam_id: examId,
    exam_name: context.exam.name,
    target_new_questions: target,
    analysis: task.result.analysis || gapDraft.analysis,
    draft_questions: merged,
    actual_past_paper_evidence_count: context.historicalEvidence.length,
    note: "Gap-filling candidates saved. The next scheduled worker run will review and publish once at least 50 unique questions pass checks."
  };
}

export async function GET(request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = dbClient();
  if (!db) return NextResponse.json({ error: "Server database credentials are not configured" }, { status: 503 });

  const { data: task, error: claimError } = await db.from("background_manager_tasks").select("*").eq("status", "queued")
    .order("priority", { ascending: false }).order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (claimError) return NextResponse.json({ error: claimError.message }, { status: 500 });
  if (!task) return NextResponse.json({ ok: true, processed: false, message: "No queued task." });

  const { data: claimedRows, error: markError } = await db.from("background_manager_tasks").update({
    status: "running", started_at: new Date().toISOString(), error_message: null
  }).eq("id", task.id).eq("status", "queued").select("id");
  if (markError) return NextResponse.json({ error: markError.message }, { status: 500 });
  if (!claimedRows?.length) return NextResponse.json({ ok: true, processed: false, message: "Task was claimed by another worker." });

  try {
    let result;
    if (task.task_type === "question_bank_expansion") result = await generateCandidates(task, db);
    else if (task.task_type === "weekly_exam_analysis") result = await runWeeklyExamAnalysis(task, db);
    else if (task.task_type === "source_review") result = { note: "Source review task staged. Official source changes require verification before publication.", payload: task.payload };
    else if (task.task_type === "source_health") result = { note: "Source health alert recorded for follow-up.", payload: task.payload };
    else result = { note: "Unknown task type; no mutation performed." };

    const deferred = Boolean(result?.deferred);
    const blocked = Boolean(result?.blocked);
    await db.from("background_manager_tasks").update({
      status: deferred ? "queued" : blocked ? "blocked" : "done",
      result,
      error_message: blocked ? result.reason : null,
      completed_at: deferred ? null : new Date().toISOString()
    }).eq("id", task.id);
    return NextResponse.json({ ok: true, processed: true, task_id: task.id, task_type: task.task_type, status: deferred ? "queued" : blocked ? "blocked" : "done", result });
  } catch (err) {
    const quotaDeferred = err?.code === "FREE_QUOTA_EXHAUSTED";
    await db.from("background_manager_tasks").update({
      status: quotaDeferred ? "queued" : "failed",
      error_message: err?.message || "Task failed",
      completed_at: quotaDeferred ? null : new Date().toISOString()
    }).eq("id", task.id);
    return NextResponse.json({
      ok: quotaDeferred,
      processed: true,
      task_id: task.id,
      status: quotaDeferred ? "queued" : "failed",
      error: err?.message || "Task failed",
      retry: quotaDeferred ? "The next scheduled worker run will retry; no paid-provider fallback is used." : undefined
    }, { status: quotaDeferred ? 202 : 500 });
  }
}
