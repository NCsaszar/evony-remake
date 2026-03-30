import Phaser from 'phaser';
import { tileToScreen, isoDepth, TILE_W, TILE_H } from '../iso/IsoMap';
import type { GameState, Army } from '../data/types';
import { loadWorld, saveWorld } from '../systems/SaveSystem';
import { simulateBattle } from '../systems/CombatSystem';
import { CombatReport } from '../ui/CombatReport';
import type { NpcCamp } from '../data/world';

const MAP_SIZE     = 200;
const STREAM_RADIUS = 28; // tiles to render around camera center

// UI layout — match CityScene constants
const TOP_H = 32;
const BOT_H = 54;

// Palette — match CityScene
const PANEL_BG  = 0x1a1408;
const BORDER    = 0x8a6a20;
const GOLD      = 0xc8a030;
const TEXT_GOLD  = '#c8a030';
const TEXT_PARCH = '#eeddb8';
const TEXT_GREY  = '#807060';

export class WorldMapScene extends Phaser.Scene {
  private state!: GameState;
  private camps!: NpcCamp[];

  // World object caches
  private tileCache    = new Map<string, Phaser.GameObjects.Image>();
  private campSprites  = new Map<string, Phaser.GameObjects.Container>();
  private worldObjList: Phaser.GameObjects.GameObject[] = [];

  // Two-camera setup: mainCam = world (zoom/drag), hudCam = UI (fixed)
  private hudCam!: Phaser.Cameras.Scene2D.Camera;
  private uiObjs: Phaser.GameObjects.GameObject[] = [];

  // Input state
  private isDragging = false;
  private dragStart  = { x: 0, y: 0 };
  private camStart   = { x: 0, y: 0 };

  // Open panels
  private combatReport!: CombatReport;
  private attackPanelObjs: Phaser.GameObjects.GameObject[] = [];

  constructor() { super({ key: 'WorldMapScene' }); }

  init(data: { state: GameState }): void {
    this.state = data.state;
  }

  create(): void {
    const W = this.scale.width, H = this.scale.height;

    // HUD camera — UI layer, never zooms, never scrolls
    this.hudCam = this.cameras.add(0, 0, W, H, false, 'hud');
    this.hudCam.setZoom(1).setScroll(0, 0);

    this.cameras.main.setBackgroundColor(0x2a4a14);

    this.combatReport = new CombatReport(this);

    // Build world then configure cameras
    this.buildVisibleTiles();
    this.renderCamps();
    this.renderPlayerCity();

    // Center main cam on player city
    const { x: px, y: py } = tileToScreen(this.state.playerX, this.state.playerY);
    this.cameras.main.centerOn(px + TILE_W / 2, py + TILE_H / 2);
    this.cameras.main.setZoom(1.0);

    // Build UI (adds to uiObjs, hides from mainCam)
    this.buildTopBar();
    this.buildBottomBar();

    // Main camera ignores all UI objects
    this.cameras.main.ignore(this.uiObjs);

    // Input
    this.setupInput();

    // ESC: close attack panel
    this.input.keyboard?.on('keydown-ESC', () => this.closeAttackPanel());

    // NPC respawn
    this.time.addEvent({
      delay: 5000,
      callback: this.checkRespawns,
      callbackScope: this,
      loop: true,
    });
  }

  // ── Camera helpers ──────────────────────────────────────────────────────────

