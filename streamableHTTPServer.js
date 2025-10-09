#!/usr/bin/env node

import dotenv from "dotenv";
import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
    CallToolRequestSchema,
    ErrorCode,
    ListToolsRequestSchema,
    McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { discoverTools } from "./lib/tools.js";

import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment
const envPath = path.resolve(__dirname, ".env");
try {
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
    }
} catch (err) {
    console.error("[FATAL] Error loading .env file:", err);
    process.exit(1);
}

// Verify required environment variables (now optional, API key comes from headers)
const REQUIRED_ENV = [];
const missingVars = REQUIRED_ENV.filter(env => !process.env[env]);

if (missingVars.length > 0) {
    console.error(`[FATAL] Missing: ${missingVars.join(", ")}`);
    process.exit(1);
}

const SERVER_NAME = "repliers-mcp-server";
const PORT = process.env.PORT || 3001;
const SESSION_ID_HEADER = "mcp-session-id";
const API_KEY_HEADER = "repliers-api-key";

// Store server instances by session ID (each has its own API key context)
const sessions = new Map();

// Transform tools for MCP protocol
function transformTools(tools) {
    return tools
        .map((tool) => {
            const definitionFunction = tool.definition?.function;
            if (!definitionFunction) return null;
            return {
                name: definitionFunction.name,
                description: definitionFunction.description,
                inputSchema: definitionFunction.parameters,
            };
        })
        .filter(Boolean);
}

// Setup MCP protocol handlers with API key in closure
function setupServerHandlers(server, tools, apiKey) {
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        console.error(`[MCP] Listing ${tools.length} tools`);
        return { tools: transformTools(tools) };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const toolName = request.params.name;
        const args = request.params.arguments || {};

        console.error(`[MCP] Tool call: ${toolName}`);

        const tool = tools.find((t) => t.definition.function.name === toolName);

        if (!tool) {
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
        }

        const requiredParameters = tool.definition?.function?.parameters?.required || [];
        for (const param of requiredParameters) {
            if (!(param in args)) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    `Missing required parameter: ${param}`
                );
            }
        }

        try {
            // Use API key from closure
            const result = await tool.function(args, apiKey);
            const apiEndpoint = result.url || `https://api.repliers.io/${toolName}`;

            console.error(`[MCP] Tool executed: ${toolName}`);

            return {
                content: [
                    {
                        type: "text",
                        text: `🔗 **API Endpoint Used**\n\`\`\`\n${apiEndpoint}\n\`\`\``,
                    },
                    {
                        type: "text",
                        text: typeof result.data === "string"
                            ? result.data
                            : JSON.stringify(result.data || result, null, 2),
                    },
                ],
            };
        } catch (error) {
            const apiEndpoint = `https://api.repliers.io/${toolName}`;
            console.error(`[MCP] Tool failed: ${error.message}`);

            return {
                content: [
                    {
                        type: "text",
                        text: `🔗 **API Endpoint Used**\n\`\`\`\n${apiEndpoint}\n\`\`\`\n\n❌ **Error**\n${error.message}`,
                    },
                ],
            };
        }
    });
}

// Check if request is initialize
function isInitializeRequest(body) {
    if (Array.isArray(body)) {
        return body.some(req => req.method === "initialize");
    }
    return body?.method === "initialize";
}

// Create error response
function createErrorResponse(message, code = -32000, id = null) {
    return {
        jsonrpc: "2.0",
        error: {
            code: code,
            message: message
        },
        id: id
    };
}

// Extract API key from request headers (required)
function extractApiKey(req) {
    const apiKey = req.headers[API_KEY_HEADER];

    if (!apiKey) {
        throw new Error(`Missing required header: ${API_KEY_HEADER}`);
    }

    return apiKey;
}

