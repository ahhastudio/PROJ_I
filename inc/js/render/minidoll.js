'use strict';
// 용병 그림: LAYERLAB 「2D Minimal - Character Maker」 파츠 인형 (js/paperdoll.js, assets/chars/)
// 직업 · 장비(SRD 무기 · 갑옷 · 방패 · 아티팩트) · 종족이 모습을 정하고, 애니메이션은 원본 곡선을 그대로 쓴다.
// 강화(m.gear)는 수치만 바꾸고 모습은 그대로다. 모습이 다른 것은 다른 아이템이다 (같은 무기 종류는 같은 사람에게 늘 같은 그림)
//
// 그리기: 인형은 픽셀 버퍼(pix)에 찍지 않고 화면 위 고해상도 층(#hd)에 원본 그대로 그린다.
//  - 가림: 그 자리의 깊이(zb)가 인형 판보다 앞이면 가린다. 벽(구운 깊이)에 가리면 반투명으로 비친다(XRAY와 같은 뜻)
//  - 인형보다 나중에 픽셀 버퍼에 그린 것(이펙트 · 파편 · 피해 숫자)은 인형 위로 다시 얹는다
//  - 쓰러진 몸은 예전처럼 픽셀 버퍼에 눕혀 찍는다
// 원본 파츠는 유료 에셋: 저장소에 공개로 올리지 않는다 (게임에 넣어 배포하는 것은 된다).
// ?art=dcss 이면 쓰지 않는다 (예전 DCSS 인형). ?ms=0.38 로 크기를 바꾼다.
const MINI_ON = DCSS && q.get('art') !== 'dcss' && !D25 && !!window.PaperDoll, MS = +(q.get('ms') || 0.38);
let MINI_READY = false;
if (MINI_ON) PaperDoll.load('assets/chars/').then(() => { MINI_READY = true; }).catch(e => console.warn('minidoll:', e.message));

