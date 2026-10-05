---
name: Research publication years
description: Source of publication years and filter bounds for the Research page.
---

For the Research page, extract each publication year from the year in the paper's `source` citation, and obtain slider/filter bounds from `/api/v1/public/statistics`'s `year_range`. Keep this filter separate from the map's sampling-period year filters.

**Why:** The public filter payload does not provide a structured publication-year field. The user identified the source citation and statistics endpoint as authoritative; the map's year filter has different sampling semantics.

**How to apply:** Parse the source year for each study; do not use `sampling_period_raw`, `start_year`, or `end_year` for Research-page publication filtering. Validate the statistics response before rendering the year range.
