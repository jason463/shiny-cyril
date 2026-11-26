// Menus and overlays, as plain DOM laid over the canvas.

import {
  ACHIEVEMENTS, AchDef, BRUSHES, BrushId, ENEMIES, EnemyKind, MAX_DEPTH, NUMERALS, RELICS, SCROLLS, TECHS, TechId,
} from '../sim/data';
import { Choice, Sim } from '../sim/sim';
import { SaveData } from '../save';

type Child = Node | string | null | undefined | false;

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K, attrs: Record<string, unknown> = {}, ...kids: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'html') el.innerHTML = String(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of kids) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid);
  }
  return el;
}

function svg(markup: string): Element {
  const t = document.createElement('template');
  t.innerHTML = markup;
  return t.content.firstElementChild!;
}

/** A small ring emblem, different for every technique and relic. */
function sigil(id: string): string {
  let hash = 7;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  const gap = 20 + (hash % 50);
  const rot = (hash >> 3) % 360;
  const marks = 1 + ((hash >> 7) % 4);
  const style = (hash >> 11) % 3;
  const circ = 2 * Math.PI * 21;
  let inner = '';
  for (let i = 0; i < marks; i++) {
    const a = ((i / marks) * 360 + rot) * (Math.PI / 180);
    const x = 30 + Math.cos(a) * 9, y = 30 + Math.sin(a) * 9;
    if (style === 0) inner += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="currentColor"/>`;
    else if (style === 1) inner += `<line x1="30" y1="30" x2="${(30 + Math.cos(a) * 14).toFixed(1)}" y2="${(30 + Math.sin(a) * 14).toFixed(1)}" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`;
    else inner += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" fill="none" stroke="currentColor" stroke-width="2"/>`;
  }
  return `<svg class="sigil" viewBox="0 0 60 60" aria-hidden="true"><circle cx="30" cy="30" r="21" fill="none" stroke="currentColor" stroke-width="5.5" stroke-linecap="round" stroke-dasharray="${(circ - gap).toFixed(1)} ${gap}" transform="rotate(${rot} 30 30)"/>${inner}</svg>`;
}

export interface ResultsData {
  won: boolean;
  score: number;
  best: boolean;
  kills: number;
  loops: number;
  ensos: number;
  biggest: number;
  time: number;
  stageName: string;
  earned: number;
  newDeeds: AchDef[];
  newDepth: number | null;
  newScroll: string | null;
  scrollName: string;
  painting: HTMLCanvasElement;
  canSave: boolean;
}

export interface Handlers {
  begin(): void;
  resume(): void;
  abandon(): void;
  toTitle(): void;
  choose(i: number): void;
  pause(): void;
  changed(): void;
  resetProgress(): void;
  fullscreen(on: boolean): void;
  savePainting(c: HTMLCanvasElement): void;
  sound(kind: 'move' | 'pick' | 'back'): void;
}

export type ScreenName = 'title' | 'scrolls' | 'brushes' | 'almanac' | 'settings' | 'pause' | 'choice' | 'results' | null;

export class UI {
  screen: ScreenName = null;
  private el: HTMLElement | null = null;
  private chrome: HTMLElement;
  private toastEl: HTMLElement | null = null;
  private toastT = 0;
  private back: (() => void) | null = null;
  private settingsFrom: 'title' | 'pause' = 'title';
  private almanacTab: 'spirits' | 'deeds' = 'spirits';
  private coarse = false;

  constructor(private root: HTMLElement, private save: SaveData, private on: Handlers) {
    this.chrome = h('div');
    root.append(this.chrome, h('div', { id: 'inset-probe' }));
    window.addEventListener('keydown', (e) => this.key(e));
    try {
      this.coarse = window.matchMedia('(pointer: coarse)').matches;
    } catch {
      this.coarse = false;
    }
  }

  setSave(s: SaveData): void {
    this.save = s;
  }

  insets(): { l: number; r: number } {
    const p = document.getElementById('inset-probe');
    if (!p) return { l: 0, r: 0 };
    const cs = getComputedStyle(p);
    return { l: parseFloat(cs.paddingLeft) || 0, r: parseFloat(cs.paddingRight) || 0 };
  }

