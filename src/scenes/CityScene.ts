import Phaser from 'phaser';
import { tileToScreen, screenToTile, isoDepth, TILE_W, TILE_H } from '../iso/IsoMap';
import type { GameState, BuildingInstance } from '../data/types';
import { BUILDINGS } from '../data/buildings';
import { tickResources } from '../systems/ResourceSystem';
import { checkConstructions, getBuildingInProgress } from '../systems/BuildingSystem';
import { loadGame, defaultState, saveGame } from '../systems/SaveSystem';
import { HUD } from '../ui/HUD';
import { BuildingPanel } from '../ui/BuildingPanel';

const GRID_SIZE = 20;
const SAVE_INTERVAL = 30000; // 30s

export class CityScene extends Phaser.Scene {
  private state!: GameState;
  private tileSprites: Phaser.GameObjects.Image[][] = [];
  private buildingSprites: Map<string, Phaser.GameObjects.Image> = new Map();
  private constructSprites: Map<string, Phaser.GameObjects.Image> = new Map();
  private constructTimerTexts: Map<string, Phaser.GameObjects.Text> = new Map();
  private hud!: HUD;
  private buildingPanel!: BuildingPanel;
  private lastSave = 0;
  private isDragging = false;
  private dragStart = { x: 0, y: 0 };
  private camStart = { x: 0, y: 0 };

  constructor() { super({ key: 'CityScene' }); }

  create(): void {
    const saved = loadGame();
    this.state = saved ?? defaultState();

    this.hud = new HUD(this);
    this.buildingPanel = new BuildingPanel(this);

    this.buildTileGrid();
    this.renderAllBuildings();
    this.hud.create(this.state);
    this.setupCamera();
    this.setupInput();
    this.setupUI();
    this.lastSave = Date.now();
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;

    tickResources(this.state, dt);

    const finished = checkConstructions(this.state);
    if (finished.length > 0) {
      finished.forEach(type => {
        const b = this.state.buildings.find(b => b.type === type && !b.constructingUntil);
        if (b) this.refreshBuilding(b);
      });
      this.hud.update(this.state);
    }

    this.updateConstructionTimers();
    this.hud.update(this.state);

    if (Date.now() - this.lastSave > SAVE_INTERVAL) {
      saveGame(this.state);
      this.lastSave = Date.now();
    }
  }

  // ── Grid construction ─────────────────────────────────────────────────────

  private buildTileGrid(): void {
    for (let y = 0; y < GRID_SIZE; y++) {
      this.tileSprites[y] = [];
      for (let x = 0; x < GRID_SIZE; x++) {
        const { x: sx, y: sy } = tileToScreen(x, y);
        const key = this.getTileKey(x, y);
        const tile = this.add.image(sx + TILE_W / 2, sy + TILE_H / 2, key);
        tile.setDepth(isoDepth(x, y));
        tile.setInteractive();
        tile.on('pointerdown', (_ptr: Phaser.Input.Pointer) => {
          if (!this.isDragging) this.buildingPanel.hide();
        });
        this.tileSprites[y][x] = tile;
      }
    }
  }

  private getTileKey(x: number, y: number): string {
    // Outer ring = field tiles
    if (x <= 2 || x >= GRID_SIZE - 3 || y <= 2 || y >= GRID_SIZE - 3) return 'tile_field';
    return 'tile_grass';
  }

  // ── Building rendering ────────────────────────────────────────────────────

  private renderAllBuildings(): void {
    for (const b of this.state.buildings) {
      this.spawnBuildingSprite(b);
    }
  }

