import Phaser from 'phaser';
import { tileToScreen, isoDepth, TILE_W, TILE_H } from '../iso/IsoMap';
import type { GameState, Army } from '../data/types';
import { loadWorld, saveWorld } from '../systems/SaveSystem';
import { simulateBattle } from '../systems/CombatSystem';
import { CombatReport } from '../ui/CombatReport';
import type { NpcCamp } from '../data/world';

const MAP_SIZE = 200;
const CHUNK = 30; // render tiles within this radius of camera center

export class WorldMapScene extends Phaser.Scene {
  private state!: GameState;
  private camps!: NpcCamp[];
  private tileCache: Map<string, Phaser.GameObjects.Image> = new Map();
  private campSprites: Map<string, Phaser.GameObjects.Container> = new Map();
  private isDragging = false;
  private dragStart = { x: 0, y: 0 };
  private camStart  = { x: 0, y: 0 };
  private combatReport!: CombatReport;

  constructor() { super({ key: 'WorldMapScene' }); }

  init(data: { state: GameState }): void {
    this.state = data.state;
  }

  create(): void {
    this.camps = loadWorld();
    this.combatReport = new CombatReport(this);

    this.buildVisibleTiles();
    this.renderCamps();
    this.renderPlayerCity();
    this.setupCamera();
    this.setupInput();
    this.setupUI();

    // Refresh NPC camps respawn
    this.time.addEvent({
      delay: 5000,
      callback: this.checkRespawns,
      callbackScope: this,
      loop: true,
    });
  }

  // ── Tile rendering ────────────────────────────────────────────────────────

  private buildVisibleTiles(): void {
    // For performance, only render a fixed grid around player
    const cx = this.state.playerX;
    const cy = this.state.playerY;
    const r = CHUNK;

    for (let y = Math.max(0, cy - r); y < Math.min(MAP_SIZE, cy + r); y++) {
      for (let x = Math.max(0, cx - r); x < Math.min(MAP_SIZE, cx + r); x++) {
        this.getOrCreateTile(x, y);
      }
    }
  }

  private getOrCreateTile(x: number, y: number): Phaser.GameObjects.Image {
    const key = `${x},${y}`;
    if (this.tileCache.has(key)) return this.tileCache.get(key)!;

    const { x: sx, y: sy } = tileToScreen(x, y);
    const tileKey = this.worldTileKey(x, y);
    const tile = this.add.image(sx + TILE_W / 2, sy + TILE_H / 2, tileKey);
    tile.setDepth(isoDepth(x, y));
    this.tileCache.set(key, tile);
    return tile;
  }

  private worldTileKey(x: number, y: number): string {
    const noise = ((x * 13 + y * 7) * 2654435761) >>> 0;
    const n = (noise % 100) / 100;
    if (n < 0.12) return 'tile_forest';
    if (n < 0.18) return 'tile_mountain';
    if (n < 0.22) return 'tile_water';
    return 'tile_grass';
  }

  // ── Camp rendering ────────────────────────────────────────────────────────

  private renderCamps(): void {
    for (const camp of this.camps) {
      this.renderCamp(camp);
    }
  }

