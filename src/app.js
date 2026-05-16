import {
  ALL_CARDS,
  RANKS,
  RANK_LABELS,
  SUIT_KEYS,
  SUIT_LABELS,
  cardKey,
  cardEquals,
} from './cards.js';
import { computeComboStrength, computeEquity, comboPairKey } from './equity.js';
import { HAND_NAMES } from './evaluator.js';

// ---------- state ----------
const state = {
  hero: [null, null],
  board: [null, null, null, null, null], // up to 5
  activeSlot: { kind: 'hero', idx: 0 }, // where next clicked card goes
  mode: 'auto', // 'auto' | 'mark'
  filter: 'all', // 'all' | 'win' | 'lose' | 'tie' | 'cat-N'
  selectedCell: null, // {row, col} on matrix
  revealedCells: new Set(), // for mark mode, set of "row-col" strings
  lastStrength: null, // computed combo strength data
};

// ---------- helpers ----------
function allFilled(arr) {
  return arr.every((c) => c !== null);
}
function filledCount(arr) {
  return arr.filter((c) => c !== null).length;
}
function activeCards() {
  return [...state.hero, ...state.board].filter((c) => c !== null);
}
function isUsed(card) {
  return activeCards().some((c) => cardEquals(c, card));
}
function findNextEmpty() {
  for (let i = 0; i < 2; i++) if (state.hero[i] === null) return { kind: 'hero', idx: i };
  for (let i = 0; i < 5; i++) if (state.board[i] === null) return { kind: 'board', idx: i };
  return null;
}
function setActiveSlot(kind, idx) {
  state.activeSlot = { kind, idx };
}

// ---------- card placement ----------
function placeCard(card) {
  if (isUsed(card)) return;
  const slot = state.activeSlot;
  if (!slot) return;
  const target = slot.kind === 'hero' ? state.hero : state.board;
  target[slot.idx] = card;
  const next = findNextEmpty();
  if (next) setActiveSlot(next.kind, next.idx);
  else state.activeSlot = null;
  state.revealedCells.clear();
  state.selectedCell = null;
  recompute();
  render();
}

function clearSlot(kind, idx) {
  if (kind === 'hero') state.hero[idx] = null;
  else state.board[idx] = null;
  setActiveSlot(kind, idx);
  state.revealedCells.clear();
  state.selectedCell = null;
  recompute();
  render();
}

function reset() {
  state.hero = [null, null];
  state.board = [null, null, null, null, null];
  state.activeSlot = { kind: 'hero', idx: 0 };
  state.revealedCells.clear();
  state.selectedCell = null;
  state.lastStrength = null;
  render();
}

function randomScenario(boardCount) {
  const shuffled = ALL_CARDS.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  state.hero = [shuffled[0], shuffled[1]];
  state.board = [shuffled[2], shuffled[3], shuffled[4], null, null];
  if (boardCount >= 4) state.board[3] = shuffled[5];
  if (boardCount >= 5) state.board[4] = shuffled[6];
  state.activeSlot = null;
  state.revealedCells.clear();
  state.selectedCell = null;
  recompute();
  render();
}

// ---------- compute ----------
function recompute() {
  const heroDone = allFilled(state.hero);
  const boardCount = filledCount(state.board);
  if (!heroDone || boardCount < 3) {
    state.lastStrength = null;
    return;
  }
  const board = state.board.filter((c) => c !== null);
  state.lastStrength = computeComboStrength(state.hero, board);
  // equity asynchronously to avoid blocking UI on flop (MC is fast enough though)
  setTimeout(() => {
    const eq = computeEquity(state.hero, board);
    state.lastEquity = eq;
    renderStats();
  }, 0);
}

// ---------- render ----------
function render() {
  renderSlots();
  renderPicker();
  renderStats();
  renderMatrix();
  renderComboDetail();
}

function renderSlots() {
  const heroEl = document.getElementById('hero-slots');
  const boardEl = document.getElementById('board-slots');
  heroEl.innerHTML = '';
  boardEl.innerHTML = '';
  for (let i = 0; i < 2; i++) heroEl.appendChild(slotEl('hero', i, state.hero[i]));
  for (let i = 0; i < 5; i++) boardEl.appendChild(slotEl('board', i, state.board[i]));
}

