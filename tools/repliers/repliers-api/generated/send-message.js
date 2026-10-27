// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: POST /messages (operationId: send-a-message)

import { apiBaseUrl } from '../../../../lib/apiBase.js';
import { apiHeaders, readFailure, errorMessage } from '../../../../lib/apiRequest.js';

const executeFunction = async (args) => {
  const baseUrl = apiBaseUrl();

  const url = new URL(`${baseUrl}/messages`);

  const body = {};
  if (args.sender !== undefined) body.sender = args.sender;
  if (args.agentId !== undefined) body.agentId = args.agentId;
  if (args.clientId !== undefined) body.clientId = args.clientId;
  if (args.content !== undefined) body.content = args.content;

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
      name: "send-message",
      description: "Send a message from an agent to a client (or vice versa) on the connected account. Key params: sender (agent|client, required), agentId (required), clientId (required), content (required; object with message/subject/listings sub-fields). Operates on the connected account's CRM data.",
      parameters: {
        type: 'object',
        properties: {
          "sender": {
            "type": "string",
            "description": "Indicates whether the agent is sending the message or the client.<br/><br/>Allowed values:<br/><br/><code>agent</code>,<code>client</code>",
            "enum": [
              "agent",
              "client"
            ]
          },
          "agentId": {
            "type": "integer",
            "description": "The agentId of the agent that's either receiving or sending the message.",
            "format": "int32"
          },
          "clientId": {
            "type": "integer",
            "description": "The clientId of the client that's either receiving or sending the message. The client must be assigned to the agent specified by <code>agentId</code>, otherwise a 400 error is returned.",
            "format": "int32"
          },
          "content": {
            "properties": {
              "listings": {
                "type": "array",
                "description": "An array of listings (mlsNumbers) to send in this message.",
                "items": {
                  "type": "string"
                }
              },
              "searches": {
                "type": "array",
                "description": "An array of saved searches (searchIds) to send in this message. Active listings that match filters for each search specified will be sent in this message.",
                "items": {
                  "type": "integer",
                  "format": "int32"
                }
              },
              "message": {
                "type": "string",
                "description": "Content to be sent with this message. For example, \"hi, how are you today?\""
              },
              "subject": {
                "type": "string",
                "maxLength": 100,
                "description": "If specified, changes the email subject from the default. Maximum 100 characters."
              },
              "links": {
                "type": "array",
                "description": "An array of links (URLs) to be sent in this message.",
                "items": {
                  "type": "string"
                }
              },
              "pictures": {
                "type": "array",
                "description": "An array of pictures (URLs) to be sent in this message.",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "message"
            ],
            "type": "object",
            "description": ""
          }
        },
        required: ["sender","agentId","clientId","content"],
      },
    },
  },
};
