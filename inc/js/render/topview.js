'use strict';
// 탑뷰 시험 (2026-11-26 사용자: 「아이소매트릭이 아니라 그냥 탑뷰면」 · 「플레이감각만 보려는거니까 실제플레이화면에 연결해봐」): 주소에 ?view=top
// 그림은 0x72 「16x16 DungeonTileset II」(CC0, assets/src/0x72/frames) — 바닥 · 벽 · 인물 · 몬스터 · 무기. 쿼터뷰 그리기(main.js 아래쪽)는 건너뛰고 같은 판 상태(rt)를 비스듬한 탑뷰로 그린다.
// 규칙 · 칸 좌표는 그대로. 화면 위 표시(UI.place · toStage · tileAt — 문 표지 · 끌기 고리 · 예고 칸)는 이 시점의 좌표로 바꿔 끼운다.
const TOP = (() => {
  // 켜기: 주소 ?view=top (끄기 ?view=iso) 또는 길드의 시점 단추 — 이 브라우저에 기억한다 (출발할 때 주소 옵션이 지워진다)
  const v0 = typeof q !== 'undefined' ? q.get('view') : null; try { if (v0 === 'top' || v0 === 'iso') localStorage.setItem('inc.view', v0); } catch (e) { /* 기억 못 해도 */ }
  const vNow = (() => { try { return v0 || localStorage.getItem('inc.view'); } catch (e) { return v0; } })();
  const on = vNow === 'top' && typeof DIVEUI !== 'undefined';
  if (!on) return { on: false };
  const HAS = new Set(["angel_idle_anim_f0","angel_idle_anim_f1","angel_idle_anim_f2","angel_idle_anim_f3","angel_run_anim_f0","angel_run_anim_f1","angel_run_anim_f2","angel_run_anim_f3","big_demon_idle_anim_f0","big_demon_idle_anim_f1","big_demon_idle_anim_f2","big_demon_idle_anim_f3","big_demon_run_anim_f0","big_demon_run_anim_f1","big_demon_run_anim_f2","big_demon_run_anim_f3","big_zombie_idle_anim_f0","big_zombie_idle_anim_f1","big_zombie_idle_anim_f2","big_zombie_idle_anim_f3","big_zombie_run_anim_f0","big_zombie_run_anim_f1","big_zombie_run_anim_f2","big_zombie_run_anim_f3","bomb_f0","bomb_f1","bomb_f2","button_blue_down","button_blue_up","button_red_down","button_red_up","chest_empty_open_anim_f0","chest_empty_open_anim_f1","chest_empty_open_anim_f2","chest_full_open_anim_f0","chest_full_open_anim_f1","chest_full_open_anim_f2","chest_mimic_open_anim_f0","chest_mimic_open_anim_f1","chest_mimic_open_anim_f2","chort_idle_anim_f0","chort_idle_anim_f1","chort_idle_anim_f2","chort_idle_anim_f3","chort_run_anim_f0","chort_run_anim_f1","chort_run_anim_f2","chort_run_anim_f3","coin_anim_f0","coin_anim_f1","coin_anim_f2","coin_anim_f3","column","column_wall","crate","doc_idle_anim_f0","doc_idle_anim_f1","doc_idle_anim_f2","doc_idle_anim_f3","doc_run_anim_f0","doc_run_anim_f1","doc_run_anim_f2","doc_run_anim_f3","doors_frame_left","doors_frame_right","doors_frame_top","doors_leaf_closed","doors_leaf_open","dwarf_f_hit_anim_f0","dwarf_f_idle_anim_f0","dwarf_f_idle_anim_f1","dwarf_f_idle_anim_f2","dwarf_f_idle_anim_f3","dwarf_f_run_anim_f0","dwarf_f_run_anim_f1","dwarf_f_run_anim_f2","dwarf_f_run_anim_f3","dwarf_m_hit_anim_f0","dwarf_m_idle_anim_f0","dwarf_m_idle_anim_f1","dwarf_m_idle_anim_f2","dwarf_m_idle_anim_f3","dwarf_m_run_anim_f0","dwarf_m_run_anim_f1","dwarf_m_run_anim_f2","dwarf_m_run_anim_f3","edge_down","elf_f_hit_anim_f0","elf_f_idle_anim_f0","elf_f_idle_anim_f1","elf_f_idle_anim_f2","elf_f_idle_anim_f3","elf_f_run_anim_f0","elf_f_run_anim_f1","elf_f_run_anim_f2","elf_f_run_anim_f3","elf_m_hit_anim_f0","elf_m_idle_anim_f0","elf_m_idle_anim_f1","elf_m_idle_anim_f2","elf_m_idle_anim_f3","elf_m_run_anim_f0","elf_m_run_anim_f1","elf_m_run_anim_f2","elf_m_run_anim_f3","flask_big_blue","flask_big_green","flask_big_red","flask_big_yellow","flask_blue","flask_green","flask_red","flask_yellow","floor_1","floor_2","floor_3","floor_4","floor_5","floor_6","floor_7","floor_8","floor_ladder","floor_spikes_anim_f0","floor_spikes_anim_f1","floor_spikes_anim_f2","floor_spikes_anim_f3","floor_stairs","goblin_idle_anim_f0","goblin_idle_anim_f1","goblin_idle_anim_f2","goblin_idle_anim_f3","goblin_run_anim_f0","goblin_run_anim_f1","goblin_run_anim_f2","goblin_run_anim_f3","hole","ice_zombie_anim_f0","ice_zombie_anim_f1","ice_zombie_anim_f2","ice_zombie_anim_f3","imp_idle_anim_f0","imp_idle_anim_f1","imp_idle_anim_f2","imp_idle_anim_f3","imp_run_anim_f0","imp_run_anim_f1","imp_run_anim_f2","imp_run_anim_f3","knight_f_hit_anim_f0","knight_f_idle_anim_f0","knight_f_idle_anim_f1","knight_f_idle_anim_f2","knight_f_idle_anim_f3","knight_f_run_anim_f0","knight_f_run_anim_f1","knight_f_run_anim_f2","knight_f_run_anim_f3","knight_m_hit_anim_f0","knight_m_idle_anim_f0","knight_m_idle_anim_f1","knight_m_idle_anim_f2","knight_m_idle_anim_f3","knight_m_run_anim_f0","knight_m_run_anim_f1","knight_m_run_anim_f2","knight_m_run_anim_f3","lever_left","lever_right","lizard_f_hit_anim_f0","lizard_f_idle_anim_f0","lizard_f_idle_anim_f1","lizard_f_idle_anim_f2","lizard_f_idle_anim_f3","lizard_f_run_anim_f0","lizard_f_run_anim_f1","lizard_f_run_anim_f2","lizard_f_run_anim_f3","lizard_m_hit_anim_f0","lizard_m_idle_anim_f0","lizard_m_idle_anim_f1","lizard_m_idle_anim_f2","lizard_m_idle_anim_f3","lizard_m_run_anim_f0","lizard_m_run_anim_f1","lizard_m_run_anim_f2","lizard_m_run_anim_f3","masked_orc_idle_anim_f0","masked_orc_idle_anim_f1","masked_orc_idle_anim_f2","masked_orc_idle_anim_f3","masked_orc_run_anim_f0","masked_orc_run_anim_f1","masked_orc_run_anim_f2","masked_orc_run_anim_f3","muddy_anim_f0","muddy_anim_f1","muddy_anim_f2","muddy_anim_f3","necromancer_anim_f0","necromancer_anim_f1","necromancer_anim_f2","necromancer_anim_f3","ogre_idle_anim_f0","ogre_idle_anim_f1","ogre_idle_anim_f2","ogre_idle_anim_f3","ogre_run_anim_f0","ogre_run_anim_f1","ogre_run_anim_f2","ogre_run_anim_f3","orc_shaman_idle_anim_f0","orc_shaman_idle_anim_f1","orc_shaman_idle_anim_f2","orc_shaman_idle_anim_f3","orc_shaman_run_anim_f0","orc_shaman_run_anim_f1","orc_shaman_run_anim_f2","orc_shaman_run_anim_f3","orc_warrior_idle_anim_f0","orc_warrior_idle_anim_f1","orc_warrior_idle_anim_f2","orc_warrior_idle_anim_f3","orc_warrior_run_anim_f0","orc_warrior_run_anim_f1","orc_warrior_run_anim_f2","orc_warrior_run_anim_f3","pumpkin_dude_idle_anim_f0","pumpkin_dude_idle_anim_f1","pumpkin_dude_idle_anim_f2","pumpkin_dude_idle_anim_f3","pumpkin_dude_run_anim_f0","pumpkin_dude_run_anim_f1","pumpkin_dude_run_anim_f2","pumpkin_dude_run_anim_f3","skelet_idle_anim_f0","skelet_idle_anim_f1","skelet_idle_anim_f2","skelet_idle_anim_f3","skelet_run_anim_f0","skelet_run_anim_f1","skelet_run_anim_f2","skelet_run_anim_f3","skull","slug_anim_f0","slug_anim_f1","slug_anim_f2","slug_anim_f3","swampy_anim_f0","swampy_anim_f1","swampy_anim_f2","swampy_anim_f3","tiny_slug_anim_f0","tiny_slug_anim_f1","tiny_slug_anim_f2","tiny_slug_anim_f3","tiny_zombie_idle_anim_f0","tiny_zombie_idle_anim_f1","tiny_zombie_idle_anim_f2","tiny_zombie_idle_anim_f3","tiny_zombie_run_anim_f0","tiny_zombie_run_anim_f1","tiny_zombie_run_anim_f2","tiny_zombie_run_anim_f3","ui_heart_empty","ui_heart_full","ui_heart_half","wall_banner_blue","wall_banner_green","wall_banner_red","wall_banner_yellow","wall_edge_bottom_left","wall_edge_bottom_right","wall_edge_left","wall_edge_mid_left","wall_edge_mid_right","wall_edge_right","wall_edge_top_left","wall_edge_top_right","wall_edge_tshape_bottom_left","wall_edge_tshape_bottom_right","wall_edge_tshape_left","wall_edge_tshape_right","wall_fountain_basin_blue_anim_f0","wall_fountain_basin_blue_anim_f1","wall_fountain_basin_blue_anim_f2","wall_fountain_basin_red_anim_f0","wall_fountain_basin_red_anim_f1","wall_fountain_basin_red_anim_f2","wall_fountain_mid_blue_anim_f0","wall_fountain_mid_blue_anim_f1","wall_fountain_mid_blue_anim_f2","wall_fountain_mid_red_anim_f0","wall_fountain_mid_red_anim_f1","wall_fountain_mid_red_anim_f2","wall_fountain_top_1","wall_fountain_top_2","wall_fountain_top_3","wall_goo","wall_goo_base","wall_hole_1","wall_hole_2","wall_left","wall_mid","wall_outer_front_left","wall_outer_front_right","wall_outer_mid_left","wall_outer_mid_right","wall_outer_top_left","wall_outer_top_right","wall_right","wall_top_left","wall_top_mid","wall_top_right","weapon_anime_sword","weapon_arrow","weapon_axe","weapon_baton_with_spikes","weapon_big_hammer","weapon_bow","weapon_bow_2","weapon_cleaver","weapon_double_axe","weapon_duel_sword","weapon_golden_sword","weapon_green_magic_staff","weapon_hammer","weapon_katana","weapon_knife","weapon_knight_sword","weapon_lavish_sword","weapon_mace","weapon_machete","weapon_red_gem_sword","weapon_red_magic_staff","weapon_regular_sword","weapon_rusty_sword","weapon_saw_sword","weapon_spear","weapon_throwing_axe","weapon_waraxe","wizzard_f_hit_anim_f0","wizzard_f_idle_anim_f0","wizzard_f_idle_anim_f1","wizzard_f_idle_anim_f2","wizzard_f_idle_anim_f3","wizzard_f_run_anim_f0","wizzard_f_run_anim_f1","wizzard_f_run_anim_f2","wizzard_f_run_anim_f3","wizzard_m_hit_anim_f0","wizzard_m_idle_anim_f0","wizzard_m_idle_anim_f1","wizzard_m_idle_anim_f2","wizzard_m_idle_anim_f3","wizzard_m_run_anim_f0","wizzard_m_run_anim_f1","wizzard_m_run_anim_f2","wizzard_m_run_anim_f3","wogol_idle_anim_f0","wogol_idle_anim_f1","wogol_idle_anim_f2","wogol_idle_anim_f3","wogol_run_anim_f0","wogol_run_anim_f1","wogol_run_anim_f2","wogol_run_anim_f3","zombie_anim_f1","zombie_anim_f10","zombie_anim_f2","zombie_anim_f3"]), DIR = 'assets/src/0x72/frames/', img = new Map();
  const im = n => { if (!n || !HAS.has(n)) return null; let i = img.get(n); if (!i) { i = new Image(); i.src = DIR + n + '.png'; img.set(n, i); } return i.complete && i.naturalWidth ? i : null; };
  const frameOf = (base, st, f) => { for (const n of [`${base}_${st}_anim_f${f}`, `${base}_idle_anim_f${f}`, `${base}_anim_f${f}`, `${base}_${st}_anim_f0`, `${base}_idle_anim_f0`, `${base}_anim_f0`]) if (HAS.has(n)) return n; return null; };
  // 직업 → 인물 · 무기 (0x72)
  const CLS = { dragoon: ['knight_m', 'weapon_knight_sword'], paladin: ['knight_f', 'weapon_hammer'], barbarian: ['dwarf_m', 'weapon_waraxe'], rogue: ['elf_m', 'weapon_knife'], archer: ['elf_f', 'weapon_bow'],
    cleric: ['dwarf_f', 'weapon_mace'], mage: ['wizzard_m', 'weapon_red_magic_staff'], archmage: ['wizzard_f', 'weapon_green_magic_staff'], bard: ['lizard_f', 'weapon_duel_sword'], warlock: ['lizard_m', 'weapon_red_gem_sword'], monk: ['pumpkin_dude', null], scout: ['angel', 'weapon_spear'] };
  // 몬스터 이름 → 그림 (없으면 유형 · 크기로)
  const MON = [[/홉고블린|오크/, 'orc_warrior'], [/고블린|코볼트/, 'goblin'], [/버그베어|놀|산적|불량배/, 'masked_orc'], [/주술|사제|메이지|광신|네크로/, 'orc_shaman'], [/오우거 좀비|미라|와이트/, 'big_zombie'],
    [/오우거|트롤|미노타/, 'ogre'], [/해골/, 'skelet'], [/구울|가스트|얼음/, 'ice_zombie'], [/좀비/, 'zombie'], [/임프/, 'imp'], [/용|드래곤|데빌|악마/, 'big_demon'], [/점액|슬라임|젤리|우즈/, 'swampy'], [/쥐|박쥐|벌레|거미/, 'tiny_slug'], [/늑대|워그|개|하이에나/, 'wogol'], [/갑옷|기사|검/, 'masked_orc']];
  const TY = { undead: 'skelet', fiend: 'chort', beast: 'wogol', ooze: 'muddy', dragon: 'big_demon', giant: 'ogre', monstrosity: 'masked_orc' };
  const monArt = e => { const n = e.n || e.t || ''; for (const [re, a] of MON) if (re.test(n)) return a; return TY[e.ty] || 'goblin'; };
  const artOf = e => (e.kind === 'mon' ? [monArt(e), null] : CLS[e.merc?.cls] || ['knight_m', 'weapon_regular_sword']);
  // 화면
  const stage = $('stage'), cv = document.createElement('canvas'); cv.id = 'ct'; cv.style.cssText = 'position:absolute;left:0;top:0;image-rendering:pixelated;'; canvas.after(cv);
  const x = cv.getContext('2d'); canvas.style.visibility = 'hidden'; const hd0 = () => { const h = $('hd'); if (h) h.style.display = 'none'; };
  const TS = 16, CY = 0.4; let Z = 3, cx = 0, cy = 0, cw = 0, ch = 0, ready = false;
  const zkOf = () => { try { return JSON.parse(localStorage.getItem('inc.dive') || '{}').zk || 1; } catch (e) { return 1; } };
  let zk = 1, zkT = 0;
  function size() {
    const w = stage.clientWidth, h = stage.clientHeight, d = devicePixelRatio || 1;
    if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); cv.style.width = w + 'px'; cv.style.height = h + 'px'; }
    cw = cv.width; ch = cv.height; const n = performance.now(); if (n - zkT > 300) { zkT = n; zk = zkOf(); }
    Z = Math.max(1, Math.round(ch / (TS * 11) * zk)); // 화면 높이에 칸 11개쯤 (확대 · 축소는 원정의 배율 zk)
  }
  const sx = tx => Math.round((tx - cx) * TS * Z + cw / 2), sy = ty => Math.round((ty - cy) * TS * Z + ch * CY);
  const dpr = () => cv.width / (stage.clientWidth || 1);
  // UI 좌표 바꿔 끼우기 (stage 기준 CSS px)
  const toStage = (tx, ty, z = 0) => [((tx - cx) * TS * Z + cw / 2) / dpr(), ((ty - cy) * TS * Z + ch * CY - z * TS * Z * 0.5) / dpr()];
  UI.toStage = toStage;
  UI.place = (el, tx, ty, z = 0) => { const [X, Y] = toStage(tx, ty, z * 0.9); el.style.transform = `translate(${Math.round(X)}px,${Math.round(Y)}px) translate(-50%,-100%)`; };
  UI.tileAt = (clientX, clientY) => { const r = cv.getBoundingClientRect(), d = dpr(); return [cx + ((clientX - r.left) * d - cw / 2) / (TS * Z), cy + ((clientY - r.top) * d - ch * CY) / (TS * Z)]; };
  const put = (n, ix, iy) => { const i = im(n); if (i) x.drawImage(i, ix, iy, i.naturalWidth * Z, i.naturalHeight * Z); };
  const FLOOR = ['floor_1', 'floor_1', 'floor_1', 'floor_2', 'floor_3', 'floor_1', 'floor_4', 'floor_1', 'floor_5', 'floor_6', 'floor_7', 'floor_8'];
  const hsh = (a, b) => { let h = Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663); h = Math.imul(h ^ (h >>> 13), 1274126177); return (h >>> 0) % 1000; };
  function drawMap(r) {
    const m = r.map, W = m.w, H = m.h, o = TS * Z / 2;
    const wall = (i, j) => { if (i < 0 || j < 0 || i >= W || j >= H) return true; const c = m.c[j * W + i]; return c === '#' || c === ' ' || c == null; };
    const seen = (i, j) => i >= 0 && j >= 0 && i < W && j < H && !!r.seen?.[j * W + i];
    const span = Math.ceil(Math.max(cw, ch) / (TS * Z) / 2) + 2, i0 = Math.max(0, Math.floor(cx - span)), i1 = Math.min(W - 1, Math.ceil(cx + span)), j0 = Math.max(0, Math.floor(cy - span)), j1 = Math.min(H - 1, Math.ceil(cy + span));
    for (let j = j0; j <= j1 + 1; j++) for (let i = i0; i <= i1; i++) {
      const X = sx(i) - o, Y = sy(j) - o;
      if (!wall(i, j)) { if (!seen(i, j)) continue; put(FLOOR[hsh(i, j) % FLOOR.length], X, Y); if (m.c[j * W + i] === '>') put('floor_stairs', X, Y); continue; }
      let near = false; for (let b = -1; b <= 1 && !near; b++) for (let a = -1; a <= 1; a++) if (!wall(i + a, j + b) && seen(i + a, j + b)) { near = true; break; } if (!near) continue;
      if (!wall(i, j + 1)) { const h = hsh(i, j); put(h % 11 === 0 ? 'wall_banner_' + ['red', 'blue', 'green', 'yellow'][hsh(j, i) % 4] : h % 17 === 0 ? 'wall_hole_1' : 'wall_mid', X, Y); put('wall_top_mid', X, Y - o * 2); } // 앞면 + 윗단
      else { x.fillStyle = '#1c1720'; x.fillRect(X, Y - o * 2, o * 2, o * 2); if (!wall(i - 1, j)) put('wall_edge_mid_left', X, Y - o * 2); if (!wall(i + 1, j)) put('wall_edge_mid_right', X, Y - o * 2); } // 윗면 (어둡게) · 옆 테두리
    }
  }
  const PROP = { chest: 'chest_full_open_anim_f0', crate: 'crate', barrel: 'crate', column: 'column', brokenpillar: 'column', statue: 'column', urn: 'flask_big_red', bones: 'skull', debris: 'skull', altar: 'column' };
  const look = new WeakMap(), words = [];
  function drawEnt(e, r, t, dt, foes) {
    const tx = e._dx ?? e.x, ty = e._dy ?? e.y, mon = e.kind === 'mon', [base, wpn] = artOf(e);
    let L = look.get(e); if (!L) { L = { px: tx, py: ty, hp: e.hp, hit: -9, dir: mon ? -1 : 1, mv: 0 }; look.set(e, L); }
    const dx = tx - L.px, dy = ty - L.py, sp = Math.hypot(dx, dy) / Math.max(dt, 1e-3); L.mv = sp > 0.4 ? 0.2 : Math.max(0, L.mv - dt); L.px = tx; L.py = ty;
    if (e.hp < L.hp - 0.5) L.hit = t; L.hp = e.hp;
    const tg = foes.length ? foes.reduce((a, b) => (Math.hypot((b._dx ?? b.x) - tx, (b._dy ?? b.y) - ty) < Math.hypot((a._dx ?? a.x) - tx, (a._dy ?? a.y) - ty) ? b : a)) : null;
    if (Math.abs(dx) > 0.005) L.dir = dx > 0 ? 1 : -1; else if (tg && r.turn) L.dir = (tg._dx ?? tg.x) >= tx ? 1 : -1;
    const dead = mon ? e.hp <= 0 : e.dead, st = L.mv > 0 ? 'run' : t - L.hit < 0.25 ? 'hit' : 'idle', f = Math.floor(t * (st === 'run' ? 10 : 6) + hsh(e.uid || 0, base.length) % 4) % 4, I = im(frameOf(base, st, f)); if (!I) return;
    // 휘두르기: 공격이 시작된 때(e._lu)부터 짧게 표적 쪽으로
    const lu = e._lu ? (performance.now() - e._lu) / 380 : 9, lq = lu >= 0 && lu < 1 ? Math.sin(lu * Math.PI) : 0, ox = tg ? (tg._dx ?? tg.x) - tx : 0, oy = tg ? (tg._dy ?? tg.y) - ty : 0, ol = Math.hypot(ox, oy) || 1;
    const w = I.naturalWidth * Z, h = I.naturalHeight * Z, X = sx(tx) + lq * ox / ol * 5 * Z, Y = sy(ty) + TS * Z * 0.45 + lq * oy / ol * 5 * Z;
    x.save(); x.fillStyle = 'rgba(0,0,0,.35)'; x.beginPath(); x.ellipse(sx(tx), sy(ty) + TS * Z * 0.42, w * 0.32, Z * 2.2, 0, 0, 7); x.fill();
    if (dead) { x.globalAlpha = 0.55; x.translate(X, Y - Z * 3); x.rotate(Math.PI / 2 * L.dir); x.filter = 'grayscale(1)'; x.drawImage(I, -w / 2, -h / 2, w, h); x.restore(); return; }
    x.translate(X, Y); if (L.dir < 0) x.scale(-1, 1);
    if (t - L.hit < 0.1) x.filter = 'brightness(2.6)';
    x.drawImage(I, -w / 2, -h, w, h);
    const WI = wpn && im(wpn); if (WI) { const ww = WI.naturalWidth * Z * 0.62, wh = WI.naturalHeight * Z * 0.62, still = /bow|staff/.test(wpn); x.translate(w * 0.16, -h * 0.22); x.rotate(still ? 0 : lq > 0 ? -0.5 + lq * 2.3 : 0.3); x.drawImage(WI, -ww / 2, -wh * 0.82, ww, wh); }
    x.restore();
    const max = e.max || 1; if (r.turn && e.hp < max) { const bw = Math.max(w * 0.8, 12 * Z), bx = sx(tx) - bw / 2, by = Y - h - 4 * Z; x.fillStyle = '#120a08'; x.fillRect(bx - Z, by - Z, bw + 2 * Z, 3 * Z); x.fillStyle = mon ? '#e04a3a' : '#5fd068'; x.fillRect(bx, by, bw * Math.max(0, e.hp) / max, Z); }
  }
  // 주문 · 기술 이펙트: 쿼터뷰의 선 그림 이펙트(VFX.VEC — 원점 = 발밑, 단위 = 버퍼 화소)를 탑뷰 좌표에 그대로 그린다. 없는 이름은 색 고리
  const live = [], VK = 0.75; // VK: 쿼터뷰 버퍼 화소 → 0x72 화소 (인형 38 ↔ 인물 28)
  const tint = id => (/fire|flame|meteor/.test(id) ? '#ff8a3a' : /ice|frost|snow/.test(id) ? '#9fe0ff' : /holy|heal|light|bless/.test(id) ? '#ffe98a' : /nature|poison|acid/.test(id) ? '#8fe04a' : '#c9a0ff');
  function vfx(id, tx, ty, t, o = {}) { const V = VFX.VEC?.[id]; if (!V) { words.push({ ring: 1, x: tx, y: ty, c: tint(id), t0: t }); return null; } const q = { vid: id, x: tx, y: ty, t0: t, dur: V.loop ? Math.min(1.2, (V.dur || 1) * 2) : V.dur || 0.6, loop: !!V.loop, seed: Math.random() * 6.283, ang: 0, flip: false, pal: false, ...o }; live.push(q); return q; }
  function cast(o, r, t) {
    const a = o.who, ax = a?._dx ?? o.x, ay = a?._dy ?? o.y, id = o.id || '', near = p => [...r.party, ...r.mons].find(e => !e.dead && e.hp > 0 && Math.hypot(e.x - p[0], e.y - p[1]) < 0.9) || null;
    if (o.mode === 'me') { vfx(id, ax, ay, t, { e: a }); return; }
    for (const p of (o.pts || []).slice(0, 8)) {
      if (o.mode === 'to' || o.mode === 'all') { vfx(id, p[0], p[1], t, { e: near(p) }); continue; }
      const ang = Math.atan2(p[1] - ay, p[0] - ax);
      if (o.mode === 'fly') { const q = vfx(id, ax, ay, t, { ang, fly: { x0: ax, y0: ay, x1: p[0], y1: p[1], T: 0.3 }, z: 1 }); if (q) { q.dur = Math.max(q.dur, 0.3); q.hit = o.hit ? () => vfx(o.hit, p[0], p[1], t + 0.3, { e: near(p) }) : null; } continue; }
      const q = vfx(id, ax, ay, t, p[0] < ax ? { flip: true, ang: -Math.atan2(p[1] - ay, ax - p[0]) } : { ang }); if (q && o.hit) { q.hitAt = 0.35; q.hit = () => vfx(o.hit, p[0], p[1], t, { e: near(p) }); }
    }
  }
  function drawVfx(t) {
    for (let i = live.length - 1; i >= 0; i--) {
      const q = live[i], V = VFX.VEC[q.vid], age = t - q.t0; if (age < 0) continue;
      if (q.hit && (q.fly ? age >= q.fly.T : age >= (q.hitAt || 0.35) * q.dur)) { const h = q.hit; q.hit = null; h(); }
      if (age >= q.dur || (q.fly && age >= q.fly.T)) { live.splice(i, 1); continue; }
      if (q.e && q.e._dx != null) { q.x = q.e._dx; q.y = q.e._dy; }
      let tx = q.x, ty = q.y; if (q.fly) { const k = age / q.fly.T; tx = q.fly.x0 + (q.fly.x1 - q.fly.x0) * k; ty = q.fly.y0 + (q.fly.y1 - q.fly.y0) * k; }
      const u = q.loop ? (age % (V.dur || 1)) / (V.dur || 1) : Math.min(1, age / q.dur), K = Z * VK, X = sx(tx), Y = sy(ty) + TS * Z * 0.45 - (q.fly ? TS * Z * 0.6 : 0);
      try {
        if (V.glow) { x.save(); x.globalCompositeOperation = 'lighter'; x.translate(X, Y); x.scale(K, K); x.filter = `blur(${Math.round(Z * 2)}px)`; V.glow(x, u, q); x.restore(); }
        x.save(); x.translate(X, Y); x.scale(K * 1.25, K * 1.25); if (q.ang) x.rotate(q.ang); if (q.flip) x.scale(-1, 1); x.lineJoin = 'round'; x.lineCap = 'round'; x.globalAlpha = q.loop && age > q.dur - 0.25 ? (q.dur - age) / 0.25 : 1; V.draw(x, u, q, age); x.restore();
      } catch (err) { live.splice(i, 1); }
    }
  }
  function drawFxTop(r, t) {
    for (const o of r.fx || []) { o._seen = 1; if (o._tv) continue; o._tv = 1;
      if (o.k === 'text') { const s = String(o.s).trim(), num = /^[+\-]?[\d,.]+$/.test(s); if (num && !Math.round(parseFloat(s.replace(/[^\d.]/g, '')))) continue; words.push({ s, x: o.x, y: o.y, c: o.col || (num ? (s[0] === '+' ? '#7dff8a' : '#ffffff') : '#ffe9b0'), t0: t, num, sz: o.sz || 1 }); }
      else if ((o.k === 'proj' || o.k === 'beam') && o.x2 != null) words.push({ beam: 1, x: o.x, y: o.y, x2: o.x2, y2: o.y2, c: o.col || '#ffd45a', t0: t });
      else if (o.k === 'cast') cast(o, r, t);
      else if (o.k === 'slash' && o.x != null) vfx('slash', o.x, o.y, t, { flip: !!o.flip, ang: (o.rot || 0) * 0.6, crit: !!o.crit, z: 1 });
      else if (o.k === 'impact' && o.x != null) vfx('impacts/hit-spark', o.x, o.y, t, { z: 1 });
      else if (o.k === 'splat' && o.x != null) vfx('blood', o.x, o.y, t, { dir: (o.dx || o.dy) ? Math.atan2(o.dy || 0, o.dx || 0) : -1.57, n: o.n || 5, s: o.s || 1 });
    }
    drawVfx(t); x.textAlign = 'center';
    for (let k = words.length - 1; k >= 0; k--) {
      const w = words[k], u = (t - w.t0) / (w.beam ? 0.25 : w.ring ? 0.5 : 0.9); if (u >= 1) { words.splice(k, 1); continue; }
      if (w.beam || w.ring) { x.strokeStyle = w.c; x.globalAlpha = 1 - u; x.lineWidth = 2 * Z; x.beginPath(); if (w.beam) { x.moveTo(sx(w.x), sy(w.y)); x.lineTo(sx(w.x2), sy(w.y2)); } else x.arc(sx(w.x), sy(w.y), (4 + u * 14) * Z, 0, 7); x.stroke(); x.globalAlpha = 1; continue; }
      const fs = Math.round((w.num ? 8 : 5.5) * Z * w.sz), X = sx(w.x), Y = sy(w.y) - TS * Z * 0.3 - u * 12 * Z;
      x.font = `700 ${fs}px Galmuri11, sans-serif`; x.lineWidth = Z * 1.5; x.strokeStyle = '#120a08'; x.globalAlpha = u > 0.75 ? (1 - u) * 4 : 1; x.strokeText(w.s, X, Y); x.fillStyle = w.c; x.fillText(w.s, X, Y); x.globalAlpha = 1;
    }
  }
  function draw(r, dt) {
    size(); hd0(); const t = performance.now() / 1000; if (typeof settle === 'function') settle(r, dt); // 표시 위치(_dx · _dy)를 걸음에 맞춰 옮긴다 (쿼터뷰 그리기가 하던 일)
    const pl = r.party.filter(p => !p.dead), pc = pl.length ? [pl.reduce((a, e) => a + (e._dx ?? e.x), 0) / pl.length, pl.reduce((a, e) => a + (e._dy ?? e.y), 0) / pl.length] : [cx, cy], seenM = r.mons.filter(m => m.hp > 0 && m.spotted && m.aggro && Math.hypot(m.x - pc[0], m.y - pc[1]) < 7), pts = pl.concat(seenM), dc = r.turn && pts.length ? [pts.reduce((a, e) => a + (e._dx ?? e.x), 0) / pts.length, pts.reduce((a, e) => a + (e._dy ?? e.y), 0) / pts.length] : null, hf = DIVEUI.follow ? DIVEUI.follow(r) : null, live = r.party.filter(p => !p.dead);
    const aim = hf || dc || (live.length ? [live.reduce((a, p) => a + (p._dx ?? p.x), 0) / live.length, live.reduce((a, p) => a + (p._dy ?? p.y), 0) / live.length] : [cx, cy]);
    const k = ready ? 1 - Math.exp(-dt * 5) : 1; cx += (aim[0] - cx) * k; cy += (aim[1] - cy) * k; ready = true;
    x.imageSmoothingEnabled = false; x.filter = 'none'; x.fillStyle = '#100c12'; x.fillRect(0, 0, cw, ch);
    drawMap(r);
    for (const P of r.map.props || []) { const n = PROP[P.kind || P.k || P.t]; if (!n || !r.seen?.[Math.round(P.y) * r.map.w + Math.round(P.x)]) continue; const I = im(n); if (I) x.drawImage(I, sx(P.x) - I.naturalWidth * Z / 2, sy(P.y) + TS * Z / 2 - I.naturalHeight * Z, I.naturalWidth * Z, I.naturalHeight * Z); }
    const foesOf = e => (e.kind === 'mon' ? r.party.filter(p => !p.dead) : r.mons.filter(m => m.hp > 0 && m.aggro));
    const all = r.mons.filter(m => m.hp > 0 && m.spotted && r.seen?.[Math.round(m.y) * r.map.w + Math.round(m.x)]).concat(r.party);
    all.sort((a, b) => (a._dy ?? a.y) - (b._dy ?? b.y)).forEach(e => drawEnt(e, r, t, dt, foesOf(e)));
    if (live.length) { const g = x.createRadialGradient(sx(aim[0]), sy(aim[1]), TS * Z * 4, sx(aim[0]), sy(aim[1]), Math.max(cw, ch) * 0.7); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(6,3,10,.7)'); x.fillStyle = g; x.fillRect(0, 0, cw, ch); } // 빛: 파티 둘레만
    drawFxTop(r, t);
    document.body.dataset.floor = 'ready';
  }
  return { on: true, draw, dbg: e => { const a = artOf(e); return [a[0], frameOf(a[0], 'idle', 0), !!im(frameOf(a[0], 'idle', 0))]; }, get fx() { return live.map(q => q.vid); } };
})();
