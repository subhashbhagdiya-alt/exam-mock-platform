export async function mapWithConcurrency(items, concurrency, mapper) {
  if (!Array.isArray(items)) throw new TypeError("items must be an array");
  if (typeof mapper !== "function") throw new TypeError("mapper must be a function");
  if (!items.length) return [];

  const requested = Number(concurrency);
  const limit = Number.isInteger(requested) && requested >= 1 && requested <= 20 ? requested : 4;
  const results = new Array(items.length);
  let nextIndex = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

export function formatSourceFetchError(error) {
  const values = [
    error?.message,
    error?.cause?.code,
    error?.cause?.message,
    error?.code,
    error?.name
  ].filter(value => typeof value === "string" && value.trim());
  const unique = [...new Set(values)];
  return (unique.join(" | ") || "Unknown network error").slice(0, 500);
}
