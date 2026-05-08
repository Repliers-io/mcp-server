// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: POST /buildings (operationId: post_buildings)

const executeFunction = async (args) => {
  const baseUrl = 'https://api.repliers.io';
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;

  const url = new URL(`${baseUrl}/buildings`);

  if (args.area !== undefined) args.area.forEach(v => url.searchParams.append('area', String(v)));
  if (args.buildingName !== undefined) args.buildingName.forEach(v => url.searchParams.append('buildingName', String(v)));
  if (args.city !== undefined) args.city.forEach(v => url.searchParams.append('city', String(v)));
  if (args.class !== undefined) args.class.forEach(v => url.searchParams.append('class', String(v)));
  if (args.displayPublic !== undefined) url.searchParams.set('displayPublic', String(args.displayPublic));
  if (args.lat !== undefined) url.searchParams.set('lat', String(args.lat));
  if (args.long !== undefined) url.searchParams.set('long', String(args.long));
  if (args.map !== undefined) url.searchParams.set('map', String(args.map));
  if (args.maxPrice !== undefined) url.searchParams.set('maxPrice', String(args.maxPrice));
  if (args.maxStories !== undefined) url.searchParams.set('maxStories', String(args.maxStories));
  if (args.minBathrooms !== undefined) url.searchParams.set('minBathrooms', String(args.minBathrooms));
  if (args.minBedrooms !== undefined) url.searchParams.set('minBedrooms', String(args.minBedrooms));
  if (args.minPrice !== undefined) url.searchParams.set('minPrice', String(args.minPrice));
  if (args.minStories !== undefined) url.searchParams.set('minStories', String(args.minStories));
  if (args.neighborhood !== undefined) args.neighborhood.forEach(v => url.searchParams.append('neighborhood', String(v)));
  if (args.pageNum !== undefined) url.searchParams.set('pageNum', String(args.pageNum));
  if (args.propertyType !== undefined) args.propertyType.forEach(v => url.searchParams.append('propertyType', String(v)));
  if (args.radius !== undefined) url.searchParams.set('radius', String(args.radius));
  if (args.resultsPerPage !== undefined) url.searchParams.set('resultsPerPage', String(args.resultsPerPage));
  if (args.sortBy !== undefined) url.searchParams.set('sortBy', String(args.sortBy));
  if (args.streetName !== undefined) args.streetName.forEach(v => url.searchParams.append('streetName', String(v)));
  if (args.streetNumber !== undefined) args.streetNumber.forEach(v => url.searchParams.append('streetNumber', String(v)));
  if (args.type !== undefined) url.searchParams.set('type', String(args.type));

  const body = {};
  if (args.map !== undefined) body.map = args.map;

  const finalUrl = url.toString();

  try {
    const response = await fetch(finalUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
      'Content-Type': 'application/json',
        'REPLIERS-API-KEY': apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(JSON.stringify(err));
    }

    const data = await response.json();
    return { url: finalUrl, data };
  } catch (error) {
    return { url: finalUrl, error: error.message };
  }
};

export const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: "search-buildings",
      description: "Searches for buildings based on location, price, property type, and other criteria. A building represents a unique address and groups together all current and historical listings at that address, making it useful for building directory pages and pre-construction research.",
      parameters: {
        type: 'object',
        properties: {
          "area": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Filters buildings by geographical area (also referred to as region or county)."
          },
          "buildingName": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Filters buildings by name. Availability of building names may vary by MLS and is not guaranteed for all buildings."
          },
          "city": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Filters buildings by city."
          },
          "class": {
            "type": "array",
            "items": {
              "type": "string",
              "enum": [
                "condo",
                "residential",
                "commercial"
              ],
              "description": "Classification of property type"
            },
            "description": "Filters buildings by property class."
          },
          "displayPublic": {
            "type": "string",
            "enum": [
              "yes",
              "no"
            ],
            "description": "Filters buildings by public display status. Y returns buildings that may be displayed publicly, N returns buildings that should be password protected."
          },
          "lat": {
            "type": "number",
            "format": "float",
            "minimum": -90,
            "maximum": 90,
            "description": "Accepts a value for latitude. Must be used with radius parameter to return buildings within a certain radius of a given latitude and longitude."
          },
          "long": {
            "type": "number",
            "format": "float",
            "minimum": -180,
            "maximum": 180,
            "description": "Accepts a value for longitude. Must be used with radius parameter to return buildings within a certain radius of a given latitude and longitude."
          },
          "map": {
            "type": "object",
            "description": "GeoJSON polygon for geographical filtering. Limits results to buildings within the specified boundaries.\nFormat: Array of coordinate arrays, where each coordinate is [longitude, latitude] in WGS 84 format.\nThe polygon must be closed (first and last points must be identical).\n",
            "properties": {
              "type": {
                "type": "string",
                "enum": [
                  "Polygon"
                ]
              },
              "coordinates": {
                "type": "array",
                "items": {
                  "type": "array",
                  "items": {
                    "type": "array",
                    "items": {
                      "type": "number"
                    },
                    "minItems": 2,
                    "maxItems": 2
                  }
                }
              }
            }
          },
          "maxPrice": {
            "type": "integer",
            "minimum": 0,
            "description": "Filters buildings whose listing prices are <= the supplied value."
          },
          "maxStories": {
            "type": "integer",
            "minimum": 1,
            "description": "Filters buildings whose story count is <= the supplied value."
          },
          "minBathrooms": {
            "type": "integer",
            "minimum": 0,
            "description": "Filters buildings whose bathroom count is >= the supplied value."
          },
          "minBedrooms": {
            "type": "integer",
            "minimum": 0,
            "description": "Filters buildings whose bedroom count is >= the supplied value."
          },
          "minPrice": {
            "type": "integer",
            "minimum": 0,
            "description": "Filters buildings whose listing prices are >= the supplied value."
          },
          "minStories": {
            "type": "integer",
            "minimum": 1,
            "description": "Filters buildings whose story count is >= the supplied value."
          },
          "neighborhood": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Filters buildings by neighborhood."
          },
          "pageNum": {
            "type": "integer",
            "minimum": 1,
            "default": 1,
            "description": "The page number to return. For example, with 100 results per page, specifying pageNum=2 returns results 101–200."
          },
          "propertyType": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Filters buildings by property type."
          },
          "radius": {
            "type": "number",
            "format": "float",
            "minimum": 1,
            "description": "Accepts a value for radius in KM. Must be used with `lat` and `long` parameters to return buildings within the specified radius of a given latitude and longitude."
          },
          "resultsPerPage": {
            "type": "integer",
            "minimum": 1,
            "maximum": 300,
            "default": 100,
            "description": "The number of buildings to return per page."
          },
          "sortBy": {
            "type": "string",
            "enum": [
              "numUnitsDesc"
            ],
            "description": "Sorts results by the specified field."
          },
          "streetName": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Filters buildings by street name."
          },
          "streetNumber": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Filters buildings by street number."
          },
          "type": {
            "type": "string",
            "enum": [
              "sale",
              "lease"
            ],
            "description": "Filters buildings by listing type."
          }
        },
        required: [],
      },
    },
  },
};
