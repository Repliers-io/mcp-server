import { apiHeaders, readFailure, errorMessage } from "../../../../lib/apiRequest.js";
import { effectiveCaptureMode } from "../../../../lib/trello.js";
import { apiBaseUrl, apiOrigin } from "../../../../lib/apiBase.js";
import { parseAppliedFilters } from "../../../../lib/appliedFilters.js";

// Curated allowlist — openapi.json POST /listings names. Only these are ever
// written into the URL; everything else in the base query passes through.
const patchParams = [
  "minPrice", "maxPrice", "propertyType", "style", "class", "type",
  "city", "area", "neighborhood", "district", "zip", "locationId",
  "minBedrooms", "maxBedrooms", "minBaths", "maxBaths",
  "minSqft", "maxSqft", "minYearBuilt", "maxYearBuilt",
  "status", "lastStatus",
  "minParkingSpaces", "minGarageSpaces", "swimmingPool", "waterfront",
  "resultsPerPage", "pageNum", "sortBy", "fields",
];

// NLP-built URLs may carry alias names; a patch must displace them.
const aliases = { minBedrooms: ["minBeds"], maxBedrooms: ["maxBeds"] };

const removablePattern = /^[A-Za-z0-9]{1,40}$/;

// Patching only these does not imply an NLP misparse.
const presentationParams = new Set(["resultsPerPage", "pageNum", "sortBy", "fields"]);

const executeFunction = async (args) => {
  let url;
  try {
    url = new URL(args.url);
  } catch {
    return { error: "url must be a valid request.url from a previous Search_Listings response." };
  }
  // Tied to the configured deployment, not a literal: on a staging host the production origin is
  // as foreign as any other, and a hardcoded check would reject the very URL Search_Listings built.
  if (url.origin !== apiOrigin() || !url.pathname.startsWith("/listings")) {
    return { error: `url must point at ${apiBaseUrl()}/listings — pass request.url from the Search_Listings response.` };
  }
  // `changed` lists only what this call actually changed: every changed name can open a card, so a
  // no-op set or a remove of an absent param must not count (one caller could exhaust the breaker).
  const original = new URLSearchParams(url.searchParams);
  const valuesOf = (params, name) =>
    [...new Set([name, ...(aliases[name] || [])].flatMap((key) => params.getAll(key)))].sort();
  const removeNames = (args.remove || []).filter((name) => removablePattern.test(name));
  const set = {};
  for (const name of patchParams) {
    const value = args[name];
    if (value === undefined || value === null) continue;
    const next = [...new Set([value].flat().map(String))].sort();
    const before = valuesOf(original, name);
    url.searchParams.delete(name);
    for (const v of [value].flat()) url.searchParams.append(name, String(v));
    for (const alias of aliases[name] || []) url.searchParams.delete(alias);
    // A value the remove step deletes again never reaches the URL.
    if (!removeNames.includes(name) && next.join("\n") !== before.join("\n")) set[name] = value;
  }
  // Remove runs last: when the same param is both set and removed in one call, remove wins. It
  // counts only for a param the original URL carried and that is still there to delete.
  const remove = [];
  for (const name of removeNames) {
    if (url.searchParams.has(name) && original.has(name) && !remove.includes(name)) remove.push(name);
    url.searchParams.delete(name);
  }
  const finalUrl = url.toString();
  const constraintPatch = [...Object.keys(set), ...remove].some((name) => !presentationParams.has(name));
  try {
    const response = await fetch(finalUrl, { headers: apiHeaders(args) });
    if (!response.ok) {
      const { status, body } = await readFailure(response);
      return { url: finalUrl, error: errorMessage(body) || `HTTP ${status}`, status, body };
    }
    const data = await response.json();
    return {
      url: finalUrl,
      constraintPatch,
      changed: { set, remove },
      data: { appliedFilters: parseAppliedFilters(finalUrl, data.unrecognizedParams), ...data },
    };
  } catch (error) {
    return { url: finalUrl, error: error.message, status: null, body: null };
  }
};

