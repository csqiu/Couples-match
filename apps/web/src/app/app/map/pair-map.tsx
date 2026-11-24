'use client';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { GeoJSONSource, MapLayerMouseEvent, Map as MlMap } from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import { boundsOf, MAP_BANDS, toGeoJSON, type MapBand, type PairLine } from '@/lib/list-map';

const STYLE = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};
const isDark = () => document.documentElement.classList.contains('dark');
const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Line style per band, so the bands differ by more than color. */
export const BAND_LINE: Record<MapBand, { width: number; dash?: number[] }> = {
  together: { width: 4 },
  commutable: { width: 3 },
  drivable: { width: 2.5, dash: [3, 2] },
  apart: { width: 2, dash: [1, 2] },
};

/** Every pair in the list as a line between the two programs. */
export function PairMap({
  lines,
  selected,
  onSelect,
  className,
  label,
}: {
  lines: PairLine[];
  selected: number | null;
  onSelect: (rank: number) => void;
  className?: string;
  label: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const latest = useRef({ lines, selected, onSelect });
  latest.current = { lines, selected, onSelect };

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
        center: [-96, 38.5],
        zoom: 3,
        attributionControl: { compact: true },
      });
      map.current = m;
      m.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');

      const addLayers = () => {
        if (m.getSource('pairs')) return;
        m.addSource('pairs', { type: 'geojson', data: toGeoJSON(latest.current.lines) });
        // Draw far-apart pairs first so the close ones sit on top.
        for (const band of [...MAP_BANDS].reverse()) {
          const style = BAND_LINE[band];
          m.addLayer({
            id: `line-${band}`,
            type: 'line',
            source: 'pairs',
            filter: ['all', ['==', ['get', 'kind'], 'line'], ['==', ['get', 'band'], band]],
            layout: { 'line-cap': 'round' },
            paint: {
              'line-color': css(`--band-${band}`),
              'line-width': style.width,
              'line-opacity': 0.75,
              ...(style.dash ? { 'line-dasharray': style.dash } : {}),
            },
          });
        }
        m.addLayer({
          id: 'line-selected',
          type: 'line',
          source: 'pairs',
          filter: ['all', ['==', ['get', 'kind'], 'line'], ['==', ['get', 'rank'], -1]],
          layout: { 'line-cap': 'round' },
          paint: { 'line-color': css('--text'), 'line-width': 6, 'line-opacity': 0.9 },
        });
        m.addLayer({
          id: 'ends',
          type: 'circle',
          source: 'pairs',
          filter: ['!=', ['get', 'kind'], 'line'],
          paint: {
            'circle-radius': 4.5,
            // Partner A filled, partner B as a ring.
            'circle-color': ['case', ['==', ['get', 'kind'], 'a'], css('--accent'), css('--surface')],
            'circle-stroke-width': 2,
            'circle-stroke-color': ['case', ['==', ['get', 'kind'], 'a'], css('--surface'), css('--tier-b')],
          },
        });
        const layers = [...MAP_BANDS.map((b) => `line-${b}`), 'ends'];
        for (const layer of layers) {
          m.on('click', layer, (e: MapLayerMouseEvent) => {
            const f = e.features?.[0];
            if (f) latest.current.onSelect(Number(f.properties?.rank));
          });
          m.on('mouseenter', layer, () => (m.getCanvas().style.cursor = 'pointer'));
          m.on('mouseleave', layer, () => (m.getCanvas().style.cursor = ''));
        }
        highlight(m, latest.current.selected);
        fit(m, latest.current.lines);
        m.once('idle', () => expose(m));
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
    const src = m?.getSource('pairs') as GeoJSONSource | undefined;
    if (m && src) {
      src.setData(toGeoJSON(lines));
      fit(m, lines);
      m.once('idle', () => expose(m));
    }
  }, [lines]);

  useEffect(() => {
    const m = map.current;
    if (!m?.getLayer('line-selected')) return;
    highlight(m, selected);
    const line = lines.find((l) => l.rank === selected);
    if (line) fit(m, [line], 120);
  }, [selected, lines]);

  return <div ref={el} className={className} role="region" aria-label={label} />;
}

function highlight(m: MlMap, rank: number | null) {
  m.setFilter('line-selected', ['all', ['==', ['get', 'kind'], 'line'], ['==', ['get', 'rank'], rank ?? -1]]);
}

function fit(m: MlMap, lines: PairLine[], padding = 48) {
  const b = boundsOf(lines);
  if (b) m.fitBounds(b, { padding, maxZoom: 10, duration: 300 });
}

/** How many pair lines are drawn — read by the end-to-end test. */
function expose(m: MlMap) {
  const layers = MAP_BANDS.map((b) => `line-${b}`).filter((l) => m.getLayer(l));
  (window as unknown as { __pairwiseMapLines?: number }).__pairwiseMapLines = m.queryRenderedFeatures({ layers }).length;
}
