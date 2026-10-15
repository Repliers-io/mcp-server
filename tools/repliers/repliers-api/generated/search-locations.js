// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: GET /locations (operationId: get_locations)

import { apiBaseUrl } from '../../../../lib/apiBase.js';
import { apiHeaders, readFailure, errorMessage } from '../../../../lib/apiRequest.js';

const executeFunction = async (args) => {
  const baseUrl = apiBaseUrl();

  const url = new URL(`${baseUrl}/locations`);

  if (args.source != null) [args.source].flat().forEach(v => url.searchParams.append('source', String(v)));
  if (args.type != null) [args.type].flat().forEach(v => url.searchParams.append('type', String(v)));
  if (args.state != null) [args.state].flat().forEach(v => url.searchParams.append('state', String(v)));
  if (args.area != null) [args.area].flat().forEach(v => url.searchParams.append('area', String(v)));
  if (args.city != null) [args.city].flat().forEach(v => url.searchParams.append('city', String(v)));
  if (args.neighborhood != null) [args.neighborhood].flat().forEach(v => url.searchParams.append('neighborhood', String(v)));
  if (args.locationId != null) [args.locationId].flat().forEach(v => url.searchParams.append('locationId', String(v)));
  if (args.fields != null) url.searchParams.set('fields', String(args.fields));
  if (args.locations != null) url.searchParams.set('locations', String(args.locations));
  if (args.aggregates != null) url.searchParams.set('aggregates', String(args.aggregates));
  if (args.resultsPerPage != null) url.searchParams.set('resultsPerPage', String(args.resultsPerPage));
  if (args.pageNum != null) url.searchParams.set('pageNum', String(args.pageNum));
  if (args.map != null) url.searchParams.set('map', String(args.map));
  if (args.radius != null) url.searchParams.set('radius', String(args.radius));
  if (args.radiusUnit != null) url.searchParams.set('radiusUnit', String(args.radiusUnit));
  if (args.lat != null) url.searchParams.set('lat', String(args.lat));
  if (args.long != null) url.searchParams.set('long', String(args.long));
  if (args.pointWithinBoundary != null) url.searchParams.set('pointWithinBoundary', String(args.pointWithinBoundary));
  if (args.sortBy != null) url.searchParams.set('sortBy', String(args.sortBy));
  if (args.hasBoundary != null) url.searchParams.set('hasBoundary', String(args.hasBoundary));
  if (args.minSize != null) url.searchParams.set('minSize', String(args.minSize));
  if (args.maxSize != null) url.searchParams.set('maxSize', String(args.maxSize));
  if (args.classification != null) [args.classification].flat().forEach(v => url.searchParams.append('classification', String(v)));
  if (args.subType != null) [args.subType].flat().forEach(v => url.searchParams.append('subType', String(v)));
  if (args.name != null) [args.name].flat().forEach(v => url.searchParams.append('name', String(v)));
  if (args.schoolType != null) [args.schoolType].flat().forEach(v => url.searchParams.append('schoolType', String(v)));
  if (args.schoolLevel != null) [args.schoolLevel].flat().forEach(v => url.searchParams.append('schoolLevel', String(v)));
  if (args.privateSchoolAffiliation != null) [args.privateSchoolAffiliation].flat().forEach(v => url.searchParams.append('privateSchoolAffiliation', String(v)));
  if (args.schoolDistrictName != null) [args.schoolDistrictName].flat().forEach(v => url.searchParams.append('schoolDistrictName', String(v)));

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
      name: "search-locations",
      description: "Search locations (areas, cities, neighborhoods, postal codes, school districts…) by name or filters; returns names, types, coordinates and locationId. Use to resolve a place the user named into a locationId or to explore what areas exist. Key params: name[] (place name), type[] (area|city|neighborhood|postalCode|district|schoolDistrict|school), city[], area[], resultsPerPage. NOT for listing searches — use Search_Listings.",
      parameters: {
        type: 'object',
        properties: {
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
            "description": "Aggregates values and counts for specified fields. Aggregates have many use cases, they're particularly useful for grouping and displaying acceptable values for fields that are used in filters. For more information refer to <a target=\"_blank\" href=\"https://help.repliers.com/en/article/using-aggregates-to-determine-acceptable-values-for-filters-c88csc\">Using Aggregates To Determine Acceptable Values For Filters</a>.<br/><br/>Comma-separate multiple fields. Only the following fields may be aggregated; any other value is rejected with a 400 error:<br/><br/><code>type</code>, <code>subType</code>, <code>classification</code>, <code>source</code>, <code>address.state</code>, <code>address.area</code>, <code>address.city</code>, <code>address.neighborhood</code>, <code>school.districtName</code>, <code>school.schoolType</code>, <code>school.lowGrade</code>, <code>school.highGrade</code>, <code>school.schoolLevel</code>, <code>school.isCharterSchool</code>, <code>school.isMagnetSchool</code>, <code>school.isVirtualSchool</code>, <code>school.isPrivate</code>, <code>school.isJJFacility</code>, <code>school.privateSchoolAffiliation</code>, <code>school.giftedAndTalented</code>, <code>school.dualEnrollment</code>, <code>school.creditRecovery</code>, <code>school.singleSexClasses</code>, <code>school.apCourse</code>, <code>school.internationalBaccalaureate</code>, <code>school.corporalPunishment</code>, <code>school.interscholarAthletics</code>, <code>school.offersKindergarten</code>, <code>school.offersFullDayKindergarten</code>, <code>school.apEnrollment</code>, <code>school.expenditurePerStudent</code>, <code>school.isTitleISchool</code>, <code>school.isTitleISchoolwideSchool</code>, <code>school.privateHours</code>, <code>school.privateDays</code>, <code>school.privateHasLibrary</code>, <code>school.privateCoed</code>, <code>school.isAssigned</code>"
          },
          "resultsPerPage": {
            "type": "integer",
            "minimum": 1,
            "default": 100,
            "description": "The number of locations to return per page. Values above 300 (or above the limit configured for your account) are not rejected; they are capped to that limit."
          },
          "pageNum": {
            "type": "integer",
            "minimum": 1,
            "default": 1,
            "description": "The page number to return. For example, with 100 results per page, specifying pageNum=2 returns results 101–200. Paging is limited to the first 100,000 results, so pageNum multiplied by resultsPerPage must not exceed 100,000. A pageNum more than one page past the last page of results is rejected with a 400 error."
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
          },
          "name": {
            "type": "array",
            "items": {
              "type": "string",
              "maxLength": 100
            },
            "description": "Filters locations by exact name. Repeat the parameter to supply multiple names."
          },
          "schoolType": {
            "type": "array",
            "items": {
              "type": "string",
              "maxLength": 100
            },
            "description": "Filters locations by school type. Applies to locations with `type=school`."
          },
          "schoolLevel": {
            "type": "array",
            "items": {
              "type": "string",
              "maxLength": 100
            },
            "description": "Filters locations by school level. Applies to locations with `type=school`."
          },
          "privateSchoolAffiliation": {
            "type": "array",
            "items": {
              "type": "string",
              "maxLength": 100
            },
            "description": "Filters locations by private school affiliation. Applies to locations with `type=school`."
          },
          "schoolDistrictName": {
            "type": "array",
            "items": {
              "type": "string",
              "maxLength": 100
            },
            "description": "Filters locations by school district name. Applies to locations with `type=school`."
          }
        },
        required: [],
      },
    },
  },
};
