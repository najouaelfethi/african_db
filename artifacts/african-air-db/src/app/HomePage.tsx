import React, { useEffect, useState, useMemo } from "react";
import {
  Map as MapIcon,
  Search,
  FlaskConical,
  Mail,
  BarChart3,
  Globe2,
  FileText,
  Database,
  ArrowRight,
  Calendar,
} from "lucide-react";
import type { DatasetStats } from "./types/arcair";
import { useAsync } from "./hooks/useData";
import { getCountrySummaries } from "./services/studyService";
import AnalyticsCharts from "./components/AnalyticsCharts";
import { feature, merge } from "topojson-client";
import countriesTopology from "world-atlas/countries-50m.json";
import um6p_logo from "../assets/um6p-logo-arc-air.png";
import um6p_arc_air_logo from "../assets/um6p-arcair-lockup.png";
import um6p_ccse_logo from "../assets/um6p-ccse-logo.png";
import team_wahid from "../assets/team-wahid.jpg";
import team_leonard from "../assets/team-leonard.jpg";
import team_naaima from "../assets/team-naaima.jpg";

interface HomePageProps {
  stats: DatasetStats | null;
  onGoHome: () => void;
  onExploreMap: () => void;
  onBrowseResearch: () => void;
  onAdmin: () => void;
}

function useCountUp(end: number | undefined, duration: number = 1000) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (end === undefined) return;

    let startTimestamp: number | null = null;
    let animationFrameId: number;

    const isReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
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

