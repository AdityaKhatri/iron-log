/**
 * Serialize / merge all IDB stores for Google Drive backup.
 */

import { getDb, idbGetAll, idbPutMany } from '../db/connection';
import { getMeta, setMeta } from '../db/meta';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BackupData {
  version: 2;
  exportedAt: number;
  deviceId: string;
  stores: {
    exercises: unknown[];
    workouts: unknown[];
    plan: unknown[];
    sessions: unknown[];
    bodyweight: unknown[];
    // meta: omit activeSession (ephemeral) and sync state
    preferences: unknown;
    profile: unknown;
  };
}

// ─── Device ID ────────────────────────────────────────────────────────────────

async function getOrCreateDeviceId(): Promise<string> {
  const existing = await getMeta<string>('deviceId');
  if (existing) return existing;

  const id = `device_${Math.random().toString(36).slice(2)}_${Date.now()}`;
  await setMeta('deviceId', id);
  return id;
}

// ─── Export ───────────────────────────────────────────────────────────────────

export async function exportToBackup(): Promise<BackupData> {
  const db = await getDb();
  const deviceId = await getOrCreateDeviceId();

  const [exercises, workouts, plan, sessions, bodyweight, preferences, profile] =
    await Promise.all([
      idbGetAll<unknown>(db, 'exercises'),
      idbGetAll<unknown>(db, 'workouts'),
      idbGetAll<unknown>(db, 'plan'),
      idbGetAll<unknown>(db, 'sessions'),
      idbGetAll<unknown>(db, 'bodyweight'),
      getMeta('preferences'),
      getMeta('profile'),
    ]);

  return {
    version: 2,
    exportedAt: Date.now(),
    deviceId,
    stores: {
      exercises,
      workouts,
      plan,
      sessions,
      bodyweight,
      preferences: preferences ?? null,
      profile: profile ?? null,
    },
  };
}

// ─── Merge ────────────────────────────────────────────────────────────────────

type RecordWithId = { id: string; updatedAt?: number };
type RecordWithDate = { date: string; updatedAt?: number };

function mergeById<T extends RecordWithId>(local: T[], incoming: T[]): T[] {
  const map = new Map<string, T>(local.map(r => [r.id, r]));
  for (const r of incoming) {
    const existing = map.get(r.id);
    if (!existing || (r.updatedAt ?? 0) >= (existing.updatedAt ?? 0)) {
      map.set(r.id, r);
    }
  }
  return Array.from(map.values());
}

function mergeByDate<T extends RecordWithDate>(local: T[], incoming: T[]): T[] {
  const map = new Map<string, T>(local.map(r => [r.date, r]));
  for (const r of incoming) {
    const existing = map.get(r.date);
    if (!existing || (r.updatedAt ?? 0) >= (existing.updatedAt ?? 0)) {
      map.set(r.date, r);
    }
  }
  return Array.from(map.values());
}

export async function mergeFromBackup(data: BackupData): Promise<void> {
  if (data.version !== 2) {
    throw new Error(`Unsupported backup version: ${(data as { version: number }).version}`);
  }

  const db = await getDb();

  // Merge array stores by id/date
  const [localExercises, localWorkouts, localPlan, localSessions, localBodyweight] =
    await Promise.all([
      idbGetAll<RecordWithId>(db, 'exercises'),
      idbGetAll<RecordWithId>(db, 'workouts'),
      idbGetAll<RecordWithDate>(db, 'plan'),
      idbGetAll<RecordWithId>(db, 'sessions'),
      idbGetAll<RecordWithDate>(db, 'bodyweight'),
    ]);

  const mergedExercises = mergeById(localExercises, data.stores.exercises as RecordWithId[]);
  const mergedWorkouts = mergeById(localWorkouts, data.stores.workouts as RecordWithId[]);
  const mergedPlan = mergeByDate(localPlan, data.stores.plan as RecordWithDate[]);
  const mergedSessions = mergeById(localSessions, data.stores.sessions as RecordWithId[]);
  const mergedBodyweight = mergeByDate(localBodyweight, data.stores.bodyweight as RecordWithDate[]);

  // Write merged arrays back
  await Promise.all([
    idbPutMany(db, 'exercises', mergedExercises),
    idbPutMany(db, 'workouts', mergedWorkouts),
    idbPutMany(db, 'plan', mergedPlan),
    idbPutMany(db, 'sessions', mergedSessions),
    idbPutMany(db, 'bodyweight', mergedBodyweight),
  ]);

  // Merge preferences and profile: last-write-wins based on backup exportedAt vs local
  // We don't have per-object updatedAt for these, so if backup exists use it
  // (caller can decide policy; here we just overwrite if backup has data)
  if (data.stores.preferences != null) {
    await setMeta('preferences', data.stores.preferences);
  }
  if (data.stores.profile != null) {
    await setMeta('profile', data.stores.profile);
  }
}
