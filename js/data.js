// mock 数据 + 本地存档：资源数值（仅金币）、英雄碎片/升级、商店、出征进度
// 弹窗操作时资源与数据联动变化；tt.setStorageSync 持久化，重启后 tt.getStorageSync 还原

// ========== 武器系（职业）系统 ==========
// 5 种武器系：弓/剑/刀/戟/枪。每名英雄/敌方单位固定归属一种武器系：
// - 装备限制：英雄仅能装备与自身武器系相同的装备（见 equipToHero/isEquipUsableByHero）
// - 战斗属性：射程（曼哈顿或切比雪夫距离，battle.js 中按切比雪夫距离判定攻击范围）与伤害倍率各不相同（见 battle.js _weaponMeta/_attack）
//   弓：射程最长(3格)，但无法攻击相邻(1格)目标；枪：射程2格，中高伤害；戟：射程2格，中等伤害+横扫周围1格；
//   刀：射程1格（近战），伤害最高；剑：射程1格（近战），伤害中等但连续攻击两次（迅捷）
export const WEAPON_TYPE_LIST = ['gong', 'jian', 'dao', 'ji', 'qiang']
export const WEAPON_TYPE_META = {
  gong: { id: 'gong', name: '弓', range: 3, minRange: 2, dmgMult: 1.0, rangeDesc: '射程2~3格（远程，无法攻击相邻目标）' },
  qiang: { id: 'qiang', name: '枪', range: 2, minRange: 1, dmgMult: 1.15, rangeDesc: '射程1~2格（长枪突刺，伤害中高）' },
  ji: { id: 'ji', name: '戟', range: 2, minRange: 1, dmgMult: 1.05, sweep: true, rangeDesc: '射程1~2格（戟扫，命中目标周围1格内敌方，伤害中等）' },
  dao: { id: 'dao', name: '刀', range: 1, minRange: 1, dmgMult: 1.35, rangeDesc: '射程1格（近战速攻，伤害最高）' },
  jian: { id: 'jian', name: '剑', range: 1, minRange: 1, dmgMult: 0.85, doubleHit: true, rangeDesc: '射程1格（近战迅捷，连续攻击两次）' }
}

// 12 名英雄基础属性：出征编队从已解锁英雄中最多选 4 人上阵（默认桃园三兄弟），与 battle.js 中
// HERO_BATTLE_DEFS 的 spd/move/技能配套；攻/血/防随等级成长
// faction：蜀/吴/魏/群；weaponType：武器系（史载明确者按史实指定，不确定者默认剑）；
// skills 为展示用技能描述（name/desc/rage/type/power），非战斗结算引擎数据
const HERO_BASE = {
  liubei: {
    name: '刘备', faction: '蜀', weaponType: 'jian', atk: 20, hp: 600, def: 8, spd: 8,
    skills: [
      { name: '仁德', desc: '全体恢复(攻击力×39%)', rage: 40, type: 'heal', power: 39 },
      { name: '鼓舞', desc: '我方全体攻击+20%(2回合)', rage: 50, type: 'buffAtk', power: 20 },
      { name: '救援', desc: '单体恢复(攻击力×87%)', rage: 80, type: 'heal', power: 87 }
    ]
  },
  guanyu: {
    name: '关羽', faction: '蜀', weaponType: 'dao', atk: 35, hp: 500, def: 6, spd: 10,
    skills: [
      { name: '青龙斩', desc: '单体120%伤害', rage: 40, type: 'damage', power: 120 },
      { name: '武圣', desc: '自身攻击+30%(2回合)', rage: 50, type: 'buffAtk', power: 30 },
      { name: '威震', desc: '周围范围290%伤害', rage: 80, type: 'area', power: 290 }
    ]
  },
  zhangfei: {
    name: '张飞', faction: '蜀', weaponType: 'qiang', atk: 30, hp: 550, def: 8, spd: 9,
    skills: [
      { name: '咆哮', desc: '单体120%伤害+眩晕1回合', rage: 40, type: 'stun', power: 120 },
      { name: '猛进', desc: '突进目标并攻击165%伤害', rage: 50, type: 'dash', power: 165 },
      { name: '怒吼', desc: '敌方全体防御-20%(2回合)', rage: 80, type: 'debuffDef', power: 20 }
    ]
  },
  zhaoyun: {
    name: '赵云', faction: '蜀', weaponType: 'qiang', atk: 32, hp: 520, def: 7, spd: 11,
    skills: [
      { name: '连刺', desc: '单体120%伤害', rage: 40, type: 'damage', power: 120 },
      { name: '龙胆', desc: '自身攻击+30%(2回合)', rage: 50, type: 'buffAtk', power: 30 },
      { name: '七进七出', desc: '单体290%伤害+自身免伤', rage: 80, type: 'damage', power: 290 }
    ]
  },
  machao: {
    name: '马超', faction: '蜀', weaponType: 'qiang', atk: 34, hp: 540, def: 7, spd: 9,
    skills: [
      { name: '枪扫', desc: '范围140%伤害', rage: 40, type: 'area', power: 140 },
      { name: '铁骑', desc: '自身攻击+25%', rage: 50, type: 'buffAtk', power: 25 },
      { name: '神威天降', desc: '单体300%伤害+眩晕', rage: 80, type: 'stun', power: 300 }
    ]
  },
  huangzhong: {
    name: '黄忠', faction: '蜀', weaponType: 'gong', atk: 38, hp: 480, def: 5, spd: 8,
    skills: [
      { name: '箭雨', desc: '范围130%伤害', rage: 40, type: 'area', power: 130 },
      { name: '百步', desc: '单体165%远程伤害', rage: 50, type: 'damage', power: 165 },
      { name: '落日神箭', desc: '单体320%必中伤害', rage: 80, type: 'damage', power: 320 }
    ]
  },
  huangyueying: {
    name: '黄月英', faction: '蜀', weaponType: 'jian', atk: 24, hp: 480, def: 6, spd: 8,
    skills: [
      { name: '机关', desc: '范围120%伤害', rage: 40, type: 'area', power: 120 },
      { name: '木牛', desc: '我方全体恢复(攻击力×36%)', rage: 50, type: 'heal', power: 36 },
      { name: '连弩', desc: '单体280%伤害', rage: 80, type: 'damage', power: 280 }
    ]
  },
  sunshangxiang: {
    name: '孙尚香', faction: '吴', weaponType: 'gong', atk: 30, hp: 470, def: 5, spd: 10,
    skills: [
      { name: '箭袭', desc: '单体125%伤害', rage: 40, type: 'damage', power: 125 },
      { name: '凤舞', desc: '自身攻击+30%', rage: 50, type: 'buffAtk', power: 30 },
      { name: '凤凰涅槃', desc: '我方全体恢复(攻击力×38%)+攻击+15%', rage: 80, type: 'heal', power: 38 }
    ]
  },
  taishici: {
    name: '太史慈', faction: '吴', weaponType: 'jian', atk: 33, hp: 510, def: 7, spd: 10,
    skills: [
      { name: '双戟', desc: '单体130%伤害', rage: 40, type: 'damage', power: 130 },
      { name: '猛突', desc: '冲刺单体150%伤害', rage: 50, type: 'dash', power: 150 },
      { name: '忠魂', desc: '自身攻击+40%(3回合)', rage: 80, type: 'buffAtk', power: 40 }
    ]
  },
  zhenji: {
    name: '甄姬', faction: '魏', weaponType: 'jian', atk: 22, hp: 460, def: 6, spd: 9,
    skills: [
      { name: '洛水', desc: '单体120%伤害+减速', rage: 40, type: 'debuffDef', power: 120 },
      { name: '凝露', desc: '单体恢复(攻击力×36%)', rage: 50, type: 'heal', power: 36 },
      { name: '洛神赋', desc: '我方全体恢复(攻击力×28%)+防御+20%', rage: 80, type: 'buffDef', power: 28 }
    ]
  },
  diaochan: {
    name: '貂蝉', faction: '群', weaponType: 'jian', atk: 28, hp: 450, def: 5, spd: 10,
    skills: [
      { name: '迷离', desc: '单体100%伤害+眩晕', rage: 40, type: 'stun', power: 100 },
      { name: '舞姿', desc: '我方全体攻击+15%', rage: 50, type: 'buffAtk', power: 15 },
      { name: '闭月', desc: '敌方全体攻击-30%(2回合)', rage: 80, type: 'debuffAtk', power: 30 }
    ]
  },
  zhurong: {
    name: '祝融', faction: '群', weaponType: 'jian', atk: 34, hp: 560, def: 9, spd: 9,
    skills: [
      { name: '飞刀', desc: '单体130%伤害', rage: 40, type: 'damage', power: 130 },
      { name: '烈焰', desc: '范围150%伤害', rage: 50, type: 'area', power: 150 },
      { name: '南蛮怒', desc: '单体280%伤害+燃烧', rage: 80, type: 'damage', power: 280 }
    ]
  }
}
export const HERO_IDS = [
  'liubei', 'guanyu', 'zhangfei', 'zhaoyun', 'machao', 'huangzhong', 'huangyueying',
  'sunshangxiang', 'taishici', 'zhenji', 'diaochan', 'zhurong'
]
// 默认出战英雄（初始已解锁）：出征编队弹窗默认选中此三人，玩家可在已解锁英雄中自由更换（最多4人）
export const BATTLE_ROSTER = ['liubei', 'guanyu', 'zhangfei']
export const HERO_META = {}
HERO_IDS.forEach(id => {
  const b = HERO_BASE[id]
  HERO_META[id] = { name: b.name, faction: b.faction, weaponType: b.weaponType, portrait: 'hero_' + id, skills: b.skills }
})