const paramSchema = (type, description) => ({ type, description });

const multiSchema = (description) => ({
  anyOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
  description,
});

// Read at import: a FEEDBACK_AUTO_CAPTURE change needs a restart. Narrow says nothing about recording.
const recording = effectiveCaptureMode() === "full"
  ? " Each call that changes a filter is recorded for the Repliers team as a probable NLP parse gap."
  : "";

const definition = {
  type: "function",
  function: {
    name: "refine-search",
    description: `Corrects a previous Search_Listings result whose appliedFilters did not match the user's stated constraints. Takes request.url from that response, changes only the parameters named (everything else — including filters not understood — passes through verbatim), re-runs the search, and returns listings with a fresh appliedFilters block. Requires a prior request.url: new searches go through Search_Listings. Not applicable when the previous response had complexQuery=true; a restated Search_Listings prompt covers that case. propertyType and style take exact board vocabulary, listed by Lookup_Possible_Values (aggregates=details.propertyType,details.style).${recording}`,
    parameters: {
      type: "object",
      properties: {
        url: paramSchema("string", "request.url from the Search_Listings response being corrected. Required."),
        minPrice: paramSchema("number", "Minimum price."),
        maxPrice: paramSchema("number", "Maximum price."),
        propertyType: multiSchema("Exact board vocabulary (e.g. 'Att/Row/Twnhouse', not 'Townhouse') — check Lookup_Possible_Values. Pass an array to include several types at once (e.g. both freehold and condo townhouses)."),
        style: multiSchema("Exact board vocabulary — check Lookup_Possible_Values. Pass an array to include several styles at once."),
        class: paramSchema("string", "Listing class, e.g. ResidentialProperty, CondoProperty, CommercialProperty."),
        type: paramSchema("string", "'sale' or 'lease'."),
        city: paramSchema("string", "City name."),
        area: paramSchema("string", "Area/region name."),
        neighborhood: paramSchema("string", "Neighborhood name."),
        district: paramSchema("string", "District name."),
        zip: paramSchema("string", "Postal/ZIP code."),
        locationId: paramSchema("string", "Location id from search-locations/autocomplete."),
        minBedrooms: paramSchema("number", "Minimum bedrooms."),
        maxBedrooms: paramSchema("number", "Maximum bedrooms."),
        minBaths: paramSchema("number", "Minimum bathrooms."),
        maxBaths: paramSchema("number", "Maximum bathrooms."),
        minSqft: paramSchema("number", "Minimum square feet."),
        maxSqft: paramSchema("number", "Maximum square feet."),
        minYearBuilt: paramSchema("number", "Minimum year built."),
        maxYearBuilt: paramSchema("number", "Maximum year built."),
        status: paramSchema("string", "Listing status, e.g. A (active), U (unavailable)."),
        lastStatus: paramSchema("string", "Last status, e.g. Sld, Lsd, Ter."),
        minParkingSpaces: paramSchema("number", "Minimum parking spaces."),
        minGarageSpaces: paramSchema("number", "Minimum garage spaces."),
        swimmingPool: paramSchema("string", "Swimming pool filter value."),
        waterfront: paramSchema("string", "Waterfront filter value."),
        resultsPerPage: paramSchema("number", "Page size."),
        pageNum: paramSchema("number", "Page number."),
        sortBy: paramSchema("string", "Sort order."),
        fields: paramSchema("string", "Comma-separated response fields (performance)."),
        remove: {
          type: "array",
          items: { type: "string" },
          description: "Parameter names to DELETE from the query — filters the NLP applied that the user did not ask for (alias names like minBeds are accepted). Runs after patching — removing a param you also set in the same call deletes it.",
        },
      },
      required: ["url"],
    },
  },
};

const apiTool = { function: executeFunction, definition };

export { apiTool };
