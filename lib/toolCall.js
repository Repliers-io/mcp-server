// lib/toolCall.js
// One tool call end to end: argument check, the call, error classification into a _notice,
// nudges, and (Task 9) server-side capture. mcpServer.js only routes requests here.
import { apiBaseUrl } from "./apiBase.js";
import { classifyError } from "./apiErrors.js";
import { augmentResult } from "./feedbackHints.js";
import { effectiveCaptureMode } from "./trello.js";
import { reporter as processReporter, captureSignals, secretScrubber } from "./autoReport.js";
import { boardsForMlsNumber } from "./boardId.js";

const SESSION_SEARCH_LIMIT = 200;
const BOARD_TOOLS = new Set(["get-listing", "get-similar-listings"]);
// One caller must not be able to spend the process-wide breaker alone.
const SESSION_SIGNALS_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;

export function createSessionState() {
  return { searches: new Map(), capture: { windowStart: -Infinity, count: 0, logged: false } };
}

export function remember(session, key, entry) {
  if (!key || !entry) return;
  session.searches.delete(key);
  session.searches.set(key, entry);
  while (session.searches.size > SESSION_SEARCH_LIMIT) {
    session.searches.delete(session.searches.keys().next().value);
  }
}

function toContent(endpoint, payload, isError) {
  const result = {
    content: [
      { type: "text", text: `🔗 **API Endpoint Used**\n\`\`\`\n${endpoint}\n\`\`\`\n` },
      { type: "text", text: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2) },
    ],
  };
  if (isError) result.isError = true;
  return result;
}

// A throw that escapes a tool is this server's own code failing on its input; real network failures
// are caught inside the tools and arrive with status null. No status classifies it as a request
// error, which is not captured: it is not a Repliers outage.
async function invoke(tool, args) {
  try {
    return await tool.function(args);
  } catch (error) {
    return { url: undefined, error: error?.message || String(error), status: undefined, body: null };
  }
}

function noticeFor(classification) {
  return {
    kind: classification.kind,
    ...(classification.forUser && { forUser: classification.forUser }),
    forAgent: classification.forAgent,
    retry: classification.retry,
    ...(classification.candidates && { candidates: classification.candidates }),
  };
}

// The key must never reach Trello, even when a tool or the API echoes it into a URL or body.
// captureSignals scrubs raw inputs before anything is cut; this pass over the finished text is
// defence in depth. Not applied to the result: listing payloads run to megabytes.
function redact(signals, secret) {
  if (!secret) return signals;
  const scrub = secretScrubber(secret);
  const text = (value) => scrub(String(value));
  return signals.map((signal) => ({
    ...signal, key: text(signal.key), summary: text(signal.summary), lines: signal.lines.map(text),
  }));
}

// A failure is scrubbed before it is classified: classification cuts the message at 1000
// characters, and a key echo straddling that cut would leave a prefix no later pass can find.
// Error bodies are small, unlike listing payloads, so walking one is cheap.
function scrubFailure(result, secret) {
  if (!secret) return result;
  const scrub = secretScrubber(secret);
  const walk = (value) => {
    if (typeof value === "string") return scrub(value);
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([key, entry]) => [scrub(key), walk(entry)]));
    }
    return value;
  };
  return { ...result, error: walk(result.error), body: walk(result.body) };
}

// At most SESSION_SIGNALS_PER_HOUR accepted signals per session per hour; the rest are not reported.
function record(reporter, signals, session, time) {
  if (!signals.length) return [];
  const quota = (session.capture ??= { windowStart: -Infinity, count: 0, logged: false });
  if (time - quota.windowStart >= HOUR_MS) Object.assign(quota, { windowStart: time, count: 0, logged: false });
  const recorded = [];
  for (const signal of signals) {
    if (quota.count >= SESSION_SIGNALS_PER_HOUR) {
      if (!quota.logged) console.error("[auto-report] session quota reached");
      quota.logged = true;
      break;
    }
    if (reporter.report(signal).accepted) {
      quota.count += 1;
      recorded.push(signal);
    }
  }
  return recorded;
}

// Capture is best effort: a bug here must never cost the caller the tool response.
function capture({ reporter, secret, session, now }, details) {
  try {
    return record(reporter, redact(captureSignals({ ...details, secret }), secret), session, now());
  } catch (error) {
    console.error(`[auto-report] capture failed: ${error.message}`);
    return [];
  }
}

