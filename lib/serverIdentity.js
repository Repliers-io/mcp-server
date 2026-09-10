// Who this server says it is. Both transports build their MCP `Implementation` from here, so the
// name, version and branding a client renders cannot drift between stdio and Streamable HTTP.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const SERVER_NAME = "Repliers MCP Server";
export const WEBSITE_URL = "https://repliers.io";

// Read rather than repeated as a literal: the version used to be typed out at both `new Server`
// call sites and again in /health, and all three said 0.1.0 while the package said 0.0.1.
export const SERVER_VERSION = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "package.json"), "utf8")
).version;

// The Repliers favicon, taken from what repliers.io serves in its own `<link rel="icon">`:
// https://repliers.com/wp-content/uploads/2024/05/cropped-favicon-small-{32x32,192x192}.png
// That matters — Claude.ai already resolves this connector's picture by falling back to the apex
// domain's favicon, so shipping anything else would replace one image with a different one.
//
// Keyed by the size each file actually is, and read here at import rather than on demand. A
// missing asset then kills startup with an ENOENT naming the file, instead of turning a cosmetic
// feature into a 500 on every initialize.
const ICONS = Object.entries({
  32: "repliers-icon-32.png",
  192: "repliers-icon-192.png",
}).map(([size, file]) => {
  const bytes = fs.readFileSync(path.join(repoRoot, "assets", file));
  return {
    size: Number(size),
    bytes,
    // Encoded once at import: serverImplementation() runs per session, and this is ~20 KB.
    src: `data:image/png;base64,${bytes.toString("base64")}`,
  };
});

/**
 * What the public branding routes serve to favicon crawlers: the largest icon carried. Which path
 * a given resolver probes first is not knowable from here, so they all get the same one rather
 * than risking a connector card rendered from an upscaled 32x32.
 */
export const faviconPng = ICONS.reduce((a, b) => (b.size > a.size ? b : a)).bytes;

/**
 * The `Implementation` handed back in every initialize result.
 *
 * The icons are inlined as data URIs rather than pointed at by URL. Under stdio there is no
 * origin to build a URL from at all, and over either transport an inlined icon cannot arrive
 * late, be blocked, or 404 independently of the result that describes it — the metadata is
 * self-contained. The cost is real and worth knowing before adding a third size: the icons are
 * ~20 KB of a ~22 KB initialize result, dwarfing the server instructions that share it. Once per
 * session, on both transports, that is affordable; a much larger asset would not be.
 */
export function serverImplementation() {
  return {
    name: SERVER_NAME,
    version: SERVER_VERSION,
    websiteUrl: WEBSITE_URL,
    icons: ICONS.map(({ size, src }) => ({
      src,
      mimeType: "image/png",
      sizes: [`${size}x${size}`],
    })),
  };
}
