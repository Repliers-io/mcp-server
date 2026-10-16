export default {
  // Path to your OpenAPI spec (relative to project root)
  specPath: './openapi.json',

  // Where `npm run sync-spec` fetches specPath from. Pinned to a commit so a regeneration is
  // reproducible and an upstream edit never reaches the roster unreviewed; bump `ref` deliberately.
  upstreamSpec: {
    repo: 'Repliers-io/api-docs',
    ref: 'be440f92a357363963c87632378f97f739989755', // 2026-10-08
    path: 'bundled_docs/repliers.json',
  },

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
    'get-tags',
    'rename-a-tag',
    'POST /nlp',
    'places',
    'transfer-agents',
    // New upstream at the 2026-10-08 sync. Held back until the roster-size question is decided:
    // registry-truncating clients (ChatGPT/Codex) already see 45 tools — docs/feedback-v2/design.md §9.
    'DELETE /messages/{messageId}',
    'GET /searches/matches',
    'GET /estimates/{estimateId}',
    'GET /buildings',
    'POST /locations',
    'PATCH /favorites/{favoriteId}',
    // Webhooks again — these two arrived under operationIds the list above does not name.
    'GET /webhooks/events/{name}',
    'PUT /webhooks/{webhookId}',
  ],
};
