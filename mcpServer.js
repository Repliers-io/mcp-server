#!/usr/bin/env node

import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "crypto";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { discoverTools, toolAnnotations } from "./lib/tools.js";
import { augmentResult } from "./lib/feedbackHints.js";
import { buildServerInstructions } from "./lib/serverInstructions.js";
import { apiBaseUrl } from "./lib/apiBase.js";
import { createIntrospectionVerifier } from "./lib/oauthVerifier.js";
import { createKeyResolver } from "./lib/repliersKey.js";
import { SCOPE_READ, requiredScope } from "./lib/scopes.js";
import {
  allowedAudiences,
  protectedResourceDocument,
  resourceMetadataUrl,
} from "./lib/protectedResource.js";

import path from "path";
import { fileURLToPath } from "url";
import fs from "fs"; // Added for file system checks

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.error("[DEBUG] MCP Server starting...");

// --- SECURITY IMPROVEMENTS START ---
// Verify script permissions before proceeding
try {
  const scriptPath = path.resolve(__dirname, "mcpServer.js");
  fs.accessSync(scriptPath, fs.constants.R_OK);
  console.error("[DEBUG] Script permissions verified");
} catch (err) {
  console.error("[FATAL] Permission error accessing main script:");
  console.error(`[FATAL] ${err.message}`);
  console.error("[FATAL] Run: chmod u+rwx " + path.resolve(__dirname));
  process.exit(1);
}

// Enhanced environment loading with error handling
const envPath = path.resolve(__dirname, ".env");
try {
  if (fs.existsSync(envPath)) {
    process.loadEnvFile(envPath);
    console.error("[DEBUG] Environment loaded from", envPath);
  } else {
    console.error("[WARN] .env file not found at", envPath);
  }
} catch (err) {
  console.error("[FATAL] Error loading .env file:", err);
  process.exit(1);
}
// --- SECURITY IMPROVEMENTS END ---

// Verify required environment variables
const REQUIRED_ENV = [];

let missingVars = [];
REQUIRED_ENV.forEach((env) => {
  if (!process.env[env]) {
    console.error(`[FATAL] Missing required environment variable: ${env}`);
    missingVars.push(env);
  }
});

if (missingVars.length > 0) {
  console.error("[FATAL] Server cannot start without required variables");
  process.exit(1);
}

// The OAuth variables are checked inside the HTTP branch instead, where we know whether this
// deployment is hosted at all: a self-hosted server carries REPLIERS_API_KEY and needs none of
// them. They are fatal there rather than a warning — a server that starts without the
// credentials it needs answers 500 to every request, which hides the cause behind a symptom.

const SERVER_NAME = "Repliers MCP Server";

// Process event handlers for debugging
process.on("uncaughtException", (error) => {
  console.error("[FATAL] Uncaught exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[FATAL] Unhandled rejection at:", promise, "reason:", reason);
  process.exit(1);
});

process.on("exit", (code) => {
  console.error(`[DEBUG] Process exiting with code: ${code}`);
});

process.on("SIGINT", () => {
  console.error("[DEBUG] Received SIGINT");
  process.exit(1);
});

process.on("SIGTERM", () => {
  console.error("[DEBUG] Received SIGTERM");
  process.exit(1);
});

async function transformTools(tools) {
  console.error("[DEBUG] Transforming tools, count:", tools.length);
  return tools
    .map((tool) => {
      const definitionFunction = tool.definition?.function;
      if (!definitionFunction) return;
      return {
        name: definitionFunction.name,
        description: definitionFunction.description,
        inputSchema: definitionFunction.parameters,
        annotations: toolAnnotations(definitionFunction.name),
      };
    })
    .filter(Boolean);
}

