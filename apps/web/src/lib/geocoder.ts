import 'server-only';
import { defaultGeocoder, type AddressQuery, type GeocodeResult } from '@pairwise/data';

// One geocoder per server process, so the cache and Nominatim's
// one-request-per-second limit are shared by every request.
const cache = new Map<string, GeocodeResult | null>();
const geocoder = defaultGeocoder({
  get: (k) => cache.get(k),
  set: (k, v) => {
    if (cache.size > 5000) cache.delete(cache.keys().next().value!);
    cache.set(k, v);
  },
});

/** Finds an address on the map; null when neither geocoder knows it (or both are unreachable). */
export async function geocode(q: AddressQuery): Promise<GeocodeResult | null> {
  return geocoder.geocode(q).catch(() => null);
}
