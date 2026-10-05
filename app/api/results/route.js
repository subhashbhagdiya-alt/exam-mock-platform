import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function getClient(sessionKey) {
  if (!supabaseUrl || !publishableKey) return null;
  return createClient(supabaseUrl, publishableKey, { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { "x-session-key": sessionKey } } });
}

const fields = "id, exam_id, test_name, score, gross_score, negative_score, marks_per_question, negative_marks_per_question, passing_percentage, total_questions, correct, wrong, unanswered, accuracy, answers, review_ids, language, created_at";

function validSessionKey(value) {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
}

async function cleanResult(body, client) {
  const required = ["test_name","total_questions","answers","review_ids","language","exam_id","question_ids"];
  if (!body || required.some(k => body[k] === undefined)) throw new Error("Invalid result payload");
  if (!/^[0-9a-f-]{36}$/i.test(String(body.exam_id))) throw new Error("Invalid exam id");
  if (!body.question_ids || typeof body.question_ids !== "object" || Array.isArray(body.question_ids)) throw new Error("Invalid question mapping");
  if (!body.answers || typeof body.answers !== "object" || Array.isArray(body.answers)) throw new Error("Invalid answers");
  const exam = await client.from("exams").select("id,name,total_questions,marks_per_question,negative_marks,passing_percentage").eq("id", body.exam_id).eq("is_active", true).maybeSingle();
  if (exam.error) throw new Error(exam.error.message);
  if (!exam.data) throw new Error("Exam not found");
  const sourceIds = Object.values(body.question_ids).filter(v => /^[0-9a-f-]{36}$/i.test(String(v)));
  if (!sourceIds.length) throw new Error("No valid question ids");
  const { data: questions, error: qError } = await client.from("question_bank").select("id,answer_index,exam_id,active,verified").in("id", sourceIds).eq("exam_id", body.exam_id).eq("active", true).eq("verified", true);
  if (qError) throw new Error(qError.message);
  const byId = new Map((questions || []).map(q => [q.id, q]));
  const localIds = Object.keys(body.question_ids);
  let correct = 0, wrong = 0, unanswered = 0;
  for (const localId of localIds) {
    const sourceId = String(body.question_ids[localId]);
    const question = byId.get(sourceId);
    if (!question) throw new Error("Question set is no longer valid");
    const answer = body.answers[localId];
    if (answer === undefined || answer === null || answer === "") { unanswered += 1; continue; }
    if (!Number.isInteger(Number(answer)) || Number(answer) < 0 || Number(answer) > 3) throw new Error("Invalid answer");
    if (Number(answer) === Number(question.answer_index)) correct += 1; else wrong += 1;
  }
  const total = localIds.length;
  if (total < 1 || correct + wrong + unanswered !== total) throw new Error("Invalid question counts");
  if (Number(exam.data.total_questions) !== total) throw new Error("Question count does not match exam rules");
  const marks = Number(exam.data.marks_per_question || 1);
  const negativePer = Number(exam.data.negative_marks || 0);
  const gross = correct * marks;
  const negative = wrong * negativePer;
  const score = Math.max(0, gross - negative);
  const accuracy = Math.round(correct / total * 100);
  return {
    session_key: body.session_key,
    exam_id: body.exam_id,
    test_name: String(exam.data.name || body.test_name).slice(0, 100),
    score, total_questions: total, correct, wrong, unanswered, accuracy,
    answers: body.answers, review_ids: Array.isArray(body.review_ids) ? body.review_ids : [],
    language: body.language === "en" ? "en" : "hi",
    gross_score: gross, negative_score: negative, marks_per_question: marks,
    negative_marks_per_question: negativePer, passing_percentage: Number(exam.data.passing_percentage || 0)
  };
}
