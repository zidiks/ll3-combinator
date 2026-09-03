#!/usr/bin/env node
// ============================================================
//  build.mjs — валидирует data.json и генерирует производные файлы.
//    node scripts/build.mjs          → проверка + unity.json + docs/catalog.md
//    node scripts/build.mjs --check  → только проверка (exit 1 при ошибках)
//  Без зависимостей. Запускается Vercel при деплое (см. vercel.json).
// ============================================================
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const Engine = require(join(ROOT, 'engine.js'));
const CHECK_ONLY = process.argv.includes('--check');

const D = JSON.parse(readFileSync(join(ROOT, 'data.json'), 'utf8'));
const errors = [], warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

// ---------------- validation ----------------
const TRIGGERS = new Set(Object.keys(D.triggers || {}));
const KNOWN_STATS = new Set(['dmgPct', 'aspdPct', 'critPct', 'critMultAdd', 'projectilesAdd', 'reloadPct', 'cdrPct', 'hpPct', 'speedPct', 'rangePct', 'rangeOptPct', 'rangeMinAdd', 'falloffAdd', 'closeMultAdd', 'projSpeedPct', 'drPct', 'xpPct', 'aoeDmgPct']);
const EFFECT_KEYS = new Set(['trigger', 'delivery', 'payload', 'inherits', 'every', 'everySec', 'chance', 'condition', 'targets', 'count', 'radius', 'duration', 'dmg', 'stacks', 'amount', 'self', 'upgrade', 'ultWindow', 'repeatSec']);
const has = (obj, id) => Object.prototype.hasOwnProperty.call(obj || {}, id);

if (D.version !== 2) err(`version must be 2, got ${D.version}`);
if (!/^\d{4}-\d{2}-\d{2}$/.test(D.updated || '')) err(`updated must be YYYY-MM-DD, got ${D.updated}`);

for (const r of D.rarities) {
  if (!D.rarityColors[r]) err(`rarityColors missing ${r}`);
  if (!D.rarityNames[r]) err(`rarityNames missing ${r}`);
  if (D.config.artifactEssence[r] == null) warn(`artifactEssence missing ${r}`);
}
let prevFrom = -1;
for (const row of D.config.rarityByLevel) {
  if (row.from <= prevFrom) err(`rarityByLevel not sorted at from=${row.from}`);
  prevFrom = row.from;
  for (const k of Object.keys(row.weights)) if (!D.rarities.includes(k)) err(`rarityByLevel weight for unknown rarity ${k}`);
}

for (const [id, p] of Object.entries(D.payloads)) {
  if (!has(D.elements, p.element)) err(`payload ${id}: unknown element ${p.element}`);
  if (!Array.isArray(p.adj) || p.adj.length !== 4) err(`payload ${id}: adj must have 4 forms [m, f, n, pl]`);
  if (!p.stem) err(`payload ${id}: stem required`);
  if (!has(D.vfxPrimitives, p.vfx)) err(`payload ${id}: unknown vfx ${p.vfx}`);
}
const checkVfx = (list, where) => { for (const v of list || []) if (!has(D.vfxPrimitives, v)) err(`${where}: unknown vfx primitive ${v}`); };
for (const [id, d] of Object.entries(D.deliveries)) {
  if (!['m', 'f', 'n', 'pl'].includes(d.gender)) err(`delivery ${id}: gender must be m|f|n|pl`);
  checkVfx(d.vfx, `delivery ${id}`);
  for (const p of d.innate || []) if (!has(D.payloads, p)) err(`delivery ${id}: innate unknown payload ${p}`);
  for (const m of d.desc.matchAll(/\{(\w+)\}/g)) if (!['targets', 'count', 'radius', 'duration'].includes(m[1])) err(`delivery ${id}: desc placeholder {${m[1]}} is not a known param`);
}
for (const [id, k] of Object.entries(D.weaponKinds)) {
  if (!['m', 'f', 'n', 'pl'].includes(k.gender)) err(`weaponKind ${id}: bad gender`);
  checkVfx(k.vfx, `weaponKind ${id}`);
}
for (const [kind, v] of Object.entries(D.weaponVariants)) {
  if (!has(D.weaponKinds, kind)) err(`weaponVariants: unknown kind ${kind}`);
  for (const dl of Object.keys(v)) if (dl !== '_' && !has(D.deliveries, dl)) err(`weaponVariants.${kind}: unknown delivery ${dl}`);
}
for (const key of Object.keys(D.compositeOverrides)) {
  const [dl, pls] = key.split('+');
  const ids = (pls || '').split(',').filter(Boolean);
  if (!has(D.deliveries, dl) && !has(D.weaponKinds, dl)) err(`compositeOverrides ${key}: unknown delivery/kind ${dl}`);
  for (const p of ids) if (!has(D.payloads, p)) err(`compositeOverrides ${key}: unknown payload ${p}`);
  if (ids.join(',') !== [...ids].sort().join(',')) err(`compositeOverrides ${key}: payloads must be sorted alphabetically`);
}
const rxPairs = new Set();
for (const rx of D.reactions) {
  for (const s of [rx.a, rx.b]) if (!has(D.payloads, s)) err(`reaction ${rx.name}: unknown payload ${s}`);
  const pair = [rx.a, rx.b].sort().join('+');
  if (rxPairs.has(pair)) err(`reaction ${rx.name}: duplicate pair ${pair}`);
  rxPairs.add(pair);
  if (!(rx.wow >= 1 && rx.wow <= 5)) warn(`reaction ${rx.name}: wow should be 1..5`);
  checkVfx(rx.vfx, `reaction ${rx.name}`);
}

