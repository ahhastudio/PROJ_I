'use strict';
// 원정 규칙 (js/game/dive.js): node test/dive_rules.js — 트리를 다 살 수 있나 · 값이 오르나 · 저장을 읽고 쓰나 · 더한 구역의 적 이름이 엔진에 있나 · 자동 정책이 고르는 것
const vm = require('vm'), L = require('./_load.js');
const ctx = { console, Math, JSON, Date, btoa, atob }; vm.createContext(ctx); L.load(ctx); L.load(ctx, ['run/core', 'run/data', 'run/rooms', 'run/combat', 'run/gen', 'run/rules']);
const G = ctx.G, D = G.Dive, RUN = ctx.RUN; G.quiet = true; G.Reward.on = true;
// 아래 검사 대부분은 파이터 · 클레릭 둘이 나가는 저장을 가정한다 (직업 둘이 열렸고 1층을 깼다). 새 저장(무작위 앞줄 + 뒷줄 둘)은 fresh1로 따로 본다
const fresh1 = D.fresh; D.fresh = () => Object.assign(fresh1(), { cls0: 2, deep: 1, party: ['dragoon'], order: null });
let ok = 0, bad = 0; const t = (name, v, extra = '') => { if (v) ok++; else { bad++; console.log('  실패:', name, extra); } };

// 차례로 몰려오는 적
{ const cnt = w => w.list.map(L => L.reduce((a, u) => a + u[1], 0)), g = { units: [['고블린', 2], ['홉고블린', 1]] }, w = D.waves(g, 'fight', 4, 1), b = D.waves({ units: [['홉고블린', 1]] }, 'boss', 4, 1), last = b.list[b.list.length - 1];
  t('무리 나누기: 1 · 2 · 3 차례로 늘고 합이 같다', [1, 2, 3, 4, 5, 6, 7, 9, 12].every(n => { const L = D.waveSizes(n, 4); return L.reduce((a, v) => a + v, 0) === n && L.every((v, i) => !i || v >= L[i - 1]); }) && D.waveSizes(6, 4).join() === '1,2,3');
  t('보통 방: 셋 → 여섯, 값은 나눠서', cnt(w).join() === '1,2,3' && w.k > 0.5 && w.k < 1, JSON.stringify(w));
  t('우두머리는 마지막 무리의 맨 앞 · 혼자면 졸개를 더하지 않는다', last[0][0] === '홉고블린' && b.list.length > 1 && D.waves({ units: [['홉고블린', 1]] }, 'boss', 1, 1).list.length === 1, JSON.stringify(b)); }
t('값은 단계마다 오른다', D.TREE.every(x => x.cost.every((c, i) => i === 0 || c > x.cost[i - 1])), JSON.stringify(D.TREE.map(x => x.cost)));
{ const s = D.fresh(); s.gold = D.total(); let n = 0;
  for (let k = 0; k < 200; k++) { const can = D.TREE.filter(x => D.cost(s, x.id) != null); if (!can.length) break; if (D.buy(s, can[0].id)) n++; }
  t('트리를 다 살 수 있다 (합계 금화로 딱)', D.complete(s) && s.gold === 0, `산 것 ${n} · 남은 금화 ${s.gold}`);
  t('다 산 줄은 더 못 산다', D.cost(s, 'cls') == null && !D.buy(s, 'cls'));
  t('다 열면 직업 12 · 엔진 배속 8 · 계단 회복 없음 · 「파티 자리」 줄은 없다 (자리는 깬 층으로)', !D.TREE.some(x => x.id === 'seat') && D.classes(s).length === 12 && D.camp(s) === 0 && D.speeds(s).join() === '2,4,8');
  t('다 열면 물자: 횃불 3 · 야영 물자 18 (공짜 몫 따로) (물약 · 도둑 도구 · 열림 두루마리는 없앴다)', JSON.stringify(D.kit(s)) === JSON.stringify({ torch: 3, camp: 6 + 4 * 3 }) && !D.TREE.some(x => x.id === 'tools' || x.id === 'knock' || x.id === 'pot')); }
{ const s = fresh1(), FR = ['dragoon', 'barbarian', 'paladin', 'monk']; t('새 저장: 무작위 앞줄 + 뒷줄 둘 · 열린 직업 둘 · 자리 둘 · 빈 명단 · 레벨 줄 없음 · 짐은 횃불 1 · 위험 귀환 끔', s.risk === false && s.bag.torch === 1 && !s.bag.potion && s.gold === 0 && D.team(s).length === 2 && FR.includes(D.team(s)[0]) && !FR.includes(D.team(s)[1]) && D.classes(s).join() === D.team(s).join() && s.order.length === 12 && new Set(s.order).size === 12 && D.seats(s) === 2 && !Object.keys(s.roster).length && !D.TREE.some(x => x.id === 'lv'));
  t('금화가 모자라면 못 산다', !D.buy(s, 'cls') && D.step(s, 'cls') === 0);
  const g = D.finish(s, 0, 37); t('전멸해도 판에서 번 금화는 들어온다', g === 37 && s.gold === 37 && s.runs === 1);
  const g2 = D.finish(s, 2, 10); t('깬 층 보너스 = 1층 + 2층', g2 === 10 + D.bonus(1) + D.bonus(2) && s.deep === 2);
  t('깊을수록 보너스가 많다', [...Array(D.LAST).keys()].every(i => i === 0 || D.bonus(i + 1) > D.bonus(i)));
  t('파티 자리 = 깬 층 + 1, 둘부터 다섯까지 · 옛 저장의 자리 해금(up.seat)은 무시', [0, 1, 2, 3, 4, 5, 9].map(d => D.seats({ ...s, deep: d, up: { seat: 2 } })).join() === '2,2,3,4,5,5,5');
  Object.assign(s, { party: ['dragoon'], order: null }); // 아래는 직업이 CLS 차례로 열리는 저장으로 본다
  s.up.cls = 2; s.deep = 1; D.toggle(s, 'mage'); D.toggle(s, 'cleric');
  t('파티는 자리 수까지 (넘치면 마지막을 바꾼다)', D.team(s).join() === 'dragoon,cleric', D.team(s).join());
  { const shut = D.CLS.find(c => !D.classes(s).includes(c)); D.toggle(s, shut); t('안 열린 직업은 못 고른다', !D.team(s).includes(shut)); }
  const back = D.load(D.dump(s)); t('저장을 쓰고 읽으면 같다', JSON.stringify(back) === JSON.stringify(s));
  t('깨진 저장 · 옛 저장(v1 · v2)은 새 저장으로', D.load('{망가짐').gold === 0 && D.load(null).runs === 0 && D.load('{"v":1,"gold":999}').gold === 0 && D.load('{"v":2,"gold":999,"dex":5}').gold === 0); }
// 출발 층
// 출발 층 (2026-11-27 한 판 = 한 층): 1층 ~ (깬 층 + 1)층 아무 데서나, 기본은 아직 못 깬 가장 얕은 층
{ const s = fresh1(); t('처음엔 1층에서만 · 자리 둘', D.starts(s).join() === '1' && D.startFloor(s) === 1 && D.seats(s) === 2);
  const g1 = D.finish(s, 1, 0, 1, 1); t('1층을 깨면 보너스 · 2층이 열리고 기본은 2층 · 자리는 그대로 둘 (2층을 깨야 셋)', g1 === D.bonus(1) && D.starts(s).join() === '1,2' && D.startFloor(s) === 2 && D.seats(s) === 2);
  const g0 = D.finish(s, 0, 0, 1, 2); t('2층에서 못 깨고 끝나면(깬 층 0) 보너스 없음 · 최고 층 · 기본 출발 층은 그대로', g0 === 0 && s.deep === 1 && D.startFloor(s) === 2);
  D.finish(s, 2, 0, 1, 2); D.finish(s, 3, 0, 1, 3); D.finish(s, 4, 0, 1, 4); t('4층까지 깨면 1~5층이 열리고 기본은 5층 · 자리 다섯', D.starts(s).join() === '1,2,3,4,5' && D.startFloor(s) === 5 && D.seats(s) === 5);
  s.start = 3; t('고른 출발 층이 있으면 그것 (이미 깬 층도)', D.startFloor(s) === 3); const g3 = D.finish(s, 3, 0, 1, 3); t('깬 층을 다시 깨도 그 층 보너스 · 최고 층은 그대로', g3 === D.bonus(3) && s.deep === 4);
  s.start = 9; t('안 열린 층을 골랐으면 기본', D.startFloor(s) === 5);
  s.start = 0; s.deep = 9; const w0 = s.wins; t('9층까지 깼으면 기본은 10층', D.startFloor(s) === 10 && D.starts(s).length === 10); D.finish(s, 10, 0, 1, 10); t('10층을 깨면 완주 · 기본은 그대로 10층 · 자리 다섯', s.wins === w0 + 1 && s.deep === 10 && D.startFloor(s) === 10 && D.starts(s).length === 10 && D.seats(s) === 5); }
// 구역: hook()이 5~10층을 더하고, 적 이름은 엔진에 있다 · 생성기가 그 층을 만든다
{ const z0 = RUN.ZONES.length; D.hook(); t('hook: 구역 셋이 더해진다 (1~10층)', RUN.ZONES.length === z0 + 3 && [...Array(10).keys()].every(i => RUN.zone(i + 1).floors[0] <= i + 1 && RUN.zone(i + 1).floors[1] >= i + 1));
  D.hook(); t('hook은 두 번 불러도 한 번', RUN.ZONES.length === z0 + 3);
  const names = D.ZONES.flatMap(z => [...Object.keys(z.cost), ...z.gate.u.map(u => u[0]), ...z.boss.u.map(u => u[0])]), miss = names.filter(n => !G.D.F.mon[n]);
  t('더한 구역의 적은 모두 엔진에 있다', !miss.length, miss.join(', '));
  t('값표에 없는 무리 이름이 없다', D.ZONES.every(z => [...z.packs, ...z.elites].every(p => p.u.every(n => z.cost[n] != null))));
  t('10층 우두머리는 붉은 성룡', RUN.zone(10).boss.u[0][0] === '붉은 성룡');
  for (const fl of [5, 7, 9, 10]) { const m = RUN.gen.make(fl * 31, fl); t(`${fl}층 생성 · 우두머리 무리`, !!m && m.nodes.some(n => n.type === 'boss' && n.g?.units?.length), fl); } }
// 자동 정책
{ const P = D.POL, SP0 = RUN.SPECS; RUN.SPECS = undefined; const st = RUN.newRun(7, ['fighter', 'cleric'], 3); RUN.SPECS = SP0; /* 설계서 없는 층의 자동 규칙 (1 · 2층은 곁방 규칙 — 아래) */
  const N = st.map.nodes, ex = (type, extra = {}) => { const n = N.find(q => q.type === type); return { to: n.id, e: { kind: 'open', ...extra } }; }; st.items.camp = 30; // 물자가 넉넉할 때의 차례 (모자랄 때는 아래 「물자」 검사)
  t('갈림길: 보물 > 사건 > 전투 > 정예', P.fork(st, [ex('elite'), ex('fight'), ex('event'), ex('treasure', {})]) === 3);
  t('갈림길: 잠긴 보물 방은 열 수단이 없으면 뒤로', P.fork(st, [ex('treasure', { kind: 'locked' }), ex('fight')]) === 1);
  st.party[0].hero = { cls: 'rogue', lv: 1 }; t('갈림길: 자물쇠를 딸 영웅(로그)이 있으면 보물 방', P.fork(st, [ex('fight'), ex('treasure', { kind: 'locked' })]) === 1); delete st.party[0].hero;
  st.party.forEach(m => { m.hp = 3; }); t('갈림길: 다쳤으면 야영 쪽', P.fork(st, [ex('treasure', {}), ex('camp')]) === 1);
  const sc = (kind, choices) => P.scene(st, { kind, choices });
  t('사건: 금화를 내지 않는 것 중 확률이 가장 높은 것', sc('event', [{ n: 'a', p: 0.4 }, { n: 'b', sub: '금화 30', p: 1 }, { n: 'c', p: 0.8 }, { n: 'd', off: () => true, p: 1 }]) === 2);
  t('전투: 기습할 수 있으면 기습', sc('fight', [{ n: '싸운다' }, { n: '기습한다' }]) === 1);
  t('상인: 떠난다', sc('shop', [{ n: '물약 사기' }, { n: '떠난다' }]) === 1);
  t('누가 할까: 보정이 가장 높은 사람', P.who([{ bonus: 1 }, { bonus: 5 }, { bonus: 3 }]) === 1);
  t('잠긴 문: 따기 · 부수기가 안 되면 열림 (스킬) · 없으면 두고 간다', P.paid(st, [{ id: 'x' }, { id: 'knock' }]) === 1 && P.paid(st, [{ id: 'x' }]) === -1); }