  // ------------------------------------------------------------ plumbing

  private mount(name: ScreenName, el: HTMLElement | null, back: (() => void) | null): void {
    this.el?.remove();
    this.el = el;
    this.screen = name;
    this.back = back;
    if (el) {
      this.root.append(el);
      // keyboards and gamepads need a starting focus; a touch screen does not, and would show a stray highlight
      if (!this.coarse) {
        const first = el.querySelector<HTMLElement>('[data-first]') ?? this.focusables()[0];
        first?.focus({ preventScroll: true });
      }
    }
  }

  hide(): void {
    this.mount(null, null, null);
  }

  private focusables(): HTMLElement[] {
    if (!this.el) return [];
    return Array.from(this.el.querySelectorAll<HTMLElement>('button:not([disabled]), input')).filter((e) => e.offsetParent !== null);
  }

  /** Move focus through the open screen: used by arrow keys and the gamepad. */
  nav(dir: number): void {
    const list = this.focusables();
    if (!list.length) return;
    const i = list.indexOf(document.activeElement as HTMLElement);
    const next = list[(i + dir + list.length) % list.length] ?? list[0];
    next.focus();
    this.on.sound('move');
  }

  activate(): void {
    (document.activeElement as HTMLElement | null)?.click?.();
  }

  goBack(): boolean {
    if (!this.back) return false;
    this.on.sound('back');
    this.back();
    return true;
  }

  private key(e: KeyboardEvent): void {
    if (!this.screen) return;
    const t = e.target as HTMLElement;
    const inRange = t instanceof HTMLInputElement && t.type === 'range';
    if (e.code === 'ArrowDown' || (e.code === 'ArrowRight' && !inRange)) {
      this.nav(1);
      e.preventDefault();
    } else if (e.code === 'ArrowUp' || (e.code === 'ArrowLeft' && !inRange)) {
      this.nav(-1);
      e.preventDefault();
    } else if (e.code === 'Escape') {
      if (this.goBack()) e.preventDefault();
    } else if (this.screen === 'choice' && /^(Digit|Numpad)[1-3]$/.test(e.code)) {
      const i = Number(e.code.slice(-1)) - 1;
      this.el?.querySelectorAll<HTMLElement>('button.card')[i]?.click();
    }
  }

  private btn(label: string, fn: () => void, cls = '', first = false): HTMLButtonElement {
    return h('button', {
      class: `btn ${cls}`, type: 'button', 'data-first': first,
      onclick: () => {
        this.on.sound('pick');
        fn();
      },
    }, label);
  }

  // ------------------------------------------------------------ in-play chrome

  playChrome(on: boolean): void {
    this.chrome.replaceChildren();
    this.toastEl = null;
    if (on) {
      this.chrome.append(h('button', { class: 'pause-btn', type: 'button', 'aria-label': 'Pause', onclick: () => this.on.pause() }));
    }
  }

  toast(text: string, seconds = 3.5): void {
    this.toastEl?.remove();
    this.toastEl = h('div', { class: 'toast', role: 'status' }, text);
    this.chrome.append(this.toastEl);
    this.toastT = seconds;
  }

  tick(dt: number): void {
    if (this.toastEl) {
      this.toastT -= dt;
      if (this.toastT <= 0) {
        this.toastEl.remove();
        this.toastEl = null;
      }
    }
  }

  // ------------------------------------------------------------ title

