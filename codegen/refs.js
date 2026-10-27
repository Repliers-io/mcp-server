// $ref resolution for codegen. Kept out of generate.js, which runs on import.

// Resolve a $ref within the spec. A ref is a URI fragment, so each segment is percent-decoded
// first (upstream writes `{mlsNumber}` as `%7BmlsNumber%7D`), then JSON-pointer unescaped
// (~1 = /, ~0 = ~) — the order RFC 6901 §6 requires.
// A segment that is not valid percent-encoding (a literal "100%") is matched as written.
// An unresolvable ref throws: silently resolving to {} is how the location-type enum was lost.
export function resolveRef(ref, spec) {
  const decode = (k) => { try { return decodeURIComponent(k); } catch { return k; } };
  const parts = ref.replace(/^#\//, '').split('/')
    .map(k => decode(k).replace(/~1/g, '/').replace(/~0/g, '~'));
  const target = parts.reduce((obj, key) => Array.isArray(obj) ? obj[Number(key)] : obj?.[key], spec);
  if (target === undefined) throw new Error(`Unresolvable $ref ${ref}`);
  return target;
}

// Recursively resolve $refs in a schema object
export function resolveSchema(schema, spec) {
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
export function resolveParam(param, spec) {
  if (param.$ref) return resolveParam(resolveRef(param.$ref, spec), spec);
  return { ...param, schema: resolveSchema(param.schema, spec) };
}
