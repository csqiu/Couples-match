export const PROGRAM_COLUMNS = 'id, name, institution, city, state, lat, lon, specialty_code, specialty_name, cbsa_name, created_by_couple, nrmp_code';

/** Search shows this many at most; narrow by specialty, state or name for the rest. */
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
}

export interface MapPoint {
  id: string;
  name: string;
  city: string;
  lat: number;
  lon: number;
  owner: 'me' | 'partner';
}
