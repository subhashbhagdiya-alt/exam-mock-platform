import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function isUuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request) {
  if (!url || !serviceRoleKey) {
    return NextResponse.json({ error: "Secure grading service is not configured" }, { status: 503 });
  }

  try {
    const body = await request.json();
    const sessionId = body?.test_session_id;
    const answers = body?.answers;
    if (!isUuid(sessionId) || !answers || typeof answers !== "object" || Array.isArray(answers)) {
      return NextResponse.json({ error: "Invalid test submission" }, { status: 400 });
    }

    const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: session, error: sessionError } = await admin
      .from("mock_test_sessions")
      .select("id,exam_id,question_ids,expires_at,submitted_at,result")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError) return NextResponse.json({ error: "Could not load test session" }, { status: 500 });
    if (!session) return NextResponse.json({ error: "Test session not found" }, { status: 404 });
    if (session.submitted_at) return session.result ? NextResponse.json({ data: session.result }) : NextResponse.json({ error: "This test has already been submitted" }, { status: 409 });
    if (new Date(session.expires_at).getTime() < Date.now()) return NextResponse.json({ error: "Test session expired. Start a new test." }, { status: 410 });

    const questionIds = Array.isArray(session.question_ids) ? session.question_ids : [];
    if (!questionIds.length || questionIds.length > 100) return NextResponse.json({ error: "Invalid test question set" }, { status: 400 });

    const { data: exam, error: examError } = await admin
      .from("exams")
      .select("id,name,marks_per_question,negative_marks,passing_percentage")
      .eq("id", session.exam_id)
      .eq("is_active", true)
      .maybeSingle();
    if (examError || !exam) return NextResponse.json({ error: "Exam configuration unavailable" }, { status: 500 });

    const { data: questions, error: questionError } = await admin
      .from("question_bank")
      .select("id,answer_index,explanation_hi,explanation_en,question_hi,question_en,options,subject,topic,source_type,source_year")
      .in("id", questionIds)
      .eq("exam_id", session.exam_id)
      .eq("active", true)
      .eq("verified", true);
    if (questionError) return NextResponse.json({ error: "Could not grade this test" }, { status: 500 });

    const byId = new Map((questions || []).map((item) => [item.id, item]));
    if (byId.size !== questionIds.length) return NextResponse.json({ error: "Question set is no longer valid" }, { status: 409 });

    let correct = 0;
    let wrong = 0;
    let unanswered = 0;
    const review = [];
    questionIds.forEach((questionId, index) => {
      const question = byId.get(questionId);
      const localId = String(index + 1);
      const value = answers[localId];
      const answered = value !== undefined && value !== null && value !== "";
      const selectedAnswer = answered && Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) < 4 ? Number(value) : null;
      if (!answered || selectedAnswer === null) {
        if (answered) wrong += 1;
        else unanswered += 1;
      } else if (selectedAnswer === Number(question.answer_index)) correct += 1;
      else wrong += 1;

      review.push({
        id: index + 1,
        answer: Number(question.answer_index),
        explanation: question.explanation_hi || question.explanation_en || "",
        question: question.question_hi || question.question_en || "",
        options: question.options,
        subject: question.subject || "General",
        topic: question.topic || "",
        sourceType: question.source_type || "curated",
        sourceYear: question.source_year || null
      });
    });

    const total = questionIds.length;
    const marks = Number(exam.marks_per_question || 1);
    const negativePer = Number(exam.negative_marks || 0);
    const gross = correct * marks;
    const negative = wrong * negativePer;
    const score = Math.max(0, gross - negative);
    const accuracy = Math.round((correct / Math.max(1, total)) * 100);
    const result = {
      exam_id: exam.id,
      test_name: exam.name,
      total_questions: total,
      correct,
      wrong,
      unanswered,
      score,
      gross_score: gross,
      negative_score: negative,
      accuracy,
      marks_per_question: marks,
      negative_marks_per_question: negativePer,
      passing_percentage: Number(exam.passing_percentage || 0),
      answers,
      review
    };

    const { data: claimed, error: claimError } = await admin
      .from("mock_test_sessions")
      .update({ submitted_at: new Date().toISOString(), result })
      .eq("id", sessionId)
      .is("submitted_at", null)
      .select("id")
      .maybeSingle();
    if (claimError) return NextResponse.json({ error: "Could not finalize test submission" }, { status: 500 });
    if (!claimed) return NextResponse.json({ error: "This test has already been submitted" }, { status: 409 });

    return NextResponse.json({ data: result });
  } catch {
    return NextResponse.json({ error: "Invalid test submission" }, { status: 400 });
  }
}
