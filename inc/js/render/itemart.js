'use strict';
// 물건 그림 (assets/item/ — Quaternius 무기 · 소품을 32px로 구운 것): x = 가방 · 전리품 기록 → 그림 주소 (맞는 것이 없으면 null)
const ITEMART = (() => {
  const u = n => `assets/item/${n}.png`, hs = s => { let h = 7; for (const c of String(s)) h = Math.imul(h, 31) + c.charCodeAt(0) | 0; return h >>> 0; };
  const WPN = [[/dagger|sickle|dart/, ['Dagger', 'Dagger_2']], [/greatsword/, ['Sword_Big', 'Claymore']], [/scimitar|rapier/, ['Sword_2']], [/sword/, ['Sword']], [/greataxe|halberd/, ['Axe_Double']], [/handaxe/, ['Axe_Small']], [/axe/, ['Axe']], [/maul|greatclub/, ['Hammer_Double']], [/club|mace|star|flail|hammer|whip/, ['Hammer_Small']], [/spear|javelin|pike|lance|trident|glaive/, ['Spear']], [/staff/, ['staff']], [/bow|sling|musket|pistol/, ['Bow_Wooden']]];
  const MAGIC = { Sword: 'Sword_Golden', Sword_Big: 'Claymore', Bow_Wooden: 'Bow_Golden' };
  const wpn = (k, magic) => { const h = WPN.find(x => x[0].test(k || '')); if (!h) return null; const n = h[1][magic != null ? hs(magic) % h[1].length : 0]; return u(magic != null && MAGIC[n] ? MAGIC[n] : n); };
  const armor = k => { const a = G.SRD.ARMOR[k]; return a ? u('armor_' + (a.cat === 'heavy' ? 'heavy' : a.cat === 'medium' ? 'medium' : a.cat === 'light' ? 'light' : 'robe')) : null; };
  const ACC = [[/potion|elixir|oil|philter/i, ['Potion_1', 'Potion_2', 'Potion_4', 'SmallBottle']], [/scroll/i, ['Scroll_1', 'Scroll_2']], [/book|tome|manual/i, ['Book_5', 'Book_7']], [/bag|haversack|quiver/i, ['Pouch_Large']], [/helm|hat|headband|circlet/i, ['helm']], [/robe|cloak|mantle|cape/i, ['armor_robe']], [/ioun|pearl|gem|stone|orb/i, ['gem_sapphire']], [/key/i, ['Key_Gold']], [/rope/i, ['Rope_1']], [/flask|bottle|decanter/i, ['SmallBottle']]];
  function url(x) {
    try {
      if (!x) return null;
      if (x.gem) return u('gem_' + x.gem);
      if (x.sup) return u('Pouch_Large');
      if (x.kind === 'base') return x.e.slot === 'w' ? wpn(x.e.k) : x.e.slot === 'a' ? armor(x.e.k) : x.e.slot === 's' ? u('Shield_Round') : null;
      const t = x.kind === 'magic' ? x.t : x.kind === 'art' ? { k: x.k, id: 0, base: x.base } : x.kind === 'rand' ? { rand: x.rand, id: 0, base: x.base } : x, d = G.Trinket.def(t); if (!d) return null;
      const kd = G.Gear.kindOf(t), en = d.en || '', id = t.id ?? t.k ?? t.n ?? 'a';
      if (kd === 'focus') return u('staff');
      if (kd === 'weapon') return wpn(t.base, id) || (/staff/i.test(en) ? u('staff') : wpn(en.toLowerCase(), id));
      if (kd === 'armor') return armor(t.base);
      if (kd === 'shield') return u(['Shield_Round_2', 'Shield_Heater_2', 'Shield_Heater', 'Shield_Celtic_Golden'][Math.min(3, d.r || 0)]);
      const h = ACC.find(q => q[0].test(en)); return h ? u(h[1][hs(en) % h[1].length]) : null;
    } catch (err) { return null; }
  }
  return { url };
})();
