// MCP handlers for the skills extension (io.modelcontextprotocol/skills, SEP-2640): skills/list,
// skills/get, and the resources/list|read that carry the skill files.
//
// The spec targets base revision 2026-07-28, where capabilities are announced through
// server/discover. SDK 1.30.0 speaks 2025-11-25 and has no server/discover, but its
// ServerCapabilities schema carries `extensions` and the initialize result passes it through, so
// the extension is declared there: a host that reads initialize capabilities finds it.
import * as z from "zod/v4";
import {
  ErrorCode,
  ListResourcesRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { isTextFile } from "./skills.js";

export const SKILLS_EXTENSION = "io.modelcontextprotocol/skills";

// Freshness hint for hosts. The files only change with a deploy, so five minutes costs little.
const CACHE = { ttlMs: 300000, cacheScope: "public" };

/** The capabilities both `new Server(...)` sites in mcpServer.js declare. */
export function serverCapabilities() {
  return { tools: {}, resources: {}, extensions: { [SKILLS_EXTENSION]: {} } };
}

const Meta = z.record(z.string(), z.unknown()).optional();

export const ListSkillsRequestSchema = z.object({
  method: z.literal("skills/list"),
  params: z.object({ cursor: z.string().optional(), _meta: Meta }).passthrough().optional(),
});

export const GetSkillRequestSchema = z.object({
  method: z.literal("skills/get"),
  params: z.object({ uri: z.string(), _meta: Meta }).passthrough(),
});

/** Registers the four handlers on `server`, serving `skills` as returned by loadSkills(). */
export function registerSkillHandlers(server, skills) {
  const byEntryUri = new Map(skills.map((s) => [s.entry.uri, s]));
  const files = new Map();
  for (const skill of skills) {
    for (const [uri, file] of skill.files) files.set(uri, { ...file, skill });
  }

  // One skill today: a single page, cursor ignored.
  server.setRequestHandler(ListSkillsRequestSchema, async () => ({
    resultType: "complete",
    skills: skills.map((s) => s.entry),
    ...CACHE,
  }));

  server.setRequestHandler(GetSkillRequestSchema, async (request) => {
    const skill = byEntryUri.get(request.params.uri);
    if (!skill) throw new McpError(ErrorCode.InvalidParams, `Unknown skill: ${request.params.uri}`);
    return { resultType: "complete", skill: skill.entry, ...CACHE };
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [...files].map(([uri, { relPath, mimeType, bytes, skill }]) =>
      relPath === "SKILL.md"
        ? {
            uri,
            name: skill.entry.frontmatter.name,
            description: skill.entry.frontmatter.description,
            mimeType,
            size: bytes.length,
          }
        : { uri, name: relPath, mimeType, size: bytes.length }
    ),
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    const file = files.get(uri);
    if (!file) throw new McpError(ErrorCode.InvalidParams, `Unknown resource: ${uri}`);
    const content = isTextFile(file.mimeType, file.bytes)
      ? { uri, mimeType: file.mimeType, text: file.bytes.toString("utf8") }
      : { uri, mimeType: file.mimeType, blob: file.bytes.toString("base64") };
    return { contents: [content] };
  });
}
