import Phaser from 'phaser';
import type { GameState } from '../data/types';
import { computeProduction, computeStorage } from '../systems/ResourceSystem';

const RES_ORDER = ['food', 'lumber', 'stone', 'iron', 'gold'] as const;
const RES_ICONS: Record<string, string> = {
  food: '🌾', lumber: '🪵', stone: '🪨', iron: '⚙️', gold: '💰',
};
const RES_COLORS: Record<string, number> = {
  food: 0x7ec850, lumber: 0xa0522d, stone: 0x999999, iron: 0x778899, gold: 0xffd700,
};

export class HUD {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private resTexts: Record<string, Phaser.GameObjects.Text> = {};
  private rateTexts: Record<string, Phaser.GameObjects.Text> = {};
  private state!: GameState;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  create(state: GameState): void {
    this.state = state;
    const W = this.scene.scale.width;

    // Top bar background
    const bar = this.scene.add.rectangle(0, 0, W, 50, 0x1a1a2e, 0.95)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(1000);

    this.container = this.scene.add.container(0, 0).setDepth(1001).setScrollFactor(0);

    const colW = W / 5;
    RES_ORDER.forEach((res, i) => {
      const cx = colW * i + colW / 2;

      this.scene.add.rectangle(cx, 25, colW - 8, 44, RES_COLORS[res], 0.15)
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0)
        .setDepth(1001);

      this.resTexts[res] = this.scene.add.text(cx, 14, '', {
        fontSize: '14px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(1002);

      this.rateTexts[res] = this.scene.add.text(cx, 34, '', {
        fontSize: '10px', color: '#aaaaaa',
      }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(1002);
    });

    this.update(state);
  }

  update(state: GameState): void {
    this.state = state;
    const rates = computeProduction(state);
    const cap = computeStorage(state);

    RES_ORDER.forEach(res => {
      const val = Math.floor(state.resources[res]);
      const rate = rates[res];
      const rateStr = rate >= 0 ? `+${fmt(rate)}/h` : `${fmt(rate)}/h`;
      const color = rate < 0 ? '#ff6666' : '#88cc88';

      this.resTexts[res]?.setText(`${RES_ICONS[res]} ${fmt(val)}`);
      this.rateTexts[res]?.setText(rateStr).setColor(color);
    });
  }
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(n) >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return Math.round(n).toString();
}