// 원정 세계 · 탐사 기록 맞추기 · 처치 금화
{ const s = D.fresh(); s.up = { camp: 1 }; s.gold = 1000; s.party = ['dragoon', 'cleric']; s.bag = { torch: 1, camp: 2 };
  const st = RUN.newRun(3, ['fighter', 'cleric'], 1), map = { w: 10, h: 10, c: new Array(100).fill('.') };
  { G.newState(); const f0 = G.S.w.fantasy; for (const c of ['dragoon', 'cleric']) s.roster[c] = { m: D.member(f0, c, 3), tr: [] }; } // 아래 검사들은 3레벨 둘에서 (새 저장은 1레벨 파이터 혼자 — 따로 본다)
  const { f, r } = D.world(s, map); D.outfit(st, r, s);
  t('원정 세계: 명단의 파이터 · 클레릭 · 3레벨', r.party.length === 2 && r.party.every(p => p.merc.lv === 3) && s.roster.dragoon && s.roster.cleric, r.party.map(p => p.merc?.lv).join());
  t('레벨업 고르기는 남지 않는다', r.party.every(p => !G.Reward.pending(p.merc)));
  t('탐사 체력 = 엔진 체력 · 시작 물자', st.party.every((m, i) => m.max === Math.round(r.party[i].max)) && !st.items.potion && st.items.camp === 2 + D.CAMP_FREE && !st.items.knockScroll && st.items.torch === 1 && s.gold === 1000 - (2 * D.TUNE.SUP.camp + D.TUNE.SUP.torch));
  const m = r.party[0].merc, xp = m.xp, g0 = st.gold, mo = G.Fantasy.spawnMon(r, 1, { n: '오우거', ...G.D.F.mon['오우거'] }, 5, 5, false, { major: true });
  G.Guild.onKill(f, r, mo); t('처치 경험치: SRD 그대로 ÷ PACE(3레벨) (오우거 450 ÷ 둘)', Math.abs(m.xp - xp - 450 / 2 / D.pace(3)) < 1, m.xp - xp);
  t('도감: 데리고 나간 빌드 · 만난 · 잡은 몬스터가 적힌다', Object.keys(s.dex.h).length === 2 && s.dex.m['오우거']?.met === 1 && s.dex.m['오우거']?.kill === 1, JSON.stringify(s.dex));
  t('처치 금화가 판 금화에 (오우거 450 ÷ 20)', st.gold - g0 === D.killGold(mo) && D.killGold(mo) === 23, st.gold - g0);
  G.Guild.onKill(f, r, mo); D.gain(m, G.Guild.needOf(m) * D.pace(3)); t('경험치가 차면 4레벨 · 고르기는 저절로', m.lv === 4 && !G.Reward.pending(m), m.lv);
  // 영웅이 남는다: 판 끝에 명단에 되적고, 다음 판에 같은 사람 · 같은 장비로
  const L = G.Guild.leader(f); let mg = null; for (let i = 0; i < 50 && !mg; i++) { const d = G.Gear.roll(5, 'boss', Math.random, f, r.party); if (d && d.kind !== 'base') mg = G.Gear.take(f, d, 5).t; } mg.on = L.uid; mg.tag = '시험 물건'; const nm = L.name, bd = L.build, wpn = JSON.stringify(G.SRD.eq(L));
  const avg = D.bank(s, f); t('판 끝: 명단에 레벨 · 경험치 · 마법 물건이 적힌다', s.roster.dragoon.m.lv === 4 && s.roster.dragoon.tr.length === 1 && avg > 0, avg);
  const W2 = D.world(s, map), L2 = G.Guild.leader(W2.f);
  t('다음 판: 같은 이름 · 빌드 · 레벨 · 기본 장비 · 마법 물건', L2.name === nm && L2.build === bd && L2.lv === 4 && JSON.stringify(G.SRD.eq(L2)) === wpn && G.Trinket.all(W2.f).some(t => t.tag === '시험 물건' && t.on === L2.uid));
  s.roster.rogue = { m: D.member(f, 'rogue', 3), tr: [] }; s.party = ['dragoon', 'cleric', 'mage']; s.deep = 2; s.up.cls = 2; const W3 = D.world(s, map), st3 = RUN.newRun(4, ['fighter', 'cleric', 'wizard'], 1); D.outfit(st3, W3.r, s); t('새로 들인 영웅은 (최고 − 2)레벨, 최소 1', s.roster.mage.m.lv === Math.max(1, Math.max(...['dragoon', 'cleric', 'rogue'].map(c => s.roster[c].m.lv)) - 2), s.roster.mage.m.lv);
  t('따라잡기 배율: 하나 낮을 때마다 +50%, 상한 +200%', D.catchK(5, 5) === 1 && D.catchK(4, 6) === 2 && D.catchK(1, 12) === 3);
  { const x0 = s.roster.rogue.m.xp || 0, mage = W3.r.party.find(p => p.merc.cls === 'mage').merc, mx = mage.xp || 0, fx = G.Guild.leader(W3.f).xp; const o = G.Fantasy.spawnMon(W3.r, 1, { n: '고블린 전사', ...G.D.F.mon['고블린 전사'] }, 5, 5, false, { major: true }); G.Guild.onKill(W3.f, W3.r, o);
    const Lv = G.Guild.leader(W3.f).lv, top = Math.max(...W3.r.party.map(p => p.merc.lv)); t('낮은 영웅은 더 빨리 (따라잡기 배율 ÷ 그 레벨의 PACE)', Math.abs((mage.xp - mx) - D.catchK(mage.lv, top) / D.catchK(Lv, top) * D.pace(Lv) / D.pace(mage.lv) * (G.Guild.leader(W3.f).xp - fx)) < 0.01, [mage.xp - mx, G.Guild.leader(W3.f).xp - fx]); D.bank(s, W3.f); t('쉬는 영웅도 받는다 (나간 영웅 평균의 25% × 따라잡기)', (s.roster.rogue.m.xp || 0) > x0 || s.roster.rogue.m.lv > 3); } }

// 자리를 비운 동안의 정산 · 도감
{ const s = D.fresh(); t('새 저장: 자동 재출발 끔 · 경로 완주 귀환 · 빈 도감', s.autoOn === false && s.endMode === 'back' && s.risk === false && !Object.keys(s.dex.m).length);
  t('한 판도 안 끝낸 저장은 정산 0', D.settle(s, 1e9).gold === 0 && s.seen === 1e9);
  D.finish(s, 1, 80, 4); s.last = null; D.finish(s, 2, 120, 6); t('분당 금화 = 최근 판 금화 ÷ 분', Math.abs(D.rate(s) - (80 + D.bonus(1) + 120 + D.bonusTo(2)) / 10) < 1e-9, D.rate(s));
  const g0 = s.gold, r = D.settle(s, s.seen + 3 * 3600e3); t('3시간 비우면 분당 금화 × 180분 × 비율', r.gold === Math.round(D.rate(s) * 180 * D.AWAY_K) && s.gold === g0 + r.gold && r.ms === 3 * 3600e3);
  { const s2 = D.fresh(), F = (G.newState(), G.S.w.fantasy); s2.roster.dragoon = { m: D.member(F, 'dragoon', 3), tr: [] }; s2.roster.cleric = { m: D.member(F, 'cleric', 3), tr: [] }; s2.party = ['dragoon', 'cleric']; D.finish(s2, 1, 60, 10, 1, 12000); s2.seen = 1;
    const a = D.settle(s2, 1 + 60 * 60e3); t('정산: 경험치도 같은 비율로 (분당 1200 × 60분 × AWAY_K, 레벨마다 PACE로 나눠) → 마지막 파티 영웅마다 레벨업', a.xp === Math.round(1200 * 60 * D.AWAY_K) && s2.roster.dragoon.m.lv === 4 && s2.roster.cleric.m.lv === 4 && a.ups.length === 2 && !G.Reward.pending(s2.roster.dragoon.m), JSON.stringify(a)); }
  t('1분 미만은 주지 않는다', D.settle(s, s.seen + 50e3).gold === 0);
  t('상한 (AWAY_CAP)', D.settle(s, s.seen + 30 * 3600e3).ms === D.AWAY_CAP);
  const back = D.load(JSON.stringify({ v: 3, gold: 5, up: {} })); t('도감 · 기록 · 명단이 없는 v3 저장도 읽는다 (빈 도감)', back.gold === 5 && !!back.dex.m && !!back.dex.h && Array.isArray(back.rec) && !!back.roster);
  const M = D.dexMons(), H = D.dexHeroes(); t('몬스터 도감: 1~10층 구역의 몬스터 (엔진 이름 · 구역)', M.length >= 30 && M.every(x => G.D.F.mon[x.n] && x.z) && M.some(x => x.n === '붉은 성룡'), M.length);
  t('영웅 도감: 열두 직업의 빌드', H.length >= 12 && D.CLS.every(c => H.some(b => b.cls === c)), H.length);
  t('도감 수: 처음엔 0 / 전체 (몬스터 · 빌드 · 아이템)', D.dexCount(D.fresh()).got === 0 && D.dexCount(D.fresh()).all === M.length + H.length + D.dexItems().length); }
// 아이템 등급
{ const I = D.dexItems(); t('아이템 도감: SRD 마법 물건 (등급 1~4 모두)', I.length > 100 && [1, 2, 3, 4].every(r => I.some(x => x.r === r)) && I.some(x => x.n === '마법 무기 +3'), I.length);
  const cnt = fl => { const c = [0, 0, 0, 0, 0]; let x = 7; const rng = () => (x = (x * 16807) % 2147483647) / 2147483647; for (let i = 0; i < 4000; i++) c[D.pickR(fl, 'fight', rng)]++; return c; };
  const a = cnt(1), b = cnt(10); t('희귀도: 1층은 고급 위주 · 매우 희귀 이상 없음', a[1] > a[2] && !a[3] && !a[4], a.join());
  t('희귀도: 10층은 매우 희귀 · 전설이 실제로 (각 10% 넘게)', b[3] / 4000 > 0.25 && b[4] / 4000 > 0.1, b.join());
  t('정예 · 보물 방은 한 구역 깊은 표', (() => { let x = 3; const rng = () => (x = (x * 16807) % 2147483647) / 2147483647; let n = 0; for (let i = 0; i < 2000; i++) if (D.pickR(7, 'treasure', rng) >= 3) n++; return n / 2000 > 0.35; })());
  const s = D.fresh(), F = (G.newState(), G.S.w.fantasy), r = G.Fantasy.rt(F), ms = [D.member(F, 'dragoon', 5)]; D.LOOT.length = 0;
  const g = D.POL.gear(F, ms, [{ kind: 'art', k: 'it_weapon_3' }, { kind: 'art', k: 'it_weapon_1' }], 9);
  t('주운 것은 LOOT에 (등급 · 낀 사람 · 값) — +3을 끼고, 더 낮은 +1은 그 자리에서 팔지 않는다 (짐으로)', D.LOOT.length === 2 && D.LOOT[0].r === 3 && D.LOOT[0].to === ms[0].name && D.LOOT[1].to === null && D.LOOT[1].gold > 0 && g === 0, JSON.stringify(D.LOOT)); }

{ const F = (G.newState(), G.S.w.fantasy), m = D.member(F, 'cleric', 9), lv = m.lv, ab = JSON.stringify(m.ab), other = G.Builds.LIST.find(b => b.cls === 'cleric' && b.id !== m.build);
  t('빌드 바꾸기: 레벨 · 능력치는 그대로, 빌드와 스킬 칸이 바뀐다', D.rebuild(m, other.id) && m.build === other.id && m.lv === lv && JSON.stringify(m.ab) === ab && G.Builds.view(m).n === other.n && !D.rebuild(m, 'fighter')); }

t('PACE: 높은 레벨일수록 크다 (3→5 · 5→10 · 10→15 · 15→20 구간 평균이 늘어난다)', (() => { const avg = (a, b) => { let x = 0; for (let l = a; l < b; l++) x += D.pace(l) * G.Guild.need(l); return x; }; const t = [[3, 5], [5, 10], [10, 15], [15, 20]].map(([a, b]) => avg(a, b)); return t.every((v, i) => i === 0 || v > t[i - 1]); })());

// 층 지도 고정 · 기억 · 경로
{ const s = D.fresh(), sig = m => JSON.stringify(m.nodes.map(n => [n.type, n.g?.label || '']).concat(m.edges.map(e => [e.a, e.b, e.kind])));
  const a = RUN.newRun(D.floorSeed(s, 3), ['fighter', 'cleric'], 3), b = RUN.newRun(D.floorSeed(s, 3), ['wizard', 'rogue', 'ranger'], 3), V = D.view(s, 3);
  t('같은 층은 파티가 달라도 같은 지도 · 같은 적 무리 (길드 지도 화면도 같다)', sig(a.map) === sig(b.map) && sig(a.map) === sig(V.map));
  t('다른 층 · 다른 저장은 다른 지도', sig(a.map) !== sig(RUN.newRun(D.floorSeed(s, 4), ['fighter'], 4).map) && sig(a.map) !== sig(RUN.newRun(D.floorSeed(D.fresh(), 3), ['fighter'], 3).map));
  t('옛 v3 저장도 씨앗을 새로 받는다 (초기화 없이)', (() => { const o = D.load(JSON.stringify({ v: 3, gold: 7 })); return o.gold === 7 && o.mapSeed > 0 && !!o.maps && !!o.plan; })());
  // 기억: 들어간 방 · 본 방 · 지나간 길 · 길 정체
  const st = RUN.newRun(D.floorSeed(s, 3), ['fighter', 'cleric'], 3), N = st.map.nodes, E = st.map.edges, e0 = E.find(e => e.a === 0 && !N[e.b].side); /* 큰길 쪽 (곁방은 다녀오는 길로 잡힌다) */
  e0.walked = true; e0.seen.trap = true; N[e0.b].visited = true; N[e0.b].info = 3; const hid = E.find(e => e.kind === 'hidden'); if (hid) hid.seen.hidden = true;
  D.remember(s, st); const ex = D.explored(s, 3);
  t('기억: 들어가 본 방 / 전체 방', ex[0] === N.filter(n => n.visited).length && ex[1] === N.length, ex);
  const back = D.load(D.dump(s)), st2 = RUN.newRun(D.floorSeed(back, 3), ['fighter'], 3); D.recall(st2, back);
  t('기억은 저장되고, 다음 판의 같은 층에 길 정체(함정 · 숨은 통로)가 이어진다', st2.map.edges[e0.id].seen.trap && (!hid || st2.map.edges[hid.id].seen.hidden) && JSON.stringify(D.explored(back, 3)) === JSON.stringify(ex));
  D.remember(s, RUN.newRun(D.floorSeed(s, 3), ['fighter'], 3)); t('기억은 줄지 않는다', JSON.stringify(D.explored(s, 3)) === JSON.stringify(ex));
  // 다음 방 자동 (2026-11-26): 안 가 본 방이 먼저 · 다 가 봤으면 안 가 본 방 쪽으로 가는 가장 짧은 길의 첫 방
  { const st3 = RUN.newRun(D.floorSeed(s, 3), ['fighter', 'cleric'], 3); D.recall(st3, s); st3.items = { camp: 9 }; const M3 = st3.map, N3 = M3.nodes; N3.forEach(n => { n.visited = false; n.hostile = false; }); N3[0].visited = true; st3.at = 0;
    const optsAt = id => M3.edges.filter(e => (e.a === id || e.b === id) && e.kind !== 'hidden').map(e => ({ e, ed: e, to: e.a === id ? e.b : e.a }));
    st3.map.edges.forEach(e => { if (e.kind === 'locked') e.opened = true; }); // 문은 열어 두고 (못 넘는 문을 안 고르는 것은 아래에서)
    const o0 = optsAt(0); o0.slice(1).forEach(x => { N3[x.to].visited = true; }); const j0 = D.POL.fork(st3, o0);
    N3.forEach(n => { n.visited = true; }); const far = N3.find(n => n.type === 'boss'); far.visited = false; const j1 = D.POL.fork(st3, o0);
    const dist = from => { const d = new Map([[from, 0]]), q = [from]; while (q.length) { const a = q.shift(); for (const x of optsAt(a)) if (!d.has(x.to)) { d.set(x.to, d.get(a) + 1); q.push(x.to); } } return d; };
    t('다음 방 자동: 안 가 본 방 먼저 · 다 가 봤으면 안 가 본 방 쪽 첫 방', o0[j0].to === o0[0].to && dist(o0[j1].to).get(far.id) === dist(0).get(far.id) - 1, [j0, j1]); } }

