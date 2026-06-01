import { getDb, idbGet, idbPut } from './connection';
import type { ProfileRecord } from '../types';

const DEFAULT_PROFILE: ProfileRecord = {
  id: 'profile',
  name: '',
  dateOfBirth: null,
  heightCm: null,
  sex: null,
  activityLevel: null,
  unit: 'kg',
  goalWeight: null,
  updatedAt: 0,
};

export async function getProfile(): Promise<ProfileRecord> {
  const db = await getDb();
  const record = await idbGet<ProfileRecord>(db, 'profile', 'profile');
  if (record) return record;

  // One-time migration from legacy meta store
  const metaRec = await idbGet<{ key: string; value: unknown }>(db, 'meta', 'profile');
  if (metaRec?.value) {
    const old = metaRec.value as Partial<ProfileRecord>;
    const migrated: ProfileRecord = {
      ...DEFAULT_PROFILE,
      name: old.name ?? '',
      dateOfBirth: old.dateOfBirth ?? null,
      heightCm: old.heightCm ?? null,
      unit: old.unit ?? 'kg',
      goalWeight: old.goalWeight ?? null,
      updatedAt: Date.now(),
    };
    await idbPut(db, 'profile', migrated);
    return migrated;
  }

  return DEFAULT_PROFILE;
}

export async function setProfile(record: Omit<ProfileRecord, 'id'>): Promise<ProfileRecord> {
  const db = await getDb();
  const updated: ProfileRecord = { ...record, id: 'profile', updatedAt: Date.now() };
  await idbPut(db, 'profile', updated);
  return updated;
}
