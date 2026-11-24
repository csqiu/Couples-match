# NRMP Main Residency Match program list

Extracted from a saved copy of the NRMP Main Residency Match Program Directory
(programdirectory.nrmp.org), provided by the project owner on 2026-11-23. 7,492 program tracks.

- `nrmp_main_match_programs.csv` / `.xlsx`: specialty, program name, city/state, track type
  (derived from the 8th character of the NRMP code), program status, how to apply for MRM and
  SOAP, NRMP code, ACGME code, directory URL. The workbook adds summary tabs and a legend.
- `parse.py` / `build.py`: the scripts that produced them
  (`python3 parse.py <saved.html> raw.json && python3 build.py raw.json <outdir>`).

The project owner has approved using this public NRMP directory data (see
`docs/data-sources.md`).

## Loading it into the app

```bash
pnpm --filter @pairwise/data nrmp:cities nrmp-directory/nrmp_main_match_programs.csv   # once: finds each city on the map (about 18 minutes)
pnpm --filter @pairwise/data nrmp:load --dry-run   # shows what would be loaded
pnpm --filter @pairwise/data nrmp:load             # loads it (needs an admin account; see the script)
```

- One program per rankable NRMP track (Active or Initial), with its official NRMP
  code. Withdrawn and not-participating tracks are left out.
- Locations are city centres (`packages/data/seed/nrmp-cities.json`), except at
  hospitals where a seed program gives the exact address.
- The seed programs are merged into their NRMP tracks
  (`packages/data/seed/nrmp-seed-map.json`).
- Re-running after a new directory export updates programs in place. Locations an
  admin fixed by hand are kept.
