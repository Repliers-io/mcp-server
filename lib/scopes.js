import { toolAnnotations } from './tools.js';

/**
 * The two scopes this server understands. They are values configured in the PropelAuth MCP
 * dashboard, so they live in exactly one place: if that dashboard cannot hold these names
 * (docs/oauth21/design.md Q9), only these two constants change.
 */
export const SCOPE_READ = 'mcp:read';
export const SCOPE_WRITE = 'mcp:write';

/**
 * The scope a tool call requires, derived from the readOnlyHint the roster already publishes.
 * That hint is keyed on the tool name, so the mapping survives `npm run generate` without any
 * per-tool marking. Fail-closed: a tool matching no annotation rule is treated as a writer.
 */
export function requiredScope(toolName) {
  return toolAnnotations(toolName)?.readOnlyHint === true ? SCOPE_READ : SCOPE_WRITE;
}
