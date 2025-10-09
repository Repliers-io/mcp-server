import express from "express";
import { sessionManager } from "../services/sessionManager.js";
import { SERVER_NAME, SERVER_VERSION, SESSION_ID_HEADER, API_KEY_HEADER } from "../config/constants.js";

const router = express.Router();

// Health check
router.get("/", (req, res) => {
    res.json({
        status: "healthy",
        server: SERVER_NAME,
        version: SERVER_VERSION,
        transport: "streamable-http",
        tools: req.app.locals.tools?.length || 0,
        activeSessions: sessionManager.size,
        uptime: process.uptime()
    });
});

// Root info
router.get("/info", (req, res) => {
    res.json({
        name: SERVER_NAME,
        version: SERVER_VERSION,
        transport: "streamable-http",
        endpoints: {
            mcp: "/mcp (POST for requests, GET for SSE, DELETE for termination)",
            health: "/health",
            info: "/health/info"
        },
        tools: req.app.locals.tools?.length || 0,
        activeSessions: sessionManager.size,
        headers: {
            sessionId: SESSION_ID_HEADER,
            apiKey: API_KEY_HEADER
        }
    });
});

export default router;