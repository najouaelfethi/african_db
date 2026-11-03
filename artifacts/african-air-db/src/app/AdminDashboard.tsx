/**
 * AdminDashboard: complete admin interface for the African Air Database.
 * Tabs: Dashboard · Research Data · Data Management · Analytics · Users · Settings
 */
import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  LineChart,
  Line,
  PieChart,
  Pie,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  LabelList,
} from "recharts";
import {
  Activity,
  BarChart2,
  ChevronRight,
  Database,
  Filter,
  Globe,
  LogOut,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Trash2,
  Upload,
  Users,
  X,
  CheckCircle,
  Clock,
  TrendingUp,
  BookOpen,
  MapPin,
  FlaskConical,
  Award,
  Eye,
  ChevronDown,
} from "lucide-react";
import { queryStudies } from "./services/studyService";
import {
  createStudy,
  deleteStudy,
  emptyMeasurement,
  emptyMethodology,
  getStudyPlaces,
  getStudyDetail,
  getVariables,
  updateStudy,
  type MeasurementEntry,
  type MethodologyEntry,
  type StudyFormValues,
  type StudyIds,
  type VariableOption,
} from "./services/adminStudyService";
import {
  getDashboardSummary,
  getMeasurementStatistics,
  getStudiesByCountry,
  getStudiesByYear,
} from "./services/analyticsService";
import ActivityHistoryTab from "./admin/ActivityHistoryTab";
import CollaborationRequestsTab from "./admin/CollaborationRequestsTab";
import UsersPermissionsTab from "./admin/UsersPermissionsTab";
import { COUNTRY_TOPO_ID } from "./data/geo";
import arcairLogo from "../assets/arcair-logo.png";
import { useAsync } from "./hooks/useData";
import type { Study } from "./types/arcair";

// ─── Types ───────────────────────────────────────────────────────────────────

type AdminTab =
  | "dashboard"
  | "research"
  | "data"
  | "analytics"
  | "requests"
  | "users"
  | "activity"
  | "settings";

interface AdminDashboardProps {
  onLogout: () => void;
  userEmail: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SIDEBAR_NAV: {
  id: AdminTab;
  label: string;
  Icon: React.FC<{ size?: number; className?: string }>;
}[] = [
  { id: "dashboard", label: "Dashboard", Icon: BarChart2 },
  { id: "research", label: "Data Management", Icon: BookOpen },
  { id: "analytics", label: "Analytics", Icon: Activity },
  { id: "requests", label: "Collaboration Requests", Icon: Mail },
  { id: "users", label: "Users & Permissions", Icon: Users },
  { id: "activity", label: "Activity History", Icon: Clock },
  { id: "settings", label: "Settings", Icon: Settings },
];

// Simulated 30-day visitor data
const VISITOR_DATA = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(2026, 7, 6);
  d.setDate(d.getDate() - (29 - i));
  const label = d.toLocaleDateString("en", { month: "short", day: "numeric" });
  const base = 120 + Math.sin(i / 4) * 40 + Math.random() * 30;
  return {
    date: label,
    visits: Math.round(base),
    unique: Math.round(base * 0.68),
  };
});

const VISITOR_COUNTRIES = [
  { country: "Morocco", visits: 1820, pct: 22 },
  { country: "South Africa", visits: 1340, pct: 16 },
  { country: "Nigeria", visits: 980, pct: 12 },
  { country: "Egypt", visits: 860, pct: 10 },
  { country: "Kenya", visits: 720, pct: 9 },
  { country: "Ethiopia", visits: 540, pct: 7 },
  { country: "Ghana", visits: 430, pct: 5 },
  { country: "Other", visits: 1630, pct: 19 },
];

const PIE_COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#F97316",
];
const MEASUREMENT_CATEGORY_LABELS: Record<string, string> = {
  bulk_pm: "Bulk PM",
  carbonaceous: "Carbonaceous aerosols",
  gas: "Atmospheric gases",
  organic: "Organic pollutants",
  trace_metals: "Trace metals",
  wsia: "Water soluble inorganic aerosols",
};
const ALL_MAP_COUNTRIES = Object.keys(COUNTRY_TOPO_ID).sort((a, b) =>
  a.localeCompare(b),
);

function Badge({
  children,
  color,
}: {
  children: React.ReactNode;
  color: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${color}`}
    >
      {children}
    </span>
  );
}

function StatCard({
  label,
  value,
  delta,
  Icon,
  iconBg,
}: {
  label: string;
  value: string | number;
  delta?: string;
  Icon: React.FC<{ size?: number; className?: string }>;
  iconBg: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 flex flex-col gap-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconBg}`}
        >
          <Icon size={16} className="text-white" />
        </div>
        {delta && (
          <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
            {delta}
          </span>
        )}
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-900">
          {value.toLocaleString()}
        </div>
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
      if (ch === '"') {
        inQ = !inQ;
      } else if (ch === "," && !inQ) {
        cols.push(cur.trim());
        cur = "";
      } else cur += ch;
    }
    cols.push(cur.trim());
    return cols;
  };
  return { headers: parse(lines[0]), rows: lines.slice(1).map(parse) };
}

// ─── Sub-tabs ─────────────────────────────────────────────────────────────────

