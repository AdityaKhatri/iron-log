import { uid } from './ids';
import type { Workout, Exercise, GroupType } from '../types';

// Publicly served JSON — AI agents can fetch this directly
const EXERCISES_JSON_URL = 'https://adityakhatri.github.io/iron-log/exercises.json';

// ─── Shared prompt sections ───────────────────────────────────────────────────

const LIBRARY_SECTION = `## Exercise Library
Fetch this URL to get all available exercises as JSON — use exercise names **exactly** as they appear in the "name" field:
${EXERCISES_JSON_URL}

Each entry has: name, muscleGroup, secondaryMuscles, equipment, category, defaultUnit.`;

const FORMAT_RULES = `**Group types:** warmup · mobility · activation · main · accessory · cardio · cooldown
**reps:** string like "10", "8-12", "AMRAP", or null for timed exercises
**rest:** seconds between sets
**For timed exercises** (holds, stretches, cardio): omit reps and use "time": 30 (seconds)`;

// ─── Single workout prompt ────────────────────────────────────────────────────

export const SINGLE_PROMPT = `You are a workout planning assistant for IronLog, a workout tracking app.

${LIBRARY_SECTION}

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

${FORMAT_RULES}

## Your job
1. Ask the user about their goals, available equipment, experience level, and which muscles to target
2. Propose a workout using exercises from the library
3. Refine based on feedback
4. When the user is happy, output the final JSON block — nothing else after it`.trim();

// ─── Week plan prompt ─────────────────────────────────────────────────────────

export function buildPlanPrompt(days: number): string {
  return `You are a workout planning assistant for IronLog, a workout tracking app. The user wants a ${days}-day weekly workout plan.

${LIBRARY_SECTION}

## Output Format
When the user approves the plan, output ONLY a single JSON code block containing all ${days} workouts:

\`\`\`json
{
  "workouts": [
    {
      "name": "Day 1 — Push",
      "notes": "optional",
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
  ]
}
\`\`\`

The "workouts" array must contain exactly ${days} workouts. Name each one clearly (e.g. "Push", "Pull", "Legs", "Upper", "Lower", "Full Body").

${FORMAT_RULES}

## Your job
1. Ask the user about their goals, available equipment, experience level, and training style (e.g. Push/Pull/Legs, Upper/Lower, Full Body)
2. Design a balanced ${days}-day split using exercises from the library
3. Ensure adequate muscle group recovery between sessions
4. Refine based on feedback
5. When the user is happy, output the final JSON block containing all ${days} workouts — nothing else after it`.trim();
}

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

/**
 * Extract and parse JSON from an AI response (handles ```json ... ``` blocks).
 * Always returns an array — handles both single workout and multi-workout formats.
 */
export function parseAIResponse(text: string): AIWorkout[] {
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = codeBlock ? codeBlock[1].trim() : text.trim();
  const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

  // Multi-workout: { workouts: [...] }
  if (Array.isArray(parsed.workouts)) {
    const workouts = parsed.workouts as AIWorkout[];
    workouts.forEach((w, i) => {
      if (!w.name || !Array.isArray(w.groups))
        throw new Error(`Workout ${i + 1} is missing "name" or "groups"`);
    });
    return workouts;
  }

  // Single workout: { name, groups, ... }
  const single = parsed as unknown as AIWorkout;
  if (!single.name || !Array.isArray(single.groups))
    throw new Error('Missing required fields: name, groups (or workouts array for a plan)');
  return [single];
}

// ─── Name → ID resolution ────────────────────────────────────────────────────

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

export interface AIResolvedExercise {
  aiName: string;
  exercise: Exercise | null;
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

function buildLookups(library: Exercise[]) {
  return {
    byId: new Map(library.map(e => [e.id, e])),
    byExactName: new Map(library.map(e => [e.name.toLowerCase(), e])),
    byNorm: new Map(library.map(e => [normalize(e.name), e])),
  };
}

function resolveExerciseName(
  name: string,
  lookups: ReturnType<typeof buildLookups>,
): Exercise | null {
  const { byId, byExactName, byNorm } = lookups;
  if (byId.has(name)) return byId.get(name)!;
  const lower = name.toLowerCase();
  if (byExactName.has(lower)) return byExactName.get(lower)!;
  const norm = normalize(name);
  if (byNorm.has(norm)) return byNorm.get(norm)!;
  const words = norm.split(' ').filter(Boolean);
  for (const [key, ex] of byNorm) {
    if (words.every(w => key.includes(w))) return ex;
  }
  return null;
}

export function resolveAIWorkouts(workouts: AIWorkout[], library: Exercise[]): AIResolveResult[] {
  const lookups = buildLookups(library);
  return workouts.map(parsed => {
    let missingCount = 0;
    const groups: AIResolvedGroup[] = parsed.groups.map(g => ({
      name: g.name || 'Group',
      groupType: VALID_GROUP_TYPES.has(g.type as GroupType) ? g.type as GroupType : 'main',
      exercises: g.exercises.map(ex => {
        const exercise = resolveExerciseName(ex.name, lookups);
        if (!exercise) missingCount++;
        return {
          aiName: ex.name,
          exercise,
          sets: ex.sets ?? 3,
          reps: ex.reps ?? null,
          time: ex.time ?? null,
          rest: ex.rest ?? null,
          notes: ex.notes ?? '',
        };
      }),
    }));
    return { workoutName: parsed.name, workoutNotes: parsed.notes ?? '', groups, missingCount };
  });
}

// ─── Build Workout records ────────────────────────────────────────────────────

export function buildWorkoutsFromAI(results: AIResolveResult[]): Workout[] {
  const now = Date.now();
  return results.map(resolved => ({
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
  }));
}