const uniq = (list, what) => {
  const seen = new Set();
  for (const x of list) {
    if (!x.id) err(`${what}: entry without id (${x.name})`);
    if (seen.has(x.id)) err(`${what}: duplicate id ${x.id}`);
    seen.add(x.id);
  }
};
uniq(D.weapons, 'weapons'); uniq(D.mods, 'mods'); uniq(D.modules, 'modules'); uniq(D.items, 'items');

for (const w of D.weapons) {
  if (!has(D.weaponKinds, w.kind)) err(`weapon ${w.id}: unknown kind ${w.kind}`);
  if (!['1h', '2h', 'off'].includes(w.hands)) err(`weapon ${w.id}: hands must be 1h|2h|off`);
  for (const t of w.tags) if (!has(D.weaponTagNames, t)) err(`weapon ${w.id}: unknown tag ${t}`);
  for (const s of w.moduleSlots || []) if (!has(D.moduleSlots, s)) err(`weapon ${w.id}: unknown module slot ${s}`);
  if (!(w.rangeMin <= w.rangeOpt && w.rangeOpt <= w.range)) err(`weapon ${w.id}: need rangeMin <= rangeOpt <= range`);
  if (w.projSpeed === 0 && w.range > 5) warn(`weapon ${w.id}: melee (projSpeed 0) with range ${w.range} m`);
}

function checkEffects(owner, what) {
  for (const ef of owner.effects || []) {
    for (const k of Object.keys(ef)) if (!EFFECT_KEYS.has(k)) warn(`${what} ${owner.id}: unknown effect key ${k}`);
    if (ef.upgrade) {
      const u = ef.upgrade;
      if (u.delivery && !has(D.deliveries, u.delivery)) err(`${what} ${owner.id}: upgrade unknown delivery ${u.delivery}`);
      if (u.trigger && !TRIGGERS.has(u.trigger)) err(`${what} ${owner.id}: upgrade unknown trigger ${u.trigger}`);
      continue;
    }
    if (!ef.trigger) err(`${what} ${owner.id}: effect without trigger`);
    else if (!TRIGGERS.has(ef.trigger)) err(`${what} ${owner.id}: unknown trigger ${ef.trigger}`);
    if (ef.delivery && !has(D.deliveries, ef.delivery)) err(`${what} ${owner.id}: unknown delivery ${ef.delivery}`);
    if (ef.payload && !has(D.payloads, ef.payload)) err(`${what} ${owner.id}: unknown payload ${ef.payload}`);
    if (ef.condition && !has(D.payloads, ef.condition)) err(`${what} ${owner.id}: unknown condition payload ${ef.condition}`);
    if (!ef.delivery && !ef.payload && !ef.self) warn(`${what} ${owner.id}: effect ${ef.trigger} has neither delivery, payload nor self text`);
    if (ef.chance != null && !(ef.chance > 0 && ef.chance <= 1)) err(`${what} ${owner.id}: chance must be in (0,1]`);
    if (ef.trigger === 'periodic' && !ef.everySec) warn(`${what} ${owner.id}: periodic without everySec (engine assumes 5 s)`);
    if (ef.trigger === 'on_activate' && what === 'mod' && !owner.cooldown) warn(`${what} ${owner.id}: on_activate without cooldown (engine assumes 10 s)`);
  }
}
function checkWeaponRule(owner, what) {
  const wr = owner.weapon || {};
  for (const t of wr.requires || []) if (!has(D.weaponTagNames, t)) err(`${what} ${owner.id}: weapon.requires unknown tag ${t}`);
  for (const key of ['bonus', 'penalty']) {
    for (const [t, v] of Object.entries(wr[key] || {})) {
      if (!has(D.weaponTagNames, t)) err(`${what} ${owner.id}: weapon.${key} unknown tag ${t}`);
      if (key === 'penalty' && v > 0) warn(`${what} ${owner.id}: penalty ${t} is positive`);
    }
  }
}
function checkStats(owner, what) { for (const k of Object.keys(owner.stats || {})) if (!KNOWN_STATS.has(k)) warn(`${what} ${owner.id}: unknown stat ${k} (engine ignores it)`); }

