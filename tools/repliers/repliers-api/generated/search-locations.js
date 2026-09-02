// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: GET /locations (operationId: get_locations)

import { apiBaseUrl } from '../../../../lib/apiBase.js';

const executeFunction = async (args) => {
  const baseUrl = apiBaseUrl();
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;

  const url = new URL(`${baseUrl}/locations`);

  if (args.source !== undefined) args.source.forEach(v => url.searchParams.append('source', String(v)));
  if (args.type !== undefined) args.type.forEach(v => url.searchParams.append('type', String(v)));
  if (args.state !== undefined) args.state.forEach(v => url.searchParams.append('state', String(v)));
  if (args.area !== undefined) args.area.forEach(v => url.searchParams.append('area', String(v)));
  if (args.city !== undefined) args.city.forEach(v => url.searchParams.append('city', String(v)));
  if (args.neighborhood !== undefined) args.neighborhood.forEach(v => url.searchParams.append('neighborhood', String(v)));
  if (args.locationId !== undefined) args.locationId.forEach(v => url.searchParams.append('locationId', String(v)));
  if (args.fields !== undefined) url.searchParams.set('fields', String(args.fields));
  if (args.locations !== undefined) url.searchParams.set('locations', String(args.locations));
  if (args.aggregates !== undefined) url.searchParams.set('aggregates', String(args.aggregates));
  if (args.resultsPerPage !== undefined) url.searchParams.set('resultsPerPage', String(args.resultsPerPage));
  if (args.pageNum !== undefined) url.searchParams.set('pageNum', String(args.pageNum));
  if (args.map !== undefined) url.searchParams.set('map', String(args.map));
  if (args.radius !== undefined) url.searchParams.set('radius', String(args.radius));
  if (args.lat !== undefined) url.searchParams.set('lat', String(args.lat));
  if (args.long !== undefined) url.searchParams.set('long', String(args.long));
  if (args.pointWithinBoundary !== undefined) url.searchParams.set('pointWithinBoundary', String(args.pointWithinBoundary));
  if (args.sortBy !== undefined) url.searchParams.set('sortBy', String(args.sortBy));
  if (args.hasBoundary !== undefined) url.searchParams.set('hasBoundary', String(args.hasBoundary));
  if (args.minSize !== undefined) url.searchParams.set('minSize', String(args.minSize));
  if (args.maxSize !== undefined) url.searchParams.set('maxSize', String(args.maxSize));
  if (args.classification !== undefined) args.classification.forEach(v => url.searchParams.append('classification', String(v)));
  if (args.subType !== undefined) args.subType.forEach(v => url.searchParams.append('subType', String(v)));
  if (args.name !== undefined) url.searchParams.set('name', String(args.name));
  if (args.schoolType !== undefined) args.schoolType.forEach(v => url.searchParams.append('schoolType', String(v)));
  if (args.schoolLevel !== undefined) args.schoolLevel.forEach(v => url.searchParams.append('schoolLevel', String(v)));
  if (args.privateSchoolAffiliation !== undefined) args.privateSchoolAffiliation.forEach(v => url.searchParams.append('privateSchoolAffiliation', String(v)));
  if (args.schoolDistrictName !== undefined) args.schoolDistrictName.forEach(v => url.searchParams.append('schoolDistrictName', String(v)));

  const finalUrl = url.toString();

  try {
    const response = await fetch(finalUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'REPLIERS-API-KEY': apiKey,
      },
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
      name: "search-locations",
      description: "Search locations (areas, cities, neighborhoods, postal codes, school districts…) by name or filters; returns names, types, coordinates and locationId. Use to resolve a place the user named into a locationId or to explore what areas exist. Key params: search (text), type[] (area|city|neighborhood|postalCode|district|schoolDistrict|school), city[], area[], resultsPerPage. NOT for listing searches — use Search_Listings. If results look wrong or incomplete — see send-feedback.",
      parameters: {
        type: 'object',
        properties: {
          "source": {
            "type": "array",
            "items": {},
            "description": "Filters locations by source:\n- `MSL` - Locations sourced from MLS (Multiple Listing Service) data.\n- `UserDefined` - Custom locations created and defined by users.\n- `LiveBy` - Locations sourced from LiveBy, a third-party neighborhood and community data provider.\n"
          },
          "type": {
            "type": "array",
            "items": {},
            "description": "Limits results to specified location types:\n- `area` - Represents larger geographical divisions that may contain multiple cities and neighborhoods. Examples of Areas are counties, regions etc.\n- `city` - Municipal division that can include multiple neighborhoods within its boundaries.\n- `city-alternate` - Alternate representation of a city, used for specific data sources or contexts.\n- `neighborhood` - Smallest geographical unit within a city.\n- `neighborhood-alternate` - Alternate representation of a neighborhood, used for specific data sources or contexts.\n- `postalCode` - Represents postal code areas, which may span multiple neighborhoods or cities.\n- `district` - Represents administrative or political districts, which may span multiple neighborhoods or cities.\n- `schoolDistrict` - Represents school district areas, which may span multiple neighborhoods or cities.\n- `school` - Represents specific school locations and catchment areas.\n"
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
            "description": "Filters locations by area names. Returns locations within the specified area.\nAreas represent larger geographical divisions that may contain multiple cities and neighborhoods. Examples of Areas are counties, regions etc.\n"
          },
          "city": {
            "type": "array",
            "items": {
              "type": "string",
              "maxLength": 100
            },
            "description": "Filters locations by city names. Returns locations within the specified city.\nCities can include multiple neighborhoods within their boundaries.\n"
          },
          "neighborhood": {
            "type": "array",
            "items": {
              "type": "string",
              "maxLength": 100
            },
            "description": "Filter results by neighborhood names. Returns specified neighborhoods.\nNeighborhoods represent the smallest geographical division in the hierarchy.\n"
          },
          "locationId": {
            "type": "array",
            "items": {
              "type": "string",
              "maxLength": 30
            },
            "description": "Filters by location IDs. Location IDs can be obtained from response of [Locations Autocomplete](/reference/get_locations-autocomplete#/) endpoint"
          },
          "fields": {
            "type": "string",
            "maxLength": 500,
            "example": "name,address,map.boundary",
            "description": "Comma-separated list of fields to include in the response.\nThis allows clients to request only the specific data they need, reducing payload size.\nExamples:\n- `name,type` - Returns only location names and types\n- `name,address.city,address.state` - Returns location names and specific address components\n- `map.boundary` - Returns only geographical boundary data\n"
          },
          "locations": {
            "type": "boolean",
            "description": "If false, the locations object will be empty. Useful for speeding up responses when aggregates are requested and locations are not needed. Default is true."
          },
          "aggregates": {
            "type": "string",
            "description": "Aggregates values and counts for specified fields. Aggregates have many use cases, they're particularly useful for grouping and displaying acceptable values for fields that are used in filters. For more information refer to <a target=\"_blank\" href=\"https://help.repliers.com/en/article/using-aggregates-to-determine-acceptable-values-for-filters-c88csc\">Using Aggregates To Determine Acceptable Values For Filters</a>."
          },
          "resultsPerPage": {
            "type": "integer",
            "minimum": 1,
            "maximum": 300,
            "default": 100,
            "description": "The number of locations to return per page."
          },
          "pageNum": {
            "type": "integer",
            "minimum": 1,
            "default": 1,
            "description": "The page number to return. For example, with 100 results per page, specifying pageNum=2 returns results 101–200."
          },
          "map": {
            "type": "string",
            "format": "json",
            "description": "GeoJSON polygon or multi-polygon boundary for geographical filtering. Limits results to locations within the specified boundaries.\nFor complex polygons or multipolygons that exceed query parameter size limits, use the POST method\nand include the map data in the request body.\n\nFormat: Array of coordinate arrays, where each coordinate is [longitude, latitude] in WGS 84 format.\nThe polygon must be closed (first and last points must be identical).\n\nFor more information refer to the implementation guide [Filtering Listings Geo-Spatially Using the \"map\" Parameter](https://help.repliers.com/en/article/filtering-listings-geo-spatially-using-the-map-parameter-7sorw0/)\n"
          },
          "radius": {
            "type": "number",
            "format": "float",
            "exclusiveMinimum": 0,
            "description": "Accepts a value for radius in KM. Must be used with `lat` and `long` parameters to return locations within the specified radius of a given latitude and longitude.\n"
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
          "pointWithinBoundary": {
            "type": "boolean",
            "default": false,
            "description": "When set to `true`, returns only locations whose boundaries contain the point specified by `lat` and `long` parameters.\nMust be used together with `lat` and `long`.\n"
          },
          "sortBy": {
            "type": "string",
            "enum": [
              "typeAsc",
              "typeDesc"
            ],
            "description": "Sort results by type"
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
              "type": "string"
            },
            "description": "Filters locations by classification."
          },
          "subType": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Filters locations by sub-type."
          },
          "name": {
            "type": "string",
            "maxLength": 100,
            "description": "Filters locations by exact name (case-insensitive)."
          },
          "schoolType": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Filters locations by school type. Applies to locations with `type=school`."
          },
          "schoolLevel": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Filters locations by school level. Applies to locations with `type=school`."
          },
          "privateSchoolAffiliation": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Filters locations by private school affiliation. Applies to locations with `type=school`."
          },
          "schoolDistrictName": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Filters locations by school district name. Applies to locations with `type=school`."
          }
        },
        required: [],
      },
    },
  },
};
