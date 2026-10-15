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

function extractOutputText(body) {
  return body.output_text || body.output?.flatMap((item) => item.content || []).map((item) => item.text || "").join("") || "";
}

async function callModel(apiKey, prompt, maxOutputTokens = 16000) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5.6",
      input: prompt,
      max_output_tokens: maxOutputTokens
    }),
    signal: AbortSignal.timeout(50000)
  });
  if (!response.ok) throw new Error(`OpenAI API returned HTTP ${response.status}`);
  const body = await response.json();
  const text = extractOutputText(body);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("AI response was not valid JSON; no questions were published.");
  }
}

async function generateCandidates(task, db) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { blocked: true, reason: "OPENAI_API_KEY is not configured. No AI-generated question was created." };

  const { data: exams, error } = await db.from("exams").select("id,name,description").eq("is_active", true).order("name").limit(8);
  if (error) throw error;
  const prompt = `Create 5 high-quality Indian competitive-exam practice MCQs for ExamPrep.
Return ONLY JSON: {"questions":[...]}. Each question must have exam_name, subject, topic, question_hi, question_en, options (exactly 4 strings), answer_index (0-3), explanation_hi, explanation_en, difficulty ("easy"|"medium"|"hard").
Do not call any question PYQ, official, or memory-based. These are curated practice questions only.
Candidate exams: ${JSON.stringify(exams)}.
Task context: ${JSON.stringify(task.payload)}.`;
  const parsed = await callModel(apiKey, prompt, 5000);
  const valid = (Array.isArray(parsed.questions) ? parsed.questions : []).filter(validateGeneratedQuestion);
  return { blocked: false, candidates: valid, generated: valid.length, note: "Legacy small-batch candidates." };
}

