import { RANK_LABELS, SUIT_KEYS, SUIT_LABELS } from './cards.js';
import {
  PRESET_RANGES,
  comboClassLabel,
  parseRange,
  randomHand,
  rangeClassSet,
  rangeMatrixSummary,
} from './range.js';

const STORAGE_KEY = 'poker-trainer-drill-v1';
const OPENER_POSITIONS = ['UTG_OPEN', 'HJ_OPEN', 'CO_OPEN', 'BTN_OPEN', 'SB_OPEN'];

// Display name without the "_OPEN" suffix.
const POS_LABEL = {
  UTG_OPEN: 'UTG',
  HJ_OPEN: 'HJ',
  CO_OPEN: 'CO',
  BTN_OPEN: 'BTN',
  SB_OPEN: 'SB',
};

// Matrix axis (top->bottom, left->right): A, K, Q, ..., 2.
const MAT_RANKS = [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2];

function classLabelAt(row, col) {
  const r1 = MAT_RANKS[Math.min(row, col)];
  const r2 = MAT_RANKS[Math.max(row, col)];
  if (row === col) return `${RANK_LABELS[r1]}${RANK_LABELS[r1]}`;
  return `${RANK_LABELS[r1]}${RANK_LABELS[r2]}${row < col ? 's' : 'o'}`;
}

// Pre-compute the class set for every opener position once.
const RANGE_SETS = {};
for (const pos of OPENER_POSITIONS) {
  RANGE_SETS[pos] = rangeClassSet(PRESET_RANGES[pos].notation);
}

const state = {
  // current question
  position: 'BTN_OPEN',
  hand: null, // [card, card]
  handClass: '',
  correctAnswer: false, // true = should open, false = should fold
  answered: false,
  // settings
  positionFilter: 'ALL', // 'ALL' or one of OPENER_POSITIONS
  weightTrouble: true,
  // persisted stats
  stats: defaultStats(),
};

function defaultStats() {
  return {
    total: 0,
    correct: 0,
    streak: 0,
    bestStreak: 0,
    perPosition: {},     // { UTG_OPEN: { seen, correct } }
    perHand: {},         // { "UTG_OPEN:ATs": { seen, correct } }
  };
}

function loadStats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultStats();
    const parsed = JSON.parse(raw);
    return { ...defaultStats(), ...parsed };
  } catch {
    return defaultStats();
  }
}

function saveStats() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.stats));
  } catch {
    // Storage may be disabled (private mode) — silently ignore.
  }
}

function resetStats() {
  if (!confirm('スコアと苦手ハンド履歴を全部消します。よろしいですか？')) return;
  state.stats = defaultStats();
  saveStats();
  renderStats();
}

// --- question generation ---

function pickPosition() {
  if (state.positionFilter !== 'ALL') return state.positionFilter;
  return OPENER_POSITIONS[(Math.random() * OPENER_POSITIONS.length) | 0];
}

// Score how much we want to drill a hand at a position.
// Higher score = more likely to be picked.
function handDrillWeight(pos, classLabel) {
  if (!state.weightTrouble) return 1;
  const key = `${pos}:${classLabel}`;
  const s = state.stats.perHand[key];
  if (!s || s.seen < 2) return 2; // unseen hands get a small boost
  const errorRate = 1 - s.correct / s.seen;
  // weight: base 1 + up to +5 for high-error hands
  return 1 + errorRate * 5;
}

function pickHand(pos) {
  // Weighted sampling: try up to 30 attempts to land on a "deserving" hand.
  // If weighting is off, the first random hand is taken immediately.
  let best = null;
  let bestWeight = -1;
  const attempts = state.weightTrouble ? 12 : 1;
  for (let i = 0; i < attempts; i++) {
    const h = randomHand();
    const cls = comboClassLabel(h);
    const w = handDrillWeight(pos, cls) * Math.random();
    if (w > bestWeight) {
      bestWeight = w;
      best = { hand: h, cls };
    }
  }
  return best;
}

function nextQuestion() {
  state.position = pickPosition();
  const { hand, cls } = pickHand(state.position);
  state.hand = hand;
  state.handClass = cls;
  state.correctAnswer = RANGE_SETS[state.position].has(cls);
  state.answered = false;
  hideResult();
  renderQuestion();
}

// --- answer handling ---

function answer(userOpened) {
  if (state.answered) return;
  state.answered = true;
  const correct = userOpened === state.correctAnswer;
  recordAnswer(correct);
  showResult(correct, userOpened);
  saveStats();
  renderStats();
}

function recordAnswer(correct) {
  const s = state.stats;
  s.total++;
  if (correct) {
    s.correct++;
    s.streak++;
    if (s.streak > s.bestStreak) s.bestStreak = s.streak;
  } else {
    s.streak = 0;
  }
  const pp = (s.perPosition[state.position] ||= { seen: 0, correct: 0 });
  pp.seen++;
  if (correct) pp.correct++;
  const key = `${state.position}:${state.handClass}`;
  const ph = (s.perHand[key] ||= { seen: 0, correct: 0 });
  ph.seen++;
  if (correct) ph.correct++;
}

// --- rendering ---

function renderQuestion() {
  document.getElementById('position-badge').textContent = POS_LABEL[state.position];
  const wrap = document.getElementById('hand-display');
  wrap.innerHTML = '';
  for (const c of state.hand) {
    const el = document.createElement('div');
    el.className = `card ${SUIT_KEYS[c.suit]} drill-card`;
    el.textContent = `${RANK_LABELS[c.rank]}${SUIT_LABELS[c.suit]}`;
    wrap.appendChild(el);
  }
  document.getElementById('btn-open').disabled = false;
  document.getElementById('btn-fold').disabled = false;
}

