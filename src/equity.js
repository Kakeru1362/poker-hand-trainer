import { ALL_CARDS, cardKey } from './cards.js';
import { evaluate } from './evaluator.js';

// Current-street strength: treats the board as final.
// Enumerates every possible villain 2-card combo from the remaining deck,
// then compares villain's best 5 vs hero's best 5 on the given board.
// Returns combo counts (wins / ties / losses) plus the per-combo list.
export function computeComboStrength(hero, board) {
  const used = new Set([...hero, ...board].map(cardKey));
  const remaining = ALL_CARDS.filter((c) => !used.has(cardKey(c)));

  const heroEval = evaluate([...hero, ...board]);
  const combos = [];
  const comboMap = new Map();
  let wins = 0;
  let ties = 0;
  let losses = 0;

  for (let i = 0; i < remaining.length; i++) {
    for (let j = i + 1; j < remaining.length; j++) {
      const c1 = remaining[i];
      const c2 = remaining[j];
      const ve = evaluate([c1, c2, ...board]);
      let result;
      if (ve.rank < heroEval.rank) {
        wins++;
        result = 'win';
      } else if (ve.rank > heroEval.rank) {
        losses++;
        result = 'lose';
      } else {
        ties++;
        result = 'tie';
      }
      const entry = { cards: [c1, c2], eval: ve, result };
      combos.push(entry);
      comboMap.set(comboPairKey(c1, c2), entry);
    }
  }

  return {
    heroEval,
    wins,
    ties,
    losses,
    total: wins + ties + losses,
    combos,
    comboMap,
  };
}

// Order-independent key for a pair of cards (uses cardKey which is unique 8..59).
export function comboPairKey(a, b) {
  const ka = cardKey(a);
  const kb = cardKey(b);
  return ka < kb ? `${ka}-${kb}` : `${kb}-${ka}`;
}

// True equity to showdown (running out remaining cards).
// - River: exact (same as combo strength)
// - Turn:  exact enumeration of (villain 2 cards) x (river 1 card)
// - Flop:  Monte Carlo sampling (default 8k iterations)
export function computeEquity(hero, board, mcSamples = 8000) {
  const used = new Set([...hero, ...board].map(cardKey));
  const remaining = ALL_CARDS.filter((c) => !used.has(cardKey(c)));

  if (board.length === 5) {
    const s = computeComboStrength(hero, board);
    return {
      equity: s.total > 0 ? (s.wins + s.ties / 2) / s.total : 0,
      method: 'exact',
      samples: s.total,
    };
  }

  if (board.length === 4) {
    let wins = 0;
    let ties = 0;
    let total = 0;
    for (let i = 0; i < remaining.length; i++) {
      for (let j = i + 1; j < remaining.length; j++) {
        for (let k = 0; k < remaining.length; k++) {
          if (k === i || k === j) continue;
          const fullBoard = [...board, remaining[k]];
          const he = evaluate([...hero, ...fullBoard]);
          const ve = evaluate([remaining[i], remaining[j], ...fullBoard]);
          total++;
          if (he.rank > ve.rank) wins++;
          else if (he.rank === ve.rank) ties++;
        }
      }
    }
    return {
      equity: total > 0 ? (wins + ties / 2) / total : 0,
      method: 'exact',
      samples: total,
    };
  }

  if (board.length === 3) {
    let wins = 0;
    let ties = 0;
    const n = remaining.length;
    for (let s = 0; s < mcSamples; s++) {
      const idx = sampleIndices(n, 4);
      const villain1 = remaining[idx[0]];
      const villain2 = remaining[idx[1]];
      const turn = remaining[idx[2]];
      const river = remaining[idx[3]];
      const fullBoard = [...board, turn, river];
      const he = evaluate([...hero, ...fullBoard]);
      const ve = evaluate([villain1, villain2, ...fullBoard]);
      if (he.rank > ve.rank) wins++;
      else if (he.rank === ve.rank) ties++;
    }
    return {
      equity: (wins + ties / 2) / mcSamples,
      method: 'mc',
      samples: mcSamples,
    };
  }

  return { equity: 0, method: 'none', samples: 0 };
}

function sampleIndices(n, k) {
  // Reservoir-like: pick k unique indices in [0, n)
  const out = [];
  const used = new Set();
  while (out.length < k) {
    const i = Math.floor(Math.random() * n);
    if (!used.has(i)) {
      used.add(i);
      out.push(i);
    }
  }
  return out;
}

// Range vs Range equity via Monte Carlo.
// - heroRange / villainRange: arrays of 2-card combos, [[c, c], ...]
// - board: 0, 3, 4, or 5 community cards
// - mcIter: target iterations (skipped iterations from card conflicts don't count)
// Returns { equity, samples, attempts }.
// Strategy per iteration: pick a random hero combo and villain combo that don't
// share cards with each other or with the board, then complete the board to the
// river, evaluate, accumulate win/tie. Loops with a max-attempt safety cap.
export function computeRangeVsRangeEquity(heroRange, villainRange, board = [], mcIter = 20000) {
  if (heroRange.length === 0 || villainRange.length === 0) {
    return { equity: 0, samples: 0, attempts: 0 };
  }
  const boardKeys = new Set(board.map(cardKey));
  let wins = 0;
  let ties = 0;
  let samples = 0;
  let attempts = 0;
  const maxAttempts = mcIter * 6; // safety bound for high-conflict ranges
  const need = 5 - board.length;

  while (samples < mcIter && attempts < maxAttempts) {
    attempts++;
    const hero = heroRange[(Math.random() * heroRange.length) | 0];
    if (boardKeys.has(cardKey(hero[0])) || boardKeys.has(cardKey(hero[1]))) continue;
    const villain = villainRange[(Math.random() * villainRange.length) | 0];
    const vk1 = cardKey(villain[0]);
    const vk2 = cardKey(villain[1]);
    if (boardKeys.has(vk1) || boardKeys.has(vk2)) continue;
    const h1 = cardKey(hero[0]);
    const h2 = cardKey(hero[1]);
    if (vk1 === h1 || vk1 === h2 || vk2 === h1 || vk2 === h2) continue;

    // Build a dead-card set and draw `need` random cards from remaining deck.
    const dead = new Set(boardKeys);
    dead.add(h1); dead.add(h2); dead.add(vk1); dead.add(vk2);
    const draws = drawCardsAvoiding(dead, need);
    const fullBoard = board.concat(draws);

    const he = evaluate([...hero, ...fullBoard]);
    const ve = evaluate([...villain, ...fullBoard]);
    if (he.rank > ve.rank) wins++;
    else if (he.rank === ve.rank) ties++;
    samples++;
  }

  return {
    equity: samples > 0 ? (wins + ties / 2) / samples : 0,
    samples,
    attempts,
  };
}

function drawCardsAvoiding(deadSet, count) {
  if (count <= 0) return [];
  const out = [];
  const localDead = new Set(deadSet);
  while (out.length < count) {
    const c = ALL_CARDS[(Math.random() * ALL_CARDS.length) | 0];
    const k = cardKey(c);
    if (localDead.has(k)) continue;
    localDead.add(k);
    out.push(c);
  }
  return out;
}
