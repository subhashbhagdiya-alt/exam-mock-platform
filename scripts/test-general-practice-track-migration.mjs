import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(new URL("../supabase/migrations/20261110100000_add_general_practice_job_tracks.sql", import.meta.url), "utf8");

for (const slug of ["mpesb-general", "ssc-general"]) {
  assert.ok(migration.includes("e.slug = '" + slug + "'"), "Migration should link the existing active exam: " + slug);
}
for (const trackSlug of ["mpesb-general-practice", "ssc-general-practice"]) {
  assert.ok(migration.includes("'" + trackSlug + "'"), "Migration should insert the board-wide track: " + trackSlug);
}
assert.equal((migration.match(/ON CONFLICT \(slug\) DO NOTHING;/g) || []).length, 2);
assert.equal((migration.match(/e\.is_active IS TRUE/g) || []).length, 2);
assert.equal((migration.match(/q\.active IS TRUE/g) || []).length, 2);
assert.equal((migration.match(/q\.verified IS TRUE/g) || []).length, 2);
assert.equal((migration.match(/\) >= e\.total_questions/g) || []).length, 2);
assert.equal(/\b(DELETE FROM|UPDATE public\.job_tracks|TRUNCATE)\b/i.test(migration), false, "This migration should not delete or overwrite existing tracks.");

console.log("General-practice job-track migration checks passed.");
