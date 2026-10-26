import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
const handlers = new Map();
const cachedUrls = [];
const cache = {
  async match() { return null; },
  async put(request) { cachedUrls.push(request.url); },
  async keys() { return []; }
};
const caches = {
  async open() { return cache; },
  async match() { return null; },
  async keys() { return ["examprep-v4"]; },
  async delete() { return true; }
};
const workerSelf = {
  location: { origin: "https://exam-prep.test" },
  clients: { async claim() {} },
  addEventListener(name, handler) { handlers.set(name, handler); },
  async skipWaiting() {}
};
const context = {
  self: workerSelf,
  caches,
  URL,
  Response,
  Promise,
  JSON,
  fetch: async () => new Response('{"meta":{"available":2}}', {
    status: 200,
    headers: { "content-type": "application/json" }
  })
};
vm.runInNewContext(source, context);

const onFetch = handlers.get("fetch");
assert.equal(typeof onFetch, "function", "Service worker should install a fetch handler");

let sessionResponseWasIntercepted = false;
onFetch({
  request: { method: "GET", url: "https://exam-prep.test/api/questions?exam=mpesb&limit=10" },
  respondWith() { sessionResponseWasIntercepted = true; }
});
assert.equal(sessionResponseWasIntercepted, false, "Generated test sessions must pass directly to the network");
assert.deepEqual(cachedUrls, [], "Generated test sessions must not be written to Cache Storage");

let availabilityPromise;
onFetch({
  request: { method: "GET", url: "https://exam-prep.test/api/questions?exam=mpesb&limit=100&mode=availability" },
  respondWith(value) { availabilityPromise = value; }
});
assert.ok(availabilityPromise, "Availability lookups should be handled for offline support");
await availabilityPromise;
await new Promise(resolve => setImmediate(resolve));
assert.equal(cachedUrls.length, 1, "Only the availability response should be cached");
assert.match(cachedUrls[0], /mode=availability/);

console.log("Service worker question-session cache policy tests passed.");
