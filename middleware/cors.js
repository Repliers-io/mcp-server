import { SESSION_ID_HEADER, API_KEY_HEADER } from "../config/constants.js";

export const corsMiddleware = (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE");
    res.setHeader("Access-Control-Allow-Headers", `Content-Type, ${SESSION_ID_HEADER}, ${API_KEY_HEADER}`);

    if (req.method === "OPTIONS") {
        return res.sendStatus(200);
    }

    next();
};