// AUTO-GENERATED — run `npm run generate` to regenerate
// Source: GET /members (operationId: members)

const executeFunction = async (args) => {
  const baseUrl = 'https://api.repliers.io';
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;

  const url = new URL(`${baseUrl}/members`);

  if (args.agentId !== undefined) url.searchParams.set('agentId', String(args.agentId));
  if (args.agentName !== undefined) url.searchParams.set('agentName', String(args.agentName));
  if (args.boardId !== undefined) url.searchParams.set('boardId', String(args.boardId));
  if (args.brokerage !== undefined) url.searchParams.set('brokerage', String(args.brokerage));
  if (args.keywords !== undefined) url.searchParams.set('keywords', String(args.keywords));
  if (args.officeId !== undefined) url.searchParams.set('officeId', String(args.officeId));
  if (args.pageNum !== undefined) url.searchParams.set('pageNum', String(args.pageNum));
  if (args.position !== undefined) url.searchParams.set('position', String(args.position));
  if (args.resultsPerPage !== undefined) url.searchParams.set('resultsPerPage', String(args.resultsPerPage));

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
      name: "search-members",
      description: "Use this endpoint to list and filter members (agents) belonging to the MLS.\n\n---\nUnderstanding the Members Endpoint\nUnderstanding the Members Endpoint\n\nOverview\n\nThe Members endpoint retrieves agent and broker information directly from Multiple Listing Service (MLS) data feeds. This endpoint provides access to the official roster of real estate professionals as maintained by MLS boards, including their contact details, brokerage affiliations, and professional designations.\n\nKey Differentiation: Members vs. Agents\n\nImportant: The Members endpoint is fundamentally different from the Agents resource in Repliers.\n\nMembers endpoint (/members): Returns MLS member records as they exist in the MLS data feed. These are official registrations maintained by MLS boards and include licensed real estate professionals in that market.\n\nAgents resource (covered in this article): Refers to internally created entities within your Repliers account that you manage through the dashboard or API. These are your own custom agent records that you create and maintain for your application's needs.\n\nA way to understand this distinction is that Members are the official MLS directory entries, while Agents are your custom records within Repliers.\n\nEndpoint Details\n\nEndpoint: GET /members\n\nParameters:\npageNum - Page number to retrieve (use this to iterate through the result set)\n\nPurpose: Retrieve paginated lists of MLS member records with their complete professional information.\n\nResponse Structure\n\nThe Members endpoint returns a paginated response with the following top-level structure:\n\npage - Current page number in the result set\nnumPages - Total number of pages available\npageSize - Number of members returned per page (typically 100)\ncount - Total number of member records available\nmembers - Array of member objects\n\nMember Object Fields\n\nEach member record includes comprehensive professional information:\n\nCore Identifiers\nresource - The MLS resource this member belongs to (e.g., \"Property:2505\")\nagentId - Member's unique identifier in the MLS system\nboardAgentId - Board-specific agent identifier\nofficeId - Identifier for the member's affiliated office\n\nBasic Information\nname - Full name of the real estate professional\nposition - Professional title or designation (e.g., \"REALTOR Salesperson\", \"Broker\")\nboard - MLS board affiliation (when available)\nupdatedOn - Timestamp of the last update to this record\n\nContact Information\nemail - Professional email address\nphones - Array of phone numbers (may include multiple numbers)\nwebsite - Professional or team website URL\nsocial - Array of social media profile links\n\nPhoto Information\nThe photo object contains:\nsmall - URL to small profile photo\nlarge - URL to larger profile photo\nupdatedOn - Timestamp of when the photo was last updated\n\nBrokerage Information\nThe brokerage object includes:\nname - Name of the brokerage firm\naddress - Complete address object with:\naddress1 - Primary street address\naddress2 - Secondary address line (suite, unit, etc.)\ncity - City name\nstate - State or province abbreviation\npostal - ZIP or postal code\ncountry - Country code\n\nCommon Use Cases\n\nBuilding Agent Directories\nUse the Members endpoint to populate your application with real estate professional profiles directly from MLS data. This ensures your directory stays synchronized with official MLS rosters.\n\nMember Information Lookup\nThe Members endpoint supports various search and filtering capabilities. Available query parameters include agentId, boardAgentId, officeId, keywords, and pageNum. The keywords parameter performs broad searches across member details including names, contact information, and professional designations. Refer to the API documentation for complete details on how to use each parameter.\n\nMarket Research\nAnalyze the composition of real estate professionals in a market, including which brokerages have the most agents and geographic distribution of professionals.\n\nProfile Enrichment\nCross-reference member data with your internal agent records to enrich them with official MLS information like professional designations, office affiliations, and updated contact details.\n\nImportant Considerations\n\nData Source\nAll member information comes directly from MLS data feeds. Repliers doesn't modify or supplement this data beyond formatting it for API delivery.\n\nAgent Availability\nIf an agent is absent from the Members endpoint, the most likely explanation is that the agent has not had any listings in the MLS system. Members are captured when they appear on property listings, so agents without any historical listing activity will not be present in this endpoint. Additionally, members of MLS boards that do not disclose agent information on listings will not have data available through this endpoint.\n\nUpdate Frequency\nMember records are updated according to the MLS board's data refresh schedule. \n\nPagination\nWith potentially tens of thousands of members per MLS board, proper pagination handling is essential. Use the pageNum parameter to iterate through pages, and check the numPages field to determine when you've reached the end of the result set.\n\nExample Response Structure\n\nHere's a simplified example showing the structure you'll receive:\n\n{\n\"page\": 1,\n\"numPages\": 394,\n\"pageSize\": 100,\n\"count\": 39337,\n\"members\": [\n{\n\"resource\": \"Property:2505\",\n\"agentId\": \"MRD12345\",\n\"boardAgentId\": \"MRD12345\",\n\"officeId\": \"MRD999\",\n\"updatedOn\": \"2021-01-22 20:42:48\",\n\"name\": \"Jane Smith\",\n\"board\": null,\n\"position\": \"REALTOR Salesperson\",\n\"phones\": [\"555-123-4567\", \"555-987-6543\"],\n\"social\": [],\n\"website\": null,\n\"photo\": {\n\"small\": null,\n\"large\": null,\n\"updatedOn\": null\n},\n\"brokerage\": {\n\"name\": \"Premier Real Estate Group\",\n\"address\": {\n\"address1\": \"123 Main Street\",\n\"address2\": \"Suite 100\",\n\"city\": \"Chicago\",\n\"state\": \"IL\",\n\"postal\": \"60601\",\n\"country\": null\n}\n},\n\"email\": \"jsmith@example.com\"\n}\n]\n}\n\nPrivacy Considerations\nWhile this is publicly available MLS data, remember that it contains personal contact information. Use this data responsibly and in accordance with applicable privacy regulations and MLS rules.\nUpdated on: 13/01/2026\n---",
      parameters: {
        type: 'object',
        properties: {
          "agentId": {
            "type": "string",
            "description": "Filters members by agent ID using exact match."
          },
          "agentName": {
            "type": "string",
            "description": "Filters members by agent name using exact match."
          },
          "boardId": {
            "type": "string",
            "description": "Filters members by the MLS board they belong to."
          },
          "brokerage": {
            "type": "string",
            "description": "Filters members by brokerage name using partial match."
          },
          "keywords": {
            "type": "string",
            "description": "Searches members by keyword across multiple fields."
          },
          "officeId": {
            "type": "string",
            "description": "Filters members by office ID."
          },
          "pageNum": {
            "type": "integer",
            "format": "int32",
            "default": 1,
            "maximum": 10000,
            "description": "The page number to return. For example, with 100 results per page, specifying pageNum=2 returns results 101–200."
          },
          "position": {
            "type": "string",
            "description": "Filters members by their position or role (e.g., Broker, Sales Representative)."
          },
          "resultsPerPage": {
            "type": "integer",
            "format": "int32",
            "default": 100,
            "maximum": 1000,
            "description": "The number of members to return per page."
          }
        },
        required: [],
      },
    },
  },
};
