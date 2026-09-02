// ============================================================
//  DEFAULT GAME DATA v2 — композиционная система эффектов
//  Мод = набор эффектов { trigger, delivery, payload, ... }
//  Движок сам собирает: оружие × доставка × нагрузка → именованный эффект + VFX-рецепт,
//  а статусы на цели реагируют друг с другом (реакции).
// ============================================================
window.DEFAULT_DATA = {
  version: 2,

  config: {
    // 9 выборов = 5 пассивок + 3 актива + 1 ульта → к 10-му уровню билд собран; 11–12 уровни — стаки и добор
    maxLevel: 12, offersPerLevel: 3, activeSlots: 3, ultSlots: 1, passiveSlots: 5, itemSlots: 1, ultMinLevel: 10,
    ultForcedAtMin: true,        // на ultMinLevel, если ульты нет — оффер целиком из ульт
    enemyHp: 600, eliteHp: 4000, bossHp: 60000,
    density: 4,                 // сколько врагов в среднем в АоЕ радиусом ~4 м (для оценки частоты)
    // Дальность: до rangeMin — урон × closeMult; rangeMin..rangeOpt — 100%; rangeOpt..range — линейный спад до falloff; дальше автонаводка не захватывает цель
    rangeAxisMax: 60,           // ось шкалы дистанций, м
    rarityByLevel: [
      { from: 1,  weights: { common: 70, uncommon: 30, rare: 0,  epic: 0,  legendary: 0 } },
      { from: 3,  weights: { common: 50, uncommon: 35, rare: 15, epic: 0,  legendary: 0 } },
      { from: 6,  weights: { common: 30, uncommon: 40, rare: 22, epic: 8,  legendary: 0 } },
      { from: 9,  weights: { common: 15, uncommon: 35, rare: 30, epic: 17, legendary: 3 } },
      { from: 12, weights: { common: 5,  uncommon: 25, rare: 35, epic: 25, legendary: 10 } },
    ],
    artifactEssence: { common: 5, uncommon: 15, rare: 40, epic: 120, legendary: 400 },
    // ---------- Правила выдачи модов в катке (зафиксировано)
    draft: {
      peakLevels: [5, 10],       // «большой оффер»: редкость сдвигается на ступень выше (10 — ульта)
      peakShift: 1,
      wReaction: 3.0,            // вес за каждую новую реакцию, которую даст мод
      wComposite: 1.5,           // вес за новый именованный композит (огненная молния и т.п.)
      wAffinity: 0.8,            // вес за affinity с оружием сверх 1.0
      banTokens: 2,              // бан-жетонов на катку (подбираются на карте)
      firstOfferRandom: true,    // первый оффер без умных весов
    },
  },

  rarities: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
  rarityColors: { common: '#9aa3ad', uncommon: '#3fbf5f', rare: '#3b8bff', epic: '#b04cff', legendary: '#ffb020' },
  rarityNames: { common: 'Обычный', uncommon: 'Необычный', rare: 'Редкий', epic: 'Эпический', legendary: 'Легендарный' },

  elements: {
    plasma:  { name: 'Плазма',   color: '#ff6a3d' },
    cryo:    { name: 'Крио',     color: '#5fd8ff' },
    volt:    { name: 'Вольт',    color: '#ffe14d' },
    void:    { name: 'Пустота',  color: '#b06bff' },
    kinetic: { name: 'Кинетика', color: '#ff8fb1' },
    nano:    { name: 'Нано',     color: '#6dff9c' },
    none:    { name: 'Нейтр.',   color: '#8a93a0' },
  },

  triggers: {
    on_hit: 'при попадании', on_crit: 'при крите', on_kill: 'при убийстве', on_block: 'при блоке', on_dodge: 'при уклонении',
    on_low_hp: 'при низком HP', on_death: 'при смерти', on_reload: 'при перезарядке', periodic: 'периодически',
    on_activate: 'активация', on_ult: 'ультимейт', on_use: 'использование предмета', passive: 'постоянно',
  },

  // ---------- НАГРУЗКИ (что накладывается). adj: [м, ж, ср, мн], stem — для сложных прилагательных
  payloads: {
    burn:      { name: 'Поджог',        element: 'plasma',  adj: ['огненный', 'огненная', 'огненное', 'огненные'], stem: 'огненно', desc: '4 урона/с 3 с, стак ×5', vfx: 'StatusAura' },
    chill:     { name: 'Обморожение',   element: 'cryo',    adj: ['ледяной', 'ледяная', 'ледяное', 'ледяные'], stem: 'ледяно', desc: '−20% скорости, 5 стаков = заморозка 1.5 с', vfx: 'StatusAura' },
    shock:     { name: 'Разряд',        element: 'volt',    adj: ['электрический', 'электрическая', 'электрическое', 'электрические'], stem: 'электро', desc: 'микро-стан 0.2 с, цель проводит ток', vfx: 'StatusAura' },
    mark:      { name: 'Метка',         element: 'void',    adj: ['пустотный', 'пустотная', 'пустотное', 'пустотные'], stem: 'пустотно', desc: '+20% получаемого урона 5 с', vfx: 'StatusAura' },
    knockback: { name: 'Отбрасывание',  element: 'kinetic', adj: ['ударный', 'ударная', 'ударное', 'ударные'], stem: 'ударно', desc: 'отброс + оглушение 0.5 с', vfx: 'ImpactHeavy' },
    bleed:     { name: 'Кровотечение',  element: 'none',    adj: ['кровавый', 'кровавая', 'кровавое', 'кровавые'], stem: 'кроваво', desc: '2% макс. HP/с 4 с, стак ×3', vfx: 'StatusAura' },
    execute:   { name: 'Казнь',         element: 'none',    adj: ['казнящий', 'казнящая', 'казнящее', 'казнящие'], stem: 'казняще', desc: 'цель ниже 15% HP умирает', vfx: 'Impact' },
    heal:      { name: 'Лечение',       element: 'nano',    adj: ['целебный', 'целебная', 'целебное', 'целебные'], stem: 'целебно', desc: 'лечит владельца', self: true, vfx: 'SelfPulse' },
    shield:    { name: 'Щит',           element: 'nano',    adj: ['защитный', 'защитная', 'защитное', 'защитные'], stem: 'защитно', desc: 'временный щит владельцу', self: true, vfx: 'SelfPulse' },
  },

  // ---------- ДОСТАВКИ (как эффект доходит до целей)
  // continuation: попадания считаются попаданиями оружия (перезапускают on_hit-эффекты)
  // innate: нагрузки, встроенные в доставку
  deliveries: {
    chain:    { noun: 'молния',    gender: 'f',  vfx: ['Arc', 'Impact'],      desc: 'дуга перескакивает на {targets} целей', targets: 1 },
    ricochet: { noun: 'рикошет',   gender: 'm',  vfx: ['Redirect', 'Trail'],  desc: 'снаряд отскакивает к {count} целям', count: 1, continuation: true },
    pierce:   { noun: 'пробитие',  gender: 'n',  vfx: ['Trail'],              desc: 'снаряд пробивает +{count} целей', count: 1, continuation: true },
    split:    { noun: 'осколки',   gender: 'pl', vfx: ['Burst', 'Trail'],     desc: '{count} осколков в ближайших', count: 3, continuation: true },
    burst:    { noun: 'взрыв',     gender: 'm',  vfx: ['Burst', 'Impact'],    desc: 'взрыв радиусом {radius} м', radius: 2 },
    zone:     { noun: 'зона',      gender: 'f',  vfx: ['Zone'],               desc: 'зона {radius} м на {duration} с', radius: 3, duration: 4 },
    pull:     { noun: 'воронка',   gender: 'f',  vfx: ['Vortex'],             desc: 'стягивает врагов в {radius} м', radius: 3, innate: ['mark'] },
    wave:     { noun: 'волна',     gender: 'f',  vfx: ['Ring'],               desc: 'кольцо радиусом {radius} м от игрока', radius: 5 },
    pulse:    { noun: 'импульс',   gender: 'm',  vfx: ['Pulse'],              desc: 'накладывает на {targets} ближайших', targets: 1 },
    reflect:  { noun: 'отражение', gender: 'n',  vfx: ['Redirect', 'Trail'],  desc: 'снаряд летит обратно в стрелка' },
    echo:     { noun: 'фантом',    gender: 'm',  vfx: ['Ghost'],              desc: 'удар повторяется фантомом' },
    summon:   { noun: 'призыв',    gender: 'm',  vfx: ['Summon', 'Trail'],    desc: 'сущность атакует {duration} с', duration: 10 },
    trap:     { noun: 'ловушка',   gender: 'f',  vfx: ['Trap', 'Burst'],      desc: 'срабатывает при касании, радиус {radius} м', radius: 2 },
    orbit:    { noun: 'спутники',  gender: 'pl', vfx: ['Orbit'],              desc: '{count} снарядов вращаются вокруг игрока', count: 3 },
  },

  // ---------- Базовая доставка оружия (носитель on_hit-нагрузок)
  weaponKinds: {
    projectile:  { noun: 'пуля',    gender: 'f', vfx: ['Trail', 'Impact'] },
    spread:      { noun: 'веер',    gender: 'm', vfx: ['TrailMulti', 'Impact'] },
    charge:      { noun: 'стрела',  gender: 'f', vfx: ['ChargeGlow', 'Trail', 'Impact'] },
    thrown:      { noun: 'сюрикен', gender: 'm', vfx: ['TrailReturn', 'Impact'] },
    melee_combo: { noun: 'клинок',  gender: 'm', vfx: ['Slash', 'Impact'] },
    melee_arc:   { noun: 'замах',   gender: 'm', vfx: ['SlashArc', 'Ring'] },
    block:       { noun: 'блок',    gender: 'm', vfx: ['ShieldFlash'] },
  },

  // ---------- Вариации по типу оружия: как та же доставка звучит на разном носителе
  weaponVariants: {
    projectile:  { _: 'срабатывает на каждое попадание пули' },
    spread:      { _: 'срабатывает с каждой дробины (×8 в упор)', chain: 'цепь стартует от каждой дробины — сеть дуг', burst: 'взрыв от каждой дробины — ковёр взрывов', ricochet: 'дробины рикошетят веером во все стороны', pierce: 'веер прошивает строй', pull: 'несколько воронок сливаются в одну большую' },
    charge:      { _: 'на полном заряде эффект ×2 (стаки/радиус)', chain: 'на полном заряде дуга бьёт по 2 целям сразу', burst: 'радиус взрыва растёт с зарядом', pierce: 'полный заряд пробивает всех на линии', pull: 'воронка растёт с зарядом' },
    thrown:      { _: 'применяется на пути туда и обратно (×2 у близких целей)', ricochet: 'сюрикен не возвращается, пока есть цели', chain: 'дуга тянется за возвращающимся сюрикеном', split: 'осколки тоже возвращаются' },
    melee_combo: { _: '3-й удар комбо накладывает ×2 стаков', chain: 'дуга срывается с клинка в ближайших', burst: 'взрыв на кончике клинка, тебя не задевает', echo: 'фантом повторяет всё комбо' },
    melee_arc:   { _: 'применяется ко всем целям в дуге замаха', burst: 'один большой взрыв на всю дугу', chain: 'цепь связывает всех задетых замахом', wave: 'волна от замаха — двойное кольцо', pull: 'воронка в центре дуги — врагов сносит к тебе' },
    block:       { _: 'при ударе щитом', reflect: 'отражённый снаряд несёт твои статусы', wave: 'волна от щита, тебя не толкает' },
  },

  // ---------- Ручные переопределения авто-имён: ключ "delivery+payloadA,payloadB" (нагрузки по алфавиту)
  compositeOverrides: {
    'chain+burn':   { name: 'Огненная молния', desc: 'дуга поджигает всех на пути и разлетается искрами по земле' },
    'chain+chill':  { name: 'Ледяная цепь', desc: 'дуга вмораживает цели в цепочку — они замедлены вместе' },
    'burst+chill':  { name: 'Криовзрыв', desc: 'сфера инея, всё внутри получает стаки обморожения' },
    'pull+burn':    { name: 'Солнечная воронка', desc: 'воронка горит — всё, что стянуто, поджигается' },
    'wave+knockback': { name: 'Сейсмическая волна', desc: 'кольцо расшвыривает врагов' },
    'ricochet+shock': { name: 'Электрорикошет', desc: 'снаряд между отскоками оставляет дугу' },
  },

  // ---------- Реакции статусов на одной цели
  reactions: [
    { a: 'burn', b: 'chill',     name: 'Термошок',          wow: 5, desc: 'Замороженная цель под огнём взрывается: 50% макс. HP АоЕ 4 м.', vfx: ['Shatter', 'Steam', 'Burst'] },
    { a: 'burn', b: 'shock',     name: 'Плазменная дуга',   wow: 3, desc: 'Разряд по горящей цели поджигает всех, кого касается дуга.', vfx: ['Arc', 'EmberTrail'] },
    { a: 'burn', b: 'mark',      name: 'Солнечная метка',   wow: 4, desc: 'Помеченная горящая цель горит на +100% и излучает жар 3 м.', vfx: ['StatusAura', 'HeatHaze'] },
    { a: 'burn', b: 'knockback', name: 'Пиро-удар',         wow: 3, desc: 'Отброшенная горящая цель оставляет огненный след.', vfx: ['Zone', 'EmberTrail'] },
    { a: 'burn', b: 'bleed',     name: 'Прижигание',        wow: 2, desc: 'Кровотечение на горящей цели тикает ×2.', vfx: ['StatusAura'] },
    { a: 'chill', b: 'shock',    name: 'Сверхпроводник',    wow: 4, desc: 'Разряд по замороженным не теряет урон и бьёт +1 цель.', vfx: ['Arc', 'FrostSpark'] },
    { a: 'chill', b: 'mark',     name: 'Стазис',            wow: 4, desc: 'Помеченная цель замораживается с 1 стака.', vfx: ['FreezeShell'] },
    { a: 'chill', b: 'knockback', name: 'Ледокол',          wow: 4, desc: 'Удар по замороженной цели разбивает её осколками (АоЕ 4 м).', vfx: ['Shatter', 'Burst'] },
    { a: 'chill', b: 'bleed',    name: 'Ледяная рана',      wow: 2, desc: 'Кровотечение не истекает, пока цель обморожена.', vfx: ['StatusAura'] },
    { a: 'shock', b: 'mark',     name: 'ЭМИ',               wow: 4, desc: 'Разряд по помеченной цели оглушает на 1 с всех в 3 м.', vfx: ['Pulse', 'Arc'] },
    { a: 'shock', b: 'knockback', name: 'Рельса',           wow: 4, desc: 'Отброшенная цель под током бьёт дугой всех на своём пути.', vfx: ['Arc', 'Trail'] },
    { a: 'shock', b: 'bleed',    name: 'Судорога',          wow: 2, desc: 'Микро-стан от разряда длится ×3 на кровоточащих.', vfx: ['StatusAura'] },
    { a: 'mark', b: 'knockback', name: 'Импульс-коллапс',   wow: 5, desc: 'Отброшенная помеченная цель взрывается на 200 урона при ударе о препятствие.', vfx: ['Burst', 'Vortex'] },
    { a: 'mark', b: 'bleed',     name: 'Кровавая метка',    wow: 3, desc: 'Тик кровотечения переносит метку на ближайшего врага.', vfx: ['Pulse'] },
    { a: 'knockback', b: 'bleed', name: 'Разрыв',           wow: 3, desc: 'Отбрасывание срывает все стаки кровотечения разом.', vfx: ['ImpactHeavy'] },
    { a: 'burn', b: 'heal',      name: 'Протокол Феникс',   wow: 3, desc: 'Урон от горения лечит тебя на 20%.', vfx: ['SelfPulse'] },
    { a: 'mark', b: 'heal',      name: 'Пожиратель',        wow: 3, desc: 'Убийство помеченной цели лечит 15% HP.', vfx: ['SelfPulse', 'Vortex'] },
    { a: 'shock', b: 'heal',     name: 'Дефибриллятор',     wow: 2, desc: 'Каждое лечение даёт +20% скорости атаки на 3 с.', vfx: ['SelfPulse'] },
    { a: 'knockback', b: 'shield', name: 'Реактивная броня', wow: 3, desc: 'Заблокированный/поглощённый урон становится щитом.', vfx: ['ShieldFlash'] },
    { a: 'chill', b: 'shield',   name: 'Криостаз',          wow: 2, desc: 'Щит замораживает атакующих в ближнем бою.', vfx: ['FreezeShell'] },
  ],

  // ---------- VFX-примитивы (библиотека для Unity VFX Graph: один subgraph = один примитив)
  vfxPrimitives: {
    Trail:       { unity: 'VFX_Trail',       attach: 'Projectile',  props: ['ColorA', 'ColorB', 'Width'], desc: 'след снаряда, тонируется элементами' },
    TrailMulti:  { unity: 'VFX_Trail ×N',    attach: 'Projectile',  props: ['ColorA', 'ColorB', 'Width'], desc: 'следы дробин' },
    TrailReturn: { unity: 'VFX_Trail (loop)', attach: 'Projectile', props: ['ColorA', 'ColorB'], desc: 'след туда-обратно' },
    ChargeGlow:  { unity: 'VFX_Charge',      attach: 'Muzzle',      props: ['ColorA', 'Charge01'], desc: 'накопление на луке' },
    Slash:       { unity: 'VFX_Slash',       attach: 'WeaponTip',   props: ['ColorA', 'Length'], desc: 'росчерк клинка' },
    SlashArc:    { unity: 'VFX_Slash (arc)', attach: 'WeaponTip',   props: ['ColorA', 'Angle'], desc: 'дуга замаха 120°' },
    ShieldFlash: { unity: 'VFX_ShieldFlash', attach: 'Shield',      props: ['ColorA'], desc: 'вспышка блока' },
    Impact:      { unity: 'VFX_Impact',      attach: 'HitPoint',    props: ['ColorA', 'Size'], desc: 'вспышка попадания' },
    ImpactHeavy: { unity: 'VFX_Impact (heavy)', attach: 'HitPoint', props: ['ColorA', 'Size'], desc: 'тяжёлый удар с пылью' },
    Arc:         { unity: 'VFX_Arc',         attach: 'Target→Target', props: ['ColorA', 'ColorB', 'Jitter'], desc: 'дуга между двумя точками' },
    Redirect:    { unity: 'VFX_Redirect',    attach: 'HitPoint',    props: ['ColorA'], desc: 'излом траектории + искры' },
    Burst:       { unity: 'VFX_Burst',       attach: 'HitPoint',    props: ['ColorA', 'ColorB', 'Radius'], desc: 'сферический взрыв' },
    Zone:        { unity: 'VFX_Zone',        attach: 'Ground',      props: ['ColorA', 'Radius', 'Duration'], desc: 'декаль + частицы на земле' },
    Vortex:      { unity: 'VFX_Vortex',      attach: 'Point',       props: ['ColorA', 'Radius', 'Duration'], desc: 'частицы внутрь' },
    Ring:        { unity: 'VFX_Ring',        attach: 'Player',      props: ['ColorA', 'Radius'], desc: 'расширяющееся кольцо' },
    Pulse:       { unity: 'VFX_Pulse',       attach: 'Point',       props: ['ColorA', 'Radius'], desc: 'кольцо-импульс без урона' },
    Ghost:       { unity: 'VFX_Ghost',       attach: 'Player',      props: ['ColorA', 'Alpha'], desc: 'полупрозрачный дубль удара' },
    Summon:      { unity: 'VFX_Summon',      attach: 'Ground',      props: ['ColorA'], desc: 'материализация сущности' },
    Trap:        { unity: 'VFX_Trap',        attach: 'Ground',      props: ['ColorA', 'Radius'], desc: 'маркер ловушки' },
    Orbit:       { unity: 'VFX_Orbit',       attach: 'Player',      props: ['ColorA', 'Count', 'Radius'], desc: 'орбитальные снаряды' },
    StatusAura:  { unity: 'VFX_StatusAura',  attach: 'Target',      props: ['ColorA', 'Stacks'], desc: 'аура статуса на цели (цвет = элемент)' },
    SelfPulse:   { unity: 'VFX_SelfPulse',   attach: 'Player',      props: ['ColorA'], desc: 'импульс на игроке (лечение/щит)' },
    Shatter:     { unity: 'VFX_Shatter',     attach: 'Target',      props: ['ColorA', 'Radius'], desc: 'разлёт ледяных осколков' },
    Steam:       { unity: 'VFX_Steam',       attach: 'Target',      props: ['Radius'], desc: 'пар от термошока' },
    EmberTrail:  { unity: 'VFX_Ember',       attach: 'Path',        props: ['ColorA'], desc: 'искры/угли по пути' },
    HeatHaze:    { unity: 'VFX_HeatHaze',    attach: 'Target',      props: ['Radius'], desc: 'марево' },
    FrostSpark:  { unity: 'VFX_FrostSpark',  attach: 'Target',      props: ['ColorA'], desc: 'искры по льду' },
    FreezeShell: { unity: 'VFX_FreezeShell', attach: 'Target',      props: ['ColorA'], desc: 'ледяная корка' },
  },

  // Пояснение: дистанция — единственное, чем игрок управляет при автонаводке. Ближний бой игнорирует преграды, но работает только в упор;
  // винтовка и лук штрафуются в упор (closeMult) — щитовик/клинок контрит их сближением, дробовик — ловит на средней.
  rangeClasses: [ { id: 'melee', name: 'упор', max: 4 }, { id: 'close', name: 'ближняя', max: 12 }, { id: 'mid', name: 'средняя', max: 30 }, { id: 'long', name: 'дальняя', max: 999 } ],

  weaponTagNames: {
    projectile: 'снаряд', melee: 'ближний бой', fast: 'быстрое', heavy: 'тяжёлое', long: 'дальнобойное', close: 'ближняя дистанция',
    spread: 'разброс', charge: 'зарядка', pierce: 'пробитие', ricochet: 'рикошет', thrown: 'метательное', multi: 'мульти-снаряд',
    defense: 'защита', aoe: 'АоЕ', kinetic: 'кинетика', stagger: 'оглушение', sustained: 'непрерывный огонь', burst: 'бурст',
    precision: 'точность', magazine: 'магазин', silent: 'бесшумное', mobile: 'мобильное', combo: 'комбо', block: 'блок',
  },

  // ---------- Оружие. kind = базовая доставка. projSpeed 0 = ближний бой
  weapons: [
    { id: 'shuriken', name: 'Сюрикен', hands: '1h', kind: 'thrown', moduleSlots: ['core', 'barrel', 'frame'], archetype: 'Метательное / рикошет',
      dmg: 18, aps: 2.2, projectiles: 1, rangeMin: 0, rangeOpt: 8, range: 14, falloff: 0.6, closeMult: 1.0, projSpeed: 30, crit: 0.10, critMult: 1.8, mag: 0, reload: 0, mobility: 1.0,
      tags: ['projectile', 'thrown', 'fast', 'ricochet', 'multi', 'mobile', 'silent'],
      gimmick: 'Возвращается в руку: цель ближе 6 м бьётся дважды. Базовый рикошет 1 отскок.',
      notes: 'Лучший носитель «за удар»-нагрузок: много попаданий, низкий урон.' },
    { id: 'shield', name: 'Щит', hands: 'off', kind: 'block', moduleSlots: ['core', 'frame'], archetype: 'Защита / контроль',
      dmg: 25, aps: 1.0, projectiles: 1, rangeMin: 0, rangeOpt: 2.5, range: 2.5, falloff: 1.0, closeMult: 1.0, projSpeed: 0, crit: 0.0, critMult: 1.5, mag: 0, reload: 0, mobility: 0.9,
      tags: ['melee', 'defense', 'block', 'kinetic', 'stagger', 'close'],
      gimmick: 'Блок 60% спереди, снаряды противника разрушаются об щит. Удар щитом — отбрасывание.',
      notes: 'Контр-игра против автонаводки. Даёт триггер on_block.' },
    { id: 'bow', name: 'Боевой лук', hands: '2h', kind: 'charge', moduleSlots: ['core', 'barrel', 'frame'], archetype: 'Заряд / точность',
      dmg: 110, aps: 0.8, projectiles: 1, rangeMin: 6, rangeOpt: 30, range: 40, falloff: 0.8, closeMult: 0.6, projSpeed: 60, crit: 0.20, critMult: 2.2, mag: 0, reload: 0, mobility: 0.85,
      tags: ['projectile', 'charge', 'pierce', 'precision', 'long', 'silent', 'burst'],
      gimmick: 'Зарядка 0.3–1.2 с: 45→140 урона, полный заряд пробивает 1 цель.',
      notes: 'Мало попаданий, каждое — событие: носитель взрывов, воронок, критов.' },
    { id: 'gun', name: 'Боевая пушка', hands: '2h', kind: 'spread', moduleSlots: ['core', 'barrel', 'frame'], archetype: 'Дробовик / бурст',
      dmg: 12, aps: 1.1, projectiles: 8, rangeMin: 0, rangeOpt: 6, range: 10, falloff: 0.3, closeMult: 1.0, projSpeed: 45, crit: 0.05, critMult: 1.6, mag: 6, reload: 2.4, mobility: 0.9,
      tags: ['projectile', 'spread', 'burst', 'close', 'kinetic', 'stagger', 'magazine', 'multi'],
      gimmick: 'Барабан на 6. Каждая дробина — отдельный снаряд.',
      notes: '8 попаданий за выстрел → «за снаряд»-эффекты (рикошет, цепь, поджог) взлетают.' },
    { id: 'rifle', name: 'Винтовка', hands: '2h', kind: 'projectile', moduleSlots: ['core', 'barrel', 'frame'], archetype: 'Дальний бой / непрерывный',
      dmg: 32, aps: 4.0, projectiles: 1, rangeMin: 8, rangeOpt: 45, range: 55, falloff: 0.85, closeMult: 0.7, projSpeed: 120, crit: 0.15, critMult: 2.0, mag: 30, reload: 1.8, mobility: 0.9,
      tags: ['projectile', 'long', 'sustained', 'precision', 'magazine', 'fast'],
      gimmick: 'Самая быстрая пуля — почти не ловит преграды.',
      notes: 'Стабильный поток попаданий на дистанции. Носитель «магазин/перезарядка».' },
    { id: 'blade', name: 'Клинок', hands: '1h', kind: 'melee_combo', moduleSlots: ['core', 'barrel', 'frame'], archetype: 'Ближний бой / комбо',
      dmg: 28, aps: 3.0, projectiles: 1, rangeMin: 0, rangeOpt: 2.5, range: 2.5, falloff: 1.0, closeMult: 1.0, projSpeed: 0, crit: 0.12, critMult: 2.0, mag: 0, reload: 0, mobility: 1.1,
      tags: ['melee', 'fast', 'combo', 'mobile', 'close', 'silent'],
      gimmick: 'Комбо из 3, третий ×1.6. Игнорирует преграды.',
      notes: 'Быстрые удары в упор: кровотечение, фантомы, фланг.' },
    { id: 'pistol', name: 'Пистолет', hands: '1h', kind: 'projectile', moduleSlots: ['core', 'barrel', 'frame'], archetype: 'Универсал',
      dmg: 20, aps: 5.0, projectiles: 1, rangeMin: 0, rangeOpt: 14, range: 22, falloff: 0.6, closeMult: 1.0, projSpeed: 90, crit: 0.10, critMult: 1.8, mag: 15, reload: 1.2, mobility: 1.05,
      tags: ['projectile', 'fast', 'sustained', 'magazine', 'mobile'],
      gimmick: 'Стрельба не снижает скорость бега.',
      notes: 'Стартовое. Одноручка + щит = самый безопасный лоадаут.' },
    { id: 'powerbat', name: 'Силовая бита', hands: '2h', kind: 'melee_arc', moduleSlots: ['core', 'barrel', 'frame'], archetype: 'Тяжёлое / АоЕ',
      dmg: 90, aps: 0.9, projectiles: 1, rangeMin: 0, rangeOpt: 3.5, range: 3.5, falloff: 1.0, closeMult: 1.0, projSpeed: 0, crit: 0.08, critMult: 2.0, mag: 0, reload: 0, mobility: 0.85,
      tags: ['melee', 'heavy', 'aoe', 'kinetic', 'stagger', 'close'],
      gimmick: 'Дуга 120° бьёт всех. Заряженный замах отбивает снаряды.',
      notes: 'Каждое попадание задевает толпу: АоЕ-нагрузки и реакции срабатывают по многим.' },
  ],

  // ---------- Модификаторы
  // effects[]: { trigger, every?, chance?, delivery?, targets?/count?/radius?/duration?, payload?, stacks?, inherits?, condition?, dmg?, self?, upgrade? }
  // inherits: вторичная доставка несёт on_hit-нагрузки базового канала (поджог + молния = огненная молния)
  mods: [
    // ===== COMMON — статы
    { id: 'dmg_up', name: 'Калибровка', type: 'passive', rarity: 'common', tags: ['stat'], maxStacks: 5, power: 2, desc: '+8% урона.', stats: { dmgPct: 0.08 }, effects: [], weapon: {} },
    { id: 'aspd_up', name: 'Разгон', type: 'passive', rarity: 'common', tags: ['stat'], maxStacks: 5, power: 2, desc: '+8% скорости атаки.', stats: { aspdPct: 0.08 }, effects: [], weapon: { bonus: { fast: 0.3 } } },
    { id: 'crit_up', name: 'Уязвимость', type: 'passive', rarity: 'common', tags: ['stat', 'crit'], maxStacks: 5, power: 2, desc: '+5% шанс крита.', stats: { critPct: 0.05 }, effects: [], weapon: { bonus: { precision: 0.4, charge: 0.3 } } },
    { id: 'hp_up', name: 'Усиленный каркас', type: 'passive', rarity: 'common', tags: ['stat'], maxStacks: 5, power: 2, desc: '+12% макс. HP.', stats: { hpPct: 0.12 }, effects: [], weapon: {} },
    { id: 'speed_up', name: 'Сервоприводы', type: 'passive', rarity: 'common', tags: ['stat', 'mobility'], maxStacks: 4, power: 2, desc: '+6% скорости бега.', stats: { speedPct: 0.06 }, effects: [], weapon: { bonus: { melee: 0.4, mobile: 0.3 } } },
    { id: 'reload_up', name: 'Быстрый затвор', type: 'passive', rarity: 'common', tags: ['stat'], maxStacks: 4, power: 2, desc: '−12% перезарядка.', stats: { reloadPct: -0.12 }, effects: [], weapon: { requires: ['magazine'] } },
    { id: 'range_up', name: 'Удлинённый ствол', type: 'passive', rarity: 'common', tags: ['stat'], maxStacks: 3, power: 2, desc: '+10% дальности.', stats: { rangePct: 0.10 }, effects: [], weapon: { requires: ['projectile'], bonus: { long: 0.3 } } },
    { id: 'proj_speed', name: 'Ускоритель', type: 'passive', rarity: 'common', tags: ['stat'], maxStacks: 3, power: 2, desc: '+15% скорости снаряда (реже разбивается о преграды).', stats: { projSpeedPct: 0.15 }, effects: [], weapon: { requires: ['projectile'], bonus: { thrown: 0.5, charge: 0.4 } } },
    { id: 'melee_reach', name: 'Длинный замах', type: 'passive', rarity: 'common', tags: ['stat'], maxStacks: 3, power: 2, desc: '+20% радиуса ближнего боя.', stats: { rangePct: 0.20 }, effects: [], weapon: { requires: ['melee'], bonus: { aoe: 0.4 } } },
    { id: 'armor_up', name: 'Композит', type: 'passive', rarity: 'common', tags: ['stat'], maxStacks: 4, power: 2, desc: '+5% снижение урона.', stats: { drPct: 0.05 }, effects: [], weapon: { bonus: { block: 0.3 } } },
    { id: 'lifesteal_small', name: 'Нано-фильтр', type: 'passive', rarity: 'common', tags: ['sustain'], maxStacks: 3, power: 2, desc: '3% вампиризм.', stats: {}, effects: [{ trigger: 'on_hit', payload: 'heal', amount: 0.03 }], weapon: { bonus: { fast: 0.3, multi: 0.3 } } },
    { id: 'pickup', name: 'Магнит', type: 'passive', rarity: 'common', tags: ['utility'], maxStacks: 2, power: 1, desc: '+30% радиус подбора, +10% опыта.', stats: { xpPct: 0.10 }, effects: [], weapon: {} },

    // ===== UNCOMMON — нагрузки «за удар»
    { id: 'burn_touch', name: 'Термоядро', type: 'passive', rarity: 'uncommon', tags: ['onhit'], maxStacks: 1, power: 4, desc: 'Попадания поджигают.', effects: [{ trigger: 'on_hit', payload: 'burn' }], weapon: { bonus: { fast: 0.5, multi: 0.6, spread: 0.6 }, penalty: { charge: -0.3 } } },
    { id: 'frost_touch', name: 'Криокапсула', type: 'passive', rarity: 'uncommon', tags: ['onhit'], maxStacks: 1, power: 4, desc: 'Попадания накладывают обморожение.', effects: [{ trigger: 'on_hit', payload: 'chill' }], weapon: { bonus: { fast: 0.6, multi: 0.5 }, penalty: { heavy: -0.3 } } },
    { id: 'static_touch', name: 'Статика', type: 'passive', rarity: 'uncommon', tags: ['onhit'], maxStacks: 1, power: 4, desc: 'Каждое 4-е попадание — молния в ближайшего (30 урона, разряд).', effects: [{ trigger: 'on_hit', every: 4, delivery: 'chain', targets: 1, payload: 'shock', dmg: 1.0, inherits: true }], weapon: { bonus: { fast: 0.5, sustained: 0.5 } } },
    { id: 'heavy_impact', name: 'Ударная масса', type: 'passive', rarity: 'uncommon', tags: ['onhit'], maxStacks: 2, power: 3, desc: 'Попадания отбрасывают, +10% урона по оглушённым.', stats: {}, effects: [{ trigger: 'on_hit', payload: 'knockback' }], weapon: { bonus: { heavy: 0.6, stagger: 0.5, kinetic: 0.5 } } },
    { id: 'void_mark', name: 'Метка пустоты', type: 'passive', rarity: 'uncommon', tags: ['onkill'], maxStacks: 1, power: 3, desc: 'Убийство помечает ближайшего врага в 5 м.', effects: [{ trigger: 'on_kill', delivery: 'pulse', targets: 1, radius: 5, payload: 'mark' }], weapon: { bonus: { precision: 0.4, long: 0.3 } } },
    { id: 'nano_regen', name: 'Регенерация', type: 'passive', rarity: 'uncommon', tags: ['sustain'], maxStacks: 2, power: 3, desc: 'Реген 1% HP/с вне боя.', effects: [{ trigger: 'passive', payload: 'heal', amount: 0.01 }], weapon: { bonus: { long: 0.3 } } },
    { id: 'crit_dmg', name: 'Бронебойность', type: 'passive', rarity: 'uncommon', tags: ['stat', 'crit'], maxStacks: 3, power: 3, desc: '+30% множитель крита.', stats: { critMultAdd: 0.30 }, effects: [], weapon: { bonus: { precision: 0.5, charge: 0.5 } } },
    { id: 'second_wind', name: 'Аварийный щит', type: 'passive', rarity: 'uncommon', tags: ['defense'], maxStacks: 1, power: 4, desc: 'Ниже 30% HP — щит 25% (раз в 40 с).', effects: [{ trigger: 'on_low_hp', payload: 'shield', amount: 0.25 }], weapon: { bonus: { melee: 0.3, close: 0.3 } } },
    { id: 'quick_hands', name: 'Ловкие руки', type: 'passive', rarity: 'uncommon', tags: ['reload'], maxStacks: 1, power: 3, desc: '−25% перезарядка; после неё +15% скорости атаки 3 с.', stats: { reloadPct: -0.25 }, effects: [{ trigger: 'on_reload', self: '+15% скорости атаки 3 с' }], weapon: { requires: ['magazine'], bonus: { sustained: 0.4 } } },
    { id: 'glass_cannon', name: 'Стеклянная пушка', type: 'passive', rarity: 'uncommon', tags: ['stat'], maxStacks: 2, power: 3, desc: '+25% урона, −15% HP.', stats: { dmgPct: 0.25, hpPct: -0.15 }, effects: [], weapon: { bonus: { long: 0.4 }, penalty: { melee: -0.3 } } },
    { id: 'momentum', name: 'Инерция', type: 'passive', rarity: 'uncommon', tags: ['positioning'], maxStacks: 1, power: 3, desc: '+2% урона за метр пробега (макс +30%).', effects: [{ trigger: 'passive', self: 'урон растёт от движения' }], weapon: { bonus: { melee: 0.6, mobile: 0.5 }, penalty: { charge: -0.4 } } },
    { id: 'charge_speed', name: 'Форсаж', type: 'passive', rarity: 'uncommon', tags: ['stat'], maxStacks: 2, power: 3, desc: '+30% скорость зарядки/замаха.', stats: { aspdPct: 0.15 }, effects: [], weapon: { requires: ['charge', 'heavy'], requiresAny: true, bonus: { charge: 0.8, heavy: 0.6 } } },
    { id: 'backstab', name: 'Фланг', type: 'passive', rarity: 'uncommon', tags: ['positioning'], maxStacks: 1, power: 3, desc: '+25% урона по целям, которые атакуют не тебя.', effects: [{ trigger: 'passive', self: 'фланговый бонус' }], weapon: { bonus: { melee: 0.5, silent: 0.5 } } },
    { id: 'xp_up', name: 'Нейроускоритель', type: 'passive', rarity: 'uncommon', tags: ['utility'], maxStacks: 2, power: 2, desc: '+15% опыта.', stats: { xpPct: 0.15 }, effects: [], weapon: {} },

    // ===== RARE — доставки
    { id: 'ricochet', name: 'Рикошет', type: 'passive', rarity: 'rare', tags: ['delivery'], maxStacks: 2, power: 5, desc: 'Снаряды отскакивают к ближайшей цели (−30% урона).', effects: [{ trigger: 'on_hit', delivery: 'ricochet', count: 1, dmg: 0.7, inherits: true }], weapon: { requires: ['projectile'], bonus: { ricochet: 1.0, multi: 0.6, spread: 0.5 } } },
    { id: 'pierce', name: 'Пробитие', type: 'passive', rarity: 'rare', tags: ['delivery'], maxStacks: 2, power: 5, desc: 'Снаряды пробивают +1 цель.', effects: [{ trigger: 'on_hit', delivery: 'pierce', count: 1, dmg: 1, inherits: true }], weapon: { requires: ['projectile'], bonus: { pierce: 0.8, long: 0.5 } } },
    { id: 'multishot', name: 'Мультивыстрел', type: 'passive', rarity: 'rare', tags: ['stat'], maxStacks: 2, power: 5, desc: '+1 снаряд, −20% урона каждого.', stats: { projectilesAdd: 1, dmgPct: -0.20 }, effects: [], weapon: { requires: ['projectile'], bonus: { thrown: 0.6, fast: 0.4 }, penalty: { spread: -0.2 } } },
    { id: 'explosive', name: 'Разрывные', type: 'passive', rarity: 'rare', tags: ['delivery'], maxStacks: 1, power: 5, desc: 'Попадания взрываются (2 м, 30% урона), взрыв несёт твои статусы.', effects: [{ trigger: 'on_hit', delivery: 'burst', radius: 2, dmg: 0.3, inherits: true }], weapon: { requires: ['projectile'], bonus: { charge: 0.7, precision: 0.5 }, penalty: { multi: -0.2 } } },
    { id: 'chain_lightning', name: 'Цепная молния', type: 'passive', rarity: 'rare', tags: ['upgrade'], maxStacks: 1, power: 5, desc: 'Все молнии перескакивают ещё на 3 цели.', effects: [{ upgrade: { delivery: 'chain', targets: 3 } }], weapon: { bonus: { fast: 0.4, sustained: 0.4 } } },
    { id: 'shatter', name: 'Дробление', type: 'passive', rarity: 'rare', tags: ['delivery', 'crit'], maxStacks: 1, power: 5, desc: 'Крит по обмороженной цели — ледяной взрыв 4 м на 150%.', effects: [{ trigger: 'on_crit', condition: 'chill', delivery: 'burst', radius: 4, dmg: 1.5, payload: 'chill' }], weapon: { bonus: { precision: 0.5, heavy: 0.6 } } },
    { id: 'ignite_spread', name: 'Пожар', type: 'passive', rarity: 'rare', tags: ['delivery'], maxStacks: 1, power: 5, desc: 'Горящие враги при смерти взрываются огнём (3 м).', effects: [{ trigger: 'on_kill', condition: 'burn', delivery: 'burst', radius: 3, dmg: 0.5, payload: 'burn' }], weapon: { bonus: { multi: 0.4, aoe: 0.4 } } },
    { id: 'gravity_shots', name: 'Гравитация', type: 'passive', rarity: 'rare', tags: ['delivery'], maxStacks: 1, power: 5, desc: 'Попадания создают воронку 3 м.', effects: [{ trigger: 'on_hit', every: 3, delivery: 'pull', radius: 3, dmg: 0.2, inherits: true }], weapon: { bonus: { charge: 0.6, heavy: 0.7, aoe: 0.6 }, penalty: { fast: -0.3 } } },
    { id: 'bleed', name: 'Кровотечение', type: 'passive', rarity: 'rare', tags: ['onhit'], maxStacks: 1, power: 5, desc: 'Удары ближнего боя вызывают кровотечение.', effects: [{ trigger: 'on_hit', payload: 'bleed' }], weapon: { requires: ['melee'], bonus: { fast: 0.6, combo: 0.6 } } },
    { id: 'whirlwind', name: 'Вихрь', type: 'passive', rarity: 'rare', tags: ['delivery'], maxStacks: 1, power: 5, desc: 'Каждый 3-й удар — круговая волна 3 м со всеми статусами.', effects: [{ trigger: 'on_hit', every: 3, delivery: 'wave', radius: 3, dmg: 1, inherits: true }], weapon: { requires: ['melee'], bonus: { combo: 0.7, heavy: 0.5 } } },
    { id: 'shield_wave', name: 'Ударная волна', type: 'passive', rarity: 'rare', tags: ['delivery'], maxStacks: 1, power: 5, desc: 'Удар щитом выпускает волну 6 м с отбрасыванием.', effects: [{ trigger: 'on_hit', delivery: 'wave', radius: 6, dmg: 0.6, payload: 'knockback', inherits: true }], weapon: { requires: ['block'], bonus: { block: 1.0 } } },
    { id: 'reflect', name: 'Отражение', type: 'passive', rarity: 'rare', tags: ['delivery', 'pvp'], maxStacks: 1, power: 5, desc: 'Блок отражает снаряд в стрелка, снаряд несёт твои статусы.', effects: [{ trigger: 'on_block', delivery: 'reflect', dmg: 1, inherits: true }], weapon: { requires: ['block'], bonus: { block: 1.0 } } },
    { id: 'last_round', name: 'Последний патрон', type: 'passive', rarity: 'rare', tags: ['burst'], maxStacks: 1, power: 5, desc: 'Последний патрон в магазине ×3 урона.', effects: [{ trigger: 'on_reload', self: 'последний патрон ×3' }], weapon: { requires: ['magazine'], bonus: { burst: 0.8 } } },
    { id: 'homing_plus', name: 'Огибание', type: 'passive', rarity: 'rare', tags: ['utility'], maxStacks: 1, power: 6, desc: 'Снаряд один раз огибает преграду.', effects: [{ trigger: 'passive', self: 'огибание преграды' }], weapon: { requires: ['projectile'], bonus: { thrown: 0.6, long: 0.5 } } },
    { id: 'execute', name: 'Казнь', type: 'passive', rarity: 'rare', tags: ['onhit'], maxStacks: 1, power: 5, desc: 'Цели ниже 15% HP умирают от любого попадания.', effects: [{ trigger: 'on_hit', payload: 'execute' }], weapon: { bonus: { fast: 0.5, multi: 0.5 } } },
    { id: 'vampiric_crit', name: 'Кровавый крит', type: 'passive', rarity: 'rare', tags: ['crit', 'sustain'], maxStacks: 1, power: 5, desc: 'Криты лечат на 8% урона.', effects: [{ trigger: 'on_crit', payload: 'heal', amount: 0.08 }], weapon: { bonus: { precision: 0.5, charge: 0.4 } } },
    { id: 'kinetic_battery', name: 'Кинетическая батарея', type: 'passive', rarity: 'rare', tags: ['defense'], maxStacks: 1, power: 5, desc: '30% полученного/заблокированного урона добавляется к следующей атаке (с отбрасыванием).', effects: [{ trigger: 'on_block', payload: 'knockback', self: 'копит урон в следующий удар' }], weapon: { bonus: { block: 0.8, heavy: 0.6 } } },

    // ===== EPIC
    { id: 'split_on_kill', name: 'Фрагментация', type: 'passive', rarity: 'epic', tags: ['delivery'], maxStacks: 1, power: 7, desc: 'Убийство выпускает 3 осколка (40%) со статусами.', effects: [{ trigger: 'on_kill', delivery: 'split', count: 3, dmg: 0.4, inherits: true }], weapon: { requires: ['projectile'], bonus: { multi: 0.5, ricochet: 0.5 } } },
    { id: 'storm_core', name: 'Грозовое ядро', type: 'passive', rarity: 'epic', tags: ['delivery'], maxStacks: 1, power: 7, desc: 'Каждые 5 с — разряд-волна 8 м.', effects: [{ trigger: 'periodic', everySec: 5, delivery: 'wave', radius: 8, dmg: 0.8, payload: 'shock' }], weapon: { bonus: { melee: 0.5, close: 0.5 } } },
    { id: 'black_hole_kill', name: 'Коллапс', type: 'passive', rarity: 'epic', tags: ['delivery'], maxStacks: 1, power: 7, desc: 'Каждое 5-е убийство — мини-чёрная дыра 4 м на 2 с.', effects: [{ trigger: 'on_kill', every: 5, delivery: 'pull', radius: 4, duration: 2, dmg: 2, inherits: true }], weapon: { bonus: { aoe: 0.5, multi: 0.4 } } },
    { id: 'phoenix', name: 'Феникс', type: 'passive', rarity: 'epic', tags: ['revive'], maxStacks: 1, power: 7, desc: 'Смерть → огненный взрыв 6 м и возрождение 30% HP.', effects: [{ trigger: 'on_death', delivery: 'burst', radius: 6, dmg: 5, payload: 'burn' }, { trigger: 'on_death', payload: 'heal', amount: 0.3 }], weapon: {} },
    { id: 'infinite_crit', name: 'Бесконечный магазин', type: 'passive', rarity: 'epic', tags: ['crit'], maxStacks: 1, power: 7, desc: 'Криты не тратят патроны и не сбивают комбо.', effects: [{ trigger: 'passive', self: 'криты бесплатны' }], weapon: { requires: ['magazine', 'combo'], requiresAny: true, bonus: { sustained: 0.7, combo: 0.6 } } },
    { id: 'adrenaline', name: 'Адреналин', type: 'passive', rarity: 'epic', tags: ['mobility'], maxStacks: 1, power: 7, desc: 'Убийство: +5% скорости атаки и бега 4 с (×6).', effects: [{ trigger: 'on_kill', self: 'ускорение (стак ×6)' }], weapon: { bonus: { fast: 0.5, melee: 0.4 } } },
    { id: 'fortress', name: 'Крепость', type: 'passive', rarity: 'epic', tags: ['positioning'], maxStacks: 1, power: 7, desc: 'Стоишь 1 с — +40% защиты, +20% урона.', effects: [{ trigger: 'passive', self: 'бонус за неподвижность' }], weapon: { bonus: { long: 0.7, block: 0.5 }, penalty: { mobile: -0.4, melee: -0.3 } } },
    { id: 'hunter_mark', name: 'Охотник', type: 'passive', rarity: 'epic', tags: ['pvp'], maxStacks: 1, power: 7, desc: 'Элитники и игроки постоянно помечены и видны сквозь стены.', effects: [{ trigger: 'passive', payload: 'mark' }], weapon: { bonus: { long: 0.6, precision: 0.5 } } },
    { id: 'overclock', name: 'Оверклок', type: 'passive', rarity: 'epic', tags: ['cooldown'], maxStacks: 1, power: 7, desc: 'Активные способности −30% кулдаун.', stats: { cdrPct: 0.30 }, effects: [], weapon: {} },
    { id: 'twin_blade', name: 'Двойной след', type: 'passive', rarity: 'epic', tags: ['delivery'], maxStacks: 1, power: 7, desc: 'Каждый удар повторяется фантомом на 50%.', effects: [{ trigger: 'on_hit', delivery: 'echo', dmg: 0.5, inherits: true }], weapon: { requires: ['melee'], bonus: { fast: 0.6, combo: 0.6 } } },

    // ===== LEGENDARY
    { id: 'echo', name: 'Эхо', type: 'passive', rarity: 'legendary', tags: ['upgrade'], maxStacks: 1, power: 9, desc: 'Каждая активная способность срабатывает дважды.', effects: [{ upgrade: { trigger: 'on_activate', mult: 2 } }], weapon: {} },
    { id: 'omni_element', name: 'Синтез', type: 'passive', rarity: 'legendary', tags: ['upgrade'], maxStacks: 1, power: 9, desc: 'Все доставки несут все твои статусы (даже те, что не наследуют).', effects: [{ upgrade: { inheritAll: true } }], weapon: { bonus: { fast: 0.5, multi: 0.5 } } },
    { id: 'infinite_ricochet', name: 'Вечный рикошет', type: 'passive', rarity: 'legendary', tags: ['delivery'], maxStacks: 1, power: 9, desc: 'Рикошет до 5 целей без потери урона.', effects: [{ trigger: 'on_hit', delivery: 'ricochet', count: 5, dmg: 1, inherits: true }], weapon: { requires: ['projectile'], bonus: { ricochet: 1.2, multi: 0.6 } } },
    { id: 'mirror_image', name: 'Отражённый', type: 'passive', rarity: 'legendary', tags: ['delivery', 'pvp'], maxStacks: 1, power: 9, desc: 'Клон повторяет атаки на 50% и перетягивает автонаводку.', effects: [{ trigger: 'passive', delivery: 'summon', dmg: 0.5, duration: 999, inherits: true }], weapon: {} },
    { id: 'deathmark', name: 'Королевская метка', type: 'passive', rarity: 'legendary', tags: ['cooldown'], maxStacks: 1, power: 9, desc: 'Убийство помеченной цели сбрасывает все кулдауны.', effects: [{ trigger: 'on_kill', condition: 'mark', self: 'сброс кулдаунов' }], weapon: {} },
    { id: 'titan', name: 'Титан', type: 'passive', rarity: 'legendary', tags: ['defense'], maxStacks: 1, power: 9, desc: '+50% HP, иммунитет к отбрасыванию, АоЕ +40%.', stats: { hpPct: 0.5, aoeDmgPct: 0.4 }, effects: [], weapon: { bonus: { heavy: 0.8, aoe: 0.6, block: 0.4 } } },

    // ===== ACTIVE
    { id: 'dash', name: 'Рывок', type: 'active', rarity: 'uncommon', tags: ['mobility'], cooldown: 8, maxStacks: 1, power: 4, desc: 'Рывок 6 м, 0.3 с неуязвимости.', effects: [{ trigger: 'on_activate', self: 'уклонение' }], weapon: { bonus: { melee: 0.6, mobile: 0.4 } } },
    { id: 'blink', name: 'Блинк', type: 'active', rarity: 'rare', tags: ['mobility'], cooldown: 12, maxStacks: 1, power: 5, desc: 'Телепорт 8 м сквозь преграды.', effects: [{ trigger: 'on_activate', self: 'телепорт' }], weapon: { bonus: { melee: 0.5, silent: 0.4 } } },
    { id: 'grenade', name: 'Плазменная граната', type: 'active', rarity: 'uncommon', tags: ['aoe'], cooldown: 14, maxStacks: 1, power: 4, desc: 'Взрыв 4 м, 120 урона, поджог.', effects: [{ trigger: 'on_activate', delivery: 'burst', radius: 4, dmg: 4, payload: 'burn' }], weapon: {} },
    { id: 'cryo_burst', name: 'Криовзрыв', type: 'active', rarity: 'rare', tags: ['cc'], cooldown: 18, maxStacks: 1, power: 5, desc: 'Заморозка всех в 5 м на 2 с.', effects: [{ trigger: 'on_activate', delivery: 'wave', radius: 5, payload: 'chill', stacks: 5 }], weapon: { bonus: { melee: 0.6, heavy: 0.5 } } },
    { id: 'volt_trap', name: 'Вольт-ловушка', type: 'active', rarity: 'rare', tags: ['trap'], cooldown: 16, maxStacks: 1, power: 5, desc: 'Ловушка: оглушение и 150 урона.', effects: [{ trigger: 'on_activate', delivery: 'trap', radius: 2, dmg: 5, payload: 'shock' }], weapon: { bonus: { long: 0.4 } } },
    { id: 'decoy', name: 'Приманка', type: 'active', rarity: 'rare', tags: ['pvp'], cooldown: 20, maxStacks: 1, power: 5, desc: 'Голограмма 6 с: автонаводка переключается на неё.', effects: [{ trigger: 'on_activate', delivery: 'summon', duration: 6, dmg: 0 }], weapon: { bonus: { silent: 0.4 } } },
    { id: 'barrier', name: 'Барьер', type: 'active', rarity: 'uncommon', tags: ['defense'], cooldown: 22, maxStacks: 1, power: 4, desc: 'Купол 3 м на 4 с, чужие снаряды разрушаются.', effects: [{ trigger: 'on_activate', delivery: 'zone', radius: 3, duration: 4, payload: 'shield' }], weapon: { bonus: { long: 0.5 } } },
    { id: 'overdrive', name: 'Овердрайв', type: 'active', rarity: 'uncommon', tags: ['buff'], cooldown: 20, maxStacks: 1, power: 4, desc: '+50% скорости атаки 5 с.', effects: [{ trigger: 'on_activate', self: '+50% скорости атаки 5 с' }], weapon: { bonus: { fast: 0.4 } } },
    { id: 'grapple', name: 'Гарпун', type: 'active', rarity: 'rare', tags: ['mobility'], cooldown: 12, maxStacks: 1, power: 5, desc: 'Притягивает врага к тебе (или тебя к нему).', effects: [{ trigger: 'on_activate', delivery: 'pull', radius: 12, targets: 1 }], weapon: { bonus: { melee: 0.8 } } },
    { id: 'turret', name: 'Турель', type: 'active', rarity: 'epic', tags: ['summon'], cooldown: 30, maxStacks: 1, power: 6, desc: 'Турель 10 с, стреляет твоими статусами.', effects: [{ trigger: 'on_activate', delivery: 'summon', duration: 10, dmg: 0.8, inherits: true }], weapon: {} },
    { id: 'smoke', name: 'Дымовая завеса', type: 'active', rarity: 'rare', tags: ['pvp'], cooldown: 18, maxStacks: 1, power: 5, desc: 'Облако 6 м на 5 с: автонаводка внутри не работает.', effects: [{ trigger: 'on_activate', delivery: 'zone', radius: 6, duration: 5, dmg: 0 }], weapon: { bonus: { melee: 0.6 } } },
    { id: 'shockwave', name: 'Сейсмический удар', type: 'active', rarity: 'uncommon', tags: ['aoe'], cooldown: 12, maxStacks: 1, power: 4, desc: 'Отбрасывание всех в 5 м, 80 урона.', effects: [{ trigger: 'on_activate', delivery: 'wave', radius: 5, dmg: 2.5, payload: 'knockback' }], weapon: { bonus: { heavy: 0.6 } } },
    { id: 'nano_pulse', name: 'Нано-импульс', type: 'active', rarity: 'uncommon', tags: ['heal'], cooldown: 25, maxStacks: 1, power: 4, desc: 'Лечение 30% HP.', effects: [{ trigger: 'on_activate', payload: 'heal', amount: 0.3 }], weapon: {} },
    { id: 'salvo', name: 'Залп', type: 'active', rarity: 'epic', tags: ['burst'], cooldown: 24, maxStacks: 1, power: 6, desc: '3 с каждая атака ×3 снаряда.', effects: [{ trigger: 'on_activate', self: '×3 снаряда 3 с' }], weapon: { requires: ['projectile'], bonus: { multi: 0.5 } } },

    // ===== ULTIMATE
    { id: 'orbital', name: 'Орбитальный удар', type: 'ultimate', rarity: 'legendary', tags: ['aoe'], maxStacks: 1, power: 10, charge: 'Нанести 3000 урона, не получив урона.', desc: 'Удар 10 м: 1500 урона, поджог.', effects: [{ trigger: 'on_ult', delivery: 'burst', radius: 10, dmg: 40, payload: 'burn' }], weapon: { bonus: { long: 0.5 } } },
    { id: 'time_stop', name: 'Стазис-поле', type: 'ultimate', rarity: 'legendary', tags: ['cc'], maxStacks: 1, power: 10, charge: '10 уклонений/блоков подряд.', desc: 'Все в 15 м заморожены на 4 с.', effects: [{ trigger: 'on_ult', delivery: 'wave', radius: 15, payload: 'chill', stacks: 5 }], weapon: { bonus: { block: 0.6 } } },
    { id: 'thunder_god', name: 'Громовержец', type: 'ultimate', rarity: 'legendary', tags: ['chain'], maxStacks: 1, power: 10, charge: '50 попаданий молниями.', desc: '8 с каждое попадание — цепная молния на 5 целей.', effects: [{ trigger: 'on_hit', delivery: 'chain', targets: 5, payload: 'shock', dmg: 1, inherits: true, ultWindow: 8 }], weapon: { bonus: { fast: 0.6 } } },
    { id: 'singularity', name: 'Сингулярность', type: 'ultimate', rarity: 'legendary', tags: ['aoe'], maxStacks: 1, power: 10, charge: '5 убийств помеченных целей.', desc: 'Чёрная дыра 8 м 4 с, затем взрыв 1000.', effects: [{ trigger: 'on_ult', delivery: 'pull', radius: 8, duration: 4, dmg: 25, inherits: true }], weapon: {} },
    { id: 'juggernaut', name: 'Джаггернаут', type: 'ultimate', rarity: 'legendary', tags: ['defense'], maxStacks: 1, power: 10, charge: 'Поглотить 500 урона щитом/бронёй.', desc: '8 с неуязвимость, каждый шаг — волна отбрасывания.', effects: [{ trigger: 'on_ult', delivery: 'wave', radius: 3, payload: 'knockback', dmg: 1, repeatSec: 0.5, duration: 8 }], weapon: { bonus: { block: 0.8, heavy: 0.6 } } },
    { id: 'overheal_nova', name: 'Нова', type: 'ultimate', rarity: 'legendary', tags: ['heal'], maxStacks: 1, power: 10, charge: 'Восстановить 400 HP.', desc: 'Полное лечение, оверхил — взрыв 8 м.', effects: [{ trigger: 'on_ult', payload: 'heal', amount: 1 }, { trigger: 'on_ult', delivery: 'burst', radius: 8, dmg: 10 }], weapon: {} },
    { id: 'ghost_protocol', name: 'Протокол-призрак', type: 'ultimate', rarity: 'legendary', tags: ['pvp'], maxStacks: 1, power: 10, charge: 'Убить элитника, не получив урона.', desc: '6 с невидимости, крит 100%.', effects: [{ trigger: 'on_ult', self: 'невидимость + крит 100%' }], weapon: { bonus: { silent: 0.8 } } },
  ],

  // ---------- МОДУЛИ ОРУЖИЯ — встраиваются в слоты оружия (мета), участвуют в синергии наравне с модами
  // slot: core (ядро — статус на попадание), barrel (излучатель — доставка), frame (каркас — статы/утилити)
  moduleSlots: { core: 'Ядро', barrel: 'Излучатель', frame: 'Каркас' },
  modules: [
    { id: 'core_plasma', name: 'Плазменное ядро', slot: 'core', rarity: 'uncommon', power: 3, desc: 'Каждое 2-е попадание поджигает.', effects: [{ trigger: 'on_hit', every: 2, payload: 'burn' }], weapon: { bonus: { fast: 0.4, multi: 0.4 } } },
    { id: 'core_cryo', name: 'Крио-ядро', slot: 'core', rarity: 'uncommon', power: 3, desc: 'Каждое 2-е попадание — обморожение.', effects: [{ trigger: 'on_hit', every: 2, payload: 'chill' }], weapon: { bonus: { fast: 0.4, multi: 0.4 } } },
    { id: 'core_volt', name: 'Вольт-ядро', slot: 'core', rarity: 'uncommon', power: 3, desc: 'Каждое 6-е попадание — молния с разрядом в ближайшего.', effects: [{ trigger: 'on_hit', every: 6, delivery: 'chain', targets: 1, payload: 'shock', dmg: 0.6, inherits: true }], weapon: { bonus: { sustained: 0.4 } } },
    { id: 'core_void', name: 'Пустотное ядро', slot: 'core', rarity: 'uncommon', power: 3, desc: 'Убийство помечает ближайшего врага.', effects: [{ trigger: 'on_kill', delivery: 'pulse', targets: 1, radius: 6, payload: 'mark' }], weapon: { bonus: { precision: 0.4 } } },
    { id: 'core_kinetic', name: 'Кинетическое ядро', slot: 'core', rarity: 'uncommon', power: 3, desc: 'Каждое 3-е попадание отбрасывает.', effects: [{ trigger: 'on_hit', every: 3, payload: 'knockback' }], weapon: { bonus: { heavy: 0.5, stagger: 0.4 } } },
    { id: 'core_nano', name: 'Нано-ядро', slot: 'core', rarity: 'uncommon', power: 3, desc: '2% вампиризм.', effects: [{ trigger: 'on_hit', payload: 'heal', amount: 0.02 }], weapon: {} },
    { id: 'core_omni', name: 'Резонансное ядро', slot: 'core', rarity: 'legendary', power: 8, desc: 'Все статусы накладываются в 2 стака.', effects: [{ trigger: 'passive', self: 'все статусы ×2 стака' }], stats: { dmgPct: 0.05 }, weapon: {} },
    { id: 'barrel_ricochet', name: 'Рикошетный излучатель', slot: 'barrel', rarity: 'rare', power: 4, desc: 'Снаряд 1 раз отскакивает (−40% урона), несёт статусы.', effects: [{ trigger: 'on_hit', delivery: 'ricochet', count: 1, dmg: 0.6, inherits: true }], weapon: { requires: ['projectile'], bonus: { thrown: 0.6, spread: 0.4 } } },
    { id: 'barrel_split', name: 'Расщепитель', slot: 'barrel', rarity: 'rare', power: 4, desc: '+1 снаряд, −15% урона каждого.', effects: [], stats: { projectilesAdd: 1, dmgPct: -0.15 }, weapon: { requires: ['projectile'], bonus: { fast: 0.4 } } },
    { id: 'barrel_pierce', name: 'Пробойник', slot: 'barrel', rarity: 'rare', power: 4, desc: 'Снаряд пробивает +1 цель.', effects: [{ trigger: 'on_hit', delivery: 'pierce', count: 1, dmg: 0.8, inherits: true }], weapon: { requires: ['projectile'], bonus: { long: 0.5, charge: 0.4 } } },
    { id: 'barrel_burst', name: 'Разрывной излучатель', slot: 'barrel', rarity: 'rare', power: 4, desc: 'Каждое 4-е попадание — взрыв 1.5 м (20%) со статусами.', effects: [{ trigger: 'on_hit', every: 4, delivery: 'burst', radius: 1.5, dmg: 0.2, inherits: true }], weapon: { requires: ['projectile'], bonus: { charge: 0.6, precision: 0.4 } } },
    { id: 'barrel_gravity', name: 'Гравитационный излучатель', slot: 'barrel', rarity: 'epic', power: 5, desc: 'Крит создаёт воронку 2 м.', effects: [{ trigger: 'on_crit', delivery: 'pull', radius: 2, dmg: 0.2, inherits: true }], weapon: { bonus: { precision: 0.5, heavy: 0.5 } } },
    { id: 'barrel_resonator', name: 'Резонатор', slot: 'barrel', rarity: 'epic', power: 5, desc: 'Все молнии: +1 цель.', effects: [{ upgrade: { delivery: 'chain', targets: 1 } }], weapon: {} },
    { id: 'barrel_phantom', name: 'Фантомное лезвие', slot: 'barrel', rarity: 'rare', power: 4, desc: 'Каждый 4-й удар повторяется фантомом (40%).', effects: [{ trigger: 'on_hit', every: 4, delivery: 'echo', dmg: 0.4, inherits: true }], weapon: { requires: ['melee'], bonus: { combo: 0.5 } } },
    { id: 'barrel_shockwave', name: 'Ударный излучатель', slot: 'barrel', rarity: 'rare', power: 4, desc: 'Каждый 5-й удар — волна 3 м (50%) со статусами.', effects: [{ trigger: 'on_hit', every: 5, delivery: 'wave', radius: 3, dmg: 0.5, inherits: true }], weapon: { requires: ['melee'], bonus: { heavy: 0.6, aoe: 0.4 } } },
    { id: 'frame_light', name: 'Лёгкий каркас', slot: 'frame', rarity: 'common', power: 2, desc: '+10% скорости атаки, +5% бега.', effects: [], stats: { aspdPct: 0.10, speedPct: 0.05 }, weapon: { bonus: { fast: 0.3, mobile: 0.3 } } },
    { id: 'frame_heavy', name: 'Тяжёлый каркас', slot: 'frame', rarity: 'common', power: 2, desc: '+15% урона, −5% мобильности.', effects: [], stats: { dmgPct: 0.15 }, weapon: { bonus: { heavy: 0.4, charge: 0.3 } } },
    { id: 'frame_stabilizer', name: 'Стабилизатор', slot: 'frame', rarity: 'uncommon', power: 3, desc: '+10% крита.', effects: [], stats: { critPct: 0.10 }, weapon: { bonus: { precision: 0.5 } } },
    { id: 'frame_mag', name: 'Расширенный магазин', slot: 'frame', rarity: 'uncommon', power: 3, desc: '−30% перезарядка.', effects: [], stats: { reloadPct: -0.30 }, weapon: { requires: ['magazine'] } },
    { id: 'frame_homing', name: 'Огибающий каркас', slot: 'frame', rarity: 'epic', power: 5, desc: 'Снаряд огибает преграду 1 раз.', effects: [{ trigger: 'passive', self: 'огибание преграды' }], weapon: { requires: ['projectile'], bonus: { thrown: 0.5, long: 0.4 } } },
    // дальность: rangePct (макс+опт), rangeOptPct (только опт), rangeMinAdd (м, минус = ближе), falloffAdd (спад на максимуме), closeMultAdd (штраф в упор)
    { id: 'frame_longbarrel', name: 'Удлинённый ствол', slot: 'frame', rarity: 'uncommon', power: 3, desc: '+25% дальности, спад на максимуме мягче.', effects: [], stats: { rangePct: 0.25, falloffAdd: 0.15 }, weapon: { requires: ['projectile'], bonus: { long: 0.5, precision: 0.3 } } },
    { id: 'frame_compensator', name: 'Компенсатор', slot: 'frame', rarity: 'rare', power: 4, desc: 'Убирает штраф в упор: минимальная дистанция −8 м.', effects: [], stats: { rangeMinAdd: -8, closeMultAdd: 0.4 }, weapon: { requires: ['charge', 'long'], requiresAny: true, bonus: { long: 0.6, charge: 0.6 } } },
    { id: 'barrel_choke', name: 'Чок', slot: 'barrel', rarity: 'rare', power: 4, desc: 'Разброс уже: +40% дальности и оптимума, −1 снаряд.', effects: [], stats: { rangePct: 0.4, projectilesAdd: -1 }, weapon: { requires: ['spread'] } },
    { id: 'frame_scope', name: 'Прицельный модуль', slot: 'frame', rarity: 'epic', power: 5, desc: 'Оптимальная дистанция +30%, крит +5%, но −10% скорости атаки.', effects: [], stats: { rangeOptPct: 0.3, critPct: 0.05, aspdPct: -0.1 }, weapon: { requires: ['projectile'], bonus: { long: 0.5, precision: 0.5 } } },
    { id: 'frame_reach', name: 'Телескопическая рукоять', slot: 'frame', rarity: 'uncommon', power: 3, desc: '+35% радиуса ближнего боя.', effects: [], stats: { rangePct: 0.35 }, weapon: { requires: ['melee'], bonus: { heavy: 0.4, aoe: 0.4 } } },
    { id: 'frame_reactive', name: 'Реактивная пластина', slot: 'frame', rarity: 'rare', power: 4, desc: 'Блок даёт щит 5% HP.', effects: [{ trigger: 'on_block', payload: 'shield', amount: 0.05 }], weapon: { requires: ['block'] } },
  ],

  // ---------- ПРЕДМЕТЫ — подбираются на карте, 1 слот, между катками не сохраняются
  // uses: зарядов; эффекты по той же схеме (trigger: on_use). Категории: боевой / выживание / информация / экономика / PvP
  items: [
    { id: 'it_cryo_grenade', name: 'Криогранаты', cat: 'боевой', rarity: 'uncommon', uses: 2, power: 4, desc: 'Заморозка всех в 5 м на 2 с.', effects: [{ trigger: 'on_use', delivery: 'wave', radius: 5, payload: 'chill', stacks: 5 }] },
    { id: 'it_thermite', name: 'Термитная шашка', cat: 'боевой', rarity: 'uncommon', uses: 2, power: 4, desc: 'Горящая зона 3 м на 6 с.', effects: [{ trigger: 'on_use', delivery: 'zone', radius: 3, duration: 6, dmg: 0.5, payload: 'burn' }] },
    { id: 'it_emp', name: 'ЭМИ-граната', cat: 'PvP', rarity: 'rare', uses: 1, power: 6, desc: 'Разряд 6 м; у всех в радиусе (и игроков) отключена автонаводка на 3 с.', effects: [{ trigger: 'on_use', delivery: 'burst', radius: 6, dmg: 1, payload: 'shock', self: 'автонаводка врагов отключена 3 с' }] },
    { id: 'it_gravity_mine', name: 'Гравитационная мина', cat: 'боевой', rarity: 'rare', uses: 1, power: 5, desc: 'Мина: при срабатывании стягивает всех в 4 м на 2 с.', effects: [{ trigger: 'on_use', delivery: 'trap', radius: 4, duration: 2, dmg: 1.5 }] },
    { id: 'it_resonance', name: 'Резонансный заряд', cat: 'боевой', rarity: 'epic', uses: 1, power: 8, desc: 'Взрыв 5 м, несёт ВСЕ твои статусы — одна кнопка запускает все реакции билда.', effects: [{ trigger: 'on_use', delivery: 'burst', radius: 5, dmg: 3, inherits: true }] },
    { id: 'it_medkit', name: 'Аптечка', cat: 'выживание', rarity: 'common', uses: 1, power: 3, desc: 'Лечение 50% HP за 3 с.', effects: [{ trigger: 'on_use', payload: 'heal', amount: 0.5 }] },
    { id: 'it_nanoshield', name: 'Нано-щит', cat: 'выживание', rarity: 'uncommon', uses: 1, power: 4, desc: 'Щит 30% HP на 10 с.', effects: [{ trigger: 'on_use', payload: 'shield', amount: 0.3 }] },
    { id: 'it_smoke', name: 'Дымовая шашка', cat: 'PvP', rarity: 'common', uses: 2, power: 3, desc: 'Облако 5 м на 5 с: автонаводка внутри не работает ни у кого.', effects: [{ trigger: 'on_use', delivery: 'zone', radius: 5, duration: 5, dmg: 0 }] },
    { id: 'it_hologram', name: 'Голограмма', cat: 'PvP', rarity: 'rare', uses: 1, power: 5, desc: 'Копия тебя на 8 с, автонаводка врагов и игроков переключается на неё.', effects: [{ trigger: 'on_use', delivery: 'summon', duration: 8, dmg: 0 }] },
    { id: 'it_stim', name: 'Стимулятор', cat: 'боевой', rarity: 'uncommon', uses: 1, power: 4, desc: '+30% скорости атаки и бега на 8 с.', effects: [{ trigger: 'on_use', self: '+30% скорости атаки и бега 8 с' }] },
    { id: 'it_radar', name: 'Радар-пульсар', cat: 'информация', rarity: 'uncommon', uses: 2, power: 4, desc: 'Показывает элитников, игроков и артефакты в 80 м на 10 с.', effects: [{ trigger: 'on_use', self: 'разведка 80 м' }] },
    { id: 'it_evac_beacon', name: 'Маяк эвакуации', cat: 'экономика', rarity: 'rare', uses: 1, power: 6, desc: 'Вызывает точку эвакуации рядом (60 с ожидания, видно всем).', effects: [{ trigger: 'on_use', self: 'точка эвакуации здесь через 60 с' }] },
    { id: 'it_reroll_token', name: 'Жетон реролла', cat: 'экономика', rarity: 'rare', uses: 1, power: 5, desc: 'Бесплатный реролл слота у автомата (редкость слота сохраняется).', effects: [{ trigger: 'on_use', self: 'реролл без артефакта' }] },
    { id: 'it_xp_booster', name: 'Нейробустер', cat: 'экономика', rarity: 'uncommon', uses: 1, power: 4, desc: '+1 уровень мгновенно.', effects: [{ trigger: 'on_use', self: '+1 уровень' }] },
    { id: 'it_artifact_scanner', name: 'Сканер артефактов', cat: 'информация', rarity: 'uncommon', uses: 1, power: 3, desc: 'Подсвечивает артефакты rare+ в 150 м на 20 с.', effects: [{ trigger: 'on_use', self: 'скан артефактов 150 м' }] },
    { id: 'it_ult_charge', name: 'Ядро-ускоритель', cat: 'боевой', rarity: 'epic', uses: 1, power: 7, desc: 'Ульта заряжена мгновенно.', effects: [{ trigger: 'on_use', self: 'заряд ульты 100%' }] },
    { id: 'it_overload', name: 'Перегрузка', cat: 'боевой', rarity: 'epic', uses: 1, power: 7, desc: '10 с все активные способности без кулдауна.', effects: [{ trigger: 'on_use', self: 'кулдауны активок 0 на 10 с' }] },
  ],

  meta: {
    currencies: [
      { id: 'scrap', name: 'Лом', source: 'Обычный лут, ящики, караваны.', sink: 'Уровни зданий, тиры оружия.' },
      { id: 'essence', name: 'Эссенция', source: 'Вывезенные артефакты (по редкости).', sink: 'Исследования модов в Лаборатории.' },
      { id: 'core', name: 'Ядро босса', source: 'Главный босс.', sink: 'Ульта-слот, T5, уникальные постройки.' },
      { id: 'blueprint', name: 'Чертёж', source: 'Элитники, караваны.', sink: 'Открытие оружия.' },
    ],
    principles: [
      'Мета — горизонталь: шире пул, больше опций. Вертикаль ≤ +15% на максимуме.',
      'Артефакт — главный конфликт катки: реролл сейчас или эссенция в мету.',
      'Выдача модов (зафиксировано): 1) оружие + модуль формируют пул — несовместимое не падает, совместимое весит больше; 2) умный драфт — после первого оффера веса смещаются к модам, дающим новую реакцию или композит с тем, что уже есть; 3) превью в оффере — «станет Огненной молнией, откроет Плазменную дугу»; 4) пики на уровнях 5/10/14 — три мода на редкость выше; 5) бан-жетоны с карты — убрать мод из своих офферов до конца катки. Пул до катки НЕ курируется: лаборатория только открывает моды в общий пул.',
      'Ульта-слот открывается в мете за ядро босса.',
      'Слоты в катке: 5 пассивок + 3 актива + 1 ульта = 9 выборов → к 10-му уровню билд собран, на 10-м оффер целиком из ульт. Мало слотов = мало одновременных статусов = читаемый VFX; вау-эффект достигается глубиной (наследование, реакции), а не количеством.',
      'Предметы: 1 слот, подбираются на карте, не сохраняются между катками. Это «джокер» катки: боевые (заморозка, резонансный заряд со всеми статусами билда), выживание, информация (радар, сканер артефактов), экономика (маяк эвакуации, жетон реролла, +1 уровень), PvP (ЭМИ, дым, голограмма — все ломают автонаводку).',
      'Тиры оружия T1–T5: +3% за тир и черта на T3/T5.',
      'Модули оружия — мета-слой синергии: ядро (статус), излучатель (доставка), каркас (статы). Слоты открываются тирами: T1 — ядро, T3 — излучатель, T5 — каркас. Модуль выбирается до катки и задаёт стартовый элемент билда — игрок драфтит моды под него.',
    ],
    buildings: [
      { id: 'workshop', name: 'Мастерская', desc: 'Открытие и прокачка оружия.', levels: [
        { cost: { scrap: 0 }, unlock: 'Пистолет и Клинок. Тир до T2.' },
        { cost: { scrap: 800 }, unlock: 'Оружие по чертежам (Сюрикен, Щит, Пушка). T3.' },
        { cost: { scrap: 2500, essence: 100 }, unlock: 'Лук, Винтовка, Бита. T4.' },
        { cost: { scrap: 6000, essence: 400, core: 1 }, unlock: 'T5 + вторая черта.' } ] },
      { id: 'lab', name: 'Лаборатория', desc: 'Открытия: исследованный мод навсегда добавляется в общий пул катки. Кураторства нет — сюрприз сохраняется.', levels: [
        { cost: { scrap: 0 }, unlock: 'Стартовый пул: все common + 6 uncommon. 1 исследование за раз.' },
        { cost: { scrap: 1200, essence: 80 }, unlock: 'Исследования rare. Стартовый common-мод на выбор при высадке.' },
        { cost: { scrap: 3000, essence: 300 }, unlock: 'Исследования epic. 2 параллельных исследования.' },
        { cost: { scrap: 7000, essence: 900, core: 1 }, unlock: 'Исследования legendary и ульт (только за ядра босса).' } ] },
      { id: 'vault', name: 'Хранилище', desc: 'Артефакты и конверсия.', levels: [
        { cost: { scrap: 0 }, unlock: '20 артефактов. Конверсия ×1.0.' },
        { cost: { scrap: 1500 }, unlock: '60. Страховка 1 артефакта при смерти.' },
        { cost: { scrap: 4000, essence: 250 }, unlock: '×1.25. 1 артефакт можно брать в катку.' } ] },
      { id: 'medbay', name: 'Медблок', desc: 'Малая вертикаль живучести.', levels: [
        { cost: { scrap: 600 }, unlock: '+5% HP.' }, { cost: { scrap: 2000, essence: 100 }, unlock: '+10% HP, реген вне боя.' }, { cost: { scrap: 5000, essence: 300 }, unlock: '+15% HP, 1 аварийный щит.' } ] },
      { id: 'radar', name: 'Радар', desc: 'Информация об острове.', levels: [
        { cost: { scrap: 900 }, unlock: 'Точки эвакуации с начала.' }, { cost: { scrap: 2500, essence: 150 }, unlock: 'Караваны и таймер элитников.' }, { cost: { scrap: 6000, essence: 500 }, unlock: 'Босс и пинг игроков рядом.' } ] },
      { id: 'hangar', name: 'Ангар', desc: 'Эвакуация.', levels: [
        { cost: { scrap: 1000 }, unlock: 'Эвакуация −20% времени.' }, { cost: { scrap: 3500, essence: 200 }, unlock: 'Доп. точка эвакуации.' }, { cost: { scrap: 8000, essence: 600, core: 2 }, unlock: 'Экстренная эвакуация 1/катку.' } ] },
      { id: 'reactor', name: 'Реактор', desc: 'Ульта-слот.', levels: [
        { cost: { scrap: 3000, essence: 300, core: 1 }, unlock: 'Слот ультимейта.' }, { cost: { scrap: 8000, essence: 1000, core: 3 }, unlock: 'Условие заряда −25%.' } ] },
    ],
    weaponTiers: [
      { tier: 1, cost: { scrap: 0 }, bonus: 'База.' }, { tier: 2, cost: { scrap: 500 }, bonus: '+3%.' }, { tier: 3, cost: { scrap: 1500, essence: 60 }, bonus: '+6%, первая черта.' },
      { tier: 4, cost: { scrap: 4000, essence: 200 }, bonus: '+9%.' }, { tier: 5, cost: { scrap: 9000, essence: 600, core: 1 }, bonus: '+12%, вторая черта.' },
    ],
    runLoop: [
      { phase: 'Высадка', minutes: '0–1', text: 'Все на уровне 1, стартовое оружие из меты.' },
      { phase: 'Лут и фарм', minutes: '1–6', text: 'Обычные враги, common/uncommon артефакты, уровни 1–5.' },
      { phase: 'Элитники', minutes: '6–11', text: 'Rare/epic артефакты, чертежи, уровни 6–10. Первые PvP-стычки.' },
      { phase: 'Караваны', minutes: '9–14', text: 'Караваны по маршрутам — точка конфликта игроков.' },
      { phase: 'Босс', minutes: '13–18', text: 'Главный босс в центре. Ядро, legendary артефакт. Пик билдов.' },
      { phase: 'Эвакуация', minutes: '15–20', text: 'Бег к точке с лутом.' },
    ],
  },
};
