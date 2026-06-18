import { useEffect, useState } from 'react';
import { getProfile, setProfile } from '../../db/profile';
import { getAllBodyweight, putBodyweight } from '../../db/bodyweight';
import { addCalorieGoal, getActiveGoalForDate } from '../../db/calorieGoalLog';
import { Topbar } from '../../components/Topbar/Topbar';
import { THEME_PAIRS, applyTheme, getTheme, getThemeMode, setThemeMode, listenForSystemThemeChange } from '../../lib/theme';
import type { ThemeKey, ThemeMode } from '../../lib/theme';
import { today } from '../../lib/date';
import { useSyncContext } from '../../context/SyncContext';
import { exportToBackup, mergeFromBackup } from '../../lib/sync';
import { getDb } from '../../db/connection';
import type { ProfileRecord, Bodyweight, CalorieGoalLog } from '../../types';
import type { BackupData } from '../../lib/sync';
import './Profile.css';

const TODAY = today();

const ACTIVITY_LEVELS: { value: number; label: string; sublabel: string }[] = [
  { value: 1.2,   label: 'Sedentary',        sublabel: 'desk job, little exercise' },
  { value: 1.375, label: 'Lightly active',   sublabel: '1–3 workouts / week' },
  { value: 1.55,  label: 'Moderately active',sublabel: '3–5 workouts / week' },
  { value: 1.725, label: 'Very active',       sublabel: '6–7 hard sessions / week' },
  { value: 1.9,   label: 'Athlete',           sublabel: '2× daily training' },
];

