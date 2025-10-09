import express from "express";
import { sessionManager } from "../services/sessionManager.js";
import { createMCPServer } from "../services/mcpServer.js";
import { extractApiKey, isInitializeRequest } from "../utils/validators.js";
import { createErrorResponse, createSuccessResponse } from "../utils/responses.js";
import { SESSION_ID_HEADER } from "../config/constants.js";

const router = express.Router();

// POST - Main MCP endpoint
router.post("/", async (req, res) => {
    const sessionId = req.headers[SESSION_ID_HEADER];

    try {
        const apiKey = extractApiKey(req);

        // Reuse existing session
        if (sessionId && sessionManager.has(sessionId)) {
 
            const session = sessionManager.get(sessionId);
            await session.transport.handleRequest(req, res, req.body);

            return;
        }

        // Create new session for initialize request
        if (!sessionId && isInitializeRequest(req.body)) {
            console.log(`Creating new session`);

            const { server, transport } = await createMCPServer(req.app.locals.tools, apiKey);

            await transport.handleRequest(req, res, req.body);

            // Store session
            const newSessionId = transport.sessionId;
            if (newSessionId) {
                sessionManager.set(newSessionId, { transport, server, apiKey });
                console.log(`✓ Session created: ${newSessionId}`);
            }
            return;
        }

        res.status(400).json(
            createErrorResponse("Bad Request: invalid session ID or method.", -32000, req.body?.id)
        );

    } catch (error) {
        console.error(`Failed to process MCP request due to:`, error);

        if (!res.headersSent) {
            res.status(500).json(
                createErrorResponse(error.message, -32603, req.body?.id)
            );
        }
    }
});

// GET - SSE support
router.get("/", async (req, res) => {
    const sessionId = req.headers[SESSION_ID_HEADER];

    if (!sessionId || !sessionManager.has(sessionId)) {
        res.status(400).json(
            createErrorResponse("Bad Request: invalid session ID.")
        );
        return;
    }

    const session = sessionManager.get(sessionId);

    try {
        await session.transport.handleRequest(req, res);
    } catch (error) {
        console.error(`Failed to handle SSE request due to:`, error);
        if (!res.headersSent) {
            res.status(500).json(createErrorResponse(error.message));
        }
    }
});

// DELETE - Session termination
router.delete("/", async (req, res) => {
    const sessionId = req.headers[SESSION_ID_HEADER];

    if (!sessionId) {
        res.status(400).json(
            createErrorResponse("Bad Request: missing session ID.")
        );
        return;
    }

    if (!sessionManager.has(sessionId)) {

        res.status(200).json(createSuccessResponse({ success: true }));
        return;
    }

    try {
        const session = sessionManager.get(sessionId);

        if (session.server && typeof session.server.close === "function") {
            await session.server.close();
        }

        sessionManager.delete(sessionId);

        res.status(200).json(createSuccessResponse({ success: true }));

    } catch (error) {
        console.error(`✗ Error terminating session: ${error.message}`);
        res.status(500).json(
            createErrorResponse(`Failed to terminate session: ${error.message}`)
        );
    }
});

export default router;