import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'BootScene' }); }

  preload(): void {
    // PNG building assets (StonesFreeWenrexa gem set + barracks)
    this.load.image('building_barracks',  'assets/barracks.png');
    this.load.image('building_townhall',  'assets/townhall.png');
    this.load.image('building_farm',      'assets/farm.png');
    this.load.image('building_sawmill',   'assets/sawmill.png');
    this.load.image('building_quarry',    'assets/quarry.png');
    this.load.image('building_ironmine',  'assets/ironmine.png');
    this.load.image('building_warehouse', 'assets/warehouse.png');
    this.load.image('building_cottage',   'assets/cottage.png');
    this.load.image('building_academy',   'assets/academy.png');
    this.load.image('building_stable',    'assets/stable.png');
    this.load.image('building_workshop',  'assets/workshop.png');
    this.genTiles();
    this.genBuildings();
    this.genUI();
  }

  create(): void {
    this.scene.start('CityScene');
  }

  // ── Tiles ──────────────────────────────────────────────────────────────────

  private genTiles(): void {
    // Bright vivid green grass — matching the original Evony palette
    this.isoTile('tile_grass', 0x5aaa28, 0x448820, true);
    // Slightly darker inner grass
    this.isoTile('tile_grass2', 0x4e9a22, 0x3d7a18, true);
    // Stone/dirt build slot
    this.isoTile('tile_slot', 0xa09070, 0x806a50, false);
    // Road/path tile
    this.isoTile('tile_road', 0x8a7a60, 0x6a5a40, false);
    // Water
    this.isoTile('tile_water', 0x2a6a9c, 0x1a5080, false);
    // World map tiles
    this.isoTile('tile_wmap', 0x3a7820, 0x2a5a18, false);
    this.isoTile('tile_forest', 0x254d18, 0x1a3a10, false);
    this.isoTile('tile_mountain', 0x707060, 0x505048, false);
    // Hover highlight
    this.isoHighlight();
  }

  private isoTile(key: string, top: number, _side: number, noise: boolean): void {
    const S = 96;
    const g = this.make.graphics();

    // Base fill
    g.fillStyle(top, 1);
    g.fillRect(0, 0, S, S);

    // Subtle noise
    if (noise) {
      const hi = Phaser.Display.Color.ValueToColor(top).lighten(7).color;
      const lo = Phaser.Display.Color.ValueToColor(top).darken(7).color;
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
          g.fillStyle((row + col) % 2 === 0 ? hi : lo, 0.38);
          g.fillRect(8 + col * 22, 8 + row * 22, 5, 4);
        }
      }
    }

    // Grid line
    g.lineStyle(1, 0x000000, 0.18);
    g.strokeRect(0.5, 0.5, S - 1, S - 1);

    g.generateTexture(key, S, S);
    g.destroy();
  }

  private isoHighlight(): void {
    const S = 96;
    const g = this.make.graphics();
    g.fillStyle(0xffee88, 0.3);
    g.fillRect(0, 0, S, S);
    g.lineStyle(2, 0xffee44, 0.9);
    g.strokeRect(1, 1, S - 2, S - 2);
    g.generateTexture('tile_highlight', S, S);
    g.destroy();
  }

  // ── Buildings ──────────────────────────────────────────────────────────────

  private genBuildings(): void {
    // townhall, farm, sawmill, quarry, ironmine, warehouse, cottage,
    // barracks, stable, workshop, academy → loaded as PNGs in preload()
    this.makeForge();
    this.makeEmbassy();
    this.makeMarket();
    this.makeInn();
    this.makeFeastingHall();
    this.makeRallySpot();
    this.makeBeaconTower();
    this.makeReliefStation();
    this.makeWalls();
    this.makeTree();
    this.makeScaffold();
    this.makeNpcCamp();
    this.makePlayerCity();
  }

  // Core helper: draw a 3-faced isometric box
  private isoBox(
    g: Phaser.GameObjects.Graphics,
    x: number, y: number,
    tw: number, th: number, wallH: number,
    topC: number, leftC: number, rightC: number
  ): void {
    const hw = tw / 2, qh = th / 2;
    // right face
    g.fillStyle(rightC, 1);
    g.fillPoints([
      { x: x+hw, y: y },       { x: x+tw, y: y+qh },
      { x: x+tw, y: y+qh+wallH }, { x: x+hw, y: y+wallH },
    ], true);
    // left face
    g.fillStyle(leftC, 1);
    g.fillPoints([
      { x: x,    y: y+qh },    { x: x+hw, y: y },
      { x: x+hw, y: y+wallH }, { x: x,    y: y+qh+wallH },
    ], true);
    // top face (diamond)
    g.fillStyle(topC, 1);
    g.fillPoints([
      { x: x+hw, y: y-qh }, { x: x+tw, y: y },
      { x: x+hw, y: y+qh }, { x: x,    y: y },
    ], true);
    // outlines
    g.lineStyle(1, 0x000000, 0.45);
    g.strokePoints([{ x:x+hw,y:y-qh},{x:x+tw,y:y},{x:x+hw,y:y+qh},{x:x,y:y}], true);
    g.strokePoints([{ x:x+hw,y:y},{x:x+tw,y:y+qh},{x:x+tw,y:y+qh+wallH},{x:x+hw,y:y+wallH}], true);
    g.strokePoints([{ x:x,y:y+qh},{x:x+hw,y:y},{x:x+hw,y:y+wallH},{x:x,y:y+qh+wallH}], true);
  }

  private darken(c: number, amt: number) {
    return Phaser.Display.Color.ValueToColor(c).darken(amt).color;
  }
  private lighten(c: number, amt: number) {
    return Phaser.Display.Color.ValueToColor(c).lighten(amt).color;
  }

  // Crenellation row across top of wall
  private crenels(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, c: number): void {
    const step = Math.floor(w / 5);
    for (let i = 0; i < 5; i++) {
      if (i % 2 === 0) {
        g.fillStyle(c, 1);
        g.fillRect(x + i * step, y - 10, step - 2, 10);
        g.lineStyle(1, 0x000000, 0.4);
        g.strokeRect(x + i * step, y - 10, step - 2, 10);
      }
    }
  }

  private makeTownHall(): void {
    const W = 256, H = 200;
    const g = this.make.graphics();
    const STONE = 0x8a7a68, DARK = 0x5a4a3a, MID = 0x6a5a4a;

    // Main keep body
    this.isoBox(g, 20, 90, 216, 54, 68, STONE, MID, DARK);

    // Stone texture dots
    for (let i = 0; i < 20; i++) {
      g.fillStyle(i%2===0 ? this.lighten(STONE,10) : this.darken(STONE,10), 0.35);
      g.fillRect(25+(i*19)%180, 105+(i*11)%55, 4, 2);
    }

    // Central tower
    this.isoBox(g, 90, 38, 76, 30, 90, this.lighten(STONE,6), MID, DARK);

    // Tower battlements
    this.crenels(g, 100, 38, 56, STONE);

    // Left turret
    this.isoBox(g, 18, 70, 40, 20, 48, MID, DARK, this.darken(DARK,10));
    this.crenels(g, 22, 70, 30, MID);

    // Right turret
    this.isoBox(g, 198, 70, 40, 20, 48, MID, DARK, this.darken(DARK,10));
    this.crenels(g, 202, 70, 30, MID);

    // Gate arch
    g.fillStyle(0x100a06, 1);
    g.fillEllipse(128, 126, 32, 20);
    g.fillRect(112, 126, 32, 20);
    g.lineStyle(1, DARK, 0.8);
    g.strokeEllipse(128, 126, 32, 20);

    // Portcullis lines
    g.lineStyle(1, 0x3a3020, 0.6);
    for (let i = 0; i < 4; i++) g.lineBetween(114+i*5, 120, 114+i*5, 146);
    g.lineBetween(112, 128, 144, 128);
    g.lineBetween(112, 136, 144, 136);

    // Flag on tower
    g.fillStyle(0x880010, 1);
    g.fillRect(127, 6, 3, 26);
    g.fillTriangle(130, 6, 130, 18, 150, 12);

    // Roof gable
    g.fillStyle(0x5a3820, 1);
    g.fillTriangle(90, 55, 128, 28, 166, 55);
    g.lineStyle(1, 0x3a2210, 1);
    g.lineBetween(90, 55, 128, 28);
    g.lineBetween(128, 28, 166, 55);

    // Arrow slits
    g.fillStyle(0x100a06, 1);
    [[90, 100],[146, 100],[90, 118],[146, 118]].forEach(([sx,sy]) => {
      g.fillRect(sx, sy, 5, 12);
      g.fillRect(sx-2, sy+5, 9, 4);
    });

    g.generateTexture('building_townhall', W, H);
    g.destroy();
  }

  private makeFarm(): void {
    const W = 128, H = 96;
    const g = this.make.graphics();
    const SOIL = 0x7a5a30, BARN = 0x8a6830;

    // Soil field
    g.fillStyle(SOIL, 1);
    g.fillPoints([{x:64,y:0},{x:128,y:32},{x:64,y:64},{x:0,y:32}], true);
    // Crop rows
    g.lineStyle(2, 0x5a8a20, 0.7);
    for (let i = 0; i < 4; i++) {
      g.lineBetween(16+i*24, 16+i*8, 56+i*24, 24+i*8);
      g.lineBetween(20+i*24, 22+i*8, 60+i*24, 30+i*8);
    }
    // Small barn
    this.isoBox(g, 44, 22, 40, 20, 22, BARN, this.darken(BARN,12), this.darken(BARN,22));
    // Roof
    g.fillStyle(0x5a3010, 1);
    g.fillTriangle(44, 22, 64, 6, 84, 22);

    g.generateTexture('building_farm', W, H);
    g.destroy();
  }

  private makeSawmill(): void {
    const W = 128, H = 108;
    const g = this.make.graphics();
    const WOOD = 0x7a5428;
    this.isoBox(g, 20, 44, 88, 44, 38, WOOD, this.darken(WOOD,12), this.darken(WOOD,24));
    // Roof
    g.fillStyle(0x4a2810, 1);
    g.fillTriangle(20, 44, 64, 18, 108, 44);
    // Log pile
    g.fillStyle(0x6a4020, 1);
    for (let i = 0; i < 3; i++) g.fillEllipse(12+i*12, 72, 18, 9);
    // Saw blade
    g.lineStyle(2, 0x888888, 1);
    g.strokeCircle(94, 52, 11);
    g.lineBetween(83,52,105,52);
    g.lineBetween(94,41,94,63);

    g.generateTexture('building_sawmill', W, H);
    g.destroy();
  }

  private makeQuarry(): void {
    const W = 128, H = 100;
    const g = this.make.graphics();
    g.fillStyle(0x5a5248, 1);
    g.fillEllipse(64, 58, 90, 38);
    g.fillStyle(0x807870, 1);
    g.fillEllipse(64, 50, 72, 26);
    g.fillStyle(0xa09888, 1);
    g.fillEllipse(32,44,28,16); g.fillEllipse(88,42,24,14); g.fillEllipse(62,38,18,12);
    this.isoBox(g, 44, 26, 40, 20, 22, 0x7a7068, 0x5a5050, 0x484040);

    g.generateTexture('building_quarry', W, H);
    g.destroy();
  }

  private makeIronMine(): void {
    const W = 128, H = 108;
    const g = this.make.graphics();
    const S = 0x6a6058;
    this.isoBox(g, 26, 40, 76, 38, 34, S, this.darken(S,12), this.darken(S,22));
    // Mine entrance
    g.fillStyle(0x080608, 1);
    g.fillEllipse(64, 60, 28, 20);
    g.fillRect(50, 60, 28, 14);
    // Beams
    g.lineStyle(3, 0x6a4820, 1);
    g.lineBetween(50,48,50,68); g.lineBetween(78,48,78,68); g.lineBetween(50,48,78,48);
    // Ore cart
    g.fillStyle(0x606878, 1);
    g.fillRect(80,60,20,12);
    g.fillStyle(0x7a5820, 1);
    g.fillRect(82,56,16,6);

    g.generateTexture('building_ironmine', W, H);
    g.destroy();
  }

  private makeWarehouse(): void {
    const W = 128, H = 112;
    const g = this.make.graphics();
    const S = 0x7a7060;
    this.isoBox(g, 16, 44, 96, 48, 42, S, this.darken(S,10), this.darken(S,22));
    g.fillStyle(0x3a2810, 1);
    g.fillTriangle(16, 44, 64, 12, 112, 44);
    g.lineStyle(1, 0x200e08, 1);
    g.lineBetween(16,44,64,12); g.lineBetween(64,12,112,44);
    // Door
    g.fillStyle(0x5a3810, 1);
    g.fillRect(50, 58, 28, 24);
    g.lineStyle(1, 0x2a1808, 1);
    g.lineBetween(64, 58, 64, 82);

    g.generateTexture('building_warehouse', W, H);
    g.destroy();
  }

  private makeCottage(): void {
    const W = 128, H = 100;
    const g = this.make.graphics();
    const S = 0x9a8a78;
    this.isoBox(g, 22, 42, 84, 42, 32, S, this.darken(S,12), this.darken(S,22));
    // Thatched roof
    g.fillStyle(0x9a7828, 1);
    g.fillTriangle(22, 42, 64, 14, 106, 42);
    g.lineStyle(1, 0x6a5018, 0.55);
    for (let i = 0; i < 5; i++) {
      g.lineBetween(28+i*12, 40-i*2, 64, 14);
      g.lineBetween(100-i*12, 40-i*2, 64, 14);
    }
    // Door
    g.fillStyle(0x3a2208, 1);
    g.fillRect(54, 54, 16, 18);
    // Windows
    g.fillStyle(0x9abcd0, 0.7);
    g.fillRect(32, 54, 11, 9); g.fillRect(85, 54, 11, 9);
    g.lineStyle(1, 0x5a5040, 0.7);
    g.strokeRect(32,54,11,9); g.strokeRect(85,54,11,9);
    // Chimney
    g.fillStyle(this.darken(S,8), 1);
    g.fillRect(88, 18, 10, 24);
    g.fillStyle(0x606060, 0.4);
    g.fillCircle(93, 16, 5);

    g.generateTexture('building_cottage', W, H);
    g.destroy();
  }

  private makeStable(): void {
    const W = 256, H = 118;
    const g = this.make.graphics();
    const WOOD = 0x7a5a30;
    this.isoBox(g, 0, 46, 256, 64, 40, WOOD, this.darken(WOOD,12), this.darken(WOOD,24));
    // Roof
    g.fillStyle(0x3a2010, 1);
    g.fillPoints([{x:0,y:46},{x:128,y:10},{x:256,y:46},{x:256,y:52},{x:128,y:16},{x:0,y:52}], true);
    // Stall dividers
    g.lineStyle(2, this.darken(WOOD,20), 0.7);
    for (let i = 1; i < 5; i++) g.lineBetween(i*48, 52, i*48, 86);
    // Door
    g.fillStyle(0x3a2010, 1); g.fillRect(108, 62, 40, 24);

    g.generateTexture('building_stable', W, H);
    g.destroy();
  }

  private makeWorkshop(): void {
    const W = 256, H = 118;
    const g = this.make.graphics();
    const S = 0x686058;
    this.isoBox(g, 0, 48, 256, 64, 42, S, this.darken(S,10), this.darken(S,20));
    // Chimney
    g.fillStyle(0x787068, 1);
    g.fillRect(190, 14, 18, 36);
    g.fillRect(188, 12, 22, 5);
    // Smoke puffs
    g.fillStyle(0x909090, 0.4);
    g.fillCircle(199, 10, 7); g.fillCircle(203, 4, 5);
    // Anvil
    g.fillStyle(0x707878, 1);
    g.fillRect(60, 68, 28, 8); g.fillRect(64, 62, 20, 8);
    g.fillStyle(0x888888, 0.6);
    g.fillEllipse(74, 62, 22, 6);

    g.generateTexture('building_workshop', W, H);
    g.destroy();
  }

  private makeAcademy(): void {
    const W = 256, H = 190;
    const g = this.make.graphics();
    const S = 0x8a8270;
    this.isoBox(g, 0, 92, 256, 64, 66, S, this.darken(S,10), this.darken(S,22));
    // Columns
    for (let i = 0; i < 4; i++) {
      const cx = 52 + i*50;
      g.fillStyle(this.lighten(S,12), 1);
      g.fillRect(cx-5, 82, 10, 38);
      g.fillRect(cx-7, 80, 14, 5);
      g.fillRect(cx-7, 118, 14, 5);
    }
    // Dome
    g.fillStyle(this.darken(S,6), 1);
    g.fillEllipse(128, 76, 84, 38);
    g.fillRect(86, 76, 84, 20);
    g.fillStyle(this.lighten(S,8), 1);
    g.fillEllipse(128, 76, 74, 30);
    // Dome highlight
    g.fillStyle(0xffffff, 0.08);
    g.fillEllipse(114, 68, 30, 14);
    // Windows
    g.fillStyle(0x9ab8d0, 0.65);
    [58,128,198].forEach(wx => {
      g.fillEllipse(wx, 112, 14, 12);
      g.fillRect(wx-7, 112, 14, 10);
    });

    g.generateTexture('building_academy', W, H);
    g.destroy();
  }

  private makeForge(): void {
    const W = 128, H = 108;
    const g = this.make.graphics();
    const S = 0x5a5248;
    this.isoBox(g, 20, 44, 88, 44, 36, S, this.darken(S,10), this.darken(S,20));
    g.fillStyle(0x787068, 1);
    g.fillRect(80, 14, 14, 32);
    // Fire glow
    g.fillStyle(0xff7700, 0.75); g.fillCircle(87, 12, 7);
    g.fillStyle(0xff3300, 0.55); g.fillCircle(87, 8, 5);
    g.fillStyle(0xffcc00, 0.3);  g.fillCircle(87, 5, 3);

    g.generateTexture('building_forge', W, H);
    g.destroy();
  }

  private makeEmbassy(): void {
    const W = 256, H = 128;
    const g = this.make.graphics();
    const S = 0x8a8070;
    this.isoBox(g, 0, 50, 256, 64, 44, S, this.darken(S,10), this.darken(S,20));
    // Flags
    [[108,28],[144,28]].forEach(([bx,by]) => {
      g.fillStyle(0xb89020, 1);
      g.fillRect(bx, by, 4, 36);
      g.fillTriangle(bx+4, by, bx+4, by+14, bx+24, by+7);
    });
    // Grand arch
    g.fillStyle(0x080608, 1);
    g.fillEllipse(128, 70, 42, 26); g.fillRect(107,70,42,18);

    g.generateTexture('building_embassy', W, H);
    g.destroy();
  }

  private makeMarket(): void {
    const W = 128, H = 108;
    const g = this.make.graphics();
    const WOOD = 0x7a5428;
    this.isoBox(g, 18, 40, 92, 46, 36, WOOD, this.darken(WOOD,12), this.darken(WOOD,24));
    // Striped awning
    g.fillStyle(0xcc6820, 1);
    g.fillPoints([{x:12,y:50},{x:64,y:30},{x:116,y:50}], true);
    g.lineStyle(2, 0x883800, 0.5);
    for (let i = 0; i < 5; i++) g.lineBetween(20+i*18,48,64,30);
    // Goods
    g.fillStyle(0x8a6020, 1);
    [40,64,88].forEach(x => g.fillEllipse(x, 57, 8, 10));

    g.generateTexture('building_market', W, H);
    g.destroy();
  }

  private makeInn(): void {
    const W = 128, H = 108;
    const g = this.make.graphics();
    const S = 0x9a8a78;
    this.isoBox(g, 20, 42, 88, 44, 34, S, this.darken(S,12), this.darken(S,22));
    g.fillStyle(0x7a5828, 1);
    g.fillTriangle(20, 42, 64, 14, 108, 42);
    // Sign
    g.fillStyle(0x6a4820, 1); g.fillRect(46, 44, 36, 16);
    g.lineStyle(1, 0x3a2808, 1); g.strokeRect(46,44,36,16);
    // Lantern
    g.fillStyle(0xffcc44, 0.85); g.fillCircle(100, 52, 5);
    g.fillStyle(0xffaa00, 0.4);  g.fillCircle(100, 52, 8);

    g.generateTexture('building_inn', W, H);
    g.destroy();
  }

  private makeFeastingHall(): void {
    const W = 256, H = 130;
    const g = this.make.graphics();
    const S = 0x7a7060;
    this.isoBox(g, 0, 52, 256, 64, 46, S, this.darken(S,10), this.darken(S,20));
    g.fillStyle(0x6a4820, 1);
    g.fillTriangle(0,52,68,14,136,52);
    g.fillTriangle(120,52,188,14,256,52);
    [58,196].forEach(bx => {
      g.fillStyle(0x880010, 1);
      g.fillRect(bx, 18, 3, 32);
      g.fillTriangle(bx+3,18,bx+3,30,bx+22,24);
    });
    // Lit windows
    g.fillStyle(0xffcc66, 0.55);
    [54,128,202].forEach(wx => g.fillRect(wx-9,66,18,13));

    g.generateTexture('building_feastinghall', W, H);
    g.destroy();
  }

  private makeRallySpot(): void {
    const W = 256, H = 118;
    const g = this.make.graphics();
    const S = 0x6a6a58;
    this.isoBox(g, 0, 46, 256, 64, 24, S, this.darken(S,10), this.darken(S,20));
    // Flagstone courtyard top
    g.fillStyle(0x7a7868, 1);
    g.fillPoints([{x:128,y:28},{x:256,y:60},{x:128,y:92},{x:0,y:60}], true);
    // Grid lines on courtyard
    g.lineStyle(1, 0x5a5848, 0.5);
    for (let i = 1; i < 4; i++) {
      g.lineBetween(128-i*30, 60+i*16, 128+i*30, 60-i*16);
      g.lineBetween(128-i*30, 60-i*16, 128+i*30, 60+i*16);
    }
    // Flag pole
    g.fillStyle(0x888888, 1); g.fillRect(124, 8, 6, 56);
    g.fillStyle(0xcc2020, 1); g.fillTriangle(130,8,130,24,158,16);

    g.generateTexture('building_rallyspot', W, H);
    g.destroy();
  }

  private makeBeaconTower(): void {
    const W = 128, H = 128;
    const g = this.make.graphics();
    const S = 0x8a7a68;
    this.isoBox(g, 40, 62, 48, 24, 52, this.lighten(S,6), S, this.darken(S,14));
    this.isoBox(g, 48, 32, 32, 16, 32, this.lighten(S,10), S, this.darken(S,12));
    this.crenels(g, 52, 32, 24, this.lighten(S,8));
    // Fire
    g.fillStyle(0xff8800, 0.9); g.fillCircle(64, 22, 10);
    g.fillStyle(0xff4400, 0.7); g.fillCircle(64, 16, 6);
    g.fillStyle(0xffff00, 0.45); g.fillCircle(64, 11, 3);
    // Glow
    g.fillStyle(0xff6600, 0.15); g.fillCircle(64, 18, 18);

    g.generateTexture('building_beacontower', W, H);
    g.destroy();
  }

  private makeReliefStation(): void {
    const W = 128, H = 108;
    const g = this.make.graphics();
    const S = 0x8a7a68;
    this.isoBox(g, 22, 42, 84, 42, 34, S, this.darken(S,10), this.darken(S,20));
    g.fillStyle(0x6a4820, 1);
    g.fillTriangle(22, 42, 64, 16, 106, 42);
    // Red cross
    g.fillStyle(0xdd2020, 1);
    g.fillRect(54, 50, 20, 6); g.fillRect(60, 44, 8, 18);

    g.generateTexture('building_reliefstation', W, H);
    g.destroy();
  }

  private makeWalls(): void {
    const W = 128, H = 108;
    const g = this.make.graphics();
    const S = 0x8a8070;
    this.isoBox(g, 0, 44, 128, 64, 40, this.lighten(S,6), S, this.darken(S,16));
    // Stone texture
    for (let i = 0; i < 10; i++) {
      g.fillStyle(i%2===0?this.lighten(S,8):this.darken(S,8),0.3);
      g.fillRect(5+(i*18)%100,55+(i*9)%32,8,4);
    }
    this.crenels(g, 4, 44, 120, this.lighten(S,10));
    // Arrow slit
    g.fillStyle(0x080606, 1);
    g.fillRect(58, 54, 4, 14); g.fillRect(54, 60, 12, 4);

    g.generateTexture('building_walls', W, H);
    g.destroy();
  }

  private makeTree(): void {
    const W = 80, H = 100;
    const g = this.make.graphics();
    // Trunk
    g.fillStyle(0x5a3a18, 1);
    g.fillRect(34, 70, 12, 26);
    // Foliage layers
    g.fillStyle(0x2a6a14, 1);
    g.fillTriangle(8, 72, 40, 14, 72, 72);
    g.fillStyle(0x38861c, 1);
    g.fillTriangle(14, 60, 40, 18, 66, 60);
    g.fillStyle(0x44a022, 1);
    g.fillTriangle(20, 50, 40, 22, 60, 50);
    // Highlight
    g.fillStyle(0x5ac82e, 0.4);
    g.fillTriangle(28, 42, 40, 26, 48, 42);

    g.generateTexture('tree', W, H);
    g.destroy();
  }

  private makeScaffold(): void {
    const W = 128, H = 100;
    const g = this.make.graphics();
    g.lineStyle(2, 0xc8922a, 0.88);
    for (let i = 0; i < 4; i++) g.lineBetween(18+i*28, 12, 18+i*28, 88);
    for (let i = 0; i < 4; i++) g.lineBetween(18, 22+i*18, 102, 22+i*18);
    g.lineBetween(18,22,46,40); g.lineBetween(46,22,18,40);
    g.lineBetween(74,22,102,40);
    g.fillStyle(0xffcc00, 0.12); g.fillRect(14, 10, 90, 80);

    g.generateTexture('scaffold', W, H);
    g.destroy();
  }

  private makeNpcCamp(): void {
    const W = 100, H = 80;
    const g = this.make.graphics();
    // Palisade stakes
    g.fillStyle(0x5a3810, 1);
    for (let i = 0; i < 6; i++) {
      g.fillRect(8+i*14, 42, 9, 26);
      g.fillTriangle(8+i*14,42,12+i*14,28,17+i*14,42);
    }
    // Tent
    g.fillStyle(0x7a3010, 1); g.fillTriangle(22,52,50,14,78,52);
    g.fillStyle(0x5a2008, 1); g.fillRect(36,40,28,14);
    // Skull
    g.fillStyle(0xcccccc, 1); g.fillCircle(55,8,5);
    g.fillStyle(0x000000, 1);
    g.fillRect(52,6,2,3); g.fillRect(56,6,2,3);

    g.generateTexture('npc_camp', W, H);
    g.destroy();
  }

  private makePlayerCity(): void {
    const W = 80, H = 70;
    const g = this.make.graphics();
    g.fillStyle(0x5a5048, 1); g.fillEllipse(40, 46, 64, 28);
    g.fillStyle(0x7a6a58, 1); g.fillEllipse(40, 38, 54, 22);
    g.fillStyle(0x8a7a68, 1); g.fillEllipse(40, 32, 40, 16);
    g.fillStyle(0x7a7060, 1); g.fillRect(28, 18, 24, 18);
    for (let i = 0; i < 3; i++) g.fillRect(28+i*8, 14, 5, 6);
    g.fillStyle(0xc8a030, 1);
    g.fillRect(39, 5, 2, 12);
    g.fillTriangle(41,5,41,11,52,8);
    g.lineStyle(1, 0x000000, 0.4); g.strokeEllipse(40,38,54,22);

    g.generateTexture('player_city', W, H);
    g.destroy();
  }

  // ── UI Textures ────────────────────────────────────────────────────────────

  private genUI(): void {
    const g = this.make.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, 4, 4);
    g.generateTexture('dot', 8, 8);
    g.destroy();
  }
}
