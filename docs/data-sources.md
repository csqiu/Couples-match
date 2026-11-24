# Program data sources: research (pending)

> **Status: not started.** Phase 3 step 1 (Section 4 of the spec) was deferred at the
> owner's request. The import pipeline is source-agnostic. Until this research is done
> and approved, it only takes CSV files someone has assembled by hand. **No source may
> be scraped before its terms are checked here.**

## Questions to answer for each source

| Source | Fields provided | Has coordinates? | Has NRMP program codes? | Bulk download / API? | Terms of use (scraping, reuse, redistribution) | Verdict |
|---|---|---|---|---|---|---|
| ACGME public program search + downloadable data | | | | | | |
| AMA FREIDA | | | | | | |
| NRMP public reports (Program Results, Main Match data) | | | | | | |
| NRMP Main Residency Match Program Directory (programdirectory.nrmp.org) | Specialty, program name, city/state, status, MRM/SOAP application service, NRMP code, ACGME code | No | Yes | No (saved page parsed; see `nrmp-directory/`) | Public data; owner approved use, no terms review needed (2026-11-24) | **Approved** |
| SMS fellowship match pages (NRMP) | | | | | | |

For each source, also record:

- How often it is updated, and when the next rank season's data appears.
- Whether it lists the **primary teaching site address**, or only the sponsoring
  institution. We geocode the primary site.
- How it identifies programs (ACGME ID?), so re-imports update rows instead of
  duplicating them.

## Needs network access

The research and geocoding need these hosts, which are blocked in the current cloud
session:

- `acgme.org`, `apps.acgme.org`, `freida.ama-assn.org`, `nrmp.org`, `www.nrmp.org`
- `geocoding.geo.census.gov`, `nominatim.openstreetmap.org`
- `www2.census.gov` (CBSA boundary files)

## When approved

1. Export or download the source to a staging CSV (`packages/data/seed/staging-template.csv`
   shows the columns).
2. Run `pnpm --filter @pairwise/data import <file.csv> --cbsa <cbsa.geojson>`.
3. Review `out/review.json`: low-confidence geocodes, possible duplicates, and programs
   outside every metro.
4. Run `pnpm --filter @pairwise/data geocode:seed` to check the hand-entered seed
   coordinates.