// 층 설계서 · 곁방 · 횃불 (2026-11-23)
{ const outs = (m, id) => m.edges.filter(e => e.a === id), ins = (m, id) => m.edges.filter(e => e.b === id);
  const bad1 = [], bad2 = [], used1 = [], used2 = [];
  for (let k = 0; k < 30; k++) for (const fl of [1, 2]) {
    const m = RUN.gen.make(1000 + k * 7919, fl), N = m.nodes, side = N.filter(n => n.side), boss = N.find(n => n.type === 'boss'), err = fl === 1 ? bad1 : bad2, no = w => err.push(`${k}:${w}`);
    if (!m.spec) { no('spec'); continue; }
    if (N.filter(n => n.type === 'start').length !== 1 || !boss || N.filter(n => n.type === 'camp').length !== 1) no('큰길');
    if (!RUN.SMALL && N.some(n => !n.name || !m._lay.room[n.id].tpl || RUN.ROOMS.find(q => q.id === m._lay.room[n.id].tpl).n !== n.name)) no('이름 · 템플릿');
    // 곁방 = 열쇠 부품: 들어가는 길의 관문 · 자물쇠 종류가 부품과 같다
    const used = new Set(side.map(n => n.part)); for (const n of side) { const P = D.PARTS[n.part], e = ins(m, n.id)[0]; if (!P || ins(m, n.id).length !== 1 || e.kind !== P.kind || (P.lock || undefined) !== e.lock || (P.sleep && !n.sleepy)) no(`곁방 관문 ${n.part}`); }
    if (side.length !== D.SPECS[fl].sides.length) no(`곁방 수 ${side.length}`);
    for (const n of side) if (!!D.PARTS[n.part].dark !== !!n.dark) no(`어두운 방 ${n.part}`);
    if (side.some(n => outs(m, n.id).some(e => !(fl === 1 && e.kind === 'hidden' && e.b === boss.id)))) no('곁방은 막다른 방');
    if (fl === 1 && !side.some(n => outs(m, n.id).some(e => e.kind === 'hidden' && e.b === boss.id))) no('숨은 통로 → 왕좌');
    if (!m.edges.some(e => e.kind === 'dark' && !N[e.b].side)) no('큰길의 어두운 굴');
    const fwd = id => outs(m, id).filter(e => !N[e.b].side && e.kind !== 'hidden').map(e => e.b);
    const fk = N.find(n => !n.side && fwd(n.id).length === 2); if (!fk) { no('갈래'); continue; }
    const [x, y] = fwd(fk.id), meet = fwd(x).filter(id => fwd(y).includes(id));
    if (meet.length !== 1) no('갈래 구성');
    if (fl === 1 && (fk.id !== 0 || [x, y].some(id => ins(m, id)[0].kind !== 'open' || N[id].g.count !== 1 || N[id].g.units[0][0] !== '거대 쥐'))) no('1층 입구 가까운 두 방 = 관문 없음 · 거대 쥐 1');
    // 큰길은 어떤 파티로도: 잠긴 문 · 숨은 통로 · 함정 없이 입구 → 우두머리 (어두운 길은 빛 없이도 지나간다)
    { const ok = new Set([0]), q = [0]; while (q.length) { const a = q.shift(); for (const e of outs(m, a)) if (!N[e.b].side && (e.kind === 'open' || e.kind === 'dark') && !ok.has(e.b)) { ok.add(e.b); q.push(e.b); } } if (!ok.has(boss.id)) no('큰길이 열쇠 없이 막힌다'); }
    (fl === 1 ? used1 : used2).push(...used);
  }
  const allKeys = new Set([...used1, ...used2].flatMap(id => D.PARTS[id].keys)), allParts = new Set([...used1, ...used2]);
  t('1층 설계서 (씨앗 30): 큰길 · 갈래(입구 곁 두 방은 관문 없이 거대 쥐 1) · 곁방 넷 = 열쇠 부품(관문 · 자물쇠 종류) · 숨은 통로 · 어두운 굴 · 큰길은 열쇠 없이', !bad1.length, bad1.slice(0, 5).join(' '));
  t('2층 설계서 (씨앗 30): 큰길 · 갈래 · 곁방 다섯(어두운 방 포함) = 열쇠 부품 · 어두운 굴 · 큰길은 열쇠 없이', !bad2.length, bad2.slice(0, 5).join(' '));
  t('부품 목록의 모든 항목이 설계서에서 조립된다 · 여덟 열쇠가 모두 쓰인다', Object.keys(D.PARTS).every(id => allParts.has(id) || id === 'darkcave') && ['따기', '부수기', '열림', '빛', '함정', '조사', '미리 알기', '치료'].every(k => allKeys.has(k) || (k === '빛')), JSON.stringify([...allParts]));
  const sig = m => JSON.stringify(m.nodes.map(n => [n.type, n.name || '']).concat(m.edges.map(e => [e.a, e.b, e.kind])));
  t('같은 설계서 · 다른 씨앗 = 다른 모양', new Set([1, 2, 3, 4].map(k => JSON.stringify(RUN.gen.make(k * 31, 1)._lay.room[1].cells))).size > 1);
  const SP = RUN.SPECS; const a3 = sig(RUN.gen.make(77, 3)), a5 = sig(RUN.gen.make(77, 5)); RUN.SPECS = undefined; const b3 = sig(RUN.gen.make(77, 3)), b5 = sig(RUN.gen.make(77, 5)), b1 = RUN.gen.make(77, 1); RUN.SPECS = SP;
  t('3층 이상도 설계서(원정) · 설계서가 없으면(기존 게임) 예전 방식', a3 !== b3 && a5 !== b5 && RUN.gen.make(77, 3).spec && !b1.spec && !b1.nodes.some(n => n.side) && !RUN.gen.make(77, 5, true).nope);
  const s = D.fresh(); s.maps[1] = { n: '', e: '' }; const V = D.view(s, 1);
  // 횃불: 곁방은 쓰지 않는다 (2026-11-23) · 어두운 길에서만 · 판 전체에 챙긴 것
  const s2 = D.fresh(); s2.up.torch = 1; s2.bag = { torch: 2, potion: 0 }; const st2 = RUN.newRun(D.floorSeed(s2, 1), ['fighter', 'cleric'], 1); D.recall(st2, s2); st2.items.torch = 2;
  st2.items.torch = 1; D.recall(st2, s2); t('계단을 내려가도 횃불은 다시 차지 않는다 (판 전체에 챙긴 것)', st2.items.torch === 1);
  // 보상을 지도에: 실제 규칙 값
  { const m1 = RUN.gen.make(4242, 1), N1 = m1.nodes, tr = N1.find(n => n.type === 'treasure'), el = N1.find(n => n.type === 'elite'), cp = N1.find(n => n.ev === 'captive'), ch = N1.find(n => n.chest), lt = N1.find(n => n.tier === 'light' && !n.side);
    t('보상: 보물 방 = 물건 1 · 등급은 그 층 희귀도 표(보물은 한 구역 깊게)', JSON.stringify(D.reward(tr, 1)) === JSON.stringify({ items: G.Gear.N_DROP.treasure, r: [1, 2, 3], gem: true }), JSON.stringify(D.reward(tr, 1)));
    t('보상: 정예 = 드롭 수 · 포로 구출 = 동료 +1 · 야영 = 회복 100%', D.reward(el, 1).items === G.Gear.N_DROP.elite && D.reward(cp, 1).ally === 1 && D.reward(N1.find(n => n.type === 'camp'), 1).heal === 100);
    t('1층 갈래: 입구 곁 두 방 = 관문 없이 거대 쥐 1 · 한쪽엔 상자', ch && !ch.side && lt && m1.edges.find(e => e.b === lt.id).kind === 'open' && m1.edges.find(e => e.b === ch.id).kind === 'open' && D.reward(ch, 1).items === 1 && !D.reward(lt, 1).items);
    t('방 수: 1층 11개 · 2층 12개 (2026-11-27 층을 10방쯤으로)', N1.length === 11 && RUN.gen.make(4242, 2).nodes.length === 12, [N1.length, RUN.gen.make(4242, 2).nodes.length]);
    }
  // 지도 경로 선: 모든 길에서 점들이 그 길의 복도 칸 + 양 끝 방 칸 안에만 (방 안은 칸 사이 걷기 — 벽을 가로지르지 않는다) · 문은 방 칸에 닿는다
  { const bad = []; for (const fl of [1, 2, 3, 5, 9]) for (let k = 0; k < 6; k++) { const m = RUN.gen.make(300 + k * 211, fl), Ly = m._lay;
      for (const e of m.edges) { const c = Ly.cor[e.id], ok = new Set([...c.cells, ...Ly.room[e.a].cells, ...Ly.room[e.b].cells].map(q => q.join())), P = D.segPts(m, e.a, e.b).pts, back = D.segPts(m, e.b, e.a).pts;
        let f = !Ly.room[e.a].cells.some(q => q.join() === c.doorA.join()) || !Ly.room[e.b].cells.some(q => q.join() === c.doorB.join()) || back.slice().reverse().join() !== P.join();
        for (let i = 0; i + 1 < P.length && !f; i++) { const [x0, y0] = P[i], [x1, y1] = P[i + 1], n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 4) + 1; for (let j = 0; j <= n; j++) if (!ok.has([Math.round(x0 + (x1 - x0) * j / n), Math.round(y0 + (y1 - y0) * j / n)].join())) { f = true; break; } }
        if (f) bad.push(`${fl}층 ${k} 길${e.id}`); } }
    t('지도 경로 선: 복도 칸 + 양 끝 방 칸만 밟는다 (설계서 층 · 3층 이상, 씨앗 6개씩) · 문은 방 칸', !bad.length, bad.slice(0, 5).join(' ')); }
  t('원정 중 지도: 기억한 방 · 길이 그림 사본에 들어간다 (규칙 상태는 그대로)', (() => { const s3 = D.fresh(), st0 = RUN.newRun(D.floorSeed(s3, 1), ['fighter'], 1), N0 = st0.map.nodes, e0 = st0.map.edges[0];
    N0[3].visited = true; N0[3].info = 3; e0.walked = true; D.remember(s3, st0); const st1 = RUN.newRun(D.floorSeed(s3, 1), ['fighter'], 1); D.recall(st1, s3); const v = D.drawState(s3, st1);
    return v.map.nodes[3].visited && v.map.edges[0].walked && !st1.map.nodes[3].visited && !st1.map.edges[0].walked && v.path === st1.path; })());
  // 타일 수준으로 이어져 있다 (교착 원인 2026-11-23: 손으로 짠 방의 문 칸이 일부만 바닥이라 복도가 벽에 막혀, 길이 하나뿐인 설계서 층에서 방이 통째로 고립 → 전투에서 서로 닿지 못함)
  { const bad = []; for (const fl of [1, 2]) for (let k = 0; k < 12; k++) { const m = RUN.gen.make(4000 + k * 97, fl), { iso, roomAt } = G.Floor.fromRun(m), W = iso.w, H = iso.h, c = iso.c, [sx, sy] = G.Floor.centerOf(m, 0), seen = new Uint8Array(W * H), q = [Math.floor(sy) * W + Math.floor(sx)]; seen[q[0]] = 1;
      while (q.length) { const i = q.pop(), x = i % W, y = (i / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy, j = Y * W + X; if (X < 0 || Y < 0 || X >= W || Y >= H || seen[j] || c[j] !== '.') continue; seen[j] = 1; q.push(j); } }
      for (const n of m.nodes) { let any = false; for (let i = 0; i < W * H && !any; i++) if (roomAt[i] === n.id && seen[i]) any = true; if (!any) bad.push(`${fl}층 ${k} ${n.name}`); } }
    t('설계서 층: 모든 방이 입구에서 걸어서 닿는다 (타일 수준)', !bad.length, bad.slice(0, 5).join(' ')); }
  { const m1 = RUN.gen.make(5151, 1), b1 = m1.nodes.find(n => n.type === 'boss'), SP0 = RUN.SPECS; RUN.SPECS = undefined; const base = RUN.gen.make(5151, 1).nodes.find(n => n.type === 'boss'); RUN.SPECS = SP0;
    t('1층 적 구성 덮어쓰기: 방마다 거대 쥐 1 · 고블린 1 · 우두머리 홉고블린 1 (기존 게임은 구역 표 그대로)', m1.nodes.filter(n => n.hostile && n.type === 'fight').every(n => n.g.count === 1) && b1.g.units[0][0] === '홉고블린' && b1.g.count === 1 && base.g.units[0][0] !== '홉고블린', JSON.stringify([b1.g.units, base.g.units])); }
  t('부활: 3레벨 미만은 0', (() => { const s5 = D.fresh(); G.newState(); s5.roster.dragoon = { m: D.member(G.S.w.fantasy, 'dragoon', 2), tr: [] }; return D.reviveCost(s5, 'dragoon') === 0 && (s5.roster.dragoon.m.lv = 3, D.reviveCost(s5, 'dragoon') === 75); })());
  // 옛 저장: 1 · 2층 기억 · 경로만 비운다
  const o = D.load(JSON.stringify({ v: 3, gold: 5, maps: { 1: { n: '4', e: '' }, 2: { n: '4', e: '' }, 3: { n: '44', e: '' } }, plan: { 1: [0, 1], 3: [0, 2] } }));
  t('옛 저장(지도 판 2 전): 모든 층의 지도 기억 · 경로를 비우고(작은 방으로 지도가 바뀌었다) 나머지는 그대로', !o.maps[1] && !o.maps[2] && !o.maps[3] && !o.plan[1] && !o.plan[3] && o.gold === 5 && o.fv === D.FV && D.load(D.dump(o)).fv === D.FV);
  { const o2 = D.load(JSON.stringify({ v: 3, fv: 4, maps: { 3: { n: '44', e: '' } } })), o3 = D.load(JSON.stringify({ v: 3, fv: D.FV, maps: { 3: { n: '44', e: '' } } })); t('지도 판 4 저장도 비운다 (2026-11-27 방 크기 · 층 구성이 바뀌었다) · 지금 판은 그대로', D.FV === 5 && !o2.maps[3] && o2.fv === 5 && o3.maps[3].n === '44'); }
}

