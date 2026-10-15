import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildQuestionCatalog, filterQuestionRows } from "../../../lib/question-categories.mjs";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
// Read-only catalog access uses a publishable key and is constrained by public RLS policies.
// Creating a test session remains restricted to server-only credentials below.
const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serverKeys = [...new Set([process.env.SUPABASE_SECRET_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY]
  .filter(value => typeof value === "string" && value.trim())
  .map(value => value.trim()))];

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function selectBalancedQuestions(rows, limit) {
  const pool = shuffle(rows);
  const trustedTarget = Math.min(2, limit, pool.filter((row) =>
    ["pyq", "official", "memory_based"].includes(row.source_type)
  ).length);
  const selected = [];
  let trustedSelected = 0;

  while (selected.length < limit && pool.length) {
    const last = selected[selected.length - 1];
    const diverse = last
      ? pool.filter((row) => row.subject !== last.subject && row.topic !== last.topic)
      : pool;
    const subjectDiverse = last
      ? pool.filter((row) => row.subject !== last.subject)
      : pool;
    let candidates = diverse.length ? diverse : subjectDiverse.length ? subjectDiverse : pool;

    if (trustedSelected < trustedTarget) {
      const trusted = candidates.filter((row) =>
        ["pyq", "official", "memory_based"].includes(row.source_type)
      );
      if (trusted.length) candidates = trusted;
      else {
        const anyTrusted = pool.filter((row) =>
          ["pyq", "official", "memory_based"].includes(row.source_type)
        );
        if (anyTrusted.length) candidates = anyTrusted;
      }
    }

    const chosen = candidates[0];
    const index = pool.findIndex((row) => row.id === chosen.id);
    if (index < 0) break;
    pool.splice(index, 1);
    selected.push(chosen);
    if (["pyq", "official", "memory_based"].includes(chosen.source_type)) trustedSelected += 1;
  }

  return selected;
}

export async function GET(request) {
  if (!url || !publicKey) return NextResponse.json({ error: "Question bank is not configured" }, { status: 503 });
  const { searchParams } = new URL(request.url);
  const exam = searchParams.get("exam") || "mpesb";
  const requestedLimit = searchParams.get("limit");
  const subject = searchParams.get("subject") || "";
  const topic = searchParams.get("topic") || "";
  const excludedIds = new Set(
    (searchParams.get("exclude") || "")
      .split(",")
      .filter((id) => /^[0-9a-f-]{36}$/i.test(id))
      .slice(0, 250)
  );
  const client = createClient(url, publicKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: examRow, error: examError } = await client
    .from("exams")
    .select("id,name,slug,total_questions,duration_minutes,marks_per_question,negative_marks,passing_percentage")
    .eq("slug", exam)
    .eq("is_active", true)
    .maybeSingle();
  if (examError) return NextResponse.json({ error: examError.message }, { status: 500 });
  if (!examRow) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  const limit = Math.min(Math.max(Number(requestedLimit || examRow.total_questions || 10), 1), 100);
  const { data, error } = await client
    .from("question_bank")
    .select("id,exam_id,subject,topic,question_hi,question_en,options,answer_index,explanation_hi,explanation_en,difficulty,source_type,source_year,prediction_score")
    .eq("active", true)
    .eq("verified", true)
    .eq("exam_id", examRow.id)
    .limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const allRows = data || [];
  // Treat capitalization and repeated whitespace as equivalent in user-selected categories.
  const rows = filterQuestionRows(allRows, subject, topic);

  if (searchParams.get("mode") === "availability") {
    const { subjects, subject_topics: subjectTopics } = buildQuestionCatalog(allRows);

    return NextResponse.json({
      exam: examRow,
      data: [],
      meta: {
        requested: limit,
        available: rows.length,
        subjects,
        subject_topics: subjectTopics
      }
    });
  }

  const unseen = rows.filter((row) => !excludedIds.has(row.id));
  // Prefer questions not used in recent attempts; reuse only when the unseen pool is too small.
  const preferredPool = unseen.length >= limit
    ? unseen
    : [...unseen, ...shuffle(rows.filter((row) => excludedIds.has(row.id)))];
  const selected = selectBalancedQuestions(preferredPool, Math.min(limit, preferredPool.length));

  if (!selected.length) return NextResponse.json({ error: "No verified questions available for this selection" }, { status: 404 });
  const sessionKey = randomUUID();
  let session = null;
  let sessionError = null;
  for (const key of serverKeys) {
    const candidate = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const result = await candidate.rpc("create_mock_test_session", {
      p_exam_id: examRow.id,
      p_question_ids: selected.map((item) => item.id),
      p_session_key: sessionKey
    });
    session = result.data;
    sessionError = result.error;
    if (!sessionError && session) break;
    if (!/invalid api key|invalid jwt|bad jwt|jwt expired|permission denied|not authorized to execute/i.test(String(sessionError?.message || ""))) break;
  }
  if (sessionError || !session) return NextResponse.json({ error: "Could not create a secure test session" }, { status: 503 });

  const safeQuestions = selected.map(({ answer_index, explanation_hi, explanation_en, ...question }) => question);
  return NextResponse.json({
    exam: examRow,
    test_session_id: session,
    test_session_key: sessionKey,
    data: safeQuestions,
    meta: {
      requested: limit,
      available: rows.length,
      unseen_available: unseen.length,
      selection: "randomized, subject/topic-diverse, recent-repeat avoidance"
    }
  });
}
