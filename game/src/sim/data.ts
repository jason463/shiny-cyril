// All tunable content lives here: spirits, brushes, techniques, relics, stages, achievements.

export const ARENA_W = 2400;
export const ARENA_H = 1600;
export const ARENA_PAD = 46;

export type EnemyKind =
  | 'drifter' | 'mite' | 'darter' | 'shell' | 'splitter'
  | 'cutter' | 'spitter' | 'wisp' | 'giant' | 'boss';

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
  | 'flick' | 'vital' | 'steady' | 'well' | 'wet' | 'burst';

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
  { id: 'burst', name: 'Ink Burst', max: 3, weight: 0.8, desc: (r) => `Your flick throws a ring that stuns nearby spirits for ${(0.5 + r * 0.5).toFixed(1)} seconds.` },
];

// ---------------------------------------------------------------- relics (unique rule-changers)

export type RelicId =
  | 'echo' | 'koi' | 'thunder' | 'charm' | 'blossom'
  | 'openhand' | 'breath' | 'stamp' | 'hungry' | 'waxed';

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
  boss?: boolean;
}

export const STAGES: StageDef[] = [
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
    dur: 9999, rate: [1.6, 2.6], weights: { drifter: 6, darter: 1.5, wisp: 1, cutter: 1 }, giants: [], boss: true,
  },
];

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
  { id: 'thousand', name: 'A Thousand Spirits', desc: 'Seal 1,000 spirits across all paintings.' },
];
