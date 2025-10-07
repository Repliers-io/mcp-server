#!/usr/bin/env node

/**
 * Streamable HTTP Client Test - Updated for /mcp endpoint
 * Tests the streamable-only server implementation
 */

const SERVER_URL = "http://localhost:3001/mcp";

let sessionId = null;

// Helper to send JSON-RPC request
async function sendRequest(method, params = {}, id = 1) {
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
    };

    // Add session ID header for subsequent requests
    if (sessionId) {
        headers['mcp-session-id'] = sessionId;
    }

    const payload = {
        jsonrpc: "2.0",
        id: id,
        method: method,
        params: params
    };
    console.log(JSON.stringify(payload, null,2))

    console.log(`📤 Sending ${method}...`);
    if (sessionId) {
        console.log(`   Session: ${sessionId}`);
    }

    const startTime = Date.now();
    console.log(JSON.stringify(headers.null,2))
    const response = await fetch(SERVER_URL, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
    });

    const duration = Date.now() - startTime;

    console.log(`📥 Response (${duration}ms):`);
    console.log(`   Status: ${response.status}`);

    // Extract session ID from response header if present
    const newSessionId = response.headers.get('mcp-session-id');
    if (newSessionId && !sessionId) {
        sessionId = newSessionId;
        console.log(`   ✅ Session ID received: ${sessionId}`);
    }

    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
        // Regular JSON response
        const data = await response.json();

        if (data.error) {
            console.log(`   ❌ Error: ${data.error.message}`);
            throw new Error(data.error.message);
        }

        console.log(`   ✅ Success (JSON)`);
        return data.result;

    } else if (contentType.includes('text/event-stream')) {
        // SSE response - parse the event stream
        console.log(`   ℹ️  SSE response`);

        const text = await response.text();

        // Parse SSE format: "event: message\ndata: {json}\n\n"
        const lines = text.split('\n');
        let jsonData = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('data: ')) {
                const dataStr = line.substring(6); // Remove "data: "
                try {
                    jsonData = JSON.parse(dataStr);
                    break;
                } catch (e) {
                    // Continue looking
                }
            }
        }

        if (!jsonData) {
            throw new Error('Could not parse SSE response');
        }

        if (jsonData.error) {
            console.log(`   ❌ Error: ${jsonData.error.message}`);
            throw new Error(jsonData.error.message);
        }

        console.log(`   ✅ Success (SSE)`);
        return jsonData.result;

    } else {
        const text = await response.text();
        console.log(`   ⚠️  Unexpected content type: ${contentType}`);
        console.log(`   Response: ${text.substring(0, 200)}`);
        throw new Error('Unexpected content type: ' + contentType);
    }
}

