import { Modal } from '../../components/Modal/Modal';
import { extractYouTubeId } from '../../lib/youtube';

interface VideoModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  url: string;
}

export function VideoModal({ open, onClose, title, url }: VideoModalProps) {
  const videoId = extractYouTubeId(url);

  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      {videoId ? (
        <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: 'var(--radius-md)', overflow: 'hidden', background: '#000' }}>
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
          />
        </div>
      ) : (
        <div className="empty-state">
          <p>Could not load video preview.</p>
        </div>
      )}
      <div style={{ marginTop: 'var(--space-4)', textAlign: 'center' }}>
        <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
          Open in YouTube ↗
        </a>
      </div>
    </Modal>
  );
}
