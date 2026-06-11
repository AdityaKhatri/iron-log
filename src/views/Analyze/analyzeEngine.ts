import type { Session, Exercise } from '../../types';
import { MUSCLE_REGIONS, MUSCLE_GROUP_MAP, type MuscleRegion } from './bodyModel';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MuscleStats {
  region: MuscleRegion;
  label: string;
  score: number;          // weighted activation score
  totalSets: number;      // raw completed set count (primary full, secondary half)
  lastTrained: string | null; // ISO date or null
}

export interface CardioStats {
  sessions: number;
  totalTimeSec: number;
  totalDistanceM: number;
}

export interface AnalysisResult {
  muscles: MuscleStats[];
  neglected: MuscleRegion[];
  cardio: CardioStats;
  totalDaysTrained: number;
  totalSessions: number;
  weeksInRange: number;
  /** Which exercises contributed to each region */
  regionExercises: Map<MuscleRegion, { name: string; sets: number }[]>;
}

// ─── Labels ──────────────────────────────────────────────────────────────────

const REGION_LABELS: Record<MuscleRegion, string> = {
  'chest':        'Chest',
  'upper-back':   'Upper Back',
  'lower-back':   'Lower Back',
  'shoulders':    'Shoulders',
  'biceps':       'Biceps',
  'triceps':      'Triceps',
  'forearms':     'Forearms',
  'core':         'Core',
  'glutes':       'Glutes',
  'quads':        'Quads',
  'hamstrings':   'Hamstrings',
  'calves':       'Calves',
  'neck':         'Neck',
  'hip-flexors':  'Hip Flexors',
};

export function getRegionLabel(region: MuscleRegion): string {
  return REGION_LABELS[region] ?? region;
}

// ─── Date range helpers ──────────────────────────────────────────────────────

export type RangeKey = '7d' | '30d' | '3mo' | '6mo' | 'all' | 'custom';

export function getDateRange(
  range: RangeKey,
  customFrom?: string,
  customTo?: string,
): { from: string; to: string } {
  const today = new Date();
  const to = today.toISOString().slice(0, 10);

  if (range === 'custom' && customFrom && customTo) {
    return { from: customFrom, to: customTo };
  }

  const d = new Date(today);
  switch (range) {
    case '7d':  d.setDate(d.getDate() - 7); break;
    case '30d': d.setDate(d.getDate() - 30); break;
    case '3mo': d.setMonth(d.getMonth() - 3); break;
    case '6mo': d.setMonth(d.getMonth() - 6); break;
    case 'all': return { from: '2000-01-01', to };
    default:    d.setDate(d.getDate() - 30);
  }
  return { from: d.toISOString().slice(0, 10), to };
}

// ─── Core analysis ───────────────────────────────────────────────────────────

