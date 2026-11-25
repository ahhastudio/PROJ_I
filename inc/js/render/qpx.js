'use strict';
// 인물 · 몬스터 그림: 구워 둔 8방향 픽셀 (2026-11-25, assets/qpx/ — Quaternius 3D를 Blender로 구운 것, px_lab.html에서 정했다)
//  인물은 모두 이 그림이다(MD). 구운 그림이 없는 몬스터(짐승 · 정령 …)는 DCSS 타일 그대로. ?art=dcss 이면 쓰지 않는다.
//  그림표 한 장 = 인물 하나: 줄 = 방향 8 (0 = 앞, 1 = 오른쪽 아래, … 반시계), 칸 = 대기 4 · 걷기 8 · 공격 n · 맞기 3 · 쓰러짐 6. 그림자는 없다(게임이 그린다).
const MINI_ON = DCSS && q.get('art') !== 'dcss', MINI_READY = MINI_ON;
const QPX = (() => {
  const on = MINI_ON;
  const CW = 82, FOOT = 59, PXM = CW / 3, SINB = Math.sin(38 * Math.PI / 180); // 칸 한 변 · 발 자리 · 1m의 px · 구운 카메라 각도
  // 공격 묶음: n = 장 수 · adv = 장마다 앞으로 나간 거리(m — 게임이 자리를 옮기므로 되돌린다) · seg = 한 번 칠 때 쓰는 토막들 [모으는 장들, 치는 장들] (칠 때마다 다음 토막)
  const SSA = [0, -.06, -.1, .14, .28, .29, .27, .26, .38, .46, .46, .46, .58, .74, .82, .82, .8, .55, .22, 0];
  const ATK = {
    ss: { adv: SSA, seg: [[[1, 2], [3, 4, 5]], [[6, 7], [8, 9, 10]], [[11, 12], [13, 14, 15, 16]]] },
    ss2: { adv: [0, 1, 2, 3, 4, 5, 11, 12, 13, 14, 15, 16, 17, 18, 19].map(i => SSA[i]), seg: [[[1, 2], [3, 4, 5]], [[6, 7], [8, 9, 10, 11]]] },
    two: { adv: [0, -.05, -.1, .14, .3, .31, .3, .34, .46, .6, .7, .7, .69, .45, .18, 0], seg: [[[1, 2], [3, 4, 5]], [[7, 8], [9, 10, 11, 12]]] },
    dual: { adv: [0, -.06, .26, .27, .3, .48, .48, .46, .54, .7, .8, .8, .5, .2, 0], seg: [[[1], [2, 3]], [[4], [5, 6]], [[7, 8], [9, 10, 11]]] },
    fist: { adv: [0, .14, .15, .2, .34, .35, .32, .3, .3, .42, .66, .67, .4, 0], seg: [[[0], [1, 2]], [[3], [4, 5]], [[6], [7, 8]], [[9], [10, 11]]] },
    cast: { adv: [0, -.03, -.07, -.09, -.09, .12, .3, .31, .3, .14, 0], seg: [[[1, 2, 3, 4], [5, 6, 7, 8, 9]]] },
    staff: { adv: [0, -.03, -.08, -.09, -.02, .16, .3, .31, .3, .15, 0], seg: [[[1, 2, 3, 4], [5, 6, 7, 8, 9]]] },
    lute: { adv: [0, -.02, .02, -.02, .02, -.05, -.06, .22, .23, .22, .1, 0], seg: [[[1], [2]], [[3], [4]], [[5, 6], [7, 8, 9]]] },
    bow: { adv: Array(9).fill(0), seg: [[[1, 2, 3, 4], [5, 6, 7]]], aim: 4 },
    mon: { adv: Array(9).fill(0), seg: [[[0, 1, 2], [3, 4, 5, 6, 7, 8]]] },
  };
  const CLS_ART = { dragoon: ['fighter', 'ss'], paladin: ['paladin', 'ss'], barbarian: ['barbarian', 'two'], rogue: ['rogue', 'dual'], archer: ['ranger', 'bow'], cleric: ['cleric', 'ss2'], bard: ['bard', 'lute'], mage: ['sorcerer', 'cast'], archmage: ['wizard', 'staff'], scout: ['druid', 'staff'], monk: ['monk', 'fist'], warlock: ['warlock', 'cast'] };
  // 몬스터 이름 → [그림, 공격 묶음, 물들이기 [r, g, b] 배율]. 위에서부터 먼저 맞는 것
  const RED = [1.15, .72, .66];
  const MON_ART = [
    [/코볼트/, 'goblin', 'dual', [1.25, .72, .62]], [/홉고블린/, 'hobgoblin', 'ss2'], [/고블린/, 'goblin', 'dual'], [/버그베어/, 'ogre', 'mon', [.86, .8, .78]],
    [/오우거 좀비/, 'troll', 'mon', [1.05, .98, .8]], [/오우거/, 'ogre', 'mon'], [/트롤/, 'troll', 'mon'], [/오크/, 'orc', 'mon'],
    [/미라/, 'zombie', 'mon', [1.3, 1.18, .95]], [/가스트/, 'zombie', 'mon', [.86, .8, 1.12]], [/구울/, 'zombie', 'mon', [.92, 1.02, .86]], [/좀비/, 'zombie', 'mon'],
    [/와이트/, 'skeleton', 'ss2', [.78, .86, 1.08]], [/^해골|스켈레톤/, 'skeleton', 'ss2'],
    [/망령|레이스/, 'wraith', 'mon'], [/스펙터|유령/, 'specter', 'mon'],
    [/놀/, 'orc', 'mon', [1.25, .95, .6]], [/뱀파이어/, 'warlock', 'cast', [1.35, 1, 1.1]], [/미노타우로스 해골/, 'skeleton', 'ss2'], [/도플갱어/, 'zombie', 'mon', [1.15, 1.1, 1.25]], [/움직이는 갑옷/, 'hobgoblin', 'ss2', [.7, .72, .85]],
    [/아이스 데빌/, 'demon', 'mon', [.5, 1.6, 2.6]], [/본 데빌/, 'demon', 'mon', [1.1, 2.6, 2]], [/데빌|발로르|데몬/, 'demon', 'mon'],
    [/회색 점액/, 'ooze', 'mon', [1, .7, 1.9]], [/젤리/, 'ooze', 'mon', [1.5, .85, .5]], [/푸딩/, 'ooze', 'mon', [.34, .27, .7]],
    [/헬 ?하운드/, 'hellhound', 'mon'], [/겨울 늑대/, 'winterwolf', 'mon'], [/늑대|다이어 울프/, 'wolf', 'mon'],
    [/임프/, 'imp', 'mon'], [/오커 젤리|점액|슬라임|푸딩|우즈/, 'ooze', 'mon'], [/균사|버섯|슈리커/, 'fungus', 'mon'],
    [/광신/, 'warlock', 'cast', RED], [/사제/, 'cleric', 'ss2', RED], [/메이지/, 'wizard', 'staff', RED], [/산적 두목/, 'fighter', 'ss', RED], [/산적/, 'rogue', 'dual', RED], [/불량배/, 'barbarian', 'two', RED],
  ];
  const memo = new Map();
  function artOf(e) {
    if (e.kind !== 'mon') { const m = e.merc || (e.cls ? e : null) || (typeof f !== 'undefined' ? f.leader : null), a = m && (CLS_ART[m.cls] || CLS_ART.dragoon); return a ? { n: a[0], k: a[1] } : null; }
    if (memo.has(e.n)) return memo.get(e.n);
    const h = MON_ART.find(x => x[0].test(e.n || '')), a = h ? { n: h[1], k: h[2], tint: h[3] } : null; memo.set(e.n, a); return a;
  }
  // 그림표: 쓰일 때 한 장씩 받아 화소로 풀어 둔다
  const sheets = new Map();
  function sheet(n) {
    let s = sheets.get(n); if (s !== undefined) return s;
    sheets.set(n, null); const im = new Image();
    im.onload = () => { const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0); const cols = c.width / CW; sheets.set(n, { px: new Uint32Array(x.getImageData(0, 0, c.width, c.height).data.buffer), w: c.width, cols, na: cols - 21, cut: new Map() }); };
    im.onerror = () => sheets.set(n, false); im.src = `assets/qpx/${n}.png`; return null;
  }
  // 한 장 잘라 내기. 발 아래로도 그림이 있다(앞으로 내민 발 · 내린 칼): drop = 발 자리 아래 줄 수
  function cut(a, col, d) {
    const s = sheet(a.n); if (!s) return null;
    const key = (a.tint ? a.tint.join() : '') + '|' + d + '|' + col; let sp = s.cut.get(key); if (sp) return sp;
    const px = new Uint32Array(CW * CW), [tr, tg, tb] = a.tint || [1, 1, 1]; let top = CW;
    for (let y = 0; y < CW; y++) for (let x = 0; x < CW; x++) {
      let c = s.px[(d * CW + y) * s.w + col * CW + x]; if ((c >>> 24) < 140) continue;
      if (a.tint) c = rgb(Math.min(255, (c & 255) * tr), Math.min(255, (c >> 8 & 255) * tg), Math.min(255, (c >> 16 & 255) * tb));
      px[y * CW + x] = c | 0xff000000; if (y < top) top = y;
    }
    sp = { w: CW, h: CW, foot: FOOT, drop: CW - 1 - FOOT, px, top, qpx: true, native: true };
    if (s.cut.size > 600) s.cut.clear(); s.cut.set(key, sp); return sp;
  }
  // 머리 위 표시 높이: 서 있는 그림의 윗줄 (공격으로 팔을 들어도 막대가 튀지 않게)
  const headOf = (a, d) => { const sp = cut(a, 0, d); return sp ? FOOT - sp.top : 40; };
  // 월드 방향 → 줄. 화면 오른쪽 u = x − y, 보는 쪽 v = x + y
  const dir8 = (dx, dy) => Math.round(Math.atan2(dx - dy, dx + dy) / (Math.PI / 4)) & 7;
  const wrap = (list, k) => list[Math.max(0, Math.min(list.length - 1, Math.floor(k * list.length)))];
  function frame(e, st) {
    const a = artOf(e), s = a && sheet(a.n); if (!s) return null;
    if (e._fv) { const l = Math.hypot(e._fv[0], e._fv[1]); if (l > .05) e._qd8 = dir8(e._fv[0], e._fv[1]); }
    const d = e._qd8 ?? (e.kind === 'mon' ? 7 : 1), K = ATK[a.k]; let col, adv = 0;
    if (st.lq < 1) e._qa = true; else if (e._qa) { e._qa = false; e._qn = (e._qn || 0) + 1; }
    if (st.down) { const k = Math.min(5, Math.floor((now() - (e._qdown ||= now())) / 110)); col = 12 + s.na + 3 + k; }
    else {
      e._qdown = 0;
      if (st.lq < 1) { const [pre, post] = K.seg[(e._qn || 0) % K.seg.length], i = st.lq < .22 ? wrap(pre, st.lq / .22) : wrap(post, (st.lq - .22) / .78); col = 12 + Math.min(i, s.na - 1); adv = K.adv[i] || 0; }
      else if (st.hq < 1) col = 12 + s.na + wrap([0, 1, 2], st.hq);
      else if (st.aim) col = 12 + (K.aim ?? K.seg[0][0][K.seg[0][0].length - 1]);
      else if (st.moving) col = 4 + Math.floor(st.t * 15 + (e._ph || 0) * 2) % 8;
      else col = Math.floor(st.t * 4 + (e._ph || 0)) % 4;
    }
    const sp = cut(a, col, d); if (!sp) return null;
    const th = d * Math.PI / 4; // 공격 그림이 앞으로 나간 만큼 되돌린다
    return Object.assign(Object.create(sp), { ox: -Math.sin(th) * adv * PXM, oy: -Math.cos(th) * adv * PXM * SINB, hh: headOf(a, d) });
  }
  // 전투 밖 화면(선술집 · 초상): 앞을 보고 선 한 장을 몸에 맞게 잘라
  const still = new WeakMap();
  function pix(m, time = 0) {
    const a = artOf(m); if (!a) return undefined; const sp = cut(a, Math.floor(time * 4) % 4, 0); if (!sp) return sheet(a.n) === false ? undefined : null;
    let o = still.get(sp); if (o) return o;
    let x0 = CW, x1 = -1, y0 = CW, y1 = -1; for (let y = 0; y < CW; y++) for (let x = 0; x < CW; x++) if (sp.px[y * CW + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const hw = Math.max((CW >> 1) - x0, x1 - (CW >> 1)) + 1, w = hw * 2, h = y1 - y0 + 3, px = new Uint32Array(w * h);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = x - (CW >> 1) + hw; if (i >= 0 && i < w) px[(y - y0 + 1) * w + i] = sp.px[y * CW + x]; }
    o = { w, h, foot: h - 2, px, top: 1 }; still.set(sp, o); return o;
  }
  // 쓰러진 적: 판에서 빠진 뒤에도 쓰러지는 그림을 잠깐 그린다 (0.66초 쓰러지고 1초 뒤 사라진다)
  const last = new Map(), bodies = [];
  function corpses(r, recs) {
    if (!on) return [];
    const alive = new Set(r.mons), n = now();
    for (const [e, R0] of last) if (!alive.has(e) || e.hp <= 0) { last.delete(e); if (e.hp <= 0 && R0.map === r.map) bodies.push({ R0: R0.rec, t0: n, map: r.map }); }
    for (const R0 of recs) if (R0.e.kind === 'mon' && R0.sp.qpx && R0.e.hp > 0) last.set(R0.e, { rec: R0, map: r.map });
    const out = [];
    for (let i = bodies.length - 1; i >= 0; i--) {
      const B = bodies[i], age = n - B.t0; if (age > 1700 || B.map !== r.map) { bodies.splice(i, 1); continue; }
      const a = artOf(B.R0.e), s = a && sheet(a.n); if (!s) continue;
      const sp = cut(a, 12 + s.na + 3 + Math.min(5, Math.floor(age / 110)), B.R0.e._qd8 ?? 7), b = project(wx(B.R0.e._dx ?? B.R0.e.x), wy(B.R0.e._dy ?? B.R0.e.y), 0);
      if (sp) out.push({ ...B.R0, sp, sx: b.sx, sy: b.sy, d: b.d, flash: false, down: false, lq: 1, body: true, dim: Math.max(0, (age - 1100) / 600) });
    }
    return out;
  }
  if (on) for (const k in CLS_ART) sheet(CLS_ART[k][0]);
  const isMon = e => e.kind === 'mon' && !!artOf(e) && sheet(artOf(e).n) !== false;
  const pix0 = (m, t) => (on ? pix(m, t) || null : null);
  return { on, has: e => on && !!artOf(e), artOf, corpses, frame, isMon, pix: pix0 };
})();
// 다른 화면이 부르는 이름 (선술집 · 초상 · 제목 · 싸움판): 물건 그림은 itemart.js
const MD = { frame: QPX.frame, isMon: QPX.isMon, pix: QPX.pix, pixMon: e => (QPX.isMon(e) ? QPX.pix(e, 0) : null), itemUrl: x => (typeof ITEMART !== 'undefined' ? ITEMART.url(x) : null) };