export default function HomePage({
  stats,
  onGoHome,
  onExploreMap,
  onBrowseResearch,
  onAdmin,
}: HomePageProps) {
  const yearRange =
    stats?.yearFrom && stats?.yearTo
      ? `${stats.yearFrom}-${stats.yearTo}`
      : "N/A";

  return (
    <div className="flex-1 overflow-y-auto bg-background w-full relative scroll-smooth">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-150 bg-linear-to-b from-primary/5 to-transparent pointer-events-none -z-10" />
      <div className="absolute top-0 right-0 w-1/2 h-full pointer-events-none -z-10 opacity-30 mix-blend-multiply flex items-start justify-end pr-10 pt-20">
        <AfricaMapPreview static />
      </div>

      <div className="max-w-5xl mx-auto px-6 py-16 md:py-20 space-y-24">
        {/* Hero Section */}
        <section className="text-center space-y-6 pt-4 animate-in fade-in duration-700 slide-in-from-bottom-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold tracking-wide mb-2 uppercase">
            Pan-African Air Quality & Climate Data
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground text-balance">
            Every study on Africa&apos;s air, searchable in one place.
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            The African Database brings together data from intensive field
            campaigns, monitoring stations and observatory records, on
            particulate matter and its chemical composition, and atmospheric
            gases across the continent curated by the African Research Center on
            Air Quality and Climate (ARC_Air) at UM6P.
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
            <StatCard
              icon={FileText}
              label="Total Studies"
              value={useCountUp(stats?.studyCount)}
            />
            <StatCard
              icon={Database}
              label="Sampling Records"
              value={useCountUp(stats?.recordCount)}
            />
            <StatCard
              icon={Globe2}
              label="Countries Covered"
              value={useCountUp(stats?.countryCount)}
            />
            <StatCard
              icon={FlaskConical}
              label="Monitored Parameters"
              value={useCountUp(stats?.pollutantCount)}
            />
            <StatCard
              icon={Calendar}
              label="Year Coverage"
              staticValue={yearRange}
            />
          </div>
        </section>

        <AnalyticsCharts />

        {/* About the Database */}
        <section className="space-y-8">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
              About the database
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
              A shared record for atmospheric research in Africa
            </h2>
          </div>

          <p className="text-muted-foreground leading-relaxed text-lg max-w-4xl mx-auto text-center">
            Air quality data on Africa has long been scattered across journals,
            campaign reports and institutional archives. Africa Database
            consolidates that work into one structured, searchable library so a
            study from Nairobi, a monitoring campaign in Casablanca, or an
            observatory record from Cape Town can be found, compared and cited
            in the same place.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <InfoCard
              title="Particulate Matter"
              description="PMₓ, black carbon (BC), organic carbon (OC), metals, water soluble inorganic aerosols (WSIA), organic speciation (PAHs, PCBs, etc.)"
            />
            <InfoCard
              title="Gases"
              description="Main trace gases nitrogen oxides (NOₓ), sulfur dioxide (SO₂), ozone (O₃) and carbon monoxide (CO)."
            />
            <InfoCard
              title="Campaigns"
              description="Time-bound field campaigns and intensive measurement efforts."
            />
            <InfoCard
              title="African Observatories"
              description="Long-term ground stations providing continuous records."
            />
          </div>
        </section>

        {/* Map Preview */}
        <section className="bg-card border border-border rounded-2xl p-8 shadow-sm flex flex-col md:flex-row items-center gap-10">
          <div className="w-full md:w-1/2 max-w-sm">
            <AfricaMapPreview />
          </div>
          <div className="w-full md:w-1/2 space-y-5">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
              Browse it on the map
            </p>
            <h2 className="text-3xl font-semibold tracking-tight">
              Explore research across Africa
            </h2>
            <p className="text-muted-foreground leading-relaxed text-lg">
              The Data Explorer shows coverage by country and city, highlights
              where the evidence is strongest, and lets you drill down into the
              studies behind each location.
            </p>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-primary" />{" "}
                Advanced filtering by year, citation count, region, country, and
                pollutant.
              </li>
              <li className="flex gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-primary" />{" "}
                Interactive country and city coverage maps for fast exploration.
              </li>
              <li className="flex gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-primary" />{" "}
                Study-level detail on authors, locations, methodology, and
                design.
              </li>
              <li className="flex gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-primary" /> Save
                or export curated results for your own work.
              </li>
            </ul>
            <button
              onClick={onExploreMap}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              Open Interactive Map <ArrowRight size={16} />
            </button>
          </div>
        </section>

        {/* ARC_Air Section */}
        <section className="space-y-8">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
              The lab behind the database
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
              ARC_Air - African Research Center on Air Quality and Climate
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_0.7fr] gap-6 items-start">
            <div className="space-y-5">
              <p className="text-muted-foreground leading-relaxed text-lg">
                Africa Database is built and maintained by ARC_Air, a research
                center within the College of Chemical Sciences and Engineering
                at Mohammed VI Polytechnic University (UM6P), in Benguerir,
                Morocco.
              </p>
              <p className="text-muted-foreground leading-relaxed text-lg">
                ARC_Air works to advance the scientific understanding of air
                quality, atmospheric chemistry and climate across Africa
                combining ground measurements, field campaigns and modelling to
                fill long-standing data gaps on the continent. Alongside its
                research programme, the center runs training initiatives for
                early-career African scientists on atmospheric observation, air
                quality modelling and forecasting.
              </p>
              <p className="text-muted-foreground leading-relaxed text-lg">
                This database is one part of that mission: turning fragmented,
                hard-to-find measurements into a shared, searchable resource for
                researchers, policymakers and students working on African air
                quality.
              </p>
            </div>
            {/*
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Hosted at
              </p>
              <div className="space-y-2">
                <p className="text-lg font-semibold">UM6P</p>
                <p className="text-sm text-muted-foreground">
                  Benguerir, Morocco
                </p>
                <p className="text-sm text-muted-foreground">
                  College of Chemical Sciences &amp; Engineering
                </p>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Atmospheric Chemistry</li>
                <li>• Air Quality Monitoring</li>
                <li>• Climate Research</li>
                <li>• Capacity Building</li>
              </ul>
            </div> 
            */}
            <div className="bg-card border border-border rounded-2xl p-7 shadow-sm min-h-80">
              <div className="flex items-center gap-3 mb-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Hosted at
                </p>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl p-4 flex items-center justify-center min-h-22">
                  <img
                    src={um6p_logo}
                    alt="UM6P"
                    className="max-h-14 w-auto object-contain"
                  />
                </div>

                <div className="rounded-xl p-4">
                  <div className="flex items-center justify-between gap-4">
                    <img
                      src={um6p_ccse_logo}
                      alt="College of Chemical Sciences & Engineering"
                      className="max-h-12 w-auto object-contain"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Team Section */}
        <section className="space-y-8">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
              The Team
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
              The people building the African Database
            </h2>
          </div>
          <p className="text-muted-foreground leading-relaxed text-lg max-w-4xl mx-auto text-center">
            A team within ARC_Air maintains the database, its data pipeline and
            this site.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <TeamCard
              name="Wahid Mellouki"
              role="Head of ARC_Air • Full Professor, UM6P"
              image={team_wahid}
            />
            <TeamCard
              name="Leonard Kirago"
              role="Postdoctoral Researcher"
              image={team_leonard}
            />
            <TeamCard
              name="Pauline Pouyes"
              role="Postdoctoral Researcher"
              image=""
            />
            <TeamCard
              name="Naaima Ben Kadour"
              role="Data Scientist"
              image={team_naaima}
            />
            <TeamCard name="Najoua ElFethi" role="Data Scientist" image="" />
            <TeamCard
              name="Mohamed El Aouan"
              role="Research Assistant"
              image=""
            />
          </div>

          <div className="text-center space-y-2 pt-2">
            <p className="text-muted-foreground">
              Questions about the database? Write to{" "}
              <a
                href="mailto:africanairdatabase@um6p.ma"
                className="text-primary hover:underline font-medium"
              >
                africanairdatabase@um6p.ma
              </a>
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-primary/5 border border-primary/10 rounded-2xl p-8 shadow-sm">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                Ready to explore the data?
              </p>
              <h3 className="text-2xl font-semibold tracking-tight">
                Open the interactive Data Explorer to browse studies by country,
                city, pollutant and year across Africa.
              </h3>
            </div>
            <button
              onClick={onBrowseResearch}
              className="bg-primary text-primary-foreground px-6 py-3.5 rounded-lg font-semibold hover:bg-primary/90 transition-all flex items-center gap-2 shadow-md hover:shadow-lg active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              Open the Data Explorer <ArrowRight size={18} />
            </button>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="border-t border-border bg-card mt-12">
        <div className="max-w-5xl mx-auto px-6 pt-10 pb-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-5">
            <div className="flex items-center justify-center gap-6 md:gap-8 flex-wrap">
              <img
                src={um6p_arc_air_logo}
                alt="UM6P"
                className="h-14 md:h-16 w-auto object-contain"
              />
              <div className="hidden md:block h-12 w-px bg-border" />
              <img
                src={um6p_ccse_logo}
                alt="College of Chemical Sciences & Engineering"
                className="h-14 md:h-16 w-auto object-contain"
              />
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-3 gap-10 text-center md:text-left">
          <div className="space-y-3">
            <h3 className="font-semibold text-foreground text-lg tracking-tight">
              Africa Database
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
              A curated, searchable database of air quality and climate research
              across Africa, built and maintained by ARC_Air at Mohammed VI
              Polytechnic University (UM6P), Benguerir, Morocco.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-foreground">Site</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <button
                  type="button"
                  onClick={onGoHome}
                  className="hover:text-primary transition-colors"
                >
                  Home
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onExploreMap}
                  className="hover:text-primary transition-colors"
                >
                  Explore Map
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onBrowseResearch}
                  className="hover:text-primary transition-colors"
                >
                  Research
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onAdmin}
                  className="hover:text-primary transition-colors"
                >
                  Admin
                </button>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-foreground">ARC_Air</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              UM6P, Benguerir, Morocco
              <br />
              College of Chemical Sciences &amp; Engineering
            </p>
            <a
              href="mailto:africanairdatabase@um6p.ma"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mt-2 font-medium"
            >
              <Mail size={14} /> africanairdatabase@um6p.ma
            </a>
          </div>
        </div>

        <div className="border-t border-border">
          <div className="max-w-5xl mx-auto px-6 py-5 text-center md:flex md:items-center md:justify-between md:text-left gap-4 text-sm text-muted-foreground">
            <span>
              © 2026 Africa Database • ARC_Air, UM6P. All rights reserved.
            </span>
            <span>Built for open air quality research in Africa.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function InfoCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col gap-3 h-full">
      <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
        <FlaskConical size={18} />
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  );
}

