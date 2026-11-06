// The hero's second layer: one day on an Apple Watch and an iPhone, the same story and the same pixel language as the
// launch film (launch/video/src/pixel). Everything is a pure function of the demo clock `t`, like a film frame, so the
// steps can jump anywhere and the loop is seamless.
//
//   1 · Wear it   the Watch hears three things you say during the day, in your language
//   2 · Read it   tonight they stream to the iPhone, and each one lifts off and becomes natural English
//   3 · Say it    you say one out loud, every word is checked, and it moves to Learned
//
// Rule from the app: pixels only carry motion; whatever comes to rest is a vector.
(() => {
const root = document.getElementById('l1');
if (!root) return;
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- math (px.ts) ----------
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const ramp = (t, a, b) => clamp01((t - a) / (b - a));
const mix = (a, b, t) => a + (b - a) * t;
const E = {
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inCubic: t => t * t * t,
  inOutCubic: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  outQuint: t => 1 - Math.pow(1 - t, 5),
  inOutQuint: t => t < .5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2,
  inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: t => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
};
const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16);
const bayer = (x, y) => BAY[((y & 3) << 2) + (x & 3)];
const hash = (a, b = 0) => {
  let h = Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b); h = Math.imul(h ^ (h >>> 16), 0x45d9f3b); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
const pxTime = t => Math.floor(t * 15 + 1e-6) / 15;

// ---------- copy ----------
const EN_FONT = 'system-ui, -apple-system, "SF Pro Text", Inter, sans-serif';
const DAY = {
  ja: {
    html: 'ja', fam: '"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif',
    said: [
      { time: '08:10', place: 'Commute', said: '電車止まってる、ちょっと遅れる！', en: 'Running late, the train stopped!' },
      { time: '12:40', place: 'Lunch', said: '授業のあと、ご飯行かない？', en: 'Wanna grab food after class?' },
      { time: '21:20', place: 'Friends', said: '週末は家でゴロゴロしてるかな。', en: 'I mostly just chill on weekends.' },
    ],
    learned: 'さっき撮った写真、送って！',
    steps: { wear: '会話のときだけ、一日を聞き取る。', read: '夜には、自分の言葉が自然な英語に。', say: '声に出して。一語ずつチェック。' },
  },
  ko: {
    html: 'ko', fam: '"Apple SD Gothic Neo","Noto Sans KR",sans-serif',
    said: [
      { time: '08:30', place: 'Café', said: '아이스 아메리카노 하나 주세요.', en: 'One iced Americano, please.' },
      { time: '12:40', place: 'Lunch', said: '수업 끝나고 밥 먹으러 갈래?', en: 'Wanna grab food after class?' },
      { time: '21:20', place: 'Home', said: '오늘 진짜 피곤하다, 일찍 자야지.', en: 'So tired today. Sleeping early.' },
    ],
    learned: '아까 찍은 사진 보내줘!',
    steps: { wear: '대화할 때만, 하루를 듣습니다.', read: '저녁에는 내가 한 말이 자연스러운 영어로.', say: '소리 내어 말해 보기. 한 단어씩 확인.' },
  },
  tc: {
    html: 'zh-Hant-TW', fam: '"PingFang TC","Noto Sans TC",sans-serif',
    said: [
      { time: '09:00', place: 'Office', said: '等一下要開會，晚點回你。', en: 'In a meeting soon, text you later.' },
      { time: '12:40', place: 'Lunch', said: '下課要不要去吃東西？', en: 'Wanna grab food after class?' },
      { time: '21:20', place: 'Friends', said: '我最近超迷爬山的。', en: "I'm really into hiking lately." },
    ],
    learned: '剛剛拍的照片傳給我！',
    steps: { wear: '有人說話時，才聽見你的一天。', read: '晚上，你說過的話變成道地英文。', say: '大聲說出來，每個字都幫你確認。' },
  },
};
const LEARNED_EN = 'Send me that pic you took earlier.';
/** The practice sentence is the film's: same words, same voice, word starts from launch/video/src/pixel/voice.json. */
const PRACTICE = 1;
const WORDS = [['Wanna', 0, .28], ['grab', .32, .6], ['food', .64, .95], ['after', 1.0, 1.17], ['class?', 1.2, 1.72]];

// ---------- timeline (seconds) ----------
const SP = [.7, 2.25, 3.8], SPK = 1.15;         // each thing said, and how long it takes
const STEP = [0, 5.3, 10.8], END = 18.2;
const EVE = 5.6;                                 // the clock reaches the evening
const DISS = k => 5.65 + k * .28;                // a bubble breaks into pixels and streams to the iPhone
const WRITE = k => DISS(k) + .62;                // the row starts writing as the first pixels land
const WRITE_LEN = .5;
const LIFT = k => 7.15 + k * 1.0;                // the row lifts off as a card
const CV = k => LIFT(k) + .38;                   // its pixels fly into the English line
const DOWN = k => LIFT(k) + 1.2;                 // and it goes back
const DONE = k => DOWN(k) + .42;
const TAP = 11.0, PRESENT = 11.2, EN_AT = 12.3, CHECKED = EN_AT + 1.95, DISMISS = 15.15, MOVE = 15.55;
const wordAt = i => EN_AT + WORDS[i][1];

// ---------- geometry ----------
const GEO = {
  wide: { W: 860, H: 640, w: { x: 200, y: 404, s: .56 }, p: { x: 652, y: 320 }, bub: { x: 14, bottom: 236 }, lift: { x: 512, w: 404 } },
  tall: { W: 520, H: 830, w: { x: 112, y: 334, s: .42 }, p: { x: 364, y: 508 }, bub: { x: 10, bottom: 186 }, lift: { x: 262, w: 424 } },
};
const BH = 50, BGAP = 8;
const ROWW = 264, ROWH = 54, LIST_Y = 278, ROWX = 36, TEXTW = 216;
const SCR = { w: 288, h: 616 };
// Watch wave (TwicyWatch/SoundWave.swift): 47 columns, 11 rows, one column every 90 ms, newest on the right.
const COLS = 47, CELL = 6, WAVE = { x: -141, y: 79 };

// ---------- pixels from text (px.ts textCells) ----------
const cellCache = new Map();
const scratch = document.createElement('canvas');
const sctx = scratch.getContext('2d', { willReadFrequently: true });
const textCells = (text, family, weight, px, threshold = .42, ss = 4) => {
  const key = `${text}|${family}|${weight}|${px}|${threshold}`;
  const hit = cellCache.get(key); if (hit) return hit;
  const f = `${weight} ${px * ss}px ${family}`;
  sctx.font = f;
  const m = sctx.measureText(text);
  const pad = 2 * ss, asc = Math.ceil(m.actualBoundingBoxAscent || px * ss), desc = Math.ceil(m.actualBoundingBoxDescent || px * ss * .3);
  const W = Math.ceil((Math.ceil(m.width) + pad * 2) / ss) * ss, H = Math.ceil((asc + desc + pad * 2) / ss) * ss;
  scratch.width = W; scratch.height = H;
  sctx.font = f; sctx.fillStyle = '#fff'; sctx.textBaseline = 'alphabetic';
  const ox = pad, oy = Math.ceil((pad + asc) / ss) * ss;
  sctx.fillText(text, ox, oy);
  const img = sctx.getImageData(0, 0, W, H).data, cw = W / ss, ch = H / ss;
  const xs = [], ys = [];
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    let s = 0;
    for (let j = 0; j < ss; j++) for (let i = 0; i < ss; i++) s += img[((y * ss + j) * W + x * ss + i) * 4 + 3];
    if (s / (255 * ss * ss) >= threshold) { xs.push(x - ox / ss); ys.push(y - oy / ss); }
  }
  let minX = Infinity, maxX = -Infinity; for (const x of xs) { if (x < minX) minX = x; if (x > maxX) maxX = x; }
  const out = { xs, ys, n: xs.length, minX, maxX };
  cellCache.set(key, out);
  return out;
};
const measure = (text, font) => { sctx.font = font; return sctx.measureText(text).width; };