function getAge(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

function calculateBMR(weightKg: number, heightCm: number, age: number, sex: 'male' | 'female'): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

export function ProfileView() {
  const [profile, setProfileState] = useState<ProfileRecord>({
    id: 'profile', name: '', dateOfBirth: null, heightCm: null,
    sex: null, activityLevel: null, unit: 'kg', goalWeight: null, updatedAt: 0,
  });
  const [saved, setSaved] = useState(false);
  const [bodyweights, setBodyweights] = useState<Bodyweight[]>([]);
  const [bwInput, setBwInput] = useState('');
  const [bwSaved, setBwSaved] = useState(false);
  const [activeGoal, setActiveGoal] = useState<CalorieGoalLog | null>(null);
  const [customKcal, setCustomKcal] = useState('');
  const [goalToast, setGoalToast] = useState('');

  useEffect(() => {
    Promise.all([
      getProfile(),
      getAllBodyweight(),
      getActiveGoalForDate(TODAY),
    ]).then(([p, bw, goal]) => {
      setProfileState(p);
      setBodyweights(bw);
      setActiveGoal(goal);
      const todayBw = bw.find(b => b.date === TODAY);
      if (todayBw) setBwInput(String(todayBw.weight));
    });
  }, []);

  async function saveProfile(updated: ProfileRecord) {
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

  async function applyGoal(kcal: number) {
    const latestBw = bodyweights[bodyweights.length - 1];
    if (!latestBw) return;
    const goal = await addCalorieGoal({
      date: TODAY,
      targetCalories: kcal,
      calculatedMaintenance: tdee ?? kcal,
      weightAtTime: latestBw.weight,
      note: '',
    });
    setActiveGoal(goal);
    setGoalToast(`Goal set to ${kcal.toLocaleString()} kcal`);
    setTimeout(() => setGoalToast(''), 2500);
  }

  // Derived calculations
  const age = getAge(profile.dateOfBirth);
  const latestBw = bodyweights[bodyweights.length - 1];
  const recentBw = bodyweights.slice(-10);

  // canShowCalorieSection: enough to show the picker and BMR
  const canShowCalorieSection = !!(latestBw && profile.heightCm && age !== null && profile.sex);
  // canCalculate: also needs an activity level to get TDEE
  const canCalculate = canShowCalorieSection && !!profile.activityLevel;

  let bmr: number | null = null;
  let tdee: number | null = null;
  if (canShowCalorieSection) {
    bmr = Math.round(calculateBMR(latestBw!.weight, profile.heightCm!, age!, profile.sex!));
  }
  if (canCalculate) {
    tdee = Math.round(bmr! * profile.activityLevel!);
  }

  return (
    <div className="profile-view">
      <Topbar title="Profile" right={saved ? <span className="profile-saved-badge">Saved</span> : undefined} />

      <div className="profile-scroll">

        {/* ── Personal Info ── */}
        <section className="profile-section">
          <div className="profile-section-label">Biometrics</div>

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
                onChange={e => saveProfile({ ...profile, dateOfBirth: e.target.value || null })}
              />
              {age !== null && <span className="profile-field-hint">{age} years old</span>}
            </ProfileField>

            <ProfileField label="Height">
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  className="profile-input"
                  type="number"
                  placeholder="cm"
                  min="100" max="250"
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

            <ProfileField label="Sex">
              <div className="profile-unit-toggle">
                {(['male', 'female'] as const).map(s => (
                  <button
                    key={s}
                    className={`profile-unit-btn${profile.sex === s ? ' active' : ''}`}
                    onClick={() => saveProfile({ ...profile, sex: s })}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </ProfileField>

            <ProfileField label="Weight Unit" last>
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
                  type="number" step="0.1" min="20" max="500"
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
        </section>

        {/* ── Calorie Goal ── */}
        <section className="profile-section">
          <div className="profile-section-label">Calorie Goal</div>

          {!canShowCalorieSection ? (
            <div className="profile-card">
              <div className="profile-field last">
                <span className="profile-field-hint">
                  Complete your biometrics above (height, date of birth, sex) and log today's weight to calculate TDEE.
                </span>
              </div>
            </div>
          ) : (
            <>
              {/* Activity level picker — always shown once biometrics are filled */}
              <div className="profile-card cal-card">
                <div className="cal-card-label">Activity Level</div>
                <div className="cal-activity-list">
                  {ACTIVITY_LEVELS.map(lvl => (
                    <button
                      key={lvl.value}
                      className={`cal-activity-row${profile.activityLevel === lvl.value ? ' active' : ''}`}
                      onClick={() => saveProfile({ ...profile, activityLevel: lvl.value })}
                    >
                      <span className="cal-activity-label">{lvl.label}</span>
                      <span className="cal-activity-sub">{lvl.sublabel}</span>
                      {profile.activityLevel === lvl.value && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" style={{ marginLeft: 'auto', flexShrink: 0 }}>
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* TDEE + goal — shown once activity level is also set */}
              {canCalculate && (
                <div className="profile-card cal-card">
                  {/* BMR → Maintenance row */}
                  <div className="cal-tdee-row">
                    <div className="cal-tdee-stat">
                      <span className="cal-tdee-val">{bmr?.toLocaleString()}</span>
                      <span className="cal-tdee-lbl">BMR</span>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--fg-mute)" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    <div className="cal-tdee-stat">
                      <span className="cal-tdee-val cal-tdee-val--main">{tdee?.toLocaleString()}</span>
                      <span className="cal-tdee-lbl">Maintenance</span>
                    </div>
                  </div>

                  {/* Quick-set buttons */}
                  <div className="cal-quickset">
                    {[
                      { delta: -500, label: '−500', sub: 'Aggressive cut' },
                      { delta: -250, label: '−250', sub: 'Cut' },
                      { delta: 0,    label: 'Maintain', sub: `${tdee?.toLocaleString()} kcal` },
                      { delta: +250, label: '+250', sub: 'Lean bulk' },
                      { delta: +500, label: '+500', sub: 'Bulk' },
                    ].map(opt => {
                      const kcal = tdee! + opt.delta;
                      const isActive = activeGoal?.targetCalories === kcal;
                      return (
                        <button
                          key={opt.delta}
                          className={`cal-qs-btn${isActive ? ' active' : ''}`}
                          onClick={() => applyGoal(kcal)}
                        >
                          <span className="cal-qs-delta">{opt.label}</span>
                          <span className="cal-qs-sub">{opt.sub}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom kcal input */}
                  <div className="cal-custom">
                    <input
                      className="profile-input"
                      type="number"
                      inputMode="numeric"
                      placeholder="Custom kcal…"
                      value={customKcal}
                      onChange={e => setCustomKcal(e.target.value)}
                    />
                    <button
                      className="btn primary btn-sm"
                      disabled={!customKcal || isNaN(Number(customKcal))}
                      onClick={() => { applyGoal(Math.round(Number(customKcal))); setCustomKcal(''); }}
                    >
                      Set Goal
                    </button>
                  </div>

                  {/* Active goal */}
                  {activeGoal && (
                    <div className="cal-active-goal">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>Goal: <strong>{activeGoal.targetCalories.toLocaleString()} kcal/day</strong></span>
                      <span className="profile-field-hint" style={{ marginLeft: 'auto' }}>set {activeGoal.date}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Toast */}
              {goalToast && (
                <div className="cal-toast">{goalToast}</div>
              )}
            </>
          )}
        </section>

        {/* ── Settings ── */}
        <SettingsSection />

      </div>
    </div>
  );
}

// ─── Settings Section ─────────────────────────────────────────────────────────

function SettingsSection() {
  const { account, syncing, lastSync, error, connect, disconnect, syncNow, clearError } = useSyncContext();
  const [importError, setImportError] = useState<string | null>(null);
  const [wipePending, setWipePending] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<ThemeKey>(getTheme);
  const [mode, setMode] = useState<ThemeMode>(getThemeMode);
  const driveConfigured = !!(import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined);

  const effectiveDark = mode === 'auto'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : mode === 'dark';

  useEffect(() => {
    return listenForSystemThemeChange(() => {
      applyTheme();
      setCurrentTheme(getTheme());
    });
  }, []);

  function handleModeChange(m: ThemeMode) {
    setThemeMode(m);
    setMode(m);
    if (m === 'auto') {
      applyTheme();
    } else {
      const pair = THEME_PAIRS.find(p => p.dark.key === currentTheme || p.light.key === currentTheme);
      if (pair) {
        const key = m === 'dark' ? pair.dark.key : pair.light.key;
        applyTheme(key);
        setCurrentTheme(key);
      }
    }
  }

  function handleThemeSelect(key: ThemeKey) {
    applyTheme(key);
    setCurrentTheme(key);
    const pair = THEME_PAIRS.find(p => p.dark.key === key || p.light.key === key);
    if (pair && mode !== 'auto') {
      const isDark = pair.dark.key === key;
      if ((isDark && mode === 'light') || (!isDark && mode === 'dark')) {
        setThemeMode(isDark ? 'dark' : 'light');
        setMode(isDark ? 'dark' : 'light');
      }
    }
  }

  function formatLastSync(ts: number | null): string {
    if (!ts) return 'Never';
    return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  async function handleExport() {
    try {
      const backup = await exportToBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rtb-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Export failed');
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text) as BackupData;
      await mergeFromBackup(data);
      alert('Import complete. Reload the app to see changes.');
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
    }
    e.target.value = '';
  }

  async function handleWipe() {
    if (!wipePending) { setWipePending(true); return; }
    try {
      const stores = ['exercises', 'workouts', 'plan', 'sessions', 'bodyweight', 'meta',
        'profile', 'nutritionLog', 'calorieGoalLog'];
      const db = await getDb();
      await Promise.all(stores.map(store =>
        new Promise<void>((resolve, reject) => {
          const req = db.transaction(store, 'readwrite').objectStore(store).clear();
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        })
      ));
      window.location.reload();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Wipe failed');
    }
  }

  return (
    <section className="profile-section">
      <div className="profile-section-label">Settings</div>

      {/* ── Sync & Backup ── */}
      {driveConfigured ? (
        <>
          <div className="profile-settings-group-label">Sync &amp; Backup</div>
          <div className="profile-card" style={{ marginBottom: 16 }}>
            {account ? (
              <>
                <div className="profile-field">
                  <span className="profile-field-label">Account</span>
                  <div className="profile-field-value" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--fg)' }}>{account.email}</span>
                    <span className="profile-field-hint">Last sync: {formatLastSync(lastSync)}</span>
                  </div>
                </div>
                {error && (
                  <div className="profile-sync-error">
                    <span>{error}</span>
                    <button className="btn ghost btn-sm" onClick={clearError}>✕</button>
                  </div>
                )}
                <div className="profile-field last" style={{ gap: 8, justifyContent: 'flex-end' }}>
                  <button className="btn outline btn-sm" onClick={syncNow} disabled={syncing}>
                    {syncing ? 'Syncing…' : 'Sync Now'}
                  </button>
                  <button className="btn ghost btn-sm" onClick={disconnect} style={{ color: 'var(--fg-mute)' }}>
                    Disconnect
                  </button>
                </div>
              </>
            ) : (
              <div className="profile-field last">
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--fg)', marginBottom: 4 }}>Google Drive</div>
                  <div className="profile-field-hint">Back up your data across devices</div>
                </div>
                <button className="btn primary btn-sm" onClick={connect} disabled={syncing}>
                  {syncing ? 'Connecting…' : 'Connect'}
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="profile-settings-group-label">Sync &amp; Backup</div>
          <div className="profile-card" style={{ marginBottom: 16 }}>
            <div className="profile-field last">
              <span className="profile-field-hint">Drive sync not configured.</span>
            </div>
          </div>
        </>
      )}

      {/* ── Data ── */}
      <div className="profile-settings-group-label">Data</div>
      <div className="profile-card" style={{ marginBottom: 16 }}>
        <div className="profile-field">
          <span className="profile-field-label">Export</span>
          <div className="profile-field-value">
            <button className="btn outline btn-sm" onClick={handleExport}>Export JSON</button>
          </div>
        </div>
        <div className="profile-field">
          <span className="profile-field-label">Import</span>
          <div className="profile-field-value">
            <label className="btn outline btn-sm" style={{ cursor: 'pointer' }}>
              Import JSON
              <input type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleImport} />
            </label>
          </div>
        </div>
        <div className="profile-field last">
          <span className="profile-field-label">Wipe All Data</span>
          <div className="profile-field-value">
            <button
              className={`btn btn-sm${wipePending ? ' primary' : ' ghost'}`}
              onClick={handleWipe}
              style={wipePending ? { background: 'var(--color-danger)', borderColor: 'var(--color-danger)' } : { color: 'var(--fg-mute)' }}
              onBlur={() => setWipePending(false)}
            >
              {wipePending ? 'Confirm wipe' : 'Wipe'}
            </button>
          </div>
        </div>
      </div>

      {importError && (
        <div className="profile-sync-error" style={{ marginBottom: 12 }}>
          <span>{importError}</span>
          <button className="btn ghost btn-sm" onClick={() => setImportError(null)}>✕</button>
        </div>
      )}

      {/* ── Appearance ── */}
      <div className="profile-settings-group-label">Appearance</div>
      <div className="profile-card" style={{ marginBottom: 10 }}>
        <div className="profile-field last">
          <span className="profile-field-label">Mode</span>
          <div className="profile-unit-toggle">
            <button className={`profile-unit-btn${mode === 'dark' ? ' active' : ''}`} onClick={() => handleModeChange('dark')}>Dark</button>
            <button className={`profile-unit-btn${mode === 'auto' ? ' active' : ''}`} onClick={() => handleModeChange('auto')}>Auto</button>
            <button className={`profile-unit-btn${mode === 'light' ? ' active' : ''}`} onClick={() => handleModeChange('light')}>Light</button>
          </div>
        </div>
      </div>
      <div className="theme-list" style={{ marginBottom: 32 }}>
        {THEME_PAIRS.map(pair => {
          const t = effectiveDark ? pair.dark : pair.light;
          const isActive = currentTheme === pair.dark.key || currentTheme === pair.light.key;
          return (
            <button
              key={t.key}
              className={`theme-list-row${isActive ? ' theme-list-row--active' : ''}`}
              onClick={() => handleThemeSelect(t.key)}
            >
              <span className="theme-list-row__name">{pair.pairName.split(' × ')[effectiveDark ? 0 : 1]}</span>
              <div className="theme-list-row__palette">
                <span className="theme-pal-dot" style={{ background: t.bg }} />
                <span className="theme-pal-dot" style={{ background: t.surface }} />
                <span className="theme-pal-dot" style={{ background: t.fg }} />
                <span className="theme-pal-dot" style={{ background: t.accent }} />
              </div>
            </button>
          );
        })}
      </div>
    </section>
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