async function runWeeklyExamAnalysis(task, db) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { blocked: true, reason: "OPENAI_API_KEY is not configured; weekly question generation was not run." };

  const target = Math.max(50, Math.min(100, Number(task.payload?.target_new_questions) || 50));
  const examId = task.payload?.exam_id;
  if (!examId) throw new Error("Weekly task is missing exam_id.");

  const [{ data: exam, error: examError }, { data: allQuestions, error: questionsError }, { data: officialSources, error: sourcesError }] = await Promise.all([
    db.from("exams").select("id,name,slug,description,total_questions,duration_minutes,marks_per_question,negative_marks").eq("id", examId).single(),
    db.from("question_bank").select("id,subject,topic,question_hi,question_en,options,answer_index,explanation_hi,explanation_en,difficulty,source_type,source_name,source_url,active,verified").eq("exam_id", examId).order("created_at", { ascending: false }).limit(500),
    db.from("exam_sources").select("board,name,url,active").eq("active", true).limit(50)
  ]);
  if (examError) throw examError;
  if (questionsError) throw questionsError;
  if (sourcesError) throw sourcesError;

  const existing = allQuestions || [];
  const activeQuestions = existing.filter((q) => q.active);
  const historicalEvidence = existing.filter((q) => ["pyq", "official"].includes(q.source_type)).slice(0, 80);
  const topicCounts = {};
  const difficultyCounts = { easy: 0, medium: 0, hard: 0 };
  for (const question of activeQuestions) {
    const key = `${question.subject || "Unclassified"} — ${question.topic || "Unclassified"}`;
    topicCounts[key] = (topicCounts[key] || 0) + 1;
    if (Object.hasOwn(difficultyCounts, question.difficulty)) difficultyCounts[question.difficulty] += 1;
  }

  const sourceRefs = (officialSources || []).map(({ board, name, url }) => ({ board, name, url })).slice(0, 25);
  const evidenceText = historicalEvidence.map((q) => ({
    subject: q.subject, topic: q.topic, question_hi: q.question_hi, question_en: q.question_en,
    options: q.options, answer_index: q.answer_index, source_type: q.source_type, source_name: q.source_name, source_url: q.source_url
  }));
  const patternPrompt = `You are an exam-pattern analyst for Indian competitive examinations.
Analyze only the evidence provided. Distinguish verified previous-paper evidence from curated practice content. Do not invent past-paper trends or claim a topic will definitely appear.
Return JSON only: {"trend_summary":"...","subjects":[{"name":"...","weight_estimate":"...","evidence":"..."}],"topic_breakdown":[{"subject":"...","topic":"...","priority":"high|medium|low","reason":"..."}],"difficulty_breakdown":{"easy":"...","medium":"...","hard":"..."},"confidence_notes":"..."}.
Exam: ${JSON.stringify({ name: exam.name, description: exam.description, total_questions: exam.total_questions, duration_minutes: exam.duration_minutes, marks_per_question: exam.marks_per_question, negative_marks: exam.negative_marks })}.
Current active question coverage: ${JSON.stringify({ active_count: activeQuestions.length, source_topic_counts: topicCounts, difficulty_counts: difficultyCounts })}.
Stored PYQ/official-tagged question evidence (may be empty): ${JSON.stringify(evidenceText)}.
Official source references to consider (URLs only; do not claim you fetched them): ${JSON.stringify(sourceRefs)}.
If no actual PYQ/official questions are provided, explicitly say evidence is insufficient for a reliable previous-paper frequency estimate. Recommend likely practice priorities, not guaranteed exam predictions.`;
  const analysis = await callModel(apiKey, patternPrompt, 6000);
  if (!analysis || typeof analysis.trend_summary !== "string" || !Array.isArray(analysis.topic_breakdown)) {
    throw new Error("Exam pattern analysis did not pass validation; no questions were published.");
  }

  const knownEnglish = existing.map((q) => q.question_en);
  const knownHindi = existing.map((q) => q.question_hi);
  const accepted = [];
  const acceptedEnglish = new Set(knownEnglish.map(normalizeQuestionText).filter(Boolean));
  const acceptedHindi = new Set(knownHindi.map(normalizeQuestionText).filter(Boolean));
  const generationLog = [];

  for (let round = 0; round < 3 && accepted.length < target; round += 1) {
    const needed = target - accepted.length;
    const batchSize = Math.min(100, needed + 8);
    const generationPrompt = `Create exactly ${batchSize} NEW bilingual Hindi/English multiple-choice practice questions for this exam.
Return JSON only: {"questions":[{"subject":"...","topic":"...","question_hi":"...","question_en":"...","options":["...","...","...","..."],"answer_index":0,"explanation_hi":"...","explanation_en":"...","difficulty":"easy|medium|hard"}]}.
Target exam: ${JSON.stringify({ name: exam.name, slug: exam.slug, description: exam.description, duration_minutes: exam.duration_minutes, total_questions: exam.total_questions, marks_per_question: exam.marks_per_question, negative_marks: exam.negative_marks })}.
Pattern analysis: ${JSON.stringify(analysis)}.
Current topic coverage: ${JSON.stringify(topicCounts)}.
Past-paper evidence: ${JSON.stringify(evidenceText)}.
Official-source reference list: ${JSON.stringify(sourceRefs)}.
Questions already in this exam bank (avoid same concepts and near-duplicates): ${JSON.stringify(existing.slice(0, 120).map((q) => ({ question_hi: q.question_hi, question_en: q.question_en, subject: q.subject, topic: q.topic })))}
New questions already accepted in this run (avoid duplication): ${JSON.stringify(accepted.map((q) => ({ question_hi: q.question_hi, question_en: q.question_en })))}
Rules: no claims these are official PYQs; no fabricated source citations; no ambiguous answers; use plausible exam-level difficulty and spread across the analysis priorities. Self-check every correct answer and explanation. If evidence is weak, create syllabus-relevant practice, not claims about actual future exam questions.`;
    const generated = await callModel(apiKey, generationPrompt, 16000);
    const candidates = Array.isArray(generated.questions) ? generated.questions.filter(validateGeneratedQuestion) : [];
    const deDuped = dedupeGeneratedQuestions(candidates, [...knownEnglish, ...accepted.map((q) => q.question_en)], [...knownHindi, ...accepted.map((q) => q.question_hi)]);
    generationLog.push({ round: round + 1, requested: batchSize, structurally_valid: candidates.length, unique_candidates: deDuped.length });

    const reviewPrompt = `Review the following ${deDuped.length} proposed practice questions for factual correctness, answer-index correctness, ambiguity, Hindi/English agreement, and explanation correctness. Correct any errors. Do not add or remove questions. Do not claim they are PYQs. Return JSON only as {"questions":[same schema]}.
If a question is inherently uncertain or not suitable, replace it with a reliable basic syllabus question on the same topic. Maintain exactly four distinct options and the same answer index convention (0-based).
Exam context: ${exam.name}; pattern evidence: ${JSON.stringify(analysis)}.
Questions: ${JSON.stringify(deDuped)}`;
    const reviewed = deDuped.length ? await callModel(apiKey, reviewPrompt, 16000) : { questions: [] };
    const reviewCandidates = Array.isArray(reviewed.questions) ? reviewed.questions.filter(validateGeneratedQuestion) : [];
    const reviewDeduped = dedupeGeneratedQuestions(reviewCandidates, [...knownEnglish, ...accepted.map((q) => q.question_en)], [...knownHindi, ...accepted.map((q) => q.question_hi)]);
    for (const q of reviewDeduped) {
      if (accepted.length >= target) break;
      const en = normalizeQuestionText(q.question_en);
      const hi = normalizeQuestionText(q.question_hi);
      if (acceptedEnglish.has(en) || acceptedHindi.has(hi)) continue;
      acceptedEnglish.add(en);
      acceptedHindi.add(hi);
      accepted.push(q);
    }
    generationLog[generationLog.length - 1].reviewed_unique = reviewDeduped.length;
    generationLog[generationLog.length - 1].accepted_total = accepted.length;
  }

  if (accepted.length < target) {
    throw new Error(`Only ${accepted.length}/${target} unique validated questions were produced after 3 rounds; nothing was inserted. Check model output or retry next worker run.`);
  }

  const toInsert = accepted.slice(0, target).map((q) => ({
    exam_id: exam.id,
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
    source_name: "ExamPrep weekly AI pattern batch (reviewed)",
    source_url: null,
    fingerprint: createHash("sha256").update(normalizeQuestionText(q.question_en)).digest("hex")
  }));

  const { data: insertedQuestions, error: insertError } = await db.from("question_bank").insert(toInsert).select("id,subject,topic,difficulty");
  if (insertError) throw insertError;

  const finalTopics = {};
  const finalDifficulties = { easy: 0, medium: 0, hard: 0 };
  const finalSubjects = new Set();
  for (const q of insertedQuestions || []) {
    finalSubjects.add(q.subject);
    const topicKey = `${q.subject} — ${q.topic || "Unclassified"}`;
    finalTopics[topicKey] = (finalTopics[topicKey] || 0) + 1;
    if (Object.hasOwn(finalDifficulties, q.difficulty)) finalDifficulties[q.difficulty] += 1;
  }

  const trendSummary = [
    analysis.trend_summary,
    `Evidence note: ${analysis.confidence_notes || "Confidence notes not provided."}`,
    `Stored actual PYQ/official-tagged evidence count: ${historicalEvidence.length}. Generated questions are curated practice, not official past-paper questions.`,
    `Generation/review rounds: ${JSON.stringify(generationLog)}`
  ].join("\n\n");
  const { error: analysisInsertError } = await db.from("exam_analysis").insert({
    exam_id: exam.id,
    source_year: new Date().getUTCFullYear(),
    question_count: activeQuestions.length + (insertedQuestions || []).length,
    subjects: [...finalSubjects].map((name) => ({ name })),
    topic_breakdown: analysis.topic_breakdown,
    difficulty_breakdown: { ...analysis.difficulty_breakdown, generated_batch: finalDifficulties },
    trend_summary: trendSummary
  });
  if (analysisInsertError) {
    // Keep the inserted questions, but surface that analysis history did not save.
    return { blocked: false, generated: (insertedQuestions || []).length, exam: exam.name, analysis_saved: false, analysis_error: analysisInsertError.message, generation_log: generationLog };
  }

  return {
    blocked: false,
    exam: exam.name,
    exam_slug: exam.slug,
    analysis_saved: true,
    analysis_summary: analysis.trend_summary,
    analysis_confidence: analysis.confidence_notes || "Not supplied",
    actual_past_paper_evidence_count: historicalEvidence.length,
    inserted_questions: (insertedQuestions || []).length,
    verified_active_count_after_insert: activeQuestions.filter((q) => q.verified).length + (insertedQuestions || []).length,
    generation_log: generationLog,
    note: "Inserted only after structural checks, deduplication, and a separate AI review pass. These remain curated practice questions, not guaranteed future exam questions."
  };
}

export async function GET(request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = dbClient();
  if (!db) return NextResponse.json({ error: "Server database credentials are not configured" }, { status: 503 });

  const { data: task, error: claimError } = await db
    .from("background_manager_tasks")
    .select("*")
    .eq("status", "queued")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

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

    const blocked = result?.blocked;
    await db.from("background_manager_tasks").update({
      status: blocked ? "blocked" : "done",
      result,
      error_message: blocked ? result.reason : null,
      completed_at: new Date().toISOString()
    }).eq("id", task.id);

    return NextResponse.json({ ok: true, processed: true, task_id: task.id, task_type: task.task_type, status: blocked ? "blocked" : "done", result });
  } catch (err) {
    await db.from("background_manager_tasks").update({
      status: "failed", error_message: err?.message || "Task failed", completed_at: new Date().toISOString()
    }).eq("id", task.id);
    return NextResponse.json({ ok: false, processed: true, task_id: task.id, status: "failed", error: err?.message || "Task failed" }, { status: 500 });
  }
}
