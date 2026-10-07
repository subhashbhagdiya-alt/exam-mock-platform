import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export async function GET() {
  if (!url || !key) return NextResponse.json({ error: "Job tracks are not configured" }, { status: 503 });

  const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
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
  const verifiedCounts = new Map();
  const sourceCounts = new Map();
  const subjectSets = new Map();
  const topicSets = new Map();

  if (examIds.length) {
    const { data: questions, error: questionError } = await client
      .from("question_bank")
      .select("exam_id,source_type,subject,topic")
      .in("exam_id", examIds)
      .eq("active", true)
      .eq("verified", true);

    if (questionError) return NextResponse.json({ error: questionError.message }, { status: 500 });

    for (const question of questions || []) {
      verifiedCounts.set(question.exam_id, (verifiedCounts.get(question.exam_id) || 0) + 1);
      const key = `${question.exam_id}:${question.source_type || "unknown"}`;
      sourceCounts.set(key, (sourceCounts.get(key) || 0) + 1);
      if (!subjectSets.has(question.exam_id)) subjectSets.set(question.exam_id, new Set());
      if (!topicSets.has(question.exam_id)) topicSets.set(question.exam_id, new Set());
      if (question.subject) subjectSets.get(question.exam_id).add(question.subject);
      if (question.topic) topicSets.get(question.exam_id).add(question.topic);
    }
  }

  const enriched = tracks.map((track) => {
    const exam = track.exam_slug ? examsBySlug.get(track.exam_slug) : null;
    const verifiedQuestionCount = exam ? (verifiedCounts.get(exam.id) || 0) : 0;
    const requiredQuestionCount = exam?.total_questions || 0;
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
      effective_status: questionBankReady ? "question_bank_ready" : track.status,
    };
  });

  return NextResponse.json({ data: enriched });
}
