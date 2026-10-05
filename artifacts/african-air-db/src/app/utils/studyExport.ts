import type { Study } from "../types/arcair";

export interface ExportPollutantInfo {
  name: string;
  unit: string;
}

const CSV_HEADERS = [
  "Study title",
  "Source citation",
  "Country",
  "Study area",
  "Author",
  "Journal",
  "Publication year",
  "Sampling period",
  "DOI or URL",
  "Methodology",
  "Site description",
  "Pollutant",
  "Unit",
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

  return `"${text.replace(/"/g, '""')}"`;
}

export function buildStudyCsv(
  studies: readonly Study[],
  pollutantInfo: ReadonlyMap<string, ExportPollutantInfo> = new Map(),
): string {
  const rows: (string | number | null | undefined)[][] = [CSV_HEADERS];

  for (const study of studies) {
    const records = study.records.length > 0 ? study.records : [null];

    for (const record of records) {
      const measurements = record
        ? Object.entries(record.measurements)
        : [];
      const entries: [string, (typeof measurements)[number][1] | null][] =
        measurements.length > 0 ? measurements : [["", null]];

      for (const [key, measurement] of entries) {
        const pollutant = pollutantInfo.get(key);
        rows.push([
          study.title || "Untitled Study",
          study.source,
          study.country,
          record?.studyArea,
          study.author,
          study.journal,
          study.publicationYear,
          record?.samplingPeriod,
          study.identifier,
          record?.methodology,
          record?.description,
          pollutant?.name ?? key,
          pollutant?.unit,
          measurement?.mean ?? measurement?.raw,
          measurement?.sd,
          measurement?.min,
          measurement?.max,
        ]);
      }
    }
  }

  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
