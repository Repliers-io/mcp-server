// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: POST /buildings (operationId: post_buildings)

import { apiBaseUrl } from '../../../../lib/apiBase.js';

const executeFunction = async (args) => {
  const baseUrl = apiBaseUrl();
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;

  const url = new URL(`${baseUrl}/buildings`);

  if (args.area != null) [args.area].flat().forEach(v => url.searchParams.append('area', String(v)));
  if (args.buildingName != null) [args.buildingName].flat().forEach(v => url.searchParams.append('buildingName', String(v)));
  if (args.city != null) [args.city].flat().forEach(v => url.searchParams.append('city', String(v)));
  if (args.class != null) [args.class].flat().forEach(v => url.searchParams.append('class', String(v)));
  if (args.displayPublic != null) url.searchParams.set('displayPublic', String(args.displayPublic));
  if (args.lat != null) url.searchParams.set('lat', String(args.lat));
  if (args.long != null) url.searchParams.set('long', String(args.long));
  if (args.map != null) url.searchParams.set('map', String(args.map));
  if (args.maxPrice != null) url.searchParams.set('maxPrice', String(args.maxPrice));
  if (args.maxStories != null) url.searchParams.set('maxStories', String(args.maxStories));
  if (args.minBathrooms != null) url.searchParams.set('minBathrooms', String(args.minBathrooms));
  if (args.minBedrooms != null) url.searchParams.set('minBedrooms', String(args.minBedrooms));
  if (args.minPrice != null) url.searchParams.set('minPrice', String(args.minPrice));
  if (args.minStories != null) url.searchParams.set('minStories', String(args.minStories));
  if (args.neighborhood != null) [args.neighborhood].flat().forEach(v => url.searchParams.append('neighborhood', String(v)));
  if (args.pageNum != null) url.searchParams.set('pageNum', String(args.pageNum));
  if (args.propertyType != null) [args.propertyType].flat().forEach(v => url.searchParams.append('propertyType', String(v)));
  if (args.radius != null) url.searchParams.set('radius', String(args.radius));
  if (args.radiusUnit != null) url.searchParams.set('radiusUnit', String(args.radiusUnit));
  if (args.resultsPerPage != null) url.searchParams.set('resultsPerPage', String(args.resultsPerPage));
  if (args.sortBy != null) url.searchParams.set('sortBy', String(args.sortBy));
  if (args.streetName != null) [args.streetName].flat().forEach(v => url.searchParams.append('streetName', String(v)));
  if (args.streetNumber != null) [args.streetNumber].flat().forEach(v => url.searchParams.append('streetNumber', String(v)));
  if (args.type != null) url.searchParams.set('type', String(args.type));
  if (args.status != null) [args.status].flat().forEach(v => url.searchParams.append('status', String(v)));

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
              "Y",
              "N"
            ],
            "description": "Filters buildings by public display status. Y returns buildings that may be displayed publicly, N returns buildings that should be password protected. Note - this parameter is currently validated but has no effect on the results."
          },
          "lat": {
            "type": "number",
            "format": "float",
            "minimum": -90,
            "maximum": 90,
            "description": "Accepts a value for latitude. Must be used together with the long and radius parameters to return buildings within a certain radius of a given latitude and longitude. If any one of lat, long or radius is provided, all three are required."
          },
          "long": {
            "type": "number",
            "format": "float",
            "minimum": -180,
            "maximum": 180,
            "description": "Accepts a value for longitude. Must be used together with the lat and radius parameters to return buildings within a certain radius of a given latitude and longitude. If any one of lat, long or radius is provided, all three are required."
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
            "minimum": 1,
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
            "minimum": 1,
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
            "type": "integer",
            "minimum": 1,
            "description": "Accepts a value for radius, expressed in the unit set by `radiusUnit` (KM by default). Must be used with `lat` and `long` parameters to return buildings within the specified radius of a given latitude and longitude. If any one of lat, long or radius is provided, all three are required. Must be a whole number greater than 0."
          },
          "radiusUnit": {
            "type": "string",
            "enum": [
              "m",
              "km",
              "mi",
              "yd"
            ],
            "default": "km",
            "description": "Sets the unit of measurement for the `radius` parameter. Can only be used together with `radius`.\n\nAllowed values:\n\n- `km` — kilometers (default)\n- `m` — meters\n- `mi` — miles\n- `yd` — yards\n"
          },
          "resultsPerPage": {
            "type": "integer",
            "minimum": 1,
            "maximum": 100,
            "default": 100,
            "description": "The number of buildings to return per page."
          },
          "sortBy": {
            "type": "string",
            "enum": [
              "numUnitsDesc"
            ],
            "description": "Sorts results by the specified field. Note - this parameter is currently validated but has no effect on the order of the results."
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
          },
          "status": {
            "type": "array",
            "items": {
              "type": "string",
              "enum": [
                "A",
                "U"
              ]
            },
            "description": "Filters buildings by the status of their listings. A returns buildings with available listings, U returns buildings with unavailable listings. Values are case-insensitive. Repeat the parameter to supply both."
          }
        },
        required: [],
      },
    },
  },
};
