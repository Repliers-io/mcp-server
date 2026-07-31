// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: GET /locations/autocomplete (operationId: get_locations_autocomplete)

const executeFunction = async (args) => {
  const baseUrl = 'https://api.repliers.io';
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;

  const url = new URL(`${baseUrl}/locations/autocomplete`);

  if (args.search !== undefined) url.searchParams.set('search', String(args.search));
  if (args.source !== undefined) args.source.forEach(v => url.searchParams.append('source', String(v)));
  if (args.type !== undefined) args.type.forEach(v => url.searchParams.append('type', String(v)));
  if (args.fields !== undefined) url.searchParams.set('fields', String(args.fields));
  if (args.map !== undefined) url.searchParams.set('map', String(args.map));
  if (args.resultsPerPage !== undefined) url.searchParams.set('resultsPerPage', String(args.resultsPerPage));
  if (args.radius !== undefined) url.searchParams.set('radius', String(args.radius));
  if (args.lat !== undefined) url.searchParams.set('lat', String(args.lat));
  if (args.long !== undefined) url.searchParams.set('long', String(args.long));
  if (args.state !== undefined) args.state.forEach(v => url.searchParams.append('state', String(v)));
  if (args.area !== undefined) args.area.forEach(v => url.searchParams.append('area', String(v)));
  if (args.city !== undefined) args.city.forEach(v => url.searchParams.append('city', String(v)));
  if (args.boundary !== undefined) url.searchParams.set('boundary', String(args.boundary));
  if (args.hasBoundary !== undefined) url.searchParams.set('hasBoundary', String(args.hasBoundary));
  if (args.minSize !== undefined) url.searchParams.set('minSize', String(args.minSize));
  if (args.maxSize !== undefined) url.searchParams.set('maxSize', String(args.maxSize));
  if (args.classification !== undefined) args.classification.forEach(v => url.searchParams.append('classification', String(v)));
  if (args.subType !== undefined) args.subType.forEach(v => url.searchParams.append('subType', String(v)));

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
      name: "autocomplete-location-search",
      description: "Type-ahead location matching: pass the user's partial input in search (min 3 chars) and get matching areas/cities/neighborhoods with locationId. Use for resolving ambiguous or misspelled place names quickly; filter with type[] to narrow. NOT for property/listing lookups — use Search_Listings. If results look wrong or incomplete — see send-feedback.",
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
            "description": "The number of locations to return per page."
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
          }
        },
        required: ["search"],
      },
    },
  },
};
