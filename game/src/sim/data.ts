// All tunable content lives here: spirits, brushes, techniques, relics, stages, achievements.

export const ARENA_W = 2400;
export const ARENA_H = 1600;
export const ARENA_PAD = 46;

export type EnemyKind =
  | 'drifter' | 'mite' | 'darter' | 'shell' | 'splitter'
  | 'cutter' | 'spitter' | 'wisp' | 'giant' | 'boss'
  | 'leech' | 'twin' | 'coil' | 'eel'
  | 'kite' | 'bellows' | 'shade' | 'rival';

/** The three finales. Each has its own rules for when a ring can touch it. */
export const BOSS_KINDS: readonly EnemyKind[] = ['boss', 'eel', 'rival'];

export interface EnemyDef {
  name: string;
  lore: string;
  r: number;
  hp: number;
  speed: number;
  essence: number;
  score: number;
  cost: number;
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  drifter: {
    name: 'Drifter', r: 13, hp: 1, speed: 78, essence: 1, score: 10, cost: 1,
    lore: 'A spilled thought that never dried. It follows the brush because it has nowhere else to go.',
  },
  mite: {
    name: 'Mite', r: 7, hp: 1, speed: 150, essence: 1, score: 5, cost: 0.5,
    lore: 'A fleck thrown off by something larger. Quick, hungry, and gone in a single ring.',
  },
  darter: {
    name: 'Darter', r: 12, hp: 1, speed: 92, essence: 2, score: 20, cost: 2,
    lore: 'It holds its breath, then crosses the page in one straight line. Watch for the pause.',
  },
  shell: {
    name: 'Shellback', r: 17, hp: 2, speed: 58, essence: 3, score: 30, cost: 3,
    lore: 'Wears a lacquered plate. The first ring cracks it. It is much faster without it.',
  },
  splitter: {
    name: 'Bloom', r: 18, hp: 1, speed: 64, essence: 2, score: 25, cost: 3,
    lore: 'Seal it and three mites scatter. A wider ring catches the whole family.',
  },
  cutter: {
    name: 'Cutter', r: 11, hp: 1, speed: 132, essence: 2, score: 25, cost: 2.5,
    lore: 'It does not want you. It wants your line, and it severs any stroke it touches.',
  },
  spitter: {
    name: 'Spitter', r: 15, hp: 1, speed: 70, essence: 3, score: 30, cost: 3,
    lore: 'Keeps its distance and lobs slow beads of ink. A ring erases the beads too.',
  },
  wisp: {
    name: 'Wisp', r: 9, hp: 1, speed: 205, essence: 2, score: 20, cost: 2,
    lore: 'Circles you in a tightening spiral. It draws its own ring, and you are in the middle.',
  },
  giant: {
    name: 'Great Blot', r: 36, hp: 4, speed: 44, essence: 14, score: 200, cost: 0,
    lore: 'An old stain with a long memory. Four rings to lift it, and it sheds drifters while it lasts.',
  },
  boss: {
    name: 'The Stain', r: 62, hp: 7, speed: 60, essence: 40, score: 2000, cost: 0,
    lore: 'What is left when a painting is abandoned. It has been waiting at the bottom of the scroll.',
  },
  leech: {
    name: 'Leech', r: 10, hp: 1, speed: 96, essence: 2, score: 25, cost: 2.5,
    lore: 'It climbs onto your line and rides it straight to the brush. Close the ring, or flick, before it arrives.',
  },
  twin: {
    name: 'Bound Twin', r: 13, hp: 1, speed: 74, essence: 3, score: 40, cost: 2,
    lore: 'Two spirits on one thread. A ring that holds only one of them holds neither.',
  },
  coil: {
    name: 'Coil', r: 15, hp: 1, speed: 0, essence: 1, score: 15, cost: 0,
    lore: 'One link of something much longer. Cut enough of them away and the head has nothing to hide behind.',
  },
  eel: {
    name: 'The Undertow', r: 27, hp: 4, speed: 176, essence: 40, score: 2500, cost: 0,
    lore: 'It circles what it means to drown. Seal its coils and it is, for a moment, only a head.',
  },
  kite: {
    name: 'Kite', r: 10, hp: 1, speed: 94, essence: 2, score: 25, cost: 2,
    lore: 'It idles in still air. When a gust comes, it comes with it, twice as fast as anything else.',
  },
  bellows: {
    name: 'Bellows', r: 16, hp: 1, speed: 52, essence: 3, score: 35, cost: 3.5,
    lore: 'It breathes out, always. The brush is pushed away, so its ring has to be a wide one.',
  },
  shade: {
    name: 'Shade', r: 12, hp: 1, speed: 100, essence: 2, score: 30, cost: 2.5,
    lore: 'Almost nothing at a distance. It only takes shape when it is close enough to matter.',
  },
  rival: {
    name: 'The Other Brush', r: 13, hp: 6, speed: 242, essence: 40, score: 3000, cost: 0,
    lore: 'It learned by watching you, and you are what it is drawing around. Touch its line to break the stroke; ring it while it reels.',
  },
};

