// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: POST /estimates (operationId: create-an-estimate)

import { apiBaseUrl } from '../../../../lib/apiBase.js';
import { apiHeaders, readFailure, errorMessage } from '../../../../lib/apiRequest.js';

const executeFunction = async (args) => {
  const baseUrl = apiBaseUrl();

  const url = new URL(`${baseUrl}/estimates`);

  const body = {};
  if (args.overallQuality !== undefined) body.overallQuality = args.overallQuality;
  if (args.address !== undefined) body.address = args.address;
  if (args.condominium !== undefined) body.condominium = args.condominium;
  if (args.details !== undefined) body.details = args.details;
  if (args.lot !== undefined) body.lot = args.lot;
  if (args.sendEmailNow !== undefined) body.sendEmailNow = args.sendEmailNow;
  if (args.sendEmailMonthly !== undefined) body.sendEmailMonthly = args.sendEmailMonthly;
  if (args.taxes !== undefined) body.taxes = args.taxes;
  if (args.clientId !== undefined) body.clientId = args.clientId;
  if (args.boardId !== undefined) body.boardId = args.boardId;
  if (args.resource !== undefined) body.resource = args.resource;
  if (args.listDate !== undefined) body.listDate = args.listDate;

  const finalUrl = url.toString();

  try {
    const response = await fetch(finalUrl, {
      method: 'POST',
      headers: apiHeaders(args, { json: true }),
      body: JSON.stringify(body),
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
      name: "create-estimate",
      description: "Create a property value estimate for a client by submitting property attributes. More attributes = more accurate result. Key params: clientId, address (required), details (required: beds, baths, sqft, etc.), overallQuality, lot, condominium, taxes, sendEmailNow, sendEmailMonthly. Operates on the connected account's CRM data.",
      parameters: {
        type: 'object',
        properties: {
          "overallQuality": {
            "type": "string",
            "description": "An indication of the overall renovation quality of the property. You may use a numeric value between 1.0 and 6.0 or one of these strings: poor, below average, average, above average, excellent. If not specified, defaults to average."
          },
          "address": {
            "properties": {
              "city": {
                "type": "string"
              },
              "streetName": {
                "type": "string"
              },
              "streetNumber": {
                "type": "string"
              },
              "streetSuffix": {
                "type": "string"
              },
              "unitNumber": {
                "type": "string"
              },
              "zip": {
                "type": "string"
              }
            },
            "required": [
              "city",
              "streetName",
              "streetNumber",
              "zip"
            ],
            "type": "object",
            "description": ""
          },
          "condominium": {
            "properties": {
              "fees": {
                "properties": {
                  "maintenance": {
                    "type": "integer",
                    "format": "int32"
                  }
                },
                "required": [],
                "type": "object"
              }
            },
            "required": [],
            "type": "object",
            "description": ""
          },
          "details": {
            "properties": {
              "basement1": {
                "type": "string"
              },
              "basement2": {
                "type": "string"
              },
              "numBathrooms": {
                "type": "integer",
                "format": "int32"
              },
              "numBedrooms": {
                "type": "integer",
                "format": "int32"
              },
              "numGarageSpaces": {
                "type": "integer",
                "format": "int32"
              },
              "numParkingSpaces": {
                "type": "integer",
                "format": "int32"
              },
              "propertyType": {
                "type": "string",
                "description": "Must be a property type value that exists in your MLS data. For a list of supported values, make a GET /listings?listings=false&aggregates=details.propertyType request."
              },
              "sqft": {
                "type": "integer",
                "format": "int32",
                "description": "The square footage of the property. Must be numeric."
              },
              "style": {
                "type": "string",
                "description": "Must be a style value that exists in your MLS data. For a list of supported values, make a GET /listings?listings=false&aggregates=details.style request."
              },
              "yearBuilt": {
                "type": "integer",
                "format": "int32",
                "description": "Must be a valid year, or a year-built value that exists in your MLS data."
              },
              "numFireplaces": {
                "type": "integer",
                "nullable": true,
                "minimum": 0,
                "description": "The number of fireplaces. The strings \"y\" and \"n\" are also accepted and mapped to 1 and 0."
              },
              "extras": {
                "type": "array",
                "description": "Additional property features. Accepts an array of strings or a single string.",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "numBathrooms",
              "numBedrooms",
              "propertyType",
              "sqft",
              "style"
            ],
            "type": "object",
            "description": ""
          },
          "lot": {
            "properties": {
              "acres": {
                "type": "string"
              },
              "depth": {
                "type": "integer",
                "format": "int32"
              },
              "width": {
                "type": "integer",
                "format": "int32"
              }
            },
            "required": [],
            "type": "object",
            "description": ""
          },
          "sendEmailNow": {
            "type": "boolean",
            "description": "If set to true and there's a clientId specified, the client will receive a message immediately with a link that will allow them to access their estimate. Note - your account must have the Repliers messaging addon to use this feature.",
            "default": false
          },
          "sendEmailMonthly": {
            "type": "boolean",
            "description": "If set to true and there's a clientId specified, the client will receive a message on a monthly basis with a link to a current estimate.  Note - your account must have the Repliers messaging addon to use this feature.",
            "default": false
          },
          "taxes": {
            "properties": {
              "annualAmount": {
                "type": "integer",
                "format": "int32"
              }
            },
            "required": [],
            "type": "object",
            "description": ""
          },
          "clientId": {
            "type": "integer",
            "description": "Set this to the clientId that the estimate is for if you wish to store the estimate. If sendEmailNow or sendEmailMonthly is used, messages containing estimates will be sent to this clientId. <strong>Required when sendEmailNow or sendEmailMonthly is true.</strong>",
            "format": "int32"
          },
          "boardId": {
            "type": "integer",
            "description": "Required when using an API key that has access to multiple boards, unless <code>resource</code> is supplied. A boardId that your API key does not have access to is rejected with a 400 error.",
            "format": "int32"
          },
          "resource": {
            "type": "string",
            "description": "The MLS resource identifier of the board, as an alternative to <code>boardId</code>. Must be a resource that your API key has access to."
          },
          "listDate": {
            "type": "string",
            "format": "date-time",
            "description": "The date the property was listed, if known. Format: <code>YYYY-MM-DDTHH:mm:ss.sssZ</code>",
            "example": "2024-06-15T00:00:00.000Z"
          }
        },
        required: ["address","details"],
      },
    },
  },
};
