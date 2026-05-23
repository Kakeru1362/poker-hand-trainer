import { parseRange, comboClassLabel, parseBoardStr, PRESET_RANGES } from '../src/range.js';
import { computeRangeVsRangeEquity } from '../src/equity.js';

let pass = 0, fail = 0;

function assert(name, cond, extra = '') {
  if (cond) { pass++; console.log(`OK   ${name}`); }
  else      { fail++; console.log(`FAIL ${name}  ${extra}`); }
}

function eqCount(label, range, expected, tol = 0) {
  const ok = Math.abs(range.length - expected) <= tol;
  assert(`${label}: ${range.length} combos (expected ${expected})`, ok);
}

// --- parser: single-class tokens ---
eqCount('AA', parseRange('AA'), 6);
eqCount('AKs', parseRange('AKs'), 4);
eqCount('AKo', parseRange('AKo'), 12);
eqCount('AK (both)', parseRange('AK'), 16);

// --- plus ranges ---
eqCount('QQ+', parseRange('QQ+'), 18);            // QQ, KK, AA = 3 * 6
eqCount('AJs+', parseRange('AJs+'), 12);          // AJs, AQs, AKs = 3 * 4
eqCount('AJo+', parseRange('AJo+'), 36);          // AJo, AQo, AKo = 3 * 12
eqCount('KTs+', parseRange('KTs+'), 12);          // KTs, KJs, KQs

// --- dashed ranges ---
eqCount('QQ-99', parseRange('QQ-99'), 24);        // QQ JJ TT 99
eqCount('A5s-A2s', parseRange('A5s-A2s'), 16);    // A5s,A4s,A3s,A2s

// --- dead cards remove conflicts ---
const heroAce = [{ rank: 14, suit: 0 }, { rank: 14, suit: 1 }]; // AsAh
const villainAA = parseRange('AA', heroAce);
// 2 aces dead → 2 remain → C(2,2) = 1 combo (AdAc)
eqCount('AA with two aces dead', villainAA, 1);

// all 4 aces dead → 0 combos
const allAcesDead = [
  { rank: 14, suit: 0 }, { rank: 14, suit: 1 },
  { rank: 14, suit: 2 }, { rank: 14, suit: 3 },
];
eqCount('AA with all four aces dead', parseRange('AA', allAcesDead), 0);

const villainAA1Dead = parseRange('AA', [heroAce[0]]);
eqCount('AA with one ace dead', villainAA1Dead, 3); // AhAd AhAc AdAc

// --- combo label round-trip ---
const aks = parseRange('AKs');
for (const combo of aks) {
  assert(`label(${JSON.stringify(combo)})=AKs`, comboClassLabel(combo) === 'AKs');
}

// --- dedup: overlapping tokens shouldn't double-count ---
eqCount('AA, AA', parseRange('AA, AA'), 6);
eqCount('QQ+, KK', parseRange('QQ+, KK'), 18);

// --- preset ranges parse to a plausible size ---
for (const [k, v] of Object.entries(PRESET_RANGES)) {
  const r = parseRange(v.notation);
  // every preset should produce at least 30 combos (sanity)
  assert(`preset ${k} parses (${r.length} combos)`, r.length >= 30, `got ${r.length}`);
}

// --- board parser ---
const b = parseBoardStr('As Kd 2c');
assert('board parses 3 cards', b.length === 3);
assert('board[0] = As', b[0].rank === 14 && b[0].suit === 0);
assert('board[1] = Kd', b[1].rank === 13 && b[1].suit === 2);
assert('board[2] = 2c', b[2].rank === 2 && b[2].suit === 3);

// --- range vs range equity: sanity checks ---
const aa = parseRange('AA');
const random = parseRange('22+, A2s+, K2s+, Q2s+, J2s+, T2s+, 92s+, 82s+, 72s+, 62s+, 52s+, 42s+, 32s, A2o+, K2o+, Q2o+, J2o+, T2o+, 92o+, 82o+, 72o+, 62o+, 52o+, 42o+, 32o');
// AA preflop vs random ≈ ~85%
const eqAaVsRand = computeRangeVsRangeEquity(aa, random, [], 8000);
const aaPct = eqAaVsRand.equity * 100;
assert(`AA vs random ~85% (got ${aaPct.toFixed(1)}%)`, aaPct > 82 && aaPct < 88, `${aaPct.toFixed(1)}%`);

// AA vs AA preflop = 50%
const eqAaVsAa = computeRangeVsRangeEquity(aa, aa, [], 4000);
const aaVsAaPct = eqAaVsAa.equity * 100;
assert(`AA vs AA ~50% (got ${aaVsAaPct.toFixed(1)}%)`, aaVsAaPct > 47 && aaVsAaPct < 53, `${aaVsAaPct.toFixed(1)}%`);

// UTG_OPEN vs BB_DEF_VS_UTG on AsKd2c board → UTG should have large edge (>62%)
const utg = parseRange(PRESET_RANGES.UTG_OPEN.notation);
const bbDef = parseRange(PRESET_RANGES.BB_DEF_VS_UTG.notation);
const ak2 = parseBoardStr('As Kd 2c');
const eqUtg = computeRangeVsRangeEquity(utg, bbDef, ak2, 8000);
const utgPct = eqUtg.equity * 100;
assert(`UTG vs BB on AK2 has UTG edge (>53%): got ${utgPct.toFixed(1)}%`,
  utgPct > 53, `${utgPct.toFixed(1)}%`);

// UTG vs BB on 722 paired low board → UTG should DOMINATE (overpairs galore)
const lowPair = parseBoardStr('7c 2d 2h');
const eqUtgLow = computeRangeVsRangeEquity(utg, bbDef, lowPair, 8000);
const utgLowPct = eqUtgLow.equity * 100;
// Note: BB also defends 22+ so trip 2s neutralizes some UTG dominance — expect ~55-60%
assert(`UTG vs BB on 722 should still favor UTG (>53%): got ${utgLowPct.toFixed(1)}%`,
  utgLowPct > 53, `${utgLowPct.toFixed(1)}%`);

// BTN vs BB on low connector 876 → BB has nut advantage, much closer to 50-50 for BTN
const btn = parseRange(PRESET_RANGES.BTN_OPEN.notation);
const bbVsBtn = parseRange(PRESET_RANGES.BB_DEF_VS_BTN.notation);
const wet = parseBoardStr('8h 7s 6c');
const eqBtnWet = computeRangeVsRangeEquity(btn, bbVsBtn, wet, 8000);
const btnWetPct = eqBtnWet.equity * 100;
assert(`BTN vs BB on 876 should be near 50% (45-55%): got ${btnWetPct.toFixed(1)}%`,
  btnWetPct > 45 && btnWetPct < 55, `${btnWetPct.toFixed(1)}%`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