// ---------------------------------------------------------------- brushes

export type BrushId = 'bamboo' | 'wolf' | 'great' | 'reed';

export interface BrushDef {
  id: BrushId;
  name: string;
  blurb: string;
  cost: number;
  trail: number;
  speed: number;
  hp: number;
  dashCd: number;
  width: number;
  perk: string;
}

export const BRUSHES: BrushDef[] = [
  {
    id: 'bamboo', name: 'Bamboo Brush', cost: 0, trail: 960, speed: 250, hp: 3, dashCd: 2.6, width: 9,
    blurb: 'An honest brush. Nothing to learn but the stroke.',
    perk: 'Balanced line, speed and health.',
  },
  {
    id: 'wolf', name: 'Wolf-hair Brush', cost: 60, trail: 780, speed: 305, hp: 3, dashCd: 2.2, width: 7,
    blurb: 'Stiff, fast, impatient. It prefers small exact circles.',
    perk: 'Fast with a short line. A true ensō strikes twice as hard.',
  },
  {
    id: 'great', name: 'Great Brush', cost: 150, trail: 1320, speed: 212, hp: 4, dashCd: 3.4, width: 13,
    blurb: 'Takes both hands. One stroke can ring half the page.',
    perk: 'Very long line and an extra drop of health, but slow.',
  },
  {
    id: 'reed', name: 'Reed Pen', cost: 300, trail: 880, speed: 268, hp: 2, dashCd: 1.2, width: 6,
    blurb: 'A splinter of a pen. It survives by never being where it was.',
    perk: 'Flick recharges twice as fast and stuns what it passes. Fragile.',
  },
];

// ---------------------------------------------------------------- techniques (stackable)

export type TechId =
  | 'long' | 'swift' | 'heavy' | 'splash' | 'ember' | 'thread'
  | 'flick' | 'vital' | 'steady' | 'well' | 'wet' | 'burst'
  | 'runink' | 'guard';

export interface TechDef {
  id: TechId;
  name: string;
  max: number;
  weight: number;
  desc: (rank: number) => string;
}

