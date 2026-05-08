// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: POST /searches (operationId: create-a-saved-search)

const executeFunction = async (args) => {
  const baseUrl = 'https://api.repliers.io';
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;

  const url = new URL(`${baseUrl}/searches`);

  const body = {};
  if (args.clientId !== undefined) body.clientId = args.clientId;
  if (args.name !== undefined) body.name = args.name;
  if (args.amenities !== undefined) body.amenities = args.amenities;
  if (args.areas !== undefined) body.areas = args.areas;
  if (args.basement !== undefined) body.basement = args.basement;
  if (args.cities !== undefined) body.cities = args.cities;
  if (args.class !== undefined) body.class = args.class;
  if (args.heating !== undefined) body.heating = args.heating;
  if (args.keywords !== undefined) body.keywords = args.keywords;
  if (args.neighborhoods !== undefined) body.neighborhoods = args.neighborhoods;
  if (args.notificationFrequency !== undefined) body.notificationFrequency = args.notificationFrequency;
  if (args.map !== undefined) body.map = args.map;
  if (args.maxBaths !== undefined) body.maxBaths = args.maxBaths;
  if (args.maxBathroomsHalf !== undefined) body.maxBathroomsHalf = args.maxBathroomsHalf;
  if (args.maxBeds !== undefined) body.maxBeds = args.maxBeds;
  if (args.maxCoveredSpaces !== undefined) body.maxCoveredSpaces = args.maxCoveredSpaces;
  if (args.minParkingSpaces !== undefined) body.minParkingSpaces = args.minParkingSpaces;
  if (args.maxPrice !== undefined) body.maxPrice = args.maxPrice;
  if (args.maxStories !== undefined) body.maxStories = args.maxStories;
  if (args.maxSqft !== undefined) body.maxSqft = args.maxSqft;
  if (args.maxYearBuilt !== undefined) body.maxYearBuilt = args.maxYearBuilt;
  if (args.minBaths !== undefined) body.minBaths = args.minBaths;
  if (args.minBathroomsHalf !== undefined) body.minBathroomsHalf = args.minBathroomsHalf;
  if (args.minBeds !== undefined) body.minBeds = args.minBeds;
  if (args.minCoveredSpaces !== undefined) body.minCoveredSpaces = args.minCoveredSpaces;
  if (args.minGarageSpaces !== undefined) body.minGarageSpaces = args.minGarageSpaces;
  if (args.minKitchens !== undefined) body.minKitchens = args.minKitchens;
  if (args.maxMaintenanceFee !== undefined) body.maxMaintenanceFee = args.maxMaintenanceFee;
  if (args.minPrice !== undefined) body.minPrice = args.minPrice;
  if (args.minStories !== undefined) body.minStories = args.minStories;
  if (args.minSqft !== undefined) body.minSqft = args.minSqft;
  if (args.minYearBuilt !== undefined) body.minYearBuilt = args.minYearBuilt;
  if (args.pets !== undefined) body.pets = args.pets;
  if (args.priceChangeNotifications !== undefined) body.priceChangeNotifications = args.priceChangeNotifications;
  if (args.propertyTypes !== undefined) body.propertyTypes = args.propertyTypes;
  if (args.sewer !== undefined) body.sewer = args.sewer;
  if (args.status !== undefined) body.status = args.status;
  if (args.soldNotifications !== undefined) body.soldNotifications = args.soldNotifications;
  if (args.streetNames !== undefined) body.streetNames = args.streetNames;
  if (args.streetNumbers !== undefined) body.streetNumbers = args.streetNumbers;
  if (args.styles !== undefined) body.styles = args.styles;
  if (args.swimmingPool !== undefined) body.swimmingPool = args.swimmingPool;
  if (args.type !== undefined) body.type = args.type;
  if (args.waterSource !== undefined) body.waterSource = args.waterSource;
  if (args.minLotSizeSqft !== undefined) body.minLotSizeSqft = args.minLotSizeSqft;
  if (args.maxLotSizeSqft !== undefined) body.maxLotSizeSqft = args.maxLotSizeSqft;
  if (args.minOpenHouseDate !== undefined) body.minOpenHouseDate = args.minOpenHouseDate;
  if (args.maxOpenHouseDate !== undefined) body.maxOpenHouseDate = args.maxOpenHouseDate;
  if (args.standardStatus !== undefined) body.standardStatus = args.standardStatus;

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
      name: "create-saved-search",
      description: "Use this endpoint to create a saved search for a client.<strong>Important</strong> - When a saved search is updated the filters must be specific enough so that the initial matches do not exceed 100 listings otherwise a 406 (not accepted) response will be received.\n\n---\nKey Features\nArticles on: Saved Searches\n\nSaved Search Implementation Guide\n\nRepliers' Saved Search feature is a powerful tool that enhances user engagement and retention by allowing clients to receive timely notifications on property listings that match their specific criteria. Clients receive notifications via email and/or text message when properties that match their search criteria are listed, sold, or experience price changes. These timely alerts keep clients in the loop and contribute to user retention, ensuring they are always informed about relevant listings.\n\nThis guide will walk you through the various functionalities of the Saved Search feature, from creation to customization. \n\nKey Features\n\nCreate a Saved Search: Set up saved searches tailored to client preferences.\nFilter Saved Searches: Narrow down saved searches based on specific criteria.\nUpdate a Saved Search: Modify existing saved searches to reflect new preferences.\nDelete a Saved Search: Remove saved searches that are no longer needed.\nGet Details of a Specific Saved Search: Retrieve comprehensive information about a particular saved search.\n\nSetting Up Alerts\n\nSaved Searches can be configured to send alerts to clients for the following scenarios:\n\nNew Listings: Notify clients when new properties match their search criteria.\nPrice Changes: Alert clients about any changes in the prices of listings they are interested in.\nSold Listings: Inform clients when a property they were tracking is sold.\n\nAlerts can be sent based on the client's preferred frequency:\n\nInstantly\nDaily\nWeekly\nMonthly\n\nAlerts can be delivered via:\n\nEmail\nText Message\nMatches and Notifications\n\n2-Way Communication\n\nSaved search email and text alerts are 2-way, meaning the client can reply directly to the message and their reply will be sent to the agent. Regardless of if they reply to a text or an email, the agent will receive an email. The agent can also reply to the email and their reply will be sent to the client via email and/or text depending on their communication preferences.\n\nLink Types in Saved Search Emails\n\nSaved search emails contain five types of links that direct clients to different pages within your application. By default, when clicked, these links redirect to your API key's configured domain name followed by a slug and querystring parameters containing context needed to customize the user's experience.\n\nThe Five Link Types\n\n1. View Saved Search\nDirects clients to view all listings matching their saved search criteria.\n\nDefault URL structure: {domain}/listings?searchId=${s.searchId}&token=${token}&email=${clientEmail}\n\n2. Adjust Saved Search\nAllows clients to modify their saved search preferences.\n\nDefault URL structure: {domain}/search?searchId=${s.searchId}&token=${token}&email=${clientEmail}\n\n3. View Listing\nTakes clients directly to a specific property listing.\n\nDefault URL structure: {domain}/listings/property?mlsNumber=${listings[0]}&email=${message.clientEmail}&boardId=${listings[0].boardId}&searchId=${savedSearch.searchId}&matchId=${savedSearch.search.matchId}\n\n4. View Profile\nRedirects clients to their profile page.\n\nDefault URL structure: {domain}/profile?token=${message.token}&utm_medium=email&email=${message.clientEmail}\n\n5. Unsubscribe\nAllows clients to unsubscribe from saved search alerts.\n\nDefault URL structure: {domain}/unsubscribe?email=${to.address}&token=${message.token}&utm_medium=email\n\nURL Structure Components\n\nEach URL consists of:\n\nYour custom domain (configured via your API key)\nA slug/path (customizable per link type)\nQuerystring parameters (standardized, not configurable)\n\nThe querystring parameters provide essential context including:\n\nsearchId - Identifier for the specific saved search\ntoken - Security token for authentication purposes (More info)\nemail - Client's email address (can be used for email tracking, more info)\nmlsNumber - MLS® listing identifier\nutm_medium - Tracking parameter for analytics\nboardId - Identifier for the dataset for the specific listing (useful for accounts that have access to multiple datasets)\nmatchId - Identifier for the specific listing match that was created for the saved search\n\nCustomizing Link Slugs\n\nWhile the querystring parameters remain standardized across all implementations, you can customize the slug/path portion of each link type to match your application's routing structure. To change the slugs for these links, please reach out to our support team and let them know what you'd like the slugs to be.\n\nMatches and Notifications\n\nWhen a listing meets the client's criteria, a match is created. Through our APIs, you can:\n\nFilter Matches: Find matches for specific clients or criteria.\nUpdate Matches: Mark matches as viewed or liked by clients.\nGet Match Details: Retrieve detailed information about specific matches.\n\nAssociation with Agents and Clients\n\nA Saved Search must be associated with an agent and a client:\n\nAgent: The sender of the alerts.\nClient: The receiver of the alerts.\n\nTo create Saved Searches, you must first create agents and clients using our agents and clients API resources.\n\nSaved Search Limit Per Client\n\nBy default, each client can have up to 5 saved searches. If you need this limit increased for your implementation, please reach out to our support team for assistance.\n\nCustomizing Email Templates\n\nThe email templates used for Saved Searches can be fully customized to match your branding and preferences. If no customization is provided, the default Repliers theming will be used.\n\nFor detailed information about email template configuration, including how to download the default templates and customize them for your needs, please refer to our Email Templates Configuration guide.\n\nExtended Support with Webhooks\n\nWe have extended support for Saved Searches through webhooks, enabling real-time event-driven integrations. The following events are supported:\n\nsearch.created\nsearch.updated\nsearch.deleted\nsearch.match.created\nsearch.match.updated\n\nThese events can be used to trigger workflow automation with other systems. For example, you can push a notification to a mobile app when a new match is created.\n\nInput Validation for Saved Searches\n\nWhen creating or updating saved searches, it's important to ensure that the filter values you provide are valid for the MLS® Systems you have access to. Invalid input values will result in a 400 Bad Request error response.\n\nCommon Validation Errors\n\nThe most common validation error occurs when providing location-based filters (such as city names) that don't exist in one or more of the MLS® Systems you have access to. For example:\n\nProviding a city name that exists in one MLS®, but not another\nUsing outdated or incorrect spelling for location names\nSpecifying property types that aren't recognized by certain MLS® Systems\n\nDetermining Valid Filter Values Using Aggregates\n\nTo avoid validation errors and determine which values are acceptable for your filters, use the aggregates parameter in the Repliers API. This feature allows you to discover all distinct values available for specific filter parameters across your accessible MLS® Systems.\n\nFor detailed information on using the aggregates parameter, refer to our Using Aggregates to Determine Distinct Values for Filters guide.\n\nBenefits of Saved Searches\n\nPersonalization: Tailored searches improve user satisfaction by providing relevant property updates.\nUser Retention: Regular alerts keep clients engaged and returning to your platform.\n\nAPI Reference\n\nFor detailed API documentation and examples, please refer to our API Reference for Saved Searches.\n\nThe Saved Search feature in Repliers Real Estate API is an invaluable tool, ensuring clients stay informed and engaged with the latest property listings. Utilize this feature to enhance your service offerings and improve client satisfaction.\n\nWhat questions does this article answer?\n\nHow do I create, update, filter, and delete saved searches using the API? \nHow do saved searches send alerts for new listings, price changes, and sold listings? \nWhat alert frequencies are supported (instant, daily, weekly, monthly)? \nHow are saved searches tied to agents and clients, and what entities must I create first? \nHow many saved searches can each client have by default, and how do I request higher limits? \nHow do I validate filter values and use aggregates to discover allowed filter options? \nUpdated on: 05/12/2025\n---",
      parameters: {
        type: 'object',
        properties: {
          "clientId": {
            "type": "integer",
            "description": "The clientId of the client that the search is for. This client will receive notifications from the agent that's assigned to them when listings that match the saved search criteria are listed.",
            "format": "int32"
          },
          "name": {
            "type": "string",
            "description": "You can specify a name for the saved search. This is useful in cases where users have multiple saved searches, to help them distinguish between saved searches."
          },
          "amenities": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": ""
          },
          "areas": {
            "type": "array",
            "description": "An array of areas to be used as a filter for this search. Required if a value for map is not provided.",
            "items": {
              "type": "string"
            }
          },
          "basement": {
            "type": "array",
            "description": "If specified, matches only listings whose basement description match all of the supplied values. For a list of supported values, make a GET /listings?listings=false&aggregates=details.basement1,details.basement2 request.",
            "items": {
              "type": "string"
            }
          },
          "cities": {
            "type": "array",
            "description": "An array of cities to be used as a filter for this search. Required if a value for map is not provided.",
            "items": {
              "type": "string"
            }
          },
          "class": {
            "type": "array",
            "description": "Indicates what class of property to search for.<br/><br/>Allowed values:<br/><br/><code>residential</code>,<code>condo</code>,<code>commercial</code>",
            "items": {
              "type": "string"
            }
          },
          "heating": {
            "type": "array",
            "description": "An array of heating values to be used as a filter for this search.",
            "items": {
              "type": "string"
            }
          },
          "keywords": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": ""
          },
          "neighborhoods": {
            "type": "array",
            "description": "An array of neighborhoods to be used as a filter for this search. Required if a value for map is not provided.",
            "items": {
              "type": "string"
            }
          },
          "notificationFrequency": {
            "type": "string",
            "description": "Sets the frequency that clients will be notified of listings that match their search criteria.<br/><br/>Allowed values:<br/><br/><code>instant</code>, <code>daily</code>, <code>weekly</code>, <code>monthly</code>",
            "default": "instant"
          },
          "map": {
            "type": "string",
            "description": "An array of polygons arrays with arrays of longitude/latitude shapes to be used as a filter for this search. If used, only listings that area geographically located within these shapes will be matched. Required if values for areas, cities and neighborhoods are not provided.",
            "format": "json"
          },
          "maxBaths": {
            "type": "integer",
            "description": "The maximum amount of bathrooms to be used as a filter for this search.",
            "format": "int32"
          },
          "maxBathroomsHalf": {
            "type": "integer",
            "description": "The maximum amount of half bathrooms to be used as a filter for this search.",
            "format": "int32"
          },
          "maxBeds": {
            "type": "integer",
            "description": "The maximum amount of bedrooms to be used as a filter for this search.",
            "format": "int32"
          },
          "maxCoveredSpaces": {
            "type": "integer",
            "description": "The maximum amount of covered spaces to be used as a filter for this search.",
            "format": "int32"
          },
          "minParkingSpaces": {
            "type": "integer",
            "description": "If specified, matches only listings whose parking space count is >= the supplied value.",
            "format": "int32"
          },
          "maxPrice": {
            "type": "integer",
            "description": "The maximum list price to be used as a filter for this search.",
            "format": "int32"
          },
          "maxStories": {
            "type": "integer",
            "format": "int32",
            "description": ""
          },
          "maxSqft": {
            "type": "integer",
            "format": "int32",
            "description": ""
          },
          "maxYearBuilt": {
            "type": "integer",
            "format": "int32",
            "description": ""
          },
          "minBaths": {
            "type": "integer",
            "description": "The minimum amount of bathrooms to be used as a filter for this search.",
            "format": "int32"
          },
          "minBathroomsHalf": {
            "type": "integer",
            "description": "The minimum amount of half bathrooms to be used as a filter for this search.",
            "format": "int32"
          },
          "minBeds": {
            "type": "integer",
            "description": "The minimum amount of bedrooms to be used as a filter for this search.",
            "format": "int32"
          },
          "minCoveredSpaces": {
            "type": "integer",
            "description": "The minimum amount of covered spaces to be used as a filter for this search.",
            "format": "int32"
          },
          "minGarageSpaces": {
            "type": "integer",
            "description": "If specified, matches only listings whose garage space count is >= the supplied value.",
            "format": "int32"
          },
          "minKitchens": {
            "type": "integer",
            "description": "If specified, matches only listings whose kitchen count is >= the supplied value.",
            "format": "int32"
          },
          "maxMaintenanceFee": {
            "type": "integer",
            "description": "If supplied limits matches to listings where the maintenance fee is <= the supplied value.",
            "format": "int32"
          },
          "minPrice": {
            "type": "integer",
            "description": "The minimum list price to be used as a filter for this search.",
            "format": "int32"
          },
          "minStories": {
            "type": "integer",
            "format": "int32",
            "description": ""
          },
          "minSqft": {
            "type": "integer",
            "format": "int32",
            "description": ""
          },
          "minYearBuilt": {
            "type": "integer",
            "format": "int32",
            "description": ""
          },
          "pets": {
            "type": "string",
            "description": ""
          },
          "priceChangeNotifications": {
            "type": "boolean",
            "description": "If set to true, clients will receive price change notifications for listings that have been matched for them.",
            "default": false
          },
          "propertyTypes": {
            "type": "array",
            "description": "An array of property types to be used as a filter for this search.",
            "items": {
              "type": "string"
            }
          },
          "sewer": {
            "type": "array",
            "description": "An array of sewer values to be used as a filter for this search.",
            "items": {
              "type": "string"
            }
          },
          "status": {
            "type": "boolean",
            "description": "If set to false, disables this search.",
            "default": true
          },
          "soldNotifications": {
            "type": "boolean",
            "description": "If set to true, clients will receive sold notifications for listings that have been matched for them.",
            "default": false
          },
          "streetNames": {
            "type": "array",
            "description": "An array of street names to be used as a filter for this search.",
            "items": {
              "type": "string"
            }
          },
          "streetNumbers": {
            "type": "array",
            "description": "An array of street numbers to be used as a filter for this search.",
            "items": {
              "type": "string"
            }
          },
          "styles": {
            "type": "array",
            "description": "An array of property styles to be used as a filter for this search.",
            "items": {
              "type": "string"
            }
          },
          "swimmingPool": {
            "type": "array",
            "description": "An array of swimming pool values to be used as a filter for this search.",
            "items": {
              "type": "string"
            }
          },
          "type": {
            "type": "string",
            "description": "Indicates whether the search is for a property that's for sale or for lease.<br/></br>Allowed values:<br/><br/><code>sale</code>,<code>lease</code>"
          },
          "waterSource": {
            "type": "array",
            "description": "An array of water source values to be used as a filter for this search.",
            "items": {
              "type": "string"
            }
          },
          "minLotSizeSqft": {
            "type": "integer",
            "format": "int32",
            "description": "The minimum lot size in square feet to be used as a filter for this search."
          },
          "maxLotSizeSqft": {
            "type": "integer",
            "format": "int32",
            "description": "The maximum lot size in square feet to be used as a filter for this search."
          },
          "minOpenHouseDate": {
            "description": "Indicates whether the search is for properties that have an Open House on or after the supplied date. Date format: <code>YYYY-MM-DD</code>",
            "type": "string",
            "format": "date"
          },
          "maxOpenHouseDate": {
            "description": "Indicates whether the search is for properties that have an Open House on or before the supplied date. Date format: <code>YYYY-MM-DD</code>. It's not recommended to use it unless you have a very good reason to set it.",
            "type": "string",
            "format": "date"
          },
          "standardStatus": {
            "type": "array",
            "description": "Indicates what Standard Status of property to search for. <br/><br/>Allowed values:<br/><br/><code>Active</code>, <code>Active Under Contract</code>, <code>Closed</code>, <code>Expired</code>, <code>Pending</code>, <code>Canceled</code>, <code>Incomplete</code>",
            "items": {
              "type": "string"
            },
            "enum": [
              "Active",
              "Active Under Contract",
              "Closed",
              "Expired",
              "Pending",
              "Canceled",
              "Incomplete"
            ]
          }
        },
        required: ["clientId","class","maxPrice","minPrice","type"],
      },
    },
  },
};
