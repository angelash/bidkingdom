import { bidKingErrorCodeRuntime, type BidKingRawTableRow } from '@bitkingdom/bidking-compat';

export type BidKingErrorTone = 'danger' | 'info' | 'system' | 'warning';

export interface BidKingErrorCodeStyle {
  className: string;
  label: string;
  tone: BidKingErrorTone;
}

export function bidKingErrorCodeStyle(row: BidKingRawTableRow): BidKingErrorCodeStyle {
  const runtime = bidKingErrorCodeRuntime(row);
  return errorStyleFromId(Number(runtime.id) || 0);
}

export function bidKingToastErrorStyle(message: string): BidKingErrorCodeStyle {
  const match = /CODE_(\d+)/.exec(message);
  if (!match) {
    return errorStyleFromId(0);
  }
  return errorStyleFromId(Number(match[1]) || 0);
}

function errorStyleFromId(id: number): BidKingErrorCodeStyle {
  if (id >= 100) {
    return style('danger', '阻断');
  }
  if (id >= 70) {
    return style('warning', '业务校验');
  }
  if (id >= 20) {
    return style('system', '流程提示');
  }
  return style('info', '通用提示');
}

function style(tone: BidKingErrorTone, label: string): BidKingErrorCodeStyle {
  return {
    className: `error-tone-${tone}`,
    label,
    tone
  };
}
