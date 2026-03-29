import Phaser from 'phaser';
import { tileToScreen, isoDepth, TILE_W, TILE_H } from '../iso/IsoMap';
import type { GameState, BuildingInstance, BuildingType, TroopType } from '../data/types';
import { BUILDINGS } from '../data/buildings';
import { TROOPS } from '../data/troops';
import { tickResources, computeProduction } from '../systems/ResourceSystem';
import { checkConstructions, getBuildingInProgress, placeBuilding } from '../systems/BuildingSystem';
import { loadGame, defaultState, saveGame } from '../systems/SaveSystem';
import { BuildingPanel } from '../ui/BuildingPanel';

// ── Grid configs ──────────────────────────────────────────────────────────────
const TOWN_GRID = 6;
const CITY_GRID = 10;
const SAVE_INTERVAL = 30_000;

// Resource-field buildings live in CITY view; everything else is TOWN
const CITY_TYPES = new Set<string>(['farm', 'sawmill', 'quarry', 'ironmine']);

// PNG-asset buildings (scaled to tile)
const PNG_BUILDINGS = new Set<string>([
  'barracks','townhall','farm','sawmill','quarry','ironmine',
  'warehouse','cottage','academy','stable','workshop',
]);

// Town build-slot positions (6×6 grid)
const TOWN_SLOTS: [number, number][] = [
  [0,0],[2,0],[4,0],[0,2],[4,2],
  [0,4],[2,4],[4,4],[5,1],[5,3],[1,5],[3,5],
];

// ── Palette ──────────────────────────────────────────────────────────────────
const PANEL_BG   = 0x1a1408;
const BORDER     = 0x8a6a20;
const GOLD       = 0xc8a030;
const TEXT_GOLD  = '#c8a030';
const TEXT_PARCH = '#eeddb8';
const TEXT_GREY  = '#807060';
const TEXT_GREEN = '#78bb50';
const TEXT_RED   = '#cc4444';

const RIGHT_W = 220;
const TOP_H   = 32;
const BOT_H   = 54;

// ── Scene ────────────────────────────────────────────────────────────────────
export class CityScene extends Phaser.Scene {
  private state!: GameState;
  private viewMode: 'town' | 'city' = 'town';

  // World objects (cleared on view switch)
  private worldObjs: Phaser.GameObjects.GameObject[] = [];
  private buildingSprites = new Map<string, Phaser.GameObjects.Image>();
  private buildingLabels  = new Map<string, Phaser.GameObjects.Text>();
  private constructSprites= new Map<string, Phaser.GameObjects.Image>();
  private constructTimers = new Map<string, Phaser.GameObjects.Text>();

  private buildingPanel!: BuildingPanel;
  private lastSave = 0;

  // Overlay objects (build menu / train panel — mutually exclusive)
  private overlayObjs: Phaser.GameObjects.GameObject[] = [];

  // Dev panel objects
  private devObjs: Phaser.GameObjects.GameObject[] = [];
  private devOpen = false;

  // Tab UI refs for active-state refresh
  private tabBgs:    Phaser.GameObjects.Graphics[] = [];
  private tabTxts:   Phaser.GameObjects.Text[]     = [];
  private tabCoords: { tx: number; tw: number }[]  = [];

  // Right-panel live-update refs
  private resTexts:  Record<string, Phaser.GameObjects.Text> = {};
  private rateTexts: Record<string, Phaser.GameObjects.Text> = {};
  private queueText!: Phaser.GameObjects.Text;

  constructor() { super({ key: 'CityScene' }); }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  create(): void {
    const saved = loadGame();
    this.state = saved ?? defaultState();
    this.cameras.main.setBackgroundColor(0x2a4a14);
    this.buildingPanel = new BuildingPanel(this);
    this.buildWorld();
    this.centerCamera();
    this.buildTopBar();
    this.buildRightPanel();
    this.buildBottomBar();
    this.lastSave = Date.now();
  }