for (const m of D.mods) {
  if (!['passive', 'active', 'ultimate'].includes(m.type)) err(`mod ${m.id}: type must be passive|active|ultimate`);
  if (!D.rarities.includes(m.rarity)) err(`mod ${m.id}: unknown rarity ${m.rarity}`);
  if (m.type === 'ultimate' && !m.charge) warn(`mod ${m.id}: ultimate without charge condition`);
  if (m.type === 'ultimate' && m.rarity !== 'legendary') warn(`mod ${m.id}: ultimate is not legendary`);
  if (m.type === 'active' && !m.cooldown) warn(`mod ${m.id}: active without cooldown`);
  if (!(m.maxStacks >= 1)) err(`mod ${m.id}: maxStacks >= 1 required`);
  checkEffects(m, 'mod'); checkWeaponRule(m, 'mod'); checkStats(m, 'mod');
}
for (const m of D.modules) {
  if (!has(D.moduleSlots, m.slot)) err(`module ${m.id}: unknown slot ${m.slot}`);
  if (!D.rarities.includes(m.rarity)) err(`module ${m.id}: unknown rarity ${m.rarity}`);
  checkEffects(m, 'module'); checkWeaponRule(m, 'module'); checkStats(m, 'module');
}
for (const it of D.items) {
  if (!D.rarities.includes(it.rarity)) err(`item ${it.id}: unknown rarity ${it.rarity}`);
  if (!(it.uses >= 1)) err(`item ${it.id}: uses >= 1 required`);
  for (const ef of it.effects || []) if (ef.trigger && ef.trigger !== 'on_use') warn(`item ${it.id}: trigger ${ef.trigger} (items are expected to use on_use)`);
  checkEffects(it, 'item');
}
for (const c of D.meta.currencies) if (!c.id) err('meta.currencies: entry without id');
const currencyIds = new Set(D.meta.currencies.map((c) => c.id));
for (const b of D.meta.buildings) for (const lv of b.levels) for (const cur of Object.keys(lv.cost || {})) if (!currencyIds.has(cur)) err(`meta.buildings ${b.id}: unknown currency ${cur}`);
for (const t of D.meta.weaponTiers) for (const cur of Object.keys(t.cost || {})) if (!currencyIds.has(cur)) err(`meta.weaponTiers T${t.tier}: unknown currency ${cur}`);

// ---------------- report ----------------
for (const w of warnings) console.warn('  warn  ' + w);
for (const e of errors) console.error('  ERROR ' + e);
console.log(`data.json: ${D.weapons.length} weapons, ${D.mods.length} mods, ${D.modules.length} modules, ${D.items.length} items, ${Object.keys(D.payloads).length} payloads, ${Object.keys(D.deliveries).length} deliveries, ${D.reactions.length} reactions, ${Object.keys(D.vfxPrimitives).length} vfx primitives — ${errors.length} errors, ${warnings.length} warnings`);
if (errors.length) process.exit(1);
if (CHECK_ONLY) process.exit(0);

// ---------------- unity.json ----------------
const unity = Engine.unityExport(D);
writeFileSync(join(ROOT, 'unity.json'), JSON.stringify(unity, null, 2) + '\n');
console.log(`unity.json: ${unity.composites.length} composites`);

// ---------------- docs/catalog.md ----------------
const pct = (x) => Math.round(x * 100) + '%';
const rar = (r) => D.rarityNames[r] || r;
const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const table = (head, rows) => ['| ' + head.join(' | ') + ' |', '|' + head.map(() => '---').join('|') + '|', ...rows.map((r) => '| ' + r.map(cell).join(' | ') + ' |')].join('\n');

