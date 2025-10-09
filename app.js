#!/usr/bin/env node

import express from "express";
import { PORT } from "./config/environment.js";
import { SERVER_NAME } from "./config/constants.js";
import { corsMiddleware } from "./middleware/cors.js";
import { loggingMiddleware } from "./middleware/logging.js";
import { requestIdMiddleware } from "./middleware/requestId.js";
import { sessionManager } from "./services/sessionManager.js";
import { discoverTools } from "./lib/tools.js";
import routes from "./routes/index.js";
import { createErrorResponse } from "./utils/responses.js";
console.log("🚀 Starting Streamable HTTP MCP Server\n");

const app = express();

// Middleware
app.use(corsMiddleware);
app.use(express.json({ limit: "10mb" }));
app.use(requestIdMiddleware);
app.use(loggingMiddleware);


const tools = await discoverTools();

// Make tools available to routes
app.locals.tools = tools;

// Routes
app.use("/", routes);

app.use((req, res) => {
    res.status(404).json({
        jsonrpc: "2.0",
        error: {
            code: -32601,
            message: `Cannot ${req.method} ${req.url}`
        },
        id: null
    });
});
app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Store error in res.locals for logging middleware
    res.locals.error = {
        message: message,
        stack: err.stack,
        code: err.code
    };

    // Log error with logger
    console.log({
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
        level: "ERROR",
        method: req.method,
        url: req.url,
        pathname: req.originalUrl.split("?")[0],
        statusCode: statusCode,
        error: {
            message: message,
            stack: err.stack,
            code: err.code
        },
        body: req.body,
        sessionId: req.headers["mcp-session-id"] || "none"
    });

    // Send error response
    if (!res.headersSent) {
        res.status(statusCode).json(
            createErrorResponse(message, err.code || -32603, req.body?.id)
        );
    }
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
    console.log(`   Info:     http://localhost:${PORT}/health/info`);
    console.log("─".repeat(60));
    console.log("🧪 Test:");
    console.log(`   node streamableHTTPClient.js`);
    console.log(`   curl http://localhost:${PORT}/health`);
    console.log("═".repeat(60));
    console.log("");
});

// Global error handlers
process.on("uncaughtException", (error) => {
    console.error("❌ Uncaught Exception:", error);
    console.log({
        timestamp: new Date().toISOString(),
        level: "FATAL",
        error: {
            type: "uncaughtException",
            message: error.message,
            stack: error.stack
        }
    });

    // Give logger time to write, then exit
    setTimeout(() => {
        process.exit(1);
    }, 1000);
});

process.on("unhandledRejection", (reason, promise) => {
    console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
    console.log({
        timestamp: new Date().toISOString(),
        level: "ERROR",
        error: {
            type: "unhandledRejection",
            message: reason?.message || String(reason),
            stack: reason?.stack
        }
    });
});
// Graceful shutdown
// Graceful shutdown
const shutdown = async (signal) => {
    console.log(`\n⚠️  ${signal} received. Shutting down gracefully...`);

    // Stop accepting new connections
    server.close(async () => {
        console.log("✓ HTTP server closed");

        try {
            // Close all active sessions
            console.log(`✓ Closing ${sessionManager.size} active sessions...`);

            for (const [sessionId, session] of sessionManager.sessions) {
                try {
                    if (session.server && typeof session.server.close === "function") {
                        await session.server.close();
                    }
                } catch (error) {
                    console.error(`✗ Error closing session ${sessionId}:`, error.message);
                }
            }

            sessionManager.clear();
            console.log("✓ All sessions closed");

            // Log shutdown
            console.log({
                timestamp: new Date().toISOString(),
                level: "INFO",
                message: "Server shutdown complete",
                signal: signal
            });

            console.log("✓ Shutdown complete");
            process.exit(0);

        } catch (error) {
            console.error("✗ Error during shutdown:", error);
            process.exit(1);
        }
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
        console.error("❌ Forced shutdown after timeout");
        process.exit(1);
    }, 30000);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export default app;