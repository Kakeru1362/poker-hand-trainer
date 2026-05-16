import { computeComboStrength, computeEquity } from './src/equity.js';

const C = (rank, suit) => ({ rank, suit });

const hero = [C(14, 0), C(13, 0)]; // AKs
const flop = [C(12, 0), C(11, 0), C(10, 0)]; // royal-ish flop, on flop
const turn = [...flop, C(7, 1)];
const river = [...turn, C(2, 2)];

console.time('flop strength');
const s1 = computeComboStrength(hero, flop);
console.timeEnd('flop strength');
console.log(`  flop: ${s1.wins}W ${s1.ties}T ${s1.losses}L total=${s1.total}`);

console.time('turn strength');
const s2 = computeComboStrength(hero, turn);
console.timeEnd('turn strength');
console.log(`  turn: ${s2.wins}W ${s2.ties}T ${s2.losses}L total=${s2.total}`);

console.time('river strength');
const s3 = computeComboStrength(hero, river);
console.timeEnd('river strength');
console.log(`  river: ${s3.wins}W ${s3.ties}T ${s3.losses}L total=${s3.total}`);

console.time('flop equity (MC 8000)');
const e1 = computeEquity(hero, flop);
console.timeEnd('flop equity (MC 8000)');
console.log(`  equity=${(e1.equity*100).toFixed(2)}% method=${e1.method}`);

console.time('turn equity (exact)');
const e2 = computeEquity(hero, turn);
console.timeEnd('turn equity (exact)');
console.log(`  equity=${(e2.equity*100).toFixed(2)}% method=${e2.method} samples=${e2.samples}`);