  /** Track a world object and hide it from the HUD camera. */
  private wObj<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.worldObjList.push(obj);
    this.hudCam.ignore(obj);
    return obj;
  }

  /** Track a UI object and hide it from the main (world) camera. */
  private uiAdd<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.uiObjs.push(obj);
    this.cameras.main.ignore(obj);
    return obj;
  }

  /** Track an attack panel object (UI layer, hidden from mainCam). */
  private panelAdd<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.attackPanelObjs.push(obj);
    this.cameras.main.ignore(obj);
    return obj;
  }

  private closeAttackPanel(): void {
    this.attackPanelObjs.forEach(o => o.destroy());
    this.attackPanelObjs = [];
  }

  // ── Tile streaming ──────────────────────────────────────────────────────────

  private buildVisibleTiles(): void {
    const cam = this.cameras.main;
    const wx = cam.scrollX + cam.width / 2 / cam.zoom;
    const wy = cam.scrollY + cam.height / 2 / cam.zoom;
    this.streamAround(Math.round(wx / TILE_W), Math.round(wy / TILE_H));
  }

  private streamTiles(): void {
    const cam = this.cameras.main;
    const wx = cam.scrollX + cam.width / 2 / cam.zoom;
    const wy = cam.scrollY + cam.height / 2 / cam.zoom;
    this.streamAround(Math.round(wx / TILE_W), Math.round(wy / TILE_H));
  }

  private streamAround(cx: number, cy: number): void {
    const r = STREAM_RADIUS;
    for (let y = Math.max(0, cy - r); y < Math.min(MAP_SIZE, cy + r); y++)
      for (let x = Math.max(0, cx - r); x < Math.min(MAP_SIZE, cx + r); x++)
        this.getOrCreateTile(x, y);
  }

  private getOrCreateTile(x: number, y: number): Phaser.GameObjects.Image {
    const key = `${x},${y}`;
    if (this.tileCache.has(key)) return this.tileCache.get(key)!;
    const { x: sx, y: sy } = tileToScreen(x, y);
    const tile = this.wObj(
      this.add.image(sx + TILE_W / 2, sy + TILE_H / 2, this.worldTileKey(x, y))
        .setDepth(isoDepth(x, y))
    );
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

  // ── Camp rendering ──────────────────────────────────────────────────────────

  private renderCamps(): void {
    for (const camp of this.camps) this.renderCamp(camp);
  }

  private renderCamp(camp: NpcCamp): void {
    this.campSprites.get(camp.id)?.destroy();

    if (camp.defeatedAt) {
      const respawnAt = camp.defeatedAt + camp.respawnMs;
      if (Date.now() < respawnAt) { this.campSprites.delete(camp.id); return; }
      camp.defeatedAt = undefined;
    }

    const { x: sx, y: sy } = tileToScreen(camp.tileX, camp.tileY);
    const depth = isoDepth(camp.tileX, camp.tileY);

    const icon = this.add.image(sx + TILE_W / 2, sy, 'npc_camp')
      .setOrigin(0.5, 1).setDepth(depth + 0.5);
    const lvlText = this.add.text(sx + TILE_W / 2, sy - 68, `Lv ${camp.level}`, {
      fontSize: '11px', color: '#ff8888', backgroundColor: '#00000099', padding: { x: 3, y: 1 },
    }).setOrigin(0.5, 1).setDepth(depth + 1);

    const container = this.wObj(
      this.add.container(0, 0, [icon, lvlText]).setDepth(depth + 0.5)
    );

    icon.setInteractive({ useHandCursor: true });
    icon.on('pointerover', () => icon.setTint(0xffaaaa));
    icon.on('pointerout',  () => icon.clearTint());
    icon.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (!this.isDragging) {
        ptr.event.stopPropagation();
        this.showAttackPanel(camp);
      }
    });

    // Each sub-object needs to be hidden from hudCam too
    this.hudCam.ignore(icon);
    this.hudCam.ignore(lvlText);

    this.campSprites.set(camp.id, container);
  }

  private renderPlayerCity(): void {
    const { x: sx, y: sy } = tileToScreen(this.state.playerX, this.state.playerY);
    const depth = isoDepth(this.state.playerX, this.state.playerY);
    this.wObj(
      this.add.image(sx + TILE_W / 2, sy, 'player_city')
        .setOrigin(0.5, 1).setDepth(depth + 1)
    );
    this.wObj(
      this.add.text(sx + TILE_W / 2, sy - 55, '⬡ Your City', {
        fontSize: '12px', color: '#ffd700', fontStyle: 'bold',
      }).setOrigin(0.5, 1).setDepth(depth + 2)
    );
  }

  // ── Attack panel ────────────────────────────────────────────────────────────

  private showAttackPanel(camp: NpcCamp): void {
    this.closeAttackPanel();

    const W = this.scale.width, H = this.scale.height;
    const PW = 320, PH = 360;
    const px = (W - PW) / 2, py = (H - PH) / 2;

    const bg = this.panelAdd(this.add.graphics().setDepth(2000));
    bg.fillStyle(PANEL_BG, 0.98); bg.fillRoundedRect(px, py, PW, PH, 6);
    bg.lineStyle(2, BORDER, 1);   bg.strokeRoundedRect(px, py, PW, PH, 6);
    bg.lineStyle(1, GOLD, 0.3);   bg.strokeRoundedRect(px+2, py+2, PW-4, PH-4, 5);

    this.panelAdd(this.add.text(px + PW / 2, py + 16, camp.label, {
      fontSize: '16px', color: '#ff9999', fontStyle: 'bold', fontFamily: 'Georgia, serif',
    }).setOrigin(0.5, 0).setDepth(2001));

    const garrison = Object.entries(camp.garrison)
      .filter(([, v]) => (v ?? 0) > 0)
      .map(([k, v]) => `  ${k}: ${v}`).join('\n') || '  (empty)';

    this.panelAdd(this.add.text(px + 16, py + 50,
      `Defenders:\n${garrison}\n\nYour army:\n${this.armySummary()}`, {
        fontSize: '12px', color: TEXT_PARCH, lineSpacing: 3, fontFamily: 'Arial',
      }).setDepth(2001));

    // Attack button
    const atkBG = this.panelAdd(this.add.graphics().setDepth(2001));
    const drawAtk = (h: boolean) => {
      atkBG.clear();
      atkBG.fillStyle(h ? 0xdd4444 : 0xaa2222, 1);
      atkBG.fillRoundedRect(px + PW / 2 - 70, py + PH - 60, 130, 38, 5);
      atkBG.lineStyle(1, 0xff6666, 1);
      atkBG.strokeRoundedRect(px + PW / 2 - 70, py + PH - 60, 130, 38, 5);
    };
    drawAtk(false);
    this.panelAdd(this.add.text(px + PW / 2 - 5, py + PH - 41, '⚔  Attack!', {
      fontSize: '14px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(2002));
    const atkZone = this.panelAdd(
      this.add.zone(px + PW / 2 - 70, py + PH - 60, 130, 38).setOrigin(0, 0).setDepth(2003)
        .setInteractive({ useHandCursor: true })
    ) as Phaser.GameObjects.Zone;
    atkZone.on('pointerover', () => drawAtk(true));
    atkZone.on('pointerout',  () => drawAtk(false));
    atkZone.on('pointerdown', () => { this.closeAttackPanel(); this.executeAttack(camp); });

    // Close button
    const clsBG = this.panelAdd(this.add.graphics().setDepth(2001));
    const drawCls = (h: boolean) => {
      clsBG.clear();
      clsBG.fillStyle(h ? 0x334455 : 0x223344, 1);
      clsBG.fillRoundedRect(px + PW / 2 + 70, py + PH - 60, 80, 38, 5);
      clsBG.lineStyle(1, 0x445566, 1);
      clsBG.strokeRoundedRect(px + PW / 2 + 70, py + PH - 60, 80, 38, 5);
    };
    drawCls(false);
    this.panelAdd(this.add.text(px + PW / 2 + 110, py + PH - 41, 'Cancel', {
      fontSize: '13px', color: TEXT_GREY,
    }).setOrigin(0.5, 0.5).setDepth(2002));
    const clsZone = this.panelAdd(
      this.add.zone(px + PW / 2 + 70, py + PH - 60, 80, 38).setOrigin(0, 0).setDepth(2003)
        .setInteractive({ useHandCursor: true })
    ) as Phaser.GameObjects.Zone;
    clsZone.on('pointerover', () => drawCls(true));
    clsZone.on('pointerout',  () => drawCls(false));
    clsZone.on('pointerdown', () => this.closeAttackPanel());
  }

  private executeAttack(camp: NpcCamp): void {
    const result = simulateBattle(this.state.troops, camp.garrison, camp.resources);
    for (const [type, lost] of Object.entries(result.attackerLosses)) {
      const cur = this.state.troops[type as keyof Army] ?? 0;
      this.state.troops[type as keyof Army] = Math.max(0, cur - (lost ?? 0));
    }
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
    for (const [type, cnt] of Object.entries(this.state.troops))
      if ((cnt ?? 0) > 0) lines.push(`  ${type}: ${cnt}`);
    return lines.length > 0 ? lines.join('\n') : '  (no troops)';
  }

  // ── Respawn ─────────────────────────────────────────────────────────────────

  private checkRespawns(): void {
    const now = Date.now();
    for (const camp of this.camps)
      if (camp.defeatedAt && now >= camp.defeatedAt + camp.respawnMs)
        this.renderCamp(camp);
  }

  // ── Input ───────────────────────────────────────────────────────────────────

  private setupInput(): void {
    const cam = this.cameras.main;

    // Scroll wheel zoom
    this.input.on('wheel', (_ptr: unknown, _go: unknown, _dx: number, dy: number) => {
      cam.setZoom(Phaser.Math.Clamp(cam.zoom - dy * 0.001, 0.15, 3.0));
    });

    // Drag pan — ignore clicks inside top/bottom bar
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (ptr.y < TOP_H || ptr.y > this.scale.height - BOT_H) return;
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
        this.streamTiles();
      }
    });

    this.input.on('pointerup', () => {
      setTimeout(() => { this.isDragging = false; }, 0);
    });

    // WASD + arrow keys pan
    const keys = this.input.keyboard!.addKeys({
      up:'W', down:'S', left:'A', right:'D',
      uarrow:'UP', darrow:'DOWN', larrow:'LEFT', rarrow:'RIGHT',
    }) as Record<string, Phaser.Input.Keyboard.Key>;
    this.events.on('update', () => {
      const spd = 8 / cam.zoom;
      if (keys.left.isDown  || keys.larrow.isDown)  cam.scrollX -= spd;
      if (keys.right.isDown || keys.rarrow.isDown)   cam.scrollX += spd;
      if (keys.up.isDown    || keys.uarrow.isDown)   cam.scrollY -= spd;
      if (keys.down.isDown  || keys.darrow.isDown)   cam.scrollY += spd;
    });
  }

  // ── UI ──────────────────────────────────────────────────────────────────────

  private buildTopBar(): void {
    const W = this.scale.width;

    const bg = this.uiAdd(this.add.graphics().setDepth(1000));
    bg.fillStyle(PANEL_BG, 0.98); bg.fillRect(0, 0, W, TOP_H);
    bg.lineStyle(2, BORDER, 1);   bg.lineBetween(0, TOP_H, W, TOP_H);
    bg.lineStyle(1, GOLD, 0.3);   bg.lineBetween(0, TOP_H - 1, W, TOP_H - 1);

    // Centered nav tabs — match CityScene
    const navTabs = [
      { label: 'TOWN', key: 'town' },
      { label: 'CITY', key: 'city' },
      { label: 'MAP',  key: 'map'  },
    ];
    const tabW = 80;
    const startX = W / 2 - (tabW * navTabs.length) / 2;

    navTabs.forEach((tab, i) => {
      const tx = startX + i * tabW;
      const active = tab.key === 'map';

      const tabBg = this.uiAdd(this.add.graphics().setDepth(1001));
      tabBg.fillStyle(active ? 0x7a5a10 : 0x2a2010, 1);
      tabBg.fillRect(tx, 2, tabW - 2, TOP_H - 4);
      if (active) {
        tabBg.fillStyle(GOLD, 0.2);
        tabBg.fillRect(tx + 1, 3, tabW - 4, (TOP_H - 6) / 2);
      }
      tabBg.lineStyle(1, active ? GOLD : BORDER, 0.7);
      tabBg.strokeRect(tx, 2, tabW - 2, TOP_H - 4);

      const lbl = this.uiAdd(this.add.text(tx + tabW / 2 - 1, TOP_H / 2, tab.label, {
        fontSize: '11px', fontStyle: 'bold',
        color: active ? TEXT_GOLD : TEXT_GREY,
        fontFamily: 'Georgia, serif',
      }).setOrigin(0.5, 0.5).setDepth(1002));

      const zone = this.uiAdd(
        this.add.zone(tx, 2, tabW - 2, TOP_H - 4).setOrigin(0, 0).setDepth(1003)
          .setInteractive({ useHandCursor: true })
      ) as Phaser.GameObjects.Zone;
      zone.on('pointerover', () => lbl.setColor(TEXT_PARCH));
      zone.on('pointerout',  () => lbl.setColor(active ? TEXT_GOLD : TEXT_GREY));
      if (!active) {
        zone.on('pointerdown', () => this.scene.start('CityScene'));
      }
    });
  }

  private buildBottomBar(): void {
    const W = this.scale.width, H = this.scale.height;
    const bY = H - BOT_H;

    const bg = this.uiAdd(this.add.graphics().setDepth(1000));
    bg.fillStyle(PANEL_BG, 0.98); bg.fillRect(0, bY, W, BOT_H);
    bg.lineStyle(2, BORDER, 1);   bg.lineBetween(0, bY, W, bY);
    bg.lineStyle(1, GOLD, 0.3);   bg.lineBetween(0, bY + 1, W, bY + 1);

    // "Return to City Center" button (centered)
    const bw = 180, bh = 36;
    const bx = W / 2 - bw / 2, by = bY + (BOT_H - bh) / 2;

    const btnG = this.uiAdd(this.add.graphics().setDepth(1001));
    const drawBtn = (h: boolean) => {
      btnG.clear();
      btnG.fillStyle(h ? 0x7a5a10 : 0x3a2808, 1);
      btnG.fillRoundedRect(bx, by, bw, bh, 4);
      btnG.lineStyle(1, h ? GOLD : BORDER, 0.9);
      btnG.strokeRoundedRect(bx, by, bw, bh, 4);
    };
    drawBtn(false);

    const btnTxt = this.uiAdd(this.add.text(bx + bw / 2, by + bh / 2, '🏰 Return to City', {
      fontSize: '12px', fontStyle: 'bold', color: TEXT_GOLD, fontFamily: 'Georgia, serif',
    }).setOrigin(0.5, 0.5).setDepth(1002));

    const zone = this.uiAdd(
      this.add.zone(bx, by, bw, bh).setOrigin(0, 0).setDepth(1003)
        .setInteractive({ useHandCursor: true })
    ) as Phaser.GameObjects.Zone;
    zone.on('pointerover',  () => { drawBtn(true);  btnTxt.setColor('#ffffff'); });
    zone.on('pointerout',   () => { drawBtn(false); btnTxt.setColor(TEXT_GOLD); });
    zone.on('pointerdown',  () => this.centerOnPlayerCity());

    // Zoom hint — left side
    this.uiAdd(this.add.text(16, bY + BOT_H / 2,
      'Scroll: zoom  ·  Drag: pan  ·  WASD: move', {
        fontSize: '9px', color: TEXT_GREY, fontFamily: 'Arial',
      }).setOrigin(0, 0.5).setDepth(1001));

    // Back to city shortcut — right side
    const backTxt = this.uiAdd(this.add.text(W - 16, bY + BOT_H / 2, '◀ City', {
      fontSize: '11px', color: '#88aaff',
      backgroundColor: '#22448822', padding: { x: 6, y: 3 },
      fontFamily: 'Arial',
    }).setOrigin(1, 0.5).setDepth(1002).setInteractive({ useHandCursor: true }));
    backTxt.on('pointerdown', () => this.scene.start('CityScene'));
    backTxt.on('pointerover', () => backTxt.setColor('#ffffff'));
    backTxt.on('pointerout',  () => backTxt.setColor('#88aaff'));
  }

  private centerOnPlayerCity(): void {
    const { x: sx, y: sy } = tileToScreen(this.state.playerX, this.state.playerY);
    this.cameras.main.centerOn(sx + TILE_W / 2, sy + TILE_H / 2);
  }
}
