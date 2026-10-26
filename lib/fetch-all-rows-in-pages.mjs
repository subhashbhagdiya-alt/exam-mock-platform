// Fetch every row from Supabase/PostgREST queries that may be capped by the server's max-row setting.
// Callers should provide a stable order and select count: "exact" so a short capped page is not mistaken for EOF.
export async function fetchAllRowsInPages(fetchPage, pageSize = 1000) {
  if (typeof fetchPage !== "function") throw new TypeError("fetchPage must be a function");
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new RangeError("pageSize must be a positive integer");

  const rows = [];
  let offset = 0;
  let expectedCount = null;

  while (true) {
    const { data, error, count } = await fetchPage(offset, offset + pageSize - 1);
    if (error) return { data: null, error };

    if (Number.isSafeInteger(count) && count >= 0) expectedCount = count;
    const page = Array.isArray(data) ? data : [];

    if (page.length === 0) {
      if (expectedCount !== null && rows.length < expectedCount) {
        return { data: null, error: new Error("A paginated query ended before its exact row count was reached.") };
      }
      return { data: rows, error: null };
    }

    rows.push(...page);
    if (expectedCount !== null && rows.length >= expectedCount) {
      return { data: rows.slice(0, expectedCount), error: null };
    }

    // Advance by rows actually returned, not by requested range size: a server-side row cap
    // can return fewer than pageSize while more rows still exist.
    offset += page.length;
    if (expectedCount === null && page.length < pageSize) return { data: rows, error: null };
  }
}
