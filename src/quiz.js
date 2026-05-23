import { RANK_LABELS, SUIT_KEYS, SUIT_LABELS } from './cards.js';
import {
  PRESET_RANGES,
  QUIZ_SCENARIOS,
  parseRange,
  parseBoardStr,
  rangeMatrixSummary,
} from './range.js';
import { computeRangeVsRangeEquity } from './equity.js';

// Matrix axis order (high to low). Same convention as the main app.
const MAT_RANKS = [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2];

const state = {
  scenarioIdx: 0,
  scenario: null,
  heroCombos: [],
  villainCombos: [],
  board: [],
  estimate: 50,
  answered: false,
  scores: [],
};

function classLabelAt(row, col) {
  const r1 = MAT_RANKS[Math.min(row, col)];
  const r2 = MAT_RANKS[Math.max(row, col)];
  if (row === col) return `${RANK_LABELS[r1]}${RANK_LABELS[r1]}`;
  const suited = row < col;
  return `${RANK_LABELS[r1]}${RANK_LABELS[r2]}${suited ? 's' : 'o'}`;
}

function loadScenario(idx) {
  const sc = QUIZ_SCENARIOS[idx];
  state.scenarioIdx = idx;
  state.scenario = sc;
  state.heroCombos = parseRange(PRESET_RANGES[sc.hero].notation);
  state.villainCombos = parseRange(PRESET_RANGES[sc.villain].notation);
  state.board = parseBoardStr(sc.boardStr);
  state.estimate = 50;
  state.answered = false;
  hideResult();
  render();
}

function render() {
  renderScenarioSelect();
  renderRoleLabels();
  renderRangeMat('hero-mat', state.heroCombos);
  renderRangeMat('villain-mat', state.villainCombos);
  renderBoard();
  renderNotation();
  renderEstimate();
  renderScore();
}

function renderScenarioSelect() {
  const sel = document.getElementById('scenario-select');
  if (sel.options.length === 0) {
    for (let i = 0; i < QUIZ_SCENARIOS.length; i++) {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = `${i + 1}. ${QUIZ_SCENARIOS[i].title}`;
      sel.appendChild(opt);
    }
    sel.onchange = (e) => loadScenario(+e.target.value);
  }
  sel.value = String(state.scenarioIdx);
}

function renderRoleLabels() {
  const sc = state.scenario;
  document.getElementById('hero-label').textContent = sc.heroLabel;
  document.getElementById('villain-label').textContent = sc.villainLabel;
  document.getElementById('hero-count').textContent = `${state.heroCombos.length} コンボ`;
  document.getElementById('villain-count').textContent = `${state.villainCombos.length} コンボ`;
  document.getElementById('scenario-note').textContent = sc.note;
}

function renderRangeMat(tableId, combos) {
  const summary = rangeMatrixSummary(combos);
  const tbl = document.getElementById(tableId);
  tbl.innerHTML = '';
  for (let row = 0; row < 13; row++) {
    const tr = document.createElement('tr');
    for (let col = 0; col < 13; col++) {
      const td = document.createElement('td');
      const k = classLabelAt(row, col);
      const info = summary[k];
      td.textContent = k;
      if (info && info.ratio > 0) {
        const intensity = Math.min(1, info.ratio);
        td.style.background = `rgba(91, 156, 255, ${0.25 + intensity * 0.65})`;
        td.style.color = '#fff';
        td.title = `${k}: ${info.selected}/${info.total} (${(info.ratio * 100).toFixed(0)}%)`;
      } else {
        td.classList.add('off');
      }
      tr.appendChild(td);
    }
    tbl.appendChild(tr);
  }
}

function renderBoard() {
  const wrap = document.getElementById('quiz-board');
  wrap.innerHTML = '';
  for (const c of state.board) {
    const el = document.createElement('div');
    el.className = `card ${SUIT_KEYS[c.suit]} board-card`;
    el.textContent = `${RANK_LABELS[c.rank]}${SUIT_LABELS[c.suit]}`;
    wrap.appendChild(el);
  }
}

