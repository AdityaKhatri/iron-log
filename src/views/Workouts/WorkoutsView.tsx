import { useEffect, useState } from 'react';
import { getAllWorkouts, putWorkout } from '../../db/workouts';
import { getAllExercises } from '../../db/exercises';
import { Modal } from '../../components/Modal/Modal';
import { SearchBar } from '../../components/SearchBar/SearchBar';
import { CategoryIcon, CATEGORY_COLOR, CATEGORY_LABEL } from '../../components/CategoryIcon/CategoryIcon';
import { uid } from '../../lib/ids';
import type { Workout, WorkoutGroup, WorkoutBlock, Exercise } from '../../types';
import './Workouts.css';

const GROUP_CLASS: Record<string, string> = {
  warmup: 'g-warmup', mobility: 'g-mobility', activation: 'g-activation',
  main: 'g-main', accessory: 'g-accessory', cardio: 'g-cardio', cooldown: 'g-cooldown',
};

export function WorkoutsView() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Workout | null>(null);

  useEffect(() => {
    getAllWorkouts().then(w => {
      setWorkouts(w.filter(x => !x.archived));
      setLoading(false);
    });
  }, []);

  async function createWorkout() {
    const w: Workout = {
      id: uid('w'),
      name: 'New Workout',
      notes: '',
      groups: [{
        id: uid('g'),
        name: 'Main',
        groupType: 'main',
        blocks: [],
      }],
      archived: false,
      updatedAt: Date.now(),
    };
    await putWorkout(w);
    setWorkouts(prev => [...prev, w]);
    setEditing(w);
  }

  async function saveWorkout(w: Workout) {
    const updated = { ...w, updatedAt: Date.now() };
    await putWorkout(updated);
    setWorkouts(prev => prev.map(x => x.id === updated.id ? updated : x));
    setEditing(updated);
  }

  if (editing) {
    return (
      <WorkoutEditor
        workout={editing}
        onSave={saveWorkout}
        onBack={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="workouts-view">
      <div className="workouts-header">
        <span className="crumb">Workouts</span>
        <button className="icon-btn" onClick={createWorkout} aria-label="New workout" title="New workout">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      <div className="workouts-list">
        {loading ? (
          <div className="empty-state"><p>Loading…</p></div>
        ) : workouts.length === 0 ? (
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6.5 6.5h11" /><path d="M6.5 17.5h11" />
              <path d="M3 9.5h18" /><path d="M3 14.5h18" />
              <rect x="2" y="6.5" width="2" height="11" rx="1" /><rect x="20" y="6.5" width="2" height="11" rx="1" />
            </svg>
            <h3>No workout templates</h3>
            <p>Create your first template to start planning sessions.</p>
            <button className="btn primary" style={{ flex: 'none' }} onClick={createWorkout}>Create Workout</button>
          </div>
        ) : (
          workouts.map(w => (
            <div key={w.id} className="workout-card" onClick={() => setEditing(w)}>
              <div className="workout-card__info">
                <div className="workout-card__name">{w.name}</div>
                <div className="workout-card__meta">
                  {w.groups.length} group{w.groups.length !== 1 ? 's' : ''} ·{' '}
                  {w.groups.reduce((a, g) => a + g.blocks.length, 0)} exercises
                </div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--fg-mute)" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Exercise Picker Modal ────────────────────────────────────────────────────

function ExercisePicker({ open, onClose, onPick }: {
  open: boolean;
  onClose: () => void;
  onPick: (exercise: Exercise) => void;
}) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (open) {
      getAllExercises().then(all => setExercises(all.filter(e => !e.archived)));
    }
  }, [open]);

  const filtered = exercises
    .filter(e => !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.muscleGroup.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Modal open={open} onClose={onClose} title="Pick Exercise" size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Search exercises…" />
        {filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px 0' }}>
            <p>No exercises found. Import the library from the Library tab.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '50vh', overflowY: 'auto' }}>
            {filtered.map(ex => {
              const iconColor = CATEGORY_COLOR[ex.category] ?? 'var(--fg-mute)';
              return (
                <button
                  key={ex.id}
                  className="exercise-picker-row"
                  onClick={() => { onPick(ex); onClose(); }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', background: 'var(--bg)', borderRadius: 4, flexShrink: 0, color: iconColor }}>
                      <CategoryIcon category={ex.category} size={14} color={iconColor} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, textAlign: 'left' }}>{ex.name}</div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--fg-mute)', marginTop: 3, textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {CATEGORY_LABEL[ex.category] ?? ex.category} · {ex.muscleGroup}
                      </div>
                    </div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--fg-mute)" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Block row with targets ───────────────────────────────────────────────────

function BlockRow({ block, onRemove, onChange }: {
  block: WorkoutBlock;
  onRemove: () => void;
  onChange: (updated: WorkoutBlock) => void;
}) {
  return (
    <div className="block-row">
      <span className="block-row__drag">
        <svg width="10" height="14" viewBox="0 0 10 14" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="3" cy="3" r="1" fill="currentColor" stroke="none" />
          <circle cx="7" cy="3" r="1" fill="currentColor" stroke="none" />
          <circle cx="3" cy="7" r="1" fill="currentColor" stroke="none" />
          <circle cx="7" cy="7" r="1" fill="currentColor" stroke="none" />
          <circle cx="3" cy="11" r="1" fill="currentColor" stroke="none" />
          <circle cx="7" cy="11" r="1" fill="currentColor" stroke="none" />
        </svg>
      </span>
      <div className="block-row__name">{block.exerciseId}</div>
      <input
        className="ed-tiny block-row__input"
        type="number"
        min={1}
        placeholder="sets"
        value={block.targetSets ?? ''}
        onChange={e => onChange({ ...block, targetSets: e.target.value ? Number(e.target.value) : null })}
      />
      <input
        className="ed-tiny block-row__input"
        type="text"
        placeholder="reps"
        value={block.targetReps ?? ''}
        onChange={e => onChange({ ...block, targetReps: e.target.value || null })}
      />
      <input
        className="ed-tiny block-row__input"
        type="number"
        placeholder="kg"
        value={block.targetWeight ?? ''}
        onChange={e => onChange({ ...block, targetWeight: e.target.value ? Number(e.target.value) : null })}
      />
      <button
        className="icon-btn"
        style={{ width: 18, height: 18, borderRadius: 2, border: 0, background: 'transparent', color: 'var(--fg-mute)' }}
        onClick={onRemove}
        aria-label="Remove"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

// ─── Workout Editor ───────────────────────────────────────────────────────────

function WorkoutEditor({ workout, onSave, onBack }: {
  workout: Workout;
  onSave: (w: Workout) => Promise<void>;
  onBack: () => void;
}) {
  const [name, setName] = useState(workout.name);
  const [notes, setNotes] = useState(workout.notes);
  const [groups, setGroups] = useState<WorkoutGroup[]>(workout.groups);
  const [pickerForGroup, setPickerForGroup] = useState<number | null>(null);

  async function save() {
    await onSave({ ...workout, name, notes, groups });
  }

  function addGroup() {
    setGroups(prev => [...prev, {
      id: uid('g'),
      name: 'New Group',
      groupType: 'main',
      blocks: [],
    }]);
  }

  function addBlockToGroup(groupIndex: number, exercise: Exercise) {
    const block: WorkoutBlock = {
      id: uid('b'),
      exerciseId: exercise.name,
      targetSets: 3,
      targetReps: '8-10',
      targetWeight: null,
      targetTime: null,
      targetDistance: null,
      restSec: null,
      notes: '',
    };
    setGroups(prev => prev.map((g, i) =>
      i === groupIndex ? { ...g, blocks: [...g.blocks, block] } : g
    ));
  }

  function updateBlock(groupIndex: number, blockIndex: number, updated: WorkoutBlock) {
    setGroups(prev => prev.map((g, gi) =>
      gi === groupIndex
        ? { ...g, blocks: g.blocks.map((b, bi) => bi === blockIndex ? updated : b) }
        : g
    ));
  }

  function removeBlock(groupIndex: number, blockIndex: number) {
    setGroups(prev => prev.map((g, gi) =>
      gi === groupIndex
        ? { ...g, blocks: g.blocks.filter((_, bi) => bi !== blockIndex) }
        : g
    ));
  }

  function removeGroup(groupIndex: number) {
    setGroups(prev => prev.filter((_, i) => i !== groupIndex));
  }

  return (
    <div className="workout-editor">
      <div className="workout-editor__header">
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="crumb" style={{ flex: 1, paddingLeft: 8 }}>{name || 'Workout'}</span>
        <button className="btn primary btn-sm" style={{ flex: 'none' }} onClick={save}>Save</button>
      </div>

      <div className="workout-editor__body">
        <div className="editor-name-wrap">
          <input
            className="ed-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Workout name"
          />
          <textarea
            className="ed-tiny"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Notes…"
            style={{ marginTop: 10, resize: 'none' }}
          />
        </div>

        {groups.map((group, gi) => {
          const groupClass = GROUP_CLASS[group.groupType] ?? 'g-main';
          return (
            <div key={group.id} className={`group ${groupClass} group-editor`}>
              <div className="group-head group-editor__header">
                <input
                  className="ed-input"
                  style={{ fontSize: 16, flex: 1 }}
                  value={group.name}
                  onChange={e => setGroups(prev => prev.map((g, i) => i === gi ? { ...g, name: e.target.value } : g))}
                />
                <select
                  className="ed-tiny"
                  style={{ width: 'auto', flexShrink: 0 }}
                  value={group.groupType}
                  onChange={e => setGroups(prev => prev.map((g, i) => i === gi ? { ...g, groupType: e.target.value as WorkoutGroup['groupType'] } : g))}
                >
                  {['warmup','mobility','activation','main','accessory','cardio','cooldown'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <button
                  className="icon-btn"
                  onClick={() => removeGroup(gi)}
                  aria-label="Remove group"
                  style={{ flexShrink: 0 }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {group.blocks.length === 0 && (
                <div style={{ color: 'var(--fg-mute)', fontFamily: 'var(--mono)', fontSize: 11, padding: '6px 0 8px', letterSpacing: '0.08em' }}>
                  No exercises yet
                </div>
              )}

              {group.blocks.map((block, bi) => (
                <BlockRow
                  key={block.id}
                  block={block}
                  onChange={updated => updateBlock(gi, bi, updated)}
                  onRemove={() => removeBlock(gi, bi)}
                />
              ))}

              <button
                className="add-block"
                style={{ marginTop: 10 }}
                onClick={() => setPickerForGroup(gi)}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add Exercise
              </button>
            </div>
          );
        })}

        <div style={{ padding: '12px 16px 0' }}>
          <button className="add-block" onClick={addGroup}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Group
          </button>
        </div>
      </div>

      <ExercisePicker
        open={pickerForGroup !== null}
        onClose={() => setPickerForGroup(null)}
        onPick={ex => {
          if (pickerForGroup !== null) addBlockToGroup(pickerForGroup, ex);
        }}
      />
    </div>
  );
}
