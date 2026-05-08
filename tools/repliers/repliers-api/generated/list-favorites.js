// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: GET /favorites (operationId: get-favorites)

const executeFunction = async (args) => {
  const baseUrl = 'https://api.repliers.io';
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;

  const url = new URL(`${baseUrl}/favorites`);

  if (args.boardId !== undefined) url.searchParams.set('boardId', String(args.boardId));
  if (args.clientId !== undefined) url.searchParams.set('clientId', String(args.clientId));
  if (args.fields !== undefined) url.searchParams.set('fields', String(args.fields));
  if (args.lastStatus !== undefined) args.lastStatus.forEach(v => url.searchParams.append('lastStatus', String(v)));
  if (args.pageNum !== undefined) url.searchParams.set('pageNum', String(args.pageNum));
  if (args.resultsPerPage !== undefined) url.searchParams.set('resultsPerPage', String(args.resultsPerPage));
  if (args.status !== undefined) url.searchParams.set('status', String(args.status));
  if (args.tags !== undefined) url.searchParams.set('tags', String(args.tags));

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
      name: "list-favorites",
      description: "Returns a list of properties that a client has favorited. Results can be filtered by listing status, last status, and tags, making it easy to surface only the most relevant favorites.\n\n---\nListing and Filtering Favorites\nArticles on: Favorites & Saved Listings\n\nFavorite Listings Implementation Guide\n\nOur real estate APIs offer robust features for managing favorite listings, allowing seamless integration and management of client preferences. This article covers the capabilities and usage of our Favorite Listings Management API, including creating, deleting, listing, filtering, and extended webhook support for real-time updates.\n\nCreating a Favorite\n\nTo create a favorite listing, the following parameters must be specified:\n\nmlsNumber: The MLS® number of the listing.\nclientId: The ID of the client who is favoriting the listing.\nboardId: Required for accounts with access to multiple MLS® Systems to ensure the uniqueness of the favorite.\n\nDeleting a Favorite\n\nFavorites can be deleted using the favorite's unique identifier. This operation removes the listing from the client's favorites list.\n\nListing and Filtering Favorites\n\nOur API allows you to list and filter favorites, enabling you to retrieve a specific client's favorites or apply other filters as needed.\n\nAssociation with Clients\n\nFavorites must be associated with a client. To create a favorite, you must first create a client using our Clients API resource. Each client you wish to save favorites for requires a unique clientId.\n\nSteps to Create a Favorite\n\nCreate a Client (If it's a new user): Use the Clients API to create a new client.\nCreate a Favorite: Use the Favorites API to add a listing to the client's favorites list.\n\nExtended Support with Webhooks\n\nWe provide extended support for favorite listings through webhooks, facilitating real-time event-driven integrations. The following webhook events are supported:\n\nfavorite.created: Triggered when a favorite is created.\nfavorite.deleted: Triggered when a favorite is deleted.\n\nThese events can be utilized to trigger workflow automation with other systems. For example, you can notify an agent in their CRM if a client favorites a listing.\n\nAdditionally, the listing.updated webhook payload contains an array of favoriteIds, showing whether the updated listing is relevant to any user's favorites. This is useful if you need to notify users who have favorited the listing about any changes.\n\n****Example Use Cases for Webhooks\n\nNotify Agents: Automatically notify an agent in their CRM when a client favorites a listing.\nUpdate Systems: Trigger updates in other systems when a favorite is added or removed.\n\nAPI Reference\n\nFor detailed API documentation, please refer to our API Reference for Favorites.\nWhat questions does this article answer?\n\nWhat does the Favorite Listings Management API do and when should I use it? \nWhat parameters are required to create a favorite (mlsNumber, clientId, boardId, etc.)? \nHow do I delete a favorite listing for a client? \nHow do I list and filter favorites for a specific client or across clients? \nWhy must each favorite be associated with a client and how do I create that client first? \nWhat webhook events exist for favorites (favorite.created, favorite.deleted), and how can I use them for workflows and notifications? \nHow can I detect which updated listings are part of one or more favorites using favoriteIds? \nUpdated on: 05/12/2025\n---",
      parameters: {
        type: 'object',
        properties: {
          "boardId": {
            "type": "integer",
            "format": "int32",
            "description": "Required if your account has access to multiple MLSes. Filters favorites to a specific board."
          },
          "clientId": {
            "type": "integer",
            "format": "int32",
            "description": "The ID of the client whose favorites to retrieve."
          },
          "fields": {
            "type": "string",
            "description": "Use if you want to limit the response to containing certain fields only. For example: fields?listPrice,soldPrice would limit the response to contain listPrice and soldPrice only. You can also specify the amount of images to return, for example if a listing has 40 images total and you specify fields=images[5] it will only return the first 5 images."
          },
          "lastStatus": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Filters favorites by the last status of the favorited listing."
          },
          "pageNum": {
            "type": "integer",
            "format": "int32",
            "description": "The page number to return. For example, with 100 results per page, specifying pageNum=2 returns results 101–200."
          },
          "resultsPerPage": {
            "type": "integer",
            "format": "int32",
            "description": "The number of favorites to return per page."
          },
          "status": {
            "type": "string",
            "description": "Filters favorites by the current status of the favorited listing."
          },
          "tags": {
            "type": "string",
            "description": "Allows you to search tags within favorites, accepts a comma-separated string, for example \"needs work, turn-key\""
          }
        },
        required: ["clientId"],
      },
    },
  },
};