export const TECHS: TechDef[] = [
  { id: 'long', name: 'Long Stroke', max: 5, weight: 1.3, desc: () => 'Your line reaches 20% further before it fades.' },
  { id: 'swift', name: 'Swift Hand', max: 4, weight: 1, desc: () => 'Move 9% faster.' },
  { id: 'heavy', name: 'Heavy Ink', max: 2, weight: 0.45, desc: () => 'Every ring seals one layer deeper. Shellbacks fall in a single stroke.' },
  { id: 'splash', name: 'Splash', max: 3, weight: 1, desc: (r) => `Closing a ring splashes outward, striking spirits within ${40 + r * 40} paces of its edge.` },
  { id: 'ember', name: 'Smoulder', max: 3, weight: 0.9, desc: (r) => `Sealed ground smoulders for ${(1.5 + r * 1.5).toFixed(1)} seconds and sears spirits that wander in.` },
  { id: 'thread', name: 'Thread', max: 3, weight: 0.9, desc: (r) => `Sealed spirits fling needles at their neighbours, up to ${r * 2} per ring.` },
  { id: 'flick', name: 'Quick Flick', max: 3, weight: 0.9, desc: () => 'Your flick recharges 20% sooner.' },
  { id: 'vital', name: 'Vital Drop', max: 3, weight: 0.7, desc: () => 'One more drop of health, filled at once.' },
  { id: 'steady', name: 'Steady Wrist', max: 3, weight: 0.8, desc: () => 'Rougher circles still count as a true ensō, and each ensō yields 25% more essence.' },
  { id: 'well', name: 'Deep Well', max: 3, weight: 0.8, desc: () => 'Gather 20% more essence from every spirit.' },
  { id: 'wet', name: 'Wet Line', max: 3, weight: 0.9, desc: (r) => `Spirits that touch your line wade through it ${20 + r * 15}% slower.` },
  { id: 'runink', name: 'Running Ink', max: 3, weight: 0.8, desc: (r) => `After closing a ring, move 30% faster for ${(0.5 + r).toFixed(1)} seconds.` },
  { id: 'guard', name: 'Second Skin', max: 2, weight: 0.6, desc: () => 'After a blow you cannot be struck again for half a second longer, and the spirits are thrown further back.' },
  { id: 'burst', name: 'Ink Burst', max: 3, weight: 0.8, desc: (r) => `Your flick throws a ring that stuns nearby spirits for ${(0.5 + r * 0.5).toFixed(1)} seconds.` },
];

// ---------------------------------------------------------------- relics (unique rule-changers)

export type RelicId =
  | 'echo' | 'koi' | 'thunder' | 'charm' | 'blossom'
  | 'openhand' | 'breath' | 'stamp' | 'hungry' | 'waxed'
  | 'lens' | 'wide' | 'lefthand' | 'goldleaf' | 'stillpond';

export interface RelicDef {
  id: RelicId;
  name: string;
  desc: string;
}

export const RELICS: RelicDef[] = [
  { id: 'echo', name: 'Second Ring', desc: 'Every ring you close echoes once, a little wider, and seals again.' },
  { id: 'koi', name: 'The Koi', desc: 'A koi swims beside you. Every few seconds it draws a small ring of its own.' },
  { id: 'thunder', name: 'Thunder Seal', desc: 'A true ensō calls lightning down on five spirits anywhere on the page.' },
  { id: 'charm', name: 'Paper Charm', desc: 'Seal six or more in one ring to gain a charm that absorbs the next blow.' },
  { id: 'blossom', name: 'Plum Blossom', desc: 'Seal twelve or more in one ring to restore a drop of health. Blooms again after 25 seconds.' },
  { id: 'openhand', name: 'Open Hand', desc: 'A ring closes when the brush merely comes near its own line. No need to cross it.' },
  { id: 'breath', name: 'Held Breath', desc: 'After every ring, the spirits move at half speed for two seconds.' },
  { id: 'stamp', name: 'Vermilion Stamp', desc: 'Every fifth ring is stamped in red and seals two layers deeper.' },
  { id: 'hungry', name: 'Hungry Ink', desc: 'Each ring lengthens your line by 4%, up to 60%. Being struck empties it.' },
  { id: 'lens', name: 'Burning Glass', desc: 'A true ensō leaves its ground smouldering for three seconds, searing whatever wanders in.' },
  { id: 'wide', name: 'Wide Wrist', desc: 'Every ring seals as though it were an eighth larger than you drew it.' },
  { id: 'lefthand', name: 'Left Hand', desc: 'Each flick closes a small ring around the brush itself.' },
  { id: 'goldleaf', name: 'Gold Leaf', desc: 'Spirits sealed four or more at a time give up double essence.' },
  { id: 'stillpond', name: 'Still Pond', desc: 'The first blow of every stage passes through you.' },
  { id: 'waxed', name: 'Waxed Line', desc: 'Cutters cannot sever your line, and beads of ink dissolve when they touch it.' },
];

