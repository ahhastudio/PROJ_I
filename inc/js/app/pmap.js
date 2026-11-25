'use strict';
// 양피지 미니맵 (화면 쪽): 지도 시제품의 그리기(RUN.draw)로 탐사 상태를 그린다. 작게 볼 때는 지금 방 둘레, 누르거나 M으로 층 전체.
const PMAP = (() => {
  const { $ } = UI;
  let st = null;
  function draw() {
    const svg = $('pmap'), box = $('pmapbox'); if (!svg || !st) return;
    if (PMAP.render) return PMAP.render(box, st, !!box?.classList.contains('big')); // 원정 모드: 픽셀 지도 (기존 게임은 아래 SVG)
    RUN.draw.render(svg, PMAP.view ? PMAP.view(st) : st); // view: 원정 모드가 지도 기억을 합친 사본을 준다 (기존 게임은 없음)
    svg.dataset.full = svg.getAttribute('viewBox');
    if (box && !box.classList.contains('big')) zoom(svg); else if (box && PMAP.bigBox) svg.setAttribute('viewBox', PMAP.bigBox(svg, st)); // bigBox: 원정 모드가 아는 곳에 맞춘 틀
  }
  function zoom(svg) {
    const [, , FW, FH] = svg.dataset.full.split(' ').map(Number), w = Math.min(FW, 26 * 13), h = Math.min(FH, w * 0.78);
    const b = st.map._lay.room[st.at], cx = 6 + (b.x + b.w / 2) * 13, cy = 6 + (b.y + b.h / 2) * 13;
    const x = Math.max(0, Math.min(FW - w, cx - w / 2)), y = Math.max(0, Math.min(FH - h, cy - h / 2));
    svg.setAttribute('viewBox', `${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`);
  }
  function toggle(ev) {
    if (ev) ev.stopPropagation(); const box = $('pmapbox'), svg = $('pmap'); if (!box) return;
    box.classList.toggle('big'); if (PMAP.render) return draw(); if (box.classList.contains('big')) svg.setAttribute('viewBox', PMAP.bigBox ? PMAP.bigBox(svg, st) : svg.dataset.full); else zoom(svg);
  }
  return {
    attach(s) { const first = !st; st = s; const box = $('pmapbox'); if (box) box.onclick = toggle; if (first) addEventListener('keydown', e => { if (e.key === 'm' || e.key === 'M') toggle(); }); draw(); }, // 층을 내려가면 다시 부른다
    draw, view: null, bigBox: null, render: null,
    hide() { const box = $('pmapbox'); if (box) box.style.display = 'none'; },
  };
})();