// 势力徽标颜色：蜀绿/吴红/魏蓝/群紫
export const FACTION_COLOR = { 蜀: '#2e8b57', 吴: '#c0392b', 魏: '#2f6fb3', 群: '#8e44ad' }

function _defaultHeroes() {
  const heroes = {}
  HERO_IDS.forEach(id => {
    const b = HERO_BASE[id]
    // 桃园三兄弟默认已兑换解锁，其余9名需集齐5碎片兑换后才能养成
    // weaponType：英雄武器系（旧存档缺失该字段时，loadGame 内 Object.assign 合并不会覆盖此处的默认值，天然兼容）
    heroes[id] = { shards: 0, level: 1, atk: b.atk, hp: b.hp, def: b.def, equip: null, weaponType: b.weaponType, unlocked: BATTLE_ROSTER.includes(id) }
  })
  return heroes
}

// ========== 称号系统 ==========
// 5 档品质：白 < 蓝 < 紫 < 黄 < 红，数值越大品质越高
export const QUALITY_META = {
  1: { name: '白', color: '#b7bcc4' },
  2: { name: '蓝', color: '#4a90e2' },
  3: { name: '紫', color: '#9b59b6' },
  4: { name: '黄', color: '#e8c96a' },
  5: { name: '红', color: '#e05a4e' }
}

// 20 个称号（每品质 4 个），effects 支持：atk/hp/def（固定值加成）、skillDmg/goldGain/allAttr（百分比加成）
export const TITLE_LIST = [
  { id: 'chuchumaolu', name: '初出茅庐', quality: 1, effects: { atk: 5 } },
  { id: 'wumingxiaozu', name: '无名小卒', quality: 1, effects: { hp: 50 } },
  { id: 'dazaxiaobing', name: '打杂小兵', quality: 1, effects: { def: 2 } },
  { id: 'xiangyong', name: '乡勇', quality: 1, effects: { atk: 3, hp: 30 } },

  { id: 'baizhanlaobing', name: '百战老兵', quality: 2, effects: { atk: 10, hp: 100 } },
  { id: 'shachangxianfeng', name: '沙场先锋', quality: 2, effects: { atk: 8 } },
  { id: 'junxuguan', name: '军需官', quality: 2, effects: { goldGain: 10 } },
  { id: 'shouchengweishi', name: '守城卫士', quality: 2, effects: { def: 8, hp: 80 } },

  { id: 'changshanyingjie', name: '常山英杰', quality: 3, effects: { atk: 20, hp: 200 } },
  { id: 'huweijiangjun', name: '虎威将军', quality: 3, effects: { skillDmg: 15 } },
  { id: 'taoyuanyishi', name: '桃园义士', quality: 3, effects: { allAttr: 5 } },
  { id: 'pozhenxiaowei', name: '破阵校尉', quality: 3, effects: { atk: 15, def: 6 } },

  { id: 'wuhushangjiang', name: '五虎上将', quality: 4, effects: { atk: 30, hp: 300, skillDmg: 10 } },
  { id: 'shuhanzhushi', name: '蜀汉柱石', quality: 4, effects: { def: 15, hp: 400 } },
  { id: 'wanrendi', name: '万人敌', quality: 4, effects: { atk: 25, skillDmg: 20 } },
  { id: 'changshengjiangjun', name: '常胜将军', quality: 4, effects: { allAttr: 8 } },

  { id: 'wusheng', name: '武圣', quality: 5, effects: { atk: 50, skillDmg: 30 } },
  { id: 'zhanshen', name: '战神', quality: 5, effects: { atk: 40, hp: 500, skillDmg: 25 } },
  { id: 'hanshizongqin', name: '汉室宗亲', quality: 5, effects: { allAttr: 15, goldGain: 20 } },
  { id: 'tianxiawushuang', name: '天下无双', quality: 5, effects: { atk: 60, hp: 600, skillDmg: 40, allAttr: 10 } }
]

// 按 id 取称号定义
export function getTitleById(id) {
  return TITLE_LIST.find(t => t.id === id)
}

// 当前装备称号的效果（未知字段兜底为 0，供战斗结算统一读取）
export function currentTitleEffects() {
  const t = getTitleById(gameData.player.currentTitle) || TITLE_LIST[0]
  const e = t.effects || {}
  return { atk: e.atk || 0, hp: e.hp || 0, def: e.def || 0, skillDmg: e.skillDmg || 0, goldGain: e.goldGain || 0, allAttr: e.allAttr || 0 }
}

