import { useState } from 'react';
import { parseLibraryCsv } from '../../lib/csv';
import { mergeExerciseLibrary } from '../../db/exercises';
interface Props {
  onSynced: () => void;
}

export function LibrarySyncButton({ onSynced }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');
  const [msg, setMsg] = useState('');

  async function handleSync() {
    setStatus('loading');
    setMsg('');
    try {
      const url = `${import.meta.env.BASE_URL}library.csv`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const rows = parseLibraryCsv(text);
      if (rows.length === 0) throw new Error('CSV appears empty or invalid');
      const { inserted, updated } = await mergeExerciseLibrary(rows);
      setMsg(`${inserted} new · ${updated} updated`);
      setStatus('ok');
      onSynced();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
      setStatus('err');
    }
  }

  return (
    <div>
      <button
        className="btn ghost btn-sm btn-full"
        style={{ justifyContent: 'flex-start', flex: 'none', width: '100%' }}
        onClick={handleSync}
        disabled={status === 'loading'}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
          <polyline points="1 4 1 10 7 10" />
          <path d="M3.51 15a9 9 0 1 0 .49-4.95" />
        </svg>
        {status === 'loading' ? 'Syncing…' : 'Sync Library from GitHub'}
      </button>
      {msg && (
        <div style={{
          fontSize: 11,
          fontFamily: 'var(--mono)',
          padding: '3px 8px',
          color: status === 'err' ? '#fc8181' : 'var(--grp-cardio)',
        }}>
          {msg}
        </div>
      )}
    </div>
  );
}