function renderNotation() {
  const sc = state.scenario;
  document.getElementById('hero-notation').textContent = PRESET_RANGES[sc.hero].notation;
  document.getElementById('villain-notation').textContent = PRESET_RANGES[sc.villain].notation;
}

function renderEstimate() {
  const slider = document.getElementById('estimate-slider');
  const disp = document.getElementById('estimate-display');
  slider.value = String(state.estimate);
  disp.textContent = state.estimate.toFixed(1);
  document.getElementById('btn-submit').disabled = state.answered;
}

function renderScore() {
  const el = document.getElementById('score');
  if (state.scores.length === 0) {
    el.textContent = '解答 0 / 平均誤差 -';
    return;
  }
  const avg = state.scores.reduce((s, e) => s + Math.abs(e), 0) / state.scores.length;
  el.textContent = `解答 ${state.scores.length} / 平均誤差 ±${avg.toFixed(1)}%`;
}

function submit() {
  if (state.answered) return;
  state.answered = true;
  const submitBtn = document.getElementById('btn-submit');
  submitBtn.disabled = true;
  submitBtn.textContent = '計算中...';

  // Yield to the browser so the button state actually paints before MC blocks.
  setTimeout(() => {
    const result = computeRangeVsRangeEquity(
      state.heroCombos,
      state.villainCombos,
      state.board,
      20000,
    );
    const actualPct = result.equity * 100;
    const error = state.estimate - actualPct;
    state.scores.push(error);
    showResult(state.estimate, actualPct, error, result);
    renderScore();
    submitBtn.textContent = '解答する';
  }, 30);
}

function gradeText(absErr) {
  if (absErr < 2) return { text: '完璧', color: 'var(--win)' };
  if (absErr < 5) return { text: '素晴らしい', color: 'var(--win)' };
  if (absErr < 10) return { text: '良い', color: 'var(--mixed)' };
  if (absErr < 15) return { text: 'もう少し', color: 'var(--tie)' };
  return { text: '要復習', color: 'var(--lose)' };
}

function showResult(guess, actual, error, mcResult) {
  document.getElementById('result-section').hidden = false;
  document.getElementById('result-guess').textContent = `${guess.toFixed(1)}%`;
  document.getElementById('result-actual').textContent = `${actual.toFixed(1)}%`;
  const errEl = document.getElementById('result-error');
  errEl.textContent = `${error >= 0 ? '+' : ''}${error.toFixed(1)}%`;
  errEl.style.color = Math.abs(error) < 5 ? 'var(--win)' : Math.abs(error) < 10 ? 'var(--tie)' : 'var(--lose)';
  const g = gradeText(Math.abs(error));
  const gradeEl = document.getElementById('result-grade');
  gradeEl.textContent = g.text;
  gradeEl.style.color = g.color;

  const detail = document.getElementById('result-detail');
  const advantage = actual > 55
    ? 'ヒーロー優位（レンジアドバンテージあり）'
    : actual < 45
    ? 'ヴィラン優位（こちらが劣勢）'
    : 'ほぼ互角';
  detail.innerHTML = `
    <div class="result-line">この状況は <strong>${advantage}</strong>。実勝率 ${actual.toFixed(1)}%。</div>
    <div class="result-line muted">${mcResult.samples.toLocaleString()} samples (${mcResult.attempts.toLocaleString()} attempts, ${((mcResult.samples / mcResult.attempts) * 100).toFixed(0)}% efficiency)</div>
  `;
}

function hideResult() {
  document.getElementById('result-section').hidden = true;
}

function next() {
  const nextIdx = (state.scenarioIdx + 1) % QUIZ_SCENARIOS.length;
  loadScenario(nextIdx);
}

// ---- wire up ----
document.getElementById('estimate-slider').addEventListener('input', (e) => {
  state.estimate = parseFloat(e.target.value);
  document.getElementById('estimate-display').textContent = state.estimate.toFixed(1);
});
document.getElementById('btn-submit').onclick = submit;
document.getElementById('btn-skip').onclick = next;
document.getElementById('btn-next').onclick = next;

loadScenario(0);
