'use strict';
// 원정 (끝이 있는 인크레멘탈, 화면 없이): 길드에서 파티 · 층을 골라 생성된 탐사 층(RUN · js/explore) 하나를 돈다 — 방 · 문 · 사건 · 보물 · 야영 · 전투 · 우두머리. 한 판 = 한 층 (2026-11-27): 우두머리를 잡으면 그 판은 승리로 끝나 길드로.
// 전멸하면 끝, 10층 붉은 성룡을 잡으면 완주. 판에서 번 금화(전투 · 보물 · 사건 · 판 장비) + 깬 층 보너스가 길드 금화 → 해금 트리(유한). 파티 자리 = 깬 층 수 + 1 (다섯까지).
// 방치형 RPG 코어 (2026-11-22): 영웅이 남는다(명단 — 이름 · 빌드 · 레벨업 때 고른 것 · 장비가 판을 넘어 이어진다, 쓰러져도 길드로 돌아온다)
// · 처치 경험치로 영웅마다 자란다 (SRD 20레벨까지, 레벨업 고르기는 저절로 첫 추천) — 따라잡기: 새 영웅은 (최고 − 2)레벨로 · 낮은 영웅은 더 빨리 · 쉬는 영웅도 조금
// · 주운 장비는 낀 채로 남는다 · 1층부터 (깬 층 + 1)층까지 아무 층에서나 출발한다 · 자리를 비운 동안도 번 것으로 친다(settle). 금화는 직업 · 탐험 물자 · 야영 · 배속에.
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
    // 층을 10방쯤으로 (2026-11-27 — 한 방이 길어지고 방마다 배치 · 전투): 입구 → 우두머리 5걸음 + 갈래 · 곁방(막다른 방). 갈래가 둘인 층(5~10층)은 곁방 셋 (2026-11-26에 늘린 칸은 되돌렸다)
    for (const k in SPECS) { const S0 = SPECS[k], forks = S0.main.filter(q => q.fork).length; SPECS[k] = { ...S0, grow: 15, sides: forks > 1 ? S0.sides.slice(0, -1) : S0.sides }; } }


  // 직업이 열리는 차례 (파이터 · 클레릭으로 시작). 엔진 직업 id — js/game/party.js CLASSES
  const CLS = ['dragoon', 'cleric', 'mage', 'rogue', 'paladin', 'archer', 'barbarian', 'bard', 'warlock', 'monk', 'archmage', 'scout'];
  // 해금 트리: 단계마다 값 (배열 길이 = 살 수 있는 횟수). 다 사면 끝 — 합계는 total(). 수치는 시험값
  const TREE = [
    { id: 'cls', br: 'party', n: '영웅 들이기', cost: [20, 80, 200, 350, 500, 700, 900, 1150, 1450, 1800, 2200], val: s => `${1 + s}직업` }, // 레벨 줄은 없앴다 — 레벨은 경험치로 · 첫 값 20 = 1레벨 혼자 첫 판(전투 2~3번 · 금화 20~30)으로 둘째 영웅 (2026-11-23)
    // 탐험 해금: 탐사 규칙에 이미 있는 열쇠 — 시작 물자로 들고 간다
    { id: 'torch', br: 'supply', n: '횃불', cost: [30, 200], val: s => `${1 + s}개` },
    { id: 'camp', br: 'supply', n: '야영 물자', cost: [100, 450, 1400], val: s => `+${CAMP_FREE}+${CAMP_BUY + CAMP_STEP * s}개` }, // 공짜 몫 + 사서 챙길 수 있는 최대 (2026-11-26 방마다 1개) // 챙길 수 있는 최대 (2026-11-23 — 옛 「계단 야영」 단계를 그대로 옮김, 계단 회복은 없앴다)
    { id: 'bag', br: 'supply', n: '짐 칸', cost: [150, 600, 1800], val: s => `+${s * TUNE.BAG_STEP}칸` }, // 파티 짐 (2026-11-23)
    { id: 'spd', br: 'party', n: '배속', cost: [30, 400], val: s => `×${[1, 2, 4][s]}` }, // 화면의 ×1 · ×2 · ×4 = 엔진 배속 2 · 4 · 8 (speeds) — 작은 창으로 곁눈질해도 지루하지 않게 기본을 엔진 ×2로
  ];
  const CAMP = [0, 30, 60, 100, 100];
  const BRANCH = [{ id: 'supply', n: '보급' }, { id: 'party', n: '원정대' }]; // 해금 갈래 (전술 갈래는 정해지면 — 2026-11-23)
  // ── 죽음의 값 · 파티 짐 (2026-11-23) — 시험값은 이 표 하나 ──
  //   REVIVE_K: 부활 값 = 이것 × 레벨 · BAG_BASE: 짐 기본 칸 · BAG_STEP: 「짐 칸」 해금 한 단계 · SUP: 물자 하나 값(출발 때) · 힘 수정치(0 이상)만큼 영웅마다 칸이 는다
  const TUNE = { REVIVE_FREE_LV: 3, REVIVE_K: 25, BAG_BASE: 4, BAG_STEP: 2, SUP: { torch: 5, camp: 3 }, RAID: 0.2, HIT: { pc: 5, mon: 3 }, SMALL_ROOMS: true, FIT_W: 1, FIT_H: 1, PACE: 0.7, WAVE: { fight: 2, elite: 1.5, max: 4, pay: 1.2 },
    VIEW_K: 0.87 }; /* VIEW_K: 작은 방 모드의 화면 배율 (2026-11-24 사용자: 「캐릭터는 조금 더 줄여야」 — 인형 45px → 39px쯤, 예전 전투 33px와의 사이) */ // SMALL_ROOMS: 작은 방 · PACE: ×1의 빠르기 배율 (2026-11-24 — 0.7 = 30% 느리게) // HIT: 원정의 명중 보정 (d20에 더함) — 실측 영웅 60% · 몬스터 40%라 빗나감이 절반이었다 (2026-11-24, 시험값) // 물자는 야영 물자 · 횃불 둘 (치유 물약은 원정에서 없앴다) · RAID: 안전하지 않은 방에서 야영할 때 이웃한 안 치운 적 무리마다 습격 확률 // 도둑 도구 · 열림 두루마리는 없앴다 (자물쇠 따기 = 로그의 스킬, 열림 = 주문 스킬)
  const SUP_KEYS = ['torch', 'camp']; // 계단 야영: 살아 있는 사람의 최대 체력 대비 회복 (4단계는 주문 슬롯 · 기술 횟수도 — 긴 휴식)
  const byId = id => TREE.find(t => t.id === id);
  // autoOn: 자동 재출발 (2026-11-25부터 기본 끔 — 지도 화면에서 켠다) · rec: 최근 원정 [금화, 분] (자리 비운 동안의 정산) · seen: 마지막으로 본 시각(ms)
  // dex: 도감 — m: 몬스터 이름 → { met: 만난 수, kill: 잡은 수 } · h: 빌드 id → 데리고 나간 원정 수
  // roster: 직업 → 영웅 { m: 엔진 사람(JSON) · tr: 끼고 있는 마법 물건들 } (직업마다 한 명) · start: 고른 출발 층 (0 = 자동) · last: 지난 판 { start, cleared }
  // dex.i: 아이템 도감 (SRD 마법 물건 id → 얻은 수)
  // trail · fail: 층 → 지난 판에 간 방 줄 · 못 연 길 번호 · shown: 층 → 지도 화면에서 마지막으로 보여 준 기억 (새로 밝힌 방을 한 번만 그려 보이려고)
  // mapSeed: 층 지도의 기준 씨앗 (층 N의 지도 = floorSeed(이것, N)) · maps: 층 → 지도 기억 { n: 방마다 16진 한 자(정보 0~3 | 들어감 4 | 종류 봄 8), e: 길마다 32진 한 자(지나감 1 | 잠김 2 | 어두움 4 | 함정 8 | 숨은 통로 16) } · plan: 층 → 경로(방 번호 줄)
  // fv: 층 지도 판 — 지도가 바뀌면 올린다. 옛 저장의 지도 기억 · 발자국 · 사건 기록을 모든 층에서 비운다
  const FV = 5; // FV 5 (2026-11-27): 방이 길어지고(폭 5 × 깊이 6~7칸) 층이 10방쯤으로 — 모든 층의 지도가 바뀌었다 // FV 4 (2026-11-26): 층을 길게 // FV 3 (2026-11-24): 작은 방의 1칸 = 2타일 (지도 칸은 같지만 방 안 위치 · 문이 달라진다) — 다시 모든 층을 비운다 // FV 2 (2026-11-24): 작은 방으로 모든 층의 지도가 바뀌었다 — 옛 지도 기억 · 경로 · 사건 · 야영 계획을 모든 층에서 비운다
  const newSeed = () => (Math.random() * 4294967296) >>> 0;
  // 기본 설정 (2026-11-25 사용자: 「기본 옵션들을 배틀하트방식으로」): 실시간 · 넷 모두 끌어 조종 · 스킬은 손으로 · 한 판 끝나면 길드로(자동 재출발 끔) · 그린 경로를 다 돌면 귀환 · 위험해도 저절로 물러나지 않는다
  const BASE = { autoOn: false, endMode: 'back', risk: false, bh: 1 };
  // 새 저장의 첫 두 영웅 (2026-11-27 사용자: 「무작위 앞줄+ 뒷줄 조합으로 나오게 해보자」 — 나중에는 게임을 시작하며 가챠로 둘을 뽑는다): 앞줄 직업 하나 + 나머지 하나
  //   order = 이 저장에서 직업이 열리는 차례 (앞의 둘이 첫 두 영웅, 그 뒤는 CLS 차례) — 「영웅 들이기」가 이 차례로 연다. 옛 저장은 order가 없어 CLS 차례 그대로
  const FRONT = ['dragoon', 'barbarian', 'paladin', 'monk'];
  const firstPair = (rng = Math.random) => { const one = L => L[Math.floor(rng() * L.length)], a = one(FRONT), b = one(CLS.filter(c => !FRONT.includes(c))); return { party: [a, b], order: [a, b, ...CLS.filter(c => c !== a && c !== b)] }; };
  const fresh = () => ({ v: 3, mapSeed: newSeed(), maps: {}, plan: {}, trail: {}, fail: {}, shown: {}, gold: 0, deep: 0, runs: 0, wins: 0, up: {}, ...firstPair(), roster: {}, start: 0, last: null, rec: [], seen: 0, dex: { m: {}, h: {}, i: {} }, fv: FV, cls0: 2, evs: {}, evPlan: {}, miss: {}, dead: {}, bag: { torch: 1, camp: 1 }, campPlan: {}, fullBack: false, deadStop: true, ...BASE });
  // v1 · v2(영웅이 판마다 새로 만들어지던 때) 저장은 구조가 달라 새로 시작한다 — 망가진 저장에도 죽지 않는다
  const load = raw => { try { const o = JSON.parse(raw || '{}'); if (o.v !== 3) return fresh(); const s = { ...fresh(), ...o, ...(o.bh ? {} : BASE) }; /* bh 없는 옛 저장은 새 기본 설정으로 한 번 바꾼다 */ s.up = { ...s.up }; s.roster = { ...(o.roster || {}) }; s.rec = [...(o.rec || [])]; s.dex = { m: { ...(o.dex?.m || {}) }, h: { ...(o.dex?.h || {}) }, i: { ...(o.dex?.i || {}) } }; s.maps = { ...(o.maps || {}) }; s.plan = { ...(o.plan || {}) }; s.trail = { ...(o.trail || {}) }; s.fail = { ...(o.fail || {}) }; s.shown = { ...(o.shown || {}) }; if (!o.mapSeed) s.mapSeed = newSeed(); s.evs = JSON.parse(JSON.stringify(o.evs || {})); s.evPlan = JSON.parse(JSON.stringify(o.evPlan || {})); s.campPlan = {}; s.plan = {}; /* 경로 계획 · 야영 지점은 없앴다 (2026-11-26) */ s.miss = { ...(o.miss || {}) }; if (o.cls0 === undefined) s.cls0 = 2; s.dead = { ...(o.dead || {}) }; s.bag = o.bag ? { ...o.bag } : null; /* 옛 저장: 사망자 없음 · 짐 = 해금한 만큼 다 */ if ((o.fv || 0) < FV) { for (const k of ['maps', 'plan', 'trail', 'fail', 'shown', 'evs', 'evPlan', 'campPlan', 'miss']) if (s[k]) s[k] = {}; s.fv = FV; } return s; } catch (e) { return fresh(); } };
  const dump = s => JSON.stringify(s);
  const step = (s, id) => s.up[id] || 0;
  const cost = (s, id) => { const t = byId(id); return t && step(s, id) < t.cost.length ? t.cost[step(s, id)] : null; }; // null = 다 샀다
  function buy(s, id) { const c = cost(s, id); if (c == null || s.gold < c) return false; s.gold -= c; s.up[id] = step(s, id) + 1; return true; }
  const total = () => TREE.reduce((a, t) => a + t.cost.reduce((x, y) => x + y, 0), 0);
  const complete = s => TREE.every(t => step(s, t.id) >= t.cost.length);
  // 지금 값
  const seats = s => Math.min(5, Math.max(2, 1 + (s.deep || 0))), /* 파티 자리 = 깬 층 수 + 1, 둘부터 다섯까지 (2026-11-27 — 1층도 둘이 나간다: 혼자는 직업마다 버티는 힘이 너무 달라 1층을 맞출 수 없다 · 금화로 사던 「파티 자리」 줄은 없앴다, 옛 저장의 up.seat은 무시) */ classes = s => (s.order || CLS).slice(0, Math.max(1, step(s, 'cls') + (s.cls0 ?? 1))); // 새 저장은 무작위 둘로 시작 (cls0 2 · order) · 옛 저장은 CLS 차례 그대로
  const camp = s => 0 /* 계단 회복 없음 — 회복은 야영뿐 */, speeds = s => [2, 4, 8].slice(0, 1 + step(s, 'spd'));
  // 들고 가는 물자 (탐사 규칙의 st.items 이름)
  // 야영 물자 (2026-11-26 사용자: 「방마다 줄어드는 형태로」 — FTL의 연료): 방을 옮길 때마다 1, 0이면 옮길 때마다 전원 최대 체력의 10%. 정리한 방에서 REST개로 전체 회복 (야영 방은 REST_CAMP)
  //   판마다 CAMP_FREE개는 공짜, 그 위로 길드에서 산다 (짐 칸은 차지하지 않는다)
  const CAMP_FREE = 9, /* 한 판 = 한 층의 연료 (2026-11-27): 입구 → 우두머리 5걸음 · 다 돌면 13~17걸음 — 곧장 가면 남고(야영 한 번) 다 돌면 모자란다 */ CAMP_BUY = 6, CAMP_STEP = 4, REST = 3, REST_CAMP = 1, STARVE = 0.1;
  const kit = s => ({ torch: 1 + step(s, 'torch'), camp: CAMP_BUY + CAMP_STEP * step(s, 'camp') });
  // 나갈 파티: 고른 직업 중 열린 것만, 자리 수까지 (비면 파이터 · 클레릭)
  // 사망한 영웅은 되살릴 때까지 나가지 못한다 (모두 죽었으면 빈 파티 — 길드가 출발을 막는다)
  function team(s) { const open = classes(s).filter(c => !s.dead?.[c]), t = [...new Set(s.party)].filter(c => open.includes(c)).slice(0, seats(s)); return t.length ? t : open.slice(0, Math.min(2, seats(s))); }
  function toggle(s, cls) { if (s.dead?.[cls]) return; const t = team(s), i = t.indexOf(cls); if (i >= 0) { if (t.length > 1) t.splice(i, 1); } else if (classes(s).includes(cls)) { if (t.length >= seats(s)) t.pop(); t.push(cls); } s.party = t; }
  // 깬 층 보너스: 그 층의 우두머리를 잡으면 (깊을수록 많이 — 용은 완주 몫까지)
  const bonus = fl => Math.round(20 * Math.pow(1.6, fl - 1)) + (fl === LAST ? 1500 : 0);
  const bonusTo = (fl, from = 1) => { let g = 0; for (let i = from; i <= fl; i++) g += bonus(i); return g; }; // from = 출발 층 · fl = 깬 층 (한 판 = 한 층이라 깼으면 그 층 하나, 못 깼으면 0)
  // ── 출발 층 (2026-11-27 한 판 = 한 층): 1층부터 (깬 층 + 1)층까지 아무 층이나. 고르지 않으면 아직 못 깬 가장 얕은 층 (다 깼으면 마지막 층) ──
  const starts = s => Array.from({ length: Math.min(LAST, (s.deep || 0) + 1) }, (_, i) => i + 1);
  const startFloor = s => (s.start && starts(s).includes(s.start) ? s.start : Math.min(LAST, (s.deep || 0) + 1));
  // 원정이 끝났다: cleared = 깬 층 (우두머리를 잡았으면 그 층, 아니면 0) · earned = 판에서 번 금화 (전멸해도 번 만큼은 들어온다) → 길드에 들어온 금화
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
    for (const k of SUP_KEYS) for (let i = 0; i < want[k] && (k === 'camp' || used < cap); i++) { const c = TUNE.SUP[k]; if (c && s.gold < c) break; s.gold -= c; got[k]++; if (k !== 'camp') used++; }
    got.camp += CAMP_FREE; return got;
  }
  const restCost = (st, id = st.at) => (st.map.nodes[id].type === 'camp' ? REST_CAMP : REST);
  const canCamp = (st, id = st.at) => (st.items.camp || 0) >= restCost(st, id) && !st.map.nodes[id].hostile;
  // 방을 옮겼다 · 무너진 길을 돌아갔다: 물자 n개 (없으면 전원 최대 체력의 STARVE씩)
  function spend(st, n = 1, why = '') {
    for (let i = 0; i < n; i++) {
      if ((st.items.camp || 0) > 0) { st.items.camp--; continue; }
      for (const m of st.party) if (!m.dead) { m.hp -= Math.max(1, Math.round(m.max * STARVE)); if (m.hp <= 0) { m.hp = 0; m.dead = true; st.log.push({ t: `${m.n} 쓰러짐 (굶주림)`, k: 'dv' }); } }
      st.log.push({ t: `물자 0 · 굶주림 · 체력 −${Math.round(STARVE * 100)}%`, k: 'dv' }); st.starved = (st.starved || 0) + 1;
    }
    if (why) st.log.push({ t: `${why} · 물자 ${st.items.camp || 0}`, k: 'dv' });
    if (!st.party.some(m => !m.dead)) st.done = 'lose';
  }
  // 쉰다 → { raid: 습격한 무리 이름 | null }. 습격이면 체력은 절반만 돌아오고 그 무리가 깬다
  function campHere(st, members = null) {
    if (!canCamp(st)) return null; const id = st.at, k0 = st.items.camp; st.items.camp -= restCost(st, id);
    for (const m of st.party) if (!m.dead) m.hp = m.max;
    st.xcd = {}; if (members) G.Res.longRest(members); st.camped = st.camped || {}; st.camped[`${st.floor}:${id}`] = true;
    st.log.push({ t: `야영 · 물자 ${k0} → ${st.items.camp} · 체력 100%`, k: 'dv' });
    return { raid: null };
  }
  // 지금 쉴까: 계획한 야영 지점이거나(그 방 일이 끝난 뒤), 계획이 없고 체력 평균이 절반 아래일 때
  function wantCamp(s, st) { if (!canCamp(st) || st.camped?.[`${st.floor}:${st.at}`]) return false; const left = (st.items.camp || 0) - restCost(st); return hurt(st) < (st.map.nodes[st.at].type === 'camp' ? 0.8 : 0.5) && left >= Math.max(2, Math.min(9, toBoss(st))); } // 자동: 다쳤고 쉬어도 물자가 둘은 · 우두머리 방까지 갈 만큼은 남을 때
  // 원정 중 짐: 물자 개수 + 전리품(st.loot) — 가득 차면 값이 가장 낮은 전리품부터 두고 간다 (물자는 버리지 않는다)
  const supN = st => st.items.torch || 0; // 짐 칸: 횃불만 (야영 물자는 칸을 안 차지한다)
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
  //   스킬 틀 하나 (2026-11-27 사용자: 「밀리계열 특성, 숙련같은거랑 주문계열 주문을 그냥 스킬이라는 용어로 통합」 · 「스킬틀 통일」): 직업 기능 · 무기 기술 · 주문이 모두 같은 표(cdOf) · 같은 시계(G.Res.clock) · 같은 기록(m.cdK)을 쓴다
  //   주문 칸 · 집중점 · 휴식 횟수 · 분노 횟수를 쓰지 않는다. 시계는 라운드 하나(G.Res.clock): 전투 라운드마다 1, 방을 하나 옮기면 ROOM_R(6) — 탐험 스킬과 한 시계. 전투가 끝나도 이어지고 야영하면 전부 돌아온다
  //   쿨 = 표(CD)에 적힌 값 → 없으면 기본값: 주문 레벨 + 1 · 집중점 2 · 짧은 휴식 기능 6 · 긴 휴식 기능 8 · 분노 10 · 자원이 없는 스킬(무기 기술)은 그 스킬의 값(SK.cd). 수치를 고칠 때는 CD에 적는다
  const CD = { sr_revive: 30 };
  const cdOf = (k, res) => { if (CD[k] != null) return CD[k]; if (!res) return G.Skill.SK[k]?.cd || 0; return res.slot ? Math.min(10, res.slot + 1) : res.focus ? 2 : res.rage ? 10 : res.short ? 6 : res.long ? 8 : 0; };
  let cdHooked = false;
  const USED = []; // 방금 자원을 쓴 스킬 (화면이 이름 · 아이콘을 띄우고 비운다)
  function cdHook() {
    if (cdHooked || !G.Res) return; cdHooked = true; const Rs = G.Res, R0 = { can: Rs.can, pay: Rs.pay, left: Rs.left, usesOf: Rs.usesOf, castLevel: Rs.castLevel, slotFrac: Rs.slotFrac, longRest: Rs.longRest };
    Rs.cdOn = false; Rs.clock = 0; Rs.cdOf = (k, res = G.Skill.resOf(k)) => cdOf(k, res);
    const sh = (k, res) => Rs.sh(k, res), ready = (m, k, res) => { [k, res] = sh(k, res); const c = cdOf(k, res), t = (m.cdK || {})[k]; return !c || t == null || Rs.clock - t >= c; };
    Rs.cdLeftOf = (m, k, res = G.Skill.resOf(k)) => { [k, res] = sh(k, res); const c = cdOf(k, res), t = (m.cdK || {})[k]; return !c || t == null ? 0 : Math.max(0, c - (Rs.clock - t)); };
    // 옛 기본 치유(엔진 healTurn · 쓰러진 동료 일으키기 — 자원 이름 'cure')는 치유 스킬을 칸에 든 영웅만 (2026-11-23, 사용자: 「스킬 6칸에 해당 스킬이 있어야」)
    Rs.can = function (m, k, res) { if (!Rs.cdOn || !res) return R0.can.apply(this, arguments); if (k === 'cure' && (!G.Guild.active(m).some(q => G.Skill.SK[q]?.heal))) return false; return ready(m, k, res); };
    Rs.left = function (m, res, k) { if (!Rs.cdOn || !res) return R0.left.apply(this, arguments); return ready(m, k, res) ? 1 : 0; };
    Rs.pay = function (m, k, res) { if (!Rs.cdOn || !res) return R0.pay.apply(this, arguments); if (USED.length < 40) USED.push({ m, k }); [k, res] = sh(k, res); (m.cdK = m.cdK || {})[k] = Rs.clock; return res.slot || 0; };
    Rs.usesOf = function (m, res, k) { if (!Rs.cdOn) return R0.usesOf.apply(this, arguments); return res ? 1 : 99; };
    Rs.castLevel = function (m, res) { if (!Rs.cdOn) return R0.castLevel.apply(this, arguments); return res.slot; }; // 올려 쓰기 없음 — 그 주문의 레벨로
    Rs.slotFrac = function (m) { if (!Rs.cdOn) return R0.slotFrac.apply(this, arguments); return 1; }; // 남은 전투 수를 보고 아끼는 계산을 끈다
    Rs.longRest = function (list) { const out = R0.longRest.apply(this, arguments); if (Rs.cdOn) for (const m of list || []) if (m) m.cdK = {}; return out; }; // 야영 = 전부 돌아온다
    // 자원이 없는 스킬(무기 기술)의 쿨타임도 같은 시계 · 같은 기록으로 (자원이 있는 스킬은 위의 can · pay가 본다)
    const Sk = G.Skill, S0 = { cdLeft: Sk.cdLeft, cdStart: Sk.cdStart };
    Sk.cdLeft = function (rt, a, k) { if (!Rs.cdOn || !a.merc) return S0.cdLeft.apply(this, arguments); return Sk.resOf(k) ? 0 : Rs.cdLeftOf(a.merc, k, null); };
    Sk.cdStart = function (rt, a, k) { if (!Rs.cdOn || !a.merc) return S0.cdStart.apply(this, arguments); if (Sk.resOf(k) || !cdOf(k, null)) return; if (USED.length < 40) USED.push({ m: a.merc, k }); (a.merc.cdK = a.merc.cdK || {})[k] = Rs.clock; };
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
    G.Fantasy.slots = () => 5; // 원정의 출전 칸: 앞장 + 넷 = 영웅 다섯 (seats) + 구출한 한 명 (엔진 기본은 앞장 + 셋)
    { const DN = G.Dnd, h0 = DN.hit; DN.hit = function (e) { return h0.apply(this, arguments) + (e?.merc ? TUNE.HIT.pc : e?.kind === 'mon' ? TUNE.HIT.mon : 0); }; DN.basicDC = TUNE.HIT.pc; } // 명중 보정: 공격 굴림 양쪽 + 내성으로 가르는 기본 공격(신성한 불꽃 · 잔인한 조롱)
    // 어두운 방을 빛 없이 (rt.dvDark — crawl이 건다): 파티가 든 횃불 · 벽 횃불 · 방의 어스름을 끈다. 빛 주문 · 빛나는 몬스터는 그대로 — 그다음은 엔진의 어둠 규칙(보이지 않는 표적 불리 · 암시야)
    // 옛 숨은 무리 매복(G.Flow.init이 방에 r.ambush를 걸고 들어서면 매복 살피기를 굴려 선공을 덮어쓴다)은 원정에서 끈다 — 선공은 crawl.js enterFight 한 곳에서 (init 바로 뒤에 부르는 G.Event.tagRooms에서 걷는다)
    if (G.Event?.tagRooms) { const tr0 = G.Event.tagRooms; G.Event.tagRooms = function (f, rt) { if (curS) for (const r of rt.map?.rooms || []) r.ambush = false; return tr0.apply(this, arguments); }; }
    // 기본 빠르기 (TUNE.PACE, 2026-11-24 사용자: 「기본 속도를 늦춰봐」): 원정 중에는 배속 값 전체에 PACE를 곱한다 — 걷기 · 공격 동작(actors) · 엔진 추가 틱(G.Turn.extra) · 탐험 걷기(crawl)가 모두 G.Turn.speed를 본다. 배속 버튼의 단계 · 표시는 f.turnX 그대로
    if (G.Turn?.speed) { const sp0 = G.Turn.speed; G.Turn.speed = function (f) { const v = sp0.apply(this, arguments); return curS ? v * TUNE.PACE : v; }; }
    if (G.Light) { const Lt = G.Light, src0 = Lt.sources, lv0 = Lt.level;
      Lt.sources = function (rt) { const o = src0.apply(this, arguments); return rt?.dvDark ? o.filter(q => !q.held?.merc && !(rt.map?.lights || []).includes(q)) : o; };
      Lt.level = function (rt, x, y) { if (!rt?.dvDark || !rt.map) return lv0.apply(this, arguments); if (Lt.inDark(rt, x, y)) return -1; let v = 0; for (const q of Lt.sources(rt)) { const d = Math.hypot(x - q.x, y - q.y); if (d > q.d + 0.5) continue; if (d <= q.b + 0.5) return 2; v = 1; } return v; }; }
    { const F = G.Fantasy, hu0 = F.hurt, hm0 = F.hurtMember, kl0 = F.kill; // 결과 집계 (위)
      F.hurt = function (f, rt, m, dmg, src, from) { const c = cur?.stat && m ? ownerOf(from) : null, b = m?.hp; if (c) m._dvBy = c;
        if (c && m.kind === 'mon' && m.stat && b > 0) { const dt = G.Skill.dtOver || G.Foe.dtype || (from?.merc ? G.Dnd.weapon(from).t : null), k = G.Foe.typeK(m, dt, from), w = tkWord(k); if (curS && m.n) affMark(curS, m.n); if (w) { const q = statOf(cur, c); q.tk = q.tk || {}; q.tk[w] = (q.tk[w] || 0) + 1; tkQ.push([from?.merc?.name || from?.by?.merc?.name || '', w]); if (tkQ.length > 8) tkQ.shift(); } } // 상성: 싸워 본 몬스터는 도감에 · 배율 기록
        const out = hu0.apply(this, arguments); if (c && b > 0) statOf(cur, c).dmg += b - Math.max(0, m.hp); return out; };
      F.hurtMember = function (f, rt, p, dmg, mo) { const b = p?.hp, out = hm0.apply(this, arguments); if (cur?.stat && p?.merc && b > 0) { const q = statOf(cur, p.merc.cls); q.took += b - Math.max(0, p.hp); if (p.hp <= 0) q.downs++; hpSeen.set(p, { hp: Math.max(0, p.hp), max: p.max }); } return out; };
      F.kill = function (f, rt, m, src, from) { if (cur?.stat && m?.kind === 'mon' && !m._dvDead) { m._dvDead = true; cur.stat.foes++; const c = ownerOf(from) || m._dvBy; if (c) statOf(cur, c).kills++; } return kl0.apply(this, arguments); }; }
    { const h0 = G.Story.heat; G.Story.heat = function (f, list) { h0.apply(this, arguments); for (const o of list) if (o.wvK && !o.wvDone) { o.wvDone = true; o.gold *= o.wvK; o.xpK = (o.xpK || 1) * o.wvK; } }; } // 늘어난 적의 값
    const m0 = G.Guild.mult; G.Guild.mult = function (m, k) { const v = m0.apply(this, arguments); return k === 'xp' ? v * XP_K * (curS ? catchK(m.lv, Math.max(...live.map(x => x.lv))) / pace(m.lv) : 1) : v; };
    const k0 = G.Guild.onKill; G.Guild.onKill = function (f, rt, mo) { if (cur && mo) cur.gold += killGold(mo); if (curS && mo?.n) { const e = curS.dex.m[mo.n] = curS.dex.m[mo.n] || { met: 1, kill: 0 }; e.kill++; }
      const out = k0.apply(this, arguments); if (curS) for (const a of rt.party || []) if (a.merc) { if (G.Reward.pending(a.merc)) autoPick(a.merc); if (curS.cardOn === false) cardAuto(a.merc); } return out; }; // 레벨업 카드를 끄면 빌드대로 // 원정 중에만 저절로 고른다 (기존 게임은 레벨업 창)
    const sp0 = G.Fantasy.spawnMon; G.Fantasy.spawnMon = function () { const o = sp0.apply(this, arguments); if (curS && o?.n && loreIn(live.filter(Boolean))) affMark(curS, o.n); if (curS && o?.n) { const e = curS.dex.m[o.n] = curS.dex.m[o.n] || { met: 0, kill: 0 }; e.met++; } return o; }; // 도감: 그 방에 선 몬스터 = 만난 것
    if (typeof RUN !== 'undefined') { RUN.SPECS = SPECS; RUN.FIXDOORS = true; RUN.X = XRUN; RUN.SMALL = TUNE.SMALL_ROOMS; RUN.COMPACT = TUNE.SMALL_ROOMS; } // SMALL: 작은 방 (폰 화면 — 줌아웃 없이 전투 방이 들어오게) // 설계서 · 문 잇기 · 탐험 판정(영웅 수치)은 원정 페이지에서만 // 설계서 · 문 잇기는 원정 페이지에서만
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
  const loadFix = raw => { const s = load(raw); for (const h of Object.values(s.roster || {})) if (h?.m) { noMc(h.m); if (!h.m.xsp) h.m.xsp = rollXsp(h.m.cls); } return s; }; // 옛 저장의 주문 계열 영웅에게도 탐험 주문을
  // bid: 영입할 때 고른 빌드 (2026-11-24 — 빌드는 영입할 때 한 번 고르고 고정, 사용자: 「장착한 장비, 얻은 스킬이 막 바뀌는게 말이 안돼」). 없으면 무게대로
  function member(f, cls, lv, rng = Math.random, bid = null) {
    const R = G.Reward, m = G.Party.trim(G.Guild.make(f, cls, { lv: 1, ab: G.Party.stdAb(cls) })); if (G.Builds) { G.Builds.assign(m, rng); const pick = bid && soloBuilds(cls).find(b => b.id === bid); if (pick) G.Builds.apply(m, pick); else if (G.Builds.byId(m.build)?.mc) { const L = soloBuilds(cls); let r = rng() * L.reduce((a, b) => a + b.w, 0); G.Builds.apply(m, L.find(b => (r -= b.w) < 0) || L[0]); } } // 다중 직업 빌드가 뽑히면 한 직업 빌드로 (무게대로)
    if (G.Builds?.CARD?.on) { m.picks = []; const r = cardRec(m); if (r) m.picks.push(r); m.cardq = [{ lv: 1, kind: 'pick' }]; G.Builds.refresh(m); } // 카드 모드: 대표 스킬 하나로 시작 · 1레벨 몫은 고를 것
    while (m.lv < lv) { m.lv++; G.Guild.grow(m); }
    if (lv > 1) cardAuto(m); // 2레벨 이상으로 들어오면 지나간 몫은 추천대로
    for (let i = 0; i < 300 && R.pending(m); i++) { const o = R.offer(m, rng); R.choose(m, o.kind === 'new' ? { kind: 'new' } : o.kind === 'swap' || !o.options.length ? 'keep' : o.options[0]); if (!o.options.length && o.kind !== 'new' && o.kind !== 'swap') break; }
    m.xsp = rollXsp(cls, rng); // 탐험 주문 (주문 계열만)
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
    f.turnX = speeds(s).includes(s.spdX) ? s.spdX : speeds(s)[speeds(s).length - 1]; // 고른 배속은 기억한다 · 처음엔 연 것 중 가장 빠른 것
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
    { const ms = new Set(s.miss[fl] || []); for (const q of N) { if (q.shut) ms.add(q.id); if (q.bonus) ms.delete(q.id); } if (ms.size) s.miss[fl] = [...ms]; else delete s.miss[fl]; } // 못 연 방 (다음에 넘을 사람을 데려오면 연다)
    s.trail[fl] = st.path.slice(); s.fail[fl] = st.map.edges.filter(q => q.kind === 'locked' && q.seen?.lock && !q.opened).map(q => q.id); // 지난 판에 실제로 간 길 (발자국) · 보고도 못 연 문 (붉은 ✕)
  }
  // 새 층에 들어섰다 (판 시작 · 계단): 기억한 길의 정체(잠김 · 어두움 · 함정 · 찾은 숨은 통로)를 그 판에도 알고 간다 · 그 층의 경로 · 판정 난수는 새로
  function recall(st, s) {
    const m = s.maps[st.floor]; if (m) st.map.edges.forEach((q, i) => { const b = hx(m.e, i, 32); q.seen = q.seen || {}; if (b & 2) q.seen.lock = true; if (b & 4) q.seen.dark = true; if (b & 8) q.seen.trap = true; if (b & 16) q.seen.hidden = true; });
    st.plan = null; /* 경로 계획은 없앴다 (2026-11-26 — 방마다 다음 방을 고른다) */ st.planMiss = 0; st.planI = 0; st.rng = RUN.rng(newSeed()); st.freeSide = RUN.lit(st) ? 1 : 0; // 횃불은 챙긴 것을 판 전체에 — 빛 소마법 · 전원 암시야 파티는 층마다 첫 곁방 하나가 공짜
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
  // 방에서 얻는 것 (지도에 미리 — 실제 규칙의 값): 물건 수(G.Gear.N_DROP) · 나올 수 있는 등급(이 층 희귀도 표 R_TABLE) · 포로 구출 = 동료 +1 · 야영 = 긴 휴식(체력 100%)
  function reward(n, floor) {
    const kind = n.type === 'treasure' || n.chest ? 'treasure' : n.type === 'elite' || n.type === 'boss' ? n.type : null, o = {};
    if (kind) { o.items = G.Gear.N_DROP[kind]; const w = R_TABLE[Math.min(R_TABLE.length - 1, Math.floor((floor - 1) / 2) + (R_UP[kind] || 0))]; o.r = w.map((x, i) => (x > 0 ? i + 1 : 0)).filter(Boolean); }
    if (kind) o.gem = true; // 보석이 나오는 방
    if (n.type === 'event' && n.ev === 'captive') o.ally = 1;
    if (n.type === 'camp') o.heal = 100;
    return o;
  }
  const short = g => { const u = g.units || [[g.name, g.count]]; return `${u[0][0]} ${u[0][1]}${u.length > 1 ? '+' : ''}`; }; // 「홉고블린 2+」
  function view(s, fl) {
    const map = genMap(floorSeed(s, fl), fl), m = s.maps[fl] || { n: '', e: '' };
    map.nodes.forEach((q, i) => { const v = hx(m.n, i, 16); q.info = v & 3; q.visited = !!(v & 4) || i === 0; /* 입구는 늘 안다 */ q.seenMap = !!(v & 8); q.notes = q.hostile && (q.visited || q.info >= 2) ? [{ t: short(q.g), ink: q.visited ? 'ink' : 'pencil' }] : []; /* 길드 지도: 적 구성은 한 줄로 짧게 */ });
    map.edges.forEach((q, i) => { const b = hx(m.e, i, 32); q.walked = !!(b & 1); q.seen = { lock: !!(b & 2), dark: !!(b & 4), trap: !!(b & 8), hidden: !!(b & 16) }; });
    const party = team(s).map(c => { const k = G.Party.RUN_CLS[c] || 'fighter', C = RUN.CLS[k], h = s.roster[c]?.m || { cls: c, lv: newLv(s), ab: G.Party.stdAb(c), name: '' }; return { cls: k, n: h.name || C.n, hp: C.hp, max: C.hp, dead: false, sl: { ...(C.slots || {}) }, hero: h }; }); // hero: 탐험 판정은 영웅의 실제 수치로 (RUN.X)
    return { map, at: 0, here: {}, party, items: kit(s), floor: fl, revealAll: true, flags: {}, log: [], path: [0] };
  }
  // 문의 장애물을 넘는 재주 (지도): [{ k: 재주 이름, ic, key, who: [기준], val: 지금 파티에서 넘는 사람의 직업 | null }] — 넘어 본 재주와 지금 파티가 가진 재주만 (처음 보는 장애물은 비어 있다)
  // 관문 한 줄 (경로 요약 · 지도): 지금 파티의 값이 있으면 값, 없으면 풀 수 있는 직업
  const GATE_N = { locked: { lock: '잠긴 문', bars: '창살', seal: '마법 봉인', rubble: '무너진 길' }, dark: '어두운 길', trap: '함정', hidden: '숨은 통로' };
  const gateKey = (V, q) => (q.room != null ? 'dark' : q.kind === 'locked' ? q.lock || 'lock' : q.kind === 'trap' ? 'trap' : q.kind === 'dark' ? 'dark' : null);
  const gateTxt = (s, V, q) => { const k = gateKey(V, q), S0 = STATE[k]; if (!S0) return GATE_N[q.kind] || ''; const r = gateInfo(s, V, q), v = r.find(x => x.val); return `${S0.n} · ${v ? v.val : S0.gate ? '닫힘' : S0.none}`; };
  function gateInfo(s, V, q) {
    const k = gateKey(V, q), S0 = STATE[k]; if (!S0) return []; const hs = team(s).map(c => s.roster[c]?.m).filter(Boolean), seen = known(s, k);
    const rows = S0.by.map(g => { const h = hs.find(m => knacksOf(m).includes(g)); return { k: KNACK[g].n, ic: KNACK[g].ic, key: g, who: [KNACK[g].need], val: h ? clsName(h.cls) : null }; }).filter(x => x.val || seen.includes(x.key));
    if (S0.torch) rows.push({ k: '횃불', who: ['누구나'], val: null });
    return rows;
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
  // ── 탐험 재주 (2026-11-27 사용자: 「부수기 / 자물쇠따기 / 함정해제 / 마법봉인해제 / 눈썰미」 · 「능력치로 보는게 srd에 가까우면 능력치로 하자」): 영웅이 가졌나만 본다 (판정 · 난이도 · 쿨타임 없음)
  //   부수기 = 근력 16 이상 · 자물쇠 따기 · 함정 해제 = 로그(도둑 도구) · 눈썰미 = 지혜 14 이상
  //   봉인 해제 · 빛 = 탐험 주문 (2026-11-27 사용자: 「주문계열 직업들이 랜덤하게 갖고 있는걸로 · 전투주문이랑 별도로 운영하게」): 주문 계열 영웅이 들어올 때 하나를 무작위로 갖는다 (m.xsp — 전투 스킬 칸과 별개, 레벨과 상관없다)
  const KNACK = { brk: { n: '부수기', ic: 'hammer', need: '근력 16' }, pick: { n: '자물쇠 따기', ic: 'key', need: '로그' }, disarm: { n: '함정 해제', ic: 'warn', need: '로그' }, unseal: { n: '봉인 해제', ic: 'wand', need: '주문' }, light: { n: '빛', ic: 'spark', need: '주문' }, eye: { n: '눈썰미', ic: 'eye', need: '지혜 14' } };
  const KN_STR = 16, KN_WIS = 14, XSPELLS = ['unseal', 'light'], CASTERS = ['bard', 'cleric', 'scout', 'mage', 'archmage', 'warlock'], XSP_N = 1; // 탐험 주문 · 갖는 직업 · 한 영웅이 갖는 수
  const rollXsp = (cls, rng = Math.random) => (CASTERS.includes(cls) ? XSPELLS.slice().sort(() => rng() - 0.5).slice(0, XSP_N) : []);
  // 그 영웅의 재주 (h = 용병 — 능력치가 아직 없으면(영입 전) 직업 · 레벨로 정해지는 것만)
  const knacksOf = h => { if (!h) return []; const ab = h.ab ? G.Dnd.ab(h) : {}, L = []; if (ab.str >= KN_STR) L.push('brk'); if (h.cls === 'rogue') L.push('pick', 'disarm'); L.push(...(h.xsp || [])); if (ab.wis >= KN_WIS) L.push('eye'); return L; };
  // ── 문의 장애물 (2026-11-27 사용자: 「탐험과 사건을 분리」 · 「잠긴문을 열지 못하면 그 방 자체를 못들어가는거」): 탐험 = 문, 사건 = 방 안
  //   gate = 넘는 재주가 없으면 못 들어간다 (설계서의 곁방에만 놓인다 — 큰길은 막히지 않는다) · by = 넘는 재주, 앞의 것 먼저 (조용한 따기가 시끄러운 부수기보다 앞) · 숨은 문은 눈썰미가 있어야 보인다 (explore/rules.js roomActs)
  //   함정 · 어둠은 막지 않는다: 함정 해제가 없으면 피해 · 어둠은 빛 주문 · 횃불 · 전원 암시야, 없으면 기습
  const STATE = {
    lock: { n: '잠긴 문', ic: 'lock', by: ['pick', 'brk'], gate: true }, bars: { n: '창살', ic: 'lock', by: ['pick', 'brk'], gate: true },
    seal: { n: '봉인', ic: 'orb', by: ['unseal'], gate: true }, rubble: { n: '무너진 길', ic: 'rock', by: ['brk'], gate: true },
    trap: { n: '함정', ic: 'warn', by: ['disarm'], none: '피해' }, dark: { n: '어둠', ic: 'moon', by: ['light'], torch: true, none: '기습' }, sleep: { n: '잠듦', ic: 'moon', by: [], none: '선공' },
  };
  const LOUD = { brk: true }; // 부수면 시끄럽다: 안의 적이 알아챈다 (잠든 적이 깬다 — 선공이 없다)
  // 겪으면 기억 (2026-11-27): 그 장애물을 어떤 재주로 넘어 봤나 (저장 s.knew) — 못 넘는 문의 표지 · 지도에 넘는 재주가 보인다. 처음 보는 것은 모른다 (창살은 잠긴 문과 같이 센다)
  const knewKey = k => (k === 'bars' ? 'lock' : k), known = (s, k) => s?.knew?.[knewKey(k)] || [];
  const learn = (s, k, g) => { if (!s || !STATE[k]) return; s.knew = s.knew || {}; const L = s.knew[knewKey(k)] = s.knew[knewKey(k)] || []; if (!L.includes(g)) L.push(g); };
  // 그 길(e — 이 방에서 나가는 쪽) 너머 방(n)의 상태 키 (없으면 null)
  const stateOf = (e, n) => (e.kind === 'locked' && !e.opened ? e.lock || 'lock' : e.kind === 'trap' && !e.disarmed ? 'trap' : (e.kind === 'dark' && !e.walked) || (n?.dark && !n.lit) ? 'dark' : n?.sleepy && !n.alert && !n.visited ? 'sleep' : null);
  // 지금 파티로 그 장애물을 넘나: { k, st: 이름, ic, sk: 쓰는 재주, who: 넘는 사람(탐사 사람), tag: '횃불 N' | '암시야' | 없을 때 결과, ok, shut: 못 들어감, loud: 시끄럽게 연다 }
  function passInfo(st, e, n) {
    const k = stateOf(e, n); if (!k) return null; const S0 = STATE[k], sk = XRUN.way(st, k), o = { k, st: S0.n, ic: S0.ic };
    if (sk) return { ...o, sk, who: XRUN.holder(st, sk), ok: true, loud: !!LOUD[sk] };
    if (k === 'dark' && XRUN.lit(st)) return { ...o, tag: '암시야', ok: true };
    if (S0.torch && (st.items?.torch || 0) > 0) return { ...o, tag: `횃불 ${st.items.torch}`, ok: true };
    return { ...o, tag: S0.none || null, ok: k === 'sleep', shut: !!S0.gate };
  }
  // 그 길은 지금 파티로 못 지난다 (안 연 잠긴 문 · 봉인 · 무너진 길에 넘는 재주가 없다)
  const gateShut = (st, e) => e.kind === 'locked' && !e.opened && !XRUN.way(st, e.lock || 'lock');
  const KEYUSE = []; // 방금 쓴 재주 { who: 탐사 사람, k: 재주, t: 한 일 } (화면이 머리 위에 띄우고 비운다)
  // 쿨타임 (라운드 · 방을 하나 옮기면 ROOM_R) — 시험값
  const XCD = { knock: 12, augury: 6, findtraps: 6, detect: 6, sense: 6, tactical: 6 }, ROOM_R = 6;
  const KO_SK = { 운동: 'athletics', 지각: 'perception', 은신: 'stealth', 조사: 'investigation', 생존: 'survival', 설득: 'persuasion', 위협: 'intimidation', 종교: 'religion', 비전: 'arcana', 의학: 'medicine', 역사: 'history' };
  const clsName = c => (G.Guild.def({ cls: c }) || {}).n || c;
  const hasX = (h, id) => !!h && (EXPL[h.cls] || []).some(([x, L]) => x === id && (h.lv || 1) >= L);
  const X_KNACK = { pick: 'pick', disarm: 'disarm', knock: 'unseal', brute: 'brk' }, X_FEAT = ['findtraps', 'evasion', 'danger', 'explorer', 'tactical', 'detect']; // 탐사 규칙의 옛 행동 이름 → 재주 · 방 안에서 쓰는 직업 기능
  // 원정의 탐사 규칙 연결 (RUN.X — js/explore/rules.js가 쓴다): 판정 = d20 + 영웅의 능력치 수정치 + 숙련(전문화 두 배) · 탐험 스킬 · 쿨타임
  const XRUN = {
    CD: XCD, ROOM_R, keyed: true,
    holder: (st, g) => (st.party || []).find(m => !m.dead && m.hero && knacksOf(m.hero).includes(g)) || null, // 그 재주를 가진 (살아 있는) 사람
    way: (st, k) => STATE[k].by.find(g => XRUN.holder(st, g)) || null, // 그 장애물을 넘을 재주 (없으면 null)
    onKnack(st, m, g, t, ob) { if (ob) learn(curS, ob, g); if (KEYUSE.length < 20) KEYUSE.push({ who: m, k: g, t: t || KNACK[g]?.n }); }, // 재주를 썼다: 겪은 것을 기억하고 화면에 알린다
    skill(m, sk) { const h = m.hero; if (!h) return (RUN.CLS[m.cls]?.sk || {})[sk] ?? 0; const N = G.Dnd, pr = N.prof(h.lv || 1);
      if (sk === '도둑 도구') return N.mod(N.ab(h).dex) + (hasX(h, 'pick') ? pr * 2 : -5); // 로그: 도둑 도구 숙련 + 전문화
      const en = KO_SK[sk]; if (!en) return 0; let v = N.skill(h, en);
      if (en === 'investigation' && hasX(h, 'explorer')) v += pr; // 능숙한 탐험가: 조사 전문화
      if (hasX(h, 'jack') && !N.profs(h).includes(en)) v += Math.floor(pr / 2); // 만능 재주꾼: 숙련 없는 판정에 숙련 절반
      return v; },
    can(st, m, id) { const g = X_KNACK[id]; return !!m.hero && (g ? knacksOf(m.hero).includes(g) : X_FEAT.includes(id) && hasX(m.hero, id)); }, // 문을 넘는 것은 재주 · 그 밖(방 안 · 사건)은 SRD 직업 기능 (그 레벨이 되어야)
    use(st, m, id) { return; }, useOld(st, m, id) { if (!XCD[id]) return; st.xcd = st.xcd || {}; (st.xcd[m.uid || m.n] = st.xcd[m.uid || m.n] || {})[id] = XCD[id]; },
    tick(st, r) { for (const k in st.xcd || {}) for (const id in st.xcd[k]) st.xcd[k][id] = Math.max(0, st.xcd[k][id] - r); if (G.Res?.cdOn) G.Res.clock += r; }, // 전투 스킬과 한 시계
    spend: (st, n, why) => spend(st, n, why),
    lit(st) { const al = st.party.filter(m => !m.dead); return !!XRUN.holder(st, 'light') || (al.length > 0 && al.every(m => (m.hero && G.Light ? G.Light.darkvision({ merc: m.hero }) > 0 : RUN.CLS[m.cls]?.dv))); }, // 빛 주문을 가진 영웅 · 또는 전원 암시야 = 영웅의 실제 종족 (전에는 옛 다섯 직업표 — 파이터면 드워프로 쳤다)
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


  // ── 길 찾기 (2026-11-27): 아는 길(못 찾은 숨은 통로 · 넘을 재주가 없는 문은 빼고)로 from에서 방마다 걸음 수 d · 바로 앞 방 prev. pass(id) = 그 방을 지나 더 갈 수 있나 (없으면 어느 방이든)
  function reach(st, from, pass = () => true) {
    const E = st.map.edges.filter(e => !e.stuck && (e.kind !== 'hidden' || e.seen?.hidden) && !gateShut(st, e)), d = new Map([[from, 0]]), prev = new Map(), q = [from];
    while (q.length) { const a = q.shift(); if (a !== from && !pass(a)) continue; for (const e of E) { const b = e.a === a ? e.b : e.b === a ? e.a : null; if (b == null || d.has(b)) continue; d.set(b, d.get(a) + 1); prev.set(b, a); q.push(b); } }
    return { d, prev };
  }
  // 지금 방에서 갈 수 있는 방들 (지나온 방은 건너뛴다): 가 본 방만 거쳐 닿는 방 — 가 본 방과 그 너머의 안 가 본 방. [{ to, path: 지나는 방 차례 (끝이 to), cost: 드는 물자 = 옮기는 방 수 }] 가까운 순
  function routes(st) { const N = st.map.nodes, { d, prev } = reach(st, st.at, id => N[id].visited), out = [];
    for (const [to, cost] of d) { if (to === st.at) continue; const path = []; for (let k = to; k !== st.at; k = prev.get(k)) path.unshift(k); out.push({ to, path, cost }); }
    return out.sort((a, b) => a.cost - b.cost); }
  // 우두머리 방까지 걸음 (못 닿으면 Infinity)
  const toBoss = (st, from = st.at) => { const b = st.map.nodes.find(n => n.type === 'boss'); return (b && reach(st, from).d.get(b.id)) ?? Infinity; };

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
    const n0 = flat.length, want = size < 2 ? n0 + (type === 'fight' ? 1 : 0) : boss ? Math.max(n0 + 1, size < 3 ? 0 : Math.min(6, size + 1)) : /* 둘이면 우두머리 곁의 졸개는 하나 (2026-11-27 — 새 저장 둘의 1층 승률 6/12 → 재려고) */ Math.max(n0 + 1, Math.round(n0 * (type === 'elite' ? W.elite : W.fight)));
    const all = flat.concat(Array(Math.max(0, want - n0)).fill(weak)).sort((a, b) => monXp(a) - monXp(b));
    let i = 0; const list = waveSizes(all.length, W.max).map(s => all.slice(i, i += s)).filter(L => L.length);
    if (boss) { if (list.length > 1) list[list.length - 1].unshift(boss); else list.push([boss]); } // 우두머리는 마지막 무리의 맨 앞
    return { list: list.map(tally), k: Math.min(1, (n0 + (boss ? 1 : 0)) / (all.length + (boss ? 1 : 0)) * W.pay) };
  }
  // ── 전투 전 배치 (2026-11-27): 방에 들어서면 입구 쪽 배치 구역(입구 벽에서 DEP.D타일)에 앞줄 · 뒷줄로 선다. 적은 안쪽.
  //   기본 = 근접 직업 앞줄 · 나머지 뒷줄, 플레이어가 옮긴 자리는 저장(s.form — 직업 → [줄 'f' | 'b', 줄 안 차례])에 남아 다음 전투의 기본. 영웅 다섯까지 서게 (줄마다 GAP타일 간격)
  const DEP = { D: 4, GAP: 2, T: 8 }; // D: 구역 깊이 · GAP: 줄 안 간격 · T: 배치 시간(초)
  // 방 id의 배치 구역 (iso · roomAt = G.Floor.fromRun, door = 들어온 문의 타일 좌표): 방 가운데 쪽이 앞(ax), 줄은 옆(side)으로
  function depZone(iso, roomAt, id, door) {
    const W = iso.w, ts = []; for (let k = 0; k < roomAt.length; k++) if (roomAt[k] === id && iso.c[k] === '.') ts.push([k % W, (k / W) | 0]);
    const mx = ts.reduce((a, t) => a + t[0], 0) / ts.length, my = ts.reduce((a, t) => a + t[1], 0) / ts.length, vx = mx - door[0], vy = my - door[1];
    const ax = Math.abs(vx) >= Math.abs(vy) ? [Math.sign(vx) || 1, 0] : [0, Math.sign(vy) || 1], side = [-ax[1], ax[0]], dep = t => t[0] * ax[0] + t[1] * ax[1], lat = t => t[0] * side[0] + t[1] * side[1];
    const d0 = Math.min(...ts.map(dep)), tiles = ts.filter(t => dep(t) - d0 < DEP.D), mid = tiles.reduce((a, t) => a + lat(t), 0) / Math.max(1, tiles.length);
    const row = t => (dep(t) - d0 >= DEP.D / 2 ? 'f' : 'b');
    const near = (x, y) => tiles.reduce((b, t) => (!b || Math.hypot(t[0] - x, t[1] - y) < Math.hypot(b[0] - x, b[1] - y) ? t : b), null); // 놓은 곳에서 가장 가까운 구역 칸
    return { tiles, ax, side, d0, mid, row, lat, near, door };
  }
  // 기본 진형: ps = 엔진 영웅들 → Map(영웅 → [x, y]). 줄마다 가운데에서 GAP 간격, 앞줄은 구역 안쪽 끝 둘째 줄 · 뒷줄은 입구 줄
  function depForm(s, ps, Z) {
    const F = s.form || {}, live = ps.filter(p => !p.dead && p.merc), rowOf = p => F[p.merc.cls]?.[0] || (G.Dnd.melee(p) ? 'f' : 'b'), out = new Map(), used = new Set();
    for (const r of ['f', 'b']) {
      const L = live.filter(p => rowOf(p) === r).sort((a, b) => (F[a.merc.cls]?.[1] ?? 9 + live.indexOf(a)) - (F[b.merc.cls]?.[1] ?? 9 + live.indexOf(b))), d = Z.d0 + (r === 'f' ? DEP.D - 2 : 0);
      L.forEach((p, i) => { const want = Z.mid + (i - (L.length - 1) / 2) * DEP.GAP, free = Z.tiles.filter(t => !used.has(t + '')), on = free.filter(t => t[0] * Z.ax[0] + t[1] * Z.ax[1] === d), pool = on.length ? on : free;
        const t = pool.reduce((b, q) => (!b || Math.abs(Z.lat(q) - want) < Math.abs(Z.lat(b) - want) ? q : b), null); if (t) { used.add(t + ''); out.set(p, t.slice()); } });
    }
    return out;
  }
  // 플레이어가 옮긴 자리를 기억: 줄(구역 앞 절반 = 앞줄) · 줄 안 차례(옆 좌표 순)
  function depSave(s, Z, slots) {
    const F = s.form = {}, rows = { f: [], b: [] }; for (const [p, t] of slots) if (p.merc) rows[Z.row(t)].push([p, Z.lat(t)]);
    for (const r of ['f', 'b']) rows[r].sort((a, b) => a[1] - b[1]).forEach(([p], i) => { F[p.merc.cls] = [r, i]; });
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
      if (XRUN.keyed) for (const x of RUN.nexts(st)) { x.n.seenMap = true; x.e.seen = x.e.seen || {}; if (x.e.kind === 'locked') x.e.seen.lock = true; if (x.e.kind === 'trap') x.e.seen.trap = true; if (x.e.kind === 'dark') x.e.seen.dark = true; } // 방 상태: 이웃 방의 종류와 상태는 늘 보인다 (적은 가 봐야 안다)
      const mark = a => { const L = st.log[st.log.length - 1]; if (L && !L.g && !L.r) L.g = { who: a.who || '', gate: '탐험', how: a.label, ok: true }; }; // 탐험 스킬 (판정 없는 것): 화면의 알림 판으로 — 판정 있는 것은 그 기록(.r)을 쓴다
      for (const a of RUN.roomActs(st)) if (['search', 'findtraps', 'sense', 'lore', 'detect'].includes(a.id)) { const n0 = st.log.length; a.run(); if (st.log.length > n0 && a.id !== 'search' && a.id !== 'findtraps') mark(a); }
      if (!XRUN.keyed) for (const x of RUN.nexts(st)) { if (x.n.visited || x.n.info >= 3) continue; for (const a of RUN.infoActs(st, x.e)) if (a.id === 'augury' || (a.id === 'scout' && (x.n.hostile || XRUN.keyed)) || a.id === 'track') { const n0 = st.log.length; a.run(); if (st.log.length > n0 && a.id === 'augury') mark(a); if (st.here.augury) break; } } },
    // 갈림길: opts = 출구들 ({ to, e }). 체력이 낮으면 야영 쪽, 아니면 RANK — 잠긴 보물 방은 열 수단이 있을 때만 (로그 · 열림 두루마리 · 열림 주문)
    // 다음 방 (FTL처럼 방마다 — 2026-11-26): opts = 이 방의 모든 길 ({ to, e, ed }). 안 가 본 방이 있으면 그중 RANK · 방 상태로, 없으면 안 가 본 방 · 우두머리로 가는 가장 짧은 길의 첫 방
    //   다쳤으면 야영 방이 앞 · 못 여는 보물 방은 뒤 · 혼자면 정예 · 우두머리는 맨 뒤
    //   물자 (2026-11-27): 그 방에 들렀다가 우두머리 방까지 굶지 않고 닿을 때만 들른다 — 모자라면 우두머리 쪽으로 곧장
    fork(st, opts) {
      const N = st.map.nodes, solo = st.party.filter(m => !m.dead).length < 2, low = hurt(st) < 0.5, camp = st.items.camp || 0, boss = N.find(n => n.type === 'boss'), dB = reach(st, boss.id).d, can = (id, c) => id === boss.id || c + (dB.get(id) ?? 99) <= camp;
      const score = x => { const n = N[x.to], t = n.type === 'fight' ? (n.tier === 'light' ? 'event' : 'fight') : n.type, pi = passInfo(st, x.ed || x.e, n); let v = RANK[t] ?? 3;
        if (low && t === 'camp') v = -2; if (pi && !pi.ok) v += 1.5; if (n.tier === 'heavy') v += 0.5; if (solo && (n.type === 'elite' || n.type === 'boss')) v += 30; return v; };
      const fresh = opts.map((x, i) => [x, i]).filter(([x]) => !N[x.to].visited && can(x.to, 1) && !passInfo(st, x.ed || x.e, N[x.to])?.shut); // 못 넘는 문은 고르지 않는다
      let j;
      if (fresh.length) j = fresh.map(([x, i]) => [score(x), i]).sort((a, b) => a[0] - b[0])[0][1];
      else { // 들를 새 방이 곁에 없다: 가 본 방을 거쳐 닿는 안 가 본 방 중 가장 가까운 (물자가 되는) 방으로, 없으면 우두머리 방으로 가는 가장 짧은 길의 첫 방
        const far = routes(st).find(r => !N[r.to].visited && can(r.to, r.cost)), R0 = reach(st, st.at);
        let k = far ? far.path[0] : boss.id; if (!far) while (R0.prev.has(k) && R0.prev.get(k) !== st.at) k = R0.prev.get(k);
        j = Math.max(0, opts.findIndex(x => x.to === k));
      }
      forkLog(st, opts[j], '자동'); return j;
    },
    move: st => spend(st, 1), // 방을 옮길 때마다 물자 1
    rest: (st, members) => campHere(st, members),
    // 장면 (사건 · 전투 · 야영 · 상인 · 구역 끝 야영지): choices의 번호
    scene(st, s) {
      const ok = s.choices.map((c, i) => [c, i]).filter(([c]) => !(c.off && c.off()) && !c.lock), name = re => ok.find(([c]) => re.test(c.n));
      if (s.kind === 'fight') return (name(/^기습한다/) || name(/^싸운다/) || ok[0])[1];
      if (s.kind === 'camp') { const pl = curS?.campPlan?.[st.floor], want = (st.items.camp || 0) > 0 && (pl && pl.length ? pl.includes(st.at) : hurt(st) < 0.9); if (want) { const k0 = st.items.camp--; st.camped = st.camped || {}; st.camped[`${st.floor}:${st.at}`] = true; st.xcd = {}; st.log.push({ t: `야영 · 물자 ${k0} → ${st.items.camp} · 체력 100%`, k: 'dv' }); return (name(/^긴 휴식/) || ok[0])[1]; } return (name(/지나간다/) || ok[ok.length - 1])[1]; } // 야영 방도 물자가 있어야 쉰다
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
  return { DEP, depZone, depForm, depSave, restCost, REST, REST_CAMP, CAMP_FREE, KNACK, knacksOf, rollXsp, known, learn, KEYUSE, STATE, stateOf, passInfo, gateShut, USED, waves, waveSizes, soloBuilds, sheetOf, firstLineOf, DT_N, TY_N, affOf, affKnown, affTag, edgeOf, planFoes, mainType, tkTake, endWhy, statTick, statOf, ownerOf, GEMS, GEM_STACK, gemDrop, slotsOf, evPass, BRANCH, evOf, evMark, evOpen, evPlanSet, evDecide, evOut, CARD, cardCands, cardRec, cardOffer, cardChoose, cardAuto, cardInit, cdOf, canCamp, campHere, wantCamp, gateTxt, PARTS, EXPL, XCD, XRUN, gateInfo, TUNE, SUP_KEYS, reviveCost, raise, deadList, strMod, bagCap, supMax, bagPlan, supCost, pack, supN, bagUsed, bagFull, stow, lootGold, drawState, segPts, reward, SPECS, FV, KEY, ZONES, LAST, CLS, TREE, CAMP, fresh, load: loadFix, noMc, dump, step, cost, buy, total, complete, seats, classes, camp, speeds, kit, team, toggle, bonus, bonusTo, starts, startFloor, reach, routes, toBoss, floorSeed, remember, recall, explored, view, killGold, finish, rate, xpRate, settle, AWAY_K, AWAY_CAP, XP_K, PACE_LV, PACE_K, pace, LV_MAX, CATCH, BENCH, NEW_GAP, catchK, gain, autoPick, totalXp, newLv, revive, bank, rebuild, dexMons, dexHeroes, dexItems, dexCount, RARITY, R_TABLE, pickR, rOf, LOOT, hook, member, world, outfit, POL };
})();
