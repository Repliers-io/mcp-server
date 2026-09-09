import { createHash } from 'node:crypto';
import {
  InvalidTokenError,
  ServerError,
} from '@modelcontextprotocol/sdk/server/auth/errors.js';

const cacheKey = (token) => createHash('sha256').update(token).digest('hex');
const normalise = (value) => String(value).replace(/\/+$/, '');

/**
 * RFC 7662 introspection against PropelAuth's MCP authorization server, wrapped in the SDK's
 * OAuthTokenVerifier contract so that requireBearerAuth owns the HTTP semantics: header
 * parsing, expiry, 401 vs 403, and the WWW-Authenticate challenge.
 *
 * Audience handling reads `resource` first and `aud` second because PropelAuth's own
 * documentation disagrees with itself about which one it populates: the overview shows `aud`,
 * the Go example checks `resource` (docs/oauth21/design.md Q6). Accepting both costs one line
 * and removes the question from the critical path.
 */
export function createIntrospectionVerifier({
  introspectionEndpoint,
  clientId,
  clientSecret,
  audiences,
  resolveApiKey,
  requireAudience = true,
  cacheTtlMs = 60_000,
  fetchImpl = fetch,
  now = () => Date.now(),
}) {
  const cache = new Map();
  const pending = new Map();
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  async function introspect(token) {
    let response;
    try {
      response = await fetchImpl(introspectionEndpoint, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ token, token_type_hint: 'access_token' }).toString(),
      });
    } catch (error) {
      throw new ServerError(`Introspection endpoint unreachable: ${error.message}`);
    }
    if (!response.ok) {
      throw new ServerError(`Introspection endpoint returned ${response.status}`);
    }
    return response.json();
  }

  function audiencesOf(claims) {
    const raw = claims.resource ?? claims.aud;
    if (raw === undefined || raw === null) return [];
    return (Array.isArray(raw) ? raw : [raw]).map(normalise);
  }

  /**
   * Introspects and validates, or replays a recent verdict for the same token.
   *
   * Synchronous up to the point where the in-flight promise is registered, which is what makes
   * the deduplication below work: an MCP client opens several connections at once carrying the
   * same freshly issued token, and all of them miss a cold cache.
   */
  function validatedClaims(token) {
    const key = cacheKey(token);
    const hit = cache.get(key);
    if (hit && hit.until > now()) return Promise.resolve(hit.entry);

    const alreadyAsking = pending.get(key);
    if (alreadyAsking) return alreadyAsking;

    // Cleared on failure as well as success: a rejected introspection must not be left behind as
    // this token's standing answer.
    const ask = introspectAndValidate(token, key).finally(() => pending.delete(key));
    pending.set(key, ask);
    return ask;
  }

  async function introspectAndValidate(token, key) {
    const claims = await introspect(token);
    if (claims.active !== true) throw new InvalidTokenError('Token is not active');

    const presented = audiencesOf(claims);
    const matched = presented.find((value) => audiences.has(value));
    if (!matched) {
      const named = presented.join(', ') || '(absent)';
      if (requireAudience) {
        throw new InvalidTokenError(`Token audience ${named} does not name this server`);
      }
      console.error(`[WARN] Accepting a token whose audience does not name us: ${named}`);
    }

    // requireBearerAuth rejects any AuthInfo without a numeric expiresAt, which would reach
    // the client as a blanket authentication failure. Say what actually happened instead.
    if (typeof claims.exp !== 'number') {
      throw new ServerError(
        'Introspection response carries no numeric exp; token expiry cannot be enforced'
      );
    }

    const entry = { claims, matched };

    // Clamped by the token's own life: a cache entry that outlived the token would keep
    // serving an authorization the authorization server has already ended.
    const ttl = Math.min(cacheTtlMs, Math.max(0, claims.exp * 1000 - now()));
    if (ttl > 0) cache.set(key, { until: now() + ttl, entry });
    return entry;
  }

  return {
    async verifyAccessToken(token) {
      const { claims, matched } = await validatedClaims(token);

      // Deliberately outside the cache. The Repliers key is resolved on every request rather
      // than captured once, so a key rotated or revoked in PropelAuth takes effect on the next
      // call instead of living on for the lifetime of a session — an invariant this server has
      // and tests for. Caching the introspection verdict saves the rate-limited call; caching
      // the key would quietly extend the life of a revoked one.
      const { key: repliersApiKey, lookupFailed, reason } = await resolveApiKey(claims.sub);

      return {
        token,
        clientId: claims.client_id ?? 'unknown',
        scopes:
          typeof claims.scope === 'string' ? claims.scope.split(' ').filter(Boolean) : [],
        expiresAt: claims.exp,
        resource: matched ? new URL(matched) : undefined,
        extra: {
          userId: claims.sub,
          orgId: claims.org_id,
          repliersApiKey,
          keyLookupFailed: lookupFailed,
          keyReason: reason,
        },
      };
    },
  };
}
