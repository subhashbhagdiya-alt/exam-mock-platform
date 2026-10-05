import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function getClient(sessionKey) {
  if (!supabaseUrl || !publishableKey) return null;
  return createClient(supabaseUrl, publishableKey, { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { "x-session-key": sessionKey } } });
}

const fields = "id, test_name, score, gross_score, negative_score, marks_per_question, negative_marks_per_question, passing_percentage, total_questions, correct, wrong, unanswered, accuracy, answers, review_ids, language, created_at";

function validSessionKey(value) {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
}

function cleanResult(body) {
  const required = ["test_name","score","total_questions","correct","wrong","unanswered","accuracy","answers","review_ids","language"];
  if (!body || required.some(k => body[k] === undefined)) throw new Error("Invalid result payload");
  const numeric = ["score","total_questions","correct","wrong","unanswered","accuracy","gross_score","negative_score","marks_per_question","negative_marks_per_question","passing_percentage"];
  for (const key of numeric) {
    if (body[key] !== undefined && (!Number.isFinite(Number(body[key])) || Number(body[key]) < 0)) throw new Error("Invalid numeric result field: " + key);
  }
  const total = Number(body.total_questions);
  const correct = Number(body.correct);
  const wrong = Number(body.wrong);
  const unanswered = Number(body.unanswered);
  if (!Number.isInteger(total) || total < 1 || !Number.isInteger(correct) || !Number.isInteger(wrong) || !Number.isInteger(unanswered) || correct + wrong + unanswered !== total) throw new Error("Invalid question counts");
  if (Number(body.accuracy) > 100 || Number(body.passing_percentage || 0) > 100) throw new Error("Invalid percentage");
  return {
    session_key: body.session_key,
    test_name: String(body.test_name).slice(0, 100),
    score: Number(body.score),
    total_questions: Number(body.total_questions),
    correct: Number(body.correct),
    wrong: Number(body.wrong),
    unanswered: Number(body.unanswered),
    accuracy: Number(body.accuracy),
    answers: body.answers,
    review_ids: body.review_ids,
    language: body.language === "en" ? "en" : "hi",
    gross_score: Number(body.gross_score || 0),
    negative_score: Number(body.negative_score || 0),
    marks_per_question: Number(body.marks_per_question || 1),
    negative_marks_per_question: Number(body.negative_marks_per_question || 0),
    passing_percentage: Number(body.passing_percentage || 0)
  };
}

export async function GET(request) {
  const key = new URL(request.url).searchParams.get("session_key");
  if (!validSessionKey(key)) return NextResponse.json({ error: "Invalid session key" }, { status: 400 });
  const client = getClient(key);
  if (!client) return NextResponse.json({ error: "Cloud storage is not configured" }, { status: 503 });
  const { data, error } = await client.from("test_results").select(fields).eq("session_key", key).order("created_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data || [] });
}

export async function POST(request) {
  try {
    const body = await request.json();
    if (!validSessionKey(body?.session_key)) return NextResponse.json({ error: "Invalid session key" }, { status: 400 });
    const client = getClient(body.session_key);
    if (!client) return NextResponse.json({ error: "Cloud storage is not configured" }, { status: 503 });
    const payload = cleanResult(body);
    const { data, error } = await client.from("test_results").insert(payload).select(fields).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Invalid request" }, { status: 400 });
  }
}
