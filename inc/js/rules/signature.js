'use strict';
// 몬스터의 시그니처 기술 (2026-11-25, 사용자: 「몬스터별 시그니처 기술에만 예고를 넣고 일반 평타는 예고를 넣지 마」). 실시간에서만 — 턴제는 SRD 그대로
//   예고 · 취소 · 발동은 G.MonAct (teleOf · teleTick). 여기는 누가 무엇을 언제 쓰는가
//   act  : 능력치표의 행동을 그대로 (그 행동이 예고를 탄다). own: 제 쿨타임으로 쓴다 (아니면 원래 AI가 고른다)
//   kind : 새로 만든 행동 — slam 앞쪽 범위 · sweep 둘레 · dive 먼 자리로 뛰어 덮치기 · charge 직선 돌진 · one 곁의 한 명
//   k    : 피해 = 그 몬스터의 한 차례 공격(연속 공격 전부)의 배. 준비로 두 차례를 쓰므로 1.2쯤이 평타와 비슷하다 (피하면 0) · 내성 성공 절반
G.Sig = (() => {
  const CD = 4, CD_BOSS = 3, WAIT = 1, MAX = 2; // 쓰고 나서 쉬는 라운드 (우두머리) · 싸움 첫머리에 안 쓰는 라운드 · 한 번에 뜨는 예고
  const T = {
    'worg': { kind: 'charge', n: '돌진', k: 1.2, save: 'str', ft: 30, cond: ['prone'], first: true },
    'bugbear-warrior': { kind: 'one', n: '붙잡기', k: 0.8, save: 'str', cond: ['grappled'] },
    'bugbear-stalker': { kind: 'one', n: '붙잡기', k: 0.8, save: 'str', cond: ['grappled'] },
    'rust-monster': { kind: 'one', n: '더듬이', k: 0, save: 'dex', fx: 'nature/acid-splash', act: 'Antennae', own: true, acMinus: 1 },
    'darkmantle': { kind: 'one', n: '머리 덮치기', k: 1, save: 'str', cond: ['blinded'] },
    'ogre': { kind: 'slam', n: '내려찍기', k: 1.2, save: 'dex', ft: 10, cond: ['prone'] },
    'gargoyle': { kind: 'dive', n: '급강하', k: 1.1, save: 'dex', ft: 5, first: true },
    'ettin': { kind: 'sweep', n: '휩쓸기', k: 1.1, save: 'dex', ft: 5 },
    'ghoul': { kind: 'one', n: '마비 할퀴기', k: 0.8, save: 'con', cond: ['paralyzed'], fx: 'melee/claw-swipe' },
    'ghast': { kind: 'sweep', n: '악취', k: 0.5, save: 'con', ft: 10, cond: ['poisoned'], fx: 'nature/poison-cloud', t: 'poison' },
    'ogre-zombie': { kind: 'slam', n: '내려찍기', k: 1.2, save: 'dex', ft: 10 },
    'mummy': { act: 'Dreadful Glare', own: true, free: true },
    'wight': { act: 'Life Drain', own: true, fx: 'shadow/soul-drain' },
    'priest': { act: 'Spirit Guardians' },
    'cultist-fanatic': { act: 'Hold Person' },
    'red-dragon-wyrmling': { act: 'Fire Breath' }, 'young-red-dragon': { act: 'Fire Breath' }, 'adult-red-dragon': { act: 'Fire Breath' },
    'troll': { kind: 'charge', n: '돌진', k: 1, save: 'str', ft: 30, move: 10, first: true },
  };
  const FX = { slam: 'impacts/ground-slam', sweep: 'melee/spin-slash', dive: 'impacts/ground-slam', charge: 'impacts/blunt-hit', one: 'impacts/blunt-hit' };
  const of = e => T[e.stat?.id] || null, live = rt => !!((G.MonAct.TELE || 0) > 0 && G.Turn.rt && rt.turn?.lane), full = rt => (rt.tele || []).length >= MAX;
  const cd = e => (e.boss ? CD_BOSS : CD), rest = (rt, e) => { e._sig = (rt.turn?.round || 1) + cd(e); };
  // 이 행동(MonAct의 한 수)이 그 몬스터의 시그니처인가
  const is = (e, b) => { const q = of(e); return !!q && (q.kind && !q.act ? false : q.act === (b.spell ? G.SRD_SP[b.spell.id]?.en : b.a.name)); };
  const foes = rt => rt.party.filter(p => !p.dead && !p.dying).concat(G.Sum ? G.Sum.alive(rt) : []);
  // 피해 주사위: 그 몬스터가 한 차례에 하는 근접 공격 전부의 k배
  function dmgOf(e, q) { if (!q.k) return []; const L = e.stat.melee || [], a = L[0]; if (!a) return []; const m = L.length * q.k, out = [{ n: Math.max(1, Math.round(a.n * m)), d: a.d, b: Math.round(a.b * m), t: q.t || a.t }];
    if (a.ex && !q.t) out.push({ n: Math.max(1, Math.round(a.ex.n * m)), d: a.ex.d, b: Math.round((a.ex.b || 0) * m), t: a.ex.t }); return out; }
  const AB = { one: 'str', slam: 'str', sweep: 'str', dive: 'str', charge: 'str' };
  function make(e, q) { const s = e.stat, raw = q.act && (s.acts || []).find(a => a.name === q.act); if (raw && raw.kind === 'save') return raw; // 능력치표의 내성 행동 그대로
    const dc = 8 + (s.pb || 2) + Math.floor(((s.abil?.[q.save === 'con' ? 'con' : AB[q.kind]] ?? 10) - 10) / 2), big = G.Dnd.cells(e) > 1 ? 5 : 0;
    const area = { slam: ['cone', q.ft], sweep: ['emanation', q.ft], dive: ['sphere', q.ft], charge: ['line', q.ft, 5] }[q.kind] || null;
    return { name: q.n, kind: 'save', save: q.save, dc, dmg: dmgOf(e, q), half: true, cond: q.cond || [], grab: q.cond?.includes('grappled') ? dc : null, until: 'next', area, one: area ? 0 : 5 + big, move: q.move || 0, text: '' }; }
  // 한 명을 노리는 것: 닿고 보이는 사람 가운데 아직 그 상태가 아닌 사람
  function pick(rt, e, a) { const L = foes(rt).filter(o => G.Dnd.gap(e, o) <= (a.one || 5) / 5 + 0.6 && G.Fantasy.sees(rt.map, e, o) && !(a.cond || []).some(c => G.Dnd.has(o, c)) && !(a.cond?.includes('grappled') && o.grabBy));
    return L.length ? L[Math.floor(Math.random() * L.length)] : null; }
  const far = (e, o) => G.Dnd.gap(e, o) >= 2;
  // 그 차례에 시그니처를 시작하면 true (G.MonAct.act — 실시간만)
  function turn(f, rt, e) {
    const q = of(e); if (!q || !(q.kind || q.own) || !live(rt)) return false;
    const rd = rt.turn.round || 1; if (e._sig == null || e._sigOf !== rt.turn.main) { e._sig = rd + (q.first ? 0 : WAIT + Math.floor(Math.random() * 2)); e._sigOf = rt.turn.main; }
    if (rd < e._sig || full(rt) || (rt.tele || []).some(x => x.e === e)) return false;
    if ((q.kind === 'charge' || q.kind === 'dive') && G.Dnd.held(e)) return false;
    const a = make(e, q); let p = null;
    if (a.area) { p = (q.kind === 'charge' || q.kind === 'dive' ? G.MonAct.plan(rt, e, a, 6, o => far(e, o)) : null) || G.MonAct.plan(rt, e, a, 6, () => true); if (!p) return false; // 돌진 · 급강하는 떨어진 사람 먼저
    } else { const t = pick(rt, e, a); if (!t) return false; p = { x: { f, rt, c: e, seen: foes(rt), reach: 24 }, list: [t], n: 1, score: 1 }; }
    const b = { a, q: p, sig: q };
    if (!G.MonAct.teleOf(rt, e, b, () => fire(f, rt, e, b))) return false;
    rest(rt, e); return !q.free;
  }
  const fx = (rt, e, id, pts, mode = 'to') => { if (G.quiet || !rt.fx || !id) return; G.fx(rt, { k: 'cast', mode, id, x: e.x, y: e.y, who: e, pts, t: 0.2 }); };
  function fire(f, rt, e, b) {
    const q = b.sig, a = b.a, p = b.q, id = q.fx || FX[q.kind]; p.list = p.list.filter(o => o.kind !== 'mon'); // 제 편은 안 다친다
    if (q.kind === 'charge') dash(rt, e, p);
    if (q.kind === 'dive' && p.t) land(rt, e, p.t);
    if (q.kind === 'slam' || q.kind === 'sweep') { G.J.lunge?.(0, e, p.list[0] || p.t); fx(rt, e, id, q.kind === 'sweep' ? [[e.x, e.y]] : [[p.t.x, p.t.y]]); }
    else if (q.kind === 'dive') fx(rt, e, id, [[p.t.x, p.t.y]]);
    else fx(rt, e, id, p.list.map(o => [o.x, o.y]));
    if (a.area && p.list.length) G.J.shake(0, 4);
    if (p.list.length) G.MonAct.doSave(rt, e, a, { ...p, t: e }, a.name);
    if (q.acMinus) for (const o of p.list) if (o.merc && G.Dnd.ac(o) > 10 && !G.Dnd.save(o, 'dex', a.dc)) { o.acMinus = (o.acMinus || 0) + q.acMinus; G.Dnd.flip(o, '갑옷 부식', '#b8d67a'); }
  }
  const taken = (rt, e, x, y) => rt.party.concat(rt.mons, G.Sum ? G.Sum.alive(rt) : []).some(o => o !== e && !o.dead && (o.kind !== 'mon' || o.hp > 0) && Math.round(o.x) === x && Math.round(o.y) === y);
  // 돌진: 붉은 줄의 가장 먼 빈칸까지 · 급강하: 겨눈 자리에 가장 가까운 빈칸
  function dash(rt, e, p) { if (G.Dnd.held(e)) return; const L = (p.cells || []).filter(([x, y]) => G.Grid.pass(rt.map, x, y) && !taken(rt, e, x, y)).sort((u, v) => Math.hypot(v[0] - e.x, v[1] - e.y) - Math.hypot(u[0] - e.x, u[1] - e.y)); if (L.length) { e.x = L[0][0]; e.y = L[0][1]; } }
  function land(rt, e, t) { let best = null, bd = 9; for (let y = Math.round(t.y) - 2; y <= t.y + 2; y++) for (let x = Math.round(t.x) - 2; x <= t.x + 2; x++) { if (!G.Grid.pass(rt.map, x, y) || taken(rt, e, x, y) || !G.Fantasy.sees(rt.map, t, { x, y })) continue; const d = Math.hypot(x - t.x, y - t.y); if (d < bd) { bd = d; best = [x, y]; } } if (best) { e.x = best[0]; e.y = best[1]; } }
  // 준비 중에 기절 · 행동 불능: 처음부터 다시 충전한다
  function cut(rt, x) { const e = x.e; if (x.b.sig) rest(rt, e); else if (x.b.a.recharge) G.MonAct.use(e).rech[x.b.a.name] = false; }
  return { T, of, is, live, full, turn, cut, CD };
})();
