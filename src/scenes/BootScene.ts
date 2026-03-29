import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'BootScene' }); }

  preload(): void {
    // Generate placeholder textures via canvas
    this.generateTileTextures();
    this.generateBuildingTextures();
    this.generateUITextures();
  }

  create(): void {
    this.scene.start('CityScene');
  }

  private generateTileTextures(): void {
    // Grass tile
    this.makeIsoTile('tile_grass',  0x4a7c3f, 0x3a6c2f);
    this.makeIsoTile('tile_field',  0x8b6914, 0x7a5804);
    this.makeIsoTile('tile_road',   0x7a6858, 0x6a5848);
    this.makeIsoTile('tile_water',  0x1e6a9c, 0x0e5a8c);
    this.makeIsoTile('tile_forest', 0x2d5a1f, 0x1d4a0f);
    this.makeIsoTile('tile_mountain', 0x8a7a6a, 0x7a6a5a);
    this.makeIsoTile('tile_highlight', 0x6699ff, 0x4477dd, 0.5);
  }

  private generateBuildingTextures(): void {
    const buildings: [string, number, number, number][] = [
      ['townhall',     2, 2, 0xa0522d],
      ['farm',         1, 1, 0x7ec850],
      ['sawmill',      1, 1, 0x8b4513],
      ['quarry',       1, 1, 0x808080],
      ['ironmine',     1, 1, 0x708090],
      ['warehouse',    1, 1, 0xc8a96e],
      ['cottage',      1, 1, 0xdeb887],
      ['barracks',     2, 1, 0x8b0000],
      ['stable',       2, 1, 0xd2691e],
      ['workshop',     2, 1, 0x4a4a6a],
      ['academy',      2, 2, 0x4169e1],
      ['forge',        1, 1, 0xff4500],
      ['embassy',      2, 1, 0xdaa520],
      ['market',       1, 1, 0xff8c00],
      ['inn',          1, 1, 0x9370db],
      ['feastinghall', 2, 1, 0xb22222],
      ['rallyspot',    2, 1, 0x2f4f4f],
      ['beacontower',  1, 1, 0xffd700],
      ['reliefstation',1, 1, 0x20b2aa],
      ['walls',        1, 1, 0x696969],
    ];

    for (const [name, tw, th, color] of buildings) {
      this.makeBuilding(`building_${name}`, tw, th, color);
    }

    // Scaffold (under construction)
    this.makeScaffold('scaffold');
    // NPC camp
    this.makeNpcCamp('npc_camp');
    // Player city flag
    this.makePlayerCity('player_city');
  }

  private generateUITextures(): void {
    // Simple 1px white dot for particles, etc.
    const g = this.make.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, 4, 4);
    g.generateTexture('dot', 8, 8);
    g.destroy();
  }

  private makeIsoTile(key: string, topColor: number, sideColor: number, alpha = 1): void {
    const TW = 128, TH = 64;
    const g = this.make.graphics();

    // Diamond top face
    g.fillStyle(topColor, alpha);
    g.fillPoints([
      { x: TW / 2, y: 0 },
      { x: TW,     y: TH / 2 },
      { x: TW / 2, y: TH },
      { x: 0,      y: TH / 2 },
    ], true);

    g.lineStyle(1, 0x000000, 0.25 * alpha);
    g.strokePoints([
      { x: TW / 2, y: 0 },
      { x: TW,     y: TH / 2 },
      { x: TW / 2, y: TH },
      { x: 0,      y: TH / 2 },
    ], true);

    g.generateTexture(key, TW, TH);
    g.destroy();
  }

  private makeBuilding(key: string, tw: number, th: number, color: number): void {
    const TW = 128, TH = 64;
    const W = TW * tw, H = TH * th + 60;

    const g = this.make.graphics();
    const baseY = H - 60;

    // Bottom-face (south wall)
    g.fillStyle(Phaser.Display.Color.ValueToColor(color).darken(25).color, 1);
    g.fillPoints([
      { x: TW * tw / 2,    y: baseY },
      { x: TW * tw,         y: baseY - TH * th / 2 },
      { x: TW * tw,         y: baseY - TH * th / 2 + 50 },
      { x: TW * tw / 2,    y: baseY + 50 },
    ], true);

    // Left wall (west)
    g.fillStyle(Phaser.Display.Color.ValueToColor(color).darken(15).color, 1);
    g.fillPoints([
      { x: 0,               y: baseY - TH * th / 2 },
      { x: TW * tw / 2,    y: baseY },
      { x: TW * tw / 2,    y: baseY + 50 },
      { x: 0,               y: baseY - TH * th / 2 + 50 },
    ], true);

    // Top face (roof)
    g.fillStyle(color, 1);
    g.fillPoints([
      { x: TW * tw / 2, y: baseY - 50 },
      { x: TW * tw,      y: baseY - TH * th / 2 - 50 },
      { x: TW * tw / 2, y: baseY - TH * th - 50 + TH * th / 2 + 20 },
      { x: 0,            y: baseY - TH * th / 2 - 50 },
    ], true);

    // Outline
    g.lineStyle(1, 0x000000, 0.5);
    g.strokePoints([
      { x: TW * tw / 2, y: baseY - 50 },
      { x: TW * tw,      y: baseY - TH * th / 2 - 50 },
      { x: TW * tw / 2, y: baseY - TH * th - 50 + TH * th / 2 + 20 },
      { x: 0,            y: baseY - TH * th / 2 - 50 },
    ], true);

    g.generateTexture(key, W, H);
    g.destroy();
  }

  private makeScaffold(key: string): void {
    const g = this.make.graphics();
    g.lineStyle(2, 0xf0a000, 0.9);
    // Simple scaffolding cross-hatch
    for (let i = 0; i < 4; i++) {
      g.lineBetween(i * 20, 0, i * 20, 80);
      g.lineBetween(0, i * 20, 80, i * 20);
    }
    g.generateTexture(key, 80, 80);
    g.destroy();
  }

  private makeNpcCamp(key: string): void {
    const g = this.make.graphics();
    // Red tent
    g.fillStyle(0xcc2222, 1);
    g.fillTriangle(32, 0, 64, 48, 0, 48);
    g.fillStyle(0x881111, 1);
    g.fillRect(20, 38, 24, 20);
    g.generateTexture(key, 64, 60);
    g.destroy();
  }

  private makePlayerCity(key: string): void {
    const g = this.make.graphics();
    g.fillStyle(0x2255aa, 1);
    g.fillCircle(24, 24, 20);
    g.lineStyle(3, 0xffd700, 1);
    g.strokeCircle(24, 24, 20);
    g.fillStyle(0xffd700, 1);
    g.fillTriangle(24, 4, 32, 24, 16, 24);
    g.generateTexture(key, 48, 48);
    g.destroy();
  }
}
