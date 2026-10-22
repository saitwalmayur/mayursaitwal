import {
  Component, ElementRef, ViewChild, AfterViewInit, OnDestroy,
  Inject, PLATFORM_ID, HostListener, ChangeDetectorRef
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight,
  PointLight, MeshBuilder, StandardMaterial, Color3, Color4,
  Mesh, DynamicTexture, PointerEventTypes, Quaternion, AbstractMesh
} from '@babylonjs/core';

interface PeriodicElement {
  number: number; symbol: string; name: string;
  mass: number; category: string; period: number; group: number;
}

const CC: Record<string, [number,number,number]> = {
  'alkali-metal':    [1.0,0.27,0.0],  'alkaline-earth': [1.0,0.65,0.0],
  'transition-metal':[1.0,0.84,0.0],  'post-transition':[0.56,0.93,0.56],
  'metalloid':       [0.0,0.9,1.0],   'nonmetal':       [0.3,0.69,0.97],
  'halogen':         [0.8,0.58,0.85], 'noble-gas':      [0.61,0.15,0.69],
  'lanthanide':      [0.96,0.56,0.71],'actinide':       [1.0,0.50,0.75],
  'unknown':         [0.47,0.56,0.61]
};

export const CATEGORY_HEX: Record<string,string> = {
  'alkali-metal':'#ff4500','alkaline-earth':'#ffa500','transition-metal':'#ffd700',
  'post-transition':'#90ee90','metalloid':'#00e5ff','nonmetal':'#4db6f7',
  'halogen':'#cc94d9','noble-gas':'#9c27b0','lanthanide':'#f592b5',
  'actinide':'#ff80c0','unknown':'#78909c'
};

const CATEGORY_NAMES: Record<string,string> = {
  'alkali-metal':'Alkali Metal','alkaline-earth':'Alkaline Earth Metal',
  'transition-metal':'Transition Metal','post-transition':'Post-Transition Metal',
  'metalloid':'Metalloid','nonmetal':'Reactive Nonmetal','halogen':'Halogen',
  'noble-gas':'Noble Gas','lanthanide':'Lanthanide','actinide':'Actinide','unknown':'Unknown'
};

