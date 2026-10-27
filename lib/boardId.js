// Which MLS boards hold an MLS number, asked with the caller's own key — so the lookup can only
// ever see boards that key already sees. null when the lookup itself fails.
import { apiBaseUrl } from "./apiBase.js";
import { apiHeaders } from "./apiRequest.js";

export async function boardsForMlsNumber(mlsNumber, args) {
  const url = new URL(`${apiBaseUrl()}/listings`);
  url.searchParams.set("mlsNumber", String(mlsNumber));
  url.searchParams.set("listings", "false");
  url.searchParams.set("aggregates", "boardId");
  try {
    const response = await fetch(url, { headers: apiHeaders(args) });
    if (!response.ok) return null;
    const data = await response.json();
    return Object.keys(data.aggregates?.boardId ?? {}).map(Number).filter(Number.isFinite);
  } catch {
    return null;
  }
}
