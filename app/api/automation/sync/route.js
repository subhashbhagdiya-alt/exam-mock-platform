import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SOURCES = [
  "https://esb.mp.gov.in/student_dashboard.htm",
  "https://esb.mp.gov.in/rulebooks/rule_books.htm",
  "https://esb.mp.gov.in/Exams_Schedule/exams_schedule_ESB26.htm",
  "https://esb.mp.gov.in/Question%20Paper%20and%20Candidate%20Responses/Question_Objection.asp"
];

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}

export async function GET(request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Database is not configured" }, { status: 503 });

  const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: sources, error } = await client.from("exam_sources").select("id,url,last_hash,last_checked_at").in("url", SOURCES).eq("active", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = [];
  for (const source of sources || []) {
    const started = Date.now();
    try {
      const response = await fetch(source.url, {
        cache: "no-store",
        headers: { "user-agent": "ExamPrep-ExamSync/1.0 (+scheduled-monitor)" },
        signal: AbortSignal.timeout(15000)
      });
      const text = await response.text();
      const hash = createHash("sha256").update(text).digest("hex");
      const changed = Boolean(source.last_hash && source.last_hash !== hash);
      const status = !response.ok ? "failed" : changed ? "changed" : "success";
      const summary = changed ? "Official source content hash changed; review and re-index exam metadata/questions." : "Official source checked; no content-hash change detected.";
      const rpc = await client.rpc("record_exam_sync", {
        p_source_id: source.id,
        p_status: status,
        p_http_status: response.status,
        p_content_hash: hash,
        p_change_summary: summary,
        p_error_message: response.ok ? null : `HTTP ${response.status}`
      });
      results.push({ url: source.url, status, http_status: response.status, changed, duration_ms: Date.now() - started, recorded: !rpc.error });
    } catch (err) {
      const rpc = await client.rpc("record_exam_sync", {
        p_source_id: source.id,
        p_status: "failed",
        p_http_status: null,
        p_content_hash: null,
        p_change_summary: "Official source check failed.",
        p_error_message: err?.message || "fetch failed"
      });
      results.push({ url: source.url, status: "failed", error: err?.message || "fetch failed", recorded: !rpc.error });
    }
  }

  return NextResponse.json({
    ok: true,
    checked_at: new Date().toISOString(),
    sources_checked: results.length,
    changed: results.filter(item => item.changed).length,
    results
  });
}
