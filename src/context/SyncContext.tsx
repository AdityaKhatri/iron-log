import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getSyncMeta, setSyncMeta } from '../db/meta';
import { exportToBackup, mergeFromBackup } from '../lib/sync';
import {
  requestToken,
  getUserInfo,
  findBackupFile,
  downloadBackup,
  uploadBackup,
} from '../lib/gapi';
import type { SyncMeta } from '../db/meta';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SyncState {
  account: { email: string; name: string } | null;
  syncing: boolean;
  lastSync: number | null;
  error: string | null;
}

interface SyncContextValue extends SyncState {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  syncNow: () => Promise<void>;
  restoreFromDrive: () => Promise<void>;
  clearError: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const SyncContext = createContext<SyncContextValue | null>(null);

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const SCOPE = [
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ');

// In-memory token cache (not persisted — tokens expire in 1h)
let cachedToken: string | null = null;

async function getToken(silent: boolean): Promise<string> {
  if (cachedToken) return cachedToken;
  if (!CLIENT_ID) throw new Error('VITE_GOOGLE_CLIENT_ID is not configured');
  const token = await requestToken(CLIENT_ID, SCOPE, silent);
  cachedToken = token;
  // Clear cache after 55 minutes (tokens last 60 min)
  setTimeout(() => { cachedToken = null; }, 55 * 60 * 1000);
  return token;
}

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SyncState>({
    account: null,
    syncing: false,
    lastSync: null,
    error: null,
  });

  // Load persisted sync state on mount; clear any in-memory token so the
  // next operation always fetches one with the full scope set.
  useEffect(() => {
    cachedToken = null;
    getSyncMeta().then(meta => {
      if (meta) {
        setState(s => ({
          ...s,
          account: { email: meta.email, name: meta.name },
          lastSync: meta.lastSync,
        }));
      }
    });
  }, []);

  const clearError = useCallback(() => {
    setState(s => ({ ...s, error: null }));
  }, []);

  const connect = useCallback(async () => {
    if (!CLIENT_ID) {
      setState(s => ({ ...s, error: 'Google Drive sync is not configured (missing client ID).' }));
      return;
    }
    try {
      setState(s => ({ ...s, syncing: true, error: null }));
      cachedToken = null; // force fresh token with user consent
      const token = await getToken(false);
      const userInfo = await getUserInfo(token);

      const meta: SyncMeta = {
        email: userInfo.email,
        name: userInfo.name,
        lastSync: null,
      };
      await setSyncMeta(meta);

      setState(s => ({
        ...s,
        account: { email: userInfo.email, name: userInfo.name },
        syncing: false,
      }));

      // Auto-sync after connecting
      await syncNowInternal(token);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const friendly = msg === 'IOS_PWA_POPUP_BLOCKED'
        ? 'ios_pwa'
        : `Connect failed: ${msg}`;
      setState(s => ({ ...s, syncing: false, error: friendly }));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function syncNowInternal(token?: string) {
    try {
      setState(s => ({ ...s, syncing: true, error: null }));
      const t = token ?? await getToken(true);
      const backup = await exportToBackup();
      const existingFileId = await findBackupFile(t);
      await uploadBackup(t, backup, existingFileId);

      const now = Date.now();
      setState(s => {
        const updatedMeta: SyncMeta | null = s.account
          ? { email: s.account.email, name: s.account.name, lastSync: now }
          : null;
        if (updatedMeta) setSyncMeta(updatedMeta);
        return { ...s, syncing: false, lastSync: now };
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setState(s => ({ ...s, syncing: false, error: `Sync failed: ${msg}` }));
    }
  }

  const syncNow = useCallback(async () => {
    await syncNowInternal();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const disconnect = useCallback(async () => {
    cachedToken = null;
    await setSyncMeta(null);
    setState(s => ({ ...s, account: null, lastSync: null, error: null }));
  }, []);

  const restoreFromDrive = useCallback(async () => {
    if (!CLIENT_ID) {
      setState(s => ({ ...s, error: 'Google Drive sync is not configured (missing client ID).' }));
      throw new Error('Drive sync not configured');
    }
    try {
      setState(s => ({ ...s, syncing: true, error: null }));
      cachedToken = null;
      const token = await getToken(false);
      const userInfo = await getUserInfo(token);

      const fileId = await findBackupFile(token);
      if (!fileId) {
        // No backup found — just save the account and return
        const meta: SyncMeta = { email: userInfo.email, name: userInfo.name, lastSync: null };
        await setSyncMeta(meta);
        setState(s => ({
          ...s,
          account: { email: userInfo.email, name: userInfo.name },
          syncing: false,
          error: null,
        }));
        return;
      }

      const backupData = await downloadBackup(token, fileId);
      await mergeFromBackup(backupData as Parameters<typeof mergeFromBackup>[0]);

      const now = Date.now();
      const meta: SyncMeta = { email: userInfo.email, name: userInfo.name, lastSync: now };
      await setSyncMeta(meta);

      setState(s => ({
        ...s,
        account: { email: userInfo.email, name: userInfo.name },
        syncing: false,
        lastSync: now,
        error: null,
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const friendly = msg === 'IOS_PWA_POPUP_BLOCKED' ? 'ios_pwa' : `Restore failed: ${msg}`;
      setState(s => ({ ...s, syncing: false, error: friendly }));
      throw err;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SyncContext.Provider value={{
      ...state,
      connect,
      disconnect,
      syncNow,
      restoreFromDrive,
      clearError,
    }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSyncContext(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSyncContext must be used within SyncProvider');
  return ctx;
}
