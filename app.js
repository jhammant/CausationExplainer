const $ = (id) => document.getElementById(id);
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const fmt = new Intl.NumberFormat('en-GB');

const PRESETS = {
  mars: [
    { name: 'CO₂ molecule', ai: 2, copies: 820000, kind: 'abiotic' },
    { name: 'basalt shard', ai: 5, copies: 14000, kind: 'geology' },
    { name: 'perchlorate salt', ai: 4, copies: 6700, kind: 'chemistry' },
    { name: 'complex organics trace', ai: 11, copies: 12, kind: 'unknown' },
    { name: 'repeated peptide-like fragment', ai: 17, copies: 140, kind: 'biosignature?' }
  ],
  tidepool: [
    { name: 'water molecule', ai: 1, copies: 900000, kind: 'abiotic' },
    { name: 'carbonate grain', ai: 6, copies: 19000, kind: 'geology' },
    { name: 'lipid fragment', ai: 13, copies: 880, kind: 'chemistry' },
    { name: 'short peptide motif', ai: 18, copies: 260, kind: 'biology' },
    { name: 'ribosomal RNA motif', ai: 27, copies: 43, kind: 'biology' }
  ],
  city: [
    { name: 'glass bead', ai: 8, copies: 12000, kind: 'technology' },
    { name: 'screw thread', ai: 16, copies: 8400, kind: 'technology' },
    { name: 'USB-C connector', ai: 33, copies: 350, kind: 'technology' },
    { name: 'iPhone camera module', ai: 52, copies: 22, kind: 'technology' },
    { name: 'pollen grain', ai: 21, copies: 5100, kind: 'biology' }
  ]
};

let sample = structuredClone(PRESETS.mars);
let thresholdAi = 15;
let thresholdCopies = 100;
let simTimer = null;
let simPop = [];
let simHistory = [];
let simMode = 'random';

function log10(v) { return Math.log10(Math.max(1, v)); }
function assemblyField(rows) {
  const total = rows.reduce((s, r) => s + Number(r.copies || 0), 0) || 1;
  return rows.reduce((s, r) => s + Number(r.copies || 0) * Math.exp(Number(r.ai || 0) / 5), 0) / total;
}
function evidenceClass(row) {
  const ai = Number(row.ai); const copies = Number(row.copies);
  if (ai >= thresholdAi && copies >= thresholdCopies) return 'selected';
  if (ai >= thresholdAi) return 'rare-deep';
  if (copies >= thresholdCopies) return 'common-shallow';
  return 'noise';
}
function evidenceLabel(row) {
  return {
    selected: 'persistent cause likely',
    'rare-deep': 'deep but rare',
    'common-shallow': 'common but easy',
    noise: 'low evidence'
  }[evidenceClass(row)];
}