// 称号效果描述文本（人物面板/称号列表展示用）
export function titleEffectDesc(title) {
  const e = title.effects || {}
  const parts = []
  if (e.atk) parts.push(`攻击+${e.atk}`)
  if (e.hp) parts.push(`血量+${e.hp}`)
  if (e.def) parts.push(`防御+${e.def}`)
  if (e.skillDmg) parts.push(`技能威力+${e.skillDmg}%`)
  if (e.goldGain) parts.push(`金币获取+${e.goldGain}%`)
  if (e.allAttr) parts.push(`全属性+${e.allAttr}%`)
  return parts.join(' ')
}

// 装备称号：仅已获得（ownedTitles 内）的称号可装备，返回是否成功
export function equipTitle(id) {
  if (!getTitleById(id)) return false
  if (!gameData.player.ownedTitles.includes(id)) return false
  gameData.player.currentTitle = id
  saveGame()
  return true
}

// 某称号是否已获得
export function isTitleOwned(id) {
  return gameData.player.ownedTitles.includes(id)
}

// ========== 装备系统（金币购买，每名英雄仅一个装备槽）==========
// 5 档品质：白/蓝/紫/黄/红（复用称号 QUALITY_META）。每件装备均带 weaponType 标签（弓/剑/刀/戟/枪之一），
// 英雄仅能装备与自身 weaponType 相同的装备（见 equipToHero/isEquipUsableByHero），装备/英雄列表按此过滤展示。
// 白/蓝/紫/黄装：每档品质 5 件，武器系齐全（弓剑刀戟枪各一件），仅提供 atk/hp/def 固定值加成，无技能伤害加成，
// 供未获得红装前过渡养成使用；红装（quality 5）为 12 名英雄的专属神兵（以英雄命名，weaponType = 该英雄武器系），
// 带 heroSkillDmg 技能伤害增幅。effects 支持 atk/hp/def 固定值加成，任何佩戴者均生效；heroSkillDmg 为 { heroId, pct }，
// 仅当佩戴者 = heroId 时该英雄技能伤害额外 +pct%（与称号「技能威力」%叠加为总百分比，详见 battle.js _skillDamage）
export const EQUIP_LIST = [
  // 白装 x5（弓剑刀戟枪各一）
  { id: 'tenggong', name: '藤弓', quality: 1, weaponType: 'gong', effects: { atk: 14 }, price: 400 },
  { id: 'mujian', name: '木剑', quality: 1, weaponType: 'jian', effects: { atk: 12, hp: 15 }, price: 400 },
  { id: 'chaidao', name: '柴刀', quality: 1, weaponType: 'dao', effects: { atk: 16 }, price: 400 },
  { id: 'zhuji', name: '竹戟', quality: 1, weaponType: 'ji', effects: { atk: 11, def: 4 }, price: 400 },
  { id: 'bailaqiang', name: '白蜡枪', quality: 1, weaponType: 'qiang', effects: { atk: 13, hp: 20 }, price: 400 },

  // 蓝装 x5
  { id: 'yinggong', name: '硬弓', quality: 2, weaponType: 'gong', effects: { atk: 26 }, price: 1000 },
  { id: 'tiejian', name: '铁剑', quality: 2, weaponType: 'jian', effects: { atk: 25, hp: 40 }, price: 1000 },
  { id: 'huanshoudao', name: '环首刀', quality: 2, weaponType: 'dao', effects: { atk: 30 }, price: 1000 },
  { id: 'tieji', name: '铁戟', quality: 2, weaponType: 'ji', effects: { atk: 20, def: 8 }, price: 1000 },
  { id: 'tieqiang', name: '铁枪', quality: 2, weaponType: 'qiang', effects: { atk: 24, hp: 50 }, price: 1000 },

  // 紫装 x5
  { id: 'jiaogong', name: '角弓', quality: 3, weaponType: 'gong', effects: { atk: 44, hp: 40 }, price: 2500 },
  { id: 'longquanjian', name: '龙泉剑', quality: 3, weaponType: 'jian', effects: { atk: 38, def: 6 }, price: 2500 },
  { id: 'bailiandao', name: '百炼刀', quality: 3, weaponType: 'dao', effects: { atk: 50 }, price: 2500 },
  { id: 'fangtianji', name: '方天戟', quality: 3, weaponType: 'ji', effects: { atk: 34, def: 12 }, price: 2500 },
  { id: 'xuantieqiang', name: '玄铁枪', quality: 3, weaponType: 'qiang', effects: { atk: 40, hp: 70 }, price: 2500 },

  // 黄装 x5
  { id: 'chiyangong', name: '赤焰弓', quality: 4, weaponType: 'gong', effects: { atk: 58, hp: 90 }, price: 5000 },
  { id: 'qinglongjian', name: '青龙剑', quality: 4, weaponType: 'jian', effects: { atk: 54, def: 10, hp: 60 }, price: 5000 },
  { id: 'longwendao', name: '龙纹刀', quality: 4, weaponType: 'dao', effects: { atk: 68 }, price: 5000 },
  { id: 'hutouji', name: '虎头戟', quality: 4, weaponType: 'ji', effects: { atk: 46, def: 16 }, price: 5000 },
  { id: 'liangyinqiang', name: '亮银枪', quality: 4, weaponType: 'qiang', effects: { atk: 56, hp: 100 }, price: 5000 },

  // 红装 x12：12 名英雄专属神兵，weaponType = 该英雄武器系，技能伤害+150%（黄月英/甄姬/貂蝉 +120%）
  { id: 'liubei_cixiongjian', name: '刘备·雌雄双股剑', quality: 5, weaponType: 'jian', effects: { atk: 70, hp: 300, def: 10 }, heroSkillDmg: { heroId: 'liubei', pct: 150 }, price: 12000 },
  { id: 'guanyu_qinglongdao', name: '关羽·青龙偃月刀', quality: 5, weaponType: 'dao', effects: { atk: 80, hp: 280, def: 8 }, heroSkillDmg: { heroId: 'guanyu', pct: 150 }, price: 12000 },
  { id: 'zhangfei_zhangbamao', name: '张飞·丈八蛇矛', quality: 5, weaponType: 'qiang', effects: { atk: 75, hp: 350, def: 12 }, heroSkillDmg: { heroId: 'zhangfei', pct: 150 }, price: 12000 },
  { id: 'zhaoyun_longdanqiang', name: '赵云·龙胆亮银枪', quality: 5, weaponType: 'qiang', effects: { atk: 78, hp: 300, def: 8 }, heroSkillDmg: { heroId: 'zhaoyun', pct: 150 }, price: 12000 },
  { id: 'machao_huqiang', name: '马超·虎头湛金枪', quality: 5, weaponType: 'qiang', effects: { atk: 76, hp: 300, def: 8 }, heroSkillDmg: { heroId: 'machao', pct: 150 }, price: 12000 },
  { id: 'huangzhong_luorigong', name: '黄忠·落日神弓', quality: 5, weaponType: 'gong', effects: { atk: 82, hp: 260, def: 6 }, heroSkillDmg: { heroId: 'huangzhong', pct: 150 }, price: 12000 },
  { id: 'huangyueying_muniu', name: '黄月英·木牛流马', quality: 5, weaponType: 'jian', effects: { atk: 60, hp: 320, def: 10 }, heroSkillDmg: { heroId: 'huangyueying', pct: 120 }, price: 12000 },
  { id: 'sunshangxiang_fenglinggong', name: '孙尚香·凤翎弓', quality: 5, weaponType: 'gong', effects: { atk: 74, hp: 270, def: 6 }, heroSkillDmg: { heroId: 'sunshangxiang', pct: 150 }, price: 12000 },
  { id: 'taishici_wushuangji', name: '太史慈·无双双戟', quality: 5, weaponType: 'jian', effects: { atk: 78, hp: 300, def: 8 }, heroSkillDmg: { heroId: 'taishici', pct: 150 }, price: 12000 },
  { id: 'zhenji_luoshenqin', name: '甄姬·洛神琴', quality: 5, weaponType: 'jian', effects: { atk: 55, hp: 350, def: 14 }, heroSkillDmg: { heroId: 'zhenji', pct: 120 }, price: 12000 },
  { id: 'diaochan_nichangyuyi', name: '貂蝉·霓裳羽衣', quality: 5, weaponType: 'jian', effects: { atk: 62, hp: 330, def: 10 }, heroSkillDmg: { heroId: 'diaochan', pct: 120 }, price: 12000 },
  { id: 'zhurong_huoshenfeidao', name: '祝融·火神飞刀', quality: 5, weaponType: 'jian', effects: { atk: 78, hp: 320, def: 10 }, heroSkillDmg: { heroId: 'zhurong', pct: 150 }, price: 15000 }
]

