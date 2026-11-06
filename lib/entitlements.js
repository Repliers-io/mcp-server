// lib/entitlements.js
// Tools only some API keys may use. A tool carrying `entitlement: "<name>"` is listed and callable
// only for a key whose probe for that name succeeds; for every other key it does not exist
// (mcp-server-docs/content/har-partner/design.md §4.1-4.2).
//
// No API endpoint exposes an account's partner configuration, so the only way to know is to ask the
// gated route itself. Verdicts are cached per key, because tools/list and every gated tools/call
// consult them, and in hosted mode the key is resolved per request.
import { createHash } from "node:crypto";
import { probeHar } from "./har.js";

const MINUTE = 60_000;
// A definite answer changes only when an account is reconfigured; an inconclusive one (a timeout,
// a 5xx) is retried soon, so a brief outage does not hide the tools for long.
const TTL = { yes: 15 * MINUTE, no: 15 * MINUTE, unknown: MINUTE };

// A probe answers "yes", "no" or "unknown"; anything else, or a throw, counts as "unknown". What
// counts as a definite answer is the probe's business (for HAR: lib/har.js).
const DEFAULT_PROBES = { har: probeHar };
const VERDICTS = new Set(["yes", "no", "unknown"]);

// The key never sits in the map as itself.
const fingerprint = (apiKey) => createHash("sha256").update(apiKey).digest("hex");

export function createEntitlements({ probes = DEFAULT_PROBES, now = Date.now, maxEntries = 1000 } = {}) {
  const cache = new Map(); // `${name}:${fingerprint}` -> { allowed, expires } | { pending }

  const store = (id, entry) => {
    cache.delete(id);
    cache.set(id, entry);
    while (cache.size > maxEntries) cache.delete(cache.keys().next().value);
  };

  async function has(name, apiKey, { userAgent } = {}) {
    const probe = probes[name];
    if (!probe || !apiKey) return false;
    const id = `${name}:${fingerprint(apiKey)}`;

    const hit = cache.get(id);
    if (hit?.pending) return hit.pending;
    if (hit && hit.expires > now()) return hit.allowed;

    // Fail closed: anything but a definite yes hides the tools (design.md §4.1). The probe starts on
    // a later tick, so the pending entry below is in place before any verdict can be stored — even
    // from a probe that settles synchronously.
    const pending = Promise.resolve().then(async () => {
      let verdict = "unknown";
      try {
        const answer = await probe({ apiKey, userAgent });
        if (VERDICTS.has(answer)) verdict = answer;
      } catch {
        // a probe that throws is inconclusive
      }
      if (verdict === "unknown") {
        console.error(`[entitlements] ${name} access probe was inconclusive; its tools stay hidden for ${TTL.unknown / 1000}s`);
      }
      store(id, { allowed: verdict === "yes", expires: now() + TTL[verdict] });
      return verdict === "yes";
    });
    store(id, { pending });
    return pending;
  }

  /** `tools` without the gated ones `apiKey` may not use. One lookup per entitlement, not per tool. */
  async function visible(tools, apiKey, options) {
    const names = [...new Set(tools.map((tool) => tool.entitlement).filter(Boolean))];
    const granted = new Set();
    await Promise.all(names.map(async (name) => {
      if (await has(name, apiKey, options)) granted.add(name);
    }));
    return tools.filter((tool) => !tool.entitlement || granted.has(tool.entitlement));
  }

  return { has, visible };
}

const processEntitlements = createEntitlements();
export const hasEntitlement = processEntitlements.has;
export const visibleTools = processEntitlements.visible;
