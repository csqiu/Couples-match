# NRMP Main Residency Match program list

Extracted from a saved copy of the NRMP Main Residency Match Program Directory
(programdirectory.nrmp.org), provided by the project owner on 2026-11-23. 7,492 program tracks.

- `nrmp_main_match_programs.csv` / `.xlsx`: specialty, program name, city/state, track type
  (derived from the 8th character of the NRMP code), program status, how to apply for MRM and
  SOAP, NRMP code, ACGME code, directory URL. The workbook adds summary tabs and a legend.
- `parse.py` / `build.py`: the scripts that produced them
  (`python3 parse.py <saved.html> raw.json && python3 build.py raw.json <outdir>`).

Reference data only: not yet wired into the import pipeline. NRMP's terms of use still need
checking per `docs/data-sources.md` before this is used in the app.
