import { getDb, idbGet, idbGetAll, idbPut, idbDelete } from './connection';
import type { PlanDay } from '../types';

export async function getPlanDay(date: string): Promise<PlanDay | undefined> {
  const db = await getDb();
  return idbGet<PlanDay>(db, 'plan', date);
}

export async function getAllPlanDays(): Promise<PlanDay[]> {
  const db = await getDb();
  return idbGetAll<PlanDay>(db, 'plan');
}

export async function putPlanDay(day: PlanDay): Promise<void> {
  const db = await getDb();
  await idbPut<PlanDay>(db, 'plan', day);
}

export async function deletePlanDay(date: string): Promise<void> {
  const db = await getDb();
  await idbDelete(db, 'plan', date);
}
