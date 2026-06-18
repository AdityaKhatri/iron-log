import { getDb, idbGetAll, idbGetByIndex, idbPut, idbDelete } from './connection';
import type { NutritionLog } from '../types';

function backfillLog(log: NutritionLog): NutritionLog {
  if (log.category === undefined) (log as unknown as Record<string, unknown>).category = 'misc';
  if (log.carbs === undefined) (log as unknown as Record<string, unknown>).carbs = 0;
  return log;
}

export async function getAllNutritionLogs(): Promise<NutritionLog[]> {
  const db = await getDb();
  const all = await idbGetAll<NutritionLog>(db, 'nutritionLog');
  return all.map(backfillLog).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getNutritionLogsByDate(date: string): Promise<NutritionLog[]> {
  const db = await getDb();
  const logs = await idbGetByIndex<NutritionLog>(db, 'nutritionLog', 'date', date);
  return logs.map(backfillLog);
}

export async function addNutritionLog(entry: Omit<NutritionLog, 'id' | 'createdAt'>): Promise<NutritionLog> {
  const db = await getDb();
  const record: NutritionLog = {
    ...entry,
    id: `nl_${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  await idbPut(db, 'nutritionLog', record);
  return record;
}

export async function deleteNutritionLog(id: string): Promise<void> {
  const db = await getDb();
  await idbDelete(db, 'nutritionLog', id);
}

export async function updateNutritionLog(entry: NutritionLog): Promise<void> {
  const db = await getDb();
  await idbPut(db, 'nutritionLog', entry);
}
