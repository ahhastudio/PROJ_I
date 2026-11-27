'use strict';
// 손맛 연결점: 세계 로직은 G.J.*를 부르기만 한다. 실제 연출(화면 흔들림 · 히트스톱 · 피격 이펙트 · 휘두름)은 화면 쪽 js/app/boot.js가 갈아 끼운다.
// 화면이 없으면(시험 · Node) 아무 일도 하지 않는다.
// 2026-11-23: 옛 화면의 히트스톱 · 슬로모션 · 확대 · 번쩍임은 「지금 보는 세계」를 G.UI.cur로 확인했는데, 새 화면에는 G.UI가 없어 늘 꺼져 있었다 — 걷어 냈다.
//   효과음(G.SFX — js/core/sfx)은 아직 불러오지 않는다 (sfx는 불러오면 그대로 난다).
G.OPT = { sfx: true, vol: 0.6, shake: true };
try { Object.assign(G.OPT, JSON.parse(localStorage.getItem('rift_inc_opt') || '{}')); } catch (e) { /* 저장소를 못 쓰면 기본값 */ }
G.saveOpt = () => { try { localStorage.setItem('rift_inc_opt', JSON.stringify(G.OPT)); } catch (e) { /* 무시 */ } };

const nop = () => {};
G.J = {
  hit: nop, // (id, 맞은 대상, 세기 0~1, 때린 쪽, 피해, 피해 종류)
  lunge: nop, // (id, 공격하는 쪽, 대상)
  shake: nop, // (id, 세기 px, 방향 x, 방향 y, 길이 초)
  finish: nop, // (id, x, y): 우두머리 처치
  sfx(id, name, o) { if (!G.quiet && G.SFX) G.SFX.play(name, o); },
  dt: (id, dt) => dt, // 세계별 시간 조정 자리 (legacy/state.js가 부른다 — 히트스톱은 화면 쪽 JU.freeze가 맡는다)
};
