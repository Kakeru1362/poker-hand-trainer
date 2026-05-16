import { RANK_LABELS } from './cards.js';

export const HAND_NAMES = [
  'ハイカード',
  'ワンペア',
  'ツーペア',
  'スリーカード',
  'ストレート',
  'フラッシュ',
  'フルハウス',
  'フォーカード',
  'ストレートフラッシュ',
];

// Evaluate any 5-7 card poker hand.
// Returns { category: 0-8, kickers: [...], rank, name, detail }
// `rank` is a sortable integer (higher = stronger).
export function evaluate(cards) {
  const rankCounts = new Array(15).fill(0);
  const suitCounts = [0, 0, 0, 0];
  const suitMask = [0, 0, 0, 0];
  let rankMask = 0;

  for (const c of cards) {
    rankCounts[c.rank]++;
    suitCounts[c.suit]++;
    suitMask[c.suit] |= 1 << c.rank;
    rankMask |= 1 << c.rank;
  }

  let flushSuit = -1;
  for (let s = 0; s < 4; s++) {
    if (suitCounts[s] >= 5) {
      flushSuit = s;
      break;
    }
  }

  if (flushSuit >= 0) {
    const sfHigh = findStraightHigh(suitMask[flushSuit]);
    if (sfHigh > 0) {
      const isRoyal = sfHigh === 14;
      return makeResult(8, [sfHigh], isRoyal ? 'ロイヤルフラッシュ' : null);
    }
  }

  const trips = [];
  const pairs = [];
  const quads = [];
  for (let r = 14; r >= 2; r--) {
    const c = rankCounts[r];
    if (c === 4) quads.push(r);
    else if (c === 3) trips.push(r);
    else if (c === 2) pairs.push(r);
  }

  if (quads.length > 0) {
    const quad = quads[0];
    const kicker = bestKickers(rankCounts, [quad], 1)[0];
    return makeResult(7, [quad, kicker]);
  }

  if (trips.length > 0) {
    const trip = trips[0];
    let pair = -1;
    if (trips.length > 1) pair = trips[1];
    if (pairs.length > 0) pair = Math.max(pair, pairs[0]);
    if (pair > 0) return makeResult(6, [trip, pair]);
  }

  if (flushSuit >= 0) {
    const flushRanks = [];
    for (let r = 14; r >= 2; r--) {
      if (suitMask[flushSuit] & (1 << r)) {
        flushRanks.push(r);
        if (flushRanks.length === 5) break;
      }
    }
    return makeResult(5, flushRanks);
  }

  const stHigh = findStraightHigh(rankMask);
  if (stHigh > 0) return makeResult(4, [stHigh]);

  if (trips.length > 0) {
    const trip = trips[0];
    const kickers = bestKickers(rankCounts, [trip], 2);
    return makeResult(3, [trip, ...kickers]);
  }

  if (pairs.length >= 2) {
    const [p1, p2] = pairs;
    const kicker = bestKickers(rankCounts, [p1, p2], 1)[0];
    return makeResult(2, [p1, p2, kicker]);
  }

  if (pairs.length === 1) {
    const pair = pairs[0];
    const kickers = bestKickers(rankCounts, [pair], 3);
    return makeResult(1, [pair, ...kickers]);
  }

  const kickers = bestKickers(rankCounts, [], 5);
  return makeResult(0, kickers);
}

function findStraightHigh(mask) {
  for (let high = 14; high >= 6; high--) {
    let ok = true;
    for (let i = 0; i < 5; i++) {
      if (!(mask & (1 << (high - i)))) {
        ok = false;
        break;
      }
    }
    if (ok) return high;
  }
  // Wheel: A-2-3-4-5
  if (
    mask & (1 << 14) &&
    mask & (1 << 2) &&
    mask & (1 << 3) &&
    mask & (1 << 4) &&
    mask & (1 << 5)
  ) {
    return 5;
  }
  return 0;
}

function bestKickers(rankCounts, excludeRanks, count) {
  const excluded = new Set(excludeRanks);
  const result = [];
  for (let r = 14; r >= 2; r--) {
    if (excluded.has(r)) continue;
    if (rankCounts[r] > 0) {
      result.push(r);
      if (result.length === count) break;
    }
  }
  return result;
}

function makeResult(cat, kickers, customName = null) {
  let rank = cat;
  for (let i = 0; i < 5; i++) {
    rank = rank * 16 + (kickers[i] || 0);
  }
  return {
    category: cat,
    kickers,
    rank,
    name: customName || HAND_NAMES[cat],
    detail: detailString(cat, kickers, customName),
  };
}

function detailString(cat, kickers, customName) {
  const k = (i) => RANK_LABELS[kickers[i]];
  if (customName === 'ロイヤルフラッシュ') return 'ロイヤルフラッシュ';
  switch (cat) {
    case 8:
      return `ストレートフラッシュ (${k(0)}-high)`;
    case 7:
      return `フォーカード ${k(0)}`;
    case 6:
      return `フルハウス ${k(0)} over ${k(1)}`;
    case 5:
      return `フラッシュ (${k(0)}-high)`;
    case 4:
      return `ストレート (${k(0)}-high)`;
    case 3:
      return `スリーカード ${k(0)}`;
    case 2:
      return `ツーペア ${k(0)} & ${k(1)} (kicker ${k(2)})`;
    case 1:
      return `ワンペア ${k(0)} (kickers ${k(1)} ${k(2)} ${k(3)})`;
    case 0:
      return `ハイカード ${k(0)} ${k(1)} ${k(2)} ${k(3)} ${k(4)}`;
    default:
      return '';
  }
}