const ELEMENTS: PeriodicElement[] = [
  {number:1,  symbol:'H',  name:'Hydrogen',      mass:1.008,   category:'nonmetal',        period:1, group:1  },
  {number:2,  symbol:'He', name:'Helium',         mass:4.003,   category:'noble-gas',        period:1, group:18 },
  {number:3,  symbol:'Li', name:'Lithium',        mass:6.94,    category:'alkali-metal',     period:2, group:1  },
  {number:4,  symbol:'Be', name:'Beryllium',      mass:9.012,   category:'alkaline-earth',   period:2, group:2  },
  {number:5,  symbol:'B',  name:'Boron',          mass:10.81,   category:'metalloid',        period:2, group:13 },
  {number:6,  symbol:'C',  name:'Carbon',         mass:12.011,  category:'nonmetal',         period:2, group:14 },
  {number:7,  symbol:'N',  name:'Nitrogen',       mass:14.007,  category:'nonmetal',         period:2, group:15 },
  {number:8,  symbol:'O',  name:'Oxygen',         mass:15.999,  category:'nonmetal',         period:2, group:16 },
  {number:9,  symbol:'F',  name:'Fluorine',       mass:18.998,  category:'halogen',          period:2, group:17 },
  {number:10, symbol:'Ne', name:'Neon',           mass:20.18,   category:'noble-gas',        period:2, group:18 },
  {number:11, symbol:'Na', name:'Sodium',         mass:22.99,   category:'alkali-metal',     period:3, group:1  },
  {number:12, symbol:'Mg', name:'Magnesium',      mass:24.305,  category:'alkaline-earth',   period:3, group:2  },
  {number:13, symbol:'Al', name:'Aluminum',       mass:26.982,  category:'post-transition',  period:3, group:13 },
  {number:14, symbol:'Si', name:'Silicon',        mass:28.085,  category:'metalloid',        period:3, group:14 },
  {number:15, symbol:'P',  name:'Phosphorus',     mass:30.974,  category:'nonmetal',         period:3, group:15 },
  {number:16, symbol:'S',  name:'Sulfur',         mass:32.06,   category:'nonmetal',         period:3, group:16 },
  {number:17, symbol:'Cl', name:'Chlorine',       mass:35.45,   category:'halogen',          period:3, group:17 },
  {number:18, symbol:'Ar', name:'Argon',          mass:39.948,  category:'noble-gas',        period:3, group:18 },
  {number:19, symbol:'K',  name:'Potassium',      mass:39.098,  category:'alkali-metal',     period:4, group:1  },
  {number:20, symbol:'Ca', name:'Calcium',        mass:40.078,  category:'alkaline-earth',   period:4, group:2  },
  {number:21, symbol:'Sc', name:'Scandium',       mass:44.956,  category:'transition-metal', period:4, group:3  },
  {number:22, symbol:'Ti', name:'Titanium',       mass:47.867,  category:'transition-metal', period:4, group:4  },
  {number:23, symbol:'V',  name:'Vanadium',       mass:50.942,  category:'transition-metal', period:4, group:5  },
  {number:24, symbol:'Cr', name:'Chromium',       mass:51.996,  category:'transition-metal', period:4, group:6  },
  {number:25, symbol:'Mn', name:'Manganese',      mass:54.938,  category:'transition-metal', period:4, group:7  },
  {number:26, symbol:'Fe', name:'Iron',           mass:55.845,  category:'transition-metal', period:4, group:8  },
  {number:27, symbol:'Co', name:'Cobalt',         mass:58.933,  category:'transition-metal', period:4, group:9  },
  {number:28, symbol:'Ni', name:'Nickel',         mass:58.693,  category:'transition-metal', period:4, group:10 },
  {number:29, symbol:'Cu', name:'Copper',         mass:63.546,  category:'transition-metal', period:4, group:11 },
  {number:30, symbol:'Zn', name:'Zinc',           mass:65.38,   category:'transition-metal', period:4, group:12 },
  {number:31, symbol:'Ga', name:'Gallium',        mass:69.723,  category:'post-transition',  period:4, group:13 },
  {number:32, symbol:'Ge', name:'Germanium',      mass:72.63,   category:'metalloid',        period:4, group:14 },
  {number:33, symbol:'As', name:'Arsenic',        mass:74.922,  category:'metalloid',        period:4, group:15 },
  {number:34, symbol:'Se', name:'Selenium',       mass:78.971,  category:'nonmetal',         period:4, group:16 },
  {number:35, symbol:'Br', name:'Bromine',        mass:79.904,  category:'halogen',          period:4, group:17 },
  {number:36, symbol:'Kr', name:'Krypton',        mass:83.798,  category:'noble-gas',        period:4, group:18 },
  {number:37, symbol:'Rb', name:'Rubidium',       mass:85.468,  category:'alkali-metal',     period:5, group:1  },
  {number:38, symbol:'Sr', name:'Strontium',      mass:87.62,   category:'alkaline-earth',   period:5, group:2  },
  {number:39, symbol:'Y',  name:'Yttrium',        mass:88.906,  category:'transition-metal', period:5, group:3  },
  {number:40, symbol:'Zr', name:'Zirconium',      mass:91.224,  category:'transition-metal', period:5, group:4  },
  {number:41, symbol:'Nb', name:'Niobium',        mass:92.906,  category:'transition-metal', period:5, group:5  },
  {number:42, symbol:'Mo', name:'Molybdenum',     mass:95.95,   category:'transition-metal', period:5, group:6  },
  {number:43, symbol:'Tc', name:'Technetium',     mass:98,      category:'transition-metal', period:5, group:7  },
  {number:44, symbol:'Ru', name:'Ruthenium',      mass:101.07,  category:'transition-metal', period:5, group:8  },
  {number:45, symbol:'Rh', name:'Rhodium',        mass:102.906, category:'transition-metal', period:5, group:9  },
  {number:46, symbol:'Pd', name:'Palladium',      mass:106.42,  category:'transition-metal', period:5, group:10 },
  {number:47, symbol:'Ag', name:'Silver',         mass:107.868, category:'transition-metal', period:5, group:11 },
  {number:48, symbol:'Cd', name:'Cadmium',        mass:112.414, category:'transition-metal', period:5, group:12 },
  {number:49, symbol:'In', name:'Indium',         mass:114.818, category:'post-transition',  period:5, group:13 },
  {number:50, symbol:'Sn', name:'Tin',            mass:118.71,  category:'post-transition',  period:5, group:14 },
  {number:51, symbol:'Sb', name:'Antimony',       mass:121.76,  category:'metalloid',        period:5, group:15 },
  {number:52, symbol:'Te', name:'Tellurium',      mass:127.6,   category:'metalloid',        period:5, group:16 },
  {number:53, symbol:'I',  name:'Iodine',         mass:126.904, category:'halogen',          period:5, group:17 },
  {number:54, symbol:'Xe', name:'Xenon',          mass:131.293, category:'noble-gas',        period:5, group:18 },
  {number:55, symbol:'Cs', name:'Cesium',         mass:132.905, category:'alkali-metal',     period:6, group:1  },
  {number:56, symbol:'Ba', name:'Barium',         mass:137.327, category:'alkaline-earth',   period:6, group:2  },
  {number:57, symbol:'La', name:'Lanthanum',      mass:138.905, category:'lanthanide',       period:6, group:0  },
  {number:58, symbol:'Ce', name:'Cerium',         mass:140.116, category:'lanthanide',       period:6, group:0  },
  {number:59, symbol:'Pr', name:'Praseodymium',   mass:140.908, category:'lanthanide',       period:6, group:0  },
  {number:60, symbol:'Nd', name:'Neodymium',      mass:144.242, category:'lanthanide',       period:6, group:0  },
  {number:61, symbol:'Pm', name:'Promethium',     mass:145,     category:'lanthanide',       period:6, group:0  },
  {number:62, symbol:'Sm', name:'Samarium',       mass:150.36,  category:'lanthanide',       period:6, group:0  },
  {number:63, symbol:'Eu', name:'Europium',       mass:151.964, category:'lanthanide',       period:6, group:0  },
  {number:64, symbol:'Gd', name:'Gadolinium',     mass:157.25,  category:'lanthanide',       period:6, group:0  },
  {number:65, symbol:'Tb', name:'Terbium',        mass:158.925, category:'lanthanide',       period:6, group:0  },
  {number:66, symbol:'Dy', name:'Dysprosium',     mass:162.5,   category:'lanthanide',       period:6, group:0  },
  {number:67, symbol:'Ho', name:'Holmium',        mass:164.93,  category:'lanthanide',       period:6, group:0  },
  {number:68, symbol:'Er', name:'Erbium',         mass:167.259, category:'lanthanide',       period:6, group:0  },
  {number:69, symbol:'Tm', name:'Thulium',        mass:168.934, category:'lanthanide',       period:6, group:0  },
  {number:70, symbol:'Yb', name:'Ytterbium',      mass:173.045, category:'lanthanide',       period:6, group:0  },
  {number:71, symbol:'Lu', name:'Lutetium',       mass:174.967, category:'lanthanide',       period:6, group:0  },
  {number:72, symbol:'Hf', name:'Hafnium',        mass:178.49,  category:'transition-metal', period:6, group:4  },
  {number:73, symbol:'Ta', name:'Tantalum',       mass:180.948, category:'transition-metal', period:6, group:5  },
  {number:74, symbol:'W',  name:'Tungsten',       mass:183.84,  category:'transition-metal', period:6, group:6  },
  {number:75, symbol:'Re', name:'Rhenium',        mass:186.207, category:'transition-metal', period:6, group:7  },
  {number:76, symbol:'Os', name:'Osmium',         mass:190.23,  category:'transition-metal', period:6, group:8  },
  {number:77, symbol:'Ir', name:'Iridium',        mass:192.217, category:'transition-metal', period:6, group:9  },
  {number:78, symbol:'Pt', name:'Platinum',       mass:195.084, category:'transition-metal', period:6, group:10 },
  {number:79, symbol:'Au', name:'Gold',           mass:196.967, category:'transition-metal', period:6, group:11 },
  {number:80, symbol:'Hg', name:'Mercury',        mass:200.592, category:'transition-metal', period:6, group:12 },
  {number:81, symbol:'Tl', name:'Thallium',       mass:204.38,  category:'post-transition',  period:6, group:13 },
  {number:82, symbol:'Pb', name:'Lead',           mass:207.2,   category:'post-transition',  period:6, group:14 },
  {number:83, symbol:'Bi', name:'Bismuth',        mass:208.98,  category:'post-transition',  period:6, group:15 },
  {number:84, symbol:'Po', name:'Polonium',       mass:209,     category:'metalloid',        period:6, group:16 },
  {number:85, symbol:'At', name:'Astatine',       mass:210,     category:'halogen',          period:6, group:17 },
  {number:86, symbol:'Rn', name:'Radon',          mass:222,     category:'noble-gas',        period:6, group:18 },
  {number:87, symbol:'Fr', name:'Francium',       mass:223,     category:'alkali-metal',     period:7, group:1  },
  {number:88, symbol:'Ra', name:'Radium',         mass:226,     category:'alkaline-earth',   period:7, group:2  },
  {number:89, symbol:'Ac', name:'Actinium',       mass:227,     category:'actinide',         period:7, group:0  },
  {number:90, symbol:'Th', name:'Thorium',        mass:232.038, category:'actinide',         period:7, group:0  },
  {number:91, symbol:'Pa', name:'Protactinium',   mass:231.036, category:'actinide',         period:7, group:0  },
  {number:92, symbol:'U',  name:'Uranium',        mass:238.029, category:'actinide',         period:7, group:0  },
  {number:93, symbol:'Np', name:'Neptunium',      mass:237,     category:'actinide',         period:7, group:0  },
  {number:94, symbol:'Pu', name:'Plutonium',      mass:244,     category:'actinide',         period:7, group:0  },
  {number:95, symbol:'Am', name:'Americium',      mass:243,     category:'actinide',         period:7, group:0  },
  {number:96, symbol:'Cm', name:'Curium',         mass:247,     category:'actinide',         period:7, group:0  },
  {number:97, symbol:'Bk', name:'Berkelium',      mass:247,     category:'actinide',         period:7, group:0  },
  {number:98, symbol:'Cf', name:'Californium',    mass:251,     category:'actinide',         period:7, group:0  },
  {number:99, symbol:'Es', name:'Einsteinium',    mass:252,     category:'actinide',         period:7, group:0  },
  {number:100,symbol:'Fm', name:'Fermium',        mass:257,     category:'actinide',         period:7, group:0  },
  {number:101,symbol:'Md', name:'Mendelevium',    mass:258,     category:'actinide',         period:7, group:0  },
  {number:102,symbol:'No', name:'Nobelium',       mass:259,     category:'actinide',         period:7, group:0  },
  {number:103,symbol:'Lr', name:'Lawrencium',     mass:266,     category:'actinide',         period:7, group:0  },
  {number:104,symbol:'Rf', name:'Rutherfordium',  mass:267,     category:'transition-metal', period:7, group:4  },
  {number:105,symbol:'Db', name:'Dubnium',        mass:268,     category:'transition-metal', period:7, group:5  },
  {number:106,symbol:'Sg', name:'Seaborgium',     mass:269,     category:'transition-metal', period:7, group:6  },
  {number:107,symbol:'Bh', name:'Bohrium',        mass:270,     category:'transition-metal', period:7, group:7  },
  {number:108,symbol:'Hs', name:'Hassium',        mass:277,     category:'transition-metal', period:7, group:8  },
  {number:109,symbol:'Mt', name:'Meitnerium',     mass:278,     category:'unknown',          period:7, group:9  },
  {number:110,symbol:'Ds', name:'Darmstadtium',   mass:281,     category:'unknown',          period:7, group:10 },
  {number:111,symbol:'Rg', name:'Roentgenium',    mass:282,     category:'unknown',          period:7, group:11 },
  {number:112,symbol:'Cn', name:'Copernicium',    mass:285,     category:'transition-metal', period:7, group:12 },
  {number:113,symbol:'Nh', name:'Nihonium',       mass:286,     category:'post-transition',  period:7, group:13 },
  {number:114,symbol:'Fl', name:'Flerovium',      mass:289,     category:'post-transition',  period:7, group:14 },
  {number:115,symbol:'Mc', name:'Moscovium',      mass:290,     category:'post-transition',  period:7, group:15 },
  {number:116,symbol:'Lv', name:'Livermorium',    mass:293,     category:'post-transition',  period:7, group:16 },
  {number:117,symbol:'Ts', name:'Tennessine',     mass:294,     category:'halogen',          period:7, group:17 },
  {number:118,symbol:'Og', name:'Oganesson',      mass:294,     category:'noble-gas',        period:7, group:18 },
];

