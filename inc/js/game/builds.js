'use strict';
// 빌드 (화면 없이, 2026-11-21 개편): 손에 드는 것은 언제나 기술 6칸 + 종족 칸 1.
// - 칸 6개는 정해진 레벨에 열린다 (SLOT_LV: 1 · 1 · 3 · 5 · 9 · 13 — 하위 직업 · 3레벨 주문 · 5레벨 주문 · 7레벨 주문 시점).
// - 빌드는 앞 칸들에 필수 기술(core)을 둔다. 칸이 열리고 그 기술의 SRD 레벨이 되면 무조건 생긴다 — 빼거나 바꿀 수 없다 (클레릭 = 치유 · 소생 같은 컨셉이 늘 유지된다).
// - 필수가 없는 칸은 자유 칸: 열리면 레벨업 카드 셋 중 하나 (그 직업의 기술 · 하위 직업이 늘 준비해 주는 주문). 전투 밖에서 바꿀 수 있다 (SRD: 긴 휴식에 준비 주문 바꾸기).
//   고르지 않았으면 빌드의 추천(sug) 순서대로 들어간다.
// - 주문끼리 교체하지 않는다: 주문은 SRD 슬롯표 · 상위 시전대로 레벨에 맞게 강해진다 (G.Res). 상위 주문(유성 폭풍 …)은 자유 칸으로.
// - 종족 칸: 숨결 · 비행 · 아드레날린 · 거대화 · 혈통 주문 중 하나 (둘 이상이면 고른다).
// - 늘 적용되는 기능(추가 공격 · 오라 · 암습)과 기본 공격(무기 · 대표 소마법)은 칸 밖.
// - 다중 직업 빌드는 mc: { cls, from, n } — 캐릭터 레벨 from부터 그 직업을 n레벨 찍는다 (선행 조건은 G.MC가 본다).
G.Builds = (() => {
  const GD = () => G.Guild, D = G.D, SLOT_N = 6, SLOT_LV = [1, 1, 3, 5, 9, 13];
  // 카드 모드 (원정 — js/game/dive.js가 켠다, 2026-11-23): 칸 여섯은 처음부터 열려 있고 든 것은 m.picks (고른 차례). 꺼져 있으면 예전 그대로
  const CARD = { on: false };
  const W_BASIC = 6, W_VAR = 3, W_MC = 1;
  // core = 칸 1~에 차례로 드는 필수 기술 · sug = 자유 칸 추천 순서 (고르지 않았을 때)
  const LIST = [
    // 파이터 (챔피언): 고르는 기능이 둘뿐 — 나머지(추가 공격 · 불굴 · 향상된 치명타)는 늘 적용. 변형은 전투 방식
    { id: 'fighter', cls: 'dragoon', n: '대형 무기 파이터', w: W_BASIC, core: ['sr_second', null, 'sr_surge'], sug: ['sr_cleave', 'sr_topple', 'wm_graze', 'sr_push', 'sr_sap', 'wm_vex', 'wm_slow'], opts: { fs: ['fs_gwf'] } },
    { id: 'fighter_shield', cls: 'dragoon', n: '방패 파이터', w: W_VAR, core: ['sr_second', null, 'sr_surge'], sug: ['sr_push', 'sr_topple', 'sr_sap', 'wm_vex', 'wm_slow', 'sr_cleave'], opts: { fs: ['fs_defense'] } },
    { id: 'fighter_twin', cls: 'dragoon', n: '쌍수 파이터', w: W_VAR, core: ['sr_second', 'wm_nick', 'sr_surge'], sug: ['wm_vex', 'sr_sap', 'wm_slow', 'sr_cleave', 'sr_push', 'wm_graze'], opts: { fs: ['fs_twf'] } },
    { id: 'barbarian', cls: 'barbarian', n: '바바리안', w: W_BASIC, core: ['sr_rage', null, 'sr_reckless', null, 'sr_brutal', 'sr_intim'], sug: ['sr_cleave', 'sr_topple', 'sr_push', 'wm_vex', 'wm_graze', 'sr_sap', 'wm_slow'] },
    { id: 'rogue', cls: 'rogue', n: '로그', w: W_BASIC, core: [null, 'sr_cunning', 'sr_steady', 'sr_cstrike', null, 'sr_devious'], sug: ['wm_vex', 'wm_nick', 'sr_sap', 'wm_graze', 'wm_slow', 'sr_topple'] },
    { id: 'monk', cls: 'monk', n: '몽크', w: W_BASIC, core: [null, 'sr_flurry', 'sr_patient', 'sr_stun', 'sr_whole', null], sug: ['sr_push', 'wm_vex', 'sr_topple', 'sr_wind', 'sr_quiver'] },
    // 팔라딘 (헌신의 맹세)
    { id: 'paladin', cls: 'paladin', n: '강타 팔라딘', w: W_BASIC, core: ['sr_smite', 'sr_lay'], sug: ['sp_divine_favor', 'sr_cleave', 'sr_searing', 'sp_shining_smite', 'sp_magic_weapon', 'sr_topple'], opts: { fs: ['fs_gwf'] } },
    { id: 'paladin_shield', cls: 'paladin', n: '수호 팔라딘', w: W_VAR, core: ['sr_lay', 'sr_sof'], sug: ['sr_bless', 'sr_cure', 'sp_warding_bond', 'sr_revive', 'sp_death_ward', 'sp_aura_of_life'], opts: { fs: ['fs_defense'] } },
    { id: 'paladin_judge', cls: 'paladin', n: '심판 팔라딘', w: W_VAR, core: ['sr_smite', 'sr_lay'], sug: ['sp_command', 'wm_vex', 'sr_push', 'ft_abjure', 'sp_banishment', 'sp_dispel_evil_and_good'], opts: { fs: ['fs_gwf'] } },
    // 레인저 (헌터)
    { id: 'ranger', cls: 'archer', n: '사냥꾼 레인저', w: W_BASIC, core: ['sr_hmark'], sug: ['sr_ensnare', 'wm_vex', 'wm_slow', 'sp_magic_weapon', 'wm_graze', 'ft_veil'], opts: { fs: ['fs_archery'] } },
    { id: 'ranger_trap', cls: 'archer', n: '덫꾼 레인저', w: W_VAR, core: ['sr_hmark'], sug: ['sr_entangle', 'sp_fog_cloud', 'sr_spike', 'sp_gust_of_wind', 'sp_plant_growth', 'sp_wind_wall'], opts: { fs: ['fs_archery'] } },
    { id: 'ranger_beast', cls: 'archer', n: '야수 레인저', w: W_VAR, core: ['sr_hmark'], sug: ['sr_cure', 'sr_ensnare', 'sp_barkskin', 'sp_conjure_animals', 'sp_conjure_woodland_beings', 'sp_dominate_beast'], opts: { fs: ['fs_archery'] } },
    { id: 'ranger_twin', cls: 'archer', n: '쌍수 레인저', w: W_VAR, core: ['sr_hmark'], sug: ['wm_vex', 'wm_slow', 'sr_sap', 'sp_barkskin', 'sr_push', 'ft_veil'], opts: { fs: ['fs_twf'] } },
    // 클레릭 (생명 권역): 기본 공격은 신성한 불꽃
    { id: 'cleric', cls: 'cleric', n: '생명 클레릭', w: W_BASIC, core: ['sr_hword'], sug: ['sr_bless', 'sr_preserve', 'sr_mhw', 'sr_revive', 'sp_mass_cure_wounds', 'sp_heal', 'sp_mass_heal'] },
    { id: 'cleric_war', cls: 'cleric', n: '빛 클레릭', w: W_VAR, core: ['sr_gbolt'], sug: ['sr_sflame', 'sr_sweapon', 'sr_guard', 'sp_flame_strike', 'sp_sunbeam', 'sp_guardian_of_faith', 'sp_sunburst'] },
    { id: 'cleric_guard', cls: 'cleric', n: '수호 클레릭', w: W_VAR, core: ['sr_bless'], sug: ['sr_sof', 'sp_warding_bond', 'sr_guard', 'sp_death_ward', 'sp_blade_barrier', 'sp_holy_aura'] },
    { id: 'cleric_death', cls: 'cleric', n: '죽음 클레릭', w: W_VAR, core: ['sp_inflict_wounds'], sug: ['sp_bane', 'sp_blindness_deafness', 'sp_bestow_curse', 'sp_contagion', 'sp_harm', 'sp_banishment'] },
    // 드루이드 (대지의 회합): 기본 공격은 불꽃 생성
    { id: 'druid', cls: 'scout', n: '폭풍 드루이드', w: W_BASIC, core: ['sr_tw'], sug: ['sp_ice_knife', 'sr_moon', 'sr_call', 'sp_sleet_storm', 'sr_ice', 'sr_cone', 'sp_storm_of_vengeance'] },
    { id: 'druid_fire', cls: 'scout', n: '화염 드루이드', w: W_VAR, core: ['sr_pflame'], sug: ['sr_faerie', 'sp_flaming_sphere', 'sp_heat_metal', 'sp_wall_of_fire', 'sp_fire_storm', 'sp_incendiary_cloud'] },
    { id: 'druid_earth', cls: 'scout', n: '대지 드루이드', w: W_VAR, core: ['sr_entangle'], sug: ['sp_fog_cloud', 'sr_spike', 'sp_plant_growth', 'sp_wall_of_stone', 'sp_wall_of_thorns', 'sp_reverse_gravity'] },
    { id: 'druid_beast', cls: 'scout', n: '야수 드루이드', w: W_VAR, core: ['sr_pflame', 'sr_wild'], sug: ['sp_barkskin', 'sp_conjure_animals', 'sp_giant_insect', 'sp_conjure_woodland_beings', 'sp_conjure_elemental', 'sp_conjure_fey'] },
    { id: 'druid_heal', cls: 'scout', n: '재생 드루이드', w: W_VAR, core: ['sr_hword'], sug: ['sr_cure', 'sp_aid', 'sp_protection_from_energy', 'sp_stoneskin', 'sp_antilife_shell', 'sp_regenerate'] },
    // 바드 (전승 학파): 기본 공격은 잔인한 조롱
    { id: 'bard', cls: 'bard', n: '응원 바드', w: W_BASIC, core: ['sr_insp'], sug: ['sp_heroism', 'sp_aid', 'sr_slow', 'sp_greater_invisibility', 'sr_haste', 'sp_beacon_of_hope'] },
    { id: 'bard_sound', cls: 'bard', n: '음파 바드', w: W_VAR, core: ['sr_mock'], sug: ['sr_tw', 'sr_shatter', 'sp_phantasmal_force', 'sr_fear', 'sp_phantasmal_killer', 'sp_mind_spike'] },
    { id: 'bard_heal', cls: 'bard', n: '치유 바드', w: W_VAR, core: ['sr_hword'], sug: ['sr_cure', 'sp_lesser_restoration', 'sr_mhw', 'sp_mass_cure_wounds', 'sp_greater_restoration'] },
    { id: 'bard_control', cls: 'bard', n: '매혹 바드', w: W_VAR, core: ['sr_insp'], sug: ['sp_hideous_laughter', 'sr_hold', 'sr_hypno', 'sp_confusion', 'sp_hold_monster', 'sp_power_word_stun'] },
    // 소서러 (용의 혈통): 기본 공격은 화염살
    { id: 'sorcerer', cls: 'mage', n: '화염 소서러', w: W_BASIC, core: ['sr_firebolt'], sug: ['sr_chroma', 'sp_dragons_breath', 'sr_fireball', 'sp_wall_of_fire', 'sp_fire_storm', 'sr_meteor'], opts: { mm: ['sr_quicken', 'mm_empower', 'sr_twin'] } },
    { id: 'sorcerer_storm', cls: 'mage', n: '번개 소서러', w: W_VAR, core: ['sp_shocking_grasp'], sug: ['sr_tw', 'sr_shatter', 'sr_lbolt', 'sr_haste', 'sr_chain'], opts: { mm: ['sr_twin', 'sr_quicken', 'mm_empower'] } },
    { id: 'sorcerer_frost', cls: 'mage', n: '냉기 소서러', w: W_VAR, core: ['sr_rof'], sug: ['sp_ice_knife', 'sr_misty', 'sp_sleet_storm', 'sr_ice', 'sr_cone', 'sp_freezing_sphere'], opts: { mm: ['sr_twin', 'sr_quicken', 'mm_empower'] } },
    { id: 'sorcerer_mind', cls: 'mage', n: '정신 소서러', w: W_VAR, core: ['sp_sorcerous_burst'], sug: ['sp_color_spray', 'sp_mind_spike', 'sr_hypno', 'sp_confusion', 'sp_telekinesis', 'sp_mass_suggestion'], opts: { mm: ['sr_twin', 'sr_quicken', 'mm_empower'] } },
    // 워락 (악마 후원자): 기본 공격은 섬뜩한 폭발
    { id: 'warlock', cls: 'warlock', n: '공포 워락', w: W_BASIC, core: ['sr_eb'], sug: ['sr_hex', 'sr_dark', 'sr_fear', 'sp_banishment', 'sp_hold_monster', 'sp_eyebite'], opts: { iv: ['sr_agon', 'iv_repel', 'iv_dsight', 'iv_spear', 'iv_mind'] } },
    { id: 'warlock_death', cls: 'warlock', n: '사령 워락', w: W_VAR, core: ['sp_chill_touch'], sug: ['sr_hex', 'sp_ray_of_enfeeblement', 'sr_vtouch', 'sp_blight', 'sp_circle_of_death', 'sp_finger_of_death'], opts: { iv: ['sr_agon', 'iv_repel', 'iv_dsight', 'iv_spear', 'iv_mind'] } },
    { id: 'warlock_charm', cls: 'warlock', n: '매혹 워락', w: W_VAR, core: ['sr_eb'], sug: ['sp_hideous_laughter', 'sp_enthrall', 'sr_hypno', 'sp_charm_monster', 'sp_hold_monster', 'sp_eyebite'], opts: { iv: ['sr_agon', 'iv_repel', 'iv_dsight', 'iv_spear', 'iv_mind'] } },
    { id: 'warlock_blade', cls: 'warlock', n: '칼날 워락', w: W_VAR, core: ['sr_hex'], sug: ['sp_bane', 'sr_misty', 'sr_hold', 'sr_vtouch', 'sp_hold_monster', 'sr_fear', 'sp_eyebite'], opts: { iv: ['iv_pblade', 'iv_thirst', 'iv_smite', 'iv_life', 'iv_devour'] } },
    // 위저드 (방출계): 기본 공격은 서리 광선
    { id: 'wizard', cls: 'archmage', n: '비전 위저드', w: W_BASIC, core: ['sr_mm'], sug: ['sr_chroma', 'sr_misty', 'sr_fireball', 'sp_faithful_hound', 'sp_arcane_hand', 'sp_disintegrate', 'sp_time_stop'] },
    { id: 'wizard_fire', cls: 'archmage', n: '화염 위저드', w: W_VAR, core: ['sr_firebolt'], sug: ['sp_burning_hands', 'sr_sray', 'sr_fireball', 'sp_wall_of_fire', 'sp_delayed_blast_fireball', 'sr_meteor'] },
    { id: 'wizard_frost', cls: 'archmage', n: '냉기 위저드', w: W_VAR, core: ['sr_rof'], sug: ['sp_ice_knife', 'sr_misty', 'sp_sleet_storm', 'sr_ice', 'sr_cone', 'sp_freezing_sphere'] },
    { id: 'wizard_storm', cls: 'archmage', n: '번개 위저드', w: W_VAR, core: ['sp_shocking_grasp'], sug: ['sr_tw', 'sr_shatter', 'sr_lbolt', 'sp_arcane_hand', 'sr_chain'] },
    { id: 'wizard_death', cls: 'archmage', n: '사령 위저드', w: W_VAR, core: ['sp_chill_touch'], sug: ['sp_ray_of_sickness', 'sp_ray_of_enfeeblement', 'sr_vtouch', 'sp_blight', 'sp_circle_of_death', 'sp_cloudkill', 'sp_finger_of_death'] },
    { id: 'wizard_control', cls: 'archmage', n: '통제 위저드', w: W_VAR, core: ['sr_sleep'], sug: ['sp_grease', 'sr_web', 'sr_slow', 'sp_black_tentacles', 'sp_hold_monster', 'sr_hypno', 'sp_forcecage'] },
    // 다중 직업 (드물게)
    { id: 'sorcadin', cls: 'paladin', n: '소서딘', w: W_MC, mc: { cls: 'mage', from: 7, n: 5 }, core: ['sr_smite', 'sr_lay', 'sr_sacred', 'sr_haste'], sug: ['sr_bless', 'sp_divine_favor', 'sr_fireball'], opts: { fs: ['fs_gwf'], mm: ['sr_quicken', 'sr_twin'] } },
    { id: 'sorlock', cls: 'mage', n: '섬뜩한 폭발 소서러', w: W_MC, mc: { cls: 'warlock', from: 2, n: 2 }, core: ['sr_chroma', 'sr_hex', 'sr_sray', 'sr_fireball'], sug: ['sr_haste', 'sr_misty', 'sr_chain', 'sr_meteor'], opts: { iv: ['sr_agon', 'iv_repel'], mm: ['sr_quicken', 'mm_empower'] } },
    { id: 'hexadin', cls: 'paladin', n: '헥사딘', w: W_MC, mc: { cls: 'warlock', from: 6, n: 3 }, core: ['sr_smite', 'sr_lay', 'sr_sacred', 'sr_hex'], sug: ['sr_bless', 'sp_divine_favor', 'sp_banishment'], opts: { fs: ['fs_gwf'], iv: ['iv_pblade', 'sr_agon'] } },
    { id: 'surgecaster', cls: 'mage', n: '쇄도 주문사', w: W_MC, mc: { cls: 'dragoon', from: 4, n: 2 }, core: ['sr_chroma', 'sr_sray', 'sr_surge', 'sr_fireball'], sug: ['sr_second', 'sr_haste', 'sr_chain', 'sr_meteor'], opts: { mm: ['sr_quicken', 'mm_empower'] } },
  ];
  const byId = id => LIST.find(b => b.id === id) || null, base = m => (G.MC?.base ? G.MC.base(m) : m);
  const ITEMS = new Set(['it_wonder', 'it_sphere']);
  // 그 기술이 어느 직업의 것인가 (계획 안의 직업 중) · 그 직업의 지금 레벨
  const classes = b => [b.cls].concat(b.mc ? [b.mc.cls] : []);
  const subSig = (c, k) => Object.values(D.ADV).some(A => A.base === c && A.sig.includes(k));
  const owns = (c, k) => D.MPOOL[c]?.includes(k) || GD().spellList(c).includes(k) || subSig(c, k);
  const ownerOf = (b, k) => classes(b).find(c => owns(c, k)) || b.cls;
  const lvIn = (m, c) => (G.MC?.on(m) ? G.MC.lvOf(m, c) : m.cls === c ? m.lv : 0);
  const always = m => G.SrdX?.classSkills(m) || []; // 하위 직업 · 재주 · 직업 기능이 늘 준비해 주는 것
  // 지금 쓸 수 있나: 그 직업 레벨이 그 기술의 레벨에 닿았다 (하위 직업 기능은 3레벨부터)
  function ready(m, k) {
    m = base(m); const b = byId(m.build); if (!b) return false; const c = ownerOf(b, k), L = lvIn(m, c);
    if (subSig(c, k) && L < 3) return false;
    return L > 0 && L >= GD().skLv(c, k);
  }
  const usable = (m, k) => ready(m, k) || always(m).includes(k);
  // 캐릭터 없이: 그 빌드의 캐릭터 레벨 L에서 직업마다의 레벨 (다중 직업은 from부터 n레벨을 그 직업으로)
  const clsLvAt = (b, c, L) => { const t = b.mc ? Math.max(0, Math.min(b.mc.n, L - b.mc.from + 1)) : 0; return b.mc && c === b.mc.cls ? t : c === b.cls ? L - t : 0; };
  const readyAt = (b, k, L) => { const c = ownerOf(b, k), cl = clsLvAt(b, c, L); if (subSig(c, k) && cl < 3) return false; return cl > 0 && cl >= GD().skLv(c, k); };
  // 필수 기술이 생기는 캐릭터 레벨 = 칸이 열리는 레벨과 그 기술의 레벨 중 늦은 것
  const coreLv = (b, i) => { const k = b.core[i]; if (!k) return null; const L = [...Array(20).keys()].map(q => q + 1).find(q => readyAt(b, k, q)); return L ? Math.max(SLOT_LV[i], L) : null; };
  // 종족 칸 후보: 종족이 주는 고르는 기술 (숨결 · 비행 · 아드레날린 · 거대화 · 혈통 주문)
  const raceOpts = m => { const k = G.SrdX?.race(m); return k && G.Skill.SK[k]?.run ? [k] : []; }; // 종족 기술은 하나 (js/srd/srd_species.js race)
  const race = m => raceOpts(base(m))[0] || null;
  // 자유 칸 i에 든 것: 고른 것(m.free[i] — null이면 비움) · 안 골랐으면 추천 순서의 첫 쓸 수 있는 것
  const sugOf = (m, b) => (m.sug?.length ? m.sug : b.sug); // 사람마다의 추천 순서 (assign이 섞는다)
  function freeAt(m, i) {
    const b = byId(m.build); if (!b || b.core[i] || m.lv < SLOT_LV[i]) return null;
    if (m.free && i in m.free) return m.free[i] && usable(m, m.free[i]) ? m.free[i] : null;
    const seen = new Set(); for (let j = 0; j < i; j++) if (!b.core[j]) { const k = freeAt(m, j); if (k) seen.add(k); }
    return sugOf(m, b).find(k => !seen.has(k) && !b.core.includes(k) && ready(m, k)) || null;
  }
  // 자유 칸 후보: 그 직업들의 고르는 기술 + 늘 준비해 주는 것 (필수 · 종족 기술 · 다른 칸에 든 것 빼고)
  function pool(m, i) {
    m = base(m); const b = byId(m.build); if (!b) return []; const K = D.MSKILLS, used = new Set(b.core), ro = new Set(raceOpts(m));
    SLOT_LV.forEach((_, j) => { if (j !== i && !b.core[j]) { const k = freeAt(m, j); if (k) used.add(k); } });
    const cand = [...new Set(classes(b).flatMap(c => GD().pickable(c)).concat(always(m)))];
    return cand.filter(k => !used.has(k) && !ro.has(k) && !ITEMS.has(k) && GD().isPick(k) && G.Skill.SK[k] && !K[k]?.noAuto && usable(m, k));
  }
  // 칸 6개 (자리 그대로 — 아직 안 열렸거나 빈 칸은 null)
  function slots(m) {
    m = base(m); const b = byId(m.build); if (!b) return [];
    if (b.line && m.star) return G.Lines.LINE_LV.map((_, i) => (i > m.star ? null : i <= (m.star0 ?? m.star) ? b.core[i] || null : m.inh?.[i] || null)); // 계열 빌드 + 성급 (영웅 모델, 2026-11-27): 칸 별 + 1개 — 태어난 성급까지는 그 계열 차례, 그 위는 계승으로 받은 스킬 (G.Dive.inherit)
    if (b.line) return G.Lines.LINE_LV.map((lv, i) => (m.lv >= lv ? b.core[i] || null : null)); // 성급이 없는 사람(시험 · 옛 경로): 레벨이 연다
    if (CARD.on && m.picks) return SLOT_LV.map((_, i) => (m.picks[i] && ready(m, m.picks[i]) ? m.picks[i] : null)); // 카드 모드: 고른 것
    return SLOT_LV.map((lv, i) => (m.lv < lv ? null : b.core[i] ? (ready(m, b.core[i]) ? b.core[i] : null) : freeAt(m, i)));
  }
  // 손에 든 것: 칸 6개 + 종족 칸
  // 카드 모드의 기본 공격: 빌드 필수 중 소마법(언제나 쓰는 공격 — 화염살 · 암흑 광선 …)은 칸에 두지 않고 칸 밖에서 늘 든다 (2026-11-23, 사용자: 「기본공격은 스킬칸 위치에 두지 마」)
  const basicOf = m => (CARD.on ? (byId(base(m).build)?.core || []).filter(k => k && GD().spLv(k) === 0 && ready(base(m), k)) : []);
  const slotted = m => { m = base(m); if (!byId(m.build)) return []; const r = race(m); return slots(m).filter(Boolean).concat(basicOf(m), r ? [r] : []); };
  // 자유 칸 고치기 (전투 밖): k = 후보 중 하나 · null = 비움. 필수 칸은 못 고친다
  function setSlot(m, i, k) {
    m = base(m); const b = byId(m.build); if (!b || b.core[i] || m.lv < SLOT_LV[i]) return false;
    if (k != null && !pool(m, i).includes(k)) return false;
    m.free = { ...(m.free || {}), [i]: k }; refresh(m); return true;
  }
  function setRace(m, k) { m = base(m); if (!raceOpts(m).includes(k)) return false; m.race = k; refresh(m); return true; }
  function resetSlots(m) { m = base(m); delete m.free; refresh(m); }
  // 손에 든 주문을 엔진의 준비 목록에 (m.skills · 다중 직업은 그 직업 줄). 고르는 기술 걸러내기는 G.Guild.active
  function refresh(m) {
    m = base(m); const b = byId(m.build); if (!b) return m;
    const sp = slots(m).concat(basicOf(m)).filter(k => k && GD().spLv(k) != null && owns(ownerOf(b, k), k));
    m.skills = sp.filter(k => ownerOf(b, k) === b.cls); for (const e of m.mc || []) e.skills = sp.filter(k => ownerOf(b, k) === e.cls);
    m.skManual = true; m.skPri = slotted(m); return m;
  }
  function apply(m, b) {
    m.build = b.id; delete m.free; delete m.sug;
    if (b.opts) { const r = m.opts || G.Opt.roll(m) || {}; m.opts = { ...r }; for (const g of ['fs', 'iv', 'mm']) if (b.opts[g]) m.opts[g] = [...b.opts[g], ...(r[g] || []).filter(k => !b.opts[g].includes(k))]; }
    return refresh(m);
  }
  // 손님에게 빌드 하나 (그 직업의 빌드 중 무게대로)
  function assign(m, rng = Math.random) {
    const L = LIST.filter(b => b.cls === m.cls); if (!L.length) return m;
    let r = rng() * L.reduce((s, b) => s + b.w, 0); const b = L.find(q => (r -= q.w) < 0) || L[0];
    apply(m, b);
    // 같은 빌드라도 사람마다 조합이 다르게 (2026-11-21, 사용자: 「파이터는 달라질 여지가 없네」): 추천 순서를 같은 레벨끼리 섞는다
    const lv = k => GD().skLv(b.cls, k) || 0, sh = b.sug.map(k => [k, rng()]); sh.sort((x, y) => lv(x[0]) - lv(y[0]) || x[1] - y[1]); m.sug = sh.map(x => x[0]);
    return refresh(m);
  }
  // 성장표: 칸마다 열리는 레벨 · 필수면 그 기술과 생기는 레벨
  const timeline = b => { if (typeof b === 'string') b = byId(b); if (!b) return []; return SLOT_LV.map((lv, i) => ({ i, open: lv, core: !!b.core[i], k: b.core[i] || null, n: b.core[i] ? D.MSKILLS[b.core[i]]?.n || b.core[i] : null, lv: b.core[i] ? coreLv(b, i) : lv })); };
  // ── 엔진에 잇기 ──
  // 칸 걸러내기: 빌드를 가진 사람은 고르는 기술(행동 · 추가 행동)을 칸에 든 것만 쓴다. 늘 적용되는 기능 · 고정 기능(전투 방식 · 영창 · 초마법)은 그대로
  { const active0 = GD().active; GD().active = m => { const out = active0(m), b = base(m); if (!byId(b?.build)) return out; const s = new Set(slotted(b)); return out.filter(k => !GD().isPick(k) || s.has(k) || ITEMS.has(k)).concat([...s].filter(k => !out.includes(k) && G.Skill.SK[k]?.run)); }; }
  // 레벨이 올랐다: 다중 직업 빌드는 그 레벨을 계획한 직업으로, 그 뒤 칸을 다시 든다 · 레벨업 카드 (새 필수 기술 알림 · 열린 자유 칸 고르기)
  { const grow0 = GD().grow; GD().grow = function (m) {
    const b = byId(m.build);
    if (b?.mc && G.MC) { if (m.lvSeen == null) m.lvSeen = m.lv - 1; while (m.lvSeen < m.lv) { m.lvSeen++; m.nextCls = m.lvSeen >= b.mc.from && G.MC.lvOf(m, b.mc.cls) < b.mc.n ? b.mc.cls : null; G.MC.levelUp(m); } m.nextCls = null; }
    const out = grow0.call(this, m); if (!b) return out;
    if (G.Reward?.on) { const q = (m.lvq = m.lvq || []);
      b.core.forEach((k, i) => { if (coreLv(b, i) === m.lv) q.push({ k: 'plan', lv: m.lv, slot: i, key: k, core: true }); });
      SLOT_LV.forEach((lv, i) => { if (!b.core[i] && lv === m.lv && pool(m, i).length) q.push({ k: 'plan', lv: m.lv, slot: i, free: true }); }); }
    refresh(m); return out;
  }; }
  // 레벨업 카드: 필수 기술은 그것 하나 (알림) · 자유 칸은 추천 하나 + 후보 중 무작위 둘 (all이면 전부)
  function offer(m, h, rng = Math.random, all = false) {
    m = base(m); const b = byId(m.build); if (!b) return []; const K = D.MSKILLS;
    const card = (k, plan) => ({ kind: 'plan', id: k, plan, n: K[k]?.n || k, d: K[k]?.d || '', lv: GD().spLv(k) || 0 });
    if (h.core) return [card(h.key, true)];
    const f0 = m.free; if (f0 && h.slot in f0) { m.free = { ...f0 }; delete m.free[h.slot]; } // 추천은 그 칸을 안 고른 셈 치고
    const P = pool(m, h.slot), r0 = freeAt(m, h.slot); m.free = f0; if (!P.length) return [];
    const rec = r0 && P.includes(r0) ? r0 : P[0], rest = P.filter(k => k !== rec);
    const alt = all ? rest : (() => { const a = rest.slice(), o = []; while (a.length && o.length < 2) o.push(a.splice(Math.floor(rng() * a.length), 1)[0]); return o; })();
    return [card(rec, true), ...alt.map(k => card(k, false))];
  }
  // 고른 카드: 자유 칸이면 그 칸에
  function choose(m, h, opt) { m = base(m); if (h?.free && opt) setSlot(m, h.slot, opt.id); return refresh(m); }
  // 아직 빈 칸에 나중에 들어올 기술 (2026-11-21, 사용자: 「기술칸에는 일단 기술을 다 채워넣고 비활성화」): 필수 칸은 그 기술 · 자유 칸은 추천 순서대로 그 칸이 열리는 레벨에 쓸 수 있는 것
  function planAt(m, i) {
    const b = byId(m.build); if (!b) return null; if (b.core[i]) return { k: b.core[i], lv: coreLv(b, i) };
    const seen = new Set(); for (let j = 0; j < i; j++) if (!b.core[j]) { const k = freeAt(m, j) || planAt(m, j)?.k; if (k) seen.add(k); }
    const L = Math.max(SLOT_LV[i], m.lv);
    const K = D.MSKILLS, cand = [...new Set(sugOf(m, b).concat(classes(b).flatMap(c => GD().pickable(c))))].filter(x => !seen.has(x) && !b.core.includes(x) && !ITEMS.has(x) && GD().isPick(x) && G.Skill.SK[x] && !K[x]?.noAuto); // 추천이 떨어지면 그 직업의 다른 고르는 기술
    for (let q = L; q <= 20; q++) { const k = cand.find(x => readyAt(b, x, q)); if (k) return { k, lv: q }; }
    return null;
  }
  // 상태창에 쓸 것 (화면 없이): 칸 6개(열리는 레벨 · 필수 / 자유 · 든 것 · 남은 횟수) · 종족 칸
  function view(m) {
    m = base(m); const b = byId(m.build); if (!b) return null; const K = D.MSKILLS, S = slots(m), tag = k => (GD().spLv(k) == null ? '기능' : GD().spLv(k) ? `${GD().spLv(k)}레벨 주문` : '소마법');
    const left = k => { const res = G.Skill.SK[k]?.res; if (!res) return null; const n = G.Res.left(m, res, k); return n >= 99 ? null : n; };
    const one = k => (k ? { k, n: K[k]?.n || k, d: K[k]?.d || '', tag: tag(k) + (G.Skill.SK[k]?.cd ? ` · 쿨 ${G.Skill.SK[k].cd}` : ''), left: left(k) } : null); // 쿨 N = N라운드에 한 번
    const r = race(m);
    return { n: b.n, max: SLOT_N,
      slots: SLOT_LV.map((lv, i) => ({ i, open: lv, locked: !(CARD.on && m.picks) && m.lv < lv, core: !!b.core[i], coreLv: b.core[i] ? coreLv(b, i) : null, coreN: b.core[i] ? K[b.core[i]]?.n || b.core[i] : null, s: one(S[i]), will: S[i] || (CARD.on && m.picks) ? null : (w => (w ? { ...one(w.k), lv: w.lv } : null))(planAt(m, i)) })),
      custom: !!m.free, race: r ? one(r) : null, sp: G.SRD?.SPECIES?.[G.Res.species(m)]?.n || '종족' /* 종족 이름 (티플링 · 엘프 …) */, spOne: G.SrdX?.one(m) || null /* 늘 켜진 종족 특징 한 줄 [이름, 효과] */, raceOpts: raceOpts(m).map(one), pool: i => pool(m, i).map(one) };
  }
  return { CARD, basicOf, sugOf: m => sugOf(base(m), byId(base(m).build)), LIST, SLOT_N, SLOT_LV, byId, assign, apply, refresh, slots, slotted, pool, race, setSlot, setRace, resetSlots, ready, timeline, view, offer, choose, ownerOf: (m, k) => ownerOf(byId(base(m).build), k) };
})();
