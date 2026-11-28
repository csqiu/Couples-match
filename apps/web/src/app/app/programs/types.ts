export const PROGRAM_COLUMNS =
  'id, name, institution, address, city, state, lat, lon, specialty_code, specialty_name, cbsa_name, created_by_couple, nrmp_code, acgme_id, is_advanced, short_name, verified';

/** Search loads this many at a time; scrolling to the end loads the next page. */
export const SEARCH_LIMIT = 60;

export interface ProgramLite {
  id: string;
  name: string;
  institution: string;
  city: string;
  state: string;
  lat: number | null;
  lon: number | null;
  specialty_code: string;
  specialty_name: string;
  cbsa_name: string | null;
  /** Set for a program this couple added themselves (not yet checked by an admin). */
  created_by_couple: string | null;
  nrmp_code: string | null;
  address: string;
  acgme_id: string | null;
  is_advanced: boolean;
  /** The catalog's short name, if an admin set one. */
  short_name: string | null;
  verified: boolean;
}

/** A program on my list, with my own short name for it (null = automatic). */
export interface MyProgram extends ProgramLite {
  my_short: string | null;
}

export interface MapPoint {
  id: string;
  name: string;
  city: string;
  lat: number;
  lon: number;
  owner: 'me' | 'partner';
}
