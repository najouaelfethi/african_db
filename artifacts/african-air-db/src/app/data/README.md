# Geographic Data

## africa-countries.json

**Source:** Natural Earth 1:50m `ne_50m_admin_0_countries` via the
[world-atlas](https://github.com/topojson/world-atlas) npm package (v2).
World-atlas redistributes Natural Earth data in TopoJSON format; the GeoJSON
here was extracted from it at build time.

**License:** Public domain (Natural Earth). Free for academic and commercial use.

**Coverage:** All 54 African sovereign states. Western Sahara (ISO 732) is
dissolved into Morocco (ISO 504) using topojson-client `merge()` so that
Morocco renders as a single unified polygon with no internal boundary.
Réunion is stored separately in `reunion.json` as a real Natural Earth polygon
extracted from France's feature and is merged into the map at runtime.

**Feature schema:**
```json
{
  "type": "Feature",
  "id": "012",                        // ISO 3166-1 numeric, zero-padded to 3 digits
  "properties": {
    "name": "Algeria",                // Display name used for tooltips
    "iso_n3": "012"                   // Redundant with id; kept for convenience
  },
  "geometry": { ... }                 // Polygon or MultiPolygon (WGS-84)
}
```

**How to update:**
1. Run the generation script from the workspace root:
   ```
   node scripts/generate-africa-geojson.js
   ```
   (Requires `world-atlas` and `topojson-client` installed in
   `artifacts/african-air-db`.)
2. Or replace this file with any GeoJSON that:
   - Uses ISO 3166-1 numeric IDs on each Feature
   - Includes `properties.name` for display
   - Covers all 54 African countries

**Upgrade path for island territories:**
To render overseas territories (Canary Islands, Réunion, Madeira) as separate
polygons rather than as part of their mainland country's MultiPolygon, replace
this file with data from Natural Earth's `ne_50m_admin_0_map_units` dataset
(available at https://www.naturalearthdata.com/downloads/50m-cultural-vectors/).
Map-units separates territories by administrative unit, not sovereignty.
