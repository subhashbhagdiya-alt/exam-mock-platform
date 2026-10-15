import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
// Grading is performed server-side; never expose the privileged key to browser code.
const serverKeys = [...new Set([process.env.SUPABASE_SECRET_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY]
  .filter(value => typeof value === "string" && value.trim())
  .map(value => value.trim()))];

function isUuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request) {
  if (!url || !serverKeys.length) return NextResponse.json({ error: "Grading service is not configured" }, { status: 503 });
  try {
    const body = await request.json();
    if (!isUuid(body?.test_session_id) || !isUuid(body?.test_session_key) ||
        !body?.answers || typeof body.answers !== "object" || Array.isArray(body.answers)) {
      return NextResponse.json({ error: "Invalid test submission" }, { status: 400 });
    }

    let data = null;
    let error = null;
    for (const key of serverKeys) {
      const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
      const result = await client.rpc("submit_mock_test", {
        p_session_id: body.test_session_id,
        p_session_key: body.test_session_key,
        p_answers: body.answers
      });
      data = result.data;
      error = result.error;
      if (!error || !/invalid api key|invalid jwt|bad jwt|jwt expired|permission denied|not authorized to execute/i.test(String(error.message || ""))) break;
    }
    if (error) {
      const message = String(error.message || "");
      const status = /not found|expired|already been submitted|no longer valid/i.test(message) ? 409 : 400;
      return NextResponse.json({ error: /test session|question set|invalid answer/i.test(message) ? message : "Could not grade this test" }, { status });
    }
    if (!data || typeof data !== "object") return NextResponse.json({ error: "Grading returned an invalid result" }, { status: 500 });
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: "Invalid test submission" }, { status: 400 });
  }
}