// ---------- build the stage ----------
const stage = $('#dstage');
const mark = '<svg><use href="#mark"/></svg>';
stage.innerHTML = `
<div class="sbox" id="sbox">
  <div class="dp" id="dp">
    <i class="pb" style="top:112px;height:22px"></i><i class="pb" style="top:150px;height:42px"></i><i class="pb" style="top:200px;height:42px"></i>
    <i class="pb" style="left:298px;top:166px;height:66px"></i>
    <div class="fr"></div><div class="bz"></div>
    <div class="pscr" id="pscr">
      <b class="stt" id="pclk">8:04</b>
      <svg class="sti" width="58" height="11" viewBox="0 0 80 14"><rect x="0" y="10" width="3.4" height="4" rx="1"/><rect x="5" y="7" width="3.4" height="7" rx="1"/><rect x="10" y="4" width="3.4" height="10" rx="1"/><rect x="15" y="1" width="3.4" height="13" rx="1"/><path d="M30 5.5a10 10 0 0 1 13 0l-1.6 1.7a7.6 7.6 0 0 0-9.8 0zM33.2 8.8a5.4 5.4 0 0 1 6.6 0L36.5 12.3z"/><rect x="52" y="2" width="22" height="11" rx="3.4" fill="none" stroke="#000" stroke-opacity=".4"/><rect x="54" y="4" width="15" height="7" rx="2"/></svg>
      <i class="isl"></i>
      <div class="hd">${mark}<span>Hi Twicy!</span></div>
      <div class="dt">Today <span>Nov 6</span></div>
      <div class="card rc">
        <svg class="rings" width="88" height="88" viewBox="0 0 88 88"><circle cx="44" cy="44" r="36" stroke="#ececee" stroke-width="11" fill="none"/><circle cx="44" cy="44" r="22" stroke="#e6e6e8" stroke-width="11" fill="none"/><circle id="ring2" cx="44" cy="44" r="22" stroke="#000" stroke-width="11" fill="none" stroke-linecap="round" stroke-dasharray="0 200" transform="rotate(-90 44 44)"/></svg>
        <div class="pill learn" id="plearn"><span><i></i>Learn</span><span id="nlearn">0</span></div>
        <div class="pill rev"><span><i></i>Review</span><span></span></div>
        <div class="pill wan"><span><i></i>Wander</span><svg width="13" height="11" viewBox="0 0 16 14"><path d="M1 3h3l7 8h4M1 11h3l2-2.3M9 5.3L11 3h4M13 1l2 2-2 2M13 9l2 2-2 2" stroke="#000" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        <i class="ln"></i>
        <div class="live"><span class="eq" id="peq">${Array.from({ length: 9 }, (_, i) => `<i style="left:${(i % 3) * 3.3}px;top:${9 - 2.2 - Math.floor(i / 3) * 3.3}px"></i>`).join('')}</span><span>Listening</span></div>
        <span class="ago">just now</span>
      </div>
      <div class="lh" id="lh1">To learn <span id="ntl">0</span></div>
      <div class="card" id="lc">${[0, 1, 2].map(k => `<div class="rw${k ? '' : ' first'}" id="rw${k}"><i class="ic"></i><i class="sk"></i><b class="nb"></b><b class="en"></b><span class="na"></span></div>`).join('')}</div>
      <div class="lh" id="lh2">Learned <span id="nld">1</span></div>
      <div class="card" id="ldc">
        <div class="rw first" id="rwn"><i class="ic done"><svg width="9" height="9" viewBox="0 0 12 12"><path d="M2.8 6.2l2.2 2.1 4.2-4.6" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></i><b class="en"></b><span class="na"></span></div>
        <div class="rw" id="rwo"><i class="ic done"><svg width="9" height="9" viewBox="0 0 12 12"><path d="M2.8 6.2l2.2 2.1 4.2-4.6" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></i><b class="en"></b><span class="na"></span></div>
      </div>
      <div class="tab"><i></i>
        <svg style="left:22px" width="17" height="17" viewBox="0 0 22 22"><circle cx="11" cy="11" r="9"/><circle cx="11" cy="11" r="5" fill="none" stroke="#fff" stroke-width="2"/></svg>
        <svg style="left:82px" width="17" height="17" viewBox="0 0 22 22"><rect x="3" y="4" width="16" height="1.8" rx=".9"/><rect x="3" y="8" width="12" height="1.8" rx=".9"/><rect x="3" y="12" width="16" height="1.8" rx=".9"/><rect x="3" y="16" width="10" height="1.8" rx=".9"/></svg>
        <svg style="left:142px" width="17" height="17" viewBox="0 0 22 22" fill="none" stroke="#000" stroke-width="1.8" stroke-linecap="round"><path d="M4.5 11a7 7 0 1 0 2-5"/><path d="M3 4.5v3.2h3.2"/><path d="M11 7v4.4l2.8 1.8"/></svg>
      </div>
      <i class="tap" id="ptap"></i>
      <div class="sheet" id="sheet">
        <span class="sx">×</span><span class="se">Say it out loud</span>
        <p class="sn" id="sn"></p>
        <p class="sw" id="sw">${WORDS.map(w => `<span class="wd">${w[0]}<i class="ck"></i></span>`).join(' ')}</p>
        <p class="sm" id="sm"></p>
      </div>
      <i class="dim" id="pdim"></i>
    </div>
  </div>
  <div class="dw" id="dw">
    <i class="band t"></i><i class="band b"></i><i class="crown"></i><i class="side"></i>
    <div class="case"></div>
    <div class="glass"><div class="scr">
      <b class="clk" id="wclk">8:04</b>
      <svg class="ring" width="400" height="480"><defs><linearGradient id="wring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#8a8a8e"/><stop offset="1" stop-color="#fff"/></linearGradient></defs><circle cx="200" cy="200" r="92" fill="none" stroke="#1c1c1e" stroke-width="9"/><circle id="wr" cx="200" cy="200" r="92" fill="none" stroke="url(#wring)" stroke-width="9" stroke-linecap="round" transform="rotate(-90 200 200)"/></svg>
      <b class="tmr" id="wtmr">0:09</b><span class="tdy">Today</span><span class="lst">Listening</span>
    </div></div>
    <i class="hit" id="whit" title="Start the day again"></i>
  </div>
  <div id="bubs">${[0, 1, 2].map(k => `<div class="bub" id="bub${k}"><span class="bt"></span><span class="bs"></span></div>`).join('')}</div>
  <canvas id="cInk"></canvas>
  <canvas id="cGlow"></canvas>
  <canvas id="cBloom" class="bloom"></canvas>
</div>`;

