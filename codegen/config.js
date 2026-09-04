export default {
  // Path to your OpenAPI spec (relative to project root)
  specPath: './openapi.json',

  // Where generated tool files are written
  outputDir: './tools/repliers/repliers-api/generated',

  // Endpoints to skip — use operationId OR "METHOD /path" (case-sensitive method)
  exclude: [
    'POST /listings',
    'POST /favorites',
    // Webhooks
    'list-subscriptions',
    'create-a-webhook',
    'get-a-subscription',
    'update-a-subscription',
    'delete-a-subscription',
    'list-events',
    // Manually excluded
    'get-deleted-listings',
    'locations',
    'get-tags',
    'rename-a-tag',
    'buildings',
    'POST /nlp',
    'places',
    'transfer-agents',
  ],
};
