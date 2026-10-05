export interface StudiesByYearRow {
  year: number;
  total_studies: number;
}

export interface PollutionVariableRow {
  pollution_variable: string;
  study_count: number;
  variable_type: string;
  percentage: number;
}

const ANALYTICS_BASE = "/api/v1/analytics";

async function getAnalyticsResponse(path: string): Promise<unknown> {
  const response = await fetch(`${ANALYTICS_BASE}/${path}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Analytics request failed (${response.status})`);
  }

  return response.json() as Promise<unknown>;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export async function getStudiesByYear(): Promise<StudiesByYearRow[]> {
  const payload = await getAnalyticsResponse("studies-by-year");
  if (!Array.isArray(payload)) {
    throw new Error("Studies-by-year response must be an array");
  }

  return payload.map((row: unknown, index: number) => {
    if (
      typeof row !== "object" ||
      row === null ||
      !("year" in row) ||
      !("total_studies" in row) ||
      !isFiniteNumber(row.year) ||
      !Number.isInteger(row.year) ||
      !isFiniteNumber(row.total_studies) ||
      row.total_studies < 0
    ) {
      throw new Error(`Invalid studies-by-year row at index ${index}`);
    }

    return { year: row.year, total_studies: row.total_studies };
  });
}

export async function getPollutionVariables(): Promise<PollutionVariableRow[]> {
  const payload = await getAnalyticsResponse("pollution-variables");
  if (!Array.isArray(payload)) {
    throw new Error("Pollution-variables response must be an array");
  }

  return payload.map((row: unknown, index: number) => {
    if (
      typeof row !== "object" ||
      row === null ||
      !("pollution_variable" in row) ||
      !("study_count" in row) ||
      !("variable_type" in row) ||
      !("percentage" in row) ||
      typeof row.pollution_variable !== "string" ||
      typeof row.variable_type !== "string" ||
      !isFiniteNumber(row.study_count) ||
      row.study_count < 0 ||
      !isFiniteNumber(row.percentage)
    ) {
      throw new Error(`Invalid pollution-variables row at index ${index}`);
    }

    return {
      pollution_variable: row.pollution_variable,
      study_count: row.study_count,
      variable_type: row.variable_type,
      percentage: row.percentage,
    };
  });
}
