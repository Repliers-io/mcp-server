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
export function createKeyResolver({ backendBaseUrl, apiKey, fetchImpl = fetch }) {
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
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );
      if (!response.ok) {
        return {
          key: null,
          lookupFailed: true,
          reason: `backend user API returned ${response.status}`,
        };
      }
      const user = await response.json();
      const key = user?.metadata?.repliers_api_key ?? null;
      return {
        key,
        lookupFailed: false,
        reason: key ? null : 'account has no repliers_api_key in PropelAuth metadata',
      };
    } catch (error) {
      return { key: null, lookupFailed: true, reason: error.message };
    }
  };
}