// 旧存档装备 id 兼容映射：折算为新列表（5 武器系改版）中属性相近的同档位装备
const OLD_EQUIP_ID_MAP = {
  bronzesword: 'mujian',
  ironsword: 'tiejian',
  steelblade: 'bailiandao',
  rattanarmor: 'zhuji',
  ironarmor: 'tieji',
  brightarmor: 'fangtianji',
  clothrobe: 'bailaqiang',
  brocaderobe: 'tieqiang',
  whitedragonarmor: 'hutouji',
  xuanwuarmor: 'liangyinqiang',
  // 5 武器系改版前的纯属性装备（无 weaponType），折算为同档位属性相近的新装备
  cubuyi: 'bailaqiang',
  pidun: 'zhuji',
  caoxie: 'zhuji',
  tiejia: 'tieji',
  jinpao: 'tieqiang',
  mingguangkai: 'fangtianji',
  huwenpao: 'jiaogong',
  jinsijia: 'hutouji',
  bawangpao: 'liangyinqiang'
}

// 按 id 取装备定义
export function getEquipById(id) {
  return EQUIP_LIST.find(e => e.id === id)
}

// 某装备是否已持有：背包中有未装备数量，或已被任一英雄装备
export function isEquipOwned(id) {
  if ((gameData.player.inventory.equips[id] || 0) > 0) return true
  return HERO_IDS.some(hid => gameData.player.heroes[hid].equip === id)
}

// 旧存档装备 id 折算为新列表 id；无法折算（未知 id）时返回 null，由调用方清空装备
function _remapEquipId(id) {
  if (!id) return null
  if (getEquipById(id)) return id
  const mapped = OLD_EQUIP_ID_MAP[id]
  return mapped && getEquipById(mapped) ? mapped : null
}

// 装备效果描述文本（商店/背包/装备弹窗展示用）：固定属性加成 + 红装专属绑定英雄技能伤害加成（非红装无此项）
export function equipEffectDesc(equip) {
  const e = equip.effects || {}
  const parts = []
  if (e.atk) parts.push(`攻击+${e.atk}`)
  if (e.hp) parts.push(`血量+${e.hp}`)
  if (e.def) parts.push(`防御+${e.def}`)
  if (equip.heroSkillDmg) {
    const heroName = (HERO_META[equip.heroSkillDmg.heroId] || {}).name || ''
    parts.push(`「${heroName}技能伤害+${equip.heroSkillDmg.pct}%」`)
  }
  return parts.join(' ')
}

// 是否可购买某装备：金币充足
export function canBuyEquip(id) {
  const e = getEquipById(id)
  if (!e) return false
  return gameData.resources.gold >= e.price
}

// 执行购买：扣金币，装备加入背包（未装备状态），返回是否成功
export function buyEquip(id) {
  if (!canBuyEquip(id)) return false
  const e = getEquipById(id)
  gameData.resources.gold -= e.price
  gameData.player.inventory.equips[id] = (gameData.player.inventory.equips[id] || 0) + 1
  saveGame()
  return true
}

// 背包中某装备的持有（未装备）数量
export function ownedEquipCount(id) {
  return gameData.player.inventory.equips[id] || 0
}

// 装备是否可被指定英雄佩戴：武器系必须与英雄自身武器系一致（同标签限定），否则拒绝装备
export function isEquipUsableByHero(heroId, equipId) {
  const hero = gameData.player.heroes[heroId]
  const equip = getEquipById(equipId)
  if (!hero || !equip) return false
  return equip.weaponType === hero.weaponType
}

// 给英雄装备背包中的装备：替换原有装备（原装备退回背包），扣减背包持有数量，返回是否成功
// 武器系不匹配（装备限制：英雄仅能装备与自身武器系相同的装备）时拒绝装备
export function equipToHero(heroId, equipId) {
  const hero = gameData.player.heroes[heroId]
  if (!hero || !getEquipById(equipId)) return false
  if (!isEquipUsableByHero(heroId, equipId)) return false
  if (ownedEquipCount(equipId) <= 0) return false
  gameData.player.inventory.equips[equipId] -= 1
  if (hero.equip) {
    gameData.player.inventory.equips[hero.equip] = (gameData.player.inventory.equips[hero.equip] || 0) + 1
  }
  hero.equip = equipId
  saveGame()
  return true
}

// 卸下英雄当前装备，退回背包，返回是否成功
export function unequipHero(heroId) {
  const hero = gameData.player.heroes[heroId]
  if (!hero || !hero.equip) return false
  gameData.player.inventory.equips[hero.equip] = (gameData.player.inventory.equips[hero.equip] || 0) + 1
  hero.equip = null
  saveGame()
  return true
}

// 英雄当前装备提供的固定属性加成（战斗结算读取，未装备返回全 0；任何佩戴者均生效，与绑定英雄无关）
export function heroEquipEffects(heroId) {
  const hero = gameData.player.heroes[heroId]
  const e = hero && hero.equip ? getEquipById(hero.equip) : null
  const eff = (e && e.effects) || {}
  return { atk: eff.atk || 0, hp: eff.hp || 0, def: eff.def || 0 }
}

