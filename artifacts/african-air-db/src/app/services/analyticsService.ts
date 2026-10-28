import { apiUrl } from "./apiUrl";

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

export interface MeasurementStatistics {
  total_measurements: number;
  avg_measurements_per_study: number;
  measurements_by_category: Record<string, number>;
}

async function getAnalyticsResponse(path: string): Promise<unknown> {
  const response = await fetch(apiUrl(`/api/v1/analytics/${path}`), {
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

export async function getMeasurementStatistics(): Promise<MeasurementStatistics> {
  const payload = await getAnalyticsResponse("measurement-statistics");
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("measurements_by_category" in payload) ||
    typeof payload.measurements_by_category !== "object" ||
    payload.measurements_by_category === null ||
    Array.isArray(payload.measurements_by_category)
  ) {
    throw new Error("Measurement-statistics response is invalid");
  }

  const byCategory: Record<string, number> = {};
  for (const [category, count] of Object.entries(
    payload.measurements_by_category,
  )) {
    if (!isFiniteNumber(count) || count < 0) {
      throw new Error(`Invalid measurement count for category "${category}"`);
    }
    byCategory[category] = count;
  }

  const total =
    "total_measurements" in payload && isFiniteNumber(payload.total_measurements)
      ? payload.total_measurements
      : Object.values(byCategory).reduce((sum, count) => sum + count, 0);
  const average =
    "avg_measurements_per_study" in payload &&
    isFiniteNumber(payload.avg_measurements_per_study)
      ? payload.avg_measurements_per_study
      : 0;

  return {
    total_measurements: total,
    avg_measurements_per_study: average,
    measurements_by_category: byCategory,
  };
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
