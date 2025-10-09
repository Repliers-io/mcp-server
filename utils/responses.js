export function createErrorResponse(message, code = -32000, id = null) {
    return {
        jsonrpc: "2.0",
        error: {
            code: code,
            message: message
        },
        id: id
    };
}

export function createSuccessResponse(result, id = null) {
    return {
        jsonrpc: "2.0",
        result: result,
        id: id
    };
}