// Start HTTP server
async function startServer() {
    console.log("🚀 Starting Streamable HTTP MCP Server\n");

    const app = express();

    // CORS
    app.use((req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', `Content-Type, ${SESSION_ID_HEADER}, ${API_KEY_HEADER}`);

        if (req.method === 'OPTIONS') {
            return res.sendStatus(200);
        }

        next();
    });

    // JSON parsing
    app.use(express.json({ limit: '10mb' }));

    // Logging
    app.use((req, res, next) => {
        console.log(`📨 [${new Date().toISOString()}] ${req.method} ${req.url}`);
        if (req.headers[API_KEY_HEADER]) {
            console.log(`🔑 API Key: ${req.headers[API_KEY_HEADER].substring(0, 8)}...`);
        }
        next();
    });

    // Discover tools
    console.log("🔍 Discovering tools...");
    const tools = await discoverTools();
    console.log(`✓ Discovered ${tools.length} tools\n`);

    // MCP endpoint - POST
    app.post("/mcp", async (req, res) => {
        const sessionId = req.headers[SESSION_ID_HEADER];

        console.log('body', req.body);
        console.log(`🌊 MCP POST (session: ${sessionId || 'new'})`);
        console.log(`📦 Method: ${req.body?.method}`);

        try {
            // Extract and validate API key
            const apiKey = extractApiKey(req);

            // Reuse existing session
            if (sessionId && sessions.has(sessionId)) {
                console.log(`♻️  Reusing session: ${sessionId}`);

                const session = sessions.get(sessionId);
                await session.transport.handleRequest(req, res, req.body);
                console.log(`✓ Request handled\n`);
                return;
            }

            // Create new session for initialize request
            if (!sessionId && isInitializeRequest(req.body)) {
                console.log(`✨ Creating new session`);

                const transport = new StreamableHTTPServerTransport({
                    sessionIdGenerator: () => {
                        return Date.now().toString(36) + Math.random().toString(36).substring(2);
                    }
                });
                console.log('✨ Created transport:', transport.sessionId);

                // Create server instance with API key in closure
                const server = new Server(
                    { name: SERVER_NAME, version: "1.0.0" },
                    { capabilities: { tools: {} } }
                );

                server.onerror = (err) => {
                    console.error(`✗ Server error:`, err);
                };

                // Setup handlers with API key captured in closure
                await setupServerHandlers(server, tools, apiKey);

                console.log(`🔌 Connecting server...`);
                await server.connect(transport);
                console.log(`✓ Server connected`);

                console.log(`📨 Handling request...`);
                await transport.handleRequest(req, res, req.body);

                // Store session
                const newSessionId = transport.sessionId;
                if (newSessionId) {
                    sessions.set(newSessionId, { transport, server, apiKey });
                    console.log(`✓ Session created: ${newSessionId}`);
                }

                console.log(`✓ Initialize completed\n`);
                return;
            }

            // Invalid request
            console.log(`❌ Bad request`);
            res.status(400).json(
                createErrorResponse("Bad Request: invalid session ID or method.", -32000, req.body?.id)
            );

        } catch (error) {
            console.error(`✗ Error: ${error.message}`);
            console.error(error.stack);

            if (!res.headersSent) {
                res.status(500).json(
                    createErrorResponse(error.message, -32603, req.body?.id)
                );
            }
        }
    });

    // MCP endpoint - GET (optional SSE support)
    app.get("/mcp", async (req, res) => {
        console.log(req.headers);
        const sessionId = req.headers[SESSION_ID_HEADER];

        console.log(`🌊 MCP GET (session: ${sessionId})`);

        if (!sessionId || !sessions.has(sessionId)) {
            res.status(400).json(
                createErrorResponse("Bad Request: invalid session ID.")
            );
            return;
        }

        console.log(`♻️  Using session: ${sessionId}`);
        const session = sessions.get(sessionId);

        try {
            await session.transport.handleRequest(req, res);
            console.log(`✓ SSE stream established\n`);
        } catch (error) {
            console.error(`✗ Error: ${error.message}`);
            if (!res.headersSent) {
                res.status(500).json(
                    createErrorResponse(error.message)
                );
            }
        }
    });
    // MCP endpoint - DELETE (session termination)
    app.delete("/mcp", async (req, res) => {
        const sessionId = req.headers[SESSION_ID_HEADER];

        console.log(`🗑️  MCP DELETE (session: ${sessionId})`);

        if (!sessionId) {
            res.status(400).json(
                createErrorResponse("Bad Request: missing session ID.")
            );
            return;
        }

        if (!sessions.has(sessionId)) {
            console.log(`⚠️  Session not found: ${sessionId}`);
            // Return success even if session doesn't exist (idempotent)
            res.status(200).json({
                jsonrpc: "2.0",
                result: { success: true },
                id: null
            });
            return;
        }

        try {
            const session = sessions.get(sessionId);

            // Close the server connection if it has a close method
            if (session.server && typeof session.server.close === 'function') {
                await session.server.close();
            }

            // Remove session from map
            sessions.delete(sessionId);

            console.log(`✓ Session terminated: ${sessionId}`);
            console.log(`📊 Active sessions: ${sessions.size}\n`);

            res.status(200).json({
                jsonrpc: "2.0",
                result: { success: true },
                id: null
            });

        } catch (error) {
            console.error(`✗ Error terminating session: ${error.message}`);
            res.status(500).json(
                createErrorResponse(`Failed to terminate session: ${error.message}`)
            );
        }
    });

    // Health check
    app.get("/health", (req, res) => {
        res.json({
            status: "healthy",
            server: SERVER_NAME,
            version: "1.0.0",
            transport: "streamable-http",
            tools: tools.length,
            activeSessions: sessions.size,
            uptime: process.uptime()
        });
    });


    // Root info
    app.get("/", (req, res) => {
        res.json({
            name: SERVER_NAME,
            version: "1.0.0",
            transport: "streamable-http",
            endpoints: {
                mcp: "/mcp (POST for requests, GET for SSE)",
                health: "/health",
                sessions: "/sessions"
            },
            tools: tools.length,
            activeSessions: sessions.size,
            headers: {
                sessionId: SESSION_ID_HEADER,
                apiKey: API_KEY_HEADER
            }
        });
    });

    // Start server
    app.listen(PORT, () => {
        console.log("═".repeat(60));
        console.log("🚀 Streamable HTTP MCP Server Running!");
        console.log("═".repeat(60));
        console.log(`📍 Server:    ${SERVER_NAME}`);
        console.log(`📍 Port:      ${PORT}`);
        console.log(`📍 Tools:     ${tools.length}`);
        console.log(`📍 Transport: Streamable HTTP`);
        console.log("─".repeat(60));
        console.log("📡 Endpoints:");
        console.log(`   MCP:      http://localhost:${PORT}/mcp`);
        console.log(`   Health:   http://localhost:${PORT}/health`);
        console.log("─".repeat(60));
        console.log("🔑 Headers:");
        console.log(`   Session:  ${SESSION_ID_HEADER}`);
        console.log(`   API Key:  ${API_KEY_HEADER}`);
        console.log("─".repeat(60));
        console.log("🧪 Test:");
        console.log(`   node test-streamable.js`);
        console.log(`   curl http://localhost:${PORT}/health`);
        console.log("═".repeat(60));
        console.log("");
    });


    // Graceful shutdown
    process.on("SIGINT", () => {
        console.log("\n⚠ Shutting down gracefully...");
        sessions.clear();
        process.exit(0);
    });

    process.on("SIGTERM", () => {
        console.log("\n⚠ Shutting down gracefully...");
        sessions.clear();
        process.exit(0);
    });
}

// Main
async function main() {
    console.log("main");
    try {
        await startServer();
    } catch (error) {
        console.error("✗ Fatal:", error);
        process.exit(1);
    }
}

main().catch((error) => {
    console.error("✗ Startup failed:", error);
    process.exit(1);
});