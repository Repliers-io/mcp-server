// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: GET /locations (operationId: get_locations)

const executeFunction = async (args) => {
  const baseUrl = 'https://api.repliers.io';
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
      description: "Searches for geographical locations such as cities, neighborhoods, and districts. Useful for building location pickers and populating address-based filters in search interfaces. For real-time autocomplete as a user types, use the GET /locations/autocomplete endpoint instead.\n\n---\nLocations API Implementation Guide\nArticles on: Property Search & Filtering\n\nLocations API Implementation Guide\n\nOverview\n\nThe Locations API provides two endpoints for working with geographical data in your real estate application:\n\nGET /locations - Advanced filtering and querying of location data\nGET /locations/autocomplete - Relevance-based search for typeahead/dropdown interfaces\n\nThese endpoints use location terminology that directly matches your MLS data, eliminating the common mismatch issues that occur when using third-party services like Google Maps or Mapbox for location search.\n\nTry out locations endpoints in our Developer Playgrounds\n\nUnderstanding Location Sources\n\nThe API aggregates location data from multiple providers, each offering different geographical coverage and use cases. Use the source parameter to restrict results to a specific provider, or omit it to search across all available sources.\n\nMLS - Locations sourced directly from MLS (Multiple Listing Service) data. These locations use terminology that matches your MLS board exactly, ensuring consistency with the geographical divisions referenced in your listings data and eliminating mismatch issues common with third-party geocoders. Usually doesn't contain boundary data.\nUserDefined - Custom locations you create and define yourself. Use this source to add proprietary neighborhoods, service areas, or any bespoke geographies specific to your business that aren't represented in MLS data.\nLiveBy - Locations sourced from LiveBy, a third-party provider specializing in neighborhood and community data. LiveBy augments MLS data with neighborhood boundaries and community-level detail, useful when you need location boundaries data and neighborhood insights.\n\nUnderstanding Location Types\n\nThe API recognizes location types spanning multiple geographical hierarchies and administrative divisions:\n\narea - Larger geographical divisions (synonymous with region, county, parish) that may contain multiple cities and neighborhoods\ncity - Municipal divisions (synonymous with town) that can include multiple neighborhoods\ncity-alternate - Alternate representation of a city, used for specific data sources or contexts\nneighborhood - The smallest geographical unit (synonymous with community) within a city\nneighborhood-alternate - Alternate representation of a neighborhood, used for specific data sources or contexts\npostalCode - Postal code areas that may span multiple neighborhoods or cities\ndistrict - Administrative or political districts that may span multiple neighborhoods or cities\nschoolDistrict - School district areas that may span multiple neighborhoods or cities\nschool - Specific school locations and their catchment areas\n\nLocation Model\n\nEach location entity includes the following structure:\n\n{\n\"locationId\": \"CAONNBWJBFJQLT\",\n\"name\": \"Downsview-Roding-CFB\",\n\"type\": \"neighborhood\",\n\"map\": {\n\"latitude\": \"43.7298069\",\n\"longitude\": \"-79.4923515\",\n\"point\": \"POINT (-79.4923515 43.7298069)\",\n\"boundary\": [\n[\n[\n-79.55113337288341,\n43.77949638257084\n],\n[\n-79.45357859322043,\n43.802565569203864\n],\n[\n-79.42666692986468,\n43.73381743036484\n],\n[\n-79.55113337288341,\n43.77949638257084\n]\n]\n]\n},\n\"address\": {\n\"state\": \"ON\",\n\"country\": \"CA\",\n\"city\": \"Toronto\",\n\"area\": \"Toronto\",\n\"neighborhood\": \"Downsview-Roding-CFB\"\n}\n}\n\nGET /locations\n\nUse this endpoint for advanced filtering, pagination, and geographical queries.\n\nCommon Use Cases\n\n1. List All Neighborhoods in a City\n\nGET /locations?city=Toronto&type=neighborhood\n\nReturns all neighborhoods within Toronto.\n\n2. List All Cities and Neighborhoods in an Area\n\nGET /locations?area=York%20Region&type=city,neighborhood\n\nReturns all cities and neighborhoods within York Region.\n\n3. Get All Areas in a State\n\nGET /locations?state=MA&typearea\n\n4. Get Locations Within a Radius\n\nGET /locations?lat=43.7298069&long=-79.4923515&radius=5\n\nReturns all locations within 5km of the specified coordinates.\n\n5. Get Locations with Boundaries Only\n\nGET /locations?city=Toronto&hasBoundary=true\n\nReturns only locations that have boundary polygon data, useful for map visualization.\n\n6. Optimize Response Size with Field Selection\n\nGET /locations?city=Toronto&type=neighborhood&fields=name,type,locationId\n\nReturns only the specified fields, reducing payload size for better performance.\n\nGET /locations Parameters Reference\n\nParameter \nType \nDescription \n\npageNum \ninteger \nPage number for pagination (e.g., pageNum=2 for results 101-200 with 100 results per page) \n\nresultsPerPage \ninteger \nNumber of locations per page (1-300, default: 100) \n\nsource \narray of strings \nFilter by data source: MLS, UserDefined, LiveBy \n\ntype \narray of strings \nFilter by location type: area, city, city-alternate, neighborhood, neighborhood-alternate, postalCode, district, schoolDistrict, school \n\narea \narray of strings \nFilter by area names \n\ncity \narray of strings \nFilter by city names \n\nneighborhood \narray of strings \nFilter by neighborhood names \n\nstate \narray of strings \nFilter by 2-letter state/province/territory codes \n\nlocationId \narray of strings \nFilter by specific location IDs (obtained from autocomplete endpoint) \n\nname \nstring \nFilter by exact location name (case-insensitive) \n\nclassification \narray of strings \nFilter by location classification \n\nsubType \narray of strings \nFilter by location sub-type \n\nminSize \nfloat \nMinimum location size in square kilometers \n\nmaxSize \nfloat \nMaximum location size in square kilometers \n\nlat \nfloat \nLatitude coordinate (requires long; combine with radius or pointWithinBoundary) \n\nlong \nfloat \nLongitude coordinate (requires lat; combine with radius or pointWithinBoundary) \n\nradius \nfloat \nRadius in kilometers (requires lat and long) \n\nmap \nGeoJSON \nPolygon or multi-polygon boundary for geographical filtering \n\npointWithinBoundary \nboolean \nWhen true, returns only locations whose boundaries contain the point specified by lat/long (default: false) \n\nhasBoundary \nboolean \nReturn only locations with boundary polygons \n\nschoolType \narray of strings \nFilter schools by school type (applies when type=school) \n\nschoolLevel \narray of strings \nFilter schools by school level (applies when type=school) \n\nprivateSchoolAffiliation \narray of strings \nFilter schools by private school affiliation (applies when type=school) \n\nschoolDistrictName \narray of strings \nFilter schools by school district name (applies when type=school) \n\nfields \nstring \nComma-separated list of fields to include in response \n\nlocations \nboolean \nInclude locations in the response (default: true). Set to false to speed up responses when only aggregates are needed \n\naggregates \nstring \nReturn aggregated values and counts for specified fields \n\nsortBy \nstring \nSort results by type: typeAsc or typeDesc \n\nGeographical Filtering with Boundaries\nYou can filter locations that fall within a custom boundary using GeoJSON polygon format:\n\nGET /locations?map=[[[long1,lat1],[long2,lat2],[long3,lat3],[long1,lat1]]]\n\nImportant Notes:\n\nCoordinates must be in [longitude, latitude] order (WGS 84 format)\nPolygons must be closed (first and last points identical)\nFor large polygons, use POST method with map data in request body\n\nPagination\nTo paginate through results, use the pageNum and resultsPerPage parameters together. For example, with 50 results per page:\n\nPage 1: pageNum=1&resultsPerPage=50\nPage 2: pageNum=2&resultsPerPage=50\nPage 3: pageNum=3&resultsPerPage=50\n\nUsing Aggregates to Discover Filter Values\n\nThe aggregates parameter returns the distinct values and counts for a given field across the matching location set. This is the recommended way to populate filter UIs (dropdowns, chips, checkboxes) with values that actually exist in your data — instead of hardcoding enum lists that may drift out of sync.\n\nPass a comma-separated list of supported fields:\n\nGET /locations?aggregates=school.districtName,school.schoolType&locations=false\n\nTip: Set locations=false when you only need aggregate data. This skips fetching and serializing the locations array, significantly reducing response time and payload size.\n\nAggregates respect any filters applied to the request, so you can scope the distinct values to a subset of locations. For example, to see the school types available within a specific city:\n\nGET /locations?city=Austin&type=school&aggregates=school.schoolType&locations=false\n\nExample response:\n\n{\n\"source\": [\"MLS\", \"LiveBy\"],\n\"page\": 1,\n\"numPages\": 104,\n\"pageSize\": 100,\n\"count\": 10337,\n\"aggregates\": {\n\"school\": {\n\"districtName\": {\n\"Austin Independent School District\": 129,\n\"Pflugerville Independent School District\": 34,\n\"Leander Independent School District\": 24,\n\"Round Rock Independent School District\": 23,\n\"Manor Independent School District\": 17\n},\n\"schoolType\": {\n\"public\": 386,\n\"private\": 105\n}\n}\n},\n\"locations\": []\n}\n\nEach key in the aggregate object is a distinct value; each value is the count of locations that have it. Nested fields (e.g. school.districtName) are returned as nested objects in the response.\n\nSupported aggregate fields:\n\nCore: type, subType, classification, source\nAddress: address.state, address.area, address.city, address.neighborhood\nSchool identification: school.districtName, school.schoolType, school.schoolLevel, school.lowGrade, school.highGrade, school.privateSchoolAffiliation\nSchool classification flags: school.isCharterSchool, school.isMagnetSchool, school.isVirtualSchool, school.isPrivate, school.isJJFacility, school.isTitleISchool, school.isTitleISchoolwideSchool, school.isAssigned\nSchool programs: school.giftedAndTalented, school.dualEnrollment, school.creditRecovery, school.singleSexClasses, school.apCourse, school.apEnrollment, school.internationalBaccalaureate, school.corporalPunishment, school.interscholarAthletics, school.offersKindergarten, school.offersFullDayKindergarten\nPrivate school details: school.privateHours, school.privateDays, school.privateHasLibrary, school.privateCoed\nOther: school.expenditurePerStudent\n\nRequesting an aggregate on a field not in the list above will return and error.\n\nGET /locations/autocomplete\n\nUse this endpoint for implementing search-as-you-type functionality in dropdown menus and search boxes. The endpoint uses relevance-based matching and handles partial searches and spelling mistakes.\n\nCommon Use Cases\n\n1. Basic Location Search\n\nGET /locations/autocomplete?search=down\n\nReturns relevant matches like \"Downsview-Roding-CFB\", \"Downtown Toronto\", etc.\n\n2. Search Within Specific City\n\nGET /locations/autocomplete?search=park&city=Toronto\n\nReturns only locations containing \"park\" within Toronto.\n\n3. Search for Specific Location Type\n\nGET /locations/autocomplete?search=york&type=area\n\nReturns only areas (counties/regions) matching \"york\".\n\n4. Include Boundaries for Map Display\n\nGET /locations/autocomplete?search=downtown&boundary=true\n\nReturns matching locations with their boundary polygons included (adds 10-20ms latency).\n\nGET /locations/autocomplete Parameters Reference\n\nParameter \nType \nDescription \n\nsearch \nstring \nRequired. User's search input (3-100 characters) \n\nsource \narray of strings \nFilter by data source: MLS, UserDefined, LiveBy \n\ntype \narray of strings \nFilter by location type: area, city, city-alternate, neighborhood, neighborhood-alternate, postalCode, district, schoolDistrict, school \n\narea \narray of strings \nSearch only within specified areas \n\ncity \narray of strings \nSearch only within specified cities \n\nstate \narray of strings \nFilter by 2-letter state/province/territory codes \n\nclassification \narray of strings \nFilter by location classification \n\nsubType \narray of strings \nFilter by location sub-type \n\nminSize \nfloat \nMinimum location size in square kilometers \n\nmaxSize \nfloat \nMaximum location size in square kilometers \n\nlat \nfloat \nLatitude coordinate (requires long; combine with radius) \n\nlong \nfloat \nLongitude coordinate (requires lat; combine with radius) \n\nradius \nfloat \nRadius in kilometers (requires lat and long) \n\nmap \nGeoJSON \nLimit search to locations within specified boundary \n\nboundary \nboolean \nInclude boundary polygons in results (adds 10-20ms latency) \n\nhasBoundary \nboolean \nOnly search locations that have boundary polygons \n\nfields \nstring \nComma-separated list of fields to include in response \n\nresultsPerPage \ninteger \nNumber of results per page (1-10, default: 10) \n\nBest Practices\n\n1. Use Field Selection to Optimize Performance\nOnly request the fields you need to reduce payload size and improve response times:\n\n// Good: Only request needed fields\nGET /locations/autocomplete?search=toronto&fields=name,type,locationId\n\n// Avoid: Requesting all data when you only need basic info\nGET /locations/autocomplete?search=toronto\n\n2. Implement Proper Debouncing\nDebounce autocomplete requests (typically 200-300ms) to reduce unnecessary API calls as users type.\n\n3. Handle Boundary Data Efficiently\nOnly request boundaries when you need them for map visualization:\n\n// When you need to display on map\nGET /locations?city=Toronto&hasBoundary=true&fields=name,map.boundary\n\n// When you only need location names for a list\nGET /locations?city=Toronto&fields=name,type\n\n4. Chain Autocomplete with Full Location Queries\nUse the autocomplete endpoint to get locationIds based on user search, then use the /locations endpoint with the locationId parameter to retrieve full location details including boundaries and complete address information.\n\n5. Use Hierarchical Filtering\nStructure your location selection flow hierarchically for better user experience:\n\nFirst, let users select an area\nThen show cities within the selected area\nFinally, show neighborhoods within the selected city\n\nUse the area, city, and type parameters to implement this hierarchy.\n\nCommon Integration Patterns\n\nPattern 1: Property Search by Location\nUse the autocomplete endpoint to help users find a location, retrieve the locationId from the selected result, then use that locationId to filter listings in your listings search endpoint.\n\nPattern 2: Map-Based Exploration\nRetrieve locations with boundary polygons using the /locations endpoint with hasBoundary=true, then render these boundaries on your map interface. Users can click on boundary polygons to view properties within that location\n\nPattern 3: Radius-Based Search\nWhen users click on a map or enter coordinates, use the lat, long, and radius parameters to find all locations within a specific distance. This is useful for \"search nearby\" functionality.\n\nPattern 4: Geographical Filtering\nUse the map parameter with a custom polygon to find locations within a user-drawn area on a map. This enables \"draw a boundary\" search functionality.\n\nTroubleshooting\n\nNo Results Returned\nCheck that location type filters match available data\nTry broader search terms in autocomplete\nVerify geographical coordinates are in the correct format (longitude, latitude order)\n\nResponse Times\nUse fields parameter to limit returned data\nOnly request boundary data when necessary for map visualization\nImplement proper pagination with reasonable resultsPerPage values\nUse autocomplete endpoint for search operations (it's optimized for speed)\n\nBoundary Polygons Missing\nNot all locations have boundary data available\nUse hasBoundary=true to filter only locations with boundaries\nUse boundary=true in autocomplete when you need boundary data included\n\nQuery Parameter Size Limits\nIf your GeoJSON polygon data exceeds URL query parameter size limits, use the POST method instead of GET and include the map data in the request body.\n\nWhat questions does this article answer?\n\nWhat does the Locations API do and what endpoints are available? \nHow are area, city, and neighborhood defined and related hierarchically? \nHow can I use the Locations API to drive search filters or dropdowns that match MLS® terminology? \nHow do I build a typeahead / autocomplete UI for locations using GET /locations/autocomplete? \nHow does integrating Locations with listing search improve relevance vs. using generic geocoding?\nUpdated on: 17/04/2026\n---",
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
