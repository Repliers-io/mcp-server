import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as z from "zod/v4";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { loadSkills } from "../lib/skills.js";
import { SKILLS_EXTENSION, registerSkillHandlers, serverCapabilities } from "../lib/skillHandlers.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = path.join(repoRoot, "skills");
const skillPath = path.join(skillsRoot, "repliers-real-estate", "SKILL.md");
const SKILL_URI = "skill://repliers-real-estate/SKILL.md";

const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

function tempSkillsRoot(t, layout) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "skills-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [rel, content] of Object.entries(layout)) {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  return root;
}

/** Captures console.error while `fn` runs, so skip warnings can be asserted and stay quiet. */
function captureStderr(t, fn) {
  const lines = [];
  t.mock.method(console, "error", (...args) => lines.push(args.join(" ")));
  const result = fn();
  t.mock.restoreAll();
  return { result, lines };
}

test("loadSkills reads the real skills/ directory", () => {
  const bytes = fs.readFileSync(skillPath);
  const skills = loadSkills(skillsRoot);

  assert.equal(skills.length, 1);
  const [{ entry, files }] = skills;
  assert.equal(entry.uri, SKILL_URI);
  assert.equal(entry.frontmatter.name, "repliers-real-estate");
  assert.match(entry.frontmatter.description, /^Use when the user asks about homes/);
  assert.deepEqual(entry.resources, [{ uri: SKILL_URI, digest: sha256(bytes), size: bytes.length }]);
  assert.match(entry.resources[0].digest, /^sha256:[0-9a-f]{64}$/);
  assert.ok(Buffer.from(files.get(SKILL_URI).bytes).equals(bytes), "served bytes must be the digested bytes");
  assert.equal(files.get(SKILL_URI).mimeType, "text/markdown");
});

test("loadSkills lists every file of a skill once, recursively, with forward-slash URIs", (t) => {
  const root = tempSkillsRoot(t, {
    "demo/SKILL.md": "---\nname: demo\ndescription: A demo skill\nlicense: MIT\n---\n\n# Demo\n",
    "demo/references/guide.md": "# Guide\n",
    "demo/scripts/run.py": "print('hi')\n",
    "demo/assets/logo.png": Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 255]),
  });
  const [skill] = loadSkills(root);

  assert.equal(skill.entry.uri, "skill://demo/SKILL.md");
  assert.deepEqual(skill.entry.frontmatter, { name: "demo", description: "A demo skill", license: "MIT" });
  assert.deepEqual(
    skill.entry.resources.map((r) => r.uri).sort(),
    [
      "skill://demo/SKILL.md",
      "skill://demo/assets/logo.png",
      "skill://demo/references/guide.md",
      "skill://demo/scripts/run.py",
    ]
  );
  const logo = fs.readFileSync(path.join(root, "demo/assets/logo.png"));
  const logoEntry = skill.entry.resources.find((r) => r.uri.endsWith("logo.png"));
  assert.deepEqual(logoEntry, { uri: "skill://demo/assets/logo.png", digest: sha256(logo), size: logo.length });
});

test("loadSkills skips a skill whose name is not its directory name", (t) => {
  const root = tempSkillsRoot(t, {
    "good/SKILL.md": "---\nname: good\ndescription: fine\n---\n",
    "mismatch/SKILL.md": "---\nname: other\ndescription: wrong name\n---\n",
  });
  const { result, lines } = captureStderr(t, () => loadSkills(root));
  assert.deepEqual(result.map((s) => s.entry.frontmatter.name), ["good"]);
  assert.ok(lines.some((l) => l.includes("mismatch")), `expected a warning naming the skipped skill: ${lines}`);
});

test("loadSkills skips a skill without a description or without frontmatter", (t) => {
  const root = tempSkillsRoot(t, {
    "nodesc/SKILL.md": "---\nname: nodesc\n---\n# Body\n",
    "nofront/SKILL.md": "# Just a body\n",
    "nofile/README.md": "not a skill\n",
  });
  const { result, lines } = captureStderr(t, () => loadSkills(root));
  assert.deepEqual(result, []);
  assert.ok(lines.some((l) => l.includes("nodesc")));
  assert.ok(lines.some((l) => l.includes("nofront")));
});

test("loadSkills skips a skill over the 512-file limit", (t) => {
  const layout = { "big/SKILL.md": "---\nname: big\ndescription: too many files\n---\n" };
  for (let i = 0; i < 512; i++) layout[`big/f/${i}.txt`] = "x";
  const root = tempSkillsRoot(t, layout);
  const { result, lines } = captureStderr(t, () => loadSkills(root));
  assert.deepEqual(result, []);
  assert.ok(lines.some((l) => l.includes("big")));
});

test("loadSkills returns nothing for a missing root", (t) => {
  const { result } = captureStderr(t, () => loadSkills(path.join(os.tmpdir(), "no-such-skills-dir-xyz")));
  assert.deepEqual(result, []);
});

