import { bidKingToastErrorStyle, type BidKingErrorTone } from './errorCodeStyleRuntime';

export type GameExceptionKind =
  | 'account'
  | 'connection'
  | 'match'
  | 'profile'
  | 'room'
  | 'server'
  | 'system';

export type GameExceptionAction = 'dismiss' | 'reload' | 'request_snapshot' | 'return_home';
export type GameExceptionStatus = 'active' | 'dismissed' | 'resolved';

export interface GameExceptionInput {
  action?: GameExceptionAction;
  code?: string;
  context?: Record<string, unknown>;
  key?: string;
  kind?: GameExceptionKind;
  message: string;
  modal?: boolean;
  source?: string;
  title?: string;
  tone?: BidKingErrorTone;
}

export interface GameExceptionRecord extends Required<Pick<GameExceptionInput, 'action' | 'kind' | 'message' | 'source' | 'title' | 'tone'>> {
  code?: string;
  context?: Record<string, unknown>;
  count: number;
  createdAt: number;
  id: string;
  key: string;
  modal: boolean;
  status: GameExceptionStatus;
  updatedAt: number;
}

export function createGameExceptionRecord(input: GameExceptionInput, now = Date.now()): GameExceptionRecord {
  const tone = input.tone ?? bidKingToastErrorStyle(input.message).tone;
  const kind = input.kind ?? kindFromMessage(input.message);
  const code = input.code ?? codeFromMessage(input.message);
  const title = input.title ?? titleForException(kind, tone);
  const action = input.action ?? actionForException(kind, tone);
  const key = input.key ?? `${kind}:${code ?? normalizeMessageKey(input.message)}`;
  return {
    action,
    code,
    context: input.context,
    count: 1,
    createdAt: now,
    id: `${key}:${now}`,
    key,
    kind,
    message: input.message,
    modal: input.modal ?? shouldOpenExceptionModal({ action, kind, tone }),
    source: input.source ?? sourceForException(kind),
    status: 'active',
    title,
    tone,
    updatedAt: now
  };
}

export function mergeGameExceptionRecord(current: GameExceptionRecord, input: GameExceptionInput, now = Date.now()): GameExceptionRecord {
  const next = createGameExceptionRecord({ ...input, key: current.key }, now);
  return {
    ...current,
    action: next.action,
    code: next.code ?? current.code,
    context: next.context ?? current.context,
    count: current.count + 1,
    kind: next.kind,
    message: next.message,
    modal: current.modal || next.modal,
    source: next.source,
    status: 'active',
    title: next.title,
    tone: next.tone,
    updatedAt: now
  };
}

export function exceptionActionLabel(action: GameExceptionAction): string {
  const labels: Record<GameExceptionAction, string> = {
    dismiss: '知道了',
    reload: '刷新',
    request_snapshot: '重新同步',
    return_home: '返回主界面'
  };
  return labels[action];
}

export function exceptionToneLabel(tone: BidKingErrorTone): string {
  const labels: Record<BidKingErrorTone, string> = {
    danger: '阻断',
    info: '提示',
    system: '流程',
    warning: '校验'
  };
  return labels[tone];
}

function shouldOpenExceptionModal(input: { action: GameExceptionAction; kind: GameExceptionKind; tone: BidKingErrorTone }): boolean {
  if (input.tone === 'danger' || input.action === 'return_home') {
    return true;
  }
  return input.kind === 'match' || input.kind === 'room';
}

function kindFromMessage(message: string): GameExceptionKind {
  if (/断开|连接|重连|网络/.test(message)) {
    return 'connection';
  }
  if (/房间|席位|开局/.test(message)) {
    return 'room';
  }
  if (/对局|阶段|回合|竞价/.test(message)) {
    return 'match';
  }
  if (/登录|账号|会话/.test(message)) {
    return 'account';
  }
  if (/CODE_\d+/.test(message)) {
    return 'server';
  }
  return 'system';
}

function titleForException(kind: GameExceptionKind, tone: BidKingErrorTone): string {
  if (tone === 'danger') {
    return '操作被阻断';
  }
  const titles: Record<GameExceptionKind, string> = {
    account: '账号状态异常',
    connection: '连接状态异常',
    match: '对局状态异常',
    profile: '档案操作未完成',
    room: '房间状态异常',
    server: '服务端提示',
    system: '系统提示'
  };
  return titles[kind];
}

function actionForException(kind: GameExceptionKind, tone: BidKingErrorTone): GameExceptionAction {
  if (kind === 'connection' || kind === 'match') {
    return 'request_snapshot';
  }
  if (kind === 'room' || (kind === 'account' && tone === 'danger')) {
    return 'return_home';
  }
  return 'dismiss';
}

function sourceForException(kind: GameExceptionKind): string {
  const sources: Record<GameExceptionKind, string> = {
    account: '账号',
    connection: '连接',
    match: '对局',
    profile: '档案',
    room: '房间',
    server: '服务端',
    system: '系统'
  };
  return sources[kind];
}

function codeFromMessage(message: string): string | undefined {
  return /CODE_\d+/.exec(message)?.[0];
}

function normalizeMessageKey(message: string): string {
  return message
    .replace(/\d{4,}/g, '#')
    .replace(/\s+/g, '')
    .slice(0, 48) || 'unknown';
}
