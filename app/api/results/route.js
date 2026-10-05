import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function getClient(sessionKey, accessToken = "") {
  if (!supabaseUrl || !publishableKey) return null;
  return createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { "x-session-key": sessionKey, ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) } }
  });
}

const fields = "id, exam_id, test_name, score, gross_score, negative_score, marks_per_question, negative_marks_per_question, passing_percentage, total_questions, correct, wrong, unanswered, accuracy, answers, review_ids, language, created_at";

function validSessionKey(value) {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
}

function validDeviceKey(value) {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
}

async function cleanResult(body, client, authUserId = null) {
  const required = ["test_name","total_questions","answers","review_ids","language","exam_id","question_ids"];
  if (!body || required.some(k => body[k] === undefined)) throw new Error("Invalid result payload");
  if (!/^[0-9a-f-]{36}$/i.test(String(body.exam_id))) throw new Error("Invalid exam id");
  if (!body.question_ids || typeof body.question_ids !== "object" || Array.isArray(body.question_ids)) throw new Error("Invalid question mapping");
  if (!body.answers || typeof body.answers !== "object" || Array.isArray(body.answers)) throw new Error("Invalid answers");

  const { data: exam, error: examError } = await client.from("exams")
    .select("id,name,total_questions,marks_per_question,negative_marks,passing_percentage")
    .eq("id", body.exam_id).eq("is_active", true).maybeSingle();
  if (examError) throw new Error(examError.message);
  if (!exam) throw new Error("Exam not found");

  const sourceIds = [...new Set(Object.values(body.question_ids).filter(v => /^[0-9a-f-]{36}$/i.test(String(v))).map(String))];
  if (!sourceIds.length) throw new Error("No valid question ids");

  const { data: questions, error: qError } = await client.from("question_bank")
    .select("id,answer_index,exam_id,active,verified")
    .in("id", sourceIds).eq("exam_id", body.exam_id).eq("active", true).eq("verified", true);
  if (qError) throw new Error(qError.message);

  const byId = new Map((questions || []).map(q => [q.id, q]));
  const localIds = Object.keys(body.question_ids);
  let correct = 0, wrong = 0, unanswered = 0;
  for (const localId of localIds) {
    const question = byId.get(String(body.question_ids[localId]));
    if (!question) throw new Error("Question set is no longer valid");
    const answer = body.answers[localId];
    if (answer === undefined || answer === null || answer === "") { unanswered += 1; continue; }
    if (!Number.isInteger(Number(answer)) || Number(answer) < 0 || Number(answer) > 3) throw new Error("Invalid answer");
    if (Number(answer) === Number(question.answer_index)) correct += 1; else wrong += 1;
  }

  const total = localIds.length;
  if (total < 1 || correct + wrong + unanswered !== total) throw new Error("Invalid question counts");

  const practiceMode = body.practice_mode === true;
  if (!practiceMode && Number(exam.total_questions) !== total) throw new Error("Question count does not match exam rules");
  if (practiceMode && total > 50) throw new Error("Practice test is limited to 50 questions");

  const marks = Number(exam.marks_per_question || 1);
  const negativePer = Number(exam.negative_marks || 0);
  const gross = correct * marks;
  const negative = wrong * negativePer;
  const score = Math.max(0, gross - negative);
  const accuracy = Math.round(correct / total * 100);

  return {
    session_key: body.session_key,
    exam_id: body.exam_id,
    user_id: authUserId,
    test_name: String(exam.name || body.test_name).slice(0, 100),
    score, total_questions: total, correct, wrong, unanswered, accuracy,
    answers: body.answers,
    review_ids: Array.isArray(body.review_ids) ? body.review_ids : [],
    language: body.language === "en" ? "en" : "hi",
    gross_score: gross, negative_score: negative,
    marks_per_question: marks, negative_marks_per_question: negativePer,
    passing_percentage: Number(exam.passing_percentage || 0)
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const sessionKey = searchParams.get("session_key") || "";
  if (!validSessionKey(sessionKey)) return NextResponse.json({ error: "Invalid session key" }, { status: 400 });

  const authHeader = request.headers.get("authorization") || "";
  const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const client = getClient(sessionKey, accessToken);
  if (!client) return NextResponse.json({ error: "Database is not configured" }, { status: 503 });

  let authUserId = null;
  if (accessToken) {
    const { data, error } = await client.auth.getUser(accessToken);
    if (error) return NextResponse.json({ error: "Invalid login session" }, { status: 401 });
    authUserId = data?.user?.id || null;
  }
  if (!authUserId) return NextResponse.json({ error: "Login required" }, { status: 401 });

  const deviceKey = request.headers.get("x-device-key") || "";
  if (!validDeviceKey(deviceKey)) return NextResponse.json({ error: "Trusted device required" }, { status: 403 });
  const { data: device, error: deviceError } = await client.from("user_devices").select("device_key").eq("user_id", authUserId).maybeSingle();
  if (deviceError) return NextResponse.json({ error: deviceError.message }, { status: 500 });
  if (!device || device.device_key !== deviceKey) return NextResponse.json({ error: "This account is bound to another device" }, { status: 403 });

  const query = client.from("test_results").select(fields).eq("user_id", authUserId).order("created_at", { ascending: false }).limit(50);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data || [] });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const sessionKey = body?.session_key;
    if (!validSessionKey(sessionKey)) return NextResponse.json({ error: "Invalid session key" }, { status: 400 });

    const authHeader = request.headers.get("authorization") || "";
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const client = getClient(sessionKey, accessToken);
    if (!client) return NextResponse.json({ error: "Database is not configured" }, { status: 503 });

    let authUserId = null;
    if (accessToken) {
      const { data, error } = await client.auth.getUser(accessToken);
      if (error) return NextResponse.json({ error: "Invalid login session" }, { status: 401 });
      authUserId = data?.user?.id || null;
    }

    if (!authUserId) return NextResponse.json({ error: "Login required to save results" }, { status: 401 });

    const cleaned = await cleanResult(body, client, authUserId);
    if (authUserId) {
      const deviceKey = body.device_key;
      if (!validDeviceKey(deviceKey)) return NextResponse.json({ error: "Trusted device required" }, { status: 403 });
      const { data: device, error: deviceError } = await client.from("user_devices").select("device_key").eq("user_id", authUserId).maybeSingle();
      if (deviceError) return NextResponse.json({ error: deviceError.message }, { status: 500 });
      if (!device || device.device_key !== deviceKey) return NextResponse.json({ error: "This account is bound to another device" }, { status: 403 });
    }
    const { data, error } = await client.from("test_results").insert(cleaned).select(fields).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Could not save result" }, { status: 400 });
  }
}