// 英雄当前装备提供的技能伤害加成百分比：仅当装备绑定的英雄 = 佩戴者本人时生效，否则为 0
export function heroEquipSkillDmgPct(heroId) {
  const hero = gameData.player.heroes[heroId]
  const e = hero && hero.equip ? getEquipById(hero.equip) : null
  if (e && e.heroSkillDmg && e.heroSkillDmg.heroId === heroId) return e.heroSkillDmg.pct
  return 0
}

// 玩家资源（仅金币）
export const gameData = {
  resources: { gold: 99999999 },
  // 玩家信息（mock）：左上角头像/等级/称号，人物介绍弹窗用；power 供出征弹窗参考
  player: {
    name: '刘玄德',
    nickName: '',
    title: '蜀汉将军',
    // 称号系统：全部称号列表 + 当前装备称号 id（默认初出茅庐）+ 已获得称号 id 列表（掉落制，默认仅初出茅庐）
    titles: TITLE_LIST,
    currentTitle: 'chuchumaolu',
    ownedTitles: ['chuchumaolu'],
    level: 5,
    power: 3500,
    // 音效/音乐开关（暂无音频资源，仅存档状态，供后续接入音频时读取）
    settings: { sound: true, music: true },
    bio: '汉室宗亲，中山靖王之后。宽仁爱民，善于识人用人，麾下关羽、张飞等猛将如云。誓兴复汉室，救万民于水火。',
    // 兵种数量（mock）：兵营购买后实时更新
    troops: { infantry: 0, cavalry: 0, engineer: 0 },
    // 英雄碎片/等级/属性/装备：招募获得碎片，碎片攒够后可升级提升攻/血；equip 为已装备的装备 id 或 null
    heroes: _defaultHeroes(),
    // 战斗道具持有数量（战斗内"使用道具"消耗 / 商店购买增加）
    items: { herb: 3, charm: 2, pill: 1 },
    // 背包持有的未装备装备：{ 装备id: 数量 }
    inventory: { equips: {} },
    // 出征关卡解锁进度：已解锁关卡数（按 campaignStages 顺序），初始解锁第1关
    campaignUnlocked: 1,
    // 上次出战编队（英雄id数组，最多4人，按出战顺序），无记录时为空数组
    lastTeam: []
  },
  // 建筑状态：等级、等级上限（仅主城/农田/铁矿/兵营可用金币升级，其余为功能入口）
  buildings: {
    maincity: { name: '主城', level: 5, maxLevel: 15 },
    farm: { name: '农田', level: 4, maxLevel: 10 },
    iron: { name: '铁矿', level: 3, maxLevel: 10 },
    barracks: { name: '兵营', level: 2, maxLevel: 10 },
    tavern: { name: '酒馆', level: 1, maxLevel: 1 },
    drillground: { name: '校场', level: 1, maxLevel: 1 },
    campaign: { name: '出征大厅', level: 1, maxLevel: 1 },
    shop: { name: '商店', level: 1, maxLevel: 1 }
  }
}

// ========== 本地存档 ==========
const SAVE_KEY = 'jxsg_save'

// 随机昵称兜底：抖音昵称获取失败/未授权时使用
function _randomNickName() {
  return '将军_' + Math.floor(1000 + Math.random() * 9000)
}

// 异步尝试获取抖音昵称（tt.getUserInfo 优先，无 nickName 时退回 tt.getUserProfile），成功后覆盖随机昵称并存档
function _fetchNickName() {
  if (typeof tt === 'undefined') return
  const applyName = name => {
    if (name) {
      gameData.player.nickName = name
      saveGame()
    }
  }
  const tryProfile = () => {
    if (tt.getUserProfile) {
      tt.getUserProfile({
        success: res => { if (res && res.userInfo && res.userInfo.nickName) applyName(res.userInfo.nickName) },
        fail: () => {}
      })
    }
  }
  if (tt.getUserInfo) {
    tt.getUserInfo({
      success: res => {
        if (res && res.userInfo && res.userInfo.nickName) applyName(res.userInfo.nickName)
        else tryProfile()
      },
      fail: tryProfile
    })
  } else {
    tryProfile()
  }
}

// 从存档还原数据；无存档时以当前 mock 默认值写入首份存档
export function loadGame() {
  let saved = null
  try { saved = tt.getStorageSync(SAVE_KEY) } catch (e) { saved = null }
  if (saved && typeof saved === 'object' && Object.keys(saved).length) {
    gameData.resources.gold = 99999999 // 测试期强制金币
    if (saved.items) Object.assign(gameData.player.items, saved.items)
    if (saved.heroes) {
      HERO_IDS.forEach(id => {
        if (saved.heroes[id]) Object.assign(gameData.player.heroes[id], saved.heroes[id])
      })
      // 装备品质升级后旧存档装备 id 需折算到新列表，折算失败则清空装备槽
      HERO_IDS.forEach(id => {
        const h = gameData.player.heroes[id]
        if (h.equip) h.equip = _remapEquipId(h.equip)
      })
    }
    if (saved.inventory && saved.inventory.equips) {
      const remapped = {}
      Object.keys(saved.inventory.equips).forEach(oldId => {
        const newId = _remapEquipId(oldId)
        if (newId) remapped[newId] = (remapped[newId] || 0) + (saved.inventory.equips[oldId] || 0)
      })
      Object.assign(gameData.player.inventory.equips, remapped)
    }
    if (typeof saved.campaignUnlocked === 'number') gameData.player.campaignUnlocked = saved.campaignUnlocked
    // 旧存档无 lastTeam 字段时兜底为空数组
    gameData.player.lastTeam = Array.isArray(saved.lastTeam) ? saved.lastTeam : []
    if (saved.playerInfo) {
      if (saved.playerInfo.name) gameData.player.name = saved.playerInfo.name
      if (saved.playerInfo.nickName) gameData.player.nickName = saved.playerInfo.nickName
      if (typeof saved.playerInfo.level === 'number') gameData.player.level = saved.playerInfo.level
      if (saved.playerInfo.title) gameData.player.title = saved.playerInfo.title
      if (typeof saved.playerInfo.power === 'number') gameData.player.power = saved.playerInfo.power
      if (saved.playerInfo.currentTitle && getTitleById(saved.playerInfo.currentTitle)) gameData.player.currentTitle = saved.playerInfo.currentTitle
    }
    if (Array.isArray(saved.ownedTitles) && saved.ownedTitles.length) {
      gameData.player.ownedTitles = saved.ownedTitles.filter(id => getTitleById(id))
      if (!gameData.player.ownedTitles.length) gameData.player.ownedTitles = ['chuchumaolu']
    }
    if (saved.settings) {
      if (typeof saved.settings.sound === 'boolean') gameData.player.settings.sound = saved.settings.sound
      if (typeof saved.settings.music === 'boolean') gameData.player.settings.music = saved.settings.music
    }
    // 当前装备称号必须在已获得列表内，异常情况下回退为初出茅庐
    if (!gameData.player.ownedTitles.includes(gameData.player.currentTitle)) {
      gameData.player.currentTitle = 'chuchumaolu'
    }
  } else {
    saveGame()
  }
  // 昵称兜底：存档中没有则先用随机昵称占位，再异步尝试获取真实抖音昵称
  if (!gameData.player.nickName) gameData.player.nickName = _randomNickName()
  _fetchNickName()
}

