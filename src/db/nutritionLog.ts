import { getDb, idbGetAll, idbGetByIndex, idbPut, idbDelete } from './connection';
import type { NutritionLog } from '../types';

export async function getAllNutritionLogs(): Promise<NutritionLog[]> {
  const db = await getDb();
  const all = await idbGetAll<NutritionLog>(db, 'nutritionLog');
  return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getNutritionLogsByDate(date: string): Promise<NutritionLog[]> {
  const db = await getDb();
  return idbGetByIndex<NutritionLog>(db, 'nutritionLog', 'date', date);
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
