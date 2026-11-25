'use strict';
// 화면 도우미 (브라우저 전용): 요소 찾기 · 글자 이스케이프 · 쿼터뷰 위치에 띄우기 · 진행 글.
const UI = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // 쿼터뷰 좌표(x, y, 높이 z)에 화면 요소를 띄운다 (요소의 발밑 가운데가 그 자리)
  function place(el, x, y, z = 0) {
    const rc = canvas.getBoundingClientRect(), sb = $('stage').getBoundingClientRect(), a = project(wx(x), wy(y), z);
    el.style.transform = `translate(${Math.round(rc.left - sb.left + a.sx / W * rc.width)}px,${Math.round(rc.top - sb.top + a.sy / H * rc.height)}px) translate(-50%,-100%)`;
  }
  // 초상: 게임 안 픽셀 인형(MD.pix — js/render/qpx.js)의 윗몸을 작은 캔버스에 그린다. 그림이 아직 안 왔으면 false (다음 틱에 다시). m = 용병 기록 또는 몬스터(kind 'mon' — 인형으로 그리는 것만)
  const bmp = new WeakMap();
  function face(cv, m) {
    const sp = typeof MD !== 'undefined' && MD.pix ? (m.kind === 'mon' ? MD.pixMon(m) : MD.pix(m, 0.2)) : null; if (!sp || !cv) return false;
    let c = bmp.get(sp); if (!c) { c = document.createElement('canvas'); c.width = sp.w; c.height = sp.h; c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(sp.px.buffer.slice(0)), sp.w, sp.h), 0, 0); bmp.set(sp, c); }
    const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.clearRect(0, 0, cv.width, cv.height); x.drawImage(c, Math.floor(cv.width / 2 - sp.w / 2), Math.floor(cv.height - (sp.foot - sp.top) * 0.62 - sp.top) - 2); return true;
  }
  // 인형이 없는 몬스터(짐승 · 용 …)의 얼굴: 게임에 그리는 스프라이트(sprite(e.t))의 윗부분(그림 폭만큼의 정사각형)을 잘라 맞춘다. 그림이 아직 안 왔으면 false
  const sbmp = new WeakMap();
  function spriteFace(cv, e) {
    let sp = null; try { const d = typeof dcssOf === 'function' ? dcssOf(e) : null; const f0 = d?.fr?.idle?.[0]; sp = f0 ? (sbmp.get(f0)?.sp || { w: d.w, h: d.h, px: f0 }) : null; if (f0 && !sbmp.get(f0)) sbmp.set(f0, { sp }); } catch (er) { sp = null; } /* 싸움판에 실제로 그리는 그림 (DCSS) — assets/art의 m_rat 같은 자리표 그림이 아니라 */
    if ((!sp || !sp.px) && typeof dcssOf === 'function' && e.kind === 'mon') return false; // 아직 불러오는 중 — 다음에 다시 (자리표 그림으로 굳지 않게)
    if (!sp || !sp.px) sp = typeof sprite === 'function' ? sprite(e.t, 0) : null; if (!sp || !sp.px || !cv) return false;
    let c = sbmp.get(sp);
    if (!c) { c = document.createElement('canvas'); c.width = sp.w; c.height = sp.h; const id = new ImageData(new Uint8ClampedArray(sp.px.buffer.slice(0)), sp.w, sp.h); c.getContext('2d').putImageData(id, 0, 0);
      let x0 = sp.w, y0 = sp.h, x1 = -1, y1 = -1; const d = id.data; for (let y = 0; y < sp.h; y++) for (let x = 0; x < sp.w; x++) if (d[(y * sp.w + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      const bw0 = x1 - x0 + 1, bh0 = y1 - y0 + 1; c.box = x1 < 0 ? [0, 0, sp.w, sp.h] : [x0, y0, bw0, bw0 >= bh0 * 0.9 ? bh0 : Math.min(bh0, Math.round(bw0 * cv.height / cv.width))]; sbmp.set(sp, c); } // 몸이 낮은(가로로 넓은) 몬스터 — 쥐 · 늑대 — 는 윗부분만 자르면 귀만 남아 스프라이트 전체를 칸에 맞춘다
    const [bx, by, bw, bh] = c.box, k = Math.min(cv.width / bw, cv.height / bh), x = cv.getContext('2d');
    x.imageSmoothingEnabled = false; x.clearRect(0, 0, cv.width, cv.height); x.drawImage(c, bx, by, bw, bh, Math.round((cv.width - bw * k) / 2), Math.round(cv.height - bh * k), Math.round(bw * k), Math.round(bh * k)); return true;
  }
  // 쿼터뷰 좌표 → 무대(#stage) 안 화면 좌표 [x, y]
  function toStage(x, y, z = 0) {
    const rc = canvas.getBoundingClientRect(), sb = $('stage').getBoundingClientRect(), a = project(wx(x), wy(y), z);
    return [rc.left - sb.left + a.sx / W * rc.width, rc.top - sb.top + a.sy / H * rc.height];
  }
  // 누른 화면 좌표(clientX, clientY) → 바닥 타일 좌표 [x, y]
  function tileAt(clientX, clientY) {
    const rc = canvas.getBoundingClientRect(), sx = (clientX - rc.left) / rc.width * canvas.width, sy = (clientY - rc.top) / rc.height * canvas.height;
    const g = unproject(sx, sy); return [g.x / T + win.cx, g.y / T + win.cy];
  }
  // 바닥 위 원(중심 x, y · 반지름 r타일)을 쿼터뷰로 꺾은 SVG 경로 (무대 좌표)
  function ring(x, y, r, n = 28) { let d = ''; for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2, [X, Y] = toStage(x + Math.cos(a) * r, y + Math.sin(a) * r); d += `${i ? 'L' : 'M'}${X.toFixed(1)},${Y.toFixed(1)}`; } return d + 'Z'; }
  // 무대 위에 깔리는 SVG 한 장 (없으면 만든다)
  function svg(id, z = 2) { let el = $(id); if (!el) { el = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); el.id = id; el.classList.add('stagesvg'); el.style.zIndex = z; $('stage').append(el); } return el; }
  // 진행 글: 그 기록(log: [{ t }])에 새로 쌓인 줄만 화면 위 dm 줄에 잠깐
  const seen = new WeakMap();
  function say(log) {
    const from = seen.get(log) || 0, lines = log.slice(from); seen.set(log, log.length); if (!lines.length) return;
    const dm = $('dm'); if (!dm) return;
    dm.innerHTML = lines.slice(-2).map(l => `<div>${esc(l.t)}</div>`).join(''); dm.classList.remove('hidden'); // 새 줄 중 마지막 둘만, 한 줄씩 (화면을 덜 가리게)
    clearTimeout(say.t); say.t = setTimeout(() => dm.classList.add('hidden'), 2600 + Math.min(2, lines.length) * 600);
  }
  // 픽셀 아이콘 (app.css의 .px-*): px('star') · 데이터의 그림 글자(이모지)는 ic()가 같은 벌의 아이콘으로 바꾼다 (모르는 것은 보석)
  const px = n => `<i class="px px-${n}"></i>`;
  const IC = { '🦺': 'armor', '🥋': 'armor', '🛡': 'shield', '🗡': 'sword', '⚔': 'sword', '🔱': 'sword', '💍': 'ring', '🪄': 'wand', '🥢': 'wand', '🧥': 'cloak', '🥻': 'cloak', '🧤': 'glove', '⛓': 'glove', '🔨': 'hammer', '📿': 'amulet', '🎗': 'amulet', '👑': 'crown', '🏹': 'bow', '👢': 'boots', '🥾': 'boots', '🪓': 'axe', '🔮': 'orb', '🧿': 'orb', '💀': 'skull', '☠': 'skull', '★': 'star', '✦': 'spark' };
  const ic = e => (e ? px(IC[[...e][0]] || 'gem') : '');
  // 기술 칸 (G.Builds.view): 선술집 상태창 · 캐릭터 시트가 같이 쓴다. 칸 6개(필수 · 자유 · 잠김) + 종족 칸
  // edit = 자유 칸 · 종족 칸을 눌러 바꿀 수 있다 (전투 밖) — bindBuild가 누름을 받는다
  function build(v, H = 'h4', edit = false) {
    if (!v) return '';
    const body = (o, kd) => `<b>${esc(o.n)}</b><small>${kd} · ${esc(o.tag)}${o.left != null ? ` · 남은 ${o.left}` : ''}</small><span>${esc(o.d)}</span>`;
    const li = c => {
      if (c.will && (c.locked || !c.s)) return `<li class="bd-lock bd-will"><b>${esc(c.will.n)}</b><small>${c.core ? '필수' : '자유'} · ${c.will.lv}레벨에 열림</small><span>${esc(c.will.d)}</span></li>`; // 나중에 들어올 기술 (흐리게)
      if (c.locked) return `<li class="bd-lock"><b>${c.core ? esc(c.coreN) : '자유'}</b><small>${c.core ? `필수 · ${c.coreLv}` : c.open}레벨</small></li>`;
      const ed = edit && !c.core ? ` class="ed${c.s ? '' : ' bd-empty'}" data-slot="${c.i}"` : c.s ? '' : ' class="bd-empty"';
      return `<li${ed}>${c.s ? body(c.s, c.core ? '필수' : '자유') : `<b>${c.core ? esc(c.coreN) : '빈 칸'}</b><small>${c.core ? `필수 · ${c.coreLv}레벨` : '자유'}</small>`}</li>`;
    };
    // 종족 (기술 칸 밖, 2026-11-22): 늘 켜진 특징 한 줄 + 종족 기술 하나(있으면)
    const rc = v.spOne || v.race ? `<${H}>종족 <small>${esc(v.sp || '')}</small></${H}><ul class="bd-now bd-race">${v.spOne ? `<li><b>${esc(v.spOne[1])}</b></li>` : ''}${v.race ? `<li>${body(v.race, '종족 기술')}</li>` : ''}</ul>` : '';
    return `<${H}>기술 <small>${esc(v.n)}</small>${edit && v.custom ? ' <button class="bd-reset">추천대로</button>' : ''}</${H}><ul class="bd-now">${v.slots.map(li).join('')}</ul>${edit ? '<ul class="bd-pick" hidden></ul>' : ''}${rc}`;
  }
  // 칸 고치기 (m = 사람 또는 사람을 돌려주는 함수): 자유 칸 · 종족 칸을 누르면 그 아래에 후보 · 고르면 그 칸에 · 다 되면 redraw()
  function bindBuild(root, m, redraw) {
    root.addEventListener('click', ev => {
      const r = ev.target.closest('.bd-reset'), slot = ev.target.closest('.bd-now li.ed'), pk = ev.target.closest('.bd-pick li');
      if (!r && !slot && !pk) return; ev.stopPropagation(); const M = typeof m === 'function' ? m() : m; if (!M) return;
      if (r) { G.Builds.resetSlots(M); redraw(); return; }
      const pick = root.querySelector('.bd-pick'); if (!pick) return;
      if (slot) { const i = slot.dataset.slot, v = G.Builds.view(M), isR = i === 'race', cur = isR ? null : v.slots[+i].s;
        if (pick.dataset.i === i && !pick.hidden) { pick.hidden = true; return; }
        root.querySelectorAll('.bd-now li.on').forEach(q => q.classList.remove('on')); slot.classList.add('on');
        const L = isR ? v.raceOpts.filter(o => o.k !== v.race?.k) : v.pool(+i);
        pick.dataset.i = i; pick.hidden = false;
        pick.innerHTML = L.map(o => `<li data-k="${esc(o.k)}"><b>${esc(o.n)}</b><small>${esc(o.tag)}</small><span>${esc(o.d)}</span></li>`).join('') + (cur ? '<li data-k=""><b>비우기</b></li>' : '') || '<li class="none"><small>넣을 기술이 없다</small></li>';
        return; }
      if (pk.classList.contains('none')) return;
      if (pick.dataset.i === 'race') G.Builds.setRace(M, pk.dataset.k); else G.Builds.setSlot(M, +pick.dataset.i, pk.dataset.k || null);
      redraw();
    });
  }
  return { $, esc, place, toStage, tileAt, ring, svg, say, face, spriteFace, px, ic, build, bindBuild };
})();