function slotEl(kind, idx, card) {
  const el = document.createElement('div');
  const isActive = state.activeSlot && state.activeSlot.kind === kind && state.activeSlot.idx === idx;
  if (card === null) {
    el.className = 'slot' + (isActive ? ' active' : '');
    el.textContent = kind === 'hero' ? `H${idx + 1}` : `B${idx + 1}`;
    el.onclick = () => {
      setActiveSlot(kind, idx);
      render();
    };
  } else {
    el.className = `slot filled card ${SUIT_KEYS[card.suit]}` + (isActive ? ' active' : '');
    el.textContent = `${RANK_LABELS[card.rank]}${SUIT_LABELS[card.suit]}`;
    el.onclick = () => clearSlot(kind, idx);
  }
  return el;
}

function renderPicker() {
  const wrap = document.getElementById('card-picker');
  wrap.innerHTML = '';
  for (let s = 0; s < 4; s++) {
    const label = document.createElement('div');
    label.className = `pick-suit-label ${SUIT_KEYS[s]}`;
    label.textContent = SUIT_LABELS[s];
    wrap.appendChild(label);
    for (const r of RANKS) {
      const card = { rank: r, suit: s };
      const cell = document.createElement('div');
      cell.className = `pick-cell ${SUIT_KEYS[s]}` + (isUsed(card) ? ' used' : '');
      cell.textContent = RANK_LABELS[r];
      if (!isUsed(card)) {
        cell.onclick = () => placeCard(card);
      }
      wrap.appendChild(cell);
    }
  }
}

function renderStats() {
  const wrap = document.getElementById('stats');
  if (!state.lastStrength) {
    wrap.innerHTML = '<div class="stats-empty">自分の 2 枚 + ボード 3 枚以上を選んでください</div>';
    return;
  }
  const s = state.lastStrength;
  const pct = s.total > 0 ? ((s.wins + s.ties / 2) / s.total) * 100 : 0;
  const eqText = state.lastEquity
    ? `${(state.lastEquity.equity * 100).toFixed(1)}%` +
      (state.lastEquity.method === 'mc' ? ` (MC ${state.lastEquity.samples.toLocaleString()})` : '')
    : '計算中...';

  wrap.innerHTML = `
    <div class="stat">
      <span class="lbl">あなたの役</span>
      <span class="val">${s.heroEval.detail}</span>
    </div>
    <div class="divider"></div>
    <div class="stat">
      <span class="lbl">現在の勝率 (vs ランダム)</span>
      <span class="val big">${pct.toFixed(1)}%</span>
      <span class="sub">${s.wins} 勝 / ${s.ties} 引分 / ${s.losses} 負け (${s.total} 通り)</span>
    </div>
    <div class="divider"></div>
    <div class="stat">
      <span class="lbl">ショウダウン勝率</span>
      <span class="val">${eqText}</span>
      <span class="sub">将来カードを考慮</span>
    </div>
    <div class="divider"></div>
    <div class="stat">
      <span class="lbl">上に何組 (自分より強い)</span>
      <span class="val">${s.losses}</span>
    </div>
    <div class="stat">
      <span class="lbl">下に何組 (自分が勝つ)</span>
      <span class="val">${s.wins}</span>
    </div>
  `;
}

// ---------- matrix ----------
// 13x13 hand class matrix.
// rows/cols: 0..12 where 0=A, 1=K, ..., 12=2
// row<col: suited; row>col: offsuit; row==col: pair
const MATRIX_RANKS = [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2];

function classKey(row, col) {
  const r1 = MATRIX_RANKS[Math.min(row, col)];
  const r2 = MATRIX_RANKS[Math.max(row, col)];
  if (row === col) return `${RANK_LABELS[r1]}${RANK_LABELS[r1]}`;
  const suited = row < col;
  return `${RANK_LABELS[r1]}${RANK_LABELS[r2]}${suited ? 's' : 'o'}`;
}

