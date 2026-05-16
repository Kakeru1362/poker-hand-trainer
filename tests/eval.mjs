import { evaluate } from './src/evaluator.js';

const C = (rank, suit) => ({ rank, suit }); // suit: 0=s 1=h 2=d 3=c

function test(name, cards, expectedCat, expectedHighKicker = null) {
  const r = evaluate(cards);
  const okCat = r.category === expectedCat;
  const okKicker = expectedHighKicker === null || r.kickers[0] === expectedHighKicker;
  const ok = okCat && okKicker;
  console.log(`${ok ? 'OK ' : 'FAIL'} ${name.padEnd(40)} cat=${r.category} kickers=${r.kickers.join(',')} (${r.detail})`);
  return ok;
}

let pass = 0, fail = 0;
const run = (...args) => (test(...args) ? pass++ : fail++);

// Royal flush
run('Royal flush spades', [C(14,0),C(13,0),C(12,0),C(11,0),C(10,0),C(2,1),C(3,2)], 8, 14);
// Straight flush 9-high
run('SF 9-high hearts', [C(9,1),C(8,1),C(7,1),C(6,1),C(5,1),C(2,2),C(3,3)], 8, 9);
// Wheel straight flush
run('Wheel SF', [C(14,0),C(2,0),C(3,0),C(4,0),C(5,0),C(7,2),C(9,3)], 8, 5);
// Quads
run('Quad aces', [C(14,0),C(14,1),C(14,2),C(14,3),C(13,0),C(7,1),C(2,2)], 7, 14);
// Full house
run('Full house As over Ks', [C(14,0),C(14,1),C(14,2),C(13,0),C(13,1),C(7,2),C(2,3)], 6, 14);
// Full house from two trips
run('Two trips makes full house', [C(7,0),C(7,1),C(7,2),C(3,0),C(3,1),C(3,2),C(2,0)], 6, 7);
// Flush
run('Flush K-high', [C(13,0),C(11,0),C(9,0),C(5,0),C(3,0),C(2,1),C(2,2)], 5, 13);
// Straight
run('Straight 9-high', [C(9,0),C(8,1),C(7,2),C(6,3),C(5,0),C(2,1),C(3,2)], 4, 9);
// Wheel straight (no flush)
run('Wheel straight', [C(14,0),C(2,1),C(3,2),C(4,3),C(5,0),C(9,1),C(11,2)], 4, 5);
// Trips
run('Trip Ks', [C(13,0),C(13,1),C(13,2),C(9,0),C(7,1),C(4,2),C(2,3)], 3, 13);
// Two pair
run('Two pair As Ks', [C(14,0),C(14,1),C(13,0),C(13,1),C(9,2),C(7,3),C(2,0)], 2, 14);
// Pair
run('Pair Qs', [C(12,0),C(12,1),C(9,0),C(7,1),C(4,2),C(3,3),C(2,0)], 1, 12);
// High card
run('Ace high', [C(14,0),C(11,1),C(9,2),C(7,3),C(5,0),C(3,1),C(2,2)], 0, 14);

// Tiebreak: which is stronger?
import { computeComboStrength } from './src/equity.js';

const hero = [C(14,0), C(14,1)]; // AA
const board = [C(13,0), C(7,1), C(2,2)]; // K72 rainbow
const r = computeComboStrength(hero, board);
console.log(`\nHero AA on K72: wins=${r.wins} ties=${r.ties} losses=${r.losses} total=${r.total} eq=${((r.wins + r.ties/2) / r.total * 100).toFixed(1)}%`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
