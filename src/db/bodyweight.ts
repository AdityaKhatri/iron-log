import { getDb, idbGet, idbGetAll, idbPut, idbDelete } from './connection';
import type { Bodyweight } from '../types';

export async function getBodyweight(date: string): Promise<Bodyweight | undefined> {
  const db = await getDb();
  return idbGet<Bodyweight>(db, 'bodyweight', date);
}

export async function getAllBodyweight(): Promise<Bodyweight[]> {
  const db = await getDb();
  const all = await idbGetAll<Bodyweight>(db, 'bodyweight');
  return all.sort((a, b) => a.date.localeCompare(b.date));
}

export async function putBodyweight(entry: Bodyweight): Promise<void> {
  const db = await getDb();
  await idbPut<Bodyweight>(db, 'bodyweight', entry);
}

export async function deleteBodyweight(date: string): Promise<void> {
  const db = await getDb();
  await idbDelete(db, 'bodyweight', date);
}
