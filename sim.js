// Standalone balance simulation script (not part of shipped game). Mirrors formulas from
// data.js (hero leveling / title / equip) and battle.js (_calcDamage) to compute realistic
// hero stats at benchmark levels, then evaluate enemy stat candidates against them.

const HERO_BASE = {
  liubei: { atk: 20, hp: 600, def: 8 },
  guanyu: { atk: 35, hp: 500, def: 6 },
  zhangfei: { atk: 30, hp: 550, def: 8 },
  zhaoyun: { atk: 32, hp: 520, def: 7 },
  machao: { atk: 34, hp: 540, def: 7 },
  huangzhong: { atk: 38, hp: 480, def: 5 },
  huangyueying: { atk: 24, hp: 480, def: 6 },
  sunshangxiang: { atk: 30, hp: 470, def: 5 },
  taishici: { atk: 33, hp: 510, def: 7 },
  zhenji: { atk: 22, hp: 460, def: 6 },
  diaochan: { atk: 28, hp: 450, def: 5 },
  zhurong: { atk: 34, hp: 560, def: 9 }
}

// heroLevel: level per upgradeHero(); atk/hp *= 1.15^(level-1), def constant
function heroStats(id, level, { titleAtk = 0, titleHp = 0, titleDef = 0, allAttr = 0, equipAtk = 0, equipHp = 0, equipDef = 0, skillDmgPct = 0 } = {}) {
  const b = HERO_BASE[id]
  const mult = Math.pow(1.15, level - 1)
  const allAttrMult = 1 + allAttr / 100
  const atk = Math.round((b.atk * mult + titleAtk) * allAttrMult) + equipAtk
  const hp = Math.round((b.hp * mult + titleHp) * allAttrMult) + equipHp
  const def = Math.round((b.def + titleDef) * allAttrMult) + equipDef
  const damageBonus = 1 + skillDmgPct / 100
  return { id, level, atk, hp, def, damageBonus }
}

function baseDamage(atk, def) { return Math.max(1, atk - def) }
// average finalDamage (fluctuation midpoint 1.0 instead of 0.9-1.1 range, for expected-value calc)
function avgDamage(atk, def, skillMult = 1, damageBonus = 1) {
  return baseDamage(atk, def) * skillMult * damageBonus
}

function printHero(h) {
  console.log(`  ${h.id} L${h.level}: atk=${h.atk} hp=${h.hp} def=${h.def} dmgBonus=${h.damageBonus.toFixed(2)}`)
}

console.log('=== Benchmark A: Chapter1 stage5 (1-5), heroes level 5-8, starter title only ===')
const A_TITLE = { titleAtk: 5 } // chuchumaolu
const teamA5 = ['liubei', 'guanyu', 'zhangfei'].map(id => heroStats(id, 5, A_TITLE))
const teamA8 = ['liubei', 'guanyu', 'zhangfei'].map(id => heroStats(id, 8, A_TITLE))
teamA5.forEach(printHero)
teamA8.forEach(printHero)

console.log('\n=== Benchmark B: Chapter2 stage5 (2-5), heroes level 12-15, quality3 title + quality2-3 equip ===')
const B_TITLE = { titleAtk: 20, titleHp: 200 } // changshanyingjie q3
const B_EQUIP = { equipAtk: 25, equipHp: 100 } // ~blue gear avg
const teamB12 = ['liubei', 'guanyu', 'zhangfei', 'zhaoyun'].map(id => heroStats(id, 12, { ...B_TITLE, ...B_EQUIP }))
const teamB15 = ['liubei', 'guanyu', 'zhangfei', 'zhaoyun'].map(id => heroStats(id, 15, { ...B_TITLE, ...B_EQUIP }))
teamB12.forEach(printHero)
teamB15.forEach(printHero)

console.log('\n=== Benchmark C: Chapter3 stage5 (3-5), heroes level 20 + red exclusive equip, quality5 title ===')
const C_TITLE = { titleAtk: 40, titleHp: 500, allAttr: 0 /* zhanshen: atk40 hp500 skillDmg25 (title skillDmg handled separately) */ }
function redEquipStats(atkBonus, hpBonus, defBonus, skillPct) {
  return { equipAtk: atkBonus, equipHp: hpBonus, equipDef: defBonus, skillDmgPct: skillPct + 25 /* + title skillDmg 25% (zhanshen) */ }
}
const teamC = [
  heroStats('guanyu', 20, { ...C_TITLE, ...redEquipStats(80, 280, 8, 150) }),
  heroStats('zhangfei', 20, { ...C_TITLE, ...redEquipStats(75, 350, 12, 150) }),
  heroStats('zhaoyun', 20, { ...C_TITLE, ...redEquipStats(78, 300, 8, 150) })
]
teamC.forEach(printHero)

console.log('\n\n========== DERIVING MINION TARGETS PER STAGE ANCHOR ==========')