function combosForClass(row, col) {
  // Returns all 2-card combos (suit-specific) for this class, that don't use already-placed cards.
  const used = new Set(activeCards().map(cardKey));
  const r1 = MATRIX_RANKS[Math.min(row, col)]; // higher rank
  const r2 = MATRIX_RANKS[Math.max(row, col)]; // lower rank
  const combos = [];

  if (row === col) {
    // pair: all C(4,2)=6 suit combinations
    for (let s1 = 0; s1 < 4; s1++) {
      for (let s2 = s1 + 1; s2 < 4; s2++) {
        const c1 = { rank: r1, suit: s1 };
        const c2 = { rank: r1, suit: s2 };
        if (used.has(cardKey(c1)) || used.has(cardKey(c2))) continue;
        combos.push([c1, c2]);
      }
    }
  } else if (row < col) {
    // suited (r1 high, r2 low, same suit)
    for (let s = 0; s < 4; s++) {
      const c1 = { rank: r1, suit: s };
      const c2 = { rank: r2, suit: s };
      if (used.has(cardKey(c1)) || used.has(cardKey(c2))) continue;
      combos.push([c1, c2]);
    }
  } else {
    // offsuit (different suits)
    for (let s1 = 0; s1 < 4; s1++) {
      for (let s2 = 0; s2 < 4; s2++) {
        if (s1 === s2) continue;
        const c1 = { rank: r1, suit: s1 };
        const c2 = { rank: r2, suit: s2 };
        if (used.has(cardKey(c1)) || used.has(cardKey(c2))) continue;
        // Avoid duplicates: enforce s1<s2 for offsuit ordering (since cards differ in rank, all permutations are unique pairs)
        // Actually for offsuit, c1 has rank r1 and c2 has rank r2, and r1 != r2, so (s1=0,s2=1) and (s1=1,s2=0) give the same pair {c1=r1s0, c2=r2s1} vs {c1=r1s1, c2=r2s0}, which are DIFFERENT combos. We need both.
        combos.push([c1, c2]);
      }
    }
  }
  return combos;
}

function classifyClassCell(row, col) {
  if (!state.lastStrength) return null;
  const combos = combosForClass(row, col);
  if (combos.length === 0) return { count: 0 };
  const board = state.board.filter((c) => c !== null);
  // Use lastStrength.combos lookup. Build a key->result map.
  // (re-use ranks via re-eval is fast; small data)
  const matchedResults = combos.map(([a, b]) => state.lastStrength.comboMap.get(comboPairKey(a, b)));
  let wins = 0,
    ties = 0,
    losses = 0;
  const cats = new Set();
  for (const r of matchedResults) {
    if (!r) continue;
    cats.add(r.eval.category);
    if (r.result === 'win') wins++;
    else if (r.result === 'tie') ties++;
    else losses++;
  }
  const total = wins + ties + losses;
  return { count: total, wins, ties, losses, cats, combos: matchedResults };
}

function cellColor(info) {
  if (!info || info.count === 0) return null;
  const { wins, ties, losses, count } = info;
  if (wins === count) return 'var(--win)';
  if (losses === count) return 'var(--lose)';
  if (ties === count) return 'var(--tie)';
  // mixed -> blend based on win ratio
  const winPct = (wins + ties * 0.5) / count;
  if (winPct >= 0.75) return 'color-mix(in srgb, var(--win) 80%, var(--mixed))';
  if (winPct <= 0.25) return 'color-mix(in srgb, var(--lose) 80%, var(--mixed))';
  return 'var(--mixed)';
}

function passesFilter(info) {
  if (!info || info.count === 0) return false;
  switch (state.filter) {
    case 'all':
      return true;
    case 'win':
      return info.wins > 0;
    case 'lose':
      return info.losses > 0;
    case 'tie':
      return info.ties > 0;
    default:
      if (state.filter.startsWith('cat-')) {
        const cat = +state.filter.split('-')[1];
        return info.cats && info.cats.has(cat);
      }
      return true;
  }
}

