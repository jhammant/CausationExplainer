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
function log10AssemblyOverOmega(rows) {
  const total = rows.reduce((s, r) => s + Number(r.copies || 0), 0) || 1;
  const terms = rows.filter(r => Number(r.copies || 0) > 1).map(r => Math.log(Number(r.copies || 0)) + Number(r.ai || 0));
  if (!terms.length) return 0;
  const max = Math.max(...terms);
  const logSum = max + Math.log(terms.reduce((sum, t) => sum + Math.exp(t - max), 0));
  return (logSum - Math.log(total)) / Math.LN10;
}
function epistemologicalThreshold(NT, M = 1, b = 12) {
  return Math.floor(Math.log(Math.max(1, NT / M)) / Math.log(1 + b)) - 1;
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
  const A = log10AssemblyOverOmega(sample);
  const calculatedThreshold = epistemologicalThreshold(sample.reduce((s, r) => s + Number(r.copies || 0), 0) || 1);
  const flagged = sample.filter(r => evidenceClass(r) === 'selected');
  const maxAi = Math.max(...sample.map(r => r.ai));
  const maxCopies = Math.max(...sample.map(r => r.copies));
  $('fieldScore').textContent = A.toFixed(2);
  $('deepestObject').textContent = sample.find(r => r.ai === maxAi)?.name || '—';
  $('largestCopy').textContent = fmt.format(maxCopies);
  $('verdict').textContent = flagged.length ? `${flagged.length} object${flagged.length > 1 ? 's' : ''} cross the causation threshold. Eq. 1 gives aᴹ≈${calculatedThreshold} for this sample size at b=12, M=1.` : `No object currently crosses both thresholds. Eq. 1 gives aᴹ≈${calculatedThreshold} for this sample size at b=12, M=1.`;
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




let activeFormula = 'threshold';
const FORMULA_EXPLAINERS = {
  ai: {
    title: 'Assembly index: count the shortest causal history',
    eq: 'aᵢ = n',
    why: 'This is the paper’s basic unit of causal depth. It asks: how many joins must have happened before this object could exist?',
    vars: [['aᵢ', 'assembly index for object type i'], ['n', 'number of causal joins along a shortest assembly path'], ['causal join', 'a step that combines existing parts into a new reusable part']],
    demo: 'ai'
  },
  copy: {
    title: 'Copy number: turn complexity into evidence',
    eq: 'nᵢ',
    why: 'A high assembly object found once may be a fluke. A high assembly object found many times implies persistence: a constructor, lineage, factory, or selection process.',
    vars: [['nᵢ', 'count of identical distinguishable objects'], ['object type i', 'the repeated structure being counted'], ['persistence', 'the same causal pathway keeps being instantiated']],
    demo: 'copy'
  },
  threshold: {
    title: 'Epistemological threshold: what blind search should not find',
    eq: 'aᴹ = ⌊ ln(Nᵀ/M) / ln(1+b) ⌋ − 1',
    why: 'This estimates the assembly depth above which a finite abiotic system should not produce observable copies without selection.',
    vars: [['Nᵀ', 'total number of objects/opportunities in the system'], ['M', 'measurement resolution or minimum observable abundance'], ['b', 'branching factor: how many new possibilities each causal step opens']],
    demo: 'threshold'
  },
  abiotic: {
    title: 'Abiotic expectation: copies decay exponentially with depth',
    eq: '⟨nᵢ(d)⟩ = Nᵀ e^{−(d+1)ln(1+b)}',
    why: 'As constructive depth increases, the expected number of accidental copies collapses. This is why the top-right phase-plot region matters.',
    vars: [['d', 'constructive depth / number of steps'], ['b', 'branching factor'], ['⟨nᵢ(d)⟩', 'expected copy number without selection']],
    demo: 'abiotic'
  },
  system: {
    title: 'System assembly: the whole sample as causal evidence',
    eq: 'A = Ω · 1/Nᵀ · Σ nᵢ e^{aᵢ}',
    why: 'The sample-level measure weights copied objects exponentially by assembly index. In the app we display log₁₀(A/Ω) to keep the number readable.',
    vars: [['A', 'system assembly'], ['Ω', 'assembly constant / units factor'], ['Σ nᵢ e^{aᵢ}', 'copied high-assembly objects dominate the sum']],
    demo: 'system'
  },
  time: {
    title: 'A(t): watch causation accumulate over time',
    eq: 'A(t) = Ω Σ e^{aᵢ} nᵢ(t)/Nᵀ(t)',
    why: 'The dynamic equation says assembly changes as copy numbers change. That is what the selection simulator makes visible.',
    vars: [['t', 'time'], ['nᵢ(t)', 'copy number through time'], ['Nᵀ(t)', 'total population through time']],
    demo: 'time'
  }
};

function formulaDemoHtml(kind) {
  if (kind === 'ai') {
    const r = greedyAssemblyIndex($('stringInput')?.value || 'REPLICATIONREPLICATION');
    return `<div class="formula-demo"><h3>Try it on a string</h3><p>The current string lab target has assembly index:</p><div class="formula-demo-output">aᵢ = ${r.index}</div><p class="mini">No-reuse worst case: ${Math.max(0, r.target.length - 1)} joins. Repeated sub-parts reduce the history.</p><a class="try-link" href="#strings">Open string assembly →</a></div>`;
  }
  if (kind === 'copy') {
    const rows = [...sample].sort((a,b) => b.copies - a.copies).slice(0,4);
    const max = Math.max(...rows.map(r => r.copies), 1);
    return `<div class="formula-demo"><h3>Current sample copy numbers</h3><div class="bar-stack">${rows.map(r => `<div class="bar-row"><span>${escapeHtml(r.name)}</span><i style="width:${Math.max(4, r.copies/max*100)}%"></i><b>${fmt.format(r.copies)}</b></div>`).join('')}</div><a class="try-link" href="#lab">Edit copy numbers →</a></div>`;
  }
  if (kind === 'threshold') {
    return `<div class="formula-demo"><h3>Threshold calculator</h3><label>Nᵀ total opportunities <input id="fxNT" type="range" min="2" max="12" value="6"></label><label>M measurement limit <input id="fxM" type="range" min="0" max="4" value="0"></label><label>b branching factor <input id="fxB" type="range" min="2" max="30" value="12"></label><div id="fxThresholdOut" class="formula-demo-output">—</div><p class="mini">Higher branching makes accidental deep copies harder; larger systems raise the threshold slowly.</p></div>`;
  }
  if (kind === 'abiotic') {
    return `<div class="formula-demo"><h3>Abiotic copy decay</h3><label>d constructive depth <input id="fxDepth" type="range" min="0" max="30" value="10"></label><label>b branching factor <input id="fxAbioticB" type="range" min="2" max="30" value="12"></label><div id="fxAbioticOut" class="formula-demo-output">—</div><svg id="fxAbioticChart" viewBox="0 0 560 150"></svg></div>`;
  }
  if (kind === 'system') {
    const rows = sample.filter(r => r.copies > 1).map(r => ({...r, contribution: (Math.log(r.copies) + r.ai) / Math.LN10})).sort((a,b)=>b.contribution-a.contribution).slice(0,4);
    const max = Math.max(...rows.map(r => r.contribution), 1);
    return `<div class="formula-demo"><h3>Who dominates A?</h3><p class="mini">Showing log contribution ≈ log₁₀(nᵢe^{aᵢ}).</p><div class="bar-stack">${rows.map(r => `<div class="bar-row"><span>${escapeHtml(r.name)}</span><i style="width:${Math.max(4, r.contribution/max*100)}%"></i><b>${r.contribution.toFixed(1)}</b></div>`).join('')}</div><a class="try-link" href="#lab">Change the sample →</a></div>`;
  }
  return `<div class="formula-demo"><h3>Dynamic version</h3><p>The main simulator is the interactive explanation: selection changes nᵢ(t), and therefore A(t), over time.</p><div class="formula-demo-output">A(t)</div><a class="try-link" href="#sim">Run the selection simulator →</a></div>`;
}

function renderFormulaExplainer() {
  if (!$('formulaExplainer')) return;
  const f = FORMULA_EXPLAINERS[activeFormula];
  document.querySelectorAll('.formula-pick').forEach(card => card.classList.toggle('active', card.dataset.formula === activeFormula));
  $('formulaExplainer').innerHTML = `<div class="card"><span class="pill">Interactive explainer</span><h3 style="margin-top:1rem">${escapeHtml(f.title)}</h3><div class="eq">${f.eq}</div><p>${escapeHtml(f.why)}</p><div class="formula-variables">${f.vars.map(([k,v]) => `<div><b>${escapeHtml(k)}</b><span class="mini"> ${escapeHtml(v)}</span></div>`).join('')}</div></div>${formulaDemoHtml(f.demo)}`;
  attachFormulaDemoHandlers();
}
function attachFormulaDemoHandlers() {
  const updateThreshold = () => {
    if (!$('fxThresholdOut')) return;
    const NT = 10 ** Number($('fxNT').value), M = 10 ** Number($('fxM').value), b = Number($('fxB').value);
    $('fxThresholdOut').textContent = `aᴹ = ${epistemologicalThreshold(NT, M, b)}`;
  };
  ['fxNT','fxM','fxB'].forEach(id => $(id)?.addEventListener('input', updateThreshold));
  updateThreshold();
  const updateAbiotic = () => {
    if (!$('fxAbioticOut')) return;
    const d = Number($('fxDepth').value), b = Number($('fxAbioticB').value), NT = 1e9;
    const expected = NT * Math.exp(-(d + 1) * Math.log(1 + b));
    $('fxAbioticOut').textContent = `⟨nᵢ(${d})⟩ ≈ ${expected < .001 ? expected.toExponential(1) : expected.toFixed(3)}`;
    const pts = Array.from({length:31}, (_,x) => {
      const yv = Math.log10(Math.max(1e-9, NT * Math.exp(-(x + 1) * Math.log(1 + b))));
      return `${20 + x * 17},${125 - clamp((yv + 9) / 18, 0, 1) * 105}`;
    }).join(' ');
    $('fxAbioticChart').innerHTML = `<rect width="560" height="150" rx="18" fill="#07101f"/><polyline points="${pts}" fill="none" stroke="var(--pink)" stroke-width="3"/><text x="22" y="30" fill="var(--dim)" font-family="monospace" font-size="13">expected copies vs depth</text>`;
  };
  ['fxDepth','fxAbioticB'].forEach(id => $(id)?.addEventListener('input', updateAbiotic));
  updateAbiotic();
}

const PAPER_SECTIONS = [
  {
    id: 'threshold', title: '1. The assembly threshold', hook: 'When does chemistry stop looking accidental?',
    quote: '“The physical scale of causation is quantified by the assembly index.”',
    body: 'The paper argues that a complex object only becomes strong evidence for life, technology, or another persistent cause when it is both hard to assemble and observed in copies. A single weird molecule can be luck; many copies of a high-assembly molecule imply a constructor.',
    concepts: [['Assembly index', 'Minimum recursive construction steps.', '#strings'], ['Copy number', 'How many identical objects are observed.', '#lab'], ['Threshold', 'The region where chance becomes a bad explanation.', '#lab'], ['Constructor', 'The persistent mechanism that keeps remaking the object.', '#sim']],
    tryHref: '#lab', tryText: 'Move the assembly/copy thresholds'
  },
  {
    id: 'space', title: '2. Assembly space', hook: 'The possible universe is bigger than the observed universe.',
    quote: '“Assembly space encodes causal possibilities as a physical space.”',
    body: 'Every join opens a branching set of possible objects. The paper distinguishes the vast assembly universe from the tiny subset actually observed. Life matters because it repeatedly finds and reuses paths through that space.',
    concepts: [['Assembly universe', 'Everything that could be built.', '#funnel'], ['Assembly observed', 'What actually exists in the sample.', '#lab'], ['Branching factor', 'How quickly possibilities explode.', '#formulas'], ['Lineage', 'A path selected through the possible space.', '#sim']],
    tryHref: '#funnel', tryText: 'See the causal funnel'
  },
  {
    id: 'metrology', title: '3. Metrology: measuring causation', hook: 'The big claim is not mystical — it must be measurable.',
    quote: '“Assembly theory introduces causation as a material property.”',
    body: 'The paper frames assembly as a lab metrology. For molecules, the hard version means inferring substructures from real instruments such as mass spectrometry or NMR, then estimating the shortest assembly path that explains the object.',
    concepts: [['Mass spec fragments', 'Observed pieces produced by breaking molecules.', '#molecular'], ['Graph decomposition', 'Represent a molecule as atoms and bonds.', '#molecular'], ['Virtual intermediates', 'Useful substructures on an assembly path.', '#molecular'], ['Instrument limit', 'What the measurement can and cannot resolve.', '#formulas']],
    tryHref: '#molecular', tryText: 'Open the molecular hard zone'
  },
  {
    id: 'memory', title: '4. Contingency and memory', hook: 'Copies are frozen history.',
    quote: '“Countable copies of high assembly index objects indicate a persistent mechanism.”',
    body: 'A high copy number is treated as evidence that the environment has memory. The system discovered a construction path and keeps reusing it. This is why the copy axis matters as much as the complexity axis.',
    concepts: [['Memory', 'A discovered object biases future production.', '#sim'], ['Contingency', 'History could have gone otherwise.', '#funnel'], ['Persistence', 'The cause keeps acting through time.', '#sim'], ['Evidence', 'High assembly plus copies beats either alone.', '#lab']],
    tryHref: '#sim', tryText: 'Run random vs selection'
  },
  {
    id: 'ratchet', title: '5. Selection and the ratchet', hook: 'Once something useful exists, the future changes.',
    quote: '“Determinism is emergent from selection along assembled lineages.”',
    body: 'Selection creates a ratchet. Objects that would be astronomically unlikely by blind search become stepping stones. That lets systems climb into deeper assembly space, producing novelty without requiring every step to be lucky again.',
    concepts: [['Ratchet', 'Reuse makes future complexity cheaper.', '#sim'], ['Open-endedness', 'New objects become new building blocks.', '#funnel'], ['Selection', 'Some histories are amplified.', '#sim'], ['Emergent determinism', 'Stable lineages make futures more predictable.', '#sim']],
    tryHref: '#sim', tryText: 'Toggle selection mode'
  },
  {
    id: 'critique', title: '6. What to be careful about', hook: 'The paper is ambitious, and the debate matters.',
    quote: '“The universe designs itself.”',
    body: 'The strongest app stance is honest: assembly theory is a powerful lens, but critics argue parts resemble compression or known complexity measures. The practical, testable core is narrower: high molecular assembly plus high copy number can be a biosignature-style signal.',
    concepts: [['Compression critique', 'Repeated structure can look like compression.', '#strings'], ['Substrate rules', 'Strings, molecules, and tools assemble differently.', '#molecular'], ['Approximation', 'Exact minimal assembly is hard.', '#molecular'], ['Useful core', 'Benchmark complexity plus abundance.', '#lab']],
    tryHref: '#strings', tryText: 'Compare string reuse'
  }
];

const FIGURE_ATLAS = [
  ['Fig 1', 'Taxol as a visually obvious high-assembly object.', '#molecular'],
  ['Fig 2', 'Branching causal possibilities explode with each join.', '#funnel'],
  ['Fig 3', 'Copy number vs assembly index creates a chance boundary.', '#lab'],
  ['Fig 4', 'Observed assembly is nested inside possible assembly space.', '#funnel'],
  ['Fig 5', 'A recursive pathway builds Taxol-like complexity.', '#molecular'],
  ['Fig 6', 'Measurement limits decide what evidence can be seen.', '#molecular'],
  ['Fig 7', 'Isomers can share formula but differ in assembly path.', '#molecular'],
  ['Fig 8', 'Assembly rises as selected structure accumulates.', '#sim']
];
let activePaperSection = 0;

function renderPaperCompanion() {
  if (!$('paperMenu')) return;
  $('paperMenu').innerHTML = PAPER_SECTIONS.map((sec, i) => `<button class="${i === activePaperSection ? 'active' : ''}" data-paper="${i}">${sec.title}<small>${sec.hook}</small></button>`).join('');
  $('paperMenu').querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => { activePaperSection = Number(btn.dataset.paper); renderPaperCompanion(); }));
  const sec = PAPER_SECTIONS[activePaperSection];
  $('paperPanel').innerHTML = `
    <span class="pill">Cronin & Walker · The Physics of Causation</span>
    <h3 style="margin-top:1rem">${escapeHtml(sec.title)}</h3>
    <p class="lede" style="font-size:1.2rem">${escapeHtml(sec.hook)}</p>
    <p>${escapeHtml(sec.body)}</p>
    <div class="quote">${escapeHtml(sec.quote)}</div>
    <div class="concept-grid">${sec.concepts.map(([name, text, href]) => `<a class="concept" href="${href || sec.tryHref}"><b>${escapeHtml(name)}</b><span class="mini">${escapeHtml(text)}</span><span class="jump">Open related demo →</span></a>`).join('')}</div>
    <a class="try-link" href="${sec.tryHref}">→ ${escapeHtml(sec.tryText)}</a>
  `;
  $('figureAtlas').innerHTML = FIGURE_ATLAS.map(([fig, text, href]) => `<a class="figure-tile" href="${href}"><b>${fig}</b><p class="mini">${escapeHtml(text)}</p></a>`).join('');
}