function fmtEffect(ef) {
  if (ef.upgrade) {
    const u = ef.upgrade; const parts = [];
    if (u.delivery) parts.push(`апгрейд доставки \`${u.delivery}\`: ` + Object.entries(u).filter(([k]) => k !== 'delivery').map(([k, v]) => `${k} +${v}`).join(', '));
    if (u.inheritAll) parts.push('все доставки наследуют базовые нагрузки (`inheritAll`)');
    if (u.trigger) parts.push(`триггер \`${u.trigger}\` ×${u.mult}`);
    return parts.join('; ');
  }
  let s = `\`${ef.trigger}\``;
  if (ef.every) s += ` (каждое ${ef.every}-е)`;
  if (ef.everySec) s += ` (раз в ${ef.everySec} с)`;
  if (ef.chance) s += ` (${pct(ef.chance)})`;
  if (ef.condition) s += ` по цели с \`${ef.condition}\``;
  if (ef.ultWindow) s += ` [окно ульты ${ef.ultWindow} с]`;
  s += ' → ';
  const out = [];
  if (ef.delivery) {
    const p = [];
    for (const k of ['targets', 'count', 'radius', 'duration']) if (ef[k] != null) p.push(`${k} ${ef[k]}`);
    if (ef.dmg != null) p.push(`dmg ${pct(ef.dmg)}`);
    if (ef.repeatSec) p.push(`повтор ${ef.repeatSec} с`);
    out.push(`\`${ef.delivery}\`${p.length ? ' (' + p.join(', ') + ')' : ''}`);
  }
  if (ef.payload) out.push(`\`${ef.payload}\`${ef.stacks ? ' ×' + ef.stacks : ''}${ef.amount != null ? ' ' + pct(ef.amount) : ''}`);
  if (ef.inherits) out.push('наследует базовые нагрузки');
  if (ef.self) out.push(`себе: ${ef.self}`);
  return s + out.join(' + ');
}
const fmtStats = (st) => Object.entries(st || {}).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${Number.isInteger(v) ? v : pct(v)}`).join(', ');
const fmtRule = (wr) => {
  const p = [];
  if (wr?.requires?.length) p.push((wr.requiresAny ? 'нужен один из: ' : 'нужно: ') + wr.requires.join(', '));
  if (wr?.bonus) p.push('бонус: ' + Object.entries(wr.bonus).map(([t, v]) => `${t} +${v}`).join(', '));
  if (wr?.penalty) p.push('штраф: ' + Object.entries(wr.penalty).map(([t, v]) => `${t} ${v}`).join(', '));
  return p.join('; ');
};
const params = (o) => ['targets', 'count', 'radius', 'duration'].filter((k) => o[k] != null).map((k) => `${k} ${o[k]}`).join(', ');
const cost = (c) => Object.entries(c || {}).map(([k, v]) => `${v} ${k}`).join(', ') || '—';

const md = [];
md.push('# Arsenal Designer — каталог контента', '',
  `> Сгенерировано из \`data.json\` (version ${D.version}, updated ${D.updated}) скриптом \`scripts/build.mjs\`. Не редактировать руками — править \`data.json\`.`,
  '> Как это всё работает: [docs/mechanics.md](mechanics.md). Схема: [schema/data.schema.json](../schema/data.schema.json).', '');
