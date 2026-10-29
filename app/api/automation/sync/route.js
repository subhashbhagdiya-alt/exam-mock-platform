import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { publicDbError } from "../../../../lib/api-errors.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// The registry is server-controlled. Keep an allowlist here as a second guard
// so an unexpected row cannot turn the scheduled checker into an arbitrary fetcher.
const OFFICIAL_HOSTS = [
  "esb.mp.gov.in",
  "rrbcdg.gov.in",
  "ssc.gov.in",
  "upsc.gov.in",
  "ctet.nic.in",
  "ugcnet.nta.ac.in",
  "jeemain.nta.nic.in",
  "neet.nta.nic.in",
  "cuet.nta.nic.in",
  "ibps.in",
  "sbi.co.in",
  "sbi.bank.in"
];
const SOURCE_BATCH_SIZE = 8;
const SOURCE_TIMEOUT_MS = 8000;

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function isAllowedOfficialUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" &&
      OFFICIAL_HOSTS.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}));
  } catch {
    return false;
  }
}

async function checkSource(client, source) {
  const started = Date.now();
  if (!isAllowedOfficialUrl(source.url)) {
    const rpc = await client.rpc("record_exam_sync", {
      p_source_id: source.id,
      p_status: "failed",
      p_http_status: null,
      p_content_hash: null,
      p_change_summary: "Source was skipped because its URL is not on the official-host allowlist.",
      p_error_message: "URL host is not allowlisted"
    });
    return { url: source.url, status: "failed", error: "URL host is not allowlisted", recorded: !rpc.error };
  }

  try {
    const response = await fetch(source.url, {
      cache: "no-store",
      headers: { "user-agent": "ExamPrep-ExamSync/1.1 (+scheduled-monitor)" },
      signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS)
    });
    const body = await response.text();
    const hash = createHash("sha256").update(body).digest("hex");
    const changed = Boolean(source.last_hash && source.last_hash !== hash);
    const status = !response.ok ? "failed" : changed ? "changed" : "success";
    const summary = !response.ok
      ? `Official source returned HTTP ${response.status}; inspect availability before using it as evidence.`
      : changed
        ? "Official source content hash changed; inspect the source and review/re-index exam metadata or questions."
        : "Official source checked; no content-hash change detected.";
    const rpc = await client.rpc("record_exam_sync", {
      p_source_id: source.id,
      p_status: status,
      p_http_status: response.status,
      p_content_hash: hash,
      p_change_summary: summary,
      p_error_message: response.ok ? null : `HTTP ${response.status}`
    });
    return {
      url: source.url,
      status,
      http_status: response.status,
      changed,
      duration_ms: Date.now() - started,
      recorded: !rpc.error,
      record_error: rpc.error?.message || null
    };
  } catch (err) {
    const detail = [err?.name, err?.cause?.code, err?.message]
      .filter((part, index, all) => part && all.indexOf(part) === index)
      .join(": ")
      .slice(0, 240) || "fetch failed";
    const rpc = await client.rpc("record_exam_sync", {
      p_source_id: source.id,
      p_status: "failed",
      p_http_status: null,
      p_content_hash: null,
      p_change_summary: "Official source check failed; diagnostic details were recorded for troubleshooting.",
      p_error_message: detail
    });
    return {
      url: source.url,
      status: "failed",
      error: detail,
      duration_ms: Date.now() - started,
      recorded: !rpc.error,
      record_error: rpc.error?.message || null
    };
  }
}

export async function GET(request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Server database credentials are not configured" }, { status: 503 });
  }

  const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  // Rotate through every active registered source, oldest/never checked first.
  // Eight concurrent requests keep the daily run bounded while covering all boards.
  const { data: sources, error } = await client
    .from("exam_sources")
    .select("id,board,name,url,last_hash,last_checked_at,created_at")
    .eq("active", true)
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true })
    .limit(SOURCE_BATCH_SIZE);
  if (error) return publicDbError("Exam source sync", error);

  const results = await Promise.all((sources || []).map((source) => checkSource(client, source)));
  const counts = results.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    ok: results.every((item) => item.recorded),
    checked_at: new Date().toISOString(),
    registered_active_sources: (sources || []).length,
    source_batch_size: SOURCE_BATCH_SIZE,
    status_counts: counts,
    changed: results.filter((item) => item.changed).length,
    results
  });
}
