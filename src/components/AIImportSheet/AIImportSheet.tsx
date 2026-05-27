import { useState } from 'react';
import { getAllExercises } from '../../db/exercises';
import { putWorkout } from '../../db/workouts';
import {
  AI_PROMPT, parseAIJson, resolveAIWorkout, buildWorkoutFromAI,
} from '../../lib/aiImport';
import type { AIResolveResult } from '../../lib/aiImport';
import './AIImportSheet.css';

interface Props {
  onDone: (name: string) => void;
  onCancel: () => void;
}

type Step = 'prompt' | 'paste' | 'preview';

export function AIImportSheet({ onDone, onCancel }: Props) {
  const [step, setStep] = useState<Step>('prompt');
  const [copied, setCopied] = useState(false);
  const [pasted, setPasted] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [preview, setPreview] = useState<AIResolveResult | null>(null);
  const [importing, setImporting] = useState(false);

  async function copyPrompt() {
    await navigator.clipboard.writeText(AI_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleParse() {
    setParseError(null);
    try {
      const parsed = parseAIJson(pasted);
      const library = await getAllExercises();
      const result = resolveAIWorkout(parsed, library);
      setPreview(result);
      setStep('preview');
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Could not parse the AI response');
    }
  }

  async function handleImport() {
    if (!preview) return;
    setImporting(true);
    try {
      const workout = buildWorkoutFromAI(preview);
      await putWorkout(workout);
      onDone(workout.name);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="ai-overlay" onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="ai-sheet">

        {/* ── Header ── */}
        <div className="ai-sheet__header">
          <div className="ai-sheet__label">Import from AI</div>
          <div className="ai-sheet__steps">
            <span className={`ai-step ${step === 'prompt' ? 'ai-step--active' : ''}`}>1 Get prompt</span>
            <span className="ai-step-sep">›</span>
            <span className={`ai-step ${step === 'paste' ? 'ai-step--active' : ''}`}>2 Paste response</span>
            <span className="ai-step-sep">›</span>
            <span className={`ai-step ${step === 'preview' ? 'ai-step--active' : ''}`}>3 Preview</span>
          </div>
        </div>

        {/* ── Step 1: Copy prompt ── */}
        {step === 'prompt' && (
          <div className="ai-sheet__body">
            <p className="ai-sheet__desc">
              Copy this prompt and paste it into ChatGPT or Claude. The AI will ask about your goals,
              browse the exercise library, and design a workout with you. When you're happy, it outputs JSON — paste that in the next step.
            </p>
            <div className="ai-prompt-box">
              <pre className="ai-prompt-text">{AI_PROMPT}</pre>
            </div>
            <div className="ai-sheet__actions">
              <button className="btn" onClick={onCancel}>Cancel</button>
              <button className="btn primary" onClick={copyPrompt}>
                {copied ? '✓ Copied!' : 'Copy Prompt'}
              </button>
              <button className="btn primary" onClick={() => setStep('paste')} style={{ background: 'var(--surface-2)', color: 'var(--fg)', borderColor: 'var(--line-2)' }}>
                Next →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Paste AI response ── */}
        {step === 'paste' && (
          <div className="ai-sheet__body">
            <p className="ai-sheet__desc">
              Paste the AI's full response below. It can be a complete message — the app will extract the JSON automatically.
            </p>
            <textarea
              className="ai-textarea"
              placeholder='Paste the AI response here…&#10;&#10;The app looks for a ```json ... ``` block or bare JSON.'
              value={pasted}
              onChange={e => { setPasted(e.target.value); setParseError(null); }}
              rows={10}
            />
            {parseError && <div className="ai-error">{parseError}</div>}
            <div className="ai-sheet__actions">
              <button className="btn" onClick={() => setStep('prompt')}>← Back</button>
              <button
                className="btn primary"
                onClick={handleParse}
                disabled={!pasted.trim()}
              >
                Parse & Preview
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Preview ── */}
        {step === 'preview' && preview && (
          <div className="ai-sheet__body">
            <div className="ai-preview-name">{preview.workoutName}</div>
            {preview.workoutNotes && (
              <div className="ai-preview-notes">{preview.workoutNotes}</div>
            )}
            {preview.missingCount > 0 && (
              <div className="ai-skip-notice">
                <strong>{preview.missingCount} exercise{preview.missingCount !== 1 ? 's' : ''} not found</strong> in your library and will be skipped.
                Import the exercise library in the Library tab if exercises are missing.
              </div>
            )}

            <div className="ai-preview-groups">
              {preview.groups.map((g, gi) => (
                <div key={gi} className="ai-preview-group">
                  <div className="ai-preview-group__name">{g.name}</div>
                  {g.exercises.map((ex, ei) => (
                    <div key={ei} className={`ai-preview-ex ${!ex.exercise ? 'ai-preview-ex--missing' : ''}`}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={ex.exercise ? 'ai-ex-icon--ok' : 'ai-ex-icon--skip'}>
                        {ex.exercise
                          ? <polyline points="20 6 9 17 4 12" />
                          : <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>}
                      </svg>
                      <span className="ai-preview-ex__name">{ex.aiName}</span>
                      <span className="ai-preview-ex__meta">
                        {ex.sets}×{ex.reps ?? `${ex.time}s`}
                        {ex.rest ? ` · ${ex.rest}s rest` : ''}
                      </span>
                      {!ex.exercise && <span className="ai-preview-ex__tag">not found</span>}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="ai-sheet__actions">
              <button className="btn" onClick={() => setStep('paste')}>← Back</button>
              <button
                className="btn primary"
                onClick={handleImport}
                disabled={importing || preview.groups.every(g => g.exercises.every(e => !e.exercise))}
              >
                {importing ? 'Importing…' : 'Import Workout'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