md.push('## Конфиг катки', '', table(['Параметр', 'Значение'], [
  ['Макс. уровень', D.config.maxLevel], ['Офферов за уровень', D.config.offersPerLevel],
  ['Слоты: пассивки / активы / ульта / предмет', `${D.config.passiveSlots} / ${D.config.activeSlots} / ${D.config.ultSlots} / ${D.config.itemSlots}`],
  ['Ульта доступна с уровня', `${D.config.ultMinLevel}${D.config.ultForcedAtMin ? ' (принудительный оффер из ульт, если ульты ещё нет)' : ''}`],
  ['HP врага / элиты / босса', `${D.config.enemyHp} / ${D.config.eliteHp} / ${D.config.bossHp}`], ['Плотность врагов в АоЕ ~4 м', D.config.density],
  ['Пиковые уровни драфта', (D.config.draft.peakLevels || []).join(', ') + ` (сдвиг редкости +${D.config.draft.peakShift})`],
  ['Веса умного драфта: реакция / композит / affinity', `${D.config.draft.wReaction} / ${D.config.draft.wComposite} / ${D.config.draft.wAffinity}`],
  ['Бан-жетонов на катку', D.config.draft.banTokens], ['Первый оффер случайный', D.config.draft.firstOfferRandom ? 'да' : 'нет'],
]), '');
md.push('### Веса редкости по уровням', '', table(['С уровня', ...D.rarities.map(rar)], D.config.rarityByLevel.map((r) => [r.from, ...D.rarities.map((x) => r.weights[x] ?? 0)])), '');
md.push('### Эссенция за артефакт', '', table(D.rarities.map(rar), [D.rarities.map((r) => D.config.artifactEssence[r])]), '');
md.push('## Элементы', '', table(['id', 'Название', 'Цвет'], Object.entries(D.elements).map(([id, e]) => [`\`${id}\``, e.name, e.color])), '');
md.push('## Триггеры', '', table(['id', 'Когда'], Object.entries(D.triggers).map(([id, t]) => [`\`${id}\``, t])), '');
md.push('## Нагрузки (payloads)', '', table(['id', 'Название', 'Элемент', 'Эффект', 'Прилагательное (м/ж/ср/мн)', 'На себя', 'VFX'],
  Object.entries(D.payloads).map(([id, p]) => [`\`${id}\``, p.name, p.element, p.desc, p.adj.join(' / ') + ` (stem: ${p.stem})`, p.self ? 'да' : '', p.vfx])), '');
md.push('## Доставки (deliveries)', '', table(['id', 'Существительное', 'Род', 'Описание', 'Параметры по умолчанию', 'Продолжение снаряда', 'Встроенные нагрузки', 'VFX'],
  Object.entries(D.deliveries).map(([id, d]) => [`\`${id}\``, d.noun, d.gender, d.desc, params(d), d.continuation ? 'да' : '', (d.innate || []).join(', '), d.vfx.join(', ')])), '');
md.push('## Носители (weaponKinds)', '', table(['id', 'Существительное', 'Род', 'VFX', 'Как звучат доставки на этом носителе'],
  Object.entries(D.weaponKinds).map(([id, k]) => { const v = D.weaponVariants[id] || {}; return [`\`${id}\``, k.noun, k.gender, k.vfx.join(', '), Object.entries(v).map(([dl, t]) => `**${dl === '_' ? 'по умолчанию' : dl}**: ${t}`).join('<br>')]; })), '');
md.push('## Ручные имена композитов', '', table(['Ключ', 'Имя', 'Описание'], Object.entries(D.compositeOverrides).map(([k, v]) => [`\`${k}\``, v.name, v.desc])), '');
md.push('## Реакции статусов', '', 'Пара статусов на одной цели → именованный эффект. `wow` 1–5 — насколько зрелищно. Интенсивность в билде = min(наложений/с двух статусов).', '',
  table(['A', 'B', 'Название', 'wow', 'Эффект', 'VFX'], D.reactions.map((r) => [`\`${r.a}\``, `\`${r.b}\``, r.name, '★'.repeat(r.wow), r.desc, (r.vfx || []).join(', ')])), '');
md.push('## Оружие', '', table(['id', 'Название', 'Руки', 'Носитель', 'Архетип', 'Урон', 'Атак/с', 'Снарядов', 'Дальность min/opt/max (м)', 'Спад', 'В упор', 'Скор. снаряда', 'Крит / множ.', 'Магазин / перезарядка', 'Слоты модулей', 'Теги'],
  D.weapons.map((w) => [`\`${w.id}\``, w.name, w.hands, w.kind, w.archetype, w.dmg, w.aps, w.projectiles, `${w.rangeMin}/${w.rangeOpt}/${w.range}`, `×${w.falloff}`, `×${w.closeMult}`, w.projSpeed === 0 ? 'ближний' : w.projSpeed, `${pct(w.crit)} / ×${w.critMult}`, w.mag ? `${w.mag} / ${w.reload} с` : '—', (w.moduleSlots || []).join('+'), w.tags.join(', ')])), '');