  title(): void {
    const s = this.save;
    const item = (label: string, fn: () => void, lead = false) =>
      h('button', {
        class: `item ${lead ? 'lead' : ''}`, type: 'button', 'data-first': lead,
        onclick: () => {
          this.on.sound('pick');
          fn();
        },
      }, label);

    const depth = s.depthUnlocked > 1
      ? h('span', { class: 'depth' },
        'Depth ',
        h('button', { type: 'button', 'aria-label': 'Shallower', disabled: s.depth <= 1, onclick: () => this.setDepth(s.depth - 1) }, '−'),
        h('b', {}, String(s.depth)),
        h('button', { type: 'button', 'aria-label': 'Deeper', disabled: s.depth >= s.depthUnlocked, onclick: () => this.setDepth(s.depth + 1) }, '+'),
      )
      : null;

    const brush = BRUSHES.find((b) => b.id === s.brush) ?? BRUSHES[0];
    const el = h('section', { class: 'screen title' },
      h('div', { class: 'title-col' },
        h('div', { class: 'wordmark' }, h('h1', {}, 'Inkwake'), h('span', { class: 'seal', 'aria-hidden': 'true' })),
        h('p', { class: 'tagline' }, 'Draw a ring around the spirits. Cross your own line, and everything inside is sealed.'),
        h('nav', { class: 'menu' },
          item('Begin a painting', () => (s.scrollsUnlocked > 1 ? this.scrolls() : this.on.begin()), true),
          item('Brushes', () => this.brushes()),
          item('Almanac', () => this.almanac()),
          item('Settings', () => this.settings('title')),
        ),
        h('div', { class: 'ledger' },
          h('span', {}, h('b', {}, brush.name)),
          h('span', {}, 'Seals ', h('b', {}, String(s.seals))),
          s.best > 0 ? h('span', {}, 'Best ', h('b', {}, s.best.toLocaleString('en-US'))) : null,
          depth,
        ),
      ),
    );
    this.mount('title', el, null);
  }

  private setDepth(d: number): void {
    this.save.depth = Math.max(1, Math.min(this.save.depthUnlocked, d));
    this.on.sound('move');
    this.on.changed();
    this.title();
  }

  // ------------------------------------------------------------ scrolls

  scrolls(): void {
    const s = this.save;
    const cards = SCROLLS.map((sc, i) => {
      const open = i < s.scrollsUnlocked;
      const wins = s.scrollWins[i] ?? 0;
      return h('button', {
        class: `card ${i === s.scroll ? 'picked' : ''}`, type: 'button', disabled: !open, 'data-first': i === s.scroll,
        onclick: () => {
          this.on.sound('pick');
          s.scroll = i;
          this.on.changed();
          this.on.begin();
        },
      },
      h('span', { class: 'kind' }, `Scroll ${NUMERALS[i]}`),
      h('h3', {}, open ? sc.name : 'Still rolled'),
      h('p', {}, open ? sc.blurb : `Finish ${SCROLLS[i - 1].name} to unroll it.`),
      open && sc.hazardNote ? h('p', { class: 'muted' }, sc.hazardNote) : null,
      open ? h('span', { class: 'chip' }, wins > 0 ? `Finished ${wins} time${wins === 1 ? '' : 's'}` : 'Not yet finished') : null,
      );
    });
    const el = h('section', { class: 'screen wash' },
      h('div', { class: 'sheet' },
        h('div', { class: 'row spread' },
          h('div', {}, h('div', { class: 'eyebrow' }, `Depth ${s.depth}`), h('h2', {}, 'Choose a scroll')),
          this.btn('Back', () => this.title(), 'quiet'),
        ),
        h('div', { class: 'cards' }, ...cards),
      ),
    );
    this.mount('scrolls', el, () => this.title());
  }

  // ------------------------------------------------------------ brushes

  brushes(): void {
    const s = this.save;
    const cards = BRUSHES.map((b) => {
      const owned = s.brushes.includes(b.id);
      const picked = s.brush === b.id;
      const stat = (label: string, v: number) =>
        h('div', { class: 'stat' }, label, h('div', { class: 'bar' }, h('i', { style: `width:${Math.round(Math.max(0.08, Math.min(1, v)) * 100)}%` })));
      let action: HTMLElement;
      if (picked) action = h('button', { class: 'btn', type: 'button', disabled: true }, 'In hand');
      else if (owned) action = this.btn('Take up', () => this.pickBrush(b.id), 'primary');
      else if (s.seals >= b.cost) action = this.btn(`Unlock for ${b.cost} seals`, () => this.buyBrush(b.id), 'primary');
      else action = h('button', { class: 'btn', type: 'button', disabled: true }, `${b.cost} seals`);
      return h('article', { class: `card brush ${picked ? 'picked' : ''}` },
        h('h3', {}, b.name),
        h('p', {}, b.blurb),
        stat('Line', b.trail / 1320),
        stat('Speed', (b.speed - 150) / 155),
        stat('Health', b.hp / 4),
        stat('Flick', 1.2 / b.dashCd),
        h('p', { class: 'muted' }, b.perk),
        action,
      );
    });
    const el = h('section', { class: 'screen wash' },
      h('div', { class: 'sheet' },
        h('div', { class: 'row spread' },
          h('div', {}, h('div', { class: 'eyebrow' }, `${s.seals} seals to spend`), h('h2', {}, 'Brushes')),
          this.btn('Back', () => this.title(), 'quiet', true),
        ),
        h('p', { class: 'muted' }, 'Each brush paints differently. Seals are earned at the end of every painting, finished or not.'),
        h('div', { class: 'cards brushes' }, ...cards),
      ),
    );
    this.mount('brushes', el, () => this.title());
  }

