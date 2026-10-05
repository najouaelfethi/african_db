import type { Dispatch, SetStateAction } from "react";
import { Chem } from "../utils/chemFormat";

export interface MeasureItem {
  key: string;
  name: string;
}

export function updateSelectedMeasures(
  selected: ReadonlySet<string>,
  items: readonly Pick<MeasureItem, "key">[],
  select: boolean,
): Set<string> {
  const next = new Set(selected);
  items.forEach(({ key }) => {
    if (select) next.add(key);
    else next.delete(key);
  });
  return next;
}

export function countSelectedMeasures(
  selected: ReadonlySet<string>,
  items: readonly Pick<MeasureItem, "key">[],
): number {
  return items.reduce(
    (count, item) => count + Number(selected.has(item.key)),
    0,
  );
}

export function getSelectedPollutantKeysForMap(
  selected: ReadonlySet<string>,
  availableKeys: readonly string[],
  hasUserChanged: boolean,
): string[] | undefined {
  if (!hasUserChanged || selected.size >= availableKeys.length)
    return undefined;
  return Array.from(selected);
}

interface MeasureFilterControlsProps {
  items: readonly MeasureItem[];
  selectedPollutants: ReadonlySet<string>;
  setSelectedPollutants: Dispatch<SetStateAction<Set<string>>>;
  onUserChange: () => void;
}

export default function MeasureFilterControls({
  items,
  selectedPollutants,
  setSelectedPollutants,
  onUserChange,
}: MeasureFilterControlsProps) {
  const selectedCount = countSelectedMeasures(selectedPollutants, items);
  const allSelected = items.length > 0 && selectedCount === items.length;

  const setActiveSelection = (select: boolean) => {
    if (items.length === 0) return;
    onUserChange();
    setSelectedPollutants((previous) =>
      updateSelectedMeasures(previous, items, select),
    );
  };

  return (
    <>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Available measures
          </span>
          <span
            role="status"
            aria-live="polite"
            aria-label="Measure selection count"
            className="rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium text-foreground/70"
          >
            {selectedCount} of {items.length} selected
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveSelection(true)}
            disabled={items.length === 0 || allSelected}
            className="rounded px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary disabled:cursor-not-allowed disabled:text-muted-foreground/50 disabled:hover:bg-transparent"
          >
            Select all
          </button>
          <span aria-hidden="true" className="text-[10px] text-border">
            /
          </span>
          <button
            type="button"
            onClick={() => setActiveSelection(false)}
            disabled={selectedCount === 0}
            className="rounded px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-white hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary disabled:cursor-not-allowed disabled:text-muted-foreground/50 disabled:hover:bg-transparent"
          >
            Clear
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-1 gap-y-0.5">
        {items.map((item) => (
          <label
            key={item.key}
            className="flex min-h-8 cursor-pointer items-center gap-1.5 rounded-md border border-transparent px-2 py-1 transition-colors hover:bg-white/80"
          >
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-primary"
              checked={selectedPollutants.has(item.key)}
              onChange={() => {
                onUserChange();
                setSelectedPollutants((previous) =>
                  updateSelectedMeasures(
                    previous,
                    [item],
                    !previous.has(item.key),
                  ),
                );
              }}
            />
            <span className="text-[11px] text-foreground/80">
              <Chem name={item.name} />
            </span>
          </label>
        ))}
      </div>
    </>
  );
}
