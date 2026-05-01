import { useEffect, useRef, useState } from 'react';
import { getAllSessions } from '../../db/sessions';
import { getAllExercises } from '../../db/exercises';
import { getAllBodyweight } from '../../db/bodyweight';
import { estimated1RM } from '../../lib/epley';
import type { Exercise, Session, Bodyweight } from '../../types';
import './Progress.css';

export function ProgressView() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [bodyweights, setBodyweights] = useState<Bodyweight[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getAllExercises(), getAllSessions(), getAllBodyweight()]).then(([exs, sess, bw]) => {
      setExercises(exs.filter(e => !e.archived));
      setSessions(sess);
      setBodyweights(bw);
      setLoading(false);
    });
  }, []);

  const exerciseSessions = sessions.flatMap(s =>
    s.groups.flatMap(g =>
      g.blocks
        .filter(b => b.exerciseId === selectedId && !b.skipped)
        .map(b => ({
          date: s.date,
          topSet: b.sets.reduce<{ weight: number; reps: number } | null>((best, set) => {
            if (!set.completed || !set.weight || !set.reps) return best;
            const e1rm = estimated1RM(set.weight, set.reps);
            if (!best) return { weight: set.weight, reps: set.reps };
            return e1rm > estimated1RM(best.weight, best.reps) ? { weight: set.weight, reps: set.reps } : best;
          }, null),
        }))
    )
  ).filter(x => x.topSet);

  return (
    <div className="progress-view">
      <div className="progress-header">
        <h2>Progress</h2>
        {exercises.length > 0 && (
          <select
            className="input"
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
          >
            <option value="">Select exercise…</option>
            {exercises.map(ex => (
              <option key={ex.id} value={ex.id}>{ex.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="progress-content">
        {loading ? (
          <div className="empty-state"><p>Loading…</p></div>
        ) : !selectedId ? (
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" /><line x1="3" y1="20" x2="21" y2="20" />
            </svg>
            <h3>Select an exercise</h3>
            <p>Pick an exercise above to see your progress charts.</p>
          </div>
        ) : exerciseSessions.length === 0 ? (
          <div className="empty-state">
            <h3>No data yet</h3>
            <p>Complete sessions with this exercise to see progress.</p>
          </div>
        ) : (
          <ExerciseChartSection data={exerciseSessions} />
        )}

        {bodyweights.length > 0 && (
          <div className="progress-section">
            <div className="progress-section-title">Bodyweight Trend</div>
            <BodyweightChart data={bodyweights} />
          </div>
        )}
      </div>
    </div>
  );
}

function ExerciseChartSection({ data }: { data: { date: string; topSet: { weight: number; reps: number } | null }[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const points = data.filter(d => d.topSet).map(d => ({
      x: d.date,
      y: estimated1RM(d.topSet!.weight, d.topSet!.reps),
    }));

    if (points.length === 0) return;

    const canvas = canvasRef.current;
    canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;

    const PAD = { top: 20, right: 16, bottom: 30, left: 48 };
    const maxY = Math.max(...points.map(p => p.y)) * 1.1;
    const minY = Math.min(...points.map(p => p.y)) * 0.9;

    const xScale = (i: number) => PAD.left + (i / (points.length - 1 || 1)) * (w - PAD.left - PAD.right);
    const yScale = (v: number) => PAD.top + (1 - (v - minY) / (maxY - minY)) * (h - PAD.top - PAD.bottom);

    ctx.clearRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = PAD.top + (i / 4) * (h - PAD.top - PAD.bottom);
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(w - PAD.right, y); ctx.stroke();
    }

    // Line
    ctx.strokeStyle = '#FF5A1F';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(xScale(i), yScale(p.y));
      else ctx.lineTo(xScale(i), yScale(p.y));
    });
    ctx.stroke();

    // Dots
    points.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(xScale(i), yScale(p.y), 4, 0, Math.PI * 2);
      ctx.fillStyle = '#FF5A1F';
      ctx.fill();
      ctx.strokeStyle = '#15151A';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Y axis labels
    ctx.fillStyle = 'rgba(245,242,235,0.35)';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const v = minY + (1 - i / 4) * (maxY - minY);
      ctx.fillText(Math.round(v) + '', PAD.left - 6, PAD.top + (i / 4) * (h - PAD.top - PAD.bottom) + 4);
    }
  }, [data]);

  return (
    <div className="progress-section">
      <div className="progress-section-title">Estimated 1RM</div>
      <canvas ref={canvasRef} style={{ width: '100%', height: 180, borderRadius: 'var(--radius-md)' }} />
    </div>
  );
}

function BodyweightChart({ data }: { data: Bodyweight[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || data.length === 0) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const canvas = canvasRef.current;
    canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    const PAD = { top: 20, right: 16, bottom: 30, left: 48 };

    const weights = data.map(d => d.weight);
    const maxY = Math.max(...weights) * 1.05;
    const minY = Math.min(...weights) * 0.95;

    const xScale = (i: number) => PAD.left + (i / (data.length - 1 || 1)) * (w - PAD.left - PAD.right);
    const yScale = (v: number) => PAD.top + (1 - (v - minY) / (maxY - minY)) * (h - PAD.top - PAD.bottom);

    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = PAD.top + (i / 4) * (h - PAD.top - PAD.bottom);
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(w - PAD.right, y); ctx.stroke();
    }

    ctx.strokeStyle = '#F5F2EB';
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    data.forEach((d, i) => {
      if (i === 0) ctx.moveTo(xScale(i), yScale(d.weight));
      else ctx.lineTo(xScale(i), yScale(d.weight));
    });
    ctx.stroke();

    ctx.fillStyle = 'rgba(245,242,235,0.35)';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const v = minY + (1 - i / 4) * (maxY - minY);
      ctx.fillText(v.toFixed(1), PAD.left - 6, PAD.top + (i / 4) * (h - PAD.top - PAD.bottom) + 4);
    }
  }, [data]);

  return <canvas ref={canvasRef} style={{ width: '100%', height: 160, borderRadius: 'var(--radius-md)' }} />;
}
