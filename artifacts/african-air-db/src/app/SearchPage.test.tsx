// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Study } from "./types/arcair";

const {
  getCountrySummariesMock,
  getPollutantsByCategoryMock,
  getPublicationYearRangeMock,
  queryStudiesMock,
} = vi.hoisted(() => ({
  getCountrySummariesMock: vi.fn(),
  getPollutantsByCategoryMock: vi.fn(),
  getPublicationYearRangeMock: vi.fn(),
  queryStudiesMock: vi.fn(),
}));

vi.mock("./services/studyService", () => ({
  getCountrySummaries: getCountrySummariesMock,
  getPollutantsByCategory: getPollutantsByCategoryMock,
  getPublicationYearRange: getPublicationYearRangeMock,
  queryStudies: queryStudiesMock,
}));

import SearchPage from "./SearchPage";

const studies: Study[] = Array.from({ length: 25 }, (_, index) => ({
  id: `study-${index + 1}`,
  region: "",
  country: "Morocco",
  source: `Example et al. ${2025 - (index % 10)}`,
  author: "A. Example",
  journal: "Air Quality Journal",
  identifier: "",
  title: `Research paper ${index + 1}`,
  dataProcessing: "",
  publicationYear: 2025 - (index % 10),
  yearFrom: 2020,
  yearTo: 2021,
  records: [],
}));

let createObjectUrlDescriptor: PropertyDescriptor | undefined;
let revokeObjectUrlDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
  getCountrySummariesMock.mockResolvedValue([{ name: "Morocco" }]);
  getPollutantsByCategoryMock.mockResolvedValue([]);
  getPublicationYearRangeMock.mockResolvedValue({ min: 2016, max: 2025 });
  queryStudiesMock.mockImplementation(
    async ({ page = 1, pageSize = 20 }: { page?: number; pageSize?: number }) => ({
      items: studies.slice((page - 1) * pageSize, page * pageSize),
      total: studies.length,
      page,
      pageSize,
      pageCount: Math.ceil(studies.length / pageSize),
    }),
  );
  createObjectUrlDescriptor = Object.getOwnPropertyDescriptor(
    URL,
    "createObjectURL",
  );
  revokeObjectUrlDescriptor = Object.getOwnPropertyDescriptor(
    URL,
    "revokeObjectURL",
  );
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:test-export"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  if (createObjectUrlDescriptor) {
    Object.defineProperty(URL, "createObjectURL", createObjectUrlDescriptor);
  } else {
    Reflect.deleteProperty(URL, "createObjectURL");
  }
  if (revokeObjectUrlDescriptor) {
    Object.defineProperty(URL, "revokeObjectURL", revokeObjectUrlDescriptor);
  } else {
    Reflect.deleteProperty(URL, "revokeObjectURL");
  }
});

describe("Research page export", () => {
  it("downloads all filtered studies, not only the currently visible page", async () => {
    render(<SearchPage />);

    await screen.findByText("Page 1 of 2");
    fireEvent.click(screen.getByLabelText("Morocco"));

    await waitFor(() => {
      expect(queryStudiesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({ countries: ["Morocco"] }),
          page: 1,
          pageSize: 20,
        }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Page 2 of 2");
    fireEvent.click(
      screen.getByRole("button", {
        name: "Export all 25 filtered studies as CSV",
      }),
    );

    await waitFor(() => {
      const exportCall = queryStudiesMock.mock.calls.find(
        ([options]) => options.pageSize === 25,
      );
      expect(exportCall?.[0]).toEqual(
        expect.objectContaining({
          filters: expect.objectContaining({ countries: ["Morocco"] }),
          page: 1,
          pageSize: 25,
        }),
      );
      expect(URL.createObjectURL).toHaveBeenCalledOnce();
    });
  });
});
