'use strict';
// 원정 모드의 길드 = 선술집 한 장면 (2026-11-25, DIVE_NEXT 2번): 열린 직업의 영웅이 모두 서 있다. 누르면 파티에 들어가고(아래 초상 줄) 오른쪽에 정보가 뜬다.
// 그리기만 — 누른 것의 처리는 js/app/dive_ui.js의 inn() (data-in = 장면의 영웅 · data-out = 파티 줄의 초상 · 나머지 단추).
// 화면 전체가 장면 (2026-11-26): 고른 영웅은 앞줄에, 나머지는 탁자에 앉고 마을 사람이 섞인다. 벽의 게시판 = 해금 · 책장 = 도감 · 술청 = 명단 · 문 = 지도. 인형은 게임 안과 같은 픽셀(MD.pix).
const DIVEINN = (() => {
  const { esc } = UI, D = G.Dive;
  const prev = new Map(); // 아직 안 들인 직업의 본보기 인형 (직업 → 사람)
  const demo = (S, c) => { let m = prev.get(c); if (!m) { m = D.member(G.S.w.fantasy, c, 1, () => 0.5, D.soloBuilds(c)[0]?.id); prev.set(c, m); } return m; };
  const clsN = c => G.Guild.def({ cls: c })?.n || c;
  const merc = (S, c) => S.roster[c]?.m || demo(S, c);
  const stOf = (S, c) => (S.dead[c] ? 'dead' : !S.roster[c] ? 'new' : 'in');
  // ── 장면: 화면 전체가 술집 한 칸. 인형과 같은 화소 크기로 그린다. F = 정보 칸에 가리지 않는 폭, B = 아래 줄에 가리지 않는 높이 ──
  const at = new Map(), acts = new Map(); // 영웅이 지금 서 있는 곳 (화면을 다시 그려도 이어진다) · 큰 그림의 동작이 시작한 때
  const CASK = ['#7fb069', '#d8553d', '#e8bc4c', '#6a9fd4', '#c07cd6', '#f0e6c8'];
  const rect = x => (c, a, b, w, h) => { x.fillStyle = c; x.fillRect(Math.round(a), Math.round(b), Math.round(w), Math.round(h)); };
  const frame = (R, a, b, w, h, c, o = '#24140c') => { R(o, a - 1, b - 1, w + 2, h + 2); R(c, a, b, w, h); };
  // 벽에 붙은 것들의 자리 (단추도 여기에 얹힌다)
  function plan(F, B) {
    const wall = Math.round(Math.max(56, Math.min(B * 0.46, 96))), wide = F >= 235, bar = wide ? 58 : 46, door = F - 34, slots = wide ? ['board', 'fire', 'shelf', 'win'] : ['board', 'shelf'], gap = (door - 8 - bar) / slots.length, pos = {};
    slots.forEach((k, i) => { pos[k] = Math.round(bar + 4 + gap * (i + 0.5)); });
    const ty0 = wall + 34, ty1 = B - 48, rows = Math.max(1, Math.min(4, Math.floor((ty1 - ty0) / 44) + 1)), x0 = 42, x1 = F - 42, cols = Math.max(2, Math.min(4, Math.floor((x1 - x0) / 70) + 1)), tables = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) tables.push({ x: Math.round(x0 + (x1 - x0) * (cols > 1 ? c / (cols - 1) : 0.5)), y: Math.round(rows > 1 ? ty0 + (ty1 - ty0) * r / (rows - 1) : ty0 - (c % 2 ? 4 : 0)) });
    const seats = [];
    for (const side of [-1, 1, 0]) tables.forEach(q => seats.push(side ? { x: q.x + side * 19, y: q.y + 1, dir: -side, sit: 1 } : { x: q.x, y: q.y - 7, dir: 1, sit: 1 }));
    return { wall, wide, bar, door, pos, tables, seats: tables.length ? seats : [], line: n => i => ({ x: Math.round(F * 0.5 + (i - (n - 1) / 2) * Math.min(38, F / (n + 1))), y: B - 5, dir: 1 }) };
  }
  // 움직이지 않는 그림 (한 번만)
  function room(x, W, H, F, P, S) {
    const R = rect(x), { wall: w, pos } = P;
    // 벽: 회벽 위쪽 + 널판 아래쪽
    R('#c98f55', 0, 0, W, w); for (let i = 0; i < W * w / 46; i++) { const a = (i * 73) % W, b = (i * 37) % w; R(i % 2 ? '#d69c62' : '#bd8249', a, b, 3 + i % 4, 1); }
    const wain = w - 24; R('#8a4f2a', 0, wain, W, 24); for (let a = 0; a < W; a += 9) { R('#6e3c1f', a, wain + 2, 1, 22); R('#9d5f35', a + 1, wain + 2, 1, 22); } R('#b0703f', 0, wain, W, 2); R('#4f2a16', 0, wain + 2, W, 1); R('#4f2a16', 0, w - 3, W, 3); R('#a3643a', 0, w - 4, W, 1);
    // 들보 · 기둥
    R('#5a2f18', 0, 0, W, 7); R('#7a4424', 0, 1, W, 2); R('#3a1d0f', 0, 7, W, 1);
    for (let a = P.bar + 2; a < W; a += Math.max(70, Math.round((P.door - P.bar) / 2))) { R('#3a1d0f', a - 1, 7, 8, w - 8); R('#6b3a1f', a, 7, 6, w - 8); R('#86502b', a + 1, 7, 1, w - 8); R('#86502b', a - 3, 8, 12, 2); }
    // 바닥
    for (let y = w, r = 0; y < H; y += 9, r++) { R(r % 2 ? '#b87a48' : '#ae7141', 0, y, W, 9); R('#8a5530', 0, y, W, 1); R('#c98c57', 0, y + 1, W, 1); for (let i = (r * 29) % 54; i < W; i += 54) { R('#8a5530', i, y, 1, 9); R('#7a4828', i + 3, y + 4, 1, 1); R('#7a4828', i - 3, y + 4, 1, 1); } }
    R('rgba(40,16,6,.35)', 0, w, W, 3);
    // 카펫: 문에서 가운데로
    { const cy = w + 1, cw = 26, a = P.door + 1 - 1; R('#7a1f26', a, cy, cw, H - cy); R('#a8323a', a + 2, cy, cw - 4, H - cy); R('#e0b04c', a + 2, cy, 1, H - cy); R('#e0b04c', a + cw - 3, cy, 1, H - cy); for (let y = cy + 6; y < H; y += 14) R('#c9545a', a + cw / 2 - 2, y, 4, 4); }
    // 깃발 (들보에 줄줄이)
    { const C = ['#d8443c', '#e8b83c', '#3f8fc4', '#5aa854']; for (let i = 0, a = 4; a < F; a += 11, i++) { if (pos.fire && Math.abs(a + 5 - pos.fire) < 30) continue; const s = Math.round(3 * Math.sin((a % 66) / 66 * Math.PI)); R('#3a1d0f', a, 8 + s, 11, 1); const c = C[i % 4]; R(c, a + 2, 9 + s, 7, 3); R(c, a + 3, 12 + s, 5, 2); R(c, a + 5, 14 + s, 1, 1); } }
    // 창 (저녁놀)
    if (pos.win) { const a = pos.win - 14, b = 20, c = ['#5a4a8a', '#8a5a94', '#c8688a', '#f08a6a', '#ffb45a', '#ffd884']; frame(R, a, b, 28, 24, '#5a2f18'); c.forEach((q, i) => R(q, a + 2, b + 2 + i * 3.4, 24, 4)); R('#fff0b8', a + 17, b + 15, 5, 4); R('#3f3466', a + 2, b + 18, 24, 4); R('#3f3466', a + 5, b + 15, 4, 4); R('#3f3466', a + 11, b + 16, 3, 3); R('#ffd884', a + 6, b + 17, 1, 1); R('#5a2f18', a + 13, b, 2, 24); R('#5a2f18', a, b + 11, 28, 2); R('#b0703f', a - 2, b + 24, 32, 2); R('#a8323a', a - 3, b - 2, 5, 22); R('#a8323a', a + 26, b - 2, 5, 22); R('#c9545a', a - 2, b - 2, 1, 22); R('#c9545a', a + 27, b - 2, 1, 22); }
    // 게시판 (해금)
    { const a = pos.board - 17, b = 20, N = [['#fff3d0', 3, 3, 9, 10], ['#f6dfa0', 14, 4, 8, 7], ['#fff3d0', 24, 2, 7, 11], ['#ffd6c0', 5, 15, 8, 8], ['#fff3d0', 15, 13, 12, 10]]; frame(R, a, b, 34, 27, '#7a4424'); R('#c99a5e', a + 2, b + 2, 30, 23); for (const [c, u, v, p, q] of N) { R('rgba(60,30,10,.4)', a + u + 1, b + v + 1, p, q); R(c, a + u, b + v, p, q); for (let y = 3; y < q - 1; y += 2) R('#a08060', a + u + 1, b + v + y, p - 2 - (y % 4), 1); R('#d8443c', a + u + (p >> 1), b + v, 1, 1); } }
    // 난로
    if (pos.fire) { const a = pos.fire - 20, b = 18; frame(R, a, b, 40, w - b, '#8d8a94'); for (let y = b, r = 0; y < w; y += 6, r++) { R('#6a6672', a, y, 40, 1); for (let j = (r % 2) * 6 + 3; j < 40; j += 12) { R('#6a6672', a + j, y, 1, 6); R('#a5a2ac', a + j + 1, y + 1, Math.min(5, 39 - j), 1); } } frame(R, a - 4, b - 3, 48, 5, '#a3643a'); R('#c98c57', a - 4, b - 3, 48, 1); frame(R, a + 8, b + 14, 24, w - b - 14, '#1c0d08'); R('#5a5662', a - 5, w - 1, 50, 4);
      // 난로 위: 깬 층의 전리품
      const T = ['#f0e6d0', '#8fbf6a', '#b84a3a', '#c9b04a', '#6a9fd4']; for (let i = 0; i < Math.min(5, Math.ceil((S.deep || 0) / 2)); i++) { const u = a - 1 + i * 9, c = T[i]; R('#24140c', u - 1, b - 10, 8, 8); R(c, u, b - 9, 6, 4); R(c, u + 1, b - 5, 4, 2); R('#24140c', u + 1, b - 8, 1, 2); R('#24140c', u + 4, b - 8, 1, 2); } }
    // 책장 (도감)
    { const a = pos.shelf - 16, b = 17, h = w - b - 1; frame(R, a, b, 32, h, '#5a2f18'); R('#7a4424', a, b, 32, 2); const BK = ['#d8443c', '#3f8fc4', '#5aa854', '#e8b83c', '#8a5ac4', '#d88a4c']; for (let y = b + 3, r = 0; y + 9 < b + h; y += 11, r++) { R('#2e170b', a + 2, y, 28, 9); for (let u = 0, i = r * 5; u < 27; i++) { const bw = 2 + (i * 7) % 3, bh = 6 + (i * 5) % 3; if (u + bw > 28) break; if (i % 6 !== 4) { R(BK[(i * 5 + r) % 6], a + 2 + u, y + 9 - bh, bw, bh); R('rgba(255,240,200,.45)', a + 2 + u, y + 9 - bh + 1, bw, 1); } u += bw; } R('#7a4424', a, y + 9, 32, 2); } }
    // 술청 뒤 선반 · 통
    { const bw = P.bar; for (const sy of [24, 37]) { R('#4f2a16', 3, sy, bw - 8, 3); R('#a3643a', 3, sy, bw - 8, 1); for (let i = 0; 6 + i * 6 < bw - 8; i++) { const c = CASK[(i * 5 + sy) % 6], h = 5 + (i * 3 + sy) % 4; R('#24140c', 4 + i * 6, sy - h - 2, 5, h + 2); R(c, 5 + i * 6, sy - h, 3, h); R('#fff', 5 + i * 6, sy - h + 1, 1, 2); R('#e8d4a8', 6 + i * 6, sy - h - 2, 1, 2); } } }
    // 문 (지도)
    { const a = P.door, b = w - 46; frame(R, a - 3, b - 3, 34, 49, '#77747e'); R('#9b98a2', a - 3, b - 3, 34, 2); for (let y = b + 2; y < w; y += 8) { R('#5a5762', a - 3, y, 3, 1); R('#5a5762', a + 28, y, 3, 1); } R('#120a10', a, b, 28, 46); for (let i = 0; i < 4; i++) R(['#4a3a44', '#3a2c36', '#2a1f28', '#1e151c'][i], a + 2 + i * 3, w - 5 - i * 5, 24 - i * 6, 4); R('#e8b83c', a + 8, b - 9, 12, 6); R('#24140c', a + 10, b - 7, 8, 1); R('#24140c', a + 10, b - 5, 6, 1); }
    // 벽등
    for (const a of lamps(P)) { R('#24140c', a - 2, 21, 5, 1); R('#24140c', a - 2, 22, 1, 6); R('#24140c', a + 2, 22, 1, 6); R('#ffd45a', a - 1, 22, 3, 6); R('#fff8d0', a, 23, 1, 4); R('#24140c', a - 2, 28, 5, 1); }
  }
  const lamps = P => { const k = Object.values(P.pos).sort((a, b) => a - b); return [P.bar + 2].concat(k.slice(1).map((v, i) => Math.round((v + k[i]) / 2)), P.door - 9); };
  function barFront(R, P) { const y = P.wall + 2, w = P.bar; R('rgba(40,16,6,.35)', 0, y + 14, w + 3, 3); frame(R, -2, y - 4, w + 4, 4, '#d09a5c'); R('#f0c484', 0, y - 4, w + 2, 1); frame(R, -2, y, w + 1, 14, '#8a4f2a'); for (let i = 5; i < w; i += 11) { R('#6e3c1f', i, y + 2, 1, 11); R('#a3643a', i + 1, y + 2, 8, 1); R('#a3643a', i + 1, y + 2, 1, 10); } mug(R, 8, y - 4); mug(R, w - 16, y - 4); mug(R, w - 10, y - 4); }
  function mug(R, a, b) { R('#24140c', a - 1, b - 6, 6, 6); R('#e8a83c', a, b - 4, 4, 3); R('#fff6e0', a, b - 5, 4, 2); R('#24140c', a + 5, b - 4, 1, 2); }
  function table(R, q, i) { const { x: a, y: b } = q; R('rgba(40,16,6,.32)', a - 11, b + 4, 22, 3); R('#24140c', a - 3, b - 5, 6, 9); R('#7a4424', a - 2, b - 5, 4, 9); R('#24140c', a - 6, b + 3, 12, 2); R('#24140c', a - 12, b - 10, 24, 7); R('#24140c', a - 13, b - 9, 26, 5); R('#c98a4e', a - 12, b - 9, 24, 4); R('#e0a868', a - 11, b - 9, 22, 1); R('#8a4f2a', a - 12, b - 5, 24, 1); mug(R, a - 8, b - 7); mug(R, a + 5, b - 7); if (i % 2) { R('#24140c', a - 3, b - 9, 7, 3); R('#f0e6d0', a - 2, b - 9, 5, 2); R('#c8683c', a - 1, b - 11, 3, 2); } else { R('#fff6d8', a - 1, b - 12, 2, 4); R('#ffb03c', a - 1, b - 14, 2, 2); } }
  function stool(R, a, b) { R('#24140c', a - 5, b - 7, 10, 4); R('#b0703f', a - 4, b - 6, 8, 2); R('#24140c', a - 4, b - 3, 2, 4); R('#24140c', a + 2, b - 3, 2, 4); }
  const SIT = 5;
  function scene(el, S, cur) {
    const cs = D.classes(S), team = D.team(S), cv = el.querySelector('canvas'), x = cv.getContext('2d'), R = rect(x), who = el.querySelector('.in-who'), guild = el.closest('.dv-panel'), big = guild.querySelector('.in-big'), back = document.createElement('canvas');
    let W = 0, H = 0, F = 0, P = null, k = 1, cw0 = 0, ch0 = 0, side0 = 0, last = performance.now();
    const tall = [], born = performance.now() / 1000, btn = [];
    if (!acts.has(cur)) { acts.clear(); acts.set(cur, born); }
    const goal = i => { const c = cs[i], n = team.indexOf(c); return n >= 0 && stOf(S, c) === 'in' ? P.line(team.length)(n) : P.seats[i % P.seats.length]; };
    const fit = () => { const cw = el.clientWidth || 360, ch = el.clientHeight || 240, info = guild.querySelector('.in-info'), bot = guild.querySelector('.in-bot'), land = cw > ch, side = (land ? info?.offsetWidth || 0 : 0) * 1e4 + (bot?.offsetHeight || 0) + (land ? 0 : info?.offsetHeight || 0); if (cw === cw0 && ch === ch0 && side === side0) return; cw0 = cw; ch0 = ch; side0 = side;
      const dpr = Math.max(1, devicePixelRatio || 1); k = Math.max(1, Math.round(Math.min(ch / (land ? 176 : 260), cw / (land ? 340 : 190)) * dpr)) / dpr; // 배율은 기기 화소의 정수배
      W = Math.ceil(cw / k); H = Math.ceil(ch / k); cv.width = back.width = W; cv.height = back.height = H; cv.style.width = W * k + 'px'; cv.style.height = H * k + 'px';
      F = land ? Math.round(W - (info?.offsetWidth || 0) / k) : W; const B = Math.round(H - ((bot?.offsetHeight || 0) + (land ? 0 : info?.offsetHeight || 0) + 4) / k);
      P = plan(F, B); room(back.getContext('2d'), W, H, F, P, S); at.forEach((v, c) => { v.snap = true; }); marks(); };
    const marks = () => {
      who.innerHTML = cs.map(c => { const st = stOf(S, c), on = team.includes(c) && st !== 'dead';
        return `<button data-in="${c}" class="in-g ${st}${on ? ' on' : ''}${c === cur ? ' cur' : ''}"><span>${st === 'dead' ? UI.px('skull') : ''}${st === 'new' ? '<em>+</em>' : ''}${on || c === cur || st === 'dead' ? esc(S.roster[c]?.m.name || clsN(c)) : ''}</span></button>`; }).join('');
      cs.forEach((c, i) => { btn[i] = who.children[i]; });
      const hot = (t, a, b, w, h) => { const b0 = guild.querySelector(`.dv-gtabs [data-tab="${t}"]`); if (b0) Object.assign(b0.style, { left: a * k + 'px', top: b * k + 'px', width: w * k + 'px', height: h * k + 'px' }); };
      hot('roster', 2, 18, P.bar - 4, P.wall - 14); hot('tree', P.pos.board - 18, 18, 36, 34); hot('dex', P.pos.shelf - 17, 16, 34, P.wall - 16); hot('go', P.door - 4, P.wall - 48, 36, 50); };
    const put = (sp, a, b, flip, al, cut) => { const c = TAVERNUI.bitmap(sp), w = sp.w, hh = cut ? sp.foot - cut : sp.h; x.save(); if (al) { x.globalAlpha = 0.5; x.filter = 'grayscale(1)'; } x.translate(Math.round(a), Math.round(b)); if (flip) x.scale(-1, 1); x.drawImage(c, 0, 0, w, hh, -Math.floor(w / 2), -sp.foot, w, hh); x.restore(); };
    const paint = () => {
      fit(); const now = performance.now(), t = now / 1000, dt = Math.min(0.2, (now - last) / 1000); last = now; x.imageSmoothingEnabled = false; x.globalCompositeOperation = 'source-over'; x.drawImage(back, 0, 0);
      const fx = P.pos.fire, w = P.wall;
      if (fx) for (let i = 0; i < 11; i++) { const h = Math.max(3, 9 + 4 * Math.sin(t * 6 + i * 1.7) + 3 * Math.sin(t * 11 + i * 0.9)) * (i > 2 && i < 8 ? 1 : 0.6), a = fx - 11 + i * 2; R('#e2531c', a, w - 2 - h, 2, h); R('#ffa63a', a, w - 2 - h * 0.65, 2, h * 0.65); if (i > 2 && i < 8) R('#fff09a', a, w - 2 - h * 0.35, 2, h * 0.35); }
      if (fx) { R('#4f2a16', fx - 10, w - 3, 20, 3); R('#8a4f2a', fx - 8, w - 4, 6, 2); }
      const Q = [];
      // 주인 (술청 뒤) · 술청
      Q.push({ y: w + 3, f: () => { const sp = MD.pixFolk?.(12, t); if (sp) put(sp, P.bar * 0.42 + 6 * Math.sin(t * 0.5), w + 5, Math.cos(t * 0.5) < 0); barFront(R, P); } });
      P.tables.forEach((q, i) => Q.push({ y: q.y + 1.5, f: () => table(R, q, i) }));
      // 손님: 빈 자리에 앉고, 하나는 문과 술청 사이를 오간다
      for (let j = 0; j < 6; j++) { const si = cs.length + j; if (si >= P.seats.length) break; const s = P.seats[si]; Q.push({ y: s.y, f: () => { const sp = MD.pixFolk?.(30 + j, t * 0.8 + j); stool(R, s.x, s.y); if (sp) put(sp, s.x, s.y - SIT + 3 + (Math.sin(t * 1.3 + j * 2) > 0.96 ? -1 : 0), s.dir < 0, 0, 4); } }); }
      { const a0 = P.bar + 8, a1 = P.door + 10, T = (a1 - a0) / 14, u = t % (2 * T + 6), out = u < T, wait = u >= T && u < T + 3, bk = u >= T + 3 && u < 2 * T + 3, a = out ? a0 + u * 14 : wait ? a1 : bk ? a1 - (u - T - 3) * 14 : a0; Q.push({ y: w + 14, f: () => { const sp = MD.pixFolk?.(21, t, out || bk ? 'Walk' : 'Idle'); if (sp) { R('rgba(40,16,6,.35)', a - 8, w + 13, 16, 3); put(sp, a, w + 14, bk || (!out && !wait)); } } }); }
      cs.forEach((c, i) => {
        const st = stOf(S, c), g = goal(i); let p = at.get(c); if (!p || p.snap) at.set(c, p = { x: g.x, y: g.y, dir: g.dir });
        const dx = g.x - p.x, dy = g.y - p.y, dd = Math.hypot(dx, dy), mv = dd > 0.5; if (mv) { const s = Math.min(dd, 62 * dt); p.x += dx / dd * s; p.y += dy / dd * s; p.dir = Math.abs(dx) > 1 ? Math.sign(dx) : p.dir; } else p.dir = g.dir;
        const sit = !mv && g.sit, on = team.includes(c) && st === 'in', act = acts.get(c), clip = mv ? 'Walk' : 'Idle';
        Q.push({ y: p.y, f: () => {
          const sp = MD.pix ? MD.pix(merc(S, c), t + i * 0.37, clip) : null;
          if (sit) stool(R, p.x, p.y); else { R('rgba(40,16,6,.35)', p.x - 10, p.y - 1, 20, 3); R('rgba(40,16,6,.35)', p.x - 7, p.y - 2, 14, 5); }
          if (c === cur) { const b = p.y + 2; R('#ffe08a', p.x - 11, b, 22, 1); R('#ffe08a', p.x - 13, b - 3, 2, 3); R('#ffe08a', p.x + 11, b - 3, 2, 3); }
          if (!sp) return; tall[i] = sp.foot - sp.top; put(sp, p.x, sit ? p.y - SIT + 3 : p.y, p.dir < 0, st === 'dead', sit ? 4 : 0); } });
        const h = tall[i] || 36, b = btn[i]; if (b) { const L = (p.x * k).toFixed(1) + 'px', T = ((p.y - h - 2) * k).toFixed(1) + 'px'; if (b.style.left !== L) b.style.left = L; if (b.style.top !== T) b.style.top = T; b.style.width = 28 * k + 'px'; b.style.marginLeft = -14 * k + 'px'; b.style.height = (h + 4) * k + 'px'; } });
      Q.sort((a, b) => a.y - b.y).forEach(q => q.f());
      // 빛
      x.globalCompositeOperation = 'screen'; const glow = (a, b, r, c) => { const g = x.createRadialGradient(a, b, 1, a, b, r); g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(a - r, b - r, r * 2, r * 2); };
      if (fx) glow(fx, w - 6, 74 + 3 * Math.sin(t * 7), `rgba(255,140,50,${0.4 + 0.05 * Math.sin(t * 9)})`); for (const a of lamps(P)) glow(a, 25, 26, 'rgba(255,200,90,.32)'); if (P.pos.win) glow(P.pos.win, 40, 44, 'rgba(255,170,90,.25)');
      x.globalCompositeOperation = 'source-over';
      // 정보 칸의 큰 그림
      if (big && cur) { const t0 = acts.get(cur) ?? -9, u = t - t0, st = stOf(S, cur), sp = MD.pix ? MD.pix(merc(S, cur), u < 1.2 ? u + 0.35 : t, u < 1.2 && st !== 'dead' ? 'Act' : 'Idle') : null, c = big.getContext('2d'); if (sp) { c.imageSmoothingEnabled = false; c.clearRect(0, 0, big.width, big.height); c.filter = st === 'dead' ? 'grayscale(1)' : 'none'; c.drawImage(TAVERNUI.bitmap(sp), Math.floor(big.width / 2 - sp.w / 2), big.height - 4 - sp.foot); } }
    };
    paint(); const tm = setInterval(() => { if (!el.isConnected) return clearInterval(tm); if (!document.hidden && !document.querySelector('#dv-sheet,#dv-hero,#dv-dex,#dv-pick')) paint(); }, 66);
  }
  // 초상: 인형 그림이 아직이면 다시 시도
  const faces = (box, S) => box.querySelectorAll('canvas[data-f]').forEach(cv => { const go = () => { if (cv.isConnected && !UI.face(cv, merc(S, cv.dataset.f))) setTimeout(go, 400); }; go(); });
  // 파티 초상 줄 (길드 · 지도가 같이 쓴다): 자리 수만큼 칸
  const party = (S, key) => { const t = D.team(S); return `<div class="in-party">${Array.from({ length: D.seats(S) }, (_, i) => { const c = t[i]; if (!c) return '<i class="in-p empty"></i>'; const m = S.roster[c]?.m;
    return `<button class="in-p on" data-${key}="${c}"><canvas data-f="${c}" width="26" height="30"${m ? '' : ' class="sil"'}></canvas><b>${esc(m?.name || clsN(c))}</b><em>${m?.lv || D.newLv(S)}</em><i class="in-pk">${D.knacksOf(m || { cls: c, lv: D.newLv(S) }).map(g => UI.px(D.KNACK[g].ic)).join('')}</i></button>`; }).join('')}</div>`; };
  // 오른쪽 정보: 큰 그림 · 이름 · 직업 · 레벨 · 단추
  function info(S, c) {
    if (!c) return ''; const h = S.roster[c], st = stOf(S, c), team = D.team(S), inT = team.includes(c);
    const keys = `<div class="in-keys">${D.knacksOf(h?.m || { cls: c, lv: D.newLv(S) }).map(g => `<span>${UI.px(D.KNACK[g].ic)}${esc(D.KNACK[g].n)}</span>`).join('')}</div>`; // 탐험 재주 (2026-11-27 — 영입 전에는 직업 · 레벨로 정해지는 것만)
    const top = (n, sub) => `<canvas class="in-big" width="80" height="50"></canvas><div class="in-hd"><b>${esc(n)}</b><small>${esc(sub)}</small></div>${keys}`;
    if (!h) return top(clsN(c), `Lv ${D.newLv(S)}`) + `<div class="in-act"><button class="in-hire" data-hire="${c}">영입</button></div>`;
    const m = h.m, need = G.Guild.needOf(m);
    return top(m.name, `${clsN(c)} · ${G.Builds.byId(m.build)?.n || ''}`)
      + `<div class="in-lv">Lv ${m.lv}<i><em style="width:${m.lv >= D.LV_MAX ? 100 : Math.round(100 * Math.min(1, (m.xp || 0) / need))}%"></em></i></div>`
      + `<div class="in-act">${st === 'dead' ? `<button class="in-hire" data-rev="${c}">부활 ${UI.px('coin')} ${D.reviveCost(S, c)}</button>` : inT ? `<button data-out="${c}"${team.length < 2 ? ' disabled' : ''}>빼기</button>` : `<button data-add="${c}"${team.length >= D.seats(S) ? ' disabled' : ''}>넣기</button>`}<button data-hero="${c}">상태</button></div>`;
  }
  return { scene, party, info, faces };
})();
