import { useMemo, useState } from "react";
import { feature, merge } from "topojson-client";
import countriesTopology from "world-atlas/countries-50m.json";
import { MapPin, BookOpen } from "lucide-react";
import { useAsync } from "../hooks/useData";
import { getCountrySummaries } from "../services/studyService";
import type { StudyFilters } from "../types/arcair";

// ── Geometry ──────────────────────────────────────────────────────────────────

const AFRICA_IDS = new Set([
  "012","024","204","072","854","108","120","132","140","148","174","178","180",
  "384","262","818","226","232","748","231","266","270","288","324","624","404",
  "426","430","434","450","454","466","478","480","504","508","516","562","566",
  "646","678","686","690","694","706","710","728","729","732","834","768","788",
  "800","894","716",
]);

// Extended viewBox: "-14 -6 382 334" shifts the visible area so Cape Verde
// (x≈3) is 17px from the left edge and eastern islands (Mauritius x≈334) fit.
const VIEW_BOX = "-14 -6 382 334";

const project = (lon: number, lat: number): [number, number] => [
  (lon + 26) * 4,
  (40  - lat) * 4,
];

function renderFeature(geom: GeoJSON.Geometry): string {
  if (geom.type === "Polygon")
    return geom.coordinates
      .map(ring => "M" + ring.map(([lo, la]) => project(lo, la).join(",")).join("L") + "Z")
      .join(" ");
  if (geom.type === "MultiPolygon")
    return geom.coordinates
      .map(poly => poly.map(ring => "M" + ring.map(([lo, la]) => project(lo, la).join(",")).join("L") + "Z").join(" "))
      .join(" ");
  return "";
}

// ── Non-sovereign territories (circle markers) ────────────────────────────────

const TERRITORY_MARKERS = [
  { id: "canary-islands", name: "Canary Islands", subtitle: "Spain",    iso: "ES", lon: -15.5, lat:  28.1, labelSide: "right" },
  { id: "madeira",        name: "Madeira",         subtitle: "Portugal", iso: "PT", lon: -16.9, lat:  32.7, labelSide: "right" },
] as const;

// Tiny sovereign island nations: rendered as circle markers for visibility
// At 50m topology scale these polygons are < 2 SVG units across and invisible.

// labelSide + short: display label positioned to avoid map edges / overlaps
const ISLAND_MARKERS = [
  { id: "132",            name: "Cape Verde",            short: "Cape Verde",   lon: -23.5, lat:  16.5, labelSide: "right" },
  { id: "678",            name: "São Tomé and Príncipe", short: "São Tomé",     lon:   6.6, lat:   0.2, labelSide: "right" },
  { id: "174",            name: "Comoros",               short: "Comoros",      lon:  43.3, lat: -11.6, labelSide: "left"  },
  { id: "690",            name: "Seychelles",            short: "Seychelles",   lon:  55.5, lat:  -4.7, labelSide: "left"  },
  { id: "480",            name: "Mauritius",             short: "Mauritius",    lon:  57.5, lat: -20.2, labelSide: "left"  },
  { id: "reunion-marker", name: "Réunion",               short: "Réunion",      lon:  55.5, lat: -21.8, labelSide: "left"  },
] as const;

// ── Country flags ─────────────────────────────────────────────────────────────
// Keys MUST match the canonical country names produced by canonicalCountryName()
// in studyService.ts, which are the exact keys used in COUNTRY_TOPO_ID (geo.ts).
// Any mismatch silently produces no flag.

