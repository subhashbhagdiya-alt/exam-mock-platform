import assert from "node:assert/strict";
import { checkMfaAssurance, evaluateMfaAssurance } from "../lib/mfa-assurance.mjs";

assert.deepEqual(
  evaluateMfaAssurance({ currentLevel: "aal1", nextLevel: "aal1" }),
  { allowed: true, mfaRequired: false }
);

const stepUp = evaluateMfaAssurance({ currentLevel: "aal1", nextLevel: "aal2" });
assert.equal(stepUp.allowed, false);
assert.equal(stepUp.status, 403);
assert.equal(stepUp.code, "MFA_REQUIRED");

assert.deepEqual(
  evaluateMfaAssurance({ currentLevel: "aal2", nextLevel: "aal2" }),
  { allowed: true, mfaRequired: true }
);

assert.deepEqual(
  evaluateMfaAssurance({ currentLevel: "aal2", nextLevel: "aal1" }),
  { allowed: true, mfaRequired: false }
);

assert.equal(evaluateMfaAssurance(null).code, "MFA_STATUS_UNAVAILABLE");
assert.equal(evaluateMfaAssurance({ currentLevel: "unknown", nextLevel: "unknown" }).status, 503);
assert.equal(evaluateMfaAssurance({ currentLevel: "aal1", nextLevel: "aal1" }, new Error("network")).status, 503);

let seenToken = "";
const mockedClient = {
  auth: {
    mfa: {
      async getAuthenticatorAssuranceLevel(token) {
        seenToken = token;
        return { data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null };
      }
    }
  }
};
const guarded = await checkMfaAssurance(mockedClient, "validated-access-token");
assert.equal(seenToken, "validated-access-token");
assert.equal(guarded.code, "MFA_REQUIRED");

const unavailable = await checkMfaAssurance({
  auth: { mfa: { async getAuthenticatorAssuranceLevel() { throw new Error("network"); } } }
}, "validated-access-token");
assert.equal(unavailable.allowed, false);
assert.equal(unavailable.status, 503);

console.log("MFA assurance tests passed.");
