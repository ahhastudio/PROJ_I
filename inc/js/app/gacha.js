'use strict';
// 모집 연출 (2026-11-28 사용자: 「한국 수집형 게임 연출 — 문을 열고 우르르 들어오다가, 높은 성급이 있으면 갈라져서 그 영웅이 들어온다」 · 「외국인들한테 K-가챠의 재미를」)
// 그리기만 (게임 규칙 없음): 지원자 [m] → 문이 열린다 → 실루엣 무리가 우르르 → (4성 이상) 멈칫 · 양옆으로 갈라짐 · 문에서 빛기둥 · 그 영웅이 천천히 · 번쩍 · 별 도장
//   → 줄 선 무리가 왼쪽부터 색을 찾으며 별이 뜬다 → 누르면 닫힌다. 아무 때나 누르면 끝 장면으로 건너뛴다
const GACHA = (() => {
  const COL = { 1: '#e8e0d0', 2: '#e8e0d0', 3: '#5a9cff', 4: '#b06aff', 5: '#ffd45a' };
  const RGB = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const ease = u => 1 - (1 - Math.min(1, Math.max(0, u))) ** 3;
  function play(list) {
    return new Promise(done => {
      const el = document.createElement('div'); el.id = 'dv-gacha'; el.innerHTML = '<canvas></canvas><button class="gc-skip">▶▶</button>'; document.body.append(el);
      const cv = el.querySelector('canvas'), x = cv.getContext('2d'), dpr = Math.max(1, devicePixelRatio || 1);
      const k = Math.max(1, Math.floor(Math.min(innerWidth / 300, innerHeight / 170) * dpr)) / dpr, W = Math.ceil(innerWidth / k), H = Math.ceil(innerHeight / k);
      cv.width = W; cv.height = H; cv.style.width = W * k + 'px'; cv.style.height = H * k + 'px';
      // ── 무대: 가운데 큰 문 · 벽 · 바닥 · 카펫 · 횃불 ──
      const DX = Math.round(W / 2), DW = 52, DH = 66, DB = Math.round(Math.max(DH + 18, H * 0.48)), DT = DB - DH;
      const n = list.length, two = n > 5, fy = H - 16, by = H - 46, gap = Math.min(46, (W - 30) / 5);
      // 자리: 앞줄 가운데부터 높은 성급, 나머지는 뒷줄 → 앞줄 남는 곳
      const front = [2, 1, 3, 0, 4].map(i => ({ x: Math.round(DX + (i - 2) * gap), y: fy })), back = [2, 1, 3, 0, 4].map(i => ({ x: Math.round(DX + (i - 2) * gap + gap / 2 * (i < 2 ? -0.3 : i > 2 ? 0.3 : 0)), y: by }));
      const ord = list.map((m, i) => ({ m, i, star: Math.min(5, m.star || 1) })).sort((a, b) => b.star - a.star);
      const sp = ord.filter(a => a.star >= 4), nor = ord.filter(a => a.star < 4);
      const slots = two ? front.slice(0, sp.length).concat(back, front.slice(sp.length)) : front;
      ord.forEach((a, j) => { const s = slots[j] || front[j % 5]; a.tx = s.x; a.ty = s.y; });
      // 시간표
      const T_OPEN = 0.55, T_RUN = 0.9, RUN_V = 150, special = sp.length > 0;
      const T_SPLIT = special ? T_RUN + Math.min(nor.length, 6) * 0.07 + 0.25 : 99;
      nor.forEach((a, j) => { a.t0 = T_RUN + j * 0.07 + (j % 3) * 0.02; a.lane = (j % 2 ? 1 : -1) * (6 + (j * 7) % 14); });
      // 높은 성급: 가장 높은 별(top)만 천천히 · 그보다 낮은 4성은 먼저 함께 빠르게 (여럿이어도 길어지지 않게) · 같은 별은 나란히
      const top = sp.length ? sp[0].star : 0, tops = sp.filter(a => a.star === top), lows = sp.filter(a => a.star < top); let tA = T_SPLIT + 0.5;
      if (lows.length) { let mx = 0; lows.forEach((a, j) => { a.low = true; a.sx = DX + (j - (lows.length - 1) / 2) * 8; a.t0 = tA + j * 0.06; a.arr = a.t0 + Math.hypot(a.tx - a.sx, a.ty - DB) / 95; mx = Math.max(mx, a.arr); }); tA = mx + 0.45; }
      tops.forEach((a, j) => { a.sx = DX + (j - (tops.length - 1) / 2) * 12; a.t0 = tA; a.arr = tA + Math.hypot(a.tx - a.sx, a.ty - DB) / 52; });
      const spIn = lows.concat(tops), lastArr = spIn.length ? Math.max(...spIn.map(a => a.arr)) : 0;
      const tNorm = nor.length ? Math.max(...nor.map(a => a.t0 + Math.hypot(a.tx - DX, a.ty - DB) / RUN_V * 1.25)) + (special ? 0.35 : 0) : T_RUN;
      const T_REV = Math.max(tNorm, special ? lastArr + 1.0 : 0) + 0.25;
      const revOrd = nor.slice().sort((a, b) => a.tx - b.tx || a.ty - b.ty); revOrd.forEach((a, j) => { a.rev = T_REV + j * 0.13; }); spIn.forEach(a => { a.rev = a.arr; });
      const T_END = T_REV + revOrd.length * 0.13 + 0.45;
      // ── 상태 ──
      const parts = [], start = performance.now(); let skipAt = 0, closed = false, lastT = 0, shake = 0;
      const now = () => (performance.now() - start) / 1000 + skipAt;
      const sil = new WeakMap(), silOf = (c, col) => { const key = c, m0 = sil.get(key) || {}; if (m0[col]) return m0[col]; const o = document.createElement('canvas'); o.width = c.width; o.height = c.height; const ox = o.getContext('2d'); ox.drawImage(c, 0, 0); ox.globalCompositeOperation = 'source-in'; ox.fillStyle = col; ox.fillRect(0, 0, o.width, o.height); m0[col] = o; sil.set(key, m0); return o; };
      const puff = (px, py, c, nP = 6, up = 0) => { for (let i = 0; i < nP; i++) parts.push({ x: px + (Math.random() - 0.5) * 8, y: py, vx: (Math.random() - 0.5) * 40, vy: -Math.random() * 18 - up, life: 0.5 + Math.random() * 0.4, t: 0, c, s: 1 + (Math.random() < 0.3) }); };
      const R = (c, a, b, w, h) => { x.fillStyle = c; x.fillRect(Math.round(a), Math.round(b), Math.round(w), Math.round(h)); };
      function stage(t, beam) {
        // 벽 (어두운 돌) · 바닥
        R('#1a1216', 0, 0, W, DB); for (let y = 4, r = 0; y < DB; y += 9, r++) for (let a = (r % 2) * 12 - 12; a < W; a += 24) { R('#241a20', a + 1, y, 22, 8); R('#2c2028', a + 1, y, 22, 1); }
        R('#120c0e', 0, DB - 4, W, 4);
        for (let y = DB, r = 0; y < H; y += 10, r++) { R(r % 2 ? '#2a2026' : '#30242a', 0, y, W, 10); R('#1c1418', 0, y, W, 1); }
        // 카펫 (문에서 앞으로 넓어진다)
        for (let y = DB; y < H; y++) { const u = (y - DB) / (H - DB), w2 = 14 + u * 34; R('#5a141c', DX - w2, y, w2 * 2, 1); R('#8a2430', DX - w2 + 2, y, w2 * 2 - 4, 1); R('#d0a040', DX - w2 + 2, y, 1, 1); R('#d0a040', DX + w2 - 3, y, 1, 1); }
        // 깃발
        for (const s of [-1, 1]) { const a = DX + s * (DW / 2 + 34) - 9; R('#3a1d0f', a - 2, 6, 22, 2); R('#7a1f26', a, 8, 18, DT - 4); R('#a8323a', a + 2, 8, 14, DT - 6); R('#e0b04c', a + 7, 16, 4, 4); R('#7a1f26', a + 4, DT + 4, 10, 3); }
        // 문틀 · 안쪽 빛 · 문짝
        const op = ease((t - T_OPEN * 0.6) / 0.45), leaf = Math.round((DW / 2 - 2) * (1 - op));
        R('#0c080a', DX - DW / 2 - 7, DT - 9, DW + 14, DH + 9); R('#5a5662', DX - DW / 2 - 5, DT - 7, DW + 10, DH + 7); R('#8a8694', DX - DW / 2 - 5, DT - 7, DW + 10, 2);
        { const g = x.createLinearGradient(0, DT, 0, DB); const c0 = beam ? COL[beam] : '#fff4c8'; g.addColorStop(0, '#ffffff'); g.addColorStop(1, c0); x.fillStyle = op > 0 ? g : '#0a0608'; x.fillRect(DX - DW / 2, DT, DW, DH); }
        for (const s of [-1, 1]) { const a = s < 0 ? DX - DW / 2 : DX + DW / 2 - leaf; if (leaf > 0) { R('#4a2a16', a, DT, leaf, DH); for (let y = DT + 4; y < DB; y += 8) R('#3a1f10', a, y, leaf, 1); R('#6a3c1f', s < 0 ? a + leaf - 1 : a, DT, 1, DH); if (leaf > 6) R('#d0a040', s < 0 ? a + leaf - 5 : a + 3, DT + DH / 2, 2, 4); } }
        // 횃불
        for (const s of [-1, 1]) { const a = DX + s * (DW / 2 + 14); R('#24140c', a - 2, DT + 12, 4, 10); const f = 4 + Math.sin(t * 13 + s) * 1.5; R('#e2531c', a - 2, DT + 12 - f, 4, f); R('#ffd45a', a - 1, DT + 13 - f * 0.6, 2, f * 0.6); }
        return op;
      }
      function glow(a, b, r, col, al) { const [cr, cg, cb] = RGB(col); const g = x.createRadialGradient(a, b, 1, a, b, r); g.addColorStop(0, `rgba(${cr},${cg},${cb},${al})`); g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`); x.fillStyle = g; x.fillRect(a - r, b - r, r * 2, r * 2); }
      function draw(a, px, py, dir, t, mode, col) { // mode: 'sil' 실루엣 · 'glow' 빛나는 실루엣 · 'on' 원래 색
        const s0 = MD.pix ? MD.pix(a.m, t + a.i * 0.31, a.moving ? 'Walk' : 'Idle') : null; if (!s0) return; const c = TAVERNUI.bitmap(s0);
        R('rgba(0,0,0,.35)', px - 9, py - 1, 18, 3);
        const img = mode === 'on' ? c : silOf(c, mode === 'glow' ? '#0a0810' : '#08060a');
        x.save(); x.translate(Math.round(px), Math.round(py)); if (dir < 0) x.scale(-1, 1);
        if (mode === 'glow') { for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) x.drawImage(silOf(c, col), -Math.floor(s0.w / 2) + ox, -s0.foot + oy); }
        x.drawImage(img, -Math.floor(s0.w / 2), -s0.foot);
        if (a.flashT != null && t - a.flashT < 0.14) { x.globalAlpha = 1 - (t - a.flashT) / 0.14; x.drawImage(silOf(c, '#ffffff'), -Math.floor(s0.w / 2), -s0.foot); }
        x.restore(); a.top = py - (s0.foot - s0.top);
      }
      function posOf(a, t) { // 지금 자리 · 움직이는 중인지
        if (a.star >= 4) { if (t < a.t0) return null; const u = Math.min(1, (t - a.t0) / (a.arr - a.t0)); return { x: a.sx + (a.tx - a.sx) * u, y: DB - 1 + (a.ty - DB + 1) * u, mv: u < 1, dir: a.tx >= a.sx ? 1 : -1 }; }
        if (t < a.t0) return null; const d = Math.hypot(a.tx - DX, a.ty - DB), run = d / RUN_V;
        let u = (t - a.t0) / run;
        if (special && t > T_SPLIT) { // 멈칫(0.3초) 뒤 갈라져 제자리로
          const uS = (T_SPLIT - a.t0) / run; if (uS < 1) { const hold = t - T_SPLIT < 0.3; u = hold ? uS : uS + (t - T_SPLIT - 0.3) / (run * 0.55); if (hold) { const p = mid(a, uS); return { ...p, mv: false, dir: DX > p.x ? 1 : -1, hold: true }; } } }
        u = Math.min(1, u); const p = mid(a, u); return { ...p, mv: u < 1, dir: u < 1 ? (a.tx >= DX ? 1 : -1) : (a.tx > DX ? -1 : 1) };
      }
      const mid = (a, u) => { const e = u, sx = DX + a.lane * Math.sin(Math.PI * Math.min(1, e)) * 0.6; return { x: sx + (a.tx - DX) * e, y: DB - 1 + (a.ty - DB + 1) * e }; };
      function frame() {
        if (closed) return; const t = now(), dt = Math.max(0, Math.min(0.05, t - lastT)); lastT = t;
        x.imageSmoothingEnabled = false;
        const curSp = spIn.find(a => t >= a.t0 - 0.6 && t < a.arr + 0.2), beam = special && t > T_SPLIT ? (curSp || spIn[spIn.length - 1]).star : 0;
        if (shake > 0) shake = Math.max(0, shake - dt);
        x.save(); if (shake > 0) x.translate(Math.round((Math.random() - 0.5) * 6 * shake / 0.3), Math.round((Math.random() - 0.5) * 4 * shake / 0.3));
        const op = stage(t, beam);
        // 문에서 쏟아지는 빛
        if (op > 0) { const c = beam ? COL[beam] : '#fff0c0', [cr, cg, cb] = RGB(c); x.globalCompositeOperation = 'screen'; const g = x.createLinearGradient(0, DB, 0, H); g.addColorStop(0, `rgba(${cr},${cg},${cb},${0.38 * op})`); g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`); x.fillStyle = g; x.beginPath(); x.moveTo(DX - DW / 2, DB); x.lineTo(DX + DW / 2, DB); x.lineTo(DX + DW * 1.4, H); x.lineTo(DX - DW * 1.4, H); x.closePath(); x.fill(); glow(DX, DB - DH / 2, DW * 1.2, c, 0.35 * op); x.globalCompositeOperation = 'source-over'; }
        // 빛기둥 (높은 성급이 들어오는 동안)
        if (curSp && t > T_SPLIT + 0.3) { const c = COL[curSp.star], [cr, cg, cb] = RGB(c), pul = 0.75 + 0.25 * Math.sin(t * 9); x.globalCompositeOperation = 'screen'; const g = x.createLinearGradient(DX - DW / 2, 0, DX + DW / 2, 0); g.addColorStop(0, `rgba(${cr},${cg},${cb},0)`); g.addColorStop(0.5, `rgba(${cr},${cg},${cb},${0.55 * pul})`); g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`); x.fillStyle = g; x.fillRect(DX - DW / 2, 0, DW, DB); x.globalCompositeOperation = 'source-over';
          if (Math.random() < 0.6) parts.push({ x: DX + (Math.random() - 0.5) * DW, y: DB - Math.random() * 10, vx: 0, vy: -30 - Math.random() * 30, life: 1, t: 0, c, s: 1 }); }
        // 사람들 (y 순서)
        const Q = [];
        for (const a of ord) { const p = posOf(a, t); if (!p) continue; a.moving = p.mv;
          if (!a.out && p) { a.out = true; puff(DX, DB, '#8a7a70', a.star >= 4 ? 10 : 4); }
          if (a.star < 4 && p.mv && Math.random() < dt * 14) puff(p.x, p.y, '#6a5a52', 1);
          const shown = t >= a.rev; if (shown && !a.shownOnce) { a.shownOnce = true; a.flashT = t; if (a.star >= 4 && !a.low) { shake = 0.3; a.stampT = t; puff(p.x, p.y - 10, COL[a.star], 22, 30); } else if (a.low) { shake = Math.max(shake, 0.12); puff(p.x, p.y - 10, COL[a.star], 12, 24); } else if (a.star >= 3) puff(p.x, p.y - 8, COL[3], 8, 20); }
          Q.push({ y: p.y, f: () => draw(a, p.x, p.y, p.dir, t, shown ? 'on' : a.star >= 4 ? 'glow' : 'sil', COL[a.star]) }); }
        Q.sort((a, b) => a.y - b.y).forEach(q => q.f());
        // 별 (공개된 사람 머리 위)
        for (const a of ord) { if (!a.shownOnce || a.top == null) continue; const p = posOf(a, t); if (!p) continue; const u = ease((t - a.rev) / 0.25), c = COL[a.star], nS = a.star, w0 = nS * 5; x.globalAlpha = u; for (let i = 0; i < nS; i++) star(p.x - w0 / 2 + i * 5 + 2, a.top - 4 - (1 - u) * 6, c); x.globalAlpha = 1; }
        // 파편
        for (const q of parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 30 * dt; } for (let i = parts.length - 1; i >= 0; i--) if (parts[i].t > parts[i].life) parts.splice(i, 1);
        for (const q of parts) { x.globalAlpha = Math.max(0, 1 - q.t / q.life); R(q.c, q.x, q.y, q.s, q.s); } x.globalAlpha = 1;
        x.restore();
        // 어둠 (처음) · 멈칫할 때 어두워짐 · 번쩍
        const dark = Math.max(0, 0.7 * (1 - t / T_OPEN)) + (special && t > T_SPLIT && t < T_SPLIT + 0.9 ? 0.45 * Math.sin(Math.PI * (t - T_SPLIT) / 0.9) : 0);
        if (dark > 0) R(`rgba(0,0,0,${dark.toFixed(3)})`, 0, 0, W, H);
        if (special && t > T_SPLIT && t < T_SPLIT + 0.12) R(`rgba(255,255,255,${(0.5 * (1 - (t - T_SPLIT) / 0.12)).toFixed(3)})`, 0, 0, W, H);
        for (const a of spIn) if (a.stampT != null && t - a.stampT < 1.1) { const u = t - a.stampT; if (u < 0.22) R(`rgba(255,255,255,${(0.85 * (1 - u / 0.22)).toFixed(3)})`, 0, 0, W, H); stamp(a.star, u); }
        if (t >= T_END) { const b = 0.5 + 0.5 * Math.sin(t * 5); x.globalAlpha = b; R('#f0dcae', DX - 3, H - 6, 7, 1); R('#f0dcae', DX - 2, H - 5, 5, 1); R('#f0dcae', DX - 1, H - 4, 3, 1); R('#f0dcae', DX, H - 3, 1, 1); x.globalAlpha = 1; }
        requestAnimationFrame(frame);
      }
      function star(a, b, c) { R('#120c08', a - 2, b - 1, 5, 3); R('#120c08', a - 1, b - 2, 3, 5); R(c, a - 1, b, 3, 1); R(c, a, b - 1, 1, 3); }
      function stamp(nS, u) { // 별 도장: 크게 떨어져 쾅
        const s = u < 0.18 ? 3 - 2 * (u / 0.18) : 1, al = u > 0.85 ? 1 - (u - 0.85) / 0.25 : 1, c = COL[nS], cy = Math.round(H * 0.3), sz = Math.round(9 * s), step = sz + 3;
        x.globalAlpha = Math.max(0, al); for (let i = 0; i < nS; i++) { const a = DX + (i - (nS - 1) / 2) * step; big(a, cy, sz, c); } x.globalAlpha = 1;
      }
      function big(a, b, r, c) { x.fillStyle = '#120c08'; poly(a, b, r + 2); x.fill(); x.fillStyle = c; poly(a, b, r); x.fill(); x.fillStyle = 'rgba(255,255,255,.55)'; poly(a - r * 0.15, b - r * 0.2, r * 0.35); x.fill(); }
      function poly(a, b, r) { x.beginPath(); for (let i = 0; i < 10; i++) { const ang = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; x.lineTo(a + Math.cos(ang) * rr, b + Math.sin(ang) * rr); } x.closePath(); }
      const close = () => { closed = true; el.remove(); done(); };
      el.onclick = ev => { ev.stopPropagation(); if (now() < T_END) { skipAt += T_END - now(); for (const a of ord) { a.out = true; a.shownOnce = true; a.flashT = null; } return; } close(); }; // 건너뛰기: 끝 장면 (번쩍 · 도장 없이) → 한 번 더 누르면 닫힘
      el.onpointerup = ev => ev.stopPropagation();
      requestAnimationFrame(frame);
    });
  }
  return { play };
})();
