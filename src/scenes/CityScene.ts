import Phaser from 'phaser';
import { tileToScreen, isoDepth, TILE_W, TILE_H } from '../iso/IsoMap';
import type { GameState, BuildingInstance } from '../data/types';
import { BUILDINGS } from '../data/buildings';
import { tickResources, computeProduction, computeStorage } from '../systems/ResourceSystem';
import { checkConstructions, getBuildingInProgress } from '../systems/BuildingSystem';
import { loadGame, defaultState, saveGame } from '../systems/SaveSystem';
import { BuildingPanel } from '../ui/BuildingPanel';

const GRID = 20;
const SAVE_INTERVAL = 30_000;

// Evony palette
const DARK_BG    = 0x0e0c08;
const PANEL_BG   = 0x1a1408;
const BORDER     = 0x8a6a20;
const GOLD       = 0xc8a030;
const TEXT_GOLD  = '#c8a030';
const TEXT_PARCH = '#eeddb8';
const TEXT_GREY  = '#807060';
const TEXT_GREEN = '#78bb50';
const TEXT_RED   = '#cc4444';

// Build slot positions (inner city, tile coords)
const BUILD_SLOTS: [number, number][] = [
  [7,7],[9,7],[11,7],[13,7],
  [7,9],[9,9],[11,9],[13,9],
  [7,11],[9,11],[11,11],[13,11],
  [7,13],[9,13],[11,13],[13,13],
];

// Tree positions around the perimeter
const TREE_POSITIONS: [number, number][] = [
  [1,1],[2,1],[3,1],[4,1],[1,2],[1,3],[1,4],
  [15,1],[16,1],[17,1],[18,1],[18,2],[18,3],[18,4],
  [1,15],[1,16],[1,17],[1,18],[2,18],[3,18],[4,18],
  [15,18],[16,18],[17,18],[18,18],[18,15],[18,16],[18,17],
  [6,2],[8,2],[10,2],[12,2],[14,2],
  [2,6],[2,8],[2,10],[2,12],[2,14],
  [6,17],[8,17],[10,17],[12,17],[14,17],
  [17,6],[17,8],[17,10],[17,12],[17,14],
];

export class CityScene extends Phaser.Scene {
  private state!: GameState;
  private buildingSprites = new Map<string, Phaser.GameObjects.Image>();
  private constructSprites = new Map<string, Phaser.GameObjects.Image>();
  private constructTimers  = new Map<string, Phaser.GameObjects.Text>();
  private buildingPanel!: BuildingPanel;
  private lastSave = 0;
  private isDragging = false;
  private dragStart  = { x: 0, y: 0 };
  private camStart   = { x: 0, y: 0 };

  // Right panel graphics refs for live update
  private resTexts:  Record<string, Phaser.GameObjects.Text> = {};
  private rateTexts: Record<string, Phaser.GameObjects.Text> = {};
  private queueText!: Phaser.GameObjects.Text;

  constructor() { super({ key: 'CityScene' }); }

  create(): void {
    const saved = loadGame();
    this.state = saved ?? defaultState();

    // Camera viewport — inset to leave room for right panel + bottom bar + top bar
    const W = this.scale.width, H = this.scale.height;
    const RIGHT_W  = 220;
    const TOP_H    = 32;
    const BOT_H    = 54;
    this.cameras.main.setViewport(0, TOP_H, W - RIGHT_W, H - TOP_H - BOT_H);
    this.cameras.main.setBackgroundColor(0x3a5a1a); // dark green bg behind tiles

    this.buildingPanel = new BuildingPanel(this);

    this.buildTiles();
    this.buildSlotMarkers();
    this.buildTrees();
    this.renderAllBuildings();
    this.centerCamera();
    this.setupInput();
    this.buildTopBar();
    this.buildRightPanel();
    this.buildBottomBar();

    this.lastSave = Date.now();
  }

  update(_t: number, delta: number): void {
    const dt = delta / 1000;
    tickResources(this.state, dt);

    const finished = checkConstructions(this.state);
    finished.forEach(type => {
      const b = this.state.buildings.find(b => b.type === type && !b.constructingUntil);
      if (b) this.refreshBuilding(b);
    });

    this.updateConstructTimers();
    this.updateResourcePanel();

    if (Date.now() - this.lastSave > SAVE_INTERVAL) {
      saveGame(this.state);
      this.lastSave = Date.now();
    }
  }

