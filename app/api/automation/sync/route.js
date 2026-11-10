import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { formatSourceFetchError, mapWithConcurrency } from "../../../../lib/exam-source-sync.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SOURCE_CHECK_CONCURRENCY = 6;
const SOURCE_FETCH_TIMEOUT_MS = 10_000;
const MAX_SOURCE_RESPONSE_BYTES = 3 * 1024 * 1024;


function authorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}

async function readLimitedResponseBody(response, maxBytes) {
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error("Source response exceeded the 3 MB inspection limit.");
  }

  if (!response.body?.getReader) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maxBytes) throw new Error("Source response exceeded the 3 MB inspection limit.");
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new Error("Source response exceeded the 3 MB inspection limit.");
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}

async function recordSourceResult(client, source, {
  status, httpStatus = null, contentHash = null, summary, errorMessage = null, started
}) {
  const rpc = await client.rpc("record_exam_sync", {
    p_source_id: source.id,
    p_status: status,
    p_http_status: httpStatus,
    p_content_hash: contentHash,
    p_change_summary: summary,
    p_error_message: errorMessage
  });
  return {
    board: source.board || "Unknown",
    name: source.name || source.url,
    url: source.url,
    status,
    http_status: httpStatus,
    changed: status === "changed",
    duration_ms: Date.now() - started,
    recorded: !rpc.error,
    ...(rpc.error ? { record_error: rpc.error.message } : {}),
    ...(errorMessage ? { error: errorMessage } : {})
  };
}

async function checkSource(client, source) {
  const started = Date.now();
  try {
    const parsed = new URL(source.url);
    if (parsed.protocol !== "https:") {
      throw new Error("Only HTTPS official source URLs are permitted.");
    }

    const response = await fetch(parsed.toString(), {
      cache: "no-store",
      redirect: "follow",
      headers: { "user-agent": "ExamPrep-ExamSync/1.0 (+scheduled-monitor)", accept: "text/html,application/pdf,*/*;q=0.8" },
      signal: AbortSignal.timeout(SOURCE_FETCH_TIMEOUT_MS)
    });
    if (!response.ok) {
      return await recordSourceResult(client, source, {
        status: "failed",
        httpStatus: response.status,
        summary: "Official source check returned HTTP " + response.status + ".",
        errorMessage: "HTTP " + response.status + (response.statusText ? " " + response.statusText : ""),
        started
      });
    }

    const body = await readLimitedResponseBody(response, MAX_SOURCE_RESPONSE_BYTES);
    const hash = createHash("sha256").update(body).digest("hex");
    const changed = Boolean(source.last_hash && source.last_hash !== hash);
    return await recordSourceResult(client, source, {
      status: changed ? "changed" : "success",
      httpStatus: response.status,
      contentHash: hash,
      summary: changed
        ? "Official source content hash changed; review and re-index exam metadata/questions."
        : "Official source checked; no content-hash change detected.",
      started
    });
  } catch (error) {
    const details = formatSourceFetchError(error);
    return await recordSourceResult(client, source, {
      status: "failed",
      httpStatus: null,
      contentHash: null,
      summary: "Official source check failed.",
      errorMessage: details,
      started
    });
  }
}

export async function GET(request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Server database credentials are not configured" }, { status: 503 });

  const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: sources, error } = await client
    .from("exam_sources")
    .select("id,board,name,url,last_hash,last_checked_at")
    .eq("active", true)
    .order("board", { ascending: true })
    .order("name", { ascending: true })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const activeSources = sources || [];
  const results = await mapWithConcurrency(
    activeSources,
    SOURCE_CHECK_CONCURRENCY,
    (source) => checkSource(client, source)
  );
  const failed = results.filter(item => item.status === "failed").length;
  const changed = results.filter(item => item.status === "changed").length;
  const recordedFailures = results.filter(item => item.recorded === false).length;

  return NextResponse.json({
    ok: recordedFailures === 0,
    checked_at: new Date().toISOString(),
    sources_registered: activeSources.length,
    sources_checked: results.length,
    successful: results.filter(item => item.status === "success").length,
    changed,
    failed,
    record_write_failures: recordedFailures,
    concurrency: SOURCE_CHECK_CONCURRENCY,
    timeout_ms: SOURCE_FETCH_TIMEOUT_MS,
    max_response_bytes: MAX_SOURCE_RESPONSE_BYTES,
    results
  });
}
