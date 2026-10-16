import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

/**
 * Queue a resumable 1,000-question analysis run as ten independently
 * reviewable 100-question batches. This endpoint only queues work; it never
 * publishes AI-created questions. The existing worker stages generated
 * questions inactive/unverified for human approval.
 *
 * POST JSON: { "exam_id": "<active exam UUID>" }
 */
export async function POST(request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Server database credentials are not configured" }, { status: 503 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body with exam_id." }, { status: 400 });
  }
  const examId = typeof body?.exam_id === "string" ? body.exam_id.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(examId)) {
    return NextResponse.json({ error: "A valid exam_id UUID is required." }, { status: 400 });
  }

  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: exam, error: examError } = await db.from("exams")
    .select("id,name,slug,is_active")
    .eq("id", examId)
    .single();
  if (examError || !exam) return NextResponse.json({ error: "Exam not found." }, { status: 404 });
  if (!exam.is_active) return NextResponse.json({ error: "Exam is inactive. Activate it before queueing bulk analysis." }, { status: 409 });

  const { data: existing, error: taskError } = await db.from("background_manager_tasks")
    .select("id,task_type,status,payload,created_at")
    .eq("task_type", "weekly_exam_analysis")
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: false })
    .limit(100);
  if (taskError) return NextResponse.json({ error: taskError.message }, { status: 500 });

  const matching = (existing || []).filter((task) =>
    task.payload?.exam_id === examId && task.payload?.bulk_run === true
  );
  if (matching.length) {
    return NextResponse.json({
      ok: true,
      queued: false,
      reason: "A bulk run for this exam is already queued or running.",
      exam: exam.name,
      existing_tasks: matching.map(({ id, status, created_at, payload }) => ({
        id, status, created_at, batch_number: payload.bulk_batch_number
      }))
    });
  }

  const runId = crypto.randomUUID();
  const tasks = Array.from({ length: 10 }, (_, index) => ({
    task_type: "weekly_exam_analysis",
    status: "queued",
    priority: 115 - index,
    payload: {
      exam_id: exam.id,
      exam_name: exam.name,
      exam_slug: exam.slug,
      target_new_questions: 100,
      bulk_run: true,
      bulk_run_id: runId,
      bulk_batch_number: index + 1,
      bulk_batch_count: 10,
      selection_reason: "User-requested 1,000-question analysis, split into ten resumable 100-question batches.",
      note: "Generated content is curated practice, not PYQ/official unless verified from an authentic paper. AI output remains inactive/unverified pending human approval."
    }
  }));

  const { data: inserted, error: insertError } = await db.from("background_manager_tasks")
    .insert(tasks)
    .select("id,task_type,status,priority,payload");
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    queued: true,
    exam: exam.name,
    bulk_run_id: runId,
    target_questions: 1000,
    batches_queued: inserted?.length || 0,
    batch_size: 100,
    publication_policy: "AI-generated questions stay inactive and unverified until human approval.",
    note: "This endpoint queues work only. Actual completion speed depends on the existing scheduled worker cadence and Gemini quota."
  }, { status: 202 });
}