// --- Protocol: a real SDK Client talking to a Server wired the way mcpServer.js wires it ---

const Passthrough = z.object({}).passthrough();

async function connectedClient(t) {
  const server = new Server({ name: "skills-test", version: "0.0.0" }, { capabilities: serverCapabilities() });
  registerSkillHandlers(server, loadSkills(skillsRoot));
  const client = new Client({ name: "skills-test-client", version: "0.0.0" });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(clientSide), server.connect(serverSide)]);
  t.after(async () => {
    await client.close();
    await server.close();
  });
  return client;
}

test("initialize advertises resources and the skills extension", async (t) => {
  const client = await connectedClient(t);
  const caps = client.getServerCapabilities();
  assert.deepEqual(caps.extensions?.[SKILLS_EXTENSION], {});
  assert.equal(SKILLS_EXTENSION, "io.modelcontextprotocol/skills");
  assert.ok(caps.resources, "resources capability must be declared");
  assert.ok(caps.tools, "tools capability must stay declared");
});

test("skills/list returns the skill entry as a complete, cacheable result", async (t) => {
  const client = await connectedClient(t);
  const result = await client.request({ method: "skills/list", params: {} }, Passthrough);
  assert.equal(result.resultType, "complete");
  assert.equal(result.ttlMs, 300000);
  assert.equal(result.cacheScope, "public");
  assert.equal(result.skills.length, 1);
  assert.equal(result.skills[0].uri, SKILL_URI);
  assert.deepEqual(result.skills[0], loadSkills(skillsRoot)[0].entry);
  assert.equal("nextCursor" in result, false);
});

test("skills/get returns the entry and rejects an unknown uri with -32602", async (t) => {
  const client = await connectedClient(t);
  const result = await client.request({ method: "skills/get", params: { uri: SKILL_URI } }, Passthrough);
  assert.equal(result.resultType, "complete");
  assert.equal(result.ttlMs, 300000);
  assert.equal(result.cacheScope, "public");
  assert.equal(result.skill.uri, SKILL_URI);

  await assert.rejects(
    client.request({ method: "skills/get", params: { uri: "skill://nope/SKILL.md" } }, Passthrough),
    (err) => err.code === ErrorCode.InvalidParams
  );
  // A file of a known skill that is not its SKILL.md is not a skill uri either.
  await assert.rejects(
    client.request({ method: "skills/get", params: { uri: "skill://repliers-real-estate/" } }, Passthrough),
    (err) => err.code === ErrorCode.InvalidParams
  );
});

test("resources/list lists SKILL.md as text/markdown with its frontmatter name and description", async (t) => {
  const client = await connectedClient(t);
  const { resources } = await client.listResources();
  const skill = resources.find((r) => r.uri === SKILL_URI);
  assert.ok(skill, `SKILL.md missing from ${JSON.stringify(resources)}`);
  assert.equal(skill.mimeType, "text/markdown");
  assert.equal(skill.name, "repliers-real-estate");
  assert.match(skill.description, /^Use when the user asks about homes/);
  assert.equal(skill.size, fs.statSync(skillPath).size);
});

test("resources/read returns exactly the digested bytes, and -32602 for an unknown uri", async (t) => {
  const client = await connectedClient(t);
  const listed = (await client.request({ method: "skills/list", params: {} }, Passthrough)).skills[0].resources[0];
  const { contents } = await client.readResource({ uri: SKILL_URI });
  assert.equal(contents.length, 1);
  assert.equal(contents[0].uri, SKILL_URI);
  assert.equal(contents[0].mimeType, "text/markdown");
  assert.equal(sha256(Buffer.from(contents[0].text, "utf8")), listed.digest);

  await assert.rejects(
    client.readResource({ uri: "skill://repliers-real-estate/missing.md" }),
    (err) => err.code === ErrorCode.InvalidParams
  );
});

test("resources/read serves a binary skill file as base64 blob", async (t) => {
  const root = tempSkillsRoot(t, {
    "demo/SKILL.md": "---\nname: demo\ndescription: d\n---\n",
    "demo/assets/logo.png": Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 255]),
  });
  const server = new Server({ name: "skills-test", version: "0.0.0" }, { capabilities: serverCapabilities() });
  registerSkillHandlers(server, loadSkills(root));
  const client = new Client({ name: "c", version: "0.0.0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(a), server.connect(b)]);
  t.after(async () => {
    await client.close();
    await server.close();
  });

  const { contents } = await client.readResource({ uri: "skill://demo/assets/logo.png" });
  assert.equal(contents[0].mimeType, "image/png");
  assert.equal(contents[0].text, undefined);
  assert.deepEqual(Buffer.from(contents[0].blob, "base64"), fs.readFileSync(path.join(root, "demo/assets/logo.png")));
});
