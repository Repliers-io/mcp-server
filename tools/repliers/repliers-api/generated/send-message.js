// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: POST /messages (operationId: send-a-message)

const executeFunction = async (args) => {
  const baseUrl = 'https://api.repliers.io';
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;

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
      name: "send-message",
      description: "Send a message from an agent to a client (or vice versa) on the connected account. Key params: sender (agent|client, required), agentId (required), clientId (required), content (required). Operates on the connected account's CRM data.",
      parameters: {
        type: 'object',
        properties: {
          "sender": {
            "type": "string",
            "description": "Indicates whether the agent is sending the message or the client.<br/><br/>Allowed values:<br/><br/><code>agent</code>,<code>client</code>"
          },
          "agentId": {
            "type": "integer",
            "description": "The agentId of the agent that's either receiving or sending the message.",
            "format": "int32"
          },
          "clientId": {
            "type": "integer",
            "description": "The clientId of the client that's either receiving or sending the message.",
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
                "description": "If specified, changes the email subject from the default"
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
            "required": [],
            "type": "object",
            "description": ""
          }
        },
        required: ["sender","agentId","clientId"],
      },
    },
  },
};
