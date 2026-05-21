import { AlertTriangle, Home, ListChecks, RefreshCcw, RotateCcw, X } from 'lucide-react';
import {
  exceptionActionLabel,
  exceptionToneLabel,
  type GameExceptionAction,
  type GameExceptionRecord
} from './gameExceptionRuntime';

interface GameExceptionCenterProps {
  activeExceptions: GameExceptionRecord[];
  exceptionCenterOpen: boolean;
  openException?: GameExceptionRecord;
  recentExceptions: GameExceptionRecord[];
  onDismiss: (key: string) => void;
  onDismissAll: () => void;
  onOpen: (key?: string) => void;
  onReload: () => void;
  onRequestSnapshot: () => void;
  onResolve: (key: string) => void;
  onReturnHome: () => void;
  onSetOpen: (open: boolean) => void;
}

export function GameExceptionCenter({
  activeExceptions,
  exceptionCenterOpen,
  openException,
  recentExceptions,
  onDismiss,
  onDismissAll,
  onOpen,
  onReload,
  onRequestSnapshot,
  onResolve,
  onReturnHome,
  onSetOpen
}: GameExceptionCenterProps): JSX.Element | null {
  const latest = activeExceptions[0] ?? recentExceptions[0];
  if (!latest) {
    return null;
  }
  const modalException = openException ?? latest;
  const hasActive = activeExceptions.length > 0;

  function runAction(record: GameExceptionRecord): void {
    if (record.action === 'request_snapshot') {
      onRequestSnapshot();
      onResolve(record.key);
      return;
    }
    if (record.action === 'return_home') {
      onReturnHome();
      onResolve(record.key);
      return;
    }
    if (record.action === 'reload') {
      onResolve(record.key);
      onReload();
      return;
    }
    onDismiss(record.key);
  }

  return (
    <>
      <button
        className={`exception-summary-button ${hasActive ? 'active' : ''} error-tone-${latest.tone}`}
        onClick={() => onOpen(latest.key)}
        type="button"
        title="异常状态"
      >
        <AlertTriangle size={17} />
        <span>{hasActive ? activeExceptions.length : 0}</span>
      </button>

      {exceptionCenterOpen && (
        <section className="exception-modal-layer" role="presentation" onMouseDown={() => onSetOpen(false)}>
          <div
            aria-modal="true"
            className={`exception-modal error-tone-${modalException.tone}`}
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="exception-modal-header">
              <div>
                <span>{exceptionToneLabel(modalException.tone)} · {modalException.source}</span>
                <h2>{modalException.title}</h2>
              </div>
              <button className="modal-close" onClick={() => onSetOpen(false)} title="关闭" type="button">
                <X size={18} />
              </button>
            </header>

            <div className="exception-current">
              <p>{modalException.message}</p>
              <div className="exception-meta-row">
                {modalException.code && <span>{modalException.code}</span>}
                <span>触发 {modalException.count} 次</span>
                <span>{formatExceptionTime(modalException.updatedAt)}</span>
              </div>
              <div className="exception-action-row">
                <button className="primary" onClick={() => runAction(modalException)} type="button">
                  {actionIcon(modalException.action)}
                  {exceptionActionLabel(modalException.action)}
                </button>
                <button onClick={() => onDismiss(modalException.key)} type="button">
                  <X size={17} />
                  忽略
                </button>
              </div>
            </div>

            <div className="exception-list-header">
              <strong>异常汇总</strong>
              <button onClick={onDismissAll} disabled={!hasActive} type="button">
                <ListChecks size={17} />
                清空活跃
              </button>
            </div>
            <div className="exception-record-list">
              {recentExceptions.map((record) => (
                <button
                  className={`exception-record-row ${record.key === modalException.key ? 'selected' : ''} status-${record.status} error-tone-${record.tone}`}
                  key={record.id}
                  onClick={() => onOpen(record.key)}
                  type="button"
                >
                  <span>{exceptionToneLabel(record.tone)}</span>
                  <strong>{record.title}</strong>
                  <em>{record.status === 'active' ? '处理中' : record.status === 'resolved' ? '已处理' : '已忽略'}</em>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

function actionIcon(action: GameExceptionAction): JSX.Element {
  if (action === 'return_home') {
    return <Home size={17} />;
  }
  if (action === 'reload') {
    return <RefreshCcw size={17} />;
  }
  if (action === 'request_snapshot') {
    return <RotateCcw size={17} />;
  }
  return <X size={17} />;
}

function formatExceptionTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}
