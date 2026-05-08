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
      description: "Use this endpoint to send a message.\n\nA message is either sent from an agent to a client, or from a client to an agent.\n\nMessages can be used to facilitate communication between agents and their clients for marketing automation or general communication.\n\nText messaging and email is supported.\n\n---\nSend a Message\nArticles on: Messaging & Alerts\n\nHow To Send Your First Message Using Repliers\n\nThis guide will walk you through the process of sending your first message with Repliers, from account setup to message delivery.\n\nPrerequisites\n\nBefore sending messages, ensure that:\n\nYour account is configured for messaging\nYou've subscribed to a plan that includes messaging functionality\n\nFor detailed instructions on setting up messaging, refer to our Integrated Email Messaging Setup Guide.\n\nStep 1: Create an Agent\n\nMessages in Repliers are exchanged between agents and clients. You'll need to create at least one agent before you can send messages.\n\nHere's a sample API request to create an agent:\n\ncurl --request POST \\\n--url https://api.repliers.io/agents \\\n--header 'accept: application/json' \\\n--header 'REPLIERS-API-KEY: your-repliers-api-key' \\\n--header 'content-type: application/json' \\\n--data '\n{\n\"status\": true,\n\"fname\": \"John\",\n\"lname\": \"Smith\",\n\"phone\": \"12221113333\",\n\"email\": \"johnsmith@realestategroup.com\",\n\"brokerage\": \"ABC Brokerage\",\n\"designation\": \"Sale Representative\"\n}\n'\n\nAfter creating the agent, note the agentId in the response as you'll need it for subsequent steps.\n\nStep 2: Create a Client\n\nNext, create a client and assign them to the agent you created:\n\ncurl --request POST \\\n--url https://api.repliers.io/clients \\\n--header 'accept: application/json' \\\n--header 'REPLIERS-API-KEY: your-repliers-api-key' \\\n--header 'content-type: application/json' \\\n--data '\n{\n\"status\": true,\n\"preferences\": {\n\"email\": true,\n\"sms\": true,\n\"unsubscribe\": false\n},\n\"agentId\": 12345, # Replace with your actual agentId\n\"fname\": \"James\",\n\"lname\": \"Davidson\",\n\"phone\": \"13332224444\",\n\"email\": \"jamesd@email.com\"\n}\n'\n\nMake sure to replace 12345 with the actual agentId from the previous step. Note the clientId from the response.\n\nFor more information about the relationship between agents and clients, see our Agents and Clients in Repliers article.\n\nStep 3: Send a Message\n\nNow you're ready to send your first message! Messages can be sent from either an agent to a client or from a client to an agent. The sender field determines who is sending the message.\n\nTo send a message from an agent to a client:\n\ncurl --request POST \\\n--url https://api.repliers.io/messages \\\n--header 'accept: application/json' \\\n--header 'REPLIERS-API-KEY: your-repliers-api-key' \\\n--header 'content-type: application/json' \\\n--data '\n{\n\"content\": {\n\"message\": \"This is a test message\"\n},\n\"sender\": \"agent\",\n\"agentId\": 12345, # Replace with your actual agentId\n\"clientId\": 54321 # Replace with your actual clientId\n}\n'\n\nMake sure to replace the agentId and clientId with the actual IDs obtained from the previous steps.\n\nVerifying Message Delivery\n\nAfter sending the message, it should appear in the client's inbox. If the message doesn't appear:\n\nCheck the spam folder in the client's email\nVerify that your account is properly configured for messaging\nContact Repliers support if you continue to experience issues\n\nNext Steps\n\nNow that you've sent your first message, you can:\n\nSet up automated messaging workflows\nCreate message templates\nConfigure notification preferences\nExplore advanced messaging features\n\nWhat questions does this article answer?\n\nWhat prerequisites are required before I can send messages (plan, configuration)? \nHow do I create an agent and a client to use with messaging? \nWhat API calls do I use to send a first test message? \nHow do I confirm that messages were delivered successfully? \nUpdated on: 05/12/2025\n---",
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