const MOLECULES = {
  benzene: {
    name: 'Benzene ring', kind: 'aromatic chemistry', baseAi: 12,
    nodes: ['C','C','C','C','C','C'], edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0]], motifs: ['ring symmetry ×6'],
    fragments: [{mz:39,label:'C3H3+'},{mz:51,label:'C4H3+'},{mz:77,label:'C6H5+'},{mz:78,label:'C6H6+'}]
  },
  caffeine: {
    name: 'Caffeine', kind: 'bioactive molecule', baseAi: 23,
    nodes: ['N','C','N','C','C','N','C','N','O','O','CH3','CH3','CH3'], edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[3,6],[6,7],[7,4],[1,8],[6,9],[0,10],[5,11],[7,12]], motifs: ['fused ring', 'three methyl repeats'],
    fragments: [{mz:55,label:'xanthine fragment'},{mz:82,label:'methyl-xanthine'},{mz:109,label:'purine core'},{mz:194,label:'molecular ion'}]
  },
  peptide: {
    name: 'Repeated peptide motif', kind: 'biological polymer', baseAi: 31,
    nodes: ['N','Cα','C','N','Cα','C','N','Cα','C','R','R','R'], edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[1,9],[4,10],[7,11]], motifs: ['peptide backbone ×3', 'side-chain repeats'],
    fragments: [{mz:72,label:'immonium ion'},{mz:147,label:'dipeptide b-ion'},{mz:218,label:'tripeptide y-ion'},{mz:329,label:'parent motif'}]
  },
  taxol: {
    name: 'Paclitaxel / Taxol-like scaffold', kind: 'high assembly natural product', baseAi: 47,
    nodes: ['A','B','C','D','E','O','O','O','Ph','Ph','Ac','N','C','O','C'], edges: [[0,1],[1,2],[2,3],[3,4],[4,0],[1,5],[2,6],[3,7],[0,8],[4,9],[5,10],[9,11],[11,12],[12,13],[13,14]], motifs: ['multi-ring scaffold', 'phenyl repeats', 'oxygenated side chain'],
    fragments: [{mz:105,label:'benzoyl cation'},{mz:286,label:'taxane core fragment'},{mz:509,label:'side-chain loss'},{mz:854,label:'molecular ion'}]
  }
};
let selectedMol = 'caffeine';

