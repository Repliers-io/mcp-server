// The authorization-server half of the fake PropelAuth: RFC 8414 metadata, RFC 7591 dynamic
// registration, and an authorization-code flow with PKCE and RFC 8707 resource indicators.
//
// It exists so a real MCP client can be driven through a complete login against this server
// without a browser and without the live tenant. Every request is recorded, so a test can assert
// what the client actually sent — which is the half of the contract our own unit tests cannot
// reach, and the half that has broken twice.
//
// Deliberately not a general-purpose authorization server: it approves every authorization
// request without asking anyone, because the user-consent step is not what is under test.
import { createHash, randomUUID } from "node:crypto";

const ISSUER_PATH = "/oauth/2.1";

function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
  });
}

const json = (res, status, payload) =>
  res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(payload));

/** base64url(SHA-256(verifier)), the S256 code challenge of RFC 7636. */
const s256 = (verifier) => createHash("sha256").update(verifier).digest("base64url");

export function createAuthorizationServerState() {
  return {
    /** Set once the socket is listening, because every URL it publishes contains its port. */
    origin: null,
    clients: new Map(), // client_id -> { redirect_uris }
    codes: new Map(), // code -> { clientId, challenge, resource, scope, redirectUri }
    issued: new Map(), // access token -> introspection claims
    /** Everything the client sent, for assertions. */
    seen: { register: [], authorize: [], token: [] },
  };
}

/**
 * Handles the authorization-server endpoints. Returns true when it answered the request, so the
 * surrounding fake can fall through to its own routes.
 */
export async function handleAuthorizationServer(req, res, state) {
  const url = new URL(req.url, state.origin ?? "http://localhost");
  const path = url.pathname;

  // RFC 8414 §3.1 with path insertion. This is the only address an MCP client tries first for an
  // issuer with a path component, which is why Q1 in the design matters.
  if (path === `/.well-known/oauth-authorization-server${ISSUER_PATH}`) {
    json(res, 200, {
      issuer: `${state.origin}${ISSUER_PATH}`,
      authorization_endpoint: `${state.origin}${ISSUER_PATH}/authorize`,
      token_endpoint: `${state.origin}${ISSUER_PATH}/token`,
      registration_endpoint: `${state.origin}${ISSUER_PATH}/register`,
      introspection_endpoint: `${state.origin}${ISSUER_PATH}/introspect`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["client_secret_post", "none"],
      scopes_supported: ["mcp:read", "mcp:write"],
    });
    return true;
  }

  if (path === `${ISSUER_PATH}/register` && req.method === "POST") {
    const body = JSON.parse((await readBody(req)) || "{}");
    state.seen.register.push(body);
    const clientId = `client-${randomUUID()}`;
    state.clients.set(clientId, { redirect_uris: body.redirect_uris ?? [] });
    json(res, 201, {
      client_id: clientId,
      redirect_uris: body.redirect_uris ?? [],
      grant_types: body.grant_types ?? ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    });
    return true;
  }

  if (path === `${ISSUER_PATH}/authorize`) {
    const q = Object.fromEntries(url.searchParams);
    state.seen.authorize.push(q);

    const client = state.clients.get(q.client_id);
    if (!client) return json(res, 400, { error: "invalid_client" });
    if (!client.redirect_uris.includes(q.redirect_uri)) {
      return json(res, 400, { error: "invalid_request", error_description: "unregistered redirect_uri" });
    }
    if (q.code_challenge_method !== "S256" || !q.code_challenge) {
      return json(res, 400, { error: "invalid_request", error_description: "PKCE S256 required" });
    }

    const code = randomUUID();
    state.codes.set(code, {
      clientId: q.client_id,
      challenge: q.code_challenge,
      resource: q.resource,
      scope: q.scope,
      redirectUri: q.redirect_uri,
    });

    // Approved without asking anyone: consent is not what this rehearsal tests.
    const back = new URL(q.redirect_uri);
    back.searchParams.set("code", code);
    if (q.state) back.searchParams.set("state", q.state);
    res.writeHead(302, { location: back.href }).end();
    return true;
  }

  if (path === `${ISSUER_PATH}/token` && req.method === "POST") {
    const params = new URLSearchParams(await readBody(req));
    const body = Object.fromEntries(params);
    state.seen.token.push(body);

    const record = state.codes.get(body.code);
    if (!record) return json(res, 400, { error: "invalid_grant" });
    state.codes.delete(body.code);

    if (s256(body.code_verifier ?? "") !== record.challenge) {
      return json(res, 400, { error: "invalid_grant", error_description: "PKCE verification failed" });
    }

    const issuedAt = Math.floor(Date.now() / 1000);
    const accessToken = `at-${randomUUID()}`;

    // RFC 8707: the audience is bound to the resource the client asked for. Whether the live
    // PropelAuth does this is design.md Q7 — here it is assumed, so the rest of the chain can be
    // exercised, and the test asserts what the client requested rather than what we hoped.
    state.issued.set(accessToken, {
      active: true,
      sub: state.loginAs ?? "user-alice",
      username: state.loginEmail ?? "alice@example.test",
      client_id: body.client_id ?? record.clientId,
      scope: record.scope ?? "mcp:read mcp:write",
      aud: body.resource ?? record.resource,
      iat: issuedAt,
      exp: issuedAt + 3600,
    });

    json(res, 200, {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 3600,
      scope: record.scope ?? "mcp:read mcp:write",
      refresh_token: `rt-${randomUUID()}`,
    });
    return true;
  }

  return false;
}
