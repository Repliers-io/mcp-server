import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
    CallToolRequestSchema,
    ErrorCode,
    ListToolsRequestSchema,
    McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { SERVER_NAME, SERVER_VERSION } from "../config/constants.js";

// Transform tools for MCP protocol
export function transformTools(tools) {
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
export function setupServerHandlers(server, tools, apiKey) {
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

// Create MCP server instance
export async function createMCPServer(tools, apiKey) {
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => {
            return Date.now().toString(36) + Math.random().toString(36).substring(2);
        }
    });

    const server = new Server(
        { name: SERVER_NAME, version: SERVER_VERSION },
        { capabilities: { tools: {} } }
    );

    server.onerror = (err) => {
        console.error(`✗ Server error:`, err);
    };

    await setupServerHandlers(server, tools, apiKey);
    await server.connect(transport);

    return { server, transport };
}