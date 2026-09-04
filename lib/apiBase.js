// Single source of the Repliers API host. Read per call rather than at import, so pointing the
// whole server — generated tools included — at a staging deployment is one `.env` line plus a
// restart, with no code edited anywhere.
// Exported so codegen can warn when openapi.json's server URL drifts away from it: the host is no
// longer baked into generated tools, so a spec change would otherwise pass unnoticed.
export const defaultApiBaseUrl = "https://api.repliers.io";
const defaultBaseUrl = defaultApiBaseUrl;

export function apiBaseUrl() {
  const configured = (process.env.REPLIERS_API_BASE_URL || "").trim();
  return (configured || defaultBaseUrl).replace(/\/+$/, "");
}

// The origin alone, for validating that a URL handed back to us belongs to the configured
// deployment. Comparing origins (not string prefixes) keeps `https://host@evil.example/…` out.
export function apiOrigin() {
  try {
    return new URL(apiBaseUrl()).origin;
  } catch {
    return new URL(defaultBaseUrl).origin;
  }
}