// 죽음의 값 · 파티 짐 (2026-11-23)
{ const F = (G.newState(), G.S.w.fantasy), s = D.fresh(); s.roster.dragoon = { m: D.member(F, 'dragoon', 6), tr: [] }; s.roster.cleric = { m: D.member(F, 'cleric', 4), tr: [] }; s.up.cls = 1; s.party = ['dragoon', 'cleric'];
  s.dead.dragoon = true; t('사망한 영웅은 파티에서 빠진다 · 넣을 수 없다', !D.team(s).includes('dragoon') && (D.toggle(s, 'dragoon'), !D.team(s).includes('dragoon')));
  s.gold = 100; const c = D.reviveCost(s, 'dragoon'); t('부활 값 = 25 × 레벨', c === D.TUNE.REVIVE_K * 6 && c === 150);
  D.raise(s, 'dragoon'); t('금화가 모자라도 부활 · 모자란 만큼 빚', !s.dead.dragoon && s.gold === -50);
  t('빚이 있으면 해금을 못 산다', !D.buy(s, 'pot'));
  D.finish(s, 0, 80); t('버는 금화가 먼저 빚을 갚는다', s.gold === 30);
  const all = D.fresh(); all.dead = { dragoon: true, cleric: true }; t('모두 죽었으면 빈 파티 (출발을 막는다)', D.team(all).length === 0);
  // 짐 칸: 기본 4 + 영웅마다 max(0, 힘 수정치) + 해금
  const sm = c0 => Math.max(0, D.strMod(s.roster[c0].m)), cap = D.TUNE.BAG_BASE + sm('dragoon') + sm('cleric');
  t('짐 칸 = 기본 + 힘 수정치 (+ 「짐 칸」 해금)', D.bagCap(s) === cap && (s.up.bag = 1, D.bagCap(s) === cap + D.TUNE.BAG_STEP), [D.bagCap(s), cap]);
  // 물자: 해금 = 최대 · 값 · 칸
  const s2 = D.fresh(); s2.up = { torch: 2, camp: 3 }; s2.gold = 1000; s2.roster = s.roster; s2.party = ['dragoon', 'cleric'];
  s2.bag = null; t('물자 최대 = 해금 · 짐 구성이 없으면(옛 저장) 최대의 절반(올림)', JSON.stringify(D.bagPlan(s2)) === JSON.stringify({ torch: 2, camp: 9 }) && JSON.stringify(D.supMax(s2)) === JSON.stringify({ torch: 3, camp: 18 }), JSON.stringify([D.bagPlan(s2), D.supMax(s2)]));
  s2.bag = { torch: 2, camp: 1 }; const got = D.pack(s2);
  t('챙기기: 고른 만큼 · 야영 물자는 공짜 몫이 더해진다 · 값을 낸다', got.torch === 2 && got.camp === 1 + D.CAMP_FREE && s2.gold === 1000 - 2 * D.TUNE.SUP.torch - D.TUNE.SUP.camp);
  s2.gold = 12; const g2 = D.pack(s2); t('금화가 모자라면 살 수 있는 만큼만 · 빚이면 값 드는 것은 못 산다', g2.torch === 2 && g2.potion === 0 && (s2.gold = -5, D.pack(s2).torch === 0));
  s2.bag = { torch: 9, potion: 9, knockScroll: 9, tools: 1 }; s2.gold = 9999; const g3 = D.pack(s2); t('칸보다 많이는 못 챙긴다', g3.torch + g3.potion + g3.knockScroll + g3.tools <= D.bagCap(s2));
  // 전리품: 가득 차면 값이 가장 낮은 것부터 두고 감 · 물자는 버리지 않는다
  const st = { items: { torch: 2, camp: 1 }, bagCap: 4, loot: [], log: [] }; // 짐 칸은 횃불만 센다
  D.stow(st, { n: 'a', gold: 50 }); D.stow(st, { n: 'b', gold: 10 }); const out = D.stow(st, { n: 'c', gold: 30 });
  t('짐이 차면 값이 가장 낮은 전리품부터 두고 간다 (물자는 그대로)', out.length === 1 && out[0].n === 'b' && st.items.torch === 2 && st.loot.map(e => e.n).join() === 'a,c' && D.bagFull(st));
  t('살아 돌아오면 전리품 값', D.lootGold(st) === 80);
  // 경로 끝 · 가득 차면 복귀 · 사망 시 멈춤: 설정은 저장된다
  const s3 = D.fresh(); s3.endMode = 'back'; s3.fullBack = true; s3.deadStop = false; s3.bag = { torch: 1, potion: 0, knockScroll: 0, tools: 0 }; s3.dead = { mage: true };
  const o = D.load(D.dump(s3)); t('설정 · 짐 구성 · 사망자가 저장된다', o.endMode === 'back' && o.fullBack && !o.deadStop && o.bag.torch === 1 && o.dead.mage);
  const old = D.load(JSON.stringify({ v: 3, gold: 7, up: { pot: 2, camp: 2 } })); t('옛 저장: 사망자 없음 · 짐 = 해금 최대의 절반 · 새 기본 설정 한 번 · 옛 계단 야영 단계 = 야영 물자 최대', !Object.keys(old.dead).length && old.bag === null && D.supMax(old).camp === 14 && D.bagPlan(old).camp === 7 && old.endMode === 'back' && old.autoOn === false && old.deadStop === true);
  // 소생술: 원정에서는 금화 없이 (엔진은 300 요구) — 슬롯이 있는 소생 영웅이 있으면
  t('소생술 훅: 원정 중에는 금화 조건을 채워 준다', typeof G.Skill.revivify === 'function' && /curS/.test(String(G.Skill.revivify)));
}

// 탐험 스킬 · 열쇠 (2026-11-23)
{ const X = D.XRUN, F = (G.newState(), G.S.w.fantasy), H = (c, lv) => D.member(F, c, lv), M = h => ({ hero: h, n: h.name, uid: h.uid, cls: G.Party.RUN_CLS[h.cls], dead: false, hp: 10, max: 10 }), st = { xcd: {}, party: [], rng: Math.random, log: [] };
  const XS = (h, ...g) => { h.xsp = g; return h; }; // 탐험 주문을 정해 둔 영웅
  const ST = (h, str, wis) => { G.Dnd.ab(h); h.ab.str = str; h.ab.wis = wis ?? 8; return h; }; // 능력치를 정해 둔 영웅 (배경 · 레벨이 더하는 몫이 있어 문턱에서 멀리 — 8 또는 16 이상)
  t('탐험 재주 (2026-11-27): 부수기 = 근력 16 · 자물쇠 따기 · 함정 해제 = 로그 · 봉인 해제 · 빛 = 가진 탐험 주문 · 눈썰미 = 지혜 14', D.knacksOf(ST(H('dragoon', 1), 16)).join() === 'brk' && D.knacksOf(ST(H('dragoon', 1), 8, 18)).join() === 'eye' && D.knacksOf(ST(H('rogue', 1), 8)).join() === 'pick,disarm' && D.knacksOf(XS(ST(H('archmage', 1), 8), 'unseal')).join() === 'unseal' && D.knacksOf(XS(ST(H('cleric', 1), 8), 'light')).join() === 'light' && D.knacksOf({ cls: 'rogue', lv: 1 }).join() === 'pick,disarm' && D.knacksOf({ cls: 'dragoon', lv: 1 }).length === 0);
  t('탐험 주문: 주문 계열 영웅은 들어올 때 하나를 갖는다 (봉인 해제 · 빛 중) · 그 밖의 직업은 없다', ['bard', 'cleric', 'scout', 'mage', 'archmage', 'warlock'].every(c => { const x = H(c, 1).xsp; return x.length === 1 && ['unseal', 'light'].includes(x[0]); }) && ['dragoon', 'rogue', 'paladin', 'archer', 'monk', 'barbarian'].every(c => H(c, 1).xsp.length === 0) && [...Array(40)].some(() => D.rollXsp('mage')[0] === 'light') && [...Array(40)].some(() => D.rollXsp('mage')[0] === 'unseal'));
  t('탐사 규칙의 행동은 재주를 본다 (직업이 아니라 그 영웅)', X.can(st, M(ST(H('rogue', 1), 8)), 'pick') && X.can(st, M(ST(H('rogue', 1), 8)), 'disarm') && X.can(st, M(XS(H('archmage', 3), 'unseal')), 'knock') && !X.can(st, M(XS(H('archmage', 3), 'light')), 'knock') && X.can(st, M(ST(H('dragoon', 1), 16)), 'brute') && !X.can(st, M(ST(H('dragoon', 5), 8)), 'brute') && !X.can(st, M(ST(H('dragoon', 5), 18)), 'pick'));
  const r1 = H('rogue', 1), r9 = H('rogue', 9);
  t('판정은 영웅의 능력치 + 숙련 (레벨이 오르면 값이 오른다) · 도둑 도구는 로그만 전문화', X.skill(M({ ...r1, lv: 9 }), '도둑 도구') > X.skill(M(r1), '도둑 도구') && /* 은신은 무작위 빌드에 숙련이 없을 수 있다 */ X.skill(M(r1), '도둑 도구') === G.Dnd.mod(G.Dnd.ab(r1).dex) + 2 * G.Dnd.prof(1) && X.skill(M(H('dragoon', 3)), '도둑 도구') < 0, [X.skill(M(r1), '은신'), X.skill(M({ ...r1, lv: 9 }), '은신')]);
  const w = M(XS(H('archmage', 3), 'unseal')); X.use(st, w, 'knock'); const c0 = X.can(st, w, 'knock'); X.tick(st, X.ROOM_R); const c1 = X.can(st, w, 'knock'); X.tick(st, X.ROOM_R);
  t('열쇠에는 쿨타임이 없다', c0 && c1 && X.can(st, w, 'knock'));
  // 문의 장애물: 잠긴 문 · 봉인 · 무너진 길은 넘는 재주가 있어야 들어간다 · 함정 · 어둠은 결과를 안고 들어간다
  const pass = (kind, lock, party, o = {}) => { const node = { hostile: false, type: 'treasure', notes: [], ...o }, S = { map: { nodes: [{}, node] }, party: party.map(M), items: { camp: 5, ...(o.items || {}) }, xcd: {}, rng: Math.random, log: [], at: 0, turn: 0, flags: {} }, e = { a: 0, b: 1, kind, lock, seen: {}, tried: {} }; const L = RUN.moveActs(S, e), ok = L[0].pre(); return { n: L.length, e, node, S, ok }; };
  { const a = pass('locked', 'lock', [ST(H('rogue', 3), 8)]), b = pass('locked', 'lock', [ST(H('dragoon', 3), 16)], { hostile: true, type: 'fight' }), c = pass('locked', 'lock', [ST(H('cleric', 3), 10)]), d = pass('locked', 'seal', [ST(H('rogue', 3), 8)]), f = pass('locked', 'seal', [XS(H('archmage', 3), 'unseal')]), g = pass('locked', 'rubble', [ST(H('rogue', 3), 8)]), h = pass('locked', 'rubble', [ST(H('dragoon', 3), 16)]);
    t('잠긴 문: 따면 조용 · 부수면 안쪽이 알아챈다 · 없으면 못 들어간다 / 봉인: 봉인 해제만 / 무너진 길: 부수기만 (물자는 더 안 든다)', a.n === 1 && a.ok && a.e.opened && a.node.bonus && !a.node.alert && b.ok && b.e.opened && b.node.alert && !c.ok && !c.e.opened && !d.ok && f.ok && f.node.bonus && !g.ok && !g.e.opened && g.S.items.camp === 5 && h.ok && h.e.opened, [a.node, b.node, c.e, g.S.items]); }
  { const a = pass('trap', null, [H('rogue', 3)]), b = pass('trap', null, [H('dragoon', 3)]); t('함정: 함정 해제가 있으면 해제 · 없으면 밟는다 (막지 않는다 · 늘 보인다)', a.e.disarmed && !b.e.disarmed && b.e.seen.trap); }
  { const S = { party: [M(ST(Object.assign(H('dragoon', 3), { sp: 'human' }), 10))], items: { torch: 0 } }, p0 = D.passInfo(S, { kind: 'locked', lock: 'seal' }, { hostile: false }), p1 = D.passInfo({ ...S, party: [M(XS(H('archmage', 3), 'unseal'))] }, { kind: 'locked', lock: 'seal' }, {}), p6 = D.passInfo({ ...S, party: [M(XS(H('archmage', 3), 'light'))] }, { kind: 'dark' }, {}), p7 = D.passInfo({ ...S, party: [M(XS(H('archmage', 3), 'light'))] }, { kind: 'locked', lock: 'seal' }, {}), p2 = D.passInfo({ ...S, items: { torch: 2 } }, { kind: 'dark' }, {}), p3 = D.passInfo(S, { kind: 'open' }, { sleepy: true }), p4 = D.passInfo({ ...S, party: [M(ST(H('dragoon', 3), 16))] }, { kind: 'locked', lock: 'lock' }, {}), p5 = D.passInfo(S, { kind: 'dark' }, {});
    t('문 표지의 장애물: 못 넘는 문은 닫힘 · 넘는 재주와 사람 · 횃불 · 부수기는 시끄럽다 · 어둠은 못 막으면 기습', p0.st === '봉인' && !p0.ok && p0.shut && p1.ok && p1.sk === 'unseal' && p1.who.hero.cls === 'archmage' && p2.ok && p2.tag === '횃불 2' && p3.st === '잠듦' && p3.ok && p4.sk === 'brk' && p4.loud && !p5.ok && !p5.shut && p5.tag === '기습' && p6.ok && p6.sk === 'light' && p7.shut && D.passInfo(S, { kind: 'open' }, {}) === null, [p0, p2, p3, p5]); }
  t('어둠: 빛 주문을 가진 영웅이 있거나 전원 암시야면 밝다 (봉인 해제만 가진 주문사는 못 밝힌다)', X.lit({ party: [M(XS(Object.assign(H('cleric', 1), { sp: 'human' }), 'light'))] }) && !X.lit({ party: [M(XS(Object.assign(H('cleric', 1), { sp: 'human' }), 'unseal'))] }) && !X.lit({ party: [M(Object.assign(H('rogue', 1), { sp: 'human' }))] }) && X.lit({ party: [M(Object.assign(H('rogue', 1), { sp: 'dwarf' }))] })); // 전원 암시야 = 영웅의 실제 종족
  { const s = D.fresh(); D.learn(s, 'bars', 'brk'); D.learn(s, 'lock', 'brk'); D.learn(s, 'lock', 'pick'); t('겪으면 기억: 넘어 본 재주가 저장에 남는다 (창살은 잠긴 문과 같이)', D.known(s, 'lock').join() === 'brk,pick' && D.known(s, 'bars').join() === 'brk,pick' && D.known(s, 'seal').length === 0, s.knew); }
  { const mk = party => ({ at: 0, party: party.map(M), items: {}, map: { nodes: [{ id: 0, visited: true }, { id: 1 }, { id: 2 }], edges: [{ a: 0, b: 1, kind: 'locked', lock: 'seal', seen: {} }, { a: 0, b: 2, kind: 'open', seen: {} }] } });
    t('못 넘는 문 너머는 갈 수 있는 방에 없다 (넘는 재주가 있으면 있다)', D.routes(mk([ST(H('rogue', 3), 8)])).map(r => r.to).join() === '2' && D.routes(mk([XS(H('archmage', 3), 'unseal')])).map(r => r.to).sort().join() === '1,2'); }
  { const E = [{ id: 0, a: 0, b: 1, kind: 'locked', lock: 'seal', seen: {} }, { id: 1, a: 0, b: 2, kind: 'open', seen: {} }, { id: 2, a: 2, b: 3, kind: 'open', seen: {} }], st = { at: 0, floor: 1, party: [M(ST(H('rogue', 3), 8))], items: { camp: 9 }, log: [], map: { nodes: [{ id: 0, type: 'start', visited: true }, { id: 1, type: 'treasure' }, { id: 2, type: 'fight', hostile: true }, { id: 3, type: 'boss', hostile: true }], edges: E } };
    const opts = [{ to: 1, e: E[0], ed: E[0] }, { to: 2, e: E[1], ed: E[1] }]; t('다음 방 자동: 못 넘는 문은 고르지 않는다', D.POL.fork(st, opts) === 1 && D.POL.fork({ ...st, party: [M(XS(H('archmage', 3), 'unseal'))] }, opts) === 0); }
  // 조사 전에는 모른다: 기억이 없으면 관문 표시가 없다
  const s0 = D.fresh(), V0 = D.view(s0, 1); t('조사 전에는 관문이 지도 데이터에 없다 (잠김 · 함정 · 어두움 · 숨은 통로 모두 미확인)', V0.map.edges.every(e => !e.seen.lock && !e.seen.trap && !e.seen.dark && !e.seen.hidden));
  // 지도의 필요한 직업: 지금 파티에 따라 값이 바뀐다
  const s3 = D.fresh(); s3.roster.dragoon = { m: ST(H('dragoon', 3), 16), tr: [] }; s3.roster.rogue = { m: ST(H('rogue', 3), 8), tr: [] }; s3.party = ['dragoon']; s3.up.cls = 4;
  const V3 = D.view(s3, 1), lk = V3.map.edges.find(e => e.kind === 'locked' && (e.lock || 'lock') === 'lock' && !V3.map.nodes[e.b].hostile); lk.seen.lock = true;
  const g1 = D.gateTxt(s3, V3, lk); s3.party = ['dragoon', 'rogue']; const g2 = D.gateTxt(s3, D.view(s3, 1), Object.assign(D.view(s3, 1).map.edges[lk.id], { seen: { lock: true } })); s3.party = ['rogue']; s3.party = []; const g3 = D.gateTxt({ ...s3, party: ['cleric'], roster: { cleric: { m: ST(H('cleric', 3), 10), tr: [] } }, up: { cls: 4 } }, V3, lk);
  t('지도의 문: 넘는 사람(조용한 재주 먼저) · 없으면 닫힘', g1 === '잠긴 문 · 파이터' && g2 === '잠긴 문 · 로그' && g3 === '잠긴 문 · 닫힘', [g1, g2, g3]);
  // 기존 게임은 원형 표 그대로
  const X0 = RUN.X; RUN.X = undefined; const st5 = RUN.newRun(3, ['rogue'], 3), ck = RUN.checkers(st5, { skill: '은신' })[0]; RUN.X = X0;
  t('기존 게임(RUN.X 없음)은 원형 표 그대로', ck.bonus === RUN.CLS.rogue.sk.은신);
}

