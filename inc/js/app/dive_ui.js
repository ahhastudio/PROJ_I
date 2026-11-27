'use strict';
// 원정 모드 화면 (dive.html — 규칙은 js/game/dive.js): 길드(금화 · 명단 · 해금 트리 · 파티 · 출발 층) → 자동 탐사(js/app/crawl.js의 층을 정책이 대신 고르며 돈다, 전투는 전부 AI) → 길드(지난 판 결과 + 자동 재출발 카운트다운).
// - 원정 한 판 = 화면 한 번: 출발을 누르면 이 탭에 적어 두고(sessionStorage GO) 화면을 다시 연다 — boot.js가 DIVEUI.world()로 그 파티의 탐사 층을 세운다 (선술집과 같은 길).
// - 탐사가 묻는 곳은 CRAWL.policy(G.Dive.POL + 여기의 기다림 · 끝 · 계단)가 고른다. 플레이어가 누르는 것은 배속 · 「돌아가기」뿐.
// - 운명판 칸(side.js) · 위 바(hud.js) 대신 이 파일의 바 (층 · 구역 · 금화 · 물자 · 파티 체력).
// - 방치형으로 켜 두기 (2026-11-22): 「작은 창으로」(팝업) · 자리를 비운 동안의 정산(G.Dive.settle — 다시 열 때 · 창이 다시 보일 때) · 도감 · 자동 재출발 기본 켬.
// - 시험용 주소: ?save=max (트리를 다 열고 9층까지 깬 저장 + 파티 다섯 · ?lv=N 레벨, 기본 14) · ?save=new (새 저장) · ?go=1 (바로 출발) · ?floor=N (그 층에서 시작 — crawl.js)
const DIVEUI = (() => {
  // 전체 화면 (2026-11-25 사용자: 「가로모드테스트하려니까 인터넷주소창때문에 스마트폰 전체화면으로 못하네」): 지원하는 브라우저(안드로이드 크롬 등)에서만 단추가 보인다 — 누르면 전체 화면 + 가로 고정.
  // 아이폰 사파리는 이 기능이 없어 「홈 화면에 추가」로 연다 (dive.html의 manifest · apple-mobile-web-app-capable). 이미 그렇게 열렸으면 단추를 숨긴다
  const fsOk = () => !!document.fullscreenEnabled && !matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
  const fsBtn = () => (fsOk() ? '<button class="chip dv-fsb" aria-label="전체 화면"><svg viewBox="0 0 12 12" width="12" height="12"><path d="M1 4V1h3M8 1h3v3M11 8v3H8M4 11H1V8" fill="none" stroke="currentColor" stroke-width="2"/></svg></button>' : '');
  document.addEventListener('click', ev => { if (!ev.target.closest?.('.dv-fsb')) return; ev.stopPropagation();
    if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).then(() => screen.orientation?.lock?.('landscape')).catch(() => {}); }, true);
  const { $, esc } = UI, D = G.Dive, ON = typeof DIVE_MODE !== 'undefined' && !!DIVE_MODE, GO = 'inc.dive.go';
  const get = () => { try { return D.load(localStorage.getItem(D.KEY)); } catch (e) { return D.fresh(); } };
  const put = s => { try { localStorage.setItem(D.KEY, D.dump(s)); } catch (e) { /* 저장 못 해도 판은 돈다 */ } };
  const flag = (v) => { try { if (v === undefined) { const x = sessionStorage.getItem(GO); sessionStorage.removeItem(GO); return !!x; } sessionStorage.setItem(GO, '1'); } catch (e) { return false; } };
  const clsN = c => G.Guild.def({ cls: c })?.n || c;
  const spd = () => G.Turn.speed(G.S.w.fantasy) || 1;
  const MINI = 'inc-dive', POP = 'popup=yes,width=420,height=760'; // 작은 창의 이름 · 크기 (폰 세로쯤)
  let S = null, R = null, run = null, on = false, away = null, cd = null; // cd: 길드의 자동 재출발 카운트다운 { res: 지난 판, n: 남은 초, stop }
  // boot.js가 부른다: 저장을 읽고, 출발이면 그 파티의 탐사 층 · 아니면 길드 뒤에 깔 빈 방
  function world() {
    S = get();
    if (q.get('save') === 'new') S = D.fresh();
    D.hook(); // 5~10층 구역 · 경험치 배율 · 레벨업 저절로 (층을 세우기 전에)
    if (q.get('save') === 'max') { for (const t of D.TREE) S.up[t.id] = t.cost.length; S.deep = 9; G.newState(); S.roster = {}; S.start2 = null; S.party = ['dragoon', 'cleric', 'mage', 'paladin', 'rogue'].map(c => D.addHero(S, D.member(G.S.w.fantasy, c, +q.get('lv') || 14))); }
    if (q.get('save')) put(S);
    if (!G.S?.w) G.newState(); // 정산의 레벨업이 엔진 상태를 읽는다 (세계는 아래 D.world가 새로 세운다)
    D.ensure(S); put(S); // 새 저장: 첫 두 영웅 (1성)
    away = D.settle(S, Date.now()); put(S); // 자리를 비운 동안의 정산 (1분 미만이면 0 — 원정마다 화면을 다시 여는 사이)
    if (!(flag() || q.get('go'))) return D.world(S, TestFloor.build('fight'));
    run = { t0: performance.now(), over: false, start: +q.get('floor') || D.startFloor(S), blk: {}, ex0: Object.fromEntries(Object.keys(S.maps).map(f => [f, D.explored(S, +f)[0]])) }; // blk: 층마다 경로가 잠긴 문에 막힌 수 · ex0: 출발 때 층마다 들어가 본 방 수
    return D.world(S, CRAWL.start(D.floorSeed(S, run.start), D.teamCls(S), run.start)); // 층 지도는 (기준 씨앗, 층)으로 고정
  }
  function attach(r) {
    R = r; on = true; document.body.classList.add('dive'); if (typeof setZoom === 'function') setZoom(HUD.zoom(false), true); watch(); if (away?.gold) awayBox(away);
    if (!run) { FXUI.attach(R); PMAP.hide(); return guild(); }
    CRAWL.policy = { ...D.POL, waves: D.waves, routeWin, slots: (Z, ps) => D.depForm(S, ps, Z), deploy: depWin, wantRest: st => D.wantCamp(S, st), chest: k => chestShow(k), busy: () => !!$('dv-card') || !!$('dv-ev') || !!$('dv-fork') || gateBusy(), event: (st, sc) => D.evDecide(S, st, sc), eventWin: (st, sc, pick) => evAuto(st, sc, pick), wait: () => 1500 / spd(), end: finish, note };
    PMAP.view = st => D.drawState(S, st); // 원정 중 지도 = 지도 기억 + 이번 판
    PMAP.render = (box, st, big) => { if (!box) return; box.querySelector('#pmap')?.style.setProperty('display', 'none'); let w = box.querySelector('.dvpmw'); if (!w) { w = document.createElement('div'); w.className = 'dvpmw'; box.append(w); const t = document.createElement('b'); t.className = 'dvpm-t'; box.append(t); }
      const V = D.drawState(S, st), ex = D.explored(S, st.floor); box.querySelector('.dvpm-t').textContent = `${RUN.zone(st.floor).n} · ${st.floor}층${ex ? ` · 탐사 ${ex[0]}/${ex[1]}` : ''}`; // 큰 지도 머리는 칸 밖(위)에 따로
      DIVEMAP.mount(w, V, { plan: null, trail: st.path, fail: [], camp: [], S, gateInfo: q0 => D.gateInfo(S, V, q0), here: st.at, mini: !big, dark: true }); }; // 원정 중 지도: 작게 = 방 · 지금 위치 · 계획 점선 · 발자국 / 크게 = 길드 지도와 같은 그림
    PMAP.bigBox = (svg, st) => { // 크게 본 지도: 아는 곳 + 계획한 길에 맞춘 틀 (길드 지도와 같은 방식, 칸 비율에 맞춰 넓힌다)
      const V = D.drawState(S, st), L = st.map._lay, cs = [], add = id => { const r = L.room[id]; cs.push([r.x, r.y], [r.x + r.w, r.y + r.h]); };
      V.map.nodes.forEach(q => { if (q.visited || q.seenMap || q.info >= 2) add(q.id); }); (st.plan || []).forEach(add); add(st.at);
      const xs = cs.map(c => c[0]), ys = cs.map(c => c[1]); let x0 = M6 + (Math.min(...xs) - 2) * T13, y0 = M6 + (Math.min(...ys) - 4) * T13, w = (Math.max(...xs) - Math.min(...xs) + 4) * T13, h = (Math.max(...ys) - Math.min(...ys) + 6) * T13;
      const ar = (svg.clientWidth || 1) / (svg.clientHeight || 1); if (w / h < ar) { const nw = h * ar; x0 -= (nw - w) / 2; w = nw; } else { const nh = w / ar; y0 -= (nh - h) / 2; h = nh; }
      return `${x0.toFixed(1)} ${y0.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`; };
    CRAWL.attach(r); D.outfit(CRAWL.st, R, S); zoomInit(); run.lv0 = Object.fromEntries(Object.entries(S.roster).map(([c, h]) => [c, h.m.lv])); run.lootN = 0; run.skills = []; run.seen = snap();
    run.team = R.party.filter(p => p.merc).map(p => p.merc.hid); run.xp0 = Object.fromEntries(run.team.map(c => [c, D.totalXp(S.roster[c]?.m || {})])); run.sup0 = { torch: CRAWL.st.items.torch || 0, camp: CRAWL.st.items.camp || 0 }; // 결과 보고서의 기준
    document.body.dataset.dive = 'run'; put(S); // 명단에 새로 들인 영웅 · 도감의 빌드
  }
  // ── 원정 끝 (전멸 · 승리 · 돌아가기): 판에서 번 금화 + 깬 층 보너스 → 길드 ──
  function finish(st, why = '') {
    if (run.over) return; run.over = true; $('dv-ev')?.remove();
    const min = Math.round((performance.now() - run.t0) / 6000) / 10;
    D.remember(S, st);
    const ex1 = D.explored(S, st.floor), maps = ex1 ? [[st.floor, ex1[0], ex1[1], ex1[0] - (run.ex0[st.floor] || 0), run.blk[st.floor] || 0]] : []; // 이 층의 탐사 (새로 밝힌 수 · 막힌 잠긴 문) — 한 판 = 한 층
    logPoll(); S.lastLog = (run.log || []).slice(-200); // 지난 판 로그 (길드에서 지난 판 결과를 펼치면)
    // 사망: 엔진에서 죽은(dead) 영웅 · 전멸이면 전원. 살아 돌아오면 짐 속 전리품이 금화, 전멸하면 잃는다
    const lose = st.done === 'lose', deadC = lose ? D.team(S) : R.party.filter(p => p.merc && p.dead).map(p => p.merc.hid);
    for (const c of deadC) S.dead[c] = true;
    const loot = (st.loot || []).filter(e => !e.dropped), lootG = lose ? 0 : D.lootGold(st), gemN = loot.filter(e => e.gem).reduce((a, e) => a + (e.cnt || 1), 0);
    const stashSold = D.settleRun(S, st, G.S.w.fantasy, lose, R.party.filter(p => p.merc && p.dead && !lose).map(p => p.merc)); // 짐 → 창고 · 전멸이면 짐 → 그 방 바닥 · 죽은 영웅의 마법 물건 → 쓰러진 방 바닥 (bank 전에)
    const f = G.S.w.fantasy, xp = D.bank(S, f), ups = Object.entries(S.roster).filter(([c, h]) => h.m.lv > (run.lv0[c] || 0)).map(([c, h]) => [h.m.name, run.lv0[c], h.m.lv]), won = st.done === 'win', cleared = won ? st.floor : 0, /* 한 판 = 한 층: 우두머리를 잡았으면 그 층을 깼다 · 못 잡았으면 깬 층 없음 */ earned = st.gold - (st.gold0 ?? 0) + lootG + stashSold, deep0 = S.deep, g = D.finish(S, cleared, earned, min, run.start, xp); S.seen = Date.now(); put(S);
    document.body.dataset.dive = won ? 'won' : 'result'; document.body.dataset.diveMin = min;
    const items = D.LOOT.filter(e => e.r >= 1).map(e => ({ ...e }));
    const res = { maps, items, skills: run.skills.slice(), won, how: won ? (st.floor >= D.LAST ? '붉은 고룡을 쓰러뜨렸다' : '승리') : st.done === 'lose' ? '전멸' : '귀환', start: run.start, floor: st.floor, g, earned: Math.max(0, earned), bonus: D.bonusTo(cleared, run.start), min, ups, best: cleared > deep0, lootN: loot.filter(e => !e.gem).length, gemN, lootG, lost: lose && loot.length > 0,  deadN: deadC.length };
    // 결과 보고서 (2026-11-23): 끝난 이유 · 얻은 것 · 잃은 것 · 쓴 물자 · 영웅마다 레벨 · 경험치 · 피해 · 회복 · 처치 (집계는 D — st.stat)
    const stt = st.stat || { h: {}, fights: 0, foes: 0 }, fin = R.party.filter(p => p.merc), gemL = {};
    for (const e of loot.filter(e => e.gem)) { const q = gemL[e.n] = gemL[e.n] || [e.n, 0, e.gold, e.gem]; q[1] += e.cnt || 1; }
    const exN = D.explored(S, st.floor);
    res.rep = { why: D.endWhy(st, why), start: run.start, floor: st.floor, min, rooms: maps.reduce((a, q) => a + q[3], 0), ex: exN ? Math.round(100 * exN[0] / Math.max(1, exN[1])) : 0, g, earned: Math.max(0, st.gold - (st.gold0 ?? 0)), lootG, bonus: res.bonus,
      gems: Object.values(gemL), items, lost: lose ? loot.map(e => [e.n, e.gem ? e.cnt || 1 : 1, e.gem ? 0 : e.r || 0]) : [], sup: Object.fromEntries(['torch', 'camp'].map(k => [k, Math.max(0, (run.sup0?.[k] || 0) - (st.items[k] || 0))])),
      rev: deadC.map(c => [S.roster[c]?.m?.name || '?', D.reviveCost(S, c)]), gold: S.gold, chest: run.chest || null, fights: stt.fights, foes: stt.foes,
      heroes: (run.team || []).map(c => { const m = S.roster[c]?.m || {}, q = stt.h[c] || {}, p = fin.find(x => x.merc.hid === c); return { c, n: m.name || '?', lv0: run.lv0[c] || m.lv, lv1: m.lv, xp: Math.max(0, Math.round(D.totalXp(m) - (run.xp0?.[c] || 0))), dmg: Math.round(q.dmg || 0), took: Math.round(q.took || 0), heal: Math.round(q.heal || 0), kills: q.kills || 0, downs: q.downs || 0, tk: q.tk || null, dead: !!S.dead[c], down: !!p?.dead && !S.dead[c] }; }) };
    S.lastRep = res.rep; put(S);
    const go = S.autoOn && !(deadC.length && S.deadStop) && D.team(S).length; // 사망자가 있으면 자동 재출발을 멈춘다 (설정으로 끌 수 있다 — 끄면 남은 사람끼리)
    cd = go ? { res, n: WAIT, stop: false } : { res, n: 0, stop: true, why: deadC.length ? 'dead' : '' }; post = { rep: res.rep, auto: !!go, used: false }; step = 'map'; /* 돌아오면 지도에 밝힌 방부터 그린다 → 보고서 → 길드 */ guild(); setTimeout(() => { if (post && !post.used) postDone(); }, 500); // 지도 그리기 연출(pixMap — 길드 지도는 틀이 자리 잡은 뒤에 그린다)이 끝나면 보고서 · 카운트다운 — 연출이 없으면 곧바로
  }
  // 원정 뒤: 길드 지도가 이번에 밝힌 방을 깃펜으로 그린 다음(post — pixMap이 연출) 보고서를 띄우고, 그때부터 자동 재출발 카운트다운
  let post = null;
  function postDone() { const p = post; post = null; if (!p || !run || !cd) return; repWin(p.rep, true);
    if (p.auto && !cd.stop) { const t = setInterval(() => { if (!cd || cd.stop) return clearInterval(t); if (--cd.n <= 0) { clearInterval(t); depart(); } else { const el = $('dv-guild')?.querySelector('.dv-cnt'); if (el) el.textContent = cntTxt(); repCnt(); } }, 1000); } }
  // ── 결과 보고서 창: 머리(끝난 이유 색 · 아이콘 · 층 · 시간 · 밝힌 방 · 탐사율) / 얻은 것 · 잃은 것 · 쓴 물자 · 부활 값 / 영웅 표 / 확인 · 다시 출발 (자동 재출발이면 카운트다운 — 창을 누르면 멈춘다) ──
  const WHY = { lose: ['skull', '전멸', ''], win: ['crown', '용 처치', ''], plan: ['target', '귀환', '경로 완주'], full: ['chest', '귀환', '짐 가득'], risk: ['warn', '귀환', '파티 위험'], quit: ['x', '귀환', '직접'], back: ['down', '귀환', ''] };
  const repCnt = () => { const b = $('dv-rep')?.querySelector('.rp-go'); if (b) b.textContent = cd && !cd.stop && cd.n > 0 ? `다시 출발 ${cd.n}` : '다시 출발'; };
  function repWin(r, now) {
    if (!r) return; const box = panel('dv-rep'), w = r.why === 'win' && r.floor < D.LAST ? ['crown', '승리', ''] : WHY[r.why] || WHY.back, hs = r.heroes || [], top = k => Math.max(1, ...hs.map(h => h[k]));
    const num = (h, k, lab) => `<span${k !== 'took' && h[k] && h[k] === top(k) && hs.length > 1 ? ' class="top"' : ''}>${h[k].toLocaleString()}<small>${lab}</small></span>`;
    const sup = Object.entries(r.sup || {}).filter(([, n]) => n > 0).map(([k, n]) => `<span class="chip">${ico({ sup: k }) || UI.px(SUP_N[k][1])} ${SUP_N[k][0]} −${n}</span>`).join('');
    const revT = (r.rev || []).reduce((a, q) => a + q[1], 0);
    box.innerHTML = `<header><h2 class="rp-why rp-${r.why}">${UI.px(w[0])} ${w[1]}${w[2] ? ` <small>${w[2]}</small>` : ''}</h2></header>`
      + `<div class="dv-res rp-head"><span class="chip">${r.start === r.floor ? `${r.floor}층` : `${r.start}→${r.floor}층`}</span><span class="chip">${r.min < 1 ? `${Math.round(r.min * 60)}초` : `${r.min}분`}</span><span class="chip">방 +${r.rooms}</span><span class="chip">탐사 ${r.ex}%</span><span class="chip">전투 ${r.fights}</span><span class="chip">처치 ${r.foes}</span></div>`
      + `<h4>${r.chest ? `<img class="rp-chest" src="assets/ll/chest_${r.chest}_open.png" alt="" onerror="this.remove()">` : ''}얻은 것</h4><div class="dv-res"><span class="chip c-gold">${UI.px('coin')} +${r.g}</span>${(r.gems || []).map(([n, c, g, id]) => `<span class="chip">${ico(id ? { gem: id } : null) || UI.px('gem')} ${esc(n)} ×${c} <small>${UI.px('coin')} ${g * c}</small></span>`).join('')}${sup}</div>`
      + ((r.items || []).length ? `<p class="dv-items">${r.items.map(e => `${ico(itemX(e))}<span class="r${e.r}">${D.RARITY[e.r]} · ${esc(e.n)}</span>${e.to ? ` → ${esc(e.to)}` : e.dropped ? ' · 두고 감' : ''}`).join('<br>')}</p>` : '')
      + ((r.lost || []).length ? `<h4 class="dv-bad">${UI.px('chest')} ${r.floor}층에 떨어뜨림</h4><p class="rp-lost">${r.lost.map(([n, c, q]) => `<span class="r${q}">${esc(n)}${c > 1 ? ` ×${c}` : ''}</span>`).join(' · ')}</p>` : '')
      + (revT ? `<p class="rp-rev">${UI.px('skull')} ${r.rev.map(([n, c]) => `${esc(n)} <small>부활 ${UI.px('coin')} ${c}</small>`).join(' · ')}${revT > Math.max(0, r.gold) ? ` <b class="dv-bad">빚 ${revT - Math.max(0, r.gold)}</b>` : ''}</p>` : '')
      + `<ul class="rp-hs">${hs.map(h => `<li class="${h.dead ? 'dead' : ''}"><canvas width="26" height="30"></canvas><b>${esc(h.n)}</b><small>${esc(clsN(h.c))}</small><em>${h.lv1 > h.lv0 ? `Lv ${h.lv0} → <b>${h.lv1}</b>` : `Lv ${h.lv1}`}</em><i>XP +${h.xp.toLocaleString()}</i>${h.dead ? `<i class="dv-bad">${UI.px('skull')} 사망</i>` : h.downs ? `<i class="dv-bad">${UI.px('down')} ${h.downs}</i>` : ''}`
        + (h.tk && Object.keys(h.tk).length ? `<i class="rp-tk">${['취약', '저항', '면역'].filter(w => h.tk[w]).map(w => `${w} ${h.tk[w]}`).join(' · ')}</i>` : '') + `<div class="rp-n">${num(h, 'dmg', '피해')}${num(h, 'took', '받음')}${num(h, 'heal', '회복')}${num(h, 'kills', '처치')}</div></li>`).join('')}</ul>`
      + `<div class="dv-row"><button class="rp-ok">확인</button><button class="rp-go"${D.team(S).length ? '' : ' disabled'}>다시 출발</button></div>`;
    repCnt();
    box.querySelectorAll('.rp-hs canvas').forEach((cv, i) => { const m = S.roster[hs[i]?.c]?.m; const draw = () => { if (m && box.isConnected && !UI.face(cv, m)) setTimeout(draw, 400); }; draw(); });
    box.onpointerdown = () => { if (cd && !cd.stop) { cd.stop = true; repCnt(); const el = $('dv-guild')?.querySelector('.dv-cnt'); if (el) el.textContent = cntTxt(); } }; // 창을 누르면 카운트다운이 멈춘다
    box.onclick = ev => { const b = ev.target.closest('button'); if (!b) return; if (b.classList.contains('rp-ok')) { box.remove(); if (step === 'map' && run) goStep('inn'); } if (b.classList.contains('rp-go') && !b.disabled) depart(); };
  }
  // 자동 재출발: 판이 끝나면 길드에 WAIT초 머문 뒤 다시 나간다 — 그 사이 길드를 누르면 멈춘다 (살 것을 사고 「원정 출발」)
  const WAIT = 8;
  const cntTxt = () => (cd.stop ? '자동 재출발 멈춤' : `자동 재출발 ${cd.n} · ${D.startFloor(S)}층`);
  // 지난 판에 얻은 것: 새 스킬 · 아이템 (등급 색)
  const gotTxt = r => (r.skills?.length ? `<p class="dv-ups">새 스킬 ${r.skills.map(([n, k]) => `<b>${esc(n)}</b> ${esc(k)}`).join(' · ')}</p>` : '') + (r.items?.length ? `<p class="dv-items">${r.items.map(e => `<span class="r${e.r}">${D.RARITY[e.r]} · ${esc(e.n)}</span>${e.to ? ` → ${esc(e.to)}` : e.dropped ? ' · 두고 감' : ` → 짐 <small>${UI.px('coin')} ${e.gold}</small>`}`).join('<br>')}</p>` : '');
  const upsTxt = ups => (ups.length ? `<p class="dv-ups">레벨업 ${ups.map(([n, a, b]) => `<b>${esc(n)}</b> ${a}→${b}레벨`).join(' · ')}</p>` : '');
  function depart() { put(S); flag(1); location.href = location.pathname + KEEPQ; }
  // ── 길드 ──
  function panel(id) { let el = $(id); if (!el) { el = document.createElement('div'); el.id = id; el.className = 'dv-panel'; el.onpointerup = ev => ev.stopPropagation(); document.body.append(el); } return el; }
  // ── 길드 (지도가 첫 화면, 2026-11-23): 위 = 지난 판 한 줄 · 층 고르기(자동 · 가 본 층 탐사 수) / 가운데 = 그 층 지도와 경로 / 아래 = 경로 요약 · 파티 · 원정 출발 / 맨 아래 탭 = 명단 · 해금 · 도감
  //    가로로 낮은 창은 지도 왼쪽 · 나머지 오른쪽 기둥 (app.css)
  let mapFl = null; // 지금 보고 있는 층 (없으면 출발 층)
  const lastLine = () => { const r = cd?.res; return r ? `<div class="dv-last"><b>${esc(r.how)}</b> · ${r.floor}층 · ${UI.px('coin')} +${r.g} · ${r.min}분${r.best ? ' · 최고 층' : ''}${r.lootN || r.gemN ? (r.lost ? ` · <span class="dv-bad">${[r.lootN ? `전리품 ${r.lootN}` : '', r.gemN ? `보석 ${r.gemN}` : ''].filter(Boolean).join(' · ')} 떨어뜨림</span>` : ` · ${[r.lootN ? `전리품 ${r.lootN}` : '', r.gemN ? `보석 ${r.gemN}` : ''].filter(Boolean).join(' · ')} · ${UI.px('coin')} +${r.lootG}`) : ''}${r.deadN ? ` · <span class="dv-bad">${UI.px('skull')} 사망 ${r.deadN}</span>` : ''}${upsTxt(r.ups)}${gotTxt(r)}${(r.maps || []).length ? `<p class="dv-maps">${r.maps.map(([f, a, b, d, k]) => `${f}층 ${a}/${b}${d ? ` (+${d})` : ''}${k ? ` · 잠긴 문 ✕${k}` : ''}`).join(' · ')}</p>` : ''}<p class="dv-cnt">${cntTxt()}</p>${(S.lastLog || []).length ? `<ul class="dv-lastlog">${logRows(S.lastLog, 200)}</ul>` : ''}</div>` : ''; }; // 지난 판 한 줄 (누르면 펼친다 — 로그 포함)
  // 선술집: 장면 · 오른쪽 정보 · 아래 파티 줄 · 지도로
  function inn(box) {
    const team = D.team(S), open = D.heroes(S), dc = D.dexCount(S), mini = window.name === MINI; if (!open.includes(inC)) inC = team[0] || open[0];
    box.innerHTML = `<header><h2>원정대 길드</h2><div class="dv-res"><span class="chip c-gold${S.gold < 0 ? ' neg' : ''}">${UI.px('coin')} ${S.gold}</span><span class="chip">최고 ${S.deep}층</span>${S.lastRep ? '<button class="chip dv-repb">보고서</button>' : ''}<button class="chip" data-view>${viewTop() ? '탑뷰' : '쿼터뷰'}</button>${mini ? '' : `<button class="chip" data-tab="mini">${mi('map')}작은 창</button>`}${fsBtn()}</div></header>` + lastLine()
      + `<div class="in-main"><div class="in-scene"><canvas></canvas><nav class="dv-gtabs"><button data-tab="roster"><span>명단</span></button><button data-tab="recruit"><span>${S.board?.list?.length ? '<i class="dv-dot"></i>' : ''}모집 <small>${open.length}/${D.ROSTER_CAP}</small></span></button><button data-tab="tree"><span>해금 <small>${D.TREE.reduce((a, t) => a + D.step(S, t.id), 0)}/${D.TREE.reduce((a, t) => a + t.cost.length, 0)}</small></span></button><button data-tab="dex"><span>도감 <small>${dc.got}/${dc.all}</small></span></button><button data-tab="stash"><span>창고 <small>${(S.stash || []).length}/${D.STASH_CAP}</small></span></button><button data-tab="go" class="in-go"${team.length ? '' : ' disabled'}><span>지도</span></button></nav><div class="in-who"></div></div><aside class="in-info">${DIVEINN.info(S, inC)}</aside></div>`
      + `<div class="in-bot">${DIVEINN.party(S, 'sel')}<button class="dv-go in-go"${team.length ? '' : ' disabled'}>${mi('map')}지도</button></div><p class="dv-dim dv-msg" hidden></p>`;
    DIVEINN.scene(box.querySelector('.in-scene'), S, inC); DIVEINN.faces(box, S); document.body.dataset.inn = open.length;
    box.onpointerdown = () => stopCd(box);
    box.onclick = ev => {
      const lr = ev.target.closest('.dv-last'); if (lr) { lr.classList.toggle('open'); return; }
      const b = ev.target.closest('button'); if (!b || b.disabled) return; const ds = b.dataset, full = D.team(S).length >= D.seats(S);
      if (ds.in) { inC = ds.in; if (S.roster[inC] && !S.dead[inC] && !D.team(S).includes(inC) && !full) D.toggle(S, inC); put(S); return guild(); } // 누르면 파티에 (자리가 차 있으면 정보만)
      if (ds.sel) { inC = ds.sel; return guild(); }
      if (ds.add || ds.out) { D.toggle(S, ds.add || ds.out); put(S); return guild(); }
      if (ds.rev) { D.raise(S, ds.rev); if (!S.party.includes(ds.rev) && !full) S.party.push(ds.rev); put(S); return guild(); } // 부활 (모자라면 빚)
      if (ds.view != null) { try { localStorage.setItem('inc.view', viewTop() ? 'iso' : 'top'); } catch (e) { /* 기억 못 해도 */ } location.href = location.pathname + KEEPQ; return; } // 시점 (탑뷰 시험) — 다시 열어 그림을 바꾼다
      if (ds.hero) return hero(ds.hero);
      if (b.classList.contains('in-go')) return goStep('map');
      if (b.classList.contains('dv-repb')) return repWin(S.lastRep);
      if (ds.tab === 'roster' || ds.tab === 'tree') return sheet(ds.tab);
      if (ds.tab === 'dex') return dex('m');
      if (ds.tab === 'stash') return invWin('stash');
      if (ds.tab === 'recruit') return recruit();
      if (ds.tab === 'mini') { const w = window.open(location.pathname, MINI, POP), m = box.querySelector('.dv-msg'); if (w) { w.focus(); m.hidden = true; } else { m.hidden = false; m.textContent = '팝업 차단됨'; } }
    };
  }
  const viewTop = () => { try { return localStorage.getItem('inc.view') === 'top'; } catch (e) { return false; } };
  const stopCd = box => { if (cd && !cd.stop) { cd.stop = true; const el = box.querySelector('.dv-cnt'); if (el) el.textContent = cntTxt(); } }; // 길드를 누르면 자동 재출발이 멈춘다
  let step = 'inn', inC = null; // 길드의 두 단계: 'inn' = 선술집 장면(파티 구성) → 'map' = 지도(경로 · 짐 · 출발) · inC: 장면에서 보고 있는 영웅
  const goStep = s => { step = s; guild(); const box = $('dv-guild'); box.classList.remove('fade'); void box.offsetWidth; box.classList.add('fade'); };
  function guild() {
    document.body.dataset.dive = 'guild';
    const box = panel('dv-guild'); box.classList.toggle('inn', step === 'inn'); box.classList.toggle('mapv', step === 'map');
    if (step === 'inn') return inn(box);
    const team = D.team(S), sf = D.startFloor(S);
    const fl = mapFl || sf, fls = [...new Set(D.starts(S).concat(Object.keys(S.maps).map(Number), [sf]))].sort((a, b) => a - b); // 출발할 수 있는 층 (1 ~ 깬 층 + 1)
    const last = lastLine();
    const tab = f => { const ex = D.explored(S, f), st = D.starts(S).includes(f); const eo = D.evOpen(S, f); return `<button data-fl="${f}" class="${f === fl ? 'on' : ''}${st ? ' st' : ''}">${f}층${ex ? ` <small>${ex[0]}/${ex[1]}</small>` : ''}${eo ? ` <small class="dv-bad">사건 ${eo}</small>` : ''}</button>`; };
    box.innerHTML = `<header><h2><button class="chip dv-back">‹ 길드</button> 지도</h2><div class="dv-res"><span class="chip c-gold${S.gold < 0 ? ' neg' : ''}">${UI.px('coin')} ${S.gold}</span><span class="chip">최고 ${S.deep}층</span>${fsBtn()}</div></header>`
      + last
      + `<div class="dv-gmain"><div class="dv-gmap"><div class="dv-fls"><button data-fl="0" class="dv-autof${S.start ? '' : ' on'}">자동 ${sf}층</button>${fls.map(tab).join('')}</div>`
      + `<div class="dv-mapw"><svg id="dvmap" xmlns="http://www.w3.org/2000/svg"></svg></div></div>`
      + `<div class="dv-gside"><div class="dv-sum"></div>${bagLine(team)}`
      + `<div class="dv-gparty">${DIVEINN.party(S, 'cls')}</div>`
      + `<div class="dv-row"><button class="dv-auto${S.autoOn ? ' on' : ''}">자동 재출발${D.deadList(S).length && S.deadStop ? ` <small class="dv-bad">${UI.px('skull')} ${D.deadList(S).length}</small>` : ''}</button><button class="dv-start"${team.length ? '' : ' disabled'}>${mi('battle')}원정 출발 · ${sf}층</button></div>`
      + `</div></div>`;
    DIVEINN.faces(box, S);
    drawMap(box, fl);
    box.onpointerdown = () => stopCd(box);
    box.onclick = ev => {
      if (ev.target.closest('#dvmap')) return; // 지도 누르기는 drawMap이 받는다
      const lr = ev.target.closest('.dv-last'); if (lr) { lr.classList.toggle('open'); return; }
      { const li = ev.target.closest('[data-evr]'); if (li) { const f0 = mapFl || D.startFloor(S), V0 = D.view(S, f0); return evPop(V0, V0.map.nodes[+li.dataset.evr], f0); } }
      const b = ev.target.closest('button'); if (!b || b.disabled) return;
      if (b.dataset.fl != null) { const f = +b.dataset.fl; if (!f) { S.start = 0; mapFl = null; } else { mapFl = f; if (D.starts(S).includes(f)) S.start = f; } put(S); guild(); return; } // 출발 층 = 지도에서 고른 층 (출발할 수 있는 층이면) · 「자동」은 그대로
      if (b.classList.contains('dv-back')) return goStep('inn');
      if (b.classList.contains('dv-bagb')) { if (cd) cd.stop = true; return bagPanel(); }
      if (b.dataset.cls) { inC = b.dataset.cls; return goStep('inn'); } // 초상: 길드로 돌아가 그 영웅
      if (b.classList.contains('dv-auto')) { S.autoOn = !S.autoOn; put(S); guild(); return; }
      if (b.classList.contains('dv-gch') && pixM && pixV) { const L = pixM.gates(); if (!L.length) return; const g = L[gchI++ % L.length]; pixM.show(g); return gatePop(pixV, g.q); } // 못 연 관문을 차례로
      if (b.classList.contains('dv-start')) depart();
    };
  }
  // ── 파티 짐 (2026-11-23): 길드의 「짐 5/9」 줄 → 짐 챙기기 창 (칸 줄 · 물자 −/+ · 값 · 남는 칸 · 경로 끝 · 가득 차면 복귀 · 사망 시 멈춤 · 계획 횃불) ──
  const SUP_N = { torch: ['횃불', 'spark'], camp: ['야영 물자', 'tent'] }; // 물자는 둘 (2026-11-23)
  const bagUse = () => D.bagPlan(S).torch; // 짐 칸은 횃불만 (야영 물자는 칸을 안 차지한다 — 2026-11-26)
  const backSum = () => [S.fullBack && '짐 가득', S.risk !== false && '파티 위험'].filter(Boolean).join(' · ') || '직접';
  // 메뉴 아이콘 (흰 실루엣): CSS mask로 버튼 글자색을 입힌다
  const mi = n => `<span class="dv-mi" style="--mi:url(assets/ll/icon_${n}.png)"></span>`;
  const bagLine = t => `<button class="dv-bagb">${mi('inventory')} 짐 ${bagUse()}/${D.bagCap(S, t)} <small>${UI.px('coin')} ${D.supCost(D.bagPlan(S))} · 귀환 ${backSum()}</small></button>`;
  function bagPanel() {
    const box = panel('dv-bag'), t = D.team(S), cap = D.bagCap(S, t), mx = D.supMax(S), b = D.bagPlan(S), used = bagUse(), cost = D.supCost(b);
    const cells = Array.from({ length: cap }, (_, i) => { let k = 0, acc = 0; for (const q of ['torch']) { const n = b[q]; if (i < acc + n) { k = q; break; } acc += n; } return `<i class="${k ? `on k-${k}` : ''}">${k ? UI.px(SUP_N[k][1]) : ''}</i>`; }).join('');
    const row = k => { const n = b[k], m = mx[k]; return `<div class="dv-supr"><b>${ico({ sup: k }) || UI.px(SUP_N[k][1])} ${SUP_N[k][0]}</b><button data-sup="${k}" data-d="-1"${n <= 0 ? ' disabled' : ''}>−</button><span>${n}/${m}</span><button data-sup="${k}" data-d="1"${n >= m || (k !== 'camp' && used >= cap) ? ' disabled' : ''}>+</button><small>${TUNE_SUP(k)}</small></div>`; };
    box.innerHTML = `<header><h2>짐 ${used}/${cap}</h2><div class="dv-res"><span class="chip c-gold${S.gold < 0 ? ' neg' : ''}">${UI.px('coin')} ${S.gold}</span><button class="chip dv-x">닫기</button></div></header>`
      + `<div class="dv-cells">${cells}</div>`
      + D.SUP_KEYS.map(row).join('')
      + `<p class="dv-bagsum">${UI.px('coin')} ${cost}${S.gold < 0 ? ' · <span class="dv-bad">빚</span>' : S.gold < cost ? ` · <span class="dv-bad">${UI.px('coin')} ${S.gold}</span>` : ''} · 남는 칸 ${cap - used} · ${UI.px('tent')} ${b.camp + D.CAMP_FREE}</p>`
      + `<h3 class="dv-togh">자동 귀환</h3>`
      + `<div class="dv-tog"><span>짐 가득</span><button data-full="1" class="${S.fullBack ? 'on' : ''}">켬</button><button data-full="0" class="${S.fullBack ? '' : 'on'}">끔</button></div>`
      + `<div class="dv-tog"><span>파티 위험</span><button data-risk="1" class="${S.risk !== false ? 'on' : ''}">켬</button><button data-risk="0" class="${S.risk !== false ? '' : 'on'}">끔</button></div>`
      + `<h3 class="dv-togh">기타</h3><div class="dv-tog"><span>레벨업 카드</span><button data-card="1" class="${S.cardOn !== false ? 'on' : ''}">켬</button><button data-card="0" class="${S.cardOn !== false ? '' : 'on'}">끔</button></div>`
      + `<div class="dv-tog"><span>${UI.px('skull')} 사망 후 재출발</span><button data-ds="0" class="${S.deadStop ? '' : 'on'}">켬</button><button data-ds="1" class="${S.deadStop ? 'on' : ''}">끔</button></div>`;
    box.onclick = ev => { const x = ev.target.closest('button'); if (!x || x.disabled) return;
      if (x.classList.contains('dv-x')) { box.remove(); guild(); return; }
      if (x.dataset.sup) { const nb = { ...D.bagPlan(S) }; nb[x.dataset.sup] = Math.max(0, nb[x.dataset.sup] + +x.dataset.d); S.bag = nb; }
      if (x.dataset.end) S.endMode = x.dataset.end; if (x.dataset.full) S.fullBack = x.dataset.full === '1'; if (x.dataset.ds) S.deadStop = x.dataset.ds === '1'; if (x.dataset.risk) S.risk = x.dataset.risk === '1'; if (x.dataset.card) S.cardOn = x.dataset.card === '1';
      put(S); bagPanel(); };
  }
  const TUNE_SUP = k => (D.TUNE.SUP[k] ? `${UI.px('coin')} ${D.TUNE.SUP[k]}` : '—');
  // 명단 · 해금 탭 (아래에서 올라오는 창)
  function sheet(kind) {
    const box = panel('dv-sheet'), team = D.team(S), open = D.heroes(S);
    const row = t => { const st = D.step(S, t.id), c = D.cost(S, t.id), max = c == null;
      return `<button class="dv-up${max ? ' max' : S.gold >= c ? ' can' : ''}" data-up="${t.id}"${max || S.gold < c ? ' disabled' : ''}><b>${esc(t.n)}</b><small>${esc(t.val(st))}${max ? '' : ` → ${esc(t.val(st + 1))}`}</small><span>${max ? '다 열었다' : `${UI.px('coin')} ${c}`}</span><i class="dv-pips">${t.cost.map((_, i) => `<em class="${i < st ? 'on' : ''}"></em>`).join('')}</i></button>`; };
    box.innerHTML = `<header><h2>${kind === 'tree' ? '해금' : '명단'}</h2><div class="dv-res"><span class="chip c-gold">${UI.px('coin')} ${S.gold}</span><button class="chip dv-x">닫기</button></div></header>`
      + (kind === 'tree' ? D.BRANCH.map(b => `<h4>${b.n}</h4><div class="dv-tree">${D.TREE.filter(t => t.br === b.id).map(row).join('')}</div>`).join('') : roster(team, open) || '<p class="dv-dim">—</p>');
    box.onclick = ev => { const li = ev.target.closest('[data-hero]'); if (li) return hero(li.dataset.hero); const b = ev.target.closest('button'); if (!b || b.disabled) return;
      if (b.classList.contains('dv-x')) { box.remove(); guild(); return; } if (b.dataset.up) { if (D.buy(S, b.dataset.up)) { put(S); sheet(kind); } } };
  }
  // ── 모집 (2026-11-27 영웅 모델): 공고 셋(일반 · 고급 · 특급) × 5명 · 10명 → 지원자(얼굴 · 이름 · 직업 · 계열 · 별 · 레벨 · 고용비) → 고용. 설명 문장 없이 값만 ──
  const stars = n => `<i class="dv-stars">${'★'.repeat(n || 1)}</i>`;
  function recruit() {
    const box = panel('dv-rc'), B = S.board, n = D.heroes(S).length;
    const tiers = D.BOARD.map((b, i) => [false, true].map(big => { const c = D.postCost(i, big); return `<button class="rc-post" data-post="${i}" data-big="${big ? 1 : ''}"${S.gold < c ? ' disabled' : ''}><b>${esc(b.n)}</b><small>${big ? D.BIG_N : D.SMALL_N}명</small><span>${UI.px('coin')} ${c}</span></button>`; }).join('')).join('');
    const row = (a, i) => { const m = a.m, why = D.canHire(S, i); return `<button class="rc-a" data-i="${i}"${why === true ? '' : ' disabled'}><canvas width="26" height="30"></canvas><b>${esc(m.name)}</b><small>${esc(clsN(m.cls))} · ${esc(G.Builds.byId(m.build)?.n || '')}</small>${stars(m.star)}<span class="dv-lv">Lv ${m.lv}</span><span>${UI.px('coin')} ${a.fee}</span></button>`; };
    box.innerHTML = `<header><h2>모집 <small>${n}/${D.ROSTER_CAP}</small></h2><div class="dv-res"><span class="chip c-gold">${UI.px('coin')} ${S.gold}</span><button class="chip dv-x">닫기</button></div></header>`
      + `<div class="rc-tiers">${tiers}</div>` + (B?.list?.length ? `<div class="dv-picks rc-list">${B.list.map(row).join('')}</div>` : '');
    box.querySelectorAll('.rc-a canvas').forEach((cv, i) => { const draw = () => { if (box.isConnected && !UI.face(cv, B.list[i].m)) setTimeout(draw, 400); }; draw(); });
    box.onclick = ev => { const x = ev.target.closest('button'); if (!x || x.disabled) return; if (x.classList.contains('dv-x')) { box.remove(); guild(); return; }
      if (x.dataset.post != null) { if (D.post(S, +x.dataset.post, !!x.dataset.big)) { put(S); recruit(); } return; }
      if (x.dataset.i != null) { const id = D.hire(S, +x.dataset.i); if (id) { inC = id; put(S); recruit(); } } };
  }
  // 명단: 지금 파티 먼저, 그다음 길드에 남은 영웅 — 이름 · 직업 · 빌드 · 레벨 · 경험치 · 장비
  function roster(team, open) {
    const cs = team.concat(open.filter(c => S.roster[c] && !team.includes(c))).filter(c => S.roster[c]);
    if (!cs.length) return '';
    const li = c => { const h = S.roster[c], m = h.m, need = G.Guild.needOf(m), mx = D.maxLv(m), sh = G.Tavern.sheet(m), mg = (h.tr || []).map(t => `<span class="r${D.rOf({ kind: 'magic', t })}">${esc(G.Gear.nameOf(t))}</span>`);
      return `<li class="${team.includes(c) ? 'on' : ''}" data-hero="${c}"><b>${esc(m.name)}</b><small>${esc(clsN(m.cls))} · ${esc(G.Builds.byId(m.build)?.n || '')}</small>${stars(m.star)}<span class="dv-lv">Lv ${m.lv}/${mx}</span>`
        + `<i class="dv-xp"><em style="width:${m.lv >= mx ? 100 : Math.round(100 * Math.min(1, (m.xp || 0) / need))}%"></em></i><small class="dv-gear">${esc(sh.weapon.n)} · ${esc(sh.armor)}${mg.length ? ` · ${mg.join(' · ')}` : ''}</small></li>`; };
    return `<h4>명단 <small>${cs.length}명</small></h4><ul class="dv-roster">${cs.map(li).join('')}</ul>`;
  }
  // ── 상태창 = 모험가 등록증 (2026-11-27 사용자: 「카드를 상태창으로 대체」 — 시안 card2): 신용카드 비율 가로 카드(520×328)를 가운데 고정 크기로 (좁은 화면은 줄인다).
  //   증명사진 + 별(테두리 재질 = 성급) · 직업 · 계열 · 경험치 / 이름 · Lv 지금/최대 · 수치 넷 · 스킬 여섯 칸(잠긴 칸은 흐리게 + 여는 성급) · 탐험 재주 · 장비. 카드 아래 띠: 고를 것 · 마법 물건 · 계승. 설명 문장 없이 수치만
  const RANK = { 1: ['#a8784a', '#5a3c22'], 2: ['#a8a8b0', '#4a4a52'], 3: ['#d08a42', '#5a2e10'], 4: ['#c4cee2', '#4a5470'], 5: ['#f0c040', '#6a4508'] };
  function photo(cv, m) { // 증명사진: 머리 쪽 가운데 · 위에서 조금 띄워 3배
    const sp = MD.pix ? MD.pix(m, 0.3, 'Idle') : null; if (!sp) return false; const k = 3, u8 = new Uint8ClampedArray(sp.px.buffer, sp.px.byteOffset, sp.w * sp.h * 4), A = (X, Y) => u8[(Y * sp.w + X) * 4 + 3] > 40;
    let y1 = 0, y0 = sp.h, sx = 0, n = 0; for (let Y = 0; Y < sp.h; Y++) for (let X = 0; X < sp.w; X++) if (A(X, Y)) { if (Y > y1) y1 = Y; if (Y < y0) y0 = Y; }
    for (let Y = y0; Y <= y0 + (y1 - y0) * 0.5; Y++) for (let X = 0; X < sp.w; X++) if (A(X, Y)) { sx += X; n++; } const mx = n ? sx / n : sp.w / 2, x = cv.getContext('2d');
    x.imageSmoothingEnabled = false; x.clearRect(0, 0, cv.width, cv.height); x.drawImage(TAVERNUI.bitmap(sp), Math.round(cv.width / 2 - (mx + 0.5) * k), Math.round(cv.height * 0.14 - y0 * k), sp.w * k, sp.h * k); return true; }
  function hero(c) {
    const h = S.roster[c]; if (!h) return; const m = D.cardInit(h.m), sh = G.Tavern.sheet(m), v = G.Builds.view(m), need = G.Guild.needOf(m), mx = D.maxLv(m), st = m.star || 1, inh = D.inheritOpts(S, c), line = D.isLine(m) && m.star;
    const Q = D.sheetOf(h), atk = `${Q.dmg.n + Q.dmg.b}~${Q.dmg.n * Q.dmg.d + Q.dmg.b}`, sg = n => (n >= 0 ? '+' : '') + n, [r, rd] = RANK[Math.min(5, st)], xp = m.lv >= mx ? 100 : Math.round(100 * Math.min(1, (m.xp || 0) / need));
    const core = G.Builds.byId(m.build)?.core || [], num = k => { const n0 = G.SkillNum_at?.(k, m.cls, m.lv), cdn = G.Res.cdOf ? G.Res.cdOf(k) : 0; return [skTag(m, k) || n0?.d, cdn ? `쿨 ${cdn}` : ''].filter(Boolean).join(' · '); };
    const cell = (c0, i) => { if (c0.s) return `<div class="lc-on" data-sk="${c0.s.k}">${SKUI.img(c0.s.k)}<span><b>${esc(c0.s.n)}</b><small>${esc(num(c0.s.k))}</small></span></div>`;
      const k = line ? core[i] : c0.will?.k, nm = line ? G.D.MSKILLS[k]?.n || k || '' : c0.will?.n || '', need0 = line ? `${UI.px('lock')}${'★'.repeat(Math.max(1, i))}` : `Lv ${c0.will?.lv || c0.open || ''}`;
      return `<div class="off"${k ? ` data-sk="${k}"` : ''}>${k ? SKUI.img(k) : '<i class="lc-nok"></i>'}<span><b>${esc(nm)}</b><small>${k ? esc(num(k)) : ''}</small></span><em>${need0}</em></div>`; };
    const eq = [sh.weapon?.n, sh.armor].filter(x => x && x !== '없음'), mg = Q.items;
    const knack = D.knacksOf(m).map(g => `<span>${UI.px(D.KNACK[g].ic)}${esc(D.KNACK[g].n)}</span>`).join('');
    const box = panel('dv-lic'), no = String(1000 + (parseInt(String(c).replace(/\D/g, ''), 10) || 1) * 37).padStart(5, '0');
    box.innerHTML = `<div class="lc" style="--r:${r};--rd:${rd}"><div class="lc-in"><div class="lc-hd"><b>모험가 등록증</b> · 원정대 길드<span>No. ${no}</span><button class="lc-x dv-x">✕</button></div>`
      + `<div class="lc-ph"><i class="lc-rar">${'★'.repeat(st)}</i><canvas width="112" height="136"></canvas></div><div class="lc-cls">${esc(sh.cls)}<small>${esc(G.Builds.byId(m.build)?.n || '')}</small></div>`
      + `<div class="lc-xp"><small>${m.lv >= mx ? 'MAX' : `경험치 ${xp}%`}</small><i><em style="width:${xp}%"></em></i></div>`
      + `<div class="lc-main"><div class="lc-name"><b>${esc(m.name)}</b><em>Lv ${m.lv} / ${mx}</em></div>`
      + `<div class="lc-st"><span><b>${Q.hp}</b>체력</span><span><b>${sg(Q.hit)}</b>명중</span><span><b>${atk}</b>공격</span><span><b>${Q.ac}</b>방어</span></div>`
      + `<div class="lc-sk">${v.slots.slice(0, 6).map((c0, i) => cell(c0, i)).join('')}</div>`
      + `<div class="lc-ft">${knack}${eq.map(n => `<span>${esc(n)}</span>`).join('')}${mg.map(x => `<span class="r${x.r}">${esc(x.n)}</span>`).join('')}</div></div><div class="lc-sig">길드장</div></div></div>`
      + ((m.cardq || []).length || inh.length ? `<div class="lc-more">${(m.cardq || []).length ? `<button class="chip dv-pickb">${UI.px('star')} ${m.cardq.length}</button>` : ''}`
        + (inh.length ? `<div class="lc-inh"><b>계승 ${stars(st + 1)}</b>${inh.map(o => { const g = S.roster[o.hid].m; return `<div><span>${esc(g.name)} ${stars(g.star)} Lv ${g.lv}</span>${o.sk.map(k => `<button class="chip" data-inh="${o.hid}" data-k="${k}">${SKUI.img(k)}${esc(G.D.MSKILLS[k]?.n || k)}</button>`).join('')}</div>`; }).join('')}</div>` : '') + '</div>' : '');
    const fitK = () => { const el = box.querySelector('.lc'), more = box.querySelector('.lc-more'), H0 = 328 + (more ? more.offsetHeight + 10 : 0), k = Math.min(1, (innerWidth - 16) / 520, (innerHeight - 24) / H0); box.style.setProperty('--k', k.toFixed(3)); }; fitK();
    const cv = box.querySelector('.lc-ph canvas'), draw = () => { if (box.isConnected && !photo(cv, m)) setTimeout(draw, 400); }; draw();
    box.onclick = ev => { if (ev.target === box) { box.remove(); return; } const sl = ev.target.closest('[data-sk]'); if (sl) return skPop(m, sl.dataset.sk); const b = ev.target.closest('button'); if (!b) return; if (b.classList.contains('dv-x')) { box.remove(); return; }
      if (b.classList.contains('dv-pickb')) return cardWin(m, () => { put(S); hero(c); }, false); // 길드에서 고를 것
      if (b.dataset.inh) { const g = S.roster[b.dataset.inh]?.m, k = b.dataset.k; if (!g) return; if (b.dataset.sure) { const r0 = D.inherit(S, c, b.dataset.inh, k); if (r0 === true) { put(S); return hero(c); } b.textContent = r0 === '창고' ? '창고 가득' : '불가'; return; }
        box.querySelectorAll('[data-sure]').forEach(o => { delete o.dataset.sure; o.classList.remove('warn'); }); b.dataset.sure = 1; b.classList.add('warn'); b.innerHTML = `${UI.px('skull')} ${esc(g.name)} → ${esc(G.D.MSKILLS[k]?.n || k)}`; } // 두 번 눌러 확정 (바친 영웅은 사라진다)
    };
  }
  // 사건 · 야영 결과 한 줄 (crawl.js가 창을 숨긴 채 고른 뒤): 이름 · 판정 · 성공 여부 · 금화
  function note(sc, ch, chk, gold) {
    const p = ch?.p != null && ch.p < 1 ? ` ${Math.round(ch.p * 100)}%` : '';
    if (sc.kind === 'event' && CRAWL.st) { const st = CRAWL.st; D.evMark(S, st.floor, st.at, { st: 'done', pick: ch?.n || '', r: `${sc.title} · ${(ch?.n || '').replace(/^\[[^\]]*\] /, '')}${chk ? ` · ${chk.ok ? '성공' : '실패'}` : ''}${gold > 0 ? ` · 금화 +${gold}` : ''}${st.flags?.ally ? ' · 동료 +1' : ''}` }); put(S); } // 사건은 한 번 — 해결(실패 포함)
    logPush('exp', `${sc.title} · ${ch?.n || ''}${chk ? ` · ${chk.skill}${p} · ${chk.ok ? '성공' : '실패'}` : ''}${gold > 0 ? ` · 금화 +${gold}` : ''}${CRAWL.st?.flags?.ally ? ' · 동료 +1' : ''}`); // 사건 한 줄: 이름 · 선택 · 판정 · 결과
    toast(`<b>${esc(sc.title)}</b>${chk ? ` · ${esc(chk.skill)}${p} · ${chk.ok ? '성공' : '실패'}` : ''}${gold > 0 ? ` · ${UI.px('coin')} +${gold}` : ''}`, 'tk-ev');
  }
  // ── 원정 중 알림: 주운 물건(고급 이상 — 등급 색) · 레벨 업 · 새 스킬. 작은 창에서 시끄럽지 않게 셋까지 쌓이고 3초 뒤 사라진다 ──
  // 물건 그림 (2026-11-24, itemart.js — 맞는 그림이 없거나 아직 안 실렸으면 '' → 지금 표시 그대로)
  const itemX = e => (e?.gem ? { gem: e.gem } : e?.x || (e?.k ? { kind: 'art', k: e.k } : null));
  const ico = (x, cls = '') => { let u = null; try { u = x && typeof MD !== 'undefined' && MD.itemUrl ? MD.itemUrl(x) : null; } catch (er) { u = null; } return u ? `<img class="dv-ico${cls ? ' ' + cls : ''}" src="${u}" alt="" onerror="this.remove()">` : ''; };
  // 얻는 순간: 그 물건 그림이 앞선 영웅 머리 위에서 떠오른다 (0.8초)
  // 상자: 보물 방 = 나무 · 정예 = 은 · 우두머리 = 금. 닫힌 것 → 열린 것, 그 위로 얻은 물건 그림이 떠오른다 (물건 그림은 상자가 열린 뒤)
  const CHEST_R = { wood: 1, silver: 2, gold: 3 };
  function chestShow(k) { if (!run || !R) return; if ((CHEST_R[k] || 0) > (CHEST_R[run.chest] || 0)) run.chest = k; const ps = R.party.filter(q => !q.dead), fl = $('floats'); if (!ps.length || !fl) return;
    const cx = ps.reduce((a, q) => a + (q._dx ?? q.x), 0) / ps.length, cy = ps.reduce((a, q) => a + (q._dy ?? q.y), 0) / ps.length, el = document.createElement('div'); el.className = 'dv-chest'; el.innerHTML = `<img src="assets/ll/chest_${k}.png" alt="" onerror="this.parentNode.remove()">`; fl.append(el); UI.place(el, cx, cy, 1.4);
    setTimeout(() => { const im = el.querySelector('img'); if (im) im.src = `assets/ll/chest_${k}_open.png`; el.classList.add('open'); }, 300); setTimeout(() => el.remove(), 1200); run.popAt = performance.now() + 380; }
  function lootPop(e) { const wait = Math.max(0, (run?.popAt || 0) - performance.now()); if (wait > 0) return void setTimeout(() => lootPop(e), wait); const h = ico(itemX(e)); if (!h || !R) return; const ps = R.party.filter(q => !q.dead), fl = $('floats'); if (!ps.length || !fl) return; const cx = ps.reduce((a, q) => a + (q._dx ?? q.x), 0) / ps.length, cy = ps.reduce((a, q) => a + (q._dy ?? q.y), 0) / ps.length; const el = document.createElement('div'); el.className = 'dv-lootpop'; el.innerHTML = h; fl.append(el); UI.place(el, cx, cy, 2.2); /* 파티 가운데 머리 위 (카메라가 보는 곳) */ setTimeout(() => el.remove(), 850); }
  function toast(html, cls = '') {
    let box = $('dv-toasts'); if (!box) { box = document.createElement('div'); box.id = 'dv-toasts'; $('stage').append(box); }
    while (box.children.length >= 3) box.firstChild.remove();
    const el = document.createElement('div'); el.className = 'dv-toast ' + cls; el.innerHTML = html; box.append(el); setTimeout(() => el.remove(), 3200);
    if (cls !== 'tk-ev') logPush('got', el.textContent.trim()); // 위에 뜨는 알림(드롭 · 레벨 업)도 로그에 (사건은 note가 따로)
    document.body.dataset.toasts = (+(document.body.dataset.toasts || 0) + 1);
  }
  const snap = () => new Map(G.Party.members(G.S.w.fantasy).map(m => [m, { lv: m.lv, sk: new Set((G.Builds.view(m)?.slots || []).filter(c => c.s).map(c => c.s.n)) }]));
  let growT = 0;
  function grow(dt) {
    for (; run.lootN < D.LOOT.length; run.lootN++) { const e = D.LOOT[run.lootN]; lootPop(e); const im = ico(itemX(e)); if (e.r >= 1 || e.bag) toast(`${im}<b class="r${e.r}">${e.gem ? (im ? '' : `${UI.px('gem')} `) : `${D.RARITY[e.r]} · `}${esc(e.n)}</b> ${e.to ? `→ ${esc(e.to)}` : e.dropped ? '· 두고 감' : '→ 짐'}`, 'r' + e.r); }
    if ((growT += dt) < 0.5) return; growT = 0;
    const now = snap();
    for (const [m, o] of now) { const p = run.seen.get(m); if (!p) continue;
      if (o.lv > p.lv) toast(`<b>레벨 업</b> · ${esc(m.name)} ${o.lv}레벨`, 'tk-up');
      for (const k of o.sk) if (!p.sk.has(k)) { toast(`<b>새 스킬</b> · ${esc(m.name)} · ${esc(k)}`, 'tk-sk'); run.skills.push([m.name, k]); } }
    run.seen = now;
  }
  // ── 지도 · 경로 (길드): run.html과 같은 양피지 지도(RUN.draw — 들어간 방은 잉크, 본 방은 연필, 모르는 곳은 빈 양피지와 ?) 위에
  //    경로 = 복도를 따라가는 잉크 선 조각들 (방 사이마다 하나) · 깃펜 · 지난 판의 발자국 · 못 연 관문의 붉은 ✕ · 잠긴 문 옆 손글씨 풀이 값 · 새로 밝힌 방은 한 번 그려 보인다
  const T13 = 13, M6 = 6; // RUN.draw의 칸 크기 · 여백 (js/explore/draw.js T · M)
  const cpt = ([x, y]) => `${(M6 + (x + 0.5) * T13).toFixed(1)},${(M6 + (y + 0.5) * T13).toFixed(1)}`;
  // a → b 복도를 따라가는 선 (방 가운데 → 문 → 복도 칸 → 문 → 방 가운데). 길이 없으면 null
  function segD(map, a, b) { const r = D.segPts(map, a, b); return r ? 'M' + r.pts.map(cpt).join(' L') : null; } // 방 안 칸 · 복도 칸만 밟는 선 (G.Dive.segPts)

  const QUILL = '<g class="dv-quill"><path d="M0,0 L-3,-4 C-2,-12 6,-20 14,-22 C10,-14 4,-6 0,0 Z" fill="#f3ead8" stroke="#2b1d14" stroke-width="1.2"/><path d="M0,0 L9,-16" stroke="#2b1d14" stroke-width="0.8"/></g>'; // 깃펜 (단순한 깃털 모양)
  let mapOld = {}; // 층 → 지난번에 그린 경로 (새 구간만 잉크로 그려 보이려고)
  // 경로 요약 (지도 아래): 들르는 방 수와 종류 · 경로 위 관문과 지금 파티의 풀이 값. 경로가 없으면 「자동」
  const TYPE_N = { fight: '전투', elite: '정예', event: '사건', camp: '야영', shop: '상인', treasure: '보물', boss: '우두머리' };
  // 층 정보 (지도 아래 — 2026-11-26 사용자: 「필요한 파티원 · 열쇠를 챙기는 데 필요한 걸로」): 그 층의 방 상태 수 · 지금 파티에서 넘는 사람(없으면 결과)
  function floorSum(V) {
    const cnt = new Map(), add = k => { const nm = D.STATE[k].n, o = cnt.get(nm) || { k, n: 0 }; o.n++; cnt.set(nm, o); };
    for (const q of V.map.edges) { const k = q.kind === 'locked' ? q.lock || 'lock' : q.kind === 'trap' ? 'trap' : q.kind === 'dark' ? 'dark' : null; if (k && D.STATE[k]) add(k); }
    for (const n of V.map.nodes) { if (n.dark) add('dark'); if (n.sleepy) add('sleep'); }
    if (!cnt.size) return '';
    const hs = D.team(S).map(c => S.roster[c]?.m).filter(Boolean), li = [...cnt].map(([nm, o]) => { const S0 = D.STATE[o.k], g = S0.by.find(g0 => hs.some(m => D.knacksOf(m).includes(g0))), h = g && hs.find(m => D.knacksOf(m).includes(g)), torch = S0.torch && D.bagPlan(S).torch > 0, v = h ? clsN(h.cls) : o.k === 'sleep' ? S0.none : torch ? `횃불 ${D.bagPlan(S).torch}` : S0.gate ? '닫힘' : S0.none, ok = !!h || o.k === 'sleep' || torch;
      return `<li class="pl-gate${ok ? '' : ' no'}">${esc(nm)} ${o.n} · ${esc(v)}</li>`; });
    return `<ul class="dv-plines">${li.join('')}</ul>`;
  }
  // 픽셀 지도 (시안 v1, 2026-11-23 — ?pix=1일 때만): DIVEMAP(js/app/dive_map.js)이 캔버스에 그린다. 누르기 · 경로 · 지우기는 SVG 지도와 같은 규칙
  // 픽셀 지도가 기본 (2026-11-23 — ?svg=1이면 예전 SVG 손그림 지도): DIVEMAP(js/app/dive_map.js)이 캔버스에 그린다. 누르기 · 경로 · 지우기 · 야영 지점 · 사건 판은 같은 규칙
  let pixM = null;
  let pixV = null, gchI = 0;
  function pixMap(box, fl, erase = null) {
    const V = D.view(S, fl), plan = null, wrap = box.querySelector('.dv-mapw'), keep = pixM && wrap.querySelector('canvas.dvpix') && wrap.dataset.fl === String(fl) ? pixM.scroll() : null;
    wrap.dataset.fl = fl; box.querySelector('#dvmap')?.remove();
    const prev = S.shown[fl] || '', cur0 = S.maps[fl]?.n || '', fresh = []; if (prev !== cur0) { for (let i = 0; i < cur0.length; i++) if ((parseInt(cur0[i], 16) & 4) && !(parseInt(prev[i] || '0', 16) & 4)) fresh.push(i); S.shown[fl] = cur0; put(S); } // 새로 밝힌 방 (한 번만)
    let anim = null; // 원정 뒤 첫 길드: 이번에 밝힌 방을 깃펜이 그린다 (새로 들어간 방 · 새로 본 방이 있을 때만 — 자동 재출발 중이면 짧게)
    if (post && !post.used) { post.used = true; const seen = []; if (prev !== cur0) for (let i = 0; i < cur0.length; i++) { const a = parseInt(prev[i] || '0', 16), b = parseInt(cur0[i], 16); if ((b & 8) && !(a & 8) && !(b & 4)) seen.push(i); }
      if (fresh.length || seen.length) anim = { trail: S.trail[fl] || [0], vis: fresh, seen, dur: post.auto ? 1 : Math.min(2.5, 1.4 + 0.12 * (fresh.length + seen.length / 2)), done: () => postDone() }; else setTimeout(postDone, 0); }
    pixM = DIVEMAP.mount(wrap, V, { plan, trail: S.trail[fl] || [], fail: S.fail[fl] || [], camp: S.campPlan[fl] || [], S, gateInfo: q0 => D.gateInfo(S, V, q0), keep, fresh, anim }); pixV = V;
    { const n = pixM.gates().length, row = box.querySelector('.dv-fls'); let ch = row?.querySelector('.dv-gch'); if (!n) ch?.remove(); else if (row) { if (!ch) { ch = document.createElement('button'); ch.className = 'dv-gch'; row.append(ch); } ch.innerHTML = `${UI.px('lock')} ${n}`; } } // 못 연 관문 수 — 누르면 차례로 그 자리로 · 자세히 // keep: 경로를 고르는 동안 틀이 움직이지 않게
    const old = mapOld[fl] || [], from = plan ? (old.length && plan.slice(0, old.length).join() === old.join() ? old.length - 1 : 0) : 0;
    if (erase) pixM.redraw(plan, 0, erase); else if (plan && from < plan.length - 1) pixM.redraw(plan, from);
    mapOld[fl] = plan ? plan.slice() : [];
    const sum = box.querySelector('.dv-sum'); if (sum) sum.innerHTML = floorSum(V);
    edges(box, V, plan);
    wrap.onclick = ev => { ev.stopPropagation(); if (pixM.dragged() || pixM.busy() || pixM.skipped()) return; const g = pixM.gate(ev); if (g) return gatePop(V, g); const id = pixM.cell(ev); if (id == null) return; // 경로 계획은 없앴다 (2026-11-26 — 원정 중 방마다 고른다): 관문 · 사건 방만 자세히
      const n = V.map.nodes[id]; if (n.type === 'event' && n.ev && D.evOf(S, fl, id)?.st !== 'done' && (n.visited || n.info >= 2)) evPop(V, n, fl); };
    document.body.dataset.mapfl = fl;
  }
  // 파티 칸: 그 경로의 아는 적에게 주 피해 유형이 통하나 (▲ 취약을 찌름 · ▼ 저항 · 면역에 막힘)
  function edges(box, V, plan) { const fz = D.planFoes(V, plan || []); box.querySelectorAll('.dv-gparty [data-cls]').forEach(b => { const h = S.roster[b.dataset.cls]?.m, eg = h && S.roster[b.dataset.cls] ? D.edgeOf(S, h, fz) : ''; b.querySelector('i.af-v, i.af-r')?.remove(); if (eg) b.insertAdjacentHTML('afterbegin', `<i class="af-${eg === '▲' ? 'v' : 'r'}">${eg}</i>`); }); }
  // 작은 판 (지도 위): 관문 자세히 · 사건 선택지 · 야영 지점
  function pop(html, onclick) { $('dv-pop')?.remove(); const el = document.createElement('div'); el.id = 'dv-pop'; el.onpointerup = ev => ev.stopPropagation(); el.innerHTML = html + '<button class="dv-popx">닫기</button>'; el.onclick = ev => { const b = ev.target.closest('button'); if (!b) return; if (b.classList.contains('dv-popx')) return el.remove(); onclick && onclick(b, el); }; document.body.append(el); return el; }
  // 관문 자세히: 방법마다 그 방법을 가진 직업 — 지금 파티에 있으면 밝게(on) · 명단에만 있으면 보통 · 없으면 어둡게(off). 지금 파티의 값이 있으면 그 값
  const whoSt = w => { const nm = w.replace(/ \d+$/, ''), c = D.CLS.find(c0 => clsN(c0) === nm); if (!c) return ''; return D.teamCls(S).includes(c) ? 'on' : D.heroes(S).some(h => S.roster[h].m.cls === c) ? '' : 'off'; };
  const gatePop = (V, q) => pop(`<h4>${esc(D.gateTxt(S, V, q).split(' · ')[0])}</h4>${D.gateInfo(S, V, q).map(x => `<p class="gp-row"><b>${esc(x.k)}</b> ${x.val ? `<em>${esc(x.val)}</em>` : ''}${x.who.map(w => `<span class="gp-who ${w === '누구나' ? 'on' : whoSt(w)}">${esc(w)}</span>`).join('')}</p>`).join('')}`);
  function evPop(V, n, fl) {
    const sc = RUN.eventScene({ ...V, rng: () => 0.5, gold: 999, flags: {}, here: {}, log: [] }, n, n.ev), want = S.evPlan?.[fl]?.[n.id];
    pop(`<h4>${esc(n.name || '사건')}</h4>${sc.filter(c => !c.lock && !D.evPass(n.ev, c.n)).map(c => { const o = D.evOut(n.ev, c.n); return `<button data-evn="${esc(c.n)}" class="${want === c.n ? 'on' : ''}"${c.off && c.off() ? ' disabled' : ''}><b>${esc(c.n.replace(/^\[([^\]]*)\] /, '$1 · '))}</b><small>${[c.p != null && c.p < 1 ? `${Math.round(c.p * 100)}%` : '', o.ok.join(' · '), o.no.length ? `실패 ${o.no.join(' · ')}` : ''].filter(Boolean).join(' · ')}</small></button>`; }).join('')}`,
      (b, el) => { if (b.dataset.evn != null) D.evPlanSet(S, fl, n.id, b.dataset.evn); put(S); el.remove(); guild(); });
  }

  const drawMap = (box, fl) => pixMap(box, fl); // 길드 지도 = 픽셀 지도 (옛 SVG 손그림 지도 · 경로 그리기는 없앴다 — 2026-11-26)
  // 방에서 얻는 것 (아는 방만): 물건 수 + 나올 수 있는 등급 색 점 · 동료 +1 · 회복 % — 길드 지도 · 원정 중 미니맵이 같이 쓴다
  function rwSvg(map, fl) { const L = map._lay, add = [];
  const RC = ['#7b6852', '#2f8a3e', '#2f63c9', '#8a3fc4', '#c9741a'];
    for (const q of map.nodes) { if (!(q.visited || q.info >= 2)) continue; { const e = q.type === 'event' ? D.evOf(S, fl, q.id) : null; if (e) { const r = L.room[q.id]; add.push(`<text x="${(M6 + (r.x + r.w / 2) * T13).toFixed(1)}" y="${(M6 + r.y * T13 + 12).toFixed(1)}" class="note halo dv-rw" text-anchor="middle" fill="${e.st === 'done' ? '#2b1d14' : '#8e2a1a'}">${e.st === 'done' ? esc((e.r || '해결').split(' · ').slice(1).join(' · ').slice(0, 16) || '해결') : '사건 !'}</text>`); } } const o = D.reward(q, fl); if (!o.items && !o.ally && !o.heal) continue; const r = L.room[q.id], x = M6 + (r.x + r.w / 2) * T13, y = M6 + (r.y + r.h) * T13 - 4; // 방 아래 가장자리 안쪽 (이웃 방 이름과 겹치지 않게)
      const parts = o.items ? `<tspan>물건 ${o.items}</tspan>${o.r.map(k => `<tspan fill="${RC[k]}" font-size="13"> ●</tspan>`).join('')}` : o.ally ? `<tspan>동료 +${o.ally}</tspan>` : `<tspan>회복 ${o.heal}%</tspan>`;
      add.push(`<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" class="note halo dv-rw" text-anchor="middle" fill="#2b1d14">${parts}</text>`); }
    return add; }
  // ── 화면 아래 로그 (2026-11-23 사용자: 「전투상황 · 탐험 선택 로그를 확인할 수 있게」): 평소 최근 몇 줄, 누르면 펼쳐 지난 기록 (한 판 분량). 줄을 누르면 굴림 값
  //    재료: 전투 굴림(R.roll — 차례 띠의 행동 줄과 같은 것) · 탐사 기록(st.log) · 위 알림(toast). 판이 끝나면 저장(S.lastLog)해 길드의 지난 판 결과에서 다시 본다
  const LOG_MAX = 400, logK = t => (/금화|상자|합류|동료|레벨|스킬|두루마리|물약|도구|드롭|→ [^ ]+$/.test(t) && !/^갈림길/.test(t) ? 'got' : /전투|라운드|쓰러|기습|덮친|전멸|달아/.test(t) ? 'fight' : 'exp');
  let logSrc = { st: null, i: 0, roll: 0 };
  function logPush(k, t, d = '') { if (!run || !t) return; const L = run.log = run.log || []; if (L.length && L[L.length - 1].t === t) return; L.push({ k, t, d }); if (L.length > LOG_MAX) L.shift(); run.logDirty = true; }
  function logPoll() {
    const st = CRAWL.st; if (st) { if (logSrc.st !== st) { const keep = logSrc.st && st.log[logSrc.i - 1] === logSrc.st.log[logSrc.i - 1]; logSrc.st = st; logSrc.i = keep ? logSrc.i : 0; /* 계단: 새 층 기록은 지난 층 기록 뒤에 이어 붙는다 — 이미 읽은 줄은 건너뛴다 */ logPush('floor', `${st.floor}층 · ${RUN.zone(st.floor).n}`); } for (; logSrc.i < st.log.length; logSrc.i++) { gateSee(st, st.log[logSrc.i]); noteSee(st, st.log[logSrc.i]); const o = logLine(st, st.log[logSrc.i]); if (o) logPush(o[0], o[1], o[2]); } }
    const r = R.roll; if (R.turn && r && r.id !== logSrc.roll && r.who) { logSrc.roll = r.id;
      const tw = D.tkTake(r.who); logPush('fight', rollLine(r) + (tw ? ` · ${tw}` : ''), `${r.nat ? `d20 ${r.nat}` : ''}${r.calc ? ` ${r.calc}` : ''}${r.need ? ` · 필요 ${r.need}` : ''}`.trim()); }
  }
  // 굴림 한 줄 (2026-11-27 사용자: 「게임로그를 조금 더 trpg스럽게」): 누가 누구를 · 주사위 · 결과를 진행자가 읽듯이. 「엘티가 그림록을 공격한다 · 14+15=29 vs AC 11 · 명중! 11 피해 · 그림록이 쓰러진다」
  const jo = (w, a, b) => { const c = String(w).charCodeAt(String(w).length - 1) - 0xac00; return w + (c >= 0 && c < 11172 && c % 28 ? a : b); }; // 받침이 있으면 a
  function rollLine(r) {
    const who = r.who, tg = r.tg, what = r.what || '공격', C = (r.calc || '').split(' · '), ac = C.find(x => /^AC /.test(x)), dc = (r.calc || '').match(/^(.+) DC (\d+)/), mods = C.filter(x => x !== C[0] && x !== ac);
    const res = (r.res || '').split(' · ').filter(Boolean).map(x => (x === '쓰러짐' && tg ? jo(tg, '이', '가') + ' 쓰러진다' : x.replace(/^(\d+)회 중 (\d+) 명중$/, '$2/$1회'))).join(' · ');
    if (r.atk && tg && ac) { const b = parseInt(C[0], 10), roll = r.nat != null && !isNaN(b) ? `${r.nat}${b >= 0 ? '+' : '−'}${Math.abs(b)}=${r.nat + b} vs ${ac}${mods.length ? ` (${mods.join(' · ')})` : ''}` : ac;
      const hit = r.nat === 20 ? '치명타!' : r.nat === 1 ? '대실패' : r.ok ? '명중!' : '빗나갔다';
      return `${what === '공격' ? `${jo(who, '이', '가')} ${jo(tg, '을', '를')} 공격한다` : `${who}의 ${what} → ${tg}`} · ${roll} · ${hit}${r.ok && res ? ` ${res}` : ''}`; }
    if (tg && dc) return `${who}의 ${what === '공격' ? '기본 공격' : what} → ${jo(tg, '은', '는')} ${dc[1]} DC ${dc[2]} · ${r.word === '실패' ? '실패' : '성공'}${res ? ` · ${res}` : ''}`;
    if (tg) return `${who}의 ${what} → ${tg}${res ? ` · ${res}` : ''}`;
    return `${jo(who, '이', '가')} ${jo(what, '을', '를')} 쓴다${res ? ` · ${res}` : ''}`;
  }
  // 로그 대신 게임 화면에 (2026-11-27 사용자: 「메인 게임화면상에서 확인할수 있는 방법으로 · 로그는 없애자」): 함정 피해 · 굶주림 · 문 부수기를 그 영웅 머리 위에
  const entOf = (st, n) => { const m = st.party.find(q => q.n === n); return m && R.party.find(p => p.merc && m.hero && p.merc.uid === m.hero.uid); };
  const float = (e, s, col, sz = 0.85) => { if (e) G.fx(R, { k: 'text', x: e.x, y: e.y - 0.6, s, col, t: 1.1, sz }); };
  function noteSee(st, e) {
    if (!run || run.over) return; const t = String(e.t || '');
    if (e.trap) { for (const [n, v] of e.trap) float(entOf(st, n), v > 0 ? `-${v}` : '회피', v > 0 ? '#ff6b6b' : '#9aa0a8'); const a = entOf(st, e.trap[0]?.[0]); if (a) G.fx(R, { k: 'text', x: a.x, y: a.y - 1.4, s: '함정!', col: '#ffb050', t: 1.2, sz: 1 }); return; }
    if (/^물자 0 · 굶주림/.test(t)) { for (const m of st.party) if (!m.dead) float(entOf(st, m.n), t.replace(/^.*체력 /, ''), '#ffb050'); const sup = document.querySelector('#dv-pick .pk-sup'); if (sup) { sup.classList.remove('dv-flash'); void sup.offsetWidth; sup.classList.add('dv-flash'); } return; }
    let m; if ((m = t.match(/^(.+) · (부숨|치움) · 적이 알아챔$/)) || (m = t.match(/^(.+) · (부숨|치움)$/))) { const a = entOf(st, m[1]); if (a) G.fx(R, { k: 'text', x: a.x, y: a.y - 1.4, s: '쾅!', col: '#ffd45a', t: 1, sz: 1.2 }); }
  }
  // 탐사 기록 한 줄 → 로그 줄 [종류, 글, 굴림] (원정 모드): 이름 · 선택 · 결과 · 수치만. 옛 서술 문장은 숨긴다 (사건은 note가 한 줄로 남긴다)
  const heroN = (st, n) => { const i = st.party.findIndex(m => m.n === n), p = CRAWL.view()?.party?.[i]; return p?.m?.name || n; };
  function logLine(st, e) {
    const t = String(e.t || '').replace(/\.$/, '');
    if (e.k === 'fork' || e.k === 'dv') return ['exp', t];
    if (e.trap) { const hit = e.trap.filter(([, v]) => v > 0); return ['fight', hit.length ? `함정 · ${hit.map(([n, v]) => `−${v} (${heroN(st, n)})`).join(' · ')}` : '함정 · 피함']; }
    if (e.r) { const r = e.r, ok = r.ok ? '성공' : '실패', pct = `${Math.round(r.p * 100)}%`;
      if (r.what === '자물쇠' || r.what === '문 부수기') return ['exp', `잠긴 문 · ${r.what === '자물쇠' ? '따기' : '부수기'} ${pct} · ${ok}`];
      if (r.what === '조사') return ['exp', `조사 ${r.tot} (필요 ${r.dc}) · ${ok}`];
      if (r.what === '정찰' || r.what === '추적') return ['exp', `${r.what} · ${ok}`];
      return null; } // 사건 판정은 note가 사건 이름 · 선택과 함께 한 줄로
    let m;
    if ((m = t.match(/^(.+) — 전투가 시작된다$/))) return ['fight', `${m[1]} — 선제권을 굴린다`];
    if ((m = t.match(/^전투에서 이겼다 \((\d+)라운드\)(?:\. )?(.*)$/))) return ['got', `전투 끝 (${m[1]}라운드)${m[2] ? ` · 전리품: ${m[2]}` : ''}`];
    if ((m = t.match(/^합류: (.+?) \(/))) return ['got', `동료 +1 · ${m[1]}`];
    if (/전멸/.test(t)) return ['fight', '전멸'];
    if (/먼저 덮쳐/.test(t)) return ['fight', '기습! 적이 먼저 움직인다'];
    if (/적이 달아났다/.test(t)) return ['fight', '교착 · 적이 달아남'];
    if (/쓰러졌다\. 아래로/.test(t)) return ['exp', '우두머리 · 계단'];
    return null;
  }
  const LOG_IC = { fight: '⚔', exp: '›', got: '+', floor: '▼' };
  const logRows = (L, n) => L.slice(-n).map((e, i) => `<li class="lg-${e.k}"${e.d ? ` data-d="${esc(e.d)}"` : ''}><i>${LOG_IC[e.k] || '›'}</i>${esc(e.t)}${e.d ? `<small>${esc(e.d)}</small>` : ''}</li>`).join('');

  // 원정 중 미니맵(#pmapbox): 이 층의 계획한 길을 점선으로 (지나온 길의 발자국 점은 RUN.draw가 찍는다). 미니맵을 다시 그리면 다시 얹는다
  function miniPlan() {
    const svg = $('pmap'), st = CRAWL.st; if (!svg || !st || svg.querySelector('.dv-mini')) return;
    const d = []; for (let k = 0; k + 1 < (st.plan || []).length; k++) { const x = segD(st.map, st.plan[k], st.plan[k + 1]); if (x) d.push(x); }
    svg.insertAdjacentHTML('beforeend', `<g class="dv-mini">${rwSvg(D.drawState(S, st).map, st.floor).join('')}${d.length ? `<path class="dv-mplan" d="${d.join(' ')}" fill="none" stroke="#a0412d" stroke-width="2.4" stroke-dasharray="5 4" stroke-linecap="round" opacity="0.8"/>` : ''}</g>`); // 보상 표시 · 계획한 길 (점선)
  }
  // ── 도감: 몬스터(만난 것 · 잡은 수, 안 만난 것은 실루엣 + ? + 나오는 구역) · 영웅(직업 × 빌드, 데리고 나간 것) ──
  // 상성 줄: 유형 · ▲취약 · ▼저항 · ✕면역 (모르면 ?)
  const affLi = n => { if (!D.affKnown(S, n)) return '<span class="dx-af">?</span>'; const a = D.affOf(n); if (!a) return ''; const L = (sym, cls, ts) => ts.map(t => `<i class="${cls}">${sym}${D.DT_N[t] || t}</i>`).join(''); return `<span class="dx-af">${esc(D.TY_N[a.ty] || a.ty || '')}${L('▲', 'af-v', a.vul)}${L('▼', 'af-r', a.res)}${L('✕', 'af-i', a.imm)}</span>`; };
  function dex(tab) {
    const box = panel('dv-dex'), M = D.dexMons(), H = D.dexHeroes(), dc = D.dexCount(S), mGot = M.filter(x => S.dex.m[x.n]?.met).length, hGot = H.filter(b => S.dex.h[b.id]).length;
    const mon = x => { const e = S.dex.m[x.n]; return e?.met ? `<li class="dx-on"><canvas width="26" height="30" data-n="${esc(x.n)}"></canvas><em>${esc(x.n.slice(0, 1))}</em><b>${esc(x.n)}</b><small>잡은 수 ${e.kill}</small>${affLi(x.n)}</li>`
      : `<li><canvas width="26" height="30" data-n="${esc(x.n)}" data-sil="1"></canvas><em>?</em><b>?</b><small>${esc(x.z)}</small></li>`; };
    const I = D.dexItems(), iGot = I.filter(x => S.dex.i[x.k]).length;
    const item = x => (S.dex.i[x.k] ? `<li class="dx-on"><b class="r${x.r}">${esc(x.n)}</b><small class="r${x.r}">${D.RARITY[x.r]} · ×${S.dex.i[x.k]}</small></li>` : `<li><b>?</b><small class="r${x.r}">${D.RARITY[x.r]}</small></li>`);
    const hero = b => { const n = S.dex.h[b.id], h = Object.values(S.roster).find(x => x.m.build === b.id)?.m; return n ? `<li class="dx-on"><b>${esc(b.n)}</b><small>${esc(clsN(b.cls))} · 원정 ${n}${h ? ` · ${esc(h.name)} ${h.lv}레벨` : ''}</small></li>` : `<li><b>?</b><small>${esc(clsN(b.cls))}</small></li>`; };
    box.innerHTML = `<header><h2>도감</h2><div class="dv-res"><span class="chip">${dc.got}/${dc.all}</span><button class="chip dv-x">닫기</button></div></header>`
      + `<div class="dv-tabs"><button data-t="m" class="${tab === 'm' ? 'on' : ''}">몬스터 ${mGot}/${M.length}</button><button data-t="i" class="${tab === 'i' ? 'on' : ''}">아이템 ${iGot}/${I.length}</button><button data-t="h" class="${tab === 'h' ? 'on' : ''}">영웅 ${hGot}/${H.length}</button></div>`
      + (tab === 'm' ? `<ul class="dx-grid">${M.map(mon).join('')}</ul>` : tab === 'i' ? [4, 3, 2, 1].map(r => { const L = I.filter(x => x.r === r); return `<h4 class="r${r}">${D.RARITY[r]} <small>${L.filter(x => S.dex.i[x.k]).length}/${L.length}</small></h4><ul class="dx-grid dx-h dx-i">${L.map(item).join('')}</ul>`; }).join('') /* 높은 등급부터, 등급마다 묶어 */ : `<ul class="dx-grid dx-h">${H.map(hero).join('')}</ul>`);
    box.onclick = ev => { const b = ev.target.closest('button'); if (!b) return; if (b.classList.contains('dv-x')) { box.remove(); return; } if (b.dataset.t) dex(b.dataset.t); };
    faces(box);
  }
  // 얼굴: 전투 차례 띠와 같은 그림 (UI.face — 사람형 몬스터만 그림이 있다, 나머지는 첫 글자). 인형 그림이 늦게 오면 잠깐 뒤에 다시. 안 만난 것은 검은 실루엣
  function faces(box) {
    let left = 0;
    for (const cv of box.querySelectorAll('canvas[data-n]:not([data-ok])')) {
      const m = { kind: 'mon', n: cv.dataset.n, ...G.D.F.mon[cv.dataset.n] };
      if (typeof MD === 'undefined' || !MD.isMon(m)) { cv.dataset.ok = '0'; continue; }
      if (!UI.face(cv, m)) { left++; continue; }
      cv.dataset.ok = '1'; cv.parentNode.classList.add('pic');
      if (cv.dataset.sil) { const x = cv.getContext('2d'); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#4a3a2a'; x.fillRect(0, 0, cv.width, cv.height); }
    }
    if (left && box.isConnected) setTimeout(() => faces(box), 400);
  }
  // ── 자리를 비운 동안: 다시 열 때(world) · 창이 다시 보일 때 정산, 보이는 동안은 마지막으로 본 시각을 15초마다 적는다 (보이는 채로 돈 시간은 정산하지 않는다) ──
  function watch() {
    const mark = () => { S.seen = Date.now(); put(S); };
    setInterval(() => { if (document.visibilityState === 'visible') mark(); }, 15000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') return mark();
      const a = D.settle(S, Date.now()); put(S); if (a.gold) { awayBox(a); if ($('dv-guild')) guild(); }
    });
    addEventListener('pagehide', mark);
  }
  function awayBox(a) {
    const h = Math.floor(a.ms / 3600e3), m = Math.floor(a.ms % 3600e3 / 60e3), el = document.createElement('div'); el.id = 'dv-away'; el.onpointerup = ev => ev.stopPropagation();
    el.innerHTML = `<h3>자리 비움 ${h ? `${h}시간 ` : ''}${m}분</h3><p><b>${UI.px('coin')} +${a.gold.toLocaleString()}</b>${a.xp ? `<br>경험치 +${a.xp.toLocaleString()}` : ''}</p>${upsTxt(a.ups || [])}<button>확인</button>`;
    el.querySelector('button').onclick = () => el.remove(); $('dv-away')?.remove(); document.body.append(el); document.body.dataset.away = a.gold;
  }
  // 확대 (hud.js의 HUD.zoom이 원정 모드면 이것을 쓴다): 너비만 보던 것을 위아래 바를 뺀 높이와 함께 — 가로로 낮은 창(640×360)에서 파티가 화면 밖으로 밀리던 것
  function zoom(fight) {
    const w = STG.clientWidth || innerWidth, h = Math.max(120, (STG.clientHeight || innerHeight) - 100), wide = w >= 700;
    return Math.max(1, Math.round(DPR * Math.min(w / (wide ? 560 : 230), wide ? (h + 100) / 190 : h / 200))); /* 넓은 가로 화면(폰 가로 844×340): 높이 항이 반올림으로 배율을 1로 떨어뜨려 캐릭터가 절반 크기가 됐다 (2026-11-24) — 가로에서는 위아래 막대가 전장 위에 얹히니 전체 높이로 본다 */ // 탐사 · 전투 같은 기본 배율 — 전투 중에는 fitZoom이 싸우는 사람들에 맞춰 한 칸씩 (카메라 가운데는 main.js)
  }
  // 스킬 효과 꼬리표 (설명 문장 대신 짧게 — 엔진 스킬 자료의 효과 줄을 그 영웅의 수치로, 추가 행동이면 표시)
  // 스킬 글 (2026-11-27 사용자: 「간결하게 효과만」 · 「8d6이라는거 자체가 현대식이 아니잖아 · 데미지 범위를 써줘야지 · 회피하면 절반 이런건 빼고」 · 「범위는 1칸 범위, 4칸 범위 같은 형태로 동일하게」)
  //   규칙 글에서 내성 · 집중 · 슬롯 · AI가 쓰는 때(체력 절반 아래 등 — 규칙이 아니라 스킬 AI의 조건)를 덜고, 주사위는 범위(8d6 → 8~48), 넓이는 「N칸 범위」 하나로
  const SK_DROP = /집중|슬롯|^무기 공격$|^(근력|민첩|건강|지혜|지능|매력) 내성( 절반| 무효)?$|^절반$|^무효$|경량 무기|중 하나|^$/;
  const SK_RW = [[/^무기 공격 \+ /, ''], [/^(무기로 )?맞히면 |^명중하면 |^내가 맞히면 /, ''], [/^명중 (?=\d)/, ''], [/^자신 |^멀리서 |^반드시 맞는 |^체력 절반 아래 |^절반 아래 |^이번 차례에 |^이번 라운드 |^라운드마다 |^가장 다친 동료 |^기습 /, ''], [/ ?(차례|라운드)마다 /, ' '],
    [/^(근력|민첩|건강|지혜|지능|매력) 내성 /, ''], [/ (근력|민첩|건강|지혜|지능|매력) 내성$/, ''], [/나를 노리는 공격 불리/, '피격 불리'], [/공격 행동 한 번 더/, '공격 +1회'], [/incapacitated/, '무력'], [/unconscious/, '기절'],
    [/^곁의 (다른 )?적(에게)? /, '1칸 범위 '], [/^(?:반경|곁) (\d+)칸( |$)/, '$1칸 범위$2'], [/^(\d+)칸( (?!범위|밀침)|$)/, '$1칸 범위$2'], [/^(\d+칸 범위) (?!·)/, '$1 · '], [/^넷에게 /, '4명 '], [/^셋에게 /, '3명 '], [/^여섯 /, '6명 '], [/^셋 /, '3명 '], [/강한 적 표식/, '표식'],
    [/ (화염|광휘|사령|관통|베기|둔기|역장|냉기|번개|천둥|정신)(?= |$)/, ''], [/^먼 적 곁으로 뛰어든다$/, '돌진'], [/^위험하면 순간 이동$/, '순간 이동'], [/(\d+)라운드/g, '$1턴'], [/^\s+|\.$/g, '']];
  const dr = (n, m, k = 0) => `${n + k}~${n * m + k}`; // 주사위 → 범위
  const skDice = t => t.replace(/(\d+)d(\d+)\s*([+−-])\s*(\d+)(?![d\d])/g, (_, n, m, sg, k) => dr(+n, +m, (sg === '+' ? 1 : -1) * +k)).replace(/(\d+)d(\d+)/g, (_, n, m) => dr(+n, +m)).replace(/\+d(\d+)(?![~\d])/g, (_, m) => `+1~${m}`).replace(/(\d+~\d+) \+ (\d+)~(\d+)/g, (_, a, b, c) => { const [x, y] = a.split('~').map(Number); return `${x + +b}~${y + +c}`; });
  const skParts = (t, heal) => { let P = skDice(String(t || '').replace(/\s*\([^)]*\)/g, '')).split(' · ').map(p => SK_RW.reduce((q, [a, b]) => q.replace(a, b), p.trim())).filter(p => !SK_DROP.test(p));
    return P.map(p => (/^\+?\d+~\d+$|^\d+$/.test(p) ? `${heal ? '회복' : /^\+/.test(p) ? '추가 피해' : '피해'} ${p.replace(/^\+/, '')}` : p.replace(/^(\d+칸 범위 ·|\d+명|일직선|파티(?: \d+명)?) (\d+~\d+|\d+)$/, `$1 · ${heal ? '회복' : '피해'} $2`).replace(/ · · /g, ' · '))); };
  const skShort = (t, heal) => { const P = skParts(t, heal); let o = P.slice(0, 2).join(' · '); if (o.length > 22) o = P[0] || ''; return o.length > 22 ? o.slice(0, 21) + '…' : o; };
  const skHeal = k => !!G.Skill.SK[k]?.heal || /회복|체력 절반 아래/.test(G.D.MSKILLS[k]?.d || ''), skTag = (m, k) => { let t = ''; try { t = G.Skill.text(m, k) || ''; } catch (e) { t = ''; } return skShort(t, skHeal(k)) || skShort(G.D.MSKILLS[k]?.d, skHeal(k)) || (/소환/.test(G.D.MSKILLS[k]?.n || '') ? '소환' : ''); };
  // 스킬 자세히 (영웅 창에서 누르면): 종류 · 쿨 · 규칙 글 전체
  const skPop = (m, k) => { let t = ''; try { t = G.Skill.text(m, k) || ''; } catch (e) { t = G.D.MSKILLS[k]?.d || ''; } const kd = G.Skill.kindOf(k), cd = G.Res.cdOf ? G.Res.cdOf(k) : 0;
    pop(`<h4>${SKUI.img(k)} ${esc(G.D.MSKILLS[k]?.n || k)}</h4><p class="gp-row">${esc(kd === '늘 적용' ? '패시브' : '스킬')}${cd ? ` · 쿨 ${cd}` : ''}</p><p>${esc(skParts(t, skHeal(k)).join(' · ') || t)}</p>`); };
  // ── 레벨업 카드 창 (2026-11-23): 카드 셋(이름 · 주사위 · 쿨 N) — 칸이 다 찼으면 고른 뒤 바꿀 칸 또는 넘김. 원정 중에는 CARD.WAIT초 안에 답이 없으면 추천 · 떠 있는 동안 원정은 멈춘다
  function cardWin(m, done, timed) {
    const q = (m.cardq || [])[0]; if (!q) return done && done(); const offer = D.cardOffer(m), full = q.kind === 'swap' || (m.picks || []).length >= G.Builds.SLOT_N, K = G.D.MSKILLS;
    let el = $('dv-card'); if (!el) { el = document.createElement('div'); el.id = 'dv-card'; el.className = 'dv-panel'; el.onpointerup = ev => ev.stopPropagation(); document.body.append(el); }
    const cd = k => { const c = G.Res.cdOf ? G.Res.cdOf(k) : 0; return c ? `쿨 ${c}` : ''; }, num = k => skTag(m, k);
    let pick = null, t0 = performance.now();
    const draw = () => { el.innerHTML = `<header><h2>${esc(m.name)} <small>Lv ${q.lv}${(m.cardq || []).length > 1 ? ` · ${m.cardq.length}` : ''}</small></h2>${timed ? '<span class="chip dv-ct"></span>' : '<button class="chip dv-x">닫기</button>'}</header>`
      + `<div class="dv-cards">${offer.map((k, i) => `<button data-k="${k}" class="${pick === k ? 'on' : ''}${i === 0 ? ' rec' : ''}"><b>${esc(K[k]?.n || k)}</b><small>${[num(k), cd(k)].filter(Boolean).join(' · ')}</small>${i === 0 ? `<i>${UI.px('star')}</i>` : ''}</button>`).join('')}</div>`
      + (full && pick ? `<div class="dv-swap">${(m.picks || []).map((k, i) => `<button data-s="${i}"><b>${esc(K[k]?.n || k)}</b></button>`).join('')}</div>` : '')
      + `<div class="dv-row"><button class="dv-skip">넘김</button></div>`; };
    const fin = (k, slot) => { clearInterval(tm); D.cardChoose(m, k, slot); put(S); el.remove(); if ((m.cardq || []).length && !timed) return cardWin(m, done, timed); done && done(); };
    const tm = timed ? setInterval(() => { const left = Math.ceil(D.CARD.WAIT - (performance.now() - t0) / 1000), c = el.querySelector('.dv-ct'); if (c) c.textContent = left; if (left <= 0) { const rec = offer[0]; fin(full ? null : rec); } }, 250) : 0;
    el.onclick = ev => { const b = ev.target.closest('button'); if (!b) return;
      if (b.classList.contains('dv-x')) { clearInterval(tm); el.remove(); return done && done(); }
      if (b.classList.contains('dv-skip')) return fin(null);
      if (b.dataset.k) { if (!full) return fin(b.dataset.k); pick = b.dataset.k; t0 = performance.now(); return draw(); }
      if (b.dataset.s != null && pick) return fin(pick, +b.dataset.s); };
    draw();
  }
  // 사건 선택 창 (처음 만났을 때 · 계획에서 안 골랐을 때): 선택지마다 이름 · 판정 확률 · 결과 숫자, 맨 아래 「자리를 피한다」. 20초 안에 답이 없으면 피함 · 떠 있는 동안 원정은 멈춘다
  // 사건은 파티 구성으로 저절로 (오토배틀러 축, 2026-11-26): 할 수 있는 선택지 중 성공률 × 얻는 것이 가장 큰 것. 얻을 것이 없으면 자리를 피한다
  function evAuto(st, sc, pick) {
    if (run.over) return; const n = st.map.nodes[st.at], fl = st.floor, id = st.at;
    let best = null, bs = 0; sc.choices.forEach((c, i) => { if (c.lock || (c.off && c.off()) || D.evPass(n.ev, c.n)) return; const o = D.evOut(n.ev, c.n), p = c.p != null ? c.p : 1, v = p * o.ok.length - (1 - p) * o.no.length * 0.6 - (o.cost || 0) / 40; if (v > bs) { bs = v; best = i; } });
    setTimeout(() => { if (run.over) return; if (best == null) { D.evMark(S, fl, id, { st: 'skip' }); put(S); st.log.push({ t: `${sc.title} · 지나감`, k: 'dv' }); } pick(best); }, 900 / Math.max(1, spd() / (D.speeds(D.fresh())[0] || 1)));
  }
  // 원정 중: 전투가 아닐 때 고를 것이 있는 영웅이 있으면 창 (레벨업 카드를 끄면 빌드대로)
  function cardTick() {
    if ($('dv-card') || FIGHT.on || !CRAWL.st || CRAWL.st.done || run.over) return; /* 판이 끝났으면(우두머리를 잡고 길드로 돌아가는 사이) 묻지 않는다 — 다음 판에 */ const ms = G.Party.members(G.S.w.fantasy).filter(m => (m.cardq || []).length); if (!ms.length) return;
    if (S.cardOn === false) { for (const m of ms) D.cardAuto(m); return; }
    cardWin(ms[0], null, true);
  }
  // 저절로 복귀 (원정 중): 「경로 끝 복귀」면 계획한 경로의 방을 다 지나 일이 끝났을 때, 「가득 차면 복귀」면 짐이 찼을 때 — 전투 · 창 · 걷는 중이 아닐 때만. 살아서 복귀로 친다
  function autoBack() {
    const st = CRAWL.st, v = CRAWL.view(); if (!st || run.over || st.done || v?.fighting || $('crawlscene') || $('dv-fork') || $('dv-cost') || $('exitsign') || REWARDUI.active) return;
    for (const k of ['potion', 'knockScroll', 'seeScroll', 'tools']) if (st.items[k] > 0) { st.gold += 10 * st.items[k]; st.log.push({ t: `${{ potion: '치유 물약', knockScroll: '열림 두루마리', seeScroll: '투시 두루마리', tools: '도둑 도구' }[k]} → 금화 +${10 * st.items[k]}`, k: 'dv' }); st.items[k] = 0; } // 원정에는 물약 · 두루마리 · 도구가 없다 (얻으면 금화로)
    if (D.wantCamp(S, st)) { const ms = G.Party.members(G.S.w.fantasy), r0 = D.campHere(st, ms); if (r0 && !r0.raid) for (const p of R.party) if (!p.dead) p.hp = p.max; return; } // 야영 (계획한 지점 · 계획이 없으면 체력 절반 아래)
    const planDone = S.endMode === 'back' && st.plan && st.plan.length > 1 && st.plan.every(id => st.map.nodes[id].visited) && st.at === st.plan[st.plan.length - 1];
    const full = S.fullBack && D.bagFull(st), al = st.party.filter(m => !m.dead), risk = S.risk !== false && al.length && ((al.reduce((a, m) => a + m.hp / m.max, 0) / al.length < 0.5 && !(st.items.camp > 0)) || (al.length < 2 && st.map.edges.some(e => e.a === st.at && ['boss', 'elite'].includes(st.map.nodes[e.b].type) && !st.map.nodes[e.b].visited) && !st.map.edges.some(e => e.a === st.at && !['boss', 'elite'].includes(st.map.nodes[e.b].type) && !st.map.nodes[e.b].visited && (e.kind !== 'hidden' || e.seen?.hidden)))); // 위험하면 복귀: 체력 평균 절반 아래 + 야영 물자 없음, 또는 혼자인데 남은 길이 정예 · 우두머리뿐
    if (!planDone && !full && !risk) { run.backT = 0; return; }
    if ((run.backT = (run.backT || 0) + 1) < 40) return; // 그 방 일(줍기 · 사건 알림)이 끝나게 잠깐 기다린다
    st.log.push({ t: risk ? '파티 위험 · 귀환' : planDone ? '경로 완주 · 귀환' : '짐 가득 · 귀환', k: 'dv' }); finish(st, risk ? 'risk' : planDone ? 'plan' : 'full');
  }
  // 원정 중 짐 목록 (위 막대의 짐 칩을 누르면): 남은 물자 · 전리품 이름과 등급 색 · 값
  // ── 인벤토리 · 창고 (2026-11-27 사용자: 「인벤토리라던가 창고 ui는 비슷한 게임들 ui참고해서 잘 만들어봐」) ──
  //   틀: 왼쪽 영웅 장비 칸(배틀 브라더스 · 다크스트 던전의 인물 칸) · 가운데 물건 격자(칸 수 = 짐 칸 · 창고 칸, 빈 칸도 보인다 — 다크스트 던전의 짐 막대) · 오른쪽 자세히 판(비교 · 영웅마다 끼우기 단추 — 모바일 RPG의 물건 상세)
  //   등급은 테두리 색 (고급 초록 · 희귀 파랑 · 매우 희귀 보라 · 전설 주황). 원정 중(bag)은 전투 밖에서만 바꾼다 · 넘친 새 물건은 격자 위 줄에 (하나를 버려야 들어온다)
  const SLOT_IC = { w: 'sword', o: 'shield', a: 'armor', t1: 'ring', t2: 'amulet' };
  let invSel = null;
  function invWin(mode, keep) {
    const run0 = mode === 'bag', st = CRAWL.st; if (run0 && !st) return; if (!keep) invSel = null;
    const el = $('dv-inv') || (() => { const d = document.createElement('div'); d.id = 'dv-inv'; d.onpointerup = ev => ev.stopPropagation(); d.onpointerdown = ev => ev.stopPropagation(); document.body.append(d); return d; })();
    const f = G.S.w.fantasy, fight = run0 && !!CRAWL.view()?.fighting;
    const heroes = run0 ? R.party.filter(p => p.merc && !p.dead).map(p => ({ key: p.merc.uid, n: p.merc.name, lv: p.merc.lv, m: p.merc, cls: p.merc.hid, worn: G.Gear.worn(f, p.merc) }))
      : D.team(S).concat(Object.keys(S.roster).filter(c => !D.team(S).includes(c) && !S.dead[c])).filter(c => S.roster[c]).map(c => ({ key: c, n: S.roster[c].m.name, lv: S.roster[c].m.lv, m: S.roster[c].m, cls: c, worn: D.stashWorn(S, c) }));
    const items = run0 ? st.loot || [] : S.stash || [], cap = run0 ? st.bagCap || 0 : D.STASH_CAP, pend = run0 ? st.pend || [] : [];
    const used = run0 ? D.bagUsed(st) : items.length, sup = run0 ? D.SUP_KEYS.filter(k => st.items[k] > 0) : [];
    const tile = (e, attr, extra = '') => `<button class="iv-c r${e.r || 0}${extra}" ${attr}>${ico(itemX(e)) || UI.px(e.gem ? 'gem' : { w: 'sword', a: 'armor', s: 'shield', t: 'ring' }[e.sl] || 'dots')}${e.gem && e.cnt > 1 ? `<em>${e.cnt}</em>` : ''}</button>`;
    const cells = [...sup.map(k => `<span class="iv-c iv-sup">${ico({ sup: k }) || UI.px(SUP_N[k][1])}<em>${st.items[k]}</em></span>`), ...items.map((e, i) => tile(e, `data-i="${i}"`, invSel?.i === i ? ' on' : ''))];
    const free = Math.max(0, cap - (run0 ? used : items.length)); for (let k = 0; k < free; k++) cells.push('<span class="iv-c iv-empty"></span>');
    const row = h => `<div class="iv-h"><canvas data-f="${h.cls}" width="26" height="30"></canvas><b>${esc(h.n)}<small>Lv ${h.lv}</small></b><span>${h.worn.map(w => `<button class="iv-s r${w.r || 0}${w.empty ? ' empty' : ''}${invSel?.h === h.key && invSel?.slot === w.slot ? ' on' : ''}" data-h="${h.key}" data-s="${w.slot}">${UI.px(SLOT_IC[w.slot] || 'dots')}</button>`).join('')}</span></div>`;
    // 자세히 판
    let det = '<div class="iv-none">' + UI.px('dots') + '</div>';
    const pick = invSel?.p != null ? pend[invSel.p] : invSel?.i != null ? items[invSel.i] : null;
    if (pick) { const o = pick.x ? D.xInfo(pick.x) : null;
      det = `<div class="iv-top">${ico(itemX(pick)) || UI.px('gem')}<b class="r${pick.r || 0}">${esc(pick.n)}</b><small>${pick.gem ? `보석 ×${pick.cnt || 1}` : `${D.RARITY[pick.r || 0]} · ${esc(o?.slotN || '')}`}</small></div>`
        + (o?.lines?.length ? `<ul class="iv-ln">${o.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : '')
        + (pick.x && invSel.p == null ? `<div class="iv-eq">${heroes.map(h => { const ft = run0 ? D.fitOf(f, h.m, pick.x) : D.stashFit(S, h.cls, pick.x); return `<button data-eq="${h.key}"${ft.ok && !fight ? '' : ' disabled'} data-at="${ft.at || ''}"><b>${esc(h.n)}</b><small>${esc(ft.ok ? ft.cmp : ft.why)}</small></button>`; }).join('')}</div>` : '')
        + `<div class="iv-act">${invSel.p != null ? '<button data-drop="pend">버리기</button>' : run0 ? `<button data-drop="${invSel.i}"${fight ? ' disabled' : ''}>버리기</button>` : `<button data-sell="${invSel.i}">팔기 ${UI.px('coin')} ${pick.gold || 0}</button>`}</div>`; }
    else if (invSel?.slot) { const h = heroes.find(q => q.key === invSel.h), w = h?.worn.find(q => q.slot === invSel.slot);
      if (w) det = `<div class="iv-top">${UI.px(SLOT_IC[w.slot])}<b class="r${w.r || 0}">${esc(w.n)}</b><small>${esc(h.n)} · ${esc(w.slotN || '')}</small></div>${w.sub ? `<ul class="iv-ln"><li>${esc(w.sub)}</li></ul>` : ''}<div class="iv-act">${w.off ? `<button data-off="${w.slot}"${fight ? ' disabled' : ''}>빼기</button>` : ''}</div>`; }
    el.innerHTML = `<div class="iv-pn"><header><h3>${run0 ? `${mi('inventory')} 짐 ${used}/${cap}` : `${mi('inventory')} 창고 ${items.length}/${cap}`}</h3>${run0 ? '' : `<span class="chip c-gold">${UI.px('coin')} ${S.gold}</span>`}<button class="chip iv-x">닫기</button></header>`
      + `<div class="iv-body"><div class="iv-party">${heroes.map(row).join('')}</div><div class="iv-mid">${pend.length ? `<div class="iv-pend">${UI.px('warn')}${pend.map((e, k) => tile(e, `data-p="${k}"`, invSel?.p === k ? ' on' : '')).join('')}</div>` : ''}<div class="iv-grid">${cells.join('')}</div></div><div class="iv-det">${det}</div></div></div>`;
    el.querySelectorAll('canvas[data-f]').forEach((cv, k) => { const m = heroes[k]?.m; const draw = () => { if (cv.isConnected && m && !UI.face(cv, m)) setTimeout(draw, 400); }; draw(); });
    el.onclick = ev => { const b = ev.target.closest('button'); if (!b || b.disabled) return; const ds = b.dataset;
      if (b.classList.contains('iv-x')) { el.remove(); invSel = null; if (!run0) guild(); return; }
      if (ds.i != null) { invSel = { i: +ds.i }; return invWin(mode, true); }
      if (ds.p != null) { invSel = { p: +ds.p }; return invWin(mode, true); }
      if (ds.h != null) { invSel = { h: run0 ? +ds.h : ds.h, slot: ds.s }; return invWin(mode, true); }
      const hero = k => heroes.find(q => String(q.key) === String(k));
      if (ds.eq != null) { const h = hero(ds.eq); if (run0) D.bagEquip(f, st, invSel.i, h.m, ds.at || null); else { D.stashEquip(S, h.cls, invSel.i, ds.at || null); put(S); } invSel = null; refreshHP?.(); return invWin(mode, true); }
      if (ds.off) { const h = hero(invSel.h); if (run0) D.bagUnequip(f, st, h.m, ds.off); else { D.stashUnequip(S, h.cls, ds.off); put(S); } invSel = null; return invWin(mode, true); }
      if (ds.drop != null) { D.bagDrop(st, ds.drop === 'pend' ? 'pend' : +ds.drop); invSel = null; return invWin(mode, true); }
      if (ds.sell != null) { D.stashSell(S, +ds.sell); put(S); invSel = null; return invWin(mode, true); } };
  }
  const refreshHP = () => { barK = ''; };

  // ── 원정 중 위 바 · 아래 파티 (읽는 것은 CRAWL.view · CRAWL.st) ──
  let barK = '', wasFight = null;
  const ITEM = [['potion', '물약'], ['knockScroll', '열림'], ['torch', '횃불'], ['tools', '도구']];
  function bar() {
    const v = CRAWL.view(), st = CRAWL.st; if (!v || !st) return; let el = $('dv-bar');
    if (!el) { el = document.createElement('div'); el.id = 'dv-bar'; el.onpointerup = ev => ev.stopPropagation(); el.innerHTML = '<div class="dv-top"></div><div class="dv-ps"></div>'; $('stage').append(el);
      el.onclick = ev => { const b = ev.target.closest('button'); if (!b) return; const f = G.S.w.fantasy, sp = D.speeds(S);
        if (b.classList.contains('dv-spd')) { f.turnX = sp[(sp.indexOf(f.turnX || sp[0]) + 1) % sp.length]; S.spdX = f.turnX; put(S); barK = ''; } // 단계는 f.turnX로 (G.Turn.speed에는 PACE가 곱해져 있다)
        if (b.dataset.z) { setZk(zk * (b.dataset.z > 0 ? 1.2 : 1 / 1.2)); put(S); }
        if (b.classList.contains('dv-quit') && !run.over && !CRAWL.view()?.fighting) finish(CRAWL.st, 'quit'); // 귀환은 방 사이에서만 (전투 중에는 못 돌아간다 — 2026-11-27)
        if (b.classList.contains('dv-bagchip')) invWin('bag'); }; } // 돌아가기: 여기까지 번 금화 · 깬 층으로 끝낸다
    if (v.fighting !== wasFight) { wasFight = v.fighting; } // 전투가 끝나면 기본 배율로 (전투 중은 fitZoom)
    const earned = Math.max(0, st.gold - (st.gold0 ?? 0)), ps = v.party.map(p => ({ m: p.m, lv: p.m?.lv || 0, n: p.m?.name || '?', c: clsN(p.m?.cls), hp: Math.max(0, p.hp), max: p.max, xp: p.m ? Math.min(1, (p.m.xp || 0) / G.Guild.needOf(p.m)) : 0, dead: p.dead || p.hp <= 0 }));
    if (run.goldSeen == null) run.goldSeen = earned;
    const k = JSON.stringify([st.floor, !!v.fighting, v.sub, earned, st.items, (st.loot || []).length, G.Res.clock || 0, G.Turn.speed(G.S.w.fantasy), ps.map(p => [p.lv, p.n, p.hp, p.max, Math.round(p.xp * 50), p.dead])]); if (k === barK) return; barK = k;
    const its = ITEM.filter(([id]) => st.items[id] > 0).map(([id, n]) => `<span class="chip">${n} ${st.items[id]}</span>`).join('') + `<button class="chip dv-bagchip${D.bagFull(st) ? ' full' : ''}">짐 ${D.bagUsed(st)}/${st.bagCap || 0}</button>`; // 파티 짐 (누르면 목록)
    const goldUp = earned > run.goldSeen; run.goldSeen = earned;
    el.firstChild.innerHTML = `<div><b>${st.floor}층</b><small>${esc(RUN.zone(st.floor).n)} · ${esc(v.sub)}</small></div><div class="dv-r"><span class="chip c-gold${goldUp ? ' dv-flash' : ''}">${UI.px('coin')} ${earned}</span>${its}<button class="dv-spd"${D.speeds(S).length > 1 ? '' : ' disabled'}>×${(G.S.w.fantasy.turnX || D.speeds(D.fresh())[0]) / D.speeds(D.fresh())[0]}</button><button class="dv-zm" data-z="-1">−</button><button class="dv-zm" data-z="1">＋</button>${fsBtn()}<button class="dv-quit"${v.fighting ? ' disabled' : ''}>돌아가기</button></div>`;
    // 파티 카드 (시안 ①): 얼굴 · 레벨 · 이름 · 직업 · 체력 막대와 숫자 · 경험치 막대
    el.querySelector('.dv-ps').innerHTML = ps.map(p => `<div class="dv-p${p.dead ? ' dead' : ''}" data-u="${p.m?.uid ?? ''}">${p.dead ? UI.px('skull') : ''}<canvas width="26" height="30"></canvas><em>${p.lv}</em><b>${esc(p.n)}</b><small>${esc(p.c)}</small><i class="hp"><em style="width:${Math.round(100 * p.hp / Math.max(1, p.max))}%"></em></i><span>${p.hp}/${p.max}</span>${p.m ? `<i class="dv-cd">${G.Builds.slots(p.m).filter(Boolean).map(k => `<em data-cu="${p.m.uid}" data-ck="${k}" style="background-image:url(${SKUI.icon(k)})"></em>`).join('')}</i>` : ''}<i class="xp"><em style="width:${Math.round(100 * p.xp)}%"></em></i></div>`).join('');
    const pse = el.querySelector('.dv-ps'); pse.innerHTML += '<div class="dv-p empty"></div>'.repeat(Math.max(0, D.seats(S) - ps.length)); pse.style.gridTemplateColumns = `repeat(${Math.max(ps.length, D.seats(S))}, 1fr)`; // 자리 수만큼 칸 (빈 자리는 빈 칸)
    pse.querySelectorAll('canvas').forEach((cv, i) => { if (ps[i]?.m) UI.face(cv, ps[i].m); });
    { const [ct, cb] = cover(); if (typeof camCover !== 'undefined') camCover = Math.max(0, cb - ct); }
    document.body.dataset.diveFl = st.floor;
  }
  // 교착 풀기: 전투가 6라운드 넘게 아무도 다치지 않고 돌면(양쪽이 서로에게 닿지 못하는 자리 — 원인은 못 찾았다, 몇십 판에 한 번) 남은 적이 달아난 것으로 끝낸다
  let stale = null;
  function unstick() {
    const T = R.turn; if (!T) { stale = null; return; }
    const k = R.party.concat(R.mons).reduce((a, e) => a + Math.max(0, e.hp || 0), 0), now = performance.now(), sig = T.round + ':' + T.i;
    if (!stale || stale.k !== k) { stale = { k, round: T.round, sig, t: now, t1: now }; return; }
    if (stale.sig !== sig) { stale.sig = sig; stale.t1 = now; } // 차례가 넘어가는지 (한 차례에 멈춰 있는 것도 교착 — 2026-11-23 640×360에서 1라운드에 36초)
    const hung = now - stale.t1 > 12000;
    if (hung) document.body.dataset.hung = `${T.round}:${T.cur ? (T.cur.merc?.name || T.cur.n || T.cur.t || T.cur.kind) : '-'}:${T.ph}`;
    if (T.round - stale.round < 6 && !hung) return;
    { const ch = (x, y) => R.map?.c?.[Math.round(y) * R.map.w + Math.round(x)] ?? '?', E = e => [e.merc?.name || e.n || e.t, +e.x.toFixed(1), +e.y.toFixed(1), Math.round(e.hp), ch(e.x, e.y), e.aware || '', e.hidden ? 'H' : '', e.stop || 0, e.spotted ? 'S' : '', e.aggro ? 'A' : ''];
      const rec = { fl: CRAWL.st?.floor, room: CRAWL.st?.at, name: CRAWL.st?.map.nodes[CRAWL.st.at]?.name || CRAWL.st?.map.nodes[CRAWL.st.at]?.type, round: T.round, ph: T.ph, cur: T.cur ? E(T.cur) : null, party: R.party.filter(p => !p.dead).map(E), mons: R.mons.filter(m => m.hp > 0).map(E), hung: !!hung, seed: S.mapSeed };
      document.body.dataset.stuck = JSON.stringify(rec); try { const L = JSON.parse(localStorage.getItem('dv.stuck') || '[]'); L.push(rec); localStorage.setItem('dv.stuck', JSON.stringify(L.slice(-20))); } catch (er) { /* 기록 못 해도 */ } } // 교착 기록 (원인 조사용 — 무엇이 멈췄나)
    stale = null; R.mons = R.mons.filter(m => m.hp <= 0); G.Fantasy.refreshEnts(R);
    CRAWL.st.log.push({ t: '맞붙지 못한 채 시간이 흘렀다 — 적이 달아났다.' }); UI.say(CRAWL.st.log);
  }
  // 전투 카메라 (main.js가 부른다): 배율은 기본 그대로, 행동하는 사람(대상이 있으면 둘의 가운데)이 화면 가장자리 20% 밖으로 나갈 때만 그쪽으로 옮긴다 — 차례마다 휙휙 튀지 않게
  let camPt = null;
  // 전투 중인 작은 방이 화면에 다 들어오는 배율 (벽 높이만큼 위아래 여유) — 넘치지 않으면 null
  // 위 막대 · 아래 파티 칸이 가리는 높이 (CSS px): 방은 그 사이에 담고(roomFit) 카메라도 그 가운데를 본다 (camCover — render/bake.js camFor)
  const cover = () => { const el = $('dv-bar'); return el ? [el.firstChild.offsetHeight || 0, el.lastChild.offsetHeight || 0] : [0, 0]; };
  function roomFit() { const st = CRAWL.st; if (!D.TUNE.SMALL_ROOMS || !st || !PXS) return null; const n = st.map.nodes[st.at]; if (!n) return null; const b = st.map._lay.room[st.at], K = G.Floor.K;
    const ps = [[b.x * K - 0.5, b.y * K - 0.5], [(b.x + b.w) * K - 0.5, b.y * K - 0.5], [b.x * K - 0.5, (b.y + b.h) * K - 0.5], [(b.x + b.w) * K - 0.5, (b.y + b.h) * K - 0.5]].map(([x, y]) => project(wx(x), wy(y), 0)), xs = ps.map(p => p.sx), ys = ps.map(p => p.sy);
    const w = Math.max(...xs) - Math.min(...xs), hr = Math.max(...ys) - Math.min(...ys), h = hr + VH * 0.12; if (!(w > 0)) return null; const wide = VW > VH * 1.4, [ct, cb] = cover(), k = Math.min(VW * 0.96 * (D.TUNE.FIT_W || 1) / w, wide ? (VH - (ct + cb) * DPR / PXS) * (D.TUNE.FIT_H || 0.95) / Math.max(1, hr) : VH * 0.78 / h); /* 가로 화면: 방 바닥이 위 막대와 파티 칸 사이 높이의 FIT_H배에 들어오게 (2026-11-27 — 배치 구역이 파티 칸 밑에 깔리지 않게. 벽 윗부분은 위 막대 밑으로 들어가도 된다) */ /* FIT_W: 방 폭의 몇 배까지 화면에 담나 (1 = 전부 · 1.2 = 좌우 끝 20%는 잘려도) */ return PXS * k; } // 지금 배율 기준의 맞는 배율 (넘치지 않으면 지금보다 크다 — 부르는 쪽이 min)
  // 작은 방(TUNE.SMALL_ROOMS, 우두머리 방 빼고): 방 전체가 화면에 들어오니 싸우는 사람을 쫓지 않고 방 가운데에 선다
  const roomMid = () => { const st = CRAWL.st; if (!D.TUNE.SMALL_ROOMS || !st) return null; const n = st.map.nodes[st.at]; if (!n) return null; const b = st.map._lay.room[st.at], K = G.Floor.K; return [b.x * K + b.w * K / 2 - 0.5, b.y * K + b.h * K / 2 - 0.5]; };
  function camAt(r) {
    if (CRAWL.between) return null; // 방 사이를 걷는 동안은 파티를 따라간다 (main.js)
    { const m = roomMid(); if (m) return m; }
    const T = r.turn, cur = T?.cur;
    if (!camPt && T) { const all = r.party.filter(p => !p.dead).concat(r.mons.filter(m => m.hp > 0)); if (all.length) { camPt = [all.reduce((a, e) => a + e.x, 0) / all.length, all.reduce((a, e) => a + e.y, 0) / all.length]; return camPt; } } // 전투가 시작되면 아군 + 살아 있는 적의 가운데로
    if (!cur) return camPt;
    const tg = T.tg && (T.tg.hp > 0 || !T.tg.dead) ? T.tg : null, x = tg ? (cur.x + tg.x) / 2 : cur.x, y = tg ? (cur.y + tg.y) / 2 : cur.y;
    const p = project(wx(cur.x), wy(cur.y), 0), out = p.sx < VW * 0.2 || p.sx > VW * 0.8 || p.sy < VH * 0.2 || p.sy > VH * 0.8;
    if (!camPt || out) camPt = [x, y];
    return camPt;
  }
  // 배율은 늘 기본 (전투 중에도 물러나지 않는다)
  // 전투 때 조금 물러난다 (2026-11-23 사용자: 「전투시 약간 줌아웃」): 기본 배율 × FIGHT_K로 0.4초쯤에 걸쳐 부드럽게, 끝나면 돌아온다
  const FIGHT_K = 0.75; let zc = 0;
  function fitZoom(dt = 0) {
    if (typeof setZoom !== 'function' || (typeof TOP !== 'undefined' && TOP.on)) return; const base = HUD.zoom(false), fz = roomFit(); let want = R.turn && !D.TUNE.SMALL_ROOMS ? base * FIGHT_K : base * (D.TUNE.SMALL_ROOMS ? D.TUNE.VIEW_K || 1 : 1); if (fz && fz < want) want = fz; want = Math.max(0.5, want * zk); // zk: 플레이어가 정한 배율 · 작은 방이 화면보다 넓으면 그만큼만 물러난다 (방 전체가 들어오게) // 작은 방(TUNE.SMALL_ROOMS)이면 전투에도 줌아웃 없이 — 우두머리 방(21타일)만 예전처럼 물러난다
    if (!zc) zc = PXS || base; const d = want - zc; zc = Math.abs(d) < 0.02 ? want : zc + d * Math.min(1, dt * 8);
    if (Math.abs(zc - PXS) > 0.01) setZoom(zc, true); if (!R.turn) camPt = null;
  }
  // ── 확대 · 축소 (2026-11-26): 휠 · 두 손가락 · 단추. 크게 보면 카메라가 고른 영웅을 따라간다 ──
  const ZK = [0.5, 2.4]; let zk = 1;
  const setZk = v => { zk = Math.round(Math.max(ZK[0], Math.min(ZK[1], v)) * 100) / 100; S.zk = zk; barK = ''; };
  const pinch = new Map(); let pin0 = null;
  function zoomInit() { zk = S.zk || 1; if (zoomInit.done) return; zoomInit.done = true;
    const onStage = t => run && !run.over && (t.id === 'c' || (t.closest?.('#stage') && t.tagName === 'CANVAS'));
    document.addEventListener('wheel', ev => { if (!onStage(ev.target)) return; ev.preventDefault(); ev.stopPropagation(); setZk(zk * (ev.deltaY < 0 ? 1.12 : 1 / 1.12)); }, { capture: true, passive: false });
    const gap = () => { const [a, b] = [...pinch.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]); };
    document.addEventListener('pointerdown', ev => { if (ev.pointerType !== 'touch' || !onStage(ev.target)) return; pinch.set(ev.pointerId, [ev.clientX, ev.clientY]); if (pinch.size === 2) { pin0 = { d: Math.max(20, gap()), z: zk }; } }, true);
    document.addEventListener('pointermove', ev => { if (!pinch.has(ev.pointerId)) return; pinch.set(ev.pointerId, [ev.clientX, ev.clientY]); if (pin0 && pinch.size === 2) { setZk(pin0.z * gap() / pin0.d); ev.stopPropagation(); } }, true);
    for (const n of ['pointerup', 'pointercancel']) document.addEventListener(n, ev => { if (!pinch.delete(ev.pointerId)) return; if (pin0) { ev.stopPropagation(); if (!pinch.size) pin0 = null; put(S); } }, true); }
  // ── 스킬 보이기 (js/app/skill_ui.js): 쓴 순간 · 쿨타임 덮개 ──
  let rollSeen = null;
  function skillSee() {
    const by = m => R.party.find(p => p.merc && p.merc.uid === m.uid), show = (p, k) => { if (p && G.D.MSKILLS[k] && R.turn) SKUI.cast(p, k); }; // 머리 위에는 이름만 (2026-11-27 사용자 — 효과는 영웅 창에서 눌러 본다)
    for (const q of D.USED.splice(0)) show(by(q.m), q.k);
    SKUI.tick();
  }
  const cdL = (m, k) => (G.Res.cdLeftOf ? G.Res.cdLeftOf(m, k) : 0); // 남은 쿨타임 (라운드) — 스킬 종류와 상관없이 한 시계
  const cdFull = (m, k) => Math.max(1, G.Res.cdOf ? G.Res.cdOf(k) || 0 : 0);
  function cdTick() {
    const el = $('dv-bar'); if (!el) return;
    for (const b of el.querySelectorAll('[data-ck]')) { const p = R.party.find(q => q.merc?.uid === +b.dataset.cu); if (!p) continue; const k = b.dataset.ck, n = cdL(p.merc, k), f = n ? Math.max(0.02, Math.min(1, n / cdFull(p.merc, k))) : 0, pv = +(b._p || 0);
      if (Math.abs(f - pv) > 0.004 || (!f && pv)) { b.style.setProperty('--skp', f.toFixed(3)); if (pv && !f) { b.classList.remove('back'); void b.offsetWidth; b.classList.add('back'); } b._p = f; b.classList.toggle('cd', f > 0); }
      const u = b.querySelector('u'); if (u) { const t = n ? String(n) : ''; if (u.textContent !== t) u.textContent = t; } }
  }
  // ── 전투 시작 · 다음 무리 · 승리 띠 ──
  let wvKey = '', wvOn = false;
  function banner(t, sub, cls) { $('dv-band')?.remove(); const el = document.createElement('div'); el.id = 'dv-band'; el.className = cls || ''; el.innerHTML = `<b>${esc(t)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}`; $('stage').append(el); setTimeout(() => el.remove(), 1500 / Math.max(1, spd() / (D.speeds(D.fresh())[0] || 1))); }
  function waveSee() {
    const w = R.wave, on = !!R.turn;
    if (on && w) { const k = `${CRAWL.st.floor}:${w.node.id}:${w.i}`; if (k !== wvKey) { wvKey = k; const us = (w.all || [])[w.i - 1] || [], boss = w.node.type === 'boss' && w.i === w.n; banner(boss ? us[0]?.[0] || '우두머리' : w.i === 1 ? '전투' : `${w.i} / ${w.n}`, boss ? '' : us.map(([n, c]) => `${n} ${c}`).join(' · '), boss ? 'boss' : ''); } }
    if (wvOn && !on && !FIGHT.on) { SKUI.clear(); if (R.party.some(p => !p.dead)) banner('승리', '', 'win'); }
    if (on) wvOn = true; else if (!FIGHT.on) wvOn = false;
    document.body.classList.toggle('dv-fight', on); if (!$('dv-vig')) { const v = document.createElement('div'), c = $('stage').querySelector('canvas'); v.id = 'dv-vig'; if (c) c.after(v); } // 전투 중 가장자리 붉게 (인형 · 막대 아래)
  }
  // ── 다음 방 고르기 (2026-11-26 사용자: 「방클리어하면 지도 띄우고 갈수있는 방을 선택하는 ftl스타일」): 층 지도에 고를 수 있는 방 번호 · 목록에 방 종류 · 상태 · 넘는 사람(없으면 결과) · 야영(물자)
  //   플레이어가 고를 때까지 기다린다 (2026-11-27 사용자: 「자동선택은 일단 없애봐」). 자동 재출발 중 · ?fork=0이면 묻지 않는다 (G.Dive.POL.fork — 다쳤으면 먼저 야영)
  // 문 표지 (2026-11-27 사용자: 「얻을수있느것과 필요한것 두가지만」): 윗칸 = 얻는 것(상자 · 금화 · 왕관 …) · 아랫줄 = 필요한 것(해골 = 싸움의 세기 · 문의 장애물)
  //   장애물: 넘으면 초록 아이콘 + 넘는 영웅 얼굴 · 못 넘는 문(잠긴 문 · 봉인 · 무너진 길)은 회색이고 못 누른다 — 넘어 본 재주가 있으면 그 아이콘 (겪으면 기억) · 함정 · 어둠은 못 막으면 붉은 아이콘 + 결과
  const SKULLS = { fight: 1, elite: 2, boss: 3 }, chestImg = k => `<img src="assets/ll/chest_${k}.png" alt="">`;
  function doorSign(st, n, pi) {
    if (n.visited) return { cls: ' seen', html: `<div class="ds-get">${UI.px('down')}</div>` };
    const bonus = pi && D.STATE[pi.k].gate && pi.k !== 'rubble' && !n.hostile; // 잠긴 문 · 봉인 너머의 상자는 한 등급 위
    const get = n.type === 'boss' ? UI.px('crown') + chestImg('gold') : n.type === 'elite' ? chestImg('silver') : n.type === 'treasure' || n.chest ? chestImg(bonus ? 'silver' : 'wood') : n.type === 'fight' ? UI.px('coin') : n.type === 'shop' ? UI.px('coin') + UI.px('arrow') + UI.px('armor') : n.type === 'camp' ? UI.px('tent') : '?';
    const bag = D.dropsAt(S, st.floor, n.id).length ? `<i class="ds-bag">${UI.px('chest')}</i>` : ''; // 떨어진 장비 (전에 쓰러진 자리)
    const sk = SKULLS[n.type] ? `<span class="ds-sk">${UI.px('skull').repeat(SKULLS[n.type] + (n.tier === 'heavy' ? 1 : 0))}</span>` : '';
    const ob = !pi ? '' : pi.shut ? `<span class="ds-shut">${UI.px(pi.ic)}${D.known(S, pi.k).map(g => UI.px(D.KNACK[g].ic)).join('')}</span>`
      : pi.sk ? `<span class="ds-ok">${UI.px(pi.ic)}<canvas width="26" height="30"></canvas></span>`
        : pi.k === 'sleep' ? '<span class="ds-ok">선공</span>' : pi.ok ? `<span class="ds-ok">${UI.px(pi.ic)}</span>` : `<span class="ds-no">${UI.px(pi.ic)}${esc(pi.tag)}</span>`;
    return { cls: `${pi?.shut ? ' shut' : ''}${n.type === 'boss' ? ' boss' : ''}`, html: `<div class="ds-get">${get}${bag}</div>${sk || ob ? `<div class="ds-need">${sk}${ob}</div>` : ''}`, who: pi?.sk ? pi.who : null, shut: !!pi?.shut };
  }
  // 다음 방 고르기 (2026-11-26 — Dungeon of the Endless · 하데스처럼): 창을 띄우지 않고 이 방의 문 위에 그 너머 방 종류 · 상태 표지. 표지를 누르면 그 문으로.
  //   위 왼쪽 작은 줄: 물자 · 야영 · 층 지도. 지나온 방은 건너뛴다 (2026-11-27): 층 지도에서 가 본 방을 거쳐 닿는 방을 바로 고른다 (G.Dive.routes — 드는 물자가 방마다 보인다) · 새 방으로 가는 문이 없으면 지도부터 띄운다
  let doorEls = [];
  const doorsOff = () => { for (const d of doorEls) d.el.remove(); doorEls = []; $('dv-pick')?.remove(); $('dv-fork')?.remove(); };
  function routeWin(st, opts, go, rest) {
    if (run.over || S.autoOn || q.get('fork') === '0') return false; doorsOff();
    const N = st.map.nodes, fl = $('floats');
    const take = path => { const n = N[path[path.length - 1]]; if (!doorEls.length && !$('dv-pick')) return; st.log.push({ t: `다음 방 · ${n.name || RUN.TYPE[n.type] || '방'}`, k: 'fork' }); doorsOff(); if (run && !run.over) go(path); }; // path: 지나는 방 차례 (끝이 가려는 방)
    const stop = ev => ev.stopPropagation();
    opts.forEach(x => { const n = N[x.to], d = doorSign(st, n, n.visited ? null : D.passInfo(st, x.ed || x.e, n)), el = document.createElement('div');
      el.className = `dv-door${d.cls}`; el.innerHTML = `<div class="ds-card">${d.html}</div><i class="ds-tip"></i>`;
      el.onpointerdown = stop; el.onpointerup = stop; el.onclick = ev => { ev.stopPropagation(); if (!d.shut) take([x.to]); };
      fl.append(el); doorEls.push({ el, x: x.door[0], y: x.door[1] });
      const cv = el.querySelector('canvas'), draw = () => { if (el.isConnected && !UI.face(cv, d.who.hero)) setTimeout(draw, 400); }; if (cv && d.who?.hero) draw(); }); // 넘는 영웅의 얼굴 (인형 그림이 늦으면 다시)
    const bar = document.createElement('div'); bar.id = 'dv-pick'; bar.onpointerdown = stop; bar.onpointerup = stop;
    const restBtn = () => { const ok = D.canCamp(st) && !st.camped?.[`${st.floor}:${st.at}`] && st.party.some(m => !m.dead && m.hp < m.max); return `<button class="pk-rest" data-r="1"${ok ? '' : ' disabled'}>${UI.px('tent')} 야영 · ${D.restCost(st)}</button>`; };
    bar.innerHTML = `<span class="pk-sup">${UI.px('tent')} <em>${st.items.camp || 0}</em></span>${restBtn()}<button class="pk-map" data-m="1">${mi('map')}</button>`;
    bar.onclick = ev => { const b = ev.target.closest('button'); if (!b || b.disabled) return; ev.stopPropagation();
      if (b.dataset.r) { if (rest()) { bar.querySelector('.pk-sup em').textContent = st.items.camp || 0; b.outerHTML = restBtn(); } return; }
      if (b.dataset.m) mapWin(st, take); };
    $('stage').append(bar);
    if (!opts.some(x => !N[x.to].visited && !D.passInfo(st, x.ed || x.e, N[x.to])?.shut)) mapWin(st, take); // 새 방으로 가는 (넘을 수 있는) 문이 없다 (막다른 방 · 다 돈 방): 층 지도부터
    return true;
  }
  // ── 전투 전 배치 (2026-11-27): 진형대로 선 파티 앞에 적이 보이는 채 DEP.T초 — 영웅을 끌어 배치 구역 안의 칸으로 (마우스 · 터치 pointer). 남은 시간 막대 · 시작. 안 건드리면 그대로 시작
  //   옮긴 자리는 저장(S.form — G.Dive.depSave)에 남아 다음 전투의 기본 진형. 자동 재출발 중이면 묻지 않는다 (routeWin과 같게)
  function depWin(Z, slots, go) {
    if (run.over || S.autoOn || q.get('fork') === '0') return false;
    const sv = UI.svg('dvdepsvg', 3), bar = document.createElement('div'), stop = ev => ev.stopPropagation(); let t0 = performance.now(), moved = false, drag = null, tm = 0;
    bar.id = 'dv-dep'; bar.onpointerdown = stop; bar.onpointerup = stop; bar.innerHTML = `<span class="dp-n">${UI.px('sword')}<em></em></span><button class="dp-go">시작</button><i class="pk-bar"></i>`; $('stage').append(bar);
    const quad = ([x, y], cls) => { const P = [[x - 0.5, y - 0.5], [x + 0.5, y - 0.5], [x + 0.5, y + 0.5], [x - 0.5, y + 0.5]].map(([a, b]) => UI.toStage(a, b).map(v => v.toFixed(1)).join(',')); return `<path class="${cls}" d="M${P.join('L')}Z"/>`; };
    const draw = () => { sv.innerHTML = Z.tiles.map(t => quad(t, 'dp-z')).join('') + (drag?.to ? quad(drag.to, 'dp-to') : '') + [...slots].filter(([p]) => !p.dead).map(([p]) => `<path class="dp-p${drag?.p === p ? ' on' : ''}" d="${UI.ring(p._dx ?? p.x, p._dy ?? p.y, 0.45)}"/>`).join(''); };
    const heroAt = ev => { const sb = $('stage').getBoundingClientRect(), X = ev.clientX - sb.left, Y = ev.clientY - sb.top; let best = null, bd = 44; for (const [p] of slots) { if (p.dead) continue; for (const z of [0, 1]) { const [px, py] = UI.toStage(p._dx ?? p.x, p._dy ?? p.y, z), d = Math.hypot(px - X, py - Y); if (d < bd) { bd = d; best = p; } } } return best; };
    const target = ev => { const [tx, ty] = UI.tileAt(ev.clientX, ev.clientY); return Z.near(tx, ty); };
    const down = ev => { if (!ev.target.closest?.('#stage') || ev.target.tagName !== 'CANVAS') return; const p = heroAt(ev); if (!p) return; drag = { p, to: null }; ev.stopPropagation(); ev.preventDefault(); };
    const move = ev => { if (!drag) return; drag.to = target(ev); ev.stopPropagation(); };
    const up = ev => { if (!drag) return; const d = drag; drag = null; ev.stopPropagation(); const to = ev.type === 'pointercancel' ? d.to : target(ev); if (!to) return;
      const was = slots.get(d.p), o = [...slots].find(([q, t]) => q !== d.p && !q.dead && t[0] === to[0] && t[1] === to[1])?.[0]; if (o) slots.set(o, was); slots.set(d.p, to.slice()); moved = true; }; // 다른 영웅이 선 칸이면 자리를 바꾼다
    const ons = [['pointerdown', down], ['pointermove', move], ['pointerup', up], ['pointercancel', up]]; for (const [k, f] of ons) document.addEventListener(k, f, true);
    window.DEP_DRAW = draw;
    const end = () => { clearInterval(tm); window.DEP_DRAW = null; for (const [k, f] of ons) document.removeEventListener(k, f, true); bar.remove(); sv.innerHTML = ''; if (moved) { D.depSave(S, Z, slots); put(S); } go(); };
    bar.querySelector('.dp-go').onclick = ev => { ev.stopPropagation(); end(); };
    let last = performance.now();
    tm = setInterval(() => { if (!bar.isConnected) return clearInterval(tm); const now = performance.now(); if (drag) t0 += now - last; last = now; // 끄는 동안은 시간이 멈춘다 (칸 그리기는 main.js가 프레임마다)
      const left = D.DEP.T - (now - t0) / 1000; bar.querySelector('.pk-bar').style.width = `${Math.max(0, left / D.DEP.T * 100)}%`; bar.querySelector('.dp-n em').textContent = Math.max(0, Math.ceil(left)); if (left <= 0) end(); }, 50);
    draw(); document.body.dataset.dep = (+(document.body.dataset.dep || 0) + 1); return true;
  }
  // 문 표지 자리: 화면 밖이면 가장자리에 붙이고 화살표로 그쪽을 가리킨다 (방이 화면보다 클 때)
  function doorTick() { if (!doorEls.length) return; const sg = $('stage'), W = sg.clientWidth, H = sg.clientHeight, x0 = 46, x1 = W - 46, y0 = 120, y1 = H - 96;
    const P = doorEls.map(d => { const [X, Y] = UI.toStage(d.x, d.y, 1.1); return { d, X, Y, cx: Math.max(x0, Math.min(x1, X)), cy: Math.max(y0, Math.min(y1, Y)) }; });
    for (let k = 0; k < 4; k++) for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) { const a = P[i], b = P[j], dx = b.cx - a.cx, dy = b.cy - a.cy; if (Math.abs(dx) >= 78 || Math.abs(dy) >= 62) continue; // 겹치면 밀어낸다 (가장자리에 붙은 표지끼리)
      if (78 - Math.abs(dx) < 62 - Math.abs(dy)) { const m = (78 - Math.abs(dx)) / 2 * (dx >= 0 ? 1 : -1); a.cx -= m; b.cx += m; } else { const m = (62 - Math.abs(dy)) / 2 * (dy >= 0 ? 1 : -1); a.cy -= m; b.cy += m; } }
    for (const p of P) { const { d, X, Y, cx, cy } = p, far = Math.abs(cx - X) > 1 || Math.abs(cy - Y) > 1;
      d.el.style.transform = `translate(${Math.round(cx)}px,${Math.round(cy)}px) translate(-50%,-100%)`; d.el.classList.toggle('far', far);
      let a = d.el.querySelector('.dv-ar'); if (far && !a) { a = document.createElement('i'); a.className = 'dv-ar'; d.el.append(a); } if (a) { a.style.display = far ? '' : 'none'; a.style.transform = `rotate(${Math.atan2(Y - cy, X - cx)}rad)`; } } }
  // 층 지도: 갈 수 있는 방(가 본 방만 거쳐 닿는 방 — G.Dive.routes)은 금색 테두리 · 드는 물자. 누르면 사이의 가 본 방을 지나 그 방으로 (가 본 방을 누르면 거기서 멈춘다)
  function mapWin(st, take) {
    $('dv-fork')?.remove(); const el = document.createElement('div'); el.id = 'dv-fork'; el.onpointerup = ev => ev.stopPropagation(); el.onpointerdown = ev => ev.stopPropagation();
    el.innerHTML = '<div class="rt-map"></div><button class="rt-x">✕</button>'; $('stage').append(el);
    const V = D.drawState(S, st), wrap = el.querySelector('.rt-map'), rs = D.routes(st), m = DIVEMAP.mount(wrap, V, { trail: st.path, fail: [], camp: [], S, gateInfo: q0 => D.gateInfo(S, V, q0), here: st.at, pick: rs.map(r => [r.to, r.cost]), fit: [st.at, ...rs.map(r => r.to)], cell: 16 });
    wrap.onclick = ev => { if (m.dragged()) return; const id = m.cell(ev), r = rs.find(x => x.to === id); if (r) { el.remove(); take(r.path); } };
    el.querySelector('.rt-x').onclick = ev => { ev.stopPropagation(); el.remove(); };
  }
  // 열쇠를 쓴 순간: 그 영웅 머리 위에 열쇠 아이콘 · 이름
  function keySee() { for (const u of D.KEYUSE.splice(0)) { const p = R.party.find(q => q.merc && u.who.hero && q.merc.uid === u.who.hero.uid); if (p) SKUI.castRaw(p, UI.px(D.KNACK[u.k]?.ic || 'star'), u.t || D.KNACK[u.k]?.n || ''); } }
  // ── 관문 · 탐험 스킬 알림 판 (2026-11-24, 사용자: 「잠긴문 부수는거나 탐험 스킬 사용할때 그냥 로그만 찍히고 넘어가니까 뭘했는지 전혀 파악이 안돼」) ──
  //   탐사 규칙의 구조 있는 기록(.g — 관문 · 방법 · 수치 · 성공, .r — 판정)을 화면 가운데 판으로. 읽힐 만큼 탐사를 잠깐 멈춘다 (×1 0.9초, 배속만큼 줄되 0.35초 아래로는 안 내려감) — 판정 규칙은 그대로
  const R_GATE = { 자물쇠: ['잠긴 문', '따기'], '문 부수기': ['잠긴 문', '부수기'], '함정 해제': ['함정', '해제'], 정찰: ['정찰', '정찰'], 추적: ['흔적', '추적'] }; // 방마다 굴리는 조사(못 찾음)는 판을 띄우지 않는다 — 찾으면 그 기록(.g)으로
  let gateQ = [], gateCur = null;
  function gateSee(st, e) { if (!run || run.over) return; let g = e.g || null; if (!g && e.r && R_GATE[e.r.what]) { const [gate, how] = R_GATE[e.r.what]; g = { who: e.r.who, gate, how, val: `d20 ${e.r.tot} / ${e.r.dc}`, ok: e.r.ok }; } if (!g) return; if (e.r && !g.val) g.val = `d20 ${e.r.tot} / ${e.r.dc}`; gateQ.push({ ...g, who: g.who ? heroN(st, g.who) : '' }); }
  const gateBusy = () => !!gateCur || gateQ.length > 0;
  function gateTick() { const now = performance.now(); if (gateCur && now < gateCur.until) return; if (gateCur) { gateCur = null; $('dv-gate')?.remove(); } const g = gateQ.shift(); if (!g) return;
    gateCur = { ...g, until: now + Math.max(350, 900 / Math.max(1, spd() / (D.speeds(D.fresh())[0] || 1))) };
    let el = $('dv-gate'); if (!el) { el = document.createElement('div'); el.id = 'dv-gate'; $('stage')?.append(el); }
    const dmg = (g.dmg || []).filter(([, v]) => v > 0).map(([n, v]) => `<span>${esc(heroN(CRAWL.st, n))} <b>−${v}</b></span>`).join('');
    el.className = g.ok ? 'ok' : 'no'; el.innerHTML = `<i>${g.ok ? '✓' : '✕'}</i><div><b>${esc(g.gate)}</b> · ${esc(g.how)}${g.who ? `<small>${esc(g.who)}</small>` : ''}</div>${g.val ? `<em>${esc(g.val)}</em>` : ''}${dmg ? `<p>${dmg}</p>` : ''}`; }
  // 선공 한 줄: 차례 엔진이 정한 첫 라운드 선공(R.turn.first)과 그 까닭(R.dvWhy — crawl.js enterFight)으로 — 결과와 반대인 줄이 뜨지 않게. 선공이 정해지지 않은(선제권 굴림) 전투는 줄 없음
  function firstLine() { const T = R.turn; if (!T || T._dvF || !CRAWL.st) return; T._dvF = 1; const w = R.dvWhy; R.dvWhy = null;
    const t = D.firstLineOf(T.first, w);
    if (t) CRAWL.st.log.push({ t, k: 'dv' }); }
  function frame(dt) {
    if (!R) return;
    if (run && run.over) return; // 끝난 뒤에는 탐사를 멈춘다 (결과 창 아래)
    CRAWL.frame(dt); doorTick(); if (run) { cardTick(); if (CRAWL.st?.pend?.length && !CRAWL.view()?.fighting && !$('dv-inv') && !run.over) invWin('bag'); /* 짐이 넘쳤다: 무엇을 버릴지 */ if (R.turn && R.turn.round !== run.rd) { if (run.rd != null) G.Res.clock = (G.Res.clock || 0) + 1; run.rd = R.turn.round; } else if (!R.turn) run.rd = null; /* 전투 라운드마다 쿨타임 시계 +1 */ unstick(); firstLine(); gateTick(); D.statTick(CRAWL.st, R); bar(); cdTick(); skillSee(); keySee(); waveSee(); logPoll(); autoBack(); grow(dt); fitZoom(dt); if ((run.memT = (run.memT || 0) + dt) > 2 && CRAWL.st) { run.memT = 0; D.remember(S, CRAWL.st); } miniPlan(); }
  }
  return { world, attach, frame, zoom, camAt, chest: k => chestShow(k), get on() { return ON && on; }, get zk() { return zk; } };
})();
