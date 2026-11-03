import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createStudy,
  deleteStudy,
  emptyMethodology,
  getStudyPlaces,
  updateStudy,
  type StudyFormValues,
} from "./adminStudyService";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const values: StudyFormValues = {
  source: " Doe et al. 2023 ",
  publicationYear: "2023",
  dataProcessing: "",
  title: "Air study",
  author: "",
  journal: "",
  identifier: "",
  region: "",
  country: "",
  city: "",
  siteDescription: "",
  methodologies: [emptyMethodology()],
};

afterEach(() => vi.restoreAllMocks());

describe("adminStudyService", () => {
  it("maps study ids to city and region", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      json({
        data: [
          { study_id: "a", study_area: "Nairobi", region: "Eastern Africa" },
          { study_id: "b" },
        ],
      }),
    );
    const places = await getStudyPlaces();
    expect(places.get("a")).toEqual({ city: "Nairobi", region: "Eastern Africa" });
    expect(places.has("b")).toBe(false);
  });

  it("creates a study then its article", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json({ id: "s1" }, 201))
      .mockResolvedValueOnce(json({ id: "a1" }, 201));

    expect(await createStudy(values)).toBe("s1");

    const [studyUrl, studyInit] = fetchMock.mock.calls[0];
    expect(String(studyUrl)).toContain("/api/v1/dashboard/studies");
    expect(JSON.parse(String(studyInit?.body))).toEqual({
      source: "Doe et al. 2023",
      publication_year: 2023,
      data_processing: null,
    });
    expect(String(fetchMock.mock.calls[1][0])).toContain("/studies/s1/articles");
  });

  it("patches the study and existing article on update", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(json({}));

    await updateStudy(
      "s1",
      { articleId: "a1", locationId: "l1", methodologyIds: ["m1"] },
      {
        ...values,
        region: "Eastern Africa",
        country: "Kenya",
        city: "Nairobi",
        methodologies: [
          {
            id: "m1",
            periodId: "p1",
            methodology: "Reference monitor",
            samplingPeriod: "2020 - 2021",
            yearFrom: "2020",
            yearTo: "",
            measurements: [],
          },
        ],
      },
    );

    expect(fetchMock.mock.calls[0][1]?.method).toBe("PATCH");
    expect(String(fetchMock.mock.calls[1][0])).toContain("/studies/s1/articles/a1");
    const methodology = fetchMock.mock.calls[2];
    expect(String(methodology[0])).toContain("/studies/s1/methodologies/m1");
    expect(JSON.parse(String(methodology[1]?.body))).toEqual({
      methodology: "Reference monitor",
    });
    const period = fetchMock.mock.calls[3];
    expect(String(period[0])).toContain("/studies/s1/periods/p1");
    expect(JSON.parse(String(period[1]?.body))).toEqual({
      sampling_period_raw: "2020 - 2021",
      start_year: 2020,
      end_year: 2020,
    });
    const location = fetchMock.mock.calls[4];
    expect(String(location[0])).toContain("/studies/s1/locations/l1");
    expect(JSON.parse(String(location[1]?.body))).toEqual({
      region: "Eastern Africa",
      country: "Kenya",
      study_area: "Nairobi",
      site_description: null,
    });
  });

  it("saves several methodologies and deletes removed ones", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => json({ id: "new" }, 200));

    await updateStudy(
      "s1",
      { articleId: null, locationId: "l1", methodologyIds: ["old", "m1"], measurementIds: ["x1", "x2"] },
      {
        ...values,
        methodologies: [
          {
            id: "m1",
            periodId: null,
            methodology: "A",
            samplingPeriod: "",
            yearFrom: "",
            yearTo: "",
            measurements: [
              { id: "x1", variableId: "v1", mean: "12,5", sd: "2", min: "", max: "", unit: "ug/m3" },
            ],
          },
          {
            id: null,
            periodId: null,
            methodology: "B",
            samplingPeriod: "2021",
            yearFrom: "",
            yearTo: "",
            measurements: [
              { id: null, variableId: "v2", mean: "1", sd: "", min: "", max: "", unit: "" },
            ],
          },
        ],
      },
    );

    const calls = fetchMock.mock.calls.map(
      ([url, init]) => `${init?.method} ${String(url).split("/studies/s1")[1] ?? ""}`,
    );
    expect(calls).toContain("DELETE /methodologies/old");
    expect(calls).toContain("PATCH /methodologies/m1");
    expect(calls).toContain("POST /methodologies");
    expect(calls).toContain("POST /periods");
    expect(calls).toContain("DELETE /measurements/x2");
    expect(calls).toContain("PATCH /measurements/x1");
    expect(calls).toContain("POST /measurements");
    expect(calls.indexOf("DELETE /measurements/x2")).toBeLessThan(
      calls.indexOf("DELETE /methodologies/old"),
    );
    const patch = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith("/measurements/x1"),
    );
    expect(JSON.parse(String(patch?.[1]?.body))).toEqual({
      variable_id: "v1",
      mean_value: 12.5,
      sd_value: 2,
      min_value: null,
      max_value: null,
      unit: "ug/m3",
    });
  });

  it("deletes and reports auth failures clearly", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json({ detail: "x" }, 401));

    await expect(deleteStudy("s1")).rejects.toThrow("Not authorized");
    expect(fetchMock.mock.calls[0][1]?.method).toBe("DELETE");
  });
});
