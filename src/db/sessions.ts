import { getDb, idbGet, idbGetAll, idbPut, idbDelete, idbGetByIndex } from './connection';
import type { Session } from '../types';

export async function getSession(id: string): Promise<Session | undefined> {
  const db = await getDb();
  return idbGet<Session>(db, 'sessions', id);
}

export async function getAllSessions(): Promise<Session[]> {
  const db = await getDb();
  const all = await idbGetAll<Session>(db, 'sessions');
  return all.sort((a, b) => b.startedAt - a.startedAt);
}

export async function getSessionsByDate(date: string): Promise<Session[]> {
  const db = await getDb();
  return idbGetByIndex<Session>(db, 'sessions', 'date', date);
}

export async function putSession(session: Session): Promise<void> {
  const db = await getDb();
  await idbPut<Session>(db, 'sessions', session);
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDb();
  await idbDelete(db, 'sessions', id);
}

export async function getSessionCount(): Promise<number> {
  const all = await getAllSessions();
  return all.length;
}

/** Get sessions in the last N days */
export async function getRecentSessions(days: number): Promise<Session[]> {
  const all = await getAllSessions();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return all.filter(s => s.startedAt >= cutoff);
}

/** Calculate current streak (consecutive days with a finished session) */
export async function getCurrentStreak(): Promise<number> {
  const all = await getAllSessions();
  const finished = all.filter(s => s.finishedAt !== null);
  if (finished.length === 0) return 0;

  const dateSet = new Set(finished.map(s => s.date));
  let streak = 0;
  const today = new Date();

  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    if (dateSet.has(iso)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}