  private spawnBuildingSprite(b: BuildingInstance): void {
    const { x: sx, y: sy } = tileToScreen(b.tileX, b.tileY);
    const def = BUILDINGS[b.type];
    const key = `building_${b.type}`;

    // Remove old sprite if exists
    this.buildingSprites.get(b.id)?.destroy();

    const sprite = this.add.image(sx + TILE_W / 2, sy, key);
    sprite.setOrigin(0.5, 1);
    sprite.setDepth(isoDepth(b.tileX, b.tileY) + 0.5);
    sprite.setInteractive({ useHandCursor: true });
    sprite.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (!this.isDragging) {
        this.buildingPanel.show(b, this.state, () => {
          this.showConstructionOverlay(b);
          this.hud.update(this.state);
        });
        ptr.event.stopPropagation();
      }
    });
    sprite.on('pointerover', () => sprite.setTint(0xddddff));
    sprite.on('pointerout',  () => sprite.clearTint());

    this.buildingSprites.set(b.id, sprite);

    // If currently constructing, show scaffold
    if (b.constructingUntil && b.constructingUntil > Date.now()) {
      this.showConstructionOverlay(b);
    }
  }

  private showConstructionOverlay(b: BuildingInstance): void {
    this.constructSprites.get(b.id)?.destroy();
    this.constructTimerTexts.get(b.id)?.destroy();

    const { x: sx, y: sy } = tileToScreen(b.tileX, b.tileY);
    const scaffold = this.add.image(sx + TILE_W / 2, sy - 10, 'scaffold')
      .setOrigin(0.5, 1)
      .setDepth(isoDepth(b.tileX, b.tileY) + 1)
      .setAlpha(0.7);

    const timerText = this.add.text(sx + TILE_W / 2, sy - 80, '', {
      fontSize: '11px', color: '#ffcc00',
      backgroundColor: '#00000099',
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5, 1).setDepth(isoDepth(b.tileX, b.tileY) + 2);

    this.constructSprites.set(b.id, scaffold);
    this.constructTimerTexts.set(b.id, timerText);
  }

  private refreshBuilding(b: BuildingInstance): void {
    this.constructSprites.get(b.id)?.destroy();
    this.constructSprites.delete(b.id);
    this.constructTimerTexts.get(b.id)?.destroy();
    this.constructTimerTexts.delete(b.id);
    this.spawnBuildingSprite(b);
  }

  private updateConstructionTimers(): void {
    const now = Date.now();
    for (const b of this.state.buildings) {
      const txt = this.constructTimerTexts.get(b.id);
      if (!txt) continue;
      if (b.constructingUntil && b.constructingUntil > now) {
        const remaining = Math.ceil((b.constructingUntil - now) / 1000);
        txt.setText(fmtTime(remaining));
      }
    }
  }

  // ── Camera ────────────────────────────────────────────────────────────────

  private setupCamera(): void {
    const cam = this.cameras.main;
    // Center on Town Hall
    const th = this.state.buildings.find(b => b.type === 'townhall');
    if (th) {
      const { x, y } = tileToScreen(th.tileX, th.tileY);
      cam.centerOn(x + TILE_W / 2, y);
    }
    cam.setBounds(-200, -200, GRID_SIZE * TILE_W + 400, GRID_SIZE * TILE_H * 2 + 400);
    cam.setZoom(1);
  }

  private setupInput(): void {
    const cam = this.cameras.main;

    // Scroll wheel zoom
    this.input.on('wheel', (_ptr: any, _go: any, _dx: number, dy: number) => {
      const zoom = Phaser.Math.Clamp(cam.zoom - dy * 0.001, 0.4, 2.5);
      cam.setZoom(zoom);
    });

    // Click-drag pan
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      this.isDragging = false;
      this.dragStart = { x: ptr.x, y: ptr.y };
      this.camStart  = { x: cam.scrollX, y: cam.scrollY };
    });

    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (!ptr.isDown) return;
      const dx = ptr.x - this.dragStart.x;
      const dy = ptr.y - this.dragStart.y;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) this.isDragging = true;
      if (this.isDragging) {
        cam.scrollX = this.camStart.x - dx / cam.zoom;
        cam.scrollY = this.camStart.y - dy / cam.zoom;
      }
    });

    this.input.on('pointerup', () => {
      setTimeout(() => { this.isDragging = false; }, 0);
    });

    // WASD
    const cursors = this.input.keyboard!.createCursorKeys();
    const wasd = this.input.keyboard!.addKeys({ up: 'W', down: 'S', left: 'A', right: 'D' }) as any;
    this.events.on('update', () => {
      const speed = 6 / cam.zoom;
      if (cursors.left.isDown  || wasd.left.isDown)  cam.scrollX -= speed;
      if (cursors.right.isDown || wasd.right.isDown) cam.scrollX += speed;
      if (cursors.up.isDown    || wasd.up.isDown)    cam.scrollY -= speed;
      if (cursors.down.isDown  || wasd.down.isDown)  cam.scrollY += speed;
    });
  }

  private setupUI(): void {
    const W = this.scale.width;
    const H = this.scale.height;

    // ── Bottom nav bar — Evony bronze style ────────────────────────────────
    const navH = 54;
    const navG = this.add.graphics().setScrollFactor(0).setDepth(990);
    navG.fillStyle(0x12100a, 0.97);
    navG.fillRect(0, H - navH, W, navH);
    // Top gold border
    navG.lineStyle(2, 0x8a6a20, 1);
    navG.lineBetween(0, H - navH, W, H - navH);
    navG.lineStyle(1, 0xd4aa40, 0.35);
    navG.lineBetween(0, H - navH - 2, W, H - navH - 2);

    // Tab buttons — matching original Evony's bottom tabs
    const tabs = [
      { label: '🏰  City',       key: 'city' },
      { label: '🗺  World Map',  key: 'world' },
      { label: '⚔  Reports',    key: 'reports' },
      { label: '📜  Alliance',   key: 'alliance' },
      { label: '🦸  Heroes',     key: 'heroes' },
    ];

    const tabW = Math.min(130, W / tabs.length - 8);
    const startX = (W - tabW * tabs.length - 8 * (tabs.length - 1)) / 2;

    tabs.forEach((tab, i) => {
      const tx = startX + i * (tabW + 8);
      const ty = H - navH + 6;
      const isActive = tab.key === 'city';

      const tabG = this.add.graphics().setScrollFactor(0).setDepth(991);
      tabG.fillStyle(isActive ? 0x8a6018 : 0x2a2010, 1);
      tabG.fillRoundedRect(tx, ty, tabW, 40, { tl: 4, tr: 4, bl: 0, br: 0 });
      if (isActive) {
        tabG.fillStyle(0xc8a030, 0.3);
        tabG.fillRoundedRect(tx + 1, ty + 1, tabW - 2, 18, { tl: 4, tr: 4, bl: 0, br: 0 });
      }
      tabG.lineStyle(1, isActive ? 0xd4aa40 : 0x5a4a20, 1);
      tabG.strokeRoundedRect(tx, ty, tabW, 40, { tl: 4, tr: 4, bl: 0, br: 0 });

      const label = this.add.text(tx + tabW / 2, ty + 20, tab.label, {
        fontSize: '12px',
        color: isActive ? '#d4aa40' : '#888070',
        fontStyle: isActive ? 'bold' : 'normal',
        fontFamily: 'Georgia, serif',
      }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(992);

      if (tab.key === 'world') {
        const hitZone = this.add.zone(tx, ty, tabW, 40)
          .setOrigin(0, 0).setScrollFactor(0).setDepth(993)
          .setInteractive({ useHandCursor: true });
        hitZone.on('pointerdown', () => {
          this.scene.start('WorldMapScene', { state: this.state });
        });
        hitZone.on('pointerover', () => {
          tabG.clear();
          tabG.fillStyle(0x5a4018, 1);
          tabG.fillRoundedRect(tx, ty, tabW, 40, { tl: 4, tr: 4, bl: 0, br: 0 });
          tabG.lineStyle(1, 0x8a6a20, 1);
          tabG.strokeRoundedRect(tx, ty, tabW, 40, { tl: 4, tr: 4, bl: 0, br: 0 });
          label.setColor('#d4aa40');
        });
        hitZone.on('pointerout', () => {
          tabG.clear();
          tabG.fillStyle(0x2a2010, 1);
          tabG.fillRoundedRect(tx, ty, tabW, 40, { tl: 4, tr: 4, bl: 0, br: 0 });
          tabG.lineStyle(1, 0x5a4a20, 1);
          tabG.strokeRoundedRect(tx, ty, tabW, 40, { tl: 4, tr: 4, bl: 0, br: 0 });
          label.setColor('#888070');
        });
      }
    });

    // Construction queue widget (top-left corner below HUD)
    this.makeConstructionWidget();
  }

  private makeConstructionWidget(): void {
    // This will be updated each frame via updateConstructionTimers
    // Placeholder slot drawn here; timer text is updated live
  }
}

function fmtTime(secs: number): string {
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
}
