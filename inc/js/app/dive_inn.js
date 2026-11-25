'use strict';
// 원정 모드의 길드 = 선술집 한 장면 (2026-11-25, DIVE_NEXT 2번): 열린 직업의 영웅이 모두 서 있다. 누르면 파티에 들어가고(아래 초상 줄) 오른쪽에 정보가 뜬다.
// 그리기만 — 누른 것의 처리는 js/app/dive_ui.js의 inn() (data-in = 장면의 영웅 · data-out = 파티 줄의 초상 · 나머지 단추).
// 방 그림은 선술집(js/app/tavern_ui.js의 room)을 같이 쓴다. 인형은 게임 안과 같은 픽셀(MD.pix), 장면 높이 240 기준이라 1배 남짓.
const DIVEINN = (() => {
  const { esc } = UI, D = G.Dive, H = 240, RH = 120;
  const prev = new Map(); // 아직 안 들인 직업의 본보기 인형 (직업 → 사람)
  const demo = (S, c) => { let m = prev.get(c); if (!m) { m = D.member(G.S.w.fantasy, c, 1, () => 0.5, D.soloBuilds(c)[0]?.id); prev.set(c, m); } return m; };
  const clsN = c => G.Guild.def({ cls: c })?.n || c;
  const merc = (S, c) => S.roster[c]?.m || demo(S, c);
  const stOf = (S, c) => (S.dead[c] ? 'dead' : !S.roster[c] ? 'new' : 'in');
  // 설 자리: 뒷줄 · 앞줄 (직업 차례대로 번갈아 — 파티가 바뀌어도 자리는 그대로)
  function spots(n, W) {
    const x0 = W * 0.04, x1 = W * 0.95, one = n <= 6 && n * 70 <= x1 - x0, rows = one ? 1 : Math.max(2, Math.ceil(n * 34 / (x1 - x0))), ys = one ? [206] : rows === 2 ? [168, 226] : [150, 188, 228];
    return Array.from({ length: n }, (_, i) => { const r = i % ys.length, k = Math.ceil((n - r) / ys.length), j = Math.floor(i / ys.length), step = (x1 - x0) / (Math.ceil(n / ys.length) + (one ? 0 : 0.5));
      return { x: Math.round(one ? x0 + step * (j + 0.5) : x0 + step * (j + 0.5 + (r % 2 ? 0.5 : 0)) + (k ? 0 : 0)), y: ys[r] - (one && i % 2 ? 14 : 0) }; });
  }
  function scene(el, S, cur) {
    const cs = D.classes(S), team = D.team(S), cv = el.querySelector('canvas'), x = cv.getContext('2d'), who = el.querySelector('.in-who'), back = document.createElement('canvas'), bx = back.getContext('2d'), tall = [];
    let W = 0, P = [], cw0 = 0, ch0 = 0;
    const fit = () => { const cw = el.clientWidth || 360, ch = el.clientHeight || H; if (cw === cw0 && ch === ch0) return; cw0 = cw; ch0 = ch;
      const dpr = Math.max(1, Math.round(devicePixelRatio || 1)), k = Math.max(1 / dpr, Math.floor(ch / H * dpr) / dpr); // 배율은 기기 화소의 정수배 (그림이 고르게)
      W = Math.round(cw / k); cv.width = W; cv.height = H; cv.style.width = W * k + 'px'; cv.style.height = H * k + 'px'; who.style.height = H * k + 'px'; who.style.top = cv.style.top = Math.floor((ch - H * k) / 2) + 'px'; back.width = Math.ceil(W / 2); back.height = RH; P = spots(cs.length, W); marks(); };
    const marks = () => { who.innerHTML = cs.map((c, i) => { const p = P[i], h = tall[i] || 36, st = stOf(S, c), on = team.includes(c) && st !== 'dead';
      return `<button data-in="${c}" class="in-g ${st}${on ? ' on' : ''}${c === cur ? ' cur' : ''}" style="left:${(100 * p.x / W).toFixed(2)}%;top:${(100 * (p.y - h - 2) / H).toFixed(2)}%;height:${(100 * (h + 6) / H).toFixed(2)}%"><span>${st === 'dead' ? UI.px('skull') : ''}${esc(S.roster[c]?.m.name || clsN(c))}</span></button>`; }).join(''); };
    const paint = () => {
      fit(); const t = performance.now() / 1000; let grew = false;
      TAVERNUI.room(bx, back.width, t, 0); x.imageSmoothingEnabled = false; x.drawImage(back, 0, 0, back.width * 2, H); TAVERNUI.shade(x, W);
      for (const i of cs.map((_, i) => i).sort((a, b) => P[a].y - P[b].y)) { const c = cs[i], p = P[i], st = stOf(S, c), on = team.includes(c) && st !== 'dead', sp = MD.pix ? MD.pix(merc(S, c), st === 'in' ? t + i * 0.37 : 0.2) : null;
        x.fillStyle = 'rgba(0,0,0,.36)'; x.fillRect(p.x - 10, p.y - 1, 20, 3); x.fillRect(p.x - 7, p.y - 2, 14, 5);
        if (on || c === cur) { x.fillStyle = on ? '#f2c14e' : '#e9e2d0'; x.fillRect(p.x - 12, p.y + 3, 24, 1); x.fillRect(p.x - 14, p.y, 2, 3); x.fillRect(p.x + 12, p.y, 2, 3); x.fillRect(p.x - 12, p.y - 3, 3, 1); x.fillRect(p.x + 9, p.y - 3, 3, 1); }
        if (!sp) continue; if (!tall[i]) { tall[i] = sp.foot - sp.top; grew = true; }
        x.save(); if (st === 'new') x.filter = 'brightness(.32) saturate(.3)'; if (st === 'dead') { x.globalAlpha = 0.6; x.filter = 'grayscale(1)'; } x.drawImage(TAVERNUI.bitmap(sp), p.x - Math.floor(sp.w / 2), p.y - sp.foot); x.restore(); }
      if (grew) marks(); };
    paint(); const tm = setInterval(() => { if (!el.isConnected) return clearInterval(tm); if (!document.hidden && !document.querySelector('#dv-sheet,#dv-hero,#dv-dex,#dv-pick')) paint(); }, 100);
  }
  // 초상: 인형 그림이 아직이면 다시 시도
  const faces = (box, S) => box.querySelectorAll('canvas[data-f]').forEach(cv => { const go = () => { if (cv.isConnected && !UI.face(cv, merc(S, cv.dataset.f))) setTimeout(go, 400); }; go(); });
  // 파티 초상 줄 (길드 · 지도가 같이 쓴다): 자리 수만큼 칸
  const party = (S, key) => { const t = D.team(S); return `<div class="in-party">${Array.from({ length: D.seats(S) }, (_, i) => { const c = t[i]; if (!c) return '<i class="in-p empty"></i>'; const m = S.roster[c]?.m;
    return `<button class="in-p on" data-${key}="${c}"><canvas data-f="${c}" width="26" height="30"${m ? '' : ' class="sil"'}></canvas><b>${esc(m?.name || clsN(c))}</b><em>${m?.lv || D.newLv(S)}</em></button>`; }).join('')}</div>`; };
  // 오른쪽 정보: 얼굴 · 이름 · 직업 · 레벨 · 수치 넷 · 스킬 이름 · 단추
  function info(S, c) {
    if (!c) return ''; const h = S.roster[c], st = stOf(S, c), team = D.team(S), inT = team.includes(c);
    const head = (n, sub) => `<div class="in-hd"><canvas data-f="${c}" width="26" height="30"${h ? '' : ' class="sil"'}></canvas><div><b>${esc(n)}</b><small>${esc(sub)}</small></div></div>`;
    if (!h) return head(clsN(c), `Lv ${D.newLv(S)}`) + `<ul class="in-sk">${D.soloBuilds(c).map(b => `<li>${esc(b.n)}</li>`).join('')}</ul><div class="in-act"><button class="in-hire" data-hire="${c}">영입</button></div>`;
    const m = h.m, Q = D.sheetOf(h), sg = n => (n >= 0 ? '+' : '') + n, need = G.Guild.needOf(m), v = G.Builds.view(m), hp = Q.hp ?? G.Dnd.srdHP(m);
    return head(m.name, `${clsN(c)} · ${G.Builds.byId(m.build)?.n || ''}`)
      + `<div class="in-lv">Lv ${m.lv}<i><em style="width:${m.lv >= D.LV_MAX ? 100 : Math.round(100 * Math.min(1, (m.xp || 0) / need))}%"></em></i></div>`
      + `<div class="in-st"><span><b>${hp}</b>체력</span><span><b>${Q.ac}</b>방어</span><span><b>${sg(Q.hit)}</b>명중</span><span><b>${Q.dmg.n}d${Q.dmg.d}${Q.dmg.b ? sg(Q.dmg.b) : ''}</b>피해</span></div>`
      + `<ul class="in-sk">${(v?.slots || []).filter(o => o.s).map(o => `<li>${esc(o.s.n)}</li>`).join('')}</ul>`
      + `<div class="in-act">${st === 'dead' ? `<button class="in-hire" data-rev="${c}">부활 ${UI.px('coin')} ${D.reviveCost(S, c)}</button>` : inT ? `<button data-out="${c}"${team.length < 2 ? ' disabled' : ''}>빼기</button>` : `<button data-add="${c}"${team.length >= D.seats(S) ? ' disabled' : ''}>넣기</button>`}<button data-hero="${c}">상태</button></div>`;
  }
  return { scene, party, info, faces };
})();
