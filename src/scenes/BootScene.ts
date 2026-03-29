import Phaser from 'phaser';

// Evony Age 1 color palette (derived from original screenshot)
const PAL = {
  // Ground tiles
  grassTop:    0x4a5c38,
  grassSide:   0x3a4a2c,
  fieldTop:    0x6b5230,
  fieldSide:   0x543f24,
  stoneTop:    0x5a5a52,
  stoneSide:   0x3f3f3a,
  waterTop:    0x1e3d5a,
  waterSide:   0x162e45,
  forestTop:   0x2d4020,
  forestSide:  0x1e2e16,
  // Stone building palette
  stoneLight:  0x8a8070,
  stoneMid:    0x6a6058,
  stoneDark:   0x4a4040,
  stoneWall:   0x7a7068,
  roofBrown:   0x5a3820,
  roofDark:    0x3a2412,
  woodBrown:   0x6b4020,
  metalGrey:   0x505868,
  goldAccent:  0xc8a030,
  redBanner:   0x8b1a1a,
};

export class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'BootScene' }); }

  preload(): void {
    this.generateTileTextures();
    this.generateBuildingTextures();
    this.generateUITextures();
  }

  create(): void {
    this.scene.start('CityScene');
  }

  // ── Tiles ──────────────────────────────────────────────────────────────────

  private generateTileTextures(): void {
    this.makeIsoTile('tile_grass',    PAL.grassTop,   PAL.grassSide,  true);
    this.makeIsoTile('tile_field',    PAL.fieldTop,   PAL.fieldSide,  false);
    this.makeIsoTile('tile_road',     PAL.stoneTop,   PAL.stoneSide,  false);
    this.makeIsoTile('tile_water',    PAL.waterTop,   PAL.waterSide,  false);
    this.makeIsoTile('tile_forest',   PAL.forestTop,  PAL.forestSide, true);
    this.makeIsoTile('tile_mountain', PAL.stoneTop,   PAL.stoneSide,  false);
    this.makeIsoTileHighlight();
  }

  private makeIsoTile(key: string, topColor: number, _sideColor: number, addNoise: boolean): void {
    const TW = 128, TH = 64;
    const g = this.make.graphics();

    // Top diamond face
    g.fillStyle(topColor, 1);
    g.fillPoints([
      { x: TW / 2, y: 0 },
      { x: TW,     y: TH / 2 },
      { x: TW / 2, y: TH },
      { x: 0,      y: TH / 2 },
    ], true);

    // Noise / texture dots to simulate stone/dirt
    if (addNoise) {
      const lighter = Phaser.Display.Color.ValueToColor(topColor).lighten(12).color;
      const darker  = Phaser.Display.Color.ValueToColor(topColor).darken(12).color;
      const dots = [
        [24, 30], [40, 20], [60, 28], [80, 18], [100, 26],
        [32, 44], [56, 50], [78, 42], [96, 48],
        [44, 58], [68, 54],
      ];
      for (const [dx, dy] of dots) {
        g.fillStyle(((dx + dy) % 3 === 0) ? lighter : darker, 0.6);
        g.fillRect(dx, dy, 2, 1);
      }
    }

    // Dark edge lines for depth
    g.lineStyle(1, 0x000000, 0.45);
    g.strokePoints([
      { x: TW / 2, y: 0 },
      { x: TW,     y: TH / 2 },
      { x: TW / 2, y: TH },
      { x: 0,      y: TH / 2 },
    ], true);

    g.generateTexture(key, TW, TH);
    g.destroy();
  }

  private makeIsoTileHighlight(): void {
    const TW = 128, TH = 64;
    const g = this.make.graphics();
    g.fillStyle(0x88aaff, 0.35);
    g.fillPoints([
      { x: TW / 2, y: 0 },
      { x: TW,     y: TH / 2 },
      { x: TW / 2, y: TH },
      { x: 0,      y: TH / 2 },
    ], true);
    g.lineStyle(2, 0x88aaff, 0.9);
    g.strokePoints([
      { x: TW / 2, y: 0 },
      { x: TW,     y: TH / 2 },
      { x: TW / 2, y: TH },
      { x: 0,      y: TH / 2 },
    ], true);
    g.generateTexture('tile_highlight', TW, TH);
    g.destroy();
  }

  // ── Buildings ──────────────────────────────────────────────────────────────

  private generateBuildingTextures(): void {
    this.makeTownHall();
    this.makeFarm();
    this.makeSawmill();
    this.makeQuarry();
    this.makeIronMine();
    this.makeWarehouse();
    this.makeCottage();
    this.makeBarracks();
    this.makeStable();
    this.makeWorkshop();
    this.makeAcademy();
    this.makeForge();
    this.makeEmbassy();
    this.makeMarket();
    this.makeInn();
    this.makeFeastingHall();
    this.makeRallySpot();
    this.makeBeaconTower();
    this.makeReliefStation();
    this.makeWalls();
    this.makeScaffold();
    this.makeNpcCamp();
    this.makePlayerCity();
  }

  // Helper: draw a stone isometric box
  private stoneBox(
    g: Phaser.GameObjects.Graphics,
    ox: number, oy: number,     // origin offset
    bw: number, bh: number,     // base tile width/height
    wallH: number,               // wall height in px
    topColor: number, leftColor: number, rightColor: number
  ): void {
    const hw = bw / 2, qh = bh / 2;
    // right face
    g.fillStyle(rightColor, 1);
    g.fillPoints([
      { x: ox + hw,       y: oy },
      { x: ox + bw,       y: oy + qh },
      { x: ox + bw,       y: oy + qh + wallH },
      { x: ox + hw,       y: oy + wallH },
    ], true);
    // left face
    g.fillStyle(leftColor, 1);
    g.fillPoints([
      { x: ox,            y: oy + qh },
      { x: ox + hw,       y: oy },
      { x: ox + hw,       y: oy + wallH },
      { x: ox,            y: oy + qh + wallH },
    ], true);
    // top face
    g.fillStyle(topColor, 1);
    g.fillPoints([
      { x: ox + hw, y: oy - bh / 2 },
      { x: ox + bw, y: oy },
      { x: ox + hw, y: oy + bh / 2 },
      { x: ox,      y: oy },
    ], true);
    // outlines
    g.lineStyle(1, 0x000000, 0.5);
    g.strokePoints([
      { x: ox + hw, y: oy - bh / 2 },
      { x: ox + bw, y: oy },
      { x: ox + hw, y: oy + bh / 2 },
      { x: ox,      y: oy },
    ], true);
    g.strokePoints([
      { x: ox + hw,       y: oy },
      { x: ox + bw,       y: oy + qh },
      { x: ox + bw,       y: oy + qh + wallH },
      { x: ox + hw,       y: oy + wallH },
    ], true);
    g.strokePoints([
      { x: ox,            y: oy + qh },
      { x: ox + hw,       y: oy },
      { x: ox + hw,       y: oy + wallH },
      { x: ox,            y: oy + qh + wallH },
    ], true);
  }

  // Helper: draw a tower (circular/square turret on top of a wall)
  private drawTower(
    g: Phaser.GameObjects.Graphics,
    cx: number, cy: number, r: number, h: number,
    color: number
  ): void {
    const dark  = Phaser.Display.Color.ValueToColor(color).darken(20).color;
    const light = Phaser.Display.Color.ValueToColor(color).lighten(10).color;
    g.fillStyle(dark, 1);
    g.fillEllipse(cx, cy + h, r * 2, r, 24);
    g.fillStyle(color, 1);
    g.fillRect(cx - r, cy, r * 2, h);
    g.fillStyle(light, 1);
    g.fillEllipse(cx, cy, r * 2, r, 24);
    // Crenellations
    g.fillStyle(dark, 1);
    for (let i = -r + 3; i < r - 3; i += 7) {
      g.fillRect(cx + i, cy - r / 2 - 4, 4, 5);
    }
    g.lineStyle(1, 0x000000, 0.6);
    g.strokeEllipse(cx, cy, r * 2, r, 24);
  }

  // Helper: add stone texture dots to a region
  private stoneTexture(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
    const colors = [0x9a8878, 0x6a5a52, 0xb0a090];
    for (let i = 0; i < 18; i++) {
      const px = x + (i * 37 + 11) % w;
      const py = y + (i * 23 + 7)  % h;
      g.fillStyle(colors[i % 3], 0.4);
      g.fillRect(px, py, 2, 1);
    }
  }

  private makeTownHall(): void {
    const W = 256, H = 200;
    const g = this.make.graphics();

    // Main stone keep - 2×2 tile footprint
    this.stoneBox(g, 0, 80, 256, 64, 60,
      PAL.stoneLight, PAL.stoneMid, PAL.stoneDark);
    this.stoneTexture(g, 10, 95, 100, 50);

    // Center tower
    this.drawTower(g, 128, 45, 28, 55, PAL.stoneMid);

    // Left flanking tower
    this.drawTower(g, 40, 70, 16, 35, PAL.stoneDark);
    // Right flanking tower
    this.drawTower(g, 216, 70, 16, 35, PAL.stoneDark);

    // Flag/banner
    g.fillStyle(PAL.redBanner, 1);
    g.fillRect(128, 12, 3, 24);
    g.fillTriangle(131, 12, 131, 20, 148, 16);

    // Roof gable
    g.fillStyle(PAL.roofBrown, 1);
    g.fillTriangle(80, 68, 128, 38, 176, 68);
    g.lineStyle(1, PAL.roofDark, 1);
    g.lineBetween(80, 68, 128, 38);
    g.lineBetween(128, 38, 176, 68);

    // Window slits
    g.fillStyle(0x1a1a1a, 1);
    g.fillRect(108, 100, 6, 12);
    g.fillRect(142, 100, 6, 12);

    g.generateTexture('building_townhall', W, H);
    g.destroy();
  }

  private makeFarm(): void {
    const W = 128, H = 100;
    const g = this.make.graphics();

    // Ground/field
    g.fillStyle(PAL.fieldTop, 1);
    g.fillPoints([
      { x: 64, y: 0 }, { x: 128, y: 32 }, { x: 64, y: 64 }, { x: 0, y: 32 },
    ], true);

    // Crop rows
    g.lineStyle(1, 0x4a6a20, 0.7);
    for (let i = 0; i < 5; i++) {
      g.lineBetween(20 + i * 18, 20 + i * 8, 60 + i * 18, 28 + i * 8);
    }

    // Small barn
    this.stoneBox(g, 44, 24, 40, 20, 18, PAL.woodBrown,
      Phaser.Display.Color.ValueToColor(PAL.woodBrown).darken(15).color,
      Phaser.Display.Color.ValueToColor(PAL.woodBrown).darken(25).color);

    // Barn roof
    g.fillStyle(PAL.roofBrown, 1);
    g.fillTriangle(44, 24, 64, 10, 84, 24);

    g.generateTexture('building_farm', W, H);
    g.destroy();
  }

  private makeSawmill(): void {
    const W = 128, H = 110;
    const g = this.make.graphics();
    this.stoneBox(g, 24, 40, 80, 40, 35,
      PAL.woodBrown,
      Phaser.Display.Color.ValueToColor(PAL.woodBrown).darken(15).color,
      Phaser.Display.Color.ValueToColor(PAL.woodBrown).darken(28).color);

    // Log pile
    g.fillStyle(0x6a4820, 1);
    for (let i = 0; i < 3; i++) g.fillEllipse(15 + i * 12, 70, 20, 10);

    // Roof
    g.fillStyle(PAL.roofDark, 1);
    g.fillTriangle(24, 40, 64, 16, 104, 40);

    // Saw blade circle
    g.lineStyle(2, PAL.metalGrey, 1);
    g.strokeCircle(90, 48, 12);
    g.lineBetween(78, 48, 102, 48);
    g.lineBetween(90, 36, 90, 60);

    g.generateTexture('building_sawmill', W, H);
    g.destroy();
  }

  private makeQuarry(): void {
    const W = 128, H = 100;
    const g = this.make.graphics();

    // Pit / excavation
    g.fillStyle(PAL.stoneDark, 1);
    g.fillEllipse(64, 55, 90, 40);
    g.fillStyle(PAL.stoneTop, 1);
    g.fillEllipse(64, 48, 80, 28);

    // Rock pile
    g.fillStyle(PAL.stoneLight, 1);
    g.fillEllipse(30, 45, 30, 18);
    g.fillEllipse(90, 42, 25, 16);
    g.fillEllipse(60, 38, 20, 14);

    // Small structure
    this.stoneBox(g, 44, 28, 40, 20, 20,
      PAL.stoneMid, PAL.stoneDark,
      Phaser.Display.Color.ValueToColor(PAL.stoneDark).darken(10).color);

    g.generateTexture('building_quarry', W, H);
    g.destroy();
  }

  private makeIronMine(): void {
    const W = 128, H = 110;
    const g = this.make.graphics();

    // Mine entrance
    this.stoneBox(g, 30, 40, 68, 34, 30,
      PAL.stoneMid, PAL.stoneDark,
      Phaser.Display.Color.ValueToColor(PAL.stoneDark).darken(10).color);

    // Mine shaft arch
    g.fillStyle(0x0a0a0a, 1);
    g.fillEllipse(64, 58, 28, 22);
    g.fillRect(50, 58, 28, 20);

    // Support beams
    g.lineStyle(3, PAL.woodBrown, 1);
    g.lineBetween(50, 46, 50, 68);
    g.lineBetween(78, 46, 78, 68);
    g.lineBetween(50, 46, 78, 46);

    // Ore cart on rails
    g.fillStyle(PAL.metalGrey, 1);
    g.fillRect(78, 62, 22, 12);
    g.fillStyle(0x8b6020, 1);
    g.fillRect(80, 58, 18, 6);

    g.generateTexture('building_ironmine', W, H);
    g.destroy();
  }

  private makeWarehouse(): void {
    const W = 128, H = 110;
    const g = this.make.graphics();
    this.stoneBox(g, 20, 40, 88, 44, 38,
      PAL.stoneMid, PAL.stoneDark,
      Phaser.Display.Color.ValueToColor(PAL.stoneDark).darken(10).color);

    // Big roof
    g.fillStyle(PAL.roofDark, 1);
    g.fillTriangle(20, 40, 64, 10, 108, 40);
    g.lineStyle(1, 0x1a1010, 1);
    g.lineBetween(20, 40, 64, 10);
    g.lineBetween(64, 10, 108, 40);

    // Door
    g.fillStyle(PAL.woodBrown, 1);
    g.fillRect(52, 56, 24, 22);
    g.lineStyle(1, PAL.roofDark, 1);
    g.lineBetween(64, 56, 64, 78);

    g.generateTexture('building_warehouse', W, H);
    g.destroy();
  }

  private makeCottage(): void {
    const W = 128, H = 100;
    const g = this.make.graphics();
    this.stoneBox(g, 24, 40, 80, 40, 30,
      PAL.stoneWall, PAL.stoneMid,
      Phaser.Display.Color.ValueToColor(PAL.stoneMid).darken(15).color);

    // Thatched roof
    g.fillStyle(0x8a6a20, 1);
    g.fillTriangle(24, 40, 64, 12, 104, 40);
    // Roof texture lines
    g.lineStyle(1, 0x6a4a10, 0.6);
    for (let i = 0; i < 5; i++) {
      g.lineBetween(30 + i * 12, 38 - i * 2, 64, 12);
      g.lineBetween(98 - i * 12, 38 - i * 2, 64, 12);
    }

    // Door & window
    g.fillStyle(PAL.roofDark, 1);
    g.fillRect(55, 53, 14, 17);
    g.fillStyle(0x8ab0c0, 1);
    g.fillRect(36, 53, 10, 9);
    g.fillRect(82, 53, 10, 9);
    g.lineStyle(1, PAL.stoneDark, 1);
    g.strokeRect(36, 53, 10, 9);
    g.strokeRect(82, 53, 10, 9);

    g.generateTexture('building_cottage', W, H);
    g.destroy();
  }

  private makeBarracks(): void {
    const W = 256, H = 130;
    const g = this.make.graphics();
    this.stoneBox(g, 0, 50, 256, 64, 45,
      PAL.stoneMid, PAL.stoneDark,
      Phaser.Display.Color.ValueToColor(PAL.stoneDark).darken(12).color);
    this.stoneTexture(g, 10, 70, 120, 40);

    // Battlements along top
    const battleY = 50;
    for (let i = 0; i < 8; i++) {
      const bx = 30 + i * 26;
      g.fillStyle(PAL.stoneLight, 1);
      g.fillRect(bx, battleY - 10, 12, 10);
      g.lineStyle(1, 0x000000, 0.4);
      g.strokeRect(bx, battleY - 10, 12, 10);
    }

    // Banner / flag
    g.fillStyle(PAL.redBanner, 1);
    g.fillRect(122, 20, 3, 28);
    g.fillTriangle(125, 20, 125, 30, 145, 25);

    // Gate arch
    g.fillStyle(0x0a0a0a, 1);
    g.fillEllipse(128, 70, 36, 22);
    g.fillRect(110, 70, 36, 16);

    g.generateTexture('building_barracks', W, H);
    g.destroy();
  }

  private makeStable(): void {
    const W = 256, H = 120;
    const g = this.make.graphics();
    this.stoneBox(g, 0, 44, 256, 64, 38,
      PAL.woodBrown,
      Phaser.Display.Color.ValueToColor(PAL.woodBrown).darken(15).color,
      Phaser.Display.Color.ValueToColor(PAL.woodBrown).darken(28).color);

    // Large sloped roof
    g.fillStyle(PAL.roofDark, 1);
    g.fillPoints([
      { x: 0, y: 44 }, { x: 128, y: 8 }, { x: 256, y: 44 },
      { x: 256, y: 50 }, { x: 128, y: 14 }, { x: 0, y: 50 },
    ], true);

    // Stall divisions (vertical lines on facade)
    g.lineStyle(2, PAL.roofDark, 0.8);
    for (let i = 1; i < 5; i++) g.lineBetween(i * 48, 50, i * 48, 82);

    // Door
    g.fillStyle(PAL.roofDark, 1);
    g.fillRect(108, 60, 40, 22);

    g.generateTexture('building_stable', W, H);
    g.destroy();
  }

  private makeWorkshop(): void {
    const W = 256, H = 120;
    const g = this.make.graphics();
    this.stoneBox(g, 0, 48, 256, 64, 40,
      PAL.stoneMid, PAL.stoneDark,
      Phaser.Display.Color.ValueToColor(PAL.stoneDark).darken(10).color);

    // Chimney
    g.fillStyle(PAL.stoneWall, 1);
    g.fillRect(186, 14, 16, 35);
    g.fillRect(184, 12, 20, 5);
    // Smoke
    g.fillStyle(0x888888, 0.4);
    g.fillCircle(194, 10, 6);
    g.fillCircle(198, 4, 4);

    // Anvil silhouette
    g.fillStyle(PAL.metalGrey, 1);
    g.fillRect(58, 68, 28, 8);
    g.fillRect(62, 62, 20, 8);

    g.generateTexture('building_workshop', W, H);
    g.destroy();
  }

  private makeAcademy(): void {
    const W = 256, H = 200;
    const g = this.make.graphics();
    this.stoneBox(g, 0, 90, 256, 64, 65,
      PAL.stoneLight, PAL.stoneMid, PAL.stoneDark);
    this.stoneTexture(g, 10, 110, 110, 55);

    // Dome / rotunda on top
    g.fillStyle(PAL.stoneMid, 1);
    g.fillEllipse(128, 75, 80, 36);
    g.fillRect(88, 75, 80, 20);
    g.fillStyle(PAL.stoneLight, 1);
    g.fillEllipse(128, 75, 72, 28);

    // Columns
    for (let i = 0; i < 4; i++) {
      const cx = 64 + i * 42;
      g.fillStyle(PAL.stoneLight, 1);
      g.fillRect(cx - 4, 80, 8, 30);
      g.fillRect(cx - 6, 78, 12, 4);
      g.fillRect(cx - 6, 108, 12, 4);
    }

    // Arched windows
    g.fillStyle(0x8ab0d0, 0.7);
    [64, 128, 192].forEach(wx => {
      g.fillEllipse(wx, 116, 16, 14);
      g.fillRect(wx - 8, 116, 16, 12);
    });

    g.generateTexture('building_academy', W, H);
    g.destroy();
  }

  private makeForge(): void {
    const W = 128, H = 110;
    const g = this.make.graphics();
    this.stoneBox(g, 20, 44, 88, 44, 36,
      PAL.stoneDark, Phaser.Display.Color.ValueToColor(PAL.stoneDark).darken(10).color,
      Phaser.Display.Color.ValueToColor(PAL.stoneDark).darken(20).color);

    // Chimney
    g.fillStyle(PAL.stoneWall, 1);
    g.fillRect(80, 14, 14, 32);
    // Fire glow
    g.fillStyle(0xff6600, 0.7);
    g.fillCircle(87, 12, 7);
    g.fillStyle(0xff3300, 0.5);
    g.fillCircle(87, 8, 4);

    g.generateTexture('building_forge', W, H);
    g.destroy();
  }

  private makeEmbassy(): void {
    const W = 256, H = 130;
    const g = this.make.graphics();
    this.stoneBox(g, 0, 50, 256, 64, 44,
      PAL.stoneLight, PAL.stoneMid, PAL.stoneDark);

    // Ornate entrance with flags
    g.fillStyle(PAL.goldAccent, 1);
    g.fillRect(108, 28, 4, 36);
    g.fillRect(144, 28, 4, 36);
    g.fillTriangle(112, 28, 112, 40, 132, 34);
    g.fillTriangle(144, 28, 144, 40, 124, 34);

    // Grand arch
    g.fillStyle(0x0a0a0a, 1);
    g.fillEllipse(128, 68, 40, 24);
    g.fillRect(108, 68, 40, 16);

    g.generateTexture('building_embassy', W, H);
    g.destroy();
  }

  private makeMarket(): void {
    const W = 128, H = 110;
    const g = this.make.graphics();
    this.stoneBox(g, 20, 40, 88, 44, 34,
      PAL.woodBrown,
      Phaser.Display.Color.ValueToColor(PAL.woodBrown).darken(15).color,
      Phaser.Display.Color.ValueToColor(PAL.woodBrown).darken(28).color);

    // Awning / canopy
    g.fillStyle(0xcc6620, 1);
    g.fillPoints([
      { x: 14, y: 50 }, { x: 64, y: 32 }, { x: 114, y: 50 },
    ], true);
    // Stripes on awning
    g.lineStyle(2, 0x882200, 0.5);
    for (let i = 0; i < 5; i++) {
      g.lineBetween(24 + i * 18, 48, 64, 32);
    }

    // Hanging goods
    g.fillStyle(0x8b6020, 1);
    [42, 64, 86].forEach(x => g.fillEllipse(x, 58, 8, 10));

    g.generateTexture('building_market', W, H);
    g.destroy();
  }

  private makeInn(): void {
    const W = 128, H = 110;
    const g = this.make.graphics();
    this.stoneBox(g, 20, 42, 88, 44, 34,
      PAL.stoneWall, PAL.stoneMid,
      Phaser.Display.Color.ValueToColor(PAL.stoneMid).darken(15).color);

    // Roof
    g.fillStyle(PAL.roofBrown, 1);
    g.fillTriangle(20, 42, 64, 14, 108, 42);

    // Sign board
    g.fillStyle(PAL.woodBrown, 1);
    g.fillRect(48, 44, 32, 14);
    g.lineStyle(1, PAL.roofDark, 1);
    g.strokeRect(48, 44, 32, 14);

    // Lantern
    g.fillStyle(0xffcc44, 0.8);
    g.fillCircle(100, 52, 5);

    g.generateTexture('building_inn', W, H);
    g.destroy();
  }

  private makeFeastingHall(): void {
    const W = 256, H = 130;
    const g = this.make.graphics();
    this.stoneBox(g, 0, 50, 256, 64, 44,
      PAL.stoneMid, PAL.stoneDark,
      Phaser.Display.Color.ValueToColor(PAL.stoneDark).darken(12).color);

    // Grand roof with two peaks
    g.fillStyle(PAL.roofBrown, 1);
    g.fillTriangle(0, 50, 70, 14, 140, 50);
    g.fillTriangle(116, 50, 186, 14, 256, 50);

    // Banners
    [60, 196].forEach(bx => {
      g.fillStyle(PAL.redBanner, 1);
      g.fillRect(bx, 18, 3, 30);
      g.fillTriangle(bx + 3, 18, bx + 3, 28, bx + 22, 23);
    });

    // Windows lit up
    g.fillStyle(0xffcc66, 0.6);
    [56, 128, 200].forEach(wx => g.fillRect(wx - 8, 64, 16, 12));

    g.generateTexture('building_feastinghall', W, H);
    g.destroy();
  }

  private makeRallySpot(): void {
    const W = 256, H = 120;
    const g = this.make.graphics();

    // Open courtyard / flagstone ground
    g.fillStyle(PAL.stoneTop, 1);
    g.fillPoints([
      { x: 128, y: 30 }, { x: 256, y: 62 }, { x: 128, y: 94 }, { x: 0, y: 62 },
    ], true);

    // Low perimeter wall
    this.stoneBox(g, 0, 44, 256, 64, 22,
      PAL.stoneMid, PAL.stoneDark,
      Phaser.Display.Color.ValueToColor(PAL.stoneDark).darken(10).color);

    // Central flag pole
    g.fillStyle(PAL.metalGrey, 1);
    g.fillRect(125, 10, 6, 54);
    g.fillStyle(0xcc2020, 1);
    g.fillTriangle(131, 10, 131, 26, 158, 18);

    g.generateTexture('building_rallyspot', W, H);
    g.destroy();
  }

  private makeBeaconTower(): void {
    const W = 128, H = 130;
    const g = this.make.graphics();

    // Tower base
    this.stoneBox(g, 38, 60, 52, 26, 50,
      PAL.stoneLight, PAL.stoneMid, PAL.stoneDark);

    // Tower upper
    this.stoneBox(g, 46, 30, 36, 18, 32,
      PAL.stoneLight, PAL.stoneMid, PAL.stoneDark);

    // Beacon fire
    g.fillStyle(0xff8800, 0.9);
    g.fillCircle(64, 22, 10);
    g.fillStyle(0xff4400, 0.7);
    g.fillCircle(64, 16, 6);
    g.fillStyle(0xffff00, 0.5);
    g.fillCircle(64, 12, 3);

    g.generateTexture('building_beacontower', W, H);
    g.destroy();
  }

  private makeReliefStation(): void {
    const W = 128, H = 110;
    const g = this.make.graphics();
    this.stoneBox(g, 24, 42, 80, 40, 32,
      PAL.stoneMid, PAL.stoneDark,
      Phaser.Display.Color.ValueToColor(PAL.stoneDark).darken(10).color);

    // Cross symbol
    g.fillStyle(0xee2222, 1);
    g.fillRect(54, 50, 20, 6);
    g.fillRect(60, 44, 8, 18);

    // Small roof
    g.fillStyle(PAL.roofBrown, 1);
    g.fillTriangle(24, 42, 64, 18, 104, 42);

    g.generateTexture('building_reliefstation', W, H);
    g.destroy();
  }

  private makeWalls(): void {
    const W = 128, H = 110;
    const g = this.make.graphics();

    // Wall segment
    this.stoneBox(g, 0, 44, 128, 64, 38,
      PAL.stoneLight, PAL.stoneMid, PAL.stoneDark);
    this.stoneTexture(g, 5, 55, 58, 35);

    // Battlements (crenellations) along top
    for (let i = 0; i < 4; i++) {
      g.fillStyle(PAL.stoneLight, 1);
      g.fillRect(10 + i * 28, 34, 14, 12);
      g.lineStyle(1, 0x000000, 0.4);
      g.strokeRect(10 + i * 28, 34, 14, 12);
    }

    // Arrow slit
    g.fillStyle(0x0a0a0a, 1);
    g.fillRect(58, 52, 4, 14);
    g.fillRect(54, 58, 12, 4);

    g.generateTexture('building_walls', W, H);
    g.destroy();
  }

  private makeScaffold(): void {
    const W = 128, H = 100;
    const g = this.make.graphics();

    g.lineStyle(2, 0xc8922a, 0.85);
    // Vertical poles
    for (let i = 0; i < 4; i++) g.lineBetween(20 + i * 28, 15, 20 + i * 28, 90);
    // Horizontal boards
    for (let i = 0; i < 4; i++) g.lineBetween(20, 25 + i * 18, 104, 25 + i * 18);
    // Diagonal braces
    g.lineBetween(20, 25, 48, 43);
    g.lineBetween(48, 25, 20, 43);
    g.lineBetween(76, 25, 104, 43);

    // "Under construction" glow
    g.fillStyle(0xffcc00, 0.15);
    g.fillRect(16, 12, 96, 80);

    g.generateTexture('scaffold', W, H);
    g.destroy();
  }

  private makeNpcCamp(): void {
    const W = 100, H = 80;
    const g = this.make.graphics();

    // Palisade wall (wooden spikes)
    g.fillStyle(0x5a3810, 1);
    for (let i = 0; i < 6; i++) {
      g.fillRect(8 + i * 14, 42, 9, 26);
      g.fillTriangle(8 + i * 14, 42, 12 + i * 14, 28, 17 + i * 14, 42);
    }

    // Tent
    g.fillStyle(0x7a3010, 1);
    g.fillTriangle(22, 50, 50, 14, 78, 50);
    g.fillStyle(0x5a2008, 1);
    g.fillRect(36, 38, 28, 14);

    // Skull flag
    g.fillStyle(0x888888, 1);
    g.fillRect(48, 8, 2, 18);
    g.fillCircle(55, 8, 5);

    g.generateTexture('npc_camp', W, H);
    g.destroy();
  }

  private makePlayerCity(): void {
    const W = 80, H = 70;
    const g = this.make.graphics();

    // City walls
    g.fillStyle(PAL.stoneMid, 1);
    g.fillEllipse(40, 45, 64, 30);
    g.fillStyle(PAL.stoneLight, 1);
    g.fillEllipse(40, 38, 56, 24);
    g.fillStyle(PAL.stoneTop, 1);
    g.fillEllipse(40, 33, 44, 18);

    // Castle keep
    g.fillStyle(PAL.stoneMid, 1);
    g.fillRect(28, 18, 24, 20);
    // Battlements
    for (let i = 0; i < 3; i++) g.fillRect(28 + i * 8, 14, 5, 6);
    // Flag
    g.fillStyle(PAL.goldAccent, 1);
    g.fillRect(39, 5, 2, 12);
    g.fillTriangle(41, 5, 41, 11, 52, 8);

    g.lineStyle(1, 0x000000, 0.5);
    g.strokeEllipse(40, 38, 56, 24);

    g.generateTexture('player_city', W, H);
    g.destroy();
  }

  // ── UI Textures ────────────────────────────────────────────────────────────

  private generateUITextures(): void {
    this.makePanel('panel_dark',   0x1a1208, 0x8a6a20, 220);  // main panel
    this.makePanel('panel_parch',  0x2a1e0e, 0x6a4a10, 200);  // parchment panel
    this.makeButton('btn_bronze',  0x8a6018, 0xc8a030, 0x5a3e10);
    this.makeButton('btn_red',     0x7a1010, 0xcc3030, 0x4a0808);
    this.makeButton('btn_grey',    0x404040, 0x888888, 0x282828);
    this.makePanelBorder();
    // dot
    const g = this.make.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, 4, 4);
    g.generateTexture('dot', 8, 8);
    g.destroy();
  }

  private makePanel(key: string, bgColor: number, borderColor: number, alpha: number): void {
    const W = 4, H = 4; // 1px tiled — actual size set at runtime
    const g = this.make.graphics();
    g.fillStyle(bgColor, alpha / 255);
    g.fillRect(0, 0, W, H);
    g.lineStyle(2, borderColor, 1);
    g.strokeRect(0, 0, W, H);
    g.generateTexture(key, W, H);
    g.destroy();
  }

  private makeButton(key: string, baseColor: number, highlightColor: number, shadowColor: number): void {
    const W = 120, H = 32;
    const g = this.make.graphics();

    // Base
    g.fillStyle(baseColor, 1);
    g.fillRoundedRect(0, 0, W, H, 4);

    // Highlight bevel top
    g.fillStyle(highlightColor, 0.4);
    g.fillRoundedRect(1, 1, W - 2, H / 2, { tl: 4, tr: 4, bl: 0, br: 0 });

    // Shadow bevel bottom
    g.fillStyle(shadowColor, 0.6);
    g.fillRoundedRect(1, H / 2, W - 2, H / 2, { tl: 0, tr: 0, bl: 4, br: 4 });

    // Border
    g.lineStyle(1, highlightColor, 0.8);
    g.strokeRoundedRect(0, 0, W, H, 4);

    g.generateTexture(key, W, H);
    g.destroy();
  }

  private makePanelBorder(): void {
    // Ornate corner decoration (gold filigree look)
    const W = 24, H = 24;
    const g = this.make.graphics();
    g.lineStyle(2, PAL.goldAccent, 1);
    g.lineBetween(0, 0, W, 0);
    g.lineBetween(0, 0, 0, H);
    g.lineBetween(2, 2, 10, 2);
    g.lineBetween(2, 2, 2, 10);
    g.fillStyle(PAL.goldAccent, 1);
    g.fillCircle(5, 5, 2);
    g.generateTexture('panel_corner', W, H);
    g.destroy();
  }
}
