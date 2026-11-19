/**
 * Geocoding with free services, politely:
 * - US Census geocoder first (US addresses, no key, generous limits);
 * - Nominatim (OpenStreetMap) as a fallback, at most 1 request per second, with
 *   a generic User-Agent as its usage policy requires;
 * - every result cached, so re-running an import never re-queries an address.
 *
 * `fetch` and the clock are injectable so this is testable offline.
 */
import type { GeocodeSource } from './types.js';

export interface AddressQuery {
  street: string;
  city: string;
  state: string;
  zip?: string;
}

export interface GeocodeResult {
  lat: number;
  lon: number;
  /** 0..1. Programs below the review threshold go to the admin queue. */
  confidence: number;
  source: GeocodeSource;
  matchedAddress?: string;
}

export interface Geocoder {
  geocode(q: AddressQuery): Promise<GeocodeResult | null>;
}

type FetchLike = (url: string, init?: { headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export function formatAddress(q: AddressQuery): string {
  return [q.street, q.city, `${q.state}${q.zip ? ` ${q.zip}` : ''}`].filter(Boolean).join(', ');
}

/** Ensures at least `minIntervalMs` between calls. */
export function throttle(minIntervalMs: number, now = () => Date.now(), sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))) {
  let last = -Infinity;
  let chain: Promise<void> = Promise.resolve();
  return () => {
    chain = chain.then(async () => {
      const wait = last + minIntervalMs - now();
      if (wait > 0) await sleep(wait);
      last = now();
    });
    return chain;
  };
}

interface CensusResponse {
  result?: { addressMatches?: Array<{ matchedAddress: string; coordinates: { x: number; y: number } }> };
}

export class CensusGeocoder implements Geocoder {
  constructor(
    private fetchImpl: FetchLike = fetch as unknown as FetchLike,
    private benchmark = 'Public_AR_Current',
  ) {}

  async geocode(q: AddressQuery): Promise<GeocodeResult | null> {
    const params = new URLSearchParams({
      street: q.street,
      city: q.city,
      state: q.state,
      benchmark: this.benchmark,
      format: 'json',
    });
    if (q.zip) params.set('zip', q.zip);
    const res = await this.fetchImpl(`https://geocoding.geo.census.gov/geocoder/locations/address?${params}`);
    if (!res.ok) throw new Error(`Census geocoder HTTP ${res.status}`);
    const matches = ((await res.json()) as CensusResponse).result?.addressMatches ?? [];
    if (!matches.length) return null;
    const m = matches[0];
    return {
      lat: m.coordinates.y,
      lon: m.coordinates.x,
      // One unambiguous street-level match is very reliable; several means ambiguity.
      confidence: matches.length === 1 ? 0.95 : 0.7,
      source: 'census',
      matchedAddress: m.matchedAddress,
    };
  }
}

interface NominatimHit {
  lat: string;
  lon: string;
  display_name: string;
  category?: string;
  class?: string;
  type?: string;
}

export class NominatimGeocoder implements Geocoder {
  private wait: () => Promise<void>;
  constructor(
    private fetchImpl: FetchLike = fetch as unknown as FetchLike,
    private userAgent = 'pairwise-program-import/0.1',
    throttleFn = throttle(1100),
  ) {
    this.wait = throttleFn;
  }

  async geocode(q: AddressQuery): Promise<GeocodeResult | null> {
    await this.wait();
    const params = new URLSearchParams({ q: formatAddress(q), format: 'jsonv2', countrycodes: 'us', limit: '1' });
    const res = await this.fetchImpl(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'User-Agent': this.userAgent },
    });
    if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
    const hits = (await res.json()) as NominatimHit[];
    if (!hits.length) return null;
    const h = hits[0];
    const kind = h.type ?? '';
    // A building or hospital hit is better than a street or a city centroid.
    const confidence = kind === 'hospital' || kind === 'house' || kind === 'building' ? 0.85 : kind === 'city' ? 0.3 : 0.6;
    return { lat: Number(h.lat), lon: Number(h.lon), confidence, source: 'nominatim', matchedAddress: h.display_name };
  }
}

/** Tries each geocoder in order; the first non-null result wins. Errors fall through to the next. */
export class FallbackGeocoder implements Geocoder {
  constructor(private geocoders: Geocoder[]) {}
  async geocode(q: AddressQuery): Promise<GeocodeResult | null> {
    for (const g of this.geocoders) {
      try {
        const r = await g.geocode(q);
        if (r) return r;
      } catch {
        // try the next one
      }
    }
    return null;
  }
}

export interface CacheStore {
  get(key: string): GeocodeResult | null | undefined;
  set(key: string, value: GeocodeResult | null): void;
}

/** Caches results (including "not found") by normalized address. */
export class CachingGeocoder implements Geocoder {
  constructor(
    private inner: Geocoder,
    private store: CacheStore = new Map<string, GeocodeResult | null>(),
  ) {}
  static key(q: AddressQuery): string {
    return formatAddress(q).toLowerCase().replace(/\s+/g, ' ').trim();
  }
  async geocode(q: AddressQuery): Promise<GeocodeResult | null> {
    const k = CachingGeocoder.key(q);
    const hit = this.store.get(k);
    if (hit !== undefined) return hit;
    const r = await this.inner.geocode(q);
    this.store.set(k, r);
    return r;
  }
}

/** The default chain used by the import and seed scripts. */
export function defaultGeocoder(store?: CacheStore): Geocoder {
  return new CachingGeocoder(new FallbackGeocoder([new CensusGeocoder(), new NominatimGeocoder()]), store);
}
