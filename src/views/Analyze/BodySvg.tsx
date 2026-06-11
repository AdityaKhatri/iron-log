import { useEffect, useRef, useState } from 'react';
import { getHeatmapColor, type MuscleRegion } from './bodyModel';

/**
 * Map SVG data-group names → our muscle regions.
 * Some SVG groups map to the same region.
 */
const SVG_GROUP_TO_REGION: Record<string, MuscleRegion> = {
  'chest':      'chest',
  'abs':        'core',
  'shoulders':  'shoulders',
  'biceps':     'biceps',
  'triceps':    'triceps',
  'forearms':   'forearms',
  'quads':      'quads',
  'hamstrings': 'hamstrings',
  'calves':     'calves',
  'glutes':     'glutes',
  'lats':       'upper-back',
  'traps':      'upper-back',
  'lower_back': 'lower-back',
  'adductors':  'hip-flexors',
};

function colorToCSS(intensity: number): string {
  const c = getHeatmapColor(intensity);
  const r = Math.round(c.r * 255);
  const g = Math.round(c.g * 255);
  const b = Math.round(c.b * 255);
  return `rgb(${r},${g},${b})`;
}

export function BodySvg({
  scores,
  onTapMuscle,
}: {
  scores: Map<MuscleRegion, number>;
  onTapMuscle: (region: MuscleRegion) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string | null>(null);

  // Load the SVG file
  useEffect(() => {
    const basePath = import.meta.env.BASE_URL ?? '/';
    fetch(`${basePath}models/muscle-map.svg`)
      .then(r => r.text())
      .then(setSvgContent);
  }, []);

  // Apply heatmap colours and click handlers once SVG is loaded
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !svgContent) return;

    // Set the SVG HTML
    container.innerHTML = svgContent;

    const svg = container.querySelector('svg');
    if (!svg) return;

    // Style the SVG to fit
    svg.style.width = '100%';
    svg.style.height = 'auto';
    svg.style.maxHeight = '420px';
    svg.style.display = 'block';
    svg.style.margin = '0 auto';

    // Apply colours to each muscle group
    const groups = svg.querySelectorAll<SVGGElement>('g[data-group]');
    for (const group of groups) {
      const groupName = group.getAttribute('data-group') ?? '';
      const region = SVG_GROUP_TO_REGION[groupName];
      if (!region) continue;

      const intensity = scores.get(region) ?? 0;
      const color = colorToCSS(intensity);

      // Colour all paths in this group
      const paths = group.querySelectorAll<SVGPathElement>('path');
      for (const path of paths) {
        path.style.fill = color;
        path.style.cursor = 'pointer';
        path.style.transition = 'opacity 0.15s';
        path.addEventListener('pointerenter', () => { path.style.opacity = '0.75'; });
        path.addEventListener('pointerleave', () => { path.style.opacity = '1'; });
      }

      // Click handler for the whole group
      group.style.cursor = 'pointer';
      group.addEventListener('click', () => onTapMuscle(region));
    }
  }, [svgContent, scores, onTapMuscle]);

  return (
    <div ref={containerRef} className="body-svg-container" />
  );
}