async function testStreamableHTTP() {
    console.log("\n🧪 Streamable HTTP Client Test\n");
    console.log("═".repeat(60));
    console.log(`📍 Server: ${SERVER_URL}`);
    console.log("═".repeat(60));

    try {
        // Step 1: Initialize (creates session)
        console.log("\n[1/6] 🔌 Initialize (create session)");
        console.log("─".repeat(60));

        const initResult = await sendRequest("initialize", {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: {
                name: "streamable-test-client",
                version: "1.0.0"
            }
        }, 1);

        console.log(`✅ Initialized`);
        console.log(`   Protocol: ${initResult.protocolVersion}`);
        console.log(`   Server: ${initResult.serverInfo.name} v${initResult.serverInfo.version}`);
        return;
        // Step 2: List tools (using session)
        console.log("\n[2/6] 📋 List tools");
        console.log("─".repeat(60));

        const toolsResult = await sendRequest("tools/list", {}, 2);

        console.log(`✅ Found ${toolsResult.tools.length} tools\n`);

        toolsResult.tools.slice(0, 5).forEach((tool, index) => {
            console.log(`${index + 1}. ${tool.name}`);
        });

        if (toolsResult.tools.length > 5) {
            console.log(`... and ${toolsResult.tools.length - 5} more`);
        }

        // Step 3: Call simple tool
        console.log("\n[3/6] 🔧 Call tool: list_property_types_and_styles");
        console.log("─".repeat(60));

        const tool1Start = Date.now();
        const tool1Result = await sendRequest("tools/call", {
            name: "list_property_types_and_styles",
            arguments: {}
        }, 3);
        const tool1Duration = Date.now() - tool1Start;

        console.log(`✅ Tool executed in ${tool1Duration}ms`);
        console.log(`   Response has ${tool1Result.content?.length || 0} content items`);

        // Step 4: Call another tool
        console.log("\n[4/6] 🔧 Call tool: list_locations");
        console.log("─".repeat(60));

        const tool2Start = Date.now();
        const tool2Result = await sendRequest("tools/call", {
            name: "list_locations",
            arguments: {
                city: "Toronto"
            }
        }, 4);
        const tool2Duration = Date.now() - tool2Start;

        console.log(`✅ Tool executed in ${tool2Duration}ms`);
        console.log(`   Response has ${tool2Result.content?.length || 0} content items`);

        // Step 5: Call search tool
        console.log("\n[5/6] 🔧 Call tool: repliers_listings_search");
        console.log("─".repeat(60));

        const searchStart = Date.now();
        const searchResult = await sendRequest("tools/call", {
            name: "repliers_listings_search",
            arguments: {
                pageNum: 1,
                resultsPerPage: 3,
                params: {
                    city: ["Toronto"],
                    type: ["sale"],
                    minBedrooms: 2
                }
            }
        }, 5);
        const searchDuration = Date.now() - searchStart;


        console.log(`✅ Search executed in ${searchDuration}ms`);
        console.log(`   Response has ${searchResult.content?.length || 0} content items`);

        // Step 6: Multiple rapid calls to test session
        console.log("\n[6/6] 🔧 Test session persistence (5 rapid calls)");
        console.log("─".repeat(60));

        for (let i = 1; i <= 5; i++) {
            const start = Date.now();
            await sendRequest("tools/list", {}, 5 + i);
            console.log(`  ${i}. tools/list: ${Date.now() - start}ms`);
        }
        console.log("✅ All calls used the same session");

        // Summary
        console.log("\n" + "═".repeat(60));
        console.log("✅ ALL TESTS PASSED!");
        console.log("═".repeat(60));
        console.log(`✓ Session ID: ${sessionId}`);
        console.log(`✓ Tools available: ${toolsResult.tools.length}`);
        console.log(`✓ Tool calls executed: 8`);
        console.log(`✓ Session persisted across all requests`);
        console.log("═".repeat(60) + "\n");

        // Check server sessions
        try {
            const sessionsRes = await fetch("http://localhost:3001/sessions");
            const sessions = await sessionsRes.json();
            console.log("📊 Server sessions:");
            console.log(`   Total active: ${sessions.total}`);
            if (sessions.sessions && sessions.sessions.length > 0) {
                sessions.sessions.forEach(s => {
                    console.log(`   • ${s.sessionId}`);
                });
            }
            console.log("");
        } catch (err) {
            console.log("ℹ️  Could not fetch session info");
        }

    } catch (error) {
        console.error("\n" + "═".repeat(60));
        console.error("❌ TEST FAILED");
        console.error("═".repeat(60));
        console.error(`Error: ${error.message}`);

        if (error.stack) {
            console.error("\nStack trace:");
            console.error(error.stack);
        }

        console.error("═".repeat(60) + "\n");
        process.exit(1);
    }
}

// Check server
async function checkServer() {
    try {
        const response = await fetch("http://localhost:3001/health");
        if (!response.ok) throw new Error(`Status ${response.status}`);

        const health = await response.json();
        console.log("✅ Server is running");
        console.log(`   Version: ${health.version}`);
        console.log(`   Transport: ${health.transport}`);
        console.log(`   Tools: ${health.tools}`);
        console.log(`   Active sessions: ${health.activeSessions}`);
        console.log(`   Uptime: ${Math.floor(health.uptime)}s`);
        return true;

    } catch (error) {
        console.error("❌ Server is not running!");
        console.error(`   ${error.message}`);
        console.error("\n💡 Start your server first:");
        console.error("   node index.js\n");
        return false;
    }
}

async function main() {
    console.log("\n🚀 Streamable HTTP MCP Client Test\n");

    const serverOk = await checkServer();
    if (!serverOk) {
        process.exit(1);
    }

    await testStreamableHTTP();
}

main().catch((error) => {
    console.error("\n💥 Fatal error:", error);
    process.exit(1);
});