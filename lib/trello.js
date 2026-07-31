export function trelloConfigured() {
  return Boolean(
    process.env.TRELLO_API_KEY && process.env.TRELLO_API_TOKEN && process.env.TRELLO_LIST_ID
  );
}

export async function createCard({ name, desc }) {
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
