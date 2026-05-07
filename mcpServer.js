#!/usr/bin/env node

import dotenv from "dotenv";
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
import { discoverTools } from "./lib/tools.js";

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
    dotenv.config({ path: envPath });
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
const OAUTH_ENV = [
  "OAUTH_BASE_URL",
  "OAUTH_AUTHORIZATION_ENDPOINT", 
  "OAUTH_TOKEN_ENDPOINT",
  "OAUTH_USERINFO_ENDPOINT"  // Using UserInfo instead of introspection
];

let missingVars = [];
REQUIRED_ENV.forEach((env) => {
  if (!process.env[env]) {
    console.error(`[FATAL] Missing required environment variable: ${env}`);
    missingVars.push(env);
  }
});

// Check OAuth variables (warn but don't exit)
let missingOAuthVars = [];
OAUTH_ENV.forEach((env) => {
  if (!process.env[env]) {
    console.error(`[WARN] Missing OAuth environment variable: ${env}`);
    missingOAuthVars.push(env);
  }
});

if (missingVars.length > 0) {
  console.error("[FATAL] Server cannot start without required variables");
  process.exit(1);
}

if (missingOAuthVars.length > 0) {
  console.error("[WARN] OAuth authentication may not work correctly without these variables:");
  console.error("[WARN]", missingOAuthVars.join(", "));
}

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
});

process.on("SIGTERM", () => {
  console.error("[DEBUG] Received SIGTERM");
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
      };
    })
    .filter(Boolean);
}

