import Phaser from 'phaser';
import type { GameState } from '../data/types';
import { computeProduction, computeStorage } from '../systems/ResourceSystem';

// Evony Age 1 resource order and styling
const RES_ORDER = ['food', 'lumber', 'stone', 'iron', 'gold'] as const;

// Unicode icons that approximate the originals
const RES_ICON: Record<string, string> = {
  food: '🌾', lumber: '🪵', stone: '🪨', iron: '⚙', gold: '💰',
};

// Evony color palette
const BRONZE_DARK  = 0x1e1508;
const BRONZE_MID   = 0x3a2a0e;
const BRONZE_LIGHT = 0x8a6a20;
const GOLD         = 0xc8a030;
const TEXT_GOLD    = '#d4aa40';
const TEXT_WHITE   = '#eeddb8';
const TEXT_RED     = '#cc4444';
const TEXT_GREEN   = '#88cc66';

export class HUD {
  private scene: Phaser.Scene;
  private resTexts: Record<string, Phaser.GameObjects.Text> = {};
  private rateTexts: Record<string, Phaser.GameObjects.Text> = {};
  private storageBar!: Phaser.GameObjects.Graphics;
  private popText!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  create(state: GameState): void {
    const W = this.scene.scale.width;

    // ── Top bar background (dark bronze panel) ────────────────────────────
    const barH = 54;
    const barBg = this.scene.add.graphics().setScrollFactor(0).setDepth(900);

    // Main bar fill
    barBg.fillStyle(BRONZE_DARK, 0.97);
    barBg.fillRect(0, 0, W, barH);

    // Top highlight line
    barBg.lineStyle(1, GOLD, 0.6);
    barBg.lineBetween(0, 0, W, 0);
    // Bottom border — gold line
    barBg.lineStyle(2, BRONZE_LIGHT, 1);
    barBg.lineBetween(0, barH, W, barH);
    barBg.lineStyle(1, GOLD, 0.4);
    barBg.lineBetween(0, barH + 2, W, barH + 2);

    // Inner panel gradient strips
    barBg.fillStyle(BRONZE_MID, 0.4);
    barBg.fillRect(0, 1, W, barH - 2);

    // ── Resource columns ─────────────────────────────────────────────────
    const colW = Math.floor(W / 6); // 5 resources + 1 for pop/buttons
    RES_ORDER.forEach((res, i) => {
      const cx = colW * i + colW / 2;

      // Divider line between columns
      if (i > 0) {
        barBg.lineStyle(1, BRONZE_LIGHT, 0.3);
        barBg.lineBetween(colW * i, 6, colW * i, barH - 6);
      }

      // Icon + value
      this.resTexts[res] = this.scene.add.text(cx, 18, '', {
        fontSize: '15px',
        fontStyle: 'bold',
        color: TEXT_GOLD,
        fontFamily: 'Georgia, serif',
      }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(901);

      // Rate (per hour)
      this.rateTexts[res] = this.scene.add.text(cx, 38, '', {
        fontSize: '10px',
        color: TEXT_GREEN,
        fontFamily: 'Arial, sans-serif',
      }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(901);
    });

    // Population display (right side)
    this.popText = this.scene.add.text(colW * 5 + colW / 2, 26, '', {
      fontSize: '12px', color: TEXT_WHITE,
      fontFamily: 'Georgia, serif',
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(901);

    this.update(state);
  }

  update(state: GameState): void {
    const rates = computeProduction(state);
    const cap   = computeStorage(state);

    RES_ORDER.forEach(res => {
      const val  = state.resources[res];
      const rate = rates[res];

      // Resource value
      this.resTexts[res]?.setText(`${RES_ICON[res]} ${fmt(val)}`);

      // Rate with color coding
      const rateStr = rate >= 0 ? `▲ ${fmt(Math.abs(rate))}/h` : `▼ ${fmt(Math.abs(rate))}/h`;
      this.rateTexts[res]?.setText(rateStr).setColor(rate < -0.01 ? TEXT_RED : TEXT_GREEN);
    });

    // Population
    const pop = state.buildings
      .filter(b => b.type === 'cottage')
      .reduce((s, b) => s + b.level * 200, 500);
    this.popText?.setText(`👤 ${fmt(pop)}\n💾 ${fmt(cap)}`);
  }
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 10_000)    return (n / 1_000).toFixed(0) + 'K';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return Math.floor(n).toString();
}