  private renderCamp(camp: NpcCamp): void {
    this.campSprites.get(camp.id)?.destroy();

    if (camp.defeatedAt) {
      const respawnAt = camp.defeatedAt + camp.respawnMs;
      if (Date.now() < respawnAt) {
        this.campSprites.delete(camp.id);
        return;
      } else {
        camp.defeatedAt = undefined;
      }
    }

    const { x: sx, y: sy } = tileToScreen(camp.tileX, camp.tileY);

    const icon = this.add.image(sx + TILE_W / 2, sy, 'npc_camp')
      .setOrigin(0.5, 1)
      .setDepth(isoDepth(camp.tileX, camp.tileY) + 0.5);

    const lvlText = this.add.text(sx + TILE_W / 2, sy - 68, `Lv ${camp.level}`, {
      fontSize: '11px', color: '#ff8888',
      backgroundColor: '#00000099',
      padding: { x: 3, y: 1 },
    }).setOrigin(0.5, 1).setDepth(isoDepth(camp.tileX, camp.tileY) + 1);

    const container = this.add.container(0, 0, [icon, lvlText])
      .setDepth(isoDepth(camp.tileX, camp.tileY) + 0.5);

    icon.setInteractive({ useHandCursor: true });
    icon.on('pointerover', () => icon.setTint(0xffaaaa));
    icon.on('pointerout',  () => icon.clearTint());
    icon.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (!this.isDragging) {
        ptr.event.stopPropagation();
        this.showAttackPanel(camp);
      }
    });

    this.campSprites.set(camp.id, container);
  }

  private renderPlayerCity(): void {
    const { x: sx, y: sy } = tileToScreen(this.state.playerX, this.state.playerY);
    this.add.image(sx + TILE_W / 2, sy, 'player_city')
      .setOrigin(0.5, 1)
      .setDepth(isoDepth(this.state.playerX, this.state.playerY) + 1);

    this.add.text(sx + TILE_W / 2, sy - 55, 'Your City', {
      fontSize: '12px', color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(0.5, 1).setDepth(isoDepth(this.state.playerX, this.state.playerY) + 2);
  }

  // ── Attack panel ──────────────────────────────────────────────────────────

  private showAttackPanel(camp: NpcCamp): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const PW = 300, PH = 340;
    const px = (W - PW) / 2, py = (H - PH) / 2;

    const bg = this.add.rectangle(px, py, PW, PH, 0x0f1e3c, 0.98)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(2000)
      .setStrokeStyle(2, 0xcc4444);

    const title = this.add.text(px + PW / 2, py + 14, camp.label, {
      fontSize: '16px', color: '#ff9999', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2001);

    const garrison = Object.entries(camp.garrison)
      .filter(([, v]) => (v ?? 0) > 0)
      .map(([k, v]) => `  ${k}: ${v}`)
      .join('\n');

    const infoText = this.add.text(px + 14, py + 44,
      `Defenders:\n${garrison}\n\nYour army:\n${this.armySummary()}`, {
        fontSize: '12px', color: '#cccccc', lineSpacing: 3,
      }).setScrollFactor(0).setDepth(2001);

    const attackBtn = this.add.rectangle(px + PW / 2, py + PH - 60, 120, 34, 0xcc3333)
      .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(2001)
      .setInteractive({ useHandCursor: true });

    const attackTxt = this.add.text(px + PW / 2, py + PH - 60, '⚔ Attack!', {
      fontSize: '14px', color: '#ffffff',
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(2002);

    const closeBtn = this.add.rectangle(px + PW / 2 + 70, py + PH - 60, 80, 34, 0x334455)
      .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(2001)
      .setInteractive({ useHandCursor: true });

    const closeTxt = this.add.text(px + PW / 2 + 70, py + PH - 60, 'Cancel', {
      fontSize: '13px', color: '#aaaaaa',
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(2002);

    const panel = this.add.container(0, 0, [
      bg, title, infoText, attackBtn, attackTxt, closeBtn, closeTxt,
    ]).setDepth(2000);

    attackBtn.on('pointerdown', () => {
      panel.destroy(true);
      this.executeAttack(camp);
    });
    closeBtn.on('pointerdown', () => panel.destroy(true));
    attackBtn.on('pointerover', () => attackBtn.setFillStyle(0xee4444));
    attackBtn.on('pointerout',  () => attackBtn.setFillStyle(0xcc3333));
  }

  private executeAttack(camp: NpcCamp): void {
    const result = simulateBattle(this.state.troops, camp.garrison, camp.resources);

    // Apply losses
    for (const [type, lost] of Object.entries(result.attackerLosses)) {
      const cur = this.state.troops[type as keyof Army] ?? 0;
      this.state.troops[type as keyof Army] = Math.max(0, cur - (lost ?? 0));
    }

    // Apply loot
    if (result.attackerWon) {
      this.state.resources.food   += result.loot.food;
      this.state.resources.lumber += result.loot.lumber;
      this.state.resources.stone  += result.loot.stone;
      this.state.resources.iron   += result.loot.iron;
      this.state.resources.gold   += result.loot.gold;

      camp.defeatedAt = Date.now();
      this.renderCamp(camp);
      saveWorld(this.camps);
    }

    this.combatReport.show(result);
  }

  private armySummary(): string {
    const lines: string[] = [];
    for (const [type, cnt] of Object.entries(this.state.troops)) {
      if ((cnt ?? 0) > 0) lines.push(`  ${type}: ${cnt}`);
    }
    return lines.length > 0 ? lines.join('\n') : '  (no troops)';
  }

  // ── Respawn ───────────────────────────────────────────────────────────────

  private checkRespawns(): void {
    const now = Date.now();
    for (const camp of this.camps) {
      if (camp.defeatedAt && now >= camp.defeatedAt + camp.respawnMs) {
        camp.defeatedAt = undefined;
        this.renderCamp(camp);
      }
    }
  }

  // ── Camera ────────────────────────────────────────────────────────────────

  private setupCamera(): void {
    const cam = this.cameras.main;
    const { x, y } = tileToScreen(this.state.playerX, this.state.playerY);
    cam.centerOn(x + TILE_W / 2, y);
    cam.setZoom(0.6);
  }

  private setupInput(): void {
    const cam = this.cameras.main;

    this.input.on('wheel', (_ptr: any, _go: any, _dx: number, dy: number) => {
      cam.setZoom(Phaser.Math.Clamp(cam.zoom - dy * 0.001, 0.2, 2));
    });

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

    const wasd = this.input.keyboard!.addKeys({ up: 'W', down: 'S', left: 'A', right: 'D' }) as any;
    this.events.on('update', () => {
      const speed = 8 / cam.zoom;
      if (wasd.left.isDown)  cam.scrollX -= speed;
      if (wasd.right.isDown) cam.scrollX += speed;
      if (wasd.up.isDown)    cam.scrollY -= speed;
      if (wasd.down.isDown)  cam.scrollY += speed;
    });
  }

  private setupUI(): void {
    const W = this.scale.width;
    const H = this.scale.height;

    this.add.rectangle(0, 0, W, 44, 0x1a1a2e, 0.92)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(1000);

    this.add.text(W / 2, 22, '🗺  World Map', {
      fontSize: '16px', color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(1001);

    this.add.text(16, 22, '◀ City', {
      fontSize: '14px', color: '#88aaff',
      backgroundColor: '#2244881a',
      padding: { x: 8, y: 4 },
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(1001)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('CityScene'))
      .on('pointerover', function(this: Phaser.GameObjects.Text) { this.setColor('#ffffff'); })
      .on('pointerout',  function(this: Phaser.GameObjects.Text) { this.setColor('#88aaff'); });
  }
}
