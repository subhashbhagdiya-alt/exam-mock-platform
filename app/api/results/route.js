import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

const fields = "id, test_name, score, total_questions, correct, wrong, unanswered, accuracy, answers, review_ids, language, created_at";

function validSessionKey(value) {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
}

function cleanResult(body) {
  const required = ["test_name","score","total_questions","correct","wrong","unanswered","accuracy","answers","review_ids","language"];
  if (!body || required.some(k => body[k] === undefined)) throw new Error("Invalid result payload");
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
    language: body.language === "en" ? "en" : "hi"
  };
}

export async function GET(request) {
  if (!admin) return NextResponse.json({ error: "Cloud storage is not configured" }, { status: 503 });
  const key = new URL(request.url).searchParams.get("session_key");
  if (!validSessionKey(key)) return NextResponse.json({ error: "Invalid session key" }, { status: 400 });
  const { data, error } = await admin.from("test_results").select(fields).eq("session_key", key).order("created_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data || [] });
}

export async function POST(request) {
  if (!admin) return NextResponse.json({ error: "Cloud storage is not configured" }, { status: 503 });
  try {
    const body = await request.json();
    if (!validSessionKey(body?.session_key)) return NextResponse.json({ error: "Invalid session key" }, { status: 400 });
    const payload = cleanResult(body);
    const { data, error } = await admin.from("test_results").insert(payload).select(fields).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Invalid request" }, { status: 400 });
  }
}