// Single-line, truncated Y-axis label so long names never wrap or overlap
function CountryTick({
  x,
  y,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value: string };
}) {
  const full = payload?.value ?? "";
  const label = full.length > 22 ? `${full.slice(0, 21)}…` : full;
  return (
    <text
      x={(x ?? 0) - 6}
      y={y}
      dy={4}
      textAnchor="end"
      fontSize={11}
      fill="#475569"
    >
      <title>{full}</title>
      {label}
    </text>
  );
}

function DashboardTab({ onNavigate }: { onNavigate: (t: AdminTab) => void }) {
  const { data: summary } = useAsync(getDashboardSummary, []);
  const { data: yearRows } = useAsync(getStudiesByYear, []);
  const { data: countryRows } = useAsync(() => getStudiesByCountry(), []);
  const { data: measurementStats } = useAsync(getMeasurementStatistics, []);

  const studiesPerYear = useMemo(
    () =>
      [...(yearRows ?? [])]
        .sort((a, b) => a.year - b.year)
        .map((row) => ({ year: String(row.year), count: row.total_studies })),
    [yearRows],
  );

  // Every known country is listed; countries missing from the API get 0
  const topCountries = useMemo(() => {
    const counts = new Map<string, number>();
    ALL_MAP_COUNTRIES.forEach((c) => counts.set(c, 0));
    (countryRows ?? []).forEach((row) =>
      counts.set(row.country, row.total_studies),
    );
    return [...counts.entries()]
      .map(([country, count]) => ({
        name: country.replace("Democratic Republic of ", "DR "),
        count,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [countryRows]);

  const [showAllCountries, setShowAllCountries] = useState(false);
  const COLLAPSED_COUNTRY_LIMIT = 15;
  const visibleCountries = showAllCountries
    ? topCountries
    : topCountries.slice(0, COLLAPSED_COUNTRY_LIMIT);

  // Pollutant distribution: measurements per category from the analytics API
  const pollutantDist = useMemo(
    () =>
      Object.entries(measurementStats?.measurements_by_category ?? {})
        .map(([key, value]) => {
          const label =
            MEASUREMENT_CATEGORY_LABELS[key.toLowerCase()] ??
            key
              .replace(/_/g, " ")
              .replace(/\b\w/g, (letter) => letter.toUpperCase());
          return { name: label, full: label, value };
        })
        .filter((item) => item.value > 0)
        .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name)),
    [measurementStats],
  );

  return (
    <div className="space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Studies"
          value={summary?.total_studies ?? 0}
          Icon={BookOpen}
          iconBg="bg-blue-500"
        />
        <StatCard
          label="Countries Covered"
          value={summary?.total_countries ?? 0}
          Icon={Globe}
          iconBg="bg-violet-500"
        />
        <StatCard
          label="Pollutants Monitored"
          value={summary?.total_pollution_variables ?? 0}
          Icon={FlaskConical}
          iconBg="bg-amber-500"
        />
        <StatCard
          label="Latest Publication Year"
          value={summary?.latest_publication_year || 0}
          Icon={Award}
          iconBg="bg-rose-500"
        />
        <StatCard
          label="Oldest Publication Year"
          value={summary?.oldest_publication_year || 0}
          Icon={Clock}
          iconBg="bg-orange-500"
        />
        <StatCard
          label="Top Country"
          value={summary?.top_country ?? 0}
          Icon={MapPin}
          iconBg="bg-pink-500"
        />
        <StatCard
          label="Top Pollutant"
          value={summary?.top_pollution_variable ?? 0}
          Icon={Activity}
          iconBg="bg-cyan-500"
        />
      </div>

      {/* Charts row */}
      <div className="grid xl:grid-cols-[1.6fr_1fr] gap-4">
        {/* Histogram */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-slate-400">
                Trend
              </div>
              <h3 className="font-semibold text-slate-800">
                Studies Published Per Year
              </h3>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={studiesPerYear}
              barCategoryGap={0}
              margin={{ left: -20, right: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f1f5f9"
                vertical={false}
              />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                interval={2}
              />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <Tooltip
                cursor={{ fill: "rgba(59, 130, 246, 0.08)" }}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Bar
                dataKey="count"
                fill="#3B82F6"
                stroke="#ffffff"
                strokeWidth={1}
                name="Studies"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Donut chart */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="mb-4">
            <div className="text-[11px] uppercase tracking-widest text-slate-400">
              Composition
            </div>
            <h3 className="font-semibold text-slate-800">
              Pollutant Distribution
            </h3>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={pollutantDist}
                dataKey="value"
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={70}
                paddingAngle={2}
              >
                {pollutantDist.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8 }}
                formatter={(v, _, p) => [v, p.payload.full]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 space-y-1">
            {pollutantDist.map((d, i) => (
              <div
                key={d.name}
                className="flex items-start justify-between gap-3 text-[11px]"
              >
                <span className="flex min-w-0 flex-1 items-start gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: PIE_COLORS[i] }}
                  />
                  <span className="text-slate-600 leading-snug">{d.full}</span>
                </span>
                <span className="text-slate-900 font-semibold tabular-nums">
                  {d.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Studies by country */}
      <div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-slate-400">
                Geography
              </div>
              <h3 className="font-semibold text-slate-800">
                Studies by Country
              </h3>
            </div>
            {topCountries.length > COLLAPSED_COUNTRY_LIMIT && (
              <button
                onClick={() => setShowAllCountries((v) => !v)}
                className="text-[11px] text-blue-600 hover:underline"
              >
                {showAllCountries
                  ? "Show less"
                  : `View all countries (${topCountries.length})`}
              </button>
            )}
          </div>
          <ResponsiveContainer
            width="100%"
            height={Math.max(260, visibleCountries.length * 30)}
          >
            <BarChart
              data={visibleCountries}
              layout="vertical"
              margin={{ left: 0, right: 30 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={false}
                stroke="#f1f5f9"
              />
              <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <YAxis
                dataKey="name"
                type="category"
                tick={<CountryTick />}
                width={150}
                interval={0}
              />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar
                dataKey="count"
                fill="#3B82F6"
                radius={[0, 4, 4, 0]}
                name="Studies"
              >
                {visibleCountries.map((row) => (
                  <Cell
                    key={row.name}
                    fill={row.count === 0 ? "#CBD5E1" : "#3B82F6"}
                  />
                ))}
                <LabelList
                  dataKey="count"
                  position="right"
                  style={{ fontSize: 10, fill: "#64748b" }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─── Research Data Tab ────────────────────────────────────────────────────────

type TextField = Exclude<keyof StudyFormValues, "methodologies">;

const CATEGORY_LABELS: Record<string, string> = {
  bulk_pm: "Bulk PM",
  wsia: "Water-soluble ions",
};

const categoryLabel = (category: string) =>
  CATEGORY_LABELS[category] ??
  category.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/** Optional, collapsed-by-default list of pollutant values for one methodology. */
function MeasurementsEditor({
  variables,
  items,
  onChange,
}: {
  variables: VariableOption[];
  items: MeasurementEntry[];
  onChange: (items: MeasurementEntry[]) => void;
}) {
  const byCategory = useMemo(() => {
    const groups = new Map<string, VariableOption[]>();
    for (const v of variables) {
      groups.set(v.category, [...(groups.get(v.category) ?? []), v]);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [variables]);

  const patch = (index: number, change: Partial<MeasurementEntry>) =>
    onChange(items.map((m, i) => (i === index ? { ...m, ...change } : m)));

  const numberInput =
    "w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-400";

  return (
    <details className="rounded-lg border border-slate-200 bg-white p-2">
      <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-widest text-slate-500">
        Measurements ({items.length})
      </summary>
      <div className="mt-2 space-y-2">
        {items.map((item, index) => (
          <div
            key={item.id ?? `new-${index}`}
            className="space-y-1.5 rounded-lg bg-slate-50 p-2"
          >
            <div className="flex items-center gap-2">
              <select
                value={item.variableId}
                onChange={(e) => {
                  const picked = variables.find((v) => v.id === e.target.value);
                  patch(index, {
                    variableId: e.target.value,
                    unit: item.unit || picked?.unit || "",
                  });
                }}
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-400"
              >
                <option value="">Select pollutant…</option>
                {byCategory.map(([category, list]) => (
                  <optgroup key={category} label={categoryLabel(category)}>
                    {list.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <button
                type="button"
                title="Remove measurement"
                onClick={() => onChange(items.filter((_, i) => i !== index))}
                className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 size={13} />
              </button>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {(
                [
                  ["mean", "Mean"],
                  ["sd", "SD"],
                  ["min", "Min"],
                  ["max", "Max"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block">
                  <span className="text-[10px] uppercase tracking-widest text-slate-400">
                    {label}
                  </span>
                  <input
                    value={item[key]}
                    inputMode="decimal"
                    onChange={(e) => patch(index, { [key]: e.target.value })}
                    className={numberInput}
                  />
                </label>
              ))}
              <label className="block">
                <span className="text-[10px] uppercase tracking-widest text-slate-400">
                  Unit
                </span>
                <input
                  value={item.unit}
                  onChange={(e) => patch(index, { unit: e.target.value })}
                  className={numberInput}
                />
              </label>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...items, emptyMeasurement()])}
          className="flex items-center gap-1 rounded-lg border border-blue-200 px-2 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-50"
        >
          <Plus size={12} /> Add measurement
        </button>
      </div>
    </details>
  );
}

/** One line per methodology row, numbered when a study has several. */
function RecordList({
  records,
  pick,
}: {
  records: Study["records"];
  pick: (record: Study["records"][number]) => string;
}) {
  if (records.length === 0) return <>-</>;
  if (records.length === 1) {
    return <span className="break-words">{pick(records[0]) || "-"}</span>;
  }
  return (
    <ol className="space-y-1.5">
      {records.map((record, index) => (
        <li key={index} className="flex gap-1.5">
          <span className="text-slate-400">{index + 1}.</span>
          <span className="break-words">{pick(record) || "-"}</span>
        </li>
      ))}
    </ol>
  );
}

function distinct(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

const STUDY_REGIONS = [
  "Northern Africa",
  "Western Africa",
  "East & Central Africa",
  "Southern Africa",
];

function ResearchDataTab() {
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("All");
  const [yearFilter, setYearFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [editor, setEditor] = useState<{
    id: string | null;
    ids: StudyIds;
    values: StudyFormValues;
  } | null>(null);
  const [deleting, setDeleting] = useState<Study | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const { data: places } = useAsync(getStudyPlaces, [reloadKey]);

  const { data: result, loading } = useAsync(
    () =>
      queryStudies({
        filters: {
          query: search || undefined,
          countries: countryFilter !== "All" ? [countryFilter] : undefined,
          yearFrom: yearFilter !== "All" ? Number(yearFilter) : undefined,
          yearTo: yearFilter !== "All" ? Number(yearFilter) : undefined,
        },
        sort: "yearDesc",
        page,
        pageSize: 20,
      }),
    [search, countryFilter, yearFilter, page, reloadKey],
  );

  const emptyValues: StudyFormValues = {
    source: "",
    publicationYear: "",
    dataProcessing: "",
    title: "",
    author: "",
    journal: "",
    identifier: "",
    region: "",
    country: "",
    city: "",
    siteDescription: "",
    methodologies: [emptyMethodology()],
  };

  const noIds: StudyIds = {
    articleId: null,
    locationId: null,
    methodologyIds: [],
  };

  const openCreate = () => {
    setActionError("");
    setEditor({ id: null, ids: noIds, values: emptyValues });
  };

  const openEdit = async (study: Study) => {
    setActionError("");
    setBusy(true);
    try {
      const { id, values, ...ids } = await getStudyDetail(study.id);
      setEditor({ id, ids, values });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not load study.");
    } finally {
      setBusy(false);
    }
  };

  const saveEditor = async () => {
    if (!editor) return;
    if (!editor.values.source.trim()) {
      setActionError("Source is required.");
      return;
    }
    setBusy(true);
    setActionError("");
    try {
      if (editor.id) {
        await updateStudy(editor.id, editor.ids, editor.values);
      } else {
        await createStudy(editor.values);
      }
      setEditor(null);
      setReloadKey((k) => k + 1);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not save study.");
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    setActionError("");
    try {
      await deleteStudy(deleting.id);
      setDeleting(null);
      setReloadKey((k) => k + 1);
    } catch (e) {
      setActionError(
        e instanceof Error ? e.message : "Could not delete study.",
      );
      // The study may already be gone (stale list): refresh so it disappears.
      setReloadKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  };

  const allCountries = useMemo(() => ALL_MAP_COUNTRIES, []);

  const [variables, setVariables] = useState<VariableOption[]>([]);
  const editorOpen = editor !== null;
  useEffect(() => {
    if (!editorOpen || variables.length > 0) return;
    getVariables()
      .then(setVariables)
      .catch(() => setVariables([]));
  }, [editorOpen, variables.length]);

  const YEAR_OPTIONS = [
    "All",
    "2025",
    "2024",
    "2023",
    "2022",
    "2021",
    "2020",
    "2019",
    "2018",
    "2015",
    "2010",
  ];

  return (
    <div className="space-y-4">
      {import.meta.env.MODE === "sandbox" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-[12px] font-medium text-amber-700">
          SANDBOX - changes here affect the disposable test database only.
        </div>
      )}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 flex-1 min-w-50]">
          <Search size={14} className="text-slate-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search studies, authors, countries…"
            className="bg-transparent text-sm outline-none text-slate-700 placeholder:text-slate-400 w-full"
          />
          {search && (
            <button onClick={() => setSearch("")}>
              <X size={13} className="text-slate-400" />
            </button>
          )}
        </div>
        <select
          value={countryFilter}
          onChange={(e) => {
            setCountryFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 bg-white outline-none"
        >
          <option value="All">All Countries</option>
          {(allCountries ?? []).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={yearFilter}
          onChange={(e) => {
            setYearFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 bg-white outline-none"
        >
          {YEAR_OPTIONS.map((y) => (
            <option key={y} value={y}>
              {y === "All" ? "All Years" : y}
            </option>
          ))}
        </select>
        <span className="text-[12px] text-slate-500 ml-auto">
          {result?.total ?? "…"} records
        </span>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-[12px] font-medium text-white hover:bg-blue-700 transition"
        >
          <Plus size={14} /> Add study
        </button>
      </div>

      {actionError && !editor && !deleting && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-[12px] text-red-600">
          {actionError}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-[12px]">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {[
                  "#",
                  "Source",
                  "Year",
                  "Region",
                  "Country",
                  "City",
                  "Sampling period",
                  "Methodology",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left py-3 px-4 text-[10px] uppercase tracking-widest text-slate-400 font-medium whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={9}
                    className="py-12 text-center text-slate-400 text-sm"
                  >
                    Loading…
                  </td>
                </tr>
              )}
              {!loading &&
                (result?.items ?? []).map((s, i) => (
                  <tr
                    key={s.id}
                    className="border-b border-slate-50 align-top hover:bg-blue-50/30 transition-colors"
                  >
                    <td className="py-2.5 px-4 text-slate-400 tabular-nums">
                      {(page - 1) * 20 + i + 1}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 max-w-65">
                      <div className="truncate font-medium" title={s.title}>
                        {s.source}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 tabular-nums">
                      {s.publicationYear ?? "-"}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">
                      {places?.get(s.id)?.region || "-"}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap">
                      {s.country}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">
                      {places?.get(s.id)?.city || "-"}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 min-w-40 tabular-nums">
                      <RecordList
                        records={s.records}
                        pick={(r) => r.samplingPeriod}
                      />
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 min-w-72 max-w-md">
                      <RecordList
                        records={s.records}
                        pick={(r) => r.methodology}
                      />
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-1">
                        <button
                          title="Edit study"
                          disabled={busy}
                          onClick={() => openEdit(s)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition disabled:opacity-40"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          title="Delete study"
                          disabled={busy}
                          onClick={() => {
                            setActionError("");
                            setDeleting(s);
                          }}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition disabled:opacity-40"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
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
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-[12px] disabled:opacity-40 hover:bg-slate-50 transition"
              >
                ← Prev
              </button>
              <button
                disabled={page === result.pageCount}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-[12px] disabled:opacity-40 hover:bg-slate-50 transition"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {editor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">
                {editor.id ? "Edit study" : "Add study"}
              </h3>
              <button onClick={() => setEditor(null)} disabled={busy}>
                <X size={16} className="text-slate-400" />
              </button>
            </div>
            <div className="space-y-3">
              {(
                [
                  [
                    "Study",
                    [
                      ["source", "Source *", "e.g. Author et al. 2023"],
                      ["publicationYear", "Publication year", "e.g. 2023"],
                      ["dataProcessing", "Data processing", ""],
                    ],
                  ],
                  [
                    "Location",
                    [
                      ["region", "Region", "e.g. Northern Africa"],
                      ["country", "Country", "e.g. Kenya"],
                      ["city", "City / Study area", "e.g. Nairobi"],
                      ["siteDescription", "Site description", "e.g. Urban - Residential"],
                    ],
                  ],
                  [
                    "Methodology & period",
                    [],
                  ],
                  [
                    "Article",
                    [
                      ["title", "Title", ""],
                      ["author", "Authors", ""],
                      ["journal", "Journal", ""],
                      ["identifier", "DOI / Identifier", ""],
                    ],
                  ],
                ] as [string, [TextField, string, string][]][]
              ).map(([section, fields]) =>
                section === "Methodology & period" ? (
                  <div key={section} className="space-y-3">
                    <div className="flex items-center justify-between pt-2">
                      <h4 className="text-[11px] font-semibold uppercase tracking-widest text-blue-600">
                        {section}
                      </h4>
                      <button
                        type="button"
                        onClick={() =>
                          setEditor({
                            ...editor,
                            values: {
                              ...editor.values,
                              methodologies: [
                                ...editor.values.methodologies,
                                emptyMethodology(),
                              ],
                            },
                          })
                        }
                        className="flex items-center gap-1 rounded-lg border border-blue-200 px-2 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-50"
                      >
                        <Plus size={12} /> Add methodology
                      </button>
                    </div>
                    {editor.values.methodologies.map((entry, index) => {
                      const update = (patch: Partial<MethodologyEntry>) =>
                        setEditor({
                          ...editor,
                          values: {
                            ...editor.values,
                            methodologies: editor.values.methodologies.map(
                              (m, i) => (i === index ? { ...m, ...patch } : m),
                            ),
                          },
                        });
                      const remove = () => {
                        if (
                          entry.id &&
                          !window.confirm(
                            "Remove this methodology? Its measurements are deleted when you save.",
                          )
                        ) {
                          return;
                        }
                        const rest = editor.values.methodologies.filter(
                          (_, i) => i !== index,
                        );
                        setEditor({
                          ...editor,
                          values: {
                            ...editor.values,
                            methodologies: rest.length
                              ? rest
                              : [emptyMethodology()],
                          },
                        });
                      };
                      const inputClass =
                        "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400";
                      const labelClass =
                        "text-[11px] uppercase tracking-widest text-slate-400";
                      return (
                        <div
                          key={entry.id ?? `new-${index}`}
                          className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-slate-500">
                              Methodology {index + 1}
                            </span>
                            {(editor.values.methodologies.length > 1 ||
                              entry.id) && (
                              <button
                                type="button"
                                title="Remove methodology"
                                onClick={remove}
                                className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                          <label className="block">
                            <span className={labelClass}>Methodology</span>
                            <textarea
                              rows={3}
                              value={entry.methodology}
                              onChange={(e) =>
                                update({ methodology: e.target.value })
                              }
                              className={`${inputClass} resize-y`}
                            />
                          </label>
                          <label className="block">
                            <span className={labelClass}>Sampling period</span>
                            <input
                              value={entry.samplingPeriod}
                              placeholder="e.g. 2006 - 2015"
                              onChange={(e) =>
                                update({ samplingPeriod: e.target.value })
                              }
                              className={inputClass}
                            />
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            <label className="block">
                              <span className={labelClass}>Start year</span>
                              <input
                                value={entry.yearFrom}
                                inputMode="numeric"
                                placeholder="e.g. 2020"
                                onChange={(e) =>
                                  update({ yearFrom: e.target.value })
                                }
                                className={inputClass}
                              />
                            </label>
                            <label className="block">
                              <span className={labelClass}>End year</span>
                              <input
                                value={entry.yearTo}
                                inputMode="numeric"
                                placeholder="e.g. 2021"
                                onChange={(e) =>
                                  update({ yearTo: e.target.value })
                                }
                                className={inputClass}
                              />
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                <div key={section} className="space-y-3">
                  <h4 className="pt-2 text-[11px] font-semibold uppercase tracking-widest text-blue-600">
                    {section}
                  </h4>
                  {fields.map(([key, label, placeholder]) => (
                    <label key={key} className="block">
                      <span className="text-[11px] uppercase tracking-widest text-slate-400">
                        {label}
                      </span>
                      <input
                        value={editor.values[key]}
                        list={
                          key === "country"
                            ? "study-countries"
                            : key === "region"
                              ? "study-regions"
                              : undefined
                        }
                        placeholder={placeholder}
                        onChange={(e) =>
                          setEditor({
                            ...editor,
                            values: { ...editor.values, [key]: e.target.value },
                          })
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400"
                      />
                    </label>
                  ))}
                </div>
                ),
              )}
              <div className="space-y-3">
                <h4 className="pt-2 text-[11px] font-semibold uppercase tracking-widest text-blue-600">
                  Measurements
                </h4>
                {editor.values.methodologies.map((entry, index) => (
                  <div
                    key={entry.id ?? `new-${index}`}
                    className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/50 p-3"
                  >
                    <span className="text-[11px] font-semibold text-slate-500">
                      Methodology {index + 1}
                    </span>
                    <MeasurementsEditor
                      variables={variables}
                      items={entry.measurements}
                      onChange={(measurements) =>
                        setEditor({
                          ...editor,
                          values: {
                            ...editor.values,
                            methodologies: editor.values.methodologies.map(
                              (m, i) =>
                                i === index ? { ...m, measurements } : m,
                            ),
                          },
                        })
                      }
                    />
                  </div>
                ))}
              </div>
              <datalist id="study-countries">
                {allCountries.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <datalist id="study-regions">
                {STUDY_REGIONS.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </div>
            {actionError && (
              <p className="mt-3 text-[12px] text-red-600">{actionError}</p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setEditor(null)}
                disabled={busy}
                className="rounded-xl border border-slate-200 px-4 py-2 text-[12px] text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={saveEditor}
                disabled={busy}
                className="rounded-xl bg-blue-600 px-4 py-2 text-[12px] font-medium text-white hover:bg-blue-700 disabled:opacity-40"
              >
                {busy ? "Saving…" : editor.id ? "Save changes" : "Create study"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="font-semibold text-slate-800">Delete study?</h3>
            <p className="mt-2 text-[12px] text-slate-500">
              “{deleting.title || deleting.source}” and its related records
              will be permanently removed.
            </p>
            {actionError && (
              <p className="mt-3 text-[12px] text-red-600">{actionError}</p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setDeleting(null)}
                disabled={busy}
                className="rounded-xl border border-slate-200 px-4 py-2 text-[12px] text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={busy}
                className="rounded-xl bg-red-600 px-4 py-2 text-[12px] font-medium text-white hover:bg-red-700 disabled:opacity-40"
              >
                {busy ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Data Management Tab ──────────────────────────────────────────────────────

function DataManagementTab() {
  const [subTab, setSubTab] = useState<"import" | "form" | "browse">("import");
  const [dragging, setDragging] = useState(false);
  const [csvData, setCsvData] = useState<{
    headers: string[];
    rows: string[][];
  } | null>(null);
  const [csvFile, setCsvFile] = useState<string>("");
  const [importStatus, setImportStatus] = useState<"idle" | "preview" | "done">(
    "idle",
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: "",
    author: "",
    journal: "",
    country: "",
    region: "",
    yearFrom: "",
    yearTo: "",
    doi: "",
  });
  const [formSaved, setFormSaved] = useState(false);

  const handleFile = (file: File) => {
    setCsvFile(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
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
    setForm({
      title: "",
      author: "",
      journal: "",
      country: "",
      region: "",
      yearFrom: "",
      yearTo: "",
      doi: "",
    });
  };

  const { data: browseResult, loading: browseLoading } = useAsync(
    () => queryStudies({ sort: "yearDesc", pageSize: 50 }),
    [],
  );

  return (
    <div className="space-y-4">
      {/* Sub-tab pills */}
      <div className="flex gap-2">
        {(["import", "form", "browse"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${subTab === t ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            {t === "import"
              ? "Import CSV"
              : t === "form"
                ? "Add Study"
                : "Browse / Filter"}
          </button>
        ))}
      </div>

      {/* ── Import CSV ── */}
      {subTab === "import" && (
        <div className="space-y-4">
          {/* Drop zone */}
          {importStatus === "idle" && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={`bg-white rounded-2xl border-2 border-dashed p-12 text-center transition cursor-pointer ${dragging ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-blue-300"}`}
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={32} className="mx-auto text-slate-300 mb-3" />
              <div className="text-sm font-medium text-slate-700">
                Drop your CSV file here, or click to browse
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Supports .csv files. Headers must match the ARC-Air dataset
                schema.
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) =>
                  e.target.files?.[0] && handleFile(e.target.files[0])
                }
              />
            </div>
          )}

          {/* CSV preview */}
          {importStatus === "preview" && csvData && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-800">{csvFile}</div>
                  <div className="text-[12px] text-slate-500">
                    {csvData.rows.length} rows · {csvData.headers.length}{" "}
                    columns detected
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setCsvData(null);
                      setImportStatus("idle");
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-[12px] text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setImportStatus("done")}
                    className="px-4 py-1.5 rounded-lg bg-emerald-500 text-white text-[12px] font-semibold hover:bg-emerald-600"
                  >
                    Confirm Import
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="min-w-full text-[11px]">
                  <thead className="bg-slate-50">
                    <tr>
                      {csvData.headers.map((h) => (
                        <th
                          key={h}
                          className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-slate-400 font-medium whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvData.rows.slice(0, 10).map((row, i) => (
                      <tr
                        key={i}
                        className="border-t border-slate-50 hover:bg-slate-50/60"
                      >
                        {row.map((cell, j) => (
                          <td
                            key={j}
                            className="py-2 px-3 text-slate-600 max-w-45 truncate"
                          >
                            {cell || "Not available"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {csvData.rows.length > 10 && (
                <div className="text-[11px] text-slate-400 text-center">
                  Showing 10 of {csvData.rows.length} rows
                </div>
              )}
            </div>
          )}

          {importStatus === "done" && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center space-y-3">
              <CheckCircle size={40} className="mx-auto text-emerald-500" />
              <div className="font-semibold text-slate-800">
                Import Successful
              </div>
              <div className="text-[12px] text-slate-500">
                {csvData?.rows.length} records from <strong>{csvFile}</strong>{" "}
                were added to the database.
              </div>
              <button
                onClick={() => {
                  setCsvData(null);
                  setCsvFile("");
                  setImportStatus("idle");
                }}
                className="mt-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
              >
                Import another file
              </button>
            </div>
          )}

          {/* Schema reference */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h4 className="text-sm font-semibold text-slate-800 mb-3">
              Expected CSV Schema
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {[
                "Country",
                "Region",
                "Source",
                "Author",
                "Journal",
                "Title",
                "Year From",
                "Year To",
                "Study Area",
                "Methodology",
                "Sampling Period",
                "Description",
              ].map((col) => (
                <div
                  key={col}
                  className="rounded-lg bg-slate-50 px-3 py-1.5 text-[11px] font-mono text-slate-600"
                >
                  {col}
                </div>
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
              <CheckCircle size={15} /> Study saved successfully (session only;
              connect backend to persist).
            </div>
          )}
          <div className="grid md:grid-cols-2 gap-4">
            {(
              [
                ["Title", "title", "Full study title"],
                ["Authors", "author", "e.g. Chirmata et al."],
                ["Journal", "journal", "Journal name"],
                ["Country", "country", "Country of study"],
                ["Region", "region", "e.g. Northern Africa"],
                ["DOI / URL", "doi", "https://doi.org/…"],
              ] as [string, keyof typeof form, string][]
            ).map(([label, key, placeholder]) => (
              <label key={key} className="block">
                <span className="text-[11px] font-medium text-slate-600">
                  {label}
                </span>
                <input
                  value={form[key]}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [key]: e.target.value }))
                  }
                  placeholder={placeholder}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition"
                />
              </label>
            ))}
            <div className="grid grid-cols-2 gap-4 md:col-span-2">
              {(["yearFrom", "yearTo"] as const).map((key) => (
                <label key={key} className="block">
                  <span className="text-[11px] font-medium text-slate-600">
                    {key === "yearFrom" ? "Year From" : "Year To"}
                  </span>
                  <input
                    type="number"
                    min={1990}
                    max={2025}
                    value={form[key]}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, [key]: e.target.value }))
                    }
                    placeholder="e.g. 2022"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition"
                  />
                </label>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="text-[11px] font-medium text-slate-600">
              Study Areas (one per line)
            </span>
            <textarea
              rows={3}
              placeholder="Casablanca&#10;Marrakesh&#10;Rabat"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition resize-none"
            />
          </label>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() =>
                setForm({
                  title: "",
                  author: "",
                  journal: "",
                  country: "",
                  region: "",
                  yearFrom: "",
                  yearTo: "",
                  doi: "",
                })
              }
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
            >
              Reset
            </button>
            <button
              onClick={handleFormSubmit}
              disabled={!form.title || !form.country}
              className="px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 transition"
            >
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
                  {["Title", "Country", "Year", "Records", "Areas"].map((h) => (
                    <th
                      key={h}
                      className="text-left py-3 px-4 text-[10px] uppercase tracking-widest text-slate-400 font-medium"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {browseLoading && (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-10 text-center text-slate-400"
                    >
                      Loading…
                    </td>
                  </tr>
                )}
                {(browseResult?.items ?? []).map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-slate-50 hover:bg-blue-50/20"
                  >
                    <td className="py-2.5 px-4 max-w-75 truncate font-medium text-slate-700">
                      {s.title}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap">
                      {s.country}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap tabular-nums">
                      {s.yearTo ?? "Not available"}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500">
                      {s.records.length}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500">
                      {new Set(s.records.map((r) => r.studyArea)).size}
                    </td>
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
  const avgDaily = Math.round(totalVisits / VISITOR_DATA.length);

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Visits (30d)"
          value={totalVisits.toLocaleString()}
          delta="+18%"
          Icon={Eye}
          iconBg="bg-blue-500"
        />
        <StatCard
          label="Avg Daily Visits"
          value={avgDaily}
          delta="+12%"
          Icon={TrendingUp}
          iconBg="bg-violet-500"
        />
        <StatCard
          label="Countries Reached"
          value={38}
          delta="+3"
          Icon={Globe}
          iconBg="bg-emerald-500"
        />
        <StatCard
          label="Avg Session (min)"
          value="4.2"
          delta="+8%"
          Icon={Clock}
          iconBg="bg-amber-500"
        />
      </div>

      {/* Daily visits chart */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="mb-4">
          <div className="text-[11px] uppercase tracking-widest text-slate-400">
            Traffic
          </div>
          <h3 className="font-semibold text-slate-800">
            Daily Visitor Traffic, Last 30 Days
          </h3>
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
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              interval={4}
            />
            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
            <Area
              type="monotone"
              dataKey="visits"
              stroke="#3B82F6"
              fill="url(#visitGrad)"
              strokeWidth={2}
              dot={false}
              name="Total Visits"
            />
            <Area
              type="monotone"
              dataKey="unique"
              stroke="#10B981"
              fill="url(#uniqueGrad)"
              strokeWidth={2}
              dot={false}
              name="Unique Visitors"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Visitor origin table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="mb-4">
          <div className="text-[11px] uppercase tracking-widest text-slate-400">
            Geography
          </div>
          <h3 className="font-semibold text-slate-800">
            Visitors by Country of Origin
          </h3>
        </div>
        <div className="space-y-3">
          {VISITOR_COUNTRIES.map((v, i) => (
            <div key={v.country} className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-sm shrink-0"
                style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
              />
              <div className="flex-1 flex items-center gap-3">
                <span className="text-sm text-slate-700 w-32">{v.country}</span>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${v.pct}%`,
                      background: PIE_COLORS[i % PIE_COLORS.length],
                    }}
                  />
                </div>
                <span className="text-[12px] text-slate-500 tabular-nums w-10 text-right">
                  {v.pct}%
                </span>
                <span className="text-[12px] text-slate-400 tabular-nums w-14 text-right">
                  {v.visits.toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab() {
  const [saved, setSaved] = useState(false);
  const save = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

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
          ["Platform name", "African Air Database"],
          ["Organisation", "ARC-Air · UM6P"],
          ["Contact email", "africanairdatabase@um6p.ma"],
          ["Data update freq", "Weekly"],
        ].map(([label, def]) => (
          <label key={label} className="block">
            <span className="text-[11px] font-medium text-slate-600">
              {label}
            </span>
            <input
              defaultValue={def}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition"
            />
          </label>
        ))}
      </div>
      <button
        onClick={save}
        className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition"
      >
        Save Settings
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminDashboard({
  onLogout,
  userEmail,
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const initials =
    userEmail
      .split("@")[0]
      .split(".")
      .map((s) => s[0]?.toUpperCase())
      .join("")
      .slice(0, 2) || "AD";

  const TAB_LABELS: Record<AdminTab, string> = {
    dashboard: "Dashboard",
    research: "Research Data",
    data: "Data Management",
    analytics: "Analytics",
    requests: "Collaboration Requests",
    users: "Users & Permissions",
    activity: "Activity History",
    settings: "Settings",
  };

  return (
    <div
      className="flex flex-1 overflow-hidden"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* ── Sidebar ── */}
      <aside
        className="w-56 shrink-0 flex flex-col"
        style={{ background: "#0F1724" }}
      >
        {/* Logo */}
        <div className="px-4 pt-5 pb-4 border-b border-white/10">
          <img
            src={arcairLogo}
            alt="ARC-Air logo"
            className="h-12 w-auto object-contain drop-shadow-sm"
          />
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {SIDEBAR_NAV.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition text-left ${
                  active
                    ? "bg-blue-600 text-white font-medium"
                    : "text-white/55 hover:text-white hover:bg-white/8"
                }`}
              >
                <Icon
                  size={15}
                  className={active ? "text-white" : "text-white/40"}
                />
                {label}
                {id === "data" && (
                  <span className="ml-auto rounded-full bg-amber-500 text-white text-[10px] px-1.5 py-0.5 leading-none font-bold">
                    43
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User profile */}
        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-[12px] font-bold shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium text-white truncate">
                {userEmail.split("@")[0]}
              </div>
              <div className="text-[10px] text-white/40">Administrator</div>
            </div>
            <button
              onClick={onLogout}
              title="Log out"
              className="text-white/30 hover:text-white/70 transition"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-50">
        {/* Header */}
        <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between shrink-0 shadow-sm">
          <div>
            
            <h1 className="text-lg font-semibold text-slate-900 mt-0.5">
              {TAB_LABELS[activeTab]}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-200">
              <Search size={13} className="text-slate-400" />
              <input
                placeholder="Search…"
                className="bg-transparent text-sm outline-none text-slate-700 placeholder:text-slate-400 w-32"
              />
            </div>
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-[12px] font-bold">
              {initials}
            </div>
          </div>
        </header>

        {/* Page body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "dashboard" && (
            <DashboardTab onNavigate={setActiveTab} />
          )}
          {activeTab === "research" && <ResearchDataTab />}
          {activeTab === "data" && <DataManagementTab />}
          {activeTab === "analytics" && <AnalyticsTab />}
          {activeTab === "requests" && <CollaborationRequestsTab />}
          {activeTab === "users" && <UsersPermissionsTab />}
          {activeTab === "activity" && <ActivityHistoryTab />}
          {activeTab === "settings" && <SettingsTab />}
        </div>
      </main>
    </div>
  );
}