function createTeamPlaceholder(name: string) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const palette = [
    ["#1F7A8C", "#E0FBFC"],
    ["#3B82F6", "#DBEAFE"],
    ["#10B981", "#D1FAE5"],
    ["#F59E0B", "#FEF3C7"],
    ["#8B5CF6", "#EDE9FE"],
    ["#EF4444", "#FEE2E2"],
  ];

  const [start, end] = palette[Math.abs(name.length) % palette.length];

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120" role="img" aria-label="${name}">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${start}"/>
          <stop offset="100%" stop-color="${end}"/>
        </linearGradient>
      </defs>
      <rect width="120" height="120" rx="60" fill="url(#g)"/>
      <circle cx="60" cy="46" r="18" fill="rgba(255,255,255,0.24)"/>
      <path d="M28 92c5-15 18-22 32-22s27 7 32 22" fill="rgba(255,255,255,0.24)"/>
      <text x="60" y="68" text-anchor="middle" font-size="28" font-weight="700" font-family="Arial, sans-serif" fill="white">${initials}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function TeamCard({
  name,
  role,
  image,
}: {
  name: string;
  role: string;
  image?: string;
}) {
  const avatar = image || createTeamPlaceholder(name);

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col gap-3">
      <img
        src={avatar}
        alt={name}
        onError={(event) => {
          event.currentTarget.src = createTeamPlaceholder(name);
        }}
        className="h-24 w-24 rounded-full object-cover border border-border shadow-sm"
      />
      <h3 className="text-lg font-semibold text-foreground">{name}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{role}</p>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  staticValue,
}: {
  icon: any;
  label: string;
  value?: number;
  staticValue?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 text-center shadow-sm flex flex-col items-center gap-2.5 transition-all hover:border-primary/20 hover:shadow-md">
      <div className="text-primary/80 bg-primary/5 p-2.5 rounded-full">
        <Icon size={22} strokeWidth={1.75} />
      </div>
      <div
        className="text-3xl font-semibold text-foreground mt-1"
        style={{ fontFamily: "'DM Mono', monospace" }}
      >
        {staticValue !== undefined
          ? staticValue
          : value !== undefined
            ? value.toLocaleString()
            : "-"}
      </div>
      <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest text-balance leading-tight">
        {label}
      </div>
    </div>
  );
}