function estimateMolAi(mol) {
  const graphCost = mol.nodes.length + mol.edges.length - 1;
  const motifDiscount = mol.motifs.length * 3;
  return Math.max(1, Math.round((graphCost + mol.baseAi) / 2 - motifDiscount));
}
function parsePeaks(text) {
  return text.split(/[\s,;]+/).map(x => Number(x.trim())).filter(Number.isFinite);
}
function fragmentMatches(mol) {
  const peaks = parsePeaks($('peakInput').value);
  return mol.fragments.map(f => {
    const nearest = peaks.reduce((best, p) => Math.abs(p - f.mz) < Math.abs(best - f.mz) ? p : best, peaks[0] ?? NaN);
    const delta = Number.isFinite(nearest) ? Math.abs(nearest - f.mz) : Infinity;
    return { ...f, nearest, hit: delta <= 1.2, delta };
  });
}
function molEvidenceScore(mol) {
  const ai = estimateMolAi(mol);
  const copies = Number($('molCopies')?.value || 1);
  const confidence = Number($('molConfidence')?.value || 50) / 100;
  const matches = fragmentMatches(mol);
  const fragmentScore = matches.filter(m => m.hit).length / matches.length;
  return Math.round((ai * 1.7 + log10(copies) * 12 + fragmentScore * 30) * confidence);
}
function renderMolButtons() {
  $('molButtons').innerHTML = Object.entries(MOLECULES).map(([key, mol]) => `<button data-mol="${key}" class="${key === selectedMol ? 'active' : ''}"><b>${mol.name}</b><span class="mini">${mol.kind} · motifs: ${mol.motifs.join(', ')}</span></button>`).join('');
  $('molButtons').querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => { selectedMol = btn.dataset.mol; loadStrongPeaks(); renderMol(); }));
}
function renderMolGraph(mol) {
  const W = 620, H = 360, cx = W/2, cy = H/2;
  const coords = mol.nodes.map((_, i) => {
    const angle = (Math.PI * 2 * i / mol.nodes.length) - Math.PI/2;
    const radius = 105 + (i % 3) * 24;
    return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
  });
  $('molGraph').innerHTML = `<rect width="${W}" height="${H}" rx="24" fill="#07101f"/>` +
    mol.edges.map(([a,b]) => `<line x1="${coords[a][0]}" y1="${coords[a][1]}" x2="${coords[b][0]}" y2="${coords[b][1]}"/>`).join('') +
    mol.nodes.map((n,i) => `<g><circle cx="${coords[i][0]}" cy="${coords[i][1]}" r="20"/><text x="${coords[i][0]}" y="${coords[i][1]}">${escapeHtml(n)}</text></g>`).join('') +
    `<text x="24" y="32" style="text-anchor:start;fill:var(--dim);font:700 14px var(--mono)">${escapeHtml(mol.name)}</text>`;
}
function renderFragments(mol) {
  const matches = fragmentMatches(mol);
  $('fragmentTable').innerHTML = matches.map(m => `<div class="fragment-row"><span>${escapeHtml(m.label)}</span><span>${m.mz.toFixed(1)} m/z</span><span class="${m.hit ? 'hit' : 'miss'}">${m.hit ? 'hit' : 'miss'}</span></div>`).join('');
  const hits = matches.filter(m => m.hit).length;
  $('peakSummary').textContent = `${hits}/${matches.length} expected fragments matched. ${hits >= 3 ? 'Strong fragment support for this assembly estimate.' : hits >= 2 ? 'Partial support; useful but not definitive.' : 'Weak support; this would need better spectra or a different structure.'}`;
  $('peakSummary').className = hits >= 3 ? 'verdict hot' : 'verdict';
}
function renderMol() {
  if (!$('molButtons')) return;
  const mol = MOLECULES[selectedMol];
  renderMolButtons();
  renderMolGraph(mol);
  renderFragments(mol);
  const ai = estimateMolAi(mol);
  const copies = Number($('molCopies').value);
  $('molAi').textContent = ai;
  $('molCopyLabel').textContent = fmt.format(copies);
  $('molEvidence').textContent = molEvidenceScore(mol);
}
function loadStrongPeaks() {
  const mol = MOLECULES[selectedMol];
  $('peakInput').value = mol.fragments.map(f => (f.mz + (Math.random() - .5) * .7).toFixed(2)).join(', ');
}
function loadNoisyPeaks() {
  const mol = MOLECULES[selectedMol];
  const noise = [31.1, 44.0, 63.3, 91.2, 120.4, 171.8, 260.5, 410.2];
  $('peakInput').value = [mol.fragments[0].mz.toFixed(2), ...noise].join(', ');
}
function addMolToSample() {
  const mol = MOLECULES[selectedMol];
  sample.push({ name: mol.name, ai: estimateMolAi(mol), copies: Number($('molCopies').value), kind: mol.kind });
  renderAll();
  location.hash = '#lab';
}

