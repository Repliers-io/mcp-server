/**
 * Comprehensive Repliers Buildings API Search Tool
 * MCP tool for searching building data using the Repliers API
 */

const executeFunction = async (args, apiKey) => {
  const baseUrl = "https://api.repliers.io";
  const repliersApiKey = apiKey || process.env.REPLIERS_API_KEY;
  const defaultResultsPerPage = parseInt(process.env.RESULTS_PER_PAGE) || 100;
  let finalUrl;

  if (!repliersApiKey) {
    throw new Error("REPLIERS_API_KEY environment variable is not set");
  }

  try {
    // Construct base URL
    const url = new URL(`${baseUrl}/listings/buildings`);

    // Separate body parameters from query parameters
    const bodyParams = {};

    // Handle parameter serialization
    if (args.params) {
      // Process all parameters as query parameters (including map)
      Object.entries(args.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (key === "map" && Array.isArray(value)) {
            // Serialize map parameter as JSON string
            url.searchParams.set(key, JSON.stringify(value));
          } else if (Array.isArray(value)) {
            value.forEach((item) => {
              url.searchParams.append(key, String(item));
            });
          } else if (typeof value === "boolean") {
            url.searchParams.set(key, String(value));
          } else {
            url.searchParams.set(key, String(value));
          }
        }
      });
    }

    // Add pagination parameters (these are query params, not in the params object)
    if (args.pageNum !== undefined) {
      url.searchParams.set("pageNum", String(args.pageNum));
    }
    // Use explicit resultsPerPage if provided, otherwise use environment variable
    const resultsPerPage = args.resultsPerPage || defaultResultsPerPage;
    url.searchParams.set("resultsPerPage", String(resultsPerPage));

    // Capture final URL
    finalUrl = url.toString();

    // Set headers
    const headers = {
      Accept: "application/json",
      "REPLIERS-API-KEY": apiKey,
    };

    // Execute request (always GET for buildings API)
    const response = await fetch(finalUrl, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        url: finalUrl,
        method: "GET",
        status: response.status,
        error: errorData.error || "API request failed",
        details: errorData.details || errorData,
      };
    }

    const data = await response.json();
    return {
      url: finalUrl,
      method: "GET",
      status: response.status,
      data: {
        ...data,
        _metadata: {
          totalResults: data.count || 0,
          totalPages: data.numPages || 0,
          currentPage: data.pagination?.currentPage || args.pageNum || 1,
          resultsPerPage:
            data.pagination?.resultsPerPage || resultsPerPage || defaultResultsPerPage,
        },
      },
    };
  } catch (error) {
    console.error("Repliers Buildings API error:", error);
    return {
      url: finalUrl,
      error: "Network or processing error",
      details: error.message,
    };
  }
};

const apiTool = {
  function: executeFunction,
  definition: {
    type: "function",
    function: {
      name: "repliers_buildings_search",
      description:
        "Search for building data using the Repliers API. Returns information about buildings/complexes rather than individual listings. All parameters including map are sent as query parameters in GET requests.",
      parameters: {
        type: "object",
        properties: {
          params: {
            type: "object",
            properties: {
              // Location parameters
              city: {
                type: "array",
                items: { type: "string" },
                description: "Filters buildings by one or more cities",
              },
              neighborhood: {
                type: "array",
                items: { type: "string" },
                description: "Filter by one or more geographical neighborhoods that the building is situated in",
              },

              // Geographic parameters
              map: {
                type: "array",
                description:
                  "GeoJSON polygon coordinates array (sent as URL-encoded query parameter). Format: [[[lng,lat],[lng,lat],...]] for single polygon or [[polygon1],[polygon2],...] for multipolygon. Will be automatically JSON stringified and URL encoded.",
              },

              // Property classification
              class: {
                type: "array",
                items: {
                  type: "string",
                  enum: ["condo", "residential", "commercial"],
                },
                description: "The class of listing to filter the search results by",
              },

              // Price parameters
              minPrice: {
                type: "number",
                description: "Minimum price for units in the building",
              },
              maxPrice: {
                type: "number",
                description: "Maximum price for units in the building",
              },

              // Bedroom parameters
              minBeds: {
                type: "number",
                description: "Minimum number of bedrooms in building units",
              },
              maxBeds: {
                type: "number",
                description: "Maximum number of bedrooms in building units",
              },

              // Property details
              propertyType: {
                type: "array",
                items: { type: "string" },
                description: "Filters buildings by one or more property types",
              },

              // Listing type
              type: {
                type: "string",
                enum: ["Sale", "Lease"],
                description: "Used to filter properties that are for sale or for lease. If not specified, will return listings of all types",
              },

              // Address parameters
              streetName: {
                type: "string",
                description:
                  "Filter by the street name of the building (excluding the street suffix and direction, for example 'Yonge')",
              },
              streetNumber: {
                type: "string",
                description: "Filter by the street number of the building",
              },

              // Sorting
              sortBy: {
                type: "string",
                enum: ["numUnitsDesc"],
                description: "The attribute that the buildings will be sorted by",
              },

              // Display options
              displayPublic: {
                type: "string",
                enum: ["Y", "N"],
                description: "Y = publicly displayable buildings, N = password protected buildings. If not specified, returns both",
              },
            },
          },
          pageNum: {
            type: "number",
            minimum: 1,
            description: "Page number for pagination (default: 1). If specified loads a specific page in the results set",
          },
          resultsPerPage: {
            type: "number",
            minimum: 1,
            maximum: 100,
            description: "Number of buildings to return per page (default: 100, max: 100)",
          },
        },
        required: [],
      },
    },
  },
};

export { apiTool };