const el = id => document.getElementById(id);
const sbox = el('sbox'), dp = el('dp'), dw = el('dw'), pscr = el('pscr');
const cInk = el('cInk'), cGlow = el('cGlow'), cBloom = el('cBloom');
const ink = cInk.getContext('2d'), glow = cGlow.getContext('2d'), bloom = cBloom.getContext('2d');
const rows = [0, 1, 2].map(k => {
  const r = el('rw' + k);
  return { el: r, ic: $('.ic', r), sk: $('.sk', r), nb: $('.nb', r), en: $('.en', r), na: $('.na', r) };
});
const bubs = [0, 1, 2].map(k => ({ el: el('bub' + k), bt: $('.bt', el('bub' + k)), bs: $('.bs', el('bub' + k)) }));
const words = $$('.wd', el('sw')), checks = $$('.ck', el('sw'));
const eqCells = $$('i', el('peq'));
const stepLis = $$('#dsteps li'), stepBars = $$('#dsteps .bar b');
const R2C = 2 * Math.PI * 22, WRC = 2 * Math.PI * 92;

// ---------- language ----------
let lang = 'ja', D = DAY.ja, fit = [];
const pickLang = () => {
  try { const v = localStorage.getItem('twicy-demo-lang'); if (DAY[v]) return v; } catch (e) {}
  for (const l of navigator.languages || [navigator.language || '']) {
    const s = l.toLowerCase();
    if (s.startsWith('ja')) return 'ja';
    if (s.startsWith('ko')) return 'ko';
    if (s.startsWith('zh-tw') || s.startsWith('zh-hant') || s.startsWith('zh-hk')) return 'tc';
  }
  return 'ja';
};
const fitSize = (text, font, size, w) => Math.min(size, size * w / Math.max(1, measure(text, `${font.w} ${size}px ${font.f}`)));
let plans = [];
const setLang = l => {
  lang = l; D = DAY[l];
  $$('#dlangs button').forEach(b => b.classList.toggle('on', b.dataset.l === l));
  $$('#dsteps .n').forEach(n => { n.textContent = D.steps[n.dataset.k]; n.lang = D.html; });
  // Every line fits its row: the size shrinks a little rather than truncating.
  fit = D.said.map(s => ({
    nb: fitSize(s.said, { w: 500, f: D.fam }, 13.5, TEXTW),
    en: fitSize(s.en, { w: 600, f: EN_FONT }, 13.5, TEXTW),
    na: fitSize(s.said, { w: 400, f: D.fam }, 10.5, TEXTW),
  }));
  D.said.forEach((s, k) => {
    const r = rows[k], f = fit[k];
    r.nb.textContent = s.said; r.nb.lang = D.html; r.nb.style.fontFamily = D.fam; r.nb.style.fontSize = f.nb + 'px';
    r.en.textContent = s.en; r.en.style.fontSize = f.en + 'px';
    r.na.textContent = s.said; r.na.lang = D.html; r.na.style.fontFamily = D.fam; r.na.style.fontSize = f.na + 'px';
    r.sk.style.width = Math.min(TEXTW, measure(s.said, `500 ${f.nb}px ${D.fam}`)) * .8 + 'px';
    const b = bubs[k];
    b.bt.textContent = `${s.time} · ${s.place}`;
    b.bs.textContent = s.said; b.bs.lang = D.html; b.bs.style.fontFamily = D.fam;
  });
  const pr = D.said[PRACTICE], pf = fit[PRACTICE];
  for (const [id, en, na] of [['rwn', pr.en, pr.said], ['rwo', LEARNED_EN, D.learned]]) {
    const r = el(id), e = $('.en', r), n = $('.na', r);
    e.textContent = en; e.style.fontSize = fitSize(en, { w: 600, f: EN_FONT }, 13.5, TEXTW) + 'px';
    n.textContent = na; n.lang = D.html; n.style.fontFamily = D.fam; n.style.fontSize = fitSize(na, { w: 400, f: D.fam }, 10.5, TEXTW) + 'px';
  }
  el('sn').textContent = pr.said; el('sn').lang = D.html; el('sn').style.fontFamily = D.fam;
  el('sn').style.fontSize = Math.min(13.5, fitSize(pr.said, { w: 400, f: D.fam }, 13.5, 250)) + 'px';
  void pf;
  plans = D.said.map((s, k) => plan(k));
  try { localStorage.setItem('twicy-demo-lang', l); } catch (e) {}
  measureBubbles();
};

