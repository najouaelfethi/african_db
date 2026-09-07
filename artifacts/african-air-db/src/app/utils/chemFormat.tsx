/**
 * Chemical formula rendering utilities.
 *
 * Converts plain-text pollutant names and concentration units from the ARC-Air
 * dataset into proper scientific notation with HTML <sub>/<sup> tags.
 *
 * All strings come from our own lookup tables; dangerouslySetInnerHTML is safe here.
 */

// ── Name map ─────────────────────────────────────────────────────────────────

const CHEM_HTML: Record<string, string> = {
  // Bulk PM
  "PM10": "PM<sub>10</sub>",
  "PM2.5": "PM<sub>2.5</sub>",
  "PM1": "PM<sub>1</sub>",

  // Water-soluble inorganic aerosols (ions)
  "NO3-":           "NO<sub>3</sub><sup>−</sup>",
  "SO42-":          "SO<sub>4</sub><sup>2−</sup>",
  "Cl-":            "Cl<sup>−</sup>",
  "F-":             "F<sup>−</sup>",
  "PO43-":          "PO<sub>4</sub><sup>3−</sup>",
  "Oxalate (C2O42-)": "Oxalate (C<sub>2</sub>O<sub>4</sub><sup>2−</sup>)",
  "NH4+":           "NH<sub>4</sub><sup>+</sup>",
  "K+":             "K<sup>+</sup>",
  "Na+":            "Na<sup>+</sup>",
  "Fe2+/Fe3+":      "Fe<sup>2+</sup>/Fe<sup>3+</sup>",
  "Mg2+":           "Mg<sup>2+</sup>",
  "Ca2+":           "Ca<sup>2+</sup>",

  // Atmospheric gases
  "NO2": "NO<sub>2</sub>",
  "SO2": "SO<sub>2</sub>",
  "CH4": "CH<sub>4</sub>",
  "O3":  "O<sub>3</sub>",
};

// ── Unit map ──────────────────────────────────────────────────────────────────

const UNIT_HTML: Record<string, string> = {
  "µg/m³": "µg.m<sup>−3</sup>",
  "ng/m³": "ng.m<sup>−3</sup>",
  "pg/m³": "pg.m<sup>−3</sup>",
  "mg/m³": "mg.m<sup>−3</sup>",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns the HTML string for a chemical name, or the plain name if not mapped. */
export function chemToHtml(name: string): string {
  return CHEM_HTML[name] ?? name;
}

/** Returns the HTML string for a concentration unit, or the plain unit if not mapped. */
export function unitToHtml(unit: string): string {
  return UNIT_HTML[unit] ?? unit;
}

// ── Components ────────────────────────────────────────────────────────────────

/**
 * Renders a chemical species name with proper subscript / superscript notation.
 * Falls back to plain text for names not in the lookup table.
 */
export function Chem({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const html = CHEM_HTML[name];
  if (!html) return <span className={className}>{name}</span>;
  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * Renders a concentration unit with proper notation (e.g. µg·m⁻³).
 * Falls back to plain text for units not in the lookup table.
 */
export function ChemUnit({
  unit,
  className,
}: {
  unit: string;
  className?: string;
}) {
  const html = UNIT_HTML[unit];
  if (!html) return <span className={className}>{unit}</span>;
  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
