import React, { useEffect, useState, useMemo } from 'react';
import { 
  Map as MapIcon, Search, FlaskConical, Mail, 
  BarChart3, Globe2, FileText, Database, ArrowRight, Calendar
} from 'lucide-react';
import type { DatasetStats } from './types/arcair';
import { useAsync } from './hooks/useData';
import { getCountrySummaries } from './services/studyService';
import { feature, merge } from "topojson-client";
import countriesTopology from "world-atlas/countries-50m.json";

interface HomePageProps {
  stats: DatasetStats | null;
  onExploreMap: () => void;
  onBrowseResearch: () => void;
}

function useCountUp(end: number | undefined, duration: number = 1000) {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    if (end === undefined) return;
    
    let startTimestamp: number | null = null;
    let animationFrameId: number;
    
    const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isReducedMotion || end === 0) {
      setCount(end);
      return;
    }

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      
      const easeProgress = 1 - Math.pow(1 - progress, 3); // cubic ease-out
      setCount(Math.floor(easeProgress * end));
      
      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(step);
      } else {
        setCount(end);
      }
    };
    
    animationFrameId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(animationFrameId);
  }, [end, duration]);
  
  return count;
}

export default function HomePage({ stats, onExploreMap, onBrowseResearch }: HomePageProps) {
  const yearRange = stats?.yearFrom && stats?.yearTo ? `${stats.yearFrom}-${stats.yearTo}` : "N/A";

  return (
    <div className="flex-1 overflow-y-auto bg-background w-full relative scroll-smooth">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-b from-primary/5 to-transparent pointer-events-none -z-10" />
      <div className="absolute top-0 right-0 w-1/2 h-full pointer-events-none -z-10 opacity-30 mix-blend-multiply flex items-start justify-end pr-10 pt-20">
        <AfricaMapPreview static />
      </div>

      <div className="max-w-5xl mx-auto px-6 py-16 md:py-20 space-y-24">
        
        {/* Hero Section */}
        <section className="text-center space-y-6 pt-4 animate-in fade-in duration-700 slide-in-from-bottom-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold tracking-wide mb-2 uppercase">
            African Research Center on Air Quality and Climate
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground text-balance">
            African Air Database
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Consolidating, visualizing, and sharing air pollution research across the African continent. Empowering researchers and policymakers with accessible environmental data.
          </p>
          <div className="flex items-center justify-center gap-4 pt-4">
            <button 
              onClick={onExploreMap}
              className="bg-primary text-primary-foreground px-6 py-3.5 rounded-lg font-semibold hover:bg-primary/90 transition-all flex items-center gap-2 shadow-md hover:shadow-lg active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <MapIcon size={18} />
              Explore Map
            </button>
            <button 
              onClick={onBrowseResearch}
              className="bg-card text-foreground border border-border px-6 py-3.5 rounded-lg font-semibold hover:bg-muted/50 transition-all flex items-center gap-2 shadow-sm active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <Search size={18} />
              Browse Research
            </button>
          </div>
        </section>

        {/* Statistics Section */}
        <section className="animate-in fade-in duration-700 delay-150 slide-in-from-bottom-4 fill-mode-both">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard icon={FileText} label="Total Studies" value={useCountUp(stats?.studyCount)} />
            <StatCard icon={Database} label="Sampling Records" value={useCountUp(stats?.recordCount)} />
            <StatCard icon={Globe2} label="Countries Covered" value={useCountUp(stats?.countryCount)} />
            <StatCard icon={FlaskConical} label="Monitored Parameters" value={useCountUp(stats?.pollutantCount)} />
            <StatCard icon={Calendar} label="Year Coverage" staticValue={yearRange} />
          </div>
        </section>

        {/* Quick Access */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold tracking-tight">Quick Access</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <QuickAccessCard 
              icon={MapIcon} title="Explore Map" 
              description="Visualize the geographical distribution of air quality studies and monitoring stations."
              onClick={onExploreMap}
            />
            <QuickAccessCard 
              icon={Search} title="Advanced Search" 
              description="Filter the database by specific pollutants, settings, regions, and publication years."
              onClick={onBrowseResearch}
            />
            <QuickAccessCard 
              icon={FlaskConical} title="Pollutants & Parameters" 
              description="Browse measured aerosol components, trace gases, and heavy metals."
              onClick={onExploreMap}
            />
          </div>
        </section>

        {/* Map Preview */}
        <section className="bg-card border border-border rounded-2xl p-8 shadow-sm flex flex-col md:flex-row items-center gap-10">
          <div className="w-full md:w-1/2 max-w-sm">
            <AfricaMapPreview />
          </div>
          <div className="w-full md:w-1/2 space-y-5">
            <h2 className="text-3xl font-semibold tracking-tight">Explore Research Across Africa</h2>
            <p className="text-muted-foreground leading-relaxed text-lg">
              Discover air quality studies geographically. The interactive map provides a macroscopic view of study density and allows you to drill down into specific country and city-level data.
            </p>
            <button 
              onClick={onExploreMap}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              Open Interactive Map <ArrowRight size={16} />
            </button>
          </div>
        </section>

      </div>

      {/* Footer */}
      <footer className="border-t border-border bg-card mt-12">
        <div className="max-w-5xl mx-auto px-6 py-12 flex flex-col md:flex-row justify-between items-center gap-6 text-center md:text-left">
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground text-lg tracking-tight">African Air Database</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              A project by the African Research Center on Air Quality and Climate (UM6P).
            </p>
            <a 
              href="mailto:africanairdatabase@um6p.ma" 
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mt-2 font-medium"
            >
              <Mail size={14} /> africanairdatabase@um6p.ma
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, staticValue }: { icon: any, label: string, value?: number, staticValue?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 text-center shadow-sm flex flex-col items-center gap-2.5 transition-all hover:border-primary/20 hover:shadow-md">
      <div className="text-primary/80 bg-primary/5 p-2.5 rounded-full">
        <Icon size={22} strokeWidth={1.75} />
      </div>
      <div className="text-3xl font-semibold text-foreground mt-1" style={{ fontFamily: "'DM Mono', monospace" }}>
        {staticValue !== undefined ? staticValue : (value !== undefined ? value.toLocaleString() : "-")}
      </div>
      <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest text-balance leading-tight">
        {label}
      </div>
    </div>
  );
}

function QuickAccessCard({ icon: Icon, title, description, onClick, disabled }: { icon: any, title: string, description: string, onClick?: () => void, disabled?: boolean }) {
  return (
    <button 
      onClick={disabled ? undefined : onClick}
      type="button"
      disabled={disabled}
      aria-disabled={disabled}
      className={`group relative text-left bg-card border border-border rounded-xl p-6 flex items-start gap-4 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
        ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-primary/40 hover:shadow-md cursor-pointer'}
      `}
    >
      <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-colors
        ${disabled ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground'}
      `}>
        <Icon size={24} />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">{title}</h3>
          {disabled && <span className="text-[10px] bg-muted-foreground/10 text-muted-foreground font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">Coming Soon</span>}
        </div>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          {description}
        </p>
      </div>
    </button>
  );
}


const AFRICA_COUNTRY_IDS = new Set([
  "012","024","204","072","854","108","120","132","140","148","174","178","180",
  "384","262","818","226","232","748","231","266","270","288","324","624","404",
  "426","430","434","450","454","466","478","480","504","508","516","562","566",
  "646","678","686","690","694","706","710","728","729","732","834","768","788",
  "800","894","716",
]);

// Extended viewBox: shifts left so Cape Verde (x≈3) is visible, extends right
// so Mauritius (x≈334) fits.
const VIEW_BOX = "-14 -6 382 334";

// Non-sovereign territories shown as circle markers
const TERRITORY_MARKERS = [
  { id: "canary-islands", lon: -15.5, lat:  28.1 },
  { id: "madeira",        lon: -16.9, lat:  32.7 },
];

// Tiny sovereign island nations: polygons < 2px at 50m scale, shown as circles
const ISLAND_MARKERS = [
  { id: "132",            lon: -23.5, lat:  16.5 }, // Cape Verde
  { id: "678",            lon:   6.6, lat:   0.2 }, // São Tomé and Príncipe
  { id: "174",            lon:  43.3, lat: -11.6 }, // Comoros
  { id: "690",            lon:  55.5, lat:  -4.7 }, // Seychelles
  { id: "480",            lon:  57.5, lat: -20.2 }, // Mauritius
  { id: "reunion-marker", lon:  55.5, lat: -21.8 }, // Réunion (territory, shifted south)
];

const project = (lon: number, lat: number) => {
  const x = (lon + 26) * 4;
  const y = (40 - lat) * 4;
  return [x, y];
};

function renderFeature(geom: GeoJSON.Geometry): string {
  if (geom.type === "Polygon") {
    return geom.coordinates.map(ring => 
      "M" + ring.map(coord => project(coord[0], coord[1]).join(",")).join("L") + "Z"
    ).join(" ");
  }
  if (geom.type === "MultiPolygon") {
    return geom.coordinates.map(poly => 
      poly.map(ring => 
        "M" + ring.map(coord => project(coord[0], coord[1]).join(",")).join("L") + "Z"
      ).join(" ")
    ).join(" ");
  }
  return "";
}

function AfricaMapPreview({ static: isStaticBackground }: { static?: boolean }) {
  const { data: countriesData } = useAsync(() => getCountrySummaries());
  const hasStudies = useMemo(() => new Set(countriesData?.filter(c => c.studyCount > 0).map(c => c.topoId).filter(Boolean)), [countriesData]);

  const paths = useMemo(() => {
    const collection = feature(
      countriesTopology as any,
      countriesTopology.objects.countries as any
    ) as unknown as GeoJSON.FeatureCollection;

    // Dissolve the shared arc between Morocco (504) and Western Sahara (732)
    // using topojson merge(): produces a single clean outline with no internal edge.
    const topo = countriesTopology as any;
    const moroccoWSGeoms = topo.objects.countries.geometries.filter(
      (g: any) => g.id === "504" || g.id === "732",
    );
    const mergedMorocco = merge(topo, moroccoWSGeoms);

    const dMap = new Map<string, string>();
    for (const f of collection.features) {
      const id = String(f.id).padStart(3, "0");
      dMap.set(id, renderFeature(f.geometry));
    }
    dMap.set("504", renderFeature(mergedMorocco));

    return collection.features
      .filter(f => {
        const id = String(f.id).padStart(3, "0");
        return AFRICA_COUNTRY_IDS.has(id) && id !== "732";
      })
      .map(f => {
        const id = String(f.id).padStart(3, "0");
        return {
          id,
          d: dMap.get(id) ?? "",
          active: hasStudies.has(id),
        };
      });
  }, [hasStudies]);

  if (isStaticBackground) {
    return (
      <svg viewBox={VIEW_BOX} className="w-full h-auto max-w-[600px] opacity-10">
        {paths.map(p => (
          <path key={p.id} d={p.d} className="fill-primary/20 stroke-primary/30" strokeWidth="0.8" />
        ))}
        {[...TERRITORY_MARKERS, ...ISLAND_MARKERS].map(t => {
          const [cx, cy] = project(t.lon, t.lat);
          return <circle key={t.id} cx={cx} cy={cy} r={4.5} className="fill-primary/20 stroke-primary/30" strokeWidth="0.8" />;
        })}
      </svg>
    );
  }

  return (
    <svg viewBox={VIEW_BOX} className="w-full h-auto max-w-[400px] drop-shadow-sm mx-auto">
      {paths.map(p => (
        <path
          key={p.id}
          d={p.d}
          className={`transition-colors duration-1000 ${p.active ? 'fill-primary/30 stroke-primary/60' : 'fill-muted stroke-border'}`}
          strokeWidth="0.8"
        />
      ))}
      {/* Non-sovereign territory markers */}
      {TERRITORY_MARKERS.map(t => {
        const [cx, cy] = project(t.lon, t.lat);
        return (
          <g key={t.id}>
            <circle cx={cx} cy={cy} r={4.5} className="fill-muted stroke-border" strokeWidth="0.8" />
            <circle cx={cx} cy={cy} r={1.4} className="fill-border" style={{ pointerEvents: "none" }} />
          </g>
        );
      })}
      {/* Tiny sovereign island nation markers */}
      {ISLAND_MARKERS.map(island => {
        const [cx, cy] = project(island.lon, island.lat);
        const active = hasStudies.has(island.id);
        return (
          <g key={island.id}>
            <circle
              cx={cx} cy={cy} r={5}
              className={active ? "fill-primary/30 stroke-primary/60" : "fill-muted stroke-border"}
              strokeWidth="0.8"
            />
            <circle cx={cx} cy={cy} r={1.6} className={active ? "fill-primary/60" : "fill-border"} style={{ pointerEvents: "none" }} />
          </g>
        );
      })}
    </svg>
  );
}