/** The flights for row k's card: every pixel of what you said goes to a pixel of the English, left to right. */
function plan(k) {
  const s = D.said[k], f = fit[k], P = 9;
  const nat = textCells(s.said, D.fam, 500, P), en = textCells(s.en, EN_FONT, 600, P);
  const cn = f.nb / P, ce = f.en / P;
  const nSpan = nat.maxX - nat.minX + 1, eSpan = en.maxX - en.minX + 1;
  const src = [], tg = [];
  for (let i = 0; i < nat.n; i++) src.push({ x: ROWX + nat.xs[i] * cn, y: 33 + nat.ys[i] * cn, xn: (nat.xs[i] - nat.minX) / nSpan, i });
  for (let i = 0; i < en.n; i++) tg.push({ x: ROWX + en.xs[i] * ce, y: 23.5 + en.ys[i] * ce, bx: en.xs[i], by: en.ys[i], xn: (en.xs[i] - en.minX) / eSpan });
  src.sort((a, b) => a.xn - b.xn || hash(a.i, 1) - hash(b.i, 1));
  tg.sort((a, b) => a.xn - b.xn || a.y - b.y);
  // Enough sources for every target, so the English comes out whole.
  const n = Math.max(src.length, tg.length);
  const fl = [];
  for (let i = 0; i < n; i++) {
    const a = src[Math.min(src.length - 1, Math.floor(i * src.length / n))];
    const g = tg[Math.min(tg.length - 1, Math.floor(i * tg.length / n))];
    fl.push({ sx: a.x, sy: a.y, tx: g.x, ty: g.y, bx: g.bx, by: g.by, at: CV(k) + .04 + g.xn * .32 + hash(i, 2 + k) * .08,
      mx: (a.x + g.x) / 2 + (hash(i, 3) - .5) * 26, my: (a.y + g.y) / 2 - 8 - hash(i, 4) * 14, cs: mix(cn, ce, .5) });
  }
  return { fl, cs: ce };
}

// ---------- layout ----------
let G = GEO.wide, scale = 1, dpr = 1;
const bubBox = [];
function measureBubbles() {
  bubs.forEach((b, k) => { bubBox[k] = { w: b.el.offsetWidth, tx: b.bs.offsetLeft, ty: b.bs.offsetTop, tw: b.bs.offsetWidth, th: b.bs.offsetHeight }; });
}
function layout() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  G = w / h >= 1.02 ? GEO.wide : GEO.tall;
  scale = Math.min(w / G.W, h / G.H);
  dpr = Math.min(devicePixelRatio || 1, 2);
  sbox.style.width = G.W + 'px'; sbox.style.height = G.H + 'px';
  // A tall stage sits a little high, under the steps; a wide one is centred beside them.
  sbox.style.transform = `translate(${(w - G.W * scale) / 2}px, ${(h - G.H * scale) * (G === GEO.tall ? .3 : .5)}px) scale(${scale})`;
  dp.style.left = G.p.x - 150 + 'px'; dp.style.top = G.p.y - 314 + 'px';
  dw.style.left = G.w.x + 'px'; dw.style.top = G.w.y + 'px'; dw.style.transform = `scale(${G.w.s})`;
  for (const [c, k] of [[cInk, 1], [cGlow, 1], [cBloom, .5]]) {
    c.width = Math.round(G.W * scale * dpr * k); c.height = Math.round(G.H * scale * dpr * k);
    c.style.width = G.W + 'px'; c.style.height = G.H + 'px';
  }
  measureBubbles();
  frame(clock());
}

// ---------- stage coordinates ----------
const scrX = () => G.p.x - 144, scrY = () => G.p.y - 308;
const rowRect = k => ({ x: scrX() + 12, y: scrY() + LIST_Y + k * ROWH, w: ROWW, h: ROWH });
const waveCell = (c, r) => ({ x: G.w.x + (WAVE.x + c * CELL) * G.w.s, y: G.w.y + (WAVE.y + r * CELL) * G.w.s });

// ---------- the day ----------
const toMin = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
/** The time on the Watch and the iPhone: it fast-forwards through the day and holds while you talk. */
function dayClock(t) {
  const m = D.said.map(s => toMin(s.time));
  const keys = [[0, m[0] - 6], [SP[0], m[0]], [SP[0] + SPK, m[0] + 1], [SP[1], m[1]], [SP[1] + SPK, m[1] + 1], [SP[2], m[2]], [SP[2] + SPK, m[2] + 1], [EVE, 21 * 60 + 40]];
  if (t >= EVE) return 21 * 60 + 40 + (t - EVE) / 6;
  for (let i = 1; i < keys.length; i++) if (t < keys[i][0]) return mix(keys[i - 1][1], keys[i][1], E.inOutSine(ramp(t, keys[i - 1][0], keys[i][0])));
  return keys[keys.length - 1][1];
}
const hm = m => `${Math.floor(m / 60) % 24}:${String(Math.floor(m % 60)).padStart(2, '0')}`;

/** Loudness 0…1 of the wave sample taken at time `tau`: only when someone is talking. */
function level(tau) {
  if (tau < 0 || tau > STEP[1] + .2) return 0;
  for (let k = 0; k < 3; k++) {
    const u = tau - SP[k];
    if (u < -.04 || u > SPK) continue;
    const syl = Math.floor(u / .11);
    const env = Math.min(1, ramp(u, -.04, .1) * 1.4) * (1 - ramp(u, SPK - .2, SPK));
    return clamp01(env * (.28 + .72 * hash(syl, k + 7)) * (.6 + .4 * Math.abs(Math.sin(u * 23 + k))));
  }
  // Someone nearby, now and then: a few quiet columns.
  const ph = Math.floor(tau / .5);
  return hash(ph, 31) > .82 && tau < STEP[1] ? .12 * hash(Math.floor(tau / .09), 5) : 0;
}