export function computeAnalysis(
  sessions: Session[],
  exercises: Exercise[],
  from: string,
  to: string,
): AnalysisResult {
  const exMap = new Map<string, Exercise>();
  for (const ex of exercises) exMap.set(ex.id, ex);

  // Filter sessions in range that are finished
  const filtered = sessions.filter(s =>
    s.finishedAt && s.date >= from && s.date <= to
  );

  // Accumulators
  const scores = new Map<MuscleRegion, number>();
  const setsCounts = new Map<MuscleRegion, number>();
  const lastTrained = new Map<MuscleRegion, string>();
  const regionExMap = new Map<MuscleRegion, Map<string, number>>();

  for (const r of MUSCLE_REGIONS) {
    scores.set(r, 0);
    setsCounts.set(r, 0);
    regionExMap.set(r, new Map());
  }

  // Cardio
  let cardioSessions = 0;
  let cardioTime = 0;
  let cardioDistance = 0;
  const cardioSessionIds = new Set<string>();

  // Track unique training days
  const trainingDays = new Set<string>();

  for (const session of filtered) {
    trainingDays.add(session.date);

    for (const group of session.groups) {
      for (const block of group.blocks) {
        if (block.skipped) continue;
        const ex = exMap.get(block.exerciseId);
        if (!ex) continue;

        const completedSets = block.sets.filter(s => s.completed).length;
        if (completedSets === 0) continue;

        // Cardio tracking
        if (ex.category === 'cardio') {
          if (!cardioSessionIds.has(session.id)) {
            cardioSessionIds.add(session.id);
            cardioSessions++;
          }
          for (const set of block.sets) {
            if (!set.completed) continue;
            if (set.time != null) cardioTime += set.time;
            if (set.distance != null) cardioDistance += set.distance;
          }
        }

        // Primary muscle — full weight
        const primaryRegions = MUSCLE_GROUP_MAP[ex.muscleGroup] ?? [];
        const primaryWeight = primaryRegions.length > 0 ? completedSets / primaryRegions.length : 0;
        for (const region of primaryRegions) {
          scores.set(region, (scores.get(region) ?? 0) + primaryWeight);
          setsCounts.set(region, (setsCounts.get(region) ?? 0) + primaryWeight);
          // Track last trained date
          const prev = lastTrained.get(region);
          if (!prev || session.date > prev) lastTrained.set(region, session.date);
          // Track exercises per region
          const exCounts = regionExMap.get(region)!;
          exCounts.set(ex.name, (exCounts.get(ex.name) ?? 0) + completedSets);
        }

        // Secondary muscles — 50% weight
        for (const sec of ex.secondaryMuscles) {
          const secRegions = MUSCLE_GROUP_MAP[sec] ?? [];
          const secWeight = secRegions.length > 0 ? (completedSets * 0.5) / secRegions.length : 0;
          for (const region of secRegions) {
            scores.set(region, (scores.get(region) ?? 0) + secWeight);
            setsCounts.set(region, (setsCounts.get(region) ?? 0) + secWeight);
            const prev = lastTrained.get(region);
            if (!prev || session.date > prev) lastTrained.set(region, session.date);
            const exCounts = regionExMap.get(region)!;
            exCounts.set(ex.name, (exCounts.get(ex.name) ?? 0) + Math.round(completedSets * 0.5));
          }
        }
      }
    }
  }

  // Build results sorted by score descending
  const muscles: MuscleStats[] = MUSCLE_REGIONS.map(r => ({
    region: r,
    label: REGION_LABELS[r],
    score: Math.round((scores.get(r) ?? 0) * 10) / 10,
    totalSets: Math.round((setsCounts.get(r) ?? 0) * 10) / 10,
    lastTrained: lastTrained.get(r) ?? null,
  })).sort((a, b) => b.score - a.score);

  const neglected = muscles.filter(m => m.score === 0).map(m => m.region);

  // Region exercises map
  const regionExercises = new Map<MuscleRegion, { name: string; sets: number }[]>();
  for (const [region, exCounts] of regionExMap) {
    const entries = Array.from(exCounts.entries())
      .map(([name, sets]) => ({ name, sets }))
      .filter(e => e.sets > 0)
      .sort((a, b) => b.sets - a.sets);
    regionExercises.set(region, entries);
  }

  // Weeks in range
  const fromDate = new Date(from + 'T00:00:00');
  const toDate = new Date(to + 'T00:00:00');
  const diffMs = toDate.getTime() - fromDate.getTime();
  const weeksInRange = Math.max(1, Math.round(diffMs / (7 * 24 * 60 * 60 * 1000)));

  return {
    muscles,
    neglected,
    cardio: {
      sessions: cardioSessions,
      totalTimeSec: cardioTime,
      totalDistanceM: cardioDistance,
    },
    totalDaysTrained: trainingDays.size,
    totalSessions: filtered.length,
    weeksInRange,
    regionExercises,
  };
}

// ─── Normalise scores to 0..1 for heatmap ────────────────────────────────────

export function normaliseScores(muscles: MuscleStats[]): Map<MuscleRegion, number> {
  const max = Math.max(...muscles.map(m => m.score), 1);
  const map = new Map<MuscleRegion, number>();
  for (const m of muscles) {
    map.set(m.region, m.score / max);
  }
  return map;
}

// ─── Generate copy prompt ────────────────────────────────────────────────────

export function generatePrompt(
  analysis: AnalysisResult,
  exercises: Exercise[],
  from: string,
  to: string,
): string {
  const lines: string[] = [];
  lines.push(`## Training Analysis (${from} to ${to})`);
  lines.push('');
  lines.push(`**Training frequency:** ${analysis.totalSessions} sessions over ${analysis.totalDaysTrained} days (${(analysis.totalSessions / analysis.weeksInRange).toFixed(1)} sessions/week)`);
  lines.push('');

  lines.push('### Muscle Activation (weighted sets — primary full, secondary 50%)');
  lines.push('');
  for (const m of analysis.muscles) {
    const lastStr = m.lastTrained ?? 'never';
    lines.push(`- **${m.label}**: ${m.totalSets} sets, last trained: ${lastStr}`);
  }
  lines.push('');

  if (analysis.neglected.length > 0) {
    lines.push('### Neglected Muscle Groups (0 sets in this period)');
    lines.push('');
    for (const r of analysis.neglected) {
      lines.push(`- ${getRegionLabel(r)}`);
    }
    lines.push('');
  }

  lines.push('### Cardio');
  lines.push('');
  lines.push(`- Sessions: ${analysis.cardio.sessions}`);
  lines.push(`- Total time: ${Math.round(analysis.cardio.totalTimeSec / 60)} min`);
  lines.push(`- Total distance: ${(analysis.cardio.totalDistanceM / 1000).toFixed(1)} km`);
  lines.push('');

  lines.push('### My Exercise Library');
  lines.push('');
  const active = exercises.filter(e => !e.archived);
  for (const ex of active) {
    const sec = ex.secondaryMuscles.length > 0 ? ` (secondary: ${ex.secondaryMuscles.join(', ')})` : '';
    lines.push(`- ${ex.name} [${ex.muscleGroup}]${sec} — ${ex.category}, ${ex.equipment}`);
  }
  lines.push('');

  lines.push('---');
  lines.push('Based on this training data and my available exercises, what muscle groups should I prioritise in the coming days? Suggest specific exercises from my library and explain why.');

  return lines.join('\n');
}
