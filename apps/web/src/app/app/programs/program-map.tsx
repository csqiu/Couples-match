'use client';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { GeoJSONSource, MapLayerMouseEvent, Map as MlMap } from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import type { MapPoint } from './types';

const STYLE = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};
const isDark = () => document.documentElement.classList.contains('dark');
const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function toGeoJSON(points: MapPoint[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: points.map((p) => ({
      type: 'Feature',
      properties: { id: p.id, name: p.name, city: p.city, owner: p.owner },
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
    })),
  };
}

/** Program pins: mine in the accent color, my partner's as rings. */
export function ProgramMap({ points, className }: { points: MapPoint[]; className?: string }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const latest = useRef(points);
  latest.current = points;

  useEffect(() => {
    let disposed = false;
    let onTheme: (() => void) | null = null;
    (async () => {
      const maplibre = await import('maplibre-gl');
      if (disposed || !el.current) return;
      // Served from /public by scripts/copy-maplibre-worker.mjs.
      maplibre.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
      const m = new maplibre.Map({
        container: el.current,
        style: isDark() ? STYLE.dark : STYLE.light,
        center: [-96, 38.5],
        zoom: 3,
        attributionControl: { compact: true },
      });
      map.current = m;
      m.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');

      const addLayers = () => {
        if (m.getSource('programs')) return;
        m.addSource('programs', { type: 'geojson', data: toGeoJSON(latest.current) });
        m.addLayer({
          id: 'partner',
          type: 'circle',
          source: 'programs',
          filter: ['==', ['get', 'owner'], 'partner'],
          paint: { 'circle-radius': 7, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-width': 2.5, 'circle-stroke-color': css('--tier-b') },
        });
        m.addLayer({
          id: 'me',
          type: 'circle',
          source: 'programs',
          filter: ['==', ['get', 'owner'], 'me'],
          paint: { 'circle-radius': 5.5, 'circle-color': css('--accent'), 'circle-stroke-width': 1.5, 'circle-stroke-color': css('--surface') },
        });
        for (const layer of ['me', 'partner']) {
          m.on('click', layer, (e: MapLayerMouseEvent) => {
            const f = e.features?.[0];
            if (!f) return;
            const p = f.properties as { name: string; city: string; owner: string };
            new maplibre.Popup({ closeButton: false })
              .setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
              .setText(`${p.name} — ${p.city}${p.owner === 'partner' ? ' (partner)' : ''}`)
              .addTo(m);
          });
          m.on('mouseenter', layer, () => (m.getCanvas().style.cursor = 'pointer'));
          m.on('mouseleave', layer, () => (m.getCanvas().style.cursor = ''));
        }
        fit(m, latest.current);
        m.once('idle', () => exposePins(m));
      };
      m.on('style.load', addLayers);
      onTheme = () => m.setStyle(isDark() ? STYLE.dark : STYLE.light);
      window.addEventListener('pairwise-theme', onTheme);
    })();
    return () => {
      disposed = true;
      if (onTheme) window.removeEventListener('pairwise-theme', onTheme);
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    const src = m?.getSource('programs') as GeoJSONSource | undefined;
    if (m && src) {
      src.setData(toGeoJSON(points));
      fit(m, points);
      m.once('idle', () => exposePins(m));
    }
  }, [points]);

  return <div ref={el} className={className} role="region" aria-label={`Map of ${points.length} programs`} />;
}

/** How many of my pins are drawn — read by the end-to-end test. */
function exposePins(m: MlMap) {
  if (!m.getLayer('me')) return;
  (window as unknown as { __pairwiseMapPins?: number }).__pairwiseMapPins = m.queryRenderedFeatures({ layers: ['me'] }).length;
}

function fit(m: MlMap, points: MapPoint[]) {
  if (!points.length) return;
  let [w, s, e, n] = [180, 90, -180, -90];
  for (const p of points) {
    w = Math.min(w, p.lon);
    e = Math.max(e, p.lon);
    s = Math.min(s, p.lat);
    n = Math.max(n, p.lat);
  }
  m.fitBounds([[w, s], [e, n]], { padding: 48, maxZoom: 9, duration: 0 });
}
