// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import MeasureFilterControls, {
  getSelectedPollutantKeysForMap,
  type MeasureItem,
} from "./MeasureFilterControls";

afterEach(cleanup);

const particulateMeasures: MeasureItem[] = [
  { key: "pm25", name: "PM2.5" },
  { key: "pm10", name: "PM10" },
];

const gasMeasures: MeasureItem[] = [
  { key: "no2", name: "NO2" },
  { key: "so2", name: "SO2" },
];

const allMeasureKeys = ["pm25", "pm10", "no2", "so2"];

function MeasureFilterHarness({
  initialSelection,
}: {
  initialSelection: string[];
}) {
  const [selected, setSelected] = useState(() => new Set(initialSelection));
  const [activeMeasures, setActiveMeasures] =
    useState<readonly MeasureItem[]>(particulateMeasures);
  const [hasUserChanged, setHasUserChanged] = useState(false);
  const mapPollutantKeys = getSelectedPollutantKeysForMap(
    selected,
    allMeasureKeys,
    hasUserChanged,
  );

  return (
    <>
      <button type="button" onClick={() => setActiveMeasures(gasMeasures)}>
        Atmospheric gases
      </button>
      <button
        type="button"
        onClick={() => setActiveMeasures(particulateMeasures)}
      >
        Particulate matter
      </button>
      <MeasureFilterControls
        items={activeMeasures}
        selectedPollutants={selected}
        setSelectedPollutants={setSelected}
        onUserChange={() => setHasUserChanged(true)}
      />
      <output aria-label="Map pollutant keys">
        {JSON.stringify(mapPollutantKeys ?? allMeasureKeys)}
      </output>
    </>
  );
}

describe("measure filter controls", () => {
  it("keeps an explicitly selected full category as a map filter", () => {
    expect(
      getSelectedPollutantKeysForMap(
        new Set(allMeasureKeys),
        allMeasureKeys,
        true,
      ),
    ).toEqual(allMeasureKeys);
  });

  it("leaves the initial category selection unfiltered", () => {
    expect(
      getSelectedPollutantKeysForMap(
        new Set(allMeasureKeys),
        allMeasureKeys,
        false,
      ),
    ).toBeUndefined();
  });

  it("selects every visible measure, updates the count, and passes those keys to the map", () => {
    render(<MeasureFilterHarness initialSelection={["pm25"]} />);

    fireEvent.click(screen.getByRole("button", { name: "Select all" }));

    expect(
      (screen.getByRole("checkbox", { name: "PM2.5" }) as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect(
      (screen.getByRole("checkbox", { name: "PM10" }) as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect(
      screen
        .getByLabelText("Measure selection count")
        .textContent?.replace(/\s+/g, " ")
        .trim(),
    ).toBe("2 of 2 selected");
    expect(screen.getByLabelText("Map pollutant keys").textContent).toBe(
      '["pm25","pm10"]',
    );
  });

  it("clears only the active subcategory and preserves its selection in the map filter", () => {
    render(<MeasureFilterHarness initialSelection={["pm25", "pm10", "no2"]} />);

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(
      (screen.getByRole("checkbox", { name: "PM2.5" }) as HTMLInputElement)
        .checked,
    ).toBe(false);
    expect(
      (screen.getByRole("checkbox", { name: "PM10" }) as HTMLInputElement)
        .checked,
    ).toBe(false);
    expect(
      screen
        .getByLabelText("Measure selection count")
        .textContent?.replace(/\s+/g, " ")
        .trim(),
    ).toBe("0 of 2 selected");
    expect(screen.getByLabelText("Map pollutant keys").textContent).toBe(
      '["no2"]',
    );

    fireEvent.click(screen.getByRole("button", { name: "Atmospheric gases" }));

    expect(
      (screen.getByRole("checkbox", { name: "NO2" }) as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect(
      (screen.getByRole("checkbox", { name: "SO2" }) as HTMLInputElement)
        .checked,
    ).toBe(false);
    expect(
      screen
        .getByLabelText("Measure selection count")
        .textContent?.replace(/\s+/g, " ")
        .trim(),
    ).toBe("1 of 2 selected");
    expect(screen.getByLabelText("Map pollutant keys").textContent).toBe(
      '["no2"]',
    );
  });
});
