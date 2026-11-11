import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildQuestionTopicSignals } from "../../../lib/question-topic-signals.mjs";
import { summarizeExamQuestionBank } from "../../../lib/exam-question-readiness.mjs";

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
  const examSlugs = tracks.map((track) => track.exam_slug).filter(Boolean);
  let examsBySlug = new Map();

  if (examSlugs.length) {
    const { data: exams, error: examError } = await client
      .from("exams")
      .select("id,slug,total_questions")
      .in("slug", examSlugs)
      .eq("is_active", true);

    if (examError) return NextResponse.json({ error: examError.message }, { status: 500 });
    examsBySlug = new Map((exams || []).map((exam) => [exam.slug, exam]));
  }

  const examIds = [...examsBySlug.values()].map((exam) => exam.id);
  const requiredCountByExamId = new Map([...examsBySlug.values()].map((exam) => [exam.id, Number(exam.total_questions || 0)]));
  const verifiedCounts = new Map();
  const questionReadyByExam = new Map();
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
        .select("exam_id,id,source_type,source_name,source_url,subject,topic,question_hi,question_en,explanation_hi,explanation_en,created_at")
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

    const questionsByExam = new Map();
    for (const question of questions) {
      if (!questionsByExam.has(question.exam_id)) questionsByExam.set(question.exam_id, []);
      questionsByExam.get(question.exam_id).push(question);
    }

    for (const [examId, examQuestions] of questionsByExam) {
      // Match the practice API's normalized-text deduplication exactly.
      const summary = summarizeExamQuestionBank(examQuestions, requiredCountByExamId.get(examId) || 0);
      const uniqueQuestions = summary.uniqueRows;
      verifiedCounts.set(examId, summary.verifiedQuestionCount);
      questionReadyByExam.set(examId, summary.questionBankReady);
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
    const requiredQuestionCount = exam?.total_questions || 0;
    const questionBankReady = Boolean(exam && questionReadyByExam.get(exam.id));

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

  return NextResponse.json({ data: enriched });
}