function renderRows() {
  $('sampleRows').innerHTML = sample.map((r, i) => `
    <div class="sample-row ${evidenceClass(r)}">
      <input aria-label="object name" value="${escapeHtml(r.name)}" data-i="${i}" data-k="name" />
      <label>AI <input type="range" min="1" max="60" value="${r.ai}" data-i="${i}" data-k="ai" /><b>${r.ai}</b></label>
      <label>copies <input type="number" min="1" max="1000000" value="${r.copies}" data-i="${i}" data-k="copies" /></label>
      <span>${evidenceLabel(r)}</span>
      <button data-remove="${i}" title="remove">×</button>
    </div>`).join('');
  $('sampleRows').querySelectorAll('input').forEach(input => input.addEventListener('input', updateFromRow));
  $('sampleRows').querySelectorAll('button[data-remove]').forEach(btn => btn.addEventListener('click', () => { sample.splice(Number(btn.dataset.remove), 1); renderAll(); }));
}
function updateFromRow(e) {
  const i = Number(e.target.dataset.i); const k = e.target.dataset.k;
  sample[i][k] = k === 'name' ? e.target.value : Number(e.target.value);
  renderAll();
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function renderPlot() {
  const svg = $('phasePlot');
  const W = 760, H = 430, pad = 54;
  const maxAi = Math.max(60, ...sample.map(r => r.ai + 5));
  const maxC = Math.max(6, ...sample.map(r => log10(r.copies) + .5));
  const x = ai => pad + (ai / maxAi) * (W - 2 * pad);
  const y = c => H - pad - (log10(c) / maxC) * (H - 2 * pad);
  const thX = x(thresholdAi), thY = y(thresholdCopies);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = `
    <defs><linearGradient id="zone" x1="0" x2="1"><stop offset="0" stop-color="#67e8f9" stop-opacity=".08"/><stop offset="1" stop-color="#f472b6" stop-opacity=".20"/></linearGradient></defs>
    <rect x="0" y="0" width="${W}" height="${H}" rx="22" fill="#07101f"/>
    <rect x="${thX}" y="${pad}" width="${W - pad - thX}" height="${thY - pad}" fill="url(#zone)"/>
    ${[0,1,2,3,4,5,6].map(t => `<line x1="${pad}" x2="${W-pad}" y1="${y(10**t)}" y2="${y(10**t)}"/><text x="14" y="${y(10**t)+5}">10^${t}</text>`).join('')}
    ${[0,10,20,30,40,50,60].map(t => `<line y1="${pad}" y2="${H-pad}" x1="${x(t)}" x2="${x(t)}"/><text x="${x(t)-8}" y="${H-18}">${t}</text>`).join('')}
    <line class="threshold" x1="${thX}" x2="${thX}" y1="${pad}" y2="${H-pad}"/>
    <line class="threshold" x1="${pad}" x2="${W-pad}" y1="${thY}" y2="${thY}"/>
    <text class="axis" x="${W/2-70}" y="${H-8}">assembly index</text>
    <text class="axis" transform="translate(18 ${H/2+70}) rotate(-90)">copy number</text>
    <text class="zone-label" x="${thX+12}" y="${pad+28}">selection / technology / life zone</text>
    ${sample.map((r, i) => `<g class="point ${evidenceClass(r)}" tabindex="0"><circle cx="${x(r.ai)}" cy="${y(r.copies)}" r="${clamp(7 + log10(r.copies)*2.5, 9, 24)}"/><text x="${x(r.ai)+14}" y="${y(r.copies)-10}">${escapeHtml(r.name)}</text><title>${escapeHtml(r.name)}: AI ${r.ai}, ${fmt.format(r.copies)} copies — ${evidenceLabel(r)}</title></g>`).join('')}
  `;
}

function renderMetrics() {
  const A = assemblyField(sample);
  const flagged = sample.filter(r => evidenceClass(r) === 'selected');
  const maxAi = Math.max(...sample.map(r => r.ai));
  const maxCopies = Math.max(...sample.map(r => r.copies));
  $('fieldScore').textContent = A.toFixed(2);
  $('deepestObject').textContent = sample.find(r => r.ai === maxAi)?.name || '—';
  $('largestCopy').textContent = fmt.format(maxCopies);
  $('verdict').textContent = flagged.length ? `${flagged.length} object${flagged.length > 1 ? 's' : ''} cross the causation threshold.` : 'No object currently crosses both thresholds.';
  $('verdict').className = flagged.length ? 'verdict hot' : 'verdict';
}

function renderFunnel() {
  const svg = $('funnel');
  const levels = [
    ['H', 'C', 'O', 'N'],
    ['CO₂', 'salt', 'lipid'],
    ['motif', 'tool', 'polymer'],
    ['cell', 'machine', 'ecosystem']
  ];
  svg.innerHTML = levels.map((lev, li) => lev.map((name, j) => {
    const x = 120 + li * 190 + (j - (lev.length-1)/2) * 40;
    const y = 300 - li * 70 + j * 28;
    const active = li < 2 || sample.some(r => r.ai > li * 12 && r.copies > 10);
    return `<g class="fnode ${active ? 'active' : ''}"><circle cx="${x}" cy="${y}" r="${18 + li*4}"/><text x="${x}" y="${y+5}">${name}</text></g>`;
  }).join('')).join('') + `
    <path d="M80 335 C230 230 410 170 720 75"/>
    <text x="78" y="370">possible</text><text x="620" y="62">observed deep lineages</text>`;
}

function findLongestNonOverlappingRepeat(s) {
  for (let len = Math.floor(s.length / 2); len >= 2; len--) {
    const seen = new Map();
    for (let i = 0; i <= s.length - len; i++) {
      const sub = s.slice(i, i + len);
      if (seen.has(sub) && i >= seen.get(sub) + len) return sub;
      if (!seen.has(sub)) seen.set(sub, i);
    }
  }
  return null;
}
function greedyAssemblyIndex(str) {
  const target = str.toUpperCase().replace(/\s+/g, '').slice(0, 64);
  const built = new Set(); const steps = [];
  const record = (l, r) => { const p = l + r; if (p.length > 1 && !built.has(p)) { built.add(p); steps.push({ p, l, r }); } return p; };
  const tokenizeBy = (s, unit) => { const out = []; let i = 0; while (i < s.length) { if (s.slice(i, i+unit.length) === unit) { out.push(unit); i += unit.length; } else { let j = s.indexOf(unit, i); if (j < 0) j = s.length; out.push(s.slice(i, j)); i = j; } } return out.filter(Boolean); };
  const build = s => {
    if (s.length <= 1 || built.has(s)) return s;
    const rep = findLongestNonOverlappingRepeat(s);
    if (rep) { build(rep); const toks = tokenizeBy(s, rep); toks.filter(t => t !== rep).forEach(build); return toks.slice(1).reduce((a, t) => record(a, t), toks[0]); }
    return s.slice(1).split('').reduce((a, ch) => record(a, ch), s[0]);
  };
  if (target) build(target);
  return { target, index: steps.length, steps };
}
function renderStringLab() {
  const result = greedyAssemblyIndex($('stringInput').value || 'REPLICATIONREPLICATION');
  $('stringAi').textContent = result.index;
  $('stringWorst').textContent = Math.max(0, result.target.length - 1);
  $('stringSteps').innerHTML = result.steps.slice(0, 18).map((s, i) => `<li><b>${i+1}</b> ${escapeHtml(s.l)} + ${escapeHtml(s.r)} → <strong>${escapeHtml(s.p)}</strong></li>`).join('') || '<li>Type a longer object/string.</li>';
}

function initSim() {
  simPop = Array.from({ length: 90 }, () => randomString(3 + Math.floor(Math.random()*4)));
  simHistory = [];
  renderSim();
}
function randomString(n) { const alphabet = 'ABCD'; return Array.from({length:n}, () => alphabet[Math.floor(Math.random()*alphabet.length)]).join(''); }
function mutate(s) { const alphabet = 'ABCD'; const r = Math.random(); if (r < .33 && s.length < 18) return s + alphabet[Math.floor(Math.random()*4)]; if (r < .66 && s.length > 2) return s.slice(0, -1); const i = Math.floor(Math.random()*s.length); return s.slice(0,i) + alphabet[Math.floor(Math.random()*4)] + s.slice(i+1); }
function simStep() {
  const motif = $('selectionMotif').value.toUpperCase().replace(/[^A-D]/g, '') || 'ABBA';
  const scored = simPop.map(s => ({ s, score: simMode === 'selection' ? 1 + (s.includes(motif) ? 8 : 0) + (s.split(motif).length - 1) * 4 : 1 }));
  const bag = scored.flatMap(o => Array(Math.round(o.score)).fill(o.s));
  simPop = Array.from({length: 90}, () => mutate(bag[Math.floor(Math.random()*bag.length)]));
  const freqs = new Map(); simPop.forEach(s => freqs.set(s, (freqs.get(s)||0)+1));
  let high = 0, copies = 0, best = '';
  for (const [s, n] of freqs) { const ai = greedyAssemblyIndex(s).index; if (ai > high) { high = ai; best = s; } if (ai >= thresholdAi && n >= 3) copies++; }
  simHistory.push({ high, copies, diversity: freqs.size, best });
  if (simHistory.length > 80) simHistory.shift();
  renderSim();
}
function renderSim() {
  const latest = simHistory.at(-1) || { high: 0, copies: 0, diversity: new Set(simPop).size, best: '—' };
  $('simStats').innerHTML = `<b>${simMode}</b> mode · diversity ${latest.diversity} · deepest AI ${latest.high} · copied deep objects ${latest.copies} · best <code>${escapeHtml(latest.best)}</code>`;
  const W = 720, H = 210, pad = 24;
  const pts = simHistory.map((d, i) => `${pad + i * ((W-2*pad)/79)},${H-pad - clamp(d.high,0,30)/30*(H-2*pad)}`).join(' ');
  const pts2 = simHistory.map((d, i) => `${pad + i * ((W-2*pad)/79)},${H-pad - clamp(d.diversity,0,90)/90*(H-2*pad)}`).join(' ');
  $('simChart').innerHTML = `<rect width="${W}" height="${H}" rx="20"/><polyline class="diversity" points="${pts2}"/><polyline points="${pts}"/><text x="30" y="35">deepest assembly index</text><text x="30" y="58" class="muted">diversity</text>`;
}
function setSimRunning(on) { if (on && !simTimer) simTimer = setInterval(simStep, 160); if (!on && simTimer) { clearInterval(simTimer); simTimer = null; } $('runSim').textContent = simTimer ? 'Pause simulation' : 'Run simulation'; }

function renderAll() { renderRows(); renderPlot(); renderMetrics(); renderFunnel(); renderStringLab(); }
function boot() {
  $('thresholdAi').addEventListener('input', e => { thresholdAi = Number(e.target.value); $('thresholdAiVal').textContent = thresholdAi; renderAll(); });
  $('thresholdCopies').addEventListener('input', e => { thresholdCopies = Number(e.target.value); $('thresholdCopiesVal').textContent = thresholdCopies; renderAll(); });
  document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => { sample = structuredClone(PRESETS[b.dataset.preset]); renderAll(); }));
  $('addObject').addEventListener('click', () => { sample.push({ name: 'new object', ai: 12, copies: 10, kind: 'unknown' }); renderAll(); });
  $('stringInput').addEventListener('input', renderStringLab);
  $('runSim').addEventListener('click', () => setSimRunning(!simTimer));
  $('stepSim').addEventListener('click', simStep);
  $('resetSim').addEventListener('click', () => { setSimRunning(false); initSim(); });
  document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { simMode = b.dataset.mode; document.querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('active', x === b)); }));
  initSim(); renderAll();
}

document.addEventListener('DOMContentLoaded', boot);
