import { useState, useCallback, useMemo, useEffect } from "react";
import {
  Search, X, ChevronDown, ChevronUp, ChevronRight, SlidersHorizontal,
  RotateCcw, Download, BookOpen, CalendarRange, Users,
  MapPin, FlaskConical, Microscope, ArrowUpDown,
  Filter,
} from "lucide-react";
import { useAsync } from "./hooks/useData";
import { Chem, chemToHtml, unitToHtml } from "./utils/chemFormat";
import { queryStudies, getPollutantsByCategory, getCountrySummaries, getPublicationYearRange } from "./services/studyService";
import type { Study, StudyFilters, StudyQuery, PagedResult } from "./types/arcair";

// ── TYPES ─────────────────────────────────────────────────────────────────────

interface YearRange {
  min: number;
  max: number;
}

const DEFAULT_PUBLICATION_YEAR_RANGE: YearRange = { min: 1991, max: 2025 };

interface Filters {
  query: string;
  countries: Set<string>;
  pollutants: Set<string>;
  publicationYearFrom: number;
  publicationYearTo: number;
}

function emptyFilters(yearRange: YearRange = DEFAULT_PUBLICATION_YEAR_RANGE): Filters {
  return {
    query: "",
    countries: new Set(),
    pollutants: new Set(),
    publicationYearFrom: yearRange.min,
    publicationYearTo: yearRange.max,
  };
}

// ── SMALL COMPONENTS ──────────────────────────────────────────────────────────

function Tag({ label, htmlLabel, onRemove }: { label: string; htmlLabel?: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-[11px] font-medium rounded px-2 py-0.5">
      {htmlLabel
        ? <span dangerouslySetInnerHTML={{ __html: htmlLabel }} />
        : label}
      <button onClick={onRemove} className="hover:text-primary/60 transition-colors"><X size={9} /></button>
    </span>
  );
}

function RangeInput({
  label, min, max, valueMin, valueMax, step = 1,
  onChangeMin, onChangeMax,
}: {
  label: string; min: number; max: number; valueMin: number; valueMax: number;
  step?: number; onChangeMin: (v: number) => void; onChangeMax: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
        <span className="text-[11px] text-primary font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>
          {valueMin} – {valueMax}
        </span>
      </div>
      <div className="flex gap-2">
        <input type="range" min={min} max={max} step={step} value={valueMin}
          onChange={e => onChangeMin(Number(e.target.value))}
          className="flex-1 h-1 accent-primary cursor-pointer" />
        <input type="range" min={min} max={max} step={step} value={valueMax}
          onChange={e => onChangeMax(Number(e.target.value))}
          className="flex-1 h-1 accent-primary cursor-pointer" />
      </div>
    </div>
  );
}

// ── POLLUTANT SECTION (grouped) ───────────────────────────────────────────────

