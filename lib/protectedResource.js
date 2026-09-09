import { SCOPE_READ, SCOPE_WRITE } from './scopes.js';

const stripTrailingSlash = (value) => String(value).replace(/\/+$/, '');

/**
 * The identity of this resource server, taken from configuration rather than from whatever a
 * caller put in the Host header.
 *
 * Metadata may be derived from the request — the client compares the answer against the URL it
 * just asked for, so a spoofed value only invalidates the spoofer's own copy. Audience
 * validation may not: an attacker holding a token for their own resource would send a matching
 * Host and put both sides of the comparison under their control, reducing the check to an
 * identity. See docs/oauth21/design.md §4.3.
 */
export function canonicalOrigin(env = process.env) {
  const raw = env.MCP_PUBLIC_URL;
  if (!raw) {
    throw new Error(
      'MCP_PUBLIC_URL must be set in hosted mode: audience validation cannot use a caller-supplied origin'
    );
  }
  return stripTrailingSlash(raw);
}

/** Every URI a token may legitimately name: this server answers on both paths. */
export function allowedAudiences(env = process.env) {
  const origin = canonicalOrigin(env);
  return new Set([origin, `${origin}/mcp`]);
}

export function authorizationServer(env = process.env) {
  if (env.OAUTH_MCP_ISSUER) return stripTrailingSlash(env.OAUTH_MCP_ISSUER);
  return `${stripTrailingSlash(env.OAUTH_BASE_URL || '')}/oauth/2.1`;
}

export function resourceUri(resourcePath, env = process.env) {
  const origin = canonicalOrigin(env);
  return resourcePath === '/mcp' ? `${origin}/mcp` : origin;
}

export function protectedResourceDocument(resourcePath, env = process.env) {
  return {
    resource: resourceUri(resourcePath, env),
    authorization_servers: [authorizationServer(env)],
    scopes_supported: [SCOPE_READ, SCOPE_WRITE],
    bearer_methods_supported: ['header'],
    resource_name: 'Repliers MCP Server',
  };
}

/** RFC 9728 §3.1 derives the address from the resource path. */
export function resourceMetadataUrl(resourcePath, env = process.env) {
  const suffix = resourcePath === '/mcp' ? '/mcp' : '';
  return `${canonicalOrigin(env)}/.well-known/oauth-protected-resource${suffix}`;
}
