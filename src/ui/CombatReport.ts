import Phaser from 'phaser';
import type { CombatResult } from '../systems/CombatSystem';
import { TROOPS } from '../data/troops';

export class CombatReport {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  show(result: CombatResult): void {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;
    const PW = 360, PH = 400;
    const px = (W - PW) / 2, py = (H - PH) / 2;

    const bg = this.scene.add.rectangle(px, py, PW, PH, 0x0f1e3c, 0.98)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(3000)
      .setStrokeStyle(2, result.attackerWon ? 0x44cc44 : 0xcc4444);

    const titleStr = result.attackerWon ? '⚔️  VICTORY!' : '💀  DEFEAT';
    const titleColor = result.attackerWon ? '#88ff88' : '#ff6666';

    const title = this.scene.add.text(px + PW / 2, py + 20, titleStr, {
      fontSize: '22px', color: titleColor, fontStyle: 'bold',
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(3001);

    // Losses
    const lossLines: string[] = ['Your Losses:'];
    for (const [type, cnt] of Object.entries(result.attackerLosses)) {
      if ((cnt ?? 0) > 0) lossLines.push(`  ${TROOPS[type as keyof typeof TROOPS].label}: -${cnt}`);
    }
    if (lossLines.length === 1) lossLines.push('  None');

    const lossText = this.scene.add.text(px + 16, py + 60, lossLines.join('\n'), {
      fontSize: '12px', color: '#ff9999', lineSpacing: 4,
    }).setScrollFactor(0).setDepth(3001);

    // Loot
    const loot = result.loot;
    const lootLines = ['Loot Gained:'];
    if (loot.food)   lootLines.push(`  🌾 Food:   +${loot.food.toLocaleString()}`);
    if (loot.lumber) lootLines.push(`  🪵 Lumber: +${loot.lumber.toLocaleString()}`);
    if (loot.stone)  lootLines.push(`  🪨 Stone:  +${loot.stone.toLocaleString()}`);
    if (loot.iron)   lootLines.push(`  ⚙️ Iron:   +${loot.iron.toLocaleString()}`);
    if (loot.gold)   lootLines.push(`  💰 Gold:   +${loot.gold.toLocaleString()}`);
    if (lootLines.length === 1) lootLines.push('  None');

    const lootText = this.scene.add.text(px + 16, py + 200, lootLines.join('\n'), {
      fontSize: '12px', color: '#ffdd88', lineSpacing: 4,
    }).setScrollFactor(0).setDepth(3001);

    // Rounds summary
    const roundSummary = this.scene.add.text(px + 16, py + 330,
      `Battle lasted ${result.rounds.length} round(s)`, {
        fontSize: '11px', color: '#888888',
      }).setScrollFactor(0).setDepth(3001);

    // Close button
    const closeBtn = this.scene.add.rectangle(px + PW / 2, py + PH - 28, 120, 32, 0x2255aa)
      .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(3001)
      .setInteractive({ useHandCursor: true });

    const closeTxt = this.scene.add.text(px + PW / 2, py + PH - 28, 'Close', {
      fontSize: '14px', color: '#ffffff',
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(3002);

    const panel = this.scene.add.container(0, 0, [
      bg, title, lossText, lootText, roundSummary, closeBtn, closeTxt,
    ]).setDepth(3000);

    closeBtn.on('pointerdown', () => panel.destroy(true));
  }
}
