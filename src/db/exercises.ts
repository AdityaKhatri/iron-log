import { getDb, idbGet, idbGetAll, idbPut, idbPutMany, idbDelete } from './connection';
import { setMeta } from './meta';
import { parsedRowToExercise, type ParsedLibraryRow } from '../lib/csv';
import type { Exercise } from '../types';

export async function getExercise(id: string): Promise<Exercise | undefined> {
  const db = await getDb();
  return idbGet<Exercise>(db, 'exercises', id);
}

export async function getAllExercises(): Promise<Exercise[]> {
  const db = await getDb();
  return idbGetAll<Exercise>(db, 'exercises');
}

export async function putExercise(exercise: Exercise): Promise<void> {
  const db = await getDb();
  await idbPut<Exercise>(db, 'exercises', exercise);
}

export async function deleteExercise(id: string): Promise<void> {
  const db = await getDb();
  await idbDelete(db, 'exercises', id);
}

/**
 * Merge library CSV rows into the exercises store.
 * Rules:
 * - id is the merge key
 * - New id → insert with source: "library"
 * - Existing id, source: "library" → update
 * - Existing id, source: "custom" → skip (never touch custom exercises)
 * - id absent from CSV but in DB → leave alone
 */
export async function mergeExerciseLibrary(rows: ParsedLibraryRow[]): Promise<{ inserted: number; updated: number }> {
  const db = await getDb();
  const existing = await idbGetAll<Exercise>(db, 'exercises');
  const existingMap = new Map(existing.map(ex => [ex.id, ex]));

  const now = Date.now();
  const toWrite: Exercise[] = [];
  let inserted = 0;
  let updated = 0;

  for (const row of rows) {
    const current = existingMap.get(row.id);
    if (current?.source === 'custom') continue;

    const exercise = parsedRowToExercise(row, now) as Exercise;
    if (current) {
      // Preserve archived status from existing record
      exercise.archived = current.archived;
      updated++;
    } else {
      inserted++;
    }
    toWrite.push(exercise);
  }

  if (toWrite.length > 0) {
    await idbPutMany<Exercise>(db, 'exercises', toWrite);
  }

  await setMeta('library_imported_at', now);
  return { inserted, updated };
}
