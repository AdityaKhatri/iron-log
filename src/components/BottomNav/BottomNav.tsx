import './BottomNav.css';
import type { ViewId } from '../../types';

const PRIMARY_TABS: { id: ViewId; label: string; icon: React.ReactNode }[] = [
  {
    id: 'today',
    label: 'Today',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="8" y1="14" x2="8" y2="14" /><line x1="12" y1="14" x2="12" y2="14" />
        <line x1="8" y1="18" x2="8" y2="18" /><line x1="12" y1="18" x2="12" y2="18" />
      </svg>
    ),
  },
  {
    id: 'plan',
    label: 'Plan',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M8 2v4M16 2v4M3 10h18" />
        <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
      </svg>
    ),
  },
  {
    id: 'workouts',
    label: 'Workouts',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6.5 6.5h11" /><path d="M6.5 17.5h11" />
        <path d="M3 9.5h18" /><path d="M3 14.5h18" />
        <rect x="2" y="6.5" width="2" height="11" rx="1" /><rect x="20" y="6.5" width="2" height="11" rx="1" />
      </svg>
    ),
  },
];

const MORE_VIEWS: ViewId[] = ['library', 'profile', 'progress', 'editor'];

interface BottomNavProps {
  current: ViewId;
  onChange: (view: ViewId) => void;
  onMore: () => void;
}

export function BottomNav({ current, onChange, onMore }: BottomNavProps) {
  const moreActive = MORE_VIEWS.includes(current);

  return (
    <nav className="botnav">
      {PRIMARY_TABS.map(item => (
        <button
          key={item.id}
          className={`tab${current === item.id ? ' active' : ''}`}
          onClick={() => onChange(item.id)}
        >
          {item.icon}
          {item.label}
        </button>
      ))}

      {/* More */}
      <button
        className={`tab${moreActive ? ' active' : ''}`}
        onClick={onMore}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="19" cy="12" r="1.2" fill="currentColor" stroke="none" />
        </svg>
        More
      </button>
    </nav>
  );
}