// ---------------------------------------------------------------- stages

export interface StageDef {
  name: string;
  sub: string;
  dur: number;
  /** spawn budget per second at the start and end of the stage */
  rate: [number, number];
  weights: Partial<Record<EnemyKind, number>>;
  /** seconds into the stage at which a Great Blot seeps in */
  giants: number[];
  /** set on a finale: which boss rises */
  boss?: EnemyKind;
}

export type Hazard = 'none' | 'rain' | 'wind';

export interface ScrollDef {
  name: string;
  blurb: string;
  hazard: Hazard;
  hazardNote: string;
  stages: StageDef[];
}

export const SCROLLS: ScrollDef[] = [
  {
    name: 'The White Page', hazard: 'none', hazardNote: '',
    blurb: 'A clean sheet and an old stain. Where every painter starts.',
    stages: [
      {
        name: 'First Stroke', sub: 'Draw a ring around them. Cross your own line to close it.',
        dur: 85, rate: [1.3, 2.6], weights: { drifter: 10, darter: 1 }, giants: [],
      },
      {
        name: 'Reed Marsh', sub: 'Some of them scatter when sealed.',
        dur: 100, rate: [2.4, 3.9], weights: { drifter: 8, darter: 3, splitter: 3, wisp: 1 }, giants: [62],
      },
      {
        name: 'Vermilion Gate', sub: 'Guard your line.',
        dur: 110, rate: [3.3, 5.0], weights: { drifter: 7, darter: 2, shell: 3.5, cutter: 3, splitter: 1.5 }, giants: [55],
      },
      {
        name: 'Storm Scroll', sub: 'Everything at once.',
        dur: 120, rate: [4.2, 6.4],
        weights: { drifter: 6, darter: 2.5, shell: 2.5, cutter: 2, splitter: 2, spitter: 3, wisp: 2.5 }, giants: [40, 85],
      },
      {
        name: 'The Stain', sub: 'It has been waiting at the bottom of the scroll.',
        dur: 9999, rate: [1.6, 2.6], weights: { drifter: 6, darter: 1.5, wisp: 1, cutter: 1 }, giants: [], boss: 'boss',
      },
    ],
  },
  {
    name: 'The Rain Scroll', hazard: 'rain', hazardNote: 'Puddles wash your line away. Draw around them.',
    blurb: 'Painted outdoors, in weather. Standing water takes the ink straight off the brush.',
    stages: [
      {
        name: 'First Drops', sub: 'Your line will not hold in standing water.',
        dur: 90, rate: [1.5, 2.8], weights: { drifter: 9, darter: 1.5, leech: 2 }, giants: [],
      },
      {
        name: 'Gutter Song', sub: 'Something is riding your line.',
        dur: 100, rate: [2.5, 4.0], weights: { drifter: 7, leech: 3, splitter: 2.5, wisp: 1.5 }, giants: [60],
      },
      {
        name: 'Bound Water', sub: 'Two on one thread. Ring both, or neither.',
        dur: 110, rate: [3.3, 5.0], weights: { drifter: 6, twin: 3, leech: 2.5, shell: 2.5, spitter: 2 }, giants: [50],
      },
      {
        name: 'Flood Mark', sub: 'The water is rising.',
        dur: 120, rate: [4.2, 6.3],
        weights: { drifter: 6, twin: 2.5, leech: 3, cutter: 2, spitter: 2.5, splitter: 2, darter: 2 }, giants: [40, 85],
      },
      {
        name: 'The Undertow', sub: 'Seal its coils. Then seal what is left.',
        dur: 9999, rate: [1.2, 2.0], weights: { drifter: 6, leech: 1.5, wisp: 1 }, giants: [], boss: 'eel',
      },
    ],
  },
  {
    name: 'The Gale Scroll', hazard: 'wind', hazardNote: 'Gusts slide everything across the page, you included.',
    blurb: 'A sheet that will not lie still. Lean into the wind, or use it.',
    stages: [
      {
        name: 'Loose Corner', sub: 'When the streaks appear, a gust is coming.',
        dur: 90, rate: [1.6, 3.0], weights: { drifter: 9, kite: 2.5, darter: 1 }, giants: [],
      },
      {
        name: 'Paper Birds', sub: 'They ride the gusts.',
        dur: 100, rate: [2.6, 4.2], weights: { drifter: 7, kite: 3.5, shade: 2.5, wisp: 2 }, giants: [58],
      },
      {
        name: 'Long Breath', sub: 'Some of them will not let you near.',
        dur: 110, rate: [3.4, 5.2], weights: { drifter: 6, bellows: 3, kite: 2.5, shade: 2.5, cutter: 2 }, giants: [50],
      },
      {
        name: 'Torn Edge', sub: 'Hold the line.',
        dur: 120, rate: [4.3, 6.5],
        weights: { drifter: 5, bellows: 2.5, kite: 3, shade: 3, twin: 2, leech: 2, spitter: 2, shell: 2 }, giants: [38, 82],
      },
      {
        name: 'The Other Brush', sub: 'Break its line before the circle closes. Ring it while it reels.',
        dur: 9999, rate: [1.5, 2.4], weights: { drifter: 6, kite: 1.5, shade: 1.5 }, giants: [], boss: 'rival',
      },
    ],
  },
];

