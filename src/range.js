import { ALL_CARDS, RANK_FROM_LABEL, RANK_LABELS, cardKey } from './cards.js';

// Order-independent dedup key for a 2-card combo.
export function comboKey(a, b) {
  const ka = cardKey(a);
  const kb = cardKey(b);
  return ka < kb ? `${ka}-${kb}` : `${kb}-${ka}`;
}

// Parse a range string into a list of [card, card] combos.
// Supports: "AA", "KK+", "QQ-99", "AKs", "AKo", "AK", "A5s+", "A5s-A2s", "KQo+".
// `deadCards` is an array of cards (e.g., the board + hero hole) to exclude.
export function parseRange(rangeStr, deadCards = []) {
  if (!rangeStr || typeof rangeStr !== 'string') return [];
  const seen = new Set();
  const combos = [];
  const dead = new Set(deadCards.map(cardKey));

  for (const raw of rangeStr.split(',')) {
    const tok = raw.trim();
    if (!tok) continue;
    const expanded = expandToken(tok);
    for (const [a, b] of expanded) {
      if (dead.has(cardKey(a)) || dead.has(cardKey(b))) continue;
      const k = comboKey(a, b);
      if (seen.has(k)) continue;
      seen.add(k);
      combos.push([a, b]);
    }
  }
  return combos;
}

// Expand a single token into raw combos (no dead-card filter, no dedup).
function expandToken(tok) {
  if (tok.includes('-')) return expandDashRange(tok);
  if (tok.endsWith('+')) return expandPlusRange(tok.slice(0, -1));
  return expandClass(tok);
}

function expandDashRange(tok) {
  const [lo, hi] = tok.split('-').map((s) => s.trim());
  const loCls = classifyToken(lo);
  const hiCls = classifyToken(hi);
  if (!loCls || !hiCls || loCls.kind !== hiCls.kind) return [];

  const result = [];
  if (loCls.kind === 'pair') {
    const [a, b] = [loCls.r1, hiCls.r1].sort((x, y) => x - y);
    for (let r = a; r <= b; r++) result.push(...combosForPair(r));
    return result;
  }
  if (loCls.r1 !== hiCls.r1) return []; // top rank must match for non-pair ranges
  const [a, b] = [loCls.r2, hiCls.r2].sort((x, y) => x - y);
  for (let r = a; r <= b; r++) {
    if (r >= loCls.r1) continue;
    result.push(...combosForRanks(loCls.r1, r, loCls.suitedness));
  }
  return result;
}

function expandPlusRange(tok) {
  const cls = classifyToken(tok);
  if (!cls) return [];
  const result = [];
  if (cls.kind === 'pair') {
    for (let r = cls.r1; r <= 14; r++) result.push(...combosForPair(r));
    return result;
  }
  // XY+ : keep X fixed, increase Y up to X-1.
  for (let r = cls.r2; r < cls.r1; r++) {
    result.push(...combosForRanks(cls.r1, r, cls.suitedness));
  }
  return result;
}

function expandClass(tok) {
  const cls = classifyToken(tok);
  if (!cls) return [];
  if (cls.kind === 'pair') return combosForPair(cls.r1);
  return combosForRanks(cls.r1, cls.r2, cls.suitedness);
}

// Returns { kind: 'pair'|'ranks', r1, r2?, suitedness?: 's'|'o'|'any' } or null.
function classifyToken(tok) {
  if (tok.length < 2) return null;
  const a = RANK_FROM_LABEL[tok[0].toUpperCase()];
  const b = RANK_FROM_LABEL[tok[1].toUpperCase()];
  if (!a || !b) return null;
  if (a === b) return { kind: 'pair', r1: a };
  const high = Math.max(a, b);
  const low = Math.min(a, b);
  const suffix = tok.slice(2).toLowerCase();
  let suitedness = 'any';
  if (suffix === 's') suitedness = 's';
  else if (suffix === 'o') suitedness = 'o';
  else if (suffix !== '') return null;
  return { kind: 'ranks', r1: high, r2: low, suitedness };
}

