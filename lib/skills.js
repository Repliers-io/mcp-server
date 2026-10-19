// Skills served over the MCP skills extension (io.modelcontextprotocol/skills, SEP-2640).
//
// Every directory `<root>/<name>/` holding a SKILL.md is one skill. Its files are read once, at
// startup — they ship in the deployed slug and never change while the process runs — and each is
// served as a `skill://<name>/<relative/path>` resource whose digest is computed over exactly the
// bytes resources/read later returns.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const MAX_FILES_PER_SKILL = 512;
export const MAX_BYTES_PER_SKILL = 16 * 1024 * 1024;

const MIME_TYPES = {
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".html": "text/html",
  ".htm": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".ts": "text/plain",
  ".py": "text/x-python",
  ".sh": "text/x-shellscript",
  ".json": "application/json",
  ".yaml": "application/yaml",
  ".yml": "application/yaml",
  ".xml": "application/xml",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

const TEXT_MIME = /^text\/|^application\/(json|yaml|xml)$|^image\/svg\+xml$/;

export function mimeTypeFor(relPath) {
  return MIME_TYPES[path.extname(relPath).toLowerCase()] ?? "application/octet-stream";
}

/**
 * Whether a file goes out as `text` rather than `blob`. Only when its type is textual and its
 * bytes are valid UTF-8: a `text` that had to be repaired on decode would no longer hash to the
 * digest the skill entry advertised.
 */
export function isTextFile(mimeType, bytes) {
  if (!TEXT_MIME.test(mimeType)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

/**
 * The `---` block at the top of a SKILL.md, as flat `key: value` pairs. Enough for the files we
 * ship; nested YAML is not supported and is reported as a missing frontmatter rather than guessed.
 * Returns null when there is no frontmatter block.
 */
export function parseFrontmatter(text) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  if (lines[0].trim() !== "---") return null;
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
  if (end === -1) return null;
  const fields = {};
  for (const line of lines.slice(1, end)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const m = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    if (value.length >= 2 && /^(["']).*\1$/.test(value)) value = value.slice(1, -1);
    fields[m[1]] = value;
  }
  return fields;
}

/** Regular files under `dir`, recursively, as forward-slash paths relative to `dir`. */
function listFiles(dir, prefix = "") {
  const out = [];
  for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${dirent.name}` : dirent.name;
    if (dirent.isDirectory()) out.push(...listFiles(path.join(dir, dirent.name), rel));
    else if (dirent.isFile()) out.push(rel);
    // Symlinks and other entries are not served: a link could point outside the skill directory.
  }
  return out;
}

const warn = (msg) => console.error(`[WARN] skills: ${msg}`);

function loadSkill(root, dirName) {
  const dir = path.join(root, dirName);
  const skillMd = path.join(dir, "SKILL.md");
  if (!fs.existsSync(skillMd)) return null;

  const frontmatter = parseFrontmatter(fs.readFileSync(skillMd, "utf8"));
  if (!frontmatter?.name || !frontmatter?.description) {
    warn(`skipping ${dirName}: SKILL.md frontmatter needs both name and description`);
    return null;
  }
  if (frontmatter.name !== dirName) {
    warn(`skipping ${dirName}: frontmatter name "${frontmatter.name}" must equal the directory name`);
    return null;
  }

  const relPaths = listFiles(dir).sort((a, b) => (a === "SKILL.md" ? -1 : b === "SKILL.md" ? 1 : a.localeCompare(b)));
  if (relPaths.length > MAX_FILES_PER_SKILL) {
    warn(`skipping ${dirName}: ${relPaths.length} files exceeds the ${MAX_FILES_PER_SKILL}-file limit`);
    return null;
  }

  const files = new Map();
  const resources = [];
  let total = 0;
  for (const rel of relPaths) {
    const bytes = fs.readFileSync(path.join(dir, rel));
    total += bytes.length;
    if (total > MAX_BYTES_PER_SKILL) {
      warn(`skipping ${dirName}: content exceeds the ${MAX_BYTES_PER_SKILL}-byte limit`);
      return null;
    }
    const uri = `skill://${dirName}/${rel}`;
    files.set(uri, { bytes, mimeType: mimeTypeFor(rel), relPath: rel });
    resources.push({ uri, digest: `sha256:${createHash("sha256").update(bytes).digest("hex")}`, size: bytes.length });
  }

  return { entry: { uri: `skill://${dirName}/SKILL.md`, frontmatter, resources }, files };
}

/** @returns {{ entry: object, files: Map<string, { bytes: Buffer, mimeType: string, relPath: string }> }[]} */
export function loadSkills(rootDir) {
  let dirents;
  try {
    dirents = fs.readdirSync(rootDir, { withFileTypes: true });
  } catch (err) {
    warn(`no skills served: cannot read ${rootDir} (${err.code ?? err.message})`);
    return [];
  }
  return dirents
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .map((name) => loadSkill(rootDir, name))
    .filter(Boolean);
}
