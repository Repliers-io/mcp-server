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

export async function createCard({ name, desc }) {
  if (dryRun()) {
    // stderr: stdout carries the JSON-RPC stream on the stdio transport
    const entry = `[feedback dry-run] Trello card:\n--- name ---\n${name}\n--- desc ---\n${desc}`;
    console.error(entry);
    // Mirrored to a file so a headless eval can read cards back after the run.
    try {
      appendFileSync(dryRunLogPath(), `${entry}\n\n`);
    } catch (error) {
      console.error(`[feedback dry-run] could not write ${dryRunLogPath()}: ${error.message}`);
    }
    return { ok: true, dryRun: true };
  }
  const url = new URL("https://api.trello.com/1/cards");
  url.searchParams.set("key", process.env.TRELLO_API_KEY);
  url.searchParams.set("token", process.env.TRELLO_API_TOKEN);
  url.searchParams.set("idList", process.env.TRELLO_LIST_ID);
  url.searchParams.set("name", name);
  url.searchParams.set("desc", desc);
  try {
    const response = await fetch(url, { method: "POST" });
    if (!response.ok) return { ok: false, error: `Trello responded ${response.status}` };
    const card = await response.json();
    return { ok: true, cardUrl: card.shortUrl };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}
