/**
 * Assigning a CBSA (metro area) by point-in-polygon.
 *
 * In production this runs in PostGIS against the Census CBSA boundaries
 * (Phase 4). This TypeScript version takes the same boundaries as GeoJSON — e.g.
 * the Census cartographic boundary file `cb_<year>_us_cbsa_500k` converted to
 * GeoJSON — so imports can be checked offline and in tests.
 */

type Ring = Array<[number, number]>; // [lon, lat]
type PolygonCoords = Ring[];

export interface CbsaFeature {
  type: 'Feature';
  properties: { CBSAFP: string; NAME: string; LSAD?: string };
  geometry: { type: 'Polygon'; coordinates: PolygonCoords } | { type: 'MultiPolygon'; coordinates: PolygonCoords[] };
}

export interface CbsaHit {
  code: string;
  name: string;
}

interface IndexedCbsa {
  code: string;
  name: string;
  polygons: PolygonCoords[];
  bbox: [number, number, number, number]; // minLon, minLat, maxLon, maxLat
}

/** Ray casting; points on an edge may go either way, which is fine for metros. */
function inRing(lon: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inPolygon(lon: number, lat: number, poly: PolygonCoords): boolean {
  if (!inRing(lon, lat, poly[0])) return false;
  for (let h = 1; h < poly.length; h++) if (inRing(lon, lat, poly[h])) return false; // hole
  return true;
}

export class CbsaIndex {
  private items: IndexedCbsa[];
  constructor(features: CbsaFeature[], opts: { metroOnly?: boolean } = {}) {
    this.items = features
      .filter((f) => !opts.metroOnly || !f.properties.LSAD || f.properties.LSAD === 'M1')
      .map((f) => {
        const polygons = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
        let minLon = Infinity;
        let minLat = Infinity;
        let maxLon = -Infinity;
        let maxLat = -Infinity;
        for (const p of polygons) {
          for (const [lon, lat] of p[0]) {
            minLon = Math.min(minLon, lon);
            maxLon = Math.max(maxLon, lon);
            minLat = Math.min(minLat, lat);
            maxLat = Math.max(maxLat, lat);
          }
        }
        return { code: f.properties.CBSAFP, name: f.properties.NAME, polygons, bbox: [minLon, minLat, maxLon, maxLat] };
      });
  }

  static fromGeoJSON(json: { features: CbsaFeature[] }, opts?: { metroOnly?: boolean }): CbsaIndex {
    return new CbsaIndex(json.features, opts);
  }

  lookup(lat: number, lon: number): CbsaHit | null {
    for (const c of this.items) {
      const [a, b, x, y] = c.bbox;
      if (lon < a || lon > x || lat < b || lat > y) continue;
      if (c.polygons.some((p) => inPolygon(lon, lat, p))) return { code: c.code, name: c.name };
    }
    return null;
  }
}