async function setupServerHandlers(server, tools, repliersApiKey) {
  console.error("[DEBUG] Setting up server handlers");

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: await transformTools(tools),
  }));

  // Call tool handler - FIXED VERSION
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    console.error(`[DEBUG] Tool call requested: ${toolName}`);

    const tool = tools.find((t) => t.definition.function.name === toolName);

    if (!tool) {
      console.error(`[ERROR] Tool not found: ${toolName}`);
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
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

    try {
      const result = await tool.function({ ...args, _repliersApiKey: repliersApiKey });
      const apiEndpoint = result.url || `https://api.repliers.io/${toolName}`;

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
      const apiEndpoint = `https://api.repliers.io/${toolName}`;

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

      const sessions = {}; // sessionId -> { transport, server }

      // OAuth token verification middleware using UserInfo endpoint
      async function verifyOAuthToken(req, res, next) {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          console.error("[ERROR] Missing or invalid authorization header");
          return res.status(401).json({
            error: "unauthorized",
            message: "Missing or invalid authorization header. Expected: Bearer <token>"
          });
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        
        try {
          // Validate token by calling UserInfo endpoint
          // If token is valid, we get user data back. If invalid, we get 401.
          const userInfoEndpoint = process.env.OAUTH_USERINFO_ENDPOINT || 
                                  `${process.env.OAUTH_BASE_URL}/oauth/userinfo`;
          
          console.error(`[DEBUG] Validating token via UserInfo: ${userInfoEndpoint}`);
          
          const response = await fetch(userInfoEndpoint, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (!response.ok) {
            console.error("[ERROR] Token validation failed:", response.status);
            return res.status(401).json({
              error: "unauthorized",
              message: "Token is invalid or expired"
            });
          }

          const userInfo = await response.json();
          
          // Store user info in request for later use
          req.user = {
            id: userInfo.sub || userInfo.id || userInfo.user_id,
            email: userInfo.email,
            name: userInfo.name,
            picture: userInfo.picture,
            emailVerified: userInfo.email_verified,
            profile: userInfo
          };

          // Fetch Repliers API key from PropelAuth org metadata
          if (req.user.id && process.env.PROPELAUTH_API_KEY) {
            try {
              // UserInfo endpoint doesn't include org membership — fetch it from the backend user API
              const userResponse = await fetch(
                `${process.env.OAUTH_BASE_URL}/api/backend/v1/user/${req.user.id}`,
                { headers: { 'Authorization': `Bearer ${process.env.PROPELAUTH_API_KEY}` } }
              );
              if (userResponse.ok) {
                const userData = await userResponse.json();
                req.user.repliersApiKey = userData.metadata?.repliers_api_key;
                console.error(`[DEBUG] Repliers API key ${req.user.repliersApiKey ? 'found' : 'not found'} in user metadata`);
              } else {
                console.error(`[WARN] Could not fetch user from PropelAuth backend: ${userResponse.status}`);
              }
            } catch (orgError) {
              console.error('[WARN] Error fetching org metadata:', orgError.message);
            }
          } else {
            if (!process.env.PROPELAUTH_API_KEY) console.error('[DEBUG] PROPELAUTH_API_KEY not set, skipping org metadata fetch');
          }

          console.error(`[DEBUG] User authenticated: ${req.user.id} (${req.user.email || 'no email'})`);
          next();
          
        } catch (error) {
          console.error("[ERROR] Token verification error:", error);
          return res.status(500).json({
            error: "server_error",
            message: "Failed to verify token"
          });
        }
      }

      // OpenID Connect Discovery endpoint (more standard than OAuth-specific)
      app.get("/.well-known/openid-configuration", (_req, res) => {
        console.error("[DEBUG] OpenID Connect discovery endpoint called");
        
        const baseUrl = process.env.OAUTH_BASE_URL || "https://your-oauth-server.com";
        const authorizationEndpoint = process.env.OAUTH_AUTHORIZATION_ENDPOINT || `${baseUrl}/oauth/authorize`;
        const tokenEndpoint = process.env.OAUTH_TOKEN_ENDPOINT || `${baseUrl}/oauth/token`;
        const userInfoEndpoint = process.env.OAUTH_USERINFO_ENDPOINT || `${baseUrl}/oauth/userinfo`;
        
        res.status(200).json({
          issuer: baseUrl,
          authorization_endpoint: authorizationEndpoint,
          token_endpoint: tokenEndpoint,
          userinfo_endpoint: userInfoEndpoint,
          response_types_supported: ["code"],
          grant_types_supported: ["authorization_code", "refresh_token"],
          subject_types_supported: ["public"],
          id_token_signing_alg_values_supported: ["RS256"],
          code_challenge_methods_supported: ["S256"],
          token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic", "none"],
        });
      });

      // OAuth discovery endpoint - provide OAuth server metadata
      app.get("/.well-known/oauth-authorization-server", (req, res) => {
        console.error("[DEBUG] OAuth discovery endpoint called");
        
        const baseUrl = process.env.OAUTH_BASE_URL || "https://your-oauth-server.com";
        const authorizationEndpoint = process.env.OAUTH_AUTHORIZATION_ENDPOINT || `${baseUrl}/oauth/authorize`;
        const tokenEndpoint = process.env.OAUTH_TOKEN_ENDPOINT || `${baseUrl}/oauth/token`;
        
        res.status(200).json({
          issuer: baseUrl,
          authorization_endpoint: authorizationEndpoint,
          token_endpoint: tokenEndpoint,
          response_types_supported: ["code"],
          grant_types_supported: ["authorization_code", "refresh_token"],
          code_challenge_methods_supported: ["S256"],
          token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic", "none"],
          // Include a registration endpoint that will return an error explaining the situation
          registration_endpoint: `https://${req.get('host')}/oauth/register`
        });
      });

      // Dynamic client registration endpoint - returns pre-configured client
      // This is a workaround for MCP clients that require dynamic registration
      app.post("/oauth/register", (_req, res) => {
        console.error("[DEBUG] Dynamic client registration attempted");
        
        // Check if we have a pre-configured client ID
        const preConfiguredClientId = process.env.OAUTH_CLIENT_ID;
        
        if (!preConfiguredClientId) {
          return res.status(501).json({
            error: "registration_not_supported",
            error_description: "Dynamic client registration is not supported. Please set OAUTH_CLIENT_ID in your .env file with your PropelAuth client ID."
          });
        }
        
        // Return the pre-configured client as if we just registered it
        console.error("[DEBUG] Returning pre-configured client ID:", preConfiguredClientId);
        res.status(201).json({
          client_id: preConfiguredClientId,
          client_secret: process.env.OAUTH_CLIENT_SECRET || undefined,
          redirect_uris: [
            "http://localhost:3000/callback",
            "http://127.0.0.1:3000/callback",
            "https://app.jenova.ai/oauth/callback"
          ],
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
          token_endpoint_auth_method: process.env.OAUTH_CLIENT_SECRET ? "client_secret_post" : "none"
        });
      });

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
      app.all(["/", "/mcp"], ...(selfHosted ? [] : [verifyOAuthToken]), async (req, res) => {
        try {
          const sessionId = req.headers['mcp-session-id'];

          // Route existing sessions directly
          if (sessionId) {
            const session = sessions[sessionId];
            if (!session) {
              return res.status(404).json({ error: "Session not found" });
            }
            await session.transport.handleRequest(req, res, req.body);
            return;
          }

          // New session — must be POST (initialize)
          if (req.method !== 'POST') {
            return res.status(400).json({ error: "New sessions must be initialized with a POST request" });
          }

          const repliersApiKey = selfHosted ? process.env.REPLIERS_API_KEY : req.user.repliersApiKey;
          console.error(`[DEBUG] New MCP session${selfHosted ? '' : ` for user: ${req.user.id}`}`);

          const server = new Server(
            { name: SERVER_NAME, version: "0.1.0" },
            { capabilities: { tools: {} } }
          );
          server.onerror = (error) => console.error("[SERVER ERROR]", error);

          const tools = await discoverTools();
          await setupServerHandlers(server, tools, repliersApiKey);

          const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (sid) => {
              sessions[sid] = { transport, server };
              console.error(`[DEBUG] Session initialized: ${sid}`);
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
      });

      const port = process.env.PORT || 3001;
      console.error("[DEBUG] Starting Express server on port:", port);

      app.listen(port, () => {
        console.error(`[MCP Server] running on port ${port}`);
        console.error(`[MCP Server] Endpoints available:`);
        console.error(`[MCP Server]   - POST /mcp (initialize session)`);
        console.error(`[MCP Server]   - GET|POST|DELETE /mcp (active sessions)`);
        console.error(`[MCP Server]   - GET  /health (health check)`);
        console.error(`[MCP Server]   - GET  /.well-known/openid-configuration`);
        console.error(`[MCP Server]   - GET  /.well-known/oauth-authorization-server`);
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
