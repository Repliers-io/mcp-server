import test from "node:test";
import assert from "node:assert/strict";
import {
  allowedAudiences,
  authorizationServer,
  canonicalOrigin,
  protectedResourceDocument,
  resourceMetadataUrl,
} from "../lib/protectedResource.js";

const env = {
  MCP_PUBLIC_URL: "https://mcp.repliers.io/",
  OAUTH_BASE_URL: "https://auth.repliers.com",
};

test("the canonical origin is normalised and comes from configuration", () => {
  assert.equal(canonicalOrigin(env), "https://mcp.repliers.io");
});

// Audience validation must never compare two caller-controlled values, so an unset
// MCP_PUBLIC_URL is a startup failure rather than a fallback to the Host header.
test("an unset MCP_PUBLIC_URL is fatal, not defaulted", () => {
  assert.throws(() => canonicalOrigin({}), /MCP_PUBLIC_URL/);
});

// A scheme-less value is an easy paste error in a variable nobody has set before. Non-empty is
// not enough: it would pass the startup check, publish unusable metadata, and then throw inside
// new URL() on the first accepted token, turning every authenticated request into an opaque 500.
test("an MCP_PUBLIC_URL that is not an absolute URL is fatal too", () => {
  assert.throws(() => canonicalOrigin({ MCP_PUBLIC_URL: "mcp.repliers.io" }), /MCP_PUBLIC_URL/);
  assert.throws(() => canonicalOrigin({ MCP_PUBLIC_URL: "   " }), /MCP_PUBLIC_URL/);
});

test("both paths the server answers on are accepted audiences", () => {
  const audiences = allowedAudiences(env);
  assert.ok(audiences.has("https://mcp.repliers.io"));
  assert.ok(audiences.has("https://mcp.repliers.io/mcp"));
  assert.equal(audiences.has("https://evil.example/mcp"), false);
});

test("the authorization server defaults to PropelAuth's MCP subsystem", () => {
  assert.equal(authorizationServer(env), "https://auth.repliers.com/oauth/2.1");
  assert.equal(
    authorizationServer({ ...env, OAUTH_MCP_ISSUER: "https://elsewhere.test/as" }),
    "https://elsewhere.test/as"
  );
});

test("each path gets its own document naming its own resource", () => {
  const root = protectedResourceDocument("/", env);
  const mcp = protectedResourceDocument("/mcp", env);
  assert.equal(root.resource, "https://mcp.repliers.io");
  assert.equal(mcp.resource, "https://mcp.repliers.io/mcp");
  assert.deepEqual(mcp.authorization_servers, ["https://auth.repliers.com/oauth/2.1"]);
  assert.deepEqual(mcp.bearer_methods_supported, ["header"]);
});

// RFC 9728 §3.1: the document describing /mcp lives one path segment deep.
test("metadata URLs follow the resource path", () => {
  assert.equal(
    resourceMetadataUrl("/", env),
    "https://mcp.repliers.io/.well-known/oauth-protected-resource"
  );
  assert.equal(
    resourceMetadataUrl("/mcp", env),
    "https://mcp.repliers.io/.well-known/oauth-protected-resource/mcp"
  );
});