function showResult(correct, userOpened) {
  document.getElementById('drill-result').hidden = false;
  document.getElementById('btn-open').disabled = true;
  document.getElementById('btn-fold').disabled = true;

  const banner = document.getElementById('result-banner');
  banner.textContent = correct ? '◯ 正解' : '✕ 不正解';
  banner.className = `result-banner ${correct ? 'correct' : 'wrong'}`;

  document.getElementById('class-display').textContent = state.handClass;
  document.getElementById('verdict-display').textContent =
    state.correctAnswer ? 'オープン' : 'フォールド';
  document.getElementById('verdict-display').className =
    `result-verdict ${state.correctAnswer ? 'verdict-open' : 'verdict-fold'}`;

  const userText = userOpened ? 'オープン' : 'フォールド';
  document.getElementById('result-note').textContent = correct
    ? `${POS_LABEL[state.position]} で ${state.handClass} は正しく${userText}を選べました。`
    : `${POS_LABEL[state.position]} で ${state.handClass} は ${state.correctAnswer ? 'オープン' : 'フォールド'} が正解。あなたは ${userText} を選びました。`;

  renderRangeMatrix();
}

function hideResult() {
  document.getElementById('drill-result').hidden = true;
}

function renderRangeMatrix() {
  const tbl = document.getElementById('drill-mat');
  const range = parseRange(PRESET_RANGES[state.position].notation);
  const summary = rangeMatrixSummary(range);
  tbl.innerHTML = '';
  for (let row = 0; row < 13; row++) {
    const tr = document.createElement('tr');
    for (let col = 0; col < 13; col++) {
      const td = document.createElement('td');
      const k = classLabelAt(row, col);
      td.textContent = k;
      const info = summary[k];
      if (info && info.ratio > 0) {
        const intensity = Math.min(1, info.ratio);
        td.style.background = `rgba(91, 156, 255, ${0.25 + intensity * 0.65})`;
        td.style.color = '#fff';
      } else {
        td.classList.add('off');
      }
      if (k === state.handClass) {
        td.classList.add('current-hand');
      }
      tr.appendChild(td);
    }
    tbl.appendChild(tr);
  }
}

function renderStats() {
  const s = state.stats;
  document.getElementById('stat-total').textContent = String(s.total);
  document.getElementById('stat-acc').textContent =
    s.total > 0 ? `${((s.correct / s.total) * 100).toFixed(0)}%` : '-';
  document.getElementById('stat-streak').textContent = String(s.streak);
  document.getElementById('stat-best').textContent = String(s.bestStreak);

  // Trouble hands
  const trouble = [];
  for (const [key, v] of Object.entries(s.perHand)) {
    if (v.seen < 2) continue;
    const errRate = 1 - v.correct / v.seen;
    if (errRate > 0) {
      trouble.push({ key, errRate, ...v });
    }
  }
  trouble.sort((a, b) => b.errRate - a.errRate || b.seen - a.seen);
  const top = trouble.slice(0, 10);
  const tt = document.getElementById('trouble-table');
  tt.innerHTML = '';
  if (top.length === 0) {
    tt.innerHTML = '<tr><td colspan="3" class="muted">まだ十分なデータがありません</td></tr>';
  } else {
    tt.innerHTML = '<tr><th>ポジション : ハンド</th><th>正解 / 出題</th><th>誤答率</th></tr>';
    for (const t of top) {
      const [pos, cls] = t.key.split(':');
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${POS_LABEL[pos] || pos} : ${cls}</td><td>${t.correct} / ${t.seen}</td><td>${(t.errRate * 100).toFixed(0)}%</td>`;
      tt.appendChild(tr);
    }
  }

  // Per-position
  const pt = document.getElementById('position-table');
  pt.innerHTML = '';
  pt.innerHTML = '<tr><th>ポジション</th><th>正解 / 出題</th><th>正解率</th></tr>';
  for (const pos of OPENER_POSITIONS) {
    const pp = s.perPosition[pos];
    const tr = document.createElement('tr');
    const acc = pp && pp.seen > 0 ? `${((pp.correct / pp.seen) * 100).toFixed(0)}%` : '-';
    const cnt = pp ? `${pp.correct} / ${pp.seen}` : '0 / 0';
    tr.innerHTML = `<td>${POS_LABEL[pos]}</td><td>${cnt}</td><td>${acc}</td>`;
    pt.appendChild(tr);
  }
}

// --- wire up ---
document.getElementById('btn-open').onclick = () => answer(true);
document.getElementById('btn-fold').onclick = () => answer(false);
document.getElementById('btn-next').onclick = nextQuestion;
document.getElementById('btn-reset-stats').onclick = resetStats;
document.getElementById('pos-select').onchange = (e) => {
  state.positionFilter = e.target.value;
  nextQuestion();
};
document.getElementById('weight-toggle').onchange = (e) => {
  state.weightTrouble = e.target.checked;
};

// Keyboard shortcuts: O / F for open/fold, Space/Enter for next
document.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  if (!state.answered) {
    if (e.key === 'o' || e.key === 'O' || e.key === 'ArrowLeft') { e.preventDefault(); answer(true); }
    else if (e.key === 'f' || e.key === 'F' || e.key === 'ArrowRight') { e.preventDefault(); answer(false); }
  } else {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); nextQuestion(); }
  }
});

state.stats = loadStats();
renderStats();
nextQuestion();
