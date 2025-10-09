import { API_KEY_HEADER, SESSION_ID_HEADER } from "../config/constants.js";


export const loggingMiddleware = (req, res, next) => {
    const startTime = Date.now();

    // Capture original end function
    const originalEnd = res.end;

    // Override res.end to log response
    res.end = function (chunk, encoding) {
        // Calculate response time
        const responseTime = Date.now() - startTime;

        // Restore original end
        res.end = originalEnd;

        // Call original end
        res.end(chunk, encoding);

        // Build log object
        const log = {
            requestId: req.requestId,
            timestamp: new Date().toISOString(),
            method: req.method,
            url: req.url,
            pathname: req.originalUrl.split("?")[0],
            statusCode: res.statusCode,
            responseTimeMs: responseTime,
            apiKey: req.headers[API_KEY_HEADER]?.substring(0, 8) + "..." || "none",
            sessionId: req.headers[SESSION_ID_HEADER] || "none",
            ip: req.ip || req.connection.remoteAddress
        };

        // Add error details if present
        if (res.locals.error) {
            log.error = res.locals.error;
        }

        // Log with logger service
        console.log(JSON.stringify(log));
    };

    next();
};