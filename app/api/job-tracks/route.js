import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildQuestionTopicSignals } from "../../../lib/question-topic-signals.mjs";
import { dedupeQuestionRows } from "../../../lib/question-pool.mjs";
import { buildUnlinkedExamTrack, getUnlinkedActiveExams } from "../../../lib/job-track-fallbacks.mjs";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
// Question-bank rows are not publicly readable; keep this privileged key server-side.
const serverKeys = [...new Set([process.env.SUPABASE_SECRET_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY]
  .filter(value => typeof value === "string" && value.trim())
  .map(value => value.trim()))];

export async function GET() {
  if (!url || !key || !serverKeys.length) return NextResponse.json({ error: "Job tracks server credentials are not configured" }, { status: 503 });

  const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const questionClient = createClient(url, serverKeys[0], { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await client
    .from("job_tracks")
    .select("id,exam_board,slug,name_hi,name_en,description_hi,description_en,status,exam_slug,exam_category,official_url,exam_date_text,form_status_text,last_verified_at")
    .eq("active", true)
    .order("sort_order");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const tracks = data || [];
  // Load all active exams, not only exams already linked to a job track. This
  // lets valid legacy general-practice banks remain discoverable in the board UI.
  const { data: exams, error: examError } = await client
    .from("exams")
    .select("id,name,slug,description,total_questions,duration_minutes,marks_per_question,negative_marks,passing_percentage")
    .eq("is_active", true)
    .order("name");

  if (examError) return NextResponse.json({ error: examError.message }, { status: 500 });
  const activeExams = exams || [];
  const examsBySlug = new Map(activeExams.map((exam) => [exam.slug, exam]));
  const examIds = activeExams.map((exam) => exam.id);
  const questionRowsByExam = new Map();
  const verifiedCounts = new Map();
  const sourceCounts = new Map();
  const subjectSets = new Map();
  const topicSets = new Map();
  const topicSignalRows = new Map();

  if (examIds.length) {
    // Supabase/PostgREST may cap each response at 500 rows. Paginate the whole
    // verified bank, otherwise later exams incorrectly appear to have zero questions.
    const questions = [];
    const questionPageSize = 500;
    for (let from = 0; ; from += questionPageSize) {
      const { data: page, error: questionError } = await questionClient
        .from("question_bank")
        .select("id,exam_id,source_type,source_name,source_url,subject,topic,question_hi,question_en,explanation_hi,explanation_en,created_at")
        .in("exam_id", examIds)
        .eq("active", true)
        .eq("verified", true)
        .order("exam_id", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + questionPageSize - 1);

      if (questionError) return NextResponse.json({ error: questionError.message }, { status: 500 });
      questions.push(...(page || []));
      if (!page || page.length < questionPageSize) break;
    }

    for (const question of questions) {
      if (!questionRowsByExam.has(question.exam_id)) questionRowsByExam.set(question.exam_id, []);
      questionRowsByExam.get(question.exam_id).push(question);
    }

    // Count the same unique question rows that /api/questions actually serves.
    for (const examId of examIds) {
      const uniqueQuestions = dedupeQuestionRows(questionRowsByExam.get(examId) || []);
      verifiedCounts.set(examId, uniqueQuestions.length);
      for (const question of uniqueQuestions) {
        const sourceKey = `${examId}:${question.source_type || "unknown"}`;
        sourceCounts.set(sourceKey, (sourceCounts.get(sourceKey) || 0) + 1);
        if (!subjectSets.has(examId)) subjectSets.set(examId, new Set());
        if (!topicSets.has(examId)) topicSets.set(examId, new Set());
        if (question.subject) subjectSets.get(examId).add(question.subject);
        if (question.topic) topicSets.get(examId).add(question.topic);
      }
      topicSignalRows.set(examId, uniqueQuestions);
    }
  }

  const enriched = tracks.map((track) => {
    const exam = track.exam_slug ? examsBySlug.get(track.exam_slug) : null;
    const verifiedQuestionCount = exam ? (verifiedCounts.get(exam.id) || 0) : 0;
    const requiredQuestionCount = Number(exam?.total_questions || 0);
    const questionBankReady = Boolean(exam && verifiedQuestionCount >= requiredQuestionCount && requiredQuestionCount > 0);

    return {
      ...track,
      verified_question_count: verifiedQuestionCount,
      required_question_count: requiredQuestionCount,
      question_bank_ready: questionBankReady,
      pyq_question_count: sourceCounts.get(`${exam?.id}:pyq`) || 0,
      official_question_count: sourceCounts.get(`${exam?.id}:official`) || 0,
      practice_question_count: sourceCounts.get(`${exam?.id}:curated`) || 0,
      subjects: exam ? [...(subjectSets.get(exam.id) || new Set())].sort() : [],
      topics: exam ? [...(topicSets.get(exam.id) || new Set())].sort() : [],
      analysis_candidates: exam ? buildQuestionTopicSignals(topicSignalRows.get(exam.id) || [], 5) : [],
      effective_status: questionBankReady ? "question_bank_ready" : track.status === "question_bank_ready" ? "practice" : track.status,
    };
  });

  const unlinkedActiveExams = getUnlinkedActiveExams(activeExams, tracks);
  const generalPracticeTracks = unlinkedActiveExams.map((exam, index) => buildUnlinkedExamTrack(exam, index, {
    verifiedCounts,
    sourceCounts,
    subjectSets,
    topicSets,
    topicSignalRows
  }));

  return NextResponse.json({ data: [...enriched, ...generalPracticeTracks] });
}
