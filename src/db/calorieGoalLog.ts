import { getDb, idbGetAll, idbPut } from './connection';
import type { CalorieGoalLog } from '../types';

export async function getAllCalorieGoals(): Promise<CalorieGoalLog[]> {
  const db = await getDb();
  const all = await idbGetAll<CalorieGoalLog>(db, 'calorieGoalLog');
  return all.sort((a, b) => a.date.localeCompare(b.date));
}

/** Returns the active goal on or before `targetDate`. */
export async function getActiveGoalForDate(targetDate: string): Promise<CalorieGoalLog | null> {
  const all = await getAllCalorieGoals();
  const applicable = all.filter(g => g.date <= targetDate);
  if (applicable.length === 0) return null;
  return applicable[applicable.length - 1]; // last in sorted order = most recent
}

/** Append a new goal entry — never mutates existing records. */
export async function addCalorieGoal(goal: Omit<CalorieGoalLog, 'id'>): Promise<CalorieGoalLog> {
  const db = await getDb();
  const record: CalorieGoalLog = { ...goal, id: `cg_${Date.now()}` };
  await idbPut(db, 'calorieGoalLog', record);
  return record;
}