const COUNTRY_ISO: Record<string, string> = {
  // North Africa
  Algeria: "DZ", Morocco: "MA", Tunisia: "TN", Libya: "LY",
  Egypt: "EG", Sudan: "SD",
  // West Africa
  Mauritania: "MR", Mali: "ML", Senegal: "SN",
  "The Gambia": "GM",           // canonical name in geo.ts
  "Guinea-Bissau": "GW", Guinea: "GN", "Sierra Leone": "SL",
  Liberia: "LR", "Côte d'Ivoire": "CI",
  Ghana: "GH", Togo: "TG", Benin: "BJ", Nigeria: "NG",
  Niger: "NE", "Burkina Faso": "BF", "Cape Verde": "CV",
  // Central Africa
  Chad: "TD", Cameroon: "CM", "Central African Republic": "CF",
  "Equatorial Guinea": "GQ", Gabon: "GA",
  "Congo Republic": "CG",
  "DR Congo": "CD",
  "São Tomé and Príncipe": "ST",
  // East Africa
  Ethiopia: "ET", Eritrea: "ER", Djibouti: "DJ", Somalia: "SO",
  Kenya: "KE", Uganda: "UG", Rwanda: "RW", Burundi: "BI",
  Tanzania: "TZ", "South Sudan": "SS",
  // Southern Africa
  Angola: "AO", Zambia: "ZM", Zimbabwe: "ZW", Malawi: "MW",
  Mozambique: "MZ", Namibia: "NA", Botswana: "BW",
  "South Africa": "ZA", Lesotho: "LS", Eswatini: "SZ",
  // Indian Ocean islands
  Madagascar: "MG", Comoros: "KM", Seychelles: "SC", Mauritius: "MU",
  // Non-sovereign territories (used by TERRITORY_MARKERS hover)
  "Canary Islands": "ES", Madeira: "PT", "Réunion": "RE",
};

/** Returns a flagcdn.com URL for the given ISO 3166-1 alpha-2 code, or null. */
const countryFlagUrl = (name: string): string | null => {
  const iso = COUNTRY_ISO[name];
  return iso ? `https://flagcdn.com/32x24/${iso.toLowerCase()}.png` : null;
};

// ── Colour scale ──────────────────────────────────────────────────────────────

const BUCKETS = [
  { min: 0,          max: 0,        label: "No data", fill: "#c4cdd9", stroke: "#a0adbe" },
  { min: 1,          max: 2,        label: "1 – 2",   fill: "#a3b7f0", stroke: "#7e99e0" },
  { min: 3,          max: 8,        label: "3 – 8",   fill: "#6d8fe6", stroke: "#4d70d6" },
  { min: 9,          max: 20,       label: "9 – 20",  fill: "#3d5dd8", stroke: "#2a46c0" },
  { min: 21, max: Infinity,         label: "21 +",    fill: "#1e36a8", stroke: "#142690" },
];