const bufPix = () => pix; // MD 안의 pix 함수(인형 한 장)와 이름이 겹친다: 화면 버퍼는 이것으로
const MD = (() => {
  const C = () => PaperDoll.catalog;
  const hs = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const pick = (a, n) => a[(n >>> 0) % a.length];
  const lid = m => m.lid ?? m.uid; // 생김새의 씨앗: 선술집 손님은 받은 번호(lid)를 던전까지 들고 간다 — 선술집에서 본 모습 그대로
  const real = cat => C()[cat].filter(n => !/_Line_|_Down$/.test(n));
  // 직업 모습: 투구(Helmet 번호) · 머리 · 왼손 물건. 무기와 갑옷은 실제 장비에서 온다
  const CLS = {
    dragoon: { helm: 40 }, paladin: { helm: 67 }, barbarian: { helm: 23, beard: 1 }, rogue: { helm: 41 }, archer: { helm: 18 },
    cleric: { helm: 28 }, bard: { helm: 15, sub: 'Book_001_Red' }, mage: { hair: '#d8463a', sub: 'MagicBall_001_Blue', wand: 1 },
    archmage: { helm: 19, beard: 1, sub: 'Book_001_Purple' }, scout: { helm: 14 }, monk: { bald: 1 }, warlock: { helm: 32, sub: 'Skull_001_White', wand: 1 },
  };
  const SKIN = { human: ['#f6c7a5', '#e8b08a', '#c98e66', '#9a6646'], elf: ['#fbe0cc', '#f1d2b8'], dwarf: ['#f0b898', '#d9a07c'], halfling: ['#f6c7a5', '#e2a983'], gnome: ['#f8cfb0', '#efbd9a'], orc: ['#8fbf6a', '#7aa85a'], goliath: ['#b8b4c4', '#a8a2b8'], tiefling: ['#d0605a', '#b84c58'], dragonborn: ['#7aa0c8', '#c8905a', '#6cae78'], aasimar: ['#fff0dc', '#f6e0c8'] };
  const HAIR = ['#3a2a22', '#6a4428', '#c89a4a', '#e8d070', '#b8b0a8', '#8a3a2a', '#2a2a3a'];
  // SRD 무기 → 파츠 종류 · 그 무기로 보일 수 있는 그림들(정렬 번호). 사람마다 그중 하나로 정해진다
  const WPN = {
    dagger: ['Sword', [10, 11, 12]], sickle: ['Sword', [10, 13]], shortsword: ['Sword', [5, 0, 2, 3, 4, 1]], scimitar: ['Sword', [13, 19, 20]], rapier: ['Sword', [11, 12, 21]],
    longsword: ['Sword', [6, 7, 8, 9, 14, 15, 16, 17, 18]], greatsword: ['Sword', [22, 23, 24, 25]],
    handaxe: ['Axe', [0, 1, 2, 3]], battleaxe: ['Axe', [13, 4, 5, 6, 7]], greataxe: ['Axe', [8, 9, 10, 11]], 'war-pick': ['Axe', [2, 3]],
    club: ['Blunt', [0, 2]], greatclub: ['Blunt', [0, 2, 8]], mace: ['Blunt', [1, 3, 4, 5]], morningstar: ['Blunt', [6, 7]], flail: ['Blunt', [6, 7]], 'light-hammer': ['Blunt', [3, 4]], warhammer: ['Blunt', [8, 9, 10]], maul: ['Blunt', [10, 11, 12]], whip: ['Blunt', [0]],
    spear: ['Spear', [0, 1, 2, 3, 5]], javelin: ['Spear', [0, 2]], pike: ['Spear', [6, 7, 8]], lance: ['Spear', [9, 10]], trident: ['Spear', [11, 12]], glaive: ['Spear', [13, 14]], halberd: ['Spear', [15, 16]],
    quarterstaff: ['Staff', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]], shortbow: ['Bow', [2, 3, 4, 5, 6]], longbow: ['Bow', [7, 8, 9, 10]],
    'light-crossbow': ['Crossbow', [0, 1, 2, 3]], 'heavy-crossbow': ['Crossbow', [4, 5, 6, 7]], 'hand-crossbow': ['Crossbow', [0, 1]], musket: ['Crossbow', [6, 7, 8]], pistol: ['Crossbow', [0, 1]],
  };
  // 아티팩트 무기: 종류마다 화려한 끝쪽 그림 (아티팩트마다 하나로 정해진다)
  const WPN_MAGIC = { Sword: [26, 27, 28, 29, 30, 31], Axe: [9, 10, 11, 12], Blunt: [9, 10, 11, 12], Spear: [12, 13, 14, 15, 16], Staff: [12, 13, 14, 15, 16, 17], Wand: [5, 6, 7, 8, 9], Bow: [11, 12, 13, 14], Crossbow: [8, 9, 10] };
  // 갑옷 분류 → Chest 번호 (그림을 보고 나눴다)
  const CHEST = { cloth: [0, 1, 2, 3, 4], robe: [8, 9, 10, 20, 21, 22, 23], light: [5, 6, 7, 13, 14, 15, 16, 17, 18, 19, 38, 39, 40, 41, 42], medium: [24, 25, 26, 35, 36, 37], heavy: [27, 28, 29, 30, 43, 44, 45, 46, 47, 48, 49, 50, 51] };
  const CHEST_MAGIC = { cloth: [11, 12, 33, 34], robe: [33, 34, 55, 56], light: [31, 32, 52, 53], medium: [31, 32, 54, 56], heavy: [52, 53, 54, 55, 56] };
  const ROBE_CLS = new Set(['mage', 'archmage', 'warlock', 'cleric', 'scout', 'bard']);
  const CASTER = new Set(['mage', 'archmage', 'warlock', 'cleric', 'scout']);

  // ── 에셋을 넓게 쓴다 (2026-11-24 사용자: 「다양한 에셋을 사용하게 하자. 아이템 종류도 많으니까 다 연결」) — 번호는 그림을 보고 나눴다 (정렬 순서) ──
  // 빌드 모습: 투구(h) · 왼손 물건(s — Sub_Item 번호) · 든 것(w — 주문 직업이 단순 무기를 들었을 때 대신 보이는 지팡이 · 완드) · 머리색(hair). 없는 빌드는 직업 기본(CLS)
  const BLOOK = {
    fighter_shield: { h: 57 }, fighter_twin: { h: 21 },
    paladin_shield: { h: 75 }, paladin_judge: { h: 74 },
    ranger_trap: { h: 44 }, ranger_beast: { h: 52 }, ranger_twin: { h: 45 },
    cleric: { w: ['Staff', 16], s: 4 }, cleric_war: { h: 29, w: ['Staff', 6], s: 47 }, cleric_guard: { h: 43 }, cleric_death: { h: 42, w: ['Staff', 8], s: 45 },
    druid: { w: ['Staff', 3] }, druid_fire: { h: 54, w: ['Staff', 13] }, druid_earth: { h: 4, w: ['Staff', 0], s: 32 }, druid_beast: { h: 50, w: ['Staff', 2] }, druid_heal: { h: 53, w: ['Staff', 4], s: 31 },
    bard_sound: { h: 9, s: 4 }, bard_heal: { h: 27, s: 5 }, bard_control: { h: 10, s: 6 },
    sorcerer: { w: ['Wand', 2], s: 28 }, sorcerer_storm: { w: ['Wand', 1], s: 27, hair: '#e8d070' }, sorcerer_frost: { w: ['Wand', 3], s: 27, hair: '#9fd0f0' }, sorcerer_mind: { w: ['Wand', 6], s: 1, hair: '#b070d0' },
    warlock: { w: ['Staff', 8] }, warlock_death: { h: 36, w: ['Staff', 9] }, warlock_charm: { h: 17, w: ['Wand', 6], s: 1 }, warlock_blade: { h: 34, s: -1 },
    wizard: { w: ['Staff', 10] }, wizard_fire: { h: 12, w: ['Staff', 13], s: 7 }, wizard_frost: { h: 11, w: ['Staff', 3], s: 4 }, wizard_storm: { h: 20, w: ['Staff', 11], s: 4 }, wizard_death: { h: 37, w: ['Staff', 14], s: 45 }, wizard_control: { h: 17, w: ['Staff', 12], s: 5 },
  };
  const SIMPLE_W = new Set(['dagger', 'quarterstaff', 'mace', 'club', 'sickle', 'light-hammer', undefined]);
  // 낀 물건 → 그림 (영문 이름의 낱말로): 지팡이 · 막대 · 완드, 방패, 머리에 쓰는 것, 손에 드는 것. 못 찾으면 종류의 화려한 그림 중 하나
  const FOCUS_ART = [[/Woodlands/, 'Staff', 1], [/Thunder/, 'Staff', 15], [/Striking/, 'Staff', 0], [/Staff of Fire/, 'Staff', 13], [/Frost/, 'Staff', 3], [/Healing/, 'Staff', 16], [/Charming/, 'Staff', 5], [/Insects/, 'Staff', 4], [/Withering/, 'Staff', 8], [/Python/, 'Staff', 2], [/Power/, 'Staff', 14], [/the Magi/, 'Staff', 10], [/Alertness/, 'Staff', 6], [/Rulership|Lordly/, 'Staff', 17], [/Resurrection/, 'Staff', 7],
    [/Binding/, 'Wand', 9], [/Fear/, 'Wand', 8], [/Fireballs/, 'Wand', 5], [/Lightning/, 'Wand', 3], [/Missiles/, 'Wand', 4], [/Paralysis/, 'Wand', 0], [/Polymorph/, 'Wand', 7], [/Web/, 'Wand', 6]];
  const SHIELD_ART = [[/Spellguard/, 11], [/Sentinel/, 12], [/Arrow/, 9], [/Animated/, 15], [/Cavalier/, 13], [/Missile/, 8], [/\+1/, 7], [/\+2/, 10], [/\+3/, 14]], SHIELD_R = [[0, 1, 2, 3, 4, 5], [7, 8, 9], [10, 11, 12], [13, 14, 15, 16], [14, 16]];
  const HEAD_ART = [[/Brilliance/, 70], [/Helm of Teleportation/, 64], [/Hat of Many Spells/, 36]];
  const HAND_ART = [[/Ioun/, 28], [/Pearl/, 27], [/Gem of Brightness/, 22], [/Luck/, 50], [/Earth Elementals/, 51], [/Iron Flask/, 36], [/Efreeti/, 38], [/War Mage/, 46, 1]] /* 셋째 값: 등급만큼 다음 그림 (+1 · +2 · +3) */;
  const wornOf = m => { try { const K = G.Gear?.kindOf, o = { list: [] }; if (!K) return o; for (const t of G.Trinket.of(m)) { const d = G.Trinket.def(t), kd = K(t), en = d.en || ''; o.list.push({ t, d, kd, en }); if (!o[kd]) o[kd] = { t, d, en }; } return o; } catch (err) { return { list: [] }; } };
  const artOf = (rows, en) => { for (const r of rows) if (r[0].test(en)) return r; return null; };

  function weaponOf(m, L, cls, B, W) {
    const SR = G.SRD, wq = SR.weaponOf(m), art = W?.weapon ? W.weapon.t : W?.list.length ? null : G.Trinket.weapon(m); // 낀 마법 무기 (방패 · 지팡이류는 따로 — 칸이 같은 'w'라 섞였다)
    let wk = Object.keys(SR.WEAPON).find(k => SR.WEAPON[k] === wq), wm = WPN[wk];
    { const fw = W?.weapon && artOf(FOCUS_ART, W.weapon.en); if (fw) return [fw[1], real(fw[1])[fw[2]]]; } // 무기 칸으로 정의된 지팡이(권능 · 마기)도 제 그림으로
    if (W?.focus) { const r = artOf(FOCUS_ART, W.focus.en), cat = r ? r[1] : /Wand/.test(W.focus.en) ? 'Wand' : 'Staff', all = real(cat); return [cat, all[Math.min(all.length - 1, r ? r[2] : pick(WPN_MAGIC[cat], hs(W.focus.en)))]]; } // 지팡이 · 막대 · 완드 물건은 그 그림으로
    if (!art && B?.w && SIMPLE_W.has(wk)) { const all = real(B.w[0]); return [B.w[0], all[Math.min(all.length - 1, B.w[1])]]; } // 주문 직업의 빌드 모습 (단순 무기 대신 지팡이 · 완드)
    if (cls.wand && (!wm || wk === 'dagger' || wk === 'quarterstaff')) wm = ['Wand', [0, 1, 2, 3, 4]];
    if (!wm) return null;
    const all = real(wm[0]);
    const artId = art && String(art.id ?? art.k ?? art.n ?? 'a');
    const i = art ? pick(WPN_MAGIC[wm[0]] || [all.length - 1], hs(artId)) : pick(wm[1], hs(lid(m) + ':' + wk));
    return [wm[0], all[Math.min(all.length - 1, i)]];
  }
  function chestOf(m, aq) {
    const art = G.Trinket.armor(m);
    const ak = aq.cat === 'heavy' ? 'heavy' : aq.cat === 'medium' ? 'medium' : aq.cat === 'light' ? 'light' : ROBE_CLS.has(m.cls) ? 'robe' : 'cloth';
    const i = art ? pick(CHEST_MAGIC[ak], hs(String(art.id ?? art.k ?? art.n ?? 'a'))) : pick(CHEST[ak], hs(lid(m) + ':' + aq.en));
    return C().Chest[i];
  }
  function lookOf(m) {
    const cls = CLS[m.cls] || {}, B = BLOOK[m.build] || null, W = wornOf(m), SR = G.SRD, e = SR.eq(m), aq = SR.armorOf(m), sp = G.Res.species(m) || 'human', h = hs(lid(m) + ':' + m.name + ':' + (m.look ?? ''));
    const L = { colors: {} };
    L.colors.skin = pick(SKIN[sp] || SKIN.human, h >> 3);
    L.colors.hair = B?.hair || cls.hair || pick(HAIR, h >> 6);
    L.colors.beard = L.colors.hair;
    L.Eye = pick(C().Eye.filter(n => !/_(Blue|Green)$/.test(n)), h >> 9);
    L.Hair = cls.bald ? null : pick(C().Hair, h >> 12);
    L.Beard = cls.beard || (sp === 'dwarf') ? pick(C().Beard, h >> 15) : null;
    { const hd = W.list.map(x => artOf(HEAD_ART, x.en)).find(Boolean), hi = hd ? hd[1] : B?.h != null ? B.h : cls.helm; L.Helmet = hi != null ? C().Helmet[hi] : null; } // 머리: 쓴 물건 → 빌드 → 직업
    L.Chest = chestOf(m, aq);
    L.weapon = weaponOf(m, L, cls, B, W);
    { const ms = W.shield, r = ms && artOf(SHIELD_ART, ms.en); L.Shield = !e.shield ? null : C().Shield[ms ? (r ? r[1] : pick(SHIELD_R[Math.min(4, ms.d.r || 1)], hs(ms.en))) : hs(lid(m) + 'sh') % 6]; } // 마법 방패는 그 그림 · 등급이 높을수록 화려한 쪽
    const ranged = L.weapon && /Bow|Crossbow/.test(L.weapon[0]), two = (SR.weaponOf(m)?.props || []).includes('two');
    { const hx = W.list.find(x => artOf(HAND_ART, x.en)), hand = hx && artOf(HAND_ART, hx.en), si = hand ? hand[1] + (hand[2] ? Math.min(2, (hx.d.r || 1) - 1) : 0) : B?.s != null ? B.s : null; // 왼손: 낀 물건(구슬 · 돌 · 병 · 완드) → 빌드 → 직업
      L.Sub_Item = L.Shield || ranged || (hand && two) || si === -1 ? null : si != null ? C().Sub_Item[si] : cls.sub ? C().Sub_Item.find(n => n.includes(cls.sub)) : null; }
    L.Arrow = pick(C().Arrow, h >> 18);
    L._caster = CASTER.has(m.cls) && !ranged;
    return L;
  }

  // 물건 그림 (전리품 · 짐 · 상태창 — 2026-11-24 사용자: 「음식, 주괴, 알, 물약 같은건 드롭템으로 보여줘도 되잖아. 장비도 마찬가지고」): 물건 → 파츠 그림 주소, 맞는 그림이 없으면 null.
  // x: 장비 물건({ kind: 'magic', t } · { kind: 'base', e: { slot, k } }) · 마법 물건 t 그대로 · 보석({ gem: id }) · 물자({ sup: 'camp' }). 마법 무기 · 방패 · 지팡이는 인형이 드는 그림과 같다
  const GEM_ART = { jade: 23, pearl: 14, diamond: 19, bpearl: 11, sapphire: 18, bigdia: 27 }, SUP_ART = { camp: 29 };
  const sub = i => (C().Sub_Item[i] ? partUrl('Sub_Item/' + C().Sub_Item[i]) : null);
  function itemUrl(x) {
    try {
      if (!MINI_READY || !x) return null;
      if (x.gem) return GEM_ART[x.gem] != null ? sub(GEM_ART[x.gem]) : null;
      if (x.sup) return SUP_ART[x.sup] != null ? sub(SUP_ART[x.sup]) : null;
      const SR = G.SRD, wpn = (k, magicId) => { const wm = WPN[k]; if (!wm) return null; const all = real(wm[0]), i = magicId != null ? pick(WPN_MAGIC[wm[0]] || [all.length - 1], hs(magicId)) : wm[1][0]; return partUrl(wm[0] + '/' + all[Math.min(all.length - 1, i)]); };
      const chest = (k, magicId) => { const a = SR.ARMOR[k]; if (!a) return null; const ak = a.cat === 'heavy' ? 'heavy' : a.cat === 'medium' ? 'medium' : a.cat === 'light' ? 'light' : 'robe'; return partUrl('Chest/' + C().Chest[magicId != null ? pick(CHEST_MAGIC[ak], hs(magicId)) : CHEST[ak][0]]); };
      if (x.kind === 'base') return x.e.slot === 'w' ? wpn(x.e.k) : x.e.slot === 'a' ? chest(x.e.k) : x.e.slot === 's' ? partUrl('Shield/' + C().Shield[0]) : null;
      const t = x.kind === 'magic' ? x.t : x.kind === 'art' ? { k: x.k, id: 0, base: x.base } : x.kind === 'rand' ? { rand: x.rand, id: 0, base: x.base } : x, d = G.Trinket.def(t); if (!d) return null;
      const kd = G.Gear.kindOf(t), en = d.en || '', id = String(t.id ?? t.k ?? t.n ?? 'a');
      if (kd === 'weapon' || kd === 'focus') { const r = artOf(FOCUS_ART, en); if (r) return partUrl(r[1] + '/' + real(r[1])[r[2]]); if (kd === 'focus') { const cat = /Wand/.test(en) ? 'Wand' : 'Staff'; return partUrl(cat + '/' + real(cat)[pick(WPN_MAGIC[cat], hs(en))]); } return wpn(t.base, id); }
      if (kd === 'armor') return chest(t.base, id);
      if (kd === 'shield') { const r = artOf(SHIELD_ART, en); return partUrl('Shield/' + C().Shield[r ? r[1] : pick(SHIELD_R[Math.min(4, d.r || 1)], hs(en))]); }
      const hd = artOf(HEAD_ART, en); if (hd) return partUrl('Helmet/' + C().Helmet[hd[1]]);
      const ha = artOf(HAND_ART, en); if (ha) return sub(ha[1] + (ha[2] ? Math.min(2, (d.r || 1) - 1) : 0));
      return null;
    } catch (err) { return null; }
  }

  // 인물별 인형 (모습이 바뀌면 다시 입힌다 — 강화 · 장비 교체가 바로 보인다)
  const dolls = new Map();
  function dollOf(m) {
    const L = lookOf(m), key = JSON.stringify(L); let d = dolls.get(m.uid);
    if (!d) { d = { doll: PaperDoll.create(L), key, cast: L._caster, cache: new Map(), L }; dolls.set(m.uid, d); }
    else if (d.key !== key) { d.doll.setLook(L); d.key = key; d.cast = L._caster; d.cache.clear(); d.L = L; }
    return d;
  }
  const partUrl = key => 'assets/chars/parts/' + key + '.png';
  // 상태창 장비 칸 그림: 지금 입은 무기 · 갑옷 · 방패 파츠
  function iconUrl(m, sl) {
    if (!MINI_READY) return null;
    const L = lookOf(m);
    if (sl === 'w') return L.weapon ? partUrl(L.weapon.join('/')) : null;
    if (sl === 'a') return L.Chest ? partUrl('Chest/' + L.Chest) : null;
    if (sl === 's') return L.Shield ? partUrl('Shield/' + L.Shield) : null;
    return null;
  }

  // ── 사람형 몬스터 (같은 에셋 · 피부색 · 크기 · 조합). 붉은 외곽선으로 우리 편과 가른다. 짐승 · 점액 · 식물 · 정령은 DCSS 그대로 ──
  // h: 투구 번호 · c: 갑옷 번호(null = 맨몸) · w: [무기 종류, 번호] · sh: 방패 · hair: 머리색(null = 대머리) · eye: 눈 색 · z: 크기 · scar: 흉터 · beard · sub: 왼손
  const UNDEAD_EYE = '#ff5040', FIEND_EYE = '#ffb020';
  const MON = {
    '고블린 졸개': { skin: '#7fae4a', z: 0.75, hair: '#2a3a1a', c: 2, w: ['Sword', 10] },
    '고블린 전사': { skin: '#7fae4a', z: 0.8, h: 16, c: 5, w: ['Sword', 13], sh: 0 },
    '고블린 두목': { skin: '#6f9e3a', z: 0.95, h: 44, c: 24, w: ['Axe', 4], beard: 1, hair: '#2a3a1a' },
    '홉고블린 전사': { skin: '#d9733f', z: 1, h: 57, c: 25, w: ['Sword', 7], sh: 3 },
    '홉고블린 대장': { skin: '#c9632f', z: 1.1, h: 56, c: 29, w: ['Sword', 16], sh: 7 },
    '버그베어 전사': { skin: '#9a6a3a', z: 1.3, h: 52, c: 14, w: ['Blunt', 6], hair: '#5a3a1a' },
    '놀 전사': { skin: '#b89a5a', z: 1.1, h: 50, c: 15, w: ['Spear', 2] },
    '오우거': { skin: '#c9a27a', z: 1.6, c: null, w: ['Blunt', 0], scar: 1 },
    '오우거 좀비': { skin: '#8fa07a', z: 1.6, c: null, w: ['Blunt', 0], scar: 1, eye: UNDEAD_EYE },
    '트롤': { skin: '#5f8f4a', z: 1.5, c: null, hair: '#2f4a2a', scar: 1 },
    '좀비': { skin: '#8fa07a', c: 2, hair: '#3a3a2a', eye: UNDEAD_EYE },
    '해골': { skin: '#ece6d6', c: null, w: ['Sword', 2], sh: 1, eye: UNDEAD_EYE },
    '구울': { skin: '#9c9a8a', c: 1, eye: UNDEAD_EYE },
    '와이트': { skin: '#b8bcc8', h: 71, c: 27, w: ['Sword', 18], eye: UNDEAD_EYE },
    '뱀파이어 스폰': { skin: '#ece0ec', hair: '#1a1a22', c: 28, eye: UNDEAD_EYE },
    '미노타우로스 해골': { skin: '#ece6d6', z: 1.4, h: 6, c: null, w: ['Axe', 9], eye: UNDEAD_EYE },
    '메이지': { h: 11, c: 21, w: ['Staff', 6], sub: 'Book_001_Blue', hair: '#6a6a7a', beard: 1 },
    '수련 사제': { h: 43, c: 23, w: ['Blunt', 3] },
    '사제': { h: 28, c: 20, w: ['Blunt', 5], sh: 2 },
    '불량배': { c: 13, w: ['Blunt', 0], hair: '#4a3020' },
    '불량배 두목': { h: 23, c: 26, w: ['Blunt', 10], beard: 1, scar: 1 },
    '산적': { h: 42, c: 7, w: ['Sword', 13] },
    '산적 두목': { h: 22, c: 35, w: ['Sword', 9], sh: 5, beard: 1, scar: 1 },
    '도플갱어': { skin: '#c8c8d0', c: 2 },
    '움직이는 갑옷': { skin: '#2a2a30', h: 39, c: 30, w: ['Sword', 9], sh: 4, eye: '#80c0ff' },
    '임프': { skin: '#c8402a', z: 0.6, h: 32, c: null, eye: FIEND_EYE },
    '바브드 데빌': { skin: '#a03030', z: 1.2, h: 35, c: null, w: ['Spear', 12], eye: FIEND_EYE },
    '본 데빌': { skin: '#d8d0b8', z: 1.4, h: 33, c: null, w: ['Spear', 14], eye: FIEND_EYE },
    '혼드 데빌': { skin: '#8a2020', z: 1.5, h: 34, c: null, w: ['Spear', 15], eye: FIEND_EYE },
    '아이스 데빌': { skin: '#8ab8e0', z: 1.5, h: 33, c: null, w: ['Spear', 16], eye: '#c0f0ff' },
  };
  const isMon = e => e.kind === 'mon' && !!MON[e.n];
  function monLook(e) {
    const M = MON[e.n], C0 = C(), L = { colors: { skin: M.skin || '#e8b08a', hair: M.hair || '#3a2a22', beard: M.hair || '#3a2a22', eye: M.eye || '#ffffff' } };
    L.Eye = C0.Eye[0]; L.Hair = M.hair || (M.hair === undefined && !M.skin) ? pick(C0.Hair, hs(e.n)) : null;
    L.Beard = M.beard ? pick(C0.Beard, hs(e.n + 'b')) : null;
    L.Helmet = M.h != null ? C0.Helmet[M.h] : null;
    L.Chest = M.c != null ? C0.Chest[M.c] : null;
    L.weapon = M.w ? [M.w[0], real(M.w[0])[Math.min(real(M.w[0]).length - 1, M.w[1])]] : null;
    L.Shield = M.sh != null ? C0.Shield[M.sh] : null;
    L.Sub_Item = M.sub && !L.Shield ? C0.Sub_Item.find(n => n.includes(M.sub)) : null;
    L.Arrow = C0.Arrow[0]; L.scar = !!M.scar;
    return L;
  }
  const mdolls = new WeakMap();
  function monDoll(e) {
    let d = mdolls.get(e); if (d) return d;
    const L = monLook(e); d = { doll: PaperDoll.create(L), key: e.n, cast: /메이지|사제/.test(e.n), cache: new Map(), L, size: MON[e.n].z || 1, mon: true };
    mdolls.set(e, d); return d;
  }

  // 상태 → 장면(클립 · 시각). 공격(lq: 0→1)은 Attack 곡선의 들어 올림~휘두름~마무리 구간에 맞춘다
  function pose(e, st) {
    const d = isMon(e) ? monDoll(e) : dollOf(e.merc || f.leader), A = PaperDoll.anims;
    let clip = 'Idle', time;
    if (st.lq < 1) { clip = d.cast ? 'Skill' : 'Attack'; time = d.cast ? .3 + st.lq * .7 : .55 + st.lq * .85; }
    else if (st.aim) { clip = 'Attack'; time = .8; }
    else if (st.moving) { clip = 'Run'; time = (st.t + (e._ph || 0)) % A.Run.len; }
    else time = (st.t * .9 + (e._ph || 0)) % A.Idle.len;
    return { d, clip, time };
  }
  function setPose(doll, clip, time) { const a = PaperDoll.anims[clip]; doll.play(clip, { once: !a.loop }); doll.update(time); ground(doll); }
  // 무기가 바닥을 뚫지 않게 (2026-11-23): 공격 동작의 내려치는 구간에서 무기 그림이 발밑 선 아래로 내려가면 그만큼 무기 마디를 들어 올린다.
  // 서 있을 때 · 걸을 때도 같다 (무기를 낮게 들고 있어 1~3px 내려갔다). doll.play가 부를 때마다 기본 자세로 되돌리므로 고친 값은 쌓이지 않는다
  const GROUND_PAD = 3; // 발밑 선 아래로 봐주는 높이 (인형 100px 기준 px — 그림 가장자리의 빈 테두리)
  // 그림의 실제 윤곽 점 (가로줄 띠마다 왼쪽 끝 · 오른쪽 끝) — 빈 테두리까지 든 네모로 재면 무기를 너무 높이 들어 올린다
  const edges = new Map(), ecv = document.createElement('canvas'), ecx2 = ecv.getContext('2d', { willReadFrequently: true });
  function edgeOf(key) {
    let E = edges.get(key); if (E) return E; E = []; const img = PaperDoll.images[key]; if (!img) return E;
    ecv.width = img.width; ecv.height = img.height; ecx2.clearRect(0, 0, img.width, img.height); ecx2.drawImage(img, 0, 0); const a = ecx2.getImageData(0, 0, img.width, img.height).data, st = Math.max(1, img.height >> 5);
    for (let y = 0; y < img.height; y += st) { let l = -1, r = -1; for (let x = 0; x < img.width; x++) if (a[(y * img.width + x) * 4 + 3] > 90) { if (l < 0) l = x; r = x; } if (l >= 0) E.push(l, y, r + 1, y + st); }
    edges.set(key, E); return E;
  }
  // 발밑 선 아래로 가장 많이 내려간 무기 그림의 깊이(ov)와 그 무기 마디(hit)
  function over(doll) {
    const M = [], PDS = PaperDoll.sprites; let ov = 0; const hit = new Set();
    for (const n of doll.nodes) {
      const r = -n.rot * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); let m = [c * n.sx, s * n.sx, -s * n.sy, c * n.sy, n.x * 100, -n.y * 100];
      if (n.parent) { const q = M[n.parent.idx]; m = [q[0] * m[0] + q[2] * m[1], q[1] * m[0] + q[3] * m[1], q[0] * m[2] + q[2] * m[3], q[1] * m[2] + q[3] * m[3], q[0] * m[4] + q[2] * m[5] + q[4], q[1] * m[4] + q[3] * m[5] + q[5]]; }
      M[n.idx] = m; n._vis = n.show && (!n.parent || n.parent._vis !== false);
      const path = n.def.path; if (!n._vis || !n.sprite || n.def.order == null || !path.startsWith('HandRight/')) continue;
      const top = 'HandRight/' + path.split('/')[1], tn = doll.byPath[top]; if (!tn) continue;
      const meta = PDS[n.sprite]; if (!meta) continue; const k = 100 / meta.ppu, x0 = -meta.px * meta.w * k, y0 = -(1 - meta.py) * meta.h * k, E = edgeOf(n.sprite);
      for (let i = 0; i < E.length; i += 2) { const wy = m[1] * (x0 + E[i] * k) + m[3] * (y0 + E[i + 1] * k) + m[5]; if (wy - GROUND_PAD > ov) { ov = wy - GROUND_PAD; hit.add(tn); } }
    }
    return { ov, hit, M };
  }
  // 손을 축으로 무기를 돌려 끝이 발밑 선에 닿는 데서 멈춘다 (2026-11-24). 전에는 내려간 만큼 무기를 통째로 들어 올렸는데, 긴 무기(대검)는 그만큼 올라가 얼굴을 다 가렸다.
  // 돌려도 안 되는 만큼(손 자체가 낮을 때)만 조금 들어 올린다 (LIFT_MAX)
  const TURN_STEP = 5, TURN_MAX = 110, LIFT_MAX = 6;
  function ground(doll) {
    let o = over(doll); if (o.ov <= 0) return;
    for (const tn of o.hit) {
      const r0 = tn.rot; let d = 0;
      for (let a = TURN_STEP; a <= TURN_MAX && !d; a += TURN_STEP) for (const sg of [1, -1]) { tn.rot = r0 + sg * a; if (over(doll).ov <= 0) { d = sg * a; break; } }
      if (!d) { tn.rot = r0; continue; }
      let lo = d - Math.sign(d) * TURN_STEP, hi = d; for (let i = 0; i < 3; i++) { const mid = (lo + hi) / 2; tn.rot = r0 + mid; if (over(doll).ov <= 0) hi = mid; else lo = mid; } tn.rot = r0 + hi; // 가장 덜 돌린 각도
    }
    o = over(doll); if (o.ov <= 0) return; const ov = Math.min(o.ov, LIFT_MAX), M = o.M;
    for (const tn of o.hit) { const q = tn.parent ? M[tn.parent.idx] : [1, 0, 0, 1, 0, 0], det = q[0] * q[3] - q[2] * q[1] || 1, lx = (q[2] * ov) / det, ly = (-q[0] * ov) / det; tn.x += lx / 100; tn.y -= ly / 100; } // 화면 위쪽으로 ov만큼 = 부모 좌표로 되돌린 값
  }

  // 버퍼 크기 실루엣: 가림 계산 · 머리 위 표시 위치 · 쓰러진 몸 그림에 쓴다 (프레임마다 캐시)
  const FPS = 15;
  const cv = document.createElement('canvas');
  const cx = cv.getContext('2d', { willReadFrequently: true });
  function raster(doll, clip, time, z = 1) {
    const CW = Math.ceil(64 * z), CH = Math.ceil(68 * z), FOOT = Math.round(58 * z); // 큰 몸은 판도 크게
    if (cv.width !== CW || cv.height !== CH) { cv.width = CW; cv.height = CH; }
    setPose(doll, clip, time);
    cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, CW, CH);
    doll.draw(cx, CW / 2, FOOT, { scale: MS * z, flip: true });
    const d = new Uint32Array(cx.getImageData(0, 0, CW, CH).data.buffer), o = new Uint32Array(CW * CH);
    for (let i = 0; i < o.length; i++) if ((d[i] >>> 24) > 90) o[i] = d[i] | 0xff000000;
    let top = 0; find: for (; top < CH; top++) for (let x = 0; x < CW; x++) if (o[top * CW + x]) break find;
    return { w: CW, h: CH, foot: FOOT, px: o, top };
  }
  function frame(e, st) {
    const { d, clip, time } = pose(e, st), fi = Math.round(time * FPS), key = clip + fi;
    let sp = d.cache.get(key);
    if (!sp) { if (d.cache.size > 160) d.cache.clear(); sp = VOXON ? px32(d, clip, fi / FPS) : raster(d.doll, clip, fi / FPS, d.size || 1); d.cache.set(key, sp); }
    return VOXON ? sp : Object.assign({}, sp, { mini: { d, clip, time } }); // 복셀 층: 32px 픽셀 인형을 버퍼에 그대로 찍는다
  }

  // ───── 32px 픽셀 인형 (복셀 층, px_lab.html에서 정한 줄이기): 외곽선 우선 · 눈 살리기 · 움직임은 1px 계단 · 1px 외곽선(몬스터는 붉게) ─────
  const SS = 8, DARK_LUM = 70, DARK_COVER = 0.4, EYE_COVER = 0.25, EYE_LIGHT = 0.35, LIGHT_LUM = 150, PH = 32;
  const hi = document.createElement('canvas'), hix = hi.getContext('2d', { willReadFrequently: true });
  const eyeCv = document.createElement('canvas'), ecx = eyeCv.getContext('2d', { willReadFrequently: true });
  let natH = 0;
  function measure() { const c = document.createElement('canvas'); c.width = c.height = 600; const x = c.getContext('2d', { willReadFrequently: true }), dl = PaperDoll.create(PaperDoll.random(() => .37)); dl.draw(x, 300, 450, { scale: 1 }); const a = x.getImageData(0, 0, 600, 600).data; let top = 600, bot = 0; for (let y = 0; y < 600; y++) for (let i = 0; i < 600; i++) if (a[(y * 600 + i) * 4 + 3] > 40) { if (y < top) top = y; if (y > bot) bot = y; } return Math.max(1, bot - top); }
  function quantize(dl, H) { const ts = natH / (100 * H), rs = 180 / Math.PI / H, ss = 2 / H; for (const n of dl.nodes) { const f0 = n.def; if (n.parent) { n.x = f0.x + Math.round((n.x - f0.x) / ts) * ts; n.y = f0.y + Math.round((n.y - f0.y) / ts) * ts; } n.rot = f0.rot + Math.round((n.rot - f0.rot) / rs) * rs; if (f0.sx) n.sx = f0.sx * (1 + Math.round((n.sx / f0.sx - 1) / ss) * ss); if (f0.sy) n.sy = f0.sy * (1 + Math.round((n.sy / f0.sy - 1) / ss) * ss); } }
  const eyeNodes = dl => dl._eyes || (dl._eyes = dl.nodes.filter(n => n.def.path === 'Body/Head/Eye' || n.def.path === 'Body/Head/Ani_Eye'));
  function eyeSample(dl, w, h, drawAt) {
    const en = eyeNodes(dl), keep = new Set(en), sp = dl.nodes.map(n => n.sprite);
    dl.nodes.forEach(n => { if (!keep.has(n)) n.sprite = null; }); eyeCv.width = w; eyeCv.height = h; drawAt(ecx, 1 / SS); dl.nodes.forEach((n, i) => n.sprite = sp[i]);
    const a = ecx.getImageData(0, 0, w, h).data; let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (a[(y * w + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return null;
    x0 = Math.max(0, x0 - 1); y0 = Math.max(0, y0 - 1); x1 = Math.min(w - 1, x1 + 1); y1 = Math.min(h - 1, y1 + 1);
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, sv = en.map(n => n.show); en.forEach(n => n.show = false);
    hix.save(); hix.beginPath(); hix.rect(x0 * SS, y0 * SS, bw * SS, bh * SS); hix.clip(); hix.clearRect(x0 * SS, y0 * SS, bw * SS, bh * SS); drawAt(hix, 1); hix.restore();
    en.forEach((n, i) => n.show = sv[i]);
    return { d: hix.getImageData(x0 * SS, y0 * SS, bw * SS, bh * SS).data, x: x0, y: y0, w: bw, h: bh };
  }
  function sampleDark(src, w, h, eye, out) {
    const HW = hi.width, N = SS * SS;
    for (let cy = 0; cy < h; cy++) for (let cx2 = 0; cx2 < w; cx2++) {
      let cov = 0, dk = 0, dr = 0, dg = 0, db = 0, fa = 0, fr = 0, fg = 0, fb = 0, ec = 0, la = 0, lr = 0, lg = 0, lb = 0, ma = 0, mr = 0, mg = 0, mb = 0;
      const noEye = eye && cx2 >= eye.x && cx2 < eye.x + eye.w && cy >= eye.y && cy < eye.y + eye.h ? eye.d : null, EW = eye ? eye.w * SS : 0;
      for (let yy = 0; yy < SS; yy++) {
        let j = ((cy * SS + yy) * HW + cx2 * SS) * 4, k = noEye ? (((cy - eye.y) * SS + yy) * EW + (cx2 - eye.x) * SS) * 4 : 0;
        for (let xx = 0; xx < SS; xx++, j += 4, k += 4) {
          if (src[j + 3] < 128) continue; cov++;
          const r = src[j], g = src[j + 1], b = src[j + 2], L = 0.3 * r + 0.59 * g + 0.11 * b;
          if (L < DARK_LUM) { dk++; dr += r; dg += g; db += b; } else { fa++; fr += r; fg += g; fb += b; }
          if (noEye && Math.abs(r - noEye[k]) + Math.abs(g - noEye[k + 1]) + Math.abs(b - noEye[k + 2]) + Math.abs(src[j + 3] - noEye[k + 3]) > 24) { ec++; if (L >= LIGHT_LUM) { la++; lr += r; lg += g; lb += b; } else if (L >= DARK_LUM) { ma++; mr += r; mg += g; mb += b; } }
        }
      }
      if (cov < N * 0.43) continue;
      const o = cy * w + cx2;
      if (ec >= N * EYE_COVER && la >= N * EYE_LIGHT) out[o] = rgb(lr / la, lg / la, lb / la);
      else if (ec >= N * EYE_COVER && ma >= N * 0.3) out[o] = rgb(mr / ma, mg / ma, mb / ma);
      else if (dk >= N * DARK_COVER || !fa) out[o] = rgb(dr / dk, dg / dk, db / dk);
      else out[o] = rgb(fr / fa, fg / fa, fb / fa);
    }
  }
  function px32(d, clip, time) {
    if (!natH) natH = measure();
    const H = Math.round(PH * (d.size || 1)), w = Math.round(H * 2.4), h = H + 17, foot = H + 3, dl = d.doll;
    setPose(dl, clip, time); quantize(dl, H);
    hi.width = w * SS; hi.height = h * SS;
    const drawAt = (c, k) => dl.draw(c, Math.floor(w / 2) * SS * k, foot * SS * k, { scale: H * SS * k / natH, flip: true });
    hix.clearRect(0, 0, hi.width, hi.height); drawAt(hix, 1);
    const src = hix.getImageData(0, 0, hi.width, hi.height).data, px = new Uint32Array(w * h);
    sampleDark(src, w, h, eyeSample(dl, w, h, drawAt), px);
    // 1px 외곽선 (몬스터는 붉게 — 우리 편과 가른다)
    const ink = d.mon ? rgb(196, 40, 36) : rgb(36, 32, 44), solid = px.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (solid[i]) continue; if ((x > 0 && solid[i - 1]) || (x < w - 1 && solid[i + 1]) || (y > 0 && solid[i - w]) || (y < h - 1 && solid[i + w])) px[i] = ink; }
    let top = 0; find: for (; top < h; top++) for (let x = 0; x < w; x++) if (px[top * w + x]) break find;
    return { w, h, foot, px, top };
  }

  // ───── 고해상도 층 ─────
  let hd = null, hx = null, tmp = null, tx = null, snapPix = null;
  const queue = [];
  function layer() {
    if (hd) return;
    hd = document.createElement('canvas'); hd.id = 'hd';
    hd.style.cssText = 'position:absolute;pointer-events:none;';
    canvas.after(hd); hx = hd.getContext('2d');
    tmp = document.createElement('canvas'); tx = tmp.getContext('2d');
  }
  // ── 픽셀 몬스터 (DCSS 그림)를 고해상도로: Scale2x 두 번(4배)으로 대각선을 잇고 → 부드럽게 줄여 → 붉은 외곽선 (선 그림 배경일 때, js/iso/hdbg.js) ──
  const svgM = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svgM.setAttribute('width', 0); svgM.setAttribute('height', 0); svgM.style.position = 'absolute';
  svgM.innerHTML = `<filter id="monline" color-interpolation-filters="sRGB" x="-10%" y="-10%" width="120%" height="120%"><feComponentTransfer in="SourceGraphic" result="sh"><feFuncA type="linear" slope="3" intercept="-.7"/></feComponentTransfer><feMorphology in="sh" operator="dilate" radius="2" result="fat"/><feFlood flood-color="#e0302a"/><feComposite in2="fat" operator="in" result="ol"/><feMorphology in="sh" operator="dilate" radius="1" result="fat2"/><feFlood flood-color="#1d1418"/><feComposite in2="fat2" operator="in" result="ol2"/><feMerge><feMergeNode in="ol"/><feMergeNode in="ol2"/><feMergeNode in="sh"/></feMerge></filter>`;
  document.body.append(svgM); const monMorph = svgM.querySelectorAll('feMorphology');
  function scale2(src, w, h) { const W2 = w * 2, out = new Uint32Array(W2 * h * 2); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const E = src[y * w + x], B = y > 0 ? src[(y - 1) * w + x] : E, Hh = y < h - 1 ? src[(y + 1) * w + x] : E, D = x > 0 ? src[y * w + x - 1] : E, F2 = x < w - 1 ? src[y * w + x + 1] : E; let e0 = E, e1 = E, e2 = E, e3 = E; if (B !== Hh && D !== F2) { if (D === B) e0 = D; if (B === F2) e1 = F2; if (D === Hh) e2 = D; if (Hh === F2) e3 = F2; } const o = y * 2 * W2 + x * 2; out[o] = e0; out[o + 1] = e1; out[o + W2] = e2; out[o + W2 + 1] = e3; } return out; }
  const sprC = new WeakMap(), x4 = new WeakMap(); let monK = 0;
  function spriteHD(sp, s, flip) {
    let m = sprC.get(sp.px); if (!m) sprC.set(sp.px, m = new Map());
    const key = (s * 100 | 0) + (flip ? 'f' : ''); let o = m.get(key); if (o) return o;
    let big4 = x4.get(sp.px); if (!big4) { const h = sp.foot + 1, src = sp.px.subarray(0, sp.w * h); big4 = document.createElement('canvas'); big4.width = sp.w * 4; big4.height = h * 4; const a = scale2(scale2(src, sp.w, h), sp.w * 2, h * 2); big4.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(a.buffer), sp.w * 4, h * 4), 0, 0); x4.set(sp.px, big4); }
    const p = Math.ceil(s) + 3, cw = Math.ceil(sp.w * s) + p * 2, ch = Math.ceil((sp.foot + 1) * s) + p * 2;
    o = document.createElement('canvas'); o.width = cw; o.height = ch; const c = o.getContext('2d');
    if (Math.abs(s - monK) > .01) { monK = s; monMorph[0].setAttribute('radius', Math.max(2, s * .7)); monMorph[1].setAttribute('radius', Math.max(1, s * .3)); }
    c.filter = 'url(#monline)'; c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    if (flip) { c.translate(cw, 0); c.scale(-1, 1); }
    c.drawImage(big4, p, p, sp.w * s, (sp.foot + 1) * s);
    o.p = p; if (m.size > 24) m.clear(); m.set(key, o); return o;
  }
  // 2.5D 시안 (?art=d25): 픽셀 그대로 키워 발끝 기준으로 늘이고 기울인다 · 무기는 손잡이를 축으로 돌린다 · 등불 빛만큼 어둡게
  const pxC = new WeakMap();
  function pxCanvas(px, w, h) { let c = pxC.get(px); if (c) return c; c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(px.buffer.slice(px.byteOffset, px.byteOffset + w * h * 4)), w, h), 0, 0); pxC.set(px, c); return c; }
  function drawD25(R0, flip, fx, fy, k) {
    const { sp, sc } = R0, P = R0.pose, s = sc * k, body = pxCanvas(sp.px, sp.w, sp.foot + 1);
    tx.save(); tx.imageSmoothingEnabled = false;
    tx.translate(fx, fy); if (P.rot) tx.rotate(P.rot); if (P.alpha != null) tx.globalAlpha = P.alpha; if (P.gray) tx.filter = `grayscale(${(P.gray * .7).toFixed(2)}) brightness(${(1 - P.gray * .25).toFixed(2)})`; tx.transform(P.px, 0, -P.lean, P.py, 0, 0); if (flip) tx.scale(-1, 1);
    tx.drawImage(body, -sp.w / 2 * s, -sp.foot * s, sp.w * s, (sp.foot + 1) * s);
    const Wp = sp.weapon; if (Wp) {
      const wc = pxCanvas(Wp.px, Wp.w, Wp.h), gx = (-sp.w / 2 + Wp.gx) * s, gy = (-sp.foot + Wp.gy) * s;
      const one = (a, al) => { tx.save(); tx.globalAlpha = al; tx.translate(gx, gy); tx.rotate(-a); tx.drawImage(wc, -Wp.gx * s, -Wp.gy * s, Wp.w * s, Wp.h * s); tx.restore(); };
      if (P.ghost) P.ghost.forEach((a, i) => one(a, .22 + i * .14)); one(P.wa, 1);
    }
    tx.restore();
    if (P.light < .99) { tx.globalCompositeOperation = 'source-atop'; tx.fillStyle = `rgba(14,10,26,${(1 - P.light).toFixed(2)})`; tx.fillRect(0, 0, tmp.width, tmp.height); tx.globalCompositeOperation = 'source-over'; }
  }
  // drawRec에서: 서 있는 인형을 버퍼 대신 줄에 세운다
  let zr = null; const zref = z => { zr = zr && zr.length === z.length ? (zr.set(z), zr) : z.slice(); };
  function enqueue(R0, flip, flash) { queue.push({ R0, flip, flash }); }
  // 인형 그리기 직후(픽셀 버퍼에 이펙트를 얹기 전): 인형마다 보이는 픽셀 판정을 만들고 버퍼를 기억해 둔다
  function snap() {
    FXLO.clear();
    if (!queue.length) { snapPix = null; return; }
    for (const Q of queue) {
      const { sp, sx, sy, d, sc } = Q.R0, pad = Q.R0.pose ? Math.ceil(sp.w * sc * .45) : 0, w = sp.w, L = Math.round(sx - w * sc / 2) - pad, B = Math.round(sy) + (pad ? 2 : 0);
      const mw = Math.ceil(w * sc) + pad * 2, mh = Math.ceil((sp.foot + 1) * sc * (pad ? 1.25 : 1)) + (pad ? 2 : 0), M = new Uint8ClampedArray(mw * mh * 4);
      for (let up = 0; up < mh; up++) {
        const j = pad ? 0 : sp.foot - Math.floor(up / sc), iy = B - up; if (j < 0 || iy < 0 || iy >= H) continue;
        const dz = d + up / (COS * S) * SIN + .06;
        for (let a = 0; a < mw; a++) {
          const i = Math.floor(a / sc), ix = L + a; if (ix < 0 || ix >= W) continue;
          const k = iy * W + ix, o = ((mh - 1 - up) * mw + a) * 4;
          // 앞에 무언가 있으면: 벽 · 바닥(구운 깊이)이면 비치고, 다른 인물 · 소품이면 가린다
          const zk = zr ? zr[k] : zb[k], al = dz > zk ? 255 : zk === bakedZ[k] ? 150 : 0;
          M[o] = M[o + 1] = M[o + 2] = 255; M[o + 3] = al;
        }
      }
      Q.mask = { w: mw, h: mh, L, T: B - mh + 1, data: new ImageData(M, mw, mh) };
    }
    snapPix = bufPix().slice();
  }
  function clear() { if (hd && hd.width) hx.clearRect(0, 0, hd.width, hd.height); queue.length = 0; }
  // 화면에 올리기 (putImageData 다음)
  const mcv = document.createElement('canvas'), mx = mcv.getContext('2d'), ocv = document.createElement('canvas'), ox = ocv.getContext('2d');
  function present() {
    layer();
    const k = canvas.clientWidth / W * (devicePixelRatio || 1), cw = Math.round(canvas.clientWidth * (devicePixelRatio || 1)), ch = Math.round(canvas.clientHeight * (devicePixelRatio || 1));
    if (hd.width !== cw || hd.height !== ch) { hd.width = cw; hd.height = ch; }
    hd.style.left = canvas.offsetLeft + 'px'; hd.style.top = canvas.offsetTop + 'px'; hd.style.width = canvas.clientWidth + 'px'; hd.style.height = canvas.clientHeight + 'px';
    hd.style.transform = canvas.style.transform; hd.style.opacity = canvas.style.opacity; hd.style.transition = canvas.style.transition;
    hx.setTransform(1, 0, 0, 1, 0, 0); hx.clearRect(0, 0, cw, ch);
    if (!queue.length) return;
    queue.sort((a, b) => a.R0.d - b.R0.d); // 먼 것부터
    for (const Q of queue) {
      const { R0, mask } = Q; if (!mask) continue;
      const { sx, sy, sc } = R0, px = !R0.sp.mini, { d: D, clip, time } = R0.sp.mini || {};
      const bw = Math.ceil(mask.w * k), bh = Math.ceil(mask.h * k);
      if (tmp.width < bw || tmp.height < bh) { tmp.width = Math.max(tmp.width, bw); tmp.height = Math.max(tmp.height, bh); }
      tx.setTransform(1, 0, 0, 1, 0, 0); tx.clearRect(0, 0, tmp.width, tmp.height); tx.globalCompositeOperation = 'source-over';
      if (R0.pose) drawD25(R0, Q.flip, (sx - mask.L) * k, (sy - mask.T) * k, k);
      else if (px) { const sp = R0.sp, o = spriteHD(sp, sc * k, Q.flip); tx.drawImage(o, (sx - sp.w * sc / 2 - mask.L) * k - o.p, (sy - (sp.foot + 1) * sc + 1 - mask.T) * k - o.p); } // 픽셀 몬스터: 붉은 외곽선까지 담긴 그림
      else {
      setPose(D.doll, clip, time);
      // 인형 발끝 = 버퍼의 (sx, sy). tmp 안에서는 마스크 왼쪽 위 기준
      D.doll.draw(tx, (sx - mask.L) * k, (sy - mask.T) * k, { scale: MS * sc * k * (D.size || 1), flip: !Q.flip });
      // 몬스터: 붉은 외곽선 (실루엣을 붉게 칠해 둘레에 깔고 그 위에 몸)
      if (D.mon) {
        if (ocv.width !== tmp.width || ocv.height !== tmp.height) { ocv.width = tmp.width; ocv.height = tmp.height; }
        ox.setTransform(1, 0, 0, 1, 0, 0); ox.globalCompositeOperation = 'source-over'; ox.clearRect(0, 0, ocv.width, ocv.height); ox.drawImage(tmp, 0, 0);
        ox.globalCompositeOperation = 'source-in'; ox.fillStyle = '#e0302a'; ox.fillRect(0, 0, ocv.width, ocv.height); ox.globalCompositeOperation = 'source-over';
        const r = Math.max(1.5, k * 0.9); tx.globalCompositeOperation = 'destination-over';
        for (const [a, b] of [[-r, 0], [r, 0], [0, -r], [0, r], [-r, -r], [r, r], [-r, r], [r, -r]]) tx.drawImage(ocv, a, b);
        tx.globalCompositeOperation = 'source-over';
      }
      }
      if (Q.flash) { tx.globalCompositeOperation = 'source-atop'; tx.fillStyle = 'rgba(255,252,240,.85)'; tx.fillRect(0, 0, bw, bh); }
      // 가림 판정 곱하기 (버퍼 픽셀 단위 그대로 키운다)
      mcv.width = mask.w; mcv.height = mask.h; mx.putImageData(mask.data, 0, 0);
      tx.globalCompositeOperation = 'destination-in'; tx.imageSmoothingEnabled = false; tx.drawImage(mcv, 0, 0, mask.w * k, mask.h * k); tx.imageSmoothingEnabled = true;
      tx.globalCompositeOperation = 'source-over';
      hx.drawImage(tmp, 0, 0, bw, bh, Math.round(mask.L * k), Math.round(mask.T * k), bw, bh);
    }
    // 인형 뒤에 그려진 이펙트 · 숫자를 인형 위로 다시 얹는다 (인형이 있는 상자 안에서 버퍼가 바뀐 픽셀만)
    if (snapPix) {
      for (const Q of queue) {
        const M = Q.mask; if (!M) continue;
        const x0 = Math.max(0, M.L), y0 = Math.max(0, M.T), x1 = Math.min(W, M.L + M.w), y1 = Math.min(H, M.T + M.h), w = x1 - x0, h = y1 - y0; if (w <= 0 || h <= 0) continue;
        const out = new Uint32Array(w * h); let any = false;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const kk = (y0 + y) * W + x0 + x; if (bufPix()[kk] !== snapPix[kk] && !FXLO.has(kk)) { out[y * w + x] = bufPix()[kk]; any = true; } }
        if (!any) continue;
        mcv.width = w; mcv.height = h; mx.putImageData(new ImageData(new Uint8ClampedArray(out.buffer), w, h), 0, 0);
        hx.imageSmoothingEnabled = false; hx.drawImage(mcv, Math.round(x0 * k), Math.round(y0 * k), w * k, h * k); hx.imageSmoothingEnabled = true;
      }
    }
    queue.length = 0;
  }

  // 상태창 · 영지 얼굴: 원본 그대로 (작은 칸은 상반신, 상태창 그림은 전신)
  function portrait(m, cvs, full) {
    const go = () => {
      const d = dollOf(m), x = cvs.getContext('2d'); setPose(d.doll, 'Idle', .2);
      x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cvs.width, cvs.height);
      if (full) d.doll.draw(x, cvs.width / 2, cvs.height * .86, { scale: cvs.height / 150 });
      else d.doll.draw(x, cvs.width / 2, cvs.height * 1.18, { scale: cvs.width / 52 });
    };
    cvs.style.imageRendering = 'auto';
    if (MINI_READY) go(); else PaperDoll.load('assets/chars/').then(go).catch(() => {});
  }
  // 선술집 등 전투 밖 화면: 그 사람의 32px 픽셀 인형 한 장 (가만히 선 모습, time = 초). 그림이 아직 안 왔으면 null
  function pixOf(d, clip, time) { const A = PaperDoll.anims[clip], fi = Math.round((A.loop ? time % A.len : Math.min(time, A.len - 0.01)) * FPS), key = 'P' + (clip === 'Idle' ? '' : clip) + fi; let sp = d.cache.get(key); if (!sp) { if (d.cache.size > 160) d.cache.clear(); sp = px32(d, clip, fi / FPS); d.cache.set(key, sp); } return sp; }
  // clip: PaperDoll의 동작 이름. 'Act' = 제 싸우는 동작 (주문 직업은 Skill)
  function pix(m, time = 0, clip = 'Idle') { if (!MINI_READY) return null; const d = dollOf(m); return pixOf(d, clip === 'Act' ? (d.cast ? 'Skill' : 'Attack') : clip, time); }
  // 마을 사람 (길드 술집의 손님 · 주인): 무기도 투구도 없는 평상복. i = 사람 번호
  const folks = new Map();
  function pixFolk(i, time = 0, clip = 'Idle') {
    if (!MINI_READY) return null;
    let d = folks.get(i);
    if (!d) { const C0 = C(), h = hs('folk' + i), hair = pick(HAIR, h >> 6), L = { colors: { skin: pick(SKIN.human, h >> 3), hair, beard: hair, eye: '#ffffff' }, Eye: C0.Eye[0], Hair: pick(C0.Hair, h >> 12), Beard: i % 3 === 0 ? pick(C0.Beard, h >> 15) : null, Helmet: null, Chest: C0.Chest[pick(CHEST.cloth, i)], weapon: null, Shield: null, Sub_Item: null, Arrow: C0.Arrow[0] };
      d = { doll: PaperDoll.create(L), cast: false, cache: new Map(), L }; folks.set(i, d); }
    return pixOf(d, clip, time);
  }
  // 몬스터의 서 있는 모습 (인형으로 그리는 몬스터만 — 아니면 null)
  function pixMon(e) { if (!MINI_READY || !isMon(e)) return null; const d = monDoll(e); let sp = d.cache.get('P0'); if (!sp) { sp = px32(d, 'Idle', 0); d.cache.set('P0', sp); } return sp; }
  return { lookOf, frame, portrait, pix, pixFolk, pixMon, iconUrl, itemUrl, enqueue, snap, present, clear, isMon, zref };
})();

// 2.5D 시안 (?art=d25): 길드 · 카드 얼굴도 DCSS 인형으로 (몸 + 무기 한 장, 인형과 같은 쪽을 보게 뒤집는다)
if (D25) {
  const one = new WeakMap(), merged = dl => {
    if (!dl) return null; let sp = one.get(dl); if (sp) return sp;
    const w = dl.w, h = dl.h, src = dl.fr.idle[0], W0 = dl.weapon, px = new Uint32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, c = (W0 && W0.w === w && W0.px[i]) || src[i]; if (c) px[y * w + (w - 1 - x)] = c; }
    sp = { w, h, foot: dl.foot, top: dl.top, px }; one.set(dl, sp); return sp;
  };
  MD.pix = m => merged(layered('c_' + m.cls, G.DCSS.cls[m.cls] || G.DCSS.cls.dragoon));
  MD.pixMon = e => merged(dcssOf(e));
}
