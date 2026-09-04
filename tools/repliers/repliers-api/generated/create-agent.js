// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: POST /agents (operationId: create-an-agent)

import { apiBaseUrl } from '../../../../lib/apiBase.js';

const executeFunction = async (args) => {
  const baseUrl = apiBaseUrl();
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;

  const url = new URL(`${baseUrl}/agents`);

  const body = {};
  if (args.fname !== undefined) body.fname = args.fname;
  if (args.lname !== undefined) body.lname = args.lname;
  if (args.phone !== undefined) body.phone = args.phone;
  if (args.email !== undefined) body.email = args.email;
  if (args.brokerage !== undefined) body.brokerage = args.brokerage;
  if (args.designation !== undefined) body.designation = args.designation;
  if (args.avatar !== undefined) body.avatar = args.avatar;
  if (args.status !== undefined) body.status = args.status;
  if (args.location !== undefined) body.location = args.location;
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
      name: "create-agent",
      description: "Create a new CRM agent record on the connected account. Use when onboarding a new agent to the system. Key params: fname, lname, email, phone, brokerage, designation, status, location, externalId. Operates on the connected account's CRM data.",
      parameters: {
        type: 'object',
        properties: {
          "fname": {
            "type": "string",
            "description": "The first name of the agent."
          },
          "lname": {
            "type": "string",
            "description": "The last name of the agent."
          },
          "phone": {
            "type": "string",
            "description": "The mobile phone number of the agent. Must be 11 digits in length.<br/><br/>Regex pattern: <code>^(1)([0-9]{10})$</code>"
          },
          "email": {
            "type": "string",
            "description": "The email address of the agent.<br/><br/>Regex pattern: <code>^(([^<>()\\[\\]\\\\.,;:\\s@\"]+(\\.[^<>()\\[\\]\\\\.,;:\\s@\"]+)*)|(\".+\"))@((\\[[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}])|(([a-zA-Z\\-0-9]+\\.)+[a-zA-Z]{2,}))</code>"
          },
          "brokerage": {
            "type": "string",
            "description": "The name of the Brokerage/Office that this agent is registered with."
          },
          "designation": {
            "type": "string",
            "description": "This agent's designation. For example, \"Sales Representative\""
          },
          "avatar": {
            "type": "string",
            "description": "A URL/Path to an avatar/picture of this agent."
          },
          "status": {
            "type": "boolean",
            "description": "If false, disables all operations for the agent.",
            "default": true
          },
          "location": {
            "properties": {
              "latitude": {
                "type": "string",
                "description": "A latitude value representing the location of the agent. Required if a value for longitude is provided."
              },
              "longitude": {
                "type": "string",
                "description": "A longitude value representing the location of the agent. Required if a value for latitude is specified."
              }
            },
            "required": [],
            "type": "object",
            "description": ""
          },
          "externalId": {
            "type": "string",
            "description": "The externalId is intended for storing agent identifiers from external systems (such as CRMs) for reference purposes."
          }
        },
        required: ["fname","lname","phone","email","brokerage","designation"],
      },
    },
  },
};