function PollutantGroup({
  selected, onToggle, collapsed, onCollapse, pollutantCategories
}: {
  selected: Set<string>; onToggle: (v: string) => void; collapsed: boolean; onCollapse: () => void; pollutantCategories: { category: string; pollutants: { key: string, name: string, unit?: string }[] }[];
}) {
  const [groupOpen, setGroupOpen] = useState<Set<string>>(new Set(["Bulk PM"]));
  const toggle = (g: string) => setGroupOpen(prev => { const n = new Set(prev); n.has(g) ? n.delete(g) : n.add(g); return n; });

  return (
    <div className="border-b border-border/60">
      <button onClick={onCollapse} className="flex items-center justify-between w-full px-4 py-3 hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-2">
          <FlaskConical size={13} className="text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground">Pollutants</span>
          {selected.size > 0 && (
            <span className="bg-primary text-primary-foreground rounded-full text-[9px] w-4 h-4 flex items-center justify-center font-bold">
              {selected.size}
            </span>
          )}
        </div>
        {collapsed ? <ChevronDown size={13} className="text-muted-foreground" /> : <ChevronUp size={13} className="text-muted-foreground" />}
      </button>

      {!collapsed && (
        <div className="pb-2">
          {pollutantCategories.map(({ category: group, pollutants: items }) => {
            const typicalUnit = items.find(p => p.unit)?.unit ?? "";
            return (
            <div key={group}>
              <button
                onClick={() => toggle(group)}
                className="flex items-center gap-2 w-full px-4 py-1.5 hover:bg-muted/20"
              >
                {groupOpen.has(group) ? <ChevronDown size={10} className="text-muted-foreground" /> : <ChevronRight size={10} className="text-muted-foreground" />}
                <span className="text-[11px] font-medium text-muted-foreground truncate flex items-baseline gap-0.5" title={group}>
                  {group}
                  {typicalUnit && (
                    <span
                      className="text-[9px] font-normal opacity-60"
                      dangerouslySetInnerHTML={{ __html: `(${unitToHtml(typicalUnit)})` }}
                    />
                  )}
                </span>
              </button>
              {groupOpen.has(group) && (
                <div className="pl-8 pr-4 pb-1 grid grid-cols-2 gap-x-2 gap-y-0.5">
                  {items.map(item => (
                    <label key={item.key} className="flex items-center gap-1.5 py-0.5 cursor-pointer group">
                      <input type="checkbox" checked={selected.has(item.key)} onChange={() => onToggle(item.key)} className="accent-primary w-3 h-3" />
                      <span className="text-[10px] text-foreground/70 group-hover:text-foreground transition-colors truncate" title={item.name}><Chem name={item.name} /></span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
          })}
        </div>
      )}
    </div>
  );
}

// ── RESULT CARD ───────────────────────────────────────────────────────────────

function ResultCard({ study, index, pollutantDict, onOpen }: { study: Study; index: number; pollutantDict: Map<string, string>; onOpen?: (id: string) => void }) {
  const [saved, setSaved] = useState(false);

  const displayTitle = study.title || study.source || "Untitled Study";
  const authorDisplay = study.author || study.source;
  const pKeys = new Set(study.records.flatMap(r => Object.keys(r.measurements)));
  const pNames = Array.from(pKeys).slice(0, 5).map(k => pollutantDict.get(k) || k);

  return (
    <div
      className="group bg-card border border-border rounded-lg p-4 hover:border-primary/30 hover:shadow-sm transition-all duration-200 cursor-pointer"
      style={{ animationDelay: `${index * 40}ms` }}
      onClick={() => onOpen?.(study.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen?.(study.id);
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground leading-snug mb-1 group-hover:text-primary transition-colors">
            {displayTitle}
          </h3>
          <p className="text-[11px] text-muted-foreground mb-2">
            {authorDisplay} · <span className="text-primary font-medium">Published {study.publicationYear ?? "year unavailable"}</span>
          </p>

          <div className="flex flex-wrap gap-1.5 mb-2">
            <span className="inline-flex items-center gap-1 text-[10px] bg-muted rounded px-1.5 py-0.5 text-muted-foreground">
              <MapPin size={8} /> {study.country}
            </span>
          </div>

          <div className="flex flex-wrap gap-1">
            {pNames.map(p => (
              <span key={p} className="text-[10px] bg-primary/8 text-primary rounded px-1.5 py-0.5 font-medium">
                <Chem name={p} />
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); setSaved(s => !s); }}
            className={`text-[10px] px-2 py-1 rounded border transition-colors ${saved ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary hover:text-primary"}`}
          >
            {saved ? "Saved ✓" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

export default function SearchPage({ onOpenStudy }: { onOpenStudy?: (id: string) => void } = {}) {
  const [filters, setFilters] = useState<Filters>(emptyFilters());
  const [sortBy, setSortBy] = useState<"yearDesc" | "yearAsc" | "relevance" | "titleAsc" | "countryAsc">("relevance");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    geo: false, pollutants: false, range: false,
  });

  const { data: categoriesData } = useAsync(getPollutantsByCategory);
  const { data: countriesData } = useAsync(getCountrySummaries);
  const {
    data: publicationYearRange,
    error: publicationYearRangeError,
  } = useAsync(getPublicationYearRange);

  useEffect(() => {
    if (!publicationYearRange) return;
    setFilters(prev => ({
      ...prev,
      publicationYearFrom: publicationYearRange.min,
      publicationYearTo: publicationYearRange.max,
    }));
  }, [publicationYearRange]);

  const activeQueryFilters = useMemo<StudyFilters>(() => {
    const f: StudyFilters = {};
    if (filters.query) f.query = filters.query;
    if (filters.countries.size > 0) f.countries = Array.from(filters.countries);
    if (filters.pollutants.size > 0) f.pollutants = Array.from(filters.pollutants);
    if (publicationYearRange) {
      f.publicationYearFrom = filters.publicationYearFrom;
      f.publicationYearTo = filters.publicationYearTo;
    }
    return f;
  }, [filters, publicationYearRange]);

  // Reset to page 1 whenever filters or sorting change
  useEffect(() => {
    setPage(1);
  }, [activeQueryFilters, sortBy]);

  const { data: pageResult } = useAsync(
    () => queryStudies({ filters: activeQueryFilters, sort: sortBy, page, pageSize: PAGE_SIZE }),
    [activeQueryFilters, sortBy, page],
  );

  const toggleCollapse = (key: string) =>
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

  const toggleSet = useCallback((key: keyof Filters, value: string) => {
    setFilters(prev => {
      const set = new Set(prev[key] as Set<string>);
      set.has(value) ? set.delete(value) : set.add(value);
      return { ...prev, [key]: set };
    });
  }, []);

  const removeTag = (key: keyof Filters, value: string) => {
    setFilters(prev => {
      const set = new Set(prev[key] as Set<string>);
      set.delete(value);
      return { ...prev, [key]: set };
    });
  };

  const resetAll = () =>
    setFilters(emptyFilters(publicationYearRange ?? DEFAULT_PUBLICATION_YEAR_RANGE));

  const results = pageResult?.items || [];
  const totalItems = pageResult?.total || 0;

  // Active tags
  const activeTags: { key: keyof Filters; value: string; rawValue?: string; htmlValue?: string }[] = [
    ...[...filters.countries].map(v => ({ key: "countries" as keyof Filters, value: v })),
    ...[...filters.pollutants].map(v => {
      const pName = categoriesData?.flatMap(c => c.pollutants).find(p => p.key === v)?.name || v;
      return { key: "pollutants" as keyof Filters, value: pName, rawValue: v, htmlValue: chemToHtml(pName) };
    }),
  ];

  const totalActive = activeTags.length;

  return (
    <div className="flex h-full w-full overflow-hidden bg-background" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── FILTER SIDEBAR ── */}
      <aside className="w-72 shrink-0 flex flex-col bg-card border-r border-border overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={15} className="text-primary" />
            <span className="text-sm font-semibold text-foreground">Advanced Filters</span>
            {totalActive > 0 && (
              <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-4.5 text-center">
                {totalActive}
              </span>
            )}
          </div>
          <button
            onClick={resetAll}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive transition-colors"
          >
            <RotateCcw size={11} />
            Reset
          </button>
        </div>

        {/* Filter panels */}
        <div className="flex-1 overflow-y-auto">

          {/* Year & Citations range */}
          <div className="border-b border-border/60">
            <button onClick={() => toggleCollapse("range")} className="flex items-center justify-between w-full px-4 py-3 hover:bg-muted/30">
              <div className="flex items-center gap-2">
                <CalendarRange size={13} className="text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">Publication Year</span>
              </div>
              {collapsed.range ? <ChevronDown size={13} className="text-muted-foreground" /> : <ChevronUp size={13} className="text-muted-foreground" />}
            </button>
            {!collapsed.range && (
              <div className="px-4 pb-4">
                {publicationYearRange ? (
                  <RangeInput
                    label="Publication Year"
                    min={publicationYearRange.min}
                    max={publicationYearRange.max}
                    valueMin={filters.publicationYearFrom}
                    valueMax={filters.publicationYearTo}
                    onChangeMin={v => setFilters(p => ({
                      ...p,
                      publicationYearFrom: Math.min(v, p.publicationYearTo),
                    }))}
                    onChangeMax={v => setFilters(p => ({
                      ...p,
                      publicationYearTo: Math.max(v, p.publicationYearFrom),
                    }))}
                  />
                ) : (
                  <p className="text-[11px] text-muted-foreground" role="status">
                    {publicationYearRangeError
                      ? "Publication year range is unavailable."
                      : "Loading publication year range…"}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Geography */}
          <div className="border-b border-border/60">
            <button onClick={() => toggleCollapse("geo")} className="flex items-center justify-between w-full px-4 py-3 hover:bg-muted/30">
              <div className="flex items-center gap-2">
                <MapPin size={13} className="text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">Geography</span>
                {filters.countries.size > 0 && (
                  <span className="bg-primary text-primary-foreground rounded-full text-[9px] w-4 h-4 flex items-center justify-center font-bold">
                    {filters.countries.size}
                  </span>
                )}
              </div>
              {collapsed.geo ? <ChevronDown size={13} className="text-muted-foreground" /> : <ChevronUp size={13} className="text-muted-foreground" />}
            </button>
            {!collapsed.geo && (
              <div className="px-4 pb-3 space-y-3">
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Country</p>
                  <div className="relative mb-1.5">
                    <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <CountrySearch selected={filters.countries} onToggle={v => toggleSet("countries", v)} countries={countriesData || []} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Pollutants */}
          <PollutantGroup
            selected={filters.pollutants}
            onToggle={v => toggleSet("pollutants", v)}
            collapsed={collapsed.pollutants}
            onCollapse={() => toggleCollapse("pollutants")}
            pollutantCategories={categoriesData || []}
          />

        </div>

        {/* Apply CTA */}
        <div className="p-3 border-t border-border bg-card">
          <button
            onClick={() => document.getElementById("search-results-heading")?.scrollIntoView({ behavior: "smooth" })}
            className="w-full bg-primary text-primary-foreground rounded-md py-2 text-xs font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all"
          >
            Apply Filters · {totalItems} results
          </button>
        </div>
      </aside>

      {/* ── RESULTS PANEL ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Search bar row */}
        <div className="shrink-0 bg-card border-b border-border px-5 py-3 flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by title, author, keyword, city…"
              value={filters.query}
              onChange={e => setFilters(p => ({ ...p, query: e.target.value }))}
              className="w-full text-sm border border-border rounded-lg pl-9 pr-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/50 placeholder:text-muted-foreground/50 transition-all"
            />
            {filters.query && (
              <button onClick={() => setFilters(p => ({ ...p, query: "" }))} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X size={13} className="text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2 shrink-0">
            <ArrowUpDown size={13} className="text-muted-foreground" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className="text-xs border border-border rounded px-2 py-2 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 cursor-pointer"
            >
              <option value="relevance">Relevance</option>
              <option value="yearDesc">Year (Newest)</option>
              <option value="yearAsc">Year (Oldest)</option>
              <option value="titleAsc">Title</option>
              <option value="countryAsc">Country</option>
            </select>
          </div>

          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify(results, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `arc-studies-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-1.5 text-xs border border-border rounded px-3 py-2 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors shrink-0"
          >
            <Download size={12} />
            Export
          </button>

        </div>

        {/* Active filter tags */}
        {activeTags.length > 0 && (
          <div className="shrink-0 px-5 py-2 border-b border-border/60 bg-background flex flex-wrap gap-1.5 items-center">
            <Filter size={11} className="text-muted-foreground shrink-0" />
            {activeTags.map(({ key, value, rawValue, htmlValue }) => (
              <Tag key={`${key}-${rawValue || value}`} label={value} htmlLabel={htmlValue} onRemove={() => removeTag(key, rawValue || value)} />
            ))}
            <button onClick={resetAll} className="text-[11px] text-muted-foreground hover:text-destructive ml-1 transition-colors">
              Clear all
            </button>
          </div>
        )}

        {/* Result count bar */}
        <div id="search-results-heading" className="shrink-0 px-5 py-2.5 flex items-center justify-between border-b border-border/40">
          <div className="flex items-center gap-2">
            <BookOpen size={13} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{totalItems}</span> studies found
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>
          </span>
        </div>

        {/* Results list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Search size={32} className="text-border mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No studies match your filters</p>
              <button onClick={resetAll} className="mt-2 text-xs text-primary hover:underline">Reset all filters</button>
            </div>
          ) : (
            results.map((study, i) => <ResultCard key={study.id} study={study} index={i} pollutantDict={new Map(categoriesData?.flatMap(c => c.pollutants).map(p => [p.key, p.name]) || [])} onOpen={onOpenStudy} />)
          )}

          {/* Pagination */}
          {pageResult && pageResult.pageCount > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2 pb-4">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="text-xs border border-border rounded px-3 py-1.5 text-muted-foreground hover:text-foreground hover:border-foreground/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="text-[11px] text-muted-foreground px-2" style={{ fontFamily: "'DM Mono', monospace" }}>
                Page {pageResult.page} of {pageResult.pageCount}
              </span>
              <button
                onClick={() => setPage(p => Math.min(pageResult.pageCount, p + 1))}
                disabled={page >= pageResult.pageCount}
                className="text-xs border border-border rounded px-3 py-1.5 text-muted-foreground hover:text-foreground hover:border-foreground/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── COUNTRY SEARCH INPUT ──────────────────────────────────────────────────────

function CountrySearch({ selected, onToggle, countries }: { selected: Set<string>; onToggle: (v: string) => void; countries: { name: string }[] }) {
  const [q, setQ] = useState("");
  const visible = q ? countries.filter(c => c.name.toLowerCase().includes(q.toLowerCase())) : countries;

  return (
    <>
      <input
        type="text"
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Search countries…"
        className="w-full text-[11px] border border-border rounded pl-6 pr-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/50"
      />
      <div className="max-h-36 overflow-y-auto mt-1 space-y-0.5">
        {visible.map(c => (
          <label key={c.name} className="flex items-center gap-2 py-0.5 cursor-pointer group">
            <input type="checkbox" checked={selected.has(c.name)} onChange={() => onToggle(c.name)} className="accent-primary w-3 h-3" />
            <span className="text-[11px] text-foreground/75 group-hover:text-foreground">{c.name}</span>
          </label>
        ))}
      </div>
    </>
  );
}
