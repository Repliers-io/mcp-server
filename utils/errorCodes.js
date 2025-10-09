// JSON-RPC 2.0 Standard Error Codes
export const ErrorCodes = {
    // Standard errors
    PARSE_ERROR: -32700,
    INVALID_REQUEST: -32600,
    METHOD_NOT_FOUND: -32601,
    INVALID_PARAMS: -32602,
    INTERNAL_ERROR: -32603,

    // Server errors (implementation-defined: -32000 to -32099)
    SERVER_ERROR: -32000,
    UNAUTHORIZED: -32001,
    FORBIDDEN: -32003,
    NOT_FOUND: -32004,
    TIMEOUT: -32005,
    SESSION_ERROR: -32010,
    SESSION_NOT_FOUND: -32011,
    SESSION_EXPIRED: -32012,
    TOOL_ERROR: -32020,
    TOOL_NOT_FOUND: -32021,
    TOOL_EXECUTION_ERROR: -32022,
    API_KEY_MISSING: -32030,
    API_KEY_INVALID: -32031,
    RATE_LIMIT: -32040
};

export const ErrorMessages = {
    [ErrorCodes.PARSE_ERROR]: "Parse error",
    [ErrorCodes.INVALID_REQUEST]: "Invalid Request",
    [ErrorCodes.METHOD_NOT_FOUND]: "Method not found",
    [ErrorCodes.INVALID_PARAMS]: "Invalid params",
    [ErrorCodes.INTERNAL_ERROR]: "Internal error",
    [ErrorCodes.SERVER_ERROR]: "Server error",
    [ErrorCodes.UNAUTHORIZED]: "Unauthorized",
    [ErrorCodes.FORBIDDEN]: "Forbidden",
    [ErrorCodes.NOT_FOUND]: "Not found",
    [ErrorCodes.TIMEOUT]: "Request timeout",
    [ErrorCodes.SESSION_ERROR]: "Session error",
    [ErrorCodes.SESSION_NOT_FOUND]: "Session not found",
    [ErrorCodes.SESSION_EXPIRED]: "Session expired",
    [ErrorCodes.TOOL_ERROR]: "Tool error",
    [ErrorCodes.TOOL_NOT_FOUND]: "Tool not found",
    [ErrorCodes.TOOL_EXECUTION_ERROR]: "Tool execution failed",
    [ErrorCodes.API_KEY_MISSING]: "API key missing",
    [ErrorCodes.API_KEY_INVALID]: "API key invalid",
    [ErrorCodes.RATE_LIMIT]: "Rate limit exceeded"
};

export function getErrorMessage(code) {
    return ErrorMessages[code] || "Unknown error";
}