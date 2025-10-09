import { randomUUID } from "crypto";

export const REQUEST_ID_HEADER = "x-request-id";

export const requestIdMiddleware = (req, res, next) => {
    // Use existing request ID from header, or generate new one
    const requestId = req.headers[REQUEST_ID_HEADER] || randomUUID();

    // Attach to request object
    req.requestId = requestId;

    // Add to response headers so client can reference it
    res.setHeader(REQUEST_ID_HEADER, requestId);

    next();
};