function withRecorded(payload, recorded) {
  if (!recorded.length || !payload || typeof payload !== "object") return payload;
  const note = recorded.map((signal) => `Recorded for the Repliers team: ${signal.summary}.`).join(" ");
  const { _notice, _feedback, ...rest } = payload;
  const merged = _feedback
    ? { signals: ["recorded", ..._feedback.signals], note: `${note} ${_feedback.note}` }
    : { signals: ["recorded"], note };
  return { ...(_notice && { _notice }), _feedback: merged, ...rest };
}

// Full capture mode only: ties a refine back to the prompt it corrects.
function rememberSearch(session, toolName, input, result) {
  if (effectiveCaptureMode() !== "full") return;
  const data = result.data;
  if (toolName === "Search_Listings" && data?.request?.url) {
    const entry = { nlpId: data.nlpId ?? null, prompt: input.prompt, url: data.request.url, appliedFilters: data.appliedFilters ?? null };
    remember(session, data.request.url, entry);
    if (entry.nlpId) remember(session, entry.nlpId, entry);
  } else if (toolName === "refine-search" && result.url) {
    remember(session, result.url, session.searches.get(input.url));
  }
}

function succeed({ toolName, input, result, session, capturing, fallbackEndpoint }) {
  augmentResult(toolName, result);
  const recorded = capture(capturing, { toolName, args: input, result, session });
  rememberSearch(session, toolName, input, result);
  const data = typeof result.data === "string" ? result.data : withRecorded(result.data || result, recorded);
  return toContent(result.url || fallbackEndpoint, data, false);
}

export async function callTool({
  tool, toolName, args, repliersApiKey, userAgent, session = createSessionState(), reporter = processReporter,
  now = Date.now,
}) {
  const input = args ?? {};
  const capturing = { reporter, secret: repliersApiKey, session, now };
  const fallbackEndpoint = `${apiBaseUrl()}/${toolName}`;
  const required = tool.definition?.function?.parameters?.required || [];
  const missing = required.filter((name) => !(name in input));
  if (missing.length) {
    return toContent(fallbackEndpoint, {
      _notice: {
        kind: "request",
        forAgent: `Missing required parameter${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`,
        retry: true,
      },
    }, true);
  }

  const callArgs = { ...input, _repliersApiKey: repliersApiKey, _userAgent: userAgent };
  let result = await invoke(tool, callArgs);

  if (result.image) {
    return { content: [{ type: "image", data: result.image.data, mimeType: result.image.mimeType }] };
  }

  if (result.error) {
    result = scrubFailure(result, repliersApiKey);
    let classification = classifyError({
      toolName, url: result.url, status: result.status, body: result.body, error: result.error,
    });
    if (classification.reason === "needs-board" && BOARD_TOOLS.has(toolName)
        && input.mlsNumber != null && input.boardId == null) {
      const boards = await boardsForMlsNumber(input.mlsNumber, callArgs);
      if (boards?.length === 1) {
        const retried = await invoke(tool, { ...callArgs, boardId: boards[0] });
        if (!retried.error) {
          retried.data = { boardIdResolved: boards[0], ...retried.data };
          return succeed({ toolName, input, result: retried, session, capturing, fallbackEndpoint });
        }
        result = scrubFailure(retried, repliersApiKey);
        classification = classifyError({ toolName, url: result.url, status: result.status, body: result.body, error: result.error });
      } else if (boards?.length > 1) {
        classification = {
          ...classification,
          candidates: boards,
          forAgent: `MLS number ${input.mlsNumber} exists on more than one MLS (boardId ${boards.join(", ")}); passing boardId selects one, and the user can say which MLS they mean.`,
        };
      } else if (boards?.length === 0) {
        classification = classifyError({ toolName, url: result.url, status: 404, body: null });
      }
    }
    if (classification.kind === "not-found") {
      return toContent(result.url || fallbackEndpoint, { found: false, reason: classification.forAgent }, false);
    }
    const recorded = capture(capturing, { toolName, args: input, result, classification, session });
    return toContent(result.url || fallbackEndpoint, withRecorded({
      _notice: noticeFor(classification),
      error: { status: classification.status ?? null, message: classification.message },
    }, recorded), true);
  }

  return succeed({ toolName, input, result, session, capturing, fallbackEndpoint });
}