  update(_t: number, delta: number): void {
    tickResources(this.state, delta / 1000);
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

  // ── Grid helpers ──────────────────────────────────────────────────────────

  private get grid(): number { return this.viewMode === 'city' ? CITY_GRID : TOWN_GRID; }

  private inCurrentZone(b: BuildingInstance): boolean {
    return CITY_TYPES.has(b.type) === (this.viewMode === 'city');
  }

  // ── View switching ────────────────────────────────────────────────────────

  private buildWorld(): void {
    this.worldObjs.forEach(o => o.destroy());
    this.worldObjs = [];
    this.buildingSprites.clear();
    this.buildingLabels.clear();
    this.constructSprites.clear();
    this.constructTimers.clear();
    this.clearOverlay();
    this.buildTiles();
    this.buildSlotMarkers();
    this.renderAllBuildings();
  }

  private switchView(mode: 'town' | 'city'): void {
    if (this.viewMode === mode) return;
    this.viewMode = mode;
    this.buildingPanel.hide();
    this.buildWorld();
    this.centerCamera();
    this.refreshTabStyles();
  }

  private refreshTabStyles(): void {
    this.tabBgs.forEach((bg, i) => {
      const coords = this.tabCoords[i];
      if (!coords) return;
      const active = (i === 0 && this.viewMode === 'town') || (i === 1 && this.viewMode === 'city');
      bg.clear();
      bg.fillStyle(active ? 0x7a5a10 : 0x2a2010, 1);
      bg.fillRect(coords.tx, 2, coords.tw - 2, TOP_H - 4);
      if (active) { bg.fillStyle(GOLD, 0.2); bg.fillRect(coords.tx+1,3,coords.tw-4,(TOP_H-6)/2); }
      bg.lineStyle(1, active ? GOLD : BORDER, 0.7);
      bg.strokeRect(coords.tx, 2, coords.tw - 2, TOP_H - 4);
    });
    this.tabTxts.forEach((t, i) => {
      const active = (i === 0 && this.viewMode === 'town') || (i === 1 && this.viewMode === 'city');
      t.setColor(active ? TEXT_GOLD : TEXT_GREY);
    });
  }

  // ── Tiles ─────────────────────────────────────────────────────────────────

  private buildTiles(): void {
    const G = this.grid;

    const border = this.wAdd(this.add.graphics().setDepth(-1));
    border.lineStyle(3, this.viewMode === 'city' ? 0x2a5a2a : 0x2a5a10, 1);
    border.strokeRect(-3, -3, G*TILE_W+6, G*TILE_H+6);
    border.lineStyle(1, this.viewMode === 'city' ? 0x4a9a4a : 0x4a8a20, 0.5);
    border.strokeRect(-1, -1, G*TILE_W+2, G*TILE_H+2);

    // Zone label
    const zoneLabel = this.viewMode === 'city' ? '🌾 Resource Fields' : '🏰 Town';
    const zlbl = this.wAdd(this.add.text(-2, -18, zoneLabel, {
      fontSize: '11px', fontStyle: 'bold',
      color: this.viewMode === 'city' ? '#88cc88' : '#c8a030',
      fontFamily: 'Georgia, serif',
      backgroundColor: '#00000088', padding: { x: 4, y: 2 },
    }).setDepth(10).setOrigin(0, 1));

    const slots = this.currentSlots();
    for (let y = 0; y < G; y++) {
      for (let x = 0; x < G; x++) {
        const { x: sx, y: sy } = tileToScreen(x, y);
        const key = (x+y) % 2 === 0 ? 'tile_grass' : 'tile_grass2';
        const t = this.wAdd(
          this.add.image(sx+TILE_W/2, sy+TILE_H/2, key).setDepth(isoDepth(x,y)).setInteractive()
        ) as Phaser.GameObjects.Image;

        const inSlot = slots.some(([tx,ty]) => tx===x && ty===y);
        t.on('pointerdown', () => {
          const occupied = this.state.buildings.some(b => b.tileX===x && b.tileY===y && this.inCurrentZone(b));
          if (inSlot && !occupied) {
            this.openBuildMenu(x, y);
          } else {
            this.buildingPanel.hide();
            this.clearOverlay();
          }
        });
      }
    }
  }

  private currentSlots(): [number,number][] {
    if (this.viewMode === 'town') return TOWN_SLOTS;
    const G = CITY_GRID;
    const slots: [number,number][] = [];
    for (let y = 0; y < G; y++)
      for (let x = 0; x < G; x++)
        slots.push([x, y]);
    return slots;
  }

  // ── Slot markers ──────────────────────────────────────────────────────────

  private buildSlotMarkers(): void {
    for (const [tx,ty] of this.currentSlots()) {
      const occupied = this.state.buildings.some(b => b.tileX===tx && b.tileY===ty && this.inCurrentZone(b));
      if (!occupied) {
        const { x: sx, y: sy } = tileToScreen(tx, ty);
        this.wAdd(
          this.add.image(sx+TILE_W/2, sy+TILE_H/2, 'tile_slot')
            .setDepth(isoDepth(tx,ty)+0.1)
            .setAlpha(this.viewMode === 'city' ? 0.18 : 0.40)
        );
      }
    }
  }

  // ── Buildings ─────────────────────────────────────────────────────────────

  private renderAllBuildings(): void {
    for (const b of this.state.buildings) {
      if (this.inCurrentZone(b)) this.spawnBuilding(b);
    }
  }

  private spawnBuilding(b: BuildingInstance): void {
    const { x: sx, y: sy } = tileToScreen(b.tileX, b.tileY);
    this.buildingSprites.get(b.id)?.destroy();
    this.buildingLabels.get(b.id)?.destroy();

    const cx = sx + TILE_W/2, cy = sy + TILE_H/2;

    const sprite = this.wAdd(
      this.add.image(cx, cy, `building_${b.type}`)
        .setOrigin(0.5, 0.5)
        .setDepth(isoDepth(b.tileX, b.tileY) + 0.5)
        .setInteractive({ useHandCursor: true })
    ) as Phaser.GameObjects.Image;

    if (PNG_BUILDINGS.has(b.type)) {
      const fill = b.type === 'townhall' ? 0.76 : 0.60;
      sprite.setScale((TILE_W * fill) / sprite.width);
    }

    // Name label in lower portion of tile
    const def = BUILDINGS[b.type as keyof typeof BUILDINGS];
    const lbl = this.wAdd(
      this.add.text(cx, sy + TILE_H - 4,
        `${def?.label ?? b.type}${b.level > 1 ? ` ${b.level}` : ''}`, {
        fontSize: '8px', color: '#eeddb8',
        backgroundColor: '#000000aa', padding: { x: 3, y: 1 },
        fontFamily: 'Arial, sans-serif',
      }).setOrigin(0.5, 1).setDepth(isoDepth(b.tileX, b.tileY) + 0.7)
    ) as Phaser.GameObjects.Text;

    this.buildingSprites.set(b.id, sprite);
    this.buildingLabels.set(b.id, lbl);

    sprite.on('pointerover', () => sprite.setTint(0xddddff));
    sprite.on('pointerout',  () => sprite.clearTint());
    sprite.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      this.clearOverlay();
      if (b.type === 'barracks' || b.type === 'stable' || b.type === 'workshop') {
        this.openTrainPanel(b);
      } else {
        this.buildingPanel.show(b, this.state, () => {
          this.showConstructOverlay(b);
          this.updateResourcePanel();
        });
      }
      ptr.event.stopPropagation();
    });

