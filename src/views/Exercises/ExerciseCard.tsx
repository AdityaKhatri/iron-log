import { useState } from 'react';
import { VideoModal } from './VideoModal';
import { CategoryIcon, CATEGORY_COLOR, CATEGORY_LABEL } from '../../components/CategoryIcon/CategoryIcon';
import type { Exercise } from '../../types';
import './Exercises.css';

interface ExerciseCardProps {
  exercise: Exercise;
  onClick: (exercise: Exercise) => void;
}

export function ExerciseCard({ exercise, onClick }: ExerciseCardProps) {
  const [videoOpen, setVideoOpen] = useState(false);
  const iconColor = CATEGORY_COLOR[exercise.category] ?? 'var(--fg-mute)';

  return (
    <>
      <div
        className={`exercise-card ${exercise.archived ? 'exercise-card--archived' : ''}`}
        onClick={() => onClick(exercise)}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onClick(exercise); }}
      >
        <div className="exercise-card__icon" style={{ color: iconColor }}>
          <CategoryIcon category={exercise.category} size={18} color={iconColor} />
        </div>
        <div className="exercise-card__main">
          <div className="exercise-card__name">{exercise.name}</div>
          <div className="exercise-card__chips">
            <span className="chip" style={{ color: iconColor, borderColor: `${iconColor}55` }}>
              {CATEGORY_LABEL[exercise.category] ?? exercise.category}
            </span>
            <span className="chip">{exercise.muscleGroup}</span>
            <span className="chip">{exercise.equipment}</span>
            {exercise.source === 'custom' && <span className="chip chip-primary">custom</span>}
          </div>
        </div>
        {exercise.videoUrl && (
          <button
            className="exercise-card__watch btn btn-icon"
            onClick={e => { e.stopPropagation(); setVideoOpen(true); }}
            aria-label="Watch video"
            title="Watch video"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </button>
        )}
      </div>

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