  private pickBrush(id: BrushId): void {
    this.save.brush = id;
    this.on.changed();
    this.brushes();
  }

  private buyBrush(id: BrushId): void {
    const b = BRUSHES.find((x) => x.id === id)!;
    if (this.save.seals < b.cost || this.save.brushes.includes(id)) return;
    this.save.seals -= b.cost;
    this.save.brushes.push(id);
    this.save.brush = id;
    this.on.changed();
    this.brushes();
  }

  // ------------------------------------------------------------ almanac

  almanac(): void {
    const s = this.save;
    const tab = this.almanacTab;
    const kinds = Object.keys(ENEMIES) as EnemyKind[];
    let body: HTMLElement;
    if (tab === 'spirits') {
      body = h('div', { class: 'entries' }, ...kinds.map((k) => {
        const seen = s.seen.includes(k);
        return h('div', { class: `entry ${seen ? 'done' : 'locked'}` },
          h('span', { class: 'mark' }),
          h('div', {}, h('h3', {}, seen ? ENEMIES[k].name : 'Not yet sealed'), h('p', {}, seen ? ENEMIES[k].lore : 'Seal one to learn what it is.')),
        );
      }));
    } else {
      body = h('div', { class: 'entries' }, ...ACHIEVEMENTS.map((a) => {
        const done = s.achievements.includes(a.id);
        return h('div', { class: `entry ${done ? 'done' : ''}` }, h('span', { class: 'mark' }), h('div', {}, h('h3', {}, a.name), h('p', {}, a.desc)));
      }));
    }
    const tabBtn = (id: 'spirits' | 'deeds', label: string) =>
      h('button', {
        type: 'button', role: 'tab', 'aria-selected': String(tab === id),
        onclick: () => {
          this.almanacTab = id;
          this.on.sound('move');
          this.almanac();
        },
      }, label);
    const seenN = kinds.filter((k) => s.seen.includes(k)).length;
    const el = h('section', { class: 'screen wash' },
      h('div', { class: 'sheet' },
        h('div', { class: 'row spread' },
          h('div', {}, h('div', { class: 'eyebrow' }, `${s.runs} paintings · ${s.totalKills.toLocaleString('en-US')} spirits sealed`), h('h2', {}, 'Almanac')),
          this.btn('Back', () => this.title(), 'quiet', true),
        ),
        h('div', { class: 'tabs', role: 'tablist' },
          tabBtn('spirits', `Spirits ${seenN}/${kinds.length}`),
          tabBtn('deeds', `Deeds ${s.achievements.length}/${ACHIEVEMENTS.length}`),
        ),
        body,
      ),
    );
    this.mount('almanac', el, () => this.title());
  }

  // ------------------------------------------------------------ settings

