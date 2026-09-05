/* ============================================================
   Arsenal Engine — общие чистые функции поверх data.json.
   Работает и в браузере (window.ArsenalEngine), и в Node (require / import).
   Здесь живёт всё, что должно совпадать между UI и скриптом сборки:
   авто-имена композитов и экспорт для Unity.
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ArsenalEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const GI = { m: 0, f: 1, n: 2, pl: 3 };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const P = (D, id) => D.payloads[id];
  const EL = (D, id) => D.elements[id] || D.elements.none;
  const payloadColor = (D, pid) => EL(D, P(D, pid)?.element || 'none').color;

  // Имя композита: прилагательное нагрузки в роде существительного доставки.
  // 0 нагрузок → «Молния»; 1 → «Огненная молния»; 2 → «Огненно-ледяная молния»; 3+ → «Мульти-элементная молния».
  // Ручные имена: compositeOverrides["delivery+payloadA,payloadB"] (нагрузки по алфавиту, self-нагрузки не участвуют).
  function compositeName(D, nounDef, payloadIds, deliveryId) {
    const st = payloadIds.filter((p) => P(D, p) && !P(D, p).self);
    const named = st.length ? st : payloadIds.filter((p) => P(D, p));
    const key = `${deliveryId}+${[...named].sort().join(',')}`;
    const ov = D.compositeOverrides[key];
    if (ov && ov.name) return { name: ov.name, key, override: ov };
    const g = GI[nounDef.gender] ?? 0;
    if (!named.length) return { name: cap(nounDef.noun), key };
    if (named.length === 1) return { name: cap(P(D, named[0]).adj[g]) + ' ' + nounDef.noun, key };
    if (named.length === 2) return { name: cap(P(D, named[0]).stem + '-' + P(D, named[1]).adj[g]) + ' ' + nounDef.noun, key };
    return { name: 'Мульти-элементн' + ['ый', 'ая', 'ое', 'ые'][g] + ' ' + nounDef.noun, key };
  }

  // Экспорт для Unity: словари + все композиты (носитель/доставка × 0–2 не-self нагрузки) с именами и цветами.
  function unityExport(D) {
    const nonSelf = Object.keys(D.payloads).filter((p) => !P(D, p).self);
    const composites = [];
    const nouns = [...Object.entries(D.weaponKinds).map(([id, k]) => ({ id, def: k })), ...Object.entries(D.deliveries).map(([id, d]) => ({ id, def: d }))];
    for (const n of nouns) {
      composites.push({ id: n.id, delivery: n.id, payloads: [], name: cap(n.def.noun), vfx: n.def.vfx.map((p) => ({ prim: p, colors: ['#c9d1d9'] })) });
      for (const a of nonSelf) {
        composites.push({ id: `${n.id}+${a}`, delivery: n.id, payloads: [a], name: compositeName(D, n.def, [a], n.id).name,
          vfx: [...n.def.vfx.map((p) => ({ prim: p, colors: [payloadColor(D, a)] })), { prim: P(D, a).vfx, colors: [payloadColor(D, a)] }] });
        for (const b of nonSelf) if (a < b) composites.push({ id: `${n.id}+${a},${b}`, delivery: n.id, payloads: [a, b], name: compositeName(D, n.def, [a, b], n.id).name,
          vfx: [...n.def.vfx.map((p) => ({ prim: p, colors: [payloadColor(D, a), payloadColor(D, b)] })), { prim: P(D, a).vfx, colors: [payloadColor(D, a)] }, { prim: P(D, b).vfx, colors: [payloadColor(D, b)] }] });
      }
    }
    return { version: D.version, updated: D.updated, elements: D.elements, payloads: D.payloads, deliveries: D.deliveries, weaponKinds: D.weaponKinds, weaponVariants: D.weaponVariants, vfxPrimitives: D.vfxPrimitives, reactions: D.reactions, composites,
      weapons: D.weapons.map((w) => ({ id: w.id, name: w.name, kind: w.kind, hands: w.hands, dmg: w.dmg, aps: w.aps, projectiles: w.projectiles, projSpeed: w.projSpeed, crit: w.crit, critMult: w.critMult, mag: w.mag, reload: w.reload, tags: w.tags, moduleSlots: w.moduleSlots || [],
        range: { min: w.rangeMin || 0, optimal: w.rangeOpt ?? w.range, max: w.range, falloffMult: w.falloff ?? 1, closeMult: w.closeMult ?? 1, ignoresObstacles: w.projSpeed === 0 } })),
      rangeStats: ['rangePct', 'rangeOptPct', 'rangeMinAdd', 'falloffAdd', 'closeMultAdd'],
      slots: { passive: D.config.passiveSlots, active: D.config.activeSlots, ultimate: D.config.ultSlots, item: D.config.itemSlots || 1, ultMinLevel: D.config.ultMinLevel, maxLevel: D.config.maxLevel },
      items: (D.items || []).map((it) => ({ id: it.id, name: it.name, cat: it.cat, rarity: it.rarity, uses: it.uses || 1, effects: it.effects || [] })),
      iconSet: D.iconSet || null,
      mods: D.mods.map((m) => ({ id: m.id, name: m.name, type: m.type, rarity: m.rarity, icon: m.icon, cooldown: m.cooldown, charge: m.charge, maxStacks: m.maxStacks, stats: m.stats || {}, effects: m.effects || [], weapon: m.weapon || {} })),
      moduleSlots: D.moduleSlots, modules: (D.modules || []).map((m) => ({ id: m.id, name: m.name, slot: m.slot, rarity: m.rarity, stats: m.stats || {}, effects: m.effects || [], weapon: m.weapon || {} })) };
  }

  return { GI, cap, payloadColor, compositeName, unityExport };
});
