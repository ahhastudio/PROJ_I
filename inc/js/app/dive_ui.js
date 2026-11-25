'use strict';
// 원정 모드 화면 (dive.html — 규칙은 js/game/dive.js): 길드(금화 · 명단 · 해금 트리 · 파티 · 출발 층) → 자동 탐사(js/app/crawl.js의 층을 정책이 대신 고르며 돈다, 전투는 전부 AI) → 길드(지난 판 결과 + 자동 재출발 카운트다운).
// - 원정 한 판 = 화면 한 번: 출발을 누르면 이 탭에 적어 두고(sessionStorage GO) 화면을 다시 연다 — boot.js가 DIVEUI.world()로 그 파티의 탐사 층을 세운다 (선술집과 같은 길).
// - 탐사가 묻는 곳은 CRAWL.policy(G.Dive.POL + 여기의 기다림 · 끝 · 계단)가 고른다. 플레이어가 누르는 것은 배속 · 「돌아가기」뿐.
// - 운명판 칸(side.js) · 위 바(hud.js) 대신 이 파일의 바 (층 · 구역 · 금화 · 물자 · 파티 체력).
// - 방치형으로 켜 두기 (2026-11-22): 「작은 창으로」(팝업) · 자리를 비운 동안의 정산(G.Dive.settle — 다시 열 때 · 창이 다시 보일 때) · 도감 · 자동 재출발 기본 켬.
// - 시험용 주소: ?save=max (트리를 다 연 저장 + 파티 넷 · ?lv=N 레벨, 기본 14) · ?save=new (새 저장) · ?go=1 (바로 출발) · ?floor=N (그 층에서 시작 — crawl.js)
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
    if (q.get('save') === 'max') { for (const t of D.TREE) S.up[t.id] = t.cost.length; S.party = ['dragoon', 'cleric', 'mage', 'paladin']; S.deep = 9; G.newState(); for (const c of S.party) S.roster[c] = { m: D.member(G.S.w.fantasy, c, +q.get('lv') || 14), tr: [] }; }
    if (q.get('save')) put(S);
    if (!G.S?.w) G.newState(); // 정산의 레벨업이 엔진 상태를 읽는다 (세계는 아래 D.world가 새로 세운다)
    away = D.settle(S, Date.now()); put(S); // 자리를 비운 동안의 정산 (1분 미만이면 0 — 원정마다 화면을 다시 여는 사이)
    if (!(flag() || q.get('go'))) return D.world(S, TestFloor.build('fight'));
    run = { t0: performance.now(), over: false, start: +q.get('floor') || D.startFloor(S), blk: {}, ex0: Object.fromEntries(Object.keys(S.maps).map(f => [f, D.explored(S, +f)[0]])) }; // blk: 층마다 경로가 잠긴 문에 막힌 수 · ex0: 출발 때 층마다 들어가 본 방 수
    return D.world(S, CRAWL.start(D.floorSeed(S, run.start), D.team(S), run.start)); // 층 지도는 (기준 씨앗, 층)으로 고정
  }
  function attach(r) {
    R = r; on = true; document.body.classList.add('dive'); if (typeof setZoom === 'function') setZoom(HUD.zoom(false), true); watch(); if (away?.gold) awayBox(away);
    if (!run) { FXUI.attach(R); PMAP.hide(); return guild(); }
    CRAWL.policy = { ...D.POL, chest: k => chestShow(k), tap: ev => handTap(ev), busy: () => !!$('dv-card') || !!$('dv-ev') || gateBusy(), event: (st, sc) => D.evDecide(S, st, sc), eventWin: (st, sc, pick) => evWin(st, sc, pick), wait: () => 1500 / spd(), end: finish, note, seed: fl => D.floorSeed(S, fl), leave: st => { D.remember(S, st); run.blk[st.floor] = (run.blk[st.floor] || 0) + D.planBlocked(st); }, descend: st => D.descend(st, S, G.Party.members(G.S.w.fantasy)) };
    PMAP.view = st => D.drawState(S, st); // 원정 중 지도 = 지도 기억 + 이번 판
    PMAP.render = (box, st, big) => { if (!box) return; box.querySelector('#pmap')?.style.setProperty('display', 'none'); let w = box.querySelector('.dvpmw'); if (!w) { w = document.createElement('div'); w.className = 'dvpmw'; box.append(w); const t = document.createElement('b'); t.className = 'dvpm-t'; box.append(t); }
      const V = D.drawState(S, st), ex = D.explored(S, st.floor); box.querySelector('.dvpm-t').textContent = `${RUN.zone(st.floor).n} · ${st.floor}층${ex ? ` · 탐사 ${ex[0]}/${ex[1]}` : ''}`; // 큰 지도 머리는 칸 밖(위)에 따로
      DIVEMAP.mount(w, V, { plan: st.plan, trail: st.path, fail: [], camp: S.campPlan[st.floor] || [], S, gateInfo: q0 => D.gateInfo(S, V, q0), here: st.at, mini: !big }); }; // 원정 중 지도: 작게 = 방 · 지금 위치 · 계획 점선 · 발자국 / 크게 = 길드 지도와 같은 그림
    PMAP.bigBox = (svg, st) => { // 크게 본 지도: 아는 곳 + 계획한 길에 맞춘 틀 (길드 지도와 같은 방식, 칸 비율에 맞춰 넓힌다)
      const V = D.drawState(S, st), L = st.map._lay, cs = [], add = id => { const r = L.room[id]; cs.push([r.x, r.y], [r.x + r.w, r.y + r.h]); };
      V.map.nodes.forEach(q => { if (q.visited || q.seenMap || q.info >= 2) add(q.id); }); (st.plan || []).forEach(add); add(st.at);
      const xs = cs.map(c => c[0]), ys = cs.map(c => c[1]); let x0 = M6 + (Math.min(...xs) - 2) * T13, y0 = M6 + (Math.min(...ys) - 4) * T13, w = (Math.max(...xs) - Math.min(...xs) + 4) * T13, h = (Math.max(...ys) - Math.min(...ys) + 6) * T13;
      const ar = (svg.clientWidth || 1) / (svg.clientHeight || 1); if (w / h < ar) { const nw = h * ar; x0 -= (nw - w) / 2; w = nw; } else { const nh = w / ar; y0 -= (nh - h) / 2; h = nh; }
      return `${x0.toFixed(1)} ${y0.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`; };
    CRAWL.attach(r); D.outfit(CRAWL.st, R, S); handInit(); dragInit(); run.lv0 = Object.fromEntries(Object.entries(S.roster).map(([c, h]) => [c, h.m.lv])); run.lootN = 0; run.skills = []; run.seen = snap();
    run.team = R.party.filter(p => p.merc).map(p => p.merc.cls); run.xp0 = Object.fromEntries(run.team.map(c => [c, D.totalXp(S.roster[c]?.m || {})])); run.sup0 = { torch: CRAWL.st.items.torch || 0, camp: CRAWL.st.items.camp || 0 }; // 결과 보고서의 기준
    document.body.dataset.dive = 'run'; put(S); // 명단에 새로 들인 영웅 · 도감의 빌드
  }
  // ── 원정 끝 (전멸 · 승리 · 돌아가기): 판에서 번 금화 + 깬 층 보너스 → 길드 ──
  function finish(st, why = '') {
    if (run.over) return; run.over = true; $('dv-ev')?.remove();
    const min = Math.round((performance.now() - run.t0) / 6000) / 10;
    D.remember(S, st); run.blk[st.floor] = (run.blk[st.floor] || 0) + D.planBlocked(st);
    const maps = []; for (let fl = run.start; fl <= st.floor; fl++) { const ex = D.explored(S, fl); if (ex) maps.push([fl, ex[0], ex[1], ex[0] - (run.ex0[fl] || 0), run.blk[fl] || 0]); } // 층별 탐사 (새로 밝힌 수 · 막힌 잠긴 문)
    logPoll(); S.lastLog = (run.log || []).slice(-200); // 지난 판 로그 (길드에서 지난 판 결과를 펼치면)
    // 사망: 엔진에서 죽은(dead) 영웅 · 전멸이면 전원. 살아 돌아오면 짐 속 전리품이 금화, 전멸하면 잃는다
    const lose = st.done === 'lose', deadC = lose ? D.team(S) : R.party.filter(p => p.merc && p.dead).map(p => p.merc.cls);
    for (const c of deadC) S.dead[c] = true;
    const loot = (st.loot || []).filter(e => !e.dropped), lootG = lose ? 0 : D.lootGold(st), gemN = loot.filter(e => e.gem).reduce((a, e) => a + (e.cnt || 1), 0);
    const f = G.S.w.fantasy, xp = D.bank(S, f), ups = Object.entries(S.roster).filter(([c, h]) => h.m.lv > (run.lv0[c] || 0)).map(([c, h]) => [h.m.name, run.lv0[c], h.m.lv]), won = st.done === 'win', cleared = won ? D.LAST : st.floor - 1, earned = st.gold - (st.gold0 ?? 0) + lootG, deep0 = S.deep, g = D.finish(S, cleared, earned, min, run.start, xp); S.seen = Date.now(); put(S);
    document.body.dataset.dive = won ? 'won' : 'result'; document.body.dataset.diveMin = min;
    const items = D.LOOT.filter(e => e.r >= 1).map(e => ({ ...e }));
    const res = { maps, items, skills: run.skills.slice(), won, how: won ? '붉은 성룡을 쓰러뜨렸다' : st.done === 'lose' ? '전멸' : '귀환', start: run.start, floor: st.floor, g, earned: Math.max(0, earned), bonus: D.bonusTo(cleared, run.start), min, ups, best: cleared > deep0, lootN: loot.filter(e => !e.gem).length, gemN, lootG, lost: lose && loot.length > 0,  deadN: deadC.length };
    // 결과 보고서 (2026-11-23): 끝난 이유 · 얻은 것 · 잃은 것 · 쓴 물자 · 영웅마다 레벨 · 경험치 · 피해 · 회복 · 처치 (집계는 D — st.stat)
    const stt = st.stat || { h: {}, fights: 0, foes: 0 }, fin = R.party.filter(p => p.merc), gemL = {};
    for (const e of loot.filter(e => e.gem)) { const q = gemL[e.n] = gemL[e.n] || [e.n, 0, e.gold, e.gem]; q[1] += e.cnt || 1; }
    const exN = D.explored(S, st.floor);
    res.rep = { why: D.endWhy(st, why), start: run.start, floor: st.floor, min, rooms: maps.reduce((a, q) => a + q[3], 0), ex: exN ? Math.round(100 * exN[0] / Math.max(1, exN[1])) : 0, g, earned: Math.max(0, st.gold - (st.gold0 ?? 0)), lootG, bonus: res.bonus,
      gems: Object.values(gemL), items, lost: lose ? loot.map(e => [e.n, e.gem ? e.cnt || 1 : 1, e.gem ? 0 : e.r || 0]) : [], sup: Object.fromEntries(['torch', 'camp'].map(k => [k, Math.max(0, (run.sup0?.[k] || 0) - (st.items[k] || 0))])),
      rev: deadC.map(c => [S.roster[c]?.m?.name || clsN(c), D.reviveCost(S, c)]), gold: S.gold, chest: run.chest || null, fights: stt.fights, foes: stt.foes,
      heroes: (run.team || []).map(c => { const m = S.roster[c]?.m || {}, q = stt.h[c] || {}, p = fin.find(x => x.merc.cls === c); return { c, n: m.name || clsN(c), lv0: run.lv0[c] || m.lv, lv1: m.lv, xp: Math.max(0, Math.round(D.totalXp(m) - (run.xp0?.[c] || 0))), dmg: Math.round(q.dmg || 0), took: Math.round(q.took || 0), heal: Math.round(q.heal || 0), kills: q.kills || 0, downs: q.downs || 0, tk: q.tk || null, dead: !!S.dead[c], down: !!p?.dead && !S.dead[c] }; }) };
    S.lastRep = res.rep; put(S);
    // 성룡을 잡아도 길드로 (자동 재출발은 계속)
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
    if (!r) return; const box = panel('dv-rep'), w = WHY[r.why] || WHY.back, hs = r.heroes || [], top = k => Math.max(1, ...hs.map(h => h[k]));
    const num = (h, k, lab) => `<span${k !== 'took' && h[k] && h[k] === top(k) && hs.length > 1 ? ' class="top"' : ''}>${h[k].toLocaleString()}<small>${lab}</small></span>`;
    const sup = Object.entries(r.sup || {}).filter(([, n]) => n > 0).map(([k, n]) => `<span class="chip">${ico({ sup: k }) || UI.px(SUP_N[k][1])} ${SUP_N[k][0]} −${n}</span>`).join('');
    const revT = (r.rev || []).reduce((a, q) => a + q[1], 0);
    box.innerHTML = `<header><h2 class="rp-why rp-${r.why}">${UI.px(w[0])} ${w[1]}${w[2] ? ` <small>${w[2]}</small>` : ''}</h2></header>`
      + `<div class="dv-res rp-head"><span class="chip">${r.start === r.floor ? `${r.floor}층` : `${r.start}→${r.floor}층`}</span><span class="chip">${r.min < 1 ? `${Math.round(r.min * 60)}초` : `${r.min}분`}</span><span class="chip">방 +${r.rooms}</span><span class="chip">탐사 ${r.ex}%</span><span class="chip">전투 ${r.fights}</span><span class="chip">처치 ${r.foes}</span></div>`
      + `<h4>${r.chest ? `<img class="rp-chest" src="assets/ll/chest_${r.chest}_open.png" alt="" onerror="this.remove()">` : ''}얻은 것</h4><div class="dv-res"><span class="chip c-gold">${UI.px('coin')} +${r.g}</span>${(r.gems || []).map(([n, c, g, id]) => `<span class="chip">${ico(id ? { gem: id } : null) || UI.px('gem')} ${esc(n)} ×${c} <small>${UI.px('coin')} ${g * c}</small></span>`).join('')}${sup}</div>`
      + ((r.items || []).length ? `<p class="dv-items">${r.items.map(e => `${ico(itemX(e))}<span class="r${e.r}">${D.RARITY[e.r]} · ${esc(e.n)}</span>${e.to ? ` → ${esc(e.to)}` : e.dropped ? ' · 두고 감' : ''}`).join('<br>')}</p>` : '')
      + ((r.lost || []).length ? `<h4 class="dv-bad">${UI.px('skull')} 잃은 것</h4><p class="rp-lost">${r.lost.map(([n, c, q]) => `<span class="r${q}">${esc(n)}${c > 1 ? ` ×${c}` : ''}</span>`).join(' · ')}</p>` : '')
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
  function depart() { put(S); flag(1); location.href = location.pathname; }
  // ── 길드 ──
  function panel(id) { let el = $(id); if (!el) { el = document.createElement('div'); el.id = id; el.className = 'dv-panel'; el.onpointerup = ev => ev.stopPropagation(); document.body.append(el); } return el; }
  // ── 길드 (지도가 첫 화면, 2026-11-23): 위 = 지난 판 한 줄 · 층 고르기(자동 · 가 본 층 탐사 수) / 가운데 = 그 층 지도와 경로 / 아래 = 경로 요약 · 파티 · 원정 출발 / 맨 아래 탭 = 명단 · 해금 · 도감
  //    가로로 낮은 창은 지도 왼쪽 · 나머지 오른쪽 기둥 (app.css)
  let mapFl = null; // 지금 보고 있는 층 (없으면 출발 층)
  const lastLine = () => { const r = cd?.res; return r ? `<div class="dv-last"><b>${esc(r.how)}</b> · ${r.start}→${r.floor}층 · ${UI.px('coin')} +${r.g} · ${r.min}분${r.best ? ' · 최고 층' : ''}${r.lootN || r.gemN ? (r.lost ? ` · <span class="dv-bad">${[r.lootN ? `전리품 ${r.lootN}` : '', r.gemN ? `보석 ${r.gemN}` : ''].filter(Boolean).join(' · ')} 잃음</span>` : ` · ${[r.lootN ? `전리품 ${r.lootN}` : '', r.gemN ? `보석 ${r.gemN}` : ''].filter(Boolean).join(' · ')} · ${UI.px('coin')} +${r.lootG}`) : ''}${r.deadN ? ` · <span class="dv-bad">${UI.px('skull')} 사망 ${r.deadN}</span>` : ''}${upsTxt(r.ups)}${gotTxt(r)}${(r.maps || []).length ? `<p class="dv-maps">${r.maps.map(([f, a, b, d, k]) => `${f}층 ${a}/${b}${d ? ` (+${d})` : ''}${k ? ` · 잠긴 문 ✕${k}` : ''}`).join(' · ')}</p>` : ''}<p class="dv-cnt">${cntTxt()}</p>${(S.lastLog || []).length ? `<ul class="dv-lastlog">${logRows(S.lastLog, 200)}</ul>` : ''}</div>` : ''; }; // 지난 판 한 줄 (누르면 펼친다 — 로그 포함)
  // 선술집: 장면 · 오른쪽 정보 · 아래 파티 줄 · 지도로
  function inn(box) {
    const team = D.team(S), open = D.classes(S), dc = D.dexCount(S), mini = window.name === MINI; if (!open.includes(inC)) inC = team[0] || open[0];
    box.innerHTML = `<header><h2>원정대 길드</h2><div class="dv-res"><span class="chip c-gold${S.gold < 0 ? ' neg' : ''}">${UI.px('coin')} ${S.gold}</span><span class="chip">최고 ${S.deep}층</span>${S.lastRep ? '<button class="chip dv-repb">보고서</button>' : ''}${fsBtn()}</div></header>` + lastLine()
      + `<div class="in-main"><div class="in-scene"><canvas></canvas><div class="in-who"></div></div><aside class="in-info">${DIVEINN.info(S, inC)}</aside></div>`
      + `<div class="in-bot">${DIVEINN.party(S, 'sel')}<nav class="dv-gtabs"><button data-tab="roster">${mi('mercenary')}명단</button><button data-tab="tree">${mi('skill')}${tabDot()}해금 <small>${D.TREE.reduce((a, t) => a + D.step(S, t.id), 0)}/${D.TREE.reduce((a, t) => a + t.cost.length, 0)}</small></button><button data-tab="dex">${mi('spell')}도감 <small>${dc.got}/${dc.all}</small></button>${mini ? '' : `<button data-tab="mini">${mi('map')}작은 창</button>`}</nav><button class="dv-go in-go"${team.length ? '' : ' disabled'}>${mi('map')}지도</button></div><p class="dv-dim dv-msg" hidden></p>`;
    DIVEINN.scene(box.querySelector('.in-scene'), S, inC); DIVEINN.faces(box, S); document.body.dataset.inn = open.length;
    box.onpointerdown = () => stopCd(box);
    box.onclick = ev => {
      const lr = ev.target.closest('.dv-last'); if (lr) { lr.classList.toggle('open'); return; }
      const b = ev.target.closest('button'); if (!b || b.disabled) return; const ds = b.dataset, full = D.team(S).length >= D.seats(S);
      if (ds.in) { inC = ds.in; if (S.roster[inC] && !S.dead[inC] && !D.team(S).includes(inC) && !full) D.toggle(S, inC); put(S); return guild(); } // 누르면 파티에 (자리가 차 있으면 정보만)
      if (ds.sel) { inC = ds.sel; return guild(); }
      if (ds.add || ds.out) { D.toggle(S, ds.add || ds.out); put(S); return guild(); }
      if (ds.hire) return buildPick(ds.hire);
      if (ds.rev) { D.raise(S, ds.rev); if (!S.party.includes(ds.rev) && !full) S.party.push(ds.rev); put(S); return guild(); } // 부활 (모자라면 빚)
      if (ds.hero) return hero(ds.hero);
      if (b.classList.contains('in-go')) return goStep('map');
      if (b.classList.contains('dv-repb')) return repWin(S.lastRep);
      if (ds.tab === 'roster' || ds.tab === 'tree') return sheet(ds.tab);
      if (ds.tab === 'dex') return dex('m');
      if (ds.tab === 'mini') { const w = window.open(location.pathname, MINI, POP), m = box.querySelector('.dv-msg'); if (w) { w.focus(); m.hidden = true; } else { m.hidden = false; m.textContent = '팝업 차단됨'; } }
    };
  }
  const stopCd = box => { if (cd && !cd.stop) { cd.stop = true; const el = box.querySelector('.dv-cnt'); if (el) el.textContent = cntTxt(); } }; // 길드를 누르면 자동 재출발이 멈춘다
  let step = 'inn', inC = null; // 길드의 두 단계: 'inn' = 선술집 장면(파티 구성) → 'map' = 지도(경로 · 짐 · 출발) · inC: 장면에서 보고 있는 영웅
  const goStep = s => { step = s; guild(); const box = $('dv-guild'); box.classList.remove('fade'); void box.offsetWidth; box.classList.add('fade'); };
  const tabDot = () => (D.cost(S, 'cls') != null && S.gold >= D.cost(S, 'cls') ? '<i class="dv-dot"></i>' : '');
  function guild() {
    document.body.dataset.dive = 'guild';
    const box = panel('dv-guild'); box.classList.toggle('inn', step === 'inn'); box.classList.toggle('mapv', step === 'map');
    if (step === 'inn') return inn(box);
    const team = D.team(S), sf = D.startFloor(S);
    const fl = mapFl || sf, fls = [...new Set(Object.keys(S.maps).map(Number).concat([sf]))].sort((a, b) => a - b);
    const last = lastLine();
    const tab = f => { const ex = D.explored(S, f), st = D.starts(S).includes(f); const eo = D.evOpen(S, f); return `<button data-fl="${f}" class="${f === fl ? 'on' : ''}${st ? ' st' : ''}">${f}층${ex ? ` <small>${ex[0]}/${ex[1]}</small>` : ''}${eo ? ` <small class="dv-bad">사건 ${eo}</small>` : ''}</button>`; };
    box.innerHTML = `<header><h2><button class="chip dv-back">‹ 길드</button> 지도</h2><div class="dv-res"><span class="chip c-gold${S.gold < 0 ? ' neg' : ''}">${UI.px('coin')} ${S.gold}</span><span class="chip">최고 ${S.deep}층</span>${fsBtn()}</div></header>`
      + last
      + `<div class="dv-gmain"><div class="dv-gmap"><div class="dv-fls"><button data-fl="0" class="dv-autof${S.start ? '' : ' on'}">자동 ${sf}층</button>${fls.map(tab).join('')}${S.plan[fl] ? '<button class="dv-clr">경로 ✕</button>' : ''}</div>`
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
      if (b.classList.contains('dv-clr')) { delete S.plan[fl]; mapOld[fl] = []; put(S); guild(); return; }
      if (b.classList.contains('dv-auto')) { S.autoOn = !S.autoOn; put(S); guild(); return; }
      if (b.classList.contains('dv-gch') && pixM && pixV) { const L = pixM.gates(); if (!L.length) return; const g = L[gchI++ % L.length]; pixM.show(g); return gatePop(pixV, g.q); } // 못 연 관문을 차례로
      if (b.classList.contains('dv-start')) depart();
    };
  }
  // ── 파티 짐 (2026-11-23): 길드의 「짐 5/9」 줄 → 짐 챙기기 창 (칸 줄 · 물자 −/+ · 값 · 남는 칸 · 경로 끝 · 가득 차면 복귀 · 사망 시 멈춤 · 계획 횃불) ──
  const SUP_N = { torch: ['횃불', 'spark'], camp: ['야영 물자', 'tent'] }; // 물자는 둘 (2026-11-23)
  const planTorch = () => { let n = 0; for (const f of Object.keys(S.plan).map(Number)) if (f >= D.startFloor(S)) n += D.torchUse(S, D.view(S, f), S.plan[f])[0]; return n; }; // 출발 층부터 계획이 있는 층들의 아는 어두운 길 수
  const bagUse = () => { const b = D.bagPlan(S); return D.SUP_KEYS.reduce((a, k) => a + b[k], 0); };
  const planCamp = () => { let n = 0; for (const f of Object.keys(S.campPlan || {}).map(Number)) if (f >= D.startFloor(S)) n += (S.campPlan[f] || []).filter(id => (S.plan[f] || []).includes(id)).length; return n; };
  const backSum = () => [S.endMode === 'back' && '경로 완주', S.fullBack && '짐 가득', S.risk !== false && '파티 위험'].filter(Boolean).join(' · ') || '직접';
  // 메뉴 아이콘 (흰 실루엣): CSS mask로 버튼 글자색을 입힌다
  const mi = n => `<span class="dv-mi" style="--mi:url(assets/ll/icon_${n}.png)"></span>`;
  const bagLine = t => `<button class="dv-bagb">${mi('inventory')} 짐 ${bagUse()}/${D.bagCap(S, t)} <small>${UI.px('coin')} ${D.supCost(D.bagPlan(S))} · 귀환 ${backSum()}</small></button>`;
  function bagPanel() {
    const box = panel('dv-bag'), t = D.team(S), cap = D.bagCap(S, t), mx = D.supMax(S), b = D.bagPlan(S), used = bagUse(), cost = D.supCost(b), pt = planTorch();
    const cells = Array.from({ length: cap }, (_, i) => { let k = 0, acc = 0; for (const q of D.SUP_KEYS) { const n = b[q]; if (i < acc + n) { k = q; break; } acc += n; } return `<i class="${k ? `on k-${k}` : ''}">${k ? UI.px(SUP_N[k][1]) : ''}</i>`; }).join('');
    const row = k => { const n = b[k], m = mx[k]; return `<div class="dv-supr"><b>${ico({ sup: k }) || UI.px(SUP_N[k][1])} ${SUP_N[k][0]}</b><button data-sup="${k}" data-d="-1"${n <= 0 ? ' disabled' : ''}>−</button><span>${n}/${m}</span><button data-sup="${k}" data-d="1"${n >= m || used >= cap ? ' disabled' : ''}>+</button><small>${TUNE_SUP(k)}</small></div>`; };
    box.innerHTML = `<header><h2>짐 ${used}/${cap}</h2><div class="dv-res"><span class="chip c-gold${S.gold < 0 ? ' neg' : ''}">${UI.px('coin')} ${S.gold}</span><button class="chip dv-x">닫기</button></div></header>`
      + `<div class="dv-cells">${cells}</div>`
      + D.SUP_KEYS.map(row).join('')
      + `<p class="dv-bagsum">${UI.px('coin')} ${cost}${S.gold < 0 ? ' · <span class="dv-bad">빚</span>' : S.gold < cost ? ` · <span class="dv-bad">${UI.px('coin')} ${S.gold}</span>` : ''} · 남는 칸 ${cap - used} · 계획 야영 ${planCamp()}${planCamp() > b.camp ? ' <span class="dv-bad">!</span>' : ''} · 계획 횃불 ${pt}${pt > b.torch ? ' <span class="dv-bad">!</span>' : ''}</p>`
      + `<h3 class="dv-togh">자동 귀환</h3><div class="dv-tog"><span>경로 완주</span><button data-end="back" class="${S.endMode === 'back' ? 'on' : ''}">켬</button><button data-end="go" class="${S.endMode !== 'back' ? 'on' : ''}">끔</button></div>`
      + `<div class="dv-tog"><span>짐 가득</span><button data-full="1" class="${S.fullBack ? 'on' : ''}">켬</button><button data-full="0" class="${S.fullBack ? '' : 'on'}">끔</button></div>`
      + `<div class="dv-tog"><span>파티 위험</span><button data-risk="1" class="${S.risk !== false ? 'on' : ''}">켬</button><button data-risk="0" class="${S.risk !== false ? '' : 'on'}">끔</button></div>`
      + `<h3 class="dv-togh">기타</h3><div class="dv-tog"><span>레벨업 카드</span><button data-card="1" class="${S.cardOn !== false ? 'on' : ''}">켬</button><button data-card="0" class="${S.cardOn !== false ? '' : 'on'}">끔</button></div>`
      + `<div class="dv-tog"><span>실시간 전투</span><button data-rt="1" class="${S.rt ? 'on' : ''}">켬</button><button data-rt="0" class="${S.rt ? '' : 'on'}">끔</button></div>`
      + `<div class="dv-tog"><span>선택 영웅 스킬 자동</span><button data-rta="1" class="${S.rtAuto !== false ? 'on' : ''}">켬</button><button data-rta="0" class="${S.rtAuto !== false ? '' : 'on'}">끔</button></div>`
      + `<div class="dv-tog"><span>직접 조종</span><button data-hand="1" class="${S.hand ? 'on' : ''}">켬</button><button data-hand="0" class="${S.hand ? '' : 'on'}">끔</button></div>`
      + `<div class="dv-tog"><span>${UI.px('skull')} 사망 후 재출발</span><button data-ds="0" class="${S.deadStop ? '' : 'on'}">켬</button><button data-ds="1" class="${S.deadStop ? 'on' : ''}">끔</button></div>`;
    box.onclick = ev => { const x = ev.target.closest('button'); if (!x || x.disabled) return;
      if (x.classList.contains('dv-x')) { box.remove(); guild(); return; }
      if (x.dataset.sup) { const nb = { ...D.bagPlan(S) }; nb[x.dataset.sup] = Math.max(0, nb[x.dataset.sup] + +x.dataset.d); S.bag = nb; }
      if (x.dataset.end) S.endMode = x.dataset.end; if (x.dataset.full) S.fullBack = x.dataset.full === '1'; if (x.dataset.ds) S.deadStop = x.dataset.ds === '1'; if (x.dataset.risk) S.risk = x.dataset.risk === '1'; if (x.dataset.card) S.cardOn = x.dataset.card === '1'; if (x.dataset.hand) S.hand = x.dataset.hand === '1'; if (x.dataset.rt) S.rt = x.dataset.rt === '1'; if (x.dataset.rta) S.rtAuto = x.dataset.rta === '1';
      put(S); bagPanel(); };
  }
  const TUNE_SUP = k => (D.TUNE.SUP[k] ? `${UI.px('coin')} ${D.TUNE.SUP[k]}` : '—');
  // 명단 · 해금 탭 (아래에서 올라오는 창)
  function sheet(kind) {
    const box = panel('dv-sheet'), team = D.team(S), open = D.classes(S);
    const row = t => { const st = D.step(S, t.id), c = D.cost(S, t.id), max = c == null;
      return `<button class="dv-up${max ? ' max' : S.gold >= c ? ' can' : ''}" data-up="${t.id}"${max || S.gold < c ? ' disabled' : ''}><b>${esc(t.n)}</b><small>${esc(t.val(st))}${max ? '' : ` → ${esc(t.val(st + 1))}`}</small><span>${max ? '다 열었다' : `${UI.px('coin')} ${c}`}</span><i class="dv-pips">${t.cost.map((_, i) => `<em class="${i < st ? 'on' : ''}"></em>`).join('')}</i></button>`; };
    box.innerHTML = `<header><h2>${kind === 'tree' ? '해금' : '명단'}</h2><div class="dv-res"><span class="chip c-gold">${UI.px('coin')} ${S.gold}</span><button class="chip dv-x">닫기</button></div></header>`
      + (kind === 'tree' ? D.BRANCH.map(b => `<h4>${b.n}</h4><div class="dv-tree">${D.TREE.filter(t => t.br === b.id).map(row).join('')}</div>`).join('') : roster(team, open) || '<p class="dv-dim">—</p>');
    box.onclick = ev => { const li = ev.target.closest('[data-hero]'); if (li) return hero(li.dataset.hero); const b = ev.target.closest('button'); if (!b || b.disabled) return;
      if (b.classList.contains('dv-x')) { box.remove(); guild(); return; } if (b.dataset.up) { if (D.buy(S, b.dataset.up)) { put(S); sheet(kind); } } };
  }
  // 영입: 그 직업의 단일 직업 빌드마다 후보 한 사람을 만들어 보이고(이름 · 시작 장비 · 기본 공격 주사위 · 방어 · 체력 · 첫 스킬), 고르면 그 사람이 명단에 — 빌드는 그 뒤로 고정
  function buildPick(c) {
    const f = G.S.w.fantasy, lv = D.newLv(S), cands = D.soloBuilds(c).map(b => ({ b, m: D.member(f, c, lv, Math.random, b.id) })), box = panel('dv-pick');
    const row = ({ b, m }, i) => { const N = G.Dnd, e = { merc: m }, w = N.weapon(e), eq = G.SRD.eq(m), k0 = (m.picks || G.Builds.slots(m).filter(Boolean))[0];
      return `<button data-i="${i}"><canvas width="26" height="30"></canvas><b>${esc(b.n)}</b><small>${esc([G.SRD.weaponOf(m).n, eq.a && eq.a !== 'none' ? G.SRD.armorOf(m).n : '', eq.shield ? '방패' : ''].filter(Boolean).join(' · '))}</small><span>${w.n}d${w.d}<small>기본 공격</small></span><span>${N.acBase(e)}<small>방어</small></span><span>${N.srdHP(m)}<small>체력</small></span><em>${esc(G.D.MSKILLS[k0]?.n || '')}</em></button>`; };
    box.innerHTML = `<header><h2>${esc(clsN(c))} <small>Lv ${lv}</small></h2><div class="dv-res"><button class="chip dv-x">닫기</button></div></header><div class="dv-picks">${cands.map(row).join('')}</div>`;
    box.querySelectorAll('.dv-picks canvas').forEach((cv, i) => { const draw = () => { if (box.isConnected && !UI.face(cv, cands[i].m)) setTimeout(draw, 400); }; draw(); }); // 후보마다 인형 얼굴 (빌드마다 모습이 다르다 — minidoll)
    box.onclick = ev => { const x = ev.target.closest('button'); if (!x) return; if (x.classList.contains('dv-x')) { box.remove(); return; }
      const q = cands[+x.dataset.i]; if (!q) return; S.roster[c] = { m: JSON.parse(JSON.stringify(q.m)), tr: [] }; if (!D.team(S).includes(c) && D.team(S).length < D.seats(S)) D.toggle(S, c); inC = c; put(S); box.remove(); guild(); };
  }
  // 명단: 지금 파티 먼저, 그다음 길드에 남은 영웅 — 이름 · 직업 · 빌드 · 레벨 · 경험치 · 장비
  function roster(team, open) {
    const cs = team.concat(open.filter(c => S.roster[c] && !team.includes(c))).filter(c => S.roster[c]);
    if (!cs.length) return '';
    const li = c => { const h = S.roster[c], m = h.m, need = G.Guild.needOf(m), sh = G.Tavern.sheet(m), mg = (h.tr || []).map(t => `<span class="r${D.rOf({ kind: 'magic', t })}">${esc(G.Gear.nameOf(t))}</span>`);
      return `<li class="${team.includes(c) ? 'on' : ''}" data-hero="${c}"><b>${esc(m.name)}</b><small>${esc(clsN(c))} · ${esc(G.Builds.byId(m.build)?.n || '')}</small><span class="dv-lv">Lv ${m.lv}</span>`
        + `<i class="dv-xp"><em style="width:${m.lv >= D.LV_MAX ? 100 : Math.round(100 * Math.min(1, (m.xp || 0) / need))}%"></em></i><small class="dv-gear">${esc(sh.weapon.n)} · ${esc(sh.armor)}${mg.length ? ` · ${mg.join(' · ')}` : ''}</small></li>`; };
    return `<h4>명단 <small>${cs.length}명</small></h4><ul class="dv-roster">${cs.map(li).join('')}</ul>`;
  }
  // ── 상태창 (길드에서 영웅을 누르면, 시안 ③ 구성): 가운데 얼굴 · 양옆 장비 칸(기본 장비 · 마법 물건 셋) · 수치 줄(체력 · 명중 · 피해 · 방어) · 물건 효과 · 스킬 6칸(안 열린 칸은 Lv N — 기본 공격은 칸 밖, 수치 줄에) · 빌드 바꾸기 (값 없이 — 레벨 · 경험치 · 장비는 그대로). 설명 문장 없이 수치만 ──
  function hero(c) {
    const h = S.roster[c]; if (!h) return; const m = D.cardInit(h.m), sh = G.Tavern.sheet(m), v = G.Builds.view(m), need = G.Guild.needOf(m), alt = G.Builds.LIST.filter(b => b.cls === c && !b.mc);
    const Q = D.sheetOf(h), sg = n => (n >= 0 ? '+' : '') + n, dmg = `${Q.dmg.n}d${Q.dmg.d}${Q.dmg.b ? sg(Q.dmg.b) : ''}`, eq = G.SRD.eq(m); // 수치는 낀 마법 물건까지 (원정 전투와 같은 값)
    const mg = Q.items, inS = s0 => mg.find(x => x.slot === s0); // 마법 물건은 제 칸에: 무기 · 방어구 · 방패 · 장신구
    const slot = (lab, n, r = 0, x = null) => { const im = n ? ico(x, 'hs-ico') : ''; return `<i class="hs-slot${n ? '' : ' empty'}"><b class="r${r}${im ? ' im' : ''}">${im || (n ? esc(n.slice(0, 1)) : '+')}</b><small>${lab}</small></i>`; }; // 그림이 있으면 그림 (없으면 첫 글자)
    const mx = q => (q ? { kind: 'magic', t: q.t } : null);
    const base = [slot('무기', inS('w')?.n || sh.weapon.n, inS('w')?.r || 0, mx(inS('w')) || { kind: 'base', e: { slot: 'w', k: eq.w } }), slot('방어구', inS('a')?.n || (eq.a && eq.a !== 'none' ? sh.armor : ''), inS('a')?.r || 0, mx(inS('a')) || { kind: 'base', e: { slot: 'a', k: eq.a } }), slot('방패', inS('s')?.n || (eq.shield ? '방패' : ''), inS('s')?.r || 0, mx(inS('s')) || { kind: 'base', e: { slot: 's', k: 'shield' } })];
    const tk = mg.filter(x => x.slot === 't'), right = [0, 1, 2].map(i => slot('물건', tk[i]?.n || '', tk[i]?.r || 0, mx(tk[i])));
    const cell = c0 => { if (!c0.s && G.Builds.CARD?.on) return '<li class="hs-lock"><b>+</b><small></small></li>'; /* 카드 모드: 빈 칸 (다음 카드로 찬다) */ if (!c0.s) { const wl = c0.will; return `<li class="hs-lock"><b>${wl ? esc(wl.n) : '?'}</b><small>Lv ${wl?.lv || c0.open}</small></li>`; }
      const num = G.SkillNum_at?.(c0.s.k, m.cls, m.lv), cdn = G.Res.cdOf ? (G.Res.cdOf(c0.s.k) || G.Skill.SK[c0.s.k]?.cd || 0) : /쿨 (\d+)/.exec(c0.s.tag || '')?.[1]; // 원정: 쿨타임 하나 (횟수 · 주문 칸 표시 없음)
      return `<li><b>${esc(c0.s.n)}</b><small>${[skTag(m, c0.s.k) || num?.d, !G.Res.cdOf && c0.s.left != null && c0.s.left < 20 ? `${c0.s.left}회` : '', cdn ? `쿨 ${cdn}` : ''].filter(Boolean).join(' · ')}</small></li>`; };
    const box = panel('dv-hero');
    box.innerHTML = `<header><h2>${esc(m.name)} <small>${esc(sh.cls)} · Lv ${m.lv}</small></h2><div class="dv-res"><button class="chip dv-x">닫기</button></div></header>`
      + `<div class="hs-doll"><div class="hs-col">${base.join('')}</div><div class="hs-mid"><canvas width="32" height="40"></canvas><i class="dv-xp"><em style="width:${m.lv >= D.LV_MAX ? 100 : Math.round(100 * Math.min(1, (m.xp || 0) / need))}%"></em></i><small>${m.lv >= D.LV_MAX ? 'MAX' : `${Math.round(m.xp || 0).toLocaleString()} / ${need.toLocaleString()}`}</small></div><div class="hs-col">${right.join('')}</div></div>`
      + `<div class="dv-stat"><span>${Q.hp}<small>체력</small></span><span>${sg(Q.hit)}<small>명중</small></span><span class="hs-atk">${dmg}<small>기본 공격</small></span><span>${Q.ac}<small>방어</small></span></div>`
      + (mg.length ? `<ul class="hs-items">${mg.map(x => `<li><b class="r${x.r}">${esc(x.n)}</b><small class="r${x.r}">${D.RARITY[x.r]}</small><span>${esc(G.Trinket.tags?.(x.t)?.join(' · ') || '')}</span></li>`).join('')}</ul>` : '')
      + `<h4>스킬${(m.cardq || []).length ? ` <button class="chip dv-pickb">${UI.px('star')} 고를 것 ${m.cardq.length}</button>` : ''}</h4><ul class="hs-sk">${v.slots.map(cell).join('')}</ul>`
      + (v.race ? `<h4>종족 <small>${esc(v.sp || '')}</small></h4><ul class="hs-sk"><li><b>${esc(v.race.n)}</b><small>${v.race.left != null ? `${v.race.left}회` : ''}</small></li></ul>` : '')
      + (sh.traits.length ? `<h4>패시브</h4><p class="dv-dim">${sh.traits.map(t => esc(t.n)).join(' · ')}</p>` : '')
      + `<h4>빌드</h4><p class="dv-dim">${esc(G.Builds.byId(m.build)?.n || '')}</p>`; // 빌드는 영입할 때 고르고 고정 (바꾸는 버튼 없음)
    const cv = box.querySelector('.hs-mid canvas'), draw = () => { if (box.isConnected && !UI.face(cv, m)) setTimeout(draw, 400); }; draw();
    box.onclick = ev => { const b = ev.target.closest('button'); if (!b) return; if (b.classList.contains('dv-x')) { box.remove(); return; }
      if (b.classList.contains('dv-pickb')) return cardWin(m, () => { put(S); hero(c); }, false); // 길드에서 고를 것
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
  function summary(V, plan) {
    if (!plan || plan.length < 2) return `<b>경로</b> <span>자동</span>`;
    const L = D.planLines(S, V, plan); // 방 차례대로 한 줄씩 (예상 · 관문) + 합계
    // 경로의 안 끝난 사건: 계획에서 고를 선택지 (지금 파티의 값 · 직업 전용은 그 직업)
    return `<ul class="dv-plines">${L.map(o => `<li class="pl-${o.k}${o.short ? ' short' : ''}${o.ev ? ' ev' : ''}${o.no ? ' no' : ''}"${o.ev != null ? ` data-evr="${o.ev}"` : ''}>${o.no ? '<b class="dv-bad">✕</b> ' : ''}${esc(o.t)}</li>`).join('')}</ul>`; // ✕: 지금 파티로 못 여는 관문 // 사건 방 줄을 누르면 선택지 판
  }
  // 픽셀 지도 (시안 v1, 2026-11-23 — ?pix=1일 때만): DIVEMAP(js/app/dive_map.js)이 캔버스에 그린다. 누르기 · 경로 · 지우기는 SVG 지도와 같은 규칙
  // 픽셀 지도가 기본 (2026-11-23 — ?svg=1이면 예전 SVG 손그림 지도): DIVEMAP(js/app/dive_map.js)이 캔버스에 그린다. 누르기 · 경로 · 지우기 · 야영 지점 · 사건 판은 같은 규칙
  const PIX = q.get('svg') !== '1';
  let pixM = null;
  let pixV = null, gchI = 0;
  function pixMap(box, fl, erase = null) {
    const V = D.view(S, fl), plan = S.plan[fl] || null, wrap = box.querySelector('.dv-mapw'), keep = pixM && wrap.querySelector('canvas.dvpix') && wrap.dataset.fl === String(fl) ? pixM.scroll() : null;
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
    const sum = box.querySelector('.dv-sum'); if (sum) sum.innerHTML = summary(V, plan);
    edges(box, V, plan);
    wrap.onclick = ev => { ev.stopPropagation(); if (pixM.dragged() || pixM.busy() || pixM.skipped()) return; const g = pixM.gate(ev); if (g) return gatePop(V, g); const id = pixM.cell(ev), before = (S.plan[fl] || []).slice();
      if (id == null) { if (!before.length) return; const pairs = []; for (let k = 0; k + 1 < before.length; k++) pairs.push([before[k], before[k + 1]]); delete S.plan[fl]; put(S); mapOld[fl] = []; box.querySelector('.dv-clr')?.remove(); return pixMap(box, fl, pairs); } // 빈 곳: 경로를 지운다
      if (before.includes(id) && id !== before[0]) { const n = V.map.nodes[id]; if (n.type === 'event' && n.ev && D.evOf(S, fl, id)?.st !== 'done') return evPop(V, n, fl); D.toggleCamp(S, fl, id); put(S); return pixMap(box, fl); } // 경로 위의 방: 사건 방이면 선택지 판, 아니면 야영 지점 켬 · 끔
      if (!D.planTo(S, V, id)) return pixM.nope(id);
      put(S); const after = S.plan[fl] || []; if (after.length && !box.querySelector('.dv-clr')) box.querySelector('.dv-fls')?.insertAdjacentHTML('beforeend', '<button class="dv-clr">경로 ✕</button>');
      pixMap(box, fl); };
    document.body.dataset.mapfl = fl;
  }
  // 파티 칸: 그 경로의 아는 적에게 주 피해 유형이 통하나 (▲ 취약을 찌름 · ▼ 저항 · 면역에 막힘)
  function edges(box, V, plan) { const fz = D.planFoes(V, plan || []); box.querySelectorAll('.dv-gparty [data-cls]').forEach(b => { const h = S.roster[b.dataset.cls]?.m, eg = h && S.roster[b.dataset.cls] ? D.edgeOf(S, h, fz) : ''; b.querySelector('i.af-v, i.af-r')?.remove(); if (eg) b.insertAdjacentHTML('afterbegin', `<i class="af-${eg === '▲' ? 'v' : 'r'}">${eg}</i>`); }); }
  // 작은 판 (지도 위): 관문 자세히 · 사건 선택지 · 야영 지점
  function pop(html, onclick) { $('dv-pop')?.remove(); const el = document.createElement('div'); el.id = 'dv-pop'; el.onpointerup = ev => ev.stopPropagation(); el.innerHTML = html + '<button class="dv-popx">닫기</button>'; el.onclick = ev => { const b = ev.target.closest('button'); if (!b) return; if (b.classList.contains('dv-popx')) return el.remove(); onclick && onclick(b, el); }; document.body.append(el); return el; }
  // 관문 자세히: 방법마다 그 방법을 가진 직업 — 지금 파티에 있으면 밝게(on) · 명단에만 있으면 보통 · 없으면 어둡게(off). 지금 파티의 값이 있으면 그 값
  const whoSt = w => { const nm = w.replace(/ \d+$/, ''), c = D.CLS.find(c0 => clsN(c0) === nm); if (!c) return ''; return D.team(S).includes(c) ? 'on' : S.roster[c] ? '' : 'off'; };
  const gatePop = (V, q) => pop(`<h4>${esc(D.gateTxt(S, V, q).split(' · ')[0])}</h4>${D.gateInfo(S, V, q).map(x => `<p class="gp-row"><b>${esc(x.k)}</b> ${x.val ? `<em>${esc(x.val)}</em>` : ''}${x.who.map(w => `<span class="gp-who ${w === '누구나' ? 'on' : whoSt(w)}">${esc(w)}</span>`).join('')}</p>`).join('')}`);
  function evPop(V, n, fl) {
    const sc = RUN.eventScene({ ...V, rng: () => 0.5, gold: 999, flags: {}, here: {}, log: [] }, n, n.ev), want = S.evPlan?.[fl]?.[n.id];
    pop(`<h4>${esc(n.name || '사건')}</h4>${sc.filter(c => !c.lock && !D.evPass(n.ev, c.n)).map(c => { const o = D.evOut(n.ev, c.n); return `<button data-evn="${esc(c.n)}" class="${want === c.n ? 'on' : ''}"${c.off && c.off() ? ' disabled' : ''}><b>${esc(c.n.replace(/^\[([^\]]*)\] /, '$1 · '))}</b><small>${[c.p != null && c.p < 1 ? `${Math.round(c.p * 100)}%` : '', o.ok.join(' · '), o.no.length ? `실패 ${o.no.join(' · ')}` : ''].filter(Boolean).join(' · ')}</small></button>`; }).join('')}<button data-camp="1" class="${(S.campPlan[fl] || []).includes(n.id) ? 'on' : ''}">야영</button>`,
      (b, el) => { if (b.dataset.evn != null) D.evPlanSet(S, fl, n.id, b.dataset.evn); if (b.dataset.camp) D.toggleCamp(S, fl, n.id); put(S); el.remove(); guild(); });
  }

  // 지도 그리기 (길드 안의 #dvmap): 경로 잉크 선(굵게) · 지나갈 방 순서 번호 · 깃펜 · 발자국 · 붉은 ✕ · 손글씨 풀이 값 · 새로 밝힌 방
  function drawMap(box, fl, erase = null) {
    if (PIX) return pixMap(box, fl, erase);
    const V = D.view(S, fl), plan = S.plan[fl] || null, svg = box.querySelector('#dvmap'); RUN.draw.render(svg, V);
    const L = V.map._lay, add = [], old = mapOld[fl] || [], from = plan ? (old.length && plan.slice(0, old.length).join() === old.join() ? old.length - 1 : 0) : 0;
    const ctr = id => { const r = L.room[id]; return [M6 + (r.x + r.w / 2) * T13, M6 + (r.y + r.h / 2) * T13]; };
    const tr = S.trail[fl] || []; for (let k = 0; k + 1 < tr.length; k++) { const d = segD(V.map, tr[k], tr[k + 1]); if (d) add.push(`<path class="dv-foot" d="${d}"/>`); }
    // 곁방에서 돌아오는 길(이미 지난 방으로 되돌아감)은 가는 점선으로 — 깃펜은 마지막으로 새로 가는 방에 (돌아온 방에 깃펜이 있으면 경로가 곁방에서 시작하는 것처럼 보였다)
    if (plan) { const met = new Set([plan[0]]); for (let k = 0; k + 1 < plan.length; k++) { const back = met.has(plan[k + 1]); met.add(plan[k + 1]); const d = segD(V.map, plan[k], plan[k + 1]); if (d) add.push(back ? `<path class="dv-seg ret${k >= from && !erase ? ' new' : ''}" data-k="${k}" d="${d}"/>` : `<path class="dv-under" d="${d}"/><path class="dv-seg${k >= from && !erase ? ' new' : ''}" data-k="${k}" d="${d}"/>`); } }
    if (erase) for (const d of erase) add.push(`<path class="dv-seg erase" d="${d}"/>`);
    add.push(...rwSvg(V.map, fl));
    const fail = new Set(S.fail[fl] || []);
    for (const q of V.map.edges) { const c = L.cor[q.id], [x, y] = c.cells[c.cells.length - 1] || c.doorB, X = M6 + (x + 1) * T13, Y = M6 + (y + 0.5) * T13;
      if (fail.has(q.id)) add.push(`<text x="${(X - 10).toFixed(1)}" y="${(Y + 7).toFixed(1)}" class="sym halo" fill="#8e2a1a" font-size="20">✕</text>`);
      if (!q.walked && ((q.kind === 'locked' && q.seen.lock) || (q.kind === 'trap' && q.seen.trap) || (q.kind === 'dark' && q.seen.dark))) D.gateInfo(S, V, q).map(x => x.val || (x.who.length ? `${x.k} ${x.who.slice(0, 3).join('·')}${x.who.length > 3 ? '…' : ''}` : '')).filter(Boolean).forEach((v, i) => add.push(`<text x="${(X + 3).toFixed(1)}" y="${(Y + 16 + i * 12).toFixed(1)}" class="note halo" fill="#2b1d14">${esc(v)}</text>`)); } /* 관문마다: 지금 파티의 값 · 없으면 풀 수 있는 직업 (파티를 바꾸면 바로 바뀐다) */
    for (const id of (S.campPlan[fl] || [])) { const rr = L.room[id], x = M6 + (rr.x + rr.w) * T13 - 14, y = M6 + rr.y * T13 + 4; add.push(`<path class="dv-tent" d="M${x.toFixed(1)},${(y + 10).toFixed(1)} l6,-10 l6,10 Z M${(x + 6).toFixed(1)},${(y + 10).toFixed(1)} l0,-5"/>`); } // 야영 지점 (텐트)
    const numd = new Set([plan?.[0]]); let num = 0; // 곁방에서 돌아온 방은 번호를 다시 달지 않는다
    if (plan) plan.slice(1).forEach(id => { if (numd.has(id)) return; numd.add(id); const i = num++; const rr = L.room[id], x = M6 + rr.x * T13 + 9, y = M6 + rr.y * T13 + 9; add.push(`<g class="dv-ord"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7.5"/><text x="${x.toFixed(1)}" y="${(y + 3.5).toFixed(1)}" text-anchor="middle">${i + 1}</text></g>`); }); // 순서 번호는 방 왼쪽 위 모서리 (가운데 글자와 겹치지 않게)
    svg.insertAdjacentHTML('beforeend', add.join('') + (plan ? QUILL : ''));
    // 맞춤: 경로가 있으면 경로(+입구) 쪽, 없으면 아는 곳 — 지도 칸의 가로세로 비율에 맞춰 넓힌다
    { const cs = [], box1 = id => { const r = L.room[id]; cs.push([r.x, r.y], [r.x + r.w, r.y + r.h]); };
      { /* 지도 틀은 아는 곳 전체로 고정 — 경로를 고르는 동안 확대 · 이동하지 않는다 (2026-11-23 사용자: 「줌인 연출」이 어색) */ V.map.nodes.forEach(q => { if (q.visited || q.seenMap || q.info >= 2) box1(q.id); }); V.map.edges.forEach(q => { if (q.walked) for (const c of L.cor[q.id].cells) cs.push(c, [c[0] + 1, c[1] + 1]); }); }
      if (cs.length) { let x0 = M6 + (Math.min(...cs.map(c => c[0])) - 2) * T13, y0 = M6 + (Math.min(...cs.map(c => c[1])) - 3) * T13, w = (Math.max(...cs.map(c => c[0])) - Math.min(...cs.map(c => c[0])) + 4) * T13, h = (Math.max(...cs.map(c => c[1])) - Math.min(...cs.map(c => c[1])) + 5) * T13;
        w = Math.max(w, 12 * T13); h = Math.max(h, 10 * T13); const cw = svg.clientWidth || 1, ch = svg.clientHeight || 1, ar = cw / ch;
        if (w / h < ar) { const nw = h * ar; x0 -= (nw - w) / 2; w = nw; } else { const nh = w / ar; y0 -= (nh - h) / 2; h = nh; }
        svg.setAttribute('viewBox', `${x0.toFixed(1)} ${y0.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`); } }
    // 발자국: 선 위에 10px마다 좌우 번갈아 (경로 잉크 위에 겹쳐도 읽히게 짙은 갈색 · 테두리)
    for (const p of svg.querySelectorAll('.dv-foot')) { const len = p.getTotalLength(), out = []; for (let u = 6, k = 0; u < len - 4; u += 10, k++) { const a = p.getPointAtLength(u), b = p.getPointAtLength(Math.min(len, u + 1)), ang = Math.atan2(b.y - a.y, b.x - a.x), o = k % 2 ? 2.8 : -2.8, cx = a.x - Math.sin(ang) * o, cy = a.y + Math.cos(ang) * o; out.push(`<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="3" ry="1.8" transform="rotate(${(ang * 180 / Math.PI).toFixed(0)} ${cx.toFixed(1)} ${cy.toFixed(1)})"/>`); } p.insertAdjacentHTML('afterend', `<g class="dv-feet">${out.join('')}</g>`); }
    const news = [...svg.querySelectorAll('.dv-seg.new')], quill = svg.querySelector('.dv-quill'), lastSeg = [...svg.querySelectorAll('.dv-seg:not(.erase):not(.ret)')].pop();
    const at = (p, u) => { const a = p.getPointAtLength(u); quill.setAttribute('transform', `translate(${a.x.toFixed(1)},${a.y.toFixed(1)}) scale(2)`); };
    if (quill && lastSeg) at(lastSeg, lastSeg.getTotalLength());
    if (news.length) { const lens = news.map(p => p.getTotalLength()), tot = lens.reduce((a, b) => a + b, 0) || 1, t0 = performance.now(), DUR = 420;
      news.forEach((p, i) => { p.style.strokeDasharray = lens[i]; p.style.strokeDashoffset = lens[i]; });
      const step = () => { if (!svg.isConnected) return; const q = Math.min(1, (performance.now() - t0) / DUR); let u = q * tot;
        news.forEach((p, i) => { const l = Math.max(0, Math.min(lens[i], u)); p.style.strokeDashoffset = lens[i] - l; if (u > 0 && u <= lens[i] && quill) at(p, l); u -= lens[i]; });
        if (q < 1) requestAnimationFrame(step); else { news.forEach(p => { p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; }); if (quill && lastSeg) at(lastSeg, lastSeg.getTotalLength()); } }; // 끝나면 원래 선 모양(돌아오는 길 점선)으로
      step(); }
    for (const p of svg.querySelectorAll('.dv-seg.erase')) requestAnimationFrame(() => p.classList.add('gone'));
    mapOld[fl] = plan ? plan.slice() : [];
    const prev = S.shown[fl] || '', cur0 = S.maps[fl]?.n || '';
    if (prev !== cur0) { for (const g of svg.querySelectorAll('g.room')) { const id = +g.dataset.id, was = parseInt(prev[id] || '0', 16), now = parseInt(cur0[id] || '0', 16); if ((now & 4) && !(was & 4)) g.classList.add('fresh'); } S.shown[fl] = cur0; put(S); }
    const sum = box.querySelector('.dv-sum'); if (sum) sum.innerHTML = summary(V, plan);
    edges(box, V, plan);
    svg.onclick = ev => { const rm = ev.target.closest('g.room'); ev.stopPropagation(); const before = (S.plan[fl] || []).slice();
      if (!rm) { if (!before.length) return; const gone = []; for (let k = 0; k + 1 < before.length; k++) { const d = segD(V.map, before[k], before[k + 1]); if (d) gone.push(d); } delete S.plan[fl]; put(S); mapOld[fl] = []; box.querySelector('.dv-clr')?.remove(); drawMap(box, fl, gone); return; } // 빈 곳을 누르면 경로를 지운다 (잉크가 흐려지며)
      if (before.includes(+rm.dataset.id) && +rm.dataset.id !== before[0]) { D.toggleCamp(S, fl, +rm.dataset.id); put(S); return drawMap(box, fl); } // 경로 위의 방을 다시 누르면 야영 지점 켬 · 끔 (경로 지우기는 빈 곳)
      if (!D.planTo(S, V, +rm.dataset.id)) { rm.classList.remove('nope'); void rm.getBBox(); rm.classList.add('nope'); const b = rm.getBBox(); rm.insertAdjacentHTML('beforeend', `<text class="note halo dv-nope" x="${(b.x + b.width / 2).toFixed(1)}" y="${(b.y + b.height / 2 + 6).toFixed(1)}" text-anchor="middle" fill="#8e2a1a" font-size="18">?</text>`); setTimeout(() => rm.querySelector('.dv-nope')?.remove(), 700); return; } // 아는 길이 없는 방: 경로는 그대로 · 흔들림과 「?」
      put(S); const after = S.plan[fl] || []; if (after.length && !box.querySelector('.dv-clr')) box.querySelector('.dv-fls')?.insertAdjacentHTML('beforeend', '<button class="dv-clr">경로 ✕</button>'); if (!after.length) box.querySelector('.dv-clr')?.remove();
      if (after.length < before.length) { const gone = []; for (let k = Math.max(0, after.length - 1); k + 1 < before.length; k++) { const d = segD(V.map, before[k], before[k + 1]); if (d) gone.push(d); } mapOld[fl] = after.slice(); drawMap(box, fl, gone); } // 지운 구간은 흐려지며 사라진다
      else drawMap(box, fl); };
    document.body.dataset.mapfl = fl;
  }
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
    const st = CRAWL.st; if (st) { if (logSrc.st !== st) { const keep = logSrc.st && st.log[logSrc.i - 1] === logSrc.st.log[logSrc.i - 1]; logSrc.st = st; logSrc.i = keep ? logSrc.i : 0; /* 계단: 새 층 기록은 지난 층 기록 뒤에 이어 붙는다 — 이미 읽은 줄은 건너뛴다 */ logPush('floor', `${st.floor}층 · ${RUN.zone(st.floor).n}`); } for (; logSrc.i < st.log.length; logSrc.i++) { gateSee(st, st.log[logSrc.i]); const o = logLine(st, st.log[logSrc.i]); if (o) logPush(o[0], o[1], o[2]); } }
    const r = R.roll; if (R.turn && r && r.id !== logSrc.roll && r.who) { logSrc.roll = r.id;
      const tw = D.tkTake(r.who); logPush('fight', `${r.who} · ${r.what || '공격'}${r.tg ? ` → ${r.tg}` : ''}${r.word ? ` · ${r.word}` : ''}${r.res ? ` · ${r.res}` : ''}${tw ? ` · ${tw}` : ''}`, `${r.nat ? `d20 ${r.nat}` : ''}${r.calc ? ` ${r.calc}` : ''}${r.need ? ` · 필요 ${r.need}` : ''}`.trim()); }
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
    if ((m = t.match(/^(.+) — 전투가 시작된다$/))) return ['fight', `전투 · ${m[1]}`];
    if ((m = t.match(/^전투에서 이겼다 \((\d+)라운드\)(?:\. )?(.*)$/))) return ['got', `승리 · ${m[1]}라운드${m[2] ? ` · ${m[2]}` : ''}`];
    if ((m = t.match(/^합류: (.+?) \(/))) return ['got', `동료 +1 · ${m[1]}`];
    if (/전멸/.test(t)) return ['fight', '전멸'];
    if (/먼저 덮쳐/.test(t)) return ['fight', '기습당함'];
    if (/적이 달아났다/.test(t)) return ['fight', '교착 · 적이 달아남'];
    if (/쓰러졌다\. 아래로/.test(t)) return ['exp', '우두머리 · 계단'];
    return null;
  }
  const LOG_IC = { fight: '⚔', exp: '›', got: '+', floor: '▼' };
  const logRows = (L, n) => L.slice(-n).map((e, i) => `<li class="lg-${e.k}"${e.d ? ` data-d="${esc(e.d)}"` : ''}><i>${LOG_IC[e.k] || '›'}</i>${esc(e.t)}${e.d ? `<small>${esc(e.d)}</small>` : ''}</li>`).join('');
  function logBox() {
    const bar0 = $('dv-bar'); if (!bar0 || !run) return; let el = $('dv-log');
    if (!el) { el = document.createElement('div'); el.id = 'dv-log'; el.onpointerup = ev => ev.stopPropagation(); el.innerHTML = '<ul></ul>'; bar0.insertBefore(el, bar0.querySelector('.dv-ps'));
      el.onclick = ev => { const li = ev.target.closest('li'); if (li && el.classList.contains('open') && li.dataset.d) { li.classList.toggle('det'); return; } el.classList.toggle('open'); run.logDirty = true; }; }
    const ps = bar0.querySelector('.dv-ps'); el.style.bottom = (ps ? ps.offsetHeight : 0) + 'px';
    if (!run.logDirty) return; run.logDirty = false; const open = el.classList.contains('open'), ul = el.firstChild;
    ul.innerHTML = logRows(run.log || [], open ? LOG_MAX : (innerHeight < 480 ? 2 : 3)); if (open) ul.scrollTop = ul.scrollHeight;
  }
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
  const skTag = (m, k) => { let t = ''; try { t = G.Skill.text(m, k) || ''; } catch (e) { t = G.D.MSKILLS[k]?.d || ''; } t = t.replace(/\s*\([^)]*\)/g, '').replace(/\.$/, '').split(' · ').filter(x => !/슬롯/.test(x)).join(' · '); /* 원정엔 올려 쓰기가 없어 「슬롯당」은 뺀다 */ if (t.length > 26) t = t.slice(0, 25) + '…'; return [t, G.Skill.SK[k]?.bonus ? '추가 행동' : ''].filter(Boolean).join(' · '); };
  // ── 레벨업 카드 창 (2026-11-23): 카드 셋(이름 · 주사위 · 쿨 N) — 칸이 다 찼으면 고른 뒤 바꿀 칸 또는 넘김. 원정 중에는 CARD.WAIT초 안에 답이 없으면 추천 · 떠 있는 동안 원정은 멈춘다
  function cardWin(m, done, timed) {
    const q = (m.cardq || [])[0]; if (!q) return done && done(); const offer = D.cardOffer(m), full = q.kind === 'swap' || (m.picks || []).length >= G.Builds.SLOT_N, K = G.D.MSKILLS;
    let el = $('dv-card'); if (!el) { el = document.createElement('div'); el.id = 'dv-card'; el.className = 'dv-panel'; el.onpointerup = ev => ev.stopPropagation(); document.body.append(el); }
    const cd = k => { const c = (G.Res.cdOf ? G.Res.cdOf(k) : 0) || G.Skill.SK[k]?.cd || 0; return c ? `쿨 ${c}` : ''; }, num = k => skTag(m, k);
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
  const EV_WAIT = 20;
  function evWin(st, sc, pick) {
    if (run.over) return; /* 돌아간 뒤에는 묻지 않는다 */
    const el = document.createElement('div'); el.id = 'dv-ev'; el.className = 'dv-panel'; el.onpointerup = ev => ev.stopPropagation(); document.body.append(el);
    const n = st.map.nodes[st.at], t0 = performance.now(), fl = st.floor, id = st.at;
    const row = (c, i) => { const o = D.evOut(n.ev, c.n), off = c.off && c.off(); return `<button data-i="${i}"${off || c.lock ? ' disabled' : ''}><b>${esc(c.n.replace(/^\[([^\]]*)\] /, '$1 · '))}</b><small>${[c.p != null && c.p < 1 ? `${Math.round(c.p * 100)}%` : '', o.ok.join(' · '), o.no.length ? `실패 ${o.no.join(' · ')}` : '', c.lock ? '' : c.sub || ''].filter(Boolean).join(' · ')}</small></button>`; };
    el.innerHTML = `<header><h2>${esc(sc.title)}</h2><span class="chip dv-ct"></span></header><div class="dv-evs">${sc.choices.map((c, i) => (D.evPass(n.ev, c.n) ? '' : row(c, i))).join('')}<button data-i="x" class="x">자리를 피한다</button></div>`;
    const end = i => { clearInterval(tm); el.remove(); if (i == null) { D.evMark(S, fl, id, { st: 'skip' }); put(S); st.log.push({ t: `${sc.title} · 자리를 피함`, k: 'dv' }); } pick(i); };
    const tm = setInterval(() => { if (!el.isConnected) return clearInterval(tm); const left = Math.ceil(EV_WAIT - (performance.now() - t0) / 1000), c = el.querySelector('.dv-ct'); if (c) c.textContent = left; if (left <= 0) end(null); }, 250);
    el.onclick = ev => { const b = ev.target.closest('button'); if (!b || b.disabled) return; end(b.dataset.i === 'x' ? null : +b.dataset.i); };
  }
  // 원정 중: 전투가 아닐 때 고를 것이 있는 영웅이 있으면 창 (레벨업 카드를 끄면 빌드대로)
  function cardTick() {
    if ($('dv-card') || FIGHT.on || !CRAWL.st || run.over) return; const ms = G.Party.members(G.S.w.fantasy).filter(m => (m.cardq || []).length); if (!ms.length) return;
    if (S.cardOn === false) { for (const m of ms) D.cardAuto(m); return; }
    cardWin(ms[0], null, true);
  }
  // 저절로 복귀 (원정 중): 「경로 끝 복귀」면 계획한 경로의 방을 다 지나 일이 끝났을 때, 「가득 차면 복귀」면 짐이 찼을 때 — 전투 · 창 · 걷는 중이 아닐 때만. 살아서 복귀로 친다
  function autoBack() {
    const st = CRAWL.st, v = CRAWL.view(); if (!st || run.over || st.done || v?.fighting || $('crawlscene') || $('exitsign') || REWARDUI.active) return;
    for (const k of ['potion', 'knockScroll', 'seeScroll', 'tools']) if (st.items[k] > 0) { st.gold += 10 * st.items[k]; st.log.push({ t: `${{ potion: '치유 물약', knockScroll: '열림 두루마리', seeScroll: '투시 두루마리', tools: '도둑 도구' }[k]} → 금화 +${10 * st.items[k]}`, k: 'dv' }); st.items[k] = 0; } // 원정에는 물약 · 두루마리 · 도구가 없다 (얻으면 금화로)
    if (D.wantCamp(S, st)) { const ms = G.Party.members(G.S.w.fantasy), r0 = D.campHere(st, ms); if (r0 && !r0.raid) for (const p of R.party) if (!p.dead) p.hp = p.max; return; } // 야영 (계획한 지점 · 계획이 없으면 체력 절반 아래)
    const planDone = S.endMode === 'back' && st.plan && st.plan.length > 1 && st.plan.every(id => st.map.nodes[id].visited) && st.at === st.plan[st.plan.length - 1];
    const full = S.fullBack && D.bagFull(st), al = st.party.filter(m => !m.dead), risk = S.risk !== false && al.length && ((al.reduce((a, m) => a + m.hp / m.max, 0) / al.length < 0.5 && !(st.items.camp > 0)) || (al.length < 2 && st.map.edges.some(e => e.a === st.at && ['boss', 'elite'].includes(st.map.nodes[e.b].type) && !st.map.nodes[e.b].visited) && !st.map.edges.some(e => e.a === st.at && !['boss', 'elite'].includes(st.map.nodes[e.b].type) && !st.map.nodes[e.b].visited && (e.kind !== 'hidden' || e.seen?.hidden)))); // 위험하면 복귀: 체력 평균 절반 아래 + 야영 물자 없음, 또는 혼자인데 남은 길이 정예 · 우두머리뿐
    if (!planDone && !full && !risk) { run.backT = 0; return; }
    if ((run.backT = (run.backT || 0) + 1) < 40) return; // 그 방 일(줍기 · 사건 알림)이 끝나게 잠깐 기다린다
    st.log.push({ t: risk ? '파티 위험 · 귀환' : planDone ? '경로 완주 · 귀환' : '짐 가득 · 귀환', k: 'dv' }); finish(st, risk ? 'risk' : planDone ? 'plan' : 'full');
  }
  // 원정 중 짐 목록 (위 막대의 짐 칩을 누르면): 남은 물자 · 전리품 이름과 등급 색 · 값
  function bagPop() {
    let el = $('dv-bagpop'); if (el) { el.remove(); return; } const st = CRAWL.st; if (!st) return;
    el = document.createElement('div'); el.id = 'dv-bagpop'; el.onpointerup = ev => ev.stopPropagation(); el.onclick = () => el.remove();
    const sup = D.SUP_KEYS.filter(k => st.items[k] > 0).map(k => `${ico({ sup: k }) || UI.px(SUP_N[k][1])} ${SUP_N[k][0]} ${k === 'tools' ? '' : st.items[k]}`).join(' · ');
    el.innerHTML = `<p><b>짐 ${D.bagUsed(st)}/${st.bagCap || 0}</b></p>${sup ? `<p>${sup}</p>` : ''}${(st.loot || []).filter(e => !e.gem).map(e => `<p>${ico(itemX(e))}<span class="r${e.r}">${D.RARITY[e.r]} · ${esc(e.n)}</span> <small>${UI.px('coin')} ${e.gold}</small></p>`).join('')}${(st.loot || []).some(e => e.gem) ? `<p><b>보물</b> ${(st.loot || []).filter(e => e.gem).map(e => `${ico({ gem: e.gem }) || UI.px('gem')} ${esc(e.n)} ×${e.cnt} <small>${UI.px('coin')} ${e.gold * e.cnt}</small>`).join(' · ')}</p>` : ''}`;
    $('stage').append(el);
  }
  // ── 원정 중 위 바 · 아래 파티 (읽는 것은 CRAWL.view · CRAWL.st) ──
  let barK = '', wasFight = null;
  const ITEM = [['potion', '물약'], ['knockScroll', '열림'], ['torch', '횃불'], ['tools', '도구']];
  function bar() {
    const v = CRAWL.view(), st = CRAWL.st; if (!v || !st) return; let el = $('dv-bar');
    if (!el) { el = document.createElement('div'); el.id = 'dv-bar'; el.onpointerup = ev => ev.stopPropagation(); el.innerHTML = '<div class="dv-top"></div><div class="dv-ps"></div>'; $('stage').append(el);
      el.onclick = ev => { if (D.HAND.on && handClick(ev)) return; const b = ev.target.closest('button'); if (!b) return; const f = G.S.w.fantasy, sp = D.speeds(S);
        if (b.classList.contains('dv-spd')) { f.turnX = sp[(sp.indexOf(f.turnX || sp[0]) + 1) % sp.length]; S.spdX = f.turnX; put(S); barK = ''; } // 단계는 f.turnX로 (G.Turn.speed에는 PACE가 곱해져 있다)
        if (b.classList.contains('dv-quit') && !run.over) finish(CRAWL.st, 'quit');
        if (b.classList.contains('dv-bagchip')) bagPop(); }; } // 돌아가기: 여기까지 번 금화 · 깬 층으로 끝낸다
    if (v.fighting !== wasFight) { wasFight = v.fighting; } // 전투가 끝나면 기본 배율로 (전투 중은 fitZoom)
    const earned = Math.max(0, st.gold - (st.gold0 ?? 0)), ps = v.party.map(p => ({ m: p.m, lv: p.m?.lv || 0, n: p.m?.name || '?', c: clsN(p.m?.cls), hp: Math.max(0, p.hp), max: p.max, xp: p.m ? Math.min(1, (p.m.xp || 0) / G.Guild.needOf(p.m)) : 0, dead: p.dead || p.hp <= 0 }));
    const k = JSON.stringify([handKey(), st.floor, v.sub, earned, st.items, (st.loot || []).length, G.Res.clock || 0, G.Turn.speed(G.S.w.fantasy), ps.map(p => [p.lv, p.n, p.hp, p.max, Math.round(p.xp * 50), p.dead])]); if (k === barK) return; barK = k;
    const its = ITEM.filter(([id]) => st.items[id] > 0).map(([id, n]) => `<span class="chip">${n} ${st.items[id]}</span>`).join('') + `<button class="chip dv-bagchip${D.bagFull(st) ? ' full' : ''}">짐 ${D.bagUsed(st)}/${st.bagCap || 0}</button>`; // 파티 짐 (누르면 목록)
    el.firstChild.innerHTML = `<div><b>${st.floor}층</b><small>${esc(RUN.zone(st.floor).n)} · ${esc(v.sub)}</small></div><div class="dv-r"><span class="chip c-gold">${UI.px('coin')} ${earned}</span>${its}<button class="dv-spd"${D.speeds(S).length > 1 ? '' : ' disabled'}>×${(G.S.w.fantasy.turnX || D.speeds(D.fresh())[0]) / D.speeds(D.fresh())[0]}</button>${fsBtn()}<button class="dv-quit">돌아가기</button></div>`;
    // 파티 카드 (시안 ①): 얼굴 · 레벨 · 이름 · 직업 · 체력 막대와 숫자 · 경험치 막대
    el.querySelector('.dv-ps').innerHTML = ps.map(p => `<div class="dv-p${p.dead ? ' dead' : ''}${D.HAND.on && p.m && p.m.uid === D.HAND.uid ? ' hand' : ''}${D.HAND.res?.ally?.merc && p.m?.uid === D.HAND.res.ally.merc.uid ? ' ally' : ''}" data-u="${p.m?.uid ?? ''}">${p.dead ? UI.px('skull') : ''}<canvas width="26" height="30"></canvas><em>${p.lv}</em><b>${esc(p.n)}</b><small>${esc(p.c)}</small><i class="hp"><em style="width:${Math.round(100 * p.hp / Math.max(1, p.max))}%"></em></i><span>${p.hp}/${p.max}</span>${p.m ? `<i class="dv-cd">${G.Builds.slots(p.m).filter(Boolean).map(k => `<em class="${G.Res.cdLeftOf && G.Res.cdLeftOf(p.m, k) > 0 ? 'cd' : ''}"></em>`).join('')}</i>` : ''}<i class="xp"><em style="width:${Math.round(100 * p.xp)}%"></em></i></div>`).join('');
    const pse = el.querySelector('.dv-ps'); pse.innerHTML += '<div class="dv-p empty"></div>'.repeat(Math.max(0, D.seats(S) - ps.length)); pse.style.gridTemplateColumns = `repeat(${Math.max(ps.length, D.seats(S))}, 1fr)`; // 자리 수만큼 칸 (빈 자리는 빈 칸)
    pse.querySelectorAll('canvas').forEach((cv, i) => { if (ps[i]?.m) UI.face(cv, ps[i].m); });
    { const hm = handM(); if (hm) pse.insertAdjacentHTML('afterbegin', `<div class="dv-hand">${G.Builds.slots(hm).filter(Boolean).map(k => { const left = cdL(hm, k); const nk = D.HAND.ack && !D.HAND.ack.ok && D.HAND.ack.k === k && Date.now() - D.HAND.ack.t < 700; return `<button data-hk="${k}" class="${D.HAND.res?.k === k ? 'on' : ''}${left ? '' : ' rdy'}${nk ? ' no' : ''}${D.HAND.fired && D.HAND.fired.k === k && Date.now() - D.HAND.fired.t < 1200 ? ' fired' : ''}"><b>${esc(G.D.MSKILLS[k]?.n || k)}</b><small>${nk ? `안 됨${left ? ' · ' + left : ''}` : left || ''}</small></button>`; }).join('')}</div>`); } // 직접 조종: 그 영웅의 스킬 칸 (쿨타임 남은 수 · 준비되면 밝게 · 누르면 예약)
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
  function roomFit() { const st = CRAWL.st; if (!D.TUNE.SMALL_ROOMS || !st || !R?.turn || !PXS) return null; const n = st.map.nodes[st.at]; if (!n) return null; const b = st.map._lay.room[st.at], K = G.Floor.K;
    const ps = [[b.x * K - 0.5, b.y * K - 0.5], [(b.x + b.w) * K - 0.5, b.y * K - 0.5], [b.x * K - 0.5, (b.y + b.h) * K - 0.5], [(b.x + b.w) * K - 0.5, (b.y + b.h) * K - 0.5]].map(([x, y]) => project(wx(x), wy(y), 0)), xs = ps.map(p => p.sx), ys = ps.map(p => p.sy);
    const w = Math.max(...xs) - Math.min(...xs), hr = Math.max(...ys) - Math.min(...ys), h = hr + VH * 0.12; if (!(w > 0)) return null; const wide = VW > VH * 1.4, k = Math.min(VW * 0.96 * (D.TUNE.FIT_W || 1) / w, wide ? VH * (D.TUNE.FIT_H || 0.95) / Math.max(1, hr) : VH * 0.78 / h); /* 가로 화면(2026-11-24): 낮은 높이에 방을 다 담으면 캐릭터가 25px까지 줄었다 — 가로에서는 방 바닥이 높이의 FIT_H배에 들어오게 (벽 윗부분은 위 막대 밑으로 들어가도 된다) */ /* FIT_W: 방 폭의 몇 배까지 화면에 담나 (1 = 전부 · 1.2 = 좌우 끝 20%는 잘려도) */ return PXS * k; } // 지금 배율 기준의 맞는 배율 (넘치지 않으면 지금보다 크다 — 부르는 쪽이 min)
  // 작은 방(TUNE.SMALL_ROOMS, 우두머리 방 빼고): 방 전체가 화면에 들어오니 싸우는 사람을 쫓지 않고 방 가운데에 선다
  const roomMid = () => { const st = CRAWL.st; if (!D.TUNE.SMALL_ROOMS || !st) return null; const n = st.map.nodes[st.at]; if (!n) return null; const b = st.map._lay.room[st.at], K = G.Floor.K; return [b.x * K + b.w * K / 2 - 0.5, b.y * K + b.h * K / 2 - 0.5]; };
  function camAt(r) {
    if (G.Turn.rt && drag?.cam) return drag.cam; // 끄는 동안 카메라를 멈춘다 (놓을 자리가 손가락 밑에서 미끄러지지 않게)
    if (G.Turn.rt) { const all = r.party.filter(p => !p.dead).concat(r.mons.filter(m => m.hp > 0)); if (all.length) return drag ? (drag.cam = [all.reduce((a, e) => a + (e._dx ?? e.x), 0) / all.length, all.reduce((a, e) => a + (e._dy ?? e.y), 0) / all.length]) : [all.reduce((a, e) => a + (e._dx ?? e.x), 0) / all.length, all.reduce((a, e) => a + (e._dy ?? e.y), 0) / all.length]; } // 실시간: 싸우는 사람 모두의 가운데를 부드럽게 (걸어 들어온 파티에서 카메라가 튀지 않게)
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
    if (typeof setZoom !== 'function') return; const base = HUD.zoom(false), fz = roomFit(); let want = R.turn && !D.TUNE.SMALL_ROOMS ? base * FIGHT_K : base * (D.TUNE.SMALL_ROOMS ? D.TUNE.VIEW_K || 1 : 1); if (fz && fz < want) want = fz; // 작은 방이 화면보다 넓으면 그만큼만 물러난다 (방 전체가 들어오게) // 작은 방(TUNE.SMALL_ROOMS)이면 전투에도 줌아웃 없이 — 우두머리 방(21타일)만 예전처럼 물러난다
    if (!zc) zc = PXS || base; const d = want - zc; zc = Math.abs(d) < 0.02 ? want : zc + d * Math.min(1, dt * 8);
    if (Math.abs(zc - PXS) > 0.01) setZoom(zc, true); if (!R.turn) camPt = null;
  }
  // ── 직접 조종 시험판 (2026-11-24, 흐름식 — 규칙은 D.HAND): 카드를 누르면 그 영웅을 조종 · 다시 누르면 전원 AI. 적을 누르면 표적 고정. 스킬을 누르면 다음 차례에 (치유는 누른 뒤 카드로 대상)
  const cdL = (m, k) => { const p = R?.turn && R.party.find(q => q.merc === m); return p ? D.handCd(R, p, k) : G.Res.cdLeftOf ? G.Res.cdLeftOf(m, k) : 0; }; // 남은 쿨타임 (라운드) — 전투 중엔 무기 기술 쿨타임까지
  const handM = () => (D.HAND.on && D.HAND.uid != null ? R?.party.find(p => p.merc?.uid === D.HAND.uid)?.merc || null : null);
  function handInit() { const H = D.HAND, rtOn = /[?&]rt=0/.test(location.search) ? false : !!S.rt || /[?&]rt=1/.test(location.search); H.cmd = {}; H.multi = rtOn; H.auto = rtOn && S.rtAuto !== false; G.Turn.rt = rtOn ? { round: D.TUNE.RT_ROUND, walk: D.TUNE.RT_WALK, lunge: D.TUNE.RT_LUNGE } : null; document.body.classList.toggle('rt', rtOn); // 실시간 시험판: 넷 모두 끌어서 조종 · 유닛마다 시계
    H.on = rtOn || !!S.hand || /[?&]hand=1/.test(location.search); H.uid = H.on && !rtOn && S.handCls ? R.party.find(p => p.merc?.cls === S.handCls)?.merc?.uid ?? null : null; } // 원정이 다시 시작돼도 같은 직업을
  const handKey = () => { const m = handM(); const fr = D.HAND.fired && Date.now() - D.HAND.fired.t < 1200 ? D.HAND.fired.k : ''; const nk = D.HAND.ack && Date.now() - D.HAND.ack.t < 700 ? D.HAND.ack.t : 0; return D.HAND.on ? [fr, nk, D.HAND.uid, D.HAND.res?.k, D.HAND.res?.ally?.merc?.uid, m ? G.Builds.slots(m).filter(Boolean).map(k => cdL(m, k)) : 0] : 0; };
  function handClick(ev) {
    if (performance.now() - dragAt < 400) return true; // 방금 끌어다 놓았다 (칸 누르기로 치지 않는다)
    const H = D.HAND, sk = ev.target.closest('[data-hk]');
    if (sk) { const k = sk.dataset.hk; if (H.res?.k === k) { D.handSet(null); barK = ''; return true; }
      if (H.multi && R?.turn) { const p = R.party.find(q => q.merc?.uid === H.uid), w = p ? D.handWait(R, p, k) / Math.max(0.1, G.Turn.speed(G.S.w.fantasy)) : 0; if (w > 1) { H.ack = { uid: H.uid, ok: false, k, t: Date.now() }; barK = ''; return true; } } // 실시간: 쿨타임이 1초 넘게 남았으면 받지 않는다 (흔들림) · 1초 안이면 이어서 예약
      D.handSet(k, { wantAlly: !!G.Skill.SK[k]?.heal && !H.multi }); if (H.cmd[H.uid]) H.cmd[H.uid].seq = (H.cmd[H.uid].seq || 0) + 1; barK = ''; return true; }
    const pc = ev.target.closest('.dv-p[data-u]'); if (!pc || pc.dataset.u === '') return false; const uid = +pc.dataset.u, p = R.party.find(q => q.merc?.uid === uid); if (!p) return true;
    if (H.res?.wantAlly) { H.res.ally = p; H.res.wantAlly = false; barK = ''; return true; } // 치유 스킬을 누른 뒤: 그 아군에게
    if (H.uid === uid) { D.handPick(null); S.handCls = null; } else { D.handPick(uid); S.handCls = p.merc.cls; } H.lock = null; H.res = null; put(S); barK = ''; return true;
  }
  function handTap(ev) { // 전투 중 적을 누르면 조종 영웅의 표적 (넉넉하게 — 누른 칸에서 1.6칸 안의 가장 가까운 적)
    if (performance.now() - dragAt < 400) return true; // 방금 끌어다 놓았다
    if (!D.HAND.on || !handM() || !R?.turn) return false; const [tx, ty] = UI.tileAt(ev.clientX, ev.clientY);
    let best = null, bd = 1.6; for (const o of R.mons) { if (o.hp <= 0 || o.down) continue; const d = Math.hypot((o._dx ?? o.x) - tx, (o._dy ?? o.y) - ty); if (d < bd) { bd = d; best = o; } }
    if (!best) return false; const p = R.party.find(q => q.merc?.uid === D.HAND.uid); if (D.HAND.multi && p) dragApply(p, { k: 'foe', e: best }); else D.HAND.lock = best; return true; }
  function handRing() { const H = D.HAND, sv = UI.svg('dvhandsvg', 3); if (!R?.turn) { sv.innerHTML = ''; return; }
    const ls = H.multi ? Object.entries(H.cmd).filter(([, c]) => c.lock && c.lock.hp > 0).map(([u, c]) => [c.lock, +u === H.uid]) : (H.lock && handM() ? [[H.lock, true]] : []);
    const now = Date.now(), fl = c => c && c.at && now - c.at < 600 ? ' flash' : '', P = u => R.party.find(q => q.merc?.uid === +u);
    let h = ls.map(([L, me]) => { const u = Object.keys(H.cmd).find(u => H.cmd[u].lock === L); return `<path class="dv-lock${me ? '' : ' dim'}${fl(H.cmd[u])}" d="${UI.ring(L._dx ?? L.x, L._dy ?? L.y, 0.62)}"/>`; }).join('');
    { const me = H.multi && H.uid != null && P(H.uid); if (me && !me.dead) h += `<path class="dv-sel" d="${UI.ring(me._dx ?? me.x, me._dy ?? me.y, 0.5)}"/>`; } // 고른 영웅의 발밑
    for (const [u, c] of Object.entries(H.cmd)) if (c.go && P(u)) h += `<path class="dv-go${+u === H.uid ? '' : ' dim'}${fl(c)}" d="${UI.ring(c.go.x, c.go.y, 0.4)}"/>`; // 바닥 명령: 설 칸
    const ak = H.ack && now - H.ack.t < 600 ? H.ack : null, fr = H.fired && now - H.fired.t < 700 ? H.fired : null; // 명령이 먹힌 영웅(초록) · 안 먹힌 영웅(빨강) · 스킬이 나간 영웅(밝게)
    for (const [o, cl] of [[ak && P(ak.uid), ak && (ak.ok ? 'ok' : 'no')], [fr && P(fr.uid), 'fired']]) if (o) h += `<path class="dv-ack ${cl}" d="${UI.ring(o._dx ?? o.x, o._dy ?? o.y, 0.55)}"/>`;
    sv.innerHTML = h; } // 표적 고리 (실시간: 영웅마다 · 고른 영웅은 진하게)
  // ── 끌어다 놓기 (실시간 시험판, 2026-11-24): 파티 칸이나 영웅 인형에서 끌기 시작 → 선 → 놓은 곳: 적 = 그 영웅의 표적 고정 · 아군 = 그 영웅의 아군 대상 스킬(다쳤으면 치유 먼저, 아니면 강화)을 그 아군에게 예약 · 바닥 = 없음
  let drag = null, dragAt = 0;
  const entAt = (cx, cy) => { const [tx, ty] = UI.tileAt(cx, cy); let best = null, bd = 1.7; for (const o of R.mons) { if (o.hp <= 0 || o.down) continue; const d = Math.hypot((o._dx ?? o.x) - tx, (o._dy ?? o.y) - ty); if (d < bd) { bd = d; best = { k: 'foe', e: o }; } } for (const p of R.party) { if (p.dead || !p.merc) continue; const d = Math.hypot((p._dx ?? p.x) - tx, (p._dy ?? p.y) - ty); if (d < bd) { bd = d; best = { k: 'ally', e: p }; } } return best || { k: 'ground' }; };
  const allySk = (m, hurt) => { const ks = [...new Set(G.Builds.slots(m).filter(Boolean).concat(G.Guild.active(m)))].filter(k => G.Skill.SK[k]), SK = G.Skill.SK, heal = ks.find(k => SK[k]?.heal), buff = ks.find(k => !SK[k]?.heal && (G.SkillEff_at?.(k, m.cls, m.lv)?.buf || []).some(b => b.to && b.to !== 'self')); return hurt ? heal || buff : buff || heal; };
  function dragApply(p, t, cx, cy) { const H = D.HAND; D.handPick(p.merc.uid); const c = H.cmd[p.merc.uid] = H.cmd[p.merc.uid] || { lock: null, res: null }; let ok = true;
    if (t.k === 'foe') { c.lock = t.e; c.go = null; } else if (t.k === 'ally') { const k = allySk(p.merc, t.e.hp < t.e.max * 0.9); if (k && !(D.handWait(R, p, k) / Math.max(0.1, G.Turn.speed(G.S.w.fantasy)) > 1)) c.res = { k, ally: t.e }; else ok = false; }
    else { const [tx, ty] = UI.tileAt(cx, cy), x = Math.round(tx), y = Math.round(ty); if (R?.turn && G.Grid.pass(R.map, x, y)) { c.go = { x, y }; c.lock = null; } else ok = false; } // 바닥: 그 칸에 가 서서 닿는 적만 (D.handLane)
    if (ok) { c.seq = (c.seq || 0) + 1; c.at = Date.now(); } H.ack = { uid: p.merc.uid, ok, k: null, t: Date.now() }; barK = ''; }
  function dragDraw(ev) { let sv = $('dv-drag'); if (!sv) { sv = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); sv.id = 'dv-drag'; document.body.append(sv); } const t = entAt(ev.clientX, ev.clientY), col = t.k === 'foe' ? '#ff6a55' : t.k === 'ally' ? '#9fe79f' : '#c9c2b2';
    sv.innerHTML = `<line x1="${drag.x0}" y1="${drag.y0}" x2="${ev.clientX}" y2="${ev.clientY}" stroke="${col}" stroke-width="4" stroke-dasharray="8 5" stroke-linecap="round"/><circle cx="${ev.clientX}" cy="${ev.clientY}" r="${t.k === 'ground' ? 8 : 16}" fill="none" stroke="${col}" stroke-width="3"/>`;
    UI.svg('dvdragsvg', 4).innerHTML = t.e ? `<path class="dv-drop ${t.k}" d="${UI.ring(t.e._dx ?? t.e.x, t.e._dy ?? t.e.y, 0.7)}"/>` : ''; }
  function dragEnd() { drag = null; $('dv-drag')?.remove(); const s2 = $('dvdragsvg'); if (s2) s2.innerHTML = ''; }
  function dragInit() { if (dragInit.done) return; dragInit.done = true;
    document.addEventListener('pointerdown', ev => { if (!D.HAND.multi || !R || !run || run.over) return; let p = null; const card = ev.target.closest?.('#dv-bar .dv-p[data-u]'); if (card && card.dataset.u !== '') p = R.party.find(q => q.merc?.uid === +card.dataset.u);
      else if (ev.target.id === 'c' || ev.target.closest?.('#stage canvas')) { const t = entAt(ev.clientX, ev.clientY); if (t.k === 'ally' && R.turn) p = t.e; }
      if (p && !p.dead) drag = { p, card: !!card, x0: ev.clientX, y0: ev.clientY, moved: false }; }, true);
    document.addEventListener('pointercancel', ev => { if (!drag) return; const d = drag; if (d.moved && d.lx != null) { dragApply(d.p, entAt(d.lx, d.ly), d.lx, d.ly); dragAt = performance.now(); } dragEnd(); }, true); // 브라우저가 끌기를 가로채도(pointercancel) 마지막 자리에 놓는다
    document.addEventListener('pointermove', ev => { if (!drag) return; drag.lx = ev.clientX; drag.ly = ev.clientY; if (!drag.moved && Math.hypot(ev.clientX - drag.x0, ev.clientY - drag.y0) > 10) drag.moved = true; if (drag.moved) dragDraw(ev); }, true);
    document.addEventListener('pointerup', ev => { if (!drag) return; const d = drag; if (d.moved) { dragApply(d.p, entAt(ev.clientX, ev.clientY), ev.clientX, ev.clientY); dragAt = performance.now(); ev.stopPropagation(); } else if (!d.card && D.HAND.uid !== d.p.merc.uid) { pickHero(d.p); dragAt = performance.now(); } /* 싸움판의 영웅을 누르면 그 영웅을 고른다 */ dragEnd(); }, true); }
  const pickHero = p => { D.handPick(p.merc.uid); S.handCls = p.merc.cls; put(S); barK = ''; };
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
  // 예고 동작 (실시간 — 규칙은 G.MonAct.teleTick, R.tele): 범위는 바닥 칸이 붉게 차오르고 · 한 사람을 노리면 그 발밑 고리 · 몬스터 머리 위에 차오르는 막대와 이름
  function teleDraw() { const sv = UI.svg('dvtelesvg', 2), L = R?.turn && R.tele; if (!L || !L.length) { if (sv.innerHTML) sv.innerHTML = ''; return; }
    const cellD = (x, y) => [[x - 0.5, y - 0.5], [x + 0.5, y - 0.5], [x + 0.5, y + 0.5], [x - 0.5, y + 0.5]].map(([a, b], i) => { const [X, Y] = UI.toStage(a, b); return `${i ? 'L' : 'M'}${X.toFixed(1)},${Y.toFixed(1)}`; }).join('') + 'Z';
    sv.innerHTML = L.map(q => { const k = Math.min(1, 1 - Math.max(0, q.t) / q.T), op = (0.12 + 0.55 * k).toFixed(2), e = q.e, [hx, hy] = UI.toStage((e._dx ?? e.x) - 1.2, (e._dy ?? e.y) - 1.2);
      return `<rect class="tl-bg" x="${(hx - 24).toFixed(1)}" y="${(hy - 4).toFixed(1)}" width="48" height="7" rx="2"/><rect class="tl-fill" x="${(hx - 24).toFixed(1)}" y="${(hy - 4).toFixed(1)}" width="${(48 * k).toFixed(1)}" height="7" rx="2"/><text class="tl-n" x="${hx.toFixed(1)}" y="${(hy - 8).toFixed(1)}">${esc(q.name)}</text>`; }).join(''); }
  function frame(dt) {
    if (!R) return;
    if (run && run.over) return; // 끝난 뒤에는 탐사를 멈춘다 (결과 창 아래)
    CRAWL.frame(dt); if (run) { cardTick(); if (R.turn && R.turn.round !== run.rd) { if (run.rd != null) G.Res.clock = (G.Res.clock || 0) + 1; run.rd = R.turn.round; } else if (!R.turn) run.rd = null; /* 전투 라운드마다 쿨타임 시계 +1 */ unstick(); firstLine(); teleDraw(); gateTick(); D.statTick(CRAWL.st, R); if (D.HAND.on) { D.handTick(R); handRing(); } bar(); logPoll(); logBox(); autoBack(); grow(dt); fitZoom(dt); if ((run.memT = (run.memT || 0) + dt) > 2 && CRAWL.st) { run.memT = 0; D.remember(S, CRAWL.st); } miniPlan(); }
  }
  // 직접 조종: 조종 영웅이 있으면 카메라가 그 영웅(표시 위치 _dx · _dy)을 따라간다 — 없으면 null (지금 카메라 그대로)
  const follow = r => { if (!D.HAND.on || D.HAND.uid == null || !run || run.over) return null; if (r.turn && roomMid()) return null; /* 전투 중 작은 방은 방 전체가 들어오니 방 가운데 (영웅을 가운데 두면 방 한쪽이 밀려 나간다) */ const p = r.party.find(q => q.merc?.uid === D.HAND.uid && !q.dead); return p ? [p._dx ?? p.x, p._dy ?? p.y] : null; };
  return { world, attach, frame, zoom, camAt, follow, chest: k => chestShow(k), get on() { return ON && on; } };
})();
