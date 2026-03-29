import Phaser from 'phaser';
import type { GameState, BuildingInstance } from '../data/types';
import { BUILDINGS } from '../data/buildings';
import { startUpgrade, getBuildingInProgress } from '../systems/BuildingSystem';
import { canAfford } from '../systems/ResourceSystem';

export class BuildingPanel {
  private scene: Phaser.Scene;
  private panel: Phaser.GameObjects.Container | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  show(building: BuildingInstance, state: GameState, onUpgrade: () => void): void {
    this.hide();

    const W = this.scene.scale.width;
    const H = this.scene.scale.height;
    const PW = 280, PH = 260;
    const px = W - PW - 12, py = H - PH - 60;

    const def = BUILDINGS[building.type];
    const nextLevel = building.level + 1;
    const atMax = building.level >= def.maxLevel;
    const levelData = atMax ? null : def.levels[nextLevel - 1];
    const inProgress = getBuildingInProgress(state);
    const busy = !!inProgress;
    const affordable = levelData ? canAfford(state, levelData.cost) : false;

    const bg = this.scene.add.rectangle(px, py, PW, PH, 0x0f1e3c, 0.97)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(2000)
      .setStrokeStyle(2, 0x4a90e2);

    const title = this.scene.add.text(px + 12, py + 12, def.label, {
      fontSize: '17px', color: '#f0d060', fontStyle: 'bold',
    }).setScrollFactor(0).setDepth(2001);

    const lvlText = this.scene.add.text(px + 12, py + 36, `Level ${building.level}${atMax ? ' (MAX)' : ''}`, {
      fontSize: '13px', color: '#aaaaaa',
    }).setScrollFactor(0).setDepth(2001);

    const desc = this.scene.add.text(px + 12, py + 58, def.description, {
      fontSize: '12px', color: '#cccccc', wordWrap: { width: PW - 24 },
    }).setScrollFactor(0).setDepth(2001);

    let costLabel = '';
    if (levelData) {
      const c = levelData.cost;
      const parts = [];
      if (c.food)   parts.push(`🌾 ${fmt(c.food)}`);
      if (c.lumber) parts.push(`🪵 ${fmt(c.lumber)}`);
      if (c.stone)  parts.push(`🪨 ${fmt(c.stone)}`);
      if (c.iron)   parts.push(`⚙️ ${fmt(c.iron)}`);
      if (c.gold)   parts.push(`💰 ${fmt(c.gold)}`);
      costLabel = `Cost: ${parts.join('  ')}`;
    }

    const costText = this.scene.add.text(px + 12, py + 130, levelData ? costLabel : '', {
      fontSize: '11px', color: affordable ? '#88cc88' : '#cc6666',
    }).setScrollFactor(0).setDepth(2001);

    // Upgrade button
    const btnEnabled = !atMax && !busy && affordable;
    const btnColor = btnEnabled ? 0x2255aa : 0x444444;
    const btnLabel = atMax ? 'MAX LEVEL' : busy ? 'Building...' : !affordable ? 'Not enough resources' : `Upgrade to Lv ${nextLevel}`;

    const btn = this.scene.add.rectangle(px + PW / 2, py + 195, PW - 24, 36, btnColor, 1)
      .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(2001)
      .setInteractive({ useHandCursor: btnEnabled });

    const btnText = this.scene.add.text(px + PW / 2, py + 195, btnLabel, {
      fontSize: '13px', color: '#ffffff',
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(2002);

    if (btnEnabled) {
      btn.on('pointerdown', () => {
        const err = startUpgrade(state, building.id);
        if (!err) { this.hide(); onUpgrade(); }
        else btnText.setText(err).setColor('#ff8888');
      });
      btn.on('pointerover', () => btn.setFillStyle(0x3366cc));
      btn.on('pointerout',  () => btn.setFillStyle(btnColor));
    }

    // Close button
    const closeBtn = this.scene.add.text(px + PW - 12, py + 10, '✕', {
      fontSize: '14px', color: '#888888',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(2002)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.hide())
      .on('pointerover', function(this: Phaser.GameObjects.Text) { this.setColor('#ffffff'); })
      .on('pointerout',  function(this: Phaser.GameObjects.Text) { this.setColor('#888888'); });

    // Time display
    if (levelData) {
      const secs = levelData.cost.time;
      const timeText = this.scene.add.text(px + 12, py + 148, `Time: ${fmtTime(secs)}`, {
        fontSize: '11px', color: '#aaaaaa',
      }).setScrollFactor(0).setDepth(2001);
      this.panel = this.scene.add.container(0, 0, [
        bg, title, lvlText, desc, costText, timeText, btn, btnText, closeBtn,
      ]).setDepth(2000);
    } else {
      this.panel = this.scene.add.container(0, 0, [
        bg, title, lvlText, desc, costText, btn, btnText, closeBtn,
      ]).setDepth(2000);
    }
  }

  hide(): void {
    if (this.panel) {
      this.panel.destroy(true);
      this.panel = null;
    }
  }

  isVisible(): boolean {
    return this.panel !== null;
  }
}

function fmt(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
  return n.toString();
}

function fmtTime(secs: number): string {
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
}