  // ── Tile grid ─────────────────────────────────────────────────────────────

  private buildTiles(): void {
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const { x: sx, y: sy } = tileToScreen(x, y);
        const key = this.tileKey(x, y);
        const t = this.add.image(sx + TILE_W / 2, sy + TILE_H / 2, key)
          .setDepth(isoDepth(x, y))
          .setInteractive();
        t.on('pointerdown', () => { if (!this.isDragging) this.buildingPanel.hide(); });
      }
    }
  }

  private tileKey(x: number, y: number): string {
    // Inner city area = alternating grass shades
    if (x >= 5 && x <= 14 && y >= 5 && y <= 14) {
      return (x + y) % 2 === 0 ? 'tile_grass' : 'tile_grass2';
    }
    return 'tile_grass';
  }

  // ── Build slot markers ────────────────────────────────────────────────────

  private buildSlotMarkers(): void {
    // Show empty slots as slightly different tile
    for (const [tx, ty] of BUILD_SLOTS) {
      const occupied = this.state.buildings.some(b => b.tileX === tx && b.tileY === ty);
      if (!occupied) {
        const { x: sx, y: sy } = tileToScreen(tx, ty);
        // Slot overlay: slightly darker stone-ish tint
        const slot = this.add.image(sx + TILE_W / 2, sy + TILE_H / 2, 'tile_slot')
          .setDepth(isoDepth(tx, ty) + 0.1)
          .setAlpha(0.45);
      }
    }
  }

  // ── Trees ─────────────────────────────────────────────────────────────────

  private buildTrees(): void {
    for (const [tx, ty] of TREE_POSITIONS) {
      const { x: sx, y: sy } = tileToScreen(tx, ty);
      this.add.image(sx + TILE_W / 2, sy, 'tree')
        .setOrigin(0.5, 1)
        .setDepth(isoDepth(tx, ty) + 0.5)
        .setScale(0.85);
    }
  }

  // ── Buildings ─────────────────────────────────────────────────────────────

  private renderAllBuildings(): void {
    for (const b of this.state.buildings) this.spawnBuilding(b);
  }

  private spawnBuilding(b: BuildingInstance): void {
    const { x: sx, y: sy } = tileToScreen(b.tileX, b.tileY);
    this.buildingSprites.get(b.id)?.destroy();

    const sprite = this.add.image(sx + TILE_W / 2, sy, `building_${b.type}`)
      .setOrigin(0.5, 1)
      .setDepth(isoDepth(b.tileX, b.tileY) + 0.5)
      .setInteractive({ useHandCursor: true });

    sprite.on('pointerover', () => sprite.setTint(0xddddff));
    sprite.on('pointerout',  () => sprite.clearTint());
    sprite.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (!this.isDragging) {
        this.buildingPanel.show(b, this.state, () => {
          this.showConstructOverlay(b);
          this.updateResourcePanel();
        });
        ptr.event.stopPropagation();
      }
    });

    this.buildingSprites.set(b.id, sprite);

    if (b.constructingUntil && b.constructingUntil > Date.now()) {
      this.showConstructOverlay(b);
    }
  }

  private showConstructOverlay(b: BuildingInstance): void {
    this.constructSprites.get(b.id)?.destroy();
    this.constructTimers.get(b.id)?.destroy();
    const { x: sx, y: sy } = tileToScreen(b.tileX, b.tileY);
    const sc = this.add.image(sx + TILE_W / 2, sy - 8, 'scaffold')
      .setOrigin(0.5, 1).setDepth(isoDepth(b.tileX, b.tileY) + 0.9).setAlpha(0.75);
    const txt = this.add.text(sx + TILE_W / 2, sy - 78, '', {
      fontSize: '11px', color: '#ffcc00',
      backgroundColor: '#00000099', padding: { x: 3, y: 2 },
    }).setOrigin(0.5, 1).setDepth(isoDepth(b.tileX, b.tileY) + 1);
    this.constructSprites.set(b.id, sc);
    this.constructTimers.set(b.id, txt);
  }

  private refreshBuilding(b: BuildingInstance): void {
    this.constructSprites.get(b.id)?.destroy(); this.constructSprites.delete(b.id);
    this.constructTimers.get(b.id)?.destroy();  this.constructTimers.delete(b.id);
    this.spawnBuilding(b);
  }

  private updateConstructTimers(): void {
    const now = Date.now();
    for (const b of this.state.buildings) {
      const txt = this.constructTimers.get(b.id);
      if (txt && b.constructingUntil && b.constructingUntil > now) {
        txt.setText(fmtTime(Math.ceil((b.constructingUntil - now) / 1000)));
      }
    }
    // Update queue text in right panel
    const inProg = getBuildingInProgress(this.state);
    if (this.queueText) {
      if (inProg && inProg.constructingUntil) {
        const sec = Math.ceil((inProg.constructingUntil - now) / 1000);
        const def = BUILDINGS[inProg.type];
        this.queueText.setText(`⚒ ${def.label} Lv${inProg.level + 1}\n  ${fmtTime(sec)}`);
      } else {
        this.queueText.setText('No construction');
      }
    }
  }

  // ── Camera ────────────────────────────────────────────────────────────────

  private centerCamera(): void {
    const cam = this.cameras.main;
    // Center of grid in world space
    const cx = (GRID / 2);
    const cy = (GRID / 2);
    const { x: wx, y: wy } = tileToScreen(cx, cy);
    cam.centerOn(wx + TILE_W / 2, wy + TILE_H);
    cam.setZoom(1.0);
    // Large bounds so dragging works freely
    cam.setBounds(-2000, -1000, 8000, 6000);
  }

  // ── Input ─────────────────────────────────────────────────────────────────

  private setupInput(): void {
    const cam = this.cameras.main;

    this.input.on('wheel', (_p: any, _g: any, _dx: number, dy: number) => {
      cam.setZoom(Phaser.Math.Clamp(cam.zoom - dy * 0.001, 0.35, 2.5));
    });

    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      this.isDragging = false;
      this.dragStart = { x: ptr.x, y: ptr.y };
      this.camStart  = { x: cam.scrollX, y: cam.scrollY };
    });

    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (!ptr.isDown) return;
      const dx = ptr.x - this.dragStart.x, dy = ptr.y - this.dragStart.y;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) this.isDragging = true;
      if (this.isDragging) {
        cam.scrollX = this.camStart.x - dx / cam.zoom;
        cam.scrollY = this.camStart.y - dy / cam.zoom;
      }
    });

    this.input.on('pointerup', () => { setTimeout(() => { this.isDragging = false; }, 0); });

    const keys = this.input.keyboard!.addKeys({ up:'W', down:'S', left:'A', right:'D' }) as any;
    this.events.on('update', () => {
      const sp = 6 / cam.zoom;
      if (keys.left.isDown)  cam.scrollX -= sp;
      if (keys.right.isDown) cam.scrollX += sp;
      if (keys.up.isDown)    cam.scrollY -= sp;
      if (keys.down.isDown)  cam.scrollY += sp;
    });
  }

  // ── Top Bar ───────────────────────────────────────────────────────────────

  private buildTopBar(): void {
    const W = this.scale.width, H = this.scale.height;
    const RIGHT_W = 220;
    const TOP_H   = 32;

    // Bar background
    const g = this.add.graphics().setScrollFactor(0).setDepth(800);
    g.fillStyle(PANEL_BG, 0.98);
    g.fillRect(0, 0, W - RIGHT_W, TOP_H);
    g.lineStyle(2, BORDER, 1);
    g.lineBetween(0, TOP_H, W - RIGHT_W, TOP_H);
    g.lineStyle(1, GOLD, 0.3);
    g.lineBetween(0, TOP_H - 1, W - RIGHT_W, TOP_H - 1);

    // Nav tabs: TOWN | CITY | MAP
    const navTabs = [
      { label: 'TOWN', key: 'town', active: true  },
      { label: 'CITY', key: 'city', active: false },
      { label: 'MAP',  key: 'map',  active: false  },
    ];
    const tabW = 80;
    const startX = (W - RIGHT_W) / 2 - (tabW * navTabs.length) / 2;

    navTabs.forEach((tab, i) => {
      const tx = startX + i * tabW;
      const bg = this.add.graphics().setScrollFactor(0).setDepth(801);
      const fill = tab.active ? 0x7a5a10 : 0x2a2010;
      bg.fillStyle(fill, 1);
      bg.fillRect(tx, 2, tabW - 2, TOP_H - 4);
      if (tab.active) {
        bg.fillStyle(GOLD, 0.2);
        bg.fillRect(tx + 1, 3, tabW - 4, (TOP_H - 6) / 2);
      }
      bg.lineStyle(1, tab.active ? GOLD : BORDER, 0.7);
      bg.strokeRect(tx, 2, tabW - 2, TOP_H - 4);

      const lbl = this.add.text(tx + tabW / 2 - 1, TOP_H / 2, tab.label, {
        fontSize: '11px', fontStyle: 'bold', color: tab.active ? TEXT_GOLD : TEXT_GREY,
        fontFamily: 'Georgia, serif',
      }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(802);

      if (tab.key === 'map') {
        this.add.zone(tx, 2, tabW - 2, TOP_H - 4)
          .setOrigin(0, 0).setScrollFactor(0).setDepth(803)
          .setInteractive({ useHandCursor: true })
          .on('pointerdown', () => this.scene.start('WorldMapScene', { state: this.state }))
          .on('pointerover', () => lbl.setColor(TEXT_PARCH))
          .on('pointerout',  () => lbl.setColor(TEXT_GREY));
      }
    });
  }

  // ── Right Panel ───────────────────────────────────────────────────────────

  private buildRightPanel(): void {
    const W = this.scale.width, H = this.scale.height;
    const RIGHT_W = 220;
    const px = W - RIGHT_W;

    // Panel background
    const g = this.add.graphics().setScrollFactor(0).setDepth(800);
    g.fillStyle(PANEL_BG, 0.99);
    g.fillRect(px, 0, RIGHT_W, H);
    g.lineStyle(2, BORDER, 1);
    g.lineBetween(px, 0, px, H);
    g.lineStyle(1, GOLD, 0.25);
    g.lineBetween(px + 2, 0, px + 2, H);

    // ── Player portrait section ──────────────────────────────────────────
    g.fillStyle(0x0e0c08, 1);
    g.fillRect(px + 4, 4, RIGHT_W - 8, 72);
    g.lineStyle(1, BORDER, 0.7);
    g.strokeRect(px + 4, 4, RIGHT_W - 8, 72);

    // Portrait placeholder (grey box)
    g.fillStyle(0x3a3028, 1);
    g.fillRect(px + 8, 8, 56, 64);
    g.lineStyle(1, GOLD, 0.5);
    g.strokeRect(px + 8, 8, 56, 64);

    // Face silhouette
    g.fillStyle(0x706050, 1);
    g.fillCircle(px + 36, 30, 16);
    g.fillRect(px + 16, 46, 40, 24);

    this.add.text(px + 72, 14, 'Lord', {
      fontSize: '10px', color: TEXT_GREY, fontFamily: 'Georgia, serif',
    }).setScrollFactor(0).setDepth(801);
    this.add.text(px + 72, 28, 'NCsaszar', {
      fontSize: '13px', fontStyle: 'bold', color: TEXT_GOLD, fontFamily: 'Georgia, serif',
    }).setScrollFactor(0).setDepth(801);
    this.add.text(px + 72, 46, '🏰 City (100,100)', {
      fontSize: '9px', color: TEXT_GREY, fontFamily: 'Arial',
    }).setScrollFactor(0).setDepth(801);

    // Divider
    g.lineStyle(1, BORDER, 0.5);
    g.lineBetween(px + 6, 80, px + RIGHT_W - 6, 80);

    // ── Resource section ─────────────────────────────────────────────────
    this.add.text(px + RIGHT_W / 2, 88, 'RESOURCES', {
      fontSize: '10px', fontStyle: 'bold', color: TEXT_GREY, fontFamily: 'Georgia, serif',
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(801);

    const RES = [
      { key: 'food',   icon: '🌾', label: 'Food' },
      { key: 'lumber', icon: '🪵', label: 'Lumber' },
      { key: 'stone',  icon: '🪨', label: 'Stone' },
      { key: 'iron',   icon: '⚙',  label: 'Iron' },
      { key: 'gold',   icon: '💰', label: 'Gold' },
    ];

    RES.forEach((res, i) => {
      const ry = 104 + i * 44;

      // Row bg
      g.fillStyle(i % 2 === 0 ? 0x181208 : 0x100e06, 1);
      g.fillRect(px + 4, ry, RIGHT_W - 8, 40);

      // Icon + label
      this.add.text(px + 10, ry + 4, res.icon + ' ' + res.label, {
        fontSize: '11px', color: TEXT_PARCH, fontFamily: 'Georgia, serif',
      }).setScrollFactor(0).setDepth(801);

      // Value
      this.resTexts[res.key] = this.add.text(px + RIGHT_W - 10, ry + 4, '0', {
        fontSize: '12px', fontStyle: 'bold', color: TEXT_GOLD, fontFamily: 'Georgia, serif',
      }).setOrigin(1, 0).setScrollFactor(0).setDepth(801);

      // Rate
      this.rateTexts[res.key] = this.add.text(px + RIGHT_W - 10, ry + 22, '+0/h', {
        fontSize: '10px', color: TEXT_GREEN, fontFamily: 'Arial',
      }).setOrigin(1, 0).setScrollFactor(0).setDepth(801);

      // Row divider
      g.lineStyle(1, BORDER, 0.2);
      g.lineBetween(px + 4, ry + 40, px + RIGHT_W - 4, ry + 40);
    });

    const resBottom = 104 + RES.length * 44 + 4;

    // Divider
    g.lineStyle(1, BORDER, 0.5);
    g.lineBetween(px + 6, resBottom + 4, px + RIGHT_W - 6, resBottom + 4);

    // ── Construction queue ───────────────────────────────────────────────
    this.add.text(px + RIGHT_W / 2, resBottom + 10, 'CONSTRUCTION', {
      fontSize: '10px', fontStyle: 'bold', color: TEXT_GREY, fontFamily: 'Georgia, serif',
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(801);

    g.fillStyle(0x0e0c08, 1);
    g.fillRect(px + 4, resBottom + 24, RIGHT_W - 8, 46);
    g.lineStyle(1, BORDER, 0.4);
    g.strokeRect(px + 4, resBottom + 24, RIGHT_W - 8, 46);

    this.queueText = this.add.text(px + 10, resBottom + 30, 'No construction', {
      fontSize: '11px', color: TEXT_GREY, fontFamily: 'Georgia, serif', lineSpacing: 3,
    }).setScrollFactor(0).setDepth(801);

    // "Get More Resources" style button at the bottom
    const btnY = H - 46;
    g.fillStyle(0x3a2808, 1);
    g.fillRoundedRect(px + 8, btnY, RIGHT_W - 16, 30, 3);
    g.lineStyle(1, BORDER, 0.8);
    g.strokeRoundedRect(px + 8, btnY, RIGHT_W - 16, 30, 3);

    this.add.text(px + RIGHT_W / 2, btnY + 15, '+ More Resources', {
      fontSize: '11px', color: TEXT_GOLD, fontFamily: 'Georgia, serif',
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(801);

    this.updateResourcePanel();
  }

  private updateResourcePanel(): void {
    const rates = computeProduction(this.state);
    ['food','lumber','stone','iron','gold'].forEach(key => {
      const val  = this.state.resources[key as keyof typeof this.state.resources];
      const rate = rates[key as keyof typeof rates];
      this.resTexts[key]?.setText(fmtN(val));
      const rateStr = rate >= 0 ? `▲ ${fmtN(rate)}/h` : `▼ ${fmtN(Math.abs(rate))}/h`;
      this.rateTexts[key]?.setText(rateStr).setColor(rate < -0.01 ? TEXT_RED : TEXT_GREEN);
    });
  }

  // ── Bottom Bar ────────────────────────────────────────────────────────────

  private buildBottomBar(): void {
    const W = this.scale.width, H = this.scale.height;
    const RIGHT_W = 220;
    const BOT_H   = 54;
    const bY      = H - BOT_H;

    const g = this.add.graphics().setScrollFactor(0).setDepth(800);
    g.fillStyle(PANEL_BG, 0.98);
    g.fillRect(0, bY, W - RIGHT_W, BOT_H);
    g.lineStyle(2, BORDER, 1);
    g.lineBetween(0, bY, W - RIGHT_W, bY);
    g.lineStyle(1, GOLD, 0.3);
    g.lineBetween(0, bY + 1, W - RIGHT_W, bY + 1);

    // ── Construction | Troops tabs (bottom-left) ────────────────────────
    const tabs = ['Construction', 'Troops'];
    tabs.forEach((label, i) => {
      const tx = 8 + i * 110;
      const tabG = this.add.graphics().setScrollFactor(0).setDepth(801);
      tabG.fillStyle(i === 0 ? 0x7a5a10 : 0x2a2010, 1);
      tabG.fillRoundedRect(tx, bY + 6, 106, 40, { tl: 4, tr: 4, bl: 0, br: 0 });
      if (i === 0) {
        tabG.fillStyle(GOLD, 0.2);
        tabG.fillRoundedRect(tx + 1, bY + 7, 104, 18, { tl: 4, tr: 4, bl: 0, br: 0 });
      }
      tabG.lineStyle(1, i === 0 ? GOLD : BORDER, 0.7);
      tabG.strokeRoundedRect(tx, bY + 6, 106, 40, { tl: 4, tr: 4, bl: 0, br: 0 });

      this.add.text(tx + 53, bY + 26, label, {
        fontSize: '12px', fontStyle: i === 0 ? 'bold' : 'normal',
        color: i === 0 ? TEXT_GOLD : TEXT_GREY, fontFamily: 'Georgia, serif',
      }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(802);
    });

    // ── Action icon buttons ─────────────────────────────────────────────
    const actions = ['🏪', '⚔', '📜', '📊', '✉'];
    const aStartX = 234;
    actions.forEach((icon, i) => {
      const ax = aStartX + i * 48;
      const iconBg = this.add.graphics().setScrollFactor(0).setDepth(801);
      iconBg.fillStyle(0x2a2010, 1);
      iconBg.fillRoundedRect(ax, bY + 8, 40, 36, 4);
      iconBg.lineStyle(1, BORDER, 0.5);
      iconBg.strokeRoundedRect(ax, bY + 8, 40, 36, 4);

      this.add.text(ax + 20, bY + 26, icon, {
        fontSize: '16px',
      }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(802);
    });

    // ── World button (center-right of bottom bar) ───────────────────────
    const wBtnX = W - RIGHT_W - 110;
    const wBtnG = this.add.graphics().setScrollFactor(0).setDepth(801);
    wBtnG.fillStyle(0x5a1a10, 1);
    wBtnG.fillRoundedRect(wBtnX, bY + 10, 100, 32, 4);
    wBtnG.fillStyle(0xff3322, 0.15);
    wBtnG.fillRoundedRect(wBtnX + 1, bY + 11, 98, 14, { tl: 4, tr: 4, bl: 0, br: 0 });
    wBtnG.lineStyle(1, 0x8a3010, 1);
    wBtnG.strokeRoundedRect(wBtnX, bY + 10, 100, 32, 4);

    this.add.text(wBtnX + 50, bY + 26, '🌍  World', {
      fontSize: '12px', fontStyle: 'bold', color: '#ee9966', fontFamily: 'Georgia, serif',
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(802)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('WorldMapScene', { state: this.state }));

    this.add.zone(wBtnX, bY + 10, 100, 32)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(803)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('WorldMapScene', { state: this.state }))
      .on('pointerover', () => { wBtnG.clear(); wBtnG.fillStyle(0x7a2a18,1); wBtnG.fillRoundedRect(wBtnX,bY+10,100,32,4); wBtnG.lineStyle(1,0xaa4020,1); wBtnG.strokeRoundedRect(wBtnX,bY+10,100,32,4); })
      .on('pointerout',  () => { wBtnG.clear(); wBtnG.fillStyle(0x5a1a10,1); wBtnG.fillRoundedRect(wBtnX,bY+10,100,32,4); wBtnG.lineStyle(1,0x8a3010,1); wBtnG.strokeRoundedRect(wBtnX,bY+10,100,32,4); });
  }
}

function fmtN(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 10_000)    return (n / 1_000).toFixed(0) + 'K';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return Math.floor(n).toString();
}
function fmtTime(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s/60)}m ${s%60}s`;
  return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m`;
}
