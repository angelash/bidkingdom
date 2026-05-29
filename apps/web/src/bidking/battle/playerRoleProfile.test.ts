import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const battlePanels = readFileSync(new URL('./BattlePanels.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');

describe('battle player role profile', () => {
  it('opens bidder bio and skill detail as a compact in-match avatar tip', () => {
    expect(battlePanels).toContain('className="avatar player-avatar-button"');
    expect(battlePanels).toContain('onClick={(event) => inspectPlayer(player.id, event)}');
    expect(battlePanels).toContain("import { createPortal } from 'react-dom';");
    expect(battlePanels).toContain('document.body');
    expect(battlePanels).toContain('function PlayerRoleTip');
    expect(battlePanels).toContain('className={`bidder-profile-tip tip-${position.side}`}');
    expect(battlePanels).toContain('roleSkillDetailForRole(role)');
    expect(battlePanels).toContain('bidderBio(role)');
    expect(battlePanels).toContain('className="bidder-profile-notes"');
    expect(battlePanels).toContain('skill.tips.map');
    expect(battlePanels).not.toContain('modal-layer bidder-profile-layer');
  });

  it('styles the in-match bidder profile as a small fixed tip', () => {
    const bidderProfileStyles = styles.slice(
      styles.indexOf('.bidder-profile-tip'),
      styles.indexOf('.player-rail .player-seat > .player-info')
    );
    expect(styles).toContain('.bidder-profile-tip');
    expect(styles).toContain('width: 292px;');
    expect(styles).toContain('max-height: calc(100dvh - 20px);');
    expect(styles).toContain('.bidder-profile-avatar');
    expect(styles).toContain('.bidder-profile-skill');
    expect(styles).toContain('.bidder-profile-notes');
    expect(bidderProfileStyles).not.toContain('-webkit-line-clamp');
    expect(bidderProfileStyles).not.toContain('text-overflow: ellipsis');
    expect(styles).not.toContain('.bidder-profile-layer');
    expect(styles).not.toContain('.bidder-profile-dialog');
    expect(styles).toContain('.player-avatar-button:hover');
  });
});
