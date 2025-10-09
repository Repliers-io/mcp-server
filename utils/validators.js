import { API_KEY_HEADER } from "../config/constants.js";

export function extractApiKey(req) {
    const apiKey = req.headers[API_KEY_HEADER];

    if (!apiKey) {
        throw new Error(`Missing required header: ${API_KEY_HEADER}`);
    }

    return apiKey;
}

export function isInitializeRequest(body) {
    if (Array.isArray(body)) {
        return body.some(req => req.method === "initialize");
    }
    return body?.method === "initialize";
}