md.push('### Гиммики оружия', '', ...D.weapons.map((w) => `- **${w.name}** (\`${w.id}\`): ${w.gimmick} _${w.notes}_`), '');
md.push('### Теги оружия', '', table(['Тег', 'Смысл'], Object.entries(D.weaponTagNames).map(([t, n]) => [`\`${t}\``, n])), '');
md.push('### Классы дальности', '', table(['id', 'Название', 'До (м)'], D.rangeClasses.map((c) => [`\`${c.id}\``, c.name, c.max])), '');
const typeName = { passive: 'Пассивки', active: 'Активы', ultimate: 'Ультимейты' };
md.push('## Модификаторы (mods)', '', `Всего ${D.mods.length}. Формат эффекта описан в [mechanics.md](mechanics.md#4-эффект--атом-системы).`, '');
for (const type of ['passive', 'active', 'ultimate']) {
  const list = D.mods.filter((m) => m.type === type).sort((a, b) => D.rarities.indexOf(a.rarity) - D.rarities.indexOf(b.rarity));
  md.push(`### ${typeName[type]} (${list.length})`, '', table(['id', 'Название', 'Редкость', 'Описание', 'Стаки', 'Power', type === 'ultimate' ? 'Заряд' : 'КД', 'Статы', 'Эффекты', 'Совместимость с оружием', 'Теги'],
    list.map((m) => [`\`${m.id}\``, m.name, rar(m.rarity), m.desc, m.maxStacks, m.power, type === 'ultimate' ? m.charge || '' : m.cooldown ? `${m.cooldown} с` : '', fmtStats(m.stats), (m.effects || []).map(fmtEffect).join('<br>'), fmtRule(m.weapon), (m.tags || []).join(', ')])), '');
}
md.push('## Модули оружия', '', `Слоты: ${Object.entries(D.moduleSlots).map(([k, v]) => `\`${k}\` = ${v}`).join(', ')}. Ставятся до катки, в конструкторе участвуют как моды (наследуются, реагируют, попадают в авто-имена).`, '');
for (const [slot, slotName] of Object.entries(D.moduleSlots)) {
  const list = D.modules.filter((m) => m.slot === slot).sort((a, b) => D.rarities.indexOf(a.rarity) - D.rarities.indexOf(b.rarity));
  md.push(`### ${slotName} (\`${slot}\`, ${list.length})`, '', table(['id', 'Название', 'Редкость', 'Описание', 'Power', 'Статы', 'Эффекты', 'Совместимость'],
    list.map((m) => [`\`${m.id}\``, m.name, rar(m.rarity), m.desc, m.power, fmtStats(m.stats), (m.effects || []).map(fmtEffect).join('<br>'), fmtRule(m.weapon)])), '');
}
md.push('## Предметы (items)', '', 'Подбираются на карте, 1 слот, срабатывают по `on_use`.', '',
  table(['id', 'Название', 'Категория', 'Редкость', 'Зарядов', 'Power', 'Описание', 'Эффекты'], D.items.map((it) => [`\`${it.id}\``, it.name, it.cat, rar(it.rarity), it.uses, it.power, it.desc, (it.effects || []).map(fmtEffect).join('<br>')])), '');
md.push('## VFX-примитивы (Unity VFX Graph)', '', table(['Примитив', 'Unity subgraph', 'Точка привязки', 'Свойства', 'Описание'], Object.entries(D.vfxPrimitives).map(([k, v]) => [`\`${k}\``, v.unity, v.attach, (v.props || []).join(', '), v.desc])), '');
md.push('## Мета-прогрессия', '', '### Принципы', '', ...D.meta.principles.map((p) => `- ${p}`), '',
  '### Валюты', '', table(['id', 'Название', 'Источник', 'Куда тратится'], D.meta.currencies.map((c) => [`\`${c.id}\``, c.name, c.source, c.sink])), '', '### Постройки', '');
for (const b of D.meta.buildings) md.push(`**${b.name}** (\`${b.id}\`) — ${b.desc}`, '', table(['Ур.', 'Стоимость', 'Открывает'], b.levels.map((lv, i) => [i + 1, cost(lv.cost), lv.unlock])), '');
md.push('### Тиры оружия', '', table(['Тир', 'Стоимость', 'Бонус'], D.meta.weaponTiers.map((t) => [`T${t.tier}`, cost(t.cost), t.bonus])), '',
  '### Петля катки', '', table(['Фаза', 'Минуты', 'Что происходит'], D.meta.runLoop.map((r) => [r.phase, r.minutes, r.text])), '');
writeFileSync(join(ROOT, 'docs', 'catalog.md'), md.join('\n') + '\n');
console.log('docs/catalog.md written');
