import type { Study } from "../types/arcair";

export interface ExportPollutantInfo {
  name: string;
  unit: string;
}

const CSV_HEADERS = [
  "Study ID",
  "Study title",
  "Source citation",
  "Region",
  "Country",
  "Record ID",
  "Study area",
  "Author",
  "Journal",
  "Publication year",
  "Sampling period",
  "DOI or URL",
  "Methodology",
  "Site description",
  "Data processing",
  "Pollutant key",
  "Pollutant",
  "Unit",
  "Reported value",
  "Mean value",
  "Standard deviation",
  "Minimum value",
  "Maximum value",
];

function csvCell(value: string | number | null | undefined): string {
  let text = value == null ? "" : String(value);

  // Keep spreadsheet programs from treating API-provided text as a formula.
  if (typeof value === "string" && /^[\t\r ]*[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  // Normalise line breaks so every row stays on one logical line in Excel.
  text = text.replace(/\r\n|\r|\n/g, " ");

  return `"${text.replace(/"/g, '""')}"`;
}

const SEPARATOR = "; ";

function distinct(values: readonly (string | number | null | undefined)[]): string {
  const seen = new Set<string>();
  for (const value of values) {
    const text = value == null ? "" : String(value).trim();
    if (text) seen.add(text);
  }
  return Array.from(seen).join(SEPARATOR);
}

function formatNumber(value: number | null | undefined): string | null {
  return value == null ? null : String(value);
}

export function buildStudyCsv(
  studies: readonly Study[],
  pollutantInfo: ReadonlyMap<string, ExportPollutantInfo> = new Map(),
): string {
  const rows: (string | number | null | undefined)[][] = [CSV_HEADERS];
  const pollutantOrder = new Map(
    Array.from(pollutantInfo.keys()).map((key, index) => [key, index]),
  );

  // One row per Study ID: merge duplicate study objects before aggregating.
  const byId = new Map<string, Study[]>();
  for (const study of studies) {
    const group = byId.get(study.id);
    if (group) group.push(study);
    else byId.set(study.id, [study]);
  }

  for (const [studyId, group] of byId) {
    const study = group[0];
    const records = group.flatMap((item) => item.records);
    const multipleRecords = records.length > 1;

    const keys: string[] = [];
    const reported: string[] = [];
    const means: string[] = [];
    const sds: string[] = [];
    const mins: string[] = [];
    const maxes: string[] = [];
    const units: string[] = [];
    const names: string[] = [];

    for (const record of records) {
      const measurements = Object.entries(record.measurements).sort(
        ([left], [right]) =>
          (pollutantOrder.get(left) ?? Number.MAX_SAFE_INTEGER) -
            (pollutantOrder.get(right) ?? Number.MAX_SAFE_INTEGER) ||
          left.localeCompare(right),
      );

      for (const [key, measurement] of measurements) {
        const pollutant = pollutantInfo.get(key);
        const name = pollutant?.name ?? key;
        // Label each value with its pollutant (and site when several records exist)
        // so aggregated cells stay traceable to the original measurement.
        const label =
          multipleRecords && record.studyArea
            ? `${name} (${record.studyArea})`
            : name;
        const labelled = (value: string | null) =>
          value == null || value === "" ? null : `${label}: ${value}`;

        keys.push(key);
        names.push(name);
        if (pollutant?.unit) units.push(`${name}: ${pollutant.unit}`);
        reported.push(labelled(measurement.raw) ?? "");
        means.push(labelled(formatNumber(measurement.mean)) ?? "");
        sds.push(labelled(formatNumber(measurement.sd)) ?? "");
        mins.push(labelled(formatNumber(measurement.min)) ?? "");
        maxes.push(labelled(formatNumber(measurement.max)) ?? "");
      }
    }

    rows.push([
      studyId,
      study.title || "Untitled Study",
      distinct(group.map((item) => item.source)),
      distinct(group.map((item) => item.region)),
      distinct(group.map((item) => item.country)),
      distinct(records.map((record) => record.id)),
      distinct(records.map((record) => record.studyArea)),
      distinct(group.map((item) => item.author)),
      distinct(group.map((item) => item.journal)),
      study.publicationYear,
      distinct(records.map((record) => record.samplingPeriod)),
      distinct(group.map((item) => item.identifier)),
      distinct(records.map((record) => record.methodology)),
      distinct(records.map((record) => record.description)),
      distinct(group.map((item) => item.dataProcessing)),
      distinct(keys),
      distinct(names),
      distinct(units),
      distinct(reported),
      distinct(means),
      distinct(sds),
      distinct(mins),
      distinct(maxes),
    ]);
  }

  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

