# Repliers MCP Server

Repliers MCP server provides a set of tools to access the [Repliers API](https://repliers.com/developer-agencies/) in a Model Context Provider (MCP) compatible format.

Repliers API provides developers with real-time access to MLS listings, advanced property search and filters, media delivery (images, floorplans, tours), market analytics, and AI-powered tools like instant valuations and alerts. It enables rapid development of real estate platforms without needing to manage backend infrastructure or MLS integrations.

This lets you use Claude Desktop, or any MCP Client, to use natural language to accomplish things via Repliers API tools, such as:

- "Find me 3 bedroom apartments in San Francisco below $1 million that has been on market for less than a week"
- "What are the property types and styles available in San Francisco?"
- "Give me history of 123 Main St, San Francisco"
- "What is the median list price for residential houses for sale in San Francisco aggregated by month within last 20 months?"

## Features

The following tools to access Repliers API are provided by the MCP server.

`search` - The search tool is the core query engine that lets you search across active, sold, or leased property listings using flexible filters like:

- location (city, neighborhood, coordinates, etc.)
- Price range
- Property type & style
- Bedrooms, bathrooms, size
- Status (active, sold, leased)
- Keywords, features (e.g. pool, finished basement)
- Listing date, open house flags
- and many more

`get-a-listing` - Fetches detailed information for a specific property listing using its ID or MLS number including address history

`find-similar-listings` - Returns listings that are similar to a given property based on location, price, type, or other attributes.

`get-address-history` - Retrieves the historical listing activity for a specific address, including previous sales, rentals, and listing changes.

`property-types-styles` - Returns a reference list of supported property types (e.g. condo, detached) and architectural styles for a given MLS board.

`get-deleted-listings` - Provides access to listings that were recently removed or deleted from the MLS.

`areas-cities-and-neighborhoods` - Returns a hierarchical catalog of geographic areas, cities, and neighborhoods as provided by MLS.

`buildings` - Fetches data about known buildings (e.g., condos or apartments) including name, address, and metadata.

Let's set things up!

## 🚦 Getting Started

### ⚙️ Prerequisites

Before starting, please ensure you have:

- [Node.js (v18+ required, v22+ recommended)](https://nodejs.org/)
- [npm](https://www.npmjs.com/) (included with Node)

Warning: if you run with a lower version of Node, some things may not work as expected.

### 📥 Installation & Setup

**1. Install dependencies**

Run from your project's root directory:

```sh
npm install
```

### 🔐 Set tool environment variables

You should create an `.env` file in the root of your project directory. This file will hold environment variable that Repliers tools will use to authenticate with the APIs.

Set the value of `REPLIERS_API_KEY` to your Repliers API key, which you can find in your [Repliers API keys](https://login.repliers.com/dashboard/apikeys). If you don't have an account, you can create one at [Repliers](https://auth.repliers.com/en/signup).

```
REPLIERS_API_KEY=
```

This environment variable is used inside of the tools to set the API key for each request. You can inspect a file in the `tools` directory to see how it works.

```javascript
// environment variables are used inside of each tool file
const apiKey = process.env.REPLIERS_API_KEY;
```

## 🌐 Test the MCP Server with Postman

The MCP Server (`mcpServer.js`) exposes your automated API tools to MCP-compatible clients, such as Claude Desktop or the Postman Desktop Application. We recommend that you test the server with Postman first and then move on to using it with an LLM.

The Postman Desktop Application is the easiest way to run and test MCP servers. Testing the downloaded server first is optional but recommended.

**Step 1**: Download the latest Postman Desktop Application from [https://www.postman.com/downloads/](https://www.postman.com/downloads/).

**Step 2**: Read out the documentation article [here](https://learning.postman.com/docs/postman-ai-agent-builder/mcp-requests/create/) and see how to create an MCP request inside the Postman app.

**Step 3**: Set the type of the MCP request to `STDIO` and set the command to `node </absolute/path/to/mcpServer.js>`. If you have issues with using only `node` (e.g. an old version is used), supply an absolute path instead to a node version 20+. You can get the full path to node by running:

```sh
which node
```

To check the node version, run:

```sh
node --version
```

To get the absolute path to `mcpServer.js`, run:

```sh
realpath mcpServer.js
```

Use the node command followed by the full path to `mcpServer.js` as the command for your new Postman MCP Request. Then click the **Connect** button. You should see a list of tools that you selected before generating the server. You can test that each tool works here before connecting the MCP server to an LLM.

## 👩‍💻 Connect the MCP Server to Claude

You can connect your MCP server to any MCP client. Here we provide instructions for connecting it to Claude Desktop.

**Step 1**: Note the full path to node and the `mcpServer.js` from the previous step.

**Step 2**. Open Claude Desktop → **Settings** → **Developers** → **Edit Config** and add a new MCP server:

```json
{
  "mcpServers": {
    "repliers": {
      "command": "<absolute/path/to/node>",
      "args": ["<absolute/path/to/mcpServer.js>"],
      "env": {
        "REPLIERS_API_KEY": "your-repliers-api-key"
      }
    }
  }
}
```

Restart Claude Desktop to activate this change. Make sure the new MCP is turned on and has a green circle next to it. If so, you're ready to begin a chat session that can use the tools you've connected.

**Warning**: If you don't supply an absolute path to a `node` version that is v20+, Claude (and other MCP clients) may fall back to another `node` version on the system of a previous version.

### Additional Options

#### 🐳 Docker Deployment (Production)

For production deployments, you can use Docker:

**1. Build Docker image**

```sh
docker build -t <your_server_name> .
```

**2. Claude Desktop Integration**

Add server configuration to Claude Desktop (Settings → Developers → Edit Config):

```json
{
  "mcpServers": {
    "<your_server_name>": {
      "command": "node",
      "args": [
        "run",
        "-i",
        "--rm",
        "--env-file=.env",
        "<your_server_name>",
        "/ABSOLUTE/PATH/TO/PROJECT/DIRECTORY/mcp-unstructured-partition-demo/"
      ],
      "env": {
        "REPLIERS_API_KEY": "your-repliers-api-key"
      }
    }
  }
}
```

> Add your environment variables (API keys, etc.) inside the `.env` file.

The project comes bundled with the following minimal Docker setup:

```dockerfile
FROM node:22.12-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install

COPY . .

ENTRYPOINT ["node", "mcpServer.js"]
```

#### 🌐 Server-Sent Events (SSE)

To run the server with Server-Sent Events (SSE) support, use the `--sse` flag:

```sh
node mcpServer.js --sse
```

## 🛠️ Additional CLI commands

#### List tools

List descriptions and parameters from all included tools with:

```sh
node index.js tools
```

Example:

```
Available Tools:

Workspace: repliers-api
  Collection: property-types-styles.js
    list_property_types_and_styles
      Description: List property types and styles from the Repliers API.
      Parameters:

  Collection: get-deleted-listings.js
    get_deleted_listings
      Description: Retrieve deleted listings from the Repliers API.
      Parameters:
        - updatedOn: The date when the listing was updated.
        - minUpdatedOn: The minimum date for updated listings.
        - maxUpdatedOn: The maximum date for updated listings.

  Collection: areas-cities-and-neighborhoods.js
    list_locations
      Description: List geographical location data such as areas, cities, and neighborhoods.
      Parameters:
        - area: Limits location metadata to areas matching the supplied value.
        - city: Limits location metadata to cities matching the supplied value.
        - class: Limits location metadata to classes matching the supplied value.
        - neighborhood: Limits location metadata to neighborhoods matching the supplied value.
        - search: Limits location metadata to areas, cities, or neighborhoods that match or partially match the supplied value.

  Collection: get-address-history.js
    get_address_history
      Description: Retrieve the MLS history of a specific address.
      Parameters:
        - city: The city of the property.
        - streetName: The street name of the property.
        - streetNumber: The street number of the property.
        - unitNumber: The unit number of the property.
        - streetSuffix: The street suffix of the property.
        - streetDirection: The street direction of the property.
        - zip: The zip code of the property.

  Collection: buildings.js
    repliers_buildings_search
      Description: Search for building data using the Repliers API. Returns information about buildings/complexes rather than individual listings. All parameters including map are sent as query parameters in GET requests.
      Parameters:
        - params: No description
        - pageNum: Page number for pagination (default: 1). If specified loads a specific page in the results set
        - resultsPerPage: Number of buildings to return per page (default: 100, max: 100)

  Collection: get-a-listing.js
    get_listing
      Description: Get a listing using the MLS.
      Parameters:
        - mlsNumber: The MLS number of the listing you wish to retrieve.
        - boardId: Filter by boardId. This is only required if your account has access to more than one MLS.

  Collection: find-similar-listings.js
    find_similar_listings
      Description: Find similar listings using the MLS number.
      Parameters:
        - mlsNumber: The MLS number of the listing to find similar listings for.
        - boardId: Filter by one or more board IDs.
        - fields: Limit the response to specific fields (e.g., "listPrice,soldPrice" or "images[5]").
        - listPriceRange: Returns similar listings within a price range (e.g., 250000 for +/- $250,000).
        - radius: Show similar listings within a specified radius in kilometers.
        - sortBy: Sort similar listings by a specific field (e.g., "updatedOnDesc", "createdOnAsc").

  Collection: search.js
    repliers_listings_search
      Description: Comprehensive property search using Repliers API with all supported parameters. Most parameters are sent as query parameters (GET request). imageSearchItems and map parameters trigger a POST request with body parameters.
      Parameters:
        - params: No description
        - pageNum: Page number for pagination (default: 1)
        - resultsPerPage: Number of results per page (default: 100, max: 100)
```

# MCP Inspector Command

Launches the MCP (Master Control Program) Inspector tool for the given URL endpoint.

## Usage
mcp-inspector http://localhost:3001/mcp