function QuickAccessCard({
  icon: Icon,
  title,
  description,
  onClick,
  disabled,
}: {
  icon: any;
  title: string;
  description: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      type="button"
      disabled={disabled}
      aria-disabled={disabled}
      className={`group relative text-left bg-card border border-border rounded-xl p-6 flex items-start gap-4 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
        ${disabled ? "opacity-60 cursor-not-allowed" : "hover:border-primary/40 hover:shadow-md cursor-pointer"}
      `}
    >
      <div
        className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-colors
        ${disabled ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground"}
      `}
      >
        <Icon size={24} />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
            {title}
          </h3>
          {disabled && (
            <span className="text-[10px] bg-muted-foreground/10 text-muted-foreground font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">
              Coming Soon
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          {description}
        </p>
      </div>
    </button>
  );
}

const AFRICA_COUNTRY_IDS = new Set([
  "012",
  "024",
  "204",
  "072",
  "854",
  "108",
  "120",
  "132",
  "140",
  "148",
  "174",
  "178",
  "180",
  "384",
  "262",
  "818",
  "226",
  "232",
  "748",
  "231",
  "266",
  "270",
  "288",
  "324",
  "624",
  "404",
  "426",
  "430",
  "434",
  "450",
  "454",
  "466",
  "478",
  "480",
  "504",
  "508",
  "516",
  "562",
  "566",
  "646",
  "678",
  "686",
  "690",
  "694",
  "706",
  "710",
  "728",
  "729",
  "732",
  "834",
  "768",
  "788",
  "800",
  "894",
  "716",
]);

// Extended viewBox: shifts left so Cape Verde (x≈3) is visible, extends right
// so Mauritius (x≈334) fits.
const VIEW_BOX = "-14 -6 382 334";

// Non-sovereign territories shown as circle markers
const TERRITORY_MARKERS = [
  { id: "canary-islands", lon: -15.5, lat: 28.1 },
  { id: "madeira", lon: -16.9, lat: 32.7 },
];

// Tiny sovereign island nations: polygons < 2px at 50m scale, shown as circles
const ISLAND_MARKERS = [
  { id: "132", lon: -23.5, lat: 16.5 }, // Cape Verde
  { id: "678", lon: 6.6, lat: 0.2 }, // São Tomé and Príncipe
  { id: "174", lon: 43.3, lat: -11.6 }, // Comoros
  { id: "690", lon: 55.5, lat: -4.7 }, // Seychelles
  { id: "480", lon: 57.5, lat: -20.2 }, // Mauritius
  { id: "reunion-marker", lon: 55.5, lat: -21.8 }, // Réunion (territory, shifted south)
];

const project = (lon: number, lat: number) => {
  const x = (lon + 26) * 4;
  const y = (40 - lat) * 4;
  return [x, y];
};

function renderFeature(geom: GeoJSON.Geometry): string {
  if (geom.type === "Polygon") {
    return geom.coordinates
      .map(
        (ring) =>
          "M" +
          ring.map((coord) => project(coord[0], coord[1]).join(",")).join("L") +
          "Z",
      )
      .join(" ");
  }
  if (geom.type === "MultiPolygon") {
    return geom.coordinates
      .map((poly) =>
        poly
          .map(
            (ring) =>
              "M" +
              ring
                .map((coord) => project(coord[0], coord[1]).join(","))
                .join("L") +
              "Z",
          )
          .join(" "),
      )
      .join(" ");
  }
  return "";
}

function AfricaMapPreview({
  static: isStaticBackground,
}: {
  static?: boolean;
}) {
  const { data: countriesData } = useAsync(() => getCountrySummaries());
  const hasStudies = useMemo(
    () =>
      new Set(
        countriesData
          ?.filter((c) => c.studyCount > 0)
          .map((c) => c.topoId)
          .filter(Boolean),
      ),
    [countriesData],
  );

  const paths = useMemo(() => {
    const collection = feature(
      countriesTopology as any,
      countriesTopology.objects.countries as any,
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
      .filter((f) => {
        const id = String(f.id).padStart(3, "0");
        return AFRICA_COUNTRY_IDS.has(id) && id !== "732";
      })
      .map((f) => {
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
      <svg
        viewBox={VIEW_BOX}
        className="w-full h-auto max-w-150 opacity-10"
      >
        {paths.map((p) => (
          <path
            key={p.id}
            d={p.d}
            className="fill-primary/20 stroke-primary/30"
            strokeWidth="0.8"
          />
        ))}
        {[...TERRITORY_MARKERS, ...ISLAND_MARKERS].map((t) => {
          const [cx, cy] = project(t.lon, t.lat);
          return (
            <circle
              key={t.id}
              cx={cx}
              cy={cy}
              r={4.5}
              className="fill-primary/20 stroke-primary/30"
              strokeWidth="0.8"
            />
          );
        })}
      </svg>
    );
  }

  return (
    <svg
      viewBox={VIEW_BOX}
      className="w-full h-auto max-w-100 drop-shadow-sm mx-auto"
    >
      {paths.map((p) => (
        <path
          key={p.id}
          d={p.d}
          className={`transition-colors duration-1000 ${p.active ? "fill-primary/30 stroke-primary/60" : "fill-muted stroke-border"}`}
          strokeWidth="0.8"
        />
      ))}
      {/* Non-sovereign territory markers */}
      {TERRITORY_MARKERS.map((t) => {
        const [cx, cy] = project(t.lon, t.lat);
        return (
          <g key={t.id}>
            <circle
              cx={cx}
              cy={cy}
              r={4.5}
              className="fill-muted stroke-border"
              strokeWidth="0.8"
            />
            <circle
              cx={cx}
              cy={cy}
              r={1.4}
              className="fill-border"
              style={{ pointerEvents: "none" }}
            />
          </g>
        );
      })}
      {/* Tiny sovereign island nation markers */}
      {ISLAND_MARKERS.map((island) => {
        const [cx, cy] = project(island.lon, island.lat);
        const active = hasStudies.has(island.id);
        return (
          <g key={island.id}>
            <circle
              cx={cx}
              cy={cy}
              r={5}
              className={
                active
                  ? "fill-primary/30 stroke-primary/60"
                  : "fill-muted stroke-border"
              }
              strokeWidth="0.8"
            />
            <circle
              cx={cx}
              cy={cy}
              r={1.6}
              className={active ? "fill-primary/60" : "fill-border"}
              style={{ pointerEvents: "none" }}
            />
          </g>
        );
      })}
    </svg>
  );
}