function getColor(count: number) {
  for (const b of BUCKETS) if (count >= b.min && count <= b.max) return b;
  return BUCKETS[BUCKETS.length - 1];
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface CountryPath { id: string; name: string; region: string; count: number; d: string; }
interface HoveredItem { name: string; region: string; count: number; isTerritory?: boolean; }

// ── Component ─────────────────────────────────────────────────────────────────

export default function AfricaMapPanel({ filters }: { filters?: StudyFilters }) {
  const { data: summaries, loading } = useAsync(
    () => getCountrySummaries(filters),
    [filters],
  );

  const [hovered, setHovered] = useState<HoveredItem | null>(null);

  const { paths, byName, totalCountries, totalStudies } = useMemo(() => {
    const byTopo = new Map<string, { name: string; region: string; count: number }>();
    const byName = new Map<string, { region: string; count: number }>();

    for (const s of summaries ?? []) {
      if (s.topoId) byTopo.set(s.topoId, { name: s.name, region: s.region ?? "", count: s.studyCount });
      byName.set(s.name, { region: s.region ?? "", count: s.studyCount });
    }

    // Western Sahara shares Morocco's study data
    const moroccoCnt = byTopo.get("504")?.count ?? 0;

    const collection = feature(
      countriesTopology as any,
      countriesTopology.objects.countries as any,
    ) as unknown as GeoJSON.FeatureCollection;

    const moroccoInfo = byTopo.get("504");

    // Use topojson merge() to dissolve the shared arc between Morocco (504) and
    // Western Sahara (732) at the topology level: produces a clean single outline
    // with no internal edge, not just two stacked shapes.
    const topo = countriesTopology as any;
    const moroccoWSGeoms = topo.objects.countries.geometries.filter(
      (g: any) => g.id === "504" || g.id === "732",
    );
    const mergedMorocco = merge(topo, moroccoWSGeoms);

    const featureMap = new Map<string, string>();
    for (const f of collection.features) {
      const id = String(f.id).padStart(3, "0");
      featureMap.set(id, renderFeature(f.geometry));
    }
    featureMap.set("504", renderFeature(mergedMorocco));

    const paths: CountryPath[] = collection.features
      .filter(f => {
        const id = String(f.id).padStart(3, "0");
        return AFRICA_IDS.has(id) && id !== "732"; // dissolved into Morocco above
      })
      .map(f => {
        const id   = String(f.id).padStart(3, "0");
        const info = byTopo.get(id);
        const count  = id === "504" ? moroccoCnt : (info?.count ?? 0);
        const name   = info?.name ?? "";
        const region = info?.region ?? "";
        return { id, name, region, count, d: featureMap.get(id) ?? "" };
      });

    const totalCountries = (summaries ?? []).filter(s => s.studyCount > 0).length;
    const totalStudies   = (summaries ?? []).reduce((a, s) => a + s.studyCount, 0);
    return { paths, byName, totalCountries, totalStudies };
  }, [summaries]);

  const hover = (name: string, region: string, count: number, isTerritory?: boolean) =>
    setHovered({ name, region, count, isTerritory });

  return (
    <div className="flex-1 flex overflow-hidden">

      {/* ── SVG MAP ── */}
      <div className="flex-1 flex items-center justify-center bg-[#F7F9FC] p-4 overflow-hidden">
        {loading ? (
          <div className="w-full max-w-lg aspect-square bg-muted/30 rounded-xl animate-pulse" />
        ) : (
          <svg
            viewBox={VIEW_BOX}
            className="w-full h-auto drop-shadow-sm"
            style={{ maxHeight: "calc(100vh - 200px)" }}
          >
            {/* Country polygons.
                Western Sahara (732) is intentionally excluded. Morocco's polygon
                covers the entire region with no internal boundary. */}
            {paths.filter(p => p.id !== "732").map(p => {
              const { fill, stroke } = getColor(p.count);
              const isHov = hovered?.name === p.name;
              return (
                <path
                  key={p.id}
                  d={p.d}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth="0.8"
                  className="transition-all duration-150 cursor-pointer"
                  style={{ opacity: hovered && !isHov ? 0.65 : 1 }}
                  onMouseEnter={() => p.name && hover(p.name, p.region, p.count)}
                  onMouseLeave={() => setHovered(null)}
                />
              );
            })}

            {/* Tiny sovereign island nations + Réunion: circle + pill label + leader line */}
            {ISLAND_MARKERS.map(island => {
              const [cx, cy] = project(island.lon, island.lat);
              const data   = byName.get(island.name);
              const count  = data?.count ?? 0;
              const region = data?.region ?? "";
              const { fill, stroke } = getColor(count);
              const isHov  = hovered?.name === island.name;
              const left   = island.labelSide === "left";
              // leader line endpoint
              const lx0 = left ? cx - 7 : cx + 7;
              const lx1 = left ? cx - 12 : cx + 12;
              // pill label: estimate width = chars * 3.6 + 8 padding
              const chars  = island.short.length;
              const pw     = chars * 3.6 + 10;
              const ph     = 9;
              const prx    = left ? lx1 - pw : lx1;
              const pry    = cy - ph / 2;
              const tx     = left ? lx1 - pw / 2 : lx1 + pw / 2;
              return (
                <g key={island.id} style={{ opacity: hovered && !isHov ? 0.65 : 1 }}>
                  {/* Glow */}
                  <circle cx={cx} cy={cy} r={11} fill={fill} fillOpacity={0.15} stroke="none" style={{ pointerEvents: "none" }} />
                  {/* Main dot */}
                  <circle
                    cx={cx} cy={cy} r={6}
                    fill={fill} stroke={stroke} strokeWidth="1.2"
                    className="cursor-pointer"
                    onMouseEnter={() => hover(island.name, region, count)}
                    onMouseLeave={() => setHovered(null)}
                  />
                  <circle cx={cx} cy={cy} r={1.8} fill={stroke} style={{ pointerEvents: "none" }} />
                  {/* Leader line */}
                  <line x1={lx0} y1={cy} x2={lx1} y2={cy} stroke={stroke} strokeWidth="0.7" style={{ pointerEvents: "none" }} />
                  {/* Pill background */}
                  <rect x={prx} y={pry} width={pw} height={ph} rx={4} fill="white" fillOpacity={0.92} stroke={stroke} strokeWidth="0.5" style={{ pointerEvents: "none" }} />
                  {/* Label text */}
                  <text x={tx} y={cy + 3} textAnchor="middle" fontSize="6" fontWeight="700"
                    fill={stroke} style={{ pointerEvents: "none", userSelect: "none" }}>
                    {island.short}
                  </text>
                </g>
              );
            })}

            {/* Non-sovereign territory markers (Canary Islands, Madeira) */}
            {TERRITORY_MARKERS.map(t => {
              const [cx, cy] = project(t.lon, t.lat);
              const isHov  = hovered?.name === t.name;
              const left   = false;
              const lx0    = left ? cx - 7 : cx + 7;
              const lx1    = left ? cx - 12 : cx + 12;
              const chars  = t.name.length;
              const pw     = chars * 3.6 + 10;
              const ph     = 9;
              const prx    = left ? lx1 - pw : lx1;
              const pry    = cy - ph / 2;
              const tx     = left ? lx1 - pw / 2 : lx1 + pw / 2;
              const fc     = BUCKETS[0].fill;
              const sc     = BUCKETS[0].stroke;
              return (
                <g key={t.id} style={{ opacity: hovered && !isHov ? 0.65 : 1 }}>
                  <circle cx={cx} cy={cy} r={10} fill={fc} fillOpacity={0.15} stroke="none" style={{ pointerEvents: "none" }} />
                  <circle
                    cx={cx} cy={cy} r={6}
                    fill={fc} stroke={sc} strokeWidth="1.2"
                    className="cursor-pointer"
                    onMouseEnter={() => hover(t.name, t.subtitle + " territory", 0, true)}
                    onMouseLeave={() => setHovered(null)}
                  />
                  <circle cx={cx} cy={cy} r={1.8} fill={sc} style={{ pointerEvents: "none" }} />
                  <line x1={lx0} y1={cy} x2={lx1} y2={cy} stroke={sc} strokeWidth="0.7" style={{ pointerEvents: "none" }} />
                  <rect x={prx} y={pry} width={pw} height={ph} rx={4} fill="white" fillOpacity={0.92} stroke={sc} strokeWidth="0.5" style={{ pointerEvents: "none" }} />
                  <text x={tx} y={cy + 3} textAnchor="middle" fontSize="6" fontWeight="700"
                    fill={sc} style={{ pointerEvents: "none", userSelect: "none" }}>
                    {t.name}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="w-56 flex-shrink-0 border-l border-border bg-card flex flex-col overflow-hidden">

        {/* Stats */}
        <div className="px-4 py-4 border-b border-border space-y-2">
          <div className="flex items-center gap-2">
            <MapPin size={13} className="text-primary" />
            <span className="text-xs text-foreground">
              <span className="font-semibold">{totalCountries}</span>
              <span className="text-muted-foreground"> countries</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <BookOpen size={13} className="text-primary" />
            <span className="text-xs text-foreground">
              <span className="font-semibold">{totalStudies}</span>
              <span className="text-muted-foreground"> studies</span>
            </span>
          </div>
        </div>

        {/* Hover info */}
        <div className="flex-1 px-4 py-4 flex flex-col justify-between overflow-hidden">
          {hovered ? (
            <div className="space-y-3">
              {/* Flag + name */}
              <div className="flex items-start gap-2.5">
                {countryFlagUrl(hovered.name) && (
                  <img
                    src={countryFlagUrl(hovered.name)!}
                    alt={hovered.name}
                    width={32} height={24}
                    className="flex-shrink-0 mt-0.5 rounded-sm shadow-sm object-cover"
                  />
                )}
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">
                    {hovered.isTerritory ? "Territory" : "Country"}
                  </div>
                  <div className="text-sm font-semibold text-foreground leading-snug">{hovered.name}</div>
                  {hovered.region && (
                    <div className="text-[11px] text-muted-foreground mt-0.5">{hovered.region}</div>
                  )}
                </div>
              </div>

              {/* Study count */}
              <div>
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  Studies
                </div>
                {hovered.count > 0 ? (
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: getColor(hovered.count).fill }} />
                    <span className="text-sm font-semibold text-foreground">{hovered.count}</span>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {hovered.isTerritory ? "Not tracked separately" : "No studies"}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground italic">
              Hover over a country to see details
            </p>
          )}

          {/* Legend */}
          <div className="mt-auto pt-4 border-t border-border/60">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Studies</div>
            <div className="space-y-1.5">
              {BUCKETS.map(b => (
                <div key={b.label} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm flex-shrink-0 border" style={{ backgroundColor: b.fill, borderColor: b.stroke }} />
                  <span className="text-[10px] text-muted-foreground">{b.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
