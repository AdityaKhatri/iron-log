import { useEffect, useRef, useState } from 'react';
import { getProfile, setProfile } from '../../db/meta';
import { LogoMark } from '../../components/Logo/Logo';
import { getAllBodyweight, putBodyweight } from '../../db/bodyweight';
import { getAllSessions } from '../../db/sessions';
import { getAllExercises } from '../../db/exercises';
import { estimated1RM } from '../../lib/epley';
import { today } from '../../lib/date';
import type { UserProfile, Bodyweight, Exercise, Session } from '../../types';
import './Profile.css';

const TODAY = today();

export function ProfileView() {
  const [profile, setProfileState] = useState<UserProfile>({
    name: '', dateOfBirth: null, heightCm: null, goalWeight: null, unit: 'kg',
  });
  const [saved, setSaved] = useState(false);
  const [bodyweights, setBodyweights] = useState<Bodyweight[]>([]);
  const [bwInput, setBwInput] = useState('');
  const [bwSaved, setBwSaved] = useState(false);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedExId, setSelectedExId] = useState('');

  useEffect(() => {
    Promise.all([
      getProfile(),
      getAllBodyweight(),
      getAllSessions(),
      getAllExercises(),
    ]).then(([p, bw, sess, exs]) => {
      setProfileState(p);
      setBodyweights(bw);
      setSessions(sess);
      setExercises(exs.filter(e => !e.archived));
      // Pre-fill today's bodyweight input if exists
      const todayBw = bw.find(b => b.date === TODAY);
      if (todayBw) setBwInput(String(todayBw.weight));
    });
  }, []);

  async function saveProfile(updated: UserProfile) {
    setProfileState(updated);
    await setProfile(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  async function logBodyweight() {
    const val = parseFloat(bwInput);
    if (!val) return;
    const entry: Bodyweight = {
      date: TODAY, weight: val, unit: profile.unit, notes: '', updatedAt: Date.now(),
    };
    await putBodyweight(entry);
    setBodyweights(prev => {
      const without = prev.filter(b => b.date !== TODAY);
      return [...without, entry].sort((a, b) => a.date.localeCompare(b.date));
    });
    setBwSaved(true);
    setTimeout(() => setBwSaved(false), 1800);
  }

  // Age from DOB
  let age: number | null = null;
  if (profile.dateOfBirth) {
    const dob = new Date(profile.dateOfBirth);
    const now = new Date();
    age = now.getFullYear() - dob.getFullYear();
    if (now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())) {
      age--;
    }
  }

  // Recent bodyweight (last 10)
  const recentBw = bodyweights.slice(-10);
  const latestBw = bodyweights[bodyweights.length - 1];

  // Exercise progress data
  const exerciseSessions = sessions.flatMap(s =>
    s.groups.flatMap(g =>
      g.blocks
        .filter(b => b.exerciseId === selectedExId && !b.skipped)
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
    <div className="profile-view">
      <div className="topbar">
        <LogoMark size={18} />
        <span className="crumb">Profile</span>
        {saved && <span className="profile-saved-badge">Saved</span>}
      </div>

      <div className="profile-scroll">

        {/* ── Personal Info ── */}
        <section className="profile-section">
          <div className="profile-section-label">Personal</div>

          <div className="profile-card">
            <ProfileField label="Name">
              <input
                className="profile-input"
                type="text"
                placeholder="Your name"
                value={profile.name}
                onChange={e => setProfileState(p => ({ ...p, name: e.target.value }))}
                onBlur={() => saveProfile(profile)}
              />
            </ProfileField>

            <ProfileField label="Date of Birth">
              <input
                className="profile-input"
                type="date"
                value={profile.dateOfBirth ?? ''}
                onChange={e => {
                  const updated = { ...profile, dateOfBirth: e.target.value || null };
                  saveProfile(updated);
                }}
              />
              {age !== null && <span className="profile-field-hint">{age} years old</span>}
            </ProfileField>

            <ProfileField label="Height">
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  className="profile-input"
                  type="number"
                  placeholder="cm"
                  min="100"
                  max="250"
                  value={profile.heightCm ?? ''}
                  onChange={e => setProfileState(p => ({ ...p, heightCm: e.target.value ? parseFloat(e.target.value) : null }))}
                  onBlur={() => saveProfile(profile)}
                  style={{ width: 80 }}
                />
                <span className="profile-field-unit">cm</span>
                {profile.heightCm && (
                  <span className="profile-field-hint">
                    {Math.floor(profile.heightCm / 30.48)}′{Math.round((profile.heightCm % 30.48) / 2.54)}″
                  </span>
                )}
              </div>
            </ProfileField>

            <ProfileField label="Weight Unit">
              <div className="profile-unit-toggle">
                {(['kg', 'lb'] as const).map(u => (
                  <button
                    key={u}
                    className={`profile-unit-btn${profile.unit === u ? ' active' : ''}`}
                    onClick={() => saveProfile({ ...profile, unit: u })}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </ProfileField>

            <ProfileField label="Goal Weight" last>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  className="profile-input"
                  type="number"
                  placeholder="—"
                  step="0.5"
                  value={profile.goalWeight ?? ''}
                  onChange={e => setProfileState(p => ({ ...p, goalWeight: e.target.value ? parseFloat(e.target.value) : null }))}
                  onBlur={() => saveProfile(profile)}
                  style={{ width: 80 }}
                />
                <span className="profile-field-unit">{profile.unit}</span>
                {latestBw && profile.goalWeight && (
                  <span className="profile-field-hint" style={{ color: latestBw.weight > profile.goalWeight ? 'var(--accent)' : 'var(--grp-cardio)' }}>
                    {Math.abs(latestBw.weight - profile.goalWeight).toFixed(1)} {profile.unit} to go
                  </span>
                )}
              </div>
            </ProfileField>
          </div>
        </section>

        {/* ── Bodyweight ── */}
        <section className="profile-section">
          <div className="profile-section-label">Bodyweight</div>

          <div className="profile-card">
            <ProfileField label="Today's Weight" last>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  className="profile-input"
                  type="number"
                  step="0.1"
                  min="20"
                  max="500"
                  placeholder="0.0"
                  value={bwInput}
                  onChange={e => setBwInput(e.target.value)}
                  style={{ width: 80 }}
                />
                <span className="profile-field-unit">{profile.unit}</span>
                <button className="btn primary btn-sm" onClick={logBodyweight}>Log</button>
                {bwSaved && <span className="profile-saved-badge">Saved</span>}
              </div>
            </ProfileField>
          </div>

          {recentBw.length > 0 && (
            <div className="profile-bw-history">
              {recentBw.slice().reverse().map(b => (
                <div key={b.date} className={`profile-bw-row${b.date === TODAY ? ' today' : ''}`}>
                  <span className="profile-bw-date">{b.date}</span>
                  <span className="profile-bw-value">{b.weight} <span className="profile-field-unit">{b.unit}</span></span>
                </div>
              ))}
            </div>
          )}

          {bodyweights.length >= 2 && (
            <div style={{ marginTop: 12 }}>
              <div className="profile-chart-label">Trend</div>
              <BodyweightChart data={bodyweights} unit={profile.unit} />
            </div>
          )}
        </section>

        {/* ── Exercise Progress ── */}
        <section className="profile-section">
          <div className="profile-section-label">Exercise Progress</div>

          <select
            className="input"
            value={selectedExId}
            onChange={e => setSelectedExId(e.target.value)}
            style={{ width: '100%', marginBottom: 12 }}
          >
            <option value="">Select exercise…</option>
            {exercises.map(ex => (
              <option key={ex.id} value={ex.id}>{ex.name}</option>
            ))}
          </select>

          {selectedExId && exerciseSessions.length === 0 && (
            <div className="empty-state" style={{ padding: '24px 0' }}>
              <h3>No data yet</h3>
              <p>Complete sessions with this exercise to see progress.</p>
            </div>
          )}
          {selectedExId && exerciseSessions.length > 0 && (
            <ExerciseChart data={exerciseSessions} />
          )}
          {!selectedExId && (
            <div className="empty-state" style={{ padding: '24px 0' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" /><line x1="3" y1="20" x2="21" y2="20" />
              </svg>
              <p>Pick an exercise to see your progress charts.</p>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}

function ProfileField({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={`profile-field${last ? ' last' : ''}`}>
      <span className="profile-field-label">{label}</span>
      <div className="profile-field-value">{children}</div>
    </div>
  );
}

function BodyweightChart({ data, unit }: { data: Bodyweight[]; unit: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || data.length < 2) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const canvas = canvasRef.current;
    canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    const PAD = { top: 16, right: 12, bottom: 24, left: 44 };

    const weights = data.map(d => d.weight);
    const maxY = Math.max(...weights) * 1.05;
    const minY = Math.min(...weights) * 0.95;

    const xScale = (i: number) => PAD.left + (i / (data.length - 1)) * (w - PAD.left - PAD.right);
    const yScale = (v: number) => PAD.top + (1 - (v - minY) / (maxY - minY || 1)) * (h - PAD.top - PAD.bottom);

    ctx.clearRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = PAD.top + (i / 4) * (h - PAD.top - PAD.bottom);
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(w - PAD.right, y); ctx.stroke();
    }

    // Line
    ctx.strokeStyle = '#f5f2eb';
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    data.forEach((d, i) => {
      if (i === 0) ctx.moveTo(xScale(i), yScale(d.weight));
      else ctx.lineTo(xScale(i), yScale(d.weight));
    });
    ctx.stroke();

    // Dots
    data.forEach((d, i) => {
      ctx.beginPath();
      ctx.arc(xScale(i), yScale(d.weight), 3, 0, Math.PI * 2);
      ctx.fillStyle = '#f5f2eb';
      ctx.fill();
    });

    // Y labels
    ctx.fillStyle = 'rgba(245,242,235,0.35)';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const v = minY + (1 - i / 4) * (maxY - minY);
      ctx.fillText(v.toFixed(1), PAD.left - 4, PAD.top + (i / 4) * (h - PAD.top - PAD.bottom) + 4);
    }
  }, [data, unit]);

  return <canvas ref={canvasRef} className="profile-chart-canvas" />;
}

function ExerciseChart({ data }: { data: { date: string; topSet: { weight: number; reps: number } | null }[] }) {
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
    const PAD = { top: 16, right: 12, bottom: 24, left: 44 };

    const maxY = Math.max(...points.map(p => p.y)) * 1.1;
    const minY = Math.min(...points.map(p => p.y)) * 0.9;

    const xScale = (i: number) => PAD.left + (i / (points.length - 1 || 1)) * (w - PAD.left - PAD.right);
    const yScale = (v: number) => PAD.top + (1 - (v - minY) / (maxY - minY || 1)) * (h - PAD.top - PAD.bottom);

    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = PAD.top + (i / 4) * (h - PAD.top - PAD.bottom);
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(w - PAD.right, y); ctx.stroke();
    }

    ctx.strokeStyle = '#FF5A1F';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(xScale(i), yScale(p.y));
      else ctx.lineTo(xScale(i), yScale(p.y));
    });
    ctx.stroke();

    points.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(xScale(i), yScale(p.y), 4, 0, Math.PI * 2);
      ctx.fillStyle = '#FF5A1F';
      ctx.fill();
      ctx.strokeStyle = '#15151A';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    ctx.fillStyle = 'rgba(245,242,235,0.35)';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const v = minY + (1 - i / 4) * (maxY - minY);
      ctx.fillText(Math.round(v) + '', PAD.left - 4, PAD.top + (i / 4) * (h - PAD.top - PAD.bottom) + 4);
    }
  }, [data]);

  return (
    <div>
      <div className="profile-chart-label">Estimated 1RM</div>
      <canvas ref={canvasRef} className="profile-chart-canvas" />
    </div>
  );
}
