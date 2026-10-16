// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: GET /locations/autocomplete (operationId: get_locations_autocomplete)

import { apiBaseUrl } from '../../../../lib/apiBase.js';
import { apiHeaders, readFailure, errorMessage } from '../../../../lib/apiRequest.js';

const executeFunction = async (args) => {
  const baseUrl = apiBaseUrl();

  const url = new URL(`${baseUrl}/locations/autocomplete`);

  if (args.search != null) url.searchParams.set('search', String(args.search));
  if (args.locationId != null) [args.locationId].flat().forEach(v => url.searchParams.append('locationId', String(v)));
  if (args.source != null) [args.source].flat().forEach(v => url.searchParams.append('source', String(v)));
  if (args.type != null) [args.type].flat().forEach(v => url.searchParams.append('type', String(v)));
  if (args.fields != null) url.searchParams.set('fields', String(args.fields));
  if (args.map != null) url.searchParams.set('map', String(args.map));
  if (args.resultsPerPage != null) url.searchParams.set('resultsPerPage', String(args.resultsPerPage));
  if (args.radius != null) url.searchParams.set('radius', String(args.radius));
  if (args.radiusUnit != null) url.searchParams.set('radiusUnit', String(args.radiusUnit));
  if (args.lat != null) url.searchParams.set('lat', String(args.lat));
  if (args.long != null) url.searchParams.set('long', String(args.long));
  if (args.state != null) [args.state].flat().forEach(v => url.searchParams.append('state', String(v)));
  if (args.area != null) [args.area].flat().forEach(v => url.searchParams.append('area', String(v)));
  if (args.city != null) [args.city].flat().forEach(v => url.searchParams.append('city', String(v)));
  if (args.boundary != null) url.searchParams.set('boundary', String(args.boundary));
  if (args.hasBoundary != null) url.searchParams.set('hasBoundary', String(args.hasBoundary));
  if (args.minSize != null) url.searchParams.set('minSize', String(args.minSize));
  if (args.maxSize != null) url.searchParams.set('maxSize', String(args.maxSize));
  if (args.classification != null) [args.classification].flat().forEach(v => url.searchParams.append('classification', String(v)));
  if (args.subType != null) [args.subType].flat().forEach(v => url.searchParams.append('subType', String(v)));

  const finalUrl = url.toString();

  try {
    const response = await fetch(finalUrl, {
      method: 'GET',
      headers: apiHeaders(args),
    });

    if (!response.ok) {
      const { status, body } = await readFailure(response);
      return { url: finalUrl, error: errorMessage(body) || `HTTP ${status}`, status, body };
    }

    // A 2xx can carry no body (typical for DELETE) or a plain-text one; neither is a failure.
    const text = await response.text();
    let data = { ok: true };
    if (text.trim()) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    return { url: finalUrl, data };
  } catch (error) {
    return { url: finalUrl, error: error.message, status: null, body: null };
  }
};