// 물자 정리 · 야영 (2026-11-23)
{ const s = D.fresh(); s.party = ['dragoon', 'cleric']; const st = RUN.newRun(D.floorSeed(s, 1), ['fighter', 'cleric'], 1); D.recall(st, s); st.items = { torch: 1, camp: 2 };
  t('물약은 원정에 없다 (해금 · 짐 · 챙기기)', !D.TREE.some(x => x.id === 'pot') && !D.SUP_KEYS.includes('potion') && D.pack(Object.assign(D.fresh(), { gold: 999 })).potion === 0);
  const camp = st.map.nodes.find(n => n.type === 'camp'), N0 = st.map.nodes[0]; st.party.forEach(m => { m.hp = 1; }); st.xcd = { a: { knock: 12 } };
  st.at = 0; st.items.camp = 5; const r0 = D.campHere(st); t('야영: 정리한 방에서 물자 3 · 체력 전부 · 쿨타임 전부 (습격 없음)', r0 && !r0.raid && st.items.camp === 5 - D.REST && st.party.every(m => m.hp === m.max) && !Object.keys(st.xcd).length, JSON.stringify(r0));
  st.items.camp = 2; t('물자가 모자라면 못 쉰다 · 적이 남은 방도 못 쉰다', D.campHere(st) === null && !D.canCamp(st) && (st.items.camp = 9, !D.canCamp(st, st.map.nodes.find(n => n.hostile).id)));
  st.map.nodes[camp.id].hostile = false; st.items.camp = 1; t('야영 방은 물자 1', D.canCamp(st, camp.id) && D.restCost(st, camp.id) === D.REST_CAMP && D.REST_CAMP === 1);
  // 방을 옮길 때마다 물자 1 · 없으면 전원 최대 체력의 10%
  st.items.camp = 1; st.party.forEach(m => { m.hp = m.max; }); D.POL.move(st); const a1 = st.items.camp, h1 = st.party.map(m => m.hp).join(); D.POL.move(st);
  t('방 이동: 물자 1 · 0이면 굶주림 (최대 체력 10%)', a1 === 0 && h1 === st.party.map(m => m.max).join() && st.party.every(m => m.hp === m.max - Math.max(1, Math.round(m.max * 0.1))) && st.log.some(l => /굶주림/.test(l.t)));
  // 자동 야영: 다쳤고 쉬어도 물자가 둘은 남을 때
  const s2 = D.fresh(), st2 = RUN.newRun(D.floorSeed(s2, 1), ['fighter'], 1); st2.map.nodes.forEach(n => { n.hostile = false; }); st2.at = 1; st2.items = { camp: 9 };
  const w3 = D.wantCamp(s2, st2); st2.party.forEach(m => { m.hp = 1; }); const w4 = D.wantCamp(s2, st2); st2.items.camp = 4; const w5 = D.wantCamp(s2, st2);
  t('자동 야영: 다쳤고 쉬어도 물자 둘이 남을 때만', !w3 && w4 && !w5);
  t('옛 저장: 경로 · 야영 계획은 비운다 · 짐은 이어짐', (() => { const o = D.load(D.dump(Object.assign(D.fresh(), { plan: { 1: [0, 2] }, campPlan: { 1: [3] }, bag: { torch: 1, camp: 2 } }))); return !o.plan[1] && !o.campPlan[1] && o.bag.camp === 2; })());
}

// 전투 스킬 = 쿨타임 하나 (2026-11-23, 원정 모드 스위치 G.Res.cdOn)
{ D.hook(); const Rs = G.Res, F = (G.newState(), G.S.w.fantasy), ms = ['cleric', 'archmage', 'paladin', 'monk', 'barbarian', 'dragoon'].map(c => D.member(F, c, 9));
  const all = []; for (const m of ms) for (const b of G.Builds.LIST.filter(x => x.cls === m.cls)) for (const k of [...(b.core || []), ...(b.sug || [])]) { const res = G.Skill.resOf(k); if (res) all.push([m, k, res]); }
  Rs.cdOn = true; Rs.clock = 0; for (const m of ms) { Rs.long(m); m.cdK = {}; const r0 = Rs.of(m); r0.sl = [9, 9, 9, 9, 9, 9, 9, 9, 9]; r0.fp = 99; r0.fu = { sr_rage: 99, sr_lay: 99, sr_turn: 99 }; } // 주문 칸 · 집중점 · 횟수를 다 썼어도
  const bad = all.filter(([m, k, res]) => !Rs.can(m, k, res));
  t('스위치가 켜지면 빌드의 모든 자원 스킬이 쿨타임만으로 돈다 (칸 · 집중점 · 횟수가 0이어도 쓴다)', all.length > 30 && !bad.length, bad.slice(0, 5).map(x => x[1]).join());
  const [m0, k0, res0] = all.find(([, k, r]) => r.slot === 3), c0 = D.cdOf(k0, res0); Rs.pay(m0, k0, res0);
  const b1 = Rs.can(m0, k0, res0); Rs.clock += c0 - 1; const b2 = Rs.can(m0, k0, res0); Rs.clock += 1; const b3 = Rs.can(m0, k0, res0);
  t('쓴 뒤 그 라운드 수만큼 못 쓴다 (3레벨 주문 = 쿨 4) · 전투가 끝나도 시계는 이어진다', c0 === 4 && !b1 && !b2 && b3, [k0, c0, b1, b2, b3]);
  Rs.pay(m0, k0, res0); const st = { xcd: {}, party: [] }; D.XRUN.tick(st, D.XRUN.ROOM_R); t('방을 옮기면 6라운드 (탐험 스킬과 한 시계)', Rs.clock - m0.cdK[G.Res.sh(k0, res0)[0]] === 6);
  Rs.pay(m0, k0, res0); Rs.longRest([m0]); t('야영(긴 휴식) = 전부 돌아온다', Rs.can(m0, k0, res0));
  t('쿨타임 값: 1레벨 주문 2 · 5레벨 주문 6 · 집중점 2 · 짧은 휴식 6 · 긴 휴식 8 · 소생술 30', D.cdOf('x', { slot: 1 }) === 2 && D.cdOf('x', { slot: 5 }) === 6 && D.cdOf('x', { focus: 1 }) === 2 && D.cdOf('x', { short: 1 }) === 6 && D.cdOf('x', { long: 1 }) === 8 && D.cdOf('sr_revive', { slot: 3 }) === 30);
  { const Sk = G.Skill, m = all[0][0], a = { merc: m }, on0 = Rs.cdOn, c0 = Rs.clock; Rs.cdOn = true; m.cdK = {}; // 스킬 틀 하나 (2026-11-27): 무기 기술도 같은 표 · 같은 시계
    const v0 = D.cdOf('sr_topple', null) === 3 && Rs.cdOf('sr_cleave') === 2 && Sk.cdLeft({}, a, 'sr_topple') === 0; Sk.cdStart({}, a, 'sr_topple'); const v1 = Sk.cdLeft({}, a, 'sr_topple') === 3 && Rs.cdLeftOf(m, 'sr_topple') === 3 && m.cdK.sr_topple === Rs.clock; Rs.clock += 2; const v2 = Sk.cdLeft({}, a, 'sr_topple') === 1; Rs.clock += 1; const v3 = Sk.cdLeft({}, a, 'sr_topple') === 0;
    t('무기 기술의 쿨타임도 원정 시계로 돈다 (표 하나 · 기록 하나)', v0 && v1 && v2 && v3 && !a.cdU, [v0, v1, v2, v3]); Rs.cdOn = on0; Rs.clock = c0; m.cdK = {}; }
  Rs.cdOn = false; const m1 = ms[0]; Rs.long(m1); const r1 = Rs.of(m1); r1.sl = [9, 9, 9, 9, 9, 9, 9, 9, 9]; const kk = all.find(([m, k, r]) => m === m1 && r.slot === 1);
  t('스위치가 꺼지면 예전과 같다 (주문 칸이 없으면 못 쓴다)', kk && !Rs.can(m1, kk[1], kk[2]) && Rs.usesOf(m1, kk[2], kk[1]) > 1);
}