// ---------- drawing ----------
function drawWave(ctx, t) {
  const k0 = Math.floor(pxTime(t) / .09), pix = CELL - 1;
  const quiet = ramp(t, STEP[1] + .6, STEP[1] + 1.4) * (1 - ramp(t, END - .5, END));
  ctx.save();
  ctx.translate(G.w.x + WAVE.x * G.w.s, G.w.y + WAVE.y * G.w.s);
  ctx.scale(G.w.s, G.w.s);
  for (let c = 0; c < COLS; c++) {
    const lv = level((k0 - (COLS - 1 - c)) * .09);
    const h = Math.round(lv * 5);
    const age = .3 + .7 * (c + 1) / COLS;
    for (let r = -h; r <= h; r++) {
      const b = r === 0 && h === 0 ? .4 : .55 + .45 * lv * (1 - Math.abs(r) / 6);
      ctx.fillStyle = `rgba(255,255,255,${b * age * (1 - .45 * quiet)})`;
      ctx.fillRect(c * CELL, (5 + r) * CELL, pix, pix);
    }
  }
  ctx.restore();
}

/** A ragged column of pixels riding the front of a wipe. */
function pixelEdge(ctx, x, top, h, t, seed, color, cell = 2.4) {
  const step = Math.floor(pxTime(t) * 15), n = Math.floor(h / cell);
  ctx.fillStyle = color;
  for (let j = 0; j < n; j++) {
    const r = hash(j + seed * 31, step);
    if (r < .35) continue;
    ctx.globalAlpha = .4 + .6 * r;
    ctx.fillRect(x + Math.floor(hash(j, step + seed) * 3) * cell - cell, top + j * cell, cell * .85, cell * .85);
  }
  ctx.globalAlpha = 1;
}

const bubPos = (k, t) => {
  let push = 0;
  for (let j = k + 1; j < 3; j++) push += E.outCubic(ramp(t, SP[j], SP[j] + .35));
  return { x: G.bub.x, y: G.bub.bottom - BH - push * (BH + BGAP) };
};

// The stream: each bubble's pixels arc over to the iPhone and land on the front of the row being written.
const PER = 30;
function streamPos(k, j, t) {
  const b = bubBox[k] || { tx: 12, ty: 21, tw: 160, th: 22 }, p = bubPos(k, DISS(k));
  const n = k * PER + j;
  const sx = p.x + b.tx + hash(n, 1) * b.tw, sy = p.y + b.ty + 4 + hash(n, 2) * (b.th - 8);
  const rr = rowRect(k), f = j / (PER - 1);
  const natW = Math.min(TEXTW, measure(D.said[k].said, `500 ${fit[k].nb}px ${D.fam}`));
  const tx = rr.x + ROWX + f * natW, ty = rr.y + 27 + (hash(n, 3) - .5) * 8;
  const dep = DISS(k) + hash(n, 4) * .12, arr = WRITE(k) + f * WRITE_LEN;
  const u = E.inOutCubic(ramp(t, dep, arr));
  const cx = (sx + tx) / 2, cy = Math.min(sy, ty) - 50 - 70 * hash(n, 5);
  return { x: (1 - u) ** 2 * sx + 2 * (1 - u) * u * cx + u * u * tx, y: (1 - u) ** 2 * sy + 2 * (1 - u) * u * cy + u * u * ty, u, dep, arr };
}
function drawStream(ctx, t) {
  for (let k = 0; k < 3; k++) {
    if (t < DISS(k) || t > WRITE(k) + WRITE_LEN + .3) continue;
    for (let j = 0; j < PER; j++) {
      const p = streamPos(k, j, t);
      if (t < p.dep || t > p.arr + .2) continue;
      if (p.u >= 1) {
        const q = ramp(t, p.arr, p.arr + .2), s = 2 + 4 * q;
        ctx.fillStyle = `rgba(0,0,0,${.45 * (1 - q)})`; ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
        continue;
      }
      const size = mix(3, 1.8, p.u) + Math.sin(Math.PI * p.u) * 3.5;
      const g = Math.round(mix(255, 20, ramp(p.u, .84, .97)));
      for (let m = 4; m >= 0; m--) {
        const tt = t - m * .016; if (tt < p.dep) continue;
        const q = m ? streamPos(k, j, tt) : p, s = size * (1 - m * .12);
        ctx.fillStyle = `rgba(${g},${g},${g},${m ? .3 * (1 - m / 5) : 1})`;
        ctx.fillRect(q.x - s / 2, q.y - s / 2, s, s);
      }
    }
  }
}

function ringIcon(ctx, x, y, half) {
  ctx.lineWidth = 1.6; ctx.strokeStyle = '#8e8e93';
  ctx.beginPath(); ctx.arc(x, y, 5.2, 0, Math.PI * 2); ctx.stroke();
  if (half > 0) { ctx.save(); ctx.beginPath(); ctx.arc(x, y, 4.4, 0, Math.PI * 2); ctx.clip(); ctx.globalAlpha = half; ctx.fillStyle = '#8e8e93'; ctx.fillRect(x - 6, y - 6, 6, 12); ctx.restore(); }
}

