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

const executeFunction = async (args) => {
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;
  let url;
  try {
    url = new URL(args.url);
  } catch {
    return { error: "url must be a valid request.url from a previous Search_Listings response." };
  }
  if (url.origin !== "https://api.repliers.io" || !url.pathname.startsWith("/listings")) {
    return { error: "url must point at https://api.repliers.io/listings — pass request.url from the Search_Listings response." };
  }
  for (const name of patchParams) {
    const value = args[name];
    if (value === undefined || value === null) continue;
    url.searchParams.delete(name);
    for (const v of [value].flat()) url.searchParams.append(name, String(v));
    for (const alias of aliases[name] || []) url.searchParams.delete(alias);
  }
  // Remove runs last: when the same param is both set and removed in one call, remove wins.
  for (const name of args.remove || []) {
    if (removablePattern.test(name)) url.searchParams.delete(name);
  }
  const finalUrl = url.toString();
  try {
    const response = await fetch(finalUrl, {
      headers: { Accept: "application/json", "REPLIERS-API-KEY": apiKey },
    });
    if (!response.ok) throw new Error(JSON.stringify(await response.json()));
    const data = await response.json();
    return {
      url: finalUrl,
      data: { appliedFilters: parseAppliedFilters(finalUrl), ...data },
    };
  } catch (error) {
    return { error: "refine-search request failed.", details: error.message, url: finalUrl };
  }
};

const paramSchema = (type, description) => ({ type, description });

const multiSchema = (description) => ({
  anyOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
  description,
});

const definition = {
  type: "function",
  function: {
    name: "refine-search",
    description: `Surgically correct a previous Search_Listings result whose appliedFilters did not match the user's stated constraints. Takes request.url from that response, changes ONLY the parameters you name (everything else — including filters you don't understand — passes through verbatim), re-runs the search, and returns listings with a fresh appliedFilters block. NOT a general search tool: new searches always go through Search_Listings; this tool requires a prior request.url. Not applicable when the previous response had complexQuery=true — restate the Search_Listings prompt instead. For propertyType/style use exact board vocabulary — verify via Lookup_Possible_Values (aggregates=details.propertyType,details.style) if unsure. Every refine is proof the original parse missed constraints: you MUST follow it with send-feedback (category nlp-misparse, missedConstraints) — the task is unfinished until both the corrected results and the report are delivered.`,
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