// 레벨업 카드 (2026-11-23, 카드 모드)
{ D.hook(); const F = (G.newState(), G.S.w.fantasy), m = D.member(F, 'cleric', 1, () => 0.3);
  t('카드 모드: 칸 여섯이 처음부터 열려 있다 · 대표 스킬 하나로 시작 · 1레벨 몫은 고를 것', G.Builds.CARD.on && G.Builds.view(m).slots.every(x => !x.locked) && m.picks.length === 1 && m.cardq.length === 1 && m.cardq[0].lv === 1);
  const off = D.cardOffer(m, () => 0.5); t('카드 셋 · 추천 카드가 늘 들어 있다', off.length === 3 && off[0] === D.cardRec(m) && new Set(off).size === 3, off);
  D.cardChoose(m, off[1]); t('고른 카드가 칸에 든다', m.picks.includes(off[1]) && !m.cardq.length && G.Guild.active(m).includes(off[1]));
  D.gain(m, 0); for (let L = 2; L <= 9; L++) { m.lv = L - 1; m.xp = G.Guild.needOf(m); m.lv = L; G.Guild.grow(m); }
  t('1 · 3 · 5 · 7 · 9레벨에 고를 것이 생긴다 (2 · 4 · 6 · 8은 없음)', m.cardq.map(q => q.lv).join() === '3,5,7,9', m.cardq.map(q => q.lv + q.kind).join());
  const c4 = D.member(F, 'cleric', 4); c4.picks = c4.picks.filter(k => k !== 'sr_revive'); const c5 = D.member(F, 'cleric', 5); c5.picks = c5.picks.filter(k => k !== 'sr_revive');
  t('SRD 레벨이 안 된 스킬은 후보에 없다 (클레릭 소생술은 5레벨부터)', !D.cardCands(c4).includes('sr_revive') && D.cardCands(c5).includes('sr_revive'));
  D.cardAuto(m); t('추천대로 (답이 없으면) · 9레벨에 여섯 칸', m.picks.length === 6 && !m.cardq.length, m.picks.length);
  m.lv = 11; m.cardq = []; G.Guild.grow(m); t('11레벨부터는 바꾸기', m.cardq[0]?.kind === 'swap');
  const nk = D.cardCands(m)[0], old0 = m.picks[0]; D.cardChoose(m, nk, 0); t('칸이 차면 고른 카드로 칸 하나를 바꾼다', m.picks[0] === nk && m.picks[0] !== old0 && m.picks.length === 6);
  m.cardq = [{ lv: 13, kind: 'swap' }]; const before = m.picks.join(); D.cardChoose(m, null); t('넘김', m.picks.join() === before && !m.cardq.length);
  const m3 = D.member(F, 'dragoon', 3); t('2레벨 이상으로 들어오면 지나간 몫은 추천대로 채워져 있다', !m3.cardq.length && m3.picks.length >= 2, m3.picks);
  const oldH = D.member(F, 'cleric', 7); delete oldH.picks; G.Builds.CARD.on = false; const had = G.Builds.slots(oldH).filter(Boolean).join(); G.Builds.CARD.on = true; D.cardInit(oldH);
  t('옛 저장의 영웅: 지금 든 스킬 그대로 (소마법 = 기본 공격은 칸 밖)', oldH.picks.join() === had.split(',').filter(k => G.Guild.spLv(k) !== 0).join() && had.length > 0);
  { const sm = D.member(F, 'mage', 5), oldM = D.member(F, 'mage', 5); D.rebuild(sm, 'sorcerer'); G.Builds.CARD.on = false; G.Builds.apply(oldM, G.Builds.byId('sorcerer')); G.Builds.CARD.on = true; delete oldM.picks; oldM.cardq = []; D.cardInit(oldM);
    t('기본 공격(화염살 같은 소마법)은 스킬 칸 · 카드에 없다 — 그래도 엔진에는 든다', !sm.picks.some(k => G.Guild.spLv(k) === 0) && !D.cardCands(sm).some(k => G.Guild.spLv(k) === 0) && G.Builds.slots(sm).every(k => !k || G.Guild.spLv(k) !== 0) && G.Builds.basicOf(sm).length === 1 && G.Guild.active(sm).includes(G.Builds.basicOf(sm)[0]), sm.picks);
    t('옛 영웅의 칸에서 소마법을 빼면 고를 것 하나', !oldM.picks.some(k => G.Guild.spLv(k) === 0) && oldM.cardq.length === 1, oldM.picks); }
  const rb = D.member(F, 'cleric', 5), alt = G.Builds.LIST.find(b => b.cls === 'cleric' && b.id !== rb.build); D.rebuild(rb, alt.id); t('빌드 바꾸기 = 그 빌드의 추천대로 다시 (1 · 3 · 5 몫)', rb.build === alt.id && rb.picks.length === 4 && !rb.cardq.length, rb.picks);
}

// 사건은 최초 1회 (2026-11-23)
{ const s = D.fresh(), st = RUN.newRun(D.floorSeed(s, 1), ['fighter', 'rogue'], 1), n = st.map.nodes.find(q => q.type === 'event'); st.at = n.id;
  const sc = { kind: 'event', title: 'x', choices: RUN.eventScene(st, n, n.ev) };
  t('처음 만나면 선택 창 (기억 없음 → 고르지 않음)', D.evDecide(s, st, sc) === null);
  D.evMark(s, 1, n.id, { st: 'skip' }); t('피하면 미해결로 남고 다음 판에 다시 만난다 · 층 줄의 미해결 수', D.evDecide(s, st, sc) === null && D.evOpen(s, 1) === 1);
  const c1 = sc.choices.find(c => !c.lock && !(c.off && c.off())); D.evPlanSet(s, 1, n.id, c1.n); t('계획에서 고른 선택지를 도착해서 한다 (창 없이)', D.evDecide(s, st, sc) === sc.choices.indexOf(c1));
  D.evMark(s, 1, n.id, { st: 'done', pick: c1.n, r: 'x · y · 실패' }); t('해결되면(실패 포함) 다시 안 일어난다 · 계획도 지운다', D.evDecide(s, st, sc) === 'done' && D.evOpen(s, 1) === 0 && !s.evPlan[1][n.id]);
  const o = D.load(D.dump(s)); t('사건 기억이 저장 · 복원된다', o.evs[1][n.id].st === 'done' && o.evs[1][n.id].r === 'x · y · 실패' && D.load(JSON.stringify({ v: 3 })).evs && !Object.keys(D.load(JSON.stringify({ v: 3 })).evs).length);
  const out = D.evOut('captive', '우리를 부순다'); t('선택지 결과는 숫자 · 이름으로 (문장 없이)', out.ok.includes('동료 +1') && out.no.includes('경보') && D.evOut('toll', '금화 15를 낸다').cost === 15);
  t('기존 게임은 그대로 (사건 결정은 원정 정책에만)', typeof D.POL.event === 'undefined');
}

// 보석 · 해금 갈래 · 사건의 지나치는 선택지 (2026-11-23)
{ const st = { items: { torch: 1, camp: 0 }, bagCap: 4, loot: [], log: [], floor: 1, gold: 100 };
  for (let i = 0; i < 6; i++) D.stow(st, { n: '옥', gem: 'jade', gold: 5, cnt: 1, r: 0 });
  t('보석: 같은 것은 한 칸에 다섯까지 쌓인다', st.loot.length === 1 && st.loot[0].cnt === 6 && D.bagUsed(st) === 1 + 2, D.bagUsed(st));
  t('보석 값 단계 (옥 < 진주 < 다이아몬드 < 흑진주 < 사파이어 < 큰 다이아몬드)', D.GEMS.every((g, i) => !i || g.g > D.GEMS[i - 1].g) && D.GEMS.length === 6);
  t('살아 돌아오면 금화 (값 × 개수)', D.lootGold(st) === 30);
  D.stow(st, { n: '사파이어', gem: 'sapphire', gold: 120, cnt: 1, r: 0 }); const out = D.stow(st, { n: '진주', gem: 'pearl', gold: 20, cnt: 1, r: 0 });
  t('짐이 차면 값이 낮은 것부터 (보석은 하나씩)', out.length >= 1 && out.every(q => q.gem === 'jade') && st.loot.some(e => e.gem === 'sapphire'), JSON.stringify(out));
  const g1 = D.gemDrop({ floor: 1 }, 'boss', () => 0.5), g9 = D.gemDrop({ floor: 9 }, 'boss', () => 0.5);
  t('층이 깊을수록 높은 단계 · 우두머리 둘', g1.length === 2 && g9[0].gold > g1[0].gold);
  const st2 = { items: {}, bagCap: 9, loot: [], log: [], floor: 3, gold: 100 }; const gs = D.POL.gem(st2, 'elite', 40); t('정예 · 우두머리: 그 판 금화의 일부를 보석으로', gs.length === 1 && st2.gold < 100 && st2.loot.length === 1);
  t('해금 갈래가 모든 줄을 담는다 (보급 · 원정대)', D.TREE.every(x => D.BRANCH.some(b => b.id === x.br)) && D.BRANCH.length === 2);
  t('사건의 지나치는 선택지는 원정 창 · 계획에서 뺀다', D.evPass('captive', '지나친다') && D.evPass('altar', '지나간다') && !D.evPass('captive', '우리를 부순다') && !D.evPass('wounded', '짐을 뒤진다') && !D.evPass('toll', '금화 15를 낸다'));
}

// 소생술이 오는 레벨 (SRD 3레벨 주문: 클레릭 5 · 팔라딘 9)
{ const F = G.S.w.fantasy, at = (cls, b, lv) => { const m = D.member(F, cls, lv); D.rebuild(m, b); m.picks = m.picks.filter(k => k !== 'sr_revive'); return [D.cardCands(m).includes('sr_revive'), D.cardRec(m)]; };
  t('소생술: 생명 클레릭 4레벨 후보 아님 · 5레벨 추천', !at('cleric', 'cleric', 4)[0] && at('cleric', 'cleric', 5)[1] === 'sr_revive');
  t('소생술: 수호 팔라딘 8레벨 후보 아님 · 9레벨 추천', !at('paladin', 'paladin_shield', 8)[0] && at('paladin', 'paladin_shield', 9)[1] === 'sr_revive');
}
// 다중 직업 (원정에서는 쓰지 않는다): 들어올 때 한 직업 · 옛 저장은 불러올 때 한 직업으로 (레벨 합 그대로)
{ const F = G.S.w.fantasy; let mcN = 0; for (let i = 0; i < 40; i++) { const m = D.member(F, 'paladin', 9); if (m.mc?.length || G.Builds.byId(m.build)?.mc) mcN++; }
  t('영웅 들이기: 다중 직업 빌드 · 다른 직업 레벨이 없다 (40명)', mcN === 0, mcN);
  G.Builds.CARD.on = false; const old = D.member(F, 'paladin', 1); G.Builds.apply(old, G.Builds.byId('hexadin')); while (old.lv < 9) { old.lv++; G.Guild.grow(old); } G.Builds.CARD.on = true;
  const hadMc = G.MC.lvOf(old, 'paladin') < 9 && old.mc?.length > 0, raw = JSON.stringify({ ...D.fresh(), roster: { paladin: { m: old, tr: [] } } }), s2 = D.load(raw), m2 = s2.roster.paladin.m;
  t('옛 저장의 다중 직업 영웅: 불러오면 팔라딘 9 · 한 직업 빌드 · 소생술 후보', hadMc && !m2.mc && m2.lv === 9 && G.MC.lvOf(m2, 'paladin') === 9 && !G.Builds.byId(m2.build).mc && (m2.picks = [], D.cardCands(m2).includes('sr_revive')), [hadMc, m2.build, m2.lv]);
  t('빌드 바꾸기에 다중 직업 빌드는 없다', !D.rebuild(D.member(F, 'paladin', 3), 'hexadin') && !D.dexHeroes().some(b => G.Builds.byId(b.id).mc));
}
// 옛 기본 치유('cure')는 치유 스킬을 칸에 든 영웅만
{ const F = G.S.w.fantasy, m = D.member(F, 'cleric', 3), c0 = G.Res.cdOn; G.Res.cdOn = true; m.picks = ['sr_bless']; G.Builds.refresh(m); const no = G.Res.can(m, 'cure', { slot: 1 }); m.picks = ['sr_bless', 'sr_cure']; G.Builds.refresh(m); m.cdK = {};
  t('치유 스킬이 칸에 없으면 기본 치유도 없다', !no && G.Res.can(m, 'cure', { slot: 1 })); G.Res.cdOn = c0; }
// 3~10층 설계서: 층마다 열쇠 부품 · 곁방 · 큰길이 열쇠 없이 우두머리까지 · 못 가는 방 없음 (씨앗 6개)
{ const bad = [], keysBy = {}; for (let fl = 3; fl <= 10; fl++) for (let k = 0; k < 6; k++) { const m = RUN.gen.make(D.floorSeed({ mapSeed: 500 + k }, fl), fl), N = m.nodes, outs = id => m.edges.filter(e => e.a === id);
    if (!m.spec) bad.push(`${fl}:설계서 아님`); const side = N.filter(n => n.side); if (side.length < 2) bad.push(`${fl}:곁방 ${side.length}`); (keysBy[fl] = keysBy[fl] || new Set()); side.forEach(n => keysBy[fl].add(n.part));
    for (const n of side) { const P = D.PARTS[n.part], e = m.edges.find(q => q.b === n.id); if (!P || e.kind !== P.kind || (P.lock || undefined) !== e.lock || !!P.dark !== !!n.dark) bad.push(`${fl}:부품 ${n.part}`); }
    const boss = N.find(n => n.type === 'boss'), ok = new Set([0]), q = [0]; while (q.length) { const a = q.shift(); for (const e of outs(a)) if (['open', 'dark', 'trap'].includes(e.kind) && !ok.has(e.b)) { ok.add(e.b); q.push(e.b); } } if (!ok.has(boss.id)) bad.push(`${fl}:큰길 막힘`);
    const all = new Set([0]), q2 = [0]; while (q2.length) { const a = q2.shift(); for (const e of outs(a)) if (!all.has(e.b)) { all.add(e.b); q2.push(e.b); } } if (all.size !== N.length) bad.push(`${fl}:못 가는 방`); }
  t('3~10층 설계서: 곁방 = 열쇠 부품 · 큰길은 열쇠 없이 · 못 가는 방 없음', !bad.length, bad.slice(0, 6).join(' '));
  t('층마다 열쇠 구성이 다르다', new Set(Object.values(keysBy).map(s => [...s].sort().join())).size >= 6, JSON.stringify(Object.fromEntries(Object.entries(keysBy).map(([k, v]) => [k, [...v]])))); }
