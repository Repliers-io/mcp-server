#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, unlinkSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const config = (await import('./config.js')).default;
const overridesPath = join(__dirname, 'overrides.json');
const rawOverrides = JSON.parse(readFileSync(overridesPath, 'utf-8'));
// Strip comment/schema keys
const overrides = Object.fromEntries(
  Object.entries(rawOverrides).filter(([k]) => !k.startsWith('_'))
);

// Load spec
const specPath = resolve(root, config.specPath);
if (!existsSync(specPath)) {
  console.error(`\nError: OpenAPI spec not found at ${specPath}`);
  console.error(`Place your spec at that path or update specPath in codegen/config.js\n`);
  process.exit(1);
}

const spec = JSON.parse(readFileSync(specPath, 'utf-8'));
const baseUrl = (spec.servers?.[0]?.url || 'https://api.repliers.io').replace(/\/$/, '');

// Ensure output directory exists
const outputDir = resolve(root, config.outputDir);
mkdirSync(outputDir, { recursive: true });

// Resolve a $ref within the spec (handles JSON Pointer encoding: ~1 = /, ~0 = ~)
function resolveRef(ref, spec) {
  const parts = ref.replace(/^#\//, '').split('/').map(k => k.replace(/~1/g, '/').replace(/~0/g, '~'));
  return parts.reduce((obj, key) => Array.isArray(obj) ? obj[Number(key)] : obj?.[key], spec);
}

// Recursively resolve $refs in a schema object
function resolveSchema(schema, spec) {
  if (!schema) return {};
  if (schema.$ref) return resolveSchema(resolveRef(schema.$ref, spec), spec);

  const out = { ...schema };
  if (out.properties) {
    out.properties = Object.fromEntries(
      Object.entries(out.properties).map(([k, v]) => [k, resolveSchema(v, spec)])
    );
  }
  if (out.items) out.items = resolveSchema(out.items, spec);
  if (out.allOf) out.allOf = out.allOf.map(s => resolveSchema(s, spec));
  if (out.oneOf) out.oneOf = out.oneOf.map(s => resolveSchema(s, spec));
  delete out.$ref;
  return out;
}

// Resolve a parameter that may itself be a $ref
function resolveParam(param, spec) {
  if (param.$ref) return resolveParam(resolveRef(param.$ref, spec), spec);
  return { ...param, schema: resolveSchema(param.schema, spec) };
}

// Derive a kebab-case filename from an operationId
function toFilename(operationId, method, path) {
  const base = operationId
    || `${method}-${path.replace(/[/{}]/g, '-').replace(/^-+|-+$/g, '').replace(/-+/g, '-')}`;
  // camelCase → kebab-case
  return base.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase() + '.js';
}

// Strip HTML to plain text, attempting to isolate article body content
function htmlToText(html) {
  // Pull out article/main body if present, otherwise use full page
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
    || html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  const source = articleMatch ? articleMatch[1] : html;

  return source
    .replace(/<(script|style|nav|header|footer|noscript|aside)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/(p|h[1-6]|li|div|section|blockquote|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Fetch and extract plain-text content from a URL (returns null on failure)
async function fetchDocText(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'mcp-codegen/1.0' } });
    if (!res.ok) return null;
    return htmlToText(await res.text());
  } catch {
    return null;
  }
}

// Produce a clean JSON string indented for embedding inside a JS object literal
function inlineJson(obj, baseIndent) {
  return JSON.stringify(obj, null, 2)
    .split('\n')
    .map((line, i) => (i === 0 ? line : ' '.repeat(baseIndent) + line))
    .join('\n');
}

