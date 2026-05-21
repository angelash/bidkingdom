import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface FullScreenPanelProps {
  icon: ReactNode;
  title: string;
  english: string;
  children: ReactNode;
  onClose: () => void;
}

export function FullScreenPanel({ icon, title, english, children, onClose }: FullScreenPanelProps): JSX.Element {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);
  return (
    <div className="system-fullscreen-backdrop">
      <section className="system-fullscreen-shell" role="dialog" aria-modal="true">
        <header className="system-fullscreen-header">
          <div className="system-fullscreen-title">
            {icon}
            <div>
              <h2>{title}</h2>
              <span>{english}</span>
            </div>
          </div>
          <button className="system-fullscreen-close" type="button" onClick={onClose} title="关闭">
            <X size={34} />
          </button>
        </header>
        <div className="system-fullscreen-body">{children}</div>
      </section>
    </div>
  );
}
