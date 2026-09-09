#!/usr/bin/env node
// Answers the open questions in docs/oauth21/design.md §5 against a live PropelAuth tenant.
//
//   node scripts/probe-propelauth.mjs https://auth.repliers.com [access-token]
//
// Without a token it answers Q1-Q4 from the authorization server metadata alone. With one --
// obtained by logging in from any MCP client -- it also answers Q5-Q8, which decide whether the
// forks in docs/oauth21/plan.md Tasks 12 and 13 are needed.
//
// Q5-Q8 additionally need the credentials in the environment:
//   PROPELAUTH_MCP_INTROSPECT_CLIENT_ID, PROPELAUTH_MCP_INTROSPECT_CLIENT_SECRET
//   PROPELAUTH_API_KEY  (for Q5 only)
//
// Exit codes: 0 every check passed, 1 something failed, 2 the probe was invoked wrongly.

const [authUrl, token] = process.argv.slice(2);
if (!authUrl) {
  console.error("usage: probe-propelauth.mjs <auth-url> [access-token]");
  process.exit(2);
}

const base = authUrl.replace(/\/+$/, "");
const issuer = `${base}/oauth/2.1`;
const verdicts = [];

const say = (id, ok, detail) => {
  verdicts.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${id}  ${detail}`);
};

async function status(url) {
  try {
    const res = await fetch(url);
    return { code: res.status, body: res.ok ? await res.json().catch(() => null) : null };
  } catch (error) {
    return { code: 0, body: null, error: error.message };
  }
}

// Q1: clients try the path-insertion address first and never try the appended
// oauth-authorization-server form, so serving only the latter is invisible to them.
const insertion = await status(`${base}/.well-known/oauth-authorization-server/oauth/2.1`);
const appended = await status(`${issuer}/.well-known/oauth-authorization-server`);
const oidcAppended = await status(`${issuer}/.well-known/openid-configuration`);
say(
  "Q1",
  insertion.code === 200,
  `path-insertion ${insertion.code}, appended ${appended.code}, oidc-appended ${oidcAppended.code}`
);

const metadata = insertion.body ?? appended.body ?? oidcAppended.body;
if (!metadata) {
  console.log("\nNo authorization server metadata at any address. MCP Auth is not enabled on this");
  console.log("tenant -- stop here and see docs/oauth21/design.md §6 for the dashboard checklist.");
  process.exit(1);
}

say(
  "Q2",
  Boolean(metadata.registration_endpoint),
  `registration_endpoint: ${metadata.registration_endpoint ?? "absent"}`
);
say(
  "Q3",
  Array.isArray(metadata.code_challenge_methods_supported),
  `code_challenge_methods_supported: ${JSON.stringify(metadata.code_challenge_methods_supported ?? null)}`
);
say(
  "Q4",
  (metadata.grant_types_supported ?? []).includes("refresh_token"),
  `grant_types_supported: ${JSON.stringify(metadata.grant_types_supported ?? null)}`
);
console.log(
  `INFO  CIMD  client_id_metadata_document_supported: ${metadata.client_id_metadata_document_supported ?? "absent"}`
);
console.log(
  `INFO  Q9    scopes_supported: ${JSON.stringify(metadata.scopes_supported ?? null)}`
);

if (!token) {
  console.log("\nNo access token supplied -- Q5-Q8 unanswered.");
  console.log("Log in from an MCP client, then rerun with the token as the second argument.");
  process.exit(verdicts.some((v) => !v.ok) ? 1 : 0);
}

const introspectId = process.env.PROPELAUTH_MCP_INTROSPECT_CLIENT_ID;
const introspectSecret = process.env.PROPELAUTH_MCP_INTROSPECT_CLIENT_SECRET;
if (!introspectId || !introspectSecret) {
  console.error(
    "\nSet PROPELAUTH_MCP_INTROSPECT_CLIENT_ID and PROPELAUTH_MCP_INTROSPECT_CLIENT_SECRET to answer Q5-Q8."
  );
  process.exit(2);
}

const introspection = await fetch(`${issuer}/introspect`, {
  method: "POST",
  headers: {
    Authorization: `Basic ${Buffer.from(`${introspectId}:${introspectSecret}`).toString("base64")}`,
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: new URLSearchParams({ token, token_type_hint: "access_token" }).toString(),
});

if (!introspection.ok) {
  console.error(`\nIntrospection endpoint returned ${introspection.status}; Q5-Q8 unanswered.`);
  process.exit(1);
}

const claims = await introspection.json();
console.log("\nIntrospection response:\n", JSON.stringify(claims, null, 2), "\n");

say(
  "Q6",
  claims.aud !== undefined || claims.resource !== undefined,
  `aud: ${JSON.stringify(claims.aud ?? null)}, resource: ${JSON.stringify(claims.resource ?? null)}`
);
say(
  "Q7",
  Boolean(claims.aud ?? claims.resource),
  "an audience being present is what shows the resource parameter was honoured"
);
say("Q8", claims.org_id !== undefined, `org_id: ${claims.org_id ?? "absent"}`);

// Not a numbered question, but a hard blocker: requireBearerAuth rejects every token whose
// AuthInfo carries no numeric expiry, so an introspection response without exp ships nothing.
say("exp", typeof claims.exp === "number", `exp: ${claims.exp ?? "absent"}`);

// Q5 is the one that can invalidate the design: the whole Repliers-key chain assumes `sub` is
// the id the backend user API accepts.
if (process.env.PROPELAUTH_API_KEY && claims.sub) {
  const user = await fetch(`${base}/api/backend/v1/user/${claims.sub}`, {
    headers: { Authorization: `Bearer ${process.env.PROPELAUTH_API_KEY}` },
  });
  const body = user.ok ? await user.json() : null;
  say(
    "Q5",
    user.ok,
    `backend user API returned ${user.status}; repliers_api_key ${body?.metadata?.repliers_api_key ? "found" : "absent"}`
  );
} else {
  console.log("INFO  Q5    set PROPELAUTH_API_KEY to check the sub -> backend user API assumption");
}

const failed = verdicts.filter((v) => !v.ok).map((v) => v.id);
console.log(failed.length ? `\nFailed: ${failed.join(", ")}` : "\nAll checks passed.");
process.exit(failed.length ? 1 : 0);
