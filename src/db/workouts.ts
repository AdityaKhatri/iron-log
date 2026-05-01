import { getDb, idbGet, idbGetAll, idbPut, idbDelete } from './connection';
import type { Workout } from '../types';

export async function getWorkout(id: string): Promise<Workout | undefined> {
  const db = await getDb();
  return idbGet<Workout>(db, 'workouts', id);
}

export async function getAllWorkouts(): Promise<Workout[]> {
  const db = await getDb();
  return idbGetAll<Workout>(db, 'workouts');
}

export async function putWorkout(workout: Workout): Promise<void> {
  const db = await getDb();
  await idbPut<Workout>(db, 'workouts', workout);
}

export async function deleteWorkout(id: string): Promise<void> {
  const db = await getDb();
  await idbDelete(db, 'workouts', id);
}
