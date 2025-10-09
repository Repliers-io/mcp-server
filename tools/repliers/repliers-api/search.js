/**
 * Comprehensive Repliers API Listings Search Tool
 * Fixed version that properly handles map parameter and body/query separation
 */

const executeFunction = async (args, apiKey) => {
  const baseUrl = "https://api.repliers.io";
  const repliersApiKey = apiKey || process.env.REPLIERS_API_KEY;
  const defaultResultsPerPage = parseInt(process.env.RESULTS_PER_PAGE) || 20;
  let finalUrl;

  if (!repliersApiKey) {
    throw new Error("REPLIERS_API_KEY environment variable is not set");
  }

  try {
    // Construct base URL
    const url = new URL(`${baseUrl}/listings`);

    // Separate body parameters from query parameters
    const bodyParams = {};

    // Handle special parameter serialization
    if (args.params) {
      const { imageSearchItems, map, ...queryParams } = args.params;

      // ImageSearchItems always goes in body when present
      if (imageSearchItems && Array.isArray(imageSearchItems)) {
        bodyParams.imageSearchItems = imageSearchItems;
      }

      // Map parameter goes in body when present (triggers POST)
      if (map) {
        bodyParams.map = map;
      }

      // Process all other parameters as query parameters
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
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
      "REPLIERS-API-KEY": repliersApiKey,
    };

    // Determine if we need to send a body
    const hasBodyParams = Object.keys(bodyParams).length > 0;

    if (hasBodyParams) {
      headers["Content-Type"] = "application/json";
    }

    // Execute request
    const response = await fetch(finalUrl, {
      method: hasBodyParams ? "POST" : "GET",
      headers,
      ...(hasBodyParams && { body: JSON.stringify(bodyParams) }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        url: finalUrl,
        method: hasBodyParams ? "POST" : "GET",
        status: response.status,
        error: errorData.error || "API request failed",
        details: errorData.details || errorData,
      };
    }

    const data = await response.json();
    return {
      url: finalUrl,
      method: hasBodyParams ? "POST" : "GET",
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
    console.error("Repliers API error:", error);
    return {
      url: finalUrl,
      error: "Network or processing error",
      details: error.message,
    };
  }
};

const repliersListingsSearchTool = {
  function: executeFunction,
  definition: {
    type: "function",
    function: {
      name: "repliers_listings_search",
      description:
        "Comprehensive property search using Repliers API with all supported parameters. Most parameters are sent as query parameters (GET request). imageSearchItems and map parameters trigger a POST request with body parameters.",
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
                description: "Filter listing by one or more cities",
              },
              state: {
                type: "array",
                items: { type: "string" },
                description:
                  "Filter by the address state of the listing, for example 'NY'",
              },
              area: {
                type: "string",
                description:
                  "Filter by the geographical area of the listing (also referred to as region)",
              },
              areaOrCity: {
                type: "array",
                items: { type: "string" },
                description:
                  "Filters listings where either the address.area or address.city field matches any of the provided values",
              },
              neighborhood: {
                type: "array",
                items: { type: "string" },
                description:
                  "Filter by the geographical neighborhood that the listing is situated in",
              },
              district: {
                type: "string",
                description:
                  "Filter by the geographical district of the listing",
              },
              zip: {
                type: "string",
                description: "Filters listings by postal or zip code",
              },
              zoning: {
                type: "string",
                description: "Filter listings by zoning description",
              },

              // Address parameters
              streetName: {
                type: "string",
                description:
                  "Filter by the street name of the listing (excluding the street suffix and direction, for example 'Yonge')",
              },
              streetNumber: {
                type: "string",
                description: "Filter by the street number of the listing",
              },
              minStreetNumber: {
                type: "number",
                description:
                  "Filter results where street number is greater than or equal to this value",
              },
              maxStreetNumber: {
                type: "number",
                description:
                  "Filter results where street number is less than or equal to this value",
              },
              streetDirection: {
                type: "array",
                items: { type: "string" },
                description: "Filter listings by one or more street directions",
              },
              streetSuffix: {
                type: "array",
                items: { type: "string" },
                description: "Filter listings by one or more street suffixes",
              },
              unitNumber: {
                type: "array",
                items: { type: "string" },
                description: "Filter by one or more unit numbers",
              },

              // Geographic parameters
              lat: {
                type: "string",
                description:
                  "Latitude value. Must be used with radius parameter",
              },
              long: {
                type: "string",
                description:
                  "Longitude value. Must be used with radius parameter",
              },
              radius: {
                type: "number",
                description:
                  "Radius in KM. Must be used with lat and long parameters",
              },
              map: {
                type: "array",
                description:
                  "GeoJSON polygon coordinates array (sent in request body, triggers POST). Format: [[[lng,lat],[lng,lat],...]] for single polygon or [[polygon1],[polygon2],...] for multipolygon",
              },
              mapOperator: {
                type: "string",
                enum: ["OR", "AND"],
                description:
                  "For multi-polygon map parameter: OR (default) = inside any polygon, AND = inside all polygons",
              },

              // Price parameters
              minPrice: {
                type: "number",
                description: "Minimum listing price",
              },
              maxPrice: {
                type: "number",
                description: "Maximum listing price",
              },
              minSoldPrice: {
                type: "number",
                description:
                  "Filter listings whose sold price is >= the supplied value",
              },
              maxSoldPrice: {
                type: "number",
                description:
                  "Filter listings whose sold price is <= the supplied value",
              },
              minMaintenanceFee: {
                type: "number",
                description: "Minimum maintenance fee",
              },
              maxMaintenanceFee: {
                type: "number",
                description: "Maximum maintenance fee",
              },
              minTaxes: {
                type: "number",
                description: "Minimum annual tax amount",
              },
              maxTaxes: {
                type: "number",
                description: "Maximum annual tax amount",
              },

              // Property details
              propertyType: {
                type: "array",
                items: { type: "string" },
                description: "Filters listings by one or more property types",
              },
              propertyTypeOrStyle: {
                type: "array",
                items: { type: "string" },
                description:
                  "Filters where either propertyType or style matches",
              },
              class: {
                type: "array",
                items: {
                  type: "string",
                  enum: ["condo", "residential", "commercial"],
                },
                description: "The class of listing to filter by",
              },
              style: {
                type: "array",
                items: { type: "string" },
                description: "Filter by the property style of the listing",
              },

              // Room parameters
              minBedrooms: {
                type: "number",
                description:
                  "Minimum bedrooms from original floorplan (above grade)",
              },
              maxBedrooms: {
                type: "number",
                description:
                  "Maximum bedrooms from original floorplan (above grade)",
              },
              minBedroomsPlus: {
                type: "number",
                description: "Minimum additional bedrooms (basement/attic)",
              },
              maxBedroomsPlus: {
                type: "number",
                description: "Maximum additional bedrooms (basement/attic)",
              },
              minBedroomsTotal: {
                type: "number",
                description: "Minimum total bedrooms (bedrooms + bedroomsPlus)",
              },
              maxBedroomsTotal: {
                type: "number",
                description: "Maximum total bedrooms (bedrooms + bedroomsPlus)",
              },
              minBaths: {
                type: "number",
                description: "Minimum number of bathrooms",
              },
              maxBaths: {
                type: "number",
                description: "Maximum number of bathrooms",
              },
              minKitchens: {
                type: "number",
                description: "Minimum number of kitchens",
              },
              maxKitchens: {
                type: "number",
                description: "Maximum number of kitchens",
              },

              // Size parameters
              minSqft: {
                type: "number",
                description:
                  "Minimum square footage (excludes listings without sqft)",
              },
              maxSqft: {
                type: "number",
                description:
                  "Maximum square footage (excludes listings without sqft)",
              },
              sqft: {
                type: "array",
                items: { type: "string" },
                description: "Filters listings by one or more values for sqft",
              },

              // Year built
              minYearBuilt: {
                type: "string",
                description:
                  "Minimum year built (excludes listings without year)",
              },
              maxYearBuilt: {
                type: "number",
                description:
                  "Maximum year built (excludes listings without year)",
              },
              yearBuilt: {
                type: "array",
                items: { type: "string" },
                description:
                  "Filter listings by one or more values for yearBuilt",
              },

              // Parking parameters
              minParkingSpaces: {
                type: "number",
                description: "Minimum parking spaces",
              },
              garage: {
                type: "array",
                items: { type: "string" },
                description: "Filter listings by garage description",
              },
              minGarageSpaces: {
                type: "number",
                description: "Minimum garage spaces",
              },
              driveway: {
                type: "array",
                items: { type: "string" },
                description:
                  "Filters listings by one or more values for driveway",
              },

              // Features and amenities
              amenities: {
                type: "array",
                items: { type: "string" },
                description: "Filter by amenities like 'Gym', 'Swimming Pool'",
              },
              swimmingPool: {
                type: "array",
                items: { type: "string" },
                description: "Filter listings by swimming pool values",
              },
              balcony: {
                type: "array",
                items: { type: "string" },
                description: "Filters listings by balcony values",
              },
              basement: {
                type: "array",
                items: { type: "string" },
                description: "Filters listings by basement description",
              },
              den: {
                type: "string",
                description: "Filter listings by den description",
              },
              locker: {
                type: "array",
                items: { type: "string" },
                description: "Filters listings by locker values",
              },
              heating: {
                type: "array",
                items: { type: "string" },
                description: "Filters listings by heating values",
              },
              waterSource: {
                type: "array",
                items: { type: "string" },
                description: "Filter listings by water source values",
              },
              sewer: {
                type: "array",
                items: { type: "string" },
                description: "Filters listings by sewer values",
              },
              exteriorConstruction: {
                type: "array",
                items: { type: "string" },
                description:
                  "Filters by exterior construction (matches exteriorConstruction1 and exteriorConstruction2)",
              },
              waterfront: {
                type: "string",
                enum: ["Y", "N"],
                description:
                  "Y = waterfront listings, N = non-waterfront listings",
              },

              // Status and type
              status: {
                type: "array",
                items: {
                  type: "string",
                  enum: ["A", "U"],
                },
                description:
                  "A = active listings, U = unavailable listings (default: A)",
              },
              lastStatus: {
                type: "array",
                items: {
                  type: "string",
                  enum: [
                    "Sus",
                    "Exp",
                    "Sld",
                    "Ter",
                    "Dft",
                    "Lsd",
                    "Sc",
                    "Sce",
                    "Lc",
                    "Pc",
                    "Ext",
                    "New",
                  ],
                },
                description: "Filter by last status of the listing",
              },
              type: {
                type: "array",
                items: {
                  type: "string",
                  enum: ["sale", "lease"],
                },
                description: "Filter properties for sale or lease",
              },

              // Business properties
              businessType: {
                type: "array",
                items: { type: "string" },
                description: "Filter by business type",
              },
              businessSubType: {
                type: "array",
                items: { type: "string" },
                description: "Filter by business sub-type",
              },

              // MLS and identification
              mlsNumber: {
                type: "array",
                items: { type: "string" },
                description: "Filter listings by one or more MLS numbers",
              },
              boardId: {
                type: "array",
                items: { type: "number" },
                description:
                  "Filter by board ID (required if account has multiple MLS access)",
              },

              // Agent and brokerage
              agent: {
                type: "array",
                items: { type: "string" },
                description: "Filter by agent name or agent ID",
              },
              brokerage: {
                type: "string",
                description: "Filter results by brokerage name",
              },
              officeId: {
                type: "string",
                description:
                  "Filter listings by the office ID of the listing brokerage",
              },
              hasAgents: {
                type: "boolean",
                description:
                  "true = only listings with agents, false = only listings without agents",
              },

              // Date filters
              listDate: {
                type: "string",
                format: "date",
                description: "Filter by specific listing date (YYYY-MM-DD)",
              },
              minListDate: {
                type: "string",
                format: "date",
                description:
                  "Listings listed on or after this date (YYYY-MM-DD)",
              },
              maxListDate: {
                type: "string",
                format: "date",
                description:
                  "Listings listed on or before this date (YYYY-MM-DD)",
              },
              minSoldDate: {
                type: "string",
                format: "date",
                description:
                  "Listings sold/leased on or after this date (YYYY-MM-DD)",
              },
              maxSoldDate: {
                type: "string",
                format: "date",
                description:
                  "Listings sold/leased on or before this date (YYYY-MM-DD)",
              },
              updatedOn: {
                type: "string",
                format: "date",
                description: "Filter by specific MLS update date (YYYY-MM-DD)",
              },
              minUpdatedOn: {
                type: "string",
                format: "date",
                description:
                  "Listings updated on or after this date (YYYY-MM-DD)",
              },
              maxUpdatedOn: {
                type: "string",
                format: "date",
                description:
                  "Listings updated on or before this date (YYYY-MM-DD)",
              },
              minUnavailableDate: {
                type: "string",
                format: "date",
                description:
                  "Listings unavailable on or after this date (YYYY-MM-DD)",
              },
              maxUnavailableDate: {
                type: "string",
                format: "date",
                description:
                  "Listings unavailable on or before this date (YYYY-MM-DD)",
              },
              minOpenHouseDate: {
                type: "string",
                format: "date",
                description:
                  "Listings with open house on or after this date (YYYY-MM-DD)",
              },
              maxOpenHouseDate: {
                type: "string",
                format: "date",
                description:
                  "Listings with open house on or before this date (YYYY-MM-DD)",
              },
              repliersUpdatedOn: {
                type: "string",
                format: "date",
                description:
                  "Filter by specific Repliers internal update date (YYYY-MM-DD)",
              },
              minRepliersUpdatedOn: {
                type: "string",
                format: "date",
                description:
                  "Repliers internal updates on or after this date (YYYY-MM-DD)",
              },
              maxRepliersUpdatedOn: {
                type: "string",
                format: "date",
                description:
                  "Repliers internal updates on or before this date (YYYY-MM-DD)",
              },

              // Display options
              displayAddressOnInternet: {
                type: "string",
                enum: ["Y", "N"],
                description:
                  "Y = address can be displayed, N = address should not be displayed",
              },
              displayInternetEntireListing: {
                type: "string",
                enum: ["Y", "N"],
                description:
                  "Y = can display on internet portals, N = back office only",
              },
              displayPublic: {
                type: "string",
                enum: ["Y", "N"],
                description: "Y = publicly displayable, N = password protected",
              },
              hasImages: {
                type: "boolean",
                description: "Filter listings with/without images",
              },

              // Search parameters
              search: {
                type: "string",
                description: "Keyword search across listing fields",
              },
              searchFields: {
                type: "string",
                description:
                  "Limit keyword search to specific fields (e.g., 'address.streetName')",
              },
              operator: {
                type: "string",
                enum: ["AND", "OR"],
                description:
                  "AND = match all parameters, OR = match at least one (default: AND)",
              },

              // Sorting
              sortBy: {
                type: "string",
                description:
                  "Sort attribute (default: updatedOnDesc). Use distanceAsc/Desc with lat/long/radius",
              },

              // Response customization
              fields: {
                type: "string",
                description:
                  "Limit response fields (e.g., 'listPrice,soldPrice' or 'images[5]' for first 5 images)",
              },
              coverImage: {
                type: "string",
                enum: ["image", "text"],
                description: "Change cover image using AI-powered feature",
              },

              // Aggregation and clustering
              aggregates: {
                type: "string",
                description: "Aggregate values/counts for specified fields",
              },
              aggregateStatistics: {
                type: "boolean",
                description: "Group statistics by aggregates when both used",
              },
              statistics: {
                type: "string",
                description: `Request real-time market statistics. MUST BE USED when user asks for: average, mean, median, min, max, sum, total, or any statistical calculation.
                              Format: Comma-separated field names (e.g., 'listPrice,soldPrice,daysOnMarket')
                              Returns: min, max, avg, median, sum, count for each field
                              Examples:
                              - "calculate median price" → statistics: "listPrice"
                              - "average days on market" → statistics: "daysOnMarket"
                              - "price statistics" → statistics: "listPrice"
                              Can be grouped by aggregates when aggregateStatistics=true`,
              },
              cluster: {
                type: "boolean",
                description: "Enable dynamic map clusters",
              },
              clusterFields: {
                type: "string",
                description:
                  "Fields to include in clusters (e.g., 'listPrice,images[5]')",
              },
              clusterLimit: {
                type: "number",
                minimum: 1,
                maximum: 200,
                description:
                  "Limit clusters returned when 'map' in aggregates (1-200)",
              },
              clusterPrecision: {
                type: "number",
                minimum: 0,
                maximum: 29,
                description:
                  "Cluster granularity (0-29, lower = fewer clusters)",
              },
              clusterStatistics: {
                type: "boolean",
                description: "Calculate statistics per cluster",
              },
              listings: {
                type: "boolean",
                description:
                  "Include listings in response (default: true, set false for stats only)",
              },

              // AI features
              nlpQuery: {
                type: "string",
                description: "Natural language query for AI processing",
              },
              // AI Image Search parameters (sent in request body)
              imageSearchItems: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    type: {
                      type: "string",
                      enum: ["image", "text"],
                      description:
                        "Input type - 'image' for image URLs or 'text' for text descriptions",
                    },
                    url: {
                      type: "string",
                      description: "Image URL (required when type='image')",
                    },
                    value: {
                      type: "string",
                      description:
                        "Text description (required when type='text')",
                    },
                    boost: {
                      type: "integer",
                      description:
                        "Importance weight (higher = more important)",
                    },
                  },
                  required: ["type"],
                  description:
                    "AI image search item - provide either image URL or text description",
                },
                description:
                  "AI-powered image search criteria (sent in request body, triggers POST method)",
              },
            },
          },
          pageNum: {
            type: "number",
            minimum: 1,
            description: "Page number for pagination (default: 1)",
          },
          resultsPerPage: {
            type: "number",
            minimum: 1,
            maximum: 100,
            description: "Number of results per page (default: 100, max: 100)",
          },
        },
        required: [],
      },
    },
  },
};

export { repliersListingsSearchTool };