  settings(from: 'title' | 'pause', sim?: Sim): void {
    this.settingsFrom = from;
    const st = this.save.settings;
    const back = () => (from === 'title' ? this.title() : this.pause(sim!));
    const slider = (id: string, label: string, key: 'music' | 'sfx') =>
      h('div', { class: 'field' },
        h('label', { for: id }, label),
        h('input', {
          id, type: 'range', min: '0', max: '1', step: '0.05', value: String(st[key]),
          oninput: (e: Event) => {
            st[key] = Number((e.target as HTMLInputElement).value);
            this.on.changed();
          },
          onchange: () => this.on.sound('pick'),
        }),
      );
    const seg = (label: string, options: [string, number][], cur: number, set: (v: number) => void) =>
      h('div', { class: 'field' },
        h('span', { class: 'label' }, label),
        h('div', { class: 'seg' }, ...options.map(([name, v]) =>
          h('button', {
            type: 'button', 'aria-pressed': String(Math.abs(cur - v) < 0.01),
            onclick: () => {
              set(v);
              this.on.sound('pick');
              this.on.changed();
              this.settings(from, sim);
            },
          }, name))),
      );

    const canFs = !!document.fullscreenEnabled;
    let confirmReset = false;
    const resetBtn = h('button', { class: 'btn quiet', type: 'button' }, 'Erase all progress');
    resetBtn.addEventListener('click', () => {
      if (!confirmReset) {
        confirmReset = true;
        resetBtn.textContent = 'Press again to erase everything';
        this.on.sound('back');
        return;
      }
      this.on.resetProgress();
    });

    const el = h('section', { class: 'screen wash' },
      h('div', { class: 'sheet narrow' },
        h('div', { class: 'row spread' }, h('h2', {}, 'Settings'), this.btn('Back', back, 'quiet', true)),
        slider('set-music', 'Music', 'music'),
        slider('set-sfx', 'Sound', 'sfx'),
        seg('Screen shake', [['Off', 0], ['Soft', 0.5], ['Full', 1]], st.shake, (v) => (st.shake = v)),
        'vibrate' in navigator ? seg('Vibration', [['Off', 0], ['On', 1]], st.haptics ? 1 : 0, (v) => (st.haptics = v === 1)) : null,
        canFs ? seg('Display', [['Windowed', 0], ['Fullscreen', 1]], document.fullscreenElement ? 1 : 0, (v) => {
          st.fullscreen = v === 1;
          this.on.fullscreen(v === 1);
        }) : null,
        h('div', { class: 'howto' },
          h('div', {}, h('b', {}, 'Guide the brush. '), 'Mouse, WASD or arrow keys, a gamepad stick, or drag a finger anywhere.'),
          h('div', {}, h('b', {}, 'Seal. '), 'Draw around spirits and cross your own line. The rounder the ring, the harder it strikes.'),
          h('div', {}, h('b', {}, 'Flick. '), 'Click, Space, a gamepad button, or a second finger: a short dash that nothing can touch.'),
          h('div', {}, h('b', {}, 'Pause. '), 'Escape or P.'),
        ),
        from === 'title' ? h('div', {}, resetBtn) : null,
      ),
    );
    this.mount('settings', el, back);
  }

  // ------------------------------------------------------------ pause

  pause(sim: Sim): void {
    const chips: HTMLElement[] = [];
    for (const t of TECHS) {
      const r = sim.techs[t.id as TechId];
      if (r) chips.push(h('span', { class: 'chip' }, r > 1 ? `${t.name} ${'I'.repeat(r)}` : t.name));
    }
    for (const id of sim.relics) {
      const r = RELICS.find((x) => x.id === id);
      if (r) chips.push(h('span', { class: 'chip relic' }, r.name));
    }
    const el = h('section', { class: 'screen wash' },
      h('div', { class: 'sheet narrow' },
        h('div', {}, h('div', { class: 'eyebrow' }, `${sim.brush.name} · Depth ${sim.depth}`), h('h2', {}, 'Paused')),
        chips.length ? h('div', { class: 'build' }, ...chips) : h('p', { class: 'muted' }, 'No techniques yet. Seal spirits to gather essence.'),
        h('div', { class: 'row' },
          this.btn('Resume', () => this.on.resume(), 'primary', true),
          this.btn('Settings', () => this.settings('pause', sim)),
          this.btn('Abandon painting', () => this.on.abandon(), 'quiet'),
        ),
      ),
    );
    this.mount('pause', el, () => this.on.resume());
  }

  // ------------------------------------------------------------ choices