async function setupServerHandlers(server, tools) {
  console.error("[DEBUG] Setting up server handlers");

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: await transformTools(tools),
  }));

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const toolName = request.params.name;
    console.error(`[DEBUG] Tool call requested: ${toolName}`);

    const tool = tools.find((t) => t.definition.function.name === toolName);

    if (!tool) {
      console.error(`[ERROR] Tool not found: ${toolName}`);
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
    }

    // Scope enforcement lives here rather than in the HTTP middleware because only here is the
    // tool name known: reaching the server needs mcp:read, calling something that mutates needs
    // mcp:write as well. `scopes` is absent in stdio and self-hosted mode, where there is no
    // per-user identity and the environment key is the only authority.
    const scopes = extra?.authInfo?.scopes;
    if (scopes) {
      const needed = requiredScope(toolName);
      if (!scopes.includes(needed)) {
        console.error(
          `[ERROR] ${toolName} needs ${needed}, token carries: ${scopes.join(" ") || "(none)"}`
        );
        throw new McpError(
          ErrorCode.InvalidRequest,
          `The tool ${toolName} requires the ${needed} scope, which this authorization does not carry.`
        );
      }
    }

    const args = request.params.arguments;
    const requiredParameters =
      tool.definition?.function?.parameters?.required || [];

    for (const requiredParameter of requiredParameters) {
      if (!(requiredParameter in args)) {
        console.error(`[ERROR] Missing parameter: ${requiredParameter}`);
        throw new McpError(
          ErrorCode.InvalidParams,
          `Missing required parameter: ${requiredParameter}`
        );
      }
    }

    // The Repliers key is resolved per request, from the identity verifyOAuthToken proved
    // for this very call, rather than captured when the session was opened. A key that is
    // rotated or revoked upstream therefore takes effect on the next call instead of living
    // on for the lifetime of the session. Absent in self-hosted and stdio mode, where there
    // is no per-user identity and the environment key is the only one.
    const repliersApiKey =
      extra?.authInfo?.extra?.repliersApiKey ?? process.env.REPLIERS_API_KEY;

    try {
      const result = await tool.function({ ...args, _repliersApiKey: repliersApiKey });

      if (result.image) {
        return {
          content: [
            {
              type: "image",
              data: result.image.data,
              mimeType: result.image.mimeType,
            },
          ],
        };
      }

      augmentResult(toolName, result);

      const apiEndpoint = result.url || `${apiBaseUrl()}/${toolName}`;

      return {
        content: [
          {
            type: "text",
            text:
              `🔗 **API Endpoint Used**\n` +
              "```\n" +
              `${apiEndpoint}\n` +
              "```\n",
          },
          {
            type: "text",
            text:
              typeof result.data === "string"
                ? result.data
                : JSON.stringify(result.data || result, null, 2),
          },
        ],
      };
    } catch (error) {
      const apiEndpoint = `${apiBaseUrl()}/${toolName}`;

      return {
        content: [
          {
            type: "text",
            text:
              `🔗 **API Endpoint Used**\n` +
              "```\n" +
              `${apiEndpoint}\n` +
              "```\n\n" +
              `❌ **Error**\n${error.message}`,
          },
        ],
      };
    }
  });

  console.error("[DEBUG] Server handlers set up successfully");
}