    if (b.constructingUntil && b.constructingUntil > Date.now()) {
      this.showConstructOverlay(b);
    }
  }

  private showConstructOverlay(b: BuildingInstance): void {
    this.constructSprites.get(b.id)?.destroy();
    this.constructTimers.get(b.id)?.destroy();
    const { x: sx, y: sy } = tileToScreen(b.tileX, b.tileY);
    const cx = sx+TILE_W/2, cy = sy+TILE_H/2;
    const sc = this.wAdd(
      this.add.image(cx, cy, 'scaffold')
        .setOrigin(0.5,0.5).setDepth(isoDepth(b.tileX,b.tileY)+0.9)
        .setAlpha(0.75).setDisplaySize(TILE_W*0.75,TILE_H*0.75)
    ) as Phaser.GameObjects.Image;
    const txt = this.wAdd(
      this.add.text(cx, sy-4,'',{fontSize:'10px',color:'#ffcc00',
        backgroundColor:'#00000099',padding:{x:3,y:2}})
        .setOrigin(0.5,1).setDepth(isoDepth(b.tileX,b.tileY)+1)
    ) as Phaser.GameObjects.Text;
    this.constructSprites.set(b.id, sc);
    this.constructTimers.set(b.id, txt);
  }

  private refreshBuilding(b: BuildingInstance): void {
    this.constructSprites.get(b.id)?.destroy(); this.constructSprites.delete(b.id);
    this.constructTimers.get(b.id)?.destroy();  this.constructTimers.delete(b.id);
    if (this.inCurrentZone(b)) this.spawnBuilding(b);
  }

  private updateConstructTimers(): void {
    const now = Date.now();
    for (const b of this.state.buildings) {
      const txt = this.constructTimers.get(b.id);
      if (txt && b.constructingUntil && b.constructingUntil > now)
        txt.setText(fmtTime(Math.ceil((b.constructingUntil-now)/1000)));
    }
    const inProg = getBuildingInProgress(this.state);
    if (this.queueText) {
      if (inProg?.constructingUntil) {
        const sec = Math.ceil((inProg.constructingUntil-Date.now())/1000);
        this.queueText.setText(`⚒ ${BUILDINGS[inProg.type].label} Lv${inProg.level+1}\n  ${fmtTime(sec)}`);
      } else {
        this.queueText.setText('No construction');
      }
    }
  }

  // ── Camera ────────────────────────────────────────────────────────────────

  private centerCamera(): void {
    const cam = this.cameras.main;
    const W = this.scale.width, H = this.scale.height;
    const G = this.grid;
    const gW = G*TILE_W, gH = G*TILE_H;
    const zoom = Math.min(1.0, Math.min((W-RIGHT_W)/gW, (H-TOP_H-BOT_H)/gH)*0.9);
    cam.setZoom(zoom);
    cam.setScroll(gW/2-(W-RIGHT_W)/2/zoom, gH/2-(H+TOP_H-BOT_H)/2/zoom);
  }

  // ── Overlay helpers ───────────────────────────────────────────────────────

  private clearOverlay(): void {
    this.overlayObjs.forEach(o => o.destroy());
    this.overlayObjs = [];
  }

  /** Track a world-layer object (destroyed on view switch) */
  private wAdd<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.worldObjs.push(obj);
    return obj;
  }

  /** Track an overlay object (destroyed on clearOverlay) */
  private oAdd<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.overlayObjs.push(obj);
    return obj;
  }

  // ── Build Menu ────────────────────────────────────────────────────────────

  private openBuildMenu(tileX: number, tileY: number): void {
    this.clearOverlay();
    this.buildingPanel.hide();

    const W = this.scale.width;
    const PW = 290;
    const px = Math.max(4, Math.floor((W-RIGHT_W-PW)/2));
    const py = TOP_H + 6;

    // Available types for this zone
    const townAvail: BuildingType[] = [
      'cottage','warehouse','academy','stable','workshop',
      'forge','embassy','market','inn','rallyspot',
    ].filter(t => !this.state.buildings.some(b => b.type===t)) as BuildingType[];

    const cityAvail: BuildingType[] = ['farm','sawmill','quarry','ironmine'];
    const avail = this.viewMode === 'city' ? cityAvail : townAvail;

    const rowH = 52;
    const PH = Math.min(avail.length*rowH+44, 340);

    const bg = this.oAdd(this.add.graphics().setScrollFactor(0).setDepth(2100));
    bg.fillStyle(PANEL_BG,0.97); bg.fillRoundedRect(px,py,PW,PH,6);
    bg.lineStyle(2,BORDER,1);    bg.strokeRoundedRect(px,py,PW,PH,6);
    bg.lineStyle(1,GOLD,0.35);   bg.strokeRoundedRect(px+2,py+2,PW-4,PH-4,5);

    this.oAdd(this.add.text(px+PW/2,py+13,'CONSTRUCT BUILDING',{
      fontSize:'11px',fontStyle:'bold',color:TEXT_GOLD,fontFamily:'Georgia, serif',
    }).setOrigin(0.5,0.5).setScrollFactor(0).setDepth(2101));

    const close = this.oAdd(this.add.text(px+PW-10,py+7,'✕',{
      fontSize:'13px',color:TEXT_GREY,fontFamily:'Arial',
    }).setOrigin(1,0).setScrollFactor(0).setDepth(2101).setInteractive({useHandCursor:true}));
    close.on('pointerdown',()=>this.clearOverlay());
    close.on('pointerover',()=>close.setColor(TEXT_PARCH));
    close.on('pointerout', ()=>close.setColor(TEXT_GREY));

    const div = this.oAdd(this.add.graphics().setScrollFactor(0).setDepth(2101));
    div.lineStyle(1,BORDER,0.5); div.lineBetween(px+8,py+26,px+PW-8,py+26);

    if (avail.length === 0) {
      this.oAdd(this.add.text(px+PW/2,py+PH/2,'All available buildings\nalready placed!',{
        fontSize:'11px',color:TEXT_GREY,fontFamily:'Georgia, serif',align:'center',
      }).setOrigin(0.5,0.5).setScrollFactor(0).setDepth(2101));
      return;
    }

    avail.slice(0, Math.floor((PH-44)/rowH)).forEach((type,i)=>{
      const def = BUILDINGS[type];
      if (!def) return;
      const ry = py+30+i*rowH;
      const cost = def.levels[0].cost;
      const r = this.state.resources;
      const canAff = (r.food>=(cost.food??0)) && (r.lumber>=(cost.lumber??0)) &&
                     (r.stone>=(cost.stone??0)) && (r.iron>=(cost.iron??0)) && (r.gold>=(cost.gold??0));

      const rowBg = this.oAdd(this.add.graphics().setScrollFactor(0).setDepth(2101));
      rowBg.fillStyle(i%2===0?0x0e0c08:0x181208,1); rowBg.fillRect(px+4,ry,PW-8,rowH-2);

      this.oAdd(this.add.text(px+10,ry+7,def.label,{
        fontSize:'11px',fontStyle:'bold',color:TEXT_PARCH,fontFamily:'Georgia, serif',
      }).setScrollFactor(0).setDepth(2102));

      const costParts: string[] = [];
      if (cost.food)   costParts.push(`${fmt(cost.food)}🌾`);
      if (cost.lumber) costParts.push(`${fmt(cost.lumber)}🪵`);
      if (cost.stone)  costParts.push(`${fmt(cost.stone)}🪨`);
      if (cost.iron)   costParts.push(`${fmt(cost.iron)}⚙`);
      if (cost.gold)   costParts.push(`${fmt(cost.gold)}💰`);
      this.oAdd(this.add.text(px+10,ry+24,costParts.join(' ')||'Free',{
        fontSize:'9px',color:canAff?TEXT_GREEN:TEXT_RED,fontFamily:'Arial',
      }).setScrollFactor(0).setDepth(2102));

      const bx=px+PW-68, by=ry+11, bw=60, bh=28;
      const btnG = this.oAdd(this.add.graphics().setScrollFactor(0).setDepth(2102));
      const draw = (hover: boolean) => {
        btnG.clear();
        btnG.fillStyle(canAff?(hover?0x4a8a1a:0x336010):(hover?0x3a3820:0x282820),1);
        btnG.fillRoundedRect(bx,by,bw,bh,3);
        btnG.lineStyle(1,canAff?0x68aa30:0x484838,1);
        btnG.strokeRoundedRect(bx,by,bw,bh,3);
      };
      draw(false);

      this.oAdd(this.add.text(bx+bw/2,by+bh/2,'Build',{
        fontSize:'10px',fontStyle:'bold',
        color:canAff?'#bbff77':TEXT_GREY,fontFamily:'Georgia, serif',
      }).setOrigin(0.5,0.5).setScrollFactor(0).setDepth(2103));

      if (canAff) {
        const zone = this.oAdd(
          this.add.zone(bx,by,bw,bh).setOrigin(0,0).setScrollFactor(0).setDepth(2104)
            .setInteractive({useHandCursor:true})
        ) as Phaser.GameObjects.Zone;
        zone.on('pointerover', ()=>draw(true));
        zone.on('pointerout',  ()=>draw(false));
        zone.on('pointerdown', ()=>{
          const err = placeBuilding(this.state,type,tileX,tileY);
          if (!err) {
            this.clearOverlay();
            this.buildWorld();
            saveGame(this.state);
            this.updateResourcePanel();
          }
        });
      }
    });
  }

  // ── Train Panel (barracks / stable / workshop) ────────────────────────────

  private openTrainPanel(b: BuildingInstance): void {
    this.clearOverlay();

    const troopsByBuilding: Record<string, TroopType[]> = {
      barracks: ['warrior','scout','pikeman','swordsman','archer'],
      stable:   ['cavalry','cataphract','transporter'],
      workshop: ['catapult','batteringram','ballista'],
    };
    const trainable = troopsByBuilding[b.type] ?? [];

    const W = this.scale.width;
    const PW = 310;
    const rowH = 54;
    const PH = Math.min(trainable.length*rowH+46, 380);
    const px = Math.max(4, Math.floor((W-RIGHT_W-PW)/2));
    const py = TOP_H + 6;

    const bg = this.oAdd(this.add.graphics().setScrollFactor(0).setDepth(2100));
    bg.fillStyle(PANEL_BG,0.97); bg.fillRoundedRect(px,py,PW,PH,6);
    bg.lineStyle(2,0x4a3a8a,1);  bg.strokeRoundedRect(px,py,PW,PH,6);

    this.oAdd(this.add.text(px+PW/2,py+13,`TRAIN TROOPS — ${BUILDINGS[b.type].label.toUpperCase()}`,{
      fontSize:'10px',fontStyle:'bold',color:'#aa88ff',fontFamily:'Georgia, serif',
    }).setOrigin(0.5,0.5).setScrollFactor(0).setDepth(2101));

    const close = this.oAdd(this.add.text(px+PW-10,py+7,'✕',{
      fontSize:'13px',color:TEXT_GREY,fontFamily:'Arial',
    }).setOrigin(1,0).setScrollFactor(0).setDepth(2101).setInteractive({useHandCursor:true}));
    close.on('pointerdown',()=>this.clearOverlay());
    close.on('pointerover',()=>close.setColor(TEXT_PARCH));
    close.on('pointerout', ()=>close.setColor(TEXT_GREY));

    const div = this.oAdd(this.add.graphics().setScrollFactor(0).setDepth(2101));
    div.lineStyle(1,0x4a3a8a,0.6); div.lineBetween(px+8,py+26,px+PW-8,py+26);

    trainable.forEach((troopType,i)=>{
      const troop = TROOPS[troopType];
      if (!troop) return;
      const ry = py+30+i*rowH;
      const cost = troop.cost;

      const rowBg = this.oAdd(this.add.graphics().setScrollFactor(0).setDepth(2101));
      rowBg.fillStyle(i%2===0?0x0a0a12:0x10101a,1); rowBg.fillRect(px+4,ry,PW-8,rowH-2);

      this.oAdd(this.add.text(px+10,ry+7,troop.label,{
        fontSize:'11px',fontStyle:'bold',color:TEXT_PARCH,fontFamily:'Georgia, serif',
      }).setScrollFactor(0).setDepth(2102));

      const costParts: string[] = [];
      if (cost.food)   costParts.push(`${cost.food}🌾`);
      if (cost.gold)   costParts.push(`${cost.gold}💰`);
      if (cost.iron)   costParts.push(`${cost.iron}⚙`);
      if (cost.lumber) costParts.push(`${cost.lumber}🪵`);
      this.oAdd(this.add.text(px+10,ry+24,costParts.join(' ')||'Free',{
        fontSize:'9px',color:'#8888cc',fontFamily:'Arial',
      }).setScrollFactor(0).setDepth(2102));

      const currentAmt = (this.state.troops as Record<string,number>)[troopType] ?? 0;
      const ownedTxt = this.oAdd(this.add.text(px+10,ry+36,`Owned: ${currentAmt}`,{
        fontSize:'8px',color:TEXT_GREY,fontFamily:'Arial',
      }).setScrollFactor(0).setDepth(2102));

      ([10,100] as const).forEach((qty,qi)=>{
        const bx=px+PW-130+qi*66, by=ry+12, bw=60, bh=28;
        const totalFood   = (cost.food??0)*qty;
        const totalGold   = (cost.gold??0)*qty;
        const totalLumber = (cost.lumber??0)*qty;
        const totalStone  = (cost.stone??0)*qty;
        const totalIron   = (cost.iron??0)*qty;
        const r = this.state.resources;
        const canAff = r.food>=totalFood && r.gold>=totalGold &&
                       r.lumber>=totalLumber && r.stone>=totalStone && r.iron>=totalIron;

        const bg2 = this.oAdd(this.add.graphics().setScrollFactor(0).setDepth(2102));
        const drawBtn = (h: boolean) => {
          bg2.clear();
          bg2.fillStyle(canAff?(h?0x2a2a5a:0x1a1a4a):(h?0x282828:0x1e1e1e),1);
          bg2.fillRoundedRect(bx,by,bw,bh,3);
          bg2.lineStyle(1,canAff?0x6666cc:0x383838,1);
          bg2.strokeRoundedRect(bx,by,bw,bh,3);
        };
        drawBtn(false);

        this.oAdd(this.add.text(bx+bw/2,by+bh/2,`+${qty}`,{
          fontSize:'11px',fontStyle:'bold',color:canAff?'#aaaaff':TEXT_GREY,fontFamily:'Georgia, serif',
        }).setOrigin(0.5,0.5).setScrollFactor(0).setDepth(2103));

        if (canAff) {
          const z = this.oAdd(
            this.add.zone(bx,by,bw,bh).setOrigin(0,0).setScrollFactor(0).setDepth(2104)
              .setInteractive({useHandCursor:true})
          ) as Phaser.GameObjects.Zone;
          z.on('pointerover',()=>drawBtn(true));
          z.on('pointerout', ()=>drawBtn(false));
          z.on('pointerdown',()=>{
            const tr = this.state.troops as Record<string,number>;
            this.state.resources.food   -= totalFood;
            this.state.resources.gold   -= totalGold;
            this.state.resources.lumber -= totalLumber;
            this.state.resources.stone  -= totalStone;
            this.state.resources.iron   -= totalIron;
            tr[troopType] = (tr[troopType]??0)+qty;
            ownedTxt.setText(`Owned: ${tr[troopType]}`);
            saveGame(this.state);
            this.updateResourcePanel();
          });
        }
      });
    });
  }

  // ── Dev Panel ─────────────────────────────────────────────────────────────

  private toggleDevPanel(): void {
    if (this.devOpen) {
      this.devObjs.forEach(o=>o.destroy()); this.devObjs=[]; this.devOpen=false;
    } else {
      this.buildDevPanel(); this.devOpen=true;
    }
  }

  private buildDevPanel(): void {
    const W = this.scale.width, H = this.scale.height;
    const PW=210, PH=230, px=8, py=H-BOT_H-PH-8;

    const bg = this.add.graphics().setScrollFactor(0).setDepth(3000);
    bg.fillStyle(0x080608,0.97); bg.fillRoundedRect(px,py,PW,PH,6);
    bg.lineStyle(2,0xaa3030,1);  bg.strokeRoundedRect(px,py,PW,PH,6);
    bg.lineStyle(1,0x882020,0.5); bg.strokeRoundedRect(px+2,py+2,PW-4,PH-4,5);
    this.devObjs.push(bg);

    this.devObjs.push(this.add.text(px+PW/2,py+14,'⚙  DEV TOOLS',{
      fontSize:'11px',fontStyle:'bold',color:'#ff6666',fontFamily:'Georgia, serif',
    }).setOrigin(0.5,0.5).setScrollFactor(0).setDepth(3001));

    const btns: {label:string; cb:()=>void}[] = [
      { label:'+2 000 All Resources', cb:()=>{
          const r=this.state.resources;
          r.food+=2000; r.lumber+=2000; r.stone+=2000; r.iron+=2000; r.gold+=2000;
          this.updateResourcePanel();
      }},
      { label:'Max Resources (1M)',  cb:()=>{
          const r=this.state.resources;
          r.food=r.lumber=r.stone=r.iron=r.gold=1_000_000;
          this.updateResourcePanel();
      }},
      { label:'Instant Build',       cb:()=>{
          for(const b of this.state.buildings)
            if(b.constructingUntil) b.constructingUntil=Date.now()-1;
      }},
      { label:'+500 Warriors+Scouts', cb:()=>{
          const t=this.state.troops as Record<string,number>;
          t.warrior=(t.warrior??0)+500; t.scout=(t.scout??0)+500;
          t.archer=(t.archer??0)+200;
      }},
    ];

    btns.forEach((btn,i)=>{
      const bx=px+8, by=py+28+i*46, bw=PW-16, bh=36;
      const g=this.add.graphics().setScrollFactor(0).setDepth(3001);
      const draw=(h:boolean)=>{
        g.clear();
        g.fillStyle(h?0x4a1010:0x280808,1); g.fillRoundedRect(bx,by,bw,bh,4);
        g.lineStyle(1,h?0xcc3030:0x882020,1); g.strokeRoundedRect(bx,by,bw,bh,4);
      };
      draw(false);
      this.devObjs.push(g);

      const t=this.add.text(bx+bw/2,by+bh/2,btn.label,{
        fontSize:'10px',color:'#ff9999',fontFamily:'Arial',
      }).setOrigin(0.5,0.5).setScrollFactor(0).setDepth(3002);
      this.devObjs.push(t);

      const z=this.add.zone(bx,by,bw,bh).setOrigin(0,0).setScrollFactor(0).setDepth(3003)
        .setInteractive({useHandCursor:true})
        .on('pointerover',()=>draw(true)).on('pointerout',()=>draw(false))
        .on('pointerdown',()=>{ btn.cb(); saveGame(this.state); });
      this.devObjs.push(z);
    });
  }

  // ── Top Bar ───────────────────────────────────────────────────────────────

  private buildTopBar(): void {
    const W = this.scale.width;
    const g = this.add.graphics().setScrollFactor(0).setDepth(800);
    g.fillStyle(PANEL_BG,0.98); g.fillRect(0,0,W-RIGHT_W,TOP_H);
    g.lineStyle(2,BORDER,1);    g.lineBetween(0,TOP_H,W-RIGHT_W,TOP_H);
    g.lineStyle(1,GOLD,0.3);    g.lineBetween(0,TOP_H-1,W-RIGHT_W,TOP_H-1);

    const navTabs=[{label:'TOWN',key:'town'},{label:'CITY',key:'city'},{label:'MAP',key:'map'}];
    const tabW=80;
    const startX=(W-RIGHT_W)/2-(tabW*navTabs.length)/2;

    navTabs.forEach((tab,i)=>{
      const tx=startX+i*tabW;
      this.tabCoords.push({tx, tw:tabW});
      const active=tab.key==='town';
      const tabBg=this.add.graphics().setScrollFactor(0).setDepth(801);
      tabBg.fillStyle(active?0x7a5a10:0x2a2010,1); tabBg.fillRect(tx,2,tabW-2,TOP_H-4);
      if(active){tabBg.fillStyle(GOLD,0.2); tabBg.fillRect(tx+1,3,tabW-4,(TOP_H-6)/2);}
      tabBg.lineStyle(1,active?GOLD:BORDER,0.7); tabBg.strokeRect(tx,2,tabW-2,TOP_H-4);
      this.tabBgs.push(tabBg);

      const lbl=this.add.text(tx+tabW/2-1,TOP_H/2,tab.label,{
        fontSize:'11px',fontStyle:'bold',color:active?TEXT_GOLD:TEXT_GREY,fontFamily:'Georgia, serif',
      }).setOrigin(0.5,0.5).setScrollFactor(0).setDepth(802);
      this.tabTxts.push(lbl);

      const zone=this.add.zone(tx,2,tabW-2,TOP_H-4).setOrigin(0,0).setScrollFactor(0).setDepth(803)
        .setInteractive({useHandCursor:true});
      if(tab.key==='map'){
        zone.on('pointerdown',()=>this.scene.start('WorldMapScene',{state:this.state}));
        zone.on('pointerover',()=>lbl.setColor(TEXT_PARCH));
        zone.on('pointerout', ()=>lbl.setColor(i===0&&this.viewMode==='town'||i===1&&this.viewMode==='city'?TEXT_GOLD:TEXT_GREY));
      } else {
        zone.on('pointerdown',()=>this.switchView(tab.key as 'town'|'city'));
      }
    });
  }

  // ── Right Panel ───────────────────────────────────────────────────────────

  private buildRightPanel(): void {
    const W=this.scale.width, H=this.scale.height;
    const px=W-RIGHT_W;
    const g=this.add.graphics().setScrollFactor(0).setDepth(800);
    g.fillStyle(PANEL_BG,0.99); g.fillRect(px,0,RIGHT_W,H);
    g.lineStyle(2,BORDER,1);    g.lineBetween(px,0,px,H);
    g.lineStyle(1,GOLD,0.25);   g.lineBetween(px+2,0,px+2,H);

    // Portrait
    g.fillStyle(0x0e0c08,1); g.fillRect(px+4,4,RIGHT_W-8,72);
    g.lineStyle(1,BORDER,0.7); g.strokeRect(px+4,4,RIGHT_W-8,72);
    g.fillStyle(0x3a3028,1); g.fillRect(px+8,8,56,64);
    g.lineStyle(1,GOLD,0.5);   g.strokeRect(px+8,8,56,64);
    g.fillStyle(0x706050,1);   g.fillCircle(px+36,30,16); g.fillRect(px+16,46,40,24);
    this.add.text(px+72,14,'Lord',{fontSize:'10px',color:TEXT_GREY,fontFamily:'Georgia, serif'}).setScrollFactor(0).setDepth(801);
    this.add.text(px+72,28,'NCsaszar',{fontSize:'13px',fontStyle:'bold',color:TEXT_GOLD,fontFamily:'Georgia, serif'}).setScrollFactor(0).setDepth(801);
    this.add.text(px+72,46,'🏰 City (100,100)',{fontSize:'9px',color:TEXT_GREY,fontFamily:'Arial'}).setScrollFactor(0).setDepth(801);
    g.lineStyle(1,BORDER,0.5); g.lineBetween(px+6,80,px+RIGHT_W-6,80);

    // Resources section
    this.add.text(px+RIGHT_W/2,88,'RESOURCES',{fontSize:'10px',fontStyle:'bold',color:TEXT_GREY,fontFamily:'Georgia, serif'}).setOrigin(0.5,0).setScrollFactor(0).setDepth(801);
    const RES=[
      {key:'food',icon:'🌾',label:'Food'},{key:'lumber',icon:'🪵',label:'Lumber'},
      {key:'stone',icon:'🪨',label:'Stone'},{key:'iron',icon:'⚙',label:'Iron'},
      {key:'gold',icon:'💰',label:'Gold'},
    ];
    RES.forEach((res,i)=>{
      const ry=104+i*44;
      g.fillStyle(i%2===0?0x181208:0x100e06,1); g.fillRect(px+4,ry,RIGHT_W-8,40);
      this.add.text(px+10,ry+4,`${res.icon} ${res.label}`,{fontSize:'11px',color:TEXT_PARCH,fontFamily:'Georgia, serif'}).setScrollFactor(0).setDepth(801);
      this.resTexts[res.key]=this.add.text(px+RIGHT_W-10,ry+4,'0',{fontSize:'12px',fontStyle:'bold',color:TEXT_GOLD,fontFamily:'Georgia, serif'}).setOrigin(1,0).setScrollFactor(0).setDepth(801);
      this.rateTexts[res.key]=this.add.text(px+RIGHT_W-10,ry+22,'+0/h',{fontSize:'10px',color:TEXT_GREEN,fontFamily:'Arial'}).setOrigin(1,0).setScrollFactor(0).setDepth(801);
      g.lineStyle(1,BORDER,0.2); g.lineBetween(px+4,ry+40,px+RIGHT_W-4,ry+40);
    });

    const resBottom=104+RES.length*44+4;
    g.lineStyle(1,BORDER,0.5); g.lineBetween(px+6,resBottom+4,px+RIGHT_W-6,resBottom+4);
    this.add.text(px+RIGHT_W/2,resBottom+10,'CONSTRUCTION',{fontSize:'10px',fontStyle:'bold',color:TEXT_GREY,fontFamily:'Georgia, serif'}).setOrigin(0.5,0).setScrollFactor(0).setDepth(801);
    g.fillStyle(0x0e0c08,1); g.fillRect(px+4,resBottom+24,RIGHT_W-8,46);
    g.lineStyle(1,BORDER,0.4); g.strokeRect(px+4,resBottom+24,RIGHT_W-8,46);
    this.queueText=this.add.text(px+10,resBottom+30,'No construction',{fontSize:'11px',color:TEXT_GREY,fontFamily:'Georgia, serif',lineSpacing:3}).setScrollFactor(0).setDepth(801);

    const btnY=H-46;
    g.fillStyle(0x3a2808,1); g.fillRoundedRect(px+8,btnY,RIGHT_W-16,30,3);
    g.lineStyle(1,BORDER,0.8); g.strokeRoundedRect(px+8,btnY,RIGHT_W-16,30,3);
    this.add.text(px+RIGHT_W/2,btnY+15,'+ More Resources',{fontSize:'11px',color:TEXT_GOLD,fontFamily:'Georgia, serif'}).setOrigin(0.5,0.5).setScrollFactor(0).setDepth(801);

    this.updateResourcePanel();
  }

  private updateResourcePanel(): void {
    const rates=computeProduction(this.state);
    ['food','lumber','stone','iron','gold'].forEach(key=>{
      const val=this.state.resources[key as keyof typeof this.state.resources];
      const rate=rates[key as keyof typeof rates];
      this.resTexts[key]?.setText(fmt(val));
      this.rateTexts[key]?.setText(rate>=0?`▲ ${fmt(rate)}/h`:`▼ ${fmt(Math.abs(rate))}/h`)
        .setColor(rate<-0.01?TEXT_RED:TEXT_GREEN);
    });
  }

  // ── Bottom Bar ────────────────────────────────────────────────────────────

  private buildBottomBar(): void {
    const W=this.scale.width, H=this.scale.height;
    const bY=H-BOT_H;
    const g=this.add.graphics().setScrollFactor(0).setDepth(800);
    g.fillStyle(PANEL_BG,0.98); g.fillRect(0,bY,W-RIGHT_W,BOT_H);
    g.lineStyle(2,BORDER,1);    g.lineBetween(0,bY,W-RIGHT_W,bY);
    g.lineStyle(1,GOLD,0.3);    g.lineBetween(0,bY+1,W-RIGHT_W,bY+1);

    ['Construction','Troops'].forEach((label,i)=>{
      const tx=8+i*110;
      const tg=this.add.graphics().setScrollFactor(0).setDepth(801);
      tg.fillStyle(i===0?0x7a5a10:0x2a2010,1);
      tg.fillRoundedRect(tx,bY+6,106,40,{tl:4,tr:4,bl:0,br:0});
      if(i===0){tg.fillStyle(GOLD,0.2); tg.fillRoundedRect(tx+1,bY+7,104,18,{tl:4,tr:4,bl:0,br:0});}
      tg.lineStyle(1,i===0?GOLD:BORDER,0.7);
      tg.strokeRoundedRect(tx,bY+6,106,40,{tl:4,tr:4,bl:0,br:0});
      this.add.text(tx+53,bY+26,label,{fontSize:'12px',fontStyle:i===0?'bold':'normal',color:i===0?TEXT_GOLD:TEXT_GREY,fontFamily:'Georgia, serif'}).setOrigin(0.5,0.5).setScrollFactor(0).setDepth(802);
    });

    ['🏪','⚔','📜','📊','✉'].forEach((icon,i)=>{
      const ax=234+i*48;
      const ig=this.add.graphics().setScrollFactor(0).setDepth(801);
      ig.fillStyle(0x2a2010,1); ig.fillRoundedRect(ax,bY+8,40,36,4);
      ig.lineStyle(1,BORDER,0.5); ig.strokeRoundedRect(ax,bY+8,40,36,4);
      this.add.text(ax+20,bY+26,icon,{fontSize:'16px'}).setOrigin(0.5,0.5).setScrollFactor(0).setDepth(802);
    });

    // World button
    const wX=W-RIGHT_W-112;
    const wg=this.add.graphics().setScrollFactor(0).setDepth(801);
    wg.fillStyle(0x5a1a10,1); wg.fillRoundedRect(wX,bY+10,100,32,4);
    wg.lineStyle(1,0x8a3010,1); wg.strokeRoundedRect(wX,bY+10,100,32,4);
    this.add.text(wX+50,bY+26,'🌍  World',{fontSize:'12px',fontStyle:'bold',color:'#ee9966',fontFamily:'Georgia, serif'})
      .setOrigin(0.5,0.5).setScrollFactor(0).setDepth(802).setInteractive({useHandCursor:true})
      .on('pointerdown',()=>this.scene.start('WorldMapScene',{state:this.state}));

    // DEV button
    const dX=W-RIGHT_W-218;
    const dg=this.add.graphics().setScrollFactor(0).setDepth(801);
    dg.fillStyle(0x300808,1); dg.fillRoundedRect(dX,bY+10,98,32,4);
    dg.lineStyle(1,0x882020,1); dg.strokeRoundedRect(dX,bY+10,98,32,4);
    this.add.text(dX+49,bY+26,'⚙  DEV',{fontSize:'11px',fontStyle:'bold',color:'#ff7777',fontFamily:'Georgia, serif'})
      .setOrigin(0.5,0.5).setScrollFactor(0).setDepth(802).setInteractive({useHandCursor:true})
      .on('pointerdown',()=>this.toggleDevPanel());
  }
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if(n>=1_000_000) return (n/1_000_000).toFixed(1)+'M';
  if(n>=10_000)    return (n/1_000).toFixed(0)+'K';
  if(n>=1_000)     return (n/1_000).toFixed(1)+'K';
  return Math.floor(n).toString();
}

function fmtTime(s: number): string {
  if(s<60)   return `${s}s`;
  if(s<3600) return `${Math.floor(s/60)}m ${s%60}s`;
  return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m`;
}
