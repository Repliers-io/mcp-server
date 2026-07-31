// Param names verified against openapi.json POST /listings; NLP-built URLs may
// also use aliases (minBeds/maxBeds observed live), so families list both.
const geoParams = [
  "city", "area", "neighborhood", "district", "zip", "locationId",
  "map", "lat", "long", "radius", "areaOrCity", "cityOrDistrict",
];

const families = {
  location: geoParams,
  propertyType: ["propertyType", "propertyTypeOrStyle"],
  style: ["style"],
  class: ["class"],
  type: ["type"],
  priceRange: ["minPrice", "maxPrice"],
  bedrooms: ["minBeds", "maxBeds", "minBedrooms", "maxBedrooms", "minBedroomsTotal", "maxBedroomsTotal"],
  bathrooms: ["minBaths", "maxBaths"],
  sqft: ["minSqft", "maxSqft"],
  status: ["status", "lastStatus", "standardStatus"],
};

export function parseAppliedFilters(urlString) {
  let params;
  try {
    params = new URL(urlString).searchParams;
  } catch {
    return null;
  }
  const out = {};
  const used = new Set();
  for (const [family, names] of Object.entries(families)) {
    const present = names.filter((name) => params.has(name));
    present.forEach((name) => used.add(name));
    out[family] = present.length
      ? present.map((name) => `${name}=${params.getAll(name).join(",")}`).join(" ")
      : null;
  }
  const other = {};
  for (const [key, value] of params.entries()) {
    if (!used.has(key)) other[key] = value;
  }
  out.other = other;
  return out;
}

export function geoFilterPresent(urlString) {
  try {
    const params = new URL(urlString).searchParams;
    return geoParams.some((name) => params.has(name));
  } catch {
    return false;
  }
}
