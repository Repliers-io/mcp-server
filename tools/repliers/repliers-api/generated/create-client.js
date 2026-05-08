// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: POST /clients (operationId: create-a-client)

const executeFunction = async (args) => {
  const baseUrl = 'https://api.repliers.io';
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;

  const url = new URL(`${baseUrl}/clients`);

  const body = {};
  if (args.agentId !== undefined) body.agentId = args.agentId;
  if (args.fname !== undefined) body.fname = args.fname;
  if (args.lname !== undefined) body.lname = args.lname;
  if (args.phone !== undefined) body.phone = args.phone;
  if (args.email !== undefined) body.email = args.email;
  if (args.status !== undefined) body.status = args.status;
  if (args.preferences !== undefined) body.preferences = args.preferences;
  if (args.tags !== undefined) body.tags = args.tags;
  if (args.externalId !== undefined) body.externalId = args.externalId;

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
      name: "create-client",
      description: "Use this endpoint to create a client. When creating saved searches, messages or favorites a client needs to be specified.\n\n---\nStep 2: Create a Client\nArticles on: Messaging & Alerts\n\nImplementation guide for agents and clients\n\nOverview\n\nThis guide covers how to create and manage agents and clients using the Repliers API. This will allow you to have a working agent and client set up, ready to use with saved searches, favorites, and messaging.\n\nIf you haven't read the article on how agents and clients work in Repliers, start with Agents and Clients in Repliers.\n\nStep 1: Create an Agent\n\nEvery client must be assigned to an agent, so you'll need to create at least one agent first. The agent's name and contact details are used as the sender in all client communications.\n\nPOST /agents{\n\"fname\": \"Sarah\",\n\"lname\": \"Chen\",\n\"phone\": \"16471234567\",\n\"email\": \"sarah.chen@example-brokerage.com\",\n\"brokerage\": \"Example Realty Inc.\",\n\"designation\": \"Sales Representative\"\n}\n\nThe fields fname, lname, phone, email, brokerage, and designation are all required. The phone field must be 11 digits and start with the country code (e.g. 16471234567 for a Toronto number).\n\nAfter the agent is created, note the agentId from the response — you'll need it in the next step.\n\nYou can optionally include:\n\navatar — a URL to a profile photo for the agent\nlocation — a latitude and longitude for the agent's service area\nexternalId — an identifier from your CRM or external system for easy cross-referencing\nstatus — defaults to true; set to false to disable the agent\n\nStep 2: Create a Client\n\nOnce you have an agent, you can create clients and assign them to that agent.\n\nPOST /clients{\n\"agentId\": 12345,\n\"fname\": \"James\",\n\"lname\": \"Okafor\",\n\"email\": \"james.okafor@email.com\",\n\"phone\": \"14165550198\",\n\"preferences\": {\n\"email\": true,\n\"sms\": false,\n\"unsubscribe\": false\n},\n\"tags\": [\"buyer\", \"toronto\", \"condo\"]\n}\n\nReplace 12345 with the agentId from Step 1. Note the clientId returned in the response — you'll use it when creating saved searches, favorites, and messages for this client.\n\nThe only required field is agentId. However, to use messaging features you'll also need to provide email (for email delivery) and/or phone (for SMS delivery).\n\nAdditional optional fields include:\n\ntags — one or more strings to categorize the client, useful for filtering (e.g. [\"buyer\", \"toronto\"])\nexternalId — an identifier from your CRM or external system\nstatus — defaults to true; set to false to suspend all activity for the client without deleting their data\n\nNote: An agent and a client can not have the same email address. If you try to create an agent or a client and the email address is in use by another client or agent, the API will return a 409 error. You can use GET /clients?email=... / GET /agents?email=... to check for an existing record first.\n\nStep 3: Retrieve a Client\n\nTo look up a specific client, use their clientId:\n\nGET /clients/{clientId}\n\nTo search across all your clients, use query parameters:\n\nGET /clients?email=james.okafor@email.com\n\nYou can filter by fname, lname, email, phone, agentId, status, tags, and externalId. Two additional parameters control how filters are applied:\n\ncondition — use EXACT (default) for exact matches or CONTAINS for partial string matches\noperator — use OR (default) to match any filter, or AND to require all filters to match\n\nFor example, to find clients whose first name contains \"james\":\n\nGET /clients?fname=james&condition=CONTAINS\n\nResults are paginated. Use pageNum and resultsPerPage (default: 100) to navigate large result sets. If you don't need saved search data in the response, set showSavedSearches=false for faster responses.\n\nStep 4: Update a Client or Agent\n\nUse a PATCH request to update any fields on an existing client or agent. You only need to include the fields you want to change.\n\nTo update a client's tags and reassign them to a different agent:\n\nPATCH /clients/{clientId}{\n\"agentId\": 67890,\n\"tags\": [\"buyer\", \"north-york\"]\n}\n\nTo unsubscribe a client from all communications:\n\nPATCH /clients/{clientId}{\n\"preferences\": {\n\"unsubscribe\": true\n}\n}\n\nTransferring an Agent's Clients\n\nIf you need to move all clients from one agent to another — for example, when offboarding a team member — use the transfer endpoint:\n\nPOST /agents/{agentId}/transfer{\n\"newAgentId\": 67890\n}\n\nReplace {agentId} with the source agent and 67890 with the destination agent. This transfers all clients at once.\n\nNote: You must transfer or individually reassign all of an agent's clients before you can delete that agent.\n\nDeleting an Agent or Client\n\nDELETE /clients/{clientId}\n\nDELETE /agents/{agentId}\n\nIf you want to temporarily disable a client without losing their saved searches and history, set status: false via a PATCH request instead of deleting the record.\n\nUsing Tags\n\nTags let you categorize clients for filtering and segmentation. You can assign multiple tags when creating or updating a client.\n\nTo get a list of all tags currently in use across your clients:\n\nGET /clients/tags\n\nTo rename a tag globally (this updates it on every client that has it):\n\nPATCH /clients/tags/{tag}{\n\"label\": \"north-york-toronto\"\n}\n\nTo filter clients by tag, pass a comma-separated list to GET /clients. This returns clients that have any of the specified tags:\n\nGET /clients?tags=buyer,investor\n\nNext Steps\n\nNow that you have agents and clients set up, you can:\n\nCreate saved searches and assign them to clients\nAdd property favorites for clients\nSend messages between agents and clients using the Messages API\nSet up automated listing alerts and monthly property value updates\n\nWhat questions does this article answer?\n\nHow do I create an agent using the Repliers API?\nWhat fields are required when creating an agent or client?\nHow do I assign a client to an agent?\nHow do I search and filter clients?\nHow do I transfer all clients from one agent to another?\nHow do I delete an agent or client?\nHow do I use tags to organize clients?\nWhat's the correct order of operations for setting up agents and clients?\n\nUpdated on: 06/04/2026\n---",
      parameters: {
        type: 'object',
        properties: {
          "agentId": {
            "type": "integer",
            "description": "The agentId of the agent that this client is assigned to. Each client must be assigned to an agent.",
            "format": "int32"
          },
          "fname": {
            "type": "string",
            "description": "The first name of this client"
          },
          "lname": {
            "type": "string",
            "description": "The last name of this client."
          },
          "phone": {
            "type": "string",
            "description": "The mobile phone number of this client (May be used to deliver text messages). Must be 11 digits in length.<br/><br/>Regex pattern: <code>^(1)([0-9]{10})$</code>"
          },
          "email": {
            "type": "string",
            "description": "The email address of this client (May be used to send emails).<br/><br/>Regex pattern: <code>^(([^<>()\\[\\]\\\\.,;:\\s@\"]+(\\.[^<>()\\[\\]\\\\.,;:\\s@\"]+)*)|(\".+\"))@((\\[[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}])|(([a-zA-Z\\-0-9]+\\.)+[a-zA-Z]{2,}))</code>"
          },
          "status": {
            "type": "boolean",
            "description": "If false, disables all operations for the client.",
            "default": true
          },
          "preferences": {
            "properties": {
              "email": {
                "type": "boolean",
                "description": "If false, the client will not receive messages via email",
                "default": true
              },
              "sms": {
                "type": "boolean",
                "description": "If false, the client will not receive messages via sms (text)",
                "default": true
              },
              "unsubscribe": {
                "type": "boolean",
                "description": "If true, unsubscribes the client from all forms of communication.",
                "default": false
              }
            },
            "required": [],
            "type": "object",
            "description": ""
          },
          "tags": {
            "type": "array",
            "description": "You may categorize this client using tags. Tags are useful for filtering purposes and building lists of specific clients. For example, if this client is a buyer from Toronto, you may want to create tags for \"Buyer\" and \"Toronto\".",
            "items": {
              "type": "string"
            }
          },
          "externalId": {
            "type": "string",
            "description": "The externalId is intended for storing client identifiers from external systems (such as CRMs) for reference purposes."
          }
        },
        required: ["agentId"],
      },
    },
  },
};