/** The first scroll's stages; kept as a named export for tests and tools. */
export const STAGES: StageDef[] = SCROLLS[0].stages;

export const NUMERALS = ['I', 'II', 'III', 'IV', 'V'];

export const MAX_DEPTH = 5;

/** Essence needed to go from `level` to `level + 1`. */
export function essenceFor(level: number): number {
  return 12 + level * 9;
}

// ---------------------------------------------------------------- achievements

export interface AchDef {
  id: string;
  name: string;
  desc: string;
}

export const ACHIEVEMENTS: AchDef[] = [
  { id: 'first', name: 'First Circle', desc: 'Seal a spirit.' },
  { id: 'five', name: 'Handful', desc: 'Seal 5 spirits with one ring.' },
  { id: 'twelve', name: 'A Dozen', desc: 'Seal 12 spirits with one ring.' },
  { id: 'twenty', name: 'Deluge', desc: 'Seal 20 spirits with one ring.' },
  { id: 'enso', name: 'Ensō', desc: 'Close a ring round enough to count as a true ensō.' },
  { id: 'enso10', name: 'Steady Hand', desc: 'Draw 10 true ensō in a single painting.' },
  { id: 'margin', name: 'Past the Margin', desc: 'Reach the Reed Marsh.' },
  { id: 'giant', name: 'Blot Out', desc: 'Lift a Great Blot.' },
  { id: 'untouched', name: 'Untouched', desc: 'Finish a stage without being struck.' },
  { id: 'hundred', name: 'A Hundred Circles', desc: 'Close 100 rings in a single painting.' },
  { id: 'boss', name: 'Clean Page', desc: 'Seal The Stain.' },
  { id: 'wolf', name: 'Wolf at the Door', desc: 'Finish a painting with the Wolf-hair Brush.' },
  { id: 'great', name: 'Both Hands', desc: 'Finish a painting with the Great Brush.' },
  { id: 'reed', name: 'Splinter', desc: 'Finish a painting with the Reed Pen.' },
  { id: 'depth3', name: 'Deeper', desc: 'Finish a painting at Depth 3.' },
  { id: 'depth5', name: 'Bottom of the Well', desc: 'Finish a painting at Depth 5.' },
  { id: 'rain', name: 'Dry Feet', desc: 'Finish The Rain Scroll.' },
  { id: 'gale', name: 'Still Hand', desc: 'Finish The Gale Scroll.' },
  { id: 'pair', name: 'Tied Off', desc: 'Seal a pair of Bound Twins with one ring.' },
  { id: 'unravel', name: 'Unravelled', desc: 'Seal six Coils with one ring.' },
  { id: 'thousand', name: 'A Thousand Spirits', desc: 'Seal 1,000 spirits across all paintings.' },
];
