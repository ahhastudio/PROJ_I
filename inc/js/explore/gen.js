'use strict';
// 한 막의 던전 만들기 (ROGUELIKE_PLAN 4-2 · 4-3 · 2-1의 6번, DESIGN.md 176).
// 순서: ① 진짜 던전을 키운다 (watabou One Page Dungeon의 방식 — 방에 대칭 날개 · 앞방을 붙여 "부분 대칭"을 만들고,
// 이웃한 방을 이어 고리를 더한다) ② 입구에서의 깊이로 방향을 정해 갈림길 그래프를 뽑는다 (더 깊은 방으로만 간다)
// ③ 방 종류 · 길 종류를 매기고, 층마다 꼭 들어갈 구조와 "열쇠 없이 갈 길"을 검사한다.
RUN.gen = (() => {
  const ROWS_GRAPH = 8;
  // 층의 윤곽 (DESIGN.md 180): 같은 규칙으로 키워도 윤곽이 다르면 전체 모습이 달라진다.
  // 캔버스 기준(앞 = 위)에서 키운 뒤 rot(돌리기) · flip(뒤집기)으로 실제 지도에 옮긴다.
  const FRAMES = {
    tall: rng => ({ n: '세로형', cw: 40, ch: 84, sx: 0.5, up: 0.55, rot: 0, region: () => true }),
    wide: rng => ({ n: '가로형', cw: 38, ch: 78, sx: 0.5, up: 0.55, rot: 1, region: () => true }),
    square: rng => ({ n: '정사각형', cw: 58, ch: 58, sx: 0.3 + rng() * 0.4, up: 0.3, rot: 0, region: () => true }),
    blob: rng => { const cw = 58, ch = 66, rx = cw / 2 - 1, ry = ch / 2 - 1, cx = cw / 2, cy = ch / 2, ph = rng() * 6;
      return { n: '덩어리형', cw, ch, sx: 0.5, up: 0.4, rot: rng() < 0.5 ? 0 : 1, region: (x, y) => { const a = Math.atan2(y - cy, x - cx), w = 1 + 0.16 * Math.sin(a * 3 + ph) + 0.1 * Math.sin(a * 5 + ph * 2); return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= w * w; } }; },
    ell: rng => ({ n: 'L자형', cw: 62, ch: 66, sx: 0.2, up: 0.5, rot: 0, region: (x, y) => x < 28 || y < 30 }),
    diag: rng => ({ n: '대각선형', cw: 64, ch: 72, sx: 0.12, up: 0.55, rot: 0, region: (x, y) => { const t = (x / 64) - (1 - y / 72); return Math.abs(t) < 0.4; } }),
  };
  const frameOf = (seed, S = {}) => { const r = RUN.rng(seed * 101 + 17), keys = S.frames || Object.keys(FRAMES), F = FRAMES[keys[Math.floor(r() * keys.length)]](r); F.flip = r() < 0.5; return F; }; // S.frames: 구역이 고른 윤곽
  const KEYLESS = { open: 1, trap: 1, dark: 1 };
  const keyless = e => !!KEYLESS[e.kind];
  const D4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const D8 = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];

  // ── 방 모양 (상대 칸 목록). 네 변의 가운데 칸은 늘 들어 있다 (문 자리) ──
  function shapeOf(rng, kind, w, h) {
    const cx = (w - 1) / 2, cy = (h - 1) / 2, out = [], decor = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let ok = true;
      if (kind === 'round') ok = (x - cx) ** 2 + (y - cy) ** 2 <= (cx + 0.55) ** 2;
      else if (kind === 'cross') ok = Math.abs(x - cx) <= Math.floor(w / 4) || Math.abs(y - cy) <= Math.floor(h / 4);
      else if (kind === 'tmpl') ok = true; // 손으로 짠 방의 자리: 사각형 전체 (모양은 나중에 템플릿으로)
      else if (kind === 'cave') { const r = ((x - cx) / (cx + 0.5)) ** 2 + ((y - cy) / (cy + 0.5)) ** 2; ok = r <= 1 + (rng() - 0.6) * 0.7 || x === Math.floor(cx) || y === Math.floor(cy); } // 문 자리 줄 (짝수 변은 가운데 앞 칸 — mid와 같게)
      if (ok) out.push([x, y]);
    }
    if (kind === 'hall') for (let x = 2; x < w - 2; x += 2) { decor.push({ k: 'pillar', x, y: 1 }); decor.push({ k: 'pillar', x, y: h - 2 }); }
    if (kind === 'round' && w >= 7 && rng() < 0.6) decor.push({ k: 'pool', x: cx, y: cy, r: w >= 9 ? 1.6 : 1.1 });
    if (kind === 'cave') for (let i = 0; i < 4; i++) { const c = out[Math.floor(rng() * out.length)]; decor.push({ k: 'rubble', x: c[0], y: c[1] }); }
    return { cells: out, decor };
  }
  // 방 모양 뽑기: 구역 규칙표의 shape.rooms · shape.big 무게 (없으면 예전 비율)
  // 방은 적게 · 넓게 (2026-11-19): 파티 넷과 적 여섯이 자리를 잡을 만큼 — 보통 방 7~9 × 5~7칸, 큰 방 11칸
  const SIZE = { rect: rng => ['rect', 7 + 2 * Math.floor(rng() * 2), 5 + 2 * Math.floor(rng() * 2)], hall: () => ['hall', 9, 7], round: rng => ['round', rng() < 0.5 ? 7 : 9, 0], cave: () => ['cave', 9, 7], cross: () => ['cross', 9, 9] };
  const BIG = { hall: ['hall', 11, 9], round: ['round', 11, 11], cross: ['cross', 11, 11] };
  // 작은 방 (원정 — RUN.SMALL, 2026-11-24 사용자: 「방사이즈를 줄이고 줌아웃을 꺼보자」): 폰 세로 화면에 전투 방이 줌아웃 없이 들어오게. 보통 3~5칸(9~15타일) · 큰 방(우두머리) 7칸(21타일). 손으로 짠 방(7칸 이상)은 쓰지 않는다
  // 2026-11-27 (방 안에서 싸운다): [모양, 문 쪽 폭, 깊이] — 폭 5칸(10타일: 앞줄 · 뒷줄에 영웅 다섯까지) · 입구에서 안쪽으로 6~7칸(12~14타일: 배치 구역 4타일 · 간격 · 적). 옆으로 붙는 방은 plan이 돌려 놓는다. 둥근 방은 길쭉하게 못 해 동굴로
  const SIZE_S = { rect: rng => ['rect', 5, 6 + Math.floor(rng() * 2)], hall: () => ['hall', 5, 7], round: () => ['cave', 5, 6], cave: () => ['cave', 5, 6], cross: () => ['cross', 5, 7] };
  const BIG_S = { hall: ['hall', 7, 5], round: ['round', 7, 7], cross: ['cross', 7, 7] };
  const SHAPE0 = { rooms: [['rect', 0.32], ['hall', 0.2], ['round', 0.18], ['cave', 0.15], ['cross', 0.15]], big: [['hall', 0.4], ['round', 0.35], ['cross', 0.25]] };
  const wpick = (rng, list) => { let u = rng() * list.reduce((a, x) => a + x[1], 0); for (const [k, w] of list) if ((u -= w) < 0) return k; return list[0][0]; };
  function pickRoom(rng, big, S = {}, TP = []) {
    // 손으로 짠 방이 있는 구역: 방 크기를 그 템플릿들의 크기에서 고른다 (자리 종류는 나중에 정하므로 우두머리 · 입구 아닌 것 고루)
    if (TP.length) { const pool = TP.filter(t => (big ? t.tags.includes('boss') : !t.tags.includes('boss') && !t.tags.includes('start'))); if (pool.length) { const [w, h] = tdim(RUN.pick(rng, pool)); return ['tmpl', w, h]; } }
    if (RUN.SMALL) return big ? BIG_S[wpick(rng, S.big || SHAPE0.big)].slice() : SIZE_S[wpick(rng, S.rooms || SHAPE0.rooms)](rng);
    return big ? BIG[wpick(rng, S.big || SHAPE0.big)].slice() : SIZE[wpick(rng, S.rooms || SHAPE0.rooms)](rng);
  }
  // 손으로 짠 방 (js/explore/rooms.js): 구역의 템플릿 · 칸 크기 · 돌리기(시계 방향 90°) · 좌우 뒤집기
  const tplsOf = zid => (typeof RUN.ROOMS !== 'undefined' ? RUN.ROOMS.filter(t => t.zone === zid) : []);
  const tdim = t => [t.map[0].length / RUN.ROOM_K, t.map.length / RUN.ROOM_K];
  const rotCW = rows => [...rows[0]].map((_, x) => rows.map((_, y) => rows[rows.length - 1 - y][x]).join(''));
  const flipX = rows => rows.map(r => [...r].reverse().join(''));

  function grow(seed, F, S = {}, TP = [], raw = false, late = false) { // late: 우두머리 방을 나중에 (설계서 층 — 큰길을 고른 뒤 그 끝 방에 붙인다, addBoss) · raw: 막다른 방 고치기를 건너뛴다 (설계서 층 — 막다른 방을 곁방으로 쓴다) // S: 구역 생김새 (RUN.ZONES의 shape) · TP: 그 구역의 손으로 짠 방
    const CW = F.cw, CH = F.ch;
    const rng = RUN.rng(seed), occ = new Int8Array(CW * CH), own = new Int16Array(CW * CH).fill(-1);
    const at = (x, y) => x < 0 || y < 0 || x >= CW || y >= CH ? 9 : occ[y * CW + x];
    const ownAt = (x, y) => x < 0 || y < 0 || x >= CW || y >= CH ? -1 : own[y * CW + x];
    const inB = (x, y) => x >= 1 && y >= 1 && x < CW - 1 && y < CH - 1 && F.region(x, y);
    const rooms = [], links = [];
    const mark = (cells, v, id) => { for (const [x, y] of cells) { occ[y * CW + x] = v; own[y * CW + x] = id; } };
    const mkRoom = (kind, w, h, x0, y0) => { if (kind === 'round') h = w; const s = shapeOf(rng, kind, w, h); return { kind, w, h, x: x0, y: y0, rel: s.cells, decor: s.decor, cells: s.cells.map(([a, b]) => [x0 + a, y0 + b]) }; };
    const fits = (r, allowOwn = -1) => r.cells.every(([x, y]) => inB(x, y) && at(x, y) === 0 && D8.every(([dx, dy]) => at(x + dx, y + dy) === 0));
    const corOk = (cells, parent) => cells.every(([x, y], i) => inB(x, y) && at(x, y) === 0 && D8.every(([dx, dy]) => { const v = at(x + dx, y + dy); return v === 0 || (v === 1 && ownAt(x + dx, y + dy) === parent && i === 0); }));
    // 변의 가운데 칸 (문 자리). 짝수 변(깊이 6칸 방)은 가운데 앞 칸 — 내림하지 않으면 문 · 복도가 x.5 칸에 놓여, 문 잇기(FIXDOORS)가 끝나지 않고 메모리를 다 먹었다 (2026-11-27)
    const mid = (r, s) => { const cx = Math.floor((r.w - 1) / 2), cy = Math.floor((r.h - 1) / 2); return s === 'up' ? [r.x + cx, r.y] : s === 'down' ? [r.x + cx, r.y + r.h - 1] : s === 'left' ? [r.x, r.y + cy] : [r.x + r.w - 1, r.y + cy]; };
    const DIR = { up: [0, -1], left: [-1, 0], right: [1, 0] }, OPP = { up: 'down', left: 'right', right: 'left' };
    // 부모 p의 s변에서 길이 L 복도 끝에 (kind, w, h) 방을 놓는 안
    function plan(p, s, kind, w, h, L) {
      if (RUN.SMALL && s !== 'up') [w, h] = [h, w]; // 작은 방: 깊이(h)가 늘 문에서 안쪽으로 — 옆으로 붙으면 돌린다
      const [dx, dy] = DIR[s], [px, py] = mid(p, s), cor = [];
      for (let i = 1; i <= L; i++) cor.push([px + dx * i, py + dy * i]);
      const [ex, ey] = cor[cor.length - 1], hh = kind === 'round' ? w : h;
      const ddx = s === 'up' ? Math.floor((w - 1) / 2) : s === 'left' ? w - 1 : 0, ddy = s === 'up' ? hh - 1 : Math.floor((hh - 1) / 2);
      const r = mkRoom(kind, w, h, ex + dx - ddx, ey + dy - ddy);
      return { r, cor, door: [px, py], cdoor: [ex + dx, ey + dy] };
    }
    function commit(p, pl) {
      const id = rooms.length; pl.r.id = id; pl.r.parent = p.id; pl.r.dep = p.dep + 1; rooms.push(pl.r); mark(pl.r.cells, 1, id); mark(pl.cor, 2, -1);
      links.push({ a: p.id, b: id, cells: pl.cor, doorA: pl.door, doorB: pl.cdoor, tree: true });
      return pl.r;
    }
    // 입구
    const start = mkRoom(TP.length ? 'tmpl' : 'rect', RUN.SMALL ? 5 : 7, RUN.SMALL ? 3 : 5, Math.max(2, Math.min(CW - 9, Math.round(F.sx * CW) - 3)), CH - 8); start.id = 0; start.parent = -1; start.dep = 0; rooms.push(start); mark(start.cells, 1, 0);
    start.tried = {};
    for (let guard = 0; guard < 500 && rooms.length < (S.grow || 11); guard++) {
      // 위쪽(앞으로) 방을 더 자주 고른다
      const open = rooms.filter(r => (!r.tried || Object.keys(r.tried).length < 3) && !(S.deep && r.dep >= S.deep)); // S.deep (설계서 층): 입구에서 그 걸음까지만 키운다 — 우두머리가 큰길 길이에 맞는 자리에 서게
      if (!open.length) break;
      open.sort((a, b) => a.y - b.y);
      const p = rng() < F.up ? open[Math.floor(rng() * Math.min(3, open.length))] : open[Math.floor(rng() * open.length)];
      p.tried = p.tried || {};
      const [kind, w, h] = pickRoom(rng, false, S, TP), L = RUN.COMPACT ? 1 + (rng() < (RUN.L2 ?? 0) ? 1 : 0) : 2 + Math.floor(rng() * 3), u = rng(); // COMPACT (원정, 2026-11-26 사용자: 「쓸때없이 복도를 길게 만들지말고」): 방을 문 한 칸 사이로 붙인다
      if (u < (S.pair ?? 0.45) && !p.tried.pair) {
        // 대칭 날개: 양옆에 같은 방
        p.tried.pair = 1; const a = plan(p, 'left', kind, w, h, L), b = plan(p, 'right', kind, w, h, L);
        if (corOk(a.cor, p.id) && fits(a.r) && corOk(b.cor, p.id)) { commit(p, a); if (fits(b.r) && corOk(b.cor, p.id)) commit(p, b); }
      } else if (!p.tried.up) {
        p.tried.up = 1; const a = plan(p, 'up', kind, w, h, L + (!RUN.COMPACT && rng() < 0.3 ? 2 : 0));
        if (corOk(a.cor, p.id) && fits(a.r)) commit(p, a);
      } else if (!p.tried.side) {
        p.tried.side = 1; const s = rng() < 0.5 ? 'left' : 'right', a = plan(p, s, kind, w, h, L);
        if (corOk(a.cor, p.id) && fits(a.r)) commit(p, a);
      }
    }
    // 우두머리 방: 가장 위쪽 방 위에 큰 방
    const tops = rooms.slice().sort((a, b) => a.y - b.y);
    let boss = null;
    const bossAt = (p, sides) => { for (const s of sides) for (const L of RUN.COMPACT ? [1, 2] : [2, 3, 4]) { const [kind, w, h] = pickRoom(rng, true, S, TP), a = plan(p, s, kind, w, h, L); if (corOk(a.cor, p.id) && fits(a.r)) return commit(p, a); } return null; };
    if (!late) { for (const p of tops.slice(0, 6)) { boss = bossAt(p, ['up']); if (boss) break; } if (!boss) return null; }
    // 고리: 이웃한 방을 짧은 굽은 복도로 잇는다 (A*). 다른 방 · 복도에 닿지 않게
    const passable = (x, y, a, b) => inB(x, y) && at(x, y) === 0 && D8.every(([dx, dy]) => { const v = at(x + dx, y + dy); if (v === 0) return true; if (v === 1) { const o = ownAt(x + dx, y + dy); return o === a || o === b; } return false; });
    function route(A, B) {
      const starts = [], goals = new Map();
      const edgeCells = (R, other) => { const out = []; for (const [x, y] of R.cells) for (const [dx, dy] of D4) { const ox = x + dx, oy = y + dy; if (ownAt(ox, oy) === R.id) continue; if (passable(ox, oy, R.id, other)) out.push({ door: [x, y], o: [ox, oy] }); } return out; };
      for (const s of edgeCells(A, B.id)) starts.push(s);
      for (const g of edgeCells(B, A.id)) goals.set(g.o[0] + ',' + g.o[1], g);
      if (!starts.length || !goals.size) return null;
      const noise = (x, y) => ((x * 73856093 ^ y * 19349663 ^ seed) >>> 0) % 100 / 100;
      const dist = new Map(), prev = new Map(), q = [];
      for (const s of starts) { const k = s.o[0] + ',' + s.o[1]; dist.set(k, 1); q.push([1, s.o[0], s.o[1], -1]); prev.set(k, { start: s }); }
      while (q.length) {
        q.sort((a, b) => a[0] - b[0]); const [d, x, y, dir] = q.shift(), k = x + ',' + y;
        if (d > dist.get(k) + 1e-9) continue;
        if (goals.has(k)) {
          const cells = []; let c = k; while (true) { const [cx, cy] = c.split(',').map(Number); cells.unshift([cx, cy]); const pv = prev.get(c); if (pv.start) return { cells, doorA: pv.start.door, doorB: goals.get(k).door }; c = pv.from; }
        }
        if (d > (RUN.COMPACT ? RUN.LOOPD || 6 : 22)) continue; // 붙인 층: 고리도 짧은 문틀만
        D4.forEach(([dx, dy], i) => {
          const nx = x + dx, ny = y + dy, nk = nx + ',' + ny; if (!passable(nx, ny, A.id, B.id)) return;
          const nd = d + 1 + (dir >= 0 && dir !== i ? 0.6 : 0) + noise(nx, ny) * 0.8;
          if (!dist.has(nk) || nd < dist.get(nk)) { dist.set(nk, nd); prev.set(nk, { from: k }); q.push([nd, nx, ny, i]); }
        });
      }
      return null;
    }
    const linked = (a, b) => links.some(l => (l.a === a && l.b === b) || (l.a === b && l.b === a));
    const centre = r => [r.x + r.w / 2, r.y + r.h / 2];
    const near = (a, b) => { const [ax, ay] = centre(a), [bx, by] = centre(b); return Math.abs(ax - bx) + Math.abs(ay - by); };
    const pairs = [];
    for (let i = 0; i < rooms.length; i++) for (let j = i + 1; j < rooms.length; j++) if (!linked(i, j) && near(rooms[i], rooms[j]) < 20) pairs.push([i, j]);
    let loops = 0;
    for (const [i, j] of RUN.shuffle(rng, pairs)) {
      if (loops >= 8) break;
      const r = route(rooms[i], rooms[j]); if (!r) continue;
      mark(r.cells, 2, -1); links.push({ a: i, b: j, ...r, tree: false }); loops++;
    }
    // 설계서 층: 우두머리 방은 큰길의 마지막 앞 방(pid)에 붙인다 — 위가 막혔으면 옆으로. 곁의 방들과 고리도 (곁방 → 우두머리 숨은 통로 자리).
    //   전에는 가장 위쪽 방 위에 미리 놓아, 큰길(입구에서 정해진 걸음)이 그 방에 닿는 씨앗을 찾느라 수백 번 다시 키웠다 (2026-11-27)
    if (late) return { rooms, links, boss: null, addBoss(pid) { const b = bossAt(rooms[pid], ['up', 'left', 'right']); if (!b) return null;
      for (const o of rooms.filter(r => r.id !== b.id && r.id !== pid && near(r, b) < 20).sort((x, y) => near(x, b) - near(y, b)).slice(0, 4)) { const r = route(o, b); if (r) { mark(r.cells, 2, -1); links.push({ a: o.id, b: b.id, ...r, tree: false }); } }
      return b; } };
    // 깊이 (입구에서 몇 방) 와 막다른 방 고치기: 더 깊은 이웃이 없는 방은 더 깊은 방으로 잇고, 안 되면 지운다
    const alive = new Set(rooms.map(r => r.id));
    const depthOf = () => { const d = new Map([[0, 0]]), q = [0]; while (q.length) { const v = q.shift(); for (const l of links) { if (!alive.has(l.a) || !alive.has(l.b)) continue; const w = l.a === v ? l.b : l.b === v ? l.a : -1; if (w >= 0 && !d.has(w)) { d.set(w, d.get(v) + 1); q.push(w); } } } return d; };
    // 순서(rank): 깊이 → 지도에서 더 위 → 번호. 길은 순서가 오르는 쪽으로만 간다 (되돌아가기 없음, 고리 없음).
    // 같은 깊이끼리의 고리도 위쪽으로 가는 길로 살린다 — 갈림길이 는다 (DESIGN.md 179)
    const rankOf = (d, id) => id === boss.id ? 1e9 : d.get(id) * 1e5 + (CH - (rooms[id].y + rooms[id].h / 2)) * 100 + id;
    for (let pass = 0; pass < (raw ? 0 : 6); pass++) {
      const d = depthOf(); let changed = false;
      for (const id of [...alive]) if (!d.has(id)) { alive.delete(id); changed = true; }
      for (const id of [...alive]) {
        if (id === boss.id) continue;
        const deeper = links.some(l => alive.has(l.a) && alive.has(l.b) && ((l.a === id && rankOf(d, l.b) > rankOf(d, id)) || (l.b === id && rankOf(d, l.a) > rankOf(d, id))));
        if (deeper) continue;
        const cands = [...alive].filter(o => rankOf(d, o) > rankOf(d, id) && !linked(id, o)).sort((a, b) => near(rooms[id], rooms[a]) - near(rooms[id], rooms[b]));
        let ok = false;
        for (const o of cands.slice(0, 4)) { const r = route(rooms[id], rooms[o]); if (r) { mark(r.cells, 2, -1); links.push({ a: id, b: o, ...r, tree: false }); ok = true; break; } }
        if (!ok) { alive.delete(id); } changed = true;
      }
      if (!changed) break;
    }
    const d = depthOf();
    if (!d.has(boss.id)) return null;
    for (const id of [...alive]) if (!d.has(id)) alive.delete(id);
    const rank = new Map([...alive].map(id => [id, rankOf(d, id)]));
    return { rooms: rooms.filter(r => alive.has(r.id)), links: links.filter(l => alive.has(l.a) && alive.has(l.b)), depth: d, rank, boss: boss.id };
  }

  const outs = (m, id) => m.edges.filter(e => e.a === id);
  const ins = (m, id) => m.edges.filter(e => e.b === id);
  function path(m, avoid = () => false) {
    const goal = m.nodes.find(n => n.type === 'boss').id, seen = new Set([0]), q = [0];
    while (q.length) { const id = q.shift(); if (id === goal) return true; for (const e of outs(m, id)) if (keyless(e) && !seen.has(e.b) && !avoid(m.nodes[e.b])) { seen.add(e.b); q.push(e.b); } }
    return false;
  }
  // 적 무리: 구역 규칙표(RUN.ZONES)의 예산과 틀로 채운다. fi = 구역 안에서 몇째 층(0 · 1), deep = 입구에서 먼 정도(0~1)
  const mkGroup = (Z, tier, fam, units) => { const count = units.reduce((a, u) => a + u[1], 0); return { fam, name: units[0][0], count, d: units.reduce((a, u) => a + Z.cost[u[0]] * u[1], 0), label: units.map(([n, c]) => `${n}${count > 1 ? ` ${c}` : ''}`).join(' · '), tier, units }; };
  const budgetOf = (type, tier, Z, fi, deep) => { const [lo, mid, hi, el] = Z.budget[fi]; return type === 'elite' ? el : (tier === 'heavy' ? hi : tier === 'light' ? lo : mid) * (0.8 + 0.4 * deep); };
  // 손으로 짠 방의 적 구성 중 예산에 맞는 것: 예산(조금 넘는 것까지) 안에서 가장 센 것, 없으면 가장 약한 것
  function encOf(t, type, tier, Z, fi, deep) {
    const bud = budgetOf(type, tier, Z, fi, deep), cost = e => e.u.reduce((a, [k, c]) => a + Z.cost[k] * c, 0), list = t.enc.slice().sort((a, b) => cost(a) - cost(b));
    // 무리 전체는 기준 인원 + 1까지 (group의 상한과 같다 — 둘이 도는 층은 셋). 그 안에 드는 구성이 있으면 그중에서 고른다
    const ALL = Z.seats[fi] + 1, cnt = x => x.u.reduce((a, [, c]) => a + c, 0), fit = list.filter(x => cnt(x) <= ALL), pool = fit.length ? fit : list;
    const e = pool.filter(x => cost(x) <= bud * 1.15).pop() || pool[0];
    return mkGroup(Z, tier, e.n, e.u.map(u => u.slice()));
  }
  function group(rng, type, tier, Z, fi, small, deep) {
    const mk = (fam, units) => mkGroup(Z, tier, fam, units);
    if (type === 'boss') { const p = fi === Z.floors[1] - Z.floors[0] ? Z.boss : Z.gate; return mk(p.n, p.u.map(u => u.slice())); } // 구역의 마지막 층은 구역 우두머리 · 그 앞 층들은 문지기 (두 층짜리 옛 구역은 예전과 같다)
    const bud = budgetOf(type, tier, Z, fi, deep);
    const pool = type === 'elite' ? Z.elites : Z.packs, two = [RUN.pick(rng, pool), RUN.pick(rng, pool)].sort((p, q) => Z.cost[q.u[0]] - Z.cost[p.u[0]]);
    const { n, u: [a, b] } = small ? two[0] : two[1];
    // 한 종류는 기준 인원 + 1까지 (2026-11-19 — 같은 놈 여섯이 한 방에 서면 행동 수가 파티를 압도하고 화면도 되풀이된다).
    // 그래서 남는 예산은 같은 무리(이름이 같은 다른 틀)의 다른 종류로 — 고블린 무리면 홉고블린, 깨어난 병기면 움직이는 갑옷
    const CAP = Z.seats[fi], cnt = v => Math.max(1, Math.min(CAP, Math.round(v))); // 한 종류는 기준 인원까지
    const units = b ? (() => { const na = cnt(bud / 2 / Z.cost[a]); return [[a, na], [b, cnt((bud - na * Z.cost[a]) / Z.cost[b])]]; })() : [[a, cnt(bud / Z.cost[a])]];
    let left = bud - units.reduce((s, [k, c]) => s + Z.cost[k] * c, 0);
    // 채울 종류는 그 방과 같은 급의 틀에서만 (보통 방에 정예 몬스터가 섞이지 않게), 무리 전체는 기준 인원 + 1까지 (2026-11-19 늦게, 두 배 → +1: 1레벨은 서로 한두 방에 쓰러진다 — 레벨을 올리는 대신 맞는 횟수를 줄인다. 둘이 도는 층은 셋, 셋이 도는 층은 넷)
    const ALL = Z.seats[fi] + 1; let n0 = units.reduce((s, u) => s + u[1], 0);
    for (let i = units.length - 1; n0 > ALL && i >= 0; i--) { const cut = Math.min(units[i][1] - 1, n0 - ALL); units[i][1] -= cut; n0 -= cut; left += cut * Z.cost[units[i][0]]; }
    const kin = [...new Set(pool.filter(p => p.n === n).flatMap(p => p.u))].filter(k => !units.some(([q]) => q === k)).sort((p, q) => Z.cost[q] - Z.cost[p]);
    for (const k of kin) { const c = Math.min(CAP, ALL - n0, Math.floor(left / Z.cost[k])); if (c < 1) continue; units.push([k, c]); left -= c * Z.cost[k]; n0 += c; }
    return mk(n, units);
  }
  // ── 설계서 (원정 모드만 — RUN.SPECS[층]이 있을 때): 키운 던전(막다른 방 그대로)에서 설계서를 만족하는 방 · 길을 고르고 나머지는 버린다 ──
  // spec = { main: [칸…], sides: [곁방…] }. 칸 = { t: 방 종류, c: [템플릿 id 후보 (앞이 먼저)] } 또는 { fork: [칸, 칸] } (앞 칸과 다음 칸 사이 두 갈래, 칸의 gate = 들어가는 길)
  // 곁방 = { t, c, gate: open | locked | trap | hidden, at: front | mid | back, hid: 'boss' (곁방 → 우두머리 숨은 통로), ev: 사건 id, see: 첫 판에 문 너머로 보임 }
  // 방 크기는 템플릿(돌려서라도)에 맞아야 한다. 같은 층에서 템플릿은 한 번씩. 못 맞추면 null (그 씨앗은 버린다)
  const ANY = '*';
  function fitSpec(g, SP, rng, TP) {
    const R = new Map(g.rooms.map(r => [r.id, r])), adj = new Map(g.rooms.map(r => [r.id, new Set()]));
    for (const l of g.links) if (adj.has(l.a) && adj.has(l.b)) { adj.get(l.a).add(l.b); adj.get(l.b).add(l.a); }
    const T = id => TP.find(t => t.id === id), fitT = (r, id) => { const t = T(id); if (!t) return false; const [w, h] = tdim(t); return (w === r.w && h === r.h) || (w === r.h && h === r.w); };
    const usedT = new Set(), used = new Map(); // used: 방 id → { slot, tid }
    const pickT = (r, slot) => (slot.c && TP.length ? slot.c.find(id => !usedT.has(id) && fitT(r, id)) : ANY); // c가 없는 칸: 손으로 짠 방 없이 생성기의 방 그대로 (3~10층)
    const take = (rid, slot) => { const tid = pickT(R.get(rid), slot); if (!tid) return false; used.set(rid, { slot, tid }); if (tid !== ANY) usedT.add(tid); return true; };
    const drop = rid => { usedT.delete(used.get(rid).tid); used.delete(rid); };
    const pref = (r, slot) => (slot.c && TP.length ? slot.c.indexOf(pickT(R.get(r), slot)) : 0); // 앞 후보(설계서가 고른 방)가 맞는 방부터
    const cand = (from, slot, extra = () => true) => RUN.shuffle(rng, [...adj.get(from)].filter(r => !used.has(r) && extra(r) && pickT(R.get(r), slot))).sort((p, q) => pref(p, slot) - pref(q, slot));
    const main = SP.main, steps = []; // steps[k] = [방 id…] (갈래 칸은 둘)
    let budget = RUN.SMALL || SP.main.some(q => !q.c && !q.fork) ? 20000 : 4000; // 손으로 짠 방이 없는 칸은 후보가 많다
    const dfs = (k, prev) => {
      if (--budget < 0) return false;
      if (k === main.length) return true;
      const sl = main[k], last = k === main.length - 1;
      if (k === 0) { if (!take(0, sl)) return false; steps[0] = [0]; if (dfs(1, [0])) return true; drop(0); return false; }
      if (last && g.addBoss) { const b = g.addBoss(prev[0]); if (!b) return false; g.boss = b.id; R.set(b.id, b); adj.set(b.id, new Set()); for (const l of g.links) if (l.a === b.id || l.b === b.id) { adj.get(l.a).add(l.b); adj.get(l.b).add(l.a); } take(b.id, sl); steps[k] = [b.id]; return true; } // 우두머리 방을 여기서 붙인다 (grow의 late)
      if (sl.fork) {
        const nx = main[k + 1]; if (!nx || nx.fork) return false;
        for (const x of cand(prev[0], sl.fork[0])) { take(x, sl.fork[0]);
          for (const y of cand(prev[0], sl.fork[1], r => adj.get(r).size > 1)) { take(y, sl.fork[1]);
            const isB = k + 1 === main.length - 1;
            for (const n of [...adj.get(x)].filter(r => adj.get(y).has(r) && !used.has(r) && (isB ? r === g.boss : r !== g.boss) && pickT(R.get(r), nx))) { take(n, nx); steps[k] = [x, y]; steps[k + 1] = [n]; if (dfs(k + 2, [n])) return true; drop(n); }
            drop(y); }
          drop(x); }
        return false;
      }
      for (const n of cand(prev[0], sl, r => (last ? r === g.boss : r !== g.boss))) { take(n, sl); steps[k] = [n]; if (dfs(k + 1, [n])) return true; drop(n); }
      return false;
    };
    if (!dfs(0, null)) return null;
    // 곁방: 큰길의 앞 · 가운데 · 뒤 칸에서 갈라지는 막다른 방
    const L = main.length, AT = { front: [0, 1], mid: [1, Math.max(1, L - 3)], back: [Math.max(1, L - 3), L - 2] }, sides = [];
    const sideDfs = i => {
      if (i === SP.sides.length) return true;
      const sd = SP.sides[i], [k0, k1] = AT[sd.at || 'mid'], anchors = RUN.shuffle(rng, steps.slice(k0, k1 + 1).flat());
      for (const a of anchors) for (const r of cand(a, sd, r => r !== g.boss && (!sd.hid || adj.get(r).has(g.boss)))) { take(r, sd); sides[i] = { r, a, sd }; if (sideDfs(i + 1)) return true; drop(r); }
      return false;
    };
    if (!sideDfs(0)) return null;
    // 번호: 큰길(갈래 포함) 차례 → 곁방 → 우두머리 맨 끝 (길은 작은 번호 → 큰 번호)
    const order = [], row = new Map();
    steps.forEach((ids, k) => ids.forEach(id => { if (id !== g.boss) { order.push(id); row.set(id, k); } }));
    sides.forEach(({ r, a }) => { order.push(r); row.set(r, row.get(a) + 1); });
    order.push(g.boss); row.set(g.boss, L - 1);
    const pos = new Map(order.map((id, i) => [id, i])), keep = [], kind = new Map(), key = (a, b) => (a < b ? a + ',' + b : b + ',' + a);
    const want = (a, b, k = 'open', sl = null) => kind.set(key(a, b), { kind: k || 'open', lock: sl?.lock, dc: sl?.dc }); // 관문 종류 · 자물쇠 종류 · 난이도 (열쇠 부품)
    for (let k = 0; k + 1 < L; k++) for (const a of steps[k]) for (const b of steps[k + 1]) if (adj.get(a).has(b)) {
      if (main[k].fork && main[k + 1].fork) continue;
      const into = main[k + 1].fork ? main[k + 1].fork[steps[k + 1].indexOf(b)] : main[k + 1]; want(a, b, into?.gate || 'open', into); }
    // 갈래 앞 → 다음 칸 바로 가는 길은 없앤다 (두 갈래를 지나야 한다)
    sides.forEach(({ r, a, sd }) => { want(a, r, sd.gate || 'open', sd); if (sd.hid) want(r, g.boss, 'hidden'); });
    for (const l of g.links) { const k = key(l.a, l.b); if (kind.has(k) && !keep.some(q => key(q.a, q.b) === k)) keep.push(l); }
    return { order: order.map(id => R.get(id)), row, keep, kind: l => kind.get(key(l.a, l.b)).kind, props: l => kind.get(key(l.a, l.b)), role: id => used.get(id), side: new Set(sides.map(x => x.r)), steps };
  }
  function build(seed, F, floor) {
    const Z = RUN.zone(floor), fi = floor - Z.floors[0];
    const SP = RUN.SPECS && RUN.SPECS[floor], TP = RUN.SMALL ? [] : tplsOf(Z.id), g = grow(seed, F, SP ? { ...Z.shape, grow: SP.grow || Z.shape.grow, deep: RUN.COMPACT ? SP.main.length - 2 : 0 } : Z.shape, TP, !!SP, !!SP && !!RUN.COMPACT); if (!g) return null;
    const fit = SP ? fitSpec(g, SP, RUN.rng(seed * 29 + 3), TP) : null; if (SP && !fit) return null;
    if (fit) { g.rooms = fit.order; g.links = fit.keep; g.depth = fit.row; g.rank = new Map(fit.order.map((r, i) => [r.id, i])); }
    // 그 종류의 손으로 짠 방이 이 방 크기에 (돌려서라도) 들어가나 — 하나뿐인 특별한 방(야영 · 상점 · 보물 · 정예)은 맞는 크기의 방에 먼저
    const fitsType = (r, type) => TP.some(t => { const [w, h] = tdim(t); return t.tags.includes(type) && ((w === r.w && h === r.h) || (w === r.h && h === r.w)); }), prefer = (list, type) => { const f = list.filter(n => fitsType(room[n.id], type)); return f.length ? f : list; };
    const rng = RUN.rng(seed * 13 + 5);
    // 방 번호를 다시 매긴다 (입구 0, 깊이 순)
    const order = g.rooms.slice().sort((a, b) => g.rank.get(a.id) - g.rank.get(b.id)), idx = new Map(order.map((r, i) => [r.id, i]));
    const maxD = Math.max(...order.map(r => g.depth.get(r.id)));
    const nodes = order.map((r, i) => ({ id: i, row: g.depth.get(r.id), x: (r.x + r.w / 2) / F.cw, type: 'fight', size: r.cells.length >= 30 ? 'large' : 'small', info: 0, notes: [] }));
    const edges = [], cor = {}, room = {};
    for (const r of order) room[idx.get(r.id)] = { x: r.x, y: r.y, w: r.w, h: r.h, cells: r.cells, decor: r.decor.map(o => ({ ...o, x: r.x + o.x, y: r.y + o.y })), kind: r.kind };
    for (const l of g.links) {
      let a = idx.get(l.a), b = idx.get(l.b), cells = l.cells, dA = l.doorA, dB = l.doorB;
      if (a > b) { [a, b] = [b, a]; cells = cells.slice().reverse(); [dA, dB] = [dB, dA]; }
      const e = { id: edges.length, a, b, kind: fit ? fit.kind(l) : 'open', loop: !l.tree }; edges.push(e); if (fit) { const pr = fit.props(l); if (pr.lock) e.lock = pr.lock; if (pr.dc) e.dc = pr.dc; }
      cor[e.id] = { cells, doorA: dA, doorB: dB, doorAout: cells[0], doorBout: cells[cells.length - 1] };
    }
    const m = { nodes, edges, rows: [], seed, floor, zone: Z.id };
    for (let r = 0; r <= maxD; r++) m.rows.push(nodes.filter(n => n.row === r).map(n => n.id));
    const N = nodes, bossN = N[idx.get(g.boss)];
    if (fit) { // 설계서: 방 종류 · 템플릿 · 이름 · 사건을 그대로
      for (const r of order) { const n = N[idx.get(r.id)], u = fit.role(r.id), t = TP.find(q => q.id === u.tid), [w] = t ? tdim(t) : [r.w]; n.type = u.slot.t; n.tier = u.slot.tier || null; n.name = t ? t.n : u.slot.name || null; if (u.slot.ev) { n.ev = u.slot.ev; n.evFixed = true; } if (fit.side.has(r.id)) n.side = true; if (u.slot.see) n.info = 2; if (u.slot.chest) n.chest = true; if (u.slot.enc) n.encOver = u.slot.enc; if (u.slot.sleep) n.sleepy = true; if (u.slot.part) n.part = u.slot.part; if (u.slot.dark) n.dark = true; /* 설계서가 덮어쓰는 적 구성 (방의 몬스터 자리 · 지형은 그대로) */ /* 상자가 있는 방 (보물 방과 같은 드롭) */ room[n.id].tpl = t; room[n.id].tplRot = w === r.w ? 0 : 1; room[n.id].tplFlip = rng() < 0.5; }
      m.spec = true;
    } else {
    if (bossN.row < 5 || N.length < 12) return null;
    // 우두머리 말고 나갈 길이 없는 방이 있으면 안 된다 (되돌아가기 없음)
    if (N.some(n => n !== bossN && !outs(m, n.id).length)) return null;
    N[0].type = 'start'; bossN.type = 'boss';
    // 우두머리 앞 야영은 한 곳만 (2026-11-19 — 우두머리 방으로 들어가는 방을 모두 야영으로 하니 층마다 2.5곳, 구역 끝 야영지까지 쉼이 넘쳤다)
    { const pre = ins(m, bossN.id).map(e => N[e.a]).filter(n => n.id !== 0); if (pre.length) RUN.pick(rng, prefer(pre, 'camp')).type = 'camp'; }
    const mid = N.filter(n => n.type === 'fight' && n.id !== 0);
    for (const n of mid) { const u = rng(); const T = Z.rooms; n.type = n.row <= 1 ? (u < T.near ? 'event' : 'fight') : u < T.event ? 'event' : u < T.event + T.elite && n.row >= 3 ? 'elite' : 'fight'; }
    const shopC = mid.filter(n => n.row >= 2 && n.row <= Math.max(3, maxD - 2)); if (!shopC.length) return null; RUN.pick(rng, prefer(shopC, 'shop')).type = 'shop';
    if (!mid.some(n => n.type === 'elite')) { const c = mid.filter(n => n.row >= 3 && n.type !== 'shop'); if (!c.length) return null; RUN.pick(rng, c).type = 'elite'; }
    let treasure = null;
    for (const n of prefer(RUN.shuffle(rng, mid.filter(n => n.row >= 2 && n.type !== 'shop' && n.type !== 'elite')), 'treasure')) if (ins(m, n.id).every(e => outs(m, e.a).some(o => o.b !== n.id))) { treasure = n; break; }
    if (!treasure) return null;
    treasure.type = 'treasure'; ins(m, treasure.id).forEach(e => { e.kind = 'locked'; });
    // 갈림길 대비 (DESIGN.md 178): 갈림길마다 한쪽은 위험하지만 얻는 게 많고(정예 · 대규모 무리), 다른 쪽은 수월하게(사건 · 소규모 무리).
    // 그래야 정찰 · 점술로 얻은 정보가 고르는 길을 바꾼다
    const free = n => n.type === 'fight' || n.type === 'event' || n.type === 'elite';
    for (const n of RUN.shuffle(rng, N)) {
      const ts = [...new Set(outs(m, n.id).map(e => e.b))].map(id => N[id]).filter(free);
      if (ts.length < 2) continue;
      const [a, b] = RUN.shuffle(rng, ts);
      if (ts.some(t => t.type === 'elite')) continue;              // 이미 위험한 쪽이 있다
      const elites = N.filter(x => x.type === 'elite').length;
      if (a.row >= 3 && elites < 2 && rng() < 0.4) { a.type = 'elite'; a.tier = null; } else { a.type = 'fight'; a.tier = 'heavy'; }
      if (rng() < 0.5) { b.type = 'event'; b.tier = null; } else { b.type = 'fight'; b.tier = 'light'; }
    }
    // 정예 자리 맞추기: 정예 방 크기에 정예 템플릿이 없으면, 정예 템플릿이 들어가는 전투 방(3줄 이상)과 종류를 맞바꾼다 (정예 수 · 줄 조건 그대로)
    if (TP.length) for (const e of N.filter(n => n.type === 'elite' && !fitsType(room[n.id], 'elite'))) { const o = RUN.shuffle(rng, N.filter(n => n.type === 'fight' && n.row >= 3 && fitsType(room[n.id], 'elite')))[0]; if (o) { [e.type, o.type] = [o.type, e.type]; [e.tier, o.tier] = [o.tier, e.tier]; } }
    // 숨은 통로: 고리 복도 하나 (나가는 길이 따로 있고, 들어가는 방은 다른 길로도 갈 수 있을 때)
    const hid = RUN.shuffle(rng, edges.filter(e => e.kind === 'open' && N[e.b] !== treasure && outs(m, e.a).filter(o => o !== e && keyless(o)).length && ins(m, e.b).length > 1)).sort((a, b) => b.loop - a.loop)[0];
    if (!hid) return null; hid.kind = 'hidden';
    const opens = () => RUN.shuffle(rng, edges.filter(e => e.kind === 'open' && N[e.b].type !== 'boss' && e.a !== 0));
    opens().slice(0, Z.paths.trap).forEach(e => { e.kind = 'trap'; });
    opens().slice(0, Z.paths.dark).forEach(e => { e.kind = 'dark'; });
    { let k = Z.paths.locked; for (const e of opens()) { if (k <= 0) break; if (outs(m, e.a).filter(o => o !== e && keyless(o)).length) { e.kind = 'locked'; k--; } } }
    // 손으로 짠 방 고르기: 방 종류가 맞고 크기가 맞는(돌려서라도) 템플릿, 같은 층에서는 덜 쓴 것부터.
    // 종류가 맞는 것이 없으면 같은 크기의 다른 방을 무대로 (적은 생성기가 고른다). 그래도 없으면 예전 방 그대로
    if (TP.length) {
      const used = new Map();
      for (const n of N) {
        const r = room[n.id], fits = TP.map(t => { const [w, h] = tdim(t); return [t, w === r.w && h === r.h ? 0 : w === r.h && h === r.w ? 1 : -1]; }).filter(([, f]) => f >= 0);
        const HOST = ['fight', 'elite'], side = t => HOST.some(x => t.tags.includes(x)) === HOST.includes(n.type), any = fits.filter(([t]) => !t.tags.includes('start') && !t.tags.includes('boss'));
        const own = fits.filter(([t]) => t.tags.includes(n.type)), near = any.filter(([t]) => side(t)), pool = own.length ? own : n.type === 'start' || n.type === 'boss' ? [] : near.length ? near : any; // 빌릴 때는 같은 계열(싸우는 방 ↔ 평화로운 방)부터
        if (!pool.length) continue;
        const least = Math.min(...pool.map(([t]) => used.get(t.id) || 0)), [t, rot] = RUN.pick(rng, pool.filter(([q]) => (used.get(q.id) || 0) === least));
        used.set(t.id, least + 1); r.tpl = t; r.tplRot = rot; r.tplFlip = rng() < 0.5;
      }
    }
    } // 설계서가 아닌 층
    const evs = RUN.shuffle(rng, RUN.EVENTS.filter(e => !e.rare).map(e => e.id).filter(id => !Z.events || Z.events.includes(id))); let ei = 0;
    for (const n of N) {
      if (n.type === 'fight' || n.type === 'elite' || n.type === 'boss') { n.g = group(rng, n.type, n.tier, Z, fi, n.size === 'small', n.row / maxD); { const T0 = room[n.id].tpl; if (T0 && T0.enc.length && T0.tags.includes(n.type) && n.type !== 'boss') n.g = encOf(T0, n.type, n.tier, Z, fi, n.row / maxD); } if (n.encOver) { const e = RUN.pick(rng, n.encOver); n.g = mkGroup(Z, n.tier, e.n, e.u.map(u => u.slice())); } n.hostile = true; n.dc = n.type === 'fight' ? 12 : n.type === 'elite' ? 14 : 15; } // 손으로 짠 방은 그 방의 적 구성 중 예산에 맞는 것 (우두머리 · 문지기는 규칙표 그대로)
      else { n.hostile = false; if (n.type === 'event' && !n.evFixed) n.ev = evs[ei++ % evs.length]; }
    }
    // 방 장식: 종류에 맞춰
    const rm = id => room[id];
    if (!rm(0).tpl) rm(0).decor.push({ k: 'stairs', x: rm(0).x + 1, y: rm(0).y + 1 }); // 손으로 짠 방의 계단은 앉힐 때 (빈 칸에)
    if (!rm(bossN.id).tpl) rm(bossN.id).decor.push({ k: 'stairs', x: rm(bossN.id).x + Math.floor(rm(bossN.id).w / 2) - 1, y: rm(bossN.id).y + 1 });
    for (const n of N) { const r = rm(n.id), c = r.cells[Math.floor(r.cells.length / 2)]; if (r.tpl) continue; if (n.type === 'event' && rng() < 0.7) r.decor.push({ k: 'altar', x: c[0], y: c[1] }); if (n.type === 'treasure') r.decor.push({ k: 'chest', x: c[0], y: c[1] }); }
    // 소품 (잔해 · 상자 · 통 · 뼈 · 석상 · 깔개 …): 문 곁은 비우고 안쪽 칸에 흩어 놓는다
    const FURN = Z.furn;
    const doorCells = new Set(); for (const e of edges) { const c = cor[e.id]; doorCells.add(c.doorA.join(',')); doorCells.add(c.doorB.join(',')); }
    for (const n of N) {
      const r = room[n.id], set = new Set(r.cells.map(c => c.join(','))), taken = new Set(r.decor.map(o => o.x + ',' + o.y));
      if (r.tpl) continue; // 손으로 짠 방은 소품도 템플릿 그대로
      const nearDoor = (x, y) => D8.some(([dx, dy]) => doorCells.has((x + dx) + ',' + (y + dy))) || doorCells.has(x + ',' + y);
      const inner = RUN.shuffle(rng, r.cells.filter(([x, y]) => D4.every(([dx, dy]) => set.has((x + dx) + ',' + (y + dy))) && !taken.has(x + ',' + y) && !nearDoor(x, y) && !D8.some(([dx, dy]) => taken.has((x + dx) + ',' + (y + dy)))));
      const k = inner.length >= 15 ? 3 + Math.floor(rng() * 3) : inner.length >= 4 ? 1 + Math.floor(rng() * 2) : 0, pool = FURN[n.type] || FURN.fight;
      for (let i = 0; i < k && i < inner.length; i++) { const [x, y] = inner[i]; if (D8.some(([dx, dy]) => taken.has((x + dx) + ',' + (y + dy)))) continue; r.decor.push({ k: RUN.pick(rng, pool), x, y, r: rng() }); taken.add(x + ',' + y); }
    }
    for (const e of edges) { const c = cor[e.id]; c.decor = []; if (c.cells.length >= 5 && rng() < 0.3) { const cl = c.cells[1 + Math.floor(rng() * (c.cells.length - 2))]; c.decor.push({ k: 'debris', x: cl[0], y: cl[1] }); } }
    if (!fit && N.some(n => n.type !== 'boss' && !outs(m, n.id).some(keyless))) return null;
    if (!path(m) || !path(m, n => n.type === 'elite')) return null;
    for (const e of edges) { e.seen = {}; e.opened = false; e.walked = false; }
    // 캔버스 → 실제 지도: 돌리기(앞 = 오른쪽) · 뒤집기
    const W = F.rot ? F.ch : F.cw, H = F.rot ? F.cw : F.ch;
    const tf = ([x, y]) => { let X = F.rot ? F.ch - 1 - y : x, Y = F.rot ? x : y; if (F.flip) X = W - 1 - X; return [X, Y]; };
    const tp = o => { const [X, Y] = tf([o.x, o.y]); return { ...o, x: X, y: Y }; };
    for (const id in room) { const r = room[id], cells = r.cells.map(tf), xs = cells.map(c => c[0]), ys = cells.map(c => c[1]);
      const x = Math.min(...xs), y = Math.min(...ys); room[id] = { ...r, cells, x, y, w: Math.max(...xs) - x + 1, h: Math.max(...ys) - y + 1, decor: r.decor.map(tp) }; }
    for (const id in cor) { const c = cor[id]; cor[id] = { cells: c.cells.map(tf), doorA: tf(c.doorA), doorB: tf(c.doorB), doorAout: tf(c.doorAout), doorBout: tf(c.doorBout), decor: (c.decor || []).map(tp) }; }
    // 양피지를 던전이 있는 곳에 맞춰 자른다 (가장자리 4칸, 위는 제목 띠 자리로 2칸 더)
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const grow1 = ([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
    for (const id in room) room[id].cells.forEach(grow1); for (const id in cor) cor[id].cells.forEach(grow1);
    const ox = x0 - 4, oy = y0 - 6, sh = ([x, y]) => [x - ox, y - oy], shp = o => ({ ...o, x: o.x - ox, y: o.y - oy });
    for (const id in room) { const r = room[id]; room[id] = { ...r, cells: r.cells.map(sh), x: r.x - ox, y: r.y - oy, decor: r.decor.map(shp) }; }
    for (const id in cor) { const c = cor[id]; cor[id] = { cells: c.cells.map(sh), doorA: sh(c.doorA), doorB: sh(c.doorB), doorAout: sh(c.doorAout), doorBout: sh(c.doorBout), decor: c.decor.map(shp) }; }
    // 손으로 짠 방 앉히기: 마지막 자리 · 방향(템플릿 돌리기 · 뒤집기 → 층 돌리기 · 뒤집기)으로. 계단(입구 · 우두머리)은 바닥만인 첫 칸에
    for (const id in room) {
      const r = room[id]; if (!r.tpl) continue;
      let rows = r.tpl.map.slice(); if (r.tplRot) rows = rotCW(rows); if (r.tplFlip) rows = flipX(rows); if (F.rot) rows = rotCW(rows); if (F.flip) rows = flipX(rows);
      const t = fromTemplate({ ...r.tpl, map: rows }, r.x, r.y), KK = RUN.ROOM_K; if (t.w !== r.w || t.h !== r.h) { delete r.tpl; continue; }
      if (N[+id].type === 'start' || N[+id].type === 'boss') { const c = t.cells.find(([cx, cy]) => { for (let j = 0; j < KK; j++) for (let i = 0; i < KK; i++) if (rows[(cy - r.y) * KK + j][(cx - r.x) * KK + i] !== '.') return false; return true; }); if (c) t.decor.push({ k: 'stairs', x: c[0], y: c[1] }); }
      room[id] = { ...r, ...t };
    }
    // 문 잇기 (원정 모드 — RUN.FIXDOORS): 손으로 짠 방이 문 칸을 비워 두면(그 칸이 통째로 빈 칸) 복도가 벽에 막혀 끝났다 — 걷기는 벽을 뚫고 지나가고, 지도 경로 선은 벽을 가로질렀다.
    //   문 칸에서 가장 가까운 방 칸까지 곧게(가로 먼저) 복도를 늘이고, 문을 그 방 칸으로 옮긴다
    if (RUN.FIXDOORS) for (const id in cor) { const c = cor[id], e = edges[+id];
      for (const end of ['A', 'B']) { const r = room[end === 'A' ? e.a : e.b], d = c['door' + end];
        // 칸 하나(3×3 타일)가 모두 바닥인가 — 손으로 짠 방은 칸 일부만 바닥이라 복도가 벽에 닿고 끝나기도 했다 (2026-11-23 교착 조사: 설계서 층은 길이 하나뿐이라 방이 통째로 고립됐다)
        const full = p => { if (!r.tmap) return r.cells.some(q => q[0] === p[0] && q[1] === p[1]); const KK = RUN.ROOM_K, ox = (p[0] - r.x) * KK, oy = (p[1] - r.y) * KK; for (let j = 0; j < KK; j++) for (let i = 0; i < KK; i++) { const ch = (r.tmap[oy + j] || '')[ox + i]; if (!ch || ch === ' ' || ch === '~' || RUN.TILE.solid.includes(ch)) return false; } return true; };
        if (full(d)) continue; const ok = r.cells.filter(full); if (!ok.length) continue;
        const t = ok.reduce((b, q) => (Math.abs(q[0] - d[0]) + Math.abs(q[1] - d[1]) < Math.abs(b[0] - d[0]) + Math.abs(b[1] - d[1]) ? q : b), ok[0]), br = [d.slice()]; let [x, y] = d;
        while (x !== t[0] || y !== t[1]) { if (x !== t[0]) x += Math.sign(t[0] - x); else y += Math.sign(t[1] - y); if (x === t[0] && y === t[1]) break; br.push([x, y]); }
        if (end === 'A') c.cells = [...br.reverse(), ...c.cells]; else c.cells = [...c.cells, ...br]; c['door' + end] = t.slice(); } }
    m._lay = { COLS: x1 - ox + 5, ROWS: y1 - oy + 5, room, cor, frame: F.n };
    return m;
  }

  // 드문 사건 (rare = 층마다 나올 확률): 지도가 선 뒤에 따로 굴려, 사건 방 하나를 바꿔 놓는다 (지도 자체는 그대로)
  function rares(m, seed) {
    const rng = RUN.rng(seed * 31 + 7), evs = m.nodes.filter(n => n.type === 'event' && !n.evFixed);
    for (const e of RUN.EVENTS) if (e.rare && evs.length && rng() < e.rare) evs[Math.floor(rng() * evs.length)].ev = e.id;
    return m;
  }
  const make = (seed, floor = 1) => {
    const S = RUN.zone(floor).shape || {}, F = frameOf(seed, S);
    for (let k = 0; k < 300; k++) { const m = build(seed * 7919 + k, F, floor); if (m) return rares(m, seed); }
    { const SP0 = RUN.SPECS && RUN.SPECS[floor]; if (SP0 && !RUN.COMPACT && SP0.sides.length > 3 && (RUN.SMALL || !SP0.main.some(q => q.c || q.fork?.some(x => x.c)))) { RUN.SPECS[floor] = { ...SP0, sides: SP0.sides.slice(0, -1) }; try { return make(seed, floor); } finally { RUN.SPECS[floor] = SP0; } } } // 곁방이 넷 이상인 설계서가 첫 윤곽에 안 서면 다른 윤곽을 뒤지기 전에 곁방 하나를 덜어 본다 (오래 걸리지 않게)
    // 뽑힌 윤곽에 층이 안 서면 그 구역의 다른 윤곽으로 (구역이 고르지 않은 세로형으로 바로 넘어가지 않게)
    for (const key of (S.frames || []).filter(k => FRAMES[k](RUN.rng(1)).n !== F.n)) { const F2 = FRAMES[key](RUN.rng(seed * 101 + 17)); F2.flip = F.flip;
      for (let k = 0; k < 150; k++) { const m = build(seed * 7919 + k, F2, floor); if (m) return rares(m, seed); } }
    for (let k = 0; k < 300; k++) { const m = build(seed * 7919 + k, FRAMES.tall(RUN.rng(seed)), floor); if (m) return rares(m, seed); }  // 윤곽이 너무 좁으면 세로형으로
    // 설계서가 안 서면(곁방 자리가 모자라는 굴 윤곽 — 9 · 10층에서 열에 하나쯤) 뒤의 곁방부터 하나씩 덜어 다시 (씨앗이 같으면 결과도 같다)
    const SP = RUN.SPECS && RUN.SPECS[floor];
    if (SP && SP.sides.length) { RUN.SPECS[floor] = { ...SP, sides: SP.sides.slice(0, -1) }; try { return make(seed, floor); } finally { RUN.SPECS[floor] = SP; } }
    throw new Error('지도를 만들지 못했다');
  };
  // 손으로 짠 방(RUN.ROOMS, js/explore/rooms.js) → 방 배치. x0 · y0: 놓을 지도 칸 좌표, flip: 좌우 뒤집기.
  // 돌려주는 것: 생성기의 방과 같은 꼴(x · y · w · h 칸, cells, decor, kind) + tmap(타일 글자 줄) · spawns(몬스터 자리, 타일 좌표) · tpl(이름)
  // 장식은 타일 좌표(tx · ty, 크기 s 타일)로 — 기둥 'P'는 2×2 묶음 하나로 그린다
  function fromTemplate(t, x0, y0, flip = false) {
    const K = RUN.ROOM_K, T = RUN.TILE, rows = flip ? t.map.map(r => [...r].reverse().join('')) : t.map.slice(), th = rows.length, tw = rows[0].length;
    const at = (x, y) => (y >= 0 && y < th && x >= 0 && x < tw ? rows[y][x] : ' '), cells = [], decor = [], spawns = [];
    for (let cy = 0; cy < th / K; cy++) for (let cx = 0; cx < tw / K; cx++) { let any = false; for (let j = 0; j < K; j++) for (let i = 0; i < K; i++) if (at(cx * K + i, cy * K + j) !== ' ') any = true; if (any) cells.push([x0 + cx, y0 + cy]); }
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
      const ch = at(x, y), X = x0 * K + x, Y = y0 * K + y;
      if (ch === 'P') { if (at(x - 1, y) !== 'P' && at(x, y - 1) !== 'P') decor.push({ k: 'pillar', tx: X, ty: Y, s: at(x + 1, y) === 'P' && at(x, y + 1) === 'P' ? 2 : 1 }); continue; }
      const k = T.decor[ch]; if (k) decor.push({ k, tx: X, ty: Y, s: 1 });
      if (T.spawn.includes(ch)) spawns.push({ tx: X, ty: Y, k: +ch });
    }
    return { x: x0, y: y0, w: tw / K, h: th / K, cells, decor, kind: t.cave ? 'cave' : 'tmpl', tmap: rows, tpl: t.id, spawns };
  }
  return { make, outs, ins, keyless, path, ROWS: ROWS_GRAPH, FRAMES, fromTemplate };
})();