async function run() {
  try {
    console.error("[DEBUG] Starting run function");
    const args = process.argv.slice(2);
    const isSSE = args.includes("--http") || args.includes("--sse");

    if (isSSE) {
      console.error("[DEBUG] Starting SSE mode");

      const selfHosted = !!process.env.REPLIERS_API_KEY;
      console.error(`[DEBUG] Mode: ${selfHosted ? 'self-hosted (env key)' : 'hosted (PropelAuth)'}`);

      const app = express();
      app.use(express.json());

      const sessions = {}; // sessionId -> { transport, server, userId }

      // Hosted mode needs credentials it cannot invent. Checked here rather than at load time
      // because a self-hosted server carries its own REPLIERS_API_KEY and needs none of them.
      if (!selfHosted) {
        for (const name of [
          "MCP_PUBLIC_URL",
          "OAUTH_BASE_URL",
          "PROPELAUTH_MCP_INTROSPECT_CLIENT_ID",
          "PROPELAUTH_MCP_INTROSPECT_CLIENT_SECRET",
        ]) {
          if (!process.env[name]) {
            console.error(`[FATAL] ${name} is required in hosted mode`);
            process.exit(1);
          }
        }
      }

      // Token validation, as an OAuth 2.1 resource server: introspection against PropelAuth's
      // MCP authorization server, with the audience checked against our own configured URI.
      // The SDK's requireBearerAuth owns everything above it — header parsing, expiry, 401 vs
      // 403, and the WWW-Authenticate challenge — so none of that is reproduced here.
      const verifier = selfHosted
        ? null
        : createIntrospectionVerifier({
            introspectionEndpoint:
              process.env.OAUTH_INTROSPECTION_ENDPOINT ||
              `${process.env.OAUTH_BASE_URL.replace(/\/+$/, "")}/oauth/2.1/introspect`,
            clientId: process.env.PROPELAUTH_MCP_INTROSPECT_CLIENT_ID,
            clientSecret: process.env.PROPELAUTH_MCP_INTROSPECT_CLIENT_SECRET,
            audiences: allowedAudiences(),
            requireAudience: process.env.OAUTH_REQUIRE_AUDIENCE !== "false",
            cacheTtlMs: Number(process.env.OAUTH_INTROSPECTION_CACHE_TTL_MS ?? 60_000),
            resolveApiKey: createKeyResolver({
              backendBaseUrl: process.env.OAUTH_BASE_URL,
              apiKey: process.env.PROPELAUTH_API_KEY,
            }),
          });

      /**
       * The provisioning gate, deliberately outside the verifier.
       *
       * Hosted mode has no fallback key. Without one, every tool call would still be served,
       * ship the literal string "undefined" as REPLIERS-API-KEY and come back as a Repliers
       * 401 — turning our own misconfiguration into what looks like their outage, several
       * layers away from the cause. Refuse here instead, and keep the two cases apart: "we
       * could not ask PropelAuth" is ours to fix, "this account has no key" is support's.
       */
      function requireRepliersKey(req, res, next) {
        const { repliersApiKey, keyLookupFailed, keyReason, userId } = req.auth?.extra ?? {};
        if (repliersApiKey) return next();

        if (keyLookupFailed) {
          console.error(`[ERROR] Refusing ${userId}: ${keyReason}`);
          return res.status(503).json({
            error: "key_lookup_failed",
            message:
              "Could not read this account's Repliers API key from PropelAuth. This is a server-side configuration problem, not a problem with the request.",
          });
        }

        console.error(`[ERROR] Refusing ${userId}: ${keyReason}`);
        return res.status(403).json({
          error: "account_not_provisioned",
          message:
            "This account has no Repliers API key configured. Contact Repliers support to have it enabled for MCP access.",
        });
      }

      // OpenAI Apps domain verification challenge
      app.get("/.well-known/openai-apps-challenge", (_req, res) => {
        res.status(200).type("text/plain").send("YsKHt1Ih_SwBJkUoRWkn961DW7BjOM3qTlXz2Oub5pg");
      });

      // Protected resource metadata (RFC 9728). This server is a resource server, not an
      // authorization server, and this is the only document that describes it. Clients look for
      // it first — Codex tries all of its addresses before anything else — and it names
      // PropelAuth's MCP authorization server as the place to authenticate.
      //
      // Served from our own code rather than the SDK's mcpAuthMetadataRouter, which always also
      // publishes /.well-known/oauth-authorization-server carrying the upstream issuer on this
      // origin. RFC 8414 §3.3 requires that issuer to identify whoever served the document, and
      // violating it is what made Codex discard our metadata in the first place.
      //
      // Hosted mode only. A self-hosted server carries its own REPLIERS_API_KEY and runs no
      // token verification, so advertising an authorization server would send clients into a
      // login flow that guards nothing.
      if (!selfHosted) {
        app.get("/.well-known/oauth-protected-resource", (_req, res) => {
          console.error("[DEBUG] Protected resource metadata requested for /");
          res.status(200).json(protectedResourceDocument("/"));
        });
        app.get("/.well-known/oauth-protected-resource/mcp", (_req, res) => {
          console.error("[DEBUG] Protected resource metadata requested for /mcp");
          res.status(200).json(protectedResourceDocument("/mcp"));
        });
      }

      // Health check endpoint (public - no auth required)
      app.get("/health", (_req, res) => {
        res.status(200).json({
          status: "ok",
          name: SERVER_NAME,
          version: "0.1.0",
          mode: "streamable-http",
          oauth_enabled: !selfHosted
        });
      });

      // MCP endpoint — handles all Streamable HTTP transport methods
      async function handleMcpRequest(req, res) {
        try {
          const sessionId = req.headers['mcp-session-id'];

          // Route existing sessions directly. A session id is a client-supplied
          // header, so it never stands in for identity: the caller the access
          // token proved must also be the user the session was opened for,
          // otherwise any authenticated user could drive another user's session
          // and spend their Repliers API key. Mismatches answer 404 rather than
          // 403 so the endpoint cannot be used to probe which session ids exist.
          if (sessionId) {
            const session = sessions[sessionId];
            if (!session || (!selfHosted && session.userId !== req.auth.extra.userId)) {
              if (session) {
                console.error(
                  `[WARN] Session ownership mismatch: ${sessionId} is owned by ${session.userId}, requested by ${req.auth.extra.userId}`
                );
              }
              return res.status(404).json({ error: "Session not found" });
            }
            await session.transport.handleRequest(req, res, req.body);
            return;
          }

          // New session — must be POST (initialize)
          if (req.method !== 'POST') {
            return res.status(400).json({ error: "New sessions must be initialized with a POST request" });
          }

          const sessionUserId = selfHosted ? null : req.auth.extra.userId;
          console.error(`[DEBUG] New MCP session${selfHosted ? '' : ` for user: ${sessionUserId}`}`);

          const server = new Server(
            { name: SERVER_NAME, version: "0.1.0" },
            { capabilities: { tools: {} }, instructions: buildServerInstructions() }
          );
          server.onerror = (error) => console.error("[SERVER ERROR]", error);

          const tools = await discoverTools();
          await setupServerHandlers(server, tools);

          const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (sid) => {
              sessions[sid] = { transport, server, userId: sessionUserId };
              console.error(`[DEBUG] Session initialized: ${sid}${selfHosted ? '' : ` (owner: ${sessionUserId})`}`);
            },
            onsessionclosed: (sid) => {
              delete sessions[sid];
              console.error(`[DEBUG] Session closed: ${sid}`);
            },
          });

          await server.connect(transport);
          await transport.handleRequest(req, res, req.body);

        } catch (error) {
          console.error("[ERROR] MCP request error:", error);
          if (!res.headersSent) {
            res.status(500).json({ error: "Internal server error", message: error.message });
          }
        }
      }

      /**
       * The two paths are registered separately rather than as one array so that each 401 can
       * point at the metadata document describing the resource that was actually asked for:
       * RFC 9728 derives the document's address from the resource path, and a client that
       * follows the wrong pointer learns nothing.
       */
      const authChain = (resourcePath) =>
        selfHosted
          ? []
          : [
              requireBearerAuth({
                verifier,
                requiredScopes: [SCOPE_READ],
                resourceMetadataUrl: resourceMetadataUrl(resourcePath),
              }),
              requireRepliersKey,
            ];

      app.all("/mcp", ...authChain("/mcp"), handleMcpRequest);
      app.all("/", ...authChain("/"), handleMcpRequest);

      const port = process.env.PORT || 3001;
      console.error("[DEBUG] Starting Express server on port:", port);

      app.listen(port, () => {
        console.error(`[MCP Server] running on port ${port}`);
        console.error(`[MCP Server] Endpoints available:`);
        console.error(`[MCP Server]   - POST /mcp (initialize session)`);
        console.error(`[MCP Server]   - GET|POST|DELETE /mcp (active sessions)`);
        console.error(`[MCP Server]   - GET  /health (health check)`);
        console.error(`[MCP Server]   - GET  /.well-known/oauth-protected-resource[/mcp]`);
      });
    } else {
      console.error("[DEBUG] Starting stdio mode for Claude Studio");

      // Create server instance
      const server = new Server(
        {
          name: SERVER_NAME,
          version: "0.1.0",
        },
        {
          capabilities: {
            tools: {},
          },
          instructions: buildServerInstructions(),
        }
      );

      // Setup error handling
      server.onerror = (error) => {
        console.error("[SERVER ERROR]", error);
        process.exit(1);
      };

      // Initialize tools
      console.error("[DEBUG] Discovering tools...");
      const tools = await discoverTools();
      console.error(`[DEBUG] ${tools.length} tools discovered`);

      // Setup protocol handlers
      await setupServerHandlers(server, tools);

      // Create stdio transport
      const transport = new StdioServerTransport();

      // Connect to transport
      await server.connect(transport);
      console.error("[DEBUG] MCP server ready in stdio mode");

      // Graceful shutdown handlers
      const shutdown = async () => {
        console.error("[DEBUG] Shutdown signal received");
        await server.close();
        console.error("[DEBUG] Server closed gracefully");
        process.exit(0);
      };

      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);

      // Keep process alive
      await new Promise(() => {});
    }
  } catch (error) {
    console.error("[FATAL ERROR]", error);
    process.exit(1);
  }
}

console.error("[DEBUG] Starting server...");
run().catch((error) => {
  console.error("[FATAL] Run function failed:", error);
  process.exit(1);
});