function generateToolFile(method, urlPath, operation, spec, override, docText) {
  const operationId = operation.operationId || `${method}_${urlPath.replace(/[/{}]/g, '_').replace(/^_+|_+$/g, '')}`;
  const toolName = override?.name || operationId;
  const baseDescription = operation.description || operation.summary || `${method.toUpperCase()} ${urlPath}`;
  const externalDocs = operation.externalDocs;
  const docsSection = docText
    ? `\n\n---\n${externalDocs?.description ? `${externalDocs.description}\n` : ''}${docText}\n---`
    : externalDocs ? `\n\nSee also: ${externalDocs.description} (${externalDocs.url})` : '';
  const defaultDescription = baseDescription + docsSection;
  const description = override?.description
    || (override?.additionalContext ? defaultDescription + '\n\n' + override.additionalContext : defaultDescription);

  const forcedQueryParams = override?.forcedQueryParams || {};
  const excludeFromSchema = new Set(override?.excludeFromSchema || []);
  const paramDescriptions = override?.parameterDescriptions || {};

  // Resolve and filter parameters
  const allParams = (operation.parameters || []).map(p => resolveParam(p, spec));
  const pathParams = allParams.filter(p => p.in === 'path' && !excludeFromSchema.has(p.name));
  const queryParams = allParams.filter(p => p.in === 'query' && !excludeFromSchema.has(p.name) && !(p.name in forcedQueryParams));

  // Request body properties
  let bodyProperties = {};
  let bodyRequired = [];
  if (operation.requestBody) {
    const content = operation.requestBody.content?.['application/json'];
    if (content?.schema) {
      const resolved = resolveSchema(content.schema, spec);
      bodyProperties = resolved.properties || {};
      bodyRequired = resolved.required || [];
    }
  }

  // Build JSON Schema for the tool
  const schemaProperties = {};
  const schemaRequired = [];

  for (const p of [...pathParams, ...queryParams]) {
    schemaProperties[p.name] = {
      ...(p.schema || { type: 'string' }),
      description: paramDescriptions[p.name] || p.description || '',
    };
    if (p.required) schemaRequired.push(p.name);
  }
  for (const [key, schema] of Object.entries(bodyProperties)) {
    schemaProperties[key] = {
      ...resolveSchema(schema, spec),
      description: paramDescriptions[key] || schema.description || '',
    };
    if (bodyRequired.includes(key)) schemaRequired.push(key);
  }

  // --- Code generation ---

  // URL construction
  const pathHasParams = pathParams.length > 0;
  let urlLines = '';
  if (pathHasParams) {
    urlLines += `  let urlPath = '${urlPath}';\n`;
    for (const p of pathParams) {
      urlLines += `  urlPath = urlPath.replace('{${p.name}}', encodeURIComponent(String(args.${p.name})));\n`;
    }
    urlLines += `  const url = new URL(\`\${baseUrl}\${urlPath}\`);\n`;
  } else {
    urlLines += `  const url = new URL(\`\${baseUrl}${urlPath}\`);\n`;
  }

  // Query params
  if (queryParams.length > 0) {
    urlLines += '\n';
    for (const p of queryParams) {
      if (p.schema?.type === 'array') {
        urlLines += `  if (args.${p.name} !== undefined) args.${p.name}.forEach(v => url.searchParams.append('${p.name}', String(v)));\n`;
      } else {
        urlLines += `  if (args.${p.name} !== undefined) url.searchParams.set('${p.name}', String(args.${p.name}));\n`;
      }
    }
  }

  // Forced query params
  for (const [key, value] of Object.entries(forcedQueryParams)) {
    urlLines += `  url.searchParams.set('${key}', '${value}');\n`;
  }

  // Body
  const hasBody = !['get', 'delete'].includes(method) && Object.keys(bodyProperties).length > 0;
  let bodyLines = '';
  if (hasBody) {
    bodyLines = `\n  const body = {};\n`;
    for (const key of Object.keys(bodyProperties)) {
      bodyLines += `  if (args.${key} !== undefined) body.${key} = args.${key};\n`;
    }
  }

  const contentTypeHeader = hasBody ? `\n      'Content-Type': 'application/json',` : '';
  const fetchBody = hasBody ? `,\n      body: JSON.stringify(body)` : '';

  return `// AUTO-GENERATED — run \`npm run generate\` to regenerate
// Source: ${method.toUpperCase()} ${urlPath} (operationId: ${operationId})

const executeFunction = async (args) => {
  const baseUrl = '${baseUrl}';
  const apiKey = args._repliersApiKey || process.env.REPLIERS_API_KEY;

${urlLines}${bodyLines}
  const finalUrl = url.toString();

  try {
    const response = await fetch(finalUrl, {
      method: '${method.toUpperCase()}',
      headers: {
        Accept: 'application/json',${contentTypeHeader}
        'REPLIERS-API-KEY': apiKey,
      }${fetchBody},
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
      name: ${JSON.stringify(toolName)},
      description: ${JSON.stringify(description)},
      parameters: {
        type: 'object',
        properties: ${inlineJson(schemaProperties, 8)},
        required: ${JSON.stringify(schemaRequired)},
      },
    },
  },
};
`;
}

// --- Main ---

const generatedFilenames = new Set();
let count = 0;
const methods = ['get', 'post', 'put', 'patch', 'delete'];

// Collect all unique externalDocs URLs across non-excluded operations
const externalDocsUrls = new Set();
for (const [urlPath, pathItem] of Object.entries(spec.paths || {})) {
  for (const method of methods) {
    const op = pathItem[method];
    if (!op?.externalDocs?.url) continue;
    const opId = op.operationId;
    const methodPath = `${method.toUpperCase()} ${urlPath}`;
    if (config.exclude?.includes(opId) || config.exclude?.includes(methodPath)) continue;
    externalDocsUrls.add(op.externalDocs.url);
  }
}

// Fetch all doc pages in parallel
const docContents = new Map();
if (externalDocsUrls.size > 0) {
  console.log(`\nFetching ${externalDocsUrls.size} documentation pages...`);
  await Promise.all([...externalDocsUrls].map(async (url) => {
    const text = await fetchDocText(url);
    if (text) {
      docContents.set(url, text);
      console.log(`  fetched ${url}`);
    } else {
      console.warn(`  failed  ${url}`);
    }
  }));
}

console.log(`\nGenerating tools from ${config.specPath}...\n`);

for (const [urlPath, pathItem] of Object.entries(spec.paths || {})) {
  for (const method of methods) {
    const operation = pathItem[method];
    if (!operation) continue;

    const operationId = operation.operationId;
    const methodPath = `${method.toUpperCase()} ${urlPath}`;

    if (config.exclude?.includes(operationId) || config.exclude?.includes(methodPath)) {
      console.log(`  skip  ${methodPath}${operationId ? ` (${operationId})` : ''}`);
      continue;
    }

    const override = overrides[operationId] || overrides[methodPath] || {};
    const filename = override.filename || (override.name ? override.name + '.js' : toFilename(operationId, method, urlPath));
    const outputPath = join(outputDir, filename);
    const docText = operation.externalDocs?.url ? docContents.get(operation.externalDocs.url) : undefined;

    const content = generateToolFile(method, urlPath, operation, spec, override, docText);
    writeFileSync(outputPath, content);
    generatedFilenames.add(filename);
    count++;
    console.log(`  write ${filename}  (${override.name || operationId || methodPath})`);
  }
}

// Remove stale generated files not produced this run
const existingFiles = existsSync(outputDir)
  ? readdirSync(outputDir).filter(f => f.endsWith('.js'))
  : [];

for (const file of existingFiles) {
  if (!generatedFilenames.has(file)) {
    unlinkSync(join(outputDir, file));
    console.log(`  removed stale: ${file}`);
  }
}

console.log(`\nDone — ${count} tool${count === 1 ? '' : 's'} written to ${config.outputDir}\n`);
