import { uid } from './ids';
import type { Workout, Exercise, GroupType } from '../types';

// Raw GitHub URL for the exercise library so the AI can browse it
const LIBRARY_CSV_URL =
  'https://raw.githubusercontent.com/AdityaKhatri/iron-log/main/public/library.csv';

// ─── Prompt ───────────────────────────────────────────────────────────────────

export const AI_PROMPT = `You are a workout planning assistant for IronLog, a workout tracking app.

## Exercise Library
All available exercises are listed in this CSV file — use exercise names **exactly** as they appear in the "name" column:
${LIBRARY_CSV_URL}

## Output Format
When the user approves the workout, output ONLY a JSON code block in this format:

\`\`\`json
{
  "name": "Workout Name",
  "notes": "optional description",
  "groups": [
    {
      "name": "Group display name",
      "type": "main",
      "exercises": [
        {
          "name": "Exercise Name",
          "sets": 3,
          "reps": "8-12",
          "rest": 90,
          "notes": ""
        }
      ]
    }
  ]
}
\`\`\`

**Group types:** warmup · mobility · activation · main · accessory · cardio · cooldown
**reps:** string like "10", "8-12", "AMRAP", or null for timed exercises
**rest:** seconds between sets
**For timed exercises** (holds, stretches, cardio): omit reps and use "time": 30 (seconds)

## Your job
1. Ask the user about their goals, available equipment, experience level, and which muscles to target
2. Propose a workout plan using exercises from the library CSV
3. Refine based on feedback
4. When the user is happy, output the final JSON block — nothing else after it`.trim();

// ─── Parser ───────────────────────────────────────────────────────────────────

interface AIExercise {
  name: string;
  sets?: number | null;
  reps?: string | null;
  time?: number | null;
  rest?: number | null;
  notes?: string;
}

interface AIGroup {
  name: string;
  type?: string;
  exercises: AIExercise[];
}

interface AIWorkout {
  name: string;
  notes?: string;
  groups: AIGroup[];
}

/** Extract and parse JSON from an AI response (handles ```json ... ``` blocks). */
export function parseAIJson(text: string): AIWorkout {
  // Try to extract from a ```json ... ``` or ``` ... ``` block first
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = codeBlock ? codeBlock[1].trim() : text.trim();
  const parsed = JSON.parse(jsonStr) as AIWorkout;

  if (!parsed.name || !Array.isArray(parsed.groups)) {
    throw new Error('Missing required fields: name, groups');
  }
  for (const g of parsed.groups) {
    if (!Array.isArray(g.exercises)) throw new Error(`Group "${g.name}" has no exercises array`);
  }
  return parsed;
}

// ─── Name → ID resolution ─────────────────────────────────────────────────────

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

export interface AIResolvedExercise {
  aiName: string;
  exercise: Exercise | null; // null = not found in library
  sets: number;
  reps: string | null;
  time: number | null;
  rest: number | null;
  notes: string;
}

export interface AIResolvedGroup {
  name: string;
  groupType: GroupType;
  exercises: AIResolvedExercise[];
}

export interface AIResolveResult {
  workoutName: string;
  workoutNotes: string;
  groups: AIResolvedGroup[];
  missingCount: number;
}

const VALID_GROUP_TYPES = new Set<GroupType>([
  'warmup', 'mobility', 'activation', 'main', 'accessory', 'cardio', 'cooldown',
]);

export function resolveAIWorkout(parsed: AIWorkout, library: Exercise[]): AIResolveResult {
  // Build lookup maps
  const byId = new Map(library.map(e => [e.id, e]));
  const byExactName = new Map(library.map(e => [e.name.toLowerCase(), e]));
  const byNorm = new Map(library.map(e => [normalize(e.name), e]));

  function resolveExercise(name: string): Exercise | null {
    // 1. Exact id (AI might already use IDs)
    if (byId.has(name)) return byId.get(name)!;
    // 2. Exact name (case-insensitive)
    const lower = name.toLowerCase();
    if (byExactName.has(lower)) return byExactName.get(lower)!;
    // 3. Normalized (strip punctuation/extra spaces)
    const norm = normalize(name);
    if (byNorm.has(norm)) return byNorm.get(norm)!;
    // 4. Substring: find library entry whose normalized name includes all words
    const words = norm.split(' ').filter(Boolean);
    for (const [key, ex] of byNorm) {
      if (words.every(w => key.includes(w))) return ex;
    }
    return null;
  }

  let missingCount = 0;
  const groups: AIResolvedGroup[] = parsed.groups.map(g => ({
    name: g.name || 'Group',
    groupType: VALID_GROUP_TYPES.has(g.type as GroupType) ? g.type as GroupType : 'main',
    exercises: g.exercises.map(ex => {
      const resolved = resolveExercise(ex.name);
      if (!resolved) missingCount++;
      return {
        aiName: ex.name,
        exercise: resolved,
        sets: ex.sets ?? 3,
        reps: ex.reps ?? null,
        time: ex.time ?? null,
        rest: ex.rest ?? null,
        notes: ex.notes ?? '',
      };
    }),
  }));

  return {
    workoutName: parsed.name,
    workoutNotes: parsed.notes ?? '',
    groups,
    missingCount,
  };
}

// ─── Build Workout record ─────────────────────────────────────────────────────

export function buildWorkoutFromAI(resolved: AIResolveResult): Workout {
  const now = Date.now();
  return {
    id: uid('w'),
    name: resolved.workoutName,
    notes: resolved.workoutNotes,
    archived: false,
    updatedAt: now,
    groups: resolved.groups.map(g => ({
      id: uid('g'),
      name: g.name,
      groupType: g.groupType,
      blocks: g.exercises
        .filter(ex => ex.exercise !== null)
        .map(ex => ({
          id: uid('b'),
          exerciseId: ex.exercise!.id,
          targetSets: ex.sets,
          targetReps: ex.reps,
          targetWeight: null,
          targetTime: ex.time,
          targetDistance: null,
          restSec: ex.rest,
          notes: ex.notes,
        })),
    })),
  };
}
