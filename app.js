/* ============================================================
   Arsenal Designer v2 — композиционная система эффектов
   Оружие (базовая доставка) × доставки модов × нагрузки → каналы;
   статусы на цели → реакции; всё раскладывается на VFX-примитивы.
   ============================================================ */
(() => {
  const LS_KEY = 'arsenal_designer_v2';
  const LS_BUILDS = 'arsenal_designer_builds_v2';
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n, d = 1) => (Number.isFinite(n) ? n.toFixed(d) : '—');
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  // ---------------- state ----------------
  let D = load();
  let builds = loadBuilds();
  const UI = {
    tab: 'builder',
    modFilter: { type: '', rarity: '', q: '' },
    lib: { q: '', type: '' },
    syn: { delivery: 'chain', payload: 'burn', modA: 'burn_touch' },
    builder: { main: 'pistol', offhand: '', passives: [], actives: [], ult: null, name: '', modules: {} },
    draft: { level: 1, offer: [], banned: [], picks: 0 },
  };
  function load() {
    try { const raw = localStorage.getItem(LS_KEY); if (raw) { const d = JSON.parse(raw); if (d && d.version === 2 && d.mods) return d; } } catch (e) { /* */ }
    return clone(window.DEFAULT_DATA);
  }
  function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(D)); flash(); } catch (e) { console.warn(e); } }
  function loadBuilds() { try { return JSON.parse(localStorage.getItem(LS_BUILDS) || '[]'); } catch (e) { return []; } }
  function saveBuilds() { try { localStorage.setItem(LS_BUILDS, JSON.stringify(builds)); } catch (e) { /* */ } }
  let flashT; function flash() { const s = $('#saveState'); if (!s) return; s.textContent = 'сохранено ✓'; s.style.color = 'var(--good)'; clearTimeout(flashT); flashT = setTimeout(() => { s.textContent = 'сохранено'; s.style.color = ''; }, 900); }

  // ---------------- lookups ----------------
  const W = (id) => D.weapons.find((w) => w.id === id);
  const M = (id) => D.mods.find((m) => m.id === id);
  const MD = (id) => (D.modules || []).find((m) => m.id === id);
  const P = (id) => D.payloads[id];
  const DL = (id) => D.deliveries[id];
  const EL = (id) => D.elements[id] || D.elements.none;
  const elColor = (id) => EL(id).color;
  const payloadColor = (pid) => elColor(P(pid)?.element || 'none');
  const rarityRank = (r) => D.rarities.indexOf(r);
  const typeName = { passive: 'Пассивка', active: 'Актив', ultimate: 'Ульта' };
  const typeOrder = ['passive', 'active', 'ultimate'];
  const handsName = { '1h': 'Одноручное', off: 'Левая рука', '2h': 'Двуручное' };
  const tn = (t) => D.weaponTagNames[t] || t;
  const GI = { m: 0, f: 1, n: 2, pl: 3 };

  // ---------------- weapon math ----------------
  function derived(w, st = {}) {
    const dmg = w.dmg * (1 + (st.dmgPct || 0));
    const aps = w.aps * (1 + (st.aspdPct || 0));
    const projectiles = (w.projectiles || 1) + (st.projectilesAdd || 0);
    const crit = Math.min(1, (w.crit || 0) + (st.critPct || 0));
    const critMult = (w.critMult || 1.5) + (st.critMultAdd || 0);
    const reload = (w.reload || 0) * Math.max(0, 1 + (st.reloadPct || 0));
    const critF = 1 + crit * (critMult - 1);
    let uptime = 1; if (w.mag > 0 && aps > 0) { const c = w.mag / aps; uptime = c / (c + reload); }
    const hitsPerSec = aps * projectiles * uptime;
    const dph = dmg * projectiles;
    const dps = dph * aps * critF * uptime;
    return { dmg, aps, projectiles, crit, critMult, reload, critF, uptime, hitsPerSec, dph, dps, ttk: D.config.enemyHp / Math.max(1, dps), ttkElite: D.config.eliteHp / Math.max(1, dps),
      obstacleRisk: w.projSpeed === 0 ? 'нет (ближний бой)' : w.projSpeed >= 100 ? 'низкий' : w.projSpeed >= 55 ? 'средний' : 'высокий' };
  }
  function loadoutTags(mainId, offId) { const t = new Set(); const m = W(mainId); if (m) m.tags.forEach((x) => t.add(x)); const o = offId ? W(offId) : null; if (o) o.tags.forEach((x) => t.add(x)); return t; }
  function affinity(tags, mod) {
    const wr = mod.weapon || {}; const reasons = []; const req = wr.requires || [];
    if (req.length) {
      const have = req.filter((t) => tags.has(t)); const ok = wr.requiresAny ? have.length > 0 : have.length === req.length;
      if (!ok) return { ok: false, score: 0, reasons: [`нужно: ${req.map(tn).join(wr.requiresAny ? ' или ' : ' + ')}`] };
    }
    let s = 1;
    for (const [t, v] of Object.entries(wr.bonus || {})) if (tags.has(t)) { s += v; reasons.push(`+${v} ${tn(t)}`); }
    for (const [t, v] of Object.entries(wr.penalty || {})) if (tags.has(t)) { s += v; reasons.push(`${v} ${tn(t)}`); }
    return { ok: true, score: Math.max(0.1, +s.toFixed(2)), reasons };
  }

  // ---------------- naming ----------------
  function compositeName(nounDef, payloadIds, deliveryId) {
    const st = payloadIds.filter((p) => P(p) && !P(p).self);
    const named = st.length ? st : payloadIds.filter((p) => P(p));
    const key = `${deliveryId}+${[...named].sort().join(',')}`;
    const ov = D.compositeOverrides[key];
    if (ov && ov.name) return { name: ov.name, key, override: ov };
    const g = GI[nounDef.gender] ?? 0;
    if (!named.length) return { name: cap(nounDef.noun), key };
    if (named.length === 1) return { name: cap(P(named[0]).adj[g]) + ' ' + nounDef.noun, key };
    if (named.length === 2) return { name: cap(P(named[0]).stem + '-' + P(named[1]).adj[g]) + ' ' + nounDef.noun, key };
    return { name: 'Мульти-элементн' + ['ый', 'ая', 'ое', 'ые'][g] + ' ' + nounDef.noun, key };
  }
  const fill = (tpl, o) => tpl.replace(/\{(\w+)\}/g, (_, k) => o[k] ?? '?');
  const densityTargets = (r) => Math.min(8, Math.round(1 + (r || 0) * 0.6));

  // ---------------- THE ENGINE ----------------
  function computeBuild(build) {
    const main = W(build.main); const off = build.offhand ? W(build.offhand) : null;
    const tags = loadoutTags(build.main, build.offhand);
    const entries = [
      ...(build.modules || []).map((id) => ({ mod: MD(id), stacks: 1, isModule: true })),
      ...build.mods.map((x) => ({ mod: M(x.id), stacks: Math.max(1, x.stacks || 1) })),
    ].filter((e) => e.mod);
    const out = { main, off, tags, stats: {}, channels: [], statuses: {}, reactions: [], selfs: [], warnings: [], affinities: [], wow: 0, power: 0, modules: entries.filter((e) => e.isModule).map((e) => e.mod) };
    if (!main) return out;

    for (const e of entries) { const n = Math.min(e.stacks, e.mod.maxStacks || 1); for (const [k, v] of Object.entries(e.mod.stats || {})) out.stats[k] = (out.stats[k] || 0) + v * n; }
    const base = derived(main, out.stats); out.base = base;
    out.power = entries.reduce((s, e) => s + (e.mod.power || 0), 0);
    for (const e of entries) { const a = affinity(tags, e.mod); out.affinities.push({ mod: e.mod, a }); if (!a.ok) out.warnings.push(`«${e.mod.name}» несовместим: ${a.reasons[0]}`); else if (a.score < 0.9) out.warnings.push(`«${e.mod.name}» слабо подходит оружию (${a.score})`); }

    // upgrades
    const up = { inheritAll: false, activateMult: 1 };
    for (const e of entries) for (const ef of e.mod.effects || []) if (ef.upgrade) {
      const u = ef.upgrade;
      if (u.delivery) { up[u.delivery] = up[u.delivery] || {}; for (const [k, v] of Object.entries(u)) if (k !== 'delivery') up[u.delivery][k] = (up[u.delivery][k] || 0) + v; }
      if (u.inheritAll) up.inheritAll = true;
      if (u.trigger === 'on_activate' && u.mult) up.activateMult *= u.mult;
    }
    const cdr = out.stats.cdrPct || 0;

    // base on_hit payloads
    const basePayloads = [];
    for (const e of entries) for (const ef of e.mod.effects || []) if (ef.trigger === 'on_hit' && ef.payload && !ef.delivery) basePayloads.push({ id: ef.payload, every: ef.every || 1, src: e.mod.name });
    const basePayloadIds = [...new Set(basePayloads.map((p) => p.id))];
    const passiveStatuses = []; for (const e of entries) for (const ef of e.mod.effects || []) if (ef.trigger === 'passive' && ef.payload && !ef.delivery) passiveStatuses.push({ id: ef.payload, src: e.mod.name });

    // continuation deliveries multiply weapon hits
    let extraHits = 0;
    const kills = base.dps / D.config.enemyHp;
    for (const e of entries) for (const ef of e.mod.effects || []) if (ef.delivery && DL(ef.delivery)?.continuation) {
      const cnt = (ef.count || DL(ef.delivery).count || 1) + ((up[ef.delivery] || {}).count || 0);
      if (ef.trigger === 'on_hit') extraHits += base.hitsPerSec * cnt / (ef.every || 1) * (ef.chance || 1) * Math.min(1, ef.dmg || 1) * 0.8;
      else if (ef.trigger === 'on_kill') extraHits += kills * cnt / (ef.every || 1);
    }
    const totalHits = base.hitsPerSec + extraHits;
    out.totalHits = totalHits; out.extraHits = extraHits; out.kills = kills;

    function rateFor(ef, mod) {
      const t = ef.trigger;
      if (t === 'on_hit') { const r = totalHits / (ef.every || 1) * (ef.chance || 1) * (ef.condition ? 0.6 : 1); return { rate: r, label: `${fmt(r, 1)}/с` }; }
      if (t === 'on_crit') { const r = totalHits * base.crit * (ef.condition ? 0.6 : 1); return { rate: r, label: `${fmt(r, 1)}/с (крит ${Math.round(base.crit * 100)}%)` }; }
      if (t === 'on_kill') { const r = kills / (ef.every || 1) * (ef.condition ? 0.7 : 1); return { rate: r, label: `${fmt(r, 2)}/с (≈${fmt(kills, 2)} уб./с)` }; }
      if (t === 'periodic') { const r = 1 / (ef.everySec || 5); return { rate: r, label: `раз в ${ef.everySec || 5} с` }; }
      if (t === 'on_activate') { const cd = (mod.cooldown || 10) * (1 - cdr); const r = up.activateMult / cd; return { rate: r, label: `КД ${fmt(cd, 0)} с${up.activateMult > 1 ? ` ×${up.activateMult}` : ''}` }; }
      if (t === 'on_ult') return { rate: null, label: 'по заряду ульты' };
      if (t === 'passive') return { rate: null, label: 'постоянно' };
      return { rate: null, label: 'ситуативно' };
    }

    // ---- base channel
    const kind = D.weaponKinds[main.kind] || D.weaponKinds.projectile;
    const bn = compositeName(kind, basePayloadIds, main.kind);
    out.channels.push({
      id: 'base', kind: 'base', name: bn.name, key: bn.key, override: bn.override, trigger: 'on_hit', rateLabel: `${fmt(totalHits, 1)} попад./с`, rate: totalHits, tps: totalHits, targets: 1,
      payloads: basePayloads.map((p) => ({ id: p.id, rate: totalHits / p.every, src: p.src })), dmg: 1,
      desc: `Каждое попадание: ${main.name.toLowerCase()}${extraHits ? ` (с продолжениями снаряда ×${fmt(totalHits / base.hitsPerSec, 2)})` : ''}` + (basePayloads.length ? ` накладывает ${basePayloads.map((p) => P(p.id).name.toLowerCase() + (p.every > 1 ? ` (каждое ${p.every}-е)` : '')).join(', ')}.` : ' — без статусов.'),
      vfx: kind.vfx, variant: null, src: [main.name, ...basePayloads.map((p) => p.src)],
    });
    if (off) {
      const bk = D.weaponKinds[off.kind]; const on = compositeName(bk, basePayloadIds, off.kind);
      out.channels.push({ id: 'off', kind: 'base', name: on.name, key: on.key, trigger: 'on_hit', rateLabel: `${fmt(off.aps, 1)} удар/с`, rate: off.aps, tps: off.aps, targets: 1, payloads: basePayloads.map((p) => ({ id: p.id, rate: off.aps / p.every, src: p.src })), dmg: 1, desc: `Удар щитом${basePayloads.length ? ': накладывает ' + basePayloads.map((p) => P(p.id).name.toLowerCase()).join(', ') : ''}. Блок даёт триггер «при блоке».`, vfx: bk.vfx, src: [off.name] });
    }

    // ---- secondary channels
    for (const e of entries) for (const ef of e.mod.effects || []) {
      if (ef.upgrade) continue;
      if (ef.self && !ef.delivery && !ef.payload) { out.selfs.push({ mod: e.mod, trigger: ef.trigger, text: ef.self }); continue; }
      if (!ef.delivery) {
        if (ef.payload && ef.trigger !== 'on_hit') {
          const r = rateFor(ef, e.mod); const pl = P(ef.payload);
          out.channels.push({ id: e.mod.id + ':' + ef.payload, kind: 'direct', name: `${pl.name}${pl.self ? ' себе' : ''}`, trigger: ef.trigger, rateLabel: r.label, rate: r.rate, tps: r.rate ?? 0.3, targets: 1, payloads: [{ id: ef.payload, rate: r.rate ?? 0.3, src: e.mod.name }], dmg: 0, desc: `${cap(D.triggers[ef.trigger])}${ef.condition ? ` по цели с «${P(ef.condition).name}»` : ''}: ${pl.desc}${ef.amount ? ` (${Math.round(ef.amount * 100)}%)` : ''}.`, vfx: [pl.vfx], src: [e.mod.name], mod: e.mod });
          if (ef.self) out.selfs.push({ mod: e.mod, trigger: ef.trigger, text: ef.self });
        }
        continue;
      }
      const dl = DL(ef.delivery); if (!dl) { out.warnings.push(`неизвестная доставка ${ef.delivery} у «${e.mod.name}»`); continue; }
      const u = up[ef.delivery] || {};
      const params = { targets: (ef.targets ?? dl.targets ?? 1) + (u.targets || 0), count: (ef.count ?? dl.count ?? 1) + (u.count || 0), radius: (ef.radius ?? dl.radius ?? 0) + (u.radius || 0), duration: ef.duration ?? dl.duration ?? 0 };
      const r = rateFor(ef, e.mod);
      if (ef.trigger === 'on_block' && !tags.has('block')) out.warnings.push(`«${e.mod.name}» требует щит (триггер «при блоке»)`);
      if (ef.condition && !basePayloadIds.includes(ef.condition) && !passiveStatuses.some((p) => p.id === ef.condition) && !entries.some((x) => (x.mod.effects || []).some((y) => y.payload === ef.condition && y !== ef))) out.warnings.push(`«${e.mod.name}» ждёт статус «${P(ef.condition).name}», но никто его не накладывает`);
      const inherits = !!ef.inherits || up.inheritAll;
      const own = [...(dl.innate || []), ...(ef.payload ? [ef.payload] : [])];
      const inherited = inherits ? basePayloadIds.filter((p) => !own.includes(p)) : [];
      const payloadIds = [...own, ...inherited];
      let targets = params.targets;
      if (['burst', 'wave', 'zone', 'pull', 'trap'].includes(ef.delivery)) targets = densityTargets(params.radius);
      else if (['split', 'ricochet', 'pierce', 'orbit'].includes(ef.delivery)) targets = params.count;
      else if (['echo', 'reflect', 'summon'].includes(ef.delivery)) targets = 1;
      let tps = r.rate == null ? 0.3 * targets : r.rate * targets;
      if (ef.delivery === 'summon' && (ef.dmg || 0) > 0) tps = base.hitsPerSec * (ef.dmg || 0.5) * Math.min(1, (params.duration || 10) / Math.max(1, e.mod.cooldown || 1));
      if (ef.repeatSec && params.duration) tps = targets * (params.duration / ef.repeatSec) * (r.rate ?? 0.02);
      const nm = compositeName(dl, payloadIds, ef.delivery);
      const variants = D.weaponVariants[main.kind] || {};
      const variant = variants[ef.delivery] || variants._ || null;
      const trig = `${cap(D.triggers[ef.trigger])}${ef.every ? ` (каждое ${ef.every}-е)` : ''}${ef.everySec ? ` (раз в ${ef.everySec} с)` : ''}${ef.chance ? ` (${Math.round(ef.chance * 100)}%)` : ''}${ef.condition ? ` по цели с «${P(ef.condition).name}»` : ''}${ef.ultWindow ? ` [во время ульты ${ef.ultWindow} с]` : ''}`;
      const desc = `${trig}: ${fill(dl.desc, params)}${ef.dmg ? `, урон ${Math.round(ef.dmg * 100)}% от удара` : ''}${payloadIds.length ? `. Несёт: ${payloadIds.map((p) => P(p).name.toLowerCase() + (ef.stacks && p === ef.payload ? ` ×${ef.stacks}` : '') + (inherited.includes(p) ? ' (унасл.)' : '')).join(', ')}` : ''}.`;
      out.channels.push({
        id: e.mod.id + ':' + ef.delivery, kind: dl.continuation ? 'continuation' : 'secondary', delivery: ef.delivery, name: nm.name, key: nm.key, override: nm.override, trigger: ef.trigger,
        rateLabel: r.label, rate: r.rate, tps, targets, params, payloads: payloadIds.map((p) => ({ id: p, rate: r.rate == null ? 0.3 : r.rate * targets, src: inherited.includes(p) ? 'унаследовано' : e.mod.name, inherited: inherited.includes(p), stacks: p === ef.payload ? ef.stacks : undefined })),
        dmg: ef.dmg || 0, desc, variant, vfx: dl.vfx, src: [e.mod.name, ...inherited.map((p) => basePayloads.find((b) => b.id === p)?.src).filter(Boolean)], mod: e.mod, inherits, own,
      });
      if (ef.self) out.selfs.push({ mod: e.mod, trigger: ef.trigger, text: ef.self });
    }

    // ---- statuses
    for (const ch of out.channels) {
      if (ch.kind === 'continuation') continue;
      for (const p of ch.payloads) {
        const s = out.statuses[p.id] || (out.statuses[p.id] = { id: p.id, aps: 0, sources: [], element: P(p.id).element, self: !!P(p.id).self });
        s.aps += p.rate || 0; if (!s.sources.includes(ch.name)) s.sources.push(ch.name);
      }
    }
    for (const p of passiveStatuses) { const s = out.statuses[p.id] || (out.statuses[p.id] = { id: p.id, aps: 0, sources: [], element: P(p.id).element, self: !!P(p.id).self }); s.aps += 0.5; s.sources.push(p.src + ' (постоянно)'); }
    for (const s of Object.values(out.statuses)) s.tier = s.aps >= 6 ? 'перманентно' : s.aps >= 2 ? 'стабильно' : s.aps >= 0.5 ? 'периодически' : 'редко';

    // ---- reactions
    for (const rx of D.reactions) { const a = out.statuses[rx.a], b = out.statuses[rx.b]; if (a && b) { out.reactions.push({ ...rx, intensity: Math.min(a.aps, b.aps), via: [a, b] }); out.wow += rx.wow || 0; } }
    out.reactions.sort((x, y) => y.intensity - x.intensity);
    for (const ch of out.channels) { const st = ch.payloads.filter((p) => !P(p.id).self).length; if (ch.kind !== 'base' && ch.kind !== 'direct') out.wow += st >= 2 ? 2 : st === 1 ? 1 : 0; }
    return out;
  }

  // ---------------- RANGE: профиль дальности ----------------
  function rangeProfile(w, st = {}) {
    const mult = 1 + (st.rangePct || 0);
    const max = Math.max(0.5, (w.range || 0) * mult);
    const opt = Math.min(max, Math.max(0, (w.rangeOpt ?? w.range ?? 0) * mult * (1 + (st.rangeOptPct || 0))));
    const min = Math.max(0, Math.min(opt, (w.rangeMin || 0) + (st.rangeMinAdd || 0)));
    const falloff = Math.min(1, Math.max(0, (w.falloff ?? 1) + (st.falloffAdd || 0)));
    const closeMult = Math.min(1, Math.max(0, (w.closeMult ?? 1) + (st.closeMultAdd || 0)));
    const cls = (D.rangeClasses || []).find((c) => max <= c.max)?.name || 'дальняя';
    return { min, opt, max, falloff, closeMult, cls, melee: w.projSpeed === 0 };
  }
  function rangeMult(p, d) {
    if (d > p.max) return 0;
    if (d < p.min) return p.closeMult;
    if (d <= p.opt) return 1;
    return 1 - (1 - p.falloff) * ((d - p.opt) / Math.max(0.001, p.max - p.opt));
  }
  // полоса профиля: красный (штраф в упор) / зелёный (оптимум) / жёлтый→серый (спад) / тёмный (вне захвата)
  function rangeStrip(p, opts = {}) {
    const axis = D.config.rangeAxisMax || 60; const W_ = 600, H = 14; const x = (m) => Math.min(W_, m / axis * W_);
    const segs = [];
    if (p.min > 0) segs.push(`<rect x="0" y="0" width="${x(p.min)}" height="${H}" fill="#ff5d5d" opacity="${0.35 + 0.5 * (1 - p.closeMult)}"><title>в упор: урон ×${p.closeMult}</title></rect>`);
    segs.push(`<rect x="${x(p.min)}" y="0" width="${Math.max(2, x(p.opt) - x(p.min))}" height="${H}" fill="#3fbf5f"><title>оптимум ${p.min.toFixed(1)}–${p.opt.toFixed(1)} м: 100%</title></rect>`);
    if (p.max > p.opt) segs.push(`<defs><linearGradient id="g${opts.id || 'x'}"><stop offset="0" stop-color="#ffe14d"/><stop offset="1" stop-color="#3a3f47"/></linearGradient></defs><rect x="${x(p.opt)}" y="0" width="${x(p.max) - x(p.opt)}" height="${H}" fill="url(#g${opts.id || 'x'})"><title>спад до ×${p.falloff} на ${p.max.toFixed(1)} м</title></rect>`);
    segs.push(`<rect x="${x(p.max)}" y="0" width="${W_ - x(p.max)}" height="${H}" fill="#14171c"><title>вне захвата автонаводки</title></rect>`);
    if (opts.base) { segs.push(`<rect x="${x(opts.base.max)}" y="0" width="1.5" height="${H}" fill="#fff" opacity="0.6"><title>база: ${opts.base.max} м</title></rect>`); }
    if (opts.dist != null) segs.push(`<rect x="${x(opts.dist) - 1}" y="-3" width="2" height="${H + 6}" fill="#5fd8ff"/>`);
    const ticks = [0, 10, 20, 30, 40, 50, 60].filter((t) => t <= axis).map((t) => `<text x="${x(t)}" y="${H + 10}" font-size="8" fill="#8a93a0" text-anchor="middle">${t}</text>`).join('');
    return `<svg viewBox="-2 -3 ${W_ + 4} ${H + 16}" class="rstrip" preserveAspectRatio="none">${segs.join('')}${ticks}</svg>`;
  }

  // ---------------- DRAFT: правила выдачи модов ----------------
  function rarityWeightsAt(level) {
    const c = D.config; const dc = c.draft || {};
    const row = [...c.rarityByLevel].reverse().find((r) => r.from <= level) || c.rarityByLevel[0];
    let w = { ...row.weights };
    const peak = (dc.peakLevels || []).includes(level);
    if (peak) { // сдвиг на ступень выше: вес редкости r = вес редкости r-1
      const sh = dc.peakShift || 1; const out = {}; D.rarities.forEach((r, i) => { out[r] = i - sh >= 0 ? (w[D.rarities[i - sh]] || 0) : 0; }); w = out;
    }
    return { weights: w, peak };
  }
  // кандидаты для оффера с весами и превью того, что мод даст текущему билду
  function draftCandidates(build, res, level, banned = []) {
    const dc = D.config.draft || {}; const tags = res.tags; const { weights, peak } = rarityWeightsAt(level);
    const owned = {}; for (const x of build.mods) owned[x.id] = (owned[x.id] || 0) + (x.stacks || 1);
    const knownCh = new Set(res.channels.map((c) => c.name)); const knownRx = new Set(res.reactions.map((r) => r.name));
    const smart = !(dc.firstOfferRandom && UI.draft.picks === 0 && build.mods.length === 0);
    const c = D.config; const nPass = build.mods.filter((x) => M(x.id)?.type === 'passive').length; const nAct = build.mods.filter((x) => M(x.id)?.type === 'active').length; const hasUlt = build.mods.some((x) => M(x.id)?.type === 'ultimate');
    const out = [];
    for (const m of D.mods) {
      if (banned.includes(m.id)) continue;
      const a = affinity(tags, m); if (!a.ok) continue;
      if (m.type === 'ultimate' && (level < c.ultMinLevel || hasUlt)) continue;
      if (m.type === 'active' && nAct >= c.activeSlots && !owned[m.id]) continue;
      if (m.type === 'passive' && !owned[m.id] && nPass >= c.passiveSlots) continue;
      if (owned[m.id] && owned[m.id] >= (m.maxStacks || 1)) continue;
      const base = weights[m.rarity] || 0; if (base <= 0) continue;
      let newCh = [], newRx = [];
      if (!owned[m.id]) {
        const r1 = computeBuild({ ...build, mods: [...build.mods, { id: m.id, stacks: 1 }] });
        newCh = r1.channels.filter((x) => !knownCh.has(x.name) && x.kind !== 'direct' && x.payloads.some((p) => !P(p.id).self)).map((x) => x.name);
        newRx = r1.reactions.filter((x) => !knownRx.has(x.name)).map((x) => x.name);
      }
      const syn = smart ? 1 + (dc.wReaction || 0) * newRx.length + (dc.wComposite || 0) * newCh.length + (dc.wAffinity || 0) * (a.score - 1) : 1;
      out.push({ mod: m, a, base, syn, weight: base * syn, newCh, newRx, stack: owned[m.id] ? owned[m.id] + 1 : 0 });
    }
    const total = out.reduce((s, x) => s + x.weight, 0) || 1;
    out.forEach((x) => { x.p = x.weight / total; });
    return { list: out.sort((x, y) => y.weight - x.weight), peak, smart, total };
  }
  function drawOffer(cands, n) {
    const pool = [...cands]; const picked = [];
    while (picked.length < n && pool.length) {
      const tot = pool.reduce((s, x) => s + x.weight, 0); let r = Math.random() * tot; let i = 0;
      for (; i < pool.length; i++) { r -= pool[i].weight; if (r <= 0) break; }
      picked.push(pool[Math.min(i, pool.length - 1)]); pool.splice(Math.min(i, pool.length - 1), 1);
    }
    return picked;
  }
  const previewText = (x) => [...x.newCh.map((n) => `станет «${n}»`), ...x.newRx.map((n) => `откроет «${n}»`)].join(', ');

  // ---------------- VFX recipe ----------------
  function vfxRecipe(ch) {
    const statuses = ch.payloads.filter((p) => !P(p.id).self).map((p) => p.id);
    const cols = statuses.slice(0, 2).map(payloadColor);
    const steps = (ch.vfx || []).map((prim) => ({ prim, colors: cols.length ? cols : ['#c9d1d9'] }));
    for (const s of statuses) steps.push({ prim: P(s).vfx || 'StatusAura', colors: [payloadColor(s)], status: s });
    return steps;
  }
  const vfxChips = (steps) => steps.map((s) => `<span class="vfx" title="${esc(D.vfxPrimitives[s.prim]?.unity || s.prim)} · ${esc(D.vfxPrimitives[s.prim]?.desc || '')}">${s.colors.map((c) => `<i style="background:${c}"></i>`).join('')}${esc(s.prim)}</span>`).join('');

  // ---------------- render helpers ----------------
  const rarPill = (r) => `<span class="pill" style="background:${D.rarityColors[r]}22;color:${D.rarityColors[r]};border:1px solid ${D.rarityColors[r]}55">${esc(D.rarityNames[r] || r)}</span>`;
  const typePill = (t) => `<span class="pill type-${t}">${esc(typeName[t] || t)}</span>`;
  const plChip = (pid, extra = '') => { const p = P(pid); if (!p) return `<span class="tag">${esc(pid)}</span>`; return `<span class="tag el" style="background:${payloadColor(pid)}" title="${esc(p.desc)}">${esc(p.name)}${extra}</span>`; };
  const wtChips = (arr) => (arr || []).map((t) => `<span class="tag wt">${esc(tn(t))}</span>`).join('');
  const wowStars = (n) => `<span class="wow">${'★'.repeat(n || 0)}${'☆'.repeat(Math.max(0, 5 - (n || 0)))}</span>`;
  const rxGrad = (rx) => `linear-gradient(135deg, ${payloadColor(rx.a)}55, ${payloadColor(rx.b)}55)`;
  function effectChips(mod) {
    return (mod.effects || []).map((ef) => {
      if (ef.upgrade) return `<span class="tag" style="color:var(--warn)">апгрейд: ${esc(Object.entries(ef.upgrade).map(([k, v]) => `${k} ${v}`).join(' '))}</span>`;
      const parts = [`<span class="tag">${esc(D.triggers[ef.trigger] || ef.trigger)}${ef.every ? ' ×1/' + ef.every : ''}</span>`];
      if (ef.delivery) parts.push(`<span class="tag dl">${esc(DL(ef.delivery)?.noun || ef.delivery)}${ef.inherits ? ' ⇠' : ''}</span>`);
      if (ef.payload) parts.push(plChip(ef.payload));
      if (ef.self) parts.push(`<span class="tag muted">${esc(ef.self)}</span>`);
      return `<span class="efx">${parts.join('<span class="arr">▸</span>')}</span>`;
    }).join('');
  }

  // ================= TABS =================
  const R = {};

  R.overview = () => {
    const c = D.config; const byR = {}; const byT = {};
    for (const m of D.mods) { byR[m.rarity] = (byR[m.rarity] || 0) + 1; byT[m.type] = (byT[m.type] || 0) + 1; }
    const curve = [];
    for (let L = 1; L <= c.maxLevel; L++) {
      const row = [...c.rarityByLevel].reverse().find((r) => r.from <= L) || c.rarityByLevel[0];
      const tot = Object.values(row.weights).reduce((a, b) => a + b, 0) || 1;
      curve.push(`<div>Ур. ${L}${L >= c.ultMinLevel ? ' ★' : ''}</div><div class="stack">${D.rarities.map((r) => { const p = (row.weights[r] || 0) / tot * 100; return p ? `<i style="width:${p}%;background:${D.rarityColors[r]}">${p >= 12 ? Math.round(p) : ''}</i>` : ''; }).join('')}</div>`);
    }
    return `<h1>Как устроена система</h1>
      <div class="grid cols-3">
        <div class="card"><h3>1. Нагрузки (статусы)</h3><div>${Object.keys(D.payloads).map((p) => plChip(p)).join(' ')}</div><p class="small muted">Что накладывается на цель (или на себя). У каждой — элемент, цвет и VFX-аура.</p></div>
        <div class="card"><h3>2. Доставки</h3><div>${Object.entries(D.deliveries).map(([id, d]) => `<span class="tag dl">${esc(d.noun)}${d.continuation ? ' ↻' : ''}</span>`).join(' ')}</div><p class="small muted">Как эффект доходит до целей. Доставка с наследованием (⇠) несёт нагрузки базового канала оружия: <b>поджог + молния = огненная молния</b>. ↻ — продолжение снаряда (рикошет, пробитие, осколки): его попадания сами запускают on_hit-эффекты.</p></div>
        <div class="card"><h3>3. Носитель — оружие</h3><div>${Object.values(D.weaponKinds).map((k) => `<span class="tag wt">${esc(k.noun)}</span>`).join(' ')}</div><p class="small muted">Базовая доставка оружия задаёт частоту попаданий и <b>вариацию</b> каждой доставки: цепь от каждой дробины, взрыв на всю дугу замаха, эффект туда-и-обратно у сюрикена.</p></div>
      </div>
      <div class="grid cols-2" style="margin-top:12px">
        <div class="card"><h3>4. Реакции</h3><p class="small">Два статуса на одной цели → именованная реакция со своим VFX (${D.reactions.length} шт.). Интенсивность = min(наложений/с двух статусов): сразу видно, что реально стреляет, а что «на бумаге».</p>
          <h3>5. Имена и VFX собираются сами</h3><p class="small">Имя = прилагательное нагрузки в роде существительного доставки: «ледяная цепь», «огненно-электрический взрыв». Ручные имена — во вкладке «Синергии». VFX-рецепт = примитивы доставки, тонированные цветами элементов, + аура статуса. В Unity: один VFX Graph subgraph на примитив с экспонированными ColorA/ColorB/Radius — любая комбинация собирается без нового ассета.</p></div>
        <div class="card"><h3>Кривая редкости</h3><div class="curve">${curve.join('')}</div><p class="small muted">Пул: ${D.mods.length} модов · ${D.rarities.map((r) => `<span style="color:${D.rarityColors[r]}">${byR[r] || 0}</span>`).join(' / ')} · ${typeOrder.map((t) => `${typeName[t]} ${byT[t] || 0}`).join(', ')}</p></div>
      </div>
      <h2>Как выдаются моды в катке (зафиксировано)</h2>
      <div class="grid cols-3">
        <div class="card"><h3>1. Оружие + модуль формируют пул</h3><p class="small">Несовместимое с лоадаутом не падает вообще, совместимое с бонусом affinity весит больше. «Колода» выбирается стволом и модулем, а не списком.</p></div>
        <div class="card"><h3>2. Умный драфт</h3><p class="small">Первый оффер случайный. Дальше вес мода = вес редкости × (1 + ${D.config.draft?.wReaction ?? 3}·новых реакций + ${D.config.draft?.wComposite ?? 1.5}·новых композитов + ${D.config.draft?.wAffinity ?? 0.8}·(affinity − 1)). Игра ведёт к вау-билду, не убивая сюрприз.</p></div>
        <div class="card"><h3>3. Превью в оффере</h3><p class="small">Рядом с модом: «станет Огненной молнией, откроет Плазменную дугу». Имена и реакции генерируются, превью считается тем же движком.</p></div>
        <div class="card"><h3>4. Пики на уровнях ${(D.config.draft?.peakLevels || []).join(', ')}</h3><p class="small">Большой оффер: веса редкости сдвигаются на ступень выше. Игрок знает, что пик будет, но не знает какой.</p></div>
        <div class="card"><h3>5. Бан-жетоны</h3><p class="small">${D.config.draft?.banTokens ?? 2} жетона за катку подбираются на карте. Жетон убирает мод из твоих офферов до конца боя — агентность как ресурс, а не домашка.</p></div>
        <div class="card"><h3>Лаборатория = открытия</h3><p class="small">Исследованный мод добавляется в общий пул навсегда. Кураторства пула до катки нет.</p></div>
      </div>
      <h2>Цикл катки</h2><div class="card"><div class="tl">${D.meta.runLoop.map((p) => `<div class="ph"><span class="t">${esc(p.phase)}</span><span class="m">${esc(p.minutes)} мин</span><div class="small">${esc(p.text)}</div></div>`).join('')}</div></div>`;
  };

  const WFIELDS = [['dmg', 'Урон', 1], ['aps', 'Атак/с', 0.1], ['projectiles', 'Снарядов', 1], ['projSpeed', 'Скор. снаряда', 1], ['crit', 'Крит', 0.01], ['critMult', 'Множ. крита', 0.1], ['mag', 'Магазин', 1], ['reload', 'Перезарядка', 0.1], ['mobility', 'Мобильность', 0.05]];
  const RFIELDS = [['rangeMin', 'Мин. дист., м', 0.5], ['rangeOpt', 'Оптимум, м', 0.5], ['range', 'Макс. захват, м', 0.5], ['falloff', 'Урон на макс.', 0.05], ['closeMult', 'Урон в упор', 0.05]];
  R.weapons = () => {
    const maxDps = Math.max(...D.weapons.map((w) => derived(w).dps));
    const rows = D.weapons.map((w) => { const d = derived(w); return `<tr><td><b>${esc(w.name)}</b><div class="small muted">${esc(w.archetype)}</div></td><td>${esc(handsName[w.hands])}</td><td><span class="tag wt">${esc(D.weaponKinds[w.kind]?.noun || w.kind)}</span></td><td class="num">${fmt(d.dph, 0)}</td><td class="num">${fmt(d.hitsPerSec, 1)}</td><td class="num">${Math.round(d.critF * 100 - 100)}%</td><td class="num">${Math.round(d.uptime * 100)}%</td><td class="num"><b>${fmt(d.dps, 0)}</b><div class="bar" style="width:90px"><i style="width:${d.dps / maxDps * 100}%"></i></div></td><td class="num">${fmt(d.ttk, 1)} с</td><td class="num">${fmt(d.ttkElite, 0)} с</td><td>${d.obstacleRisk}</td></tr>`; }).join('');
    const cards = D.weapons.map((w) => { const d = derived(w); return `<div class="card">
      <div class="head"><span class="name">${esc(w.name)}</span><span class="tag">${esc(handsName[w.hands])}</span><span class="spacer"></span><button class="btn sm" data-act="w-json" data-id="${w.id}">JSON</button></div>
      <div class="row" style="gap:8px;margin:4px 0"><label class="f">Базовая доставка<select data-wkind="${w.id}">${Object.entries(D.weaponKinds).map(([k, v]) => `<option value="${k}" ${w.kind === k ? 'selected' : ''}>${esc(v.noun)}</option>`).join('')}</select></label><div>${wtChips(w.tags)}</div></div>
      <div class="row" style="gap:6px 10px;margin:8px 0">${WFIELDS.map(([k, l, step]) => `<label class="f">${l}<input type="number" step="${step}" value="${w[k] ?? 0}" data-wfield="${k}" data-id="${w.id}"></label>`).join('')}</div>
      <div class="bh">Дальность · ${esc(rangeProfile(w).cls)}${w.projSpeed === 0 ? ' · игнорирует преграды' : ''}</div>
      <div class="row" style="gap:6px 10px;margin:4px 0">${RFIELDS.map(([k, l, step]) => `<label class="f">${l}<input type="number" step="${step}" value="${w[k] ?? 0}" data-wfield="${k}" data-id="${w.id}"></label>`).join('')}</div>
      ${rangeStrip(rangeProfile(w), { id: w.id })}
      <div class="kv"><b>DPS</b><span><b>${fmt(d.dps, 0)}</b> · попаданий/с ${fmt(d.hitsPerSec, 1)} · крит ×${fmt(d.critF, 2)} · аптайм ${Math.round(d.uptime * 100)}%</span><b>TTK</b><span>${fmt(d.ttk, 1)} с / элитник ${fmt(d.ttkElite, 0)} с</span><b>Вариации</b><span class="small">${Object.entries(D.weaponVariants[w.kind] || {}).map(([k, v]) => `<div><span class="tag dl">${k === '_' ? 'любая' : esc(DL(k)?.noun || k)}</span> ${esc(v)}</div>`).join('')}</span></div>
      <label class="f" style="margin-top:6px">Фишка<input value="${esc(w.gimmick || '')}" data-wtext="gimmick" data-id="${w.id}"></label>
      <label class="f" style="margin-top:6px">Заметки<textarea rows="2" data-wtext="notes" data-id="${w.id}">${esc(w.notes || '')}</textarea></label></div>`; }).join('');
    return `<div class="row"><h1 style="margin:0">Оружие</h1><span style="flex:1"></span><button class="btn primary" data-act="w-add">+ Оружие</button></div>
      <div class="tablewrap" style="margin:10px 0 16px"><table><thead><tr><th>Оружие</th><th>Руки</th><th>Доставка</th><th class="num">Урон/выстр.</th><th class="num">Попад./с</th><th class="num">Крит</th><th class="num">Аптайм</th><th class="num">DPS</th><th class="num">TTK</th><th class="num">TTK элит</th><th>Преграды</th></tr></thead><tbody>${rows}</tbody></table></div>
      <h2>Дистанции работы</h2>
      <div class="card"><div class="small muted" style="margin-bottom:6px"><span class="tag" style="color:#ff5d5d">штраф в упор</span> <span class="tag" style="color:#3fbf5f">оптимум 100%</span> <span class="tag" style="color:#ffe14d">спад урона</span> <span class="tag">вне захвата автонаводки</span> · дистанция — единственное, чем игрок управляет при автонаводке: ближний бой игнорирует преграды, но работает в упор; лук и винтовка штрафуются в упор — клинок и щит контрят их сближением.</div>
        ${D.weapons.map((w) => { const p = rangeProfile(w); return `<div class="rrow"><div class="rname"><b>${esc(w.name)}</b><div class="small muted">${p.min ? `${p.min}–` : ''}${p.opt} м опт · до ${p.max} м · ${esc(p.cls)}</div></div>${rangeStrip(p, { id: 'all_' + w.id })}</div>`; }).join('')}</div>
      <div class="grid cols-2" style="margin-top:14px">${cards}</div>`;
  };

  R.mods = () => {
    const f = UI.modFilter;
    const list = D.mods.filter((m) => (!f.type || m.type === f.type) && (!f.rarity || m.rarity === f.rarity) && (!f.q || (m.name + ' ' + m.desc + ' ' + m.id).toLowerCase().includes(f.q.toLowerCase())))
      .sort((a, b) => typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type) || rarityRank(a.rarity) - rarityRank(b.rarity));
    const rows = list.map((m) => { const wr = m.weapon || {}; return `<tr data-act="m-json" data-id="${m.id}" style="cursor:pointer"><td>${rarPill(m.rarity)}</td><td>${typePill(m.type)}</td><td><b>${esc(m.name)}</b><div class="mono muted">${esc(m.id)}</div></td><td>${effectChips(m)}</td><td>${esc(m.desc)}${m.charge ? `<div class="small" style="color:var(--warn)">Заряд: ${esc(m.charge)}</div>` : ''}${m.cooldown ? `<div class="small muted">КД ${m.cooldown} с</div>` : ''}</td><td class="small">${wr.requires?.length ? `<div>треб: ${wr.requires.map(tn).join(wr.requiresAny ? ' / ' : ' + ')}</div>` : ''}${Object.entries(wr.bonus || {}).map(([t, v]) => `<span class="tag" style="color:var(--good)">${esc(tn(t))} +${v}</span>`).join('')}${Object.entries(wr.penalty || {}).map(([t, v]) => `<span class="tag" style="color:var(--bad)">${esc(tn(t))} ${v}</span>`).join('')}</td><td class="num">${m.maxStacks || 1}</td><td class="num">${m.power || 0}</td></tr>`; }).join('');
    return `<div class="row"><h1 style="margin:0">Модификаторы</h1><span style="flex:1"></span><button class="btn primary" data-act="m-add">+ Модификатор</button></div>
      <div class="row" style="margin:10px 0"><input placeholder="поиск…" value="${esc(f.q)}" data-mf="q" style="width:200px"><select data-mf="type"><option value="">— тип —</option>${typeOrder.map((k) => `<option value="${k}" ${f.type === k ? 'selected' : ''}>${typeName[k]}</option>`).join('')}</select><select data-mf="rarity"><option value="">— редкость —</option>${D.rarities.map((r) => `<option value="${r}" ${f.rarity === r ? 'selected' : ''}>${D.rarityNames[r]}</option>`).join('')}</select><span class="muted small">${list.length} из ${D.mods.length}</span></div>
      <div class="tablewrap"><table><thead><tr><th>Редк.</th><th>Тип</th><th>Название</th><th style="min-width:260px">Эффекты (триггер ▸ доставка ▸ нагрузка; ⇠ = наследует статусы)</th><th style="min-width:240px">Описание</th><th>Оружие</th><th class="num">Стак</th><th class="num">Сила</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="small muted">Клик по строке — JSON. Схема эффекта: { trigger, every, chance, delivery, targets/count/radius/duration, payload, stacks, inherits, condition, dmg, self, upgrade }.</p>`;
  };

  R.modules = () => {
    const rows = (D.modules || []).slice().sort((a, b) => Object.keys(D.moduleSlots).indexOf(a.slot) - Object.keys(D.moduleSlots).indexOf(b.slot) || rarityRank(a.rarity) - rarityRank(b.rarity)).map((m) => { const wr = m.weapon || {}; return `<tr data-act="md-json" data-id="${m.id}" style="cursor:pointer"><td><span class="tag wt">${esc(D.moduleSlots[m.slot] || m.slot)}</span></td><td>${rarPill(m.rarity)}</td><td><b>${esc(m.name)}</b><div class="mono muted">${esc(m.id)}</div></td><td>${effectChips(m)}${Object.keys(m.stats || {}).length ? `<div class="small muted">${esc(Object.entries(m.stats).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join(', '))}</div>` : ''}</td><td>${esc(m.desc)}</td><td class="small">${wr.requires?.length ? `<div>треб: ${wr.requires.map(tn).join(wr.requiresAny ? ' / ' : ' + ')}</div>` : ''}${Object.entries(wr.bonus || {}).map(([t, v]) => `<span class="tag" style="color:var(--good)">${esc(tn(t))} +${v}</span>`).join('')}${Object.entries(wr.penalty || {}).map(([t, v]) => `<span class="tag" style="color:var(--bad)">${esc(tn(t))} ${v}</span>`).join('')}</td><td class="num">${m.power || 0}</td></tr>`; }).join('');
    return `<div class="row"><h1 style="margin:0">Модули оружия</h1><span style="flex:1"></span><button class="btn" data-act="dict-json" data-k="moduleSlots">Типы слотов</button><button class="btn primary" data-act="md-add">+ Модуль</button></div>
      <p class="small muted">Модуль вставляется в слот оружия до катки (мета) и работает по той же схеме эффектов, что и моды: его статусы наследуются доставками, участвуют в реакциях и авто-именах. Слоты у оружия: ${D.weapons.map((w) => `<b>${esc(w.name)}</b> — ${(w.moduleSlots || []).map((s) => D.moduleSlots[s] || s).join(', ')}`).join('; ')}.</p>
      <div class="tablewrap"><table><thead><tr><th>Слот</th><th>Редк.</th><th>Модуль</th><th style="min-width:260px">Эффекты</th><th style="min-width:220px">Описание</th><th>Оружие</th><th class="num">Сила</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  };

  R.synergy = () => {
    const statusIds = Object.keys(D.payloads);
    const rxMap = {}; D.reactions.forEach((r, i) => { rxMap[r.a + '|' + r.b] = i; rxMap[r.b + '|' + r.a] = i; });
    const rxTable = `<div class="tablewrap"><table class="rx"><thead><tr><th></th>${statusIds.map((s) => `<th>${plChip(s)}</th>`).join('')}</tr></thead><tbody>${statusIds.map((a) => `<tr><th>${plChip(a)}</th>${statusIds.map((b) => {
      if (a === b) return '<td class="dim"></td>';
      const i = rxMap[a + '|' + b];
      if (i === undefined) return `<td class="empty" data-act="rx-new" data-a="${a}" data-b="${b}" title="создать реакцию">+</td>`;
      const r = D.reactions[i];
      return `<td data-act="rx-json" data-i="${i}" style="background:${rxGrad(r)}" title="${esc(r.desc)}"><b>${esc(r.name)}</b><div class="small">${wowStars(r.wow)}</div><div class="small muted">${(r.vfx || []).join(' + ')}</div></td>`;
    }).join('')}</tr>`).join('')}</tbody></table></div>`;

    const nonSelf = statusIds.filter((s) => !P(s).self);
    const nouns = [...Object.entries(D.weaponKinds).map(([id, k]) => ({ id, def: k, base: true })), ...Object.entries(D.deliveries).map(([id, d]) => ({ id, def: d }))];
    const compTable = `<div class="tablewrap"><table class="comp"><thead><tr><th>Доставка \\ статус</th>${nonSelf.map((s) => `<th>${plChip(s)}</th>`).join('')}</tr></thead><tbody>${nouns.map((n) => `<tr><th>${n.base ? '<span class="tag wt">оружие</span> ' : ''}${esc(n.def.noun)}<div class="small muted">${(n.def.vfx || []).join('+')}</div></th>${nonSelf.map((s) => { const nm = compositeName(n.def, [s], n.id); return `<td data-act="ov-edit" data-key="${nm.key}" style="cursor:pointer;border-left:3px solid ${payloadColor(s)}"><b>${esc(nm.name)}</b>${nm.override ? ' <span class="tag" style="color:var(--warn)">ручное</span>' : ''}${nm.override?.desc ? `<div class="small muted">${esc(nm.override.desc)}</div>` : ''}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;

    const s = UI.syn; const dlDef = DL(s.delivery) || DL('chain'); if (!DL(s.delivery)) s.delivery = 'chain'; if (!P(s.payload)) s.payload = nonSelf[0];
    const varCards = D.weapons.filter((w) => w.hands !== 'off').map((w) => {
      const kind = D.weaponKinds[w.kind]; const d = derived(w);
      const nm = compositeName(dlDef, [s.payload], s.delivery);
      const variant = (D.weaponVariants[w.kind] || {})[s.delivery] || (D.weaponVariants[w.kind] || {})._ || '—';
      const t = ['burst', 'wave', 'zone', 'pull', 'trap'].includes(s.delivery) ? densityTargets(dlDef.radius) : (dlDef.targets || dlDef.count || 1);
      return `<div class="card tight"><div class="head"><span class="name">${esc(w.name)}</span><span class="tag wt">${esc(kind.noun)}</span></div>
        <div><b style="color:${payloadColor(s.payload)}">${esc(nm.name)}</b></div><div class="small">${esc(variant)}</div>
        <div class="small muted">≈ ${fmt(d.hitsPerSec, 1)} попад./с → до ${fmt(d.hitsPerSec * t, 1)} наложений/с при триггере «при попадании»</div>
        <div style="margin-top:4px">${vfxChips([...kind.vfx.map((p) => ({ prim: p, colors: [payloadColor(s.payload)] })), ...dlDef.vfx.map((p) => ({ prim: p, colors: [payloadColor(s.payload)] })), { prim: P(s.payload).vfx, colors: [payloadColor(s.payload)] }])}</div></div>`;
    }).join('');

    const modA = M(s.modA) || D.mods.find((m) => (m.effects || []).length);
    const b0 = { main: UI.builder.main, offhand: UI.builder.offhand, mods: [{ id: modA.id, stacks: 1 }] };
    const r0 = computeBuild(b0);
    const baseNames = new Set(r0.channels.map((c) => c.name)); const baseRx = new Set(r0.reactions.map((r) => r.name));
    const pairs = [];
    const candidates = [...D.mods.map((m) => ({ m, isModule: false })), ...(D.modules || []).map((m) => ({ m, isModule: true }))];
    for (const { m: mb, isModule } of candidates) {
      if (mb.id === modA.id) continue;
      const r1 = computeBuild(isModule ? { ...b0, modules: [mb.id] } : { ...b0, mods: [...b0.mods, { id: mb.id, stacks: 1 }] });
      const newCh = r1.channels.filter((c) => !baseNames.has(c.name) && c.payloads.some((p) => !P(p.id).self) && c.kind !== 'direct');
      const newRx = r1.reactions.filter((r) => !baseRx.has(r.name));
      if (newCh.length || newRx.length) pairs.push({ mod: mb, isModule, newCh, newRx, aff: affinity(r1.tags, mb) });
    }
    pairs.sort((x, y) => (y.newRx.length * 3 + y.newCh.length) - (x.newRx.length * 3 + x.newCh.length));
    const pairList = pairs.map((p) => `<div class="pair" data-act="to-builder-pair" data-a="${modA.id}" data-b="${p.mod.id}" data-module="${p.isModule ? p.mod.slot : ''}" title="открыть пару в конструкторе">
      <div style="min-width:200px">${rarPill(p.mod.rarity)} <b>${esc(p.mod.name)}</b>${p.isModule ? ` <span class="tag wt">модуль · ${esc(D.moduleSlots[p.mod.slot] || p.mod.slot)}</span>` : ''}${p.aff.ok ? '' : ' <span class="err" title="несовместим с текущим оружием">✕</span>'}</div>
      <div class="small" style="flex:1">${p.newRx.map((r) => `<span class="tag" style="background:${rxGrad(r)};color:#fff">⚡ ${esc(r.name)}</span>`).join('')}${p.newCh.map((c) => `<span class="tag" style="color:var(--accent2)">${esc(c.name)}</span>`).join('')}</div></div>`).join('') || '<div class="muted small">Ни с чем не комбинируется напрямую (статы/утилити).</div>';

    return `<h1>Каталог синергий</h1>
      <p class="small muted">Всё вычисляется из данных. Клик по ячейке — редактировать реакцию или задать ручное имя эффекта.</p>
      <h2>Реакции статусов (два статуса на одной цели)</h2>${rxTable}
      <h2>Доставка × статус → авто-имя эффекта</h2>${compTable}
      <h2>Вариации по оружию</h2>
      <div class="row" style="margin-bottom:8px"><label class="f">Доставка<select data-syn="delivery">${Object.entries(D.deliveries).map(([id, d]) => `<option value="${id}" ${s.delivery === id ? 'selected' : ''}>${esc(d.noun)}</option>`).join('')}</select></label><label class="f">Статус<select data-syn="payload">${nonSelf.map((p) => `<option value="${p}" ${s.payload === p ? 'selected' : ''}>${esc(P(p).name)}</option>`).join('')}</select></label></div>
      <div class="grid cols-4">${varCards}</div>
      <h2>С чем комбинируется мод</h2>
      <div class="row" style="margin-bottom:8px"><label class="f">Мод<select data-syn="modA">${D.mods.filter((m) => (m.effects || []).length).sort((a, b) => a.name.localeCompare(b.name)).map((m) => `<option value="${m.id}" ${modA.id === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label><span class="small muted">на лоадауте из конструктора: ${esc(W(UI.builder.main)?.name)}${UI.builder.offhand ? ' + ' + esc(W(UI.builder.offhand)?.name) : ''}. Клик по строке — открыть пару в конструкторе.</span></div>
      <div class="card tight">${pairList}</div>`;
  };

  // ----- BUILDER
  function builderModules() {
    const b = UI.builder; const out = [];
    const w = W(b.main); const o = b.offhand ? W(b.offhand) : null;
    for (const s of (w?.moduleSlots || [])) { const id = (b.modules || {})[b.main + ':' + s]; if (id && MD(id)) out.push(id); }
    for (const s of (o?.moduleSlots || [])) { const id = (b.modules || {})[b.offhand + ':' + s]; if (id && MD(id)) out.push(id); }
    return out;
  }
  function builderBuild() { const b = UI.builder; return { main: b.main, offhand: b.offhand, modules: builderModules(), mods: [...b.passives, ...b.actives.filter(Boolean).map((id) => ({ id, stacks: 1 })), ...(b.ult ? [{ id: b.ult, stacks: 1 }] : [])] }; }
  function inBuild(id) { return builderBuild().mods.some((x) => x.id === id); }
  function addMod(id) {
    const m = M(id); if (!m) return; const b = UI.builder; const c = D.config;
    if (inBuild(id)) return removeMod(id);
    if (m.type === 'passive') { if (b.passives.length < c.passiveSlots) b.passives.push({ id, stacks: 1 }); }
    else if (m.type === 'active') { if (b.actives.filter(Boolean).length < c.activeSlots) b.actives.push(id); }
    else b.ult = id;
  }
  function removeMod(id) { const b = UI.builder; b.passives = b.passives.filter((x) => x.id !== id); b.actives = b.actives.filter((x) => x && x !== id); if (b.ult === id) b.ult = null; }

  function graphSvg(res) {
    const W_ = 1100, colX = [16, 240, 620, 860], nodeW = [200, 340, 200, 220], H = 32, GAP = 10;
    const cols = [[], [], [], []];
    cols[0].push({ id: 'w', label: res.main.name + (res.off ? ' + ' + res.off.name : ''), color: '#5fd8ff', sub: `${fmt(res.totalHits, 1)} попад./с` });
    for (const ch of res.channels) cols[1].push({ id: ch.id, label: ch.name, color: ch.payloads.length ? payloadColor(ch.payloads[0].id) : '#8a93a0', sub: ch.rateLabel + (ch.targets > 1 ? ` × ${ch.targets}` : ''), dim: ch.kind === 'direct' });
    for (const s of Object.values(res.statuses)) cols[2].push({ id: 's:' + s.id, label: P(s.id).name, color: payloadColor(s.id), sub: `${fmt(s.aps, 1)}/с · ${s.tier}` });
    for (const r of res.reactions) cols[3].push({ id: 'r:' + r.name, label: r.name, color: payloadColor(r.a), color2: payloadColor(r.b), sub: `интенсивность ${fmt(r.intensity, 1)}` });
    const maxN = Math.max(...cols.map((c) => c.length), 1); const height = maxN * (H + GAP) + 10;
    const pos = {};
    cols.forEach((c, ci) => { const total = c.length * (H + GAP) - GAP; const y0 = (height - total) / 2; c.forEach((n, i) => { pos[n.id] = { x: colX[ci], y: y0 + i * (H + GAP), w: nodeW[ci] }; }); });
    const edges = [];
    for (const ch of res.channels) { edges.push(['w', ch.id, '#3a4250']); for (const p of ch.payloads) if (res.statuses[p.id]) edges.push([ch.id, 's:' + p.id, payloadColor(p.id)]); }
    for (const r of res.reactions) { edges.push(['s:' + r.a, 'r:' + r.name, payloadColor(r.a)]); edges.push(['s:' + r.b, 'r:' + r.name, payloadColor(r.b)]); }
    const path = ([a, b, c]) => { const A = pos[a], B = pos[b]; if (!A || !B) return ''; const x1 = A.x + A.w, y1 = A.y + H / 2, x2 = B.x, y2 = B.y + H / 2, mx = (x1 + x2) / 2; return `<path d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}" stroke="${c}" />`; };
    const node = (n) => { const p = pos[n.id]; return `<g opacity="${n.dim ? 0.55 : 1}"><rect x="${p.x}" y="${p.y}" width="${p.w}" height="${H}" rx="6" fill="#15181d" stroke="${n.color}" /><rect x="${p.x}" y="${p.y}" width="4" height="${H}" rx="2" fill="${n.color}" />${n.color2 ? `<rect x="${p.x + p.w - 4}" y="${p.y}" width="4" height="${H}" rx="2" fill="${n.color2}" />` : ''}<text x="${p.x + 10}" y="${p.y + 13}" font-size="11" font-weight="600" fill="#e6e9ee">${esc(n.label)}</text><text x="${p.x + 10}" y="${p.y + 25}" font-size="9" fill="#8a93a0">${esc(n.sub || '')}</text></g>`; };
    const heads = ['Носитель', 'Каналы эффектов', 'Статусы на цели', 'Реакции'];
    return `<svg viewBox="0 0 ${W_} ${height + 20}" class="graph" preserveAspectRatio="xMinYMin meet">${heads.map((h, i) => `<text x="${colX[i]}" y="11" font-size="10" fill="#8a93a0" letter-spacing="1">${h.toUpperCase()}</text>`).join('')}<g transform="translate(0,18)"><g fill="none" stroke-width="1.5" opacity="0.7">${edges.map(path).join('')}</g>${cols.flat().map(node).join('')}</g></svg>`;
  }

  R.builder = () => {
    const b = UI.builder; const c = D.config;
    if (!W(b.main) || W(b.main).hands === 'off') b.main = D.weapons.find((w) => w.hands !== 'off')?.id;
    const canOff = W(b.main)?.hands === '1h'; if (!canOff) b.offhand = '';
    const build = builderBuild(); const res = computeBuild(build); const tags = res.tags;

    const lf = UI.lib;
    const lib = D.mods.filter((m) => (!lf.type || m.type === lf.type) && (!lf.q || (m.name + ' ' + m.desc).toLowerCase().includes(lf.q.toLowerCase())))
      .sort((a, x) => typeOrder.indexOf(a.type) - typeOrder.indexOf(x.type) || rarityRank(a.rarity) - rarityRank(x.rarity) || a.name.localeCompare(x.name));
    let lastT = '';
    const libHtml = lib.map((m) => { const a = affinity(tags, m); const on = inBuild(m.id); let g = ''; if (m.type !== lastT) { lastT = m.type; g = `<div class="lib-g">${typeName[m.type]}</div>`; }
      return g + `<div class="lib-i ${a.ok ? '' : 'dis'} ${on ? 'on' : ''}" data-act="lib-toggle" data-id="${m.id}" title="${esc(a.ok ? (a.reasons.join(', ') || 'нейтрально к оружию') : a.reasons[0])}"><i class="rd" style="background:${D.rarityColors[m.rarity]}"></i><div style="flex:1;min-width:0"><div class="nm">${esc(m.name)} ${on ? '<span class="chk">✓</span>' : ''}</div><div class="ef">${effectChips(m) || `<span class="muted small">${esc(m.desc)}</span>`}</div></div><span class="aff" style="opacity:${a.ok ? 1 : 0.5}">${a.ok ? (a.score === 1 ? '' : a.score) : '✕'}</span></div>`; }).join('');

    const entry = (x, kind) => { const m = M(x.id); if (!m) return ''; const a = affinity(tags, m); return `<div class="be" style="border-left-color:${D.rarityColors[m.rarity]}"><div style="flex:1;min-width:0"><div class="nm">${esc(m.name)} <span class="muted small">${a.ok ? (a.score !== 1 ? 'aff ' + a.score : '') : '<span class="err">несовместим</span>'}</span></div><div class="ef">${effectChips(m)}</div></div>${kind === 'passive' && (m.maxStacks || 1) > 1 ? `<input type="number" min="1" max="${m.maxStacks}" value="${x.stacks || 1}" data-stack="${m.id}" title="стаки" style="width:46px">` : ''}<button class="btn sm ghost" data-act="rm" data-id="${m.id}">✕</button></div>`; };
    const buildHtml = `
      <div class="card">
        <div class="row" style="gap:8px"><label class="f">Основное<select data-bsel="main">${D.weapons.filter((w) => w.hands !== 'off').map((w) => `<option value="${w.id}" ${b.main === w.id ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}</select></label>
        <label class="f">Левая рука<select data-bsel="offhand" ${canOff ? '' : 'disabled'}><option value="">— нет —</option>${D.weapons.filter((w) => w.hands === 'off').map((w) => `<option value="${w.id}" ${b.offhand === w.id ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}</select></label>
        <span style="flex:1"></span><button class="btn sm" data-act="build-clear">Очистить</button></div>
        <div class="small muted" style="margin-top:6px">${wtChips([...tags])}</div>
        <div class="bh" style="margin-top:8px">Модули оружия <span class="muted">(мета, до катки)</span></div>
        ${[W(b.main), b.offhand ? W(b.offhand) : null].filter(Boolean).map((w) => (w.moduleSlots || []).map((slot) => {
          const key = w.id + ':' + slot; const cur = (b.modules || {})[key] || ''; const curM = MD(cur);
          const opts = (D.modules || []).filter((m) => m.slot === slot).map((m) => { const a = affinity(loadoutTags(w.id, ''), m); return `<option value="${m.id}" ${cur === m.id ? 'selected' : ''} ${a.ok ? '' : 'disabled'}>${esc(m.name)}${a.ok ? (a.score !== 1 ? ` (aff ${a.score})` : '') : ' ✕'}</option>`; }).join('');
          return `<div class="mslot"><label class="f">${esc(w.name)} · ${esc(D.moduleSlots[slot] || slot)}<select data-msel="${key}"><option value="">— пусто —</option>${opts}</select></label>${curM ? `<div class="ef">${effectChips(curM) || `<span class="muted small">${esc(curM.desc)}</span>`}</div>` : ''}</div>`;
        }).join('')).join('')}
      </div>
      <div class="bsec"><div class="bh">Пассивные <span class="muted">${b.passives.length}/${c.passiveSlots}</span></div>${b.passives.map((x) => entry(x, 'passive')).join('') || '<div class="empty">кликни мод в библиотеке слева</div>'}</div>
      <div class="bsec"><div class="bh">Активные <span class="muted">${b.actives.filter(Boolean).length}/${c.activeSlots}</span></div>${b.actives.filter(Boolean).map((id) => entry({ id }, 'active')).join('') || '<div class="empty">—</div>'}</div>
      <div class="bsec"><div class="bh">Ультимейт</div>${b.ult ? entry({ id: b.ult }, 'ultimate') : '<div class="empty">—</div>'}</div>
      <div class="row" style="margin-top:10px"><input placeholder="название билда" value="${esc(b.name)}" data-bname style="flex:1"><button class="btn primary sm" data-act="build-save">Сохранить</button></div>
      ${builds.length ? `<div class="bsec"><div class="bh">Сохранённые</div>${builds.map((sb, i) => { const r2 = computeBuild(sb.build); return `<div class="be" style="border-left-color:var(--line)"><div style="flex:1"><b>${esc(sb.name)}</b> <span class="small muted">${esc(W(sb.build.main)?.name)} · ${r2.reactions.length} реакц. · ★${r2.wow}</span></div><button class="btn sm" data-act="build-load" data-i="${i}">Открыть</button><button class="btn sm ghost" data-act="build-del" data-i="${i}">✕</button></div>`; }).join('')}</div>` : ''}`;

    const statusList = Object.values(res.statuses).sort((x, y) => y.aps - x.aps).map((s) => `<div class="st"><span class="tag el" style="background:${payloadColor(s.id)}">${esc(P(s.id).name)}</span><div class="bar" style="flex:1"><i style="width:${Math.min(100, s.aps / 8 * 100)}%;background:${payloadColor(s.id)}"></i></div><span class="mono small">${fmt(s.aps, 1)}/с</span><span class="small muted" style="width:82px">${s.tier}</span></div>`).join('') || '<div class="muted small">нет статусов — добавь нагрузку (Термоядро, Криокапсула…)</div>';
    const rxList = res.reactions.map((r) => `<div class="rx-card" style="background:${rxGrad(r)}"><div class="row" style="gap:6px"><b>${esc(r.name)}</b>${wowStars(r.wow)}<span style="flex:1"></span><span class="mono small" title="интенсивность = min(наложений/с)">${fmt(r.intensity, 1)}/с</span></div><div class="small">${esc(r.desc)}</div><div class="small muted" style="margin-top:3px">${plChip(r.a)} + ${plChip(r.b)} · VFX: ${(r.vfx || []).join(' + ')}</div></div>`).join('') || '<div class="muted small">реакций нет — нужны два разных статуса на цели</div>';
    const warn = res.warnings.map((w) => `<div class="syn warn small">⚠ ${esc(w)}</div>`).join('');
    const chCards = res.channels.map((ch) => `<div class="ch ${ch.kind}"><div class="row" style="gap:6px"><b style="font-size:14px">${esc(ch.name)}</b>${ch.override ? '<span class="tag" style="color:var(--warn)">ручное имя</span>' : ''}<span class="tag">${esc(ch.kind === 'base' ? 'базовый канал' : ch.kind === 'continuation' ? 'продолжение снаряда' : ch.kind === 'direct' ? 'прямая нагрузка' : DL(ch.delivery)?.noun)}</span><span style="flex:1"></span><span class="mono small">${esc(ch.rateLabel)}${ch.targets > 1 ? ` × ${ch.targets} целей` : ''}</span></div>
      <div class="small" style="margin:3px 0">${esc(ch.desc)}</div>
      ${ch.variant ? `<div class="small" style="color:var(--accent2)">↳ на ${esc(res.main.name)}: ${esc(ch.variant)}</div>` : ''}
      <div style="margin-top:4px">${ch.payloads.map((p) => plChip(p.id, p.inherited ? ' ⇠' : '')).join(' ')} <span class="muted small">из: ${esc(ch.src.join(', '))}</span></div>
      <div style="margin-top:4px">${vfxChips(vfxRecipe(ch))} ${ch.key ? `<button class="btn sm ghost" data-act="ov-edit" data-key="${ch.key}">✎ имя</button>` : ''}</div></div>`).join('');
    const selfs = res.selfs.map((s) => `<span class="tag">${esc(D.triggers[s.trigger])}: ${esc(s.text)} <span class="muted">(${esc(s.mod.name)})</span></span>`).join(' ');

    return `<div class="three">
      <div class="col lib"><div class="lib-top"><input placeholder="поиск в библиотеке…" value="${esc(lf.q)}" data-lib="q"><select data-lib="type"><option value="">все</option>${typeOrder.map((t) => `<option value="${t}" ${lf.type === t ? 'selected' : ''}>${typeName[t]}</option>`).join('')}</select></div><div class="lib-list">${libHtml}</div></div>
      <div class="col">${buildHtml}</div>
      <div class="col">
        <div class="card"><div class="row"><h3 style="margin:0">Итог</h3><span style="flex:1"></span><span class="wow">★ ${res.wow}</span><span class="tag">сила ${res.power}</span><span class="tag">DPS ${fmt(res.base?.dps, 0)}</span><span class="tag">${fmt(res.totalHits, 1)} попад./с</span></div>${warn}
          ${(() => { const p = rangeProfile(res.main, res.stats); const p0 = rangeProfile(res.main); const dist = Math.min(D.config.rangeAxisMax || 60, UI.builder.dist ?? p.opt); const m = rangeMult(p, dist); const off = res.off ? rangeProfile(res.off, res.stats) : null;
            return `<h3>Дальность · ${esc(p.cls)}</h3>${rangeStrip(p, { id: 'b', base: p0, dist })}
            <div class="row" style="gap:8px;margin-top:4px"><input type="range" min="0" max="${D.config.rangeAxisMax || 60}" step="0.5" value="${dist}" data-dist style="flex:1"><span class="mono small" style="width:190px">${dist} м → урон ×${m.toFixed(2)} · DPS ${fmt((res.base?.dps || 0) * m, 0)}</span></div>
            <div class="small muted">опт ${p.min ? p.min.toFixed(1) + '–' : ''}${p.opt.toFixed(1)} м · захват ${p.max.toFixed(1)} м${p.max !== p0.max || p.opt !== p0.opt || p.min !== p0.min ? ` (база ${p0.min ? p0.min + '–' : ''}${p0.opt}/${p0.max})` : ''} · спад ×${p.falloff.toFixed(2)}${p.min ? ` · в упор ×${p.closeMult.toFixed(2)}` : ''}${off ? ` · щит: ${off.max.toFixed(1)} м` : ''}</div>`; })()}
          <h3>Статусы на целях</h3>${statusList}
          <h3>Реакции (${res.reactions.length})</h3>${rxList}
          ${selfs ? `<h3>Утилити</h3><div>${selfs}</div>` : ''}</div>
      </div>
    </div>
    ${draftPanel(build, res)}
    <h2>Поток эффектов</h2><div class="card" style="padding:6px">${graphSvg(res)}</div>
    <h2>Каналы эффектов (${res.channels.length}) — что летит, как называется, из каких VFX собирается</h2>
    <div class="grid cols-2">${chCards}</div>`;
  };

  function draftPanel(build, res) {
    const d = UI.draft; const dc = D.config.draft || {}; const c = D.config;
    d.level = Math.max(1, Math.min(c.maxLevel, d.level || 1));
    const cands = draftCandidates(build, res, d.level, d.banned);
    const rw = rarityWeightsAt(d.level);
    const offer = (d.offer || []).map((id) => cands.list.find((x) => x.mod.id === id)).filter(Boolean);
    const offerCards = offer.length ? offer.map((x) => `<div class="offer" style="border-color:${D.rarityColors[x.mod.rarity]}">
        <div class="row" style="gap:6px">${rarPill(x.mod.rarity)}${typePill(x.mod.type)}<b style="font-size:14px">${esc(x.mod.name)}</b>${x.stack ? `<span class="tag">стак ${x.stack}</span>` : ''}<span style="flex:1"></span><span class="mono small" title="вероятность попасть в оффер">${(x.p * 100).toFixed(1)}%</span></div>
        <div class="ef" style="margin:3px 0">${effectChips(x.mod)}</div><div class="small muted">${esc(x.mod.desc)}</div>
        ${previewText(x) ? `<div class="preview">→ ${esc(previewText(x))}</div>` : '<div class="small muted">→ без новых синергий</div>'}
        <div class="small muted" style="margin-top:3px">вес: редкость ${x.base} × синергия ${x.syn.toFixed(1)}${x.a.score !== 1 ? ` (aff ${x.a.score})` : ''}</div>
        <div class="row" style="margin-top:6px;gap:6px"><button class="btn primary sm" data-act="draft-take" data-id="${x.mod.id}">Взять</button><button class="btn sm" data-act="draft-ban" data-id="${x.mod.id}" ${d.banned.length >= (dc.banTokens || 0) ? 'disabled' : ''}>Бан</button></div></div>`).join('')
      : '<div class="empty" style="flex:1">нажми «Сгенерировать оффер»</div>';
    const top = cands.list.slice(0, 12).map((x) => `<div class="pair" style="cursor:default"><div style="min-width:180px">${rarPill(x.mod.rarity)} <b>${esc(x.mod.name)}</b></div><div class="mono small" style="width:56px">${(x.p * 100).toFixed(1)}%</div><div class="small muted" style="flex:1">${esc(previewText(x)) || '—'}</div></div>`).join('');
    return `<h2>Драфт: что предложит игра на этом уровне</h2>
      <div class="card">
        <div class="row">
          <label class="f">Уровень<input type="number" min="1" max="${c.maxLevel}" value="${d.level}" data-draft-level style="width:64px"></label>
          <div class="small">${rw.peak ? '<span class="tag" style="color:var(--warn)">★ пик — редкость на ступень выше</span>' : ''}${!cands.smart ? '<span class="tag">первый оффер — без умных весов</span>' : '<span class="tag" style="color:var(--accent2)">умный драфт</span>'} <span class="muted">веса редкости: ${D.rarities.map((r) => `<span style="color:${D.rarityColors[r]}">${rw.weights[r] || 0}</span>`).join(' / ')} · кандидатов ${cands.list.length}</span></div>
          <span style="flex:1"></span>
          <button class="btn primary" data-act="draft-gen">Сгенерировать оффер</button><button class="btn sm" data-act="draft-reset">Сброс (ур. 1)</button>
        </div>
        <div class="offers">${offerCards}</div>
        <div class="row" style="margin-top:8px"><span class="small muted">Бан-жетоны: ${d.banned.length}/${dc.banTokens || 0}</span>${d.banned.map((id) => `<span class="tag" style="color:var(--bad)">${esc(M(id)?.name || id)} <a data-act="draft-unban" data-id="${id}" style="cursor:pointer">✕</a></span>`).join('')}</div>
        <details style="margin-top:8px"><summary class="small muted" style="cursor:pointer">Топ-12 самых вероятных кандидатов</summary><div style="margin-top:6px">${top}</div></details>
      </div>`;
  }

  R.meta = () => {
    const mt = D.meta; const cost = (c) => Object.entries(c || {}).map(([k, v]) => `${v} ${esc(mt.currencies.find((x) => x.id === k)?.name || k)}`).join(', ') || 'бесплатно';
    return `<div class="row"><h1 style="margin:0">Мета-прогрессия</h1><span style="flex:1"></span><button class="btn" data-act="meta-json">JSON</button></div>
      <h2>Принципы</h2><div class="card">${mt.principles.map((p) => `<p>• ${esc(p)}</p>`).join('')}</div>
      <h2>Валюты</h2><div class="tablewrap"><table><thead><tr><th>Валюта</th><th>Источник</th><th>Куда</th></tr></thead><tbody>${mt.currencies.map((c) => `<tr><td><b>${esc(c.name)}</b></td><td>${esc(c.source)}</td><td>${esc(c.sink)}</td></tr>`).join('')}</tbody></table></div>
      <h2>Постройки</h2><div class="grid cols-2">${mt.buildings.map((bd, i) => `<div class="card"><div class="head"><span class="name">${esc(bd.name)}</span><span class="spacer"></span><button class="btn sm" data-act="bld-json" data-i="${i}">JSON</button></div><div class="small muted">${esc(bd.desc)}</div><table style="margin-top:6px"><tbody>${bd.levels.map((l, j) => `<tr><td class="num" style="width:36px">L${j + 1}</td><td class="small mono muted" style="width:200px">${cost(l.cost)}</td><td class="small">${esc(l.unlock)}</td></tr>`).join('')}</tbody></table></div>`).join('')}</div>
      <h2>Тиры оружия</h2><div class="tablewrap"><table><thead><tr><th>Тир</th><th>Стоимость</th><th>Бонус</th></tr></thead><tbody>${mt.weaponTiers.map((t) => `<tr><td>T${t.tier}</td><td class="mono small">${cost(t.cost)}</td><td>${esc(t.bonus)}</td></tr>`).join('')}</tbody></table></div>
      <h2>Артефакт: реролл или эвакуация</h2><div class="card"><table><thead><tr><th>Редкость</th><th>Эссенция</th><th>Реролл даёт</th><th>Модов в пуле</th></tr></thead><tbody>${D.rarities.map((r) => `<tr><td>${rarPill(r)}</td><td class="num">${D.config.artifactEssence[r] ?? '—'}</td><td>случайный мод этой редкости, совместимый с оружием</td><td class="num">${D.mods.filter((m) => m.rarity === r).length}</td></tr>`).join('')}</tbody></table></div>`;
  };

  function unityExport() {
    const nonSelf = Object.keys(D.payloads).filter((p) => !P(p).self);
    const composites = [];
    const nouns = [...Object.entries(D.weaponKinds).map(([id, k]) => ({ id, def: k })), ...Object.entries(D.deliveries).map(([id, d]) => ({ id, def: d }))];
    for (const n of nouns) {
      composites.push({ id: n.id, delivery: n.id, payloads: [], name: cap(n.def.noun), vfx: n.def.vfx.map((p) => ({ prim: p, colors: ['#c9d1d9'] })) });
      for (const a of nonSelf) {
        composites.push({ id: `${n.id}+${a}`, delivery: n.id, payloads: [a], name: compositeName(n.def, [a], n.id).name, vfx: [...n.def.vfx.map((p) => ({ prim: p, colors: [payloadColor(a)] })), { prim: P(a).vfx, colors: [payloadColor(a)] }] });
        for (const b of nonSelf) if (a < b) composites.push({ id: `${n.id}+${a},${b}`, delivery: n.id, payloads: [a, b], name: compositeName(n.def, [a, b], n.id).name, vfx: [...n.def.vfx.map((p) => ({ prim: p, colors: [payloadColor(a), payloadColor(b)] })), { prim: P(a).vfx, colors: [payloadColor(a)] }, { prim: P(b).vfx, colors: [payloadColor(b)] }] });
      }
    }
    return { version: D.version, elements: D.elements, payloads: D.payloads, deliveries: D.deliveries, weaponKinds: D.weaponKinds, weaponVariants: D.weaponVariants, vfxPrimitives: D.vfxPrimitives, reactions: D.reactions, composites,
      weapons: D.weapons.map((w) => ({ id: w.id, name: w.name, kind: w.kind, hands: w.hands, dmg: w.dmg, aps: w.aps, projectiles: w.projectiles, projSpeed: w.projSpeed, crit: w.crit, critMult: w.critMult, mag: w.mag, reload: w.reload, tags: w.tags, moduleSlots: w.moduleSlots || [],
        range: { min: w.rangeMin || 0, optimal: w.rangeOpt ?? w.range, max: w.range, falloffMult: w.falloff ?? 1, closeMult: w.closeMult ?? 1, ignoresObstacles: w.projSpeed === 0 } })),
      rangeStats: ['rangePct', 'rangeOptPct', 'rangeMinAdd', 'falloffAdd', 'closeMultAdd'],
      mods: D.mods.map((m) => ({ id: m.id, name: m.name, type: m.type, rarity: m.rarity, cooldown: m.cooldown, charge: m.charge, maxStacks: m.maxStacks, stats: m.stats || {}, effects: m.effects || [], weapon: m.weapon || {} })),
      moduleSlots: D.moduleSlots, modules: (D.modules || []).map((m) => ({ id: m.id, name: m.name, slot: m.slot, rarity: m.rarity, stats: m.stats || {}, effects: m.effects || [], weapon: m.weapon || {} })) };
  }
  R.data = () => {
    const c = D.config;
    return `<h1>Данные и настройки</h1>
      <div class="grid cols-2">
        <div class="card"><h3>Конфиг</h3><div class="row">${[['maxLevel', 'Макс. ур.'], ['offersPerLevel', 'Офферов'], ['passiveSlots', 'Пассивок'], ['activeSlots', 'Активов'], ['ultMinLevel', 'Ульта с ур.'], ['enemyHp', 'HP врага'], ['eliteHp', 'HP элитн.'], ['density', 'Плотность']].map(([k, l]) => `<label class="f">${l}<input type="number" value="${c[k]}" data-cfg="${k}"></label>`).join('')}</div>
          <h3>Эссенция за артефакт</h3><div class="row">${D.rarities.map((r) => `<label class="f">${D.rarityNames[r]}<input type="number" value="${c.artifactEssence[r] ?? 0}" data-cfg-ess="${r}"></label>`).join('')}</div>
          <h3>Веса редкости по уровням</h3><table><thead><tr><th>С ур.</th>${D.rarities.map((r) => `<th style="color:${D.rarityColors[r]}">${D.rarityNames[r]}</th>`).join('')}<th></th></tr></thead><tbody>${c.rarityByLevel.map((row, i) => `<tr><td><input type="number" value="${row.from}" data-rbl="${i}" data-k="from" style="width:60px"></td>${D.rarities.map((r) => `<td><input type="number" value="${row.weights[r] || 0}" data-rbl="${i}" data-k="${r}" style="width:60px"></td>`).join('')}<td><button class="btn sm danger" data-act="rbl-del" data-i="${i}">✕</button></td></tr>`).join('')}</tbody></table><button class="btn sm" data-act="rbl-add" style="margin-top:6px">+ строка</button>
        </div>
        <div class="card"><h3>Экспорт / импорт</h3>
          <div class="row"><button class="btn primary" data-act="export">Скачать JSON</button><button class="btn primary" data-act="export-unity">Экспорт для Unity</button><label class="btn">Импорт<input type="file" accept="application/json" data-import hidden></label><button class="btn danger" data-act="reset">Сбросить</button></div>
          <p class="small muted">Экспорт для Unity: примитивы VFX, нагрузки, доставки, реакции и все композиты (доставка × 1–2 статуса) с готовыми именами и цветами. Один VFX Graph subgraph на примитив (<span class="mono">vfxPrimitives[*].unity</span>) с экспонированными свойствами — композит собирается из них в рантайме.</p>
          <div id="exportArea"></div>
          <h3>Словари</h3><div class="row">${[['payloads', 'Нагрузки'], ['deliveries', 'Доставки'], ['weaponKinds', 'Типы оружия'], ['weaponVariants', 'Вариации оружия'], ['vfxPrimitives', 'VFX-примитивы'], ['compositeOverrides', 'Ручные имена'], ['elements', 'Элементы'], ['triggers', 'Триггеры']].map(([k, l]) => `<button class="btn sm" data-act="dict-json" data-k="${k}">${l}</button>`).join('')}</div>
          <h3>VFX-примитивы</h3><div class="tablewrap"><table><thead><tr><th>Примитив</th><th>Unity</th><th>Attach</th><th>Свойства</th><th>Описание</th></tr></thead><tbody>${Object.entries(D.vfxPrimitives).map(([k, v]) => `<tr><td><b>${esc(k)}</b></td><td class="mono small">${esc(v.unity)}</td><td class="small">${esc(v.attach)}</td><td class="small mono">${(v.props || []).join(', ')}</td><td class="small muted">${esc(v.desc)}</td></tr>`).join('')}</tbody></table></div>
        </div></div>`;
  };

  // ---------------- modal ----------------
  function openModal(title, html) { $('#modalTitle').textContent = title; $('#modalBody').innerHTML = html; $('#modal').classList.remove('hidden'); }
  function closeModal() { $('#modal').classList.add('hidden'); }
  function jsonEditor(title, obj, onApply, opts = {}) {
    openModal(title, `<textarea class="json" id="jsonTa">${esc(JSON.stringify(obj, null, 2))}</textarea><div class="err" id="jsonErr"></div><div class="row" style="margin-top:8px"><button class="btn primary" id="jsonApply">Применить</button>${opts.onDelete ? '<button class="btn danger" id="jsonDelete">Удалить</button>' : ''}<button class="btn" id="jsonCancel">Отмена</button><span class="small muted">${esc(opts.hint || '')}</span></div>`);
    $('#jsonApply').onclick = () => { try { const v = JSON.parse($('#jsonTa').value); const err = onApply(v); if (err) { $('#jsonErr').textContent = err; return; } closeModal(); save(); render(); } catch (e) { $('#jsonErr').textContent = String(e.message || e); } };
    $('#jsonCancel').onclick = closeModal;
    if (opts.onDelete) $('#jsonDelete').onclick = () => { if (confirm('Удалить?')) { opts.onDelete(); closeModal(); save(); render(); } };
  }
  function overrideEditor(key) {
    const ov = D.compositeOverrides[key] || { name: '', desc: '' };
    const [dlId, pls] = key.split('+'); const nounDef = DL(dlId) || D.weaponKinds[dlId];
    const auto = nounDef ? compositeName(nounDef, (pls || '').split(',').filter(Boolean), '__auto__').name : '';
    openModal(`Имя эффекта: ${key}`, `<p class="small muted">Авто-имя: <b>${esc(auto)}</b>. Пусто = вернуть авто.</p><label class="f">Название<input id="ovName" value="${esc(ov.name)}"></label><label class="f" style="margin-top:8px">Описание (что происходит визуально/механически)<textarea id="ovDesc" rows="3">${esc(ov.desc || '')}</textarea></label><div class="row" style="margin-top:10px"><button class="btn primary" id="ovApply">Сохранить</button><button class="btn" id="ovCancel">Отмена</button></div>`);
    $('#ovApply').onclick = () => { const n = $('#ovName').value.trim(), d = $('#ovDesc').value.trim(); if (!n && !d) delete D.compositeOverrides[key]; else D.compositeOverrides[key] = { name: n || auto, desc: d }; closeModal(); save(); render(); };
    $('#ovCancel').onclick = closeModal;
  }

  // ---------------- events ----------------
  function dlFile(text, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; a.click(); }
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act], [data-tab]'); if (!t) return;
    if (t.dataset.tab) { UI.tab = t.dataset.tab; render(); return; }
    const act = t.dataset.act, id = t.dataset.id;
    const H = {
      'w-json': () => { const w = W(id); jsonEditor(`Оружие: ${w.name}`, w, (v) => { if (!v.id || !v.name) return 'нужны id и name'; if (v.id !== w.id && W(v.id)) return 'id занят'; Object.keys(w).forEach((k) => delete w[k]); Object.assign(w, v); }, { onDelete: () => { D.weapons = D.weapons.filter((x) => x !== w); } }); },
      'w-add': () => jsonEditor('Новое оружие', { id: 'new_weapon', name: 'Новое оружие', hands: '2h', kind: 'projectile', archetype: '', dmg: 30, aps: 2, projectiles: 1, range: 20, projSpeed: 60, crit: 0.1, critMult: 1.8, mag: 0, reload: 0, mobility: 1, tags: ['projectile'], gimmick: '', notes: '' }, (v) => { if (W(v.id)) return 'id занят'; D.weapons.push(v); }),
      'm-json': () => { const m = M(id); jsonEditor(`Мод: ${m.name}`, m, (v) => { if (!v.id || !v.name) return 'нужны id и name'; if (v.id !== m.id && M(v.id)) return 'id занят'; for (const ef of v.effects || []) { if (ef.delivery && !DL(ef.delivery)) return 'неизвестная доставка ' + ef.delivery; if (ef.payload && !P(ef.payload)) return 'неизвестная нагрузка ' + ef.payload; } Object.keys(m).forEach((k) => delete m[k]); Object.assign(m, v); }, { onDelete: () => { D.mods = D.mods.filter((x) => x !== m); }, hint: 'effects: [{trigger, delivery, payload, inherits, every, radius, targets, dmg, condition, self, upgrade}]' }); },
      'm-add': () => jsonEditor('Новый модификатор', { id: 'new_mod', name: 'Новый мод', type: 'passive', rarity: 'common', tags: [], maxStacks: 1, power: 3, desc: '', stats: {}, effects: [{ trigger: 'on_hit', payload: 'burn' }], weapon: {} }, (v) => { if (M(v.id)) return 'id занят'; D.mods.push(v); }),
      'rx-json': () => { const r = D.reactions[+t.dataset.i]; jsonEditor(`Реакция: ${r.name}`, r, (v) => Object.assign(r, v), { onDelete: () => D.reactions.splice(+t.dataset.i, 1) }); },
      'rx-new': () => jsonEditor('Новая реакция', { a: t.dataset.a, b: t.dataset.b, name: '', wow: 3, desc: '', vfx: ['Burst'] }, (v) => { if (!v.name) return 'нужно имя'; D.reactions.push(v); }),
      'ov-edit': () => overrideEditor(t.dataset.key),
      'lib-toggle': () => { addMod(id); render(); },
      'rm': () => { removeMod(id); render(); },
      'to-builder-pair': () => { removeMod(t.dataset.a); addMod(t.dataset.a); if (t.dataset.module) { UI.builder.modules = UI.builder.modules || {}; UI.builder.modules[UI.builder.main + ':' + t.dataset.module] = t.dataset.b; } else { removeMod(t.dataset.b); addMod(t.dataset.b); } UI.tab = 'builder'; render(); },
      'md-json': () => { const m = MD(id); jsonEditor(`Модуль: ${m.name}`, m, (v) => { if (!v.id || !v.name || !v.slot) return 'нужны id, name, slot'; if (!D.moduleSlots[v.slot]) return 'неизвестный слот ' + v.slot; if (v.id !== m.id && MD(v.id)) return 'id занят'; for (const ef of v.effects || []) { if (ef.delivery && !DL(ef.delivery)) return 'неизвестная доставка ' + ef.delivery; if (ef.payload && !P(ef.payload)) return 'неизвестная нагрузка ' + ef.payload; } Object.keys(m).forEach((k) => delete m[k]); Object.assign(m, v); }, { onDelete: () => { D.modules = D.modules.filter((x) => x !== m); }, hint: 'slot: core|barrel|frame · effects как у модов' }); },
      'md-add': () => jsonEditor('Новый модуль', { id: 'new_module', name: 'Новый модуль', slot: 'core', rarity: 'uncommon', power: 3, desc: '', stats: {}, effects: [{ trigger: 'on_hit', every: 2, payload: 'burn' }], weapon: {} }, (v) => { if (MD(v.id)) return 'id занят'; (D.modules = D.modules || []).push(v); }),
      'build-clear': () => { UI.builder.passives = []; UI.builder.actives = []; UI.builder.ult = null; render(); },
      'draft-gen': () => { const build = builderBuild(); const res = computeBuild(build); const cands = draftCandidates(build, res, UI.draft.level, UI.draft.banned); UI.draft.offer = drawOffer(cands.list, D.config.offersPerLevel).map((x) => x.mod.id); render(); },
      'draft-take': () => { const m = M(id); const b = UI.builder; if (m.type === 'passive') { const p = b.passives.find((x) => x.id === id); if (p) p.stacks = (p.stacks || 1) + 1; else addMod(id); } else addMod(id); UI.draft.picks++; UI.draft.level = Math.min(D.config.maxLevel, UI.draft.level + 1); UI.draft.offer = []; render(); },
      'draft-ban': () => { if (UI.draft.banned.length < (D.config.draft?.banTokens || 0) && !UI.draft.banned.includes(id)) UI.draft.banned.push(id); UI.draft.offer = UI.draft.offer.filter((x) => x !== id); render(); },
      'draft-unban': () => { UI.draft.banned = UI.draft.banned.filter((x) => x !== id); render(); },
      'draft-reset': () => { UI.draft = { level: 1, offer: [], banned: [], picks: 0 }; render(); },
      'build-save': () => { builds.push({ name: UI.builder.name.trim() || `Билд ${builds.length + 1}`, build: clone(builderBuild()) }); saveBuilds(); UI.builder.name = ''; render(); },
      'build-load': () => { const sb = builds[+t.dataset.i]; const b = UI.builder; b.main = sb.build.main; b.offhand = sb.build.offhand; b.passives = []; b.actives = []; b.ult = null; b.modules = {}; for (const id of sb.build.modules || []) { const md = MD(id); if (!md) continue; const w = (W(b.main)?.moduleSlots || []).includes(md.slot) ? b.main : b.offhand; if (w) b.modules[w + ':' + md.slot] = id; } for (const x of sb.build.mods) { const m = M(x.id); if (!m) continue; if (m.type === 'passive') b.passives.push({ id: x.id, stacks: x.stacks || 1 }); else addMod(x.id); } b.name = sb.name; render(); },
      'build-del': () => { builds.splice(+t.dataset.i, 1); saveBuilds(); render(); },
      'meta-json': () => jsonEditor('Мета', D.meta, (v) => { D.meta = v; }),
      'bld-json': () => { const bd = D.meta.buildings[+t.dataset.i]; jsonEditor(bd.name, bd, (v) => Object.assign(bd, v), { onDelete: () => D.meta.buildings.splice(+t.dataset.i, 1) }); },
      'dict-json': () => jsonEditor(t.dataset.k, D[t.dataset.k], (v) => { D[t.dataset.k] = v; }),
      'rbl-add': () => { D.config.rarityByLevel.push({ from: D.config.maxLevel, weights: { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 } }); save(); render(); },
      'rbl-del': () => { D.config.rarityByLevel.splice(+t.dataset.i, 1); save(); render(); },
      'export': () => dlFile(JSON.stringify(D, null, 2), 'arsenal-data.json'),
      'export-unity': () => { const j = JSON.stringify(unityExport(), null, 2); dlFile(j, 'arsenal-unity.json'); const ea = $('#exportArea'); if (ea) ea.innerHTML = `<textarea class="json" readonly style="margin-top:8px">${esc(j)}</textarea>`; },
      'reset': () => { if (confirm('Сбросить все данные к дефолту из data.js?')) { D = clone(window.DEFAULT_DATA); save(); render(); } },
    };
    if (H[act]) { e.preventDefault(); H[act](); }
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.wfield) { W(t.dataset.id)[t.dataset.wfield] = +t.value; save(); render(); }
    else if (t.dataset.wkind) { W(t.dataset.wkind).kind = t.value; save(); render(); }
    else if (t.dataset.wtext) { W(t.dataset.id)[t.dataset.wtext] = t.value; save(); }
    else if (t.dataset.mf !== undefined) { UI.modFilter[t.dataset.mf] = t.value; render(); }
    else if (t.dataset.lib !== undefined) { UI.lib[t.dataset.lib] = t.value; render(); }
    else if (t.dataset.syn !== undefined) { UI.syn[t.dataset.syn] = t.value; render(); }
    else if (t.dataset.bsel) { UI.builder[t.dataset.bsel] = t.value; if (t.dataset.bsel === 'main' && W(t.value)?.hands !== '1h') UI.builder.offhand = ''; render(); }
    else if (t.dataset.dist !== undefined) { UI.builder.dist = +t.value; render(); }
    else if (t.dataset.draftLevel !== undefined) { UI.draft.level = Math.max(1, +t.value || 1); UI.draft.offer = []; render(); }
    else if (t.dataset.msel) { UI.builder.modules = UI.builder.modules || {}; UI.builder.modules[t.dataset.msel] = t.value; render(); }
    else if (t.dataset.stack !== undefined) { const p = UI.builder.passives.find((x) => x.id === t.dataset.stack); if (p) p.stacks = Math.max(1, +t.value || 1); render(); }
    else if (t.dataset.bname !== undefined) UI.builder.name = t.value;
    else if (t.dataset.cfg) { D.config[t.dataset.cfg] = +t.value; save(); }
    else if (t.dataset.cfgEss) { D.config.artifactEssence[t.dataset.cfgEss] = +t.value; save(); }
    else if (t.dataset.rbl !== undefined) { const row = D.config.rarityByLevel[+t.dataset.rbl]; if (t.dataset.k === 'from') row.from = +t.value; else row.weights[t.dataset.k] = +t.value; D.config.rarityByLevel.sort((a, b) => a.from - b.from); save(); }
    else if (t.dataset.import !== undefined && t.files[0]) { const fr = new FileReader(); fr.onload = () => { try { const d = JSON.parse(fr.result); if (!d.mods || !d.payloads) throw new Error('это не файл Arsenal v2'); D = d; save(); render(); } catch (err) { alert('Ошибка импорта: ' + err.message); } }; fr.readAsText(t.files[0]); }
  });
  let dT; function debounce(fn) { clearTimeout(dT); dT = setTimeout(fn, 200); }
  document.addEventListener('input', (e) => { const t = e.target; if (t.dataset.mf === 'q') { UI.modFilter.q = t.value; debounce(render); } if (t.dataset.lib === 'q') { UI.lib.q = t.value; debounce(render); } if (t.dataset.bname !== undefined) UI.builder.name = t.value; });
  $('#modalClose').onclick = closeModal; $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); }); document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  function render() {
    $$('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === UI.tab));
    const ae = document.activeElement; const keep = ae && ae.dataset && (ae.dataset.lib === 'q' || ae.dataset.mf === 'q') ? { sel: ae.dataset.lib === 'q' ? '[data-lib="q"]' : '[data-mf="q"]', pos: ae.selectionStart } : null;
    const scroll = $('.lib-list')?.scrollTop;
    $('#view').innerHTML = R[UI.tab] ? R[UI.tab]() : '';
    if (keep) { const el = $(keep.sel); if (el) { el.focus(); try { el.setSelectionRange(keep.pos, keep.pos); } catch (_) { /* */ } } }
    if (scroll != null && $('.lib-list')) $('.lib-list').scrollTop = scroll;
  }
  window.ARSENAL = { computeBuild, compositeName, get D() { return D; } };
  render();
})();
