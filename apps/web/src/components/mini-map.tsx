'use client';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { GeoJSONSource, Map as MlMap } from 'maplibre-gl';
import { useEffect, useRef } from 'react';

const STYLE = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};
const isDark = () => document.documentElement.classList.contains('dark');
const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export interface MiniPoint {
  lat: number;
  lon: number;
}

function data(points: MiniPoint[]): GeoJSON.FeatureCollection {
  const coords = points.map((p) => [p.lon, p.lat]);
  return {
    type: 'FeatureCollection',
    features: [
      ...(coords.length === 2 ? [{ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: coords } }] : []),
      ...coords.map((c) => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: c } })),
    ],
  };
}

function fit(m: MlMap, points: MiniPoint[]) {
  if (!points.length) return;
  const lons = points.map((p) => p.lon);
  const lats = points.map((p) => p.lat);
  m.fitBounds(
    [
      [Math.min(...lons), Math.min(...lats)],
      [Math.max(...lons), Math.max(...lats)],
    ],
    { padding: 36, maxZoom: 9, duration: 0 },
  );
}

/** A small, non-interactive map of one pair: two pins and the line between them. */
export function MiniMap({ points, label, className }: { points: MiniPoint[]; label: string; className?: string }) {
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
      maplibre.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
      const m = new maplibre.Map({
        container: el.current,
        style: isDark() ? STYLE.dark : STYLE.light,
        interactive: false,
        attributionControl: false,
        center: [-96, 38.5],
        zoom: 2.5,
      });
      map.current = m;
      m.on('style.load', () => {
        m.addSource('pair', { type: 'geojson', data: data(latest.current) });
        m.addLayer({
          id: 'line',
          type: 'line',
          source: 'pair',
          filter: ['==', ['geometry-type'], 'LineString'],
          paint: { 'line-color': css('--accent'), 'line-width': 2, 'line-dasharray': [2, 1.5] },
        });
        m.addLayer({
          id: 'pins',
          type: 'circle',
          source: 'pair',
          filter: ['==', ['geometry-type'], 'Point'],
          paint: { 'circle-radius': 5, 'circle-color': css('--accent'), 'circle-stroke-width': 1.5, 'circle-stroke-color': css('--surface') },
        });
        fit(m, latest.current);
      });
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

  const key = points.map((p) => `${p.lat},${p.lon}`).join(';');
  useEffect(() => {
    const m = map.current;
    const src = m?.getSource('pair') as GeoJSONSource | undefined;
    if (m && src) {
      src.setData(data(points));
      fit(m, points);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return <div ref={el} className={className} role="img" aria-label={label} />;
}
