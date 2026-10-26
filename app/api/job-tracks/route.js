import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { publicDbError } from "../../../lib/api-errors.mjs";
import { fetchAllRowsInPages } from "../../../lib/fetch-all-rows-in-pages.mjs";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
// Question-bank rows are not publicly readable; keep this privileged key server-side.
const serverKeys = [...new Set([process.env.SUPABASE_SECRET_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY]
  .filter(value => typeof value === "string" && value.trim())
  .map(value => value.trim()))];
const hasServerQuestionAccess = serverKeys.length > 0;

export async function GET() {
  if (!url || !key) return NextResponse.json({ error: "Public Supabase configuration is not configured" }, { status: 503 });

  // Public exam/recruitment metadata can load with the publishable key. Private question-bank
  // summaries stay server-only; never weaken question_bank RLS to make previews appear ready.
  const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const questionClient = hasServerQuestionAccess
    ? createClient(url, serverKeys[0], { auth: { autoRefreshToken: false, persistSession: false } })
    : null;
  const { data, error } = await client
    .from("job_tracks")
    .select("id,exam_board,slug,name_hi,name_en,description_hi,description_en,status,exam_slug,exam_category,official_url,exam_date_text,form_status_text,last_verified_at")
    .eq("active", true)
    .order("sort_order");

  if (error) return publicDbError("Exam list", error);

  const tracks = data || [];
  const examSlugs = tracks.map((track) => track.exam_slug).filter(Boolean);
  let examsBySlug = new Map();

  if (examSlugs.length) {
    const { data: exams, error: examError } = await client
      .from("exams")
      .select("id,slug,total_questions")
      .in("slug", examSlugs)
      .eq("is_active", true);

    if (examError) return publicDbError("Exam list", examError);
    examsBySlug = new Map((exams || []).map((exam) => [exam.slug, exam]));
  }

  const examIds = [...examsBySlug.values()].map((exam) => exam.id);
  const verifiedCounts = new Map();
  const sourceCounts = new Map();
  const subjectSets = new Map();
  const topicSets = new Map();
  const predictionCandidates = new Map();

  if (examIds.length && questionClient) {
    const { data: questions, error: questionError } = await fetchAllRowsInPages(
      (from, to) => questionClient
        .from("question_bank")
        .select("exam_id,source_type,subject,topic,prediction_score", { count: "exact" })
        .in("exam_id", examIds)
        .eq("active", true)
        .eq("verified", true)
        .order("exam_id", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to)
    );

    if (questionError) return publicDbError("Question bank summary", questionError);

    for (const question of questions || []) {
      verifiedCounts.set(question.exam_id, (verifiedCounts.get(question.exam_id) || 0) + 1);
      const key = `${question.exam_id}:${question.source_type || "unknown"}`;
      sourceCounts.set(key, (sourceCounts.get(key) || 0) + 1);
      if (!subjectSets.has(question.exam_id)) subjectSets.set(question.exam_id, new Set());
      if (!topicSets.has(question.exam_id)) topicSets.set(question.exam_id, new Set());
      if (question.subject) subjectSets.get(question.exam_id).add(question.subject);
      if (question.topic) topicSets.get(question.exam_id).add(question.topic);
      if (!predictionCandidates.has(question.exam_id)) predictionCandidates.set(question.exam_id, []);
      predictionCandidates.get(question.exam_id).push(question);
    }
  }

  const enriched = tracks.map((track) => {
    const exam = track.exam_slug ? examsBySlug.get(track.exam_slug) : null;
    const verifiedQuestionCount = questionClient && exam ? (verifiedCounts.get(exam.id) || 0) : null;
    const requiredQuestionCount = exam?.total_questions || 0;
    const questionBankReady = Boolean(questionClient && exam && verifiedQuestionCount >= requiredQuestionCount && requiredQuestionCount > 0);

    return {
      ...track,
      verified_question_count: verifiedQuestionCount,
      required_question_count: requiredQuestionCount,
      question_bank_ready: questionBankReady,
      question_bank_check_available: Boolean(questionClient),
      question_bank_status: questionClient ? (questionBankReady ? "ready" : "incomplete") : "server_credentials_required",
      pyq_question_count: questionClient ? (sourceCounts.get(`${exam?.id}:pyq`) || 0) : null,
      official_question_count: questionClient ? (sourceCounts.get(`${exam?.id}:official`) || 0) : null,
      practice_question_count: questionClient ? (sourceCounts.get(`${exam?.id}:curated`) || 0) : null,
      subjects: questionClient && exam ? [...(subjectSets.get(exam.id) || new Set())].sort() : [],
      topics: questionClient && exam ? [...(topicSets.get(exam.id) || new Set())].sort() : [],
      analysis_candidates: exam ? [...(predictionCandidates.get(exam.id) || [])]
        .sort((a,b) => Number(b.prediction_score || 0) - Number(a.prediction_score || 0))
        .slice(0,5)
        .map(q => ({ subject:q.subject, topic:q.topic, prediction_score:Number(q.prediction_score || 0), source_type:q.source_type })) : [],
      effective_status: questionBankReady ? "question_bank_ready" : track.status === "question_bank_ready" ? "practice" : track.status,
    };
  });

  return NextResponse.json({ data: enriched });
}