function combosForPair(rank) {
  const out = [];
  for (let s1 = 0; s1 < 4; s1++) {
    for (let s2 = s1 + 1; s2 < 4; s2++) {
      out.push([{ rank, suit: s1 }, { rank, suit: s2 }]);
    }
  }
  return out;
}

function combosForRanks(rHigh, rLow, suitedness) {
  const out = [];
  if (suitedness === 's' || suitedness === 'any') {
    for (let s = 0; s < 4; s++) {
      out.push([{ rank: rHigh, suit: s }, { rank: rLow, suit: s }]);
    }
  }
  if (suitedness === 'o' || suitedness === 'any') {
    for (let s1 = 0; s1 < 4; s1++) {
      for (let s2 = 0; s2 < 4; s2++) {
        if (s1 === s2) continue;
        out.push([{ rank: rHigh, suit: s1 }, { rank: rLow, suit: s2 }]);
      }
    }
  }
  return out;
}

// Format a combo array back as a class label like "AKs" or "QQ" (suit-agnostic class).
export function comboClassLabel([a, b]) {
  if (a.rank === b.rank) return `${RANK_LABELS[a.rank]}${RANK_LABELS[a.rank]}`;
  const high = a.rank > b.rank ? a : b;
  const low = a.rank > b.rank ? b : a;
  const suited = a.suit === b.suit ? 's' : 'o';
  return `${RANK_LABELS[high.rank]}${RANK_LABELS[low.rank]}${suited}`;
}

// Build a 13x13 frequency map (class -> fraction of all suit combos in the range).
// Returns { [classKey]: { selected: N, total: M, ratio: N/M } }.
// classKey format matches comboClassLabel (e.g., "AA", "AKs", "AKo").
export function rangeMatrixSummary(combos) {
  const counts = {};
  for (const c of combos) {
    const k = comboClassLabel(c);
    counts[k] = (counts[k] || 0) + 1;
  }
  const summary = {};
  for (const [k, n] of Object.entries(counts)) {
    summary[k] = { selected: n, total: maxCombosForClass(k), ratio: n / maxCombosForClass(k) };
  }
  return summary;
}

function maxCombosForClass(label) {
  if (label.length === 2) return 6; // pair
  return label.endsWith('s') ? 4 : 12;
}

// ---- preset ranges (rough educational approximations of 100bb 6max GTO opens) ----
// These are NOT exact solver ranges. Labelled "approx." in UI to set expectations.
export const PRESET_RANGES = {
  UTG_OPEN: {
    label: 'UTG オープン (約 12%)',
    notation: '77+, A9s+, KTs+, QTs+, JTs, T9s, AJo+, KQo',
  },
  HJ_OPEN: {
    label: 'HJ オープン (約 18%)',
    notation: '55+, A7s+, K9s+, Q9s+, J9s+, T9s, 98s, ATo+, KJo+, QJo',
  },
  CO_OPEN: {
    label: 'CO オープン (約 27%)',
    notation: '22+, A2s+, K8s+, Q9s+, J9s+, T8s+, 98s, 87s, 76s, A9o+, KTo+, QTo+, JTo',
  },
  BTN_OPEN: {
    label: 'BTN オープン (約 45%)',
    notation: '22+, A2s+, K2s+, Q5s+, J7s+, T7s+, 97s+, 86s+, 75s+, 64s+, 53s+, A2o+, K8o+, Q9o+, J9o+, T8o+, 98o, 87o',
  },
  SB_OPEN: {
    label: 'SB オープン (約 40%)',
    notation: '22+, A2s+, K5s+, Q7s+, J8s+, T8s+, 97s+, 86s+, 75s+, 64s+, A2o+, K9o+, Q9o+, J9o+, T9o',
  },
  BB_DEF_VS_BTN: {
    label: 'BB ディフェンス vs BTN (約 55%)',
    notation: '22+, A2s+, K2s+, Q4s+, J6s+, T7s+, 97s+, 86s+, 75s+, 64s+, 53s+, A2o+, K7o+, Q8o+, J8o+, T8o+, 97o+, 87o, 76o',
  },
  BB_DEF_VS_UTG: {
    label: 'BB ディフェンス vs UTG (約 20%)',
    notation: '22+, A8s+, K9s+, Q9s+, JTs, T9s, 98s, ATo+, KTo+, QJo',
  },
  BB_DEF_VS_CO: {
    label: 'BB ディフェンス vs CO (約 40%)',
    notation: '22+, A2s+, K5s+, Q7s+, J8s+, T8s+, 97s+, 86s+, 76s, 65s, A5o+, K9o+, Q9o+, JTo, T9o',
  },
};

