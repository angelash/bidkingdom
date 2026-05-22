import type { AdminMatchDetail } from '@bitkingdom/shared';

export function matchStatusName(status: string): string {
  const names: Record<string, string> = {
    lobby: '大厅',
    playing: '进行中',
    ended: '已结束'
  };
  return names[status] ?? status;
}

export function playerNameFromAdmin(detail: AdminMatchDetail, playerId: string): string {
  return detail.summary.players.find((player) => player.id === playerId)?.name ?? '未知玩家';
}

export function eventName(type: string): string {
  const names: Record<string, string> = {
    round_started: '轮次开始',
    phase_changed: '阶段切换',
    bid_submitted: '提交出价',
    auction_passed: '停手',
    skill_used: '使用掌眼',
    skill_triggered: '掌眼触发',
    battle_item_used: '使用试宝令',
    round_feedback: '轮间反馈',
    round_settled: '完成结算',
    item_revealed: '开箱揭示',
    round_finished: '轮次结束',
    match_ended: '对局结束',
    bot_action_chosen: '随从决策',
    bot_action_failed: '随从决策失败',
    player_disconnected: '掌柜断线',
    player_rejoined: '掌柜重连'
  };
  return names[type] ?? type;
}

export function transactionName(reason: string): string {
  const names: Record<string, string> = {
    auction_deposit_paid: '支付押金',
    auction_deposit_refund: '退回押金',
    auction_payment: '成交付款',
    repair_cost_paid: '支付修复费',
    insurance_refund: '保险返还'
  };
  return names[reason] ?? reason;
}

export function clueSourceName(source: string): string {
  const names: Record<string, string> = {
    public: '公共',
    private: '私有',
    skill: '掌眼',
    rumor: '传言'
  };
  return names[source] ?? source;
}

export function eventPayloadText(payload: unknown, detail: AdminMatchDetail): string {
  const record = asRecord(payload);
  if (!record) {
    return '无详情';
  }
  if (typeof record.roomCode === 'string' && typeof record.playerId === 'string') {
    const phase = typeof record.phase === 'string' ? `，${phaseName(record.phase)}阶段` : '';
    return `房间 ${record.roomCode}${phase}`;
  }
  if (typeof record.phase === 'string') {
    return `进入${phaseName(record.phase)}阶段`;
  }
  const feedback = asRecord(record.feedback);
  const decision = asRecord(record.decision) ?? asRecord(feedback?.decision);
  if (decision && typeof decision.reason === 'string') {
    return decision.reason;
  }
  if (typeof record.actionType === 'string') {
    const audit = asRecord(record.audit);
    const amount = numberPart('出价', record.amount);
    const rankAi = typeof audit?.rankAiRowId === 'number' ? `RankAi ${audit.rankAiRowId}` : undefined;
    const estimate = numberPart('估值', audit?.estimate);
    const target = numberPart('目标', audit?.targetBid, audit?.targetBidRatio);
    const maxBid = numberPart('上限', audit?.maxBid, audit?.maxBidRatio);
    const floor = numberPart('底价', audit?.bidFloor, audit?.bidFloorRatio);
    const trueValue = numberPart('真值', audit?.trueValue);
    const projectedProfit = numberPart('预盈', audit?.projectedProfitAtAction);
    const details = [amount, rankAi, estimate, target, maxBid, floor, trueValue, projectedProfit]
      .filter(Boolean)
      .join('，');
    const error = typeof record.error === 'string' ? `，失败：${record.error}` : '';
    return `${record.actionType}${details ? `，${details}` : ''}${error}`;
  }
  const effectPlan = asRecord(record.effectPlan);
  if (typeof record.itemId === 'number' && effectPlan) {
    return battleItemEventText(record, effectPlan, detail);
  }
  if (typeof record.skillCid === 'number' && effectPlan) {
    return skillEffectEventText(record, effectPlan, detail);
  }
  if (typeof record.amount === 'number') {
    return `出价 ${record.amount.toLocaleString()}`;
  }
  if (typeof record.mode === 'string') {
    return auctionModeName(record.mode);
  }
  if (typeof record.skillId === 'string') {
    const target = typeof record.targetPlayerId === 'string' ? `，目标 ${playerNameFromAdmin(detail, record.targetPlayerId)}` : '';
    return `${record.skillId}${target}`;
  }
  const item = asRecord(record.item);
  if (item && typeof item.name === 'string') {
    return `揭示 ${item.name}`;
  }
  if (typeof record.title === 'string') {
    return record.title;
  }
  if (typeof record.roundId === 'string') {
    return record.roundId;
  }
  return trimText(JSON.stringify(record), 90);
}

