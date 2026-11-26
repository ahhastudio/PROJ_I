'use strict';
// 원정 지도 — 픽셀 그림 (2026-11-23 사용자: 「맵 디자인도 픽셀로 다시 그려」 · 「복도나 방 주변 음영 · 글씨가 경로에 가리는 걸 수정」). 기존 게임의 SVG 지도(RUN.draw)는 그대로.
// 캔버스 한 장(지도 전체 · 칸 c px)을 지도 칸 안에서 끌어 넘겨 본다. 그리는 순서: 양피지 → 바닥(방 종류 색조) → 둘레 음영 띠 → 관문 · 발자국 · 경로 선 → 아이콘 · 글씨(바탕 판).
// 읽는 것: 탐사 기록 꼴 V(G.Dive.view / drawState), 경로 · 발자국 · 못 연 길 · 야영 지점, G.Dive의 보상 · 관문 · 사건 기억. 화면 밖 규칙은 없다.
const DIVEMAP = (() => {
  const PAL = { bg: '#e6cf9c', bg2: '#d6ba82', bg3: '#efdcae', ink: '#2b1d14', pen: '#7b6852', rust: '#8e2a1a', paper: '#f3e4c3', gold: '#d9a441', band: '#3b2a1c', band2: '#a88e66', floor: '#f6ead0', seen: '#ead6a8', fog: '#d9c08c', shade: '#d8c49a' };
  const TINT = { fight: '#f4e3c9', elite: '#ecd2c0', boss: '#e6c3b4', treasure: '#f3e7b2', event: '#e2e6d0', camp: '#dfe7c8', start: '#f6ead0', shop: '#f0e0c0' }; // 방 종류 색조
  const RC = ['#7b6852', '#2f8a3e', '#2f63c9', '#8a3fc4', '#c9741a'];
  // 8×8 픽셀 아이콘 (두 배로 16px) — 1 잉크 · 2 붉은 잉크 · 3 금색
  const ICON = {
    fight: ['1......1', '.1....1.', '..1..1..', '...11...', '...11...', '..1..1..', '.11..11.', '11....11'],
    elite: ['.111111.', '11111111', '1..11..1', '1..11..1', '11111111', '.111111.', '.1.11.1.', '.1.11.1.'],
    boss: ['3..3..3.', '33.33.33', '33333333', '33333333', '.333333.', '.333333.', '........', '........'],
    treasure: ['........', '.111111.', '13333331', '11111111', '13311331', '13333331', '11111111', '........'],
    event: ['...11...', '...11...', '...11...', '...11...', '...11...', '........', '...11...', '...11...'],
    camp: ['...2....', '..222...', '...2....', '..111...', '.11.11..', '11...11.', '1.....1.', '11111111'],
    start: ['......11', '....1111', '....11..', '..1111..', '..11....', '1111....', '11......', '........'],
    shop: ['..3333..', '.33..33.', '.33.....', '..3333..', '.....33.', '.33..33.', '..3333..', '........'],
  };
  // 관문 아이콘 (8×8, 한 배)
  const GATE = {
    lock: ['..111...', '.1...1..', '.1...1..', '1111111.', '1333331.', '1331331.', '1333331.', '1111111.'],
    bars: ['1.1.1.1.', '1.1.1.1.', '1111111.', '1.1.1.1.', '1.1.1.1.', '1111111.', '1.1.1.1.', '1.1.1.1.'],
    seal: ['..222...', '.2...2..', '2..2..2.', '2.222.2.', '2..2..2.', '.2...2..', '..222...', '........'],
    rubble: ['........', '...11...', '..1111..', '.11.11..', '111111.1', '11.1111.', '11111111', '........'],
    dark: ['..1111..', '.11..1..', '11......', '11......', '11......', '.11..1..', '..1111..', '........'],
    trap: ['...2....', '..222...', '..2.2...', '.2.2.2..', '.2...2..', '2..2..2.', '2222222.', '........'],
    hidden: ['........', '........', '........', '11.11.11', '11.11.11', '........', '........', '........'],
  };
  const QUILL = ['..........11', '.........121', '........1221', '.......1221.', '......1221..', '.....1221...', '....1221....', '...1221.....', '..1221......', '.1121.......', '.11.........', '1...........'];
  const GEM = ['..1111..', '.133331.', '13333331', '.133331.', '..1331..', '...11...'];
  const TENT = ['....3....', '...333...', '..33133..', '.3311133.', '331111133', '.........'];
  const shown = n => n.visited || n.seenMap || n.info >= 2, shownAll = shown;
  let rnd = 1; const R = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
  function bitmap(x, rows, X, Y, s = 1, col = { 1: PAL.ink, 2: PAL.rust, 3: PAL.gold }) { for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) { const k = rows[j][i]; if (k !== '.') { x.fillStyle = col[k]; x.fillRect(X + i * s, Y + j * s, s, s); } } }
  function line(x, x0, y0, x1, y1, w, col, dash = null, acc = { d: 0 }) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1); x.fillStyle = col;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy; const h = Math.floor(w / 2);
    for (;;) { const on = !dash || acc.d % (dash[0] + dash[1]) < dash[0]; if (on) x.fillRect(x0 - h, y0 - h, w, w); acc.d++; if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  }
  const polyLen = P => { let t = 0; for (let i = 1; i < P.length; i++) t += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); return t; };
  function polyPart(P, u) { const out = [P[0]]; let left = u; for (let i = 1; i < P.length; i++) { const l = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); if (left >= l) { out.push(P[i]); left -= l; continue; } const k = l ? left / l : 0; out.push([P[i - 1][0] + (P[i][0] - P[i - 1][0]) * k, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * k]); break; } return out; }
  // 글씨: 양피지색 바탕 판 위에 (선과 겹쳐도 읽히게) · 방 폭 maxW 안으로 잘라 넣는다
  function text(x, s, X, Y, col, { align = 'center', size = 12, bold = false, maxW = 999, plate = true } = {}) {
    x.font = `${bold ? 700 : 400} ${size}px Galmuri11, sans-serif`; x.textAlign = align; x.textBaseline = 'alphabetic';
    let t = String(s); while (t.length > 1 && x.measureText(t).width > maxW) t = t.slice(0, -1); if (t !== String(s)) t = t.slice(0, -1) + '…';
    const w = Math.ceil(x.measureText(t).width), lx = align === 'center' ? X - w / 2 : align === 'right' ? X - w : X;
    if (plate) { x.fillStyle = 'rgba(243,228,195,0.88)'; x.fillRect(Math.round(lx) - 2, Math.round(Y) - size + 1, w + 4, size + 2); }
    x.fillStyle = col; x.fillText(t, Math.round(X), Math.round(Y)); return w;
  }
  // 직업 기호: 색 네모 + 첫 글자 (긴 직업 이름 대신)
  const CLS_COL = { 파이터: '#8a2d24', 바바리안: '#a3542a', 팔라딘: '#c9a227', 몽크: '#4f7a3a', 로그: '#3a3a4a', 레인저: '#2f6a3a', 클레릭: '#e0d6b4', 드루이드: '#5e7c2f', 바드: '#a2427e', 위저드: '#2f4fa3', 소서러: '#7a3fa3', 워락: '#4a2a5e' };
  function clsMark(x, nm, X, Y) { const base = nm.replace(/ \d+$/, ''), lv = (/ (\d+)$/.exec(nm) || [])[1]; x.fillStyle = PAL.ink; x.fillRect(X, Y, 13, 13); x.fillStyle = CLS_COL[base] || PAL.pen; x.fillRect(X + 1, Y + 1, 11, 11); x.font = '700 10px Galmuri11, sans-serif'; x.textAlign = 'center'; x.fillStyle = base === '클레릭' ? PAL.ink : PAL.paper; x.fillText(base[0], X + 7, Y + 11); if (lv) { x.fillStyle = PAL.rust; x.font = '700 9px Galmuri11, sans-serif'; x.fillText(lv, X + 15, Y + 6); } return lv ? 20 : 15; }
  // ── 바탕 (방 · 복도 · 음영 · 관문 아이콘) — 한 번 그려 두고 경로만 다시 ──
  function base(V, o) {
    const { c, x0, y0, W, H, fl, mini } = o, L = V.map._lay, N = V.map.nodes, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
    const hide = o.hide || null, shown = n => shownAll(n) && !(hide && hide.has(n.id)); // hide: 지도 그리기 연출에서 아직 안 그린 방
    const P = ([cx, cy]) => [(cx - x0) * c, (cy - y0) * c];
    rnd = 7 + fl * 13; x.fillStyle = PAL.bg; x.fillRect(0, 0, W, H);
    for (let j = 0; j < H; j += 2) for (let i = (j / 2) % 2 ? 1 : 0; i < W; i += 2) { const r = R(); if (r < 0.05) { x.fillStyle = PAL.bg2; x.fillRect(i, j, 1, 1); } else if (r > 0.97) { x.fillStyle = PAL.bg3; x.fillRect(i, j, 1, 1); } }
    const st = new Map(), key = (a, b) => a + ',' + b, put = (cx, cy, v, t) => { const k = key(cx, cy), p = st.get(k); if (!p || p.v < v || v === 2) st.set(k, { v, t }); };
    const linkOK = q => (q.kind !== 'hidden' || q.seen?.hidden) && !(hide && (hide.has(q.a) || hide.has(q.b))) && ((N[q.a].visited && shown(N[q.b])) || (N[q.b].visited && shown(N[q.a])) || q.walked);
    for (const q of V.map.edges) if (linkOK(q)) for (const [a, b] of L.cor[q.id].cells) put(a, b, 1);
    const fogBox = {};
    for (const n of N) { if (!shown(n)) continue; const r = L.room[n.id];
      if (n.visited || n.info >= 2) for (const [a, b] of r.cells) put(a, b, n.visited ? 3 : 2, n.type);
      else { const cx = Math.round(r.x + (r.w - 3) / 2), cy = Math.round(r.y + (r.h - 3) / 2); fogBox[n.id] = [cx, cy]; for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) put(cx + i, cy + j, 0.5); } }
    const has = (a, b) => st.has(key(a, b)), D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    // 둘레 음영: 바닥 바깥 첫 픽셀 띠(어둡게 2px) · 그 바깥(옅게 2px) — 방 · 복도 같은 규칙
    for (const [k] of st) { const [a, b] = k.split(',').map(Number), [px, py] = P([a, b]);
      for (const [dx, dy] of D4) if (!has(a + dx, b + dy)) { x.fillStyle = PAL.band2; if (dx === 1) x.fillRect(px + c + 2, py - 2, 2, c + 4); if (dx === -1) x.fillRect(px - 4, py - 2, 2, c + 4); if (dy === 1) x.fillRect(px - 2, py + c + 2, c + 4, 2); if (dy === -1) x.fillRect(px - 2, py - 4, c + 4, 2);
        x.fillStyle = PAL.band; if (dx === 1) x.fillRect(px + c, py - 1, 2, c + 2); if (dx === -1) x.fillRect(px - 2, py - 1, 2, c + 2); if (dy === 1) x.fillRect(px - 1, py + c, c + 2, 2); if (dy === -1) x.fillRect(px - 1, py - 2, c + 2, 2); } }
    // 바닥: 방 종류 색조 (본 방은 옅게 · 모르는 방은 작은 상자)
    for (const [k, p] of st) { const [a, b] = k.split(',').map(Number), [px, py] = P([a, b]); x.fillStyle = p.v === 0.5 ? PAL.fog : p.v === 1 ? PAL.floor : p.v === 2 ? PAL.seen : TINT[p.t] || PAL.floor; x.fillRect(px, py, c, c); }
    // 방 안쪽 벽 아래 그림자 1px (위쪽이 벽인 바닥 칸)
    for (const [k, p] of st) { if (p.v < 2) continue; const [a, b] = k.split(',').map(Number), [px, py] = P([a, b]); if (!has(a, b - 1)) { x.fillStyle = PAL.shade; x.fillRect(px, py, c, 2); } }
    // 곁방: 안쪽에 점선 테두리
    for (const n of N) { if (!n.side || !shown(n) || fogBox[n.id]) continue; const r = L.room[n.id], [rx, ry] = P([r.x, r.y]); x.fillStyle = PAL.pen; for (let t = 4; t < r.w * c - 4; t += 4) { x.fillRect(rx + t, ry + 3, 2, 1); x.fillRect(rx + t, ry + r.h * c - 4, 2, 1); } for (let t = 4; t < r.h * c - 4; t += 4) { x.fillRect(rx + 3, ry + t, 1, 2); x.fillRect(rx + r.w * c - 4, ry + t, 1, 2); } }
    if (!hide) { o.fogBox = fogBox; o.linkOK = linkOK; }
    return cv;
  }
  // ── 위 층 (관문 · 경로 · 발자국 · 아이콘 · 글씨) ──
  function draw(cv, V, o, st) {
    const x = cv.getContext('2d'), { c, x0, y0, mini } = o, P = ([a, b]) => [(a - x0) * c + c / 2, (b - y0) * c + c / 2], L = V.map._lay, N = V.map.nodes, fl = o.fl;
    x.imageSmoothingEnabled = false; x.drawImage(st.animBase || st.base, 0, 0);
    const seg = (a, b) => { const r = G.Dive.segPts(V.map, a, b); return r ? r.pts.map(P) : null; };
    // 발자국 (지난 판 · 이번 판)
    const tr = st.trail || []; let qtip = null, tl = st.trailU == null ? Infinity : st.trailU; for (let k = 0; k + 1 < tr.length; k++) { if (tl <= 0) break; const Q = seg(tr[k], tr[k + 1]); if (!Q) continue; const len0 = polyLen(Q), len = Math.min(len0, tl); tl -= len0; if (st.trailU != null) { const A = polyPart(Q, len); qtip = A[A.length - 1]; } for (let u = 4, i = 0; u < len - 2; u += 7, i++) { const A = polyPart(Q, u), B = polyPart(Q, u + 1), a = A[A.length - 1], b = B[B.length - 1], ang = Math.atan2(b[1] - a[1], b[0] - a[0]), off = i % 2 ? 2 : -2; x.fillStyle = PAL.pen; x.fillRect(Math.round(a[0] - Math.sin(ang) * off), Math.round(a[1] + Math.cos(ang) * off), 2, 2); } }
    // 지우는 선
    if (st.erase && st.eraseA > 0) { x.globalAlpha = st.eraseA; for (const Q of st.erase) for (let i = 1; i < Q.length; i++) line(x, Q[i - 1][0], Q[i - 1][1], Q[i][0], Q[i][1], 3, PAL.rust); x.globalAlpha = 1; }
    // 경로
    const plan = st.plan || [], met = new Set([plan[0]]), segs = [];
    for (let k = 0; k + 1 < plan.length; k++) { const back = met.has(plan[k + 1]); met.add(plan[k + 1]); const Q = seg(plan[k], plan[k + 1]); if (Q) segs.push({ Q, back, len: polyLen(Q), k }); }
    const tot = segs.filter(s => s.k >= (st.from || 0)).reduce((a, s) => a + s.len, 0); let left = st.u == null ? Infinity : st.u * tot, tip = null;
    for (const s of segs) { let Q = s.Q; if (s.k >= (st.from || 0)) { if (left <= 0) break; if (left < s.len) Q = polyPart(Q, left); left -= s.len; }
      const acc = { d: 0 }; for (let i = 1; i < Q.length; i++) { if (s.back) line(x, Q[i - 1][0], Q[i - 1][1], Q[i][0], Q[i][1], 2, PAL.rust, [3, 3], acc); else line(x, Q[i - 1][0], Q[i - 1][1], Q[i][0], Q[i][1], 6, PAL.paper); }
      if (!s.back) for (let i = 1; i < Q.length; i++) line(x, Q[i - 1][0], Q[i - 1][1], Q[i][0], Q[i][1], mini ? 2 : 3, PAL.rust, mini ? [3, 2] : null);
      if (!s.back) tip = Q[Q.length - 1]; }
    // 붉은 ✕ (지난 판에 못 연 길)
    for (const id of st.fail || []) { const cr = L.cor[id]; if (!cr) continue; const [px, py] = P(cr.cells[cr.cells.length - 1] || cr.doorB); line(x, px - 4, py - 4, px + 4, py + 4, 2, PAL.rust); line(x, px - 4, py + 4, px + 4, py - 4, 2, PAL.rust); }
    o.gates = [];
    if (!mini) {
      // 관문: 문 자리에 아이콘 · 옆에 지금 파티의 값(있으면) 또는 풀 수 있는 직업 기호 — 눌러서 자세히
      for (const q of V.map.edges) { if (!o.linkOK(q) || q.walked || (st.hide && (st.hide.has(q.a) || st.hide.has(q.b)))) continue; const known = (q.kind === 'locked' && q.seen?.lock) || (q.kind === 'dark' && q.seen?.dark) || (q.kind === 'trap' && q.seen?.trap) || (q.kind === 'hidden' && q.seen?.hidden); if (!known) continue;
        const cr = L.cor[q.id], mid = cr.cells[Math.floor(cr.cells.length / 2)] || cr.doorA, [px, py] = P(mid), g = q.kind === 'locked' ? (q.lock || 'lock') : q.kind;
        x.fillStyle = PAL.paper; x.fillRect(px - 6, py - 6, 12, 12); bitmap(x, GATE[g] || GATE.lock, px - 4, py - 4, 1);
        const info = st.gateInfo ? st.gateInfo(q) : []; let gx = px + 8; const val = info.map(i => i.val).filter(Boolean)[0];
        if (val) gx += text(x, val.replace(/^[^ ]+ /, ''), gx + 1, py + 4, PAL.ink, { align: 'left', size: 10 }) + 4;
        else for (const nm of [...new Set(info.flatMap(i => i.who).filter(w => w !== '누구나'))].slice(0, 3)) gx += clsMark(x, nm, gx, py - 6);
        o.gates.push({ q, x: px - 12, y: py - 12, w: Math.max(24, gx - px + 14), h: 24 }); } // 누르는 범위는 아이콘보다 넓게 (24px)
      // 방: 아이콘 · 이름(위) · 적 구성(가운데 아래) · 보상(아래) · 텐트 · 사건 표시 · 순서 번호
      for (const n of N) { if (!shown(n) || (st.hide && st.hide.has(n.id))) continue; const r = L.room[n.id], [rx, ry] = [(r.x - x0) * c, (r.y - y0) * c], rw = r.w * c, rh = r.h * c, cx = rx + rw / 2, mw = rw - 6;
        if (o.fogBox[n.id]) { const [fx, fy] = o.fogBox[n.id]; if (n.seenMap && ICON[n.type]) bitmap(x, ICON[n.type], Math.round((fx - x0 + 1.5) * c - 8), Math.round((fy - y0 + 1.5) * c - 8), 2); else text(x, '?', (fx - x0 + 1.5) * c, (fy - y0 + 1.5) * c + 5, PAL.ink, { size: 12, bold: true, plate: false }); continue; } // 종류만 본 방 (원정: 이웃 방) — 아이콘
        if (n.name) text(x, n.name, cx, ry + 13, PAL.ink, { size: 12, maxW: mw });
        const low = rh < 64, ic = ICON[n.type]; if (ic && n.visited && (!low || !(n.hostile && n.g))) bitmap(x, ic, Math.round(cx - 8), Math.round(ry + rh / 2 - 12), 2); // 낮은 방(3칸): 아이콘 없이 글씨만 (겹치지 않게)
        if (n.hostile && n.g) { const u = n.g.units || [[n.g.name, n.g.count]]; text(x, `${u[0][0]} ×${u.reduce((a, q) => a + q[1], 0)}`, cx, ry + rh / 2 + (low ? 5 : 16), n.visited ? PAL.ink : PAL.pen, { size: 11, maxW: mw }); }
        const ev = n.type === 'event' ? G.Dive.evOf(st.S, fl, n.id) : null, rw0 = G.Dive.reward(n, fl), by = ry + rh - 4;
        if (rw0.gem) bitmap(x, GEM, Math.round(rx + 4), Math.round(ry + rh - 22), 1, { 1: PAL.ink, 3: '#5fc7d9' }); // 보석이 나오는 방
        if (rw0.items) { const t0 = `물건 ${rw0.items}`, tw = text(x, t0, cx - rw0.r.length * 3 - 2, by, PAL.ink, { size: 10 }); rw0.r.forEach((k, i) => { const dx = Math.round(cx + tw / 2 - rw0.r.length * 3 + 1 + i * 6), dy = by - 7; x.fillStyle = PAL.ink; x.fillRect(dx - 1, dy - 1, 6, 6); x.fillStyle = RC[k]; x.fillRect(dx, dy, 4, 4); }); }
        else if (rw0.ally && ev?.st !== 'done') text(x, '동료 +1', cx, by, PAL.ink, { size: 10 });
        else if (rw0.heal) text(x, `회복 ${rw0.heal}%`, cx, by, PAL.ink, { size: 10 });
        if (ev) { x.fillStyle = ev.st === 'done' ? '#2f8a3e' : PAL.rust; x.fillRect(rx + rw - 14, ry + 3, 11, 11); text(x, ev.st === 'done' ? '✓' : '!', rx + rw - 8, ry + 13, PAL.paper, { size: 10, bold: true, plate: false }); }
        if ((st.S?.miss?.[fl] || []).includes(n.id)) bitmap(x, GATE.lock, Math.round(rx + rw - 12), Math.round(ry + 4), 1, { 1: PAL.rust, 3: PAL.paper }); // 못 연 방 (다시 올 이유)
        if ((st.camp || []).includes(n.id)) bitmap(x, TENT, Math.round(rx + rw - 13), Math.round(ry + rh - 22), 1);
        if (n.dark) { const q = { kind: 'dark', room: n.id }, gx0 = rx + 3, gy0 = Math.round(ry + rh / 2 - 6); x.fillStyle = PAL.ink; x.fillRect(gx0, gy0, 12, 12); bitmap(x, GATE.dark, gx0 + 2, gy0 + 2, 1, { 1: PAL.paper, 2: PAL.paper, 3: PAL.paper }); // 어두운 방: 달 · 풀 수 있는 직업 (관문처럼 눌러서 자세히)
          const info = st.gateInfo ? st.gateInfo(q) : []; let gx = gx0 + 14; const val = info.map(i => i.val).filter(Boolean)[0]; if (val) gx += text(x, val, gx + 1, gy0 + 10, PAL.ink, { align: 'left', size: 10 }) + 4; else for (const nm of [...new Set(info.flatMap(i => i.who).filter(w => w !== '누구나'))].slice(0, 3)) gx += clsMark(x, nm, gx, gy0);
          o.gates.push({ q, x: gx0 - 6, y: gy0 - 6, w: Math.max(24, gx - gx0 + 12), h: 24 }); }
      }
      { const numd = new Set([plan[0]]); let num = 0; for (const id of plan.slice(1)) { if (numd.has(id)) continue; numd.add(id); num++; const r = L.room[id], px = (r.x - x0) * c + 2, py = (r.y - y0) * c + r.h * c - 14; x.fillStyle = PAL.paper; x.fillRect(px - 1, py - 1, 13, 13); x.fillStyle = PAL.rust; x.fillRect(px, py, 11, 11); x.font = '700 10px Galmuri11, sans-serif'; x.textAlign = 'center'; x.fillStyle = PAL.paper; x.fillText(String(num), px + 6, py + 10); } }
      if (tip || qtip) { const q0 = tip || qtip; bitmap(x, QUILL, Math.round(q0[0]) - 1, Math.round(q0[1]) - 23, 2, { 1: PAL.ink, 2: PAL.paper }); }
    }
    // 고를 수 있는 방 (다음 방 고르기): 금색 테두리 · 번호 (목록과 같은 번호)
    for (const [id, num] of st.pick || []) { const r = L.room[id], rx = (r.x - x0) * c, ry = (r.y - y0) * c, rw = r.w * c, rh = r.h * c; x.fillStyle = PAL.gold; x.fillRect(rx - 3, ry - 3, rw + 6, 3); x.fillRect(rx - 3, ry + rh, rw + 6, 3); x.fillRect(rx - 3, ry, 3, rh); x.fillRect(rx + rw, ry, 3, rh);
      x.fillStyle = PAL.ink; x.fillRect(rx - 3, ry - 3, 17, 17); x.fillStyle = PAL.gold; x.fillRect(rx - 2, ry - 2, 15, 15); text(x, String(num), rx + 5, ry + 10, PAL.ink, { size: 12, bold: true, plate: false }); }
    // 지금 위치 (원정 중)
    if (st.here != null) { const r = L.room[st.here], hx = (r.x - x0 + r.w / 2) * c, hy = (r.y - y0 + r.h / 2) * c; x.fillStyle = PAL.ink; x.fillRect(hx - 4, hy - 4, 9, 9); x.fillStyle = '#d9493a'; x.fillRect(hx - 3, hy - 3, 7, 7); }
    if (st.flash > 0) for (const id of st.fresh || []) { const r = L.room[id]; x.globalAlpha = st.flash * 0.55; x.fillStyle = '#fff6c8'; x.fillRect((r.x - x0) * c, (r.y - y0) * c, r.w * c, r.h * c); x.globalAlpha = 1; } // 새로 밝힌 방: 잠깐 밝게
    if (st.nope) { const r = L.room[st.nope.id], [px, py] = P([r.x + r.w / 2 - 0.5, r.y + r.h / 2 - 0.5]); text(x, '?', px + st.nope.dx, py + 6, PAL.rust, { size: 24, bold: true }); }
  }
  // ── 원정 뒤 지도 그리기 (2026-11-24): 깃펜이 이번 판에 걸어온 순서대로 발자국 선을 긋고, 새로 들어간 방에 닿으면 테두리 → 바닥 → 아이콘, 그 방에서 본 새 방은 흐리게(본 방 그림 그대로).
  //   이미 알던 방 사이는 빠르게. 길이는 A.dur(초, 방이 많으면 방마다 짧게). 누르면 건너뛴다. 끝나면 A.done()
  //   A = { trail: [방 id …], vis: [새로 들어간 방], seen: [새로 본 방], dur, done }
  function animate(cv, V, o, st, A) {
    const L = V.map._lay, c = o.c, vis = new Set(A.vis), seen = new Set(A.seen), hidden = new Set([...vis, ...seen]), full = st.base;
    const old = base(V, { ...o, hide: hidden }), work = document.createElement('canvas'); work.width = o.W; work.height = o.H; const wx = work.getContext('2d'); wx.drawImage(old, 0, 0);
    const P = ([a, b]) => [(a - o.x0) * c + c / 2, (b - o.y0) * c + c / 2], tr = (A.trail || []).filter((id, i, a) => i === 0 || id !== a[i - 1]);
    // 구간 (방 → 방): 새 방으로 들어가는 구간은 무겁게 · 아는 방끼리는 가볍게 — 시간을 무게대로 나눈다
    const segs = []; for (let k = 0; k + 1 < tr.length; k++) { const r = G.Dive.segPts(V.map, tr[k], tr[k + 1]); const len = r ? polyLen(r.pts.map(P)) : 0; segs.push({ to: tr[k + 1], len, w: vis.has(tr[k + 1]) ? 1 : 0.25 }); }
    const W0 = segs.reduce((a, q) => a + q.w, 0) + (vis.has(tr[0]) ? 1 : 0) || 1, T = A.dur * 1000, ROOM = 0.45; // ROOM: 방을 그리는 데 쓰는 몫 (그 구간 시간 안에서)
    // 방 하나 그리기: 테두리(잉크 선) → 바닥(완성 바탕에서 그 방 칸 · 이어진 복도 칸을 옮겨 온다) → 아이콘(위 층)
    const cellsOf = id => { const out = L.room[id].cells.slice(); for (const q of V.map.edges) if ((q.a === id || q.b === id) && o.linkOK(q) && !(st.hide && st.hide.has(q.a === id ? q.b : q.a))) out.push(...L.cor[q.id].cells); /* 이미 그린 방과 잇는 복도 */ return out; };
    const paint = (id, a) => { wx.globalAlpha = a; for (const [cx, cy] of cellsOf(id)) { const px = (cx - o.x0) * c - 4, py = (cy - o.y0) * c - 4; wx.drawImage(full, px, py, c + 8, c + 8, px, py, c + 8, c + 8); } wx.globalAlpha = 1; };
    const edge = (id, k) => { const r = L.room[id], x0 = (r.x - o.x0) * c, y0 = (r.y - o.y0) * c, w = r.w * c, h = r.h * c, per = 2 * (w + h), n = per * k; wx.fillStyle = PAL.ink; let t = 0; for (const [ax, ay, bx, by] of [[x0, y0, x0 + w, y0], [x0 + w, y0, x0 + w, y0 + h], [x0 + w, y0 + h, x0, y0 + h], [x0, y0 + h, x0, y0]]) { const l = Math.hypot(bx - ax, by - ay), m = Math.max(0, Math.min(l, n - t)); if (m > 0) line(wx, ax, ay, ax + (bx - ax) * m / l, ay + (by - ay) * m / l, 2, PAL.ink); t += l; } };
    const ev = []; let t = 0; const at = q => t / W0 * T;
    if (vis.has(tr[0])) { ev.push({ id: tr[0], t0: 0, t1: T / W0 }); t += 1; }
    const lenAt = []; let acc = 0; for (const sg of segs) { const t0 = at(), dt = sg.w / W0 * T, move = vis.has(sg.to) ? dt * (1 - ROOM) : dt; lenAt.push({ t0, t1: t0 + move, l0: acc, l1: acc + sg.len }); acc += sg.len; if (vis.has(sg.to) && !ev.some(e => e.id === sg.to)) ev.push({ id: sg.to, t0: t0 + move, t1: t0 + dt }); t += sg.w; }
    // 본 방: 그 방이 이웃한 방(들어간 방)을 처음 그릴 때 함께 · 이웃이 없으면 끝에
    const seenAt = id => { const nb = V.map.edges.filter(q => q.a === id || q.b === id).map(q => (q.a === id ? q.b : q.a)), e = ev.find(x => nb.includes(x.id)) || (nb.includes(tr[0]) ? { t0: 0, t1: T * 0.1 } : null); return e ? e.t1 : T; };
    const seenEv = [...seen].map(id => ({ id, t: seenAt(id), done: false }));
    const t0 = performance.now(); let doneAll = false;
    const fin = () => { if (doneAll) return; doneAll = true; st.anim = null; st.animBase = null; st.hide = null; st.trailU = null; draw(cv, V, o, st); A.done && A.done(); };
    st.anim = { skip: fin }; st.animBase = work; st.hide = new Set(hidden);
    const stepped = new Map(); // 방 → 그린 단계 (0 테두리 · 1 바닥 · 2 아이콘)
    const step = () => { if (doneAll) return; if (!cv.isConnected) { doneAll = true; st.anim = null; A.done && A.done(); return; } const now = performance.now() - t0;
      // 깃펜 위치
      let u = 0; for (const q of lenAt) { if (now >= q.t1) u = q.l1; else if (now > q.t0) { u = q.l0 + (q.l1 - q.l0) * (now - q.t0) / Math.max(1, q.t1 - q.t0); break; } else break; } st.trailU = u;
      for (const e of ev) { if (now < e.t0) continue; const k = Math.min(1, (now - e.t0) / Math.max(1, e.t1 - e.t0)), sg = stepped.get(e.id) || 0;
        if (k < 0.4) edge(e.id, k / 0.4); else { if (sg < 1) { edge(e.id, 1); stepped.set(e.id, 1); } if (k < 0.8) paint(e.id, Math.min(1, (k - 0.4) / 0.4 * 0.5)); else if (sg < 2) { paint(e.id, 1); stepped.set(e.id, 2); st.hide.delete(e.id); } } }
      for (const q of seenEv) if (!q.done && now >= q.t) { q.done = true; paint(q.id, 1); st.hide.delete(q.id); }
      draw(cv, V, o, st);
      if (now >= T + 120) return fin(); requestAnimationFrame(step); };
    step();
  }
  // 지도 칸에 붙이기: wrap(넘겨 볼 칸) · V · opts { plan, trail, fail, camp, S, gateInfo, here, mini, title } → { redraw, nope, cell(ev) → 방 id | null, gate(ev) → 관문 | null }
  function mount(wrap, V, opts) {
    let cv = wrap.querySelector('canvas.dvpix'); if (!cv) { wrap.innerHTML = ''; cv = document.createElement('canvas'); cv.className = 'dvpix'; wrap.append(cv); }
    const L = V.map._lay, cs = [], add = (a, b) => cs.push([a, b]);
    V.map.nodes.forEach(n => { if (shown(n)) { const r = L.room[n.id]; add(r.x, r.y); add(r.x + r.w, r.y + r.h); } }); V.map.edges.forEach(q => { if (q.walked) for (const [a, b] of L.cor[q.id].cells) add(a, b); });
    if (!cs.length) add(0, 0);
    const bx0 = Math.min(...cs.map(q => q[0])) - 2, by0 = Math.min(...cs.map(q => q[1])) - 2, bw = Math.max(...cs.map(q => q[0])) - bx0 + 3, bh = Math.max(...cs.map(q => q[1])) - by0 + 3;
    const VW = Math.max(120, wrap.clientWidth), VH = Math.max(100, wrap.clientHeight);
    // 칸 크기: 미니맵은 작게 · 지도는 폭(가로로 긴 층이면 높이)에 맞추되 10~14px — 넘치면 끌어서 본다
    const tall = bh / bw > VH / VW, small = typeof RUN !== 'undefined' && RUN.SMALL, c = opts.mini ? 5 : Math.max(small ? 16 : 10, Math.min(small ? 20 : 14, Math.floor(tall ? VW / bw : VH / bh))); // 작은 방(5칸)은 칸을 크게 (16~20px) — 방 글씨가 붙지 않게, 넘치면 끌어서 본다
    const W = Math.max(VW, bw * c), H = Math.max(VH, bh * c), x0 = bx0 - Math.floor((W / c - bw) / 2), y0 = by0 - Math.floor((H / c - bh) / 2), o = { c, x0, y0, W, H, fl: V.floor, mini: !!opts.mini };
    cv.width = W; cv.height = H; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const st = { base: base(V, o), plan: opts.plan, trail: opts.trail, fail: opts.fail, camp: opts.camp || [], S: opts.S, gateInfo: opts.gateInfo, here: opts.here, pick: opts.pick || null }; // pick: [[방, 번호]] 고를 수 있는 방
    if (opts.anim) animate(cv, V, o, st, opts.anim); else draw(cv, V, o, st);
    if (opts.fresh?.length && !opts.anim) { st.fresh = opts.fresh; const t0 = performance.now(); const step = () => { if (!cv.isConnected) return; const k = (performance.now() - t0) / 900; st.flash = k < 1 ? Math.abs(Math.sin(k * Math.PI * 2)) * (1 - k) : 0; draw(cv, V, o, st); if (k < 1) requestAnimationFrame(step); }; step(); }
    // 처음 열면 입구 쪽 (경로가 있으면 경로의 시작) — 그 뒤로는 끌 때만 움직인다
    const focus = id => { const r = L.room[id] || L.room[0], fx = (r.x - x0 + r.w / 2) * c, fy = (r.y - y0 + r.h / 2) * c; wrap.scrollLeft = Math.max(0, fx - VW / 2); wrap.scrollTop = Math.max(0, fy - VH * (opts.mini ? 0.5 : 0.65)); };
    if (opts.keep) { wrap.scrollLeft = opts.keep[0]; wrap.scrollTop = opts.keep[1]; } else focus(opts.here ?? (opts.plan?.[0] ?? 0));
    // 끌어서 넘기기 (마우스 · 손가락) — 조금이라도 끌었으면 누르기로 치지 않는다
    let drag = null; cv.onpointerdown = ev => { if (st.anim) { st.skipAt = performance.now(); st.anim.skip(); ev.stopPropagation(); return; } /* 그리는 중에 누르면 건너뛴다 */ drag = { x: ev.clientX, y: ev.clientY, sl: wrap.scrollLeft, st: wrap.scrollTop, moved: false }; };
    cv.onpointermove = ev => { if (!drag || !(ev.buttons & 1) && ev.pointerType === 'mouse') return; const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true; if (drag.moved) { wrap.scrollLeft = drag.sl - dx; wrap.scrollTop = drag.st - dy; } };
    cv.onpointerup = () => { setTimeout(() => { drag = null; }, 0); };
    const at = ev => { const b = cv.getBoundingClientRect(); return [(ev.clientX - b.left) * (W / b.width), (ev.clientY - b.top) * (H / b.height)]; };
    return {
      busy: () => !!st.anim,
      gates: () => (o.gates || []).filter(g => g.q.room != null || !g.q.walked), // 아직 안 연 관문 · 어두운 방 (그린 자리)
      show(g) { wrap.scrollLeft = Math.max(0, g.x + g.w / 2 - VW / 2); wrap.scrollTop = Math.max(0, g.y + g.h / 2 - VH / 2); },
      skipped: () => performance.now() - (st.skipAt || 0) < 600,
      dragged: () => !!drag?.moved,
      scroll: () => [wrap.scrollLeft, wrap.scrollTop],
      redraw(plan, from = 0, erase = null) {
        st.plan = plan; st.from = from; st.erase = erase ? erase.map(([a, b]) => { const r = G.Dive.segPts(V.map, a, b); return r ? r.pts.map(([p, q]) => [(p - x0) * c + c / 2, (q - y0) * c + c / 2]) : []; }) : null;
        const t0 = performance.now(), DUR = erase ? 350 : 420;
        const step = () => { if (!cv.isConnected) return; const k = Math.min(1, (performance.now() - t0) / DUR); if (erase) { st.eraseA = 1 - k; st.u = null; } else st.u = k; draw(cv, V, o, st); if (k < 1) requestAnimationFrame(step); else { st.erase = null; st.u = null; draw(cv, V, o, st); } };
        step();
      },
      nope(id) { const t0 = performance.now(); const step = () => { const k = (performance.now() - t0) / 700; st.nope = k < 1 ? { id, dx: Math.round(Math.sin(k * 30) * 3 * (1 - k)) } : null; draw(cv, V, o, st); if (k < 1) requestAnimationFrame(step); }; step(); },
      cell(ev) { const [px, py] = at(ev), cx = Math.floor(px / c) + x0, cy = Math.floor(py / c) + y0;
        for (const n of V.map.nodes) { if (!shown(n)) continue; const r = L.room[n.id]; if (cx >= r.x && cx < r.x + r.w && cy >= r.y && cy < r.y + r.h) return n.id; } return null; },
      gate(ev) { const [px, py] = at(ev); return (o.gates || []).find(g => px >= g.x && px <= g.x + g.w && py >= g.y && py <= g.y + g.h)?.q || null; },
    };
  }
  return { mount };
})();