/** Row k as a card: it lifts off the list, what you said turns to pixels, they fly into the English, it goes back. */
function drawCard(ctx, k, t) {
  if (t < LIFT(k) || t >= DONE(k)) return;
  const up = E.inOutQuint(ramp(t, LIFT(k), LIFT(k) + .4)), down = E.inOutQuint(ramp(t, DOWN(k), DONE(k)));
  const a = up * (1 - down);
  const r0 = rowRect(k), lw = G.lift.w, lh = ROWH * lw / ROWW;
  const r1 = { x: G.lift.x - lw / 2, y: r0.y + ROWH / 2 - lh / 2 - 26, w: lw, h: lh };
  const x = mix(r0.x, r1.x, a), y = mix(r0.y, r1.y, a), w = mix(r0.w, r1.w, a), h = mix(r0.h, r1.h, a), sc = w / ROWW;
  ctx.save();
  ctx.shadowColor = `rgba(0,0,0,${.5 * a})`; ctx.shadowBlur = 40 * a; ctx.shadowOffsetY = 18 * a;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 16 * a); ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(x, y); ctx.scale(sc, sc);
  const s = D.said[k], f = fit[k], cv = CV(k), tp = pxTime(t);
  ringIcon(ctx, 20, 27, ramp(t, cv + .55, cv + .8));
  if (k > 0 && a < .2) { ctx.fillStyle = '#ececee'; ctx.globalAlpha = 1 - a * 5; ctx.fillRect(ROWX, 0, ROWW, 1); ctx.globalAlpha = 1; }
  if (tp < cv) {
    ctx.font = `500 ${f.nb}px ${D.fam}`; ctx.fillStyle = '#1c1c1e'; ctx.fillText(s.said, ROWX, 32.5);
  } else {
    const pl = plans[k], res = ramp(tp, cv + .78, cv + .95);
    for (let i = 0; i < pl.fl.length; i++) {
      const q = pl.fl[i];
      if (res > 0 && bayer(q.bx, q.by) < res) continue;
      const u = E.inOutCubic(ramp(t, q.at, q.at + .42)), mid = Math.sin(Math.PI * u);
      const px = (1 - u) ** 2 * q.sx + 2 * (1 - u) * u * q.mx + u * u * q.tx, py = (1 - u) ** 2 * q.sy + 2 * (1 - u) * u * q.my + u * u * q.ty;
      const z = q.cs * .92 * (1 + .5 * mid);
      ctx.globalAlpha = 1 - .35 * mid;
      ctx.fillStyle = '#000';
      ctx.fillRect(px - z / 2, py - z / 2, z, z);
    }
    ctx.globalAlpha = 1;
    if (res > 0) { ctx.globalAlpha = E.outCubic(res); ctx.font = `600 ${f.en}px ${EN_FONT}`; ctx.fillStyle = '#000'; ctx.fillText(s.en, ROWX, 23.5); }
    const na = ramp(tp, cv + .85, cv + 1.05);
    if (na > 0) { ctx.globalAlpha = na; ctx.font = `400 ${f.na}px ${D.fam}`; ctx.fillStyle = '#8e8e93'; ctx.fillText(s.said, ROWX, 41.5); }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// The practice terrain (PixelArt.swift, PixelTerrain): three dithered layers that rise with your voice.
const LAYERS = [
  { ridge: .28, amplitude: .1, speed: .05, frequency: .07, density: .32, seed: 1 },
  { ridge: .5, amplitude: .12, speed: .09, frequency: .11, density: .52, seed: 2 },
  { ridge: .72, amplitude: .09, speed: .14, frequency: .16, density: .78, seed: 3 },
];
const voiceLevel = t => {
  let v = 0;
  WORDS.forEach((w, i) => { const u = t - wordAt(i); if (u > -.03 && u < w[2] - w[1] + .08) v = Math.max(v, .55 + .45 * Math.abs(Math.sin(u * 19 + i))); });
  return v;
};
function drawTerrain(ctx, t, x0, y0, w, h, c, up) {
  if (up <= 0) return;
  const lv = voiceLevel(t), energy = .45 + .4 * lv, cols = Math.ceil(w / c), rows = Math.round(h / c), off = (1 - up) * h;
  const time = pxTime(t) + 40, step = Math.floor(time * 2), g = Math.max(.6, c * .12);
  for (let li = 0; li < 3; li++) {
    const L = LAYERS[li], strength = (.25 + .75 * energy) * (.45 + .3 * li);
    for (let x = 0; x < cols; x++) {
      const phase = x * L.frequency * (80 / cols), lift = 1 + lv * 1.6;
      const wave = Math.sin(phase + time * L.speed * 6) * .65 + Math.sin(phase * 2.3 - time * L.speed * 9 + L.seed) * .25 + (hash(x, step + L.seed) - .5) * .2;
      const top = Math.max(0, Math.min(rows - 1, Math.floor((L.ridge - L.amplitude * lift * wave) * rows)));
      ctx.fillStyle = '#000'; ctx.fillRect(x0 + x * c, y0 + top * c + off, c, h);
      ctx.fillStyle = `rgba(255,255,255,${strength * .55})`;
      for (let y = top + 1; y < rows; y++) {
        const d = (y - top) / Math.max(rows - top, 1);
        if (bayer(x, y) < L.density * (1 - d * .7)) ctx.fillRect(x0 + x * c, y0 + y * c + off, c - g, c - g);
      }
      ctx.fillStyle = `rgba(255,255,255,${Math.min(1, strength * 1.15)})`;
      ctx.fillRect(x0 + x * c, y0 + top * c + off, c - g, c - g);
    }
  }
}

// ---------- one frame ----------
const css = (e, k, v) => { if (e._c?.[k] !== v) { (e._c ||= {})[k] = v; e.style[k] = v; } };
const txt = (e, v) => { if (e._t !== v) { e._t = v; e.textContent = v; } };

function frame(t) {
  const fade = Math.min(ramp(t, 0, .3), 1 - ramp(t, END - .45, END));
  css(sbox, 'opacity', String(fade));
  const step = t < STEP[1] ? 0 : t < STEP[2] ? 1 : 2;
  stepLis.forEach((li, i) => li.classList.toggle('on', i === step));
  stepBars.forEach((b, i) => css(b, 'transform', `scaleX(${i < step ? 1 : i > step ? 0 : ramp(t, STEP[i], i < 2 ? STEP[i + 1] : END - .4)})`));
  const dnow = el('dnow');
  if (dnow._s !== step + lang) { dnow._s = step + lang; const k = ['wear', 'read', 'say'][step]; dnow.innerHTML = `${$$('#dsteps .d')[step].textContent}<span lang="${D.html}">${D.steps[k]}</span>`; }

  // Clock and the Watch.
  const m = dayClock(t);
  txt(el('wclk'), hm(m)); txt(el('pclk'), hm(m));
  const listened = Math.max(0, m - toMin(D.said[0].time) + 6) * 27 + 9;
  txt(el('wtmr'), listened >= 3600 ? `${Math.floor(listened / 3600)}:${String(Math.floor(listened % 3600 / 60)).padStart(2, '0')}:${String(Math.floor(listened % 60)).padStart(2, '0')}` : `${Math.floor(listened / 60)}:${String(Math.floor(listened % 60)).padStart(2, '0')}`);
  el('wr').setAttribute('stroke-dasharray', `${WRC * mix(.06, 1, ramp(m, toMin(D.said[0].time) - 6, 21 * 60 + 40))} ${WRC}`);
  el('wring').setAttribute('gradientTransform', `rotate(${t * 40} .5 .5)`);
  const wdim = ramp(t, STEP[1] + .6, STEP[1] + 1.3) * (1 - ramp(t, END - .6, END));
  css(dw, 'filter', wdim > 0 ? `brightness(${mix(1, .5, wdim)})` : 'none');

  // Bubbles: what you said, written as it is said, then broken into the stream.
  bubs.forEach((b, k) => {
    const on = E.outBack(ramp(t, SP[k], SP[k] + .35)), gone = ramp(t, DISS(k), DISS(k) + .3);
    const vis = t >= SP[k] && gone < 1;
    css(b.el, 'visibility', vis ? 'visible' : 'hidden');
    if (!vis) return;
    const p = bubPos(k, t);
    css(b.el, 'transform', `translate(${p.x}px, ${p.y + (1 - on) * 10}px) scale(${mix(.92, 1, on) * mix(1, 1.04, gone)})`);
    css(b.el, 'opacity', String(Math.min(1, on * 1.4) * (1 - gone) * mix(1, .55, ramp(t, SP[k] + 2.6, SP[k] + 3.2))));
    css(b.el, 'filter', gone > 0 ? `blur(${gone * 6}px)` : 'none');
    const w = ramp(t, SP[k] + .08, SP[k] + SPK - .05);
    css(b.bs, 'clipPath', `inset(0 ${(1 - w) * 100}% 0 0)`);
  });

  // iPhone.
  const wake = ramp(t, STEP[1] - .3, STEP[1] + .5);
  css(el('pdim'), 'opacity', String(mix(.55, 0, E.inOutSine(wake)) * (1 - ramp(t, END - .5, END))));
  const eqStep = Math.floor(t * 6);
  eqCells.forEach((c, i) => { const col = i % 3, row = Math.floor(i / 3), h = 1 + Math.floor(hash(col, eqStep) * 3); css(c, 'opacity', row < h ? '1' : '0'); });

  // To learn: rows are written, lift off as cards, and come back in English. After practice, row 1 moves to Learned.
  const moved = E.inOutCubic(ramp(t, MOVE, MOVE + .5)), h1 = 1 - moved;
  let written = 0, y = 0;
  rows.forEach((r, k) => {
    const wr = ramp(t, WRITE(k), WRITE(k) + WRITE_LEN);
    if (t > WRITE(k) + .3) written++;
    const after = t >= DONE(k), lifted = t >= LIFT(k) && t < DONE(k);
    const hk = k === 1 ? h1 : 1;
    css(r.el, 'top', y + 'px'); css(r.el, 'height', ROWH * hk + 'px');
    css(r.el, 'opacity', String(k === 1 ? 1 - ramp(t, MOVE - .05, MOVE + .25) : 1));
    if (k === 2) r.el.style.setProperty('--sep', String(Math.max(h1, 0)));
    y += ROWH * hk;
    css(r.el, 'visibility', lifted ? 'hidden' : 'visible');
    css(r.sk, 'opacity', String(1 - wr));
    css(r.nb, 'opacity', after ? '0' : '1');
    css(r.nb, 'clipPath', `inset(0 ${(1 - wr) * 100}% 0 0)`);
    css(r.en, 'opacity', after ? '1' : '0');
    css(r.na, 'opacity', after ? '1' : '0');
    r.ic.style.setProperty('--half', after ? '1' : '0');
    css(r.ic, 'opacity', String(ramp(t, WRITE(k) + .35, WRITE(k) + .6)));
  });
  const listH = y;
  css(el('lc'), 'top', LIST_Y + 'px'); css(el('lc'), 'height', listH + 'px');
  const toLearn = written - (t > MOVE + .25 ? 1 : 0);
  txt(el('ntl'), String(toLearn)); txt(el('nlearn'), String(toLearn));
  css(el('lh1'), 'top', LIST_Y - 25 + 'px');
  const l2 = LIST_Y + listH + 20;
  css(el('lh2'), 'top', l2 + 'px');
  const nIn = E.inOutCubic(ramp(t, MOVE + .15, MOVE + .65));
  const ldc = el('ldc'), rwn = el('rwn'), rwo = el('rwo');
  css(ldc, 'top', l2 + 25 + 'px'); css(ldc, 'height', ROWH * (1 + nIn) + 'px');
  css(rwn, 'top', '0px'); css(rwn, 'height', ROWH * nIn + 'px'); css(rwn, 'opacity', String(ramp(nIn, .4, 1)));
  css(rwo, 'top', ROWH * nIn + 'px'); css(rwo, 'height', ROWH + 'px');
  rwo.classList.toggle('first', nIn <= 0);
  txt($('span', el('lh2')), String(1 + (t > MOVE + .4 ? 1 : 0)));
  el('ring2').setAttribute('stroke-dasharray', `${R2C * .34 * E.inOutCubic(ramp(t, MOVE + .4, MOVE + 1.2))} ${R2C}`);

  // Tap Learn; the practice screen comes up over Today.
  const tap = ramp(t, TAP, TAP + .5), tapOn = t > TAP && tap < 1;
  const ptap = el('ptap');
  css(ptap, 'opacity', tapOn ? String(1 - tap) : '0');
  css(ptap, 'transform', `translate(${12 + 108 + 72}px, ${108 + 12 + 13}px) scale(${.2 + tap})`);
  const press = t > TAP ? Math.sin(Math.PI * ramp(t, TAP, TAP + .22)) : 0;
  css(el('plearn'), 'transform', `scale(${1 - .06 * press})`);
  const present = E.outQuint(ramp(t, PRESENT, PRESENT + .5)) * (1 - E.inCubic(ramp(t, DISMISS, DISMISS + .4)));
  css(el('sheet'), 'transform', `translateY(${(1 - present) * SCR.h}px)`);
  css(el('sheet'), 'visibility', present > 0 ? 'visible' : 'hidden');
  words.forEach((wd, i) => {
    const at = wordAt(i), on = E.outCubic(ramp(t, at, at + .12)), pop = t >= at ? Math.exp(-(t - at) / .12) : 0;
    const g = Math.round(mix(58, 255, on));
    css(wd, 'color', `rgb(${g},${g},${Math.round(mix(60, 255, on))})`);
    css(wd, 'transform', `translateY(${-pop * 3}px)`);
    css(wd, 'textShadow', on > 0 ? `0 0 ${14 * pop + 6 * on}px rgba(255,255,255,${.35 * on})` : 'none');
    const ck = ramp(pxTime(t), at + WORDS[i][2] - WORDS[i][1], at + WORDS[i][2] - WORDS[i][1] + .27);
    css(checks[i], 'clipPath', `inset(0 ${Math.round((1 - ck) * 6) / 6 * 100}% 0 0)`);
    css(checks[i], 'opacity', String(.55 + .45 * ramp(t, CHECKED, CHECKED + .2)));
  });
  const sm = el('sm'), smState = t < EN_AT - .1 ? 0 : t < CHECKED ? 1 : 2;
  if (sm._s !== smState) { sm._s = smState; sm.innerHTML = ['Tap the mic and say it', 'Listening…', '<b>5 / 5</b> · every word checked'][smState]; }
  css(sm, 'opacity', String(ramp(t, PRESENT + .35, PRESENT + .7)));

  // Canvases.
  const k = scale * dpr;
  glow.setTransform(1, 0, 0, 1, 0, 0); glow.clearRect(0, 0, cGlow.width, cGlow.height); glow.setTransform(k, 0, 0, k, 0, 0);
  ink.setTransform(1, 0, 0, 1, 0, 0); ink.clearRect(0, 0, cInk.width, cInk.height); ink.setTransform(k, 0, 0, k, 0, 0);
  glow.globalAlpha = fade; ink.globalAlpha = 1;
  drawWave(glow, t);
  // The front of each bubble's writing.
  bubs.forEach((b, j) => {
    const w = ramp(t, SP[j] + .08, SP[j] + SPK - .05);
    if (w <= 0 || w >= 1 || !bubBox[j]) return;
    const p = bubPos(j, t), bb = bubBox[j];
    pixelEdge(glow, p.x + bb.tx + w * bb.tw, p.y + bb.ty + 3, bb.th - 6, t, j, '#fff', 2.2);
  });
  drawStream(glow, t);
  // The front of each row's writing, in ink.
  rows.forEach((r, j) => {
    const w = ramp(t, WRITE(j), WRITE(j) + WRITE_LEN);
    if (w <= 0 || w >= 1) return;
    const rr = rowRect(j), natW = Math.min(TEXTW, measure(D.said[j].said, `500 ${fit[j].nb}px ${D.fam}`));
    pixelEdge(ink, rr.x + ROWX + w * natW, rr.y + 19, 16, t, j + 5, '#000', 2);
  });
  for (let j = 0; j < 3; j++) drawCard(ink, j, t);
  // Terrain, inside the practice screen.
  if (present > 0) {
    const sx = scrX(), sy = scrY() + (1 - present) * SCR.h;
    glow.save();
    glow.beginPath(); glow.roundRect(scrX(), scrY(), SCR.w, SCR.h, 50); glow.clip();
    const up = E.outCubic(ramp(t, PRESENT + .1, PRESENT + .8)) * (1 - E.inCubic(ramp(t, DISMISS - .2, DISMISS + .2)));
    drawTerrain(glow, t, sx, sy + 400, SCR.w, SCR.h - 400, 6, up);
    glow.restore();
  }
  bloom.setTransform(1, 0, 0, 1, 0, 0); bloom.clearRect(0, 0, cBloom.width, cBloom.height);
  bloom.drawImage(cGlow, 0, 0, cBloom.width, cBloom.height);
}

// ---------- the clock, sound, and controls ----------
let t0 = performance.now(), held = null, running = false, visible = false, hiddenAt = 0, lastT = 0, sound = false;
const clock = () => held != null ? held : ((performance.now() - t0) / 1000) % END;
const seek = s => { t0 = performance.now() - s * 1000; lastT = s; held = null; if (!running) frame(s); };
const voices = {};
const voice = name => (voices[name] ||= Object.assign(new Audio(`assets/voice/${name}.mp3`), { preload: 'auto' }));
const cues = () => [[SP[PRACTICE], lang], [EN_AT, 'en']];
function tick() {
  if (!running) return;
  const t = clock();
  if (sound) for (const [at, name] of cues()) if ((lastT < at && t >= at) || (t < lastT && t >= at && at < .2)) { const a = voice(name); a.currentTime = 0; a.play().catch(() => {}); }
  lastT = t;
  frame(t);
  requestAnimationFrame(tick);
}
const STILL = [SP[2] + SPK + .2, DONE(2) + .1, CHECKED + .5];
const api = {
  visible(o) {
    const on = o > .02;
    if (on === visible) return;
    visible = on;
    if (on) {
      if (performance.now() - hiddenAt > 4000) seek(0);
      if (reduce) { held = STILL[1]; frame(held); return; }
      running = true; requestAnimationFrame(tick);
    } else { running = false; hiddenAt = performance.now(); Object.values(voices).forEach(a => a.pause()); }
  },
};
/** Hold the demo at one moment (for checking frames by hand); `at(null)` lets it run again. */
api.at = s => { held = s; if (s != null) frame(s); else seek(0); };
window.twicyDemo = api;

$$('#dsteps button').forEach(b => b.addEventListener('click', () => {
  const i = +b.dataset.step;
  if (reduce) { held = STILL[i]; frame(held); return; }
  seek(STEP[i] + (i ? 0 : .01));
}));
$$('#dlangs button').forEach(b => b.addEventListener('click', () => { setLang(b.dataset.l); if (reduce) frame(held ?? STILL[1]); else seek(.01); }));
el('whit').addEventListener('click', () => { if (!reduce) seek(.01); });
const snd = el('dsnd');
snd.addEventListener('click', () => {
  sound = !sound; snd.setAttribute('aria-pressed', String(sound));
  if (sound) { voice(lang); voice('en'); } else Object.values(voices).forEach(a => a.pause());
});

setLang(pickLang());
new ResizeObserver(() => layout()).observe(stage);
layout();
// Text pixels are rasterised from the real fonts: redo them once the fonts arrive.
document.fonts?.ready.then(() => { cellCache.clear(); setLang(lang); layout(); });
})();
