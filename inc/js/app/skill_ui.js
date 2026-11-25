'use strict';
// 스킬 보이기 (2026-11-26, 원정): 아이콘 · 쓴 순간의 머리 위 판(아이콘 · 이름 · 효과 수치) · 쿨타임 덮개. 규칙은 보지 않는다 — 부르는 쪽(dive_ui.js)이 알려 준다.
// 아이콘은 DCSS 주문 그림(assets/dcss/s_*.png — CC0)을 이름의 낱말로 고른다.
const SKUI = (() => {
  const { $, esc } = UI;
  const BY = [ // [id 또는 이름의 낱말, 그림] — 앞이 먼저
    [/치유|회복|상처 치료|숨 고르기|소생|하급 회복/, 'elyvilon_heal_other'], [/축복|은총|영감|영웅심|원조|희망/, 'tso_bless_weapon'], [/신성|빛나는|수호령|선악|태양|빛의|물리치기/, 'dispel_undead'],
    [/분노|광란/, 'berserker_rage'], [/함성|위협/, 'cause_fear'], [/연속 행동|가속/, 'haste'], [/감속|다리 베기/, 'slow'],
    [/회전|휩쓸|칼날 장벽/, 'song_of_slaying'], [/넘어뜨/, 'unarmed_combat'], [/밀쳐|돌풍/, 'force_lance'], [/약화|분쇄/, 'maces_flails'], [/견제|연속 베기|쌍수/, 'short_blades'], [/스치|대형 무기|강타$/, 'long_blades'],
    [/약점|암습|찌르/, 'stabbing'], [/표적|조준|궁술|덩굴 화살/, 'bows'], [/그림자|안개 걸음|장막|투명/, 'controlled_blink'],
    [/화염구/, 'fireball'], [/화염살|작열/, 'throw_flame'], [/불|화염|유성|용의 숨결/, 'fire_storm'], [/서리|냉기/, 'bolt_of_cold'], [/얼음|얼어|진눈깨비/, 'ice_storm'],
    [/연쇄 번개/, 'chain_lightning'], [/번개|전격/, 'lightning_bolt'], [/천둥|산산/, 'shatter'], [/독|전염/, 'poison_magic'], [/원소|색채/, 'fulminant_prism'],
    [/저주|낙인|파멸|사안/, 'hexes'], [/공포|환영/, 'cause_fear'], [/속박|포박|기절|마비/, 'petrify'], [/최면|혼란|웃음|조롱|암시|명령/, 'mass_confusion'], [/정신/, 'pain'], [/실명|어둠|악마/, 'darkness'],
    [/암흑 광선|폭발|마력/, 'iskenderuns_mystic_blast'], [/해악|상처 입/, 'agony'], [/소환|숲의|동물/, 'summonings'], [/얽힘|가시|식물|나무/, 'summon_forest'], [/바람/, 'air_magic'],
    [/방패|수호|방어|방지|보호/, 'shields'], [/영적 무기|마법 무기/, 'spectral_weapon'], [/추방|차원/, 'passage_of_golubria'], [/염동/, 'gravitas'], [/주문|가속|쌍둥이/, 'spellcasting'], [/연타|권|기공|주먹/, 'unarmed_combat']];
  const nameOf = k => G.D.MSKILLS[k]?.n || k;
  const icon = k => { const n = nameOf(k); for (const [re, g] of BY) if (re.test(n)) return `assets/dcss/s_${g}.png`; return 'assets/dcss/s_fighting.png'; };
  const img = k => `<img src="${icon(k)}" alt="">`;
  // 쓴 순간: e의 머리 위 판 { k: 스킬 · 또는 n: 이름만, fx: 효과 수치 }
  const live = new Map();
  function cast(e, k, fx, foe) {
    const t = performance.now(), L = live.get(e); if (L && L.k === k && t - L.t < 900) return; L?.el.remove();
    const el = document.createElement('div'); el.className = 'sk-cast' + (foe ? ' foe' : ''); el.innerHTML = `${img(k)}<div><b>${esc(nameOf(k))}</b>${fx ? `<small>${esc(fx)}</small>` : ''}</div>`; $('floats').append(el); live.set(e, { el, k, t });
  }
  function tick() { const t = performance.now(); for (const [e, L] of live) { if (t - L.t > 1500 || e.dead) { L.el.remove(); live.delete(e); continue; } UI.place(L.el, e._dx ?? e.x, e._dy ?? e.y, 2.3); L.r = null; } const on = [];
    for (const L of [...live.values()].sort((a, b) => b.t - a.t)) { const m = /translate\(([-\d.]+)px, ?([-\d.]+)px\)/.exec(L.el.style.transform); if (!m) continue; let x = +m[1], y = +m[2]; const w = L.el.offsetWidth, h = L.el.offsetHeight + 2; for (let n = 0; n < 4 && on.some(o => Math.abs(o.x - x) < (o.w + w) / 2 && Math.abs(o.y - y) < h); n++) y -= h; on.push({ x, y, w }); L.el.style.transform = `translate(${x}px, ${y}px) translate(-50%,-100%)`; } } // 서로 겹치면 위로 쌓는다
  function clear() { for (const L of live.values()) L.el.remove(); live.clear(); }
  return { icon, img, cast, tick, clear };
})();