// Educational scenario list. Each scenario references preset range keys + a fixed board.
// Boards use the same "Th 9d 5c" string format we parse below.
export const QUIZ_SCENARIOS = [
  {
    id: 'utg-vs-bb-ak2',
    title: 'UTG vs BB — A♠ K♦ 2♣',
    hero: 'UTG_OPEN',
    villain: 'BB_DEF_VS_UTG',
    heroLabel: 'UTG (オープナー)',
    villainLabel: 'BB (ディフェンダー)',
    boardStr: 'As Kd 2c',
    note: 'ハイカード乾燥ボード。プリフロップアグレッサ (UTG) はナッツ寄り。',
  },
  {
    id: 'btn-vs-bb-876',
    title: 'BTN vs BB — 8♥ 7♠ 6♣',
    hero: 'BTN_OPEN',
    villain: 'BB_DEF_VS_BTN',
    heroLabel: 'BTN (オープナー)',
    villainLabel: 'BB (ディフェンダー)',
    boardStr: '8h 7s 6c',
    note: 'ローでコネクトしたウェットボード。BB のナッツアドバンテージが効くスポット。',
  },
  {
    id: 'co-vs-bb-k55',
    title: 'CO vs BB — K♥ 5♦ 5♣',
    hero: 'CO_OPEN',
    villain: 'BB_DEF_VS_CO',
    heroLabel: 'CO (オープナー)',
    villainLabel: 'BB (ディフェンダー)',
    boardStr: 'Kh 5d 5c',
    note: 'ペアドボード。CO はキング多めで強いが、BB はトリップス少。',
  },
  {
    id: 'btn-vs-bb-qjt',
    title: 'BTN vs BB — Q♠ J♥ T♦',
    hero: 'BTN_OPEN',
    villain: 'BB_DEF_VS_BTN',
    heroLabel: 'BTN (オープナー)',
    villainLabel: 'BB (ディフェンダー)',
    boardStr: 'Qs Jh Td',
    note: 'ハイ・コネクト・モノ寄りではないが超ウェット。どちらもストレート/2ペア多め。',
  },
  {
    id: 'utg-vs-bb-722',
    title: 'UTG vs BB — 7♣ 2♦ 2♥',
    hero: 'UTG_OPEN',
    villain: 'BB_DEF_VS_UTG',
    heroLabel: 'UTG (オープナー)',
    villainLabel: 'BB (ディフェンダー)',
    boardStr: '7c 2d 2h',
    note: 'ローペアドボード。UTG のオーバーペア多数 → 圧倒的にレンジ有利。',
  },
];

// Parse a board string like "As Kd 2c" or "Th 9d 5c 8s" into card objects.
export function parseBoardStr(str) {
  if (!str) return [];
  const out = [];
  for (const tok of str.split(/\s+/)) {
    if (!tok) continue;
    if (tok.length !== 2) continue;
    const rank = RANK_FROM_LABEL[tok[0].toUpperCase()];
    const suitCh = tok[1].toLowerCase();
    const suit = { s: 0, h: 1, d: 2, c: 3 }[suitCh];
    if (!rank || suit === undefined) continue;
    out.push({ rank, suit });
  }
  return out;
}
