import { useEffect, useRef, useState } from 'react';
import { useAllPlanDays } from '../../hooks/usePlanDay';
import { putPlanDay, deletePlanDay } from '../../db/plan';
import { getAllWorkouts } from '../../db/workouts';
import { getAllSessions } from '../../db/sessions';
import { Modal } from '../../components/Modal/Modal';
import { getDaysInMonth, getFirstDayOfMonth, toISODate, formatDisplayDate, formatDuration } from '../../lib/date';
import type { Workout, PlanDay, Session } from '../../types';
import './Plan.css';

const now = new Date();
const TODAY_STR = toISODate(now);

export function PlanView() {
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const { days, reload } = useAllPlanDays();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getAllWorkouts().then(all => setWorkouts(all.filter(w => !w.archived)));
  }, []);

  useEffect(() => {
    getAllSessions().then(setAllSessions);
  }, []);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const monthName = new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  function goToToday() {
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setSelectedDate(TODAY_STR);
  }

  async function addWorkoutToDay(workout: Workout) {
    if (!selectedDate) return;
    const existing = days.get(selectedDate);
    const updated: PlanDay = {
      date: selectedDate,
      workouts: [...(existing?.workouts ?? []), { workoutId: workout.id, note: '' }],
      notes: existing?.notes ?? '',
      updatedAt: Date.now(),
    };
    await putPlanDay(updated);
    await reload();
    setPickerOpen(false);
  }

  async function removeWorkoutFromDay(date: string, workoutId: string) {
    const existing = days.get(date);
    if (!existing) return;
    const remaining = existing.workouts.filter(pw => pw.workoutId !== workoutId);
    if (remaining.length === 0) {
      await deletePlanDay(date);
    } else {
      await putPlanDay({ ...existing, workouts: remaining, updatedAt: Date.now() });
    }
    await reload();
  }

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const workoutMap = new Map(workouts.map(w => [w.id, w]));

  // Sessions keyed by date for list view
  const sessionsByDate = new Map<string, Session[]>();
  for (const s of allSessions) {
    if (!sessionsByDate.has(s.date)) sessionsByDate.set(s.date, []);
    sessionsByDate.get(s.date)!.push(s);
  }

  // Build sorted list of dates that have plan entries or sessions
  const listDates = Array.from(
    new Set([...days.keys(), ...sessionsByDate.keys()])
  ).sort();

  // Scroll to today in list view when switching to it
  useEffect(() => {
    if (viewMode === 'list' && listRef.current) {
      const todayEl = listRef.current.querySelector<HTMLElement>('[data-today="true"]');
      if (todayEl) todayEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [viewMode]);

  // Which workoutIds are already done for a given date (have a finished session)?
  function doneWorkoutIdsForDate(date: string): Set<string> {
    const sessions = sessionsByDate.get(date) ?? [];
    const doneIds = new Set<string>();
    for (const s of sessions) {
      if (s.finishedAt && s.workoutId) doneIds.add(s.workoutId);
    }
    return doneIds;
  }

  return (
    <div className="plan-view">
      {/* Header */}
      <div className="plan-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <button className="icon-btn" onClick={prevMonth} aria-label="Previous month">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span className="plan-month" style={{ flex: 1, textAlign: 'center' }}>{monthName}</span>
          <button className="icon-btn" onClick={nextMonth} aria-label="Next month">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
        <div className="plan-header-actions">
          <button
            className="btn outline btn-sm"
            onClick={goToToday}
            title="Go to today"
          >
            Today
          </button>
          <div className="plan-view-toggle">
            <button
              className={`plan-toggle-btn${viewMode === 'calendar' ? ' active' : ''}`}
              onClick={() => setViewMode('calendar')}
              aria-label="Calendar view"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </button>
            <button
              className={`plan-toggle-btn${viewMode === 'list' ? ' active' : ''}`}
              onClick={() => setViewMode('list')}
              aria-label="List view"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Calendar view ── */}
      {viewMode === 'calendar' && (
        <>
          <div className="plan-weekdays">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
              <div key={d} className="plan-weekday">{d}</div>
            ))}
          </div>

          <div className="plan-cal-wrap">
            <div className="cal-grid">
              {cells.map((day, i) => {
                if (!day) {
                  return <div key={`empty-${i}`} className="cal-cell muted" />;
                }
                const m = String(month + 1).padStart(2, '0');
                const d = String(day).padStart(2, '0');
                const dateStr = `${year}-${m}-${d}`;
                const planDay = days.get(dateStr);
                const isToday = dateStr === TODAY_STR;
                const isSelected = dateStr === selectedDate;
                const doneIds = doneWorkoutIdsForDate(dateStr);
                const daySessions = sessionsByDate.get(dateStr) ?? [];

                return (
                  <div
                    key={dateStr}
                    className={`cal-cell${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}`}
                    onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className="cal-num">{day}</span>
                    {planDay && planDay.workouts.map(pw => {
                      const w = workoutMap.get(pw.workoutId);
                      const done = doneIds.has(pw.workoutId);
                      return (
                        <div key={pw.workoutId} className={`cal-pill${done ? ' cal-pill--done' : ''}`}>
                          {done && '✓ '}{w?.name ?? '·'}
                        </div>
                      );
                    })}
                    {/* Unplanned sessions (no matching plan entry) */}
                    {daySessions.filter(s => s.unplanned && s.finishedAt).map(s => (
                      <div key={s.id} className="cal-pill cal-pill--unplanned">
                        {s.workoutName}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Day panel */}
          {selectedDate && (
            <div className="plan-day-panel">
              <div className="plan-day-panel__header">
                <span className="plan-day-panel__date">{formatDisplayDate(selectedDate)}</span>
                <button
                  className="btn primary btn-sm"
                  style={{ flex: 'none' }}
                  onClick={() => setPickerOpen(true)}
                >
                  + Add
                </button>
              </div>

              {(() => {
                const planDay = days.get(selectedDate);
                const doneIds = doneWorkoutIdsForDate(selectedDate);
                const daySessions = sessionsByDate.get(selectedDate) ?? [];
                const hasPlanned = planDay && planDay.workouts.length > 0;
                const unplannedSessions = daySessions.filter(s => s.unplanned && s.finishedAt);

                if (!hasPlanned && unplannedSessions.length === 0) {
                  return (
                    <p style={{ color: 'var(--fg-mute)', fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.08em' }}>
                      No workouts planned. Tap "+ Add" to schedule one.
                    </p>
                  );
                }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {planDay && planDay.workouts.map(pw => {
                      const workout = workoutMap.get(pw.workoutId);
                      const isDone = doneIds.has(pw.workoutId);
                      return (
                        <div key={pw.workoutId} className={`plan-workout-row${isDone ? ' plan-workout-row--done' : ''}`}>
                          <div>
                            <div className="plan-workout-row__name">
                              {isDone && <span className="plan-done-check">✓ </span>}
                              {workout?.name ?? pw.workoutId}
                            </div>
                            <div className="plan-workout-row__meta">
                              {workout ? `${workout.groups.length} groups · ${workout.groups.reduce((a, g) => a + g.blocks.length, 0)} exercises` : ''}
                              {isDone ? ' · Done' : ''}
                            </div>
                          </div>
                          <button
                            className="icon-btn"
                            onClick={() => removeWorkoutFromDay(selectedDate, pw.workoutId)}
                            aria-label="Remove"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                    {unplannedSessions.map(s => (
                      <div key={s.id} className="plan-workout-row plan-workout-row--unplanned">
                        <div>
                          <div className="plan-workout-row__name">{s.workoutName}</div>
                          <div className="plan-workout-row__meta">
                            Freestyle{s.durationMs ? ` · ${formatDuration(s.durationMs)}` : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </>
      )}

      {/* ── List view ── */}
      {viewMode === 'list' && (
        <div className="plan-list" ref={listRef}>
          {listDates.length === 0 ? (
            <div className="empty-state" style={{ padding: '48px 0' }}>
              <h3>Nothing planned yet</h3>
              <p>Switch to calendar view to schedule workouts.</p>
            </div>
          ) : (
            listDates.map(dateStr => {
              const planDay = days.get(dateStr);
              const daySessions = sessionsByDate.get(dateStr) ?? [];
              const doneIds = doneWorkoutIdsForDate(dateStr);
              const isToday = dateStr === TODAY_STR;
              const isPast = dateStr < TODAY_STR;

              return (
                <div
                  key={dateStr}
                  className={`plan-list-day${isToday ? ' plan-list-day--today' : ''}${isPast ? ' plan-list-day--past' : ''}`}
                  data-today={isToday ? 'true' : undefined}
                >
                  <div className="plan-list-day__header">
                    <span className="plan-list-day__date">{formatDisplayDate(dateStr)}</span>
                    {isToday && <span className="plan-list-today-chip">Today</span>}
                  </div>

                  <div className="plan-list-day__entries">
                    {/* Planned workouts */}
                    {planDay && planDay.workouts.map(pw => {
                      const workout = workoutMap.get(pw.workoutId);
                      const isDone = doneIds.has(pw.workoutId);
                      return (
                        <div key={pw.workoutId} className={`plan-list-entry${isDone ? ' plan-list-entry--done' : ''}`}>
                          <div className={`plan-list-entry__dot${isDone ? ' done' : ''}`} />
                          <div style={{ flex: 1 }}>
                            <div className="plan-list-entry__name">{workout?.name ?? pw.workoutId}</div>
                            <div className="plan-list-entry__meta">
                              {workout ? `${workout.groups.reduce((a, g) => a + g.blocks.length, 0)} exercises` : ''}
                              {isDone ? ' · Done' : ' · Planned'}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Logged sessions not in plan (unplanned or different workoutId) */}
                    {daySessions
                      .filter(s => s.finishedAt && (s.unplanned || !s.workoutId || !doneIds.has(s.workoutId)))
                      .map(s => (
                        <div key={s.id} className="plan-list-entry plan-list-entry--logged">
                          <div className="plan-list-entry__dot done" />
                          <div style={{ flex: 1 }}>
                            <div className="plan-list-entry__name">{s.workoutName}</div>
                            <div className="plan-list-entry__meta">
                              {s.unplanned ? 'Freestyle' : 'Completed'}
                              {s.durationMs ? ` · ${formatDuration(s.durationMs)}` : ''}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} title="Add Workout" size="md">
        {workouts.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px 0' }}>
            <h3>No workout templates</h3>
            <p>Create templates in the Workouts tab first.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {workouts
              .filter(w => {
                // Don't show workouts already planned for this date
                if (!selectedDate) return true;
                const planDay = days.get(selectedDate);
                if (!planDay) return true;
                return !planDay.workouts.some(pw => pw.workoutId === w.id);
              })
              .map(w => (
                <button
                  key={w.id}
                  className="plan-picker-row"
                  onClick={() => addWorkoutToDay(w)}
                >
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{w.name}</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--fg-mute)', marginTop: 3, letterSpacing: '0.08em' }}>
                      {w.groups.length} groups · {w.groups.reduce((a, g) => a + g.blocks.length, 0)} exercises
                    </div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--fg-mute)" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              ))}
            {workouts.filter(w => {
              if (!selectedDate) return true;
              const planDay = days.get(selectedDate);
              if (!planDay) return true;
              return !planDay.workouts.some(pw => pw.workoutId === w.id);
            }).length === 0 && (
              <p style={{ color: 'var(--fg-mute)', fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.08em', padding: '16px 0' }}>
                All workouts are already planned for this day.
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
