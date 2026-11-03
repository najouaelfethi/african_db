import { afterEach, describe, expect, it, vi } from "vitest";
import { getDashboardSummary, getStudiesByCountry } from "./analyticsService";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

afterEach(() => vi.restoreAllMocks());

describe("getDashboardSummary", () => {
  it("returns the API values", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      json({
        total_studies: 289,
        total_countries: 32,
        total_pollution_variables: 95,
        total_variables: 95,
        latest_publication_year: 2026,
        oldest_publication_year: 1992,
        top_country: "Kenya",
        top_pollution_variable: "PM2.5",
      }),
    );

    const summary = await getDashboardSummary();

    expect(fetchMock.mock.calls[0][0]).toContain(
      "/api/v1/analytics/dashboard-summary",
    );
    expect(summary.total_studies).toBe(289);
    expect(summary.top_country).toBe("Kenya");
  });

  it("falls back to 0 when data is missing or null", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      json({ total_studies: 5, latest_publication_year: null, top_country: null }),
    );

    expect(await getDashboardSummary()).toEqual({
      total_studies: 5,
      total_countries: 0,
      total_pollution_variables: 0,
      total_variables: 0,
      latest_publication_year: 0,
      oldest_publication_year: 0,
      top_country: 0,
      top_pollution_variable: 0,
    });
  });
});

describe("getStudiesByCountry", () => {
  it("requests the endpoint with an optional limit", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json([{ country: "Kenya", total_studies: 49 }]));

    expect(await getStudiesByCountry(10)).toEqual([
      { country: "Kenya", total_studies: 49 },
    ]);
    expect(fetchMock.mock.calls[0][0]).toContain(
      "/api/v1/analytics/studies-by-country?limit=10",
    );
  });

  it("rejects malformed rows", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(json([{ country: 1 }]));
    await expect(getStudiesByCountry()).rejects.toThrow("Invalid");
  });
});