function renderAll() { renderRows(); renderPlot(); renderMetrics(); renderFunnel(); renderStringLab(); renderFormulaExplainer(); renderPaperCompanion(); renderMol(); }
function boot() {
  const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('visible'); }), { threshold: 0.12 });
  document.querySelectorAll('.card, .paper-note, .metric, .snippet-card, .formula-card, .figure-tile, .concept, .pipeline li').forEach((el, i) => { el.classList.add('reveal'); el.style.transitionDelay = `${Math.min(i % 6, 5) * 35}ms`; revealObserver.observe(el); });
  $('thresholdAi').addEventListener('input', e => { thresholdAi = Number(e.target.value); $('thresholdAiVal').textContent = thresholdAi; renderAll(); });
  $('thresholdCopies').addEventListener('input', e => { thresholdCopies = Number(e.target.value); $('thresholdCopiesVal').textContent = thresholdCopies; renderAll(); });
  document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => { sample = structuredClone(PRESETS[b.dataset.preset]); renderAll(); }));
  $('addObject').addEventListener('click', () => { sample.push({ name: 'new object', ai: 12, copies: 10, kind: 'unknown' }); renderAll(); });
  $('stringInput').addEventListener('input', () => { renderStringLab(); if (activeFormula === 'ai') renderFormulaExplainer(); });
  document.querySelectorAll('.formula-pick').forEach(card => { card.addEventListener('click', (e) => { if (e.target.closest('a')) return; activeFormula = card.dataset.formula; renderFormulaExplainer(); }); card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activeFormula = card.dataset.formula; renderFormulaExplainer(); } }); });
  if ($('peakInput')) { loadStrongPeaks(); $('peakInput').addEventListener('input', renderMol); $('molCopies').addEventListener('input', renderMol); $('molConfidence').addEventListener('input', renderMol); $('loadGoodPeaks').addEventListener('click', () => { loadStrongPeaks(); renderMol(); }); $('loadNoisyPeaks').addEventListener('click', () => { loadNoisyPeaks(); renderMol(); }); $('addMolToSample').addEventListener('click', addMolToSample); }
  $('runSim').addEventListener('click', () => setSimRunning(!simTimer));
  $('stepSim').addEventListener('click', simStep);
  $('resetSim').addEventListener('click', () => { setSimRunning(false); initSim(); });
  document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { simMode = b.dataset.mode; document.querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('active', x === b)); }));
  initSim(); renderAll();
}

document.addEventListener('DOMContentLoaded', boot);
