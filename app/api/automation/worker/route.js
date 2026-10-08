import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

async function generateCandidates(task, db) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { blocked: true, reason: "OPENAI_API_KEY is not configured. No AI-generated question was created." };
  }

  const { data: exams, error } = await db
    .from("exams")
    .select("id,name,description")
    .eq("is_active", true)
    .order("name")
    .limit(8);
  if (error) throw error;

  const prompt = `Create 5 high-quality Indian competitive-exam practice MCQs for the ExamPrep question bank.
Return ONLY valid JSON: {"questions":[...]}.
Each question must contain: exam_name, subject, topic, question_hi, question_en, options (array of exactly 4 strings), answer_index (0-3), explanation_hi, explanation_en, difficulty ("easy"|"medium"|"hard").
Do NOT claim any question is PYQ, official, or memory-based. These are curated practice questions only.
Use accurate, syllabus-relevant facts and avoid ambiguous wording.
Candidate exams: ${JSON.stringify(exams)}.
Task context: ${JSON.stringify(task.payload)}.`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5.6",
      input: prompt,
      temperature: 0.2
    }),
    signal: AbortSignal.timeout(45000)
  });

  if (!response.ok) throw new Error(`OpenAI API returned HTTP ${response.status}`);
  const body = await response.json();
  const text = body.output_text || body.output?.flatMap(item => item.content || []).map(item => item.text || "").join("") || "";
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error("AI response was not valid JSON"); }

  const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
  const valid = questions.filter(q =>
    q && typeof q.question_hi === "string" && typeof q.question_en === "string" &&
    Array.isArray(q.options) && q.options.length === 4 &&
    Number.isInteger(q.answer_index) && q.answer_index >= 0 && q.answer_index <= 3 &&
    ["easy","medium","hard"].includes(q.difficulty)
  ).map(q => ({ ...q, source_type: "curated", verified: false, active: false }));

  return { blocked: false, candidates: valid, generated: valid.length, note: "AI candidates are staged in the task result and are NOT published automatically." };
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

  const { error: markError } = await db.from("background_manager_tasks").update({
    status: "running", started_at: new Date().toISOString(), error_message: null
  }).eq("id", task.id).eq("status", "queued");
  if (markError) return NextResponse.json({ error: markError.message }, { status: 500 });

  try {
    let result;
    if (task.task_type === "question_bank_expansion") result = await generateCandidates(task, db);
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
