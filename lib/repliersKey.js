/**
 * Resolves the Repliers API key a caller's tool calls are served with.
 *
 * Isolated in its own module because it rests on one unverified assumption: that `sub` in a
 * PropelAuth MCP introspection response is the same user id the backend user API accepts
 * (docs/oauth21/design.md Q5). If that turns out to be false, this file is the only one that
 * changes — see docs/oauth21/plan.md Task 12.
 *
 * `lookupFailed` separates "we could not ask PropelAuth" from "this account has no key". Both
 * end in no key, but different people fix them, and they answer with different HTTP statuses.
 */
/**
 * A status alone says nothing about who has to fix it, and this call fails on the day of a
 * cutover when nobody is in a position to guess. 401/403 is our own credential being refused;
 * 404 is the token's `sub` not being an id this API knows, which is the Q5 assumption failing.
 */
function explain(status, backendBaseUrl) {
  const where = `${backendBaseUrl}/api/backend/v1/user/...`;
  if (status === 401 || status === 403) {
    return (
      `PROPELAUTH_API_KEY was rejected by ${where} (${status}). The key is wrong or revoked, is ` +
      `not a Backend Integration API key, or belongs to a different PropelAuth environment than ` +
      `OAUTH_BASE_URL points at.`
    );
  }
  if (status === 404) {
    return (
      `${where} does not know this user (404). PROPELAUTH_API_KEY is being accepted, so the ` +
      `introspection 'sub' is not an id the backend user API takes -- see docs/oauth21/design.md Q5.`
    );
  }
  if (status >= 500) {
    return `PropelAuth's backend user API is failing: ${where} returned ${status}.`;
  }
  return `${where} returned ${status}.`;
}

export function createKeyResolver({ backendBaseUrl, apiKey, fetchImpl = fetch, timeoutMs = 5_000 }) {
  return async function resolve(userId) {
    if (!apiKey) {
      return { key: null, lookupFailed: true, reason: 'PROPELAUTH_API_KEY is not set' };
    }
    if (!userId) {
      return { key: null, lookupFailed: true, reason: 'introspection response carried no sub' };
    }

    try {
      // Encoded, not interpolated raw. `sub` comes from the authorization server rather than the
      // caller, but design.md Q5 records its shape as unverified — and a composite or pseudonymous
      // value containing path or query characters would silently retarget this request, which
      // carries our own PropelAuth API key, at a different endpoint instead of failing.
      const response = await fetchImpl(
        `${backendBaseUrl}/api/backend/v1/user/${encodeURIComponent(userId)}`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
          // This call runs on every request, so a stalled connection here stalls the whole
          // server for the caller rather than failing one lookup.
          signal: AbortSignal.timeout(timeoutMs),
        }
      );
      if (!response.ok) {
        return { key: null, lookupFailed: true, reason: explain(response.status, backendBaseUrl) };
      }
      const user = await response.json();
      const key = user?.metadata?.repliers_api_key ?? null;
      return {
        key,
        lookupFailed: false,
        reason: key ? null : 'account has no repliers_api_key in PropelAuth metadata',
      };
    } catch (error) {
      return {
        key: null,
        lookupFailed: true,
        reason: `could not reach the PropelAuth backend user API at ${backendBaseUrl}: ${error.message}`,
      };
    }
  };
}
