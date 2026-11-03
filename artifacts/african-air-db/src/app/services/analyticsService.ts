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

export interface DashboardSummary {
  total_studies: number;
  total_countries: number;
  total_pollution_variables: number;
  total_variables: number;
  latest_publication_year: number;
  oldest_publication_year: number;
  top_country: string | number;
  top_pollution_variable: string | number;
}

export interface StudiesByCountryRow {
  country: string;
  total_studies: number;
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

const numberOrZero = (value: unknown): number =>
  isFiniteNumber(value) ? value : 0;
const textOrZero = (value: unknown): string | number =>
  typeof value === "string" && value.trim() ? value : 0;

/** Missing or null fields fall back to 0 so the dashboard never shows blanks. */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const payload = await getAnalyticsResponse("dashboard-summary");
  const data =
    typeof payload === "object" && payload !== null
      ? (payload as Record<string, unknown>)
      : {};

  return {
    total_studies: numberOrZero(data.total_studies),
    total_countries: numberOrZero(data.total_countries),
    total_pollution_variables: numberOrZero(data.total_pollution_variables),
    total_variables: numberOrZero(data.total_variables),
    latest_publication_year: numberOrZero(data.latest_publication_year),
    oldest_publication_year: numberOrZero(data.oldest_publication_year),
    top_country: textOrZero(data.top_country),
    top_pollution_variable: textOrZero(data.top_pollution_variable),
  };
}

export async function getStudiesByCountry(
  limit?: number,
): Promise<StudiesByCountryRow[]> {
  const payload = await getAnalyticsResponse(
    limit ? `studies-by-country?limit=${limit}` : "studies-by-country",
  );
  if (!Array.isArray(payload)) {
    throw new Error("Studies-by-country response must be an array");
  }

  return payload.map((row: unknown, index: number) => {
    if (
      typeof row !== "object" ||
      row === null ||
      !("country" in row) ||
      !("total_studies" in row) ||
      typeof row.country !== "string" ||
      !isFiniteNumber(row.total_studies) ||
      row.total_studies < 0
    ) {
      throw new Error(`Invalid studies-by-country row at index ${index}`);
    }

    return { country: row.country, total_studies: row.total_studies };
  });
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