  choice(sim: Sim): void {
    const relic = sim.phase === 'relic';
    const cards = sim.choices.map((c: Choice, i: number) => {
      const pips = c.kind === 'tech'
        ? h('div', { class: 'pips', 'aria-label': `Rank ${c.rank} of ${c.max}` },
          ...Array.from({ length: c.max }, (_, k) => h('i', { class: k < c.rank - 1 ? 'on' : k === c.rank - 1 ? 'new' : '' })))
        : null;
      return h('button', {
        class: `card ${c.kind === 'relic' ? 'relic' : ''}`, type: 'button', 'data-first': i === 0,
        onclick: () => {
          this.on.sound('pick');
          this.on.choose(i);
        },
      },
      svg(sigil(c.id)),
      h('span', { class: 'kind' }, c.kind === 'relic' ? 'Relic' : c.kind === 'tech' ? 'Technique' : 'Boon'),
      h('h3', {}, c.name),
      pips,
      h('p', {}, c.desc),
      h('span', { class: 'key', 'aria-hidden': 'true' }, String(i + 1)),
      );
    });
    const el = h('section', { class: 'screen wash' },
      h('div', { class: 'sheet' },
        h('div', {},
          h('div', { class: 'eyebrow' }, relic ? 'The stage is clean' : `Stroke ${sim.level + 1}`),
          h('h2', {}, relic ? 'Choose a relic' : 'Choose a technique'),
        ),
        h('div', { class: 'cards choice' }, ...cards),
      ),
    );
    this.mount('choice', el, null);
  }

  // ------------------------------------------------------------ results

  results(d: ResultsData): void {
    const mins = Math.floor(d.time / 60), secs = Math.floor(d.time % 60);
    d.painting.className = 'painting';
    d.painting.setAttribute('role', 'img');
    d.painting.setAttribute('aria-label', 'The ink painting your rings left on the page');
    const fig = (label: string, value: string) => [h('dt', {}, label), h('dd', {}, value)];
    const el = h('section', { class: 'screen wash' },
      h('div', { class: 'sheet' },
        h('div', {},
          h('div', { class: 'eyebrow' }, d.won ? `${d.scrollName} · the page is clean` : `${d.scrollName} · the ink ran dry in ${d.stageName}`),
          h('h2', {}, d.won ? 'A finished painting' : 'An unfinished painting'),
        ),
        h('div', { class: 'results' },
          h('div', {}, d.painting),
          h('div', { class: 'sheet', style: 'gap:18px;margin:0;width:100%' },
            h('dl', { class: 'figures' },
              h('dt', {}, d.best ? 'Score · new best' : 'Score'), h('dd', { class: 'total' }, d.score.toLocaleString('en-US')),
              ...fig('Spirits sealed', d.kills.toLocaleString('en-US')),
              ...fig('Rings closed', String(d.loops)),
              ...fig('True ensō', String(d.ensos)),
              ...fig('Largest ring', `${d.biggest} sealed`),
              ...fig('Time', `${mins}:${String(secs).padStart(2, '0')}`),
            ),
            h('div', { class: 'earned' }, `+${d.earned} seals`),
            d.newScroll ? h('p', {}, h('b', {}, `${d.newScroll} has unrolled. `), 'A new sheet, new spirits, and something waiting at the bottom of it.') : null,
            d.newDepth ? h('p', {}, h('b', {}, `Depth ${d.newDepth} is open. `), 'The spirits there are faster and there are more of them.') : null,
            d.newDeeds.length
              ? h('div', {}, h('div', { class: 'eyebrow' }, 'New deeds'), h('div', { class: 'build', style: 'margin-top:8px' }, ...d.newDeeds.map((a) => h('span', { class: 'chip relic', title: a.desc }, a.name))))
              : null,
            h('div', { class: 'row' },
              this.btn('Paint again', () => this.on.begin(), 'primary', true),
              d.canSave ? this.btn('Save painting', () => this.on.savePainting(d.painting)) : null,
              this.btn('Title', () => this.on.toTitle(), 'quiet'),
            ),
          ),
        ),
      ),
    );
    this.mount('results', el, () => this.on.toTitle());
  }

  /** Where Settings should return to; kept for the gamepad back button. */
  get from(): 'title' | 'pause' {
    return this.settingsFrom;
  }
}

export { MAX_DEPTH };
