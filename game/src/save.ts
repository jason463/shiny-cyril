// Progress lives in localStorage. Every access is guarded: the game must run
// (without persistence) where storage is blocked or throws.

import { BrushId, EnemyKind } from './sim/data';

export interface SaveData {
  v: 1;
  seals: number;
  brushes: BrushId[];
  brush: BrushId;
  depthUnlocked: number;
  depth: number;
  best: number;
  runs: number;
  wins: number;
  totalKills: number;
  seen: EnemyKind[];
  achievements: string[];
  tutorialDone: boolean;
  settings: { music: number; sfx: number; shake: number; fullscreen: boolean; haptics: boolean };
}

const KEY = 'inkwake.save.v1';

export function defaultSave(): SaveData {
  return {
    v: 1, seals: 0, brushes: ['bamboo'], brush: 'bamboo', depthUnlocked: 1, depth: 1,
    best: 0, runs: 0, wins: 0, totalKills: 0, seen: [], achievements: [], tutorialDone: false,
    settings: { music: 0.6, sfx: 0.8, shake: 1, fullscreen: false, haptics: true },
  };
}

export function loadSave(): SaveData {
  const d = defaultSave();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return d;
    const p = JSON.parse(raw) as Partial<SaveData>;
    if (!p || p.v !== 1) return d;
    return { ...d, ...p, settings: { ...d.settings, ...(p.settings ?? {}) } };
  } catch {
    return d;
  }
}

export function storeSave(s: SaveData): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // storage unavailable: play on without saving
  }
}
