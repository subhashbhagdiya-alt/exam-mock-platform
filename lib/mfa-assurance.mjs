const unavailable = {
  allowed: false,
  status: 503,
  code: "MFA_STATUS_UNAVAILABLE",
  error: "Could not verify multi-factor authentication status. Please retry."
};

export function evaluateMfaAssurance(data, error = null) {
  if (error || !data || typeof data !== "object") return { ...unavailable };

  const { currentLevel, nextLevel } = data;

  // Existing accounts without MFA remain unaffected.
  if (currentLevel === "aal1" && nextLevel === "aal1") {
    return { allowed: true, mfaRequired: false };
  }

  // A verified second factor has been enrolled, but this session has not
  // completed its MFA challenge yet. Keep sensitive account APIs protected.
  if (currentLevel === "aal1" && nextLevel === "aal2") {
    return {
      allowed: false,
      status: 403,
      code: "MFA_REQUIRED",
      error: "Complete your authenticator verification before accessing saved results."
    };
  }

  if (currentLevel === "aal2" && nextLevel === "aal2") {
    return { allowed: true, mfaRequired: true };
  }

  // Supabase may report aal2 -> aal1 when a factor was removed and the JWT
  // is stale. The session no longer has an active MFA requirement.
  if (nextLevel === "aal1" && currentLevel === "aal2") {
    return { allowed: true, mfaRequired: false };
  }

  return { ...unavailable };
}

export async function checkMfaAssurance(authClient, accessToken) {
  if (!accessToken || typeof accessToken !== "string" ||
      typeof authClient?.auth?.mfa?.getAuthenticatorAssuranceLevel !== "function") {
    return { ...unavailable };
  }

  try {
    // Passing the validated access token is supported for server-side checks
    // where the Supabase client intentionally has no persisted browser session.
    const { data, error } = await authClient.auth.mfa.getAuthenticatorAssuranceLevel(accessToken);
    return evaluateMfaAssurance(data, error);
  } catch {
    return { ...unavailable };
  }
}
