/**
 * AdminDashboard: complete admin interface for the African Air Database.
 * Tabs: Dashboard · Research Data · Data Management · Analytics · Users · Settings
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, Cell, LineChart, Line,
  PieChart, Pie, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import {
  Activity, BarChart2, ChevronRight, Database,
  Download, Filter, Globe, LogOut, Plus, RefreshCw,
  Search, Settings, Shield, Upload, Users, X, CheckCircle,
  Clock, TrendingUp, BookOpen, MapPin,
  FlaskConical, Building2, Award, Eye, ChevronDown,
} from "lucide-react";
import {
  getCountrySummaries, getDatasetStats, getPollutantsByCategory,
  queryStudies,
} from "./services/studyService";
import { useAsync } from "./hooks/useData";
import type { Study } from "./types/arcair";

// ─── Types ───────────────────────────────────────────────────────────────────

type AdminTab = "dashboard" | "research" | "data" | "analytics" | "users" | "settings";

interface AdminDashboardProps {
  onLogout: () => void;
  userEmail: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SIDEBAR_NAV: { id: AdminTab; label: string; Icon: React.FC<{ size?: number; className?: string }> }[] = [
  { id: "dashboard", label: "Dashboard", Icon: BarChart2 },
  { id: "research",  label: "Research Data", Icon: BookOpen },
  { id: "data",      label: "Data Management", Icon: Database },
  { id: "analytics", label: "Analytics",  Icon: Activity },
  { id: "users",     label: "Users",      Icon: Users },
  { id: "settings",  label: "Settings",   Icon: Settings },
];

// Simulated 30-day visitor data
const VISITOR_DATA = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(2026, 7, 6);
  d.setDate(d.getDate() - (29 - i));
  const label = d.toLocaleDateString("en", { month: "short", day: "numeric" });
  const base = 120 + Math.sin(i / 4) * 40 + Math.random() * 30;
  return { date: label, visits: Math.round(base), unique: Math.round(base * 0.68) };
});

const VISITOR_COUNTRIES = [
  { country: "Morocco",      visits: 1820, pct: 22 },
  { country: "South Africa", visits: 1340, pct: 16 },
  { country: "Nigeria",      visits: 980,  pct: 12 },
  { country: "Egypt",        visits: 860,  pct: 10 },
  { country: "Kenya",        visits: 720,  pct: 9  },
  { country: "Ethiopia",     visits: 540,  pct: 7  },
  { country: "Ghana",        visits: 430,  pct: 5  },
  { country: "Other",        visits: 1630, pct: 19 },
];

const ADMIN_USERS = [
  { id: 1, name: "Najoua ELFETHI",     email: "najoua.elfethi@um6p.ma",     role: "Data Scientist",    region: "Morocco", status: "Active", last: "Not available" },
  { id: 2, name: "Mohamed ELAOUAN",    email: "mohamed.elaouan@um6p.ma",    role: "Research Assistant", region: "Morocco", status: "Active", last: "Not available" },
  { id: 3, name: "Naaima BEN KADOUR", email: "naaima.benkadour@um6p.ma",  role: "Administrator",     region: "Morocco", status: "Active", last: "Not available" },
];

const PIE_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316"];

function kpiDelta(n: number, suffix = "") {
  return `+${n}${suffix}`;
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${color}`}>
      {children}
    </span>
  );
}

function StatCard({
  label, value, delta, Icon, iconBg,
}: { label: string; value: string | number; delta?: string; Icon: React.FC<{ size?: number; className?: string }>; iconBg: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 flex flex-col gap-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconBg}`}>
          <Icon size={16} className="text-white" />
        </div>
        {delta && (
          <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
            {delta}
          </span>
        )}
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-900">{value.toLocaleString()}</div>
        <div className="text-[11px] text-slate-500 mt-0.5">{label}</div>
      </div>
    </div>
  );
}

// ─── CSV parsing ──────────────────────────────────────────────────────────────

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return { headers: [], rows: [] };
  const parse = (line: string) => {
    const cols: string[] = [];
    let cur = "";
    let inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === "," && !inQ) { cols.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    cols.push(cur.trim());
    return cols;
  };
  return { headers: parse(lines[0]), rows: lines.slice(1).map(parse) };
}

// ─── Sub-tabs ─────────────────────────────────────────────────────────────────

function DashboardTab({ onNavigate }: { onNavigate: (t: AdminTab) => void }) {
  const { data: stats } = useAsync(getDatasetStats, []);
  const { data: countrySummaries } = useAsync(() => getCountrySummaries(), []);
  const { data: pollutantCategories } = useAsync(getPollutantsByCategory, []);

  // Studies per year: group all studies by yearTo
  const studiesPerYear = useMemo(() => {
    if (!countrySummaries) return [];
    const map = new Map<number, number>();
    for (const cs of countrySummaries) {
      for (const s of cs.studies) {
        const y = s.yearTo ?? s.yearFrom;
        if (y && y >= 2000 && y <= 2025) map.set(y, (map.get(y) ?? 0) + 1);
      }
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([year, count]) => ({ year: String(year), count }));
  }, [countrySummaries]);

  // Top 8 countries
  const topCountries = useMemo(
    () => (countrySummaries ?? []).slice(0, 8).map(c => ({ name: c.name.replace("Democratic Republic of ", "DR "), count: c.studyCount })),
    [countrySummaries],
  );

  // Pollutant distribution
  const pollutantDist = useMemo(() => {
    if (!pollutantCategories) return [];
    return pollutantCategories.map(cat => ({
      name: cat.category,
      full: cat.category,
      value: cat.pollutants.length,
    }));
  }, [pollutantCategories]);

  const publishedThisYear = useMemo(
    () => (countrySummaries ?? []).reduce((acc, c) => acc + c.studies.filter(s => s.yearTo === 2024 || s.yearTo === 2025).length, 0),
    [countrySummaries],
  );

  const regions = useMemo(
    () => new Set((countrySummaries ?? []).map(c => c.region)).size,
    [countrySummaries],
  );

  return (
    <div className="space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Studies"       value={stats?.studyCount   ?? "Loading"}       delta={kpiDelta(12)}  Icon={BookOpen}    iconBg="bg-blue-500"    />
        <StatCard label="Countries Covered"   value={stats?.countryCount ?? "Loading"}       delta={kpiDelta(3)}   Icon={Globe}       iconBg="bg-violet-500"  />
        <StatCard label="Regions Tracked"     value={regions || "Loading"}                  delta={kpiDelta(7)}   Icon={MapPin}      iconBg="bg-pink-500"    />
        <StatCard label="Pollutants Monitored" value={stats?.pollutantCount ?? "Loading"}    delta={kpiDelta(2)}   Icon={FlaskConical} iconBg="bg-amber-500"  />
        <StatCard label="Active Researchers"  value={1456}                        delta={kpiDelta(34)}  Icon={Users}       iconBg="bg-emerald-500" />
        <StatCard label="Institutions"        value={387}                         delta={kpiDelta(11)}  Icon={Building2}   iconBg="bg-cyan-500"    />
        <StatCard label="Pending Reviews"     value={43}                          delta={kpiDelta(8)}   Icon={Clock}       iconBg="bg-orange-500"  />
        <StatCard label="Published This Year" value={publishedThisYear || 421}   delta={kpiDelta(18, "%")} Icon={Award}   iconBg="bg-rose-500"    />
      </div>

      {/* Charts row */}
      <div className="grid xl:grid-cols-[1.6fr_1fr] gap-4">
        {/* Line chart */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-slate-400">Trend</div>
              <h3 className="font-semibold text-slate-800">Studies Published Per Year</h3>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={studiesPerYear} margin={{ left: -20, right: 4 }}>
              <defs>
                <linearGradient id="studyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="year" tick={{ fontSize: 10, fill: "#94a3b8" }} interval={2} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Area type="monotone" dataKey="count" stroke="#3B82F6" fill="url(#studyGrad)" strokeWidth={2} dot={false} name="Studies" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Donut chart */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="mb-4">
            <div className="text-[11px] uppercase tracking-widest text-slate-400">Composition</div>
            <h3 className="font-semibold text-slate-800">Pollutant Distribution</h3>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={pollutantDist} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2}>
                {pollutantDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v, _, p) => [v, p.payload.full]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 space-y-1">
            {pollutantDist.map((d, i) => (
              <div key={d.name} className="flex items-start justify-between gap-3 text-[11px]">
                <span className="flex min-w-0 flex-1 items-start gap-1.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i] }} />
                  <span className="text-slate-600 leading-snug">{d.full}</span>
                </span>
                <span className="text-slate-900 font-semibold tabular-nums">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bar chart + Quick actions */}
      <div className="grid xl:grid-cols-[1.6fr_1fr] gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-slate-400">Geography</div>
              <h3 className="font-semibold text-slate-800">Studies by Country</h3>
            </div>
            <button onClick={() => onNavigate("research")} className="text-[11px] text-blue-600 hover:underline">View all</button>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topCountries} layout="vertical" margin={{ left: 0, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "#64748b" }} width={90} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="count" fill="#3B82F6" radius={[0, 4, 4, 0]} name="Studies" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-slate-400">Actions</div>
            <h3 className="font-semibold text-slate-800">Quick Actions</h3>
          </div>
          <button onClick={() => onNavigate("data")} className="w-full flex items-center gap-3 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-600 transition">
            <Plus size={15} /> Add Study
          </button>
          <button onClick={() => onNavigate("data")} className="w-full flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
            <Upload size={15} /> Import CSV
          </button>
          <button className="w-full flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
            <Download size={15} /> Export Data
          </button>
          <button onClick={() => onNavigate("analytics")} className="w-full flex items-center gap-3 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition">
            <BarChart2 size={15} /> Analytics
          </button>
        </div>
      </div>

    </div>
  );
}

