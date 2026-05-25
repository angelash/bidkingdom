import { Home } from 'lucide-react';

type AppView = 'play' | 'admin';

interface AppTopBarProps {
  connected: boolean;
  hasRoom: boolean;
  hidden: boolean;
  view: AppView;
  onReturnHome: () => void;
  onSwitchView: (view: AppView) => void;
}

export function AppTopBar({
  connected,
  hasRoom,
  hidden,
  view,
  onReturnHome,
  onSwitchView
}: AppTopBarProps): JSX.Element | null {
  if (hidden) {
    return null;
  }

  return (
    <header className="topbar">
      <div>
        <span className="brand-kicker">三国珍宝</span>
        <h1>珍宝局</h1>
      </div>
      <div className="topbar-actions">
        {hasRoom && (
          <button className="topbar-back-home" onClick={onReturnHome} type="button">
            <Home size={16} />
            返回主界面
          </button>
        )}
        <button onClick={() => onSwitchView(view === 'admin' ? 'play' : 'admin')} type="button">
          {view === 'admin' ? '返回开局' : '后台管理'}
        </button>
        <div className={`status-pill ${connected ? 'online' : 'offline'}`}>{connected ? '已连接' : '连接中'}</div>
      </div>
    </header>
  );
}