export const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: "autocomplete-location-search",
      description: "Type-ahead location matching: pass the user's partial input in search (min 3 chars) and get matching areas/cities/neighborhoods with locationId. Use for resolving ambiguous or misspelled place names quickly; filter with type[] to narrow. NOT for property/listing lookups — use Search_Listings.",
      parameters: {
        type: 'object',
        properties: {
          "search": {
            "type": "string",
            "minLength": 3,
            "maxLength": 100,
            "example": "Sacrame",
            "description": "Search query string"
          },
          "locationId": {
            "type": "array",
            "maxItems": 50,
            "items": {
              "type": "string",
              "maxLength": 30
            },
            "description": "Limits results to the specified locationIds. Repeat the parameter to supply multiple values, up to 50."
          },
          "source": {
            "type": "array",
            "items": {
              "type": "string",
              "enum": [
                "MLS",
                "UserDefined",
                "LiveBy",
                "PublicRecord"
              ],
              "description": "Location data source"
            },
            "description": "Filters locations by source:\n- `MLS` - Locations sourced from MLS (Multiple Listing Service) data.\n- `UserDefined` - Custom locations created and defined by users.\n- `LiveBy` - Locations sourced from LiveBy, a third-party neighborhood and community data provider.\n- `PublicRecord` - Locations sourced from Public Records Data.\n\n`UserDefined`, `LiveBy` and `PublicRecord` require the corresponding data to be enabled on your account. Requesting a source that is not enabled for your account returns a 400 error.\n"
          },
          "type": {
            "type": "array",
            "items": {
              "type": "string",
              "enum": [
                "area",
                "city",
                "city-alternate",
                "neighborhood",
                "neighborhood-alternate",
                "postalCode",
                "district",
                "schoolDistrict",
                "school",
                "property"
              ],
              "description": "Location type classification"
            },
            "description": "Limits results to specified location types:\n- `area` - Represents larger geographical divisions that may contain multiple cities and neighborhoods. Examples of Areas are counties, regions etc.\n- `city` - Municipal division that can include multiple neighborhoods within its boundaries.\n- `city-alternate` - Alternate representation of a city, used for specific data sources or contexts.\n- `neighborhood` - Smallest geographical unit within a city.\n- `neighborhood-alternate` - Alternate representation of a neighborhood, used for specific data sources or contexts.\n- `postalCode` - Represents postal code areas, which may span multiple neighborhoods or cities.\n- `district` - Represents administrative or political districts, which may span multiple neighborhoods or cities.\n- `schoolDistrict` - Represents school district areas, which may span multiple neighborhoods or cities.\n- `school` - Represents specific school locations and catchment areas.\n- `property` - Represents individual properties or land parcels along with publicly available information derived from public records data.\n"
          },
          "fields": {
            "type": "string",
            "maxLength": 500,
            "example": "name,address.city,address.state",
            "description": "Comma-separated list of fields to include in the response.\nThis allows clients to request only the specific data they need, reducing payload size.\nExamples:\n- `name,type` - Returns only location names and types\n- `name,address.city,address.state` - Returns location names and specific address components\n- `map.boundary` - Returns only geographical boundary data\n"
          },
          "map": {
            "type": "string",
            "format": "json",
            "description": "GeoJSON polygon or multi-polygon boundary for geographical filtering. Limits results to locations within the specified boundaries.\nFor complex polygons or multipolygons that exceed query parameter size limits, use the POST method\nand include the map data in the request body.\n\nFormat: Array of coordinate arrays, where each coordinate is [longitude, latitude] in WGS 84 format.\nThe polygon must be closed (first and last points must be identical).\n\nFor more information refer to the implementation guide  [Filtering Listings Geo-Spatially Using the \"map\" Parameter](https://help.repliers.com/en/article/filtering-listings-geo-spatially-using-the-map-parameter-7sorw0/)\n"
          },
          "resultsPerPage": {
            "type": "integer",
            "minimum": 1,
            "maximum": 10,
            "default": 10,
            "description": "The number of locations to return per page. Accepts 1-10 only, default 10 — this endpoint caps far lower than the other search tools, and a larger value is rejected by the API."
          },
          "radius": {
            "type": "number",
            "format": "float",
            "exclusiveMinimum": 0,
            "description": "Accepts a value for radius, expressed in the unit set by `radiusUnit` (KM by default). Must be used with `lat` and `long` parameters to return locations within the specified radius of a given latitude and longitude.\n"
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
          "lat": {
            "type": "number",
            "format": "float",
            "minimum": -90,
            "maximum": 90,
            "description": "Accepts a value for latitude. Must be used with `long` parameter. When used with `radius`, returns locations within the specified radius of these coordinates."
          },
          "long": {
            "type": "number",
            "format": "float",
            "minimum": -180,
            "maximum": 180,
            "description": "Accepts a value for longitude. Must be used with `lat` parameter. When used with `radius`, returns locations within the specified radius of these coordinates."
          },
          "state": {
            "type": "array",
            "items": {
              "type": "string",
              "maxLength": 100
            },
            "description": "Filters locations by 2-letter State/Province/Territory codes. Returns locations within the specified states.\n"
          },
          "area": {
            "type": "array",
            "items": {
              "type": "string",
              "maxLength": 100
            },
            "description": "Searches for locations only inside specified areas.\nAreas represent larger geographical divisions that may contain multiple cities and neighborhoods. Examples of Areas are counties, regions etc.\n"
          },
          "city": {
            "type": "array",
            "items": {
              "type": "string",
              "maxLength": 100
            },
            "description": "Searches for locations only inside specified cities.\nCities can include multiple neighborhoods within their boundaries.\n"
          },
          "boundary": {
            "type": "boolean",
            "default": null,
            "description": "Fetches locations with boundary polygons for a small performance penalty of 10-20ms\n"
          },
          "hasBoundary": {
            "type": "boolean",
            "default": null,
            "description": "Only search through locations that have boundary polygons\n"
          },
          "minSize": {
            "type": "number",
            "format": "float",
            "exclusiveMinimum": 0,
            "description": "Filters locations by minimum size (in square kilometers)."
          },
          "maxSize": {
            "type": "number",
            "format": "float",
            "exclusiveMinimum": 0,
            "description": "Filters locations by maximum size (in square kilometers)."
          },
          "classification": {
            "type": "array",
            "items": {
              "type": "string",
              "maxLength": 100
            },
            "description": "Filters locations by classification."
          },
          "subType": {
            "type": "array",
            "items": {
              "type": "string",
              "enum": [
                "village"
              ]
            },
            "description": "Filters locations by sub-type. Values are case-insensitive.<br/><br/>Allowed values:<br/><br/><code>village</code>"
          }
        },
        required: ["search"],
      },
    },
  },
};
