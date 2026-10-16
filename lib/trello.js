import { appendFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";

const dryRun = () => process.env.FEEDBACK_DRY_RUN === "true";

const serverRoot = fileURLToPath(new URL("..", import.meta.url));

export function dryRunLogPath() {
  return process.env.FEEDBACK_DRY_RUN_LOG || resolve(serverRoot, "feedback-cards.log");
}

// Dry-run makes the whole feedback channel act configured (tool roster,
// server instructions, nudges) while cards go to the console instead of Trello.
export function trelloConfigured() {
  return (
    dryRun() ||
    Boolean(process.env.TRELLO_API_KEY && process.env.TRELLO_API_TOKEN && process.env.TRELLO_LIST_ID)
  );
}

// Server-side capture writes to its own list so automatic cards never mix with model-written ones.
// Without TRELLO_AUTO_LIST_ID it is off, though send-feedback still works.
export function autoCaptureConfigured() {
  // Needs the whole feedback channel, so "without Trello nothing is captured" holds literally.
  return dryRun() || (trelloConfigured() && Boolean(process.env.TRELLO_AUTO_LIST_ID));
}

// narrow (default; also any unknown value): the server captures only deterministic defects.
// full: it also captures refine-search corrections and restated searches (repairsNlpId).
// Read per call, like FEEDBACK_PROMPT_LEVEL.
export function autoCaptureMode() {
  return process.env.FEEDBACK_AUTO_CAPTURE === "full" ? "full" : "narrow";
}

// What actually drives behaviour and text: "full" only when it is requested and capture can run.
// With capture off, full-mode wording would promise recording (or omit the user offer) for nothing.
export function effectiveCaptureMode() {
  return autoCaptureMode() === "full" && autoCaptureConfigured() ? "full" : "narrow";
}

let dryRunCards = 0;

function logDryRun(entry) {
  // stderr: stdout carries the JSON-RPC stream on the stdio transport
  console.error(entry);
  // Mirrored to a file so a headless eval can read cards back after the run.
  try {
    appendFileSync(dryRunLogPath(), `${entry}\n\n`);
  } catch (error) {
    console.error(`[feedback dry-run] could not write ${dryRunLogPath()}: ${error.message}`);
  }
}

export async function createCard({ name, desc }, { listId } = {}) {
  if (dryRun()) {
    logDryRun(`[feedback dry-run] Trello card:\n--- name ---\n${name}\n--- desc ---\n${desc}`);
    dryRunCards += 1;
    return { ok: true, dryRun: true, cardId: `dry-run-${dryRunCards}` };
  }
  const url = new URL("https://api.trello.com/1/cards");
  url.searchParams.set("key", process.env.TRELLO_API_KEY);
  url.searchParams.set("token", process.env.TRELLO_API_TOKEN);
  try {
    // Card content travels in the body, never the query: Trello answers 414 past ~8 KB of
    // URL, while buildFeedbackCard caps a description at 16 KB.
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idList: listId ?? process.env.TRELLO_LIST_ID, name, desc }),
    });
    if (!response.ok) return { ok: false, error: `Trello responded ${response.status}` };
    const card = await response.json();
    return { ok: true, cardId: card.id, cardUrl: card.shortUrl };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export async function addComment(cardId, text) {
  if (dryRun()) {
    logDryRun(`[feedback dry-run] Trello comment on ${cardId}:\n${text}`);
    return { ok: true, dryRun: true };
  }
  const url = new URL(`https://api.trello.com/1/cards/${encodeURIComponent(cardId)}/actions/comments`);
  url.searchParams.set("key", process.env.TRELLO_API_KEY);
  url.searchParams.set("token", process.env.TRELLO_API_TOKEN);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    return response.ok ? { ok: true } : { ok: false, error: `Trello responded ${response.status}` };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}
