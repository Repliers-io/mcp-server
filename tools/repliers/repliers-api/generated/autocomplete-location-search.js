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
      description: "Autocomplete for Locations search. As your user types, you simply pass their input into search param and get locations which match their input. You can use other params to fine-tune the locations which will be returned for a given search.\n\n---\nBuilding an Autocomplete Search Feature\nArticles on: Property Search & Filtering\n\nBuilding an Autocomplete Search Feature with Repliers APIs\n\nA comprehensive guide to implementing a unified search experience that combines MLS® listings with cities and neighborhoods using the Repliers API.\n\nOverview\n\nThis recipe demonstrates how to build a powerful autocomplete search feature that allows users to search for both MLS® listings and locations simultaneously. The results are presented categorically, giving users a seamless search experience whether they're looking for a specific property address, MLS® number, or exploring different areas.\n\nExample\n\nImplementation Steps\n\nStep 1: Search MLS® Listings\n\nThe first step involves searching through MLS® listings using the /listings endpoint. This allows users to find properties by address components or MLS® numbers.\n\nAPI Request\n\nGET https://api.repliers.io/listings?search={user_input}&searchFields=address.streetNumber,address.streetName,mlsNumber,address.city&fields=address.*,mlsNumber,listPrice\n\nRequest Parameters Breakdown\n\nParameter \nDescription \nExample \n\nsearch \nThe user's input from the search field \n123 \n\nsearchFields \nComma-separated list of fields to search within \naddress.streetNumber,address.streetName,mlsNumber,address.city \n\nfields \nFields to include in the response (for performance optimization) \naddress.*,mlsNumber,listPrice \n\nWhy These Search Fields?\n\naddress.streetNumber - Allows finding properties by house number\naddress.streetName - Enables searching by street names\nmlsNumber - Lets users search by listing ID/MLS® number\naddress.city - Enables city-based property searches\n\nField Selection Best Practices\n\nOnly request the fields you need to display in your autocomplete results. This improves API performance significantly. Learn more about field optimization in our Fields Parameter Guide.\n\nExample Response\n\n{\n\"apiVersion\": \"1\",\n\"page\": 1,\n\"numPages\": 3,\n\"pageSize\": 100,\n\"count\": 293,\n\"statistics\": {\n\"listPrice\": {\n\"min\": 1,\n\"max\": 14585000\n}\n},\n\"listings\": [\n{\n\"mlsNumber\": \"X12151945\",\n\"listPrice\": \"1250000.00\",\n\"address\": {\n\"area\": \"Peterborough\",\n\"city\": \"Trent Lakes\",\n\"country\": \"Canada\",\n\"district\": null,\n\"majorIntersection\": \"Hwy 36 & Bessie Ave\",\n\"neighborhood\": \"Trent Lakes\",\n\"streetDirection\": null,\n\"streetName\": \"Fire Route 123\",\n\"streetNumber\": \"13\",\n\"streetSuffix\": \"N/A\",\n\"unitNumber\": null,\n\"zip\": \"K0M 1A0\",\n\"state\": \"Ontario\",\n\"communityCode\": null,\n\"streetDirectionPrefix\": null\n}\n},\n{\n\"mlsNumber\": \"X12196167\",\n\"listPrice\": \"1895000.00\",\n\"address\": {\n\"area\": \"Grey County\",\n\"city\": \"Grey Highlands\",\n\"country\": \"Canada\",\n\"district\": null,\n\"majorIntersection\": \"Lakeview Rd off of Rd 63\",\n\"neighborhood\": \"Grey Highlands\",\n\"streetDirection\": null,\n\"streetName\": \"Lakeview\",\n\"streetNumber\": \"123\",\n\"streetSuffix\": \"Rd\",\n\"unitNumber\": null,\n\"zip\": \"N0C 1M0\",\n\"state\": \"Ontario\",\n\"communityCode\": null,\n\"streetDirectionPrefix\": null\n}\n}\n]\n}\n\nNote: Results are returned in order of relevance based on our proprietary algorithm, refined over years of optimization.\n\nStep 2: Search Locations (Asynchronous)\n\nSimultaneously search for matching locations using the /locations/autocomplete endpoint. This provides cities, neighborhoods, and areas from MLS® data.\n\nAPI Request\n\nGET https://api.repliers.io/locations/autocomplete?search={user_input}\n\nFiltering by Location Type\n\nYou can limit results to specific location types if needed:\n\nGET https://api.repliers.io/locations/autocomplete?search=tor&type=city&type=neighborhood\n\nThis example excludes areas (counties/regions) and only returns cities and neighborhoods.\n\nExample Response\n\n{\n\"page\": 1,\n\"numPages\": 2,\n\"pageSize\": 10,\n\"count\": 20,\n\"locations\": [\n{\n\"resource\": \"Property:2381\",\n\"locationId\": \"CAONCIREWPFEEZ\",\n\"name\": \"Toronto\",\n\"type\": \"city\",\n\"map\": {\n\"latitude\": \"43.653226\",\n\"longitude\": \"-79.3831843\"\n},\n\"address\": {\n\"state\": \"ON\",\n\"country\": \"CA\",\n\"city\": \"Toronto\",\n\"area\": \"Toronto\",\n\"neighborhood\": \"\"\n}\n},\n{\n\"resource\": \"Property:2381\",\n\"locationId\": \"CAONNBZFGYQLJV\",\n\"name\": \"Toronto Gore Rural Estate\",\n\"type\": \"neighborhood\",\n\"map\": {\n\"latitude\": \"43.8003876\",\n\"longitude\": \"-79.7014332\"\n},\n\"address\": {\n\"state\": \"ON\",\n\"country\": \"CA\",\n\"city\": \"Brampton\",\n\"area\": \"Peel\",\n\"neighborhood\": \"Toronto Gore Rural Estate\"\n}\n}\n]\n}\n\nStep 3: Combine and Present Results\n\nConcatenate the listings and locations results, then present them to users in organized categories (e.g., \"Properties\", \"Cities\", \"Neighborhoods\").\n\nImplementation Best Practices\n\nPerformance Optimization\n\nDebounce User Input Implement a debounce mechanism to prevent API calls on every keystroke. Recommended delay: 300-500ms after the user stops typing.\n\n// Example debounce implementation\nconst debounce = (func, delay) => {\nlet timeoutId;\nreturn (...args) => {\nclearTimeout(timeoutId);\ntimeoutId = setTimeout(() => func.apply(null, args), delay);\n};\n};\n\nconst debouncedSearch = debounce(performSearch, 300);\n\nField Selection Only request the fields you need in your fields parameter. This significantly improves response times and reduces bandwidth usage.\nConcurrent Requests Execute both API calls (listings and locations) simultaneously using Promise.all() or similar concurrent execution patterns.\n\nUser Experience Considerations\n\nCategorized Results Present results in clear categories:\n\nProperties (from listings endpoint)\nCities (from locations endpoint)\nNeighborhoods (from locations endpoint)\nAreas (from locations endpoint, if included)\n\nVisual Hierarchy Use clear visual distinctions between categories and include relevant details like:\n\nProperty addresses and prices\nLocation types (city, neighborhood, area)\nGeographic context when helpful\n\nLoading States Implement appropriate loading indicators while API requests are in progress.\n\nCode Example\n\nasync function performAutocompleteSearch(query) {\nif (query.length < 2) return; // Don't search for very short queries\n\ntry {\n// Execute both searches concurrently\nconst [listingsResponse, locationsResponse] = await Promise.all([\nfetch(`https://api.repliers.io/listings?search=${encodeURIComponent(query)}&searchFields=address.streetNumber,address.streetName,mlsNumber,address.city&fields=address.*,mlsNumber,listPrice`),\nfetch(`https://api.repliers.io/locations/autocomplete?search=${encodeURIComponent(query)}`)\n]);\n\nconst listings = await listingsResponse.json();\nconst locations = await locationsResponse.json();\n\n// Combine and categorize results\nconst results = {\nproperties: listings.listings || [],\ncities: locations.locations?.filter(loc => loc.type === 'city') || [],\nneighborhoods: locations.locations?.filter(loc => loc.type === 'neighborhood') || [],\nareas: locations.locations?.filter(loc => loc.type === 'area') || []\n};\n\ndisplayResults(results);\n\n} catch (error) {\nconsole.error('Search failed:', error);\n// Handle error appropriately\n}\n}\n\n// Apply debouncing\nconst debouncedSearch = debounce(performAutocompleteSearch, 300);\n\n// Attach to search input\ndocument.getElementById('search-input').addEventListener('input', (e) => {\ndebouncedSearch(e.target.value);\n});\n\nAlternative Approaches\n\nHybrid Location Services\n\nFor markets where MLS® location data doesn't align with local terminology, consider combining:\n\nOption 1: Google Places Integration\n\n// Use Google Places for locations, Repliers for listings\nconst [listingsResponse, placesResponse] = await Promise.all([\nsearchReplierListings(query),\nsearchGooglePlaces(query)\n]);\n\nOption 2: Mapbox Integration\n\n// Use Mapbox for locations, Repliers for listings\nconst [listingsResponse, mapboxResponse] = await Promise.all([\nsearchReplierListings(query),\nsearchMapboxPlaces(query)\n]);\n\nThis hybrid approach provides the comprehensive MLS® listing data from Repliers while leveraging the superior location recognition capabilities of specialized mapping services.\n\nConclusion\n\nThis autocomplete implementation provides users with a comprehensive search experience that bridges the gap between specific property searches and general location exploration. By combining both endpoints and following the optimization practices outlined above, you can create a fast, intuitive search interface that helps users find exactly what they're looking for.\n\nWhat questions does this article answer?\n\nHow do I build an autocomplete search experience that returns both listings and locations? \nHow do I structure results so that MLS® listings, cities, and neighborhoods appear in separate categories? \nWhich endpoints should I combine (Listings, Locations, possibly NLP) for a unified autocomplete? \nWhat does a complete implementation flow look like from keystroke to API requests and response handling? \nHow can I design a UX similar to Repliers’ autocomplete demo? \n\nUpdated on: 05/12/2025\n---",
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