// Rough per-stage hero-level anchors reflecting expected player progression through the campaign.
// Guards at each chapter's boss stage (stage5) intentionally reuse the stage1 anchor's minion
// strength (existing design: boss carries the difficulty, guards stay low), so only stage1-4
// anchors need fresh minion numbers; stage5 guards = stage1 numbers.
const ANCHORS = [
  // chapter1: starter title only, no equip, 3-hero team
  { chapter: 1, stage: 1, level: 1, heroes: ['liubei', 'guanyu', 'zhangfei'], opts: { titleAtk: 5 } },
  { chapter: 1, stage: 2, level: 2, heroes: ['liubei', 'guanyu', 'zhangfei'], opts: { titleAtk: 5 } },
  { chapter: 1, stage: 3, level: 3, heroes: ['liubei', 'guanyu', 'zhangfei'], opts: { titleAtk: 5 } },
  { chapter: 1, stage: 4, level: 4, heroes: ['liubei', 'guanyu', 'zhangfei'], opts: { titleAtk: 5 } },
  // chapter2: quality3 title + modest (quality2-ish) equip, 4-hero team
  { chapter: 2, stage: 1, level: 9, heroes: ['liubei', 'guanyu', 'zhangfei', 'zhaoyun'], opts: { titleAtk: 20, titleHp: 200, equipAtk: 22, equipHp: 70 } },
  { chapter: 2, stage: 2, level: 10, heroes: ['liubei', 'guanyu', 'zhangfei', 'zhaoyun'], opts: { titleAtk: 20, titleHp: 200, equipAtk: 22, equipHp: 70 } },
  { chapter: 2, stage: 3, level: 11, heroes: ['liubei', 'guanyu', 'zhangfei', 'zhaoyun'], opts: { titleAtk: 20, titleHp: 200, equipAtk: 22, equipHp: 70 } },
  { chapter: 2, stage: 4, level: 12, heroes: ['liubei', 'guanyu', 'zhangfei', 'zhaoyun'], opts: { titleAtk: 20, titleHp: 200, equipAtk: 22, equipHp: 70 } },
  // chapter3 non-boss: quality4 title (+skillDmg10) + quality4-ish equip, 3-4 hero team
  { chapter: 3, stage: 1, level: 16, heroes: ['liubei', 'guanyu', 'zhangfei', 'zhaoyun'], opts: { titleAtk: 30, titleHp: 300, skillDmgPct: 10, equipAtk: 50, equipHp: 250 } },
  { chapter: 3, stage: 2, level: 17, heroes: ['liubei', 'guanyu', 'zhangfei', 'zhaoyun'], opts: { titleAtk: 30, titleHp: 300, skillDmgPct: 10, equipAtk: 50, equipHp: 250 } },
  { chapter: 3, stage: 3, level: 18, heroes: ['liubei', 'guanyu', 'zhangfei', 'zhaoyun'], opts: { titleAtk: 30, titleHp: 300, skillDmgPct: 10, equipAtk: 50, equipHp: 250 } },
  { chapter: 3, stage: 4, level: 19, heroes: ['liubei', 'guanyu', 'zhangfei', 'zhaoyun'], opts: { titleAtk: 30, titleHp: 300, skillDmgPct: 10, equipAtk: 50, equipHp: 250 } }
]

// minion def per chapter (kept low/flat, roughly matching old proportion growth)
const MINION_DEF = { 1: 4, 2: 12, 3: 24 }
const HITS_TO_KILL_HERO = 4   // mid of "3-5"
const HITS_TO_DIE_TO_HERO = 3 // mid of "2-4"

ANCHORS.forEach(a => {
  const team = a.heroes.map(id => heroStats(id, a.level, a.opts))
  const avgHp = team.reduce((s, h) => s + h.hp, 0) / team.length
  const avgDef = team.reduce((s, h) => s + h.def, 0) / team.length
  const avgAtk = team.reduce((s, h) => s + h.atk, 0) / team.length
  const avgDmgBonus = team.reduce((s, h) => s + h.damageBonus, 0) / team.length
  const def = MINION_DEF[a.chapter]
  const atk = Math.round(def + avgHp / HITS_TO_KILL_HERO)
  const heroDmgPerHit = (avgAtk - def) * avgDmgBonus
  const hp = Math.round(HITS_TO_DIE_TO_HERO * heroDmgPerHit)
  console.log(`ch${a.chapter} stage${a.stage} (lvl${a.level} anchor): heroAvg atk=${avgAtk.toFixed(0)} hp=${avgHp.toFixed(0)} def=${avgDef.toFixed(1)} dmgBonus=${avgDmgBonus.toFixed(2)}`)
  console.log(`  -> minion target: atk=${atk} def=${def} hp=${hp}  (kills hero in ${(avgHp/(atk-avgDef)).toFixed(1)} hits; dies to hero in ${(hp/heroDmgPerHit).toFixed(1)} hits)`)
})
