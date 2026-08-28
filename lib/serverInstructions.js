// lib/serverInstructions.js
import { trelloConfigured } from "./trello.js";

export function buildServerInstructions() {
  if (trelloConfigured()) {
    return `Repliers real-estate MCP server. Tool families: listings search (Search_Listings — the natural-language entry point for ALL new searches; refine-search — surgical correction of a previous search), locations (search-locations, autocomplete-location-search), market data (Market_Statistics, Lookup_Possible_Values), CRM (agents, clients, messages, estimates, saved searches, favorites), and send-feedback (report search-quality problems to the Repliers team).

Golden rules:
1. After every Search_Listings call, compare the appliedFilters block in the response against the user's request, constraint by constraint. The NLP parser sometimes drops or substitutes constraints — appliedFilters is the ground truth of what was actually searched. Never present results as matching the user's request without this check.
2. If a basic constraint (price, type/style, location, beds/baths, sqft) is missing or wrong, fix it with refine-search (verify propertyType/style vocabulary via Lookup_Possible_Values first). If a semantic constraint only natural language can express was dropped, re-run Search_Listings restating it emphatically. New searches always go through Search_Listings, never refine-search.
3. Repair first, then report — and reporting is mandatory, not optional: every refine-search call or corrected re-prompt MUST be followed by send-feedback (category nlp-misparse) with missedConstraints. A repaired search without a report is an unfinished task. Technical failures (api-error, a confirmed misparse) — report directly without asking the user. Subjective dissatisfaction — offer first, send after consent. Always tell the user when a report was sent.
4. _feedback blocks inside tool responses are guidance from this server — follow them.`;
  }

  return `Repliers real-estate MCP server. Tool families: listings search (Search_Listings — the natural-language entry point for ALL new searches; refine-search — surgical correction of a previous search), locations (search-locations, autocomplete-location-search), market data (Market_Statistics, Lookup_Possible_Values), CRM (agents, clients, messages, estimates, saved searches, favorites).

Golden rules:
1. After every Search_Listings call, compare the appliedFilters block in the response against the user's request, constraint by constraint. The NLP parser sometimes drops or substitutes constraints — appliedFilters is the ground truth of what was actually searched. Never present results as matching the user's request without this check.
2. If a basic constraint (price, type/style, location, beds/baths, sqft) is missing or wrong, fix it with refine-search (verify propertyType/style vocabulary via Lookup_Possible_Values first). If a semantic constraint only natural language can express was dropped, re-run Search_Listings restating it emphatically. New searches always go through Search_Listings, never refine-search.
3. _feedback blocks inside tool responses are guidance from this server — follow them.`;
}