// 어두운 방 (2026-11-23): 빛 · 횃불 1 · 없으면 어둠(조사 못 함 · 엔진 빛을 끈다)
{ const s = D.fresh(), st = RUN.newRun(D.floorSeed(s, 2), ['rogue', 'cleric'], 2), n = st.map.nodes.find(q => q.dark), e = n && st.map.edges.find(q => q.b === n.id);
  t('2층에 어두운 방이 있다 (곁방)', !!n && n.side && n.part === 'darkroom');
  const go = () => { st.at = e.a; st.scene = null; const a = RUN.moveActs(st, e); a[a.length - 1].run(); };
  const lit0 = RUN.lit(st); st.items.torch = 1; go(); t('횃불이 있으면 하나 쓰고 밝다', !lit0 && (st.items.torch === 0 && n.lit && st.roomDark == null), [st.items.torch, n.lit]);
  n.lit = false; st.items.torch = 0; go(); t('횃불이 없으면 어둠 · 그 방 조사 못 함', !lit0 && (st.roomDark === n.id && RUN.roomActs(st).length === 0));
  const rt = { map: { w: 4, h: 4, c: new Array(16).fill('.'), passChars: '.', amb: new Uint8Array(16).fill(1), lights: [{ x: 1, y: 1, b: 4, d: 8, wall: true }] }, party: [{ merc: { cls: 'dragoon' }, x: 1, y: 1, dead: false }], mons: [], darks: [], suns: [] };
  const lv1 = G.Light.level(rt, 2, 2); rt.dvDark = true; t('빛 없이 어두운 방의 전투: 벽 횃불 · 든 횃불 · 어스름이 꺼진다', lv1 === 2 && G.Light.level(rt, 2, 2) === 0, [lv1, G.Light.level(rt, 2, 2)]);
  t('어두운 방은 방 상태 「어둠」 (지도의 한 줄)', /^어둠 · /.test(D.gateTxt(s, D.view(s, 2), { kind: 'dark', room: n.id })));
}
// 함정 다루기 (로그): 찾은 함정은 도둑 도구로 해제 · 아니면 알고 지나간다 (작동, 내성 이점)
{ const F = (G.newState(), G.S.w.fantasy), H = (c, lv) => D.member(F, c, lv), M = h => ({ hero: h, n: h.name, uid: h.uid, cls: G.Party.RUN_CLS[h.cls], dead: false, hp: 30, max: 30 });
  const rg = H('rogue', 5), mk = party => ({ map: { nodes: [{ id: 0, notes: [] }, { id: 1, hostile: false, type: 'treasure', notes: [] }], edges: [] }, party: party.map(M), items: {}, xcd: {}, rng: () => 0.99, log: [], at: 0, turn: 0, flags: {}, path: [0], here: {} });
  const e = { a: 0, b: 1, kind: 'trap', dc: 15, seen: { trap: true }, tried: {} }, S1 = mk([rg]), acts = RUN.moveActs(S1, e), N = G.Dnd;
  t('함정: 손재주(로그)가 있으면 판정 없이 해제', acts.length === 1 && !acts[0].check, acts.map(a => a.id));
  acts[0].run(); t('해제 성공: 작동하지 않는다', e.disarmed && !S1.log.some(l => l.trap), S1.log.map(l => l.t));
  const e2 = { a: 0, b: 1, kind: 'trap', seen: { trap: true }, tried: {} }, S2 = mk([H('dragoon', 5)]), a2 = RUN.moveActs(S2, e2); a2[0].run();
  t('손재주가 없으면 밟고 지나간다: 작동한다', a2.length === 1 && S2.log.some(l => l.trap), a2.map(a => a.id));
}
// 몬스터 상성 (SRD 능력치표) · 싸워 본 것은 도감에 · 레인저는 만난 것만으로
{ const s = D.fresh(); s.party = ['dragoon', 'cleric']; const map = { w: 10, h: 10, c: new Array(100).fill('.') };
  G.newState(); const f0 = G.S.w.fantasy; for (const c of ['dragoon', 'cleric']) s.roster[c] = { m: D.member(f0, c, 3), tr: [] };
  const a = D.affOf('해골'); t('상성: 해골 = 언데드 · 타격 취약 · 독 면역', a.ty === 'undead' && a.vul.includes('bludgeoning') && a.imm.includes('poison'), JSON.stringify(a));
  t('싸우기 전에는 모른다', !D.affKnown(s, '해골') && D.affTag(s, '해골') === '');
  const st = RUN.newRun(3, ['fighter', 'cleric'], 1), { f, r } = D.world(s, map); D.outfit(st, r, s);
  const mo = G.Fantasy.spawnMon(r, 1, { n: '해골', ...G.D.F.mon['해골'] }, 5, 5, false, {}), t0 = G.Foe.dtype; G.Foe.dtype = 'bludgeoning'; G.Fantasy.hurt(f, r, mo, 3, 'hit', { merc: r.party[0].merc }); G.Foe.dtype = t0;
  t('싸워 보면 도감에 · 표시 ▲타격 ✕독 · 배율 기록(취약)', D.affKnown(s, '해골') && /▲타격/.test(D.affTag(s, '해골')) && /✕독/.test(D.affTag(s, '해골')) && st.stat.h.dragoon.tk?.취약 === 1, D.affTag(s, '해골'));
  const s2 = D.fresh(); s2.dex.m['구울'] = { met: 1, kill: 0 }; s2.party = ['archer']; s2.up = { cls: 4 }; s2.roster.archer = { m: D.member(f0, 'archer', 3), tr: [] };
  t('레인저(사냥꾼의 지식, 3레벨)가 파티에 있으면 만난 것만으로', D.affKnown(s2, '구울') && !D.affKnown({ ...s2, party: [] }, '구울'));
  t('주 피해 유형이 저항에 막히면 ▼ · 취약을 찌르면 ▲', D.edgeOf(s, { ...s.roster.dragoon.m }, ['해골']) !== undefined);
}
// 사건의 직업 선택지: 열두 직업의 실제 영웅 (옛 다섯 직업 표 대신)
{ const F = (G.newState(), G.S.w.fantasy), H = (c, lv) => D.member(F, c, lv), M = h => ({ hero: h, n: h.name, uid: h.uid, cls: G.Party.RUN_CLS[h.cls], dead: false, hp: 20, max: 20, sl: {} });
  const sc = (party, id) => { const st = { party: party.map(M), items: {}, xcd: {}, rng: () => 0.5, log: [], gold: 99, flags: {}, here: {}, at: 0, map: { nodes: [{ id: 0, notes: [] }], edges: [] } }; return RUN.eventScene(st, st.map.nodes[0], id).map(c => c.n); };
  const a1 = sc([H('mage', 3)], 'altar'), a2 = sc([H('warlock', 3)], 'toll'), a3 = sc([H('rogue', 3)], 'captive');
  t('비전 주문 직업(소서러) → 위저드 몫 · 없는 몫은 [능력] ???', a1.some(n => /^\[소서러\] 문양 속 지도를 읽는다/.test(n)) && a1.some(n => /^\[(신성|도둑 도구|운동|생존)\] \?\?\?$/.test(n)), a1);
  t('워락도 비전 몫 (불꽃으로 겁준다)', a2.some(n => /^\[워락\] 손바닥에 불꽃/.test(n)), a2);
  t('도둑 도구가 있는 로그 → 자물쇠를 딴다', a3.some(n => /^\[로그\] 자물쇠를 딴다/.test(n)), a3);
  t('사건 수는 그대로 다섯', RUN.EVENTS.length === 5, RUN.EVENTS.length);
}
// 기습당함: 탐사 규칙이 굴린 값을 방에 남긴다 (원정의 실제 전투가 보고 적 선공 — crawl.js enterFight)
{ const s = D.fresh(), mk = () => { const st = RUN.newRun(D.floorSeed(s, 3), ['fighter', 'cleric'], 3); st.rng = () => 0; return st; };
  const go = (st, info) => { const e = st.map.edges.find(q => q.a === 0 && st.map.nodes[q.b].hostile && st.map.nodes[q.b].type !== 'boss'); const n = st.map.nodes[e.b]; n.info = info; n.alert = false; e.kind = 'open'; RUN.moveActs(st, e)[0].run(); return n; };
  const n1 = go(mk(), 0), n2 = go(mk(), 2); t('모르고 들어서면 기습 시도가 방에 남는다(원정은 실제 전투가 매복 살피기로 가린다 — 「기습당함」 메모는 거기서) · 미리 알았으면 없다', n1.surprisedNow === true && !n1.notes.some(q => /기습당함/.test(q.t || q)) && n2.surprisedNow === false, [n1.surprisedNow, n2.surprisedNow]);
  const X0 = RUN.X; RUN.X = null; const n3 = go(mk(), 0); RUN.X = X0; t('옛 탐사 게임은 그대로 「기습당함」 메모', n3.surprisedNow && n3.notes.some(q => /기습당함/.test(q.t || q))); }
// 선공 한 줄: 결과(첫 라운드 선공)와 반대되는 낱말이 섞이지 않는다
{ const W = [null, 'dark', 'ambush', 'look', 'sleep', 'x'], foes = W.map(w => D.firstLineOf('foes', w)), party = W.map(w => D.firstLineOf('party', w));
  t('적 선공이면 「우리 선공 · 먼저 봤다」가 없다 · 우리 선공이면 「기습당함 · 적 선공」이 없다 · 정해지지 않으면 줄 없음', foes.every(x => /적 선공$/.test(x) && !/우리|먼저 봤다/.test(x)) && party.every(x => /우리 선공$/.test(x) && !/기습당함|적 선공/.test(x)) && W.every(w => D.firstLineOf(null, w) === ''), [foes, party]); }
// 주운 마법 무기는 무기 칸에 (상태창 · 수치도 무기로)
{ const s = D.fresh(); s.party = ['dragoon']; const map = { w: 10, h: 10, c: new Array(100).fill('.') };
  G.newState(); const f0 = G.S.w.fantasy; s.roster.dragoon = { m: D.member(f0, 'dragoon', 3), tr: [] };
  const st = RUN.newRun(3, ['fighter'], 1), { f, r } = D.world(s, map); D.outfit(st, r, s); const m = r.party[0].merc, hit0 = G.Dnd.hit({ merc: m }), wk = G.SRD.eq(m).w;
  D.POL.gear(f, [m], [{ kind: 'art', k: 'it_weapon_1', base: wk }], 3); const wr = G.Gear.worn(f, m).find(q => q.slot === 'w');
  t('규칙: 주운 +1 무기는 무기 칸 (장신구 칸이 아님) · 실제 명중 +1', /\+1/.test(wr.n) && G.Gear.worn(f, m).filter(q => /^t/.test(q.slot)).every(q => q.empty) && G.Dnd.hit({ merc: m }) === hit0 + 1, [wr.n, hit0, G.Dnd.hit({ merc: m })]);
  D.bank(s, f); const Q = D.sheetOf(s.roster.dragoon);
  t('길드 상태창: 그 물건은 무기 칸(w) · 명중 · 기본 공격 피해에 +1 (원정 전투와 같은 값)', Q.items.length === 1 && Q.items[0].slot === 'w' && Q.hit === hit0 + 1 && G.Trinket.all(G.S.w.fantasy).every(t => t.on !== -9001), [Q.items.map(x => x.slot), Q.hit, hit0]);
}
// 빌드는 영입할 때 고르고 고정: 고른 빌드로 들어오고 · 고르는 단계 없이 들어오면 기본 빌드
{ const F = (G.newState(), G.S.w.fantasy), L = D.soloBuilds('paladin'), b2 = L[L.length - 1];
  const m = D.member(F, 'paladin', 3, Math.random, b2.id), s = D.fresh(); s.party = ['dragoon']; const { f } = D.world(s, { w: 10, h: 10, c: new Array(100).fill('.') });
  t('영입: 고른 빌드로 들어온다 · 기본 빌드는 목록의 첫째 · 다중 직업 빌드는 후보에 없다', m.build === b2.id && s.roster.dragoon.m.build === D.soloBuilds('dragoon')[0].id && L.length > 1 && L.every(b => !b.mc), [m.build, s.roster.dragoon.m.build]); }
// 전투 방 하나를 세워 보는 시험 (고블린 전사 셋): 배속 · 스킬 예외 뒤처리
{ const RM = { id: 'A', x: 2, y: 2, w: 16, h: 10, cx: 10, cy: 7, tags: ['hall'] }, W = 20, Hh = 14, c = new Array(W * Hh).fill('#'); for (let y = 2; y < 12; y++) for (let x = 2; x < 18; x++) c[y * W + x] = '.';
  const rig = first => { const map = { w: W, h: Hh, c, kindAt: new Uint8Array(W * Hh), poi: {}, passChars: '.>,', ver: 1, dist: {}, rooms: [RM], start: RM, end: RM, fixed: true };
    G.newState(); const f0 = G.S.w.fantasy, s = D.fresh(); for (const k of ['dragoon', 'cleric']) s.roster[k] = { m: D.member(f0, k, 5), tr: [] }; s.party = ['dragoon', 'cleric']; s.up = { seat: 0, cls: 1 };
    const st = RUN.newRun(3, ['fighter', 'cleric'], 1), { f, r } = D.world(s, map); D.outfit(st, r, s); r.party.forEach((p, i) => { p.x = 4 + i; p.y = 7; });
    const ms = [0, 1, 2].map(i => G.Fantasy.spawnMon(r, 1, { n: '고블린 전사', ...G.D.F.mon['고블린 전사'] }, 14, 5 + i * 2, false, { aggro: true, spotted: true, major: true })); G.Fantasy.refreshEnts(r);
    r.nextFirst = first; return { f, r, ms }; };
  const sm0 = G.Turn.smooth; G.Turn.smooth = true;
  { const s = D.fresh(); s.up = Object.fromEntries(D.TREE.map(q => [q.id, q.cost.length])); s.roster.dragoon = { m: D.member(G.S.w.fantasy, 'dragoon', 3), tr: [] }; const mk = () => ({ w: W, h: Hh, c, kindAt: new Uint8Array(W * Hh), poi: {}, passChars: '.>,', ver: 1, dist: {}, rooms: [RM], start: RM, end: RM, fixed: true });
    const a = D.world(s, mk()).f.turnX; s.spdX = 4; const b = D.world(s, mk()).f.turnX; t('배속: 처음엔 연 것 중 가장 빠른 것 · 고른 배속은 기억', a === 8 && b === 4, [a, b]); }
  { const { f, r } = rig(null), p = r.party[1], S = G.Skill.SK.sr_cure, w0 = S.when, r0 = S.run; for (let k = 0; k < 6; k++) G.tick(0.05); S.when = () => true; S.run = () => { throw new Error('대상 없음'); }; p.plan = null; p.slotUsed = false; p.merc.cdK = {}; let threw = false; const a0 = G.Guild.active; G.Guild.active = () => ['sr_cure']; try { G.Skill.tick(f, r, p, 0, [], S.bonus ? 1 : undefined); } catch (x) { threw = true; } finally { S.when = w0; S.run = r0; G.Guild.active = a0; }
    t('스킬이 중간에 터져도 피해 종류가 남지 않는다', threw && !G.Foe.dtype && !G.Skill.dtOver && !G.Skill.maxDice, [threw, G.Foe.dtype]); }
  G.Turn.smooth = sm0;
}
// 원정 결과 집계 (2026-11-23, 보고서)
{ const s = D.fresh(); s.party = ['dragoon', 'cleric']; s.up = { seat: 0, cls: 1 }; const map = { w: 10, h: 10, c: new Array(100).fill('.') };
  G.newState(); const f0 = G.S.w.fantasy; for (const c of ['dragoon', 'cleric']) s.roster[c] = { m: D.member(f0, c, 3), tr: [] };
  const st = RUN.newRun(3, ['fighter', 'cleric'], 1), { f, r } = D.world(s, map); D.outfit(st, r, s);
  const [pf, pc] = r.party, mo = G.Fantasy.spawnMon(r, 1, { n: '오우거', ...G.D.F.mon['오우거'] }, 5, 5, false, { major: true }), h0 = mo.hp;
  G.Fantasy.hurt(f, r, mo, 7, 'hit', { merc: pf.merc }); t('준 피해가 영웅에게 쌓인다', Math.round(st.stat.h.dragoon.dmg) === h0 - mo.hp && h0 - mo.hp > 0, st.stat.h.dragoon);
  const sum = { kind: 'sum', by: pc }; G.Fantasy.hurt(f, r, mo, 5, 'hit', sum); t('소환수의 피해는 주인에게', st.stat.h.cleric.dmg > 0, st.stat.h.cleric);
  const b = pc.hp; G.Fantasy.hurtMember(f, r, pc, 6, null); t('받은 피해', Math.round(st.stat.h.cleric.took) === b - pc.hp && b > pc.hp, st.stat.h.cleric);
  r.turn = { cur: pc, round: 1 }; D.statTick(st, r); pc.hp += 4; D.statTick(st, r); t('회복 = 그 차례 영웅의 몫 · 전투 수', Math.round(st.stat.h.cleric.heal) === 4 && st.stat.fights === 1, st.stat);
  pc.max += 5; pc.hp += 5; D.statTick(st, r); t('레벨업으로 늘어난 체력은 회복이 아니다', Math.round(st.stat.h.cleric.heal) === 4); r.turn = null;
  G.Fantasy.hurt(f, r, mo, 9999, 'hit', { merc: pf.merc }); t('처치 수 · 처치한 적 수', st.stat.h.dragoon.kills === 1 && st.stat.foes === 1, st.stat);
  t('끝난 이유: 전멸 · 용 처치 · 귀환(경로 끝 · 짐 · 위험 · 직접)', D.endWhy({ done: 'lose' }, 'plan') === 'lose' && D.endWhy({ done: 'win' }) === 'win' && D.endWhy({}, 'plan') === 'plan' && D.endWhy({}, 'quit') === 'quit' && D.endWhy({}) === 'back');
}

