import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAsync } from "../hooks/useData";
import {
  getPollutionVariables,
  getStudiesByYear,
} from "../services/analyticsService";

const CATEGORY_COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#F97316",
];

const CATEGORY_LABELS: Record<string, string> = {
  bulk_pm: "Bulk PM",
  carbonaceous: "Carbonaceous aerosols",
  gas: "Atmospheric gases",
  organic: "Organic pollutants",
  trace_metals: "Trace metals",
  wsia: "Water soluble inorganic aerosols",
};

const axisTick = { fontSize: 12, fontWeight: 500, fill: "#334155" };
const tooltipStyle = {
  fontSize: 12,
  borderRadius: 8,
  border: "1px solid #E2E8F0",
  boxShadow: "0 8px 24px rgba(23, 34, 53, 0.08)",
};

export default function AnalyticsCharts() {
  const [yearRequest, setYearRequest] = useState(0);
  const [pollutantRequest, setPollutantRequest] = useState(0);

  return (
    <section
      className="space-y-4 animate-in fade-in duration-700 delay-200 slide-in-from-bottom-4 fill-mode-both"
      aria-label="Research analytics"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Evidence at a glance
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Publication history and the range of pollutants documented.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-4">
        <AnnualStudiesCard
          key={`annual-${yearRequest}`}
          onRetry={() => setYearRequest((request) => request + 1)}
        />
        <PollutantDistributionCard
          key={`pollutant-${pollutantRequest}`}
          onRetry={() => setPollutantRequest((request) => request + 1)}
        />
      </div>
    </section>
  );
}

function AnnualStudiesCard({ onRetry }: { onRetry: () => void }) {
  const studies = useAsync(getStudiesByYear, []);
  const annualData = useMemo(
    () =>
      (studies.data ?? [])
        .slice()
        .sort((a, b) => a.year - b.year)
        .map(({ year, total_studies }) => ({
          year: String(year),
          count: total_studies,
        })),
    [studies.data],
  );

  return (
    <article className="flex h-full min-w-0 flex-col rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="mb-4">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Trend
        </div>
        <h2 className="text-base font-semibold text-foreground">
          Studies Published Per Year
        </h2>
      </div>
      {studies.loading ? (
        <ChartLoading label="Loading annual study totals" />
      ) : studies.error ? (
        <ChartError
          message="Annual study totals could not be loaded."
          onRetry={onRetry}
        />
      ) : annualData.length === 0 ? (
        <ChartEmpty message="No annual study totals are available yet." />
      ) : (
        <div
          className="min-h-52 min-w-0 flex-1 sm:min-h-56"
          role="img"
          aria-label="Area chart showing total studies by publication year"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={annualData}
              margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
            >
              <defs>
                <linearGradient
                  id="homeStudiesGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.015} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDF1F6" />
              <XAxis
                dataKey="year"
                tick={axisTick}
                tickLine={false}
                axisLine={{ stroke: "#94A3B8", strokeWidth: 1 }}
                minTickGap={24}
              />
              <YAxis
                tick={axisTick}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={42}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value) => [Number(value).toLocaleString(), "Studies"]}
                labelFormatter={(label) => `Year ${label}`}
              />
              <Area
                type="monotone"
                dataKey="count"
                name="Studies"
                stroke="#3B82F6"
                strokeWidth={2.25}
                fill="url(#homeStudiesGradient)"
                activeDot={{ r: 4, strokeWidth: 0 }}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </article>
  );
}

function PollutantDistributionCard({ onRetry }: { onRetry: () => void }) {
  const pollutants = useAsync(getPollutionVariables, []);
  const categoryData = useMemo(() => {
    const variablesByType = new Map<string, Set<string>>();
    for (const row of pollutants.data ?? []) {
      const category = row.variable_type.trim() || "Unclassified";
      const variable = row.pollution_variable.trim();
      if (!variable) continue;
      const variables = variablesByType.get(category) ?? new Set<string>();
      variables.add(variable);
      variablesByType.set(category, variables);
    }

    return Array.from(variablesByType.entries())
      .map(([name, variables]) => ({
        name: CATEGORY_LABELS[name.toLowerCase()] ??
          name.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
        full: CATEGORY_LABELS[name.toLowerCase()] ??
          name.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
        value: variables.size,
      }))
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  }, [pollutants.data]);

  return (
    <article className="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="mb-3">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Composition
        </div>
        <h2 className="text-base font-semibold text-foreground">
          Pollutant Distribution
        </h2>
      </div>
      {pollutants.loading ? (
        <ChartLoading label="Loading pollutant categories" />
      ) : pollutants.error ? (
        <ChartError
          message="Pollutant categories could not be loaded."
          onRetry={onRetry}
        />
      ) : categoryData.length === 0 ? (
        <ChartEmpty message="No pollutant categories are available yet." />
      ) : (
        <>
          <div
            className="h-40 min-w-0"
            role="img"
            aria-label="Donut chart showing unique pollutant variables by category"
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={68}
                  paddingAngle={2}
                  stroke="var(--card)"
                  strokeWidth={2}
                >
                  {categoryData.map((item, index) => (
                    <Cell
                      key={item.name}
                      fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value, _name, item) => [
                    `${Number(value).toLocaleString()} ${
                      Number(value) === 1 ? "variable" : "variables"
                    }`,
                    item.payload?.full ?? "",
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-1.5">
            {categoryData.map((item, index) => (
              <div
                key={item.name}
                className="flex items-start justify-between gap-3 text-[11px]"
              >
                <span className="flex min-w-0 items-start gap-2">
                  <span
                    className="mt-1 h-2 w-2 shrink-0 rounded-full"
                    style={{
                      backgroundColor:
                        CATEGORY_COLORS[index % CATEGORY_COLORS.length],
                    }}
                  />
                  <span className="leading-snug text-muted-foreground">
                    {item.full}
                  </span>
                </span>
                <span className="shrink-0 font-medium tabular-nums text-foreground">
                  {item.value.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
            Counts are unique pollutant variables per category; studies may
            report multiple pollutants.
          </p>
        </>
      )}
    </article>
  );
}

function ChartLoading({
  label,
}: {
  label: string;
}) {
  return (
    <div className="h-56 animate-pulse rounded-xl bg-muted/70" role="status" aria-label={label}>
      <div className="flex h-full items-end gap-3 px-6 pb-6 pt-8">
        <div className="h-1/3 w-full rounded-t bg-border/70" />
        <div className="h-2/3 w-full rounded-t bg-border/70" />
        <div className="h-1/2 w-full rounded-t bg-border/70" />
        <div className="h-4/5 w-full rounded-t bg-border/70" />
        <div className="h-3/5 w-full rounded-t bg-border/70" />
        <div className="h-full w-full rounded-t bg-border/70" />
      </div>
    </div>
  );
}

function ChartError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex h-56 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 px-5 text-center" role="alert">
      <p className="text-sm text-muted-foreground">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-md px-3 py-1.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        Try again
      </button>
    </div>
  );
}

function ChartEmpty({
  message,
}: {
  message: string;
}) {
  return (
    <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 px-5 text-center" role="status">
      <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
        {message}
      </p>
    </div>
  );
}