// 写入存档：金币/道具/英雄碎片等级属性/出征进度/玩家信息/设置
export function saveGame() {
  // power 为战力缓存值，实际展示统一调用 computePower() 实时计算，此处仅为兼容旧存档格式
  gameData.player.power = computePower()
  const data = {
    gold: gameData.resources.gold,
    items: gameData.player.items,
    heroes: gameData.player.heroes,
    inventory: gameData.player.inventory,
    campaignUnlocked: gameData.player.campaignUnlocked,
    lastTeam: gameData.player.lastTeam,
    ownedTitles: gameData.player.ownedTitles,
    playerInfo: {
      name: gameData.player.name,
      nickName: gameData.player.nickName,
      level: gameData.player.level,
      title: gameData.player.title,
      power: gameData.player.power,
      currentTitle: gameData.player.currentTitle
    },
    settings: gameData.player.settings
  }
  try { tt.setStorageSync(SAVE_KEY, data) } catch (e) { /* 存档失败忽略，不影响游戏运行 */ }
}

loadGame()

// 升级消耗表：仅金币（主城/农田/铁矿/兵营可升级）
const COST_TABLE = {
  maincity: lv => ({ gold: 2000 * lv }),
  farm: lv => ({ gold: 600 * lv }),
  iron: lv => ({ gold: 600 * lv }),
  barracks: lv => ({ gold: 800 * lv })
}

// 取某建筑当前升级消耗（无升级表的功能入口返回空对象）
export function getUpgradeCost(id) {
  const b = gameData.buildings[id]
  if (!COST_TABLE[id]) return {}
  return COST_TABLE[id](b.level)
}

// 建筑等级上限：主城固定 15；其他建筑 = min(自身上限, 主城等级)
export function capOf(id) {
  if (id === 'maincity') return gameData.buildings.maincity.maxLevel
  const b = gameData.buildings[id]
  return Math.min(b.maxLevel, gameData.buildings.maincity.level)
}

// 是否可升级：未达等级上限 且 金币充足（无升级表的功能入口恒为不可升级）
export function canUpgrade(id) {
  if (!COST_TABLE[id]) return false
  const b = gameData.buildings[id]
  if (b.level >= capOf(id)) return false
  const cost = getUpgradeCost(id)
  return gameData.resources.gold >= (cost.gold || 0)
}

// 执行升级：扣金币、等级+1，返回是否成功
export function upgradeBuilding(id) {
  if (!canUpgrade(id)) return false
  const cost = getUpgradeCost(id)
  gameData.resources.gold -= cost.gold || 0
  gameData.buildings[id].level += 1
  saveGame()
  return true
}

// 建筑功能说明文本
export function buildingDesc(id) {
  const b = gameData.buildings[id]
  switch (id) {
    case 'maincity':
      return `城池中枢，其他建筑等级上限 = 主城等级（当前 ${b.level}）`
    case 'farm':
      return '产出建筑，助力城池发展，金币升级'
    case 'iron':
      return '产出建筑，助力城池发展，金币升级'
    case 'barracks':
      return '训练士兵的场所，兵种可在商店购买'
    case 'tavern':
      return '招募英雄，点击底部「招募」使用金币招募'
    case 'drillground':
      return '英雄养成：点击底部「英雄」升级英雄'
    case 'campaign':
      return '出征入口，选择关卡与编队后出征'
    case 'shop':
      return '商店，金币购买道具'
    default:
      return ''
  }
}

// 兵种商品目录（金币购买）：名称、定位、属性、价格
export const troopCatalog = [
  { id: 'infantry', name: '步兵', role: '近战', atk: 8, hp: 60, cost: { gold: 500 } },
  { id: 'cavalry', name: '骑兵', role: '机动', atk: 18, hp: 50, cost: { gold: 1200 } },
  { id: 'engineer', name: '工兵', role: '工程', atk: 12, hp: 45, cost: { gold: 800 } }
]

// 是否可购买某兵种：金币充足
export function canBuyTroop(id) {
  const t = troopCatalog.find(x => x.id === id)
  if (!t) return false
  return gameData.resources.gold >= (t.cost.gold || 0)
}

// 执行购买：扣金币、该兵种数量+1，返回是否成功
export function buyTroop(id) {
  if (!canBuyTroop(id)) return false
  const t = troopCatalog.find(x => x.id === id)
  gameData.resources.gold -= t.cost.gold || 0
  gameData.player.troops[id] += 1
  saveGame()
  return true
}

// 兵力总数（三兵种合计）
export function troopTotal() {
  const t = gameData.player.troops
  return t.infantry + t.cavalry + t.engineer
}

// ========== 商店（金币购买道具，战斗内可用）==========
export const shopGoods = [
  { id: 'herb', name: '金疮药', desc: '战斗中恢复目标30%最大血量', price: 200 },
  { id: 'charm', name: '护甲符', desc: '战斗中目标防御+10，持续2回合', price: 300 },
  { id: 'pill', name: '回春丹', desc: '战斗中我方全体恢复', price: 500 }
]

// 是否可购买商店道具：金币充足
export function canBuyShopItem(id) {
  const g = shopGoods.find(x => x.id === id)
  if (!g) return false
  return gameData.resources.gold >= g.price
}

// 执行商店购买：扣金币，道具数量 +1，返回是否成功
export function buyShopItem(id) {
  if (!canBuyShopItem(id)) return false
  const g = shopGoods.find(x => x.id === id)
  gameData.resources.gold -= g.price
  gameData.player.items[id] = (gameData.player.items[id] || 0) + 1
  saveGame()
  return true
}

// ========== 招募（金币抽卡，随机获得英雄碎片）==========
export const RECRUIT_COST = 1000
export const RECRUIT_COST_TEN = 10000

// 招募一次：消耗1000金币，随机获得一名英雄碎片×1，返回英雄id；金币不足返回null
export function recruitOnce() {
  if (gameData.resources.gold < RECRUIT_COST) return null
  gameData.resources.gold -= RECRUIT_COST
  const id = HERO_IDS[Math.floor(Math.random() * HERO_IDS.length)]
  gameData.player.heroes[id].shards += 1
  saveGame()
  return id
}

// 招募十次：消耗10000金币，返回获得的英雄id数组；金币不足返回null
export function recruitTen() {
  if (gameData.resources.gold < RECRUIT_COST_TEN) return null
  gameData.resources.gold -= RECRUIT_COST_TEN
  const results = []
  for (let i = 0; i < 10; i++) {
    const id = HERO_IDS[Math.floor(Math.random() * HERO_IDS.length)]
    gameData.player.heroes[id].shards += 1
    results.push(id)
  }
  saveGame()
  return results
}

// ========== 英雄兑换（首次解锁需集齐5碎片）==========
export const HERO_UNLOCK_SHARDS = 5

// 是否可兑换解锁：碎片数达标且尚未解锁
export function canUnlockHero(id) {
  const h = gameData.player.heroes[id]
  if (!h || h.unlocked) return false
  return h.shards >= HERO_UNLOCK_SHARDS
}

