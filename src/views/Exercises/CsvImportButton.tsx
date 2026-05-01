import { useRef, useState } from 'react';
import { parseLibraryCsv } from '../../lib/csv';
import { mergeExerciseLibrary } from '../../db/exercises';

interface CsvImportButtonProps {
  onImported: () => void;
}

export function CsvImportButton({ onImported }: CsvImportButtonProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleFile(text: string) {
    setLoading(true);
    setStatus(null);
    try {
      const rows = parseLibraryCsv(text);
      if (rows.length === 0) {
        setStatus('No valid rows found in CSV.');
        return;
      }
      const { inserted, updated } = await mergeExerciseLibrary(rows);
      setStatus(`Imported: ${inserted} new, ${updated} updated.`);
      onImported();
    } catch (e) {
      setStatus(`Error: ${e}`);
    } finally {
      setLoading(false);
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => handleFile(ev.target?.result as string);
    reader.readAsText(file);
    e.target.value = '';
  }

  async function importFromUrl() {
    const url = prompt('Enter library CSV URL:');
    if (!url) return;
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await handleFile(await res.text());
    } catch (e) {
      setStatus(`Fetch failed: ${e}`);
      setLoading(false);
    }
  }

  return (
    <div>
      <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={onFileChange} />
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()} disabled={loading}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          {loading ? 'Importing…' : 'Import CSV'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={importFromUrl} disabled={loading}>
          From URL
        </button>
      </div>
      {status && (
        <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          {status}
        </div>
      )}
    </div>
  );
}
