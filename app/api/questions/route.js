import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export async function GET(request) {
  if (!url || !key) return NextResponse.json({ error: "Question bank is not configured" }, { status: 503 });
  const { searchParams } = new URL(request.url);
  const exam = searchParams.get("exam") || "mpesb";
  const requestedLimit = searchParams.get("limit");
  const subject = searchParams.get("subject") || "";
  const topic = searchParams.get("topic") || "";
  const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: examRow, error: examError } = await client
    .from("exams")
    .select("id,name,slug,total_questions,duration_minutes,marks_per_question,negative_marks,passing_percentage")
    .eq("slug", exam)
    .eq("is_active", true)
    .maybeSingle();
  if (examError) return NextResponse.json({ error: examError.message }, { status: 500 });
  if (!examRow) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  const limit = Math.min(Math.max(Number(requestedLimit || examRow.total_questions || 10), 1), 100);
  const poolSize = Math.min(Math.max(limit * 2, limit), 100);

  const { data, error } = await client
    .from("question_bank")
    .select("id,exam_id,subject,topic,question_hi,question_en,options,answer_index,explanation_hi,explanation_en,difficulty,source_type,source_year,prediction_score")
    .eq("active", true)
    .eq("verified", true)
    .eq("exam_id", examRow.id)
    .match(subject ? { subject } : {})
    .match(topic ? { topic } : {})
    .order("prediction_score", { ascending: false })
    .limit(poolSize);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data || [];
  // Prefer real previous-year/official questions over curated practice items.
  const trusted = rows.filter((row) => row.source_type === "pyq" || row.source_type === "official" || row.source_type === "memory_based");
  const practice = rows.filter((row) => row.source_type === "curated");
  const prioritized = [...trusted, ...practice];
  const selected = shuffle(prioritized).slice(0, Math.min(limit, prioritized.length));
  return NextResponse.json({
    exam: examRow,
    data: selected,
    meta: { requested: limit, available: rows.length, selection: "PYQ/official first, then verified practice; shuffle within priority" }
  });
}