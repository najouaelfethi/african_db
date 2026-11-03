import { apiUrl } from "./apiUrl";
import { authFetch } from "./authService";

export interface MeasurementEntry {
  id: string | null;
  variableId: string;
  mean: string;
  sd: string;
  min: string;
  max: string;
  unit: string;
}

export const emptyMeasurement = (): MeasurementEntry => ({
  id: null,
  variableId: "",
  mean: "",
  sd: "",
  min: "",
  max: "",
  unit: "",
});

export interface MethodologyEntry {
  id: string | null;
  periodId: string | null;
  methodology: string;
  samplingPeriod: string;
  yearFrom: string;
  yearTo: string;
  measurements: MeasurementEntry[];
}

export const emptyMethodology = (): MethodologyEntry => ({
  id: null,
  periodId: null,
  methodology: "",
  samplingPeriod: "",
  yearFrom: "",
  yearTo: "",
  measurements: [],
});

export interface StudyFormValues {
  source: string;
  publicationYear: string;
  dataProcessing: string;
  title: string;
  author: string;
  journal: string;
  identifier: string;
  region: string;
  country: string;
  city: string;
  siteDescription: string;
  methodologies: MethodologyEntry[];
}

export interface StudyIds {
  articleId: string | null;
  locationId: string | null;
  methodologyIds: string[];
  measurementIds?: string[];
}

export interface StudyDetail extends StudyIds {
  id: string;
  values: StudyFormValues;
}

const STUDIES = "/api/v1/dashboard/studies";

async function failure(response: Response): Promise<Error> {
  if (response.status === 401 || response.status === 403) {
    return new Error(
      "Not authorized. Sign in with a backend admin account to modify studies.",
    );
  }
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string") return new Error(body.detail);
    if (Array.isArray(body.detail)) {
      const first = body.detail[0] as { msg?: string } | undefined;
      if (first?.msg) return new Error(first.msg);
    }
  } catch {
    // Non-JSON error body: use the status fallback below.
  }
  return new Error(`Request failed with status ${response.status}`);
}

function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function studyBody(values: StudyFormValues) {
  const year = values.publicationYear.trim();
  return {
    source: values.source.trim(),
    publication_year: year ? Number(year) : null,
    data_processing: nullable(values.dataProcessing),
  };
}

function articleBody(values: StudyFormValues) {
  return {
    title: nullable(values.title),
    author: nullable(values.author),
    journal: nullable(values.journal),
    identifier: nullable(values.identifier),
  };
}

function hasArticleData(values: StudyFormValues): boolean {
  return Object.values(articleBody(values)).some((v) => v !== null);
}

function hasLocationData(values: StudyFormValues): boolean {
  return Boolean(
    values.country.trim() ||
      values.city.trim() ||
      values.region.trim() ||
      values.siteDescription.trim(),
  );
}

function hasMethodologyData(entry: MethodologyEntry): boolean {
  return Boolean(
    entry.methodology.trim() ||
      entry.samplingPeriod.trim() ||
      entry.yearFrom.trim() ||
      entry.yearTo.trim() ||
      entry.measurements.some((x) => x.variableId),
  );
}

function hasPeriodData(entry: MethodologyEntry): boolean {
  return Boolean(
    entry.samplingPeriod.trim() || entry.yearFrom.trim() || entry.yearTo.trim(),
  );
}

function toNumber(value: string): number | null {
  const trimmed = value.trim().replace(",", ".");
  return trimmed ? Number(trimmed) : null;
}

function measurementBody(entry: MeasurementEntry) {
  return {
    variable_id: entry.variableId,
    mean_value: toNumber(entry.mean),
    sd_value: toNumber(entry.sd),
    min_value: toNumber(entry.min),
    max_value: toNumber(entry.max),
    unit: nullable(entry.unit),
  };
}

export interface VariableOption {
  id: string;
  name: string;
  category: string;
  unit: string;
}

/** Full variable catalog (public endpoint, paged 500 at a time). */
export async function getVariables(): Promise<VariableOption[]> {
  const all: VariableOption[] = [];
  for (let skip = 0; ; skip += 500) {
    const response = await fetch(apiUrl(`/api/variables/?skip=${skip}&limit=500`));
    if (!response.ok) throw new Error(`Variables API error: ${response.status}`);
    const page = (await response.json()) as {
      id: string;
      name: string;
      category: string;
      default_unit?: string | null;
    }[];
    for (const v of page) {
      all.push({
        id: v.id,
        name: v.name,
        category: v.category,
        unit: v.default_unit ?? "",
      });
    }
    if (page.length < 500) return all;
  }
}

function locationBody(values: StudyFormValues) {
  return {
    region: nullable(values.region),
    country: nullable(values.country),
    study_area: nullable(values.city),
    site_description: nullable(values.siteDescription),
  };
}

function periodBody(entry: MethodologyEntry) {
  const from = entry.yearFrom.trim();
  const to = entry.yearTo.trim();
  return {
    sampling_period_raw: nullable(entry.samplingPeriod),
    start_year: from ? Number(from) : null,
    end_year: to ? Number(to) : from ? Number(from) : null,
  };
}

export interface StudyPlace {
  city: string;
  region: string;
}

/** study_id -> city (study area) and region, from the public map endpoint. */
export async function getStudyPlaces(): Promise<Map<string, StudyPlace>> {
  const response = await fetch(apiUrl("/api/v1/public/map/studies"));
  if (!response.ok) throw new Error(`Map API error: ${response.status}`);
  const body = (await response.json()) as {
    data?: {
      study_id?: string;
      study_area?: string | null;
      region?: string | null;
    }[];
  };
  const places = new Map<string, StudyPlace>();
  for (const row of body.data ?? []) {
    if (row.study_id && (row.study_area || row.region) && !places.has(row.study_id)) {
      places.set(row.study_id, {
        city: row.study_area ?? "",
        region: row.region ?? "",
      });
    }
  }
  return places;
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw await failure(response);
  return (await response.json()) as T;
}

export async function getStudyDetail(id: string): Promise<StudyDetail> {
  const [body, locations, periods, measurements] = await Promise.all([
    authFetch(`${STUDIES}/${id}`).then(
      (r) =>
        readJson<{
          id: string;
          source?: string | null;
          publication_year?: number | null;
          data_processing?: string | null;
          articles?: {
            id: string;
            title?: string | null;
            author?: string | null;
            journal?: string | null;
            identifier?: string | null;
          }[];
          methodologies?: { id: string; methodology?: string | null }[];
        }>(r),
    ),
    authFetch(`${STUDIES}/${id}/locations`).then((r) =>
      readJson<
        {
          id: string;
          methodology_id?: string | null;
          region?: string | null;
          country?: string | null;
          study_area?: string | null;
          site_description?: string | null;
        }[]
      >(r),
    ),
    authFetch(`${STUDIES}/${id}/periods`).then((r) =>
      readJson<
        {
          id: string;
          methodology_id?: string | null;
          sampling_period_raw?: string | null;
          start_year?: number | null;
          end_year?: number | null;
        }[]
      >(r),
    ),
    authFetch(`${STUDIES}/${id}/measurements`).then((r) =>
      readJson<
        {
          id: string;
          methodology_id?: string | null;
          variable_id: string;
          mean_value?: number | null;
          sd_value?: number | null;
          min_value?: number | null;
          max_value?: number | null;
          unit?: string | null;
        }[]
      >(r),
    ),
  ]);
  const article = body.articles?.[0];
  const location = locations[0];
  const methodologies = (body.methodologies ?? []).map((m) => {
    const period = periods.find((p) => p.methodology_id === m.id);
    return {
      id: m.id,
      periodId: period?.id ?? null,
      methodology: m.methodology ?? "",
      samplingPeriod: period?.sampling_period_raw ?? "",
      yearFrom: period?.start_year?.toString() ?? "",
      yearTo: period?.end_year?.toString() ?? "",
      measurements: measurements
        .filter((x) => x.methodology_id === m.id)
        .map((x) => ({
          id: x.id,
          variableId: x.variable_id,
          mean: x.mean_value?.toString() ?? "",
          sd: x.sd_value?.toString() ?? "",
          min: x.min_value?.toString() ?? "",
          max: x.max_value?.toString() ?? "",
          unit: x.unit ?? "",
        })),
    };
  });
  return {
    id: body.id,
    articleId: article?.id ?? null,
    locationId: location?.id ?? null,
    methodologyIds: methodologies.map((m) => m.id),
    measurementIds: measurements.map((x) => x.id),
    values: {
      source: body.source ?? "",
      publicationYear: body.publication_year?.toString() ?? "",
      dataProcessing: body.data_processing ?? "",
      title: article?.title ?? "",
      author: article?.author ?? "",
      journal: article?.journal ?? "",
      identifier: article?.identifier ?? "",
      region: location?.region ?? "",
      country: location?.country ?? "",
      city: location?.study_area ?? "",
      siteDescription: location?.site_description ?? "",
      methodologies: methodologies.length ? methodologies : [emptyMethodology()],
    },
  };
}

async function send(path: string, method: string, body?: unknown) {
  const response = await authFetch(
    path,
    body === undefined ? { method } : jsonInit(method, body),
  );
  if (!response.ok) throw await failure(response);
  return response;
}

