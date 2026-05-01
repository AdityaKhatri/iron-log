import { getDb, idbGet, idbPut } from './connection';
import type { MetaRecord, Preferences, Session, UserProfile } from '../types';

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await getDb();
  const record = await idbGet<MetaRecord>(db, 'meta', key);
  return record?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  await idbPut<MetaRecord>(db, 'meta', { key, value });
}

export async function getPreferences(): Promise<Preferences> {
  const prefs = await getMeta<Preferences>('preferences');
  return prefs ?? { unit: 'kg', restTimerSound: true, theme: 'system' };
}

export async function setPreferences(prefs: Preferences): Promise<void> {
  await setMeta('preferences', prefs);
}

export async function getActiveSession(): Promise<Session | null> {
  const session = await getMeta<Session>('activeSession');
  return session ?? null;
}

export async function setActiveSession(session: Session | null): Promise<void> {
  await setMeta('activeSession', session);
}

export async function getSchemaVersion(): Promise<number> {
  const v = await getMeta<number>('schema_version');
  return v ?? 0;
}

export async function setSchemaVersion(v: number): Promise<void> {
  await setMeta('schema_version', v);
}

const DEFAULT_PROFILE: UserProfile = {
  name: '',
  dateOfBirth: null,
  heightCm: null,
  goalWeight: null,
  unit: 'kg',
};

export async function getProfile(): Promise<UserProfile> {
  const p = await getMeta<UserProfile>('profile');
  return p ?? DEFAULT_PROFILE;
}

export async function setProfile(profile: UserProfile): Promise<void> {
  await setMeta('profile', profile);
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

export async function getOnboardingDone(): Promise<boolean> {
  const v = await getMeta<boolean>('onboarding_done');
  return v === true;
}

export async function setOnboardingDone(): Promise<void> {
  await setMeta('onboarding_done', true);
}

// ─── Sync meta ────────────────────────────────────────────────────────────────

export interface SyncMeta {
  email: string;
  name: string;
  lastSync: number | null;
}

export async function getSyncMeta(): Promise<SyncMeta | null> {
  const v = await getMeta<SyncMeta>('sync');
  return v ?? null;
}

export async function setSyncMeta(s: SyncMeta | null): Promise<void> {
  await setMeta('sync', s);
}
