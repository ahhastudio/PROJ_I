'use strict';
// 계열 스킬 (화면 없이, 2026-11-27 — inc/SKILL_LINES.md): 밀리 · 원거리 직업의 계열마다 스킬 여섯을 성급 차례로 둔다. 스킬은 SRD를 벗어나도 된다 (사용자 확정).
// - 수치는 「기본 공격의 몇 배」(×k): 그 사람의 무기 한 대 × 공격 횟수 × k를 한 번 굴린다. AI 값도 같은 단위(기본 공격 = 1)로 S.ai가 돌려준다 (js/ai/skill_ai.js)
// - 성급이 아직 없으니 칸은 레벨로 연다: LINE_LV (1성 둘 · 2성 5레벨 · 3성 9 · 4성 13 · 5성 17 — 별 × 4 + 1). 계열 빌드는 레벨업 카드 없이 이 차례 그대로
// - 패시브는 엔진에 한 번 감싸 거는 것(hurt · hurtMember · Foe.target · Dnd.attack)으로 — 칸에 들어 있을 때만 (G.Fantasy.sk)
(() => {
  const D = G.D, DN = G.Dnd, GR = G.Grid, F = () => G.Fantasy, H = () => G.Skill.H, SK = G.Skill.SK;
  const now = () => G.S.runTime, R6 = n => n * G.Res_ROUND;
  const has = (c, k) => !!c?.merc && F().sk(c, k);
  const live = o => o && o.hp > 0 && !o.dead;
  const foes = x => x.rt.mons.filter(live);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const reach = c => (DN.melee(c) ? 1.8 : Math.max(1.8, (DN.rng(c) || 0) + 0.3));
  const inReach = (x, c, r = reach(c)) => x.seen.filter(o => live(o) && dist(o, c) <= r).sort((a, b) => dist(a, c) - dist(b, c));
  const around = (x, p, r, skip) => foes(x).filter(o => o !== skip && dist(o, p) <= r);
  const say = (x, c, s, col = '#ffe08a') => G.fx(x.rt, { k: 'text', x: c.x, y: c.y - 1.2, s, col, t: 1, sz: 0.9, pop: true });
  const ring = (x, p, r, col) => G.fx(x.rt, { k: 'ring', x: p.x, y: p.y, r, t: 0.45, col });
  // 기본 공격 ×k 한 번: 명중을 굴려 맞으면 (무기 주사위 × 공격 횟수) × k. 치명타는 주사위 두 배
  function hitK(x, c, o, k, opt = {}) {
    if (!live(o)) return { hit: false };
    const r = DN.attack(c, o); if (!r.hit && !opt.sure) { DN.miss(x.rt, o); return r; }
    const w = DN.weapon(c), n = opt.once ? 1 : DN.attacks(c), s = [w.n * n, w.d, (w.b + DN.bsum(c, 'dmgB')) * n];
    F().hurt(x.f, x.rt, o, H().dmg(x, c, s, r.crit) * k * (opt.mul || 1), r.crit ? 'crit' : 'hit', c);
    if (live(o)) G.Skill.onHit(x.f, x.rt, c, o);
    return { ...r, hit: true };
  }
  const cond = (x, c, o, ab, k, rounds) => live(o) && H().cond(x, c, o, ab, k, rounds);
  const buff = (e, k, rounds, props) => DN.buff(e, k, R6(rounds), props);
  // 일직선: c에서 o 쪽으로 len칸, 폭 0.8 안의 적
  const line = (x, c, o, len) => { const dx = o.x - c.x, dy = o.y - c.y, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l; return foes(x).filter(q => { const px = q.x - c.x, py = q.y - c.y, t = px * ux + py * uy; return t > 0 && t <= len + 0.3 && Math.abs(px * uy - py * ux) <= 0.8; }); };
  const stepTo = (x, c, o) => { for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) { const tx = Math.round(o.x) + dx, ty = Math.round(o.y) + dy; if (GR.pass(x.rt.map, tx, ty) && !x.rt.party.concat(x.rt.mons).some(e => live(e) && e !== c && Math.round(e.x) === tx && Math.round(e.y) === ty)) { c.x = tx; c.y = ty; return true; } } return false; };
  const prone = o => DN.has(o, 'prone'), downed = o => DN.has(o, 'prone') || DN.has(o, 'stunned') || DN.has(o, 'paralyzed') || DN.has(o, 'restrained');
  // AI 값: 맞히는 수 × 배율 (+ 상태 하나 0.4) — 기본 공격 = 1
  const V = (n, k, extra = 0) => (n > 0 ? n * k + extra : -1);

  // ── 스킬 정의: [id, 이름, 종류(a 스킬 · p 패시브), 쿨, 설명(현대식), 아이콘 타일, SK 몸 { when, run, ai }] ──
  const L = [];
  const A = (id, n, cd, d, t, body) => L.push({ id, n, cd, d, t, body, p: false });
  const P = (id, n, d, t) => L.push({ id, n, d, t, p: true });
  // 파이터
  A('ln_carve', '가르기', 4, '2칸 일직선 · 피해 ×1.8', 'w_spear', { when: (c, x) => inReach(x, c).length > 0, ai: (c, x) => { const o = inReach(x, c)[0]; return o ? V(line(x, c, o, 2).length, 1.8) : -1; }, run(c, x) { const o = inReach(x, c)[0]; for (const q of line(x, c, o, 2)) hitK(x, c, q, 1.8); } });
  A('ln_gale', '칼바람', 8, '2칸 범위 · 피해 ×2.0 · 처치하면 한 번 더 (최대 3)', 'w_spear', { when: (c, x) => around(x, c, 2).length > 0, ai: (c, x) => V(around(x, c, 2).length, 2), run(c, x) { ring(x, c, 2, '#ffe08a'); for (let i = 0; i < 3; i++) { const L0 = around(x, c, 2); let kill = false; for (const q of L0) { hitK(x, c, q, 2); if (!live(q)) kill = true; } if (!kill || !around(x, c, 2).length) break; say(x, c, '한 번 더!'); } } });
  A('ln_bash', '방패 강타', 3, '피해 ×0.8 · 넘어뜨림', 'd_shield', { when: (c, x) => inReach(x, c, 1.8).length > 0, ai: (c, x) => V(inReach(x, c, 1.8).length ? 1 : 0, 0.8, 0.5), run(c, x) { const o = inReach(x, c, 1.8)[0], r = hitK(x, c, o, 0.8); if (r.hit) cond(x, c, o, 'str', 'prone', 1); } });
  P('ln_parry', '받아넘기기', '라운드의 첫 근접 피해 −30%', 'd_shield');
  P('ln_cover', '가로막기', '곁의 동료가 받을 근접 피해를 대신 받음 (라운드 1회)', 'd_shield');
  A('ln_bulwark', '철벽', 10, '3턴 · 3칸 안 동료 방어 +3 · 곁의 적은 나만 공격', 'd_shield', { when: (c, x) => around(x, c, 3).length > 0, ai: (c, x) => (around(x, c, 1.8).length ? 1.6 : 0.8) * Math.min(1, G.SkillAI.threat(c, x)) * 1.5, run(c, x) { ring(x, c, 3, '#9fd8ff'); for (const p of x.rt.party.filter(p => !p.dead && dist(p, c) <= 3)) buff(p, 'bulwark', 3, { ac: 3 }); buff(c, 'taunt', 3, { taunt: 1.8 }); } });
  P('ln_flank', '협공', '동료가 붙은 적을 치면 추가 피해 2~12 (차례당 1회)', 'w_spear');
  A('ln_dance', '칼춤', 8, '1칸 범위 · 피해 ×0.7 다섯 번', 'w_spear', { when: (c, x) => around(x, c, 1.8).length > 0, ai: (c, x) => V(Math.min(5, around(x, c, 1.8).length * 2), 0.7), run(c, x) { for (let i = 0; i < 5; i++) { const L0 = around(x, c, 1.8); if (!L0.length) break; hitK(x, c, L0[i % L0.length], 0.7); } } });
  A('ln_aim', '조준 사격', 3, '8칸 · 피해 ×1.8', 'w_bow', { when: (c, x) => inReach(x, c, 8).length > 0, ai: (c, x) => V(inReach(x, c, 8).length ? 1 : 0, 1.8), run(c, x) { const o = G.Tactics.pick(x.rt, inReach(x, c, 8), c) || inReach(x, c, 8)[0]; G.fx(x.rt, { k: 'proj', x: c.x, y: c.y, x2: o.x, y2: o.y, key: 'fx_arrow', t: 0.2 }); hitK(x, c, o, 1.8); } });
  A('ln_pierce', '관통 볼트', 4, '일직선 범위 · 피해 ×1.3', 'w_bow', { when: (c, x) => inReach(x, c, 8).length > 0, ai: (c, x) => { const o = inReach(x, c, 8)[0]; return o ? V(line(x, c, o, 8).length, 1.3) : -1; }, run(c, x) { const o = inReach(x, c, 8)[0]; G.fx(x.rt, { k: 'beam', x: c.x, y: c.y, x2: o.x, y2: o.y, col: '#e8d8a8', w: 2, t: 0.25 }); for (const q of line(x, c, o, 8)) hitK(x, c, q, 1.3); } });
  A('ln_volley', '일제 사격', 8, '사거리 안 4명 · 피해 ×1.5', 'w_bow', { when: (c, x) => inReach(x, c, 8).length > 0, ai: (c, x) => V(Math.min(4, inReach(x, c, 8).length), 1.5), run(c, x) { for (const q of inReach(x, c, 8).slice(0, 4)) hitK(x, c, q, 1.5); } });
  // 바바리안
  P('ln_chain', '연쇄 처치', '적을 쓰러뜨리면 기본 공격 1회 더', 'w_axe');
  A('ln_feast', '피의 축제', 10, '3턴 · 처치할 때마다 쿨타임 −2', 'w_axe', { when: (c, x) => around(x, c, 3).length > 0, ai: (c, x) => (around(x, c, 3).length >= 2 ? 1.5 : 0.6), run(c, x) { buff(c, 'feast', 3, { feast: 1 }); say(x, c, '피의 축제'); } });
  A('ln_crush', '분쇄 일격', 4, '피해 ×2.5 · 치명타면 넘어뜨림', 'w_axe', { when: (c, x) => inReach(x, c, 1.8).length > 0, ai: (c, x) => V(inReach(x, c, 1.8).length ? 1 : 0, 2.5), run(c, x) { const o = inReach(x, c, 1.8)[0], r = hitK(x, c, o, 2.5); if (r.crit) cond(x, c, o, 'str', 'prone', 1); } });
  A('ln_charge', '돌진', 3, '먼 적에게 달려가 피해 ×1.5 · 넘어뜨림', 'a_escape', { when: (c, x) => x.seen.some(o => live(o) && dist(o, c) > 2.5 && dist(o, c) <= 8), ai: (c, x) => V(x.seen.some(o => live(o) && dist(o, c) > 2.5 && dist(o, c) <= 8) ? 1 : 0, 1.5, 0.6), run(c, x) { const o = x.seen.filter(o => live(o) && dist(o, c) > 2.5 && dist(o, c) <= 8).sort((a, b) => dist(a, c) - dist(b, c))[0]; if (!stepTo(x, c, o)) return false; const r = hitK(x, c, o, 1.5); if (r.hit) cond(x, c, o, 'str', 'prone', 1); } });
  A('ln_stomp', '짓밟기', 4, '넘어진 적 · 피해 ×2.0', 'w_axe', { when: (c, x) => inReach(x, c, 1.8).some(prone), ai: (c, x) => V(inReach(x, c, 1.8).some(prone) ? 1 : 0, 2), run(c, x) { hitK(x, c, inReach(x, c, 1.8).find(prone), 2); } });
  A('ln_quake', '대지 강타', 8, '2칸 범위 · 피해 ×1.5 · 넘어뜨림', 'w_axe', { when: (c, x) => around(x, c, 2).length > 0, ai: (c, x) => V(around(x, c, 2).length, 1.5, 0.4 * around(x, c, 2).length), run(c, x) { ring(x, c, 2, '#c89a5a'); for (const q of around(x, c, 2)) { const r = hitK(x, c, q, 1.5); if (r.hit) cond(x, c, q, 'str', 'prone', 1); } } });
  A('ln_taunt', '도발', 4, '2턴 · 곁의 적은 나만 공격', 'b_rage', { when: (c, x) => around(x, c, 1.8).length > 0 && x.rt.party.some(p => p !== c && !p.dead && p.hp < p.max * 0.7), ai: (c, x) => 1.4 * Math.min(1, G.SkillAI.threat(c, x)), run(c, x) { buff(c, 'taunt', 2, { taunt: 1.8 }); say(x, c, '도발', '#ff8a6a'); } });
  A('ln_hide', '강철 가죽', 10, '3턴 · 받는 피해 −70%', 'b_rage', { when: (c, x) => c.hp < c.max * 0.6 && around(x, c, 2).length > 0, ai: () => 2.5, run(c, x) { buff(c, 'hide', 3, { dmgK: 0.3 }); say(x, c, '강철 가죽'); } });
  // 로그
  P('ln_assassin', '암살', '아직 행동하지 않은 적 · 피해 ×2', 'w_knife');
  A('ln_poison', '독 바르기', 5, '3턴 · 명중마다 추가 피해 2~12', 'w_knife', { when: (c, x) => inReach(x, c, 3).length > 0 && !(c.bf?.poison?.until > now()), ai: () => 1.3, run(c, x) { buff(c, 'poison', 3, { poison: 1 }); say(x, c, '독', '#9fe79f'); } });
  A('ln_vanish', '은신', 6, '2턴 · 표적이 안 됨 · 다음 공격 ×2', 'c_invis', { when: (c, x) => around(x, c, 1.8).length > 0 && c.hp < c.max * 0.7, ai: () => 1.5, run(c, x) { buff(c, 'vanish', 2, { invis: 1, hitDis: 1, ambushK: 2 }); say(x, c, '은신', '#c9d8ff'); } });
  A('ln_ambush', '암습', 8, '피해 ×3.0 · 기절 1턴', 'w_knife', { when: (c, x) => inReach(x, c).length > 0, ai: (c, x) => V(inReach(x, c).length ? 1 : 0, 3, 0.6), run(c, x) { const o = inReach(x, c)[0], r = hitK(x, c, o, 3); if (r.hit) cond(x, c, o, 'con', 'stunned', 1); } });
  P('ln_riposte', '받아치기', '근접 공격이 빗나가면 ×0.7 반격 (라운드 1회)', 'w_knife');
  A('ln_disarm', '무장 해제', 4, '피해 ×1.0 · 2턴 적의 피해 −30%', 'w_knife', { when: (c, x) => inReach(x, c, 1.8).length > 0, ai: (c, x) => V(inReach(x, c, 1.8).length ? 1 : 0, 1, 0.5 * Math.min(1, G.SkillAI.threat(c, x))), run(c, x) { const o = inReach(x, c, 1.8)[0], r = hitK(x, c, o, 1); if (r.hit && live(o)) buff(o, 'disarm', 2, { outK: 0.7 }); } });
  A('ln_duel', '결투 선언', 10, '4턴 · 한 적과 서로 피해 +50%', 'w_knife', { when: (c, x) => inReach(x, c, 1.8).some(o => o.boss || o.hp > c.max), ai: () => 1.6, run(c, x) { const o = inReach(x, c, 1.8).sort((a, b) => b.hp - a.hp)[0]; buff(c, 'duel', 4, { duelT: o }); buff(o, 'duel', 4, { duelT: c }); say(x, c, '결투!', '#ff8a6a'); } });
  A('ln_knives', '단검 투척', 2, '6칸 · 피해 ×0.8 두 번', 'w_knife', { when: (c, x) => inReach(x, c, 6).length > 0, ai: (c, x) => V(inReach(x, c, 6).length ? 2 : 0, 0.8), run(c, x) { const o = inReach(x, c, 6)[0]; for (let i = 0; i < 2; i++) hitK(x, c, o, 0.8, { once: true }); } });
  A('ln_smoke', '연막', 6, '2칸 범위 · 2턴 · 안의 동료를 노리는 원거리 명중 −5', 'c_invis', { when: (c, x) => x.seen.some(o => live(o) && G.Foe.ranged?.(o)), ai: () => 1.2, run(c, x) { ring(x, c, 2, '#b8b8b8'); for (const p of x.rt.party.filter(p => !p.dead && dist(p, c) <= 2)) buff(p, 'smoke', 2, { hitDis: 1 }); } });
  A('ln_bladestorm', '칼날 폭풍', 8, '사거리 안 모두 · 피해 ×1.2', 'w_knife', { when: (c, x) => inReach(x, c, 6).length > 0, ai: (c, x) => V(inReach(x, c, 6).length, 1.2), run(c, x) { for (const q of inReach(x, c, 6)) hitK(x, c, q, 1.2, { once: true, mul: DN.attacks(c) }); } });
  // 몽크
  A('ln_tempest', '폭풍 연타', 5, '피해 ×0.6 다섯 번', 'b_monk', { when: (c, x) => inReach(x, c, 1.8).length > 0, ai: (c, x) => V(inReach(x, c, 1.8).length ? 5 : 0, 0.6), run(c, x) { for (let i = 0; i < 5; i++) { const o = inReach(x, c, 1.8)[0]; if (!o) break; hitK(x, c, o, 0.6); } } });
  A('ln_nerve', '급소 찌르기', 4, '피해 ×1.0 · 2턴 적의 피해 −30%', 'b_monk', { when: (c, x) => inReach(x, c, 1.8).length > 0, ai: (c, x) => V(inReach(x, c, 1.8).length ? 1 : 0, 1, 0.5 * Math.min(1, G.SkillAI.threat(c, x))), run(c, x) { const o = inReach(x, c, 1.8)[0], r = hitK(x, c, o, 1); if (r.hit && live(o)) buff(o, 'nerve', 2, { outK: 0.7 }); } });
  P('ln_pressure', '점혈', '기절 · 넘어진 적에게 피해 +50%', 'b_monk');
  A('ln_quakefield', '진동장', 10, '3칸 범위 · 기절 1턴', 'b_monk', { when: (c, x) => around(x, c, 3).length > 1, ai: (c, x) => around(x, c, 3).length * 0.8, run(c, x) { ring(x, c, 3, '#ffe08a'); for (const q of around(x, c, 3)) cond(x, c, q, 'con', 'stunned', 1); } });
  P('ln_counter', '되받아치기', '근접 공격이 빗나가면 ×1.0 반격 (라운드 1회)', 'b_monk');
  // 레인저
  A('ln_snipe', '저격', 3, '사거리 +3 · 피해 ×2.0', 'w_bow', { when: (c, x) => inReach(x, c, reach(c) + 3).length > 0, ai: (c, x) => V(inReach(x, c, reach(c) + 3).length ? 1 : 0, 2), run(c, x) { const L0 = inReach(x, c, reach(c) + 3), o = L0.sort((a, b) => b.hp - a.hp)[0]; G.fx(x.rt, { k: 'proj', x: c.x, y: c.y, x2: o.x, y2: o.y, key: 'fx_arrow', t: 0.2 }); hitK(x, c, o, 2); } });
  A('ln_execute', '일격필살', 10, '피해 ×4.0 · 체력 30% 아래면 처치 (우두머리 제외)', 'w_bow', { when: (c, x) => inReach(x, c, reach(c) + 3).length > 0, ai: (c, x) => V(1, 4, inReach(x, c, reach(c) + 3).some(o => !o.boss && o.hp < o.max * 0.3) ? 2 : 0), run(c, x) { const L0 = inReach(x, c, reach(c) + 3), o = L0.find(o => !o.boss && o.hp < o.max * 0.3) || L0.sort((a, b) => b.hp - a.hp)[0], r = hitK(x, c, o, 4); if (r.hit && live(o) && !o.boss && o.hp < o.max * 0.3) { F().hurt(x.f, x.rt, o, o.hp + 1, 'crit', c); say(x, o, '필살!', '#ff5a3a'); } } });
  A('ln_rapid', '속사', 2, '피해 ×0.6 세 번', 'w_bow', { when: (c, x) => inReach(x, c).length > 0, ai: (c, x) => V(inReach(x, c).length ? 3 : 0, 0.6), run(c, x) { for (let i = 0; i < 3; i++) { const o = inReach(x, c)[0]; if (!o) break; hitK(x, c, o, 0.6); } } });
  A('ln_rain', '화살비', 5, '대상 주위 2칸 범위 · 피해 ×1.0', 'w_bow', { when: (c, x) => inReach(x, c).length > 0, ai: (c, x) => { const o = G.SkillAI.best({ seen: inReach(x, c) }, 2); return V(o.length, 1); }, run(c, x) { const L0 = G.SkillAI.best({ seen: inReach(x, c) }, 2), o = L0[0] || inReach(x, c)[0]; ring(x, o, 2, '#e8d8a8'); for (const q of around(x, o, 2)) hitK(x, c, q, 1); } });
  A('ln_arrowstorm', '화살 폭풍', 8, '사거리 안 모두 · 피해 ×0.8 두 번', 'w_bow', { when: (c, x) => inReach(x, c).length > 0, ai: (c, x) => V(inReach(x, c).length * 2, 0.8), run(c, x) { for (let i = 0; i < 2; i++) for (const q of inReach(x, c)) hitK(x, c, q, 0.8); } });
  A('ln_trap', '덫 놓기', 4, '가장 가까운 적 · 피해 2~12 · 속박 1턴', 'q_herb', { when: (c, x) => x.seen.some(live), ai: () => 1.3, run(c, x) { const o = x.seen.filter(live).sort((a, b) => dist(a, c) - dist(b, c))[0]; F().hurt(x.f, x.rt, o, DN.dice(2, 6) * H().G0(x, c), 'hit', c); cond(x, c, o, 'str', 'restrained', 1); say(x, o, '덫!', '#c89a5a'); } });
  A('ln_ground', '사냥터', 10, '4턴 · 4칸 범위의 적 느려짐 · 내 명중 +5', 'q_herb', { when: (c, x) => around(x, c, 4).length > 1, ai: (c, x) => around(x, c, 4).length * 0.6, run(c, x) { ring(x, c, 4, '#9fe79f'); buff(c, 'ground', 4, { hit: 5 }); for (const q of around(x, c, 4)) buff(q, 'ground', 4, { moveK: -0.5 }); } });
  P('ln_beast', '야수 동료', '전투가 시작되면 늑대 하나가 함께 싸움', 'm_wolf');
  P('ln_pack', '무리 전술', '야수가 붙은 적 · 추가 피해 1~6', 'm_wolf');
  A('ln_pounce', '덮치기', 4, '피해 ×1.5 · 넘어뜨림', 'm_wolf', { when: (c, x) => inReach(x, c).length > 0, ai: (c, x) => V(inReach(x, c).length ? 1 : 0, 1.5, 0.5), run(c, x) { const o = inReach(x, c)[0], r = hitK(x, c, o, 1.5); if (r.hit) cond(x, c, o, 'str', 'prone', 1); } });
  A('ln_packking', '무리의 왕', 10, '4턴 · 늑대 둘 더', 'm_wolf', { when: (c, x) => x.seen.some(live), ai: (c, x) => 2 * Math.min(1, G.SkillAI.threat(c, x)) + 0.5, run(c, x) { for (let i = 0; i < 2; i++) wolf(x.f, x.rt, c, 4); } });
  // 팔라딘
  A('ln_judgment', '심판의 일격', 10, '피해 ×3.0 · 추가 피해 6~48', 'u_god', { when: (c, x) => inReach(x, c, 1.8).length > 0, ai: (c, x) => V(inReach(x, c, 1.8).length ? 1 : 0, 3, 1.5), run(c, x) { const o = inReach(x, c, 1.8).sort((a, b) => b.hp - a.hp)[0], r = hitK(x, c, o, 3); if (r.hit && live(o)) F().hurt(x.f, x.rt, o, DN.dice(6, 8) * H().G0(x, c), 'smite', c); } });

  // 늑대 (야수 동료 · 무리의 왕): SRD 늑대
  function wolf(f, rt, c, rounds) { const B = G.SRD_MON?.wolf; if (!B || !G.Sum) return null; const k = Math.max(1, (c.merc?.lv || 1) / 3); return G.Sum.spawn(f, rt, { ...B, hp: Math.round(B.hp * k) }, { by: c, rounds, n: '늑대', src: 'ln_beast' }); }

  // 등록: 이름 · 설명 · 아이콘 (G.D.MSKILLS) + 몸 (G.Skill.SK). 계열 스킬은 칸 차례가 정하니 직업 레벨은 1
  for (const s of L) { D.MSKILLS[s.id] = { n: s.n, t: s.t, d: s.d, lv: 1, ...(s.p ? { passive: true } : {}), line: true }; if (!s.p) SK[s.id] = { ...s.body, cd: s.cd }; }

  // 이펙트: 비슷한 기술의 것을 빌려 쓴다 (이펙트 표 js/rules/skill_fx.js는 건드리지 않는다)
  { const T = G.SkillFx?.TABLE, LIKE = { w_bow: 'sr_ensnare', m_wolf: 'sr_cleave', b_monk: 'sr_stun', q_herb: 'sr_entangle', b_rage: 'sr_intim', c_invis: 'sr_cunning', u_god: 'sr_smite', d_shield: 'sr_topple', a_escape: 'sr_cleave' }; if (T) for (const s of L) if (!s.p && !T[s.id]) T[s.id] = T[LIKE[s.t] || 'sr_cleave'] || T.sr_cleave; }
  // ── 패시브 · 상태가 엔진에 거는 것 ──
  const turnOf = rt => rt.turn, myTurn = (rt, e) => rt.turn?.cur === e;
  { const hurt0 = F().hurt; F().hurt = function (f, rt, o, d, src, from) {
      if (from && d > 0 && (src === 'hit' || src === 'crit')) {
        if (has(from, 'ln_assassin') && rt.turn && !rt.turn.order.slice(0, rt.turn.i + 1).some(q => q.e === o)) d *= 2; // 아직 차례가 안 온 적
        if (has(from, 'ln_pressure') && downed(o)) d *= 1.5;
        if (from.bf?.vanish?.ambushK && from.bf.vanish.until > now()) { d *= from.bf.vanish.ambushK; from.bf.vanish.until = 0; } // 은신 뒤 첫 공격
        if (from.bf?.duel?.until > now() && from.bf.duel.duelT === o) d *= 1.5;
        const T = rt.turn?.round ?? -1, x0 = { f, rt }, G0 = () => H().G0(x0, from);
        if (has(from, 'ln_flank') && from._flankR !== T && rt.party.some(p => p !== from && !p.dead && dist(p, o) <= 1.6)) { from._flankR = T; d += DN.dice(2, 6) * G0(); }
        if (has(from, 'ln_pack') && (rt.sums || []).some(s => s.hp > 0 && s.by === from && dist(s, o) <= 1.6)) d += DN.dice(1, 6) * G0();
        if (from.bf?.poison?.until > now()) d += DN.dice(2, 6) * G0();
      }
      if (from && o?.merc == null && from.bf) { /* 적의 피해 −30% (무장 해제 · 급소 찌르기)는 hurtMember 쪽 */ }
      const was = live(o), out = hurt0.call(this, f, rt, o, d, src, from);
      if (was && !live(o) && from?.merc && rt.turn) {
        if (from.bf?.feast?.until > now()) for (const k in from.merc.cdK || {}) from.merc.cdK[k] -= 2; // 피의 축제: 쿨타임 −2 (원정 시계 기록을 앞당긴다)
        if (has(from, 'ln_chain') && from._chainR !== rt.turn.round) { from._chainR = rt.turn.round; const x = { f, rt, seen: rt.mons.filter(live), c: from }, q = inReach(x, from)[0]; if (q) { G.fx(rt, { k: 'text', x: from.x, y: from.y - 1.2, s: '연쇄!', col: '#ff8a6a', t: 0.9, sz: 0.9, pop: true }); H().weaponAtk(x, from, q); } }
      }
      return out; }; }
  { const hm0 = F().hurtMember; F().hurtMember = function (f, rt, p, dmg, mo) {
      if (mo && dmg > 0) {
        if (mo.bf?.disarm?.until > now() || mo.bf?.nerve?.until > now()) dmg *= 0.7;
        if (mo.bf?.duel?.until > now() && mo.bf.duel.duelT === p) dmg *= 1.5;
        const melee = dist(mo, p) <= 1.9, T = rt.turn?.round ?? -1;
        if (melee) { const cov = rt.party.find(q => q !== p && !q.dead && q.hp > 0 && has(q, 'ln_cover') && q._coverR !== T && dist(q, p) <= 1.6); if (cov) { cov._coverR = T; G.fx(rt, { k: 'text', x: cov.x, y: cov.y - 1.2, s: '가로막기', col: '#9fd8ff', t: 0.9, sz: 0.85, pop: true }); p = cov; } }
        if (melee && has(p, 'ln_parry') && p._parryR !== T) { p._parryR = T; dmg *= 0.7; }
        if (p.bf?.hide?.until > now()) dmg *= p.bf.hide.dmgK;
      }
      return hm0.call(this, f, rt, p, dmg, mo); }; }
  // 도발 · 철벽: 곁(taunt칸)의 적은 그 사람을 친다
  { const tg0 = G.Foe.target; G.Foe.target = function (rt, e) { const t = rt.party.find(p => !p.dead && p.hp > 0 && p.bf?.taunt?.until > now() && dist(p, e) <= (p.bf.taunt.taunt || 1.8) + 0.4); return t || tg0.apply(this, arguments); }; }
  // 받아치기 · 되받아치기: 적의 근접 공격이 빗나가면 반격 (라운드 1회)
  { const at0 = DN.attack; DN.attack = function (att, tg) { const r = at0.apply(this, arguments);
      try { if (r && !r.hit && att?.kind === 'mon' && tg?.merc && dist(att, tg) <= 1.9) { const k = has(tg, 'ln_counter') ? 1 : has(tg, 'ln_riposte') ? 0.7 : 0, rt = G.RT?.fantasy, T = rt?.turn?.round ?? -1; if (k && rt && tg._ripR !== T && live(att)) { tg._ripR = T; const x = { f: G.S.w.fantasy, rt, seen: [att], c: tg }; G.fx(rt, { k: 'text', x: tg.x, y: tg.y - 1.2, s: '반격', col: '#ffe08a', t: 0.8, sz: 0.85, pop: true }); hitK(x, tg, att, k, { sure: true }); } } } catch (e) { /* 반격 실패는 무시 */ }
      return r; }; }
  // 야수 동료: 전투가 시작될 때 (첫 라운드 그 사람 차례에) 늑대 하나
  { const tick0 = G.Skill.tick; G.Skill.tick = function (f, rt, a) { if (a?.merc && rt?.turn && has(a, 'ln_beast') && a._beastT !== rt.turn) { a._beastT = rt.turn; wolf(f, rt, a, 100); } return tick0.apply(this, arguments); }; }

  // ── 계열 빌드 (SKILL_LINES.md): core = 여섯 칸 성급 차례 ──
  const LINE_LV = [1, 1, 5, 9, 13, 17];
  const B = (id, cls, n, core, opts) => ({ id, cls, n, w: 4, core, sug: [], line: true, ...(opts ? { opts } : {}) });
  const LINES = [
    B('fighter', 'dragoon', '대형 무기', ['sr_cleave', 'sr_second', 'sr_surge', 'sr_impcrit', 'ln_carve', 'ln_gale'], { fs: ['fs_gwf'] }),
    B('fighter_shield', 'dragoon', '방패', ['ln_bash', 'sr_second', 'ln_parry', 'ln_cover', 'sr_indom', 'ln_bulwark'], { fs: ['fs_defense'] }),
    B('fighter_twin', 'dragoon', '쌍수', ['wm_nick', 'wm_vex', 'sr_sap', 'sr_surge', 'ln_flank', 'ln_dance'], { fs: ['fs_twf'] }),
    B('fighter_xbow', 'dragoon', '석궁', ['ln_aim', 'wm_slow', 'sr_surge', 'ln_pierce', 'ft_studied', 'ln_volley'], { fs: ['fs_archery'] }),
    B('barbarian', 'barbarian', '광란', ['sr_rage', 'ln_chain', 'sr_cleave', 'sr_reckless', 'ln_crush', 'ln_feast']),
    B('barbarian_charge', 'barbarian', '돌격', ['ln_charge', 'sr_topple', 'sr_intim', 'ln_stomp', 'sr_fastmove', 'ln_quake']),
    B('barbarian_wall', 'barbarian', '버팀', ['sr_rage', 'ln_taunt', 'sr_relent', 'sr_retal', 'ft_danger', 'ln_hide']),
    B('rogue', 'rogue', '암살', ['ln_assassin', 'sr_cunning', 'ln_poison', 'sr_cstrike', 'ln_vanish', 'ln_ambush']),
    B('rogue_duel', 'rogue', '결투', ['ln_riposte', 'wm_vex', 'sr_uncanny', 'ln_disarm', 'sr_elusive', 'ln_duel']),
    B('rogue_throw', 'rogue', '투척', ['ln_knives', 'sr_steady', 'wm_slow', 'ln_smoke', 'ft_evasion_r', 'ln_bladestorm']),
    B('monk', 'monk', '연타', ['sr_flurry', 'sr_wind', 'sr_ohtech', 'ft_empowered', 'ln_tempest', 'sr_quiver']),
    B('monk_stun', 'monk', '기절', ['sr_stun', 'sr_push', 'ln_nerve', 'sr_topple', 'ln_pressure', 'ln_quakefield']),
    B('monk_flow', 'monk', '흘리기', ['sr_patient', 'sr_deflect', 'ft_metabolism', 'ln_counter', 'ft_denergy', 'ft_sdefense']),
    B('ranger', 'archer', '저격', ['sr_hmark', 'ln_snipe', 'sr_colossus', 'ft_hlore', 'sr_precise', 'ln_execute'], { fs: ['fs_archery'] }),
    B('ranger_rapid', 'archer', '속사', ['ln_rapid', 'wm_slow', 'wm_vex', 'ln_rain', 'sr_tireless', 'ln_arrowstorm'], { fs: ['fs_archery'] }),
    B('ranger_trap', 'archer', '덫꾼', ['sr_ensnare', 'ln_trap', 'sr_entangle', 'sr_spike', 'ft_escape', 'ln_ground'], { fs: ['fs_archery'] }),
    B('ranger_beast', 'archer', '야수', ['ln_beast', 'sr_hmark', 'ln_pack', 'ln_pounce', 'sp_barkskin', 'ln_packking'], { fs: ['fs_archery'] }),
    B('paladin', 'paladin', '강타', ['sr_smite', 'sr_lay', 'sr_sacred', 'sr_searing', 'sr_radiant', 'ln_judgment'], { fs: ['fs_gwf'] }),
    B('paladin_shield', 'paladin', '수호', ['sr_sof', 'sr_lay', 'sr_aura', 'sr_bless', 'sp_death_ward', 'sr_nimbus'], { fs: ['fs_defense'] }),
    B('paladin_judge', 'paladin', '심판', ['sr_smite', 'sp_command', 'wm_vex', 'ft_abjure', 'sp_banishment', 'sp_dispel_evil_and_good'], { fs: ['fs_gwf'] }),
  ];
  G.Lines = { LIST: LINES, LINE_LV, SKILLS: L.map(s => s.id), hitK, wolf };
})();
