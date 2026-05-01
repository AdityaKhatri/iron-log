import { useState } from 'react';
import { Modal } from '../../components/Modal/Modal';
import { VideoModal } from './VideoModal';
import { extractYouTubeId } from '../../lib/youtube';
import type { Exercise } from '../../types';

interface ExerciseDetailModalProps {
  exercise: Exercise | null;
  open: boolean;
  onClose: () => void;
  onEdit: (exercise: Exercise) => void;
  onArchive: (exercise: Exercise) => void;
}

export function ExerciseDetailModal({ exercise, open, onClose, onEdit, onArchive }: ExerciseDetailModalProps) {
  const [videoOpen, setVideoOpen] = useState(false);

  if (!exercise) return null;

  const videoId = extractYouTubeId(exercise.videoUrl);

  return (
    <>
      <Modal open={open} onClose={onClose} title={exercise.name} size="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

          {/* Video thumbnail */}
          {videoId && (
            <button
              onClick={() => setVideoOpen(true)}
              style={{ position: 'relative', display: 'block', width: '100%', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <img
                src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
                alt={exercise.name}
                style={{ width: '100%', display: 'block', objectFit: 'cover' }}
              />
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,90,31,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                </div>
              </div>
            </button>
          )}

          {/* Details */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <Detail label="Muscle Group" value={exercise.muscleGroup} />
            <Detail label="Equipment" value={exercise.equipment} />
            <Detail label="Category" value={exercise.category} />
            {exercise.defaultUnit && <Detail label="Default Unit" value={exercise.defaultUnit} />}
          </div>

          {exercise.secondaryMuscles.length > 0 && (
            <div>
              <div className="label">Secondary Muscles</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                {exercise.secondaryMuscles.map(m => (
                  <span key={m} className="chip">{m}</span>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
            {exercise.source === 'custom' && (
              <button className="btn btn-secondary btn-sm" onClick={() => { onEdit(exercise); onClose(); }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit
              </button>
            )}
            <button
              className={`btn btn-sm ${exercise.archived ? 'btn-outlined' : 'btn-ghost'}`}
              onClick={() => { onArchive(exercise); onClose(); }}
            >
              {exercise.archived ? 'Unarchive' : 'Archive'}
            </button>
          </div>
        </div>
      </Modal>

      {exercise.videoUrl && (
        <VideoModal
          open={videoOpen}
          onClose={() => setVideoOpen(false)}
          title={exercise.name}
          url={exercise.videoUrl}
        />
      )}
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label" style={{ marginBottom: 'var(--space-1)' }}>{label}</div>
      <div style={{ fontSize: 'var(--text-md)', textTransform: 'capitalize' }}>{value}</div>
    </div>
  );
}
