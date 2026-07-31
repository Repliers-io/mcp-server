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
      description: "Create a new CRM client record on the connected account. Key params: agentId, fname, lname, email, phone, status, tags, preferences, externalId. Operates on the connected account's CRM data.",
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