/** Saves every methodology block (with its period); returns the first id. */
async function saveMethodologies(
  studyId: string,
  ids: StudyIds,
  values: StudyFormValues,
): Promise<string | null> {
  const kept = new Set(
    values.methodologies.map((m) => m.id).filter((x): x is string => !!x),
  );
  const keptMeasurements = new Set(
    values.methodologies.flatMap((m) =>
      m.measurements.map((x) => x.id).filter((x): x is string => !!x),
    ),
  );
  // Delete removed measurements first; removing a methodology would cascade them.
  for (const oldId of ids.measurementIds ?? []) {
    if (!keptMeasurements.has(oldId)) {
      await send(`${STUDIES}/${studyId}/measurements/${oldId}`, "DELETE");
    }
  }
  for (const oldId of ids.methodologyIds) {
    if (!kept.has(oldId)) {
      await send(`${STUDIES}/${studyId}/methodologies/${oldId}`, "DELETE");
    }
  }

  let firstId: string | null = null;
  for (const entry of values.methodologies) {
    if (!entry.id && !hasMethodologyData(entry)) continue;
    let methodologyId = entry.id;
    const text = nullable(entry.methodology);
    if (methodologyId) {
      await send(`${STUDIES}/${studyId}/methodologies/${methodologyId}`, "PATCH", {
        methodology: text,
      });
    } else {
      const created = await send(`${STUDIES}/${studyId}/methodologies`, "POST", {
        methodology: text ?? "Not specified",
      });
      methodologyId = ((await created.json()) as { id: string }).id;
    }
    firstId ??= methodologyId;

    if (entry.periodId) {
      await send(
        `${STUDIES}/${studyId}/periods/${entry.periodId}`,
        "PATCH",
        periodBody(entry),
      );
    } else if (hasPeriodData(entry)) {
      await send(`${STUDIES}/${studyId}/periods`, "POST", {
        methodology_id: methodologyId,
        ...periodBody(entry),
      });
    }

    for (const item of entry.measurements) {
      if (!item.variableId) continue;
      if (item.id) {
        await send(
          `${STUDIES}/${studyId}/measurements/${item.id}`,
          "PATCH",
          measurementBody(item),
        );
      } else {
        await send(`${STUDIES}/${studyId}/measurements`, "POST", {
          methodology_id: methodologyId,
          ...measurementBody(item),
        });
      }
    }
  }
  return firstId;
}

async function saveLocation(
  studyId: string,
  ids: StudyIds,
  values: StudyFormValues,
  firstMethodologyId: string | null,
): Promise<void> {
  if (ids.locationId) {
    await send(
      `${STUDIES}/${studyId}/locations/${ids.locationId}`,
      "PATCH",
      locationBody(values),
    );
  } else if (hasLocationData(values)) {
    let methodologyId = firstMethodologyId;
    if (!methodologyId) {
      const created = await send(`${STUDIES}/${studyId}/methodologies`, "POST", {
        methodology: "Not specified",
      });
      methodologyId = ((await created.json()) as { id: string }).id;
    }
    await send(`${STUDIES}/${studyId}/locations`, "POST", {
      methodology_id: methodologyId,
      ...locationBody(values),
    });
  }
}

export async function createStudy(values: StudyFormValues): Promise<string> {
  const response = await authFetch(STUDIES, jsonInit("POST", studyBody(values)));
  if (!response.ok) throw await failure(response);
  const created = (await response.json()) as { id: string };
  if (hasArticleData(values)) {
    const article = await authFetch(
      `${STUDIES}/${created.id}/articles`,
      jsonInit("POST", articleBody(values)),
    );
    if (!article.ok) throw await failure(article);
  }
  const ids: StudyIds = { articleId: null, locationId: null, methodologyIds: [] };
  const firstId = await saveMethodologies(created.id, ids, values);
  await saveLocation(created.id, ids, values, firstId);
  return created.id;
}

export async function updateStudy(
  id: string,
  ids: StudyIds,
  values: StudyFormValues,
): Promise<void> {
  const response = await authFetch(
    `${STUDIES}/${id}`,
    jsonInit("PATCH", studyBody(values)),
  );
  if (!response.ok) throw await failure(response);

  if (ids.articleId) {
    const article = await authFetch(
      `${STUDIES}/${id}/articles/${ids.articleId}`,
      jsonInit("PATCH", articleBody(values)),
    );
    if (!article.ok) throw await failure(article);
  } else if (hasArticleData(values)) {
    const article = await authFetch(
      `${STUDIES}/${id}/articles`,
      jsonInit("POST", articleBody(values)),
    );
    if (!article.ok) throw await failure(article);
  }

  const firstId = await saveMethodologies(id, ids, values);
  await saveLocation(id, ids, values, firstId ?? ids.methodologyIds[0] ?? null);
}

export async function deleteStudy(id: string): Promise<void> {
  const response = await authFetch(`${STUDIES}/${id}`, { method: "DELETE" });
  if (!response.ok) throw await failure(response);
}