// 执行兑换解锁：扣碎片、置为已解锁，返回是否成功
export function unlockHero(id) {
  if (!canUnlockHero(id)) return false
  const h = gameData.player.heroes[id]
  h.shards -= HERO_UNLOCK_SHARDS
  h.unlocked = true
  saveGame()
  return true
}

// ========== 英雄升级（碎片消耗，攻/血 +15%/级）==========
// 升级消耗：等级 N -> N+1 需要 5 + 2*N 碎片
export function heroUpgradeCost(level) {
  return 5 + 2 * level
}

export function canUpgradeHero(id) {
  const h = gameData.player.heroes[id]
  if (!h || !h.unlocked) return false
  return h.shards >= heroUpgradeCost(h.level)
}

// 执行英雄升级：扣碎片、等级+1，攻/血按基础值 * 1.15^(等级-1) 重新计算，返回是否成功
export function upgradeHero(id) {
  if (!canUpgradeHero(id)) return false
  const h = gameData.player.heroes[id]
  const base = HERO_BASE[id]
  h.shards -= heroUpgradeCost(h.level)
  h.level += 1
  const mult = Math.pow(1.15, h.level - 1)
  h.atk = Math.round(base.atk * mult)
  h.hp = Math.round(base.hp * mult)
  h.def = base.def
  saveGame()
  return true
}

// ========== 战力计算（动态，供头像战力显示/出征弹窗推荐战力对照使用）==========
// 战力 = Σ(已解锁英雄) (攻*2 + 血/10 + 防*5)，其中英雄当前属性 = 基础值+等级加成(atk/hp) + 称号固定加成 + 装备固定加成，
// 再乘以 (1 + 称号全属性%/100)，四舍五入取整十位；未解锁任何英雄时回退为 3500（初始展示值）
export function computePower() {
  const titleEff = currentTitleEffects()
  let sum = 0
  let hasUnlocked = false
  HERO_IDS.forEach(id => {
    const h = gameData.player.heroes[id]
    if (!h || !h.unlocked) return
    hasUnlocked = true
    const equipEff = heroEquipEffects(id)
    const atk = h.atk + titleEff.atk + equipEff.atk
    const hp = h.hp + titleEff.hp + equipEff.hp
    const def = h.def + titleEff.def + equipEff.def
    sum += atk * 2 + hp / 10 + def * 5
  })
  if (!hasUnlocked) return 3500
  sum *= 1 + titleEff.allAttr / 100
  return Math.round(sum / 10) * 10
}

// ========== 出征章节/关卡系统 ==========
// 3 章 × 5 关，关卡按顺序解锁：完成第N关解锁第N+1关（含跨章节，如完成1-5解锁2-1）
// 难度循序增强：每章内小兵数值按 enemyAtkScale/enemyHpScale（对应 1~4 关递增，第5关BOSS战的护卫小兵
// 强度回落至接近第1关水平，难度主要由 BOSS 自身承担），乘在 battle.js ENEMY_MINION_DEFS 基础值上；
// 章节间难度跳跃：第1章 < 第2章 < 第3章，第3章配合红装+20级英雄可较为轻松通关 3-5
// 每关：id/所属章节/推荐战力/胜利奖励金钱/敌方小兵组成(类型id数组)/BOSS(id或null，仅第5关有)/敌方数值缩放
const CHAPTER_META = [
  {
    chapter: 1, name: '第1章 黄巾之乱', boss: 'zhangjiao',
    stageNames: ['黄巾起势', '波才叛乱', '黄巾大营', '渠帅坐镇', '天公将军'],
    // 小兵组成（前4关，2~3人）+ 第5关BOSS护卫（黄巾兵/黄巾弓手，专属立绘）
    minionCompositions: [
      ['huangjinbing_yt', 'huangjinbing_yt'],
      ['huangjinbing_yt', 'huangjingongshou'],
      ['huangjinbing_yt', 'huangjinbing_yt', 'huangjingongshou'],
      ['huangjingongshou', 'huangjingongshou', 'huangjinbing_yt']
    ],
    bossMinions: ['huangjinbing_yt', 'huangjingongshou'],
    // 新伤害公式（防御在技能倍率前先扣减，敌方数值需与英雄攻/血成长同速率）下重新配平：
    // 基础值(黄巾兵 atk16/hp220/def3)按此缩放 -> 约 atk153~230 / hp33~42，第5关护卫回落至第1关强度
    enemyAtkScale: [9.58, 10.94, 12.54, 14.35, 9.58],
    enemyHpScale: [0.15, 0.17, 0.18, 0.19, 0.15],
    powers: [300, 400, 500, 650, 800],
    rewards: [300, 400, 550, 650, 800]
  },
  {
    chapter: 2, name: '第2章 董卓之乱', boss: 'huaxiong',
    stageNames: ['西凉铁骑', '长安兵变', '虎牢关前', '联军对峙', '骁将华雄'],
    // 小兵组成（前4关，3~4人，沿用山贼立绘：黄巾兵=普通/刀斧手=精锐）+ 第5关BOSS护卫（精锐刀斧手 x2）
    minionCompositions: [
      ['huangjinbing', 'huangjinbing', 'daofushou'],
      ['huangjinbing', 'daofushou', 'daofushou'],
      ['huangjinbing', 'huangjinbing', 'daofushou', 'daofushou'],
      ['daofushou', 'daofushou', 'daofushou', 'huangjinbing']
    ],
    bossMinions: ['daofushou', 'daofushou'],
    // 基础值(黄巾兵 atk16/hp220/def3)按此缩放 -> 约 atk345~550 / hp95~150，第5关护卫回落至第1关强度
    enemyAtkScale: [21.54, 24.90, 30.10, 34.35, 21.54],
    enemyHpScale: [0.50, 0.55, 0.71, 0.79, 0.50],
    powers: [1200, 1600, 2000, 2500, 3000],
    rewards: [1000, 1250, 1450, 1650, 1800]
  },
  {
    chapter: 3, name: '第3章 虎牢关之战', boss: 'lvbu',
    stageNames: ['并州先锋', '赤兔突骑', '连破八将', '诸侯震怖', '天下无双'],
    // 小兵组成（前4关，4~5人）+ 第5关BOSS护卫（3名精锐刀斧手，约 atk110/hp2500）
    minionCompositions: [
      ['huangjinbing', 'huangjinbing', 'daofushou', 'daofushou'],
      ['daofushou', 'daofushou', 'daofushou', 'huangjinbing'],
      ['huangjinbing', 'huangjinbing', 'daofushou', 'daofushou', 'daofushou'],
      ['daofushou', 'daofushou', 'daofushou', 'daofushou', 'huangjinbing']
    ],
    bossMinions: ['daofushou', 'daofushou', 'daofushou'],
    // 基础值(黄巾兵 atk16/hp220/def3)按此缩放 -> 约 atk910~2200 / hp198~392，第5关护卫回落至第1关强度
    enemyAtkScale: [56.82, 74.32, 96.91, 110.08, 56.82],
    enemyHpScale: [1.04, 1.31, 1.60, 1.78, 1.04],
    powers: [4000, 5000, 6500, 8000, 10000],
    rewards: [2000, 2500, 2900, 3200, 3500]
  }
]

