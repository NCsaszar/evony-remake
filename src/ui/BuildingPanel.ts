import Phaser from 'phaser';
import type { GameState, BuildingInstance } from '../data/types';
import { BUILDINGS } from '../data/buildings';
import { startUpgrade, getBuildingInProgress } from '../systems/BuildingSystem';
import { canAfford } from '../systems/ResourceSystem';

// Evony Age 1 panel color palette
const PANEL_BG      = 0x12100a;
const PANEL_BORDER  = 0x8a6a20;
const PANEL_INNER   = 0x1e1a0e;
const GOLD_BRIGHT   = 0xd4aa40;
const GOLD_DIM      = 0x8a6a20;
const BTN_BRONZE    = 0x7a5510;
const BTN_BRONZE_HI = 0xa87820;
const BTN_DISABLED  = 0x333028;
const TEXT_GOLD     = '#d4aa40';
const TEXT_PARCH    = '#eeddb8';
const TEXT_GREY     = '#888070';
const TEXT_GREEN    = '#88cc66';
const TEXT_RED      = '#cc4444';
const TEXT_ORANGE   = '#cc8833';

export class BuildingPanel {
  private scene: Phaser.Scene;
  private panel: Phaser.GameObjects.Container | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  show(building: BuildingInstance, state: GameState, onUpgrade: () => void): void {
    this.hide();

    const W  = this.scene.scale.width;
    const H  = this.scene.scale.height;
    const PW = 300;
    const PH = 310;
    const px = W - PW - 14;
    const py = H - PH - 62;

    const def      = BUILDINGS[building.type];
    const nextLvl  = building.level + 1;
    const atMax    = building.level >= def.maxLevel;
    const nextData = atMax ? null : def.levels[nextLvl - 1];
    const busy     = !!getBuildingInProgress(state);
    const afford   = nextData ? canAfford(state, nextData.cost) : false;

    const objects: Phaser.GameObjects.GameObject[] = [];

    // ── Outer border glow ──────────────────────────────────────────────────
    const glow = this.scene.add.graphics().setScrollFactor(0).setDepth(1999);
    glow.lineStyle(1, GOLD_BRIGHT, 0.25);
    glow.strokeRect(px - 2, py - 2, PW + 4, PH + 4);
    objects.push(glow);

    // ── Main panel background ──────────────────────────────────────────────
    const bg = this.scene.add.graphics().setScrollFactor(0).setDepth(2000);
    // Dark fill
    bg.fillStyle(PANEL_BG, 0.97);
    bg.fillRect(px, py, PW, PH);
    // Inner slightly lighter background
    bg.fillStyle(PANEL_INNER, 0.9);
    bg.fillRect(px + 2, py + 2, PW - 4, PH - 4);
    // Outer gold border
    bg.lineStyle(2, PANEL_BORDER, 1);
    bg.strokeRect(px, py, PW, PH);
    // Inner thin line
    bg.lineStyle(1, GOLD_DIM, 0.5);
    bg.strokeRect(px + 4, py + 4, PW - 8, PH - 8);
    objects.push(bg);

    // ── Corner ornaments ───────────────────────────────────────────────────
    const corners = this.scene.add.graphics().setScrollFactor(0).setDepth(2001);
    corners.fillStyle(GOLD_BRIGHT, 0.9);
    // Top-left
    corners.fillRect(px,      py,      8, 2);
    corners.fillRect(px,      py,      2, 8);
    corners.fillCircle(px + 4, py + 4, 2);
    // Top-right
    corners.fillRect(px + PW - 8, py,      8, 2);
    corners.fillRect(px + PW - 2, py,      2, 8);
    corners.fillCircle(px + PW - 4, py + 4, 2);
    // Bottom-left
    corners.fillRect(px,      py + PH - 2, 8, 2);
    corners.fillRect(px,      py + PH - 8, 2, 8);
    corners.fillCircle(px + 4, py + PH - 4, 2);
    // Bottom-right
    corners.fillRect(px + PW - 8, py + PH - 2, 8, 2);
    corners.fillRect(px + PW - 2, py + PH - 8, 2, 8);
    corners.fillCircle(px + PW - 4, py + PH - 4, 2);
    objects.push(corners);

    // ── Title bar ─────────────────────────────────────────────────────────
    const titleBar = this.scene.add.graphics().setScrollFactor(0).setDepth(2001);
    titleBar.fillStyle(GOLD_DIM, 0.3);
    titleBar.fillRect(px + 6, py + 6, PW - 12, 28);
    titleBar.lineStyle(1, GOLD_DIM, 0.6);
    titleBar.lineBetween(px + 6, py + 34, px + PW - 6, py + 34);
    objects.push(titleBar);

    const title = this.scene.add.text(px + PW / 2, py + 20, def.label.toUpperCase(), {
      fontSize: '14px', fontStyle: 'bold', color: TEXT_GOLD,
      fontFamily: 'Georgia, "Times New Roman", serif',
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(2002);
    objects.push(title);

    // Close button (X)
    const closeHit = this.scene.add.text(px + PW - 14, py + 14, '✕', {
      fontSize: '13px', color: TEXT_GREY,
      fontFamily: 'Arial',
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(2002)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.hide())
      .on('pointerover', function(this: Phaser.GameObjects.Text) { this.setColor('#ffffff'); })
      .on('pointerout',  function(this: Phaser.GameObjects.Text) { this.setColor(TEXT_GREY); });
    objects.push(closeHit);

    // ── Level badge ────────────────────────────────────────────────────────
    const lvlBadge = this.scene.add.graphics().setScrollFactor(0).setDepth(2001);
    lvlBadge.fillStyle(BTN_BRONZE, 0.9);
    lvlBadge.fillRoundedRect(px + 14, py + 42, 56, 20, 3);
    lvlBadge.lineStyle(1, GOLD_DIM, 0.8);
    lvlBadge.strokeRoundedRect(px + 14, py + 42, 56, 20, 3);
    objects.push(lvlBadge);

    const lvlText = this.scene.add.text(px + 42, py + 52, `Level ${building.level}${atMax ? ' ★' : ''}`, {
      fontSize: '11px', color: TEXT_PARCH,
      fontFamily: 'Georgia, serif',
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(2002);
    objects.push(lvlText);

    // ── Description ────────────────────────────────────────────────────────
    const desc = this.scene.add.text(px + 14, py + 70, def.description, {
      fontSize: '11px', color: TEXT_GREY,
      fontFamily: 'Georgia, serif',
      wordWrap: { width: PW - 28 },
      lineSpacing: 3,
    }).setScrollFactor(0).setDepth(2002);
    objects.push(desc);

    // ── Divider ─────────────────────────────────────────────────────────────
    const div1 = this.scene.add.graphics().setScrollFactor(0).setDepth(2001);
    div1.lineStyle(1, GOLD_DIM, 0.4);
    div1.lineBetween(px + 10, py + 108, px + PW - 10, py + 108);
    objects.push(div1);

    // ── Current output ────────────────────────────────────────────────────
    const currentData = def.levels[building.level - 1];
    if (currentData.output) {
      const outParts: string[] = [];
      const o = currentData.output;
      if (o.food)   outParts.push(`🌾 ${fmtR(o.food)}/h`);
      if (o.lumber) outParts.push(`🪵 ${fmtR(o.lumber)}/h`);
      if (o.stone)  outParts.push(`🪨 ${fmtR(o.stone)}/h`);
      if (o.iron)   outParts.push(`⚙ ${fmtR(o.iron)}/h`);
      if (o.gold)   outParts.push(`💰 ${fmtR(o.gold)}/h`);

      if (outParts.length > 0) {
        this.scene.add.text(px + 14, py + 114, 'Production:', {
          fontSize: '10px', color: TEXT_GREY, fontFamily: 'Georgia, serif',
        }).setScrollFactor(0).setDepth(2002).also(o => objects.push(o));
        this.scene.add.text(px + 14, py + 126, outParts.join('   '), {
          fontSize: '11px', color: TEXT_GREEN, fontFamily: 'Arial',
        }).setScrollFactor(0).setDepth(2002).also(o => objects.push(o));
      }
    }

    // ── Upgrade section ────────────────────────────────────────────────────
    if (!atMax && nextData) {
      // Section label
      this.scene.add.text(px + 14, py + 152,
        `UPGRADE TO LEVEL ${nextLvl}`, {
          fontSize: '10px', color: TEXT_ORANGE, fontStyle: 'bold',
          fontFamily: 'Georgia, serif',
        }).setScrollFactor(0).setDepth(2002).also(o => objects.push(o));

      // Cost display
      const c = nextData.cost;
      const costItems = [
        { label: '🌾', val: c.food   ?? 0, key: 'food'   as const },
        { label: '🪵', val: c.lumber ?? 0, key: 'lumber' as const },
        { label: '🪨', val: c.stone  ?? 0, key: 'stone'  as const },
        { label: '⚙',  val: c.iron   ?? 0, key: 'iron'   as const },
        { label: '💰', val: c.gold   ?? 0, key: 'gold'   as const },
      ].filter(x => x.val > 0);

      const state2 = state;
      costItems.forEach((item, i) => {
        const col = i % 3, row = Math.floor(i / 3);
        const cx = px + 14 + col * 92;
        const cy = py + 166 + row * 18;
        const hasEnough = (state2.resources[item.key as keyof typeof state2.resources] ?? 0) >= item.val;
        this.scene.add.text(cx, cy, `${item.label} ${fmtC(item.val)}`, {
          fontSize: '11px',
          color: hasEnough ? TEXT_GREEN : TEXT_RED,
          fontFamily: 'Arial',
        }).setScrollFactor(0).setDepth(2002).also(o => objects.push(o));
      });

      // Time
      this.scene.add.text(px + 14, py + 204, `⏱ ${fmtTime(nextData.cost.time)}`, {
        fontSize: '11px', color: TEXT_GREY, fontFamily: 'Arial',
      }).setScrollFactor(0).setDepth(2002).also(o => objects.push(o));

      // ── Upgrade button ───────────────────────────────────────────────────
      const btnEnabled = !busy && afford;
      const btnColor   = btnEnabled ? BTN_BRONZE : BTN_DISABLED;
      const btnBorder  = btnEnabled ? GOLD_DIM : 0x555555;

      const btnG = this.scene.add.graphics().setScrollFactor(0).setDepth(2002);
      btnG.fillStyle(btnColor, 1);
      btnG.fillRoundedRect(px + 14, py + 222, PW - 28, 36, 4);
      if (btnEnabled) {
        // Bevel highlight
        btnG.fillStyle(BTN_BRONZE_HI, 0.4);
        btnG.fillRoundedRect(px + 14, py + 222, PW - 28, 18, { tl: 4, tr: 4, bl: 0, br: 0 });
      }
      btnG.lineStyle(1, btnBorder, 1);
      btnG.strokeRoundedRect(px + 14, py + 222, PW - 28, 36, 4);
      objects.push(btnG);

      const btnLabel = busy  ? 'Construction in progress...'
                     : !afford ? 'Insufficient Resources'
                     : `Upgrade  (Lv ${building.level} → ${nextLvl})`;
      const btnColor2 = busy || !afford ? TEXT_GREY : TEXT_GOLD;

      const btnTxt = this.scene.add.text(px + PW / 2, py + 240, btnLabel, {
        fontSize: '12px', color: btnColor2, fontStyle: btnEnabled ? 'bold' : 'normal',
        fontFamily: 'Georgia, serif',
      }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(2003);
      objects.push(btnTxt);

      if (btnEnabled) {
        // Invisible hit area over button
        const hitZone = this.scene.add.zone(px + 14, py + 222, PW - 28, 36)
          .setOrigin(0, 0).setScrollFactor(0).setDepth(2003)
          .setInteractive({ useHandCursor: true });
        hitZone.on('pointerover', () => {
          btnG.clear();
          btnG.fillStyle(BTN_BRONZE_HI, 1);
          btnG.fillRoundedRect(px + 14, py + 222, PW - 28, 36, 4);
          btnG.lineStyle(1, GOLD_BRIGHT, 1);
          btnG.strokeRoundedRect(px + 14, py + 222, PW - 28, 36, 4);
        });
        hitZone.on('pointerout', () => {
          btnG.clear();
          btnG.fillStyle(BTN_BRONZE, 1);
          btnG.fillRoundedRect(px + 14, py + 222, PW - 28, 36, 4);
          btnG.fillStyle(BTN_BRONZE_HI, 0.4);
          btnG.fillRoundedRect(px + 14, py + 222, PW - 28, 18, { tl: 4, tr: 4, bl: 0, br: 0 });
          btnG.lineStyle(1, GOLD_DIM, 1);
          btnG.strokeRoundedRect(px + 14, py + 222, PW - 28, 36, 4);
        });
        hitZone.on('pointerdown', () => {
          const err = startUpgrade(state, building.id);
          if (!err) {
            this.hide();
            onUpgrade();
          } else {
            btnTxt.setText(err).setColor(TEXT_RED);
          }
        });
        objects.push(hitZone);
      }
    } else if (atMax) {
      // Max level badge
      const maxG = this.scene.add.graphics().setScrollFactor(0).setDepth(2002);
      maxG.fillStyle(0x2a4a1a, 1);
      maxG.fillRoundedRect(px + 14, py + 222, PW - 28, 36, 4);
      maxG.lineStyle(1, 0x44aa44, 0.8);
      maxG.strokeRoundedRect(px + 14, py + 222, PW - 28, 36, 4);
      objects.push(maxG);
      this.scene.add.text(px + PW / 2, py + 240, '★  MAX LEVEL REACHED  ★', {
        fontSize: '12px', color: TEXT_GREEN, fontStyle: 'bold',
        fontFamily: 'Georgia, serif',
      }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(2003).also(o => objects.push(o));
    }

    this.panel = this.scene.add.container(0, 0, objects as Phaser.GameObjects.GameObject[]).setDepth(2000);
  }

  hide(): void {
    if (this.panel) {
      this.panel.destroy(true);
      this.panel = null;
    }
  }

  isVisible(): boolean { return this.panel !== null; }
}

// Extend Phaser text with .also() helper for chaining
declare module 'phaser' {
  namespace GameObjects {
    interface Text {
      also(fn: (t: Text) => void): Text;
    }
    interface Graphics {
      also(fn: (g: Graphics) => void): Graphics;
    }
  }
}
Phaser.GameObjects.Text.prototype.also = function(fn) { fn(this); return this; };
Phaser.GameObjects.Graphics.prototype.also = function(fn) { fn(this); return this; };

function fmtC(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(0) + 'K';
  return n.toString();
}
function fmtR(n: number): string {
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
  return n.toString();
}
function fmtTime(secs: number): string {
  if (secs < 60)   return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
}
