import { useCallback, useEffect, useState } from 'react';
import { getAllBodyweight, putBodyweight, getBodyweight } from '../db/bodyweight';
import type { Bodyweight } from '../types';

export function useBodyweight() {
  const [entries, setEntries] = useState<Bodyweight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllBodyweight().then(all => {
      setEntries(all);
      setLoading(false);
    });
  }, []);

  const saveEntry = useCallback(async (entry: Bodyweight) => {
    const updated = { ...entry, updatedAt: Date.now() };
    await putBodyweight(updated);
    setEntries(prev => {
      const idx = prev.findIndex(e => e.date === entry.date);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updated;
        return next;
      }
      return [...prev, updated].sort((a, b) => a.date.localeCompare(b.date));
    });
  }, []);

  return { entries, loading, saveEntry };
}

export function useTodayBodyweight(date: string) {
  const [entry, setEntry] = useState<Bodyweight | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBodyweight(date).then(e => {
      setEntry(e ?? null);
      setLoading(false);
    });
  }, [date]);

  const save = useCallback(async (e: Bodyweight) => {
    const updated = { ...e, updatedAt: Date.now() };
    await putBodyweight(updated);
    setEntry(updated);
  }, []);

  return { entry, loading, save };
}