function renderMatrix() {
  const table = document.getElementById('matrix');
  table.innerHTML = '';
  // header row
  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  hr.appendChild(document.createElement('td'));
  for (const r of MATRIX_RANKS) {
    const th = document.createElement('td');
    th.className = 'empty';
    th.textContent = RANK_LABELS[r];
    hr.appendChild(th);
  }
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (let row = 0; row < 13; row++) {
    const tr = document.createElement('tr');
    const rowLabel = document.createElement('td');
    rowLabel.className = 'empty';
    rowLabel.textContent = RANK_LABELS[MATRIX_RANKS[row]];
    tr.appendChild(rowLabel);
    for (let col = 0; col < 13; col++) {
      const td = document.createElement('td');
      const info = classifyClassCell(row, col);
      const key = classKey(row, col);
      td.dataset.row = row;
      td.dataset.col = col;
      td.title = key;

      if (!info || info.count === 0) {
        td.classList.add('empty');
        td.textContent = key;
      } else if (!passesFilter(info)) {
        td.style.background = 'var(--bg-3)';
        td.style.opacity = '0.3';
        td.textContent = key;
      } else {
        const isRevealed = state.mode === 'auto' || state.revealedCells.has(`${row}-${col}`);
        if (!isRevealed) {
          td.classList.add('hidden-color');
          td.textContent = '';
        } else {
          const color = cellColor(info);
          td.style.background = color;
          const winPct = ((info.wins + info.ties * 0.5) / info.count) * 100;
          td.innerHTML = `${key}<span class="pct">${winPct.toFixed(0)}%</span>`;
        }
        td.onclick = () => {
          if (state.mode === 'mark') state.revealedCells.add(`${row}-${col}`);
          state.selectedCell = { row, col };
          render();
        };
        if (state.selectedCell && state.selectedCell.row === row && state.selectedCell.col === col) {
          td.classList.add('selected');
        }
      }
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
}

function renderComboDetail() {
  const wrap = document.getElementById('combo-detail');
  if (!state.selectedCell || !state.lastStrength) {
    wrap.innerHTML = '<div class="hint">マトリクスのセルをクリックすると、そのハンドクラスの個別コンボが表示されます。</div>';
    return;
  }
  const { row, col } = state.selectedCell;
  const info = classifyClassCell(row, col);
  const key = classKey(row, col);
  if (!info || info.count === 0) {
    wrap.innerHTML = `<h3>${key}</h3><div class="hint">このクラスのコンボは盤面で使われているため残っていません。</div>`;
    return;
  }
  const winPct = ((info.wins + info.ties * 0.5) / info.count) * 100;
  let html = `<h3>${key} — ${info.count} コンボ (勝ち ${info.wins} / 引分 ${info.ties} / 負け ${info.losses}, 勝率 ${winPct.toFixed(1)}%)</h3><div class="combo-list">`;
  for (const r of info.combos) {
    if (!r) continue;
    const [c1, c2] = r.cards;
    html += `<div class="combo-item ${r.result}">
      <span class="mini-card ${SUIT_KEYS[c1.suit]}">${RANK_LABELS[c1.rank]}${SUIT_LABELS[c1.suit]}</span>
      <span class="mini-card ${SUIT_KEYS[c2.suit]}">${RANK_LABELS[c2.rank]}${SUIT_LABELS[c2.suit]}</span>
      <span class="eval-text">${r.eval.detail}</span>
    </div>`;
  }
  html += '</div>';
  wrap.innerHTML = html;
}

// ---------- wire up ----------
document.getElementById('btn-reset').onclick = reset;
document.getElementById('btn-random-flop').onclick = () => randomScenario(3);
document.getElementById('btn-random-turn').onclick = () => randomScenario(4);
document.getElementById('btn-random-river').onclick = () => randomScenario(5);
document.getElementById('mode-select').onchange = (e) => {
  state.mode = e.target.value;
  state.revealedCells.clear();
  render();
};
document.getElementById('filter-select').onchange = (e) => {
  state.filter = e.target.value;
  render();
};

render();