function skillEffectEventText(
  record: Record<string, unknown>,
  effectPlan: Record<string, unknown>,
  detail: AdminMatchDetail
): string {
  const clue = asRecord(record.clue);
  const targetPlayerId = typeof record.targetPlayerId === 'string' ? record.targetPlayerId : undefined;
  const targetPlayer = targetPlayerId ? `目标 ${playerNameFromAdmin(detail, targetPlayerId)}` : undefined;
  const effect = typeof effectPlan.effectId === 'number' ? `效果 ${effectPlan.effectId}` : undefined;
  const category = typeof effectPlan.effectCategory === 'number' ? `Category ${effectPlan.effectCategory}` : undefined;
  const targetCount = typeof effectPlan.targetCount === 'number' ? `命中 ${effectPlan.targetCount} 个目标` : undefined;
  const skillTarget = typeof effectPlan.skillTarget === 'number' ? `目标规则 ${effectPlan.skillTarget}` : undefined;
  const clueText = typeof clue?.text === 'string' ? trimText(clue.text, 34) : undefined;
  return [
    `掌眼 ${record.skillCid}`,
    effect,
    category,
    targetCount,
    skillTarget,
    targetPlayer,
    clueText
  ].filter(Boolean).join(' · ');
}

function battleItemEventText(
  record: Record<string, unknown>,
  effectPlan: Record<string, unknown>,
  detail: AdminMatchDetail
): string {
  const clue = asRecord(record.clue);
  const targetPlayerId = typeof record.targetPlayerId === 'string' ? record.targetPlayerId : undefined;
  const targetPlayer = targetPlayerId ? `目标 ${playerNameFromAdmin(detail, targetPlayerId)}` : undefined;
  const skill = typeof effectPlan.skillId === 'number' ? `机缘 ${effectPlan.skillId}` : undefined;
  const effect = typeof effectPlan.effectId === 'number' ? `效果 ${effectPlan.effectId}` : undefined;
  const category = typeof effectPlan.effectCategory === 'number' ? `Category ${effectPlan.effectCategory}` : undefined;
  const revealKind = typeof effectPlan.revealKind === 'string' ? revealKindName(effectPlan.revealKind) : '情报';
  const targetCount = typeof effectPlan.targetCount === 'number' ? `揭示 ${effectPlan.targetCount} 个${revealKind}` : revealKind;
  const targetMode = typeof effectPlan.targetMode === 'string' ? targetModeName(effectPlan.targetMode) : undefined;
  const cooldown = typeof record.cooldownRemaining === 'number' && record.cooldownRemaining > 0
    ? `冷却 ${record.cooldownRemaining} 回合`
    : undefined;
  const clueText = typeof clue?.text === 'string' ? trimText(clue.text, 34) : undefined;
  return [
    `试宝令 ${record.itemId}`,
    skill,
    effect,
    category,
    targetCount,
    targetMode,
    cooldown,
    targetPlayer,
    clueText
  ].filter(Boolean).join(' · ');
}

function revealKindName(kind: string): string {
  const names: Record<string, string> = {
    category: '品类',
    footprint: '轮廓',
    identity: '本体',
    quality: '品质',
    quantity: '数量',
    risk: '风险',
    value: '估值'
  };
  return names[kind] ?? kind;
}

function targetModeName(mode: string): string {
  const names: Record<string, string> = {
    highest_value: '高价值优先',
    largest_slots: '大格位优先',
    risk_first: '风险优先',
    skill_target: '指定目标'
  };
  return names[mode] ?? mode;
}

export function phaseName(phase: string): string {
  const names: Record<string, string> = {
    container: '看货',
    warehouse_roll: '随机仓',
    warehouse_selected: '仓型确认',
    auctioneer_reveal: '掌眼情报',
    intel: '情报',
    auction: '竞价',
    reveal: '开箱',
    settlement: '结算',
    ended: '结束'
  };
  return names[phase] ?? phase;
}

export function auctionModeName(mode: string): string {
  const names: Record<string, string> = {
    open: '明拍',
    sealed: '暗拍',
    second_price: '次高价',
    deposit_open: '押金明拍',
    flash: '闪拍'
  };
  return names[mode] ?? mode;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? value as Record<string, unknown> : undefined;
}

function trimText(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function numberPart(label: string, value: unknown, ratio?: unknown): string | undefined {
  if (typeof value !== 'number') {
    return undefined;
  }
  const ratioText = typeof ratio === 'number' ? `(${Math.round(ratio * 100)}%)` : '';
  return `${label} ${Math.round(value).toLocaleString()}${ratioText}`;
}
