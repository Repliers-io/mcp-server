class SessionManager {
    constructor() {
        this.sessions = new Map();
    }

    has(sessionId) {
        return this.sessions.has(sessionId);
    }

    get(sessionId) {
        return this.sessions.get(sessionId);
    }

    set(sessionId, sessionData) {
        this.sessions.set(sessionId, sessionData);
    }

    delete(sessionId) {
        return this.sessions.delete(sessionId);
    }

    clear() {
        this.sessions.clear();
    }

    get size() {
        return this.sessions.size;
    }

    list() {
        return Array.from(this.sessions.keys()).map(sessionId => ({
            sessionId,
            hasApiKey: !!this.sessions.get(sessionId).apiKey,
            created: "unknown"
        }));
    }
}

export const sessionManager = new SessionManager();