import { LogIn, UserPlus, UserRound } from 'lucide-react';
import { useState } from 'react';
import type { AccountAuthStatus } from './useBidKingAppState';

interface AccountGateProps {
  defaultPlayerName: string;
  error?: string;
  status: AccountAuthStatus;
  onContinueAsGuest: (playerName: string) => Promise<void>;
  onLogin: (accountName: string, password: string) => Promise<void>;
  onRegister: (accountName: string, password: string, playerName: string) => Promise<void>;
}

export function AccountGate({
  defaultPlayerName,
  error,
  status,
  onContinueAsGuest,
  onLogin,
  onRegister
}: AccountGateProps): JSX.Element {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [accountName, setAccountName] = useState('');
  const [password, setPassword] = useState('');
  const [playerName, setPlayerName] = useState(defaultPlayerName);
  const busy = status === 'checking' || status === 'submitting';

  function submitAccount(): void {
    if (mode === 'login') {
      void onLogin(accountName, password);
      return;
    }
    void onRegister(accountName, password, playerName);
  }

  return (
    <section className="account-gate">
      <div className="account-gate-panel">
        <span className="account-gate-mark">珍</span>
        <div className="account-gate-title">
          <span>BitKingdom</span>
          <h1>珍宝局</h1>
        </div>

        <div className="account-mode-tabs" role="tablist" aria-label="账号入口">
          <button className={mode === 'login' ? 'active' : ''} type="button" onClick={() => setMode('login')}>
            <LogIn size={18} />
            登录
          </button>
          <button className={mode === 'register' ? 'active' : ''} type="button" onClick={() => setMode('register')}>
            <UserPlus size={18} />
            注册
          </button>
        </div>

        <label>
          账号
          <input value={accountName} onChange={(event) => setAccountName(event.target.value)} maxLength={32} autoComplete="username" />
        </label>
        <label>
          密码
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" maxLength={72} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        </label>
        {mode === 'register' && (
          <label>
            掌柜名
            <input value={playerName} onChange={(event) => setPlayerName(event.target.value)} maxLength={12} />
          </label>
        )}

        {error && <p className="account-gate-error">{error}</p>}

        <div className="account-gate-actions">
          <button className="primary" type="button" disabled={busy} onClick={submitAccount}>
            {mode === 'login' ? <LogIn size={18} /> : <UserPlus size={18} />}
            {busy ? '处理中' : mode === 'login' ? '进入账号' : '创建账号'}
          </button>
          <button type="button" disabled={busy} onClick={() => void onContinueAsGuest(playerName || defaultPlayerName)}>
            <UserRound size={18} />
            游客进入
          </button>
        </div>
      </div>
    </section>
  );
}