// ── 2026-11-27: 층 생성 (긴 방 · 10방쯤) · 한 판 = 한 층의 물자 · 지나온 방 건너뛰기 · 전투 전 배치 ──
// 층 생성: 1~10층 모두 방 10~12 · 입구 → 우두머리 5걸음 · 문 · 복도가 정수 칸 (짝수 변 방의 가운데 문이 x.5 칸에 놓여 문 잇기가 끝나지 않던 것)
{ const badG = [];
  for (let fl = 1; fl <= 10; fl++) for (let k = 0; k < 6; k++) { const m = RUN.gen.make(D.floorSeed({ mapSeed: 500 + k * 131 }, fl), fl), N = m.nodes, boss = N.find(q => q.type === 'boss'), d = D.reach({ map: m }, 0).d;
    if (N.length < 10 || N.length > 12) badG.push(`${fl}층 ${k} 방 ${N.length}`);
    if (d.get(boss.id) !== 5) badG.push(`${fl}층 ${k} 직행 ${d.get(boss.id)}`);
    for (const e of m.edges) { const c = m._lay.cor[e.id]; if (![...c.cells, c.doorA, c.doorB].flat().every(Number.isInteger)) badG.push(`${fl}층 ${k} 길${e.id} 소수 칸`); }
    for (const id in m._lay.room) { const r = m._lay.room[id]; if (N[id].type !== 'boss' && N[id].type !== 'start' && (Math.min(r.w, r.h) !== 5 || Math.max(r.w, r.h) < 6 || Math.max(r.w, r.h) > 7)) badG.push(`${fl}층 ${k} 방${id} ${r.w}×${r.h}`); } }
  t('층 생성 (1~10층 · 씨앗 6개씩): 방 10~12 · 입구 → 우두머리 5걸음 · 방은 폭 5 × 깊이 6~7칸 · 문 · 복도는 정수 칸', !badG.length, badG.slice(0, 6).join(' / ')); }
// 길 찾기 · 지나온 방 건너뛰기 (G.Dive.routes): 가 본 방만 거쳐 닿는 방 · 드는 물자 = 옮기는 방 수
{ const s = D.fresh(), st = RUN.newRun(D.floorSeed(s, 3), ['fighter', 'cleric'], 3), N = st.map.nodes, E = st.map.edges, nb = id => E.filter(e => (e.a === id || e.b === id) && e.kind !== 'hidden').map(e => (e.a === id ? e.b : e.a));
  N.forEach(q => { q.visited = false; }); N[0].visited = true; st.at = 0; E.forEach(e => { if (e.kind === 'locked') e.opened = true; }); // 문은 모두 열어 두고 (못 넘는 문은 위의 재주 시험이 본다)
  const r0 = D.routes(st); t('길: 입구에서는 이웃 방만 (물자 1씩)', r0.length === nb(0).length && r0.every(r => r.cost === 1 && r.path.length === 1 && nb(0).includes(r.to)), JSON.stringify(r0));
  // 큰길을 두 방 걷고(0 → a → b) 막다른 곁방 x에 들어간 뒤: x에서 가 본 방을 거쳐 갈 수 있는 방
  const side = N.filter(q => q.side && nb(q.id).length === 1), x = side.find(q => !nb(q.id).includes(0)) || side[0], a = nb(x.id)[0], hid = E.find(e => e.kind === 'hidden');
  const back = D.reach(st, 0).prev; for (let k = a; k != null; k = back.get(k)) N[k].visited = true; x.visited = true; st.at = x.id;
  const rs = D.routes(st), seen = new Set(N.filter(q => q.visited).map(q => q.id)), adj = (p, q) => nb(p).includes(q);
  t('길: 경로는 지금 방에서 이어지고 사이의 방은 모두 가 본 방 · 물자 = 방 수', rs.length > 1 && rs.every(r => r.cost === r.path.length && r.path[r.path.length - 1] === r.to && adj(x.id, r.path[0]) && r.path.every((id, i) => (i === r.path.length - 1 || seen.has(id)) && (!i || adj(r.path[i - 1], id)))), JSON.stringify(rs));
  const far = rs.filter(r => !seen.has(r.to)); t('길: 막다른 방에서 가 본 방 너머의 안 가 본 방을 바로 (물자 2 이상) · 안 가 본 방 너머는 못 고른다', far.length > 0 && far.every(r => r.cost >= 2 && seen.has(r.path[r.path.length - 2])) && rs.every(r => seen.has(r.to) || nb(r.to).some(id => seen.has(id))) && N.filter(q => !seen.has(q.id) && !nb(q.id).some(id => seen.has(id))).every(q => !rs.some(r => r.to === q.id)), JSON.stringify(far));
  t('길: 가 본 방도 고를 수 있다 (거기서 멈춘다) · 가까운 순', rs.some(r => r.to === 0 && r.cost === D.reach(st, x.id, id => seen.has(id)).d.get(0)) && rs.every((r, i) => !i || r.cost >= rs[i - 1].cost));
  if (hid) { const o = hid.a === 0 || N[hid.a].visited ? hid.b : hid.a; N[hid.a].visited = N[hid.b].visited = false; N[o === hid.a ? hid.b : hid.a].visited = true; st.at = o === hid.a ? hid.b : hid.a; const q0 = D.routes(st).some(r => r.to === o && r.cost === 1); hid.seen.hidden = true; t('길: 못 찾은 숨은 통로는 길이 아니다 · 찾으면 길', !q0 && D.routes(st).some(r => r.to === o && r.cost === 1)); }
  t('우두머리 방까지 걸음', D.toBoss({ map: RUN.newRun(D.floorSeed(s, 5), ['fighter'], 5).map, at: 0 }) === 5); }
// 물자와 자동 선택: 곧장 가면 남고 다 돌면 모자란다 · 모자라면 굶으러 가지 않고 우두머리 쪽으로
{ const s = D.fresh(), walk = (fl, camp, seed = 0) => { const st = RUN.newRun(D.floorSeed({ mapSeed: 900 + seed }, fl), ['fighter', 'cleric'], fl), N = st.map.nodes, E = st.map.edges; D.recall(st, s); st.items = { camp, torch: 0 }; N.forEach(q => { q.hostile = false; }); let moves = 0, starve = 0;
    for (let k = 0; k < 60 && N[st.at].type !== 'boss'; k++) { const opts = E.filter(e => (e.a === st.at || e.b === st.at) && (e.kind !== 'hidden' || e.seen?.hidden)).map(e => ({ e, ed: e, to: e.a === st.at ? e.b : e.a })), j = D.POL.fork(st, opts);
      st.at = opts[j].to; N[st.at].visited = true; moves++; if (st.items.camp > 0) st.items.camp--; else starve++; }
    return { moves, starve, seen: N.filter(q => q.visited).length, all: N.length, boss: N[st.at].type === 'boss', tour: tour(st.map) }; };
  // 입구에서 모든 방을 들르고 우두머리 방에서 끝나는 가장 짧은 걸음 (우두머리 방에 들어서면 판이 끝난다)
  const tour = M => { const n = M.nodes.length, boss = M.nodes.find(q => q.type === 'boss').id, adj = M.nodes.map(() => []), full = (1 << n) - 1, dist = new Map([[1, 0]]), q = [[0, 1]]; for (const e of M.edges) { adj[e.a].push(e.b); adj[e.b].push(e.a); }
    for (let h = 0; h < q.length; h++) { const [a, m] = q[h], d = dist.get(a * 65536 + m); if (a === boss) { if (m === full) return d; continue; } for (const b of adj[a]) { const m2 = m | (1 << b), k = b * 65536 + m2; if (!dist.has(k)) { dist.set(k, d + 1); q.push([b, m2]); } } } return -1; };
  const L = []; for (let fl = 1; fl <= 10; fl++) for (const sd of [0, 77]) L.push([fl, walk(fl, D.CAMP_FREE, sd), walk(fl, 5, sd), walk(fl, 2, sd)]);
  t('물자: 공짜 몫 9 — 곧장 가면(5걸음) 야영 한 번 몫이 남고, 다 돌려면(13걸음 이상) 모자란다 (1~10층)', D.CAMP_FREE === 9 && D.CAMP_FREE - 5 >= D.REST && L.every(([, a]) => a.tour > D.CAMP_FREE + 3), JSON.stringify(L.map(q => [q[0], q[1].tour])));
  t('자동 선택: 공짜 몫으로 굶지 않고 우두머리 방에 닿는다 (1~10층)', L.every(([, a]) => a.boss && !a.starve && a.moves <= D.CAMP_FREE), JSON.stringify(L.map(q => [q[0], q[1].moves, q[1].starve, q[1].seen])));
  t('자동 선택: 물자가 딱 5면 곧장 5걸음 · 굶지 않는다', L.every(([, , b]) => b.boss && b.moves === 5 && !b.starve), JSON.stringify(L.map(q => [q[0], q[2].moves, q[2].starve])));
  t('자동 선택: 물자가 모자라도(2) 곁방으로 새지 않고 곧장 — 굶는 걸음은 3뿐', L.every(([, , , c]) => c.boss && c.moves === 5 && c.starve === 3), JSON.stringify(L.map(q => [q[0], q[3].moves, q[3].starve])));
  const st = RUN.newRun(D.floorSeed(s, 3), ['fighter', 'cleric'], 3); st.items = { camp: 4 }; st.party.forEach(m => { m.hp = 1; }); st.map.nodes[0].hostile = false;
  t('야영: 쉬고 나면 우두머리 방까지 갈 물자가 안 남을 때는 쉬지 않는다', D.canCamp(st) && !D.wantCamp(s, st) && (st.items.camp = 8, D.wantCamp(s, st))); }
// 전투 전 배치: 어느 방 · 어느 문으로 들어서도 구역에 다섯이 선다 (근접 앞줄 · 나머지 뒷줄) · 옮긴 자리는 기억
{ const s = D.fresh(); s.deep = 4; s.up.cls = 11; s.party = ['dragoon', 'cleric', 'mage', 'paladin', 'rogue']; const badD = []; let Z1 = null, P1 = null;
  for (const fl of [1, 3, 5, 9]) { const m = RUN.gen.make(D.floorSeed(s, fl), fl), { iso, roomAt } = G.Floor.fromRun(m), { r } = D.world(s, iso), ps = r.party;
    if (ps.length !== 5) badD.push(`${fl}층 파티 ${ps.length}`);
    for (const e of m.edges) { const c = m._lay.cor[e.id]; for (const [id, out] of [[e.b, c.cells[c.cells.length - 1]], [e.a, c.cells[0]]]) { const Z = D.depZone(iso, roomAt, id, G.Floor.tile(out)), F = D.depForm({}, ps, Z), ts = [...F.values()], dep = t0 => t0[0] * Z.ax[0] + t0[1] * Z.ax[1];
        if (F.size !== 5 || new Set(ts.map(String)).size !== 5 || !ts.every(t0 => roomAt[t0[1] * iso.w + t0[0]] === id && iso.c[t0[1] * iso.w + t0[0]] === '.' && dep(t0) - Z.d0 < D.DEP.D)) badD.push(`${fl}층 방${id} 자리 ${F.size}`);
        const fr = ps.filter(p => G.Dnd.melee(p)), bk = ps.filter(p => !G.Dnd.melee(p)); if (fr.length && bk.length && Math.min(...fr.map(p => dep(F.get(p)))) < Math.max(...bk.map(p => dep(F.get(p))))) badD.push(`${fl}층 방${id} 줄`);
        if (fl === 3 && !Z1) { Z1 = Z; P1 = ps; } } } }
  t('배치: 1 · 3 · 5 · 9층의 모든 방 · 모든 문에서 다섯이 배치 구역(입구 쪽 4타일)의 서로 다른 칸에 · 근접은 앞줄', !badD.length, badD.slice(0, 6).join(' / '));
  const F0 = D.depForm(s, P1, Z1), me = P1.find(p => G.Dnd.melee(p)), ca = P1.find(p => !G.Dnd.melee(p)), a0 = F0.get(me), b0 = F0.get(ca); F0.set(me, b0); F0.set(ca, a0); D.depSave(s, Z1, F0);
  const F1 = D.depForm(D.load(D.dump(s)), P1, Z1); t('배치: 옮긴 자리(줄 · 줄 안 차례)는 저장에 남아 다음 전투의 기본 진형', s.form[me.merc.cls][0] === 'b' && s.form[ca.merc.cls][0] === 'f' && String(F1.get(me)) === String(b0) && String(F1.get(ca)) === String(a0), JSON.stringify(s.form)); }

console.log(`dive_rules: 통과 ${ok} · 실패 ${bad}`);
process.exit(bad ? 1 : 0);