export const campaignStages = []
CHAPTER_META.forEach(meta => {
  for (let s = 1; s <= 5; s++) {
    const isBoss = s === 5
    campaignStages.push({
      id: meta.chapter + '-' + s,
      chapter: meta.chapter,
      chapterName: meta.name,
      stage: s,
      name: meta.stageNames[s - 1],
      power: meta.powers[s - 1],
      reward: meta.rewards[s - 1],
      minions: isBoss ? meta.bossMinions : meta.minionCompositions[s - 1],
      boss: isBoss ? meta.boss : null,
      enemyAtkScale: meta.enemyAtkScale[s - 1],
      enemyHpScale: meta.enemyHpScale[s - 1]
    })
  }
})

// 出征弹窗按章节分组展示
export const campaignChapters = CHAPTER_META.map(meta => ({
  chapter: meta.chapter,
  name: meta.name,
  stages: campaignStages.filter(s => s.chapter === meta.chapter)
}))

// 某关是否已解锁（按 campaignStages 顺序，前 campaignUnlocked 关可进入）
export function isStageUnlocked(stageId) {
  const idx = campaignStages.findIndex(s => s.id === stageId)
  return idx >= 0 && idx < gameData.player.campaignUnlocked
}

// 通关某关：若该关正是当前解锁进度的最前沿，则解锁下一关，并保存进度
export function completeStage(stageId) {
  const idx = campaignStages.findIndex(s => s.id === stageId)
  if (idx === -1) return
  if (idx === gameData.player.campaignUnlocked - 1 && gameData.player.campaignUnlocked < campaignStages.length) {
    gameData.player.campaignUnlocked++
  }
  saveGame()
}

// ========== 称号掉落（战斗胜利结算调用）==========
// 掉落概率区间：按章节难度分档，章节内按关卡序号(1~5)线性插值到区间上限
const DROP_CHANCE_RANGE = {
  1: [0.05, 0.12],
  2: [0.12, 0.25],
  3: [0.25, 0.40]
}

// 品质分布：按章节难度分档，数值为该品质掉落权重（同章节内求和为1）
const QUALITY_DIST = {
  1: { 1: 0.70, 2: 0.25, 3: 0.05 },
  2: { 2: 0.60, 3: 0.30, 4: 0.10 },
  3: { 3: 0.40, 4: 0.35, 5: 0.25 }
}

// 按关卡计算本关掉落概率
function _dropChance(stage) {
  const [lo, hi] = DROP_CHANCE_RANGE[stage.chapter] || DROP_CHANCE_RANGE[1]
  const t = (stage.stage - 1) / 4
  return lo + (hi - lo) * t
}

// 按章节品质分布加权随机抽取一个品质
function _rollQuality(chapter) {
  const dist = QUALITY_DIST[chapter] || QUALITY_DIST[1]
  const r = Math.random()
  let acc = 0
  let picked = null
  for (const q of Object.keys(dist)) {
    acc += dist[q]
    picked = Number(q)
    if (r <= acc) return picked
  }
  return picked
}

// 战斗胜利结算调用：按关卡难度掉落称号；未获得则直接加入 ownedTitles，已获得则按品质转化为金币
// 返回 null（未掉落）或 { title, isNew, goldGained }
export function rollTitleDrop(stage) {
  if (!stage) return null
  if (Math.random() > _dropChance(stage)) return null
  const quality = _rollQuality(stage.chapter)
  const pool = TITLE_LIST.filter(t => t.quality === quality)
  if (!pool.length) return null
  const notOwned = pool.filter(t => !gameData.player.ownedTitles.includes(t.id))
  const candidates = notOwned.length ? notOwned : pool
  const title = candidates[Math.floor(Math.random() * candidates.length)]
  const isNew = !gameData.player.ownedTitles.includes(title.id)
  let goldGained = 0
  if (isNew) {
    gameData.player.ownedTitles.push(title.id)
  } else {
    goldGained = 300 * title.quality
    gameData.resources.gold += goldGained
  }
  saveGame()
  return { title, isNew, goldGained }
}

// ========== 装备掉落（战斗胜利结算调用，与称号掉落概率区间复用同一 _dropChance）==========
// 品质分布：按章节难度分档；红装（quality 5）仅从第3章掉落获得，商店不出售
const EQUIP_DROP_QUALITY_DIST = {
  1: { 1: 0.60, 2: 0.30, 3: 0.10 },
  2: { 2: 0.50, 3: 0.35, 4: 0.15 },
  3: { 2: 0.15, 3: 0.30, 4: 0.35, 5: 0.20 }
}

// 重复装备转化金币：按品质档位固定值
const EQUIP_DUP_GOLD = { 1: 200, 2: 500, 3: 1200, 4: 2500, 5: 8000 }

// 按章节装备品质分布加权随机抽取一个品质
function _rollEquipQuality(chapter) {
  const dist = EQUIP_DROP_QUALITY_DIST[chapter] || EQUIP_DROP_QUALITY_DIST[1]
  const r = Math.random()
  let acc = 0
  let picked = null
  for (const q of Object.keys(dist)) {
    acc += dist[q]
    picked = Number(q)
    if (r <= acc) return picked
  }
  return picked
}

// 战斗胜利结算调用：按关卡难度掉落装备；未持有则加入背包，已持有则按品质转化为金币
// 返回 null（未掉落）或 { equip, isNew, goldGained }
export function rollEquipDrop(stage) {
  if (!stage) return null
  if (Math.random() > _dropChance(stage)) return null
  const quality = _rollEquipQuality(stage.chapter)
  const pool = EQUIP_LIST.filter(e => e.quality === quality)
  if (!pool.length) return null
  const notOwned = pool.filter(e => !isEquipOwned(e.id))
  const candidates = notOwned.length ? notOwned : pool
  const equip = candidates[Math.floor(Math.random() * candidates.length)]
  const isNew = !isEquipOwned(equip.id)
  let goldGained = 0
  if (isNew) {
    gameData.player.inventory.equips[equip.id] = (gameData.player.inventory.equips[equip.id] || 0) + 1
  } else {
    goldGained = EQUIP_DUP_GOLD[equip.quality] || 200
    gameData.resources.gold += goldGained
  }
  saveGame()
  return { equip, isNew, goldGained }
}

// ========== 设置（音效/音乐开关，暂无音频资源，供后续接入音频时读取）==========
export function isSoundOn() {
  return gameData.player.settings.sound
}

export function isMusicOn() {
  return gameData.player.settings.music
}

// 切换音效开关，返回切换后的状态
export function toggleSound() {
  gameData.player.settings.sound = !gameData.player.settings.sound
  saveGame()
  return gameData.player.settings.sound
}

// 切换音乐开关，返回切换后的状态
export function toggleMusic() {
  gameData.player.settings.music = !gameData.player.settings.music
  saveGame()
  return gameData.player.settings.music
}