function gridPos(el: PeriodicElement): { row: number; col: number } {
  if (el.category === 'lanthanide') return { row: 8, col: el.number - 57 + 2 };
  if (el.category === 'actinide')   return { row: 9, col: el.number - 89 + 2 };
  return { row: el.period - 1, col: el.group - 1 };
}

function electronShells(Z: number): number[] {
  const caps = [2, 8, 18, 32, 32, 18, 8];
  const shells: number[] = [];
  let rem = Z;
  for (const cap of caps) {
    if (rem <= 0) break;
    const n = Math.min(rem, cap);
    shells.push(n);
    rem -= n;
  }
  return shells;
}

const NORMALS: Vector3[] = [
  new Vector3(0, 1, 0),
  new Vector3(1, 0, 0),
  new Vector3(0, 0, 1),
  new Vector3(1, 1, 0).normalize(),
  new Vector3(0, 1, 1).normalize(),
  new Vector3(1, 0, 1).normalize(),
  new Vector3(1, 1, 1).normalize(),
];

interface ElectronData { mesh: Mesh; u: Vector3; v: Vector3; phase: number; r: number; }
interface ShellData    { speed: number; electrons: ElectronData[]; }

@Component({
  selector: 'app-elementtable',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './elementtable.html',
  styleUrl: './elementtable.scss',
})
export class Elementtable implements AfterViewInit, OnDestroy {
  @ViewChild('babylonCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  public mode: 'table' | 'atom' = 'table';
  public selected: PeriodicElement | null = null;
  public hovered:  PeriodicElement | null = null;
  public loading = true;
  public readonly catHex  = CATEGORY_HEX;
  public readonly catName = CATEGORY_NAMES;
  public readonly legend  = Object.entries(CATEGORY_HEX);
  public readonly Math    = Math;
  public readonly ELEMENTS = ELEMENTS;

  private eng!: Engine;
  private scene!: Scene;
  private cam!: ArcRotateCamera;
  private elMeshes = new Map<number, Mesh>();
  private atomMeshes: Mesh[] = [];
  private atomLights: PointLight[] = [];
  private shells: ShellData[] = [];
  private lastHover: AbstractMesh | null = null;

  constructor(@Inject(PLATFORM_ID) private pid: Object, private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.pid)) return;
    this.init();
  }

  ngOnDestroy(): void {
    this.scene?.dispose();
    this.eng?.dispose();
  }

  @HostListener('window:resize')
  onResize(): void { this.eng?.resize(); }

  private rowY(row: number): number {
    if (row <= 6) return 7.5 - row * 2.05;
    return row === 8 ? -7.8 : -9.9;
  }

  private init(): void {
    const canvas = this.canvasRef.nativeElement;
    this.eng   = new Engine(canvas, true, { powerPreference: 'high-performance' });
    this.scene = new Scene(this.eng);
    this.scene.clearColor = new Color4(0.03, 0.03, 0.07, 1.0);

    this.cam = new ArcRotateCamera('cam', -Math.PI / 2, Math.PI / 2, 42, new Vector3(0, -1.2, 0), this.scene);
    this.cam.attachControl(canvas, true);
    this.cam.lowerRadiusLimit = 6;
    this.cam.upperRadiusLimit = 90;
    this.cam.wheelPrecision = 15;

    const hemi = new HemisphericLight('hemi', new Vector3(0,1,0), this.scene);
    hemi.intensity = 0.3;

    this.buildTable();

    this.scene.onPointerObservable.add(pi => {
      if (pi.type === PointerEventTypes.POINTERMOVE)  this.onHover(pi.pickInfo?.pickedMesh ?? null);
      if (pi.type === PointerEventTypes.POINTERTAP)   this.onPick(pi.pickInfo?.pickedMesh ?? null);
    });

    this.eng.runRenderLoop(() => { this.animateAtom(); this.scene.render(); });

    setTimeout(() => { this.eng.resize(); this.loading = false; this.cdr.detectChanges(); }, 250);
  }

  private onHover(mesh: AbstractMesh | null): void {
    if (this.lastHover && this.lastHover !== mesh) {
      const n = +this.lastHover.name.replace('el_','');
      if (this.selected?.number !== n) this.lastHover.scaling = Vector3.One();
    }
    if (mesh?.name.startsWith('el_')) {
      const n = +mesh.name.replace('el_','');
      this.hovered = ELEMENTS.find(e => e.number === n) ?? null;
      if (this.selected?.number !== n) mesh.scaling = new Vector3(1.12,1.12,1.6);
      this.lastHover = mesh;
    } else {
      this.hovered = null;
      this.lastHover = null;
    }
    this.cdr.detectChanges();
  }

  private onPick(mesh: AbstractMesh | null): void {
    if (!mesh?.name.startsWith('el_')) return;
    const n = +mesh.name.replace('el_','');
    const el = ELEMENTS.find(e => e.number === n);
    if (el) this.selectEl(el);
  }

  private buildTable(): void {
    ELEMENTS.forEach(el => {
      const {row,col} = gridPos(el);
      this.createBox(el, new Vector3((col - 8.5) * 2.05, this.rowY(row), 0));
    });
  }

  private createBox(el: PeriodicElement, pos: Vector3): void {
    const box = MeshBuilder.CreateBox('el_' + el.number, { width: 1.9, height: 1.9, depth: 0.18 }, this.scene);
    box.position = pos;

    const tex = new DynamicTexture('tx_' + el.number, { width: 256, height: 256 }, this.scene, true);
    const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
    const c   = CC[el.category] ?? CC['unknown'];
    const [r, g, b] = [Math.round(c[0] * 255), Math.round(c[1] * 255), Math.round(c[2] * 255)];

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 256, 256);
    grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.22)`);
    grad.addColorStop(0.4, 'rgba(11, 14, 25, 0.96)');
    grad.addColorStop(1, 'rgba(6, 8, 16, 0.98)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    // Category accent border
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.85)`;
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, 250, 250);

    // Subtle inner border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(10, 10, 236, 236);

    // Atomic number (top left)
    ctx.font = 'bold 24px monospace';
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.textAlign = 'left';
    ctx.fillText(el.number.toString(), 16, 36);

    // Atomic mass (top right)
    ctx.font = '18px monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.textAlign = 'right';
    ctx.fillText(el.mass.toFixed(el.mass >= 100 ? 1 : 2), 240, 36);

    // Chemical symbol (center)
    const symSize = el.symbol.length > 2 ? 66 : 84;
    ctx.font = `bold ${symSize}px "Segoe UI", Inter, Roboto, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.7)`;
    ctx.shadowBlur = 10;
    ctx.fillText(el.symbol, 128, 142);
    ctx.shadowBlur = 0;

    // Element name (below symbol)
    ctx.font = 'bold 20px "Segoe UI", Inter, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.textAlign = 'center';
    const nm = el.name.length > 12 ? el.name.substring(0, 11) + '…' : el.name;
    ctx.fillText(nm, 128, 184);

    // Category label (bottom)
    ctx.font = '600 13px "Segoe UI", Inter, sans-serif';
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.95)`;
    ctx.textAlign = 'center';
    const catShort = (CATEGORY_NAMES[el.category] ?? el.category).toUpperCase();
    ctx.fillText(catShort, 128, 222);

    tex.update();

    const mat = new StandardMaterial('m_' + el.number, this.scene);
    mat.diffuseColor = Color3.Black();
    mat.emissiveTexture = tex;
    mat.disableLighting = true;
    mat.backFaceCulling = false;
    box.material = mat;
    this.elMeshes.set(el.number, box);
  }

  public selectEl(el: PeriodicElement): void {
    if (this.selected) {
      const p = this.elMeshes.get(this.selected.number);
      if (p) p.scaling = Vector3.One();
    }
    this.selected = el;
    const m = this.elMeshes.get(el.number);
    if (m) m.scaling = new Vector3(1.14, 1.14, 1.8);
    this.toAtomView(el);
  }

  public backToTable(): void {
    this.mode = 'table';
    this.clearAtom();
    this.elMeshes.forEach(m => m.setEnabled(true));
    this.cam.alpha = -Math.PI / 2;
    this.cam.beta = Math.PI / 2;
    this.cam.radius = 42;
    this.cam.target = new Vector3(0, -1.2, 0);
    this.cdr.detectChanges();
  }

  private toAtomView(el: PeriodicElement): void {
    this.mode = 'atom';
    this.elMeshes.forEach(m => m.setEnabled(false));
    this.buildAtom(el);
    const s = electronShells(el.number);
    const maxR = 2.8 + (s.length-1)*2.4 + 3;
    this.cam.alpha = -Math.PI/4; this.cam.beta = Math.PI/3; this.cam.radius = maxR;
    this.cam.target = Vector3.Zero();
    this.cdr.detectChanges();
  }

  private buildAtom(el: PeriodicElement): void {
    this.clearAtom();
    const c = CC[el.category] ?? CC['unknown'];
    const s = electronShells(el.number);
    const speeds = [1.4, 1.0, 0.75, 0.58, 0.45, 0.36, 0.28];

    // Nucleus
    const nucR = Math.min(0.42 + el.number * 0.007, 1.15);
    const nuc  = MeshBuilder.CreateSphere('nuc', { diameter: nucR*2, segments:32 }, this.scene);
    const nm   = new StandardMaterial('nm', this.scene);
    nm.emissiveColor = new Color3(c[0],c[1],c[2]);
    nm.diffuseColor  = new Color3(c[0]*0.4, c[1]*0.4, c[2]*0.4);
    nuc.material = nm;
    this.atomMeshes.push(nuc);

    const pl = new PointLight('pl', Vector3.Zero(), this.scene);
    pl.diffuse = new Color3(c[0],c[1],c[2]);
    pl.intensity = 2.2; pl.range = 35;
    this.atomLights.push(pl);

    // Shells
    s.forEach((eCount, si) => {
      const orR  = 2.8 + si * 2.4;
      const norm = NORMALS[si] ?? new Vector3(0,1,0);

      const tor  = MeshBuilder.CreateTorus('sh_'+si, { diameter:orR*2, thickness:0.07, tessellation:60 }, this.scene);
      const tm   = new StandardMaterial('tm_'+si, this.scene);
      tm.emissiveColor = new Color3(c[0]*0.3, c[1]*0.3, c[2]*0.3);
      tm.alpha = 0.5;
      tor.material = tm;

      const yAx = new Vector3(0,1,0);
      const cr   = Vector3.Cross(yAx, norm);
      if (cr.length() > 0.001) {
        const ang = Math.acos(Math.max(-1, Math.min(1, Vector3.Dot(yAx, norm))));
        tor.rotationQuaternion = Quaternion.RotationAxis(cr.normalize(), ang);
      }
      this.atomMeshes.push(tor);

      const ref = Math.abs(norm.y) < 0.95 ? new Vector3(0,1,0) : new Vector3(1,0,0);
      const u   = Vector3.Cross(norm, ref).normalize();
      const v   = Vector3.Cross(norm, u).normalize();
      const cnt = Math.min(eCount, 16);
      const es: ElectronData[] = [];

      for (let i = 0; i < cnt; i++) {
        const ph  = (2*Math.PI*i) / cnt;
        const em  = MeshBuilder.CreateSphere('e_'+si+'_'+i, { diameter:0.26, segments:8 }, this.scene);
        const emat= new StandardMaterial('emat_'+si+'_'+i, this.scene);
        emat.emissiveColor = new Color3(Math.min(c[0]+0.45,1), Math.min(c[1]+0.45,1), Math.min(c[2]+0.45,1));
        em.material = emat;
        em.position = u.scale(orR*Math.cos(ph)).add(v.scale(orR*Math.sin(ph)));
        this.atomMeshes.push(em);
        es.push({ mesh:em, u, v, phase:ph, r:orR });
      }
      this.shells.push({ speed: speeds[si]??0.3, electrons:es });
    });
  }

  private clearAtom(): void {
    this.atomMeshes.forEach(m => m.dispose()); this.atomMeshes = [];
    this.atomLights.forEach(l => l.dispose()); this.atomLights = [];
    this.shells = [];
  }

  private animateAtom(): void {
    if (this.mode !== 'atom') return;
    const t = performance.now() * 0.001;
    this.shells.forEach(sh => {
      sh.electrons.forEach(e => {
        const a = t * sh.speed + e.phase;
        e.mesh.position = e.u.scale(e.r*Math.cos(a)).add(e.v.scale(e.r*Math.sin(a)));
      });
    });
    if (this.atomLights[0]) this.atomLights[0].intensity = 1.8 + Math.sin(t*2.5)*0.55;
  }

  public shellsOf(el: PeriodicElement): number[]  { return electronShells(el.number); }
  public shellDots(n: number): unknown[]           { return Array.from({ length: Math.min(n,12) }); }
  public catLabel(c: string): string               { return CATEGORY_NAMES[c] ?? c; }
}
