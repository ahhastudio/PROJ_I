'use strict';
// 원정 (끝이 있는 인크레멘탈, 화면 없이): 길드에서 파티를 골라 생성된 탐사 층(RUN · js/explore)을 자동으로 돈다 — 방 · 통로 · 문 · 사건 · 보물 · 야영 · 전투 · 우두머리 → 계단 → 다음 층.
// 전멸하면 끝, 10층 붉은 성룡을 잡으면 승리. 판에서 번 금화(전투 · 보물 · 사건 · 판 장비) + 깬 층 보너스가 길드 금화 → 해금 트리(유한)를 사서 다음 원정을 더 깊이.
// 방치형 RPG 코어 (2026-11-22): 영웅이 남는다(명단 — 이름 · 빌드 · 레벨업 때 고른 것 · 장비가 판을 넘어 이어진다, 쓰러져도 길드로 돌아온다)
// · 처치 경험치로 영웅마다 자란다 (SRD 20레벨까지, 레벨업 고르기는 저절로 첫 추천) — 따라잡기: 새 영웅은 (최고 − 2)레벨로 · 낮은 영웅은 더 빨리 · 쉬는 영웅도 조금
// · 주운 장비는 낀 채로 남는다 · 깬 구역 다음 층(3 · 5 · 7 · 9)에서 다시 출발한다 · 자리를 비운 동안도 번 것으로 친다(settle). 금화는 자리 · 직업 · 탐험 물자 · 야영 · 배속에.
// 원칙: 캐릭터의 숫자는 SRD 안에 둔다. 저장은 localStorage 한 키(KEY), 읽고 쓰는 것은 화면 쪽(js/app/dive_ui.js).
// 탐사가 묻는 곳(갈림길 · 사건 · 누가 할까 · 잠긴 문 · 주운 장비)은 여기 POL이 대신 고른다 — 화면(crawl.js)은 창을 띄우고 POL이 고른 단추를 누른다.
G.Dive = (() => {
  const KEY = 'inc.dive';
  // 5~10층 구역 (RUN.ZONES는 1~4층 두 줄뿐 — 원정 모드에서만 hook()이 이 줄들을 더한다. 기존 탐사 게임은 4층 우두머리에서 끝난 그대로).
  // 값은 RUN.ZONES와 같은 결: 몬스터 값(cost) ≈ SRD 경험치 ÷ 50 · 예산(budget) = 층의 [약한 · 보통 · 센 무리, 정예] · seats = 한 종류의 기준 인원. 이름은 모두 G.D.F.mon에 있는 것 (dive_rules가 본다)
  const look = { furn: { fight: ['bones', 'crate', 'debris', 'brokenpillar', 'statue'], elite: ['bones', 'brokenpillar', 'statue', 'debris', 'bones'], event: ['statue', 'urn', 'rug', 'altar'],
      camp: ['bedroll', 'bedroll', 'barrel', 'crate'], shop: ['table', 'crate', 'barrel', 'rug'], treasure: ['urn', 'urn', 'crate'], boss: ['brokenpillar', 'statue', 'bones', 'debris', 'brokenpillar'], start: ['crate', 'debris', 'statue'] },
    rooms: { near: 0.35, event: 0.3, elite: 0.2 }, paths: { trap: 3, dark: 2, locked: 2 }, events: null };
  const ZONES = [
    { id: 'crypt', n: '지하 묘지', floors: [5, 6], seats: [3, 3], lv: [5, 6], budget: [[24, 36, 48, 60], [30, 44, 58, 72]],
      cost: { 해골: 1, 좀비: 1, 구울: 4, 가스트: 9, '오우거 좀비': 9, 미라: 14, 와이트: 14 },
      packs: [{ n: '해골 무리', u: ['해골'] }, { n: '걷는 시체', u: ['좀비', '해골'] }, { n: '굶주린 것', u: ['구울'] }, { n: '묘지기', u: ['구울', '해골'] }],
      elites: [{ n: '걷는 시체', u: ['오우거 좀비', '좀비'] }, { n: '굶주린 것', u: ['가스트', '구울'] }],
      gate: { n: '묘지의 문지기', u: [['미라', 1], ['해골', 2]] }, boss: { n: '묘지의 주인', u: [['와이트', 1], ['가스트', 1], ['구울', 2]] },
      shape: { rooms: [['rect', 0.4], ['hall', 0.3], ['cross', 0.2], ['round', 0.1]], big: [['hall', 0.6], ['cross', 0.4]], pair: 0.6, frames: ['tall', 'wide', 'square'] }, ...look },
    { id: 'temple', n: '숭배자의 신전', floors: [7, 8], seats: [3, 3], lv: [7, 8], budget: [[40, 60, 80, 100], [50, 72, 95, 120]],
      cost: { 광신도: 0.5, '코볼트 전사': 0.5, '수련 사제': 1, 사제: 9, 광신자: 9, '붉은 새끼 용': 22 },
      packs: [{ n: '광신도 무리', u: ['광신도', '수련 사제'] }, { n: '코볼트 무리', u: ['코볼트 전사'] }, { n: '신전 수호', u: ['광신자', '광신도'] }, { n: '사제단', u: ['사제', '광신도'] }],
      elites: [{ n: '용을 섬기는 자', u: ['붉은 새끼 용', '코볼트 전사'] }, { n: '사제단', u: ['광신자', '사제'] }],
      gate: { n: '신전 문지기', u: [['붉은 새끼 용', 1], ['광신자', 2]] }, boss: { n: '대사제와 새끼 용', u: [['붉은 새끼 용', 2], ['사제', 1]] },
      shape: { rooms: [['hall', 0.4], ['cross', 0.3], ['rect', 0.3]], big: [['hall', 0.7], ['cross', 0.3]], pair: 0.8, frames: ['tall', 'wide', 'square'] }, ...look },
    { id: 'lair', n: '용의 둥지', floors: [9, 10], seats: [3, 3], lv: [9, 10], budget: [[60, 90, 120, 150], [70, 100, 130, 160]],
      cost: { '코볼트 전사': 0.5, 광신자: 9, '붉은 새끼 용': 22, 트롤: 36, '어린 붉은 용': 118, '붉은 성룡': 360 },
      packs: [{ n: '새끼 용', u: ['붉은 새끼 용', '코볼트 전사'] }, { n: '둥지의 하인', u: ['광신자', '코볼트 전사'] }, { n: '굴의 짐승', u: ['트롤'] }],
      elites: [{ n: '어린 용', u: ['어린 붉은 용', '코볼트 전사'] }, { n: '굴의 짐승', u: ['트롤', '붉은 새끼 용'] }],
      gate: { n: '둥지 입구', u: [['어린 붉은 용', 1], ['붉은 새끼 용', 1]] }, boss: { n: '붉은 성룡', u: [['붉은 성룡', 1]] },
      shape: { rooms: [['cave', 0.5], ['round', 0.3], ['hall', 0.2]], big: [['round', 0.7], ['hall', 0.3]], pair: 0.2, frames: ['blob', 'diag', 'square'], cave: true }, ...look },
  ];
  const LAST = 10; // 마지막 층 (붉은 성룡)
  // 층 설계서 (2026-11-23, 1 · 2층 고블린 굴): 손으로 짠 방(js/explore/rooms.js)으로 「어느 방이 큰길 · 갈래 · 곁방의 어디에, 어떤 관문 뒤에」를 정한다.
  // 생성기(RUN.gen)는 키운 던전에서 이것을 만족하는 방 · 길을 고른다 (씨앗마다 모양은 다르고 구성은 같다). c = 템플릿 후보 (앞이 먼저 — 방 크기가 안 맞으면 뒤의 같은 종류로)
  const FIGHTS = ['g_stalag', 'g_collapse', 'g_post', 'g_colonnade', 'g_pool', 'g_barracks', 'g_wolfpen'], EVENTS_T = ['g_shrine', 'g_ossuary', 'g_mushroom'];
  const TREAS = ['g_hoard', 'g_hoard_cave', 'g_vault'], CAMPS = ['g_camp', 'g_camp_spring', 'g_camp_wide'], ELITES = ['g_wolfden', 'g_wargs', 'g_hob_barracks', 'g_bugbear'];
  const first = (id, list) => [id, ...list.filter(x => x !== id)];
  // 초반 사다리 (2026-11-23 — 새 저장 = 1레벨 파이터 혼자): enc = 그 칸의 적 구성 덮어쓰기 (손으로 짠 방의 몬스터 자리 · 지형은 그대로, 기존 게임은 그대로). 값은 어림 (균형은 코어가 선 뒤에 한꺼번에)
  const E = (n, ...u) => ({ n, u }), ENC = {
    1: { short: [E('굴의 짐승', ['거대 쥐', 1])], long: [E('고블린 무리', ['고블린', 1])], mid: [E('고블린 무리', ['고블린', 1])], deep: [E('굴의 짐승', ['거대 쥐', 1])],
      elite: [E('고블린 무리', ['고블린', 2])], boss: [E('굴 문지기', ['홉고블린', 1])] },
    2: { a: [E('고블린 무리', ['고블린', 1])], heavy: [E('고블린 무리', ['고블린', 2])], b: [E('고블린 무리', ['고블린', 2])], elite: [E('고블린 무리', ['고블린', 2])], boss: [E('고블린 무리', ['버그베어', 1])] },
  };

  // ── 열쇠가 걸린 자리 (조립용 부품, 2026-11-23): 사건 · 손으로 짠 방처럼 목록으로 두고 층 설계서가 가져다 쓴다 ──
  //   kind = 들어가는 길의 관문 (locked · dark · trap · hidden · open) · lock = 자물쇠 종류 (lock 따기 · 부수기 · 열림 / bars 창살 따기 · 부수기 / seal 마법 봉인 열림만 · 마법 탐지로 미리 앎 / rubble 무너진 길 부수기만)
  //   dc · beyond = 너머의 방 종류 · ev = 사건 · sleep = 잠든 무리(미리 알면 기습) · c = 쓸 수 있는 방 생김새(템플릿 후보) · zone = 어울리는 구역 · keys = 이 자리를 푸는 열쇠 (여덟 중)
  const PARTS = {
    vault: { n: '잠긴 보물고', kind: 'locked', lock: 'lock', dc: 15, beyond: 'treasure', c: TREAS, zone: 'goblin', keys: ['따기', '부수기', '열림'] },
    bars: { n: '창살 우리', kind: 'locked', lock: 'bars', dc: 12, beyond: 'event', ev: 'captive', c: EVENTS_T, zone: 'goblin', keys: ['부수기', '따기'] },
    hidden: { n: '숨은 방', kind: 'hidden', beyond: 'treasure', c: TREAS, zone: 'goblin', keys: ['조사'] },
    trapway: { n: '함정 복도', kind: 'trap', beyond: 'elite', c: ELITES, zone: 'goblin', keys: ['함정'] },
    seal: { n: '마법 봉인', kind: 'locked', lock: 'seal', beyond: 'treasure', c: TREAS, zone: 'goblin', keys: ['열림', '미리 알기'] },
    rubble: { n: '무너진 길', kind: 'locked', lock: 'rubble', dc: 13, beyond: 'fight', c: FIGHTS, zone: 'goblin', keys: ['부수기'] },
    sleepers: { n: '잠든 무리', kind: 'open', beyond: 'elite', sleep: true, c: ELITES, zone: 'goblin', keys: ['미리 알기'] },
    wounded: { n: '쓰러진 탐사대원', kind: 'open', beyond: 'event', ev: 'wounded', c: EVENTS_T, zone: 'goblin', keys: ['치료'] },
    darkcave: { n: '어두운 굴', kind: 'dark', beyond: 'fight', c: FIGHTS, zone: 'goblin', keys: ['빛'] },
    // 어두운 방 (2026-11-23, 사용자: 「횃불은 어두운 길과 어두운 방에서 한개씩」): 길은 열려 있고 방이 어둡다 — 빛(직업 스킬 · 전원 암시야) 또는 횃불 1. 없이 들어가면 엔진의 어둠으로 싸우고(파티 횃불 · 벽 횃불 없음) 그 방 조사는 못 한다
    darkroom: { n: '어두운 방', kind: 'open', dark: true, beyond: 'fight', chest: true, c: FIGHTS, zone: 'goblin', keys: ['빛'] },
  };
  const part = (id, o = {}) => { const P = PARTS[id]; return { t: P.beyond, c: P.c, gate: P.kind, lock: P.lock, dc: P.dc, ev: P.ev, sleep: P.sleep, dark: P.dark, chest: P.chest, part: id, name: P.n, ...o }; };
  const bare = (id, o = {}) => { const q = part(id, o); delete q.c; if (!o.c) delete q.c; return q; }; // 손으로 짠 방 없이 (3~10층 — 생성기의 방에 부품만)
  const SPECS = {
    // 1층: 입구에서 가까운 두 방(갈래)은 관문 없이 거대 쥐 1 — 첫 판이 튜토리얼. 열쇠 자리: 잠긴 보물고 · 창살 우리(포로) · 숨은 방 · 함정 복도(정예, 숨은 통로로 왕좌) · 어두운 굴(큰길 — 빛 없이도 지나간다)
    1: { main: [{ t: 'start', c: ['g_entry'] }, { fork: [{ t: 'fight', c: first('g_post', FIGHTS), tier: 'light', enc: ENC[1].short }, { t: 'fight', c: first('g_barracks', FIGHTS), chest: true, enc: ENC[1].short }] }, { t: 'fight', c: first('g_stalag', FIGHTS), enc: ENC[1].mid }, { ...part('darkcave'), c: first('g_wolfpen', FIGHTS), enc: ENC[1].deep }, { t: 'camp', c: first('g_camp', CAMPS) }, { t: 'boss', c: ['g_throne'], enc: ENC[1].boss }],
      sides: [part('vault', { c: first('g_hoard', TREAS), at: 'mid', see: true }), part('bars', { c: first('g_shrine', EVENTS_T), at: 'mid' }), part('hidden', { c: first('g_hoard_cave', TREAS), at: 'mid' }), part('trapway', { c: first('g_wolfden', ELITES), at: 'back', hid: 'boss', enc: ENC[1].elite })] },
    // 2층: 마법 봉인 · 무너진 길 · 잠든 무리 · 쓰러진 탐사대원 · 어두운 굴(큰길)
    2: { main: [{ t: 'start', c: ['g_entry'] }, { t: 'fight', c: first('g_colonnade', FIGHTS), enc: ENC[2].a }, { fork: [{ t: 'fight', c: first('g_pool', FIGHTS), tier: 'heavy', chest: true, enc: ENC[2].heavy }, { t: 'event', c: first('g_mushroom', EVENTS_T) }] }, { ...part('darkcave'), c: first('g_collapse', FIGHTS), enc: ENC[2].b }, { t: 'camp', c: first('g_camp_spring', CAMPS) }, { t: 'boss', c: ['g_throne'], enc: ENC[2].boss }],
      sides: [part('seal', { c: first('g_vault', TREAS), at: 'back' }), part('rubble', { c: first('g_stalag', FIGHTS), at: 'mid', enc: ENC[2].a }), part('sleepers', { c: first('g_bugbear', ELITES), at: 'mid', enc: ENC[2].elite }), part('wounded', { c: first('g_ossuary', EVENTS_T), at: 'front' }), part('darkroom', { c: first('g_barracks', FIGHTS), at: 'mid', enc: ENC[2].a })] },
  };
  // 3~10층 (2026-11-23): 구역마다 손으로 짠 방이 없으니 생성기의 방에 열쇠 부품만 설계서로 놓는다. 층마다 열쇠 3~5종을 달리 — 데려갈 직업이 바뀌게. 깊을수록 갈림길 · 곁방이 는다
  //   적은 구역 표(RUN.zone — 폐성채 = 병기 · 녹 괴물, 묘지 = 언데드, 신전 = 광신도 · 새끼 용, 둥지 = 붉은 용 · 트롤)가 고른다 — 상성은 거기서 산다
  { const F_ = { t: 'fight' }, EV = { t: 'event' }, CP = { t: 'camp' }, BS = { t: 'boss' }, ST = { t: 'start' }, EL = { t: 'elite' };
    const fork = (a, b) => ({ fork: [a, b] }), heavy = { t: 'fight', tier: 'heavy', chest: true }, light = { t: 'fight', tier: 'light' };
    const DEEP = {
      3: { main: [ST, F_, fork(heavy, EV), bare('darkcave'), CP, BS], sides: [bare('vault', { at: 'mid' }), bare('rubble', { at: 'front' }), bare('trapway', { at: 'back' })] },
      4: { main: [ST, F_, fork(heavy, EV), F_, CP, BS], sides: [bare('bars', { at: 'front' }), bare('seal', { at: 'back' }), bare('darkroom', { at: 'mid' }), bare('sleepers', { at: 'mid' })] },
      5: { main: [ST, fork(heavy, EV), F_, fork(light, EL), CP, BS], sides: [bare('hidden', { at: 'mid' }), bare('darkroom', { at: 'front' }), bare('wounded', { at: 'mid' }), bare('trapway', { at: 'back' })] },
      6: { main: [ST, fork(heavy, EV), bare('darkcave'), fork(light, EL), CP, BS], sides: [bare('seal', { at: 'mid' }), bare('sleepers', { at: 'back' }), bare('vault', { at: 'front' }), bare('darkroom', { at: 'mid' })] },
      7: { main: [ST, fork(heavy, EV), F_, fork(light, EL), CP, BS], sides: [bare('bars', { at: 'front' }), bare('trapway', { at: 'mid' }), bare('hidden', { at: 'back' }), bare('seal', { at: 'mid' })] },
      8: { main: [ST, fork(heavy, EV), bare('darkcave'), fork(light, EL), CP, BS], sides: [bare('rubble', { at: 'front' }), bare('darkroom', { at: 'mid' }), bare('wounded', { at: 'mid' }), bare('sleepers', { at: 'back' })] },
      9: { main: [ST, fork(heavy, EV), F_, fork(light, EL), CP, BS], sides: [bare('vault', { at: 'front' }), bare('seal', { at: 'back' }), bare('trapway', { at: 'mid' }), bare('darkroom', { at: 'mid' })] },
      10: { main: [ST, fork(heavy, EV), bare('darkcave'), fork(light, EL), CP, BS], sides: [bare('sleepers', { at: 'mid' }), bare('rubble', { at: 'front' }), bare('bars', { at: 'mid' }), bare('seal', { at: 'back' })] },
    };
    Object.assign(SPECS, DEEP);
    // 층을 길게 (2026-11-26 사용자: 「탐험과 전투가 너무 짧아」): 야영 앞에 방을 더한다 — 1층 전투 하나 · 2~4층 갈래와 전투 · 5~8층 전투 둘 · 9~10층 전투 하나. grow = 키울 방의 수 (생성기)
    for (const k in SPECS) { const fl = +k, L = SPECS[k].main, i = L.findIndex(q => q.t === 'camp'), fk = { fork: [{ ...light, c: FIGHTS, enc: ENC[fl]?.a }, { ...EV, c: EVENTS_T }] }, ft = { ...F_, c: FIGHTS, enc: ENC[fl]?.mid || ENC[fl]?.b };
      for (const q of [fk.fork[0], fk.fork[1], ft]) { if (fl > 2) delete q.c; if (!q.enc) delete q.enc; }
      SPECS[k] = { ...SPECS[k], grow: 15, main: [...L.slice(0, i), ...(fl === 1 || fl > 8 ? [ft] : fl < 5 ? [fk, ft] : [ft, { ...ft }]), ...L.slice(i)] }; } }


  // 직업이 열리는 차례 (파이터 · 클레릭으로 시작). 엔진 직업 id — js/game/party.js CLASSES
  const CLS = ['dragoon', 'cleric', 'mage', 'rogue', 'paladin', 'archer', 'barbarian', 'bard', 'warlock', 'monk', 'archmage', 'scout'];
  // 해금 트리: 단계마다 값 (배열 길이 = 살 수 있는 횟수). 다 사면 끝 — 합계는 total(). 수치는 시험값
  const TREE = [
    { id: 'seat', br: 'party', n: '파티 자리', cost: [250, 1500], val: s => `${2 + s}명` },
    { id: 'cls', br: 'party', n: '영웅 들이기', cost: [20, 80, 200, 350, 500, 700, 900, 1150, 1450, 1800, 2200], val: s => `${1 + s}직업` }, // 레벨 줄은 없앴다 — 레벨은 경험치로 · 첫 값 20 = 1레벨 혼자 첫 판(전투 2~3번 · 금화 20~30)으로 둘째 영웅 (2026-11-23)
    // 탐험 해금: 탐사 규칙에 이미 있는 열쇠 — 시작 물자로 들고 간다
    { id: 'torch', br: 'supply', n: '횃불', cost: [30, 200], val: s => `${1 + s}개` },
    { id: 'camp', br: 'supply', n: '야영 물자', cost: [100, 450, 1400], val: s => `${Math.min(4, 1 + s)}개` }, // 챙길 수 있는 최대 (2026-11-23 — 옛 「계단 야영」 단계를 그대로 옮김, 계단 회복은 없앴다)
    { id: 'bag', br: 'supply', n: '짐 칸', cost: [150, 600, 1800], val: s => `+${s * TUNE.BAG_STEP}칸` }, // 파티 짐 (2026-11-23)
    { id: 'spd', br: 'party', n: '배속', cost: [30, 400], val: s => `×${[1, 2, 4][s]}` }, // 화면의 ×1 · ×2 · ×4 = 엔진 배속 2 · 4 · 8 (speeds) — 작은 창으로 곁눈질해도 지루하지 않게 기본을 엔진 ×2로
  ];
  const CAMP = [0, 30, 60, 100, 100];
  const BRANCH = [{ id: 'supply', n: '보급' }, { id: 'party', n: '원정대' }]; // 해금 갈래 (전술 갈래는 정해지면 — 2026-11-23)
  // ── 죽음의 값 · 파티 짐 (2026-11-23) — 시험값은 이 표 하나 ──
  //   REVIVE_K: 부활 값 = 이것 × 레벨 · BAG_BASE: 짐 기본 칸 · BAG_STEP: 「짐 칸」 해금 한 단계 · SUP: 물자 하나 값(출발 때) · 힘 수정치(0 이상)만큼 영웅마다 칸이 는다
  const TUNE = { REVIVE_FREE_LV: 3, REVIVE_K: 25, BAG_BASE: 4, BAG_STEP: 2, SUP: { torch: 5, camp: 30 }, RAID: 0.2, HIT: { pc: 5, mon: 3 }, SMALL_ROOMS: true, FIT_W: 1, FIT_H: 0.95, PACE: 0.7, RT_ROUND: 4.2, RT_WALK: 2.4, RT_LUNGE: 700, RT_DMG: 0.3, WAVE: { fight: 2, elite: 1.5, max: 4, pay: 1.2 }, /* 전투 빠르기 (2026-11-25 사용자: 「너무 빨리 걷고 너무 빨리 때려」) — 게임 초 기준, 화면의 ×1은 1.4배라 한 라운드 3.0초 · 걷기 초당 3.4칸 · 휘두르기 0.5초 */ TELE: 1, /* TELE: 실시간 예고 동작의 준비 (라운드 — G.MonAct.teleTick) */ // RT_DMG: 실시간에서만 양쪽이 주고받는 피해 배율 (2026-11-24 시험값 — 사용자: 「한 방에서 싸움은 15초 정도로」, 라운드 박자는 그대로 두고 라운드 수를 늘린다)
    VIEW_K: 0.87 }; /* VIEW_K: 작은 방 모드의 화면 배율 (2026-11-24 사용자: 「캐릭터는 조금 더 줄여야」 — 인형 45px → 39px쯤, 예전 전투 33px와의 사이) */ // SMALL_ROOMS: 작은 방 · PACE: ×1의 빠르기 배율 (2026-11-24 — 0.7 = 30% 느리게) // HIT: 원정의 명중 보정 (d20에 더함) — 실측 영웅 60% · 몬스터 40%라 빗나감이 절반이었다 (2026-11-24, 시험값) // 물자는 야영 물자 · 횃불 둘 (치유 물약은 원정에서 없앴다) · RAID: 안전하지 않은 방에서 야영할 때 이웃한 안 치운 적 무리마다 습격 확률 // 도둑 도구 · 열림 두루마리는 없앴다 (자물쇠 따기 = 로그의 스킬, 열림 = 주문 스킬)
  const SUP_KEYS = ['torch', 'camp']; // 계단 야영: 살아 있는 사람의 최대 체력 대비 회복 (4단계는 주문 슬롯 · 기술 횟수도 — 긴 휴식)
  const byId = id => TREE.find(t => t.id === id);
  // autoOn: 자동 재출발 (2026-11-25부터 기본 끔 — 지도 화면에서 켠다) · rec: 최근 원정 [금화, 분] (자리 비운 동안의 정산) · seen: 마지막으로 본 시각(ms)
  // dex: 도감 — m: 몬스터 이름 → { met: 만난 수, kill: 잡은 수 } · h: 빌드 id → 데리고 나간 원정 수
  // roster: 직업 → 영웅 { m: 엔진 사람(JSON) · tr: 끼고 있는 마법 물건들 } (직업마다 한 명) · start: 고른 출발 층 (0 = 자동) · last: 지난 판 { start, cleared }
  // dex.i: 아이템 도감 (SRD 마법 물건 id → 얻은 수)
  // trail · fail: 층 → 지난 판에 간 방 줄 · 못 연 길 번호 · shown: 층 → 지도 화면에서 마지막으로 보여 준 기억 (새로 밝힌 방을 한 번만 그려 보이려고)
  // mapSeed: 층 지도의 기준 씨앗 (층 N의 지도 = floorSeed(이것, N)) · maps: 층 → 지도 기억 { n: 방마다 16진 한 자(정보 0~3 | 들어감 4 | 종류 봄 8), e: 길마다 32진 한 자(지나감 1 | 잠김 2 | 어두움 4 | 함정 8 | 숨은 통로 16) } · plan: 층 → 경로(방 번호 줄)
  // fv: 층 설계서 판 — 설계서가 생긴(바뀐) 층(SPEC_FL)의 지도 기억 · 경로를 옛 저장에서 비운다 (나머지는 그대로)
  const FV = 4, SPEC_FL = [1, 2]; // FV 4 (2026-11-26): 층을 길게 — 모든 층의 지도가 바뀌었다. // FV 3 (2026-11-24): 작은 방의 1칸 = 2타일 (지도 칸은 같지만 방 안 위치 · 문이 달라진다) — 다시 모든 층을 비운다 // FV 2 (2026-11-24): 작은 방으로 모든 층의 지도가 바뀌었다 — 옛 지도 기억 · 경로 · 사건 · 야영 계획을 모든 층에서 비운다
  const newSeed = () => (Math.random() * 4294967296) >>> 0;
  // 기본 설정 (2026-11-25 사용자: 「기본 옵션들을 배틀하트방식으로」): 실시간 · 넷 모두 끌어 조종 · 스킬은 손으로 · 한 판 끝나면 길드로(자동 재출발 끔) · 그린 경로를 다 돌면 귀환 · 위험해도 저절로 물러나지 않는다
  const BASE = { rt: true, rtAuto: false, hand: false, autoOn: false, endMode: 'back', risk: false, bh: 1 };
  const fresh = () => ({ v: 3, mapSeed: newSeed(), maps: {}, plan: {}, trail: {}, fail: {}, shown: {}, gold: 0, deep: 0, runs: 0, wins: 0, up: {}, party: ['dragoon'], roster: {}, start: 0, last: null, rec: [], seen: 0, dex: { m: {}, h: {}, i: {} }, fv: FV, cls0: 1, evs: {}, evPlan: {}, dead: {}, bag: { torch: 1, camp: 1 }, campPlan: {}, fullBack: false, deadStop: true, ...BASE });
  // v1 · v2(영웅이 판마다 새로 만들어지던 때) 저장은 구조가 달라 새로 시작한다 — 망가진 저장에도 죽지 않는다
  const load = raw => { try { const o = JSON.parse(raw || '{}'); if (o.v !== 3) return fresh(); const s = { ...fresh(), ...o, ...(o.bh ? {} : BASE) }; /* bh 없는 옛 저장은 새 기본 설정으로 한 번 바꾼다 */ s.up = { ...s.up }; s.roster = { ...(o.roster || {}) }; s.rec = [...(o.rec || [])]; s.dex = { m: { ...(o.dex?.m || {}) }, h: { ...(o.dex?.h || {}) }, i: { ...(o.dex?.i || {}) } }; s.maps = { ...(o.maps || {}) }; s.plan = { ...(o.plan || {}) }; s.trail = { ...(o.trail || {}) }; s.fail = { ...(o.fail || {}) }; s.shown = { ...(o.shown || {}) }; if (!o.mapSeed) s.mapSeed = newSeed(); s.evs = JSON.parse(JSON.stringify(o.evs || {})); s.evPlan = JSON.parse(JSON.stringify(o.evPlan || {})); s.campPlan = { ...(o.campPlan || {}) }; if (o.cls0 === undefined) s.cls0 = 2; s.dead = { ...(o.dead || {}) }; s.bag = o.bag ? { ...o.bag } : null; /* 옛 저장: 사망자 없음 · 짐 = 해금한 만큼 다 */ if ((o.fv || 0) < FV) { const fls = (o.fv || 0) < 3 ? null : SPEC_FL; for (const k of ['maps', 'plan', 'trail', 'fail', 'shown', 'evs', 'evPlan', 'campPlan']) { if (!s[k]) continue; if (fls) for (const fl of fls) delete s[k][fl]; else s[k] = {}; } s.fv = FV; } return s; } catch (e) { return fresh(); } };
  const dump = s => JSON.stringify(s);
  const step = (s, id) => s.up[id] || 0;
  const cost = (s, id) => { const t = byId(id); return t && step(s, id) < t.cost.length ? t.cost[step(s, id)] : null; }; // null = 다 샀다
  function buy(s, id) { const c = cost(s, id); if (c == null || s.gold < c) return false; s.gold -= c; s.up[id] = step(s, id) + 1; return true; }
  const total = () => TREE.reduce((a, t) => a + t.cost.reduce((x, y) => x + y, 0), 0);
  const complete = s => TREE.every(t => step(s, t.id) >= t.cost.length);
  // 지금 값
  const seats = s => 2 + step(s, 'seat'), classes = s => CLS.slice(0, Math.max(1, step(s, 'cls') + (s.cls0 ?? 1))); // 새 저장은 파이터 하나로 시작 (cls0 1) · 옛 저장은 둘로 시작했다 (cls0 2 — 열린 직업 그대로)
  const camp = s => 0 /* 계단 회복 없음 — 회복은 야영뿐 */, speeds = s => [2, 4, 8].slice(0, 1 + step(s, 'spd'));
  // 들고 가는 물자 (탐사 규칙의 st.items 이름)
  const kit = s => ({ torch: 1 + step(s, 'torch'), camp: Math.min(4, 1 + step(s, 'camp')) });
  // 나갈 파티: 고른 직업 중 열린 것만, 자리 수까지 (비면 파이터 · 클레릭)
  // 사망한 영웅은 되살릴 때까지 나가지 못한다 (모두 죽었으면 빈 파티 — 길드가 출발을 막는다)
  function team(s) { const open = classes(s).filter(c => !s.dead?.[c]), t = [...new Set(s.party)].filter(c => open.includes(c)).slice(0, seats(s)); return t.length ? t : (s.party.length ? open.slice(0, Math.min(2, seats(s))) : ['dragoon', 'cleric']); }
  function toggle(s, cls) { if (s.dead?.[cls]) return; const t = team(s), i = t.indexOf(cls); if (i >= 0) { if (t.length > 1) t.splice(i, 1); } else if (classes(s).includes(cls)) { if (t.length >= seats(s)) t.pop(); t.push(cls); } s.party = t; }
  // 깬 층 보너스: 우두머리를 잡고 내려갈 때마다 (깊을수록 많이 — 용은 승리 몫까지)
  const bonus = fl => Math.round(20 * Math.pow(1.6, fl - 1)) + (fl === LAST ? 1500 : 0);
  const bonusTo = (fl, from = 1) => { let g = 0; for (let i = from; i <= fl; i++) g += bonus(i); return g; }; // from = 출발 층 (깊이 출발했으면 건너뛴 층은 치지 않는다)
  // ── 출발 층: 구역 첫 층 (1 · 3 · 5 · 7 · 9). 그 앞 구역을 깬 적이 있으면 열린다 ──
  const STARTS = [1, 3, 5, 7, 9];
  const starts = s => STARTS.filter(x => x === 1 || s.deep >= x - 1);
  // 자동: 열린 가장 깊은 곳 — 지난 판이 그 출발 구역도 못 깨고 끝났으면 한 구역 위에서
  function autoStart(s) { const L = starts(s), best = L[L.length - 1], l = s.last; if (l && l.cleared < l.start + 1) return Math.min(best, Math.max(1, l.start - 2)); return best; }
  const startFloor = s => (s.start && starts(s).includes(s.start) ? s.start : autoStart(s));
  // 원정이 끝났다: cleared = 깬 층 수 · earned = 판에서 번 금화 (전멸해도 번 만큼은 들어온다) → 길드에 들어온 금화
  // min: 걸린 분 (있으면 정산용 기록에 — 최근 REC판)
  // start: 출발 층 · xp: 이번 판에 영웅 한 명이 번 평균 경험치 (정산용)
  // 사망 · 부활: 부활 값 = REVIVE_K × 레벨. 금화가 모자라도 되살리고 모자란 만큼 빚(음수 금화) — 빚이 있으면 살 수 없고, 버는 금화가 먼저 빚을 갚는다
  const reviveCost = (s, cls) => { const lv = s.roster[cls]?.m?.lv || START_LV; return lv < TUNE.REVIVE_FREE_LV ? 0 : TUNE.REVIVE_K * lv; }; // 3레벨 미만은 공짜
  function raise(s, cls) { if (!s.dead?.[cls]) return false; s.gold -= reviveCost(s, cls); delete s.dead[cls]; return true; }
  const deadList = s => Object.keys(s.dead || {}).filter(c => s.dead[c]);
  // 짐: 칸 = 기본 + 해금 + 나가는 영웅마다 max(0, 힘 수정치). 물자(하나에 한 칸)와 원정 중 주운 장비 · 마법 물건(하나에 한 칸)이 같은 칸을 쓴다 — 금화는 칸을 쓰지 않는다
  const strMod = m => Math.floor(((m?.ab?.str ?? 10) - 10) / 2);
  const bagCap = (s, t = team(s)) => TUNE.BAG_BASE + step(s, 'bag') * TUNE.BAG_STEP + t.reduce((a, c) => a + Math.max(0, strMod(s.roster[c]?.m)), 0);
  const supMax = s => kit(s); // 해금 = 챙길 수 있는 최대 개수
  const bagPlan = s => { const mx = supMax(s), b = s.bag || Object.fromEntries(SUP_KEYS.map(k => [k, Math.ceil(mx[k] / 2)])), o = {}; /* 옛 저장: 해금 최대의 절반(올림) */ for (const k of SUP_KEYS) o[k] = Math.max(0, Math.min(mx[k], b[k] ?? mx[k])); return o; };
  const supCost = o => SUP_KEYS.reduce((a, k) => a + TUNE.SUP[k] * (o[k] || 0), 0);
  // 출발할 때 챙긴다: 칸 · 금화가 허락하는 만큼 (빚이 있으면 값이 드는 것은 못 산다). 금화를 내고 실제로 챙긴 개수를 돌려준다
  function pack(s, t = team(s)) {
    const want = bagPlan(s), cap = bagCap(s, t), got = { torch: 0, camp: 0, potion: 0, knockScroll: 0, tools: 0, seeScroll: 0 }; let used = 0; // 두루마리 · 도구는 0 (없앴다)
    for (const k of SUP_KEYS) for (let i = 0; i < want[k] && used < cap; i++) { const c = TUNE.SUP[k]; if (c && s.gold < c) break; s.gold -= c; got[k]++; used++; }
    return got;
  }
  // ── 야영 (2026-11-23): 야영 물자 1개 = 체력 전부 · 탐험 스킬 쿨타임 전부 (전투 쪽은 엔진의 긴 휴식). 야영 방은 안전, 그 밖의 치운 방은 이웃한 안 치운 적 무리마다 RAID 확률로 습격 ──
  //   어디서 쉴지는 지도에서 정한다 (s.campPlan[층] = 방 번호들). 계획이 없으면 체력 평균 절반 아래 + 물자가 있을 때 지금 방에서
  const raidRisk = (map, id) => { const n = map.nodes[id]; if (n.type === 'camp') return 0; const k = map.edges.filter(e => (e.a === id || e.b === id)).map(e => map.nodes[e.a === id ? e.b : e.a]).filter(q => q.hostile && !q.visited).length; return 1 - Math.pow(1 - TUNE.RAID, k); };
  const canCamp = (st, id = st.at) => (st.items.camp || 0) > 0 && !st.map.nodes[id].hostile;
  // 쉰다 → { raid: 습격한 무리 이름 | null }. 습격이면 체력은 절반만 돌아오고 그 무리가 깬다
  function campHere(st, members = null) {
    if (!canCamp(st)) return null; const id = st.at, map = st.map, k0 = st.items.camp; st.items.camp--;
    const foes = map.edges.filter(e => e.a === id || e.b === id).map(e => map.nodes[e.a === id ? e.b : e.a]).filter(q => q.hostile && !q.visited && map.nodes[id].type !== 'camp'), hit = foes.find(() => st.rng() < TUNE.RAID);
    for (const m of st.party) if (!m.dead) m.hp = hit ? Math.min(m.max, m.hp + Math.ceil((m.max - m.hp) / 2)) : m.max;
    st.xcd = {}; if (members && !hit) G.Res.longRest(members); st.camped = st.camped || {}; st.camped[`${st.floor}:${id}`] = true;
    if (hit) { hit.alert = true; st.log.push({ t: `야영 중 습격 · ${hit.g?.label || '적'}`, k: 'dv' }); } else st.log.push({ t: `야영 · 물자 ${k0} → ${st.items.camp} · 체력 100%`, k: 'dv' });
    return { raid: hit ? hit.g?.label || '적' : null };
  }
  // 지금 쉴까: 계획한 야영 지점이거나(그 방 일이 끝난 뒤), 계획이 없고 체력 평균이 절반 아래일 때
  function wantCamp(s, st) { if (!canCamp(st) || st.camped?.[`${st.floor}:${st.at}`]) return false; const pl = s.campPlan?.[st.floor]; if (pl && pl.length) return pl.includes(st.at); return hurt(st) < 0.5; }
  // 원정 중 짐: 물자 개수 + 전리품(st.loot) — 가득 차면 값이 가장 낮은 전리품부터 두고 간다 (물자는 버리지 않는다)
  const supN = st => SUP_KEYS.reduce((a, k) => a + (st.items[k] || 0), 0);
  // ── 보석 (2026-11-23, 보물로만 — 팔기만): SRD 주문 재료의 보석 이름 · 값 단계 (값은 우리 금화 규모로, 시험값). 같은 보석은 한 칸에 GEM_STACK개까지
  const GEMS = [{ id: 'jade', n: '옥', g: 5 }, { id: 'pearl', n: '진주', g: 20 }, { id: 'diamond', n: '다이아몬드', g: 45 }, { id: 'bpearl', n: '흑진주', g: 70 }, { id: 'sapphire', n: '사파이어', g: 120 }, { id: 'bigdia', n: '큰 다이아몬드', g: 400 }], GEM_STACK = 5;
  const slotsOf = e => (e.gem ? Math.ceil((e.cnt || 1) / GEM_STACK) : 1);
  const bagUsed = st => supN(st) + (st.loot || []).reduce((a, e) => a + slotsOf(e), 0);
  const bagFull = st => bagUsed(st) >= (st.bagCap || 0);
  function stow(st, e) { st.loot = st.loot || []; const same = e.gem && st.loot.find(q => q.gem === e.gem); if (same) same.cnt = (same.cnt || 1) + (e.cnt || 1); else st.loot.push(e.gem ? { ...e, cnt: e.cnt || 1 } : e); const out = [];
    while (bagUsed(st) > (st.bagCap || 0) && st.loot.length) { const i = st.loot.reduce((b, q, j) => (q.gold < st.loot[b].gold ? j : b), 0), q = st.loot[i]; if (q.gem && q.cnt > 1) { q.cnt--; out.push({ ...q, cnt: 1 }); } else out.push(st.loot.splice(i, 1)[0]); } return out; } // 가득 차면 값이 낮은 것부터 (보석은 하나씩)
  const lootGold = st => (st.loot || []).reduce((a, e) => a + (e.gold || 0) * (e.gem ? e.cnt || 1 : 1), 0);
  // 보석 떨어뜨리기: 보물 방 · 상자 = 1~2개 · 정예 1 · 우두머리 2 — 층이 깊을수록 높은 단계 (두 단계 중 하나, 9층 이상은 드물게 큰 다이아몬드)
  function gemDrop(st, kind, rng = Math.random) { const fl = st.floor || 1, lo = Math.min(4, Math.floor((fl - 1) / 2)), n = kind === 'boss' ? 2 : kind === 'treasure' ? 1 + (rng() < 0.4 ? 1 : 0) : 1, out = [];
    for (let i = 0; i < n; i++) { const t = fl >= 9 && rng() < 0.08 ? 5 : lo + (rng() < 0.35 ? 1 : 0), G0 = GEMS[Math.min(5, t)]; out.push({ n: G0.n, gem: G0.id, gold: G0.g, r: 0, cnt: 1 }); } return out; }
  function finish(s, cleared, earned = 0, min = 0, start = 1, xp = 0) { const g = Math.max(0, Math.round(earned)) + bonusTo(cleared, start); if (min > 0) { s.rec.push([g, min, xp]); s.rec = s.rec.slice(-REC); } s.last = { start, cleared }; s.gold += g; s.runs++; s.deep = Math.max(s.deep, cleared); if (cleared >= LAST) s.wins++; return g; }

  // ── 엔진에 잇기 (옛 엔진 G — 화면 없이) ──
  // 처치 경험치: SRD 그대로(엔진의 XP_PACE ×3 · 훈련장 ×1.2를 XP_K로 상쇄 — 살아 있는 파티가 나눠 받는다) ÷ PACE(그 영웅의 레벨) × 따라잡기. 판 안에서 바로 오르고 고르기는 저절로 · 5~10층 구역을 탐사 구역 표에 더한다 (원정 모드에서만 부른다)
  // 필요 경험치 표(G.Guild.need)는 SRD 그대로 — 얻는 쪽을 PACE로 나눠 높은 레벨일수록 오래 걸리게. 시험값 (아래 PACE_LV · PACE_K, 따라잡기 · 쉬는 영웅 · 정산 값은 그 아래 주석)
  // 처치 금화: 쓰러뜨린 적마다 그 자리에서 판 금화에 (SRD 경험치 ÷ 20) — 전멸해도 한 일만큼은 남는다. cur = 지금 원정의 탐사 기록 (outfit이 건다)
  // ── 자리를 비운 동안의 정산 (브라우저는 가려지거나 닫힌 창을 멈춘다): 최근 원정들의 분당 금화 × 비운 시간 × AWAY_K, 상한 AWAY_CAP. 수치는 시험값 ──
  const REC = 5, AWAY_K = 0.1, AWAY_CAP = 4 * 3600e3, AWAY_MIN = 60e3; // 50% · 8시간으로 두니 3시간 비운 것만으로 세 영웅이 7→20레벨, 금화 7만 (깨어 30분이면 7레벨쯤 되는 게임이라) — 10% · 4시간 = 깨어 있는 24분어치까지
  const sumRec = (s, i) => s.rec.reduce((a, r) => a + (r[i] || 0), 0);
  const rate = s => { const m = sumRec(s, 1); return m > 0 ? sumRec(s, 0) / m : 0; }; // 분당 금화 (한 판도 안 끝냈으면 0)
  const xpRate = s => { const m = sumRec(s, 1); return m > 0 ? sumRec(s, 2) / m : 0; }; // 나간 영웅 한 명의 분당 경험치
  // 지금(now) 정산: 마지막으로 본 뒤 1분이 넘었으면 금화와 경험치(마지막에 나갔던 파티의 영웅마다 — 따라잡기 배율도)를 같은 비율로 주고 { ms, gold, xp, ups: [[이름, 전, 후]] } — 아니면 0. 어느 쪽이든 seen = now
  function settle(s, now) {
    const ms = s.seen ? Math.min(AWAY_CAP, Math.max(0, now - s.seen)) : 0, on = ms >= AWAY_MIN, gold = on ? Math.round(rate(s) * ms / 60e3 * AWAY_K) : 0, xp = on ? Math.round(xpRate(s) * ms / 60e3 * AWAY_K) : 0, ups = [];
    s.seen = now; s.gold += gold;
    if (xp) { const hs = team(s).map(c => s.roster[c]?.m).filter(Boolean), top = Math.max(0, ...hs.map(m => m.lv)); for (const m of hs) { const lv0 = m.lv; gain(m, xp * catchK(m.lv, top)); if (m.lv > lv0) ups.push([m.name, lv0, m.lv]); } }
    return { ms, gold, xp, ups };
  }
  // ── 도감: 원정에 나올 수 있는 몬스터 전부(1~10층 구역 표 — hook 뒤에 부른다) · 직업 × 빌드 ──
  const dexMons = () => { const out = [], seen = new Set(); for (const z of (typeof RUN !== 'undefined' ? RUN.ZONES : [])) for (const n0 of [...Object.keys(z.cost), ...z.gate.u.map(u => u[0]), ...z.boss.u.map(u => u[0])]) { const n = G.Encounter.monName(n0); if (!seen.has(n)) { seen.add(n); out.push({ n, z: z.n }); } } return out; };
  // ── 아이템 등급 (SRD 희귀도 — 엔진의 G.D.ARTS가 이미 r 1~4로 가진다: +1 무기 고급 · +2 희귀 · +3 매우 희귀, 갑옷은 한 단계 위) ──
  const RARITY = ['일반', '고급', '희귀', '매우 희귀', '전설'];
  const rOf = x => G.Gear.info(x).r || 0;
  // 원정의 희귀도 표 (시험값): 구역마다 [고급, 희귀, 매우 희귀, 전설]의 무게. 우두머리는 두 번 굴려 높은 쪽 (gear.js). 9~10층은 매우 희귀 · 전설이 실제로 나오게
  const R_TABLE = [[10, 2, 0, 0], [8, 4, 0.5, 0], [5, 5, 1.5, 0.1], [3, 5, 3, 0.5], [1, 4, 4, 1.5]];
  const R_UP = { elite: 1, treasure: 1 }; // 정예 · 보물 방은 한 구역 깊은 표로
  function pickR(floor, type, rng = Math.random) { const w = R_TABLE[Math.min(R_TABLE.length - 1, Math.floor((floor - 1) / 2) + (R_UP[type] || 0))]; let x = rng() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < 4; i++) if ((x -= w[i]) < 0) return i + 1; return 1; }
  const LOOT = []; // 이번 판에 주운 것들 { n, r, k, to: 낀 사람 이름 | null, gold: 판 값 } — 화면이 읽고 비운다
  const dexItems = () => Object.keys(G.D.ARTS).filter(k => G.D.ARTS[k].props?.length).map(k => ({ k, n: G.D.ARTS[k].n, r: G.D.ARTS[k].r || 1 })).sort((a, b) => a.r - b.r);
  const dexHeroes = () => G.Builds.LIST.filter(b => CLS.includes(b.cls) && !b.mc).map(b => ({ id: b.id, cls: b.cls, n: b.n }));
  const dexCount = s => { const M = dexMons(), H = dexHeroes(), I = dexItems(); return { got: M.filter(x => s.dex.m[x.n]?.met).length + H.filter(b => s.dex.h[b.id]).length + I.filter(x => s.dex.i[x.k]).length, all: M.length + H.length + I.length }; };
  let hooked = false, cur = null, curS = null, live = [], xp0 = []; // cur = 지금 원정의 탐사 기록 · curS = 그 저장 (도감을 적는다) — outfit이 건다 · live = 이번 판의 엔진 사람들(명단 차례) · xp0 = 출발 때 누적 경험치
  // 템포 (시험값, 2026-11-23): 화면 ×4 실제 원정 시간으로 3→5 약 10분 · 5→10 약 1시간 · 10→15 약 3시간 · 15→20 약 6시간.
  //   레벨 L의 목표 분(×4) T = 4 6 | 7 9 11 14 19 | 26 31 36 41 46 | 60 66 72 78 84 (3~19레벨) 과, 잰 분당 경험치(그 레벨의 4인 파티가 실제로 가는 층, SRD 단위 · ×4 — 1100 · 1277 · 2406 · 3197 · 5610 @ 3 · 5 · 8 · 11 · 14레벨 사이를 로그로 잇는다)로
  //   PACE(L) = T × 분당 경험치 ÷ need(L). 전체를 늘이고 줄이려면 PACE_K 하나만, 구간 모양은 PACE_LV 표만 고친다
  const PACE_LV = [1, 1, 1, 2.44, 1.87, 1.19, 1.58, 1.95, 2.41, 3.14, 3.6, 6.61, 6.94, 9.53, 10.32, 11.22, 12.34, 10.1, 10.94, 9.42, 9.42], PACE_K = 1; // 인덱스 = 레벨 (0~20)
  const pace = lv => PACE_K * (PACE_LV[Math.max(0, Math.min(20, lv))] || 1);
  const XP_K = 1 / 3.6, LV_MAX = 20, CATCH = 0.5, CATCH_CAP = 4, BENCH = 0.25, NEW_GAP = 2, START_LV = 1; // 새 저장 = 1레벨 파이터 혼자 (2026-11-23) · 새로 들이는 영웅 = (최고 − 2), 최소 1
  const catchK = (lv, top) => 1 + CATCH * Math.min(CATCH_CAP, Math.max(0, top - lv)); // 따라잡기 배율 (최고 레벨과의 차이)
  // 레벨업 고르기를 저절로 (첫 추천 — 능력치 향상 · 전투 방식 · 빌드 칸 · 주문)
  function autoPick(m, rng = Math.random) { const R = G.Reward; for (let i = 0; i < 300 && R.pending(m); i++) { const o = R.offer(m, rng); R.choose(m, o.kind === 'new' ? { kind: 'new' } : o.kind === 'swap' || !o.options.length ? 'keep' : o.options[0]); if (!o.options.length && o.kind !== 'new' && o.kind !== 'swap') break; } }
  // 경험치를 더하고 오를 만큼 오른다 (쉬는 영웅 · 정산 — 엔진 밖의 저장된 사람에게도)
  // x = PACE를 나누기 전 경험치 (쉬는 영웅 · 정산): 레벨마다 그 레벨의 PACE로 나눠 넣는다 — 여러 레벨을 한 번에 넘어도 높은 레벨일수록 덜 오른다
  function gain(m, x) { m.xp = m.xp || 0; while (x > 0 && m.lv < LV_MAX) { const cost = (G.Guild.needOf(m) - m.xp) * pace(m.lv); if (x < cost) { m.xp += Math.round(x / pace(m.lv)); break; } x -= cost; m.xp = 0; m.lv++; G.Guild.grow(m); } if (m.lv >= LV_MAX) m.xp = 0; autoPick(m); cardAuto(m); } // 쉬는 영웅 · 정산은 추천대로
  const totalXp = m => { let t = m.xp || 0; for (let l = 1; l < m.lv; l++) t += G.Guild.need(l); return t; };
  const TEXT_OK = /^[+\-]?[\d,.]+!?$|빗나|^회복|^Lv|레벨|^면역$|^저항$|^약점!$|^흡수/; // 치명타 숫자(「12!」) · 피해 종류 면역 · 저항 · 약점 · 흡수도 (파티 구성이 왜 통하고 안 통하는지 보이게 — 2026-11-23)
  const killGold = mo => Math.max(1, Math.round((G.Region.XP[mo.stat?.cr] || 10) / 20));
  // ── 전투 스킬의 자원 = 쿨타임 하나 (2026-11-23, 원정 모드에서만 — G.Res.cdOn) ──
  //   주문 칸 · 집중점 · 휴식 횟수 · 분노 횟수를 쓰지 않는다. 시계는 라운드 하나(G.Res.clock): 전투 라운드마다 1, 방을 하나 옮기면 ROOM_R(6) — 탐험 스킬과 한 시계. 전투가 끝나도 이어지고 야영하면 전부 돌아온다
  //   쿨 = 주문 레벨 + 1 · 집중점 2 · 짧은 휴식 기능 6 · 긴 휴식 기능 8 · 분노 10 · 예외(CD_EX) — 무기 기술의 쿨타임(SK.cd)은 지금 그대로 (전투 안)
  const CD_EX = { sr_revive: 30 };
  const cdOf = (k, res) => { if (CD_EX[k] != null) return CD_EX[k]; if (!res) return 0; return res.slot ? Math.min(10, res.slot + 1) : res.focus ? 2 : res.rage ? 10 : res.short ? 6 : res.long ? 8 : 0; };
  let cdHooked = false;
  const USED = []; // 방금 자원을 쓴 스킬 (화면이 이름 · 아이콘을 띄우고 비운다)
  function cdHook() {
    if (cdHooked || !G.Res) return; cdHooked = true; const Rs = G.Res, R0 = { can: Rs.can, pay: Rs.pay, left: Rs.left, usesOf: Rs.usesOf, castLevel: Rs.castLevel, slotFrac: Rs.slotFrac, longRest: Rs.longRest };
    Rs.cdOn = false; Rs.clock = 0; Rs.cdOf = (k, res = G.Skill.resOf(k)) => cdOf(k, res);
    const sh = (k, res) => Rs.sh(k, res), ready = (m, k, res) => { [k, res] = sh(k, res); const c = cdOf(k, res), t = (m.cdK || {})[k]; return !c || t == null || Rs.clock - t >= c; };
    Rs.cdLeftOf = (m, k, res = G.Skill.resOf(k)) => { [k, res] = sh(k, res); const c = cdOf(k, res), t = (m.cdK || {})[k]; return !c || t == null ? 0 : Math.max(0, c - (Rs.clock - t)); };
    // 옛 기본 치유(엔진 healTurn · 쓰러진 동료 일으키기 — 자원 이름 'cure')는 치유 스킬을 칸에 든 영웅만 (2026-11-23, 사용자: 「스킬 6칸에 해당 스킬이 있어야」)
    Rs.can = function (m, k, res) { if (!Rs.cdOn || !res) return R0.can.apply(this, arguments); if (k === 'cure' && (!G.Guild.active(m).some(q => G.Skill.SK[q]?.heal) || (HAND.on && !aiSk(m) && (HAND.multi || HAND.uid === m.uid)))) return false; /* 직접 조종하는 영웅도 옛 기본 치유 없이 (눌러야) */ return ready(m, k, res); };
    Rs.left = function (m, res, k) { if (!Rs.cdOn || !res) return R0.left.apply(this, arguments); return ready(m, k, res) ? 1 : 0; };
    Rs.pay = function (m, k, res) { if (!Rs.cdOn || !res) return R0.pay.apply(this, arguments); if (USED.length < 40) USED.push({ m, k }); [k, res] = sh(k, res); (m.cdK = m.cdK || {})[k] = Rs.clock; return res.slot || 0; };
    Rs.usesOf = function (m, res, k) { if (!Rs.cdOn) return R0.usesOf.apply(this, arguments); return res ? 1 : 99; };
    Rs.castLevel = function (m, res) { if (!Rs.cdOn) return R0.castLevel.apply(this, arguments); return res.slot; }; // 올려 쓰기 없음 — 그 주문의 레벨로
    Rs.slotFrac = function (m) { if (!Rs.cdOn) return R0.slotFrac.apply(this, arguments); return 1; }; // 남은 전투 수를 보고 아끼는 계산을 끈다
    Rs.longRest = function (list) { const out = R0.longRest.apply(this, arguments); if (Rs.cdOn) for (const m of list || []) if (m) m.cdK = {}; return out; }; // 야영 = 전부 돌아온다
  }
  // ── 원정 결과 집계 (2026-11-23, 결과 보고서): st.stat = { h: { 직업: { dmg 준 피해, took 받은 피해, heal 회복(그 사람이 한 치유), kills 처치, downs 쓰러짐 } }, fights 전투 수, foes 처치한 적 수 }
  //   피해 · 처치는 엔진 hurt · hurtMember · kill을 감싸 체력 차이로, 회복은 전투 중 영웅 체력이 오르면 그 차례의 주인 몫으로 (statTick — 화면이 프레임마다 부른다). 소환수 몫은 주인에게. 출처 없는 지속 피해는 세지 않는다
  const ownerOf = e => e?.merc?.cls || (e?.kind === 'sum' ? e.by?.merc?.cls : null) || null;
  const hpSeen = new WeakMap();
  const statOf = (st, c) => (st.stat.h[c] = st.stat.h[c] || { dmg: 0, took: 0, heal: 0, kills: 0, downs: 0 });
  const statInit = st => { st.stat = { h: {}, fights: 0, foes: 0, inFight: false }; for (const m of st.party || []) if (m.cls) statOf(st, m.cls); return st.stat; };
  function statTick(st, rt) {
    const S0 = st?.stat; if (!S0 || !rt) return; const T = rt.turn; if (!!T !== S0.inFight) { S0.inFight = !!T; if (T) S0.fights++; }
    const who = T ? ownerOf(T.cur) : null;
    for (const p of rt.party || []) { if (!p.merc) continue; const l = hpSeen.get(p), h = Math.max(0, p.hp); if (l && T && h > l.hp && p.max === l.max) statOf(st, who || p.merc.cls).heal += h - l.hp; hpSeen.set(p, { hp: h, max: p.max }); }
  }
  // ── 몬스터 상성 (2026-11-23, DIVE_PLAN 5장): 엔진 능력치표(SRD)의 유형 · 취약 · 저항 · 면역. 싸워 본 몬스터는 도감에 적힌다(af) · 레인저(사냥꾼의 지식)가 파티에 있으면 만난 것만으로 ──
  const DT_N = { slashing: '베기', piercing: '관통', bludgeoning: '타격', fire: '화염', cold: '냉기', radiant: '광휘', force: '역장', psychic: '정신', necrotic: '사령', lightning: '번개', poison: '독', acid: '산성', thunder: '천둥' };
  const TY_N = { undead: '언데드', fiend: '악마', giant: '거인', beast: '야수', humanoid: '인간형', ooze: '점액', plant: '식물', dragon: '용', aberration: '이계', elemental: '원소', construct: '구조물', monstrosity: '괴수', fey: '요정', celestial: '천상' };
  const AFF = {};
  const affOf = nm => { const id = G.Encounter.monName(nm); if (AFF[id]) return AFF[id]; const d = G.D.F.mon[id]; if (!d) return null; const b = G.Foe.stat({ n: id, ...d }).block || {}, phys = ['slashing', 'piercing', 'bludgeoning'];
    return (AFF[id] = { n: id, ty: b.ty || d.ty, vul: [...(b.vul || [])], res: [...new Set([...(b.res || []), ...(b.nonmag ? phys : [])])], imm: [...(b.imm || [])] }); };
  const loreIn = hs => hs.some(h => hasX(h, 'lore')); // 사냥꾼의 지식 (레인저 3)
  const affKnown = (s, nm, hs = team(s).map(c => s.roster[c]?.m).filter(Boolean)) => { const e = s.dex.m[G.Encounter.monName(nm)]; return !!(e?.af || (e?.met && loreIn(hs))); };
  const affMark = (s, nm, id) => { const k = G.Encounter.monName(nm), e = s.dex.m[k] = s.dex.m[k] || { met: 0, kill: 0 }; if (!e.af) e.af = 1; };
  // 짧은 표시: ▲취약 ▼저항 ✕면역 (아는 것만 — 모르면 '')
  const affTag = (s, nm, hs) => { if (!affKnown(s, nm, hs)) return ''; const a = affOf(nm); if (!a) return ''; return [...a.vul.map(t => `▲${DT_N[t]}`), ...a.res.map(t => `▼${DT_N[t]}`), ...a.imm.map(t => `✕${DT_N[t]}`)].join(' '); };
  // 파티 칸: 그 경로의 아는 적에게 주 피해(기본 공격) 유형이 통하나 — ▲ 취약을 찌름 · ▼ 저항 · 면역에 막힘 · '' 상관없음
  const mainType = m => G.Dnd.weapon({ merc: m }).t;
  function edgeOf(s, m, names) { const t = mainType(m); let up = 0, dn = 0; for (const nm of names) { if (!affKnown(s, nm)) continue; const a = affOf(nm); if (!a) continue; if (a.vul.includes(t)) up++; if (a.res.includes(t) || a.imm.includes(t)) dn++; } return dn > up ? '▼' : up > dn ? '▲' : ''; }
  const planFoes = (V, plan) => [...new Set((plan || []).slice(1))].flatMap(id => { const n = V.map.nodes[id]; return n?.hostile && n.g && (n.visited || n.info >= 2) ? (n.g.units || [[n.g.name, n.g.count]]).map(u => u[0]) : []; });
  let tkQ = []; // 최근 피해 배율 [공격자 이름, 낱말] — 화면의 전투 로그가 가져간다
  const tkWord = k => (k === 0 ? '면역' : k < 1 ? '저항' : k > 1 ? '취약' : '');
  const tkTake = who => { const i = tkQ.findIndex(q => q[0] === who); const w = i >= 0 ? tkQ[i][1] : ''; tkQ = []; return w; };
  // ── 직접 조종 시험판 (2026-11-24, 흐름식 — 게임은 멈추지 않는다): 한 명(uid)만 손으로. 기본 공격 · 이동은 AI 그대로, 플레이어가 끼어들 때만
  //   lock = 그 영웅의 표적 (죽거나 다른 적을 누를 때까지) · res = 예약한 스킬 { k, ally?, at? } — 그 영웅의 다음 차례에 쓴다(못 쓰면 풀고 기본 행동)
  //   조종하는 영웅의 스킬은 AI가 저절로 쓰지 않는다 (예약한 것만). 옛 멈춤식 직접 조종(G.Ctrl)과는 따로
  //   실시간 시험판(2026-11-24)에서는 넷 모두(multi): 영웅마다 명령 cmd[uid] = { lock, res } · 손대지 않은 영웅은 AI 그대로. auto = 스킬 자동 (켜면 예약이 없을 때 AI가 스킬을 고른다)
  //   HAND.lock · HAND.res = 지금 고른 영웅(uid)의 명령 (한 명 조종 화면이 그대로 쓴다)
  const HAND = { on: false, uid: null, fired: null, multi: false, auto: false, cmd: {}, // fired = 방금 쓴 예약 { k, t } (화면이 「먹혔다」를 잠깐 보인다)
    get lock() { return this.uid != null ? this.cmd[this.uid]?.lock || null : null; }, set lock(v) { if (this.uid != null) (this.cmd[this.uid] = this.cmd[this.uid] || {}).lock = v; },
    get res() { return this.uid != null ? this.cmd[this.uid]?.res || null : null; }, set res(v) { if (this.uid != null) (this.cmd[this.uid] = this.cmd[this.uid] || {}).res = v; } };
  const handIs = e => !!(HAND.on && e?.merc && (HAND.multi || (HAND.uid != null && e.merc.uid === HAND.uid)));
  const cmdOf = e => (HAND.cmd[e.merc.uid] = HAND.cmd[e.merc.uid] || { lock: null, res: null });
  // 실시간 (2026-11-25 사용자: 「내가 선택한 캐릭터만 유저가 직접 조작하고, 나머지 영웅은 utility ai가」): 고른 영웅(HAND.uid)만 스킬을 손으로, 나머지는 AI 그대로. HAND.auto(선택 영웅 스킬 자동)면 고른 영웅도 예약이 없을 때 AI
  const aiSk = m => HAND.multi && (HAND.auto || m?.uid !== HAND.uid);
  // 고르기: 다른 영웅에게 내린 명령(표적 · 바닥 · 예약)은 걷는다 — 놓은 영웅은 곧바로 AI
  const handPick = uid => { HAND.uid = uid; if (HAND.multi) for (const u in HAND.cmd) if (+u !== uid) delete HAND.cmd[u]; };
  const handLock = (e, fs) => { if (!handIs(e)) return null; const L = cmdOf(e).lock; return L && L.hp > 0 && !L.down && (!fs || fs.includes(L)) ? L : null; };
  const handSet = (k, o = {}) => { HAND.res = k ? { k, ...o } : null; };
  // 예약은 쓸 때까지 남는다 (그 차례에 못 쓰면 — 사거리 밖 · 쓸 조건 — 기본 행동으로 다가가고 다음 차례에 다시). 영영 못 쓸 때(영웅이 쓰러짐 · 칸에서 빠짐)만 푼다 — 화면이 프레임마다 부른다
  const handTick = rt => { for (const uid in HAND.cmd) { const c = HAND.cmd[uid], p = rt?.party?.find(q => q.merc?.uid === +uid); if (c.res && (!p || p.dead || !G.Builds.slots(p.merc).includes(c.res.k))) c.res = null; if (c.lock && (c.lock.hp <= 0 || c.lock.down)) c.lock = null; if (!rt?.turn) c.go = null; } };
  // ── 실시간 명령 (2026-11-25, 사용자: 「스킬이 제때 안써지고, 조작이 제대로 안돼」 · 「스킬을 누르고 있어도 썼다는 로그도 없고」) — G.Turn.laneCmd가 차선마다 프레임마다 (rt.turn = 그 차선)
  //   전에는 누른 스킬이 그 영웅의 시계가 찰 때(최대 한 라운드)까지 기다렸고, 쓸 조건(숨 고르기 = 다쳤을 때 · 휩쓸기 = 곁에 둘 …)이 안 맞으면 표시 없이 영영 예약으로 남았다
  //   스킬: 쿨타임이 끝났고 닿으면 그 자리에서 (휘두르는 공격은 마친 뒤). 닿지 않으면 바로 걸어가 닿는 순간. 닿는데 조건이 안 맞으면 버리고 「안 됨」(HAND.ack)
  //     행동 스킬은 그 영웅의 시계를 처음으로 (다음 차례는 한 라운드 뒤 — 걷던 차례의 기본 공격은 접는다) · 추가 행동 · 자유 스킬은 시계를 건드리지 않는다. 남용은 쿨타임이 막는다
  //   표적 바꾸기: 걷던 걸음을 끊고 새 표적으로 (공격 수는 그대로 — 기본 공격은 시계가 찬 차례에만) · 바닥: 그 칸에 가 서서 닿는 적만 친다 (새 명령이나 전투 끝까지)
  //   시계가 차기 전의 걸음(쉬는 동안)은 공짜 — 공격은 더하지 않는다. 기회 공격은 그대로 (SRD)
  const walking = e => !!(G.Turn.smooth && e._dx != null && Math.hypot(e._dx - e.x, e._dy - e.y) > 0.12 && ((e._spd ?? 1) > 0.25 || Date.now() - (e._hopAt || 0) < 400)); // 그림이 아직 걷는 중 (논리 위치는 미리 도착해 있다 — 그림끼리 밀려 멈춰 선 것은 걷는 중이 아니다)
  function cutWalk(rt, e) { if (!walking(e)) return; const x = Math.round(e._dx), y = Math.round(e._dy); if (G.Grid.pass(rt.map, x, y) && !rt.party.concat(rt.mons, G.Sum.alive(rt)).some(o => o !== e && !o.dead && o.hp > 0 && o.x === x && o.y === y)) { e.x = x; e.y = y; } }
  function hop(f, rt, L, e, path) { const io = G.Turn.io; if (!path.length) return; const px = e.x, py = e.y; e._hopAt = Date.now(); G.Tactics.walk(e, path, io.MOVE_V, 99); G.Fantasy.fieldMove(f, rt, e, px, py); io.opportunity(f, rt, L, e, px, py); }
  const ack = (e, ok, k) => { HAND.ack = { uid: e.merc.uid, ok, k: k || null, t: Date.now() }; };
  // 그 스킬이 다시 되기까지 남은 라운드 (원정 쿨타임 G.Res + 무기 기술 SK.cd) — 화면은 이것으로 「안 됨 · n」 · 1초 안이면 이어서 예약
  function handCd(rt, e, k) { const S = G.Skill.SK[k]; let n = G.Res.cdLeftOf ? G.Res.cdLeftOf(e.merc, k) : 0; const L = rt?.lanes?.get(e), u = e.cdU?.[k]; if (S?.cd && L && u && u.st === L) n = Math.max(n, u.r + S.cd - L.round); return Math.max(0, n); }
  // 다시 되기까지 남은 게임 초 (실시간 — 라운드 경계까지 + 남은 라운드)
  function handWait(rt, e, k) { const n = handCd(rt, e, k); if (!n || !G.Turn.rt || !rt?.turn) return n ? 99 : 0; const RT = G.Turn.rt.round, st = rt.turn.main || rt.turn, t = (st.rtT || 0) % RT; return (n - 1) * RT + (RT - t); }
  const skR = (e, k) => G.D.SK_RANGE[k] ?? (G.Skill.SK[k]?.heal ? null : G.Turn.io.reach(e)); // 사거리가 없는 무기 기술(약화 일격 · 밀쳐내기)은 무기 사거리
  function handLane(f, rt, L, RT, started) {
    const e = L.cur; if (!handIs(e) || e.dead || e.dying || !e.merc || G.Dnd.out(e) || (e.broke && e.broke !== 'rage')) return; /* 행동 불능(기절 · 마비 · 의식 없음) · 무너짐: 차례 시작(turn.js)과 같이 명령을 안 받는다 — 예약은 남아 풀리면 나간다 */ const cm = cmdOf(e), io = G.Turn.io, m = rt.map;
    const can = tg => (x, y) => io.canHit(m, e, x, y, tg), atGo = () => cm.go && e.x === cm.go.x && e.y === cm.go.y, toGo = () => (atGo() ? [] : G.Tactics.plan(rt, e, cm.go, io.moveOf(e), (x, y) => x === cm.go.x && y === cm.go.y));
    if (started) { if (cm.go && (L.ph === 'move' || L.ph === 'back')) { L.path = toGo(); L.ph = 'move'; } return; } // 바닥 명령: 이 차례의 걸음은 그 칸으로만 — 다 걸은 뒤 닿는 적이 있으면 친다 (turn.js 'move')
    const fresh = L.seq !== cm.seq; L.seq = cm.seq;
    if (fresh && cm.lock) L.chase = cm.lock;
    if (fresh && walking(e)) { // 새 명령: 걷던 걸음을 끊는다 (휘두르는 공격은 마친다 — 'pre'에서 그림이 도착했으면 이미 친다)
      if (L.ph === 'pre' && cm.lock && cm.lock !== L.tg) { cutWalk(rt, e); L.tg = cm.lock; L.path = G.Tactics.plan(rt, e, cm.lock, io.moveOf(e), can(cm.lock)); L.ph = 'move'; }
      else if (L.ph === 'pre' && cm.go) { cutWalk(rt, e); io.laneEnd(f, rt, L); }
      else if (L.ph === 'idle') cutWalk(rt, e);
    }
    if (L.ph === 'move' && cm.lock && handLock(e) && L.tg !== cm.lock && !cm.go) { L.tg = cm.lock; L.path = G.Tactics.plan(rt, e, cm.lock, io.moveOf(e), can(cm.lock)); }
    // 스킬
    const r = cm.res, S = r && G.Skill.SK[r.k];
    if (S && !S.rider && !(r.wantAlly && !r.ally) && (L.ph === 'idle' || L.ph === 'wait' || L.ph === 'move' || (L.ph === 'pre' && walking(e))) && !handCd(rt, e, r.k) && G.Res.can(e.merc, r.k, G.Skill.resOf(r.k))) {
      if (r.ally && (r.ally.dead || !rt.party.includes(r.ally))) { cm.res = null; ack(e, false, r.k); return; }
      if (L.ph === 'pre' || L.ph === 'idle') cutWalk(rt, e);
      const seen = io.seenBy(rt, e), kind = S.free ? 'free' : S.bonus ? 1 : 0, sv = { lastSk: e.lastSk, lastBonus: e.lastBonus, slotUsed: e.slotUsed, plan: e.plan, freeDone: e.freeDone, gcd: e.gcd };
      e.lastSk = null; e.lastBonus = null; e.slotUsed = false; e.freeDone = null; e.gcd = 0; e.plan = G.SkillAI.plan(f, rt, e, seen);
      const before = io.snapshot(rt); let shot = false, rec = null; G.Turn.rec = [];
      const R1 = skR(e, r.k), t1 = r.ally || handLock(e, seen) || seen[0], far1 = R1 && t1 && !G.Opt.inReach(e, rt, t1, R1), w0 = S.when;
      try { for (let i = 0; i < 2 && !shot; i++) { if (i) { if (far1) break; S.when = () => true; } /* 눌렀으면 AI의 「쓸 만한가」(다쳤을 때만 · 곁에 둘 이상 …)는 묻지 않는다 — 대상 · 사거리 · 안 듣는 적은 그대로 */ try { G.Skill.tick(f, rt, e, 0, seen, kind || undefined); } catch (x) { /* 조건을 건너뛰어 못 쓰는 기술 */ } shot = e.lastSk === r.k || e.lastBonus === r.k || !!e.freeDone?.[r.k]; } }
      finally { S.when = w0; rec = G.Turn.rec; G.Turn.rec = null; Object.assign(e, sv); }
      if (shot) { cm.res = null; HAND.fired = { k: r.k, t: Date.now(), uid: e.merc.uid }; if (before) io.report(f, rt, e, null, rec || [], before, G.D.MSKILLS[r.k]?.n || r.k); // 로그 한 줄
        if (!kind) { L.clk = RT; if (L.ph === 'move' || L.ph === 'pre') io.laneEnd(f, rt, L); } return; }
      const R0 = skR(e, r.k); let tg = r.ally || handLock(e, seen); if (!tg && seen.length && !S.heal) try { tg = G.Tactics.pick(rt, seen, e) || null; } catch (x) { tg = null; }
      if (!tg && !S.heal && R0 && !seen.length) tg = io.foes(rt).filter(o => !o.down).sort((p, q) => Math.hypot(p.x - e.x, p.y - e.y) - Math.hypot(q.x - e.x, q.y - e.y))[0] || null; // 보이는 적이 없으면 가장 가까운 적 쪽으로
      if (R0 && tg && !G.Opt.inReach(e, rt, tg, R0)) { r.far = tg; if (L.ph === 'move' || L.ph === 'pre') { if (!kind) io.laneEnd(f, rt, L); } } // 닿지 않는다: 걸어간다 (아래)
      else { cm.res = null; ack(e, false, r.k); } // 닿는데 조건이 안 맞는다 (다치지 않았다 · 곁에 적이 모자라다 …): 버린다
    }
    // 쉬는 동안의 걸음 (공짜): 스킬이 닿을 곳 · 바닥 칸 · 막 고른 표적에게. 그림이 도착한 뒤 다음 걸음
    if (L.ph !== 'idle' || walking(e)) return;
    const far = cm.res?.far, ok = o => o && !o.dead && o.hp > 0 && !o.down;
    if (far && cm.res && ok(far)) { const R0 = skR(e, cm.res.k) || 1.5; hop(f, rt, L, e, G.Tactics.plan(rt, e, far, io.moveOf(e), (x, y) => Math.hypot(x - far.x, y - far.y) <= R0 && G.Fantasy.sees(m, { x, y }, far))); return; }
    if (cm.go) { hop(f, rt, L, e, toGo()); return; }
    if (L.chase && L.chase === cm.lock && ok(L.chase)) { if (io.canHit(m, e, e.x, e.y, L.chase)) { L.chase = null; return; } hop(f, rt, L, e, G.Tactics.plan(rt, e, L.chase, io.moveOf(e), can(L.chase))); }
  }
  // 선공 한 줄 (첫 라운드 선공 first = 'foes' | 'party' | null · 까닭 why = crawl.js enterFight의 R.dvWhy): 결과와 반대되는 낱말이 섞이지 않게 결과로만 고른다
  const firstLineOf = (first, why) => (first === 'foes' ? (why === 'dark' ? '어둠 · 적 선공' : why === 'ambush' ? '매복 살피기 · 실패 · 기습당함 · 적 선공' : '기습당함 · 적 선공') : first === 'party' ? (why === 'look' ? '매복 살피기 · 먼저 봤다 · 우리 선공' : why === 'sleep' ? '잠든 무리 · 기습 · 우리 선공' : '기습 · 우리 선공') : '');
  // 길드 상태창의 수치 (2026-11-24): 명단의 영웅이 낀 마법 물건(h.tr)을 잠깐 이 세계의 물건 목록에 그 사람이 낀 채로 넣고 엔진 수치를 잰다 — 원정 전투(revive)와 같은 값.
  //   물건마다 칸(G.Gear.slotOf: w 무기 · a 방어구 · s 방패 · t 장신구)을 붙여 돌려준다 — 화면은 칸대로 그린다 (전에는 마법 무기 · 갑옷도 「물건」 칸에 그렸다)
  function sheetOf(h) { const f = G.S.w.fantasy, A = G.Trinket.all(f), mm = { ...h.m, uid: -9001 }, tmp = (h.tr || []).map((t, i) => ({ ...t, id: -9001 - i, on: mm.uid })); A.push(...tmp);
    try { const e = { merc: mm }, w = G.Dnd.weapon(e), dB = G.Trinket.sum(mm, 'dmgB'), sh = G.Tavern.sheet(mm); return { sh, hp: sh.hp, ac: sh.ac, hit: G.Dnd.hit(e), dmg: { n: w.n, d: w.d, b: (w.b || 0) + dB }, items: (h.tr || []).map(t => ({ t, r: rOf({ kind: 'magic', t }), n: G.Gear.nameOf(t), slot: G.Gear.slotOf({ kind: 'magic', t }) })) }; }
    finally { for (const t of tmp) { const i = A.indexOf(t); if (i >= 0) A.splice(i, 1); } } }
  const endWhy = (st, why) => (st.done === 'win' ? 'win' : st.done === 'lose' ? 'lose' : why || 'back'); // 끝난 이유: 용 처치 · 전멸 · 귀환(경로 끝 plan · 짐 가득 full · 위험 risk · 직접 quit)
  function hook() {
    if (hooked) return; hooked = true;
    { const DN = G.Dnd, h0 = DN.hit; DN.hit = function (e) { return h0.apply(this, arguments) + (e?.merc ? TUNE.HIT.pc : e?.kind === 'mon' ? TUNE.HIT.mon : 0); }; DN.basicDC = TUNE.HIT.pc; } // 명중 보정: 공격 굴림 양쪽 + 내성으로 가르는 기본 공격(신성한 불꽃 · 잔인한 조롱)
    // 어두운 방을 빛 없이 (rt.dvDark — crawl이 건다): 파티가 든 횃불 · 벽 횃불 · 방의 어스름을 끈다. 빛 주문 · 빛나는 몬스터는 그대로 — 그다음은 엔진의 어둠 규칙(보이지 않는 표적 불리 · 암시야)
    // 직접 조종 (위 HAND): 표적 · 스킬 계획 · 자유 행동 기능 · 맞힌 뒤 붙는 기술(강타 등)을 그 영웅만 덮어쓴다 — 조종 대상이 없으면 그대로
    // 옛 숨은 무리 매복(G.Flow.init이 방에 r.ambush를 걸고 들어서면 매복 살피기를 굴려 선공을 덮어쓴다)은 원정에서 끈다 — 선공은 crawl.js enterFight 한 곳에서 (init 바로 뒤에 부르는 G.Event.tagRooms에서 걷는다)
    if (G.Event?.tagRooms) { const tr0 = G.Event.tagRooms; G.Event.tagRooms = function (f, rt) { if (curS) for (const r of rt.map?.rooms || []) r.ambush = false; return tr0.apply(this, arguments); }; }
    // 기본 빠르기 (TUNE.PACE, 2026-11-24 사용자: 「기본 속도를 늦춰봐」): 원정 중에는 배속 값 전체에 PACE를 곱한다 — 걷기 · 공격 동작(actors) · 엔진 추가 틱(G.Turn.extra) · 탐험 걷기(crawl)가 모두 G.Turn.speed를 본다. 배속 버튼의 단계 · 표시는 f.turnX 그대로
    if (G.Turn?.speed) { const sp0 = G.Turn.speed; G.Turn.speed = function (f) { const v = sp0.apply(this, arguments); return curS ? v * TUNE.PACE : v; }; }
    if (G.Tactics?.guardTarget) { const gt0 = G.Tactics.guardTarget; G.Tactics.guardTarget = function (rt, e, fs) { return handLock(e, fs) || gt0.apply(this, arguments); }; }
    if (G.SkillAI?.plan) { const pl0 = G.SkillAI.plan, pb0 = G.SkillAI.planBonus, SKo = () => G.Skill.SK;
      G.SkillAI.plan = function (f, rt, a) { if (!handIs(a)) return pl0.apply(this, arguments); const r = cmdOf(a).res, S = r && SKo()[r.k]; if (!r && aiSk(a.merc)) return pl0.apply(this, arguments); if (r) r.at = G.Turn.no();
        return { turn: G.Turn.no(), action: S && !S.bonus && !S.free && !S.rider ? r.k : 'basic', bonus: S && S.bonus ? r.k : null, slotOk: !!(S && S.bonus), swap: S && S.conc ? r.k : null, v: 0 }; };
      if (pb0) G.SkillAI.planBonus = function (f, rt, a) { if (!handIs(a)) return pb0.apply(this, arguments); const r = cmdOf(a).res, S = r && SKo()[r.k]; if (!r && aiSk(a.merc)) return pb0.apply(this, arguments); return S && S.bonus && !a.lastBonus ? { turn: G.Turn.no(), action: 'basic', bonus: r.k, slotOk: true, v: 0 } : null; }; }
    if (G.Skill?.tick) { const tk0 = G.Skill.tick, oh0 = G.Skill.onHit;
      G.Skill.tick = function (f, rt, a, dt, seen, bonus) { if (!handIs(a)) return tk0.apply(this, arguments); const cm = cmdOf(a), r = cm.res, S = r && G.Skill.SK[r.k];
        if (bonus === 'free' && !(S && S.free) && !aiSk(a.merc)) return; // 자유 행동 기능도 눌러야 (스킬 자동이면 AI 그대로)
        let L = handLock(a, seen); if (!L && S && !S.heal && seen.length) { try { L = G.Tactics.pick(rt, seen, a) || null; } catch (e) { L = null; } } // 표적 고정이 없으면 그 영웅이 지금 치려는 적(AI가 고르는 적)에게
        const sn = L && S && !S.heal && !r?.ally ? [L] : seen, p0 = rt.party; if (r?.ally) rt.party = rt.party.filter(p => p === r.ally || p === a); // 아군 대상(치유 · 강화): 고른 사람에게
        try { return tk0.call(this, f, rt, a, dt, sn, bonus); } finally { rt.party = p0; if (r && cm.res === r && (a.lastSk === r.k || a.lastBonus === r.k)) { cm.res = null; HAND.fired = { k: r.k, t: Date.now(), uid: a.merc.uid }; } } };
      if (oh0) G.Skill.onHit = function (f, rt, a, o) { if (!handIs(a)) return oh0.apply(this, arguments); const cm = cmdOf(a), r = cm.res, own = r && G.Skill.SK[r.k]?.rider, h0 = a.lastHitSk; if (!r && aiSk(a.merc)) return oh0.apply(this, arguments); if (!own) a.lastHitSk = h0 || '_hand';
        try { return oh0.apply(this, arguments); } finally { if (!own) a.lastHitSk = h0; else if (a.lastHitSk === r.k) { cm.res = null; HAND.fired = { k: r.k, t: Date.now(), uid: a.merc.uid }; } } }; }
    // 실시간 명령은 영웅의 시계를 기다리지 않는다 (아래 handLane — 차선마다 프레임마다) · 바닥 명령을 받은 영웅은 차례 첫머리에 앞사람 곁으로 저절로 걷지 않는다
    G.Turn.laneCmd = handLane; if (G.MonAct) Object.defineProperty(G.MonAct, 'TELE', { get: () => TUNE.TELE, configurable: true }); // 예고 동작 (실시간만)
    for (const nm of ['escorts', 'trails']) if (G.Tactics?.[nm]) { const o = G.Tactics[nm]; G.Tactics[nm] = function (e) { return handIs(e) && HAND.cmd[e.merc.uid]?.go ? false : o.apply(this, arguments); }; }
    if (G.Light) { const Lt = G.Light, src0 = Lt.sources, lv0 = Lt.level;
      Lt.sources = function (rt) { const o = src0.apply(this, arguments); return rt?.dvDark ? o.filter(q => !q.held?.merc && !(rt.map?.lights || []).includes(q)) : o; };
      Lt.level = function (rt, x, y) { if (!rt?.dvDark || !rt.map) return lv0.apply(this, arguments); if (Lt.inDark(rt, x, y)) return -1; let v = 0; for (const q of Lt.sources(rt)) { const d = Math.hypot(x - q.x, y - q.y); if (d > q.d + 0.5) continue; if (d <= q.b + 0.5) return 2; v = 1; } return v; }; }
    { const F = G.Fantasy, hu0 = F.hurt, hm0 = F.hurtMember, kl0 = F.kill; // 결과 집계 (위)
      const rtDmg = d => Math.max(1, Math.round(d * (TUNE.RT_DMG ?? 1))); // 실시간 피해 배율: 반올림 · 맞았으면 1 이상 (엔진은 소수를 버려서 3 피해가 0.9 → 0이 되던 것)
      F.hurt = function (f, rt, m, dmg, src, from) { if (G.Turn.rt && rt?.turn && dmg > 0) arguments[3] = dmg = src === 'dot' ? dmg * (TUNE.RT_DMG ?? 1) : rtDmg(dmg); /* 실시간: 양쪽 피해 같은 배율 (아래 hurtMember도) · 지속 피해는 엔진이 소수를 모은다 */ const c = cur?.stat && m ? ownerOf(from) : null, b = m?.hp; if (c) m._dvBy = c;
        if (c && m.kind === 'mon' && m.stat && b > 0) { const dt = G.Skill.dtOver || G.Foe.dtype || (from?.merc ? G.Dnd.weapon(from).t : null), k = G.Foe.typeK(m, dt, from), w = tkWord(k); if (curS && m.n) affMark(curS, m.n); if (w) { const q = statOf(cur, c); q.tk = q.tk || {}; q.tk[w] = (q.tk[w] || 0) + 1; tkQ.push([from?.merc?.name || from?.by?.merc?.name || '', w]); if (tkQ.length > 8) tkQ.shift(); } } // 상성: 싸워 본 몬스터는 도감에 · 배율 기록
        const out = hu0.apply(this, arguments); if (c && b > 0) statOf(cur, c).dmg += b - Math.max(0, m.hp); return out; };
      F.hurtMember = function (f, rt, p, dmg, mo) { if (G.Turn.rt && rt?.turn && dmg > 0) arguments[3] = rtDmg(dmg); const b = p?.hp, out = hm0.apply(this, arguments); if (cur?.stat && p?.merc && b > 0) { const q = statOf(cur, p.merc.cls); q.took += b - Math.max(0, p.hp); if (p.hp <= 0) q.downs++; hpSeen.set(p, { hp: Math.max(0, p.hp), max: p.max }); } return out; };
      F.kill = function (f, rt, m, src, from) { if (cur?.stat && m?.kind === 'mon' && !m._dvDead) { m._dvDead = true; cur.stat.foes++; const c = ownerOf(from) || m._dvBy; if (c) statOf(cur, c).kills++; } return kl0.apply(this, arguments); }; }
    { const h0 = G.Story.heat; G.Story.heat = function (f, list) { h0.apply(this, arguments); for (const o of list) if (o.wvK && !o.wvDone) { o.wvDone = true; o.gold *= o.wvK; o.xpK = (o.xpK || 1) * o.wvK; } }; } // 늘어난 적의 값
    const m0 = G.Guild.mult; G.Guild.mult = function (m, k) { const v = m0.apply(this, arguments); return k === 'xp' ? v * XP_K * (curS ? catchK(m.lv, Math.max(...live.map(x => x.lv))) / pace(m.lv) : 1) : v; };
    const k0 = G.Guild.onKill; G.Guild.onKill = function (f, rt, mo) { if (cur && mo) cur.gold += killGold(mo); if (curS && mo?.n) { const e = curS.dex.m[mo.n] = curS.dex.m[mo.n] || { met: 1, kill: 0 }; e.kill++; }
      const out = k0.apply(this, arguments); if (curS) for (const a of rt.party || []) if (a.merc) { if (G.Reward.pending(a.merc)) autoPick(a.merc); if (curS.cardOn === false) cardAuto(a.merc); } return out; }; // 레벨업 카드를 끄면 빌드대로 // 원정 중에만 저절로 고른다 (기존 게임은 레벨업 창)
    const sp0 = G.Fantasy.spawnMon; G.Fantasy.spawnMon = function () { const o = sp0.apply(this, arguments); if (curS && o?.n && loreIn(live.filter(Boolean))) affMark(curS, o.n); if (curS && o?.n) { const e = curS.dex.m[o.n] = curS.dex.m[o.n] || { met: 0, kill: 0 }; e.met++; } return o; }; // 도감: 그 방에 선 몬스터 = 만난 것
    if (typeof RUN !== 'undefined') { RUN.SPECS = SPECS; RUN.FIXDOORS = true; RUN.X = XRUN; RUN.SMALL = TUNE.SMALL_ROOMS; } // SMALL: 작은 방 (폰 화면 — 줌아웃 없이 전투 방이 들어오게) // 설계서 · 문 잇기 · 탐험 판정(영웅 수치)은 원정 페이지에서만 // 설계서 · 문 잇기는 원정 페이지에서만
    if (typeof RUN !== 'undefined' && RUN.ZONES) for (const z of ZONES) if (!RUN.ZONES.some(q => q.id === z.id)) RUN.ZONES.push(z);
    // 원정 화면의 떠오르는 글자: 피해 숫자(치명타 포함) · 빗나감 · 회복 · 레벨 업 · 면역 · 저항 · 약점만 (버프 · 「방에 들어선다!」 · 「차례를 넘긴다」 · 금화 · 경계 표시 ! ?는 띄우지 않는다)
    // 겹침은 화면 쪽(render/fxlayer.js)이 화면 픽셀로 쌓아 푼다 (여기서 칸을 밀면 많이 맞을수록 숫자가 적에게서 멀어졌다)
    const fx0 = G.fx; G.fx = function (rt, o) {
      if (curS && o && o.k === 'text' && !TEXT_OK.test(String(o.s).trim())) return;
      return fx0.apply(this, arguments); };
    // 소생술 (SRD Revivify, 3레벨 슬롯): 엔진은 금화 300을 요구한다 — 원정에서는 금화 없이 주문 슬롯만 (금화를 잠깐 채웠다가 되돌린다). 기록: 「소생 · 시전자 → 대상」
    const rv0 = G.Skill.revivify; if (rv0) G.Skill.revivify = function (f, rt, p) { if (!curS) return rv0.apply(this, arguments); const c = rt.party.find(q => q !== p && q.merc && !q.dead && !q.dying && G.Guild.picks(q.merc).includes('sr_revive')), g0 = f.gold || 0; f.gold = g0 + 300; const ok = rv0.apply(this, arguments); f.gold = g0; if (ok && cur) cur.log.push({ t: `소생 · ${c?.merc?.name || '?'} → ${p.merc?.name || '?'}`, k: 'dv' }); return ok; };
    cdHook();
    if (G.Builds?.CARD) { G.Builds.CARD.on = true; const gr0 = G.Guild.grow; G.Guild.grow = function (m) { cardInit(m); const out = gr0.apply(this, arguments); if (G.Builds.CARD.on && G.Builds.byId(m.build)) { const q = (m.cardq = m.cardq || []); if (CARD.PICK.includes(m.lv) && (m.picks || []).length + q.filter(x => x.kind === 'pick').length < G.Builds.SLOT_N) q.push({ lv: m.lv, kind: 'pick' }); else if (CARD.PICK.includes(m.lv) || CARD.SWAP.includes(m.lv)) q.push({ lv: m.lv, kind: 'swap' }); } return out; }; } // 레벨업 카드
    G.Gear.pickR = pickR; G.Gear.noRand = true; // 원정의 희귀도 표 · 랜다트(지어낸 물건) 없이 SRD 물건만
    // 첫 층은 더 순하게: 한 무리 둘까지 (탐사 게임은 셋). 원정 페이지에서만 바뀐다
    const g = typeof RUN !== 'undefined' && RUN.ZONES.find(q => q.id === 'goblin'); if (g) g.seats = [1, 2];
  }
  // 한 사람: 선술집 손님(js/game/tavern.js guest)처럼 1레벨로 만들고(직업 표준 능력치 · 빌드 6칸), 트리의 레벨까지 실제 레벨업 길(G.Guild.grow → G.Reward.levelUp)로 올린다.
  // 레벨업 고르기는 저절로 첫 추천을 (능력치 향상 · 전투 방식 · 빌드 칸 · 주문) — 바로 그 레벨로 만들면 능력치 향상이 빠져 같은 레벨보다 약했다
  // ── 레벨업 카드 (2026-11-23, 원정 — G.Builds.CARD.on): 칸 여섯은 처음부터 열려 있고 든 것은 m.picks. 1 · 3 · 5 · 7 · 9레벨에 고를 것 하나(칸이 다 찼으면 바꾸기),
  //   11 · 13 · 15 · 17 · 19레벨에는 「가진 것과 바꾸거나 넘긴다」. 카드 셋 = 추천(빌드의 대표 · 추천 순서) 하나 + 그 직업의 쓸 수 있는(그 레벨에 SRD상 되는 · 안 가진) 스킬 중 무작위 둘
  //   m.cardq = 고를 것 [{ lv, kind: pick | swap }]. 원정 중에 고를지는 화면이 (답이 없으면 추천) · 정산 · 새 영웅의 지나간 레벨 · 쉬는 영웅은 추천대로
  const CARD = { PICK: [1, 3, 5, 7, 9], SWAP: [11, 13, 15, 17, 19], WAIT: 15 };
  const REC_FIRST = ['sr_revive'];
  const cardCands = m => { const b = G.Builds.byId(m.build); if (!b) return []; const have = new Set(m.picks || []), K = G.D.MSKILLS; return [...new Set(G.Guild.pickable(b.cls))].filter(k => !have.has(k) && G.Guild.spLv(k) !== 0 && G.Guild.isPick(k) && G.Skill.SK[k] && !K[k]?.noAuto && G.Builds.ready(m, k)); };
  const cardRec = m => { const b = G.Builds.byId(m.build); if (!b) return null; const c = cardCands(m), set = new Set(c); const ord = [...b.core.filter(Boolean), ...G.Builds.sugOf(m)]; return REC_FIRST.find(k => set.has(k) && ord.includes(k)) || ord.find(k => set.has(k)) || c[0] || null; };
  // 추천을 앞당기는 것: 소생술은 그 빌드가 쓰는 것이면 쓸 수 있게 된 레벨(클레릭 · 드루이드 5 · 팔라딘 9 — SRD 3레벨 주문)의 카드에서 바로 추천 (2026-11-23, 사용자: 「3레벨 주문인데 왜 9레벨에」)
  function cardOffer(m, rng = Math.random) { const rec = cardRec(m); if (!rec) return []; const rest = cardCands(m).filter(k => k !== rec), out = [rec]; while (rest.length && out.length < 3) out.push(rest.splice(Math.floor(rng() * rest.length), 1)[0]); return out; }
  // 고른다: key = 고른 카드 (null = 넘김) · slot = 칸이 다 찼으면 바꿀 칸
  function cardChoose(m, key, slot = null) { const q = (m.cardq || []).shift(); if (!q) return false; m.picks = m.picks || [];
    if (key) { if (q.kind === 'pick' && m.picks.length < G.Builds.SLOT_N) m.picks.push(key); else if (slot != null && slot < m.picks.length) m.picks[slot] = key; }
    G.Builds.refresh(m); return true; }
  // 추천대로 (자리가 있으면 추천 카드 · 칸이 다 찼거나 바꾸기면 넘김)
  function cardAuto(m) { for (let i = 0; i < 40 && (m.cardq || []).length; i++) { const q = m.cardq[0]; cardChoose(m, q.kind === 'pick' && (m.picks || []).length < G.Builds.SLOT_N ? cardRec(m) : null); } }
  // 카드 모드로 옮긴다: 옛 영웅은 지금 든 것 그대로 (picks가 없으면 지금 칸에서)
  //   소마법(기본 공격 · 언제나 쓰는 것)은 칸에서 뺀다 — 옛 영웅은 뺀 만큼 고를 것을 하나씩 (2026-11-23)
  const cardInit = m => { if (!G.Builds?.CARD?.on || !m || !G.Builds.byId(m.build)) return m; noMc(m); if (!m.picks) { G.Builds.CARD.on = false; m.picks = G.Builds.slots(m).filter(Boolean); G.Builds.CARD.on = true; }
    const n0 = m.picks.length; m.picks = m.picks.filter(k => G.Guild.spLv(k) !== 0); for (let i = m.picks.length; i < n0; i++) (m.cardq = m.cardq || []).push({ lv: m.lv, kind: 'pick' });
    for (let i = 0; i < 6 && (m.cardq || []).length && m.cardq[0].kind === 'pick' && m.cardq[0].lv <= 1; i++) cardChoose(m, cardRec(m)); // 1레벨 카드는 묻지 않는다 — 그 빌드의 추천(영입 화면에 보인 첫 스킬)대로 (2026-11-24 사용자: 「시작할때 1레벨카드선택하는것좀 안뜨게해. 흐름끊기게」)
    G.Builds.refresh(m); return m; };
  // ── 다중 직업은 원정에서 쓰지 않는다 (2026-11-23, 사용자: 「다중직업관련 버그는 고쳐」): 카드는 한 직업의 스킬만 보여 주는데, 다중 직업 빌드(소서딘 · 헥사딘 …)로 들어온 영웅은
  //   다른 직업 레벨이 m.mc에 남아 빌드를 바꿔도 본 직업 레벨이 모자랐다(팔라딘 9레벨인데 팔라딘 6 + 워락 3 → 소생술이 안 옴). 들어올 때 한 직업 빌드만 · 옛 저장은 불러올 때 한 직업으로 (레벨 합 = m.lv 그대로)
  const soloBuilds = cls => G.Builds.LIST.filter(b => b.cls === cls && !b.mc);
  function noMc(m) { if (!m || !G.Builds) return m; const had = !!m.mc?.length, b = G.Builds.byId(m.build); if (!had && !b?.mc) return m;
    delete m.mc; delete m.nextCls; if (b?.mc) { const nb = soloBuilds(m.cls)[0]; if (nb) G.Builds.apply(m, nb); }
    if (m.picks) { const n0 = m.picks.length; m.picks = m.picks.filter(k => G.Builds.ready(m, k)); for (let i = m.picks.length; i < n0; i++) (m.cardq = m.cardq || []).push({ lv: m.lv, kind: 'pick' }); }
    G.Builds.refresh(m); return m; }
  const loadFix = raw => { const s = load(raw); for (const h of Object.values(s.roster || {})) if (h?.m) noMc(h.m); return s; };
  // bid: 영입할 때 고른 빌드 (2026-11-24 — 빌드는 영입할 때 한 번 고르고 고정, 사용자: 「장착한 장비, 얻은 스킬이 막 바뀌는게 말이 안돼」). 없으면 무게대로
  function member(f, cls, lv, rng = Math.random, bid = null) {
    const R = G.Reward, m = G.Party.trim(G.Guild.make(f, cls, { lv: 1, ab: G.Party.stdAb(cls) })); if (G.Builds) { G.Builds.assign(m, rng); const pick = bid && soloBuilds(cls).find(b => b.id === bid); if (pick) G.Builds.apply(m, pick); else if (G.Builds.byId(m.build)?.mc) { const L = soloBuilds(cls); let r = rng() * L.reduce((a, b) => a + b.w, 0); G.Builds.apply(m, L.find(b => (r -= b.w) < 0) || L[0]); } } // 다중 직업 빌드가 뽑히면 한 직업 빌드로 (무게대로)
    if (G.Builds?.CARD?.on) { m.picks = []; const r = cardRec(m); if (r) m.picks.push(r); m.cardq = [{ lv: 1, kind: 'pick' }]; G.Builds.refresh(m); } // 카드 모드: 대표 스킬 하나로 시작 · 1레벨 몫은 고를 것
    while (m.lv < lv) { m.lv++; G.Guild.grow(m); }
    if (lv > 1) cardAuto(m); // 2레벨 이상으로 들어오면 지나간 몫은 추천대로
    for (let i = 0; i < 300 && R.pending(m); i++) { const o = R.offer(m, rng); R.choose(m, o.kind === 'new' ? { kind: 'new' } : o.kind === 'swap' || !o.options.length ? 'keep' : o.options[0]); if (!o.options.length && o.kind !== 'new' && o.kind !== 'swap') break; }
    return G.Party.forge(m, rng);
  }
  // ── 명단: 직업마다 영웅 하나. 처음 파티에 넣을 때 들인다 — (명단 최고 레벨 − NEW_GAP), 최소 3레벨 ──
  const topLv = s => Math.max(0, ...Object.values(s.roster).map(h => h.m.lv));
  const newLv = s => Math.max(START_LV, topLv(s) - NEW_GAP);
  // 저장된 영웅을 이 세계(f)에 되살린다: 사람은 그대로(번호만 이 세계의 것으로), 마법 물건은 파티 공용 목록에 그 사람이 낀 채로
  function revive(f, s, cls, rng) {
    let h = s.roster[cls]; if (!h) { h = s.roster[cls] = { m: JSON.parse(JSON.stringify(member(f, cls, newLv(s), rng, soloBuilds(cls)[0]?.id))), tr: [] }; } // 고르는 단계 없이 들어오는 영웅(새 저장의 첫 파이터 · 빌드가 하나뿐인 직업)은 기본 빌드
    const m = JSON.parse(JSON.stringify(h.m)); m.uid = f.nextUid = (f.nextUid || 0) + 1; delete m.lead; m.inj = 0; m.downs = 0; m.cdK = {}; cardInit(m); // 쿨타임은 판마다 새로 · 카드 모드로
    for (const t of h.tr || []) G.Trinket.all(f).push({ ...t, id: f.trUid = (f.trUid || 0) + 1, on: m.uid });
    return m;
  }
  // 빌드 바꾸기 (길드 상태창): 같은 직업의 다른 빌드로 — 레벨 · 경험치 · 장비 · 능력치 향상은 그대로, 스킬 칸만 그 빌드의 필수 · 추천으로 다시 (G.Builds.apply)
  function rebuild(m, id) { const b = G.Builds.byId(id); if (!b || b.cls !== m.cls || b.mc) return false; noMc(m); G.Builds.apply(m, b); if (G.Builds.CARD?.on) { m.picks = []; m.cardq = CARD.PICK.filter(L => L <= m.lv).map(L => ({ lv: L, kind: 'pick' })); const r = cardRec(m); if (r) m.picks.push(r); cardAuto(m); } autoPick(m); return true; } // 카드 모드: 그 빌드의 추천대로 다시 (고른 것은 사라진다)
  // 판이 끝났다: 이번 판의 사람들(레벨 · 경험치 · 고른 것 · 장비)을 명단에 되적고, 쉬던 영웅은 나간 영웅 평균의 BENCH만큼(따라잡기 배율도) → 나간 영웅 평균 경험치 (PACE를 나누기 전 값 — 쉬는 영웅 · 정산이 gain으로 레벨마다 다시 나눈다)
  function bank(s, f) {
    let got = 0; const out = new Set();
    live.forEach((m, i) => { if (!m) return; out.add(m.cls); const c = JSON.parse(JSON.stringify(m)); delete c.lead; delete c.rs; c.inj = 0; c.downs = 0; got += pace(m.lv) * Math.max(0, totalXp(m) - (xp0[i] || 0));
      s.roster[m.cls] = { m: c, tr: G.Trinket.all(f).filter(t => t.on === m.uid).map(t => ({ ...t, on: null })) }; });
    const avg = live.length ? Math.round(got / live.length) : 0, top = topLv(s);
    for (const [c, h] of Object.entries(s.roster)) if (!out.has(c) && avg) gain(h.m, avg * BENCH * catchK(h.m.lv, top));
    return avg;
  }
  // 세계 하나 (원정 한 판): 새 상태 · 명단에서 파티(첫 사람이 앞장). map = 탐사 층의 쿼터뷰 지도 (CRAWL.start) — boot.js TestFloor.world('crawl')와 같은 순서 (그쪽은 앞장의 레벨을 시작 레벨로 되돌린다)
  function world(s, map, rng = Math.random) {
    hook(); G.newState(); if (G.Res.cdOn != null) { G.Res.cdOn = true; G.Res.clock = 0; } // 원정: 쿨타임 하나 (판마다 시계를 새로)
    const f = G.S.w.fantasy, ms = team(s).map(c => revive(f, s, c, rng));
    f.leader = { ...ms[0], lead: true }; G.Guild.leader(f);
    f.leaderNew = false; f.autoTr = f.autoParty = false; f.askMeet = false;
    const rest = ms.slice(1); f.mercs.push(...rest); f.lineup = rest.map(m => m.uid);
    f.floor = f.maxFloor = f.start = f.checkpoint = 1; f.town = true;
    G.Party.members(f).forEach(m => G.Party.place(f, m));
    const r = G.Fantasy.rt(f); G.Fantasy.syncAllies(f);
    f.town = false; r.phase = 'explore'; r.turn = null; r.mons = []; r.chests = []; r.fields = [];
    G.Trinket.sync?.(f); live = G.Party.members(f); xp0 = live.map(totalXp); // 앞장은 f.leader(사본)이라 명단 차례대로 엔진 쪽 사람을 잡아 둔다
    f.turnX = s.rt ? (speeds(s).includes(s.spdX) ? s.spdX : speeds(s)[0]) : speeds(s)[speeds(s).length - 1]; // 실시간은 ×1에서 (고른 배속은 기억한다) · 턴제는 연 것 중 가장 빠른 것
    r.map = map; r.seen = new Uint8Array(map.w * map.h).fill(1); r.seenVer = (r.seenVer || 0) + 1;
    return { f, r };
  }
  // 탐사 기록(st)을 원정에 맞춘다: 탐사 규칙의 체력을 엔진 체력(레벨에 맞는 값)으로 — 함정 2d6 · 사건 피해가 레벨과 맞게 / 시작 물자 / 번 금화의 기준
  function outfit(st, r, s) {
    st.party.forEach((m, i) => { const p = r.party[i]; if (p) { m.hp = m.max = Math.max(1, Math.round(p.max)); m.hero = p.merc; m.uid = p.merc?.uid; } }); // hero: 탐험 판정 = 그 영웅의 실제 수치
    Object.assign(st.items, pack(s)); st.bagCap = bagCap(s); st.loot = []; st.gold0 = st.gold; cur = st; curS = s; statInit(st); LOOT.length = 0; recall(st, s); // 짐: 챙긴 물자 (금화는 길드에서 낸다)
    for (const p of r.party) if (p.merc?.build) s.dex.h[p.merc.build] = (s.dex.h[p.merc.build] || 0) + 1; // 영웅 도감: 데리고 나간 빌드
  }
  // ── 층 지도 고정 · 지도 기억 · 경로 (2026-11-23) ──
  // 층 N의 지도는 (기준 씨앗, N)만으로 정해진다 — 파티 · 출발 층 · 몇째 판인지와 무관하게 같은 방 배치 · 같은 적 무리. 판정 · 드롭의 난수는 판마다 새로 (recall)
  const floorSeed = (s, fl) => ((s.mapSeed >>> 0) + fl * 977) >>> 0;
  const hx = (str, i, b) => parseInt((str || '')[i] || '0', b) || 0;
  // 탐사 기록(st)에서 알게 된 것을 그 층의 기억에 더한다 (줄어들지 않는다)
  function remember(s, st) {
    if (!st?.map) return; const fl = st.floor, N = st.map.nodes, E = st.map.edges, o = s.maps[fl] || { n: '', e: '' };
    const n = N.map((q, i) => { const v = hx(o.n, i, 16); return (Math.max(v & 3, Math.min(3, q.info || 0)) | (v & 4) | (q.visited ? 4 : 0) | (v & 8) | (q.visited || q.seenMap || (q.info || 0) >= 2 ? 8 : 0)).toString(16); }).join('');
    const e = E.map((q, i) => (hx(o.e, i, 32) | (q.walked ? 1 : 0) | (q.seen?.lock ? 2 : 0) | (q.seen?.dark ? 4 : 0) | (q.seen?.trap ? 8 : 0) | (q.seen?.hidden ? 16 : 0)).toString(32)).join('');
    s.maps[fl] = { n, e };
    s.trail[fl] = st.path.slice(); s.fail[fl] = st.map.edges.filter(q => q.stuck).map(q => q.id); // 지난 판에 실제로 간 길 (발자국) · 못 연 관문 (붉은 ✕)
  }
  // 새 층에 들어섰다 (판 시작 · 계단): 기억한 길의 정체(잠김 · 어두움 · 함정 · 찾은 숨은 통로)를 그 판에도 알고 간다 · 그 층의 경로 · 판정 난수는 새로
  function recall(st, s) {
    const m = s.maps[st.floor]; if (m) st.map.edges.forEach((q, i) => { const b = hx(m.e, i, 32); q.seen = q.seen || {}; if (b & 2) q.seen.lock = true; if (b & 4) q.seen.dark = true; if (b & 8) q.seen.trap = true; if (b & 16) q.seen.hidden = true; });
    st.plan = s.plan[st.floor] || null; st.planMiss = 0; st.planI = 0; st.rng = RUN.rng(newSeed()); st.freeSide = RUN.lit(st) ? 1 : 0; // 횃불은 챙긴 것을 판 전체에 — 빛 소마법 · 전원 암시야 파티는 층마다 첫 곁방 하나가 공짜
  }
  // 지도 위 경로 선의 점들 (칸 좌표): 방 a 가운데 → 방 안 칸만 밟아 문 → 복도 칸 → 문 → 방 b 가운데. 방 안은 칸 사이 걷기(8방향, 벽 모서리는 깎지 않는다)
  //   예전에는 방 가운데와 문을 곧게 이어, 모양이 고르지 않은 방(동굴 · 손으로 짠 방)에서 선이 벽을 가로지르고, 템플릿이 문 칸을 비운 방에서는 문이 방 밖에 찍혔다 (2026-11-23 사용자: 「경로가 실제 복도와 안 맞는다」)
  function inRoom(cells, from, to) {
    const S = new Set(cells.map(c => c[0] + ',' + c[1])), k = c => c[0] + ',' + c[1], near = p => cells.reduce((b, c) => (Math.hypot(c[0] - p[0], c[1] - p[1]) < Math.hypot(b[0] - p[0], b[1] - p[1]) ? c : b), cells[0]);
    const s = near(from), g = S.has(k(to)) ? to : near(to), prev = new Map([[k(s), null]]), q = [s];
    while (q.length) { const c = q.shift(); if (k(c) === k(g)) break; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { if (!dx && !dy) continue; const n = [c[0] + dx, c[1] + dy]; if (!S.has(k(n)) || prev.has(k(n))) continue; if (dx && dy && !(S.has(k([c[0] + dx, c[1]])) && S.has(k([c[0], c[1] + dy])))) continue; prev.set(k(n), c); q.push(n); } }
    const out = []; for (let c = g; c; c = prev.get(k(c))) out.unshift(c); return out;
  }
  function segPts(map, a, b) {
    const e = map.edges.find(q => (q.a === a && q.b === b) || (q.a === b && q.b === a)); if (!e) return null;
    const L = map._lay, c = L.cor[e.id], ra = L.room[e.a], rb = L.room[e.b], ctr = r => [r.x + r.w / 2 - 0.5, r.y + r.h / 2 - 0.5];
    const c0 = c.cells[0] || c.doorB, c1 = c.cells[c.cells.length - 1] || c.doorA; // 문: 방 칸 가운데 복도 첫 칸에 닿는 것 (템플릿이 원래 문 칸을 비웠으면 가장 가까운 방 칸)
    const pts = [...inRoom(ra.cells, ctr(ra), c.doorA && ra.cells.some(q => q[0] === c.doorA[0] && q[1] === c.doorA[1]) ? c.doorA : c0), ...c.cells, ...inRoom(rb.cells, ctr(rb), c.doorB && rb.cells.some(q => q[0] === c.doorB[0] && q[1] === c.doorB[1]) ? c.doorB : c1).reverse()];
    // 줄 당기기: 칸 사이 걷기의 계단 모양을 펴서, 곧게 그어도 허용 칸(그 길의 복도 + 양 끝 방) 안이면 건너뛴다 (방 안에서 선이 지그재그로 흔들리던 것)
    const okS = new Set([...c.cells, ...ra.cells, ...rb.cells].map(q => q[0] + ',' + q[1])), clear = (p, q) => { const n = Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) * 4) + 1; for (let j = 0; j <= n; j++) if (!okS.has(Math.round(p[0] + (q[0] - p[0]) * j / n) + ',' + Math.round(p[1] + (q[1] - p[1]) * j / n))) return false; return true; };
    const simp = [pts[0]]; for (let i = 0; i < pts.length - 1;) { let j = pts.length - 1; while (j > i + 1 && !clear(pts[i], pts[j])) j--; simp.push(pts[j]); i = j; }
    return { e, pts: e.a === a ? simp : simp.reverse() };
  }
  // 원정 중 지도(미니맵)에 그릴 상태: 이번 판의 탐사 기록 + 그 층의 지도 기억 (이전 판에 가 본 방 · 본 방 · 지나간 길 · 길 정체). 규칙 상태는 그대로 두고 그리는 사본만 합친다
  //   발자국 · 지금 위치는 이번 판 것 (st.path · st.at)
  function drawState(s, st) {
    const m = s.maps[st.floor] || { n: '', e: '' };
    const nodes = st.map.nodes.map((q, i) => { const v = hx(m.n, i, 16), vis = q.visited || !!(v & 4), info = Math.max(q.info || 0, v & 3); return { ...q, visited: vis, info, seenMap: q.seenMap || !!(v & 8), notes: q.notes.length || !q.hostile || !(vis || info >= 2) ? q.notes : [{ t: short(q.g), ink: 'pencil' }] }; });
    const edges = st.map.edges.map((q, i) => { const b = hx(m.e, i, 32); return { ...q, walked: q.walked || !!(b & 1), seen: { ...q.seen, lock: q.seen?.lock || !!(b & 2), dark: q.seen?.dark || !!(b & 4), trap: q.seen?.trap || !!(b & 8), hidden: q.seen?.hidden || !!(b & 16) } }; });
    const ex = explored(s, st.floor); return { ...st, title: `${RUN.zone(st.floor).n} · ${st.floor}층${ex ? ` · 탐사 ${ex[0]}/${ex[1]}` : ''}`, map: { ...st.map, nodes, edges } };
  }
  // 들어가 본 방 / 전체 방 (기억이 없으면 null)
  const explored = (s, fl) => { const m = s.maps[fl]; if (!m) return null; let v = 0; for (let i = 0; i < m.n.length; i++) if (hx(m.n, i, 16) & 4) v++; return [v, m.n.length]; };
  // 길드의 지도 화면: 그 층의 지도를 다시 만들고 기억한 것만 드러낸 탐사 기록 꼴 (RUN.draw.render · RUN.moveActs가 그대로 읽는다). 파티는 지금 고른 사람들 · 물자는 지금 해금
  // 지도 만들기는 무겁다 (설계서 층은 한 장에 0.1~0.3초) — 길드 지도 화면은 같은 층을 자꾸 다시 그리니 씨앗마다 한 번만 만들고 사본을 쓴다
  const GEN = new Map(); const genMap = (seed, fl) => { const k = seed + ':' + fl; if (!GEN.has(k)) { if (GEN.size > 24) GEN.clear(); GEN.set(k, JSON.stringify(RUN.gen.make(seed, fl))); } return JSON.parse(GEN.get(k)); };
  // ── 곁방 · 횃불 (설계서 층): 곁방(막다른 방)에 한 번 들를 때 횃불 하나 — 큰길 · 갈래는 공짜. 층마다 다시 채운다 (해금한 개수 + 빛 소마법이나 전원 암시야면 1)
  //    횃불이 없어도 들어간다: 적이 있는 방이면 기습당하고(적이 먼저), 그 밖이면 어둠 속 함정 피해 (탐사 규칙의 함정과 같은 2d6 · 민첩 13 내성이면 절반)
  const torches = (s, st) => bagPlan(s).torch + (RUN.lit(st) ? 1 : 0); // 길드 지도의 경로 요약: 챙길 횃불 + 그 층의 공짜 한 번
  const isSide = (map, id) => !!map.nodes[id]?.side;
  // 방에서 얻는 것 (지도에 미리 — 실제 규칙의 값): 물건 수(G.Gear.N_DROP) · 나올 수 있는 등급(이 층 희귀도 표 R_TABLE) · 포로 구출 = 동료 +1 · 야영 = 긴 휴식(체력 100%)
  function reward(n, floor) {
    const kind = n.type === 'treasure' || n.chest ? 'treasure' : n.type === 'elite' || n.type === 'boss' ? n.type : null, o = {};
    if (kind) { o.items = G.Gear.N_DROP[kind]; const w = R_TABLE[Math.min(R_TABLE.length - 1, Math.floor((floor - 1) / 2) + (R_UP[kind] || 0))]; o.r = w.map((x, i) => (x > 0 ? i + 1 : 0)).filter(Boolean); }
    if (kind) o.gem = true; // 보석이 나오는 방
    if (n.type === 'event' && n.ev === 'captive') o.ally = 1;
    if (n.type === 'camp') o.heal = 100;
    return o;
  }
  // 경로 예상 (길드 지도 아래, 방 차례대로 한 줄씩): 아는 만큼만 — 들어가 본 방은 확정, 문 너머로 본 방(info 2 이상)은 「추정」, 그 밖은 「?」
  //   [{ t: 줄, k: fight | got | gate | sum }] · 관문(잠긴 문 · 함정 · 어두운 길 · 횃불)은 그 길 다음 줄에
  function planLines(s, V, plan) {
    const out = [], N = V.map.nodes, seen = new Set([plan[0]]), fl = V.floor; let fights = 0, items = 0, ally = 0;
    const hs = team(s).map(c => s.roster[c]?.m).filter(Boolean), unitsOf = g => (g.units || [[g.name, g.count]]).map(([n, c]) => { const a = affTag(s, n, hs); return `${n} ${c}${a ? ` ${a}` : ''}`; }).join(' · ');
    for (let k = 1; k < plan.length; k++) {
      const id = plan[k], q = V.map.edges.find(e => (e.a === plan[k - 1] && e.b === id)); // 돌아오는 길은 관문 없음
      if (q && !q.walked && ((q.kind === 'locked' && q.seen.lock) || (q.kind === 'trap' && q.seen.trap) || (q.kind === 'dark' && q.seen.dark))) { const gi = gateInfo(s, V, q); out.push({ t: gateTxt(s, V, q), k: 'gate', no: gi.length > 0 && gi.every(x => !x.val && !x.who.includes('누구나')) }); } // 관문: 지금 파티의 값 · 없으면 풀 수 있는 직업 · no = 지금 파티로는 못 연다
      if (seen.has(id)) continue; seen.add(id);
      if (N[id].dark && darkKnown(N[id])) out.push({ t: gateTxt(s, V, { kind: 'dark', room: id }), k: 'gate' }); // 어두운 방: 빛 · 횃불
      const n = N[id], know = n.visited ? 2 : n.info >= 2 ? 1 : 0, est = know === 1 ? ' 추정' : '', nm = n.name || RUN.TYPE[n.type] || '방', o = reward(n, fl), bits = [];
      if (!know) { out.push({ t: `${nm} · ?`, k: 'fight' }); continue; }
      if (n.hostile && n.g) { bits.push(`${unitsOf(n.g)}${est}`); fights++; }
      if (o.items) { const r0 = RARITY[o.r[0]], r1 = RARITY[o.r[o.r.length - 1]]; bits.push(`물건 ${o.items} · ${r0}${r1 !== r0 ? `~${r1}` : ''} 추정`); items += o.items; }
      if (o.ally && evOf(s, fl, id)?.st !== 'done') { bits.push(`동료 +${o.ally}${est || ' 추정'}`); ally += o.ally; } // 해결된 포로 구출은 다시 안 생긴다
      if (o.heal) bits.push(`회복 ${o.heal}%`);
      if (n.type === 'event') { const e = evOf(s, fl, id), want = s.evPlan?.[fl]?.[id]; if (e?.st === 'done') bits.push('해결'); else bits.push(want ? `${want.replace(/^\[[^\]]*\] /, '')}` : e?.st === 'skip' ? '사건 · 미해결' : '사건'); } // 사건: 해결 · 계획에서 고른 선택지 · 미해결
      if ((s.campPlan?.[fl] || []).includes(id)) { const r = raidRisk(V.map, id); bits.push(`야영${r ? ` · 습격 ${Math.round(r * 100)}%` : ''}`); } // 계획한 야영 지점
      out.push({ t: `${nm}${bits.length ? ` · ${bits.join(' · ')}` : ''}`, k: n.hostile ? 'fight' : o.items || o.ally ? 'got' : 'exp', ev: n.type === 'event' && n.ev && evOf(s, fl, id)?.st !== 'done' ? id : null }); // ev: 화면이 그 줄을 누르면 사건 선택지 판
    }
    const [tu, tn] = torchUse(s, V, plan), cu = (s.campPlan?.[fl] || []).filter(id => plan.includes(id)).length, cn = bagPlan(s).camp;
    out.push({ t: [`전투 ${fights}`, items ? `물건 ${items} 추정` : '', ally ? `동료 +${ally}` : '', cu ? `야영 ${cu} · 물자 ${cu}/${cn}` : '', tu ? `횃불 ${tu}/${tn}` : ''].filter(Boolean).join(' · '), k: 'sum', short: tu > tn || cu > cn });
    return out;
  }
  // 경로로 얻는 것의 합 (같은 방은 한 번)
  const planReward = (map, plan, floor) => { const t = { items: 0, ally: 0 }; for (const id of new Set((plan || []).slice(1))) { const o = reward(map.nodes[id], floor); t.items += o.items || 0; t.ally += o.ally || 0; } return t; };
  // 곁방에 들어선다 (처음): 횃불을 쓰거나 어둠 → { torch, dark }. 적이 없는 방이면 피해까지 여기서
  function sideEnter(st, id) { return null; // 「곁방마다 횃불 하나」는 없앴다 (2026-11-23) — 횃불은 어두운 길에서만 (탐사 규칙)
  }
  function sideEnterOld(st, id) {
    const n = st.map.nodes[id]; if (!n?.side || n.sideIn) return null; n.sideIn = true;
    if (st.freeSide > 0) { st.freeSide--; st.log.push({ t: `${n.name || '곁방'} · 빛`, k: 'dv' }); return { torch: true }; }
    if (st.items.torch > 0) { st.items.torch--; st.log.push({ t: `${n.name || '곁방'} · 횃불 ${st.items.torch + 1} → ${st.items.torch}`, k: 'dv' }); return { torch: true }; }
    st.log.push({ t: `${n.name || '곁방'} · 횃불 0 · 어둠`, k: 'dv' });
    if (!n.hostile) for (const m of st.party.filter(q => !q.dead)) { const ok = RUN.check(st.rng, RUN.CLS[m.cls].dex, 13).ok, d = RUN.roll(st.rng, '2d6'), v = ok ? Math.floor(d / 2) : d; m.hp -= v; if (m.hp <= 0) { m.hp = 0; m.dead = true; } }
    if (!st.party.some(q => !q.dead)) st.done = 'lose';
    return { dark: true };
  }
  // 경로의 곁방 들르기 수 (같은 곁방은 한 번)
  const planSides = (map, plan) => new Set((plan || []).filter(id => isSide(map, id))).size;
  // 경로에 필요한 횃불 = 경로 위의 아는 어두운 길 수 (빛 · 전원 암시야 파티는 0)
  const planDark = (V, plan) => { let n = 0; for (let k = 0; k + 1 < (plan || []).length; k++) { const q = V.map.edges.find(e => e.a === plan[k] && e.b === plan[k + 1]); if (q && q.kind === 'dark' && q.seen.dark && !q.walked) n++; } for (const id of new Set((plan || []).slice(1))) if (V.map.nodes[id]?.dark && darkKnown(V.map.nodes[id])) n++; return RUN.X && RUN.X.lit(V) ? 0 : n; };
  const darkKnown = n => !!(n.visited || n.seenMap || n.info >= 1); // 어두운 방은 방이 보이면 안다 (어둡다는 것만)
  // 길드 지도 화면: 이 층 경로가 쓰는 횃불 / 가진 횃불
  const torchUse = (s, V, plan) => [planDark(V, plan), bagPlan(s).torch];
  const short = g => { const u = g.units || [[g.name, g.count]]; return `${u[0][0]} ${u[0][1]}${u.length > 1 ? '+' : ''}`; }; // 「홉고블린 2+」
  function view(s, fl) {
    const map = genMap(floorSeed(s, fl), fl), m = s.maps[fl] || { n: '', e: '' };
    map.nodes.forEach((q, i) => { const v = hx(m.n, i, 16); q.info = v & 3; q.visited = !!(v & 4) || i === 0; /* 입구는 늘 안다 */ q.seenMap = !!(v & 8); q.notes = q.hostile && (q.visited || q.info >= 2) ? [{ t: short(q.g), ink: q.visited ? 'ink' : 'pencil' }] : []; /* 길드 지도: 적 구성은 한 줄로 짧게 */ });
    map.edges.forEach((q, i) => { const b = hx(m.e, i, 32); q.walked = !!(b & 1); q.seen = { lock: !!(b & 2), dark: !!(b & 4), trap: !!(b & 8), hidden: !!(b & 16) }; });
    const party = team(s).map(c => { const k = G.Party.RUN_CLS[c] || 'fighter', C = RUN.CLS[k], h = s.roster[c]?.m || { cls: c, lv: newLv(s), ab: G.Party.stdAb(c), name: '' }; return { cls: k, n: h.name || C.n, hp: C.hp, max: C.hp, dead: false, sl: { ...(C.slots || {}) }, hero: h }; }); // hero: 탐험 판정은 영웅의 실제 수치로 (RUN.X)
    return { map, at: 0, here: {}, party, items: kit(s), floor: fl, revealAll: true, flags: {}, log: [], path: [0] };
  }
  const shownN = q => q.visited || q.seenMap || q.info >= 2;
  const edgeOK = (V, q) => (q.kind !== 'hidden' || q.seen.hidden) && shownN(V.map.nodes[q.b]) && (q.walked || V.map.nodes[q.a].visited);
  // 출발 방(또는 경로의 끝)에서 그 방까지 아는 길로 앞으로만 (없으면 null)
  function pathTo(V, from, to) {
    const prev = new Map([[from, null]]), q = [from];
    while (q.length) { const a = q.shift(); if (a === to) break; for (const e of V.map.edges) if (e.a === a && !prev.has(e.b) && edgeOK(V, e)) { prev.set(e.b, a); q.push(e.b); } }
    if (!prev.has(to)) return null; const out = []; for (let k = to; k != null; k = prev.get(k)) out.unshift(k); return out;
  }
  // 경로 잡기: 이미 경로에 있는 방이면 거기까지로 줄이고, 경로 끝에서 이어지면 잇고, 아니면 출발 방부터 새로. 못 가는 방이면 그대로
  function planTo(s, V, id) {
    const fl = V.floor, cur = s.plan[fl] || [0], i = cur.indexOf(id);
    if (i >= 0) { s.plan[fl] = cur.slice(0, i + 1); if (s.plan[fl].length < 2) delete s.plan[fl]; return true; }
    const tail = pathTo(V, cur[cur.length - 1], id), fresh0 = tail ? null : pathTo(V, 0, id);
    const back = p => { const e = p[p.length - 1], n = V.map.nodes[e]; if (n.side && !V.map.edges.some(q => q.a === e && edgeOK(V, q)) && p.length > 1) p.push(p[p.length - 2]); return p; }; // 막다른 곁방: 갈라진 방으로 돌아온다
    if (tail) { s.plan[fl] = back(cur.concat(tail.slice(1))); return true; } if (fresh0) { s.plan[fl] = back(fresh0); return true; } return false;
  }
  // 잠긴 문을 지금 파티 · 물자로 푸는 값 (탐사 규칙의 계산 그대로): 적이 있는 방은 문 앞 준비(G.Prep)가 걷어차서라도 연다 → 「부수기」, 그 밖은 RUN.moveActs
  function doorVals(V, q) {
    if (q.kind === 'locked' && V.map.nodes[q.b].hostile && (q.lock || 'lock') !== 'seal') return ['부수기'];
    const out = []; q.tried = {}; const acts = q.kind === 'locked' ? RUN.moveActs({ ...V, xcd: {} }, q) : [], pct = p => `${Math.round(p * 100)}%`;
    for (const a of acts) { if (a.id === 'pick') out.push(`따기 ${pct(a.p)}`); if (a.id === 'break') out.push(`부수기 ${pct(a.p)}`); if (a.id === 'knock') out.push('열림'); }
    return out.length ? out : ['✕'];
  }
  // 관문을 푸는 열쇠와 직업 (지도 · 경로 요약): [{ k: 열쇠, who: 풀 수 있는 직업 이름들, val: 지금 파티의 값 | null }] — 지금 파티에 없어도 누구를 데려와야 하나가 보이게
  // 관문 한 줄 (경로 요약 · 지도): 지금 파티의 값이 있으면 값, 없으면 풀 수 있는 직업
  const GATE_N = { locked: { lock: '잠긴 문', bars: '창살', seal: '마법 봉인', rubble: '무너진 길' }, dark: '어두운 길', trap: '함정', hidden: '숨은 통로' };
  const gateTxt = (s, V, q) => { const nm = q.room != null ? '어두운 방' : q.kind === 'locked' ? GATE_N.locked[q.lock || 'lock'] : GATE_N[q.kind] || ''; const o = gateInfo(s, V, q).map(x => x.val || (x.who.length ? `${x.k} ${x.who.join('·')}` : '')).filter(Boolean); return `${nm}${o.length ? ` · ${o.join(' · ')}` : ''}`; };
  function gateInfo(s, V, q) {
    const lv = c => s.roster[c]?.m?.lv || newLv(s), who = id => CLS.map(c => [c, (EXPL[c] || []).find(([x]) => x === id)]).filter(([, e]) => e).map(([c, [, L]]) => `${clsName(c)}${lv(c) < L ? ` ${L}` : ''}`), vals = doorVals(V, q), v = re => vals.find(x => re.test(x)) || null; // 모든 직업 (안 연 직업도 — 누구를 데려와야 하나) · 레벨이 모자라면 필요한 레벨
    if (q.kind === 'locked') { const lt = q.lock || 'lock', o = [];
      if (lt === 'lock' || lt === 'bars') o.push({ k: '따기', who: who('pick'), val: v(/^따기/) });
      if (lt !== 'seal') o.push({ k: '부수기', who: ['누구나'], val: v(/^부수기/) });
      if (lt === 'lock' || lt === 'seal') o.push({ k: '열림', who: who('knock'), val: v(/^열림/) });
      return o; }
    if (q.kind === 'dark') return [{ k: '빛', who: who('light'), val: XRUN.lit(V) ? '빛' : null }, { k: '횃불', who: ['누구나'], val: null }];
    if (q.kind === 'hidden') return [{ k: '조사', who: ['누구나'], val: q.seen?.hidden ? '찾음' : 'DC 15' }, { k: '능숙한 탐험가', who: who('explorer'), val: null }]; // 숨은 통로: 조사 DC 15 (레인저 능숙한 탐험가 = 조사 전문화)
    if (q.kind === 'trap') { const best = {}; for (const id of ['disarm', 'danger', 'findtraps', 'evasion']) for (const c of CLS) { const e = (EXPL[c] || []).find(([x]) => x === id); if (e && !(c in best && best[c] <= e[1])) best[c] = e[1]; } return [{ k: '함정', who: Object.entries(best).map(([c, L]) => `${clsName(c)}${lv(c) < L ? ` ${L}` : ''}`), val: null }]; } // 해제 · 위험 감지 · 함정 찾기 · 회피 (직업마다 가장 이른 것)
    return [];
  }
  // ── 탐험 스킬 (2026-11-23, SRD 직업 기능 · 주문 — 그 레벨이 되어야 생긴다): [id, 레벨]. 탐험에만 쓴다 (전투 스킬 여섯 칸과 별개)
  //   tactical 전술적 사고(실패한 판정 +1d10, 쿨) · brute 운동 이점(부수기) · danger 위험 감지(함정 내성 이점) · pick 자물쇠 따기(도둑 도구 전문화) · disarm 함정 해제 · scout 정찰 · evasion 회피
  //   sense 신성 감지 · explorer 능숙한 탐험가(조사 전문화) · lore 사냥꾼의 지식 · findtraps 함정 찾기 · augury 점술 · light 빛 · jack 만능 재주꾼 · knock 열림 · detect 마법 탐지 · track 흔적 쫓기
  const EXPL = {
    dragoon: [['tactical', 2], ['brute', 3]], barbarian: [['brute', 1], ['danger', 2]], rogue: [['pick', 1], ['disarm', 1], ['scout', 1], ['evasion', 7]], monk: [['evasion', 7]],
    paladin: [['sense', 1]], archer: [['scout', 1], ['track', 1], ['explorer', 2], ['lore', 3], ['findtraps', 5]], cleric: [['light', 1], ['augury', 3], ['findtraps', 3]],
    scout: [['track', 1], ['scout', 2], ['augury', 3], ['findtraps', 3]], bard: [['light', 1], ['jack', 2], ['knock', 3]], archmage: [['light', 1], ['detect', 1], ['knock', 3], ['augury', 3]],
    mage: [['light', 1], ['knock', 3]], warlock: [['detect', 1]],
  };
  // 쿨타임 (라운드 · 방을 하나 옮기면 ROOM_R) — 시험값
  const XCD = { knock: 12, augury: 6, findtraps: 6, detect: 6, sense: 6, tactical: 6 }, ROOM_R = 6;
  const KO_SK = { 운동: 'athletics', 지각: 'perception', 은신: 'stealth', 조사: 'investigation', 생존: 'survival', 설득: 'persuasion', 위협: 'intimidation', 종교: 'religion', 비전: 'arcana', 의학: 'medicine', 역사: 'history' };
  const clsName = c => (G.Guild.def({ cls: c }) || {}).n || c;
  const hasX = (h, id) => !!h && (EXPL[h.cls] || []).some(([x, L]) => x === id && (h.lv || 1) >= L);
  // 원정의 탐사 규칙 연결 (RUN.X — js/explore/rules.js가 쓴다): 판정 = d20 + 영웅의 능력치 수정치 + 숙련(전문화 두 배) · 탐험 스킬 · 쿨타임
  const XRUN = {
    CD: XCD, ROOM_R,
    skill(m, sk) { const h = m.hero; if (!h) return (RUN.CLS[m.cls]?.sk || {})[sk] ?? 0; const N = G.Dnd, pr = N.prof(h.lv || 1);
      if (sk === '도둑 도구') return N.mod(N.ab(h).dex) + (hasX(h, 'pick') ? pr * 2 : -5); // 로그: 도둑 도구 숙련 + 전문화
      const en = KO_SK[sk]; if (!en) return 0; let v = N.skill(h, en);
      if (en === 'investigation' && hasX(h, 'explorer')) v += pr; // 능숙한 탐험가: 조사 전문화
      if (hasX(h, 'jack') && !N.profs(h).includes(en)) v += Math.floor(pr / 2); // 만능 재주꾼: 숙련 없는 판정에 숙련 절반
      return v; },
    can(st, m, id) { if (!hasX(m.hero, id)) return false; if (!XCD[id]) return true; const c = (st.xcd || {})[m.uid || m.n]; return !(c && c[id] > 0); },
    use(st, m, id) { if (!XCD[id]) return; st.xcd = st.xcd || {}; (st.xcd[m.uid || m.n] = st.xcd[m.uid || m.n] || {})[id] = XCD[id]; },
    tick(st, r) { for (const k in st.xcd || {}) for (const id in st.xcd[k]) st.xcd[k][id] = Math.max(0, st.xcd[k][id] - r); if (G.Res?.cdOn) G.Res.clock += r; }, // 전투 스킬과 한 시계
    lightBy: st => st.party.find(m => !m.dead && hasX(m.hero, 'light')),
    lit(st) { const al = st.party.filter(m => !m.dead); return !!XRUN.lightBy(st) || (al.length > 0 && al.every(m => (m.hero && G.Light ? G.Light.darkvision({ merc: m.hero }) > 0 : RUN.CLS[m.cls]?.dv))); }, // 전원 암시야 = 영웅의 실제 종족 (전에는 옛 다섯 직업표 — 파이터면 드워프로 쳤다)
    onFail(st, m, r, c) { if (!XRUN.can(st, m, 'tactical')) return 0; XRUN.use(st, m, 'tactical'); const d = 1 + Math.floor(st.rng() * 10); st.log.push({ t: `${m.n} · 전술적 사고 · +${d}`, k: 'dv' }); return d; },
    trapSave(st, m) { const h = m.hero; if (!h) return { b: RUN.CLS[m.cls]?.dex ?? 0, adv: 0, ev: false }; const N = G.Dnd, b = N.mod(N.ab(h).dex) + (['rogue', 'monk', 'archer', 'bard'].includes(h.cls) ? N.prof(h.lv || 1) : 0); return { b, adv: hasX(h, 'danger') ? 1 : 0, ev: hasX(h, 'evasion') }; },
    // 사건의 직업 선택지 (2026-11-23): 옛 다섯 직업 대신 그 일을 할 수 있는 영웅 — 실제 숙련 · 능력치 · 탐험 스킬 · SRD 주문 계열. 여럿이면 그 판정 값이 가장 높은 사람
    //   rogue = 도둑 도구 · 손재주 · 은신 / fighter = 운동 숙련 또는 근력 +2 / wizard = 비전 주문(바드 · 소서러 · 워락 · 위저드) / cleric = 신성 주문(클레릭 · 팔라딘) 또는 신성 감지 · 점술 / ranger = 생존 숙련 · 추적 · 정찰
    ROLE_N: { rogue: '도둑 도구', fighter: '운동', wizard: '비전', cleric: '신성', ranger: '생존' },
    role(st, cls, sk) { const N = G.Dnd, ok = h => { if (!h) return false; const P = N.profs(h);
        if (cls === 'rogue') return hasX(h, 'pick') || P.includes('sleight') || P.includes('stealth');
        if (cls === 'fighter') return P.includes('athletics') || N.mod(N.ab(h).str) >= 2;
        if (cls === 'wizard') return ['bard', 'mage', 'warlock', 'archmage'].includes(h.cls);
        if (cls === 'cleric') return ['cleric', 'paladin'].includes(h.cls) || hasX(h, 'sense') || hasX(h, 'augury');
        if (cls === 'ranger') return P.includes('survival') || hasX(h, 'track') || hasX(h, 'scout');
        return h.cls === cls; };
      const c = st.party.filter(m => !m.dead && ok(m.hero)); if (!c.length) return null; return sk ? c.reduce((a, m) => (XRUN.skill(m, sk) > XRUN.skill(a, sk) ? m : a)) : c[0]; },
    clsN: m => clsName(m.hero?.cls) || m.n,
    onLore(st, n) { if (curS && n?.g) for (const u of n.g.units || [[n.g.name]]) affMark(curS, u[0]); }, // 사냥꾼의 지식 (탐사 행동): 옆 방 적의 상성
    unholy: n => (n.g?.units || []).some(([nm]) => ['undead', 'fiend'].includes(G.D.F.mon[G.Encounter.monName(nm)]?.ty)),
  };

  // 이번 판 그 층에서 경로가 잠긴 문에 막힌 수 (판정을 다 해 보고 못 연 문 — crawl.js가 e.stuck을 붙인다)
  const planBlocked = st => { const p = st.plan; if (!p) return 0; let n = 0; for (let i = 0; i + 1 < p.length; i++) { const e = st.map.edges.find(q => q.a === p[i] && q.b === p[i + 1]); if (e && e.stuck) n++; } return n; };

  // 계단을 내려갔다: 계단 야영 (살아 있는 사람 체력 % · 4단계면 엔진 자원도 긴 휴식)
  function descend(st, s, members) { if (cur && cur !== st) { st.stat = cur.stat; cur = st; } recall(st, s); } // 처치 금화 · 짐 · 집계가 새 층의 상태로 (전에는 1층 상태에 남았다) // 계단: 회복 없음 (야영뿐 — 2026-11-23)

  // ── 차례로 몰려오는 적 (2026-11-26 사용자: 「한마리 두마리 세마리 같이 순차적으로 늘려서」): 무리를 늘려 셋까지 나눈다. 약한 것부터, 센 것 · 우두머리는 마지막에.
  //   TUNE.WAVE: fight · elite = 적 수의 배율 · max = 한 번에 나오는 수 · pay = 늘어난 만큼 나눈 경험치 · 금화에 곱하는 값
  const monXp = n => G.Region.XP[G.D.F.mon[G.Encounter.monName(n)]?.stat?.cr] || G.Region.XP[G.D.F.mon[G.Encounter.monName(n)]?.cr] || 0;
  function waveSizes(n, max) {
    if (n <= 1) return [1]; if (n === 2) return [1, 1]; const k = n < 6 ? 2 : 3, out = Array(k).fill(0); let left = n;
    for (let i = 0; i < k; i++) { out[i] = i + 1; left -= i + 1; } for (let i = k - 1; left > 0; i = (i + k - 1) % k) { if (out.every(v => v >= max)) { out.push(Math.min(left, max)); left -= out[out.length - 1]; continue; } if (out[i] < max) { out[i]++; left--; } }
    return out.sort((a, b) => a - b);
  }
  function waves(g, type, size, floor) {
    const W = TUNE.WAVE, us = (g.units || [[g.name, g.count]]), flat = us.flatMap(([n, c]) => Array(c).fill(n)), tally = L => { const o = new Map(); for (const n of L) o.set(n, (o.get(n) || 0) + 1); return [...o]; };
    if (!W || !flat.length) return { list: [us], k: 1 };
    const boss = type === 'boss' ? flat.shift() : null, cost = RUN.zone(floor)?.cost || {}, weak = flat.slice().sort((a, b) => monXp(a) - monXp(b))[0] || (boss && Object.keys(cost).sort((a, b) => cost[a] - cost[b])[0]);
    const n0 = flat.length, want = size < 2 ? n0 + (type === 'fight' ? 1 : 0) : boss ? Math.max(n0 + 1, Math.min(6, size + 1)) : Math.max(n0 + 1, Math.round(n0 * (type === 'elite' ? W.elite : W.fight)));
    const all = flat.concat(Array(Math.max(0, want - n0)).fill(weak)).sort((a, b) => monXp(a) - monXp(b));
    let i = 0; const list = waveSizes(all.length, W.max).map(s => all.slice(i, i += s)).filter(L => L.length);
    if (boss) { if (list.length > 1) list[list.length - 1].unshift(boss); else list.push([boss]); } // 우두머리는 마지막 무리의 맨 앞
    return { list: list.map(tally), k: Math.min(1, (n0 + (boss ? 1 : 0)) / (all.length + (boss ? 1 : 0)) * W.pay) };
  }
  // ── 자동 정책 (탐사가 묻는 곳마다 하나를 고른다 — 화면 없이). 돌려주는 것은 고른 번호 (없으면 -1 = 「두고 간다 · 둘러본다」) ──
  const hurt = st => { const a = st.party.filter(m => !m.dead); return a.length ? a.reduce((x, m) => x + m.hp / m.max, 0) / a.length : 1; };
  // 갈림길 기록 (화면 아래 로그): 「갈림길 · 계획 → 보물 창고」
  const forkLog = (st, x, how) => { const n = st.map.nodes[x.to]; st.log.push({ t: `갈림길 · ${how} → ${n.name || RUN.TYPE[n.type] || '방'}`, k: 'fork' }); };
  const RANK = { treasure: 0, event: 1, fight: 2, camp: 3, shop: 4, elite: 5, boss: 6 }; // 갈림길: 보물 > 사건 > 전투 > 정예 (야영은 다쳤을 때 맨 앞)
  const POL = {
    // 방에 들어섰다 (설계서 층): 함정 · 숨은 통로를 저절로 찾아본다 (조사 판정 — 탐사 규칙 그대로, 방마다 한 번)
    // 방에 들어섰다: 조사(함정 · 숨은 통로) · 함정 찾기 · 신성 감지 · 사냥꾼의 지식 · 마법 탐지를 저절로, 그리고 아직 안 간 이웃 방을 미리 알기(정찰 · 흔적 · 점술) — 탐사 규칙 그대로
    arrive(st) { if (st.here.xdone) return; st.here.xdone = true;
      const mark = a => { const L = st.log[st.log.length - 1]; if (L && !L.g && !L.r) L.g = { who: a.who || '', gate: '탐험', how: a.label, ok: true }; }; // 탐험 스킬 (판정 없는 것): 화면의 알림 판으로 — 판정 있는 것은 그 기록(.r)을 쓴다
      for (const a of RUN.roomActs(st)) if (['search', 'findtraps', 'sense', 'lore', 'detect'].includes(a.id)) { const n0 = st.log.length; a.run(); if (st.log.length > n0 && a.id !== 'search' && a.id !== 'findtraps') mark(a); }
      for (const x of RUN.nexts(st)) { if (x.n.visited || x.n.info >= 3) continue; for (const a of RUN.infoActs(st, x.e)) if (a.id === 'augury' || (a.id === 'scout' && x.n.hostile) || a.id === 'track') { const n0 = st.log.length; a.run(); if (st.log.length > n0 && a.id === 'augury') mark(a); if (st.here.augury) break; } } },
    side: sideEnter,
    // 갈림길: opts = 출구들 ({ to, e }). 체력이 낮으면 야영 쪽, 아니면 RANK — 잠긴 보물 방은 열 수단이 있을 때만 (로그 · 열림 두루마리 · 열림 주문)
    fork(st, opts) {
      // 경로가 있으면 먼저: 경로의 다음 방이 선택지에 있으면 그리로 (다쳤어도 — 플레이어가 정한 길이 먼저). 없으면(막혔다 · 경로를 벗어났다) 아래 자동 규칙
      if (st.plan) { const i0 = st.plan.indexOf(st.at, st.planI || 0), i = i0 >= 0 ? i0 : st.plan.indexOf(st.at), nx = i >= 0 ? st.plan[i + 1] : null; if (nx != null) { const j = opts.findIndex(x => x.to === nx); if (j >= 0) { st.planI = i + 1; forkLog(st, opts[j], '계획'); return j; } st.planMiss = (st.planMiss || 0) + 1; } } // planI: 경로에서 지금 어디쯤 (곁방 왕복으로 같은 방이 두 번 나온다)
      const solo = st.party.filter(m => !m.dead).length < 2, low = hurt(st) < 0.5, canOpen = RUN.X ? st.party.some(m => !m.dead && (RUN.X.can(st, m, 'pick') || RUN.X.can(st, m, 'knock'))) : st.party.some(m => !m.dead && (m.cls === 'rogue' || m.cls === 'wizard')) || st.items.knockScroll > 0; // 잠긴 곁방을 열 수단 (따기 · 열림 — 부수기는 누구나지만 소리)
      const score = x => { const n = st.map.nodes[x.to], t = n.type === 'fight' ? (n.tier === 'light' ? 'event' : 'fight') : n.type; let v = RANK[t] ?? 3; if (low && t === 'camp') v = -2; if (x.e.kind === 'locked' && !x.e.opened && !canOpen) v += 4; if (n.tier === 'heavy') v += 0.5; if (n.side) v = (x.e.kind === 'locked' && !x.e.opened && !canOpen) ? v + 20 : low ? v : -10; if (solo && (n.type === 'elite' || n.type === 'boss')) v += 30; return v; }; // 혼자면 정예 · 우두머리는 맨 뒤 (위험하면 복귀가 그 앞에서 돌아오게 — 첫 판이 튜토리얼) // 곁방: 횃불이 남는 동안 처음 만난 열 수 있는 곁방부터 (종류는 가리지 않는다 — 고르는 것은 계획의 몫) // 곁방: 횃불이 남고 열 수 있으면 먼저 (보물 > 사건 > 정예), 아니면 들르지 않는다
      const j = opts.map((x, i) => [score(x), i]).sort((a, b) => a[0] - b[0])[0][1]; forkLog(st, opts[j], '자동'); return j;
    },
    // 장면 (사건 · 전투 · 야영 · 상인 · 구역 끝 야영지): choices의 번호
    scene(st, s) {
      const ok = s.choices.map((c, i) => [c, i]).filter(([c]) => !(c.off && c.off()) && !c.lock), name = re => ok.find(([c]) => re.test(c.n));
      if (s.kind === 'fight') return (name(/^기습한다/) || name(/^싸운다/) || ok[0])[1];
      if (s.kind === 'camp') { const pl = curS?.campPlan?.[st.floor], want = (st.items.camp || 0) > 0 && (pl && pl.length ? pl.includes(st.at) : hurt(st) < 0.9); if (want) { const k0 = st.items.camp--; st.camped = st.camped || {}; st.camped[`${st.floor}:${st.at}`] = true; st.xcd = {}; st.log.push({ t: `야영 · 물자 ${k0} → ${st.items.camp} · 체력 100%`, k: 'dv' }); return (name(/^긴 휴식/) || ok[0])[1]; } return (name(/지나간다/) || ok[ok.length - 1])[1]; } // 야영 방도 물자가 있어야 쉰다
      if (s.kind === 'rest') return (name(/^긴 휴식/) || name(/^내려간다/) || ok[ok.length - 1])[1]; // 쉬고(한 번) 내려간다 — 상인은 지나친다
      if (s.kind === 'shop') return (name(/^떠난다/) || ok[ok.length - 1])[1];
      // 사건: 금화를 내는 것은 빼고, 성공 확률이 가장 높은 것 (같으면 앞의 것)
      const free = ok.filter(([c]) => !/^금화 \d+/.test(c.sub || '')), L = free.length ? free : ok;
      return L.slice().sort((a, b) => (b[0].p ?? 1) - (a[0].p ?? 1))[0][1];
    },
    // 누가 할까: 보정이 가장 높은 사람 (cands의 번호)
    who: cands => cands.map((c, i) => [c.bonus, i]).sort((a, b) => b[0] - a[0])[0][1],
    // 잠긴 문 (따기 · 부수기가 안 됐다): 대가가 있는 방법 — 너머가 보물 방이면 쓴다, 아니면 두고 간다
    // 보석 (원정 — crawl이 보물 상자 · 정예 · 우두머리를 이긴 뒤 부른다): 짐으로 (가득 차면 싼 것부터 두고 감). 정예 · 우두머리는 그 판 금화의 일부를 보석으로 돌린 셈 치고 금화에서 뺀다
    gem(st, kind, gold0 = 0) { const gs = gemDrop(st, kind); let v = 0; for (const e of gs) { v += e.gold; LOOT.push({ ...e, bag: true }); for (const q of stow(st, e)) { q.dropped = true; st.log.push({ t: `두고 감 · ${q.n}`, k: 'dv' }); } } if (gold0 > 0) st.gold -= Math.min(Math.round(gold0 * 0.5), v); return gs; },
    paid: (st, acts) => acts.findIndex(a => a.id === 'knock'), // 따기 · 부수기가 안 되면 열림 (쿨타임 스킬 — 물건은 없앴다)
    // 주운 장비: 낄 사람이 있으면 끼우고(기본 장비는 가장 나아지는 사람, 마법 물건은 낄 수 있는 첫 사람), 아니면 반값에 판다 → 판 금화
    // 마법 물건은 그 칸이 비었거나 지금 낀 것보다 등급이 높은 사람에게 (장신구는 두 칸). 주운 것은 LOOT에 적는다 (화면의 알림 · 지난 판 결과 · 아이템 도감)
    gear(f, ms, drops, floor) {
      const X = G.Gear; let gold = 0;
      const room = (m, x) => { const sl = X.slotOf(x), on = G.Trinket.worn(f, m.uid).filter(t => X.slotOf({ kind: 'magic', t }) === sl); return sl === 't' ? on.length < 2 || on.some(t => rOf({ kind: 'magic', t }) < rOf(x)) : !on.length || on.every(t => rOf({ kind: 'magic', t }) < rOf(x)); };
      for (const d of drops) {
        const x = X.take(f, d, floor), live = ms.filter(m => m && !m.dead), o = X.info(x);
        const to = x.kind === 'base' ? live.map(m => [m, X.can(m, x, f).ok ? X.better(m, x) : 0]).filter(([, g]) => g > 0).sort((a, b) => b[1] - a[1])[0]?.[0] : live.find(m => X.can(m, x, f).ok && room(m, x));
        const e = { n: o.n, r: o.r || 0, k: x.kind === 'magic' ? x.t.k || null : null, to: null, gold: 0, x: x.kind === 'base' ? { kind: 'base', e: { slot: x.e.slot, k: x.e.k } } : { kind: 'magic', t: { k: x.t.k, rand: x.t.rand, base: x.t.base } } }; // x: 그 물건 (화면이 그림을 찾는다 — MD.itemUrl)
        e.gold = Math.round(X.price(x.kind === 'base' ? d : x) / 2); // 길드에 돌아와 팔 값
        if (to && X.equip(f, to, x)) e.to = to.name; else if (cur) { e.bag = true; for (const q of stow(cur, e)) { q.dropped = true; cur.log.push({ t: `두고 감 · ${q.n}`, k: 'dv' }); } } // 못 끼는 것은 짐으로 (가득 차면 싼 것부터 두고 간다)
        LOOT.push(e); if (e.k && curS) curS.dex.i[e.k] = (curS.dex.i[e.k] || 0) + 1;
      }
      return gold;
    },
  };
  // 지도에서 야영 지점 켜고 끄기 (경로 위의 방만, 입구 빼고)
  // ── 사건은 최초 1회 (2026-11-23): 그 층의 그 방에서 한 번. s.evs[층][방] = { st: 'skip' 피함(미해결) | 'done' 해결(실패 포함), pick: 고른 선택지 이름, r: 결과 한 줄 } · s.evPlan[층][방] = 계획에서 고른 선택지 이름
  const evOf = (s, fl, id) => s.evs?.[fl]?.[id] || null;
  function evMark(s, fl, id, o) { const L = (s.evs[fl] = s.evs[fl] || {}); L[id] = { ...(L[id] || {}), ...o }; if (o.st === 'done' && s.evPlan[fl]) delete s.evPlan[fl][id]; }
  const evOpen = (s, fl) => Object.values(s.evs?.[fl] || {}).filter(e => e.st === 'skip').length; // 피한 사건 수 (층 줄에)
  function evPlanSet(s, fl, id, name) { const L = (s.evPlan[fl] = s.evPlan[fl] || {}); if (name == null || L[id] === name) delete L[id]; else L[id] = name; }
  // 원정에서 사건 방에 닿았다: 'done' (해결됨 — 그냥 지나간다) | 선택지 번호 (계획에서 고른 것이 지금 파티로 되면) | null (선택 창)
  function evDecide(s, st, sc) { const e = evOf(s, st.floor, st.at); if (e?.st === 'done') return 'done'; const want = s.evPlan?.[st.floor]?.[st.at]; if (want == null) return null; const bare = x => String(x).replace(/^\[[^\]]*\] /, ''), i = sc.choices.findIndex(c => (c.n === want || bare(c.n) === bare(want)) && !(c.off && c.off()) && !c.lock); /* 직업 꼬리표는 파티에 따라 바뀐다 — 선택지 이름으로 */ return i >= 0 ? i : null; } // (지나친다류는 계획에서 고를 수 없다)
  // 선택지의 결과를 숫자로 (사건 자료의 ok · no — 화면에 문장은 띄우지 않는다)
  // 아무 일도 없이 끝내는 선택지 (「지나친다」류 — 원정의 창 · 계획에서는 뺀다: 「자리를 피한다」 하나로)
  function evPass(evId, choiceName) { const ev = RUN.EVENTS.find(x => x.id === evId); const o = ev?.opts.find(q => choiceName === q.n || choiceName.endsWith(`] ${q.n}`)); if (!o || o.sk || o.cls || o.cost) return false; const r = o.ok || {}; return !Object.keys(r).some(k => k !== 'msg'); }
  function evOut(evId, choiceName) { const ev = RUN.EVENTS.find(x => x.id === evId); if (!ev) return { ok: [], no: [] }; const o = ev.opts.find(q => choiceName === q.n || choiceName.endsWith(`] ${q.n}`)); if (!o) return { ok: [], no: [] };
    const f = r => (!r ? [] : [r.gold ? `금화 +${r.gold}` : '', r.ally ? '동료 +1' : '', r.healAll ? `체력 +${r.healAll}` : '', r.hurt ? `체력 −${r.hurt}` : '', r.fight ? '싸움' : '', r.mapPiece || r.revealRow || r.scoutAhead ? '지도' : '', r.bless ? '가호' : '', r.curse ? '저주' : '', r.warn || r.alert ? '경보' : ''].filter(Boolean));
    return { ok: f(o.ok), no: o.sk ? f(o.no) : [], cost: o.cost || 0 }; }
  function toggleCamp(s, fl, id) { const pl = s.plan[fl] || []; if (!pl.includes(id) || id === pl[0]) return false; const c = s.campPlan[fl] = s.campPlan[fl] || []; const i = c.indexOf(id); if (i >= 0) c.splice(i, 1); else c.push(id); if (!c.length) delete s.campPlan[fl]; return true; }
  return { USED, waves, waveSizes, soloBuilds, sheetOf, firstLineOf, HAND, handIs, handLock, handSet, handPick, handTick, handCd, handWait, DT_N, TY_N, affOf, affKnown, affTag, edgeOf, planFoes, mainType, tkTake, endWhy, statTick, statOf, ownerOf, GEMS, GEM_STACK, gemDrop, slotsOf, evPass, BRANCH, evOf, evMark, evOpen, evPlanSet, evDecide, evOut, CARD, cardCands, cardRec, cardOffer, cardChoose, cardAuto, cardInit, cdOf, toggleCamp, raidRisk, canCamp, campHere, wantCamp, gateTxt, PARTS, EXPL, XCD, XRUN, gateInfo, TUNE, SUP_KEYS, reviveCost, raise, deadList, strMod, bagCap, supMax, bagPlan, supCost, pack, supN, bagUsed, bagFull, stow, lootGold, planLines, drawState, segPts, reward, planReward, SPECS, FV, torches, sideEnter, planSides, torchUse, isSide, KEY, ZONES, LAST, CLS, TREE, CAMP, fresh, load: loadFix, noMc, dump, step, cost, buy, total, complete, seats, classes, camp, speeds, kit, team, toggle, bonus, bonusTo, STARTS, starts, autoStart, startFloor, floorSeed, remember, recall, explored, view, pathTo, planTo, doorVals, planBlocked, killGold, finish, rate, xpRate, settle, AWAY_K, AWAY_CAP, XP_K, PACE_LV, PACE_K, pace, LV_MAX, CATCH, BENCH, NEW_GAP, catchK, gain, autoPick, totalXp, newLv, revive, bank, rebuild, dexMons, dexHeroes, dexItems, dexCount, RARITY, R_TABLE, pickR, rOf, LOOT, hook, member, world, outfit, descend, POL };
})();