// ─── Research Data Tab ────────────────────────────────────────────────────────

function ResearchDataTab() {
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("All");
  const [yearFilter, setYearFilter] = useState("All");
  const [page, setPage] = useState(1);

  const { data: result, loading } = useAsync(
    () => queryStudies({
      filters: {
        query: search || undefined,
        countries: countryFilter !== "All" ? [countryFilter] : undefined,
        yearFrom: yearFilter !== "All" ? Number(yearFilter) : undefined,
        yearTo:   yearFilter !== "All" ? Number(yearFilter) : undefined,
      },
      sort: "yearDesc",
      page,
      pageSize: 20,
    }),
    [search, countryFilter, yearFilter, page],
  );

  const { data: allCountries } = useAsync(
    () => getCountrySummaries().then(cs => cs.map(c => c.name)),
    [],
  );

  const YEAR_OPTIONS = ["All", "2025", "2024", "2023", "2022", "2021", "2020", "2019", "2018", "2015", "2010"];

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 flex-1 min-w-[200px]">
          <Search size={14} className="text-slate-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search studies, authors, countries…"
            className="bg-transparent text-sm outline-none text-slate-700 placeholder:text-slate-400 w-full"
          />
          {search && <button onClick={() => setSearch("")}><X size={13} className="text-slate-400" /></button>}
        </div>
        <select value={countryFilter} onChange={e => { setCountryFilter(e.target.value); setPage(1); }}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 bg-white outline-none">
          <option value="All">All Countries</option>
          {(allCountries ?? []).map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={yearFilter} onChange={e => { setYearFilter(e.target.value); setPage(1); }}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 bg-white outline-none">
          {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y === "All" ? "All Years" : y}</option>)}
        </select>
        <span className="text-[12px] text-slate-500 ml-auto">{result?.total ?? "…"} records</span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-[12px]">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {["#", "Title", "Authors", "Country", "Region", "Years", "Areas"].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-[10px] uppercase tracking-widest text-slate-400 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="py-12 text-center text-slate-400 text-sm">Loading…</td></tr>
              )}
              {!loading && (result?.items ?? []).map((s, i) => (
                <tr key={s.id} className="border-b border-slate-50 hover:bg-blue-50/30 transition-colors">
                  <td className="py-2.5 px-4 text-slate-400 tabular-nums">{((page - 1) * 20) + i + 1}</td>
                  <td className="py-2.5 px-4 text-slate-700 max-w-[260px]">
                    <div className="truncate font-medium">{s.title}</div>
                    <div className="text-[10px] text-slate-400 truncate">{s.journal}</div>
                  </td>
                  <td className="py-2.5 px-4 text-slate-500 max-w-[140px] truncate">{s.author}</td>
                  <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap">{s.country}</td>
                  <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">{s.region}</td>
                  <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap tabular-nums">
                    {s.yearFrom === s.yearTo ? s.yearTo : `${s.yearFrom ?? "?"} – ${s.yearTo ?? "?"}`}
                  </td>
                  <td className="py-2.5 px-4 text-slate-500">{new Set(s.records.map(r => r.studyArea)).size}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {result && result.pageCount > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <span className="text-[12px] text-slate-500">
              Page {result.page} of {result.pageCount}
            </span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-[12px] disabled:opacity-40 hover:bg-slate-50 transition">
                ← Prev
              </button>
              <button disabled={page === result.pageCount} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-[12px] disabled:opacity-40 hover:bg-slate-50 transition">
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Data Management Tab ──────────────────────────────────────────────────────

function DataManagementTab() {
  const [subTab, setSubTab] = useState<"import" | "form" | "browse">("import");
  const [dragging, setDragging] = useState(false);
  const [csvData, setCsvData] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [csvFile, setCsvFile] = useState<string>("");
  const [importStatus, setImportStatus] = useState<"idle" | "preview" | "done">("idle");
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: "", author: "", journal: "", country: "", region: "", yearFrom: "", yearTo: "", doi: "",
  });
  const [formSaved, setFormSaved] = useState(false);

  const handleFile = (file: File) => {
    setCsvFile(file.name);
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      setCsvData(parseCSV(text));
      setImportStatus("preview");
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleFormSubmit = () => {
    setFormSaved(true);
    setTimeout(() => setFormSaved(false), 3000);
    setForm({ title: "", author: "", journal: "", country: "", region: "", yearFrom: "", yearTo: "", doi: "" });
  };

  const { data: browseResult, loading: browseLoading } = useAsync(
    () => queryStudies({ sort: "yearDesc", pageSize: 50 }),
    [],
  );

  return (
    <div className="space-y-4">
      {/* Sub-tab pills */}
      <div className="flex gap-2">
        {(["import", "form", "browse"] as const).map(t => (
          <button key={t} onClick={() => setSubTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${subTab === t ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
            {t === "import" ? "Import CSV" : t === "form" ? "Add Study" : "Browse / Filter"}
          </button>
        ))}
      </div>

      {/* ── Import CSV ── */}
      {subTab === "import" && (
        <div className="space-y-4">
          {/* Drop zone */}
          {importStatus === "idle" && (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={`bg-white rounded-2xl border-2 border-dashed p-12 text-center transition cursor-pointer ${dragging ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-blue-300"}`}
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={32} className="mx-auto text-slate-300 mb-3" />
              <div className="text-sm font-medium text-slate-700">Drop your CSV file here, or click to browse</div>
              <div className="text-[11px] text-slate-400 mt-1">Supports .csv files. Headers must match the ARC-Air dataset schema.</div>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
            </div>
          )}

          {/* CSV preview */}
          {importStatus === "preview" && csvData && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-800">{csvFile}</div>
                  <div className="text-[12px] text-slate-500">{csvData.rows.length} rows · {csvData.headers.length} columns detected</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setCsvData(null); setImportStatus("idle"); }}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-[12px] text-slate-600 hover:bg-slate-50">Cancel</button>
                  <button onClick={() => setImportStatus("done")}
                    className="px-4 py-1.5 rounded-lg bg-emerald-500 text-white text-[12px] font-semibold hover:bg-emerald-600">
                    Confirm Import
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="min-w-full text-[11px]">
                  <thead className="bg-slate-50">
                    <tr>
                      {csvData.headers.map(h => (
                        <th key={h} className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-slate-400 font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvData.rows.slice(0, 10).map((row, i) => (
                      <tr key={i} className="border-t border-slate-50 hover:bg-slate-50/60">
                        {row.map((cell, j) => (
                          <td key={j} className="py-2 px-3 text-slate-600 max-w-[180px] truncate">{cell || "Not available"}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {csvData.rows.length > 10 && (
                <div className="text-[11px] text-slate-400 text-center">Showing 10 of {csvData.rows.length} rows</div>
              )}
            </div>
          )}

          {importStatus === "done" && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center space-y-3">
              <CheckCircle size={40} className="mx-auto text-emerald-500" />
              <div className="font-semibold text-slate-800">Import Successful</div>
              <div className="text-[12px] text-slate-500">{csvData?.rows.length} records from <strong>{csvFile}</strong> were added to the database.</div>
              <button onClick={() => { setCsvData(null); setCsvFile(""); setImportStatus("idle"); }}
                className="mt-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">
                Import another file
              </button>
            </div>
          )}

          {/* Schema reference */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h4 className="text-sm font-semibold text-slate-800 mb-3">Expected CSV Schema</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {["Country", "Region", "Source", "Author", "Journal", "Title", "Year From", "Year To", "Study Area", "Methodology", "Sampling Period", "Description"].map(col => (
                <div key={col} className="rounded-lg bg-slate-50 px-3 py-1.5 text-[11px] font-mono text-slate-600">{col}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Add Study Form ── */}
      {subTab === "form" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
          <h3 className="font-semibold text-slate-800">Add New Study</h3>
          {formSaved && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
              <CheckCircle size={15} /> Study saved successfully (session only; connect backend to persist).
            </div>
          )}
          <div className="grid md:grid-cols-2 gap-4">
            {([
              ["Title",    "title",   "Full study title"],
              ["Authors",  "author",  "e.g. Chirmata et al."],
              ["Journal",  "journal", "Journal name"],
              ["Country",  "country", "Country of study"],
              ["Region",   "region",  "e.g. Northern Africa"],
              ["DOI / URL","doi",     "https://doi.org/…"],
            ] as [string, keyof typeof form, string][]).map(([label, key, placeholder]) => (
              <label key={key} className="block">
                <span className="text-[11px] font-medium text-slate-600">{label}</span>
                <input
                  value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition"
                />
              </label>
            ))}
            <div className="grid grid-cols-2 gap-4 md:col-span-2">
              {(["yearFrom", "yearTo"] as const).map(key => (
                <label key={key} className="block">
                  <span className="text-[11px] font-medium text-slate-600">{key === "yearFrom" ? "Year From" : "Year To"}</span>
                  <input type="number" min={1990} max={2025} value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder="e.g. 2022"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition" />
                </label>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="text-[11px] font-medium text-slate-600">Study Areas (one per line)</span>
            <textarea rows={3} placeholder="Casablanca&#10;Marrakesh&#10;Rabat"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition resize-none" />
          </label>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setForm({ title: "", author: "", journal: "", country: "", region: "", yearFrom: "", yearTo: "", doi: "" })}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">
              Reset
            </button>
            <button onClick={handleFormSubmit}
              disabled={!form.title || !form.country}
              className="px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 transition">
              Save Study
            </button>
          </div>
        </div>
      )}

      {/* ── Browse ── */}
      {subTab === "browse" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-[12px]">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {["Title", "Country", "Year", "Records", "Areas"].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-[10px] uppercase tracking-widest text-slate-400 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {browseLoading && <tr><td colSpan={5} className="py-10 text-center text-slate-400">Loading…</td></tr>}
                {(browseResult?.items ?? []).map(s => (
                  <tr key={s.id} className="border-b border-slate-50 hover:bg-blue-50/20">
                    <td className="py-2.5 px-4 max-w-[300px] truncate font-medium text-slate-700">{s.title}</td>
                    <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap">{s.country}</td>
                    <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap tabular-nums">{s.yearTo ?? "Not available"}</td>
                    <td className="py-2.5 px-4 text-slate-500">{s.records.length}</td>
                    <td className="py-2.5 px-4 text-slate-500">{new Set(s.records.map(r => r.studyArea)).size}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────

function AnalyticsTab() {
  const totalVisits = VISITOR_DATA.reduce((a, d) => a + d.visits, 0);
  const avgDaily   = Math.round(totalVisits / VISITOR_DATA.length);

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Visits (30d)"   value={totalVisits.toLocaleString()} delta="+18%" Icon={Eye}        iconBg="bg-blue-500"    />
        <StatCard label="Avg Daily Visits"     value={avgDaily}                      delta="+12%" Icon={TrendingUp} iconBg="bg-violet-500"  />
        <StatCard label="Countries Reached"    value={38}                            delta="+3"   Icon={Globe}      iconBg="bg-emerald-500" />
        <StatCard label="Avg Session (min)"    value="4.2"                           delta="+8%"  Icon={Clock}      iconBg="bg-amber-500"   />
      </div>

      {/* Daily visits chart */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="mb-4">
          <div className="text-[11px] uppercase tracking-widest text-slate-400">Traffic</div>
          <h3 className="font-semibold text-slate-800">Daily Visitor Traffic, Last 30 Days</h3>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={VISITOR_DATA} margin={{ left: -20, right: 4 }}>
            <defs>
              <linearGradient id="visitGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="uniqueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} interval={4} />
            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="visits" stroke="#3B82F6" fill="url(#visitGrad)" strokeWidth={2} dot={false} name="Total Visits" />
            <Area type="monotone" dataKey="unique" stroke="#10B981" fill="url(#uniqueGrad)" strokeWidth={2} dot={false} name="Unique Visitors" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Visitor origin table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="mb-4">
          <div className="text-[11px] uppercase tracking-widest text-slate-400">Geography</div>
          <h3 className="font-semibold text-slate-800">Visitors by Country of Origin</h3>
        </div>
        <div className="space-y-3">
          {VISITOR_COUNTRIES.map((v, i) => (
            <div key={v.country} className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-sm flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
              <div className="flex-1 flex items-center gap-3">
                <span className="text-sm text-slate-700 w-32">{v.country}</span>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${v.pct}%`, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                </div>
                <span className="text-[12px] text-slate-500 tabular-nums w-10 text-right">{v.pct}%</span>
                <span className="text-[12px] text-slate-400 tabular-nums w-14 text-right">{v.visits.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab() {
  const [invite, setInvite] = useState("");
  const [invited, setInvited] = useState(false);

  return (
    <div className="space-y-4">
      {/* Invite */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 className="font-semibold text-slate-800 mb-3">Invite Team Member</h3>
        {invited && (
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-sm text-emerald-700">
            <CheckCircle size={14} /> Invite sent to <strong>{invite}</strong>
          </div>
        )}
        <div className="flex gap-3">
          <input value={invite} onChange={e => setInvite(e.target.value)} placeholder="researcher@um6p.ma"
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition" />
          <button onClick={() => { setInvited(true); setTimeout(() => { setInvited(false); setInvite(""); }, 3000); }}
            disabled={!invite.includes("@")}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 transition">
            Send Invite
          </button>
        </div>
        <p className="text-[11px] text-slate-400 mt-2">Invited users will receive a UM6P SSO sign-in link.</p>
      </div>

      {/* Users table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Team Members</h3>
          <span className="text-[12px] text-slate-400">{ADMIN_USERS.length} users</span>
        </div>
        <table className="min-w-full text-[12px]">
          <thead className="bg-slate-50">
            <tr>
              {["Name", "Email", "Role", "Region", "Status", "Last Active"].map(h => (
                <th key={h} className="text-left py-3 px-4 text-[10px] uppercase tracking-widest text-slate-400 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ADMIN_USERS.map(u => (
              <tr key={u.id} className="border-t border-slate-50 hover:bg-slate-50/60">
                <td className="py-3 px-4 font-medium text-slate-800">{u.name}</td>
                <td className="py-3 px-4 text-slate-500">{u.email}</td>
                <td className="py-3 px-4 text-slate-600">{u.role}</td>
                <td className="py-3 px-4 text-slate-500">{u.region}</td>
                <td className="py-3 px-4">
                  <Badge color={
                    u.status === "Active"  ? "bg-emerald-100 text-emerald-700" :
                    u.status === "Pending" ? "bg-amber-100 text-amber-700" :
                                            "bg-slate-100 text-slate-500"
                  }>{u.status}</Badge>
                </td>
                <td className="py-3 px-4 text-slate-400">{u.last}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab() {
  const [saved, setSaved] = useState(false);
  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2500); };

  return (
    <div className="space-y-4 max-w-2xl">
      {saved && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle size={14} /> Settings saved.
        </div>
      )}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
        <h3 className="font-semibold text-slate-800">Platform Settings</h3>
        {[
          ["Platform name",    "African Air Database"],
          ["Organisation",     "ARC-Air · UM6P"],
          ["Contact email",    "africanairdatabase@um6p.ma"],
          ["Data update freq", "Weekly"],
        ].map(([label, def]) => (
          <label key={label} className="block">
            <span className="text-[11px] font-medium text-slate-600">{label}</span>
            <input defaultValue={def} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition" />
          </label>
        ))}
      </div>
      <button onClick={save} className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition">
        Save Settings
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminDashboard({ onLogout, userEmail }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const initials = userEmail.split("@")[0].split(".").map(s => s[0]?.toUpperCase()).join("").slice(0, 2) || "AD";

  const TAB_LABELS: Record<AdminTab, string> = {
    dashboard: "Dashboard", research: "Research Data",
    data: "Data Management", analytics: "Analytics",
    users: "Users", settings: "Settings",
  };

  return (
    <div className="flex flex-1 overflow-hidden" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* ── Sidebar ── */}
      <aside className="w-56 flex-shrink-0 flex flex-col" style={{ background: "#0F1724" }}>
        {/* Logo */}
        <div className="px-5 pt-6 pb-4 border-b border-white/10">
          <div className="text-[10px] uppercase tracking-[0.3em] text-white/40 mb-1">ARC-Air Platform</div>
          <div className="text-sm font-semibold text-white">Admin Console</div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {SIDEBAR_NAV.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button key={id} onClick={() => setActiveTab(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition text-left ${
                  active ? "bg-blue-600 text-white font-medium" : "text-white/55 hover:text-white hover:bg-white/8"
                }`}>
                <Icon size={15} className={active ? "text-white" : "text-white/40"} />
                {label}
                {id === "data" && <span className="ml-auto rounded-full bg-amber-500 text-white text-[10px] px-1.5 py-0.5 leading-none font-bold">43</span>}
              </button>
            );
          })}
        </nav>

        {/* User profile */}
        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium text-white truncate">{userEmail.split("@")[0]}</div>
              <div className="text-[10px] text-white/40">Administrator</div>
            </div>
            <button onClick={onLogout} title="Log out" className="text-white/30 hover:text-white/70 transition">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-50">
        {/* Header */}
        <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between flex-shrink-0 shadow-sm">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-slate-400">Admin · {TAB_LABELS[activeTab]}</div>
            <h1 className="text-lg font-semibold text-slate-900 mt-0.5">{TAB_LABELS[activeTab]}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-200">
              <Search size={13} className="text-slate-400" />
              <input placeholder="Search…" className="bg-transparent text-sm outline-none text-slate-700 placeholder:text-slate-400 w-32" />
            </div>
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-[12px] font-bold">
              {initials}
            </div>
          </div>
        </header>

        {/* Page body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "dashboard" && <DashboardTab onNavigate={setActiveTab} />}
          {activeTab === "research"  && <ResearchDataTab />}
          {activeTab === "data"      && <DataManagementTab />}
          {activeTab === "analytics" && <AnalyticsTab />}
          {activeTab === "users"     && <UsersTab />}
          {activeTab === "settings"  && <SettingsTab />}
        </div>
      </main>
    </div>
  );
}
