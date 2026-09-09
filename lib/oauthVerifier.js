import { createHash } from 'node:crypto';
import {
  InvalidTokenError,
  ServerError,
} from '@modelcontextprotocol/sdk/server/auth/errors.js';

const cacheKey = (token) => createHash('sha256').update(token).digest('hex');
const normalise = (value) => String(value).replace(/\/+$/, '');

/**
 * The audience is echoed back to an unauthenticated caller inside an error message that the SDK
 * writes verbatim into the WWW-Authenticate header. RFC 8707 makes `resource` client-supplied, so
 * an authorization server that echoes it into `aud` would let a caller put quotes or CRLF into
 * our own response header — corrupting the challenge, or making Node reject the header outright
 * and turn a 401 into a 500 with no pointer to the metadata at all.
 */
const forHeader = (value) => String(value).replace(/[\r\n"\\]/g, '').slice(0, 200);

/**
 * RFC 7662 introspection against PropelAuth's MCP authorization server, wrapped in the SDK's
 * OAuthTokenVerifier contract so that requireBearerAuth owns the HTTP semantics: header
 * parsing, expiry, 401 vs 403, and the WWW-Authenticate challenge.
 *
 * Audience handling reads `resource` and `aud` together because PropelAuth's own documentation
 * disagrees with itself about which one it populates: the overview shows `aud`, the Go example
 * checks `resource` (docs/oauth21/design.md Q6). Consulting both removes the question from the
 * critical path; consulting only whichever is populated first would not.
 */
export function createIntrospectionVerifier({
  introspectionEndpoint,
  clientId,
  clientSecret,
  audiences,
  resolveApiKey,
  requireAudience = true,
  cacheTtlMs = 60_000,
  maxCacheEntries = 5_000,
  timeoutMs = 5_000,
  fetchImpl = fetch,
  now = () => Date.now(),
}) {
  const cache = new Map();
  const pending = new Map();

  // A TTL that came from an unset or malformed environment variable used to disable caching
  // silently — Number('') is 0, Number('60s') is NaN, and both fail the `ttl > 0` guard below —
  // sending every request to a rate-limited endpoint with nothing in the log to say why.
  const ttlMs = Number.isFinite(cacheTtlMs) && cacheTtlMs > 0 ? cacheTtlMs : 60_000;
  if (ttlMs !== cacheTtlMs) {
    console.error(`[WARN] Unusable introspection cache TTL ${cacheTtlMs}; using ${ttlMs}ms`);
  }
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
        // A half-open connection would otherwise stall for undici's default of five minutes,
        // and deduplication makes every request carrying this token wait on the same promise.
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new ServerError(`Introspection endpoint unreachable: ${error.message}`);
    }
    if (!response.ok) {
      throw new ServerError(`Introspection endpoint returned ${response.status}`);
    }
    return response.json();
  }

  /**
   * Both fields, not whichever is populated first. PropelAuth's overview documents `aud` and its
   * own Go example checks `resource` (design.md Q6); a token that names us in either one was
   * issued for us, and picking one field would reject tokens whose other field holds an internal
   * identifier.
   */
  function audiencesOf(claims) {
    return [claims.resource, claims.aud]
      .filter((raw) => raw !== undefined && raw !== null)
      .flatMap((raw) => (Array.isArray(raw) ? raw : [raw]))
      .map(normalise);
  }

  /** RFC 7662 gives scope as a space-delimited string; several servers send an array instead. */
  function scopesOf(claims) {
    if (Array.isArray(claims.scope)) return claims.scope.map(String).filter(Boolean);
    if (typeof claims.scope === 'string') return claims.scope.split(' ').filter(Boolean);
    return [];
  }

  /**
   * Bounded, because tokens rotate on every refresh: a long-running process would otherwise keep
   * one entry per token per user per refresh interval for its whole lifetime. Expired entries go
   * first; if that is not enough, the oldest insertions do, which Map iteration order gives free.
   */
  function remember(key, entry, ttl) {
    if (cache.size >= maxCacheEntries) {
      for (const [candidate, held] of cache) {
        if (held.until <= now()) cache.delete(candidate);
      }
      while (cache.size >= maxCacheEntries) cache.delete(cache.keys().next().value);
    }
    cache.set(key, { until: now() + ttl, entry });
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

    // Introspection answers for any token type; token_type_hint is only a hint. If the
    // authorization server says this credential is something other than an access token — a
    // refresh token presented as a bearer, say — believe it rather than the caller.
    const kind = String(claims.token_type ?? 'bearer').toLowerCase();
    if (kind !== 'bearer' && kind !== 'access_token') {
      throw new InvalidTokenError(`Credential is not an access token (token_type: ${forHeader(kind)})`);
    }

    const presented = audiencesOf(claims);
    const matched = presented.find((value) => audiences.has(value));
    if (!matched) {
      const named = presented.map(forHeader).join(', ') || '(absent)';
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
    const ttl = Math.min(ttlMs, Math.max(0, claims.exp * 1000 - now()));
    if (ttl > 0) remember(key, entry, ttl);
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
        scopes: scopesOf(claims),
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
