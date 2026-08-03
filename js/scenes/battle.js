import { Scene } from './scene.js'
import { gameData, campaignStages, completeStage, saveGame, currentTitleEffects, rollTitleDrop, rollEquipDrop, QUALITY_META, heroEquipEffects, heroEquipSkillDmgPct, WEAPON_TYPE_META } from '../data.js'
import { playBattleBg, stopBattleBg, stopMainBg, playHit } from '../audio.js'

// 受击反馈动画时长（秒）：立绘闪白+抖动持续时间
const HIT_ANIM_DURATION = 0.25

// 大招（第3个技能）过场动画各阶段时长（秒）：intro闪屏 → show立绘定格 → burst全屏爆发，总时长约1.3s
const CUTSCENE_INTRO_DUR = 0.15
const CUTSCENE_SHOW_DUR = 0.8
const CUTSCENE_BURST_DUR = 0.35

// 地形类型
const TERRAIN = {
  GRASS: 0,    // 草地：正常
  FOREST: 1,   // 森林：受伤害-30%
  MOUNTAIN: 2, // 山：不可通行
  ROAD: 3      // 道路：正常
}

// 地形对应贴图 key
const TERRAIN_IMG = {
  [TERRAIN.GRASS]: 'tile_grass',
  [TERRAIN.FOREST]: 'tile_forest',
  [TERRAIN.MOUNTAIN]: 'tile_mountain',
  [TERRAIN.ROAD]: 'tile_road'
}

// 我方英雄数据（攻/血/防/速/移动力 + 技能列表），按 id 索引，供出征编队按选中英雄动态生成上阵单位
// 14×4 棋盘：我方英雄列 0-1，敌方右侧列 12-13；起始格由 TEAM_POSITIONS 按上阵人数动态分配（见下）
// 技能字段说明：
//   type：heal(治疗)/buffAtk(加攻)/debuffAtk(降攻)/debuffDef(降防)/damage(伤害)/damageStun(伤害+眩晕)/dashDamage(突进伤害)
//   target：self/oneAlly/allAlly/oneEnemy/allEnemy/rangeEnemies(以施法者为中心周围3格，即时释放)
//   value：治疗百分比(0~1) 或 伤害倍率(1=普攻)；duration：增益/减益持续回合数
const HERO_BATTLE_DEFS = {
  liubei: {
    id: 'liubei', name: '刘备', atk: 20, hp: 600, def: 8, spd: 8, move: 3, img: 'hero_liubei',
    skills: [
      { id: 'rende', name: '仁德', icon: 'skill_rende', desc: '全体恢复(攻击力×39%)', type: 'heal', target: 'allAlly', value: 0.39 },
      { id: 'guwu', name: '鼓舞', icon: 'skill_guwu', desc: '我方全体攻击+20%(2回合)', type: 'buffAtk', target: 'allAlly', value: 0.2, duration: 2 },
      { id: 'jiuyuan', name: '救援', icon: 'skill_jiuyuan', desc: '单体恢复(攻击力×87%)', type: 'heal', target: 'oneAlly', value: 0.87 }
    ]
  },
  guanyu: {
    id: 'guanyu', name: '关羽', atk: 35, hp: 500, def: 6, spd: 10, move: 3, img: 'hero_guanyu',
    skills: [
      { id: 'qinglongzhan', name: '青龙斩', icon: 'skill_qinglongzhan', desc: '单体120%伤害', type: 'damage', target: 'oneEnemy', value: 1.2 },
      { id: 'wusheng', name: '武圣', icon: 'skill_wusheng', desc: '自身攻击+30%(2回合)', type: 'buffAtk', target: 'self', value: 0.3, duration: 2 },
      { id: 'weizhen', name: '威震', icon: 'skill_weizhen', desc: '周围3格范围290%伤害', type: 'damage', target: 'rangeEnemies', value: 2.9 }
    ]
  },
  zhangfei: {
    id: 'zhangfei', name: '张飞', atk: 30, hp: 550, def: 8, spd: 9, move: 3, img: 'hero_zhangfei',
    skills: [
      { id: 'paoxiao', name: '咆哮', icon: 'skill_paoxiao', desc: '单体120%伤害+眩晕1回合', type: 'damageStun', target: 'oneEnemy', value: 1.2 },
      { id: 'mengjin', name: '猛进', icon: 'skill_mengjin', desc: '突进目标并攻击165%伤害', type: 'dashDamage', target: 'oneEnemy', value: 1.65 },
      { id: 'nuhou', name: '怒吼', icon: 'skill_nuhou', desc: '敌方全体防御-20%(2回合)', type: 'debuffDef', target: 'allEnemy', value: 0.2, duration: 2 }
    ]
  },
  zhaoyun: {
    id: 'zhaoyun', name: '赵云', atk: 32, hp: 520, def: 7, spd: 11, move: 3, img: 'hero_zhaoyun',
    skills: [
      { id: 'lianci', name: '连刺', desc: '单体120%伤害', type: 'damage', target: 'oneEnemy', value: 1.2 },
      { id: 'longdan', name: '龙胆', desc: '自身攻击+30%(2回合)', type: 'buffAtk', target: 'self', value: 0.3, duration: 2 },
      { id: 'qijinqichu', name: '七进七出', desc: '单体290%伤害', type: 'damage', target: 'oneEnemy', value: 2.9 }
    ]
  },
  machao: {
    id: 'machao', name: '马超', atk: 34, hp: 540, def: 7, spd: 9, move: 3, img: 'hero_machao',
    skills: [
      { id: 'qiangsao', name: '枪扫', desc: '周围3格范围140%伤害', type: 'damage', target: 'rangeEnemies', value: 1.4 },
      { id: 'tieqi', name: '铁骑', desc: '自身攻击+25%(2回合)', type: 'buffAtk', target: 'self', value: 0.25, duration: 2 },
      { id: 'shenweitianjiang', name: '神威天降', desc: '单体300%伤害+眩晕1回合', type: 'damageStun', target: 'oneEnemy', value: 3.0 }
    ]
  },
  huangzhong: {
    id: 'huangzhong', name: '黄忠', atk: 38, hp: 480, def: 5, spd: 8, move: 3, img: 'hero_huangzhong',
    skills: [
      { id: 'jianyu', name: '箭雨', desc: '周围3格范围130%伤害', type: 'damage', target: 'rangeEnemies', value: 1.3 },
      { id: 'baibu', name: '百步', desc: '单体165%伤害', type: 'damage', target: 'oneEnemy', value: 1.65 },
      { id: 'luorishenjian', name: '落日神箭', desc: '单体320%伤害', type: 'damage', target: 'oneEnemy', value: 3.2 }
    ]
  },
  huangyueying: {
    id: 'huangyueying', name: '黄月英', atk: 24, hp: 480, def: 6, spd: 8, move: 3, img: 'hero_huangyueying',
    skills: [
      { id: 'jiguan', name: '机关', desc: '周围3格范围120%伤害', type: 'damage', target: 'rangeEnemies', value: 1.2 },
      { id: 'muniu', name: '木牛', desc: '我方全体恢复(攻击力×36%)', type: 'heal', target: 'allAlly', value: 0.36 },
      { id: 'lianu', name: '连弩', desc: '单体280%伤害', type: 'damage', target: 'oneEnemy', value: 2.8 }
    ]
  },
  sunshangxiang: {
    id: 'sunshangxiang', name: '孙尚香', atk: 30, hp: 470, def: 5, spd: 10, move: 3, img: 'hero_sunshangxiang',
    skills: [
      { id: 'jianxi', name: '箭袭', desc: '单体125%伤害', type: 'damage', target: 'oneEnemy', value: 1.25 },
      { id: 'fengwu', name: '凤舞', desc: '自身攻击+30%(2回合)', type: 'buffAtk', target: 'self', value: 0.3, duration: 2 },
      { id: 'fenghuangniepan', name: '凤凰涅槃', desc: '我方全体恢复(攻击力×38%)', type: 'heal', target: 'allAlly', value: 0.38 }
    ]
  },
  taishici: {
    id: 'taishici', name: '太史慈', atk: 33, hp: 510, def: 7, spd: 10, move: 3, img: 'hero_taishici',
    skills: [
      { id: 'shuangji', name: '双戟', desc: '单体130%伤害', type: 'damage', target: 'oneEnemy', value: 1.3 },
      { id: 'mengtu', name: '猛突', desc: '突进目标并攻击150%伤害', type: 'dashDamage', target: 'oneEnemy', value: 1.5 },
      { id: 'zhonghun', name: '忠魂', desc: '自身攻击+40%(3回合)', type: 'buffAtk', target: 'self', value: 0.4, duration: 3 }
    ]
  },
  zhenji: {
    id: 'zhenji', name: '甄姬', atk: 22, hp: 460, def: 6, spd: 9, move: 3, img: 'hero_zhenji',
    skills: [
      { id: 'luoshui', name: '洛水', desc: '单体120%伤害+眩晕1回合', type: 'damageStun', target: 'oneEnemy', value: 1.2 },
      { id: 'ninglu', name: '凝露', desc: '单体恢复(攻击力×36%)', type: 'heal', target: 'oneAlly', value: 0.36 },
      { id: 'luoshenfu', name: '洛神赋', desc: '我方全体恢复(攻击力×28%)', type: 'heal', target: 'allAlly', value: 0.28 }
    ]
  },
  diaochan: {
    id: 'diaochan', name: '貂蝉', atk: 28, hp: 450, def: 5, spd: 10, move: 3, img: 'hero_diaochan',
    skills: [
      { id: 'mili', name: '迷离', desc: '单体100%伤害+眩晕1回合', type: 'damageStun', target: 'oneEnemy', value: 1.0 },
      { id: 'wuzi', name: '舞姿', desc: '我方全体攻击+15%(2回合)', type: 'buffAtk', target: 'allAlly', value: 0.15, duration: 2 },
      { id: 'biyue', name: '闭月', desc: '敌方全体攻击-30%(2回合)', type: 'debuffAtk', target: 'allEnemy', value: 0.3, duration: 2 }
    ]
  },
  zhurong: {
    id: 'zhurong', name: '祝融', atk: 34, hp: 560, def: 9, spd: 9, move: 3, img: 'hero_zhurong',
    skills: [
      { id: 'feidao', name: '飞刀', desc: '单体130%伤害', type: 'damage', target: 'oneEnemy', value: 1.3 },
      { id: 'lieyan', name: '烈焰', desc: '周围3格范围150%伤害', type: 'damage', target: 'rangeEnemies', value: 1.5 },
      { id: 'nanmannu', name: '南蛮怒', desc: '单体280%伤害', type: 'damage', target: 'oneEnemy', value: 2.8 }
    ]
  }
}

// 出征上阵起始格：按上阵人数（1~4）分配棋盘左侧格子，按选中顺序对应分配
// 我方英雄仅列 0-1 两列可用，故同一行的两列相邻会导致立绘（可达1.4倍格宽）横向重叠；
// 各人数档位均使用互不相同的行，避免出现"站在格外/与相邻英雄重叠"的观感问题
const TEAM_POSITIONS = {
  1: [{ r: 1, c: 1 }],
  2: [{ r: 0, c: 1 }, { r: 2, c: 1 }],
  3: [{ r: 0, c: 1 }, { r: 2, c: 0 }, { r: 3, c: 1 }],
  4: [{ r: 0, c: 1 }, { r: 1, c: 1 }, { r: 2, c: 0 }, { r: 3, c: 1 }]
}

// 敌方小兵模板（普通关卡使用）：每种仅 1 个技能
// atk/hp/def 为基础值，实际生成单位时按关卡的 enemyAtkScale/enemyHpScale 缩放（见 data.js CHAPTER_META）
// 第2、3章沿用通用山贼小兵立绘（assets/bandit/），第1章「黄巾之乱」使用专属黄巾兵/黄巾弓手立绘（见下方 huangjinbing_yt/huangjingongshou）
// weaponType：敌方武器系分布——基础步卒持枪(qiang)、精锐刀斧手用刀(dao)、专属弓手用弓(gong)
const ENEMY_MINION_DEFS = {
  huangjinbing: {
    name: '黄巾兵', img: 'enemy_huangjinbing', weaponType: 'qiang',
    atk: 16, hp: 220, def: 3, spd: 7, move: 3,
    skills: [
      { id: 'pinming', name: '拼命', icon: 'skill_pinming', desc: '自身攻击+20%(1回合)', type: 'buffAtk', target: 'self', value: 0.2, duration: 1 }
    ]
  },
  daofushou: {
    name: '刀斧手', img: 'enemy_daofushou', weaponType: 'dao',
    atk: 20, hp: 190, def: 3, spd: 8, move: 3,
    skills: [
      { id: 'zhongji', name: '重击', icon: 'skill_zhongji', desc: '单体130%伤害', type: 'damage', target: 'oneEnemy', value: 1.3 }
    ]
  },
  // 第1章专属：黄巾兵（近战，立绘 assets/yt/minion.png），数值/技能与通用黄巾兵一致
  huangjinbing_yt: {
    name: '黄巾兵', img: 'enemy_yt_minion', weaponType: 'qiang',
    atk: 16, hp: 220, def: 3, spd: 7, move: 3,
    skills: [
      { id: 'pinming', name: '拼命', icon: 'skill_pinming', desc: '自身攻击+20%(1回合)', type: 'buffAtk', target: 'self', value: 0.2, duration: 1 }
    ]
  },
  // 第1章专属：黄巾弓手（远程，立绘 assets/yt/archer.png）
  huangjingongshou: {
    name: '黄巾弓手', img: 'enemy_yt_archer', weaponType: 'gong',
    atk: 22, hp: 170, def: 2, spd: 8, move: 3,
    skills: [
      { id: 'jingzhunshejii', name: '精准射击', icon: 'skill_zhongji', desc: '单体130%伤害', type: 'damage', target: 'oneEnemy', value: 1.3 }
    ]
  }
}

// 章节 BOSS 武将模板（仅第5关出现）：3 个技能，AI 按冷却/伤害择优释放
// cooldown：技能冷却回合数（以该单位自身回合计），damage 类 target 支持：
//   oneEnemy(单体) / rangeEnemies(以自身为中心周围 AREA_RANGE 格) / areaEnemy(以目标格为中心 radius 格范围)
// weaponType：张角(道人佩剑)用剑、华雄(阵前猛将)用刀、吕布(方天画戟)用戟
const BOSS_DEFS = {
  zhangjiao: {
    name: '张角', img: 'boss_zhangjiao', weaponType: 'jian',
    atk: 250, hp: 1500, def: 15, spd: 9, move: 3,
    skills: [
      { id: 'leifa', name: '雷法', icon: 'skill_leifa', desc: '3x3范围雷击130%伤害', type: 'damage', target: 'areaEnemy', value: 1.3, radius: 1, cooldown: 2 },
      { id: 'fushui', name: '符水', icon: 'skill_fushui', desc: '自身恢复30%最大血量', type: 'heal', target: 'self', value: 0.3, cooldown: 2 },
      { id: 'yaoshu', name: '妖术', icon: 'skill_yaoshu', desc: '敌方全体攻击-20%(2回合)', type: 'debuffAtk', target: 'allEnemy', value: 0.2, duration: 2, cooldown: 2 }
    ]
  },
  huaxiong: {
    name: '华雄', img: 'boss_huaxiong', weaponType: 'dao',
    atk: 550, hp: 4200, def: 30, spd: 8, move: 3,
    skills: [
      { id: 'liezhan', name: '裂斩', icon: 'skill_liezhan', desc: '单体120%伤害', type: 'damage', target: 'oneEnemy', value: 1.2, cooldown: 1 },
      { id: 'zhanhou', name: '战吼', icon: 'skill_zhanhou', desc: '自身攻击+30%(2回合)', type: 'buffAtk', target: 'self', value: 0.3, duration: 2, cooldown: 2 },
      { id: 'hengsao', name: '横扫', icon: 'skill_hengsao', desc: '周围3格范围290%伤害', type: 'damage', target: 'rangeEnemies', value: 2.9, cooldown: 2 }
    ]
  },
  lvbu: {
    name: '吕布', img: 'boss_lvbu', weaponType: 'ji',
    atk: 1700, hp: 22000, def: 80, spd: 11, move: 3,
    skills: [
      { id: 'wushuangluanwu', name: '无双乱舞', icon: 'skill_wushuangluanwu', desc: '周围3格范围120%伤害', type: 'damage', target: 'rangeEnemies', value: 1.2, cooldown: 2 },
      { id: 'tianxiawushuang', name: '天下无双', icon: 'skill_tianxiawushuang', desc: '单体165%伤害', type: 'damage', target: 'oneEnemy', value: 1.65, cooldown: 2 },
      { id: 'chitutuxi', name: '赤兔突袭', icon: 'skill_chitutuxi', desc: '突进目标并攻击290%伤害', type: 'dashDamage', target: 'oneEnemy', value: 2.9, cooldown: 1 }
    ]
  }
}

// 敌方单位出生格位（右侧列 12-13，避开右下山区，行号需在 0-3 范围内），按顺序分配给小兵/BOSS
const ENEMY_POSITIONS = [
  { r: 0, c: 13 }, { r: 1, c: 12 }, { r: 2, c: 13 }, { r: 0, c: 12 }, { r: 1, c: 13 }
]

const DEFAULT_STAGE = campaignStages[0]

// 8 方向（含斜向）
const DIRS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],            [0, 1],
  [1, -1],  [1, 0],  [1, 1]
]

// 战斗道具定义（对应 gameData.player.items 计数）
// target：oneAlly(需选目标) / allAlly(即时生效)
const ITEM_DEFS = [
  { id: 'herb', name: '金疮药', desc: '恢复目标30%最大血量', type: 'heal', target: 'oneAlly', value: 0.3 },
  { id: 'charm', name: '护甲符', desc: '目标防御+10，持续2回合', type: 'buffDefFlat', target: 'oneAlly', value: 10, duration: 2 },
  { id: 'pill', name: '回春丹', desc: '我方全体恢复20%最大血量', type: 'healAll', target: 'allAlly', value: 0.2 }
]

// 战斗道具（金疮药等）施法距离，以及 BOSS 专属范围技能（areaEnemy，如"雷法"）施法中心选取距离：曼哈顿距离，与武器射程统一化无关
// 英雄/敌方单位的普攻与单体/单体友军技能（oneEnemy/oneAlly）施法距离已统一改为武器系射程（见 _inAttackRange），不再使用此常量
const SKILL_RANGE = 5
const AREA_RANGE = 3  // 范围技能（威震）以施法者为中心的影响半径

// 怒气系统：技能按在技能列表中的顺序（第1/2/3个技能）消耗怒气 40/50/80
const SKILL_RAGE_COSTS = [40, 50, 80]
const MAX_RAGE = 100
const RAGE_ON_TURN_START = 20 // 每个单位自己回合开始时获得的怒气
const RAGE_ON_HIT = 10        // 单位受到伤害时获得的怒气

// 眩晕等控制效果概率触发，取低区间(5%~10%)；攻击/防御增减均为必定触发的百分比修正，不受此限制
const STUN_PROC_CHANCE = 0.08

const DEFAULT_LEVEL_NAME = '山贼剿灭战'
const AI_INTERVAL = 0.8 // 敌方 AI / 眩晕跳过 行动间隔（秒）
const LOG_MAX = 30      // 战斗日志最多保留条数

const MAX_ROUNDS = 100 // 回合数上限：满 100 回合仍未分出胜负则判我方失败
const MOVE_LEG_DURATION = 0.16 // 移动动画：每格滑动时长（秒）

// 战斗场景：网格战棋 —— 14×4 棋盘 + 左操作栏 + 右日志栏
export class BattleScene extends Scene {
  constructor(game, params) {
    super(game)
    this.levelId = (params && params.levelId) || null
    this.levelName = (params && params.levelName) || DEFAULT_LEVEL_NAME
    // 出征编队：主城出征弹窗选中的英雄id列表（1~4人），仅保留已解锁英雄；为空/全部无效时回退桃园三兄弟
    const rawTeam = (params && Array.isArray(params.team)) ? params.team : []
    const validTeam = rawTeam.filter(id => HERO_BATTLE_DEFS[id] && gameData.player.heroes[id] && gameData.player.heroes[id].unlocked).slice(0, 4)
    this.team = validTeam.length ? validTeam : ['liubei', 'guanyu', 'zhangfei']
  }

  enter() {
    // 进入战斗：停止主城音乐，播放战斗背景音乐（若音乐开关关闭则不播放）
    stopMainBg()
    playBattleBg()

    const w = this.game.width
    const h = this.game.height

    // 布局：顶部信息栏 + 中间棋盘 + 右日志栏 + 底部操作栏
    // 顶部信息栏加高为两行（关卡名/提示 + 回合与单位信息），并为立绘头顶预留空间
    this.topBarH = 74
    this.bottomBarH = 88 // 底部操作栏分两行排布（普攻+3技能 / 道具+自动+结束回合），需要比单行更高
    this.rightBarW = 200
    this.cols = 14
    this.rows = 4
    // 顶部信息栏右侧安全边距：避开抖音小游戏横屏右上角胶囊/分享按钮
    this.topBarRightPad = 110

    // 安全区：横屏刘海在左侧，safeArea.left 为刘海区宽度（无刘海设备为 0）
    this.safeL = 0
    this.safeR = w
    this.safeT = 0
    this.safeB = h
    try {
      const sa = tt.getSystemInfoSync().safeArea
      if (sa) {
        this.safeL = sa.left || 0
        this.safeR = sa.right != null ? sa.right : w
        this.safeT = sa.top || 0
        this.safeB = sa.bottom != null ? sa.bottom : h
      }
    } catch (e) { /* 取不到 safeArea 则全屏可用 */ }

    // 图片清单：[缓存key, 路径]
    this.imgList = [
      ['bg', 'assets/battle_bg.jpg'],
      ['tile_grass', 'assets/tiles/grass.png'],
      ['tile_forest', 'assets/tiles/forest.png'],
      ['tile_mountain', 'assets/tiles/mountain.png'],
      ['tile_road', 'assets/tiles/road.png'],
      ['hero_liubei', 'assets/hero/liubei.png'],
      ['hero_guanyu', 'assets/hero/guanyu.png'],
      ['hero_zhangfei', 'assets/hero/zhangfei.png'],
      ['hero_zhaoyun', 'assets/hero/zhaoyun.png'],
      ['hero_machao', 'assets/hero/machao.png'],
      ['hero_huangzhong', 'assets/hero/huangzhong.png'],
      ['hero_huangyueying', 'assets/hero/huangyueying.png'],
      ['hero_sunshangxiang', 'assets/hero/sunshangxiang.png'],
      ['hero_taishici', 'assets/hero/taishici.png'],
      ['hero_zhenji', 'assets/hero/zhenji.png'],
      ['hero_diaochan', 'assets/hero/diaochan.png'],
      ['hero_zhurong', 'assets/hero/zhurong.png'],
      ['enemy_huangjinbing', 'assets/bandit/minion.png'],
      ['enemy_daofushou', 'assets/bandit/boss.png'],
      // 第1章专属黄巾兵/黄巾弓手立绘
      ['enemy_yt_minion', 'assets/yt/minion.png'],
      ['enemy_yt_archer', 'assets/yt/archer.png'],
      // BOSS 正面立绘（未生成时自动回退为色块占位，见 _drawUnit）
      ['boss_zhangjiao', 'assets/boss/zhangjiao.png'],
      ['boss_huaxiong', 'assets/boss/huaxiong.png'],
      ['boss_lvbu', 'assets/boss/lvbu.png'],
      // 侧面立绘（移动动画时使用，默认朝右；BOSS 不使用侧面立绘，移动时仍显示正面立绘）
      ['side_liubei', 'assets/side/liubei.png'],
      ['side_guanyu', 'assets/side/guanyu.png'],
      ['side_zhangfei', 'assets/side/zhangfei.png'],
      ['side_zhaoyun', 'assets/side/zhaoyun.png'],
      ['side_machao', 'assets/side/machao.png'],
      ['side_huangzhong', 'assets/side/huangzhong.png'],
      ['side_taishici', 'assets/side/taishici.png'],
      ['side_sunshangxiang', 'assets/side/sunshangxiang.png'],
      ['side_diaochan', 'assets/side/diaochan.png'],
      ['side_huangyueying', 'assets/side/huangyueying.png'],
      ['side_zhurong', 'assets/side/zhurong.png'],
      ['side_zhenji', 'assets/side/zhenji.png'],
      ['side_huangjinbing', 'assets/side/minion.png'],
      ['side_daofushou', 'assets/side/boss.png'],
      // 第1章黄巾兵移动动画沿用通用小兵侧面立绘；黄巾弓手暂无侧面立绘，移动时回退显示正面立绘
      ['side_minion', 'assets/side/minion.png'],
      ['skill_rende', 'assets/skills/rende.png'],
      ['skill_guwu', 'assets/skills/guwu.png'],
      ['skill_jiuyuan', 'assets/skills/jiuyuan.png'],
      ['skill_qinglongzhan', 'assets/skills/qinglongzhan.png'],
      ['skill_wusheng', 'assets/skills/wusheng.png'],
      ['skill_weizhen', 'assets/skills/weizhen.png'],
      ['skill_paoxiao', 'assets/skills/paoxiao.png'],
      ['skill_mengjin', 'assets/skills/mengjin.png'],
      ['skill_nuhou', 'assets/skills/nuhou.png'],
      ['skill_pinming', 'assets/skills/pinming.png'],
      ['skill_zhongji', 'assets/skills/zhongji.png'],
      ['skill_leifa', 'assets/skills/leifa.png'],
      ['skill_fushui', 'assets/skills/fushui.png'],
      ['skill_yaoshu', 'assets/skills/yaoshu.png'],
      ['skill_liezhan', 'assets/skills/liezhan.png'],
      ['skill_zhanhou', 'assets/skills/zhanhou.png'],
      ['skill_hengsao', 'assets/skills/hengsao.png'],
      ['skill_wushuangluanwu', 'assets/skills/wushuangluanwu.png'],
      ['skill_tianxiawushuang', 'assets/skills/tianxiawushuang.png'],
      ['skill_chitutuxi', 'assets/skills/chitutuxi.png']
    ]
    this.imgs = {}
    this.loadedCount = 0
    this.ready = false
    this._loadImages()

    // 中间棋盘区：基于安全区计算，占满顶部信息栏与底部操作栏之间的全部高度
    const midX = this.safeL
    const midW = (this.safeR - this.safeL) - this.rightBarW
    const midY = this.safeT + this.topBarH
    // 格子边长：宽度优先，14 列铺满可用宽度，仅保留 2~4px 的微小边距
    const boardPad = 2
    this.cell = (midW - boardPad * 2) / this.cols
    // 高度方向额外预留 extraRows 个格高，防止单位立绘（1.7倍格高，含血条/怒气条/名字）超出顶部时被信息栏遮挡
    // 首行单位堆叠（自立绘顶部向上）实际所需高度含固定像素下限（名字/血条/怒气条最小可读尺寸），
    // 格子较小时这些下限相对格高占比更大，需据此推导最小预留行数，而非使用与格高无关的固定收紧值
    const nameHc = Math.max(13, this.cell * 0.22)
    const rageBarHc = Math.max(3, this.cell * 0.06)
    const barHc = Math.max(5, this.cell * 0.12)
    const stackGap = 2
    const stackH = nameHc + rageBarHc + barHc + stackGap * 3
    // 0.7 = 立绘（1.7倍格高）超出格顶部分；额外 0.15 格作缓冲，确保不贴边
    const minExtraRows = 0.7 + stackH / this.cell + 0.15
    // 若默认预留在当前格宽下放不下，逐级收紧：先减少预留高度（不低于实际所需最小值），再小幅压缩底部操作栏
    let extraRows = Math.max(2.0, minExtraRows)
    let midH = (this.safeB - this.safeT) - this.topBarH - this.bottomBarH
    let contentH = this.cell * (this.rows + extraRows)
    if (contentH > midH) {
      extraRows = minExtraRows
      contentH = this.cell * (this.rows + extraRows)
    }
    if (contentH > midH) {
      const minBottomBarH = 64
      const shrink = Math.min(this.bottomBarH - minBottomBarH, contentH - midH)
      if (shrink > 0) {
        this.bottomBarH -= shrink
        midH = (this.safeB - this.safeT) - this.topBarH - this.bottomBarH
      }
    }
    this.gridW = this.cell * this.cols
    this.gridH = this.cell * this.rows
    this.ox = midX + (midW - this.gridW) / 2  // 水平居中
    // 垂直方向：立绘预留高度 + 棋盘整体在剩余空间内居中
    const topClearance = this.cell * extraRows
    const offsetTop = midY + Math.max(0, (midH - contentH) / 2)
    this.oy = offsetTop + topClearance

    // 右侧日志栏几何（限制在安全区内）
    this.rightBarX = this.safeR - this.rightBarW
    this.logHeaderH = 28
    this.lineH = 18
    this.logViewH = ((this.safeB - this.safeT) - this.topBarH) - this.logHeaderH

    this.elapsed = 0
    this.floaters = []   // 飘字 { text, x, y, expire, color }
    this.effects = []    // 技能特效 { type, x, y, color, t, dur, extra }
    this.over = false
    this.result = null   // 'win' / 'lose'
    this.loseReason = null // 'wipeout'(全军覆没) / 'timeout'(回合数耗尽)
    this._endBtn = null    // 结束行动按钮热区
    this._attackBtn = null // 普通攻击按钮热区
    this._itemBtn = null   // 使用道具按钮热区
    this._exitBtn = null   // 退出战斗按钮热区
    this._skillBtns = []  // 技能按钮热区
    this._dialogBtns = []// 结算弹窗按钮热区
    this._itemDialogBtns = [] // 道具弹窗"使用"按钮热区
    this._itemDialogClose = null // 道具弹窗关闭按钮热区
    this._itemDialogPanel = null // 道具弹窗面板矩形（用于点击外部关闭）
    this._exitDialogBtns = []    // 退出确认弹窗按钮热区
    this._exitDialogPanel = null // 退出确认弹窗面板矩形
    this.skillSelecting = null  // 技能选目标状态 { skill, unit }
    this.attackSelecting = null // 普通攻击选目标状态 { unit }
    this.itemSelecting = null   // 道具选目标状态 { item }
    this.itemDialog = false     // 道具弹窗是否打开
    this.exitConfirm = false    // 退出确认弹窗是否打开
    this._skipPending = false  // 眩晕等待自动跳过
    this._logDrag = null       // 日志栏拖动滚动状态
    this.logScrollTop = 0
    this.cutscene = null // 大招过场动画状态 { phase, t, caster, skill, targetCell, color, shakeX, shakeY }；非空时输入/回合推进全部冻结

    // 初始化战斗数据
    this._initBattle()
  }

  // 离开战斗场景（胜利/失败/退出战斗均会切回主城触发）：停止战斗背景音乐，销毁音频上下文
  leave() {
    stopBattleBg()
  }

  // 异步加载所有图片，全部 onload 后才进渲染（加载中显示 loading）
  _loadImages() {
    const total = this.imgList.length
    const finish = () => {
      this.loadedCount++
      if (this.loadedCount >= total) this.ready = true
    }
    this.imgList.forEach(([key, path]) => {
      const img = tt.createImage()
      img.onload = () => { this.imgs[key] = img; finish() }
      // 加载失败也计数，避免卡在 loading
      img.onerror = () => { finish() }
      img.src = path
    })
  }

  // 初始化/重置战斗：地图、单位、行动队列、日志、回合
  _initBattle() {
    // 预置 14×4 地图：左上 2×2 森林、右下 1×3 山区、中间一行横向道路，其余草地
    // 0 草 1 林 2 山 3 路
    this.map = [
      [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2]
    ]

    // 当前关卡配置：按 levelId 匹配 campaignStages，未匹配时回退到第一关
    this.stage = campaignStages.find(s => s.id === this.levelId) || DEFAULT_STAGE
    // 称号「金币获取」加成：按百分比提升本关胜利奖励
    const titleEffects = currentTitleEffects()
    this.rewardGold = Math.round(this.stage.reward * (1 + titleEffects.goldGain / 100))

    // 生成单位（深拷贝定义，避免重启污染常量）
    // 英雄攻/血/防来自存档 gameData.player.heroes（招募升级后数值成长）+ 当前称号加成，其余（技能/速度）取自 HERO_BATTLE_DEFS
    // 上阵人数/顺序取自出征编队 this.team（1~4人），起始格按 TEAM_POSITIONS 分配
    const positions = TEAM_POSITIONS[this.team.length] || TEAM_POSITIONS[3]
    this.units = [
      ...this.team.map((heroId, i) => {
        const d = HERO_BATTLE_DEFS[heroId]
        const saved = gameData.player.heroes[heroId]
        const equipEff = heroEquipEffects(heroId)
        const allAttrMult = 1 + titleEffects.allAttr / 100
        const atk = Math.round((saved.atk + titleEffects.atk) * allAttrMult) + equipEff.atk
        const hp = Math.round((saved.hp + titleEffects.hp) * allAttrMult) + equipEff.hp
        const def = Math.round((saved.def + titleEffects.def) * allAttrMult) + equipEff.def
        // 装备绑定英雄技能伤害加成：仅当装备绑定英雄=佩戴者本人时生效，与称号技能威力%相加
        const skillDmgPct = heroEquipSkillDmgPct(heroId)
        // 武器系取自存档英雄数据（含旧存档兜底默认值），决定该英雄的攻击射程与伤害倍率
        const weaponType = saved.weaponType || 'jian'
        const pos = positions[i] || positions[positions.length - 1]
        return this._mkUnit({ ...d, atk, hp, def, skillDmgPct, weaponType, r: pos.r, c: pos.c }, 'hero')
      }),
      ...this._buildEnemiesForStage(this.stage).map(d => this._mkUnit(d, 'enemy'))
    ]

    this.floaters = []
    this.effects = []
    this.over = false
    this.result = null
    this.loseReason = null
    this.titleDrop = null
    this.equipDrop = null
    this._dialogBtns = []
    this._itemDialogBtns = []
    this._itemDialogClose = null
    this._itemDialogPanel = null
    this._exitDialogBtns = []
    this._exitDialogPanel = null
    this.skillSelecting = null
    this.attackSelecting = null
    this.itemSelecting = null
    this.itemDialog = false
    this._turnStartPos = null
    this._undoBtn = null
    this.exitConfirm = false
    this._skipPending = false
    this._logDrag = null
    this.logScrollTop = 0
    this.cutscene = null
    this.log = []
    this.round = 0 // _newRound 内自增到 1
    this.autoBattle = false // 自动战斗开关：仅本场战斗内有效

    // 行动队列：按速度降序
    this._newRound()
  }

  // 按关卡配置生成敌方单位定义：小兵按 enemyAtkScale/enemyHpScale 分别缩放攻/血/防，第5关额外加入 BOSS
  _buildEnemiesForStage(stage) {
    const defs = []
    let pi = 0
    const atkScale = stage.enemyAtkScale || 1
    const hpScale = stage.enemyHpScale || 1
    stage.minions.forEach((typeId, i) => {
      const base = ENEMY_MINION_DEFS[typeId]
      const pos = ENEMY_POSITIONS[pi++] || ENEMY_POSITIONS[ENEMY_POSITIONS.length - 1]
      defs.push({
        id: typeId + i,
        name: base.name,
        atk: Math.round(base.atk * atkScale),
        hp: Math.round(base.hp * hpScale),
        def: Math.round(base.def * atkScale),
        spd: base.spd,
        move: base.move,
        img: base.img,
        weaponType: base.weaponType,
        r: pos.r,
        c: pos.c,
        skills: base.skills
      })
    })
    if (stage.boss) {
      const b = BOSS_DEFS[stage.boss]
      const pos = ENEMY_POSITIONS[pi++] || ENEMY_POSITIONS[ENEMY_POSITIONS.length - 1]
      defs.push({
        id: stage.boss,
        name: b.name,
        atk: b.atk,
        hp: b.hp,
        def: b.def,
        spd: b.spd,
        move: b.move,
        img: b.img,
        weaponType: b.weaponType,
        r: pos.r,
        c: pos.c,
        skills: b.skills,
        isBoss: true
      })
    }
    return defs
  }

  _mkUnit(def, side) {
    return {
      id: def.id,
      name: def.name,
      side: side,
      atk: def.atk,
      hp: def.hp,
      maxHp: def.hp,
      def: def.def,
      spd: def.spd,
      move: def.move,
      img: def.img,
      r: def.r,
      c: def.c,
      isBoss: !!def.isBoss, // BOSS：更大立绘、移动时不切换侧面立绘（沿用正面立绘/占位）
      weaponType: def.weaponType || 'jian', // 武器系：决定攻击射程与伤害倍率（见 _weaponMeta/_inAttackRange/_attack）
      skillDmgPct: def.skillDmgPct || 0, // 装备绑定英雄技能伤害加成百分比（仅英雄单位可能非0）
      facing: { dr: 0, dc: side === 'hero' ? 1 : -1 }, // 英雄朝东、敌方朝西
      moved: false,
      attacked: false,
      acted: false,
      dead: false,
      // 移动动画状态：moving 为 true 时逐格滑动，使用侧面立绘朝行进方向显示
      moving: false,
      _movePath: null,   // 剩余待走的格子队列
      _animFrom: null,   // 当前这一格动画的起点 {r,c}
      _animTo: null,     // 当前这一格动画的终点 {r,c}
      _animT: 0,         // 当前这一格动画已耗时（秒）
      _onMoveDone: null, // 全部移动完成后的回调
      _faceRight: side === 'hero', // 侧面立绘朝向：true=朝右(默认图朝向)，false=需镜像；纵向移动沿用上次水平朝向
      // 技能状态（cd：技能冷却剩余回合数，仅 BOSS 多技能时使用，每回合递减；cost：怒气消耗，按技能顺序 40/50/80）
      skills: def.skills ? def.skills.map((s, i) => ({ ...s, cd: 0, cost: SKILL_RAGE_COSTS[i] != null ? SKILL_RAGE_COSTS[i] : 80 })) : [],
      skillUsed: false,     // 本回合是否已释放技能
      rage: 0,              // 怒气（0~100）：自身回合开始+20，受击+10；技能按消耗扣减，回合间不重置
      atkBuff: 0,           // 攻击增益倍率（0.2 = +20%）
      atkBuffTurns: 0,      // 增益剩余回合
      atkDebuff: 0,         // 攻击减益倍率（0.2 = -20%，如"妖术"）
      atkDebuffTurns: 0,    // 攻击减益剩余回合
      defDebuff: 0,         // 防御减益倍率（0.2 = -20%）
      defDebuffTurns: 0,    // 减益剩余回合
      defBuffFlat: 0,       // 道具护甲符附加防御（固定值）
      defBuffFlatTurns: 0,  // 护甲符剩余回合
      stunned: 0,           // 眩晕剩余回合（>0 时跳过行动）
      hitT: 0                // 受击反馈剩余时间（秒）：>0 时立绘闪白并抖动
    }
  }

  // 受击反馈：扣血单位闪白+抖动（由 update 中按 hitT 衰减驱动），并播放受击音效（含节流）
  _applyDamage(target, dmg) {
    target.hp -= dmg
    target.hitT = HIT_ANIM_DURATION
    target.rage = Math.min(MAX_RAGE, (target.rage || 0) + RAGE_ON_HIT)
    playHit()
  }

  // 新一轮：按速度排序、重置行动标记、递增益/减益计时器
  _newRound() {
    this.round++
    this._addLog('━━ 第 ' + this.round + ' 回合 ━━', '#9aa6bd')

    const living = this.units.filter(u => !u.dead)
    living.forEach(u => {
      u.moved = false
      u.attacked = false
      u.acted = false
      u.skillUsed = false
      // 攻击增益计时器递减
      if (u.atkBuffTurns > 0) {
        u.atkBuffTurns--
        if (u.atkBuffTurns <= 0) { u.atkBuff = 0; u.atkBuffTurns = 0 }
      }
      // 攻击减益计时器递减
      if (u.atkDebuffTurns > 0) {
        u.atkDebuffTurns--
        if (u.atkDebuffTurns <= 0) { u.atkDebuff = 0; u.atkDebuffTurns = 0 }
      }
      // 防御减益计时器递减
      if (u.defDebuffTurns > 0) {
        u.defDebuffTurns--
        if (u.defDebuffTurns <= 0) { u.defDebuff = 0; u.defDebuffTurns = 0 }
      }
      // 护甲符（固定防御加成）计时器递减
      if (u.defBuffFlatTurns > 0) {
        u.defBuffFlatTurns--
        if (u.defBuffFlatTurns <= 0) { u.defBuffFlat = 0; u.defBuffFlatTurns = 0 }
      }
      // 技能冷却递减（BOSS 多技能使用）
      u.skills.forEach(s => { if (s.cd > 0) s.cd-- })
    })
    living.sort((a, b) => b.spd - a.spd)
    this.queue = living
    this.qIdx = 0
    this.current = this.queue[0] || null
    this._startTurn(this.current)
  }

  _startTurn(unit) {
    if (!unit) return
    this.current = unit
    this.selected = unit
    unit.rage = Math.min(MAX_RAGE, (unit.rage || 0) + RAGE_ON_TURN_START)
    this.movableCells = []
    this.aiDelay = 0
    this._skipPending = false
    this.skillSelecting = null
    this.attackSelecting = null
    this.itemSelecting = null
    this.itemDialog = false
    // 记录本回合起始格：移动后、攻击/技能提交前可点「回退」或再次点击单位撤回移动（见 _undoMove）
    this._turnStartPos = { r: unit.r, c: unit.c }

    // 眩晕：跳过本回合（敌我均自动等待后跳过）
    if (unit.stunned > 0) {
      this._skipPending = true
      this.hint = unit.name + ' 眩晕中，跳过回合'
      this._addLog(unit.name + ' 眩晕中，跳过回合', '#c9a8e0')
      return
    }

    if (unit.side === 'hero') {
      if (this.autoBattle) {
        this.movableCells = []
        this.hint = unit.name + ' 自动行动中…'
      } else {
        this.movableCells = unit.moved ? [] : this._movableCells(unit)
        this.hint = '点绿格移动，点敌方攻击，或点左侧普攻/技能'
      }
    } else {
      this.hint = unit.name + ' 思索中…'
    }
  }

  // 推进到下一单位；队列执行完则进入下一轮
  _advance() {
    this.qIdx++
    while (this.qIdx < this.queue.length && this.queue[this.qIdx].dead) this.qIdx++
    if (this.qIdx >= this.queue.length) {
      this._newRound()
      return
    }
    this._startTurn(this.queue[this.qIdx])
  }

  _endTurn() {
    if (this.current) this.current.acted = true
    this._checkSettle()
    if (this.over) return
    this._advance()
  }

  // 胜负判定（胜利时金钱 +500 写入 mock 数据）
  _checkSettle() {
    const heroes = this.units.filter(u => u.side === 'hero' && !u.dead)
    const enemies = this.units.filter(u => u.side === 'enemy' && !u.dead)
    if (enemies.length === 0) {
      this.over = true
      this.result = 'win'
      gameData.resources.gold += this.rewardGold
      // completeStage 内部会保存存档（含金币与出征进度）
      if (this.levelId) completeStage(this.levelId)
      else saveGame()
      this._addLog('我方胜利！获得金钱 +' + this.rewardGold, '#e8c96a')
      // 称号掉落：概率/品质随关卡难度浮动，重复称号自动转化为金币
      this.titleDrop = rollTitleDrop(this.stage)
      if (this.titleDrop) {
        if (this.titleDrop.isNew) {
          this._addLog(`获得称号：${this.titleDrop.title.name}（${QUALITY_META[this.titleDrop.title.quality].name}）`, QUALITY_META[this.titleDrop.title.quality].color)
        } else {
          this._addLog(`重复称号，转化为金币 +${this.titleDrop.goldGained}`, '#e8c96a')
        }
      }
      // 装备掉落：概率/品质随关卡难度浮动，红装仅可通过掉落获得，重复装备自动转化为金币
      this.equipDrop = rollEquipDrop(this.stage)
      if (this.equipDrop) {
        if (this.equipDrop.isNew) {
          this._addLog(`获得装备：${this.equipDrop.equip.name}（${QUALITY_META[this.equipDrop.equip.quality].name}）`, QUALITY_META[this.equipDrop.equip.quality].color)
        } else {
          this._addLog(`重复装备，转化为金币 +${this.equipDrop.goldGained}`, '#e8c96a')
        }
      }
    } else if (heroes.length === 0) {
      this.over = true
      this.result = 'lose'
      this.loseReason = 'wipeout'
      this._addLog('我方全军覆没', '#d75b5b')
    } else if (this.round >= MAX_ROUNDS && this.qIdx >= this.queue.length - 1) {
      // 第 100 回合的最后一名单位行动结束，双方均未被全歼：判定回合数耗尽，我方失败
      this.over = true
      this.result = 'lose'
      this.loseReason = 'timeout'
      this._addLog('回合数耗尽，挑战失败', '#d75b5b')
    }
  }

  update(dt) {
    this.elapsed += dt
    // 大招过场动画进行中：冻结其余所有动画/回合推进，仅推进过场动画自身状态
    if (this.cutscene) {
      this._updateCutscene(dt)
      return
    }
    // 飘字倒计时
    if (this.floaters.length) {
      this.floaters = this.floaters.filter(f => {
        f.expire -= dt
        return f.expire > 0
      })
    }
    // 技能特效计时衰减：超过持续时间的特效自动移除
    if (this.effects.length) {
      this.effects.forEach(e => { e.t += dt })
      this.effects = this.effects.filter(e => e.t <= e.dur)
    }
    // 受击反馈计时衰减（闪白+抖动，与回合/AI 计时独立）
    if (this.units) {
      this.units.forEach(u => {
        if (u.hitT > 0) {
          u.hitT -= dt
          if (u.hitT < 0) u.hitT = 0
        }
      })
    }
    // 推进所有单位的移动滑动动画（与回合/AI 计时独立）
    if (this.ready) {
      this.units.forEach(u => { if (u.moving) this._advanceUnitAnim(u, dt) })
    }

    if (!this.ready || this.over || !this.current) return

    // 眩晕自动跳过（敌我均适用）
    if (this._skipPending) {
      this.aiDelay += dt
      if (this.aiDelay >= AI_INTERVAL) {
        this.current.stunned--
        this._skipPending = false
        this._endTurn()
      }
      return
    }
    // AI 计时：敌方单位始终由 AI 控制；我方英雄在「自动」开启时同样交由 AI 控制
    // 移动动画进行中暂不重复触发行动
    const aiControlled = this.current.side === 'enemy' || (this.current.side === 'hero' && this.autoBattle)
    if (aiControlled && !this.current.moving) {
      this.aiDelay += dt
      if (this.aiDelay >= AI_INTERVAL) {
        this._aiAct(this.current)
      }
    }
  }

  // ---- 大招（技能3）过场动画 ----
  // 释放第3个技能（大招）时先播放过场动画：intro闪屏 → show立绘定格+技能名 → burst全屏爆发；
  // 期间输入与回合推进全部冻结，动画结束后再调用 _resolveSkillEffect 结算真实伤害/效果（目标在起手时已确定，期间无其它逻辑推进，无需重新校验）
  _startCutscene(caster, skill, targetCell) {
    this.cutscene = {
      phase: 'intro',
      t: 0,
      caster,
      skill,
      targetCell,
      color: this._skillEffectColor(caster),
      shakeX: 0,
      shakeY: 0
    }
    // 清理可能残留的选择态高亮，避免与过场遮罩叠加显示
    this.skillSelecting = null
    this.attackSelecting = null
    this.movableCells = []
  }

  // 按阶段推进过场动画计时，到时切换下一阶段；burst阶段结算真实伤害并结束过场
  _updateCutscene(dt) {
    const cs = this.cutscene
    cs.t += dt
    if (cs.phase === 'intro') {
      if (cs.t >= CUTSCENE_INTRO_DUR) { cs.phase = 'show'; cs.t = 0 }
    } else if (cs.phase === 'show') {
      if (cs.t >= CUTSCENE_SHOW_DUR) { cs.phase = 'burst'; cs.t = 0 }
    } else if (cs.phase === 'burst') {
      // 屏幕震动：每帧随机小幅偏移，制造爆发冲击感
      cs.shakeX = (Math.random() - 0.5) * 10
      cs.shakeY = (Math.random() - 0.5) * 10
      if (cs.t >= CUTSCENE_BURST_DUR) {
        const { caster, skill, targetCell } = cs
        this.cutscene = null
        this._resolveSkillEffect(caster, skill, targetCell)
      }
    }
  }

  // 推进单位当前这一格的滑动动画；到时后切下一格或结束移动并触发回调
  _advanceUnitAnim(u, dt) {
    u._animT += dt
    if (u._animT < MOVE_LEG_DURATION) return
    if (u._movePath && u._movePath.length) {
      this._beginNextLeg(u)
    } else {
      u.moving = false
      u._animFrom = null
      u._animTo = null
      const cb = u._onMoveDone
      u._onMoveDone = null
      if (cb) cb()
    }
  }

  // 缓入缓出（quad）
  _easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
  }

  // 开始一段多格移动：path 为不含起点的格子序列，逐格滑动，全部完成后调用 onDone
  _startMove(unit, path, onDone) {
    if (!path || !path.length) {
      if (onDone) onDone()
      return
    }
    unit.moving = true
    unit._movePath = path.slice()
    unit._onMoveDone = onDone || null
    this._beginNextLeg(unit)
  }

  // 取出下一格目标，设置动画起止点，并立即更新逻辑坐标/朝向（视觉位置由动画插值）
  _beginNextLeg(unit) {
    const next = unit._movePath.shift()
    unit._animFrom = { r: unit.r, c: unit.c }
    unit._animTo = { r: next.r, c: next.c }
    unit._animT = 0
    const dr = next.r - unit.r
    const dc = next.c - unit.c
    if (dr !== 0 || dc !== 0) unit.facing = { dr, dc }
    if (dc !== 0) unit._faceRight = dc > 0 // 纵向移动（dc===0）沿用上次水平朝向
    unit.r = next.r
    unit.c = next.c
  }

  // 单位当前渲染位置（浮点行列）：移动中按缓动插值，否则为逻辑格
  _unitRenderPos(u) {
    if (u.moving && u._animFrom && u._animTo) {
      const t = this._easeInOut(Math.min(1, u._animT / MOVE_LEG_DURATION))
      return {
        r: u._animFrom.r + (u._animTo.r - u._animFrom.r) * t,
        c: u._animFrom.c + (u._animTo.c - u._animFrom.c) * t
      }
    }
    return { r: u.r, c: u.c }
  }

  // 由正面立绘 key（如 hero_liubei/enemy_daofushou）推导对应侧面立绘 key
  _sideImgKey(u) {
    const parts = u.img.split('_')
    return 'side_' + parts[parts.length - 1]
  }

  render(ctx) {
    const w = this.game.width
    const h = this.game.height
    // 加载中
    if (!this.ready) {
      ctx.fillStyle = '#10151c'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#e8c96a'
      ctx.font = 'bold 24px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const dots = '.'.repeat((Math.floor(this.elapsed * 2) % 3) + 1)
      ctx.fillText('加载中' + dots, w / 2, h / 2)
      ctx.fillStyle = '#8a9bb5'
      ctx.font = '14px sans-serif'
      ctx.fillText(`${this.loadedCount}/${this.imgList.length}`, w / 2, h / 2 + 34)
      return
    }

    // 大招过场 burst 阶段：整屏随机小幅偏移，制造冲击震动感
    const shaking = this.cutscene && this.cutscene.phase === 'burst'
    if (shaking) {
      ctx.save()
      ctx.translate(this.cutscene.shakeX, this.cutscene.shakeY)
    }

    this._drawBg(ctx)       // 背景铺满
    this._drawTiles(ctx)    // 地形格子
    this._drawMovable(ctx)  // 可移动格高亮
    this._drawAttackTargets(ctx) // 可攻击敌方高亮
    this._drawSkillTargets(ctx)  // 技能选目标高亮
    this._drawItemTargets(ctx)   // 道具选目标高亮
    // 按行从上到下绘制：立绘会向上超出格子，需保证下方（前排）单位覆盖上方单位
    this.units.filter(u => !u.dead).sort((a, b) => a.r - b.r).forEach(u => this._drawUnit(ctx, u))
    this._drawEffects(ctx)  // 技能特效（叠加在单位之上，UI 面板之下）
    this._drawFloaters(ctx) // 飘字
    this._drawTopBar(ctx)   // 顶部信息栏（含退出战斗按钮）
    this._drawBottomBar(ctx) // 底部操作栏（普攻+技能+使用道具+结束）
    this._drawRightBar(ctx) // 右侧战斗日志栏
    if (this.itemDialog) this._drawItemDialog(ctx)   // 道具弹窗
    if (this.exitConfirm) this._drawExitConfirm(ctx) // 退出确认弹窗
    if (this.over) this._drawSettle(ctx) // 胜负结算
    if (this.cutscene) this._drawCutscene(ctx) // 大招过场：全屏闪光/立绘+技能名/爆发特效，叠加在最上层

    if (shaking) ctx.restore()
  }

  // 大招过场动画绘制：intro全屏染色闪屏 → show半透明黑幕+大立绘+技能名定格 → burst全屏闪光+扩散光环/放射线（立绘同步淡出）
  _drawCutscene(ctx) {
    const cs = this.cutscene
    const w = this.game.width
    const h = this.game.height
    const cx = w / 2
    const cy = h / 2

    if (cs.phase === 'intro') {
      // 快速闪屏：染上技能色 + 暗幕，alpha 随时间爬升
      const p = Math.min(1, cs.t / CUTSCENE_INTRO_DUR)
      ctx.save()
      ctx.globalAlpha = p * 0.7
      ctx.fillStyle = cs.color
      ctx.fillRect(0, 0, w, h)
      ctx.globalAlpha = p * 0.5
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, w, h)
      ctx.restore()
      return
    }

    // show/burst 阶段共用：半透明黑幕背景 + 施法者立绘（约占屏高40%）+ 技能名；burst 阶段立绘渐隐
    const portraitAlpha = cs.phase === 'burst' ? Math.max(0, 1 - cs.t / CUTSCENE_BURST_DUR) : 1

    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.62)'
    ctx.fillRect(0, 0, w, h)

    const img = this.imgs[cs.caster.img]
    const portraitH = h * 0.4
    const aspect = (img && img.width) ? img.width / img.height : 0.62
    const portraitW = portraitH * aspect

    ctx.globalAlpha = portraitAlpha
    if (img && img.width) {
      ctx.drawImage(img, cx - portraitW / 2, cy - portraitH / 2, portraitW, portraitH)
    }

    // 技能名：施法者技能色，粗体大字，位于立绘下方
    ctx.fillStyle = cs.color
    ctx.font = 'bold 40px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.shadowColor = 'rgba(0,0,0,0.85)'
    ctx.shadowBlur = 10
    ctx.fillText('「' + cs.skill.name + '！」', cx, cy + portraitH / 2 + 42)
    ctx.restore()

    if (cs.phase === 'burst') {
      const p = Math.min(1, cs.t / CUTSCENE_BURST_DUR)

      // 全屏闪光：由亮转弱
      ctx.save()
      ctx.globalAlpha = Math.max(0, 1 - p) * 0.85
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
      ctx.restore()

      // 由中心向外扩散的光环
      ctx.save()
      ctx.strokeStyle = cs.color
      ctx.globalAlpha = 1 - p
      ctx.lineWidth = 6 * (1 - p) + 1
      ctx.beginPath()
      ctx.arc(cx, cy, p * Math.max(w, h) * 0.7, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()

      // 中心向外的放射线条
      ctx.save()
      ctx.strokeStyle = cs.color
      ctx.globalAlpha = (1 - p) * 0.8
      ctx.lineWidth = 3
      const lineLen = p * Math.max(w, h) * 0.6
      const lines = 16
      for (let i = 0; i < lines; i++) {
        const ang = (Math.PI * 2 / lines) * i
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(ang) * lineLen * 0.3, cy + Math.sin(ang) * lineLen * 0.3)
        ctx.lineTo(cx + Math.cos(ang) * lineLen, cy + Math.sin(ang) * lineLen)
        ctx.stroke()
      }
      ctx.restore()
    }
  }

  // 背景等比裁剪铺满（cover）
  _drawBg(ctx) {
    const w = this.game.width
    const h = this.game.height
    const img = this.imgs.bg
    if (!img || !img.width) {
      ctx.fillStyle = '#1a2332'
      ctx.fillRect(0, 0, w, h)
      return
    }
    const scale = Math.max(w / img.width, h / img.height)
    const dw = img.width * scale
    const dh = img.height * scale
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh)
  }

  _drawTiles(ctx) {
    const cell = this.cell
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const x = this.ox + c * cell
        const y = this.oy + r * cell
        const t = this.map[r][c]
        const img = this.imgs[TERRAIN_IMG[t]]
        if (img) {
          ctx.drawImage(img, x, y, cell, cell)
        } else {
          // 贴图未就绪时的兜底色
          ctx.fillStyle = t === TERRAIN.MOUNTAIN ? '#6b6257'
            : t === TERRAIN.FOREST ? '#2c5e2e'
              : t === TERRAIN.ROAD ? '#a8915c' : '#3d7a3a'
          ctx.fillRect(x, y, cell, cell)
        }
        // 格线
        ctx.strokeStyle = 'rgba(0,0,0,0.2)'
        ctx.lineWidth = 1
        ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1)
      }
    }
  }

  _drawMovable(ctx) {
    if (!this.movableCells || !this.movableCells.length) return
    const cell = this.cell
    this.movableCells.forEach(m => {
      const x = this.ox + m.c * cell
      const y = this.oy + m.r * cell
      ctx.fillStyle = 'rgba(46,139,87,0.35)'
      ctx.fillRect(x, y, cell, cell)
      ctx.strokeStyle = '#7fffaa'
      ctx.lineWidth = 2
      ctx.strokeRect(x + 1, y + 1, cell - 2, cell - 2)
    })
  }

  // 当前我方单位可攻击的相邻敌方红框高亮（技能/普攻选目标时也显示）
  _drawAttackTargets(ctx) {
    if (this.skillSelecting || this.itemSelecting) return
    if (!this.current || this.current.side !== 'hero' || this.current.attacked || this.over || this.current.moving) return
    const cell = this.cell
    const strong = !!this.attackSelecting // 普攻选目标时加粗高亮
    this._attackableEnemies(this.current).forEach(e => {
      const x = this.ox + e.c * cell
      const y = this.oy + e.r * cell
      ctx.strokeStyle = '#ff5b4d'
      ctx.lineWidth = strong ? 4 : 2
      ctx.strokeRect(x + 1, y + 1, cell - 2, cell - 2)
      if (strong) {
        ctx.fillStyle = 'rgba(255,91,77,0.18)'
        ctx.fillRect(x, y, cell, cell)
      }
    })
  }

  // 技能选目标时：先按单位武器系射程（与普攻同一射程来源，见 _inAttackRange）高亮可达格（同移动格高亮样式，橙色以区分），
  // 再对有效目标画绿/红框（超出武器射程的目标不高亮、不可选，与普攻射程完全一致）
  _drawSkillTargets(ctx) {
    if (!this.skillSelecting) return
    const skill = this.skillSelecting.skill
    const caster = this.skillSelecting.unit
    const cell = this.cell
    if (skill.target !== 'oneAlly' && skill.target !== 'oneEnemy') return
    const wt = this._weaponMeta(caster)
    const minR = wt.minRange || 1
    const maxR = wt.range

    // 施法射程范围提示：与武器攻击射程同一来源，样式与移动格高亮一致（仅换色以区分技能/移动）
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const d = this._dist(caster, { r, c })
        if (d < minR || d > maxR) continue
        const x = this.ox + c * cell
        const y = this.oy + r * cell
        ctx.fillStyle = 'rgba(232,160,60,0.30)'
        ctx.fillRect(x, y, cell, cell)
        ctx.strokeStyle = '#ffb454'
        ctx.lineWidth = 2
        ctx.strokeRect(x + 1, y + 1, cell - 2, cell - 2)
      }
    }

    if (skill.target === 'oneAlly') {
      // 射程内的我方单位画绿框，射程外的不可选
      this.units.filter(u => u.side === caster.side && !u.dead && this._inAttackRange(caster, u)).forEach(u => {
        const x = this.ox + u.c * cell
        const y = this.oy + u.r * cell
        ctx.strokeStyle = '#7fffaa'
        ctx.lineWidth = 3
        ctx.strokeRect(x + 1, y + 1, cell - 2, cell - 2)
      })
    } else if (skill.target === 'oneEnemy') {
      // 射程内的敌方单位画红框（可点击释放），射程外的不可选
      this.units.filter(u => u.side !== caster.side && !u.dead && this._inAttackRange(caster, u)).forEach(u => {
        const x = this.ox + u.c * cell
        const y = this.oy + u.r * cell
        ctx.strokeStyle = '#ff5b4d'
        ctx.lineWidth = 3
        ctx.strokeRect(x + 1, y + 1, cell - 2, cell - 2)
      })
    }
  }

  // 道具选目标时高亮可选我方单位（绿框，仅 oneAlly 类道具需要，超出施法距离不可选）
  _drawItemTargets(ctx) {
    if (!this.itemSelecting) return
    const caster = this.current
    const cell = this.cell
    // 施法距离范围提示
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this._manhattan(caster, { r, c }) > SKILL_RANGE) continue
        const x = this.ox + c * cell
        const y = this.oy + r * cell
        ctx.fillStyle = 'rgba(232,201,106,0.10)'
        ctx.fillRect(x, y, cell, cell)
      }
    }
    this.units.filter(u => u.side === 'hero' && !u.dead && this._manhattan(caster, u) <= SKILL_RANGE).forEach(u => {
      const x = this.ox + u.c * cell
      const y = this.oy + u.r * cell
      ctx.strokeStyle = '#7fffaa'
      ctx.lineWidth = 3
      ctx.strokeRect(x + 1, y + 1, cell - 2, cell - 2)
    })
  }

  // 单位：站立式立绘（脚底对齐格子底部中心，立绘高度约1.6~1.8倍格高）+ 血条 + 名字
  _drawUnit(ctx, u) {
    const cell = this.cell
    const pos = this._unitRenderPos(u)
    const x = this.ox + pos.c * cell
    const y = this.oy + pos.r * cell
    const cx = x + cell / 2
    const feetY = y + cell // 脚底：格子底部中心

    // 移动中显示侧面立绘（朝行进方向），静止显示正面立绘；BOSS 无侧面立绘，移动时仍用正面立绘/占位
    const moving = !!u.moving
    const sideImg = u.isBoss ? null : this.imgs[this._sideImgKey(u)]
    const img = (moving && sideImg && sideImg.width) ? sideImg : this.imgs[u.img]

    // 立绘等比缩放（不裁剪），高度约为格高的 1.7 倍（BOSS 更大，2.2 倍），比格子更高更显眼
    const aspect = (img && img.width) ? img.width / img.height : 0.62
    const portraitH = cell * (u.isBoss ? 2.2 : 1.7)
    let portraitW = portraitH * aspect
    portraitW = Math.min(portraitW, cell * 1.4) // 限制最大宽度，避免过度遮挡相邻格
    const portraitTop = feetY - portraitH
    const px = cx - portraitW / 2

    // 受击抖动：hitT 衰减期内小幅高频震荡（仅立绘偏移，血条/名字/阴影保持原位）
    let shakeX = 0
    let shakeY = 0
    if (u.hitT > 0) {
      const shakeStrength = u.hitT / HIT_ANIM_DURATION
      shakeX = Math.sin(u.hitT * 60) * 4 * shakeStrength
      shakeY = Math.cos(u.hitT * 80) * 2 * shakeStrength
    }
    const drawPx = px + shakeX
    const drawPortraitTop = portraitTop + shakeY

    // 脚下阴影，强化"站立在格子上"的观感
    ctx.save()
    ctx.globalAlpha = 0.35
    ctx.fillStyle = '#000'
    ctx.beginPath()
    ctx.ellipse(cx, feetY - 2, cell * 0.32, cell * 0.1, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    if (img && img.width) {
      // 侧面立绘默认朝右；朝左移动时用负缩放水平镜像
      if (moving && !u._faceRight) {
        ctx.save()
        ctx.translate(drawPx + portraitW, drawPortraitTop)
        ctx.scale(-1, 1)
        ctx.drawImage(img, 0, 0, portraitW, portraitH)
        ctx.restore()
      } else {
        ctx.drawImage(img, drawPx, drawPortraitTop, portraitW, portraitH)
      }
    } else {
      ctx.fillStyle = '#3a4258'
      ctx.fillRect(drawPx, drawPortraitTop, portraitW, portraitH)
    }

    // 受击闪白：仅在已绘制的立绘像素上叠加白色（source-atop 保证不越界到透明区域）
    if (u.hitT > 0) {
      const flashAlpha = Math.min(0.75, (u.hitT / HIT_ANIM_DURATION) * 0.75)
      ctx.save()
      ctx.globalCompositeOperation = 'source-atop'
      ctx.globalAlpha = flashAlpha
      ctx.fillStyle = '#fff'
      ctx.fillRect(drawPx, drawPortraitTop, portraitW, portraitH)
      ctx.restore()
    }

    // 血条 + 怒气条 + 名字：从上到下依次为 血条 → 怒气条（细） → 名字 → 立绘
    const barW = Math.min(Math.max(portraitW, cell * 0.9), cell * 1.3)
    const barH = Math.max(5, Math.round(cell * 0.12))
    const rageBarH = Math.max(3, Math.round(cell * 0.06))
    const nameH = Math.max(13, Math.round(cell * 0.22))
    const gap = 2
    const nameTop = portraitTop - gap - nameH
    const rageBarTop = nameTop - gap - rageBarH
    const barTop = rageBarTop - gap - barH
    const barX = cx - barW / 2

    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(barX - 1, barTop - 1, barW + 2, barH + 2)
    ctx.fillStyle = '#444'
    ctx.fillRect(barX, barTop, barW, barH)
    ctx.fillStyle = u.side === 'hero' ? '#4caf50' : '#d43d2a'
    ctx.fillRect(barX, barTop, barW * Math.max(0, u.hp / u.maxHp), barH)
    ctx.fillStyle = '#fff'
    ctx.font = Math.max(9, Math.round(cell * 0.16)) + 'px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(u.hp), cx, barTop + barH / 2)

    // 怒气条：橙黄色细条，按 rage/100 填充
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(barX - 1, rageBarTop - 1, barW + 2, rageBarH + 2)
    ctx.fillStyle = '#3a3220'
    ctx.fillRect(barX, rageBarTop, barW, rageBarH)
    ctx.fillStyle = '#e8a13a'
    ctx.fillRect(barX, rageBarTop, barW * Math.max(0, Math.min(1, (u.rage || 0) / MAX_RAGE)), rageBarH)

    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(barX, nameTop, barW, nameH)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold ' + Math.max(10, Math.round(cell * 0.2)) + 'px sans-serif'
    ctx.fillText(u.name, cx, nameTop + nameH / 2)

    // 当前行动单位：仅脚下柔和淡蓝光环（不用醒目的黄色，保持画面干净）
    if (this.current === u && !this.over) {
      ctx.save()
      ctx.globalAlpha = 0.5
      ctx.strokeStyle = '#8fd8ff'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.ellipse(cx, feetY - 2, cell * 0.36, cell * 0.12, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
    // 眩晕状态：紫色描边
    if (u.stunned > 0) {
      ctx.strokeStyle = '#b066d4'
      ctx.lineWidth = 2
      ctx.strokeRect(px + 2, portraitTop + 2, portraitW - 4, portraitH - 4)
    }
  }

  // 等比裁剪绘制（cover）：图片居中裁剪填满目标矩形
  _drawCover(ctx, img, x, y, w, h) {
    if (!img || !img.width) {
      ctx.fillStyle = '#3a4258'
      ctx.fillRect(x, y, w, h)
      return
    }
    const scale = Math.max(w / img.width, h / img.height)
    const dw = img.width * scale
    const dh = img.height * scale
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
  }

  _drawFloaters(ctx) {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    this.floaters.forEach(f => {
      ctx.fillStyle = f.color || '#ff5b4d'
      ctx.font = 'bold 16px sans-serif'
      ctx.fillText(f.text, f.x, f.y)
    })
  }

  // 在单位头顶生成飘字
  _spawnFloater(unit, text, color) {
    const cx = this.ox + unit.c * this.cell + this.cell / 2
    const cy = this.oy + unit.r * this.cell + this.cell / 2
    this.floaters.push({ text, x: cx, y: cy, expire: 1, color: color || '#ff5b4d' })
  }

  // ---- 技能特效系统 ----
  // 特效对象结构：{ type, x, y, color, t(已存活时间), dur(总时长), extra(类型专属数据) }
  // update(dt) 中按 t 递增并在 t>dur 时移除；render 中按 type 分派绘制

  // 各武将技能特效主色：刘备绿金 / 关羽青白 / 张飞红橙 / 张角雷电黄白 / 华雄暗红 / 吕布绯紫
  static get HERO_EFFECT_COLORS() {
    return {
      liubei: '#8fe6a0',
      guanyu: '#7fdfff',
      zhangfei: '#ff7a3d',
      zhangjiao: '#fff27a',
      huaxiong: '#8b2020',
      lvbu: '#b23bcf'
    }
  }

  // 治疗特效统一配色（绿金），与施法者身份无关
  static get HEAL_COLOR() { return '#8fe6a0' }

  // 取伤害类技能（命中/范围/突进）的特效主色：优先按施法者身份取色，小兵等未定义身份则用默认橙红
  _skillEffectColor(caster) {
    return BattleScene.HERO_EFFECT_COLORS[caster.id] || '#ff9b6a'
  }

  // 格子中心像素坐标（与飘字定位方式一致）
  _cellCenter(r, c) {
    return { x: this.ox + c * this.cell + this.cell / 2, y: this.oy + r * this.cell + this.cell / 2 }
  }

  // 生成一个特效，target 为 {r,c} 或单位对象（含 r/c 字段即可）
  _spawnEffect(type, target, color) {
    const { x, y } = this._cellCenter(target.r, target.c)
    const durs = { impact: 0.35, area: 0.5, heal: 0.5, buff: 0.6, dash: 0.25 }
    const dur = durs[type] || 0.4
    const eff = { type, x, y, color, t: 0, dur, extra: {} }
    if (type === 'impact') {
      // 迸溅火花：预生成随机方向/距离，绘制时按存活进度向外扩散
      eff.extra.sparks = Array.from({ length: 7 }, () => ({ angle: Math.random() * Math.PI * 2, dist: 0.15 + Math.random() * 0.25 }))
    } else if (type === 'heal') {
      // 上升光粒：预生成随机水平偏移与起始延迟
      eff.extra.particles = Array.from({ length: 6 }, () => ({ dx: (Math.random() - 0.5) * 0.6, delay: Math.random() * 0.3 }))
    }
    this.effects.push(eff)
    return eff
  }

  // 突进特效：施法者原始格 → 目标格 的动感拖尾线 + 落点命中特效
  _spawnDashEffect(fromCell, toUnit, color) {
    const from = this._cellCenter(fromCell.r, fromCell.c)
    const to = this._cellCenter(toUnit.r, toUnit.c)
    this.effects.push({
      type: 'dash', x: to.x, y: to.y, color, t: 0, dur: 0.25,
      extra: { x1: from.x, y1: from.y, x2: to.x, y2: to.y }
    })
    this._spawnEffect('impact', toUnit, color)
  }

  _drawEffects(ctx) {
    if (!this.effects.length) return
    this.effects.forEach(e => {
      const p = Math.min(1, e.t / e.dur) // 存活进度 0~1
      ctx.save()
      if (e.type === 'impact') this._drawImpactEffect(ctx, e, p)
      else if (e.type === 'area') this._drawAreaEffect(ctx, e, p)
      else if (e.type === 'heal') this._drawHealEffect(ctx, e, p)
      else if (e.type === 'buff') this._drawBuffEffect(ctx, e, p)
      else if (e.type === 'dash') this._drawDashEffect(ctx, e, p)
      ctx.restore()
    })
  }

  // a. 单体命中：扩散光环 + 白色闪光 + 迸溅火花
  _drawImpactEffect(ctx, e, p) {
    const cell = this.cell
    // 白色闪光：命中瞬间快速衰减
    const flashA = Math.max(0, 1 - p * 3)
    if (flashA > 0) {
      ctx.globalAlpha = flashA * 0.6
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(e.x, e.y, cell * 0.28, 0, Math.PI * 2)
      ctx.fill()
    }
    // 扩散光环
    ctx.globalAlpha = 1 - p
    ctx.strokeStyle = e.color
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(e.x, e.y, cell * (0.15 + p * 0.55), 0, Math.PI * 2)
    ctx.stroke()
    // 迸溅火花
    ctx.globalAlpha = (1 - p) * 0.9
    ctx.fillStyle = e.color
    ;(e.extra.sparks || []).forEach(s => {
      const d = cell * s.dist * (0.3 + p * 1.2)
      const sx = e.x + Math.cos(s.angle) * d
      const sy = e.y + Math.sin(s.angle) * d
      ctx.beginPath()
      ctx.arc(sx, sy, Math.max(1, cell * 0.035), 0, Math.PI * 2)
      ctx.fill()
    })
  }

  // b. 范围技能：扩散光环 + 放射尖刺 + 地面染色闪光
  _drawAreaEffect(ctx, e, p) {
    const cell = this.cell
    // 地面染色闪光
    ctx.globalAlpha = (1 - p) * 0.35
    ctx.fillStyle = e.color
    ctx.beginPath()
    ctx.arc(e.x, e.y, cell * (0.5 + p * 0.6), 0, Math.PI * 2)
    ctx.fill()
    // 扩散光环
    ctx.globalAlpha = 1 - p
    ctx.strokeStyle = e.color
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(e.x, e.y, cell * (0.3 + p * 1.1), 0, Math.PI * 2)
    ctx.stroke()
    // 放射尖刺
    ctx.globalAlpha = (1 - p) * 0.8
    ctx.strokeStyle = e.color
    ctx.lineWidth = 2
    const spikes = 8
    for (let i = 0; i < spikes; i++) {
      const ang = (Math.PI * 2 / spikes) * i
      const rIn = cell * 0.25
      const rOut = cell * (0.4 + p * 1.0)
      ctx.beginPath()
      ctx.moveTo(e.x + Math.cos(ang) * rIn, e.y + Math.sin(ang) * rIn)
      ctx.lineTo(e.x + Math.cos(ang) * rOut, e.y + Math.sin(ang) * rOut)
      ctx.stroke()
    }
  }

  // c. 治疗：绿金上升光粒 + 柔和光环
  _drawHealEffect(ctx, e, p) {
    const cell = this.cell
    const tones = ['#8fe6a0', '#e8c96a'] // 绿/金交替
    // 柔和光环
    ctx.globalAlpha = (1 - p) * 0.5
    ctx.strokeStyle = BattleScene.HEAL_COLOR
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(e.x, e.y - cell * 0.2, cell * 0.4, 0, Math.PI * 2)
    ctx.stroke()
    // 上升光粒
    ;(e.extra.particles || []).forEach((pt, i) => {
      const lp = Math.max(0, Math.min(1, (p - pt.delay) / (1 - pt.delay)))
      if (lp <= 0) return
      const px = e.x + pt.dx * cell
      const py = e.y + cell * 0.3 - lp * cell * 1.0
      ctx.globalAlpha = (1 - lp) * 0.9
      ctx.fillStyle = tones[i % tones.length]
      ctx.beginPath()
      ctx.arc(px, py, cell * 0.045, 0, Math.PI * 2)
      ctx.fill()
    })
  }

  // d. 增益/减益：目标周围光环渐隐
  _drawBuffEffect(ctx, e, p) {
    const cell = this.cell
    ctx.globalAlpha = (1 - p) * 0.7
    ctx.strokeStyle = e.color
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(e.x, e.y, cell * 0.5, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = (1 - p) * 0.22
    ctx.fillStyle = e.color
    ctx.beginPath()
    ctx.arc(e.x, e.y, cell * 0.5, 0, Math.PI * 2)
    ctx.fill()
  }

  // e. 突进：施法者→目标的动感拖尾线（落点命中特效由 impact 单独负责）
  _drawDashEffect(ctx, e, p) {
    ctx.globalAlpha = (1 - p) * 0.85
    ctx.strokeStyle = e.color
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(e.extra.x1, e.extra.y1)
    ctx.lineTo(e.extra.x2, e.extra.y2)
    ctx.stroke()
  }

  // 顶部信息栏（两行布局，避免各元素互相遮挡）：
  // 第一行：退出战斗按钮（左）+ 关卡名（整栏水平居中）
  // 第二行：行动单位/回合数/属性（左，紧跟退出按钮下方起）+ 操作提示（居中偏右，避开右侧安全边距）
  _drawTopBar(ctx) {
    const bx = this.safeL
    const by = this.safeT
    const bw = this.safeR - this.safeL
    const bh = this.topBarH
    ctx.fillStyle = 'rgba(15,22,34,0.9)'
    ctx.fillRect(bx, by, bw, bh)
    ctx.strokeStyle = 'rgba(232,201,106,0.4)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(bx, by + bh)
    ctx.lineTo(bx + bw, by + bh)
    ctx.stroke()

    // 右侧安全边距：避开抖音小游戏横屏右上角胶囊/分享按钮，此区域内不绘制任何文字
    const rightEdge = bx + bw - this.topBarRightPad

    // 左：退出战斗按钮（纵向居中于整个信息栏）
    const exitBtnW = 72
    const exitBtnH = bh - 16
    const exitBtnX = bx + 10
    const exitBtnY = by + (bh - exitBtnH) / 2
    ctx.fillStyle = '#5a2a2a'
    this._roundRect(ctx, exitBtnX, exitBtnY, exitBtnW, exitBtnH, 6)
    ctx.fill()
    ctx.strokeStyle = '#e8735f'
    ctx.lineWidth = 1.5
    this._roundRect(ctx, exitBtnX + 0.5, exitBtnY + 0.5, exitBtnW - 1, exitBtnH - 1, 6)
    ctx.stroke()
    ctx.fillStyle = '#ffcfc7'
    ctx.font = 'bold 13px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('退出战斗', exitBtnX + exitBtnW / 2, exitBtnY + exitBtnH / 2)
    this._exitBtn = { x: exitBtnX, y: exitBtnY, w: exitBtnW, h: exitBtnH }

    // 第一行：关卡名，整栏水平居中（不随退出按钮偏移，避免与右侧信息冲突）
    const row1Y = by + bh * 0.32
    ctx.fillStyle = '#e8c96a'
    ctx.font = 'bold 17px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(this.levelName, bx + bw / 2, row1Y)

    // 第二行：左侧——行动单位 + 回合数 + 属性（同一行内以分隔符相连，避免与提示语重叠）
    const row2Y = by + bh * 0.72
    const cur = (this.current && !this.current.dead) ? this.current : null
    const infoX = exitBtnX + exitBtnW + 12
    ctx.textAlign = 'left'
    ctx.fillStyle = '#c9d4e3'
    ctx.font = 'bold 13px sans-serif'
    let info = cur ? ('行动：' + cur.name + '  ·  第 ' + this.round + ' 回合') : ('第 ' + this.round + ' 回合')
    if (cur) {
      const wt = this._weaponMeta(cur)
      info += '  ·  ' + wt.name + '(射程' + (wt.minRange || 1) + '~' + wt.range + ')' +
        '  ·  攻' + this._effAtk(cur) + ' 防' + this._effDef(cur) + ' 速' + cur.spd + ' 血' + cur.hp + '/' + cur.maxHp + ' 怒' + (cur.rage || 0) + '/' + MAX_RAGE
    }
    ctx.fillText(info, infoX, row2Y)

    // 静态提示：回合数上限（不随行动变化，仅在无当前行动单位提示遮挡时另起一行不便，故附加到关卡名下方留白处）
    ctx.fillStyle = '#8a94a8'
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('100回合未获胜即失败', bx + bw / 2, row1Y + (row2Y - row1Y) * 0.55)

    // 第二行：右侧——操作提示，右对齐于安全边距处，与左侧信息之间留白，避免重叠
    if (this.hint) {
      ctx.fillStyle = '#ffffff'
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(this.hint, rightEdge, row2Y)
    }
  }

  // 底部操作栏：普通攻击 + 当前英雄 3 技能 + 使用道具 + 结束行动（横排按钮）
  _drawBottomBar(ctx) {
    const bw = (this.safeR - this.safeL) - this.rightBarW
    const bx = this.safeL
    const bh = this.bottomBarH
    const by = this.safeB - bh
    // 背景
    ctx.fillStyle = 'rgba(15,22,34,0.9)'
    ctx.fillRect(bx, by, bw, bh)
    ctx.strokeStyle = 'rgba(232,201,106,0.4)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(bx, by)
    ctx.lineTo(bx + bw, by)
    ctx.stroke()

    // 当前是否为我方英雄行动（按钮可用前提；移动动画/自动战斗中禁止手动发起新行动）
    const cur = (!this.over && this.current && this.current.side === 'hero' && !this._skipPending && !this.current.moving && !this.autoBattle) ? this.current : null

    // 按钮几何：按钮数量较多，分两行排布，避免单行拥挤导致文字溢出按钮框
    // 第1行：普通攻击 + 3 个技能（4 个按钮）；第2行：使用道具 + 自动 + 结束行动（3 个按钮）
    const pad = 8
    const innerW = bw - pad * 2
    const gap = 6
    const rowGap = 4
    const rowH = Math.floor((bh - pad * 2 - rowGap) / 2)
    const row1Y = by + pad
    const row2Y = row1Y + rowH + rowGap

    // 第1行：普通攻击 + 3 技能，均分宽度
    const row1Count = 4
    const row1BtnW = Math.floor((innerW - (row1Count - 1) * gap) / row1Count)
    let btnX = bx + pad

    // 普通攻击按钮（代码绘制：剑图标 + 文字）
    const atkEnabled = !!(cur && !cur.attacked)
    this._attackBtn = this._drawActionBtn(ctx, btnX, row1Y, row1BtnW, rowH, {
      label: '普通攻击', iconType: 'sword',
      enabled: atkEnabled, selected: !!this.attackSelecting
    })
    btnX += row1BtnW + gap

    // 技能按钮（图标 assets/skills/ + 技能名小字 + 怒气消耗；怒气不足时置灰不可用）
    this._skillBtns = []
    if (cur && cur.skills && cur.skills.length) {
      cur.skills.forEach(sk => {
        const used = cur.skillUsed
        const enabled = !used && (cur.rage || 0) >= sk.cost
        const isSel = this.skillSelecting && this.skillSelecting.skill === sk
        this._drawSkillBtn(ctx, btnX, row1Y, row1BtnW, rowH, sk, enabled, isSel)
        this._skillBtns.push({ x: btnX, y: row1Y, w: row1BtnW, h: rowH, skill: sk, enabled })
        btnX += row1BtnW + gap
      })
    } else {
      // 敌方回合/眩晕：占位灰按钮
      for (let i = 0; i < 3; i++) {
        this._drawDisabledBtn(ctx, btnX, row1Y, row1BtnW, rowH, '技能')
        btnX += row1BtnW + gap
      }
    }

    // 第2行：使用道具 + 回退 + 自动 + 结束行动，均分宽度
    const row2Count = 4
    const row2BtnW = Math.floor((innerW - (row2Count - 1) * gap) / row2Count)
    btnX = bx + pad

    // 使用道具按钮
    const itemEnabled = !!cur
    this._itemBtn = this._drawActionBtn(ctx, btnX, row2Y, row2BtnW, rowH, {
      label: '使用道具', iconType: 'bag',
      enabled: itemEnabled, selected: this.itemDialog || !!this.itemSelecting, color: '#5a4a2a'
    })
    btnX += row2BtnW + gap

    // 回退按钮：移动后、提交攻击/技能前可撤回移动，回到起始格重新选择落点（见 _canUndoMove/_undoMove）
    const undoEnabled = this._canUndoMove()
    this._undoBtn = this._drawActionBtn(ctx, btnX, row2Y, row2BtnW, rowH, {
      label: '回退', iconType: 'undo',
      enabled: undoEnabled, selected: false, color: '#5a4520'
    })
    btnX += row2BtnW + gap

    // 自动战斗开关：开启后我方英雄回合由 AI 接管（移动+攻击+怒气技能），任意时刻可切换，仅本场战斗内有效
    this._autoBtn = this._drawActionBtn(ctx, btnX, row2Y, row2BtnW, rowH, {
      label: this.autoBattle ? '自动:开' : '自动:关', iconType: 'auto',
      enabled: true, selected: this.autoBattle, color: this.autoBattle ? '#2e6b8b' : '#3a4a66'
    })
    btnX += row2BtnW + gap

    // 结束行动按钮
    const canEnd = !!cur
    this._endBtn = this._drawActionBtn(ctx, btnX, row2Y, row2BtnW, rowH, {
      label: '结束行动', iconType: 'end',
      enabled: canEnd, selected: false, color: '#2e8b57'
    })
  }

  // 通用动作按钮：圆角矩形 + 代码绘制图标 + 文字，返回热区
  _drawActionBtn(ctx, x, y, w, h, opts) {
    const enabled = opts.enabled
    ctx.fillStyle = enabled ? (opts.color || '#3a4a66') : '#262c38'
    this._roundRect(ctx, x, y, w, h, 6)
    ctx.fill()
    ctx.strokeStyle = opts.selected ? '#ffffff' : (enabled ? '#e8c96a' : '#555f70')
    ctx.lineWidth = opts.selected ? 3 : 1.5
    this._roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 6)
    ctx.stroke()
    // 图标 + 文字作为一个整体在按钮框内水平垂直居中；文字过长时自动缩小字号，确保不超出按钮边框
    const iconSize = Math.min(h - 8, 22)
    const gap = 6
    const maxTextW = w - iconSize - gap - 6
    let fontSize = 13
    ctx.font = 'bold ' + fontSize + 'px sans-serif'
    let textW = ctx.measureText(opts.label).width
    while (textW > maxTextW && fontSize > 9) {
      fontSize -= 1
      ctx.font = 'bold ' + fontSize + 'px sans-serif'
      textW = ctx.measureText(opts.label).width
    }
    const groupW = iconSize + gap + textW
    const ix = x + (w - groupW) / 2
    const iy = y + (h - iconSize) / 2
    if (opts.iconType === 'sword') this._drawSwordIcon(ctx, ix, iy, iconSize, enabled)
    else if (opts.iconType === 'end') this._drawEndIcon(ctx, ix, iy, iconSize, enabled)
    else if (opts.iconType === 'bag') this._drawBagIcon(ctx, ix, iy, iconSize, enabled)
    else if (opts.iconType === 'auto') this._drawAutoIcon(ctx, ix, iy, iconSize, enabled)
    else if (opts.iconType === 'undo') this._drawUndoIcon(ctx, ix, iy, iconSize, enabled)
    ctx.fillStyle = enabled ? '#fff' : '#8a9bb5'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(opts.label, ix + iconSize + gap, y + h / 2)
    return { x, y, w, h, enabled }
  }

  // 代码绘制：剑图标（刀身 + 护手 + 柄）
  _drawSwordIcon(ctx, x, y, s, enabled) {
    const cx = x + s / 2
    ctx.save()
    ctx.globalAlpha = enabled ? 1 : 0.5
    // 刀身（竖向三角）
    ctx.fillStyle = '#d8dde6'
    ctx.beginPath()
    ctx.moveTo(cx, y + 2)
    ctx.lineTo(cx - s * 0.13, y + s * 0.56)
    ctx.lineTo(cx + s * 0.13, y + s * 0.56)
    ctx.closePath()
    ctx.fill()
    // 护手
    ctx.fillStyle = '#e8c96a'
    ctx.fillRect(cx - s * 0.32, y + s * 0.56, s * 0.64, s * 0.1)
    // 柄
    ctx.fillStyle = '#8a5a2a'
    ctx.fillRect(cx - s * 0.06, y + s * 0.66, s * 0.12, s * 0.28)
    ctx.restore()
  }

  // 代码绘制：布袋图标（袋身梯形 + 顶部系带）
  _drawBagIcon(ctx, x, y, s, enabled) {
    const cx = x + s / 2
    ctx.save()
    ctx.globalAlpha = enabled ? 1 : 0.5
    // 袋身（梯形）
    ctx.fillStyle = '#c98a3e'
    ctx.beginPath()
    ctx.moveTo(cx - s * 0.16, y + s * 0.32)
    ctx.lineTo(cx + s * 0.16, y + s * 0.32)
    ctx.lineTo(cx + s * 0.34, y + s * 0.94)
    ctx.lineTo(cx - s * 0.34, y + s * 0.94)
    ctx.closePath()
    ctx.fill()
    // 系带
    ctx.strokeStyle = '#e8c96a'
    ctx.lineWidth = Math.max(1.5, s * 0.08)
    ctx.beginPath()
    ctx.moveTo(cx - s * 0.16, y + s * 0.32)
    ctx.quadraticCurveTo(cx, y, cx + s * 0.16, y + s * 0.32)
    ctx.stroke()
    ctx.restore()
  }

  // 代码绘制：结束图标（向右三角箭头）
  _drawEndIcon(ctx, x, y, s, enabled) {
    ctx.save()
    ctx.globalAlpha = enabled ? 1 : 0.5
    ctx.fillStyle = '#e8c96a'
    ctx.beginPath()
    ctx.moveTo(x + s * 0.25, y + s * 0.2)
    ctx.lineTo(x + s * 0.78, y + s * 0.5)
    ctx.lineTo(x + s * 0.25, y + s * 0.8)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  // 代码绘制：自动图标（循环箭头，象征 AI 自动接管）
  _drawAutoIcon(ctx, x, y, s, enabled) {
    const cx = x + s / 2
    const cy = y + s / 2
    const r = s * 0.34
    ctx.save()
    ctx.globalAlpha = enabled ? 1 : 0.5
    ctx.strokeStyle = '#e8c96a'
    ctx.lineWidth = Math.max(1.5, s * 0.12)
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0.35, Math.PI * 1.7)
    ctx.stroke()
    const ang = Math.PI * 1.7
    const ax = cx + Math.cos(ang) * r
    const ay = cy + Math.sin(ang) * r
    ctx.fillStyle = '#e8c96a'
    ctx.beginPath()
    ctx.moveTo(ax, ay)
    ctx.lineTo(ax - s * 0.2, ay - s * 0.04)
    ctx.lineTo(ax - s * 0.03, ay + s * 0.2)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  // 代码绘制：回退图标（逆时针箭头，象征撤回移动）
  _drawUndoIcon(ctx, x, y, s, enabled) {
    const cx = x + s / 2
    const cy = y + s / 2
    const r = s * 0.34
    ctx.save()
    ctx.globalAlpha = enabled ? 1 : 0.5
    ctx.strokeStyle = '#ffcf7a'
    ctx.lineWidth = Math.max(1.5, s * 0.12)
    ctx.beginPath()
    ctx.arc(cx, cy, r, Math.PI * 1.15, Math.PI * 2.5)
    ctx.stroke()
    const ang = Math.PI * 1.15
    const ax = cx + Math.cos(ang) * r
    const ay = cy + Math.sin(ang) * r
    ctx.fillStyle = '#ffcf7a'
    ctx.beginPath()
    ctx.moveTo(ax, ay)
    ctx.lineTo(ax + s * 0.2, ay - s * 0.06)
    ctx.lineTo(ax + s * 0.04, ay + s * 0.2)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  // 技能按钮：技能图标 + 技能名小字 + 怒气消耗小字
  _drawSkillBtn(ctx, x, y, w, h, sk, enabled, selected) {
    ctx.fillStyle = enabled ? '#3a4a66' : '#262c38'
    this._roundRect(ctx, x, y, w, h, 6)
    ctx.fill()
    ctx.strokeStyle = selected ? '#fff' : (enabled ? '#e8c96a' : '#555f70')
    ctx.lineWidth = selected ? 3 : 1.5
    this._roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 6)
    ctx.stroke()
    // 图标+技能名放在按钮上半部分，怒气消耗小字放在下半部分，上下分区避免重叠出框
    const iconSize = Math.min(h * 0.42, 20)
    const gap = 5
    const maxTextW = w - iconSize - gap - 6
    let fontSize = 13
    ctx.font = 'bold ' + fontSize + 'px sans-serif'
    let textW = ctx.measureText(sk.name).width
    while (textW > maxTextW && fontSize > 9) {
      fontSize -= 1
      ctx.font = 'bold ' + fontSize + 'px sans-serif'
      textW = ctx.measureText(sk.name).width
    }
    const groupW = iconSize + gap + textW
    const ix = x + (w - groupW) / 2
    const nameY = y + h * 0.34
    const iy = nameY - iconSize / 2
    const img = this.imgs[sk.icon]
    if (img) {
      ctx.globalAlpha = enabled ? 1 : 0.4
      this._drawCover(ctx, img, ix, iy, iconSize, iconSize)
      ctx.globalAlpha = 1
    } else {
      ctx.fillStyle = enabled ? '#3a4258' : '#2a2f3a'
      ctx.fillRect(ix, iy, iconSize, iconSize)
    }
    ctx.fillStyle = enabled ? '#fff' : '#8a9bb5'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(sk.name, ix + iconSize + gap, nameY)
    // 怒气消耗小字：按钮下半部分居中显示，与技能名分行，避免与图标/文字重叠
    ctx.font = '9px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillStyle = enabled ? '#ffcf6a' : '#6a7488'
    ctx.fillText(sk.cost + '怒气', x + w / 2, y + h - 3)
  }

  // 占位禁用按钮
  _drawDisabledBtn(ctx, x, y, w, h, label) {
    ctx.fillStyle = '#222a36'
    this._roundRect(ctx, x, y, w, h, 6)
    ctx.fill()
    ctx.strokeStyle = '#3a4258'
    ctx.lineWidth = 1
    this._roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 6)
    ctx.stroke()
    ctx.fillStyle = '#5a6478'
    ctx.font = '13px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('— ' + label + ' —', x + w / 2, y + h / 2)
  }

  // 右侧战斗日志栏：标题 + 滚动列表（新日志在底部，超出滚动）
  _drawRightBar(ctx) {
    const h = this.game.height
    const bx = this.rightBarX
    const by = this.topBarH
    const bw = this.rightBarW
    const bh = h - this.topBarH
    ctx.fillStyle = 'rgba(15,22,34,0.9)'
    ctx.fillRect(bx, by, bw, bh)
    ctx.strokeStyle = 'rgba(232,201,106,0.4)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(bx, by)
    ctx.lineTo(bx, by + bh)
    ctx.stroke()
    // 标题
    ctx.fillStyle = '#e8c96a'
    ctx.font = 'bold 15px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText('战斗日志', bx + 10, by + this.logHeaderH / 2)
    // 分隔线
    ctx.strokeStyle = 'rgba(232,201,106,0.25)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(bx + 6, by + this.logHeaderH)
    ctx.lineTo(bx + bw - 6, by + this.logHeaderH)
    ctx.stroke()

    // 日志列表（裁剪区内绘制）
    const lineH = this.lineH
    const areaY = by + this.logHeaderH
    const areaH = bh - this.logHeaderH
    const contentH = this.log.length * lineH
    const maxScroll = Math.max(0, contentH - areaH)
    if (this.logScrollTop > maxScroll) this.logScrollTop = maxScroll
    if (this.logScrollTop < 0) this.logScrollTop = 0

    ctx.save()
    ctx.beginPath()
    ctx.rect(bx + 4, areaY, bw - 8, areaH)
    ctx.clip()
    const startIdx = Math.floor(this.logScrollTop / lineH)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.font = '12px sans-serif'
    for (let i = startIdx; i < this.log.length; i++) {
      const yy = areaY + (i * lineH - this.logScrollTop)
      if (yy + lineH < areaY) continue
      if (yy > areaY + areaH) break
      const e = this.log[i]
      ctx.fillStyle = e.color || '#c9d4e3'
      ctx.fillText(e.text, bx + 10, yy + 3)
    }
    ctx.restore()

    // 滚动条提示
    if (maxScroll > 0) {
      const thumbH = Math.max(20, areaH * (areaH / contentH))
      const thumbY = areaY + (this.logScrollTop / maxScroll) * (areaH - thumbH)
      ctx.fillStyle = 'rgba(232,201,106,0.3)'
      ctx.fillRect(bx + bw - 6, thumbY, 3, thumbH)
    }
  }

  // 添加战斗日志：新条目入底；若原在底部则跟随到底，否则保持位置
  _addLog(text, color) {
    const contentH = this.log.length * this.lineH
    const maxScroll = Math.max(0, contentH - this.logViewH)
    const atBottom = (contentH <= this.logViewH) || (this.logScrollTop >= maxScroll - 1)
    this.log.push({ text, color: color || '#c9d4e3' })
    if (this.log.length > LOG_MAX) this.log.shift()
    const contentH2 = this.log.length * this.lineH
    const maxScroll2 = Math.max(0, contentH2 - this.logViewH)
    if (atBottom || contentH2 <= this.logViewH) this.logScrollTop = maxScroll2
  }

  // 胜负结算弹窗
  _drawSettle(ctx) {
    const w = this.game.width
    const h = this.game.height
    // 遮罩
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, 0, w, h)
    // 面板：胜利且有称号/装备掉落文案时增高，每条掉落文案各占一行
    const dw = Math.min(360, w - 48)
    const hasTitleDropLine = this.result === 'win' && this.titleDrop
    const hasEquipDropLine = this.result === 'win' && this.equipDrop
    const dropLineCount = (hasTitleDropLine ? 1 : 0) + (hasEquipDropLine ? 1 : 0)
    const dh = 220 + dropLineCount * 30
    const px = (w - dw) / 2
    const py = (h - dh) / 2
    ctx.fillStyle = '#222d3f'
    this._roundRect(ctx, px, py, dw, dh, 12)
    ctx.fill()
    ctx.strokeStyle = '#e8c96a'
    ctx.lineWidth = 2
    this._roundRect(ctx, px, py, dw, dh, 12)
    ctx.stroke()
    // 标题
    ctx.fillStyle = this.result === 'win' ? '#e8c96a' : '#ff5b4d'
    ctx.font = 'bold 26px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(this.result === 'win' ? '胜利！' : '失败', px + dw / 2, py + 50)
    // 正文
    ctx.fillStyle = '#ffffff'
    ctx.font = '18px sans-serif'
    const loseText = this.loseReason === 'timeout' ? '回合数耗尽，挑战失败' : '我方全军覆没'
    ctx.fillText(this.result === 'win' ? ('获得金钱 +' + this.rewardGold) : loseText, px + dw / 2, py + 96)
    // 称号/装备掉落结果：依次显示在金钱奖励下方，各占一行
    let dropY = py + 128
    if (hasTitleDropLine) {
      const drop = this.titleDrop
      ctx.font = 'bold 16px sans-serif'
      if (drop.isNew) {
        ctx.fillStyle = QUALITY_META[drop.title.quality].color
        ctx.fillText(`获得称号：${drop.title.name}（${QUALITY_META[drop.title.quality].name}）`, px + dw / 2, dropY)
      } else {
        ctx.fillStyle = '#e8c96a'
        ctx.fillText(`重复称号，转化为金币 +${drop.goldGained}`, px + dw / 2, dropY)
      }
      dropY += 30
    }
    if (hasEquipDropLine) {
      const drop = this.equipDrop
      ctx.font = 'bold 16px sans-serif'
      if (drop.isNew) {
        ctx.fillStyle = QUALITY_META[drop.equip.quality].color
        ctx.fillText(`获得装备：${drop.equip.name}（${QUALITY_META[drop.equip.quality].name}）`, px + dw / 2, dropY)
      } else {
        ctx.fillStyle = '#e8c96a'
        ctx.fillText(`重复装备，转化为金币 +${drop.goldGained}`, px + dw / 2, dropY)
      }
      dropY += 30
    }
    // 按钮
    const bh = 42
    const gap = 16
    this._dialogBtns = []
    if (this.result === 'win') {
      const bw = (dw - 48 - gap) / 2
      const b1 = { x: px + 24, y: py + dh - 64, w: bw, h: bh, action: 'restart' }
      const b2 = { x: b1.x + bw + gap, y: b1.y, w: bw, h: bh, action: 'maincity' }
      this._drawSettleBtn(ctx, b1, '#2e8b57', '再战')
      this._drawSettleBtn(ctx, b2, '#3a4a66', '返回主城')
      this._dialogBtns = [b1, b2]
    } else {
      const bw = dw - 48
      const b1 = { x: px + 24, y: py + dh - 64, w: bw, h: bh, action: 'maincity' }
      this._drawSettleBtn(ctx, b1, '#3a4a66', '返回主城')
      this._dialogBtns = [b1]
    }
  }

  _drawSettleBtn(ctx, b, color, label) {
    ctx.fillStyle = color
    this._roundRect(ctx, b.x, b.y, b.w, b.h, 8)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 18px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, b.x + b.w / 2, b.y + b.h / 2)
  }

  // 退出确认弹窗："退出本次战斗？" + 确定/取消
  _drawExitConfirm(ctx) {
    const w = this.game.width
    const h = this.game.height
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, 0, w, h)
    const dw = Math.min(320, w - 48)
    const dh = 160
    const px = (w - dw) / 2
    const py = (h - dh) / 2
    ctx.fillStyle = '#222d3f'
    this._roundRect(ctx, px, py, dw, dh, 12)
    ctx.fill()
    ctx.strokeStyle = '#e8c96a'
    ctx.lineWidth = 2
    this._roundRect(ctx, px, py, dw, dh, 12)
    ctx.stroke()
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 18px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('退出本次战斗？', px + dw / 2, py + 54)
    const bh = 42
    const gap = 16
    const bw = (dw - 48 - gap) / 2
    const b1 = { x: px + 24, y: py + dh - 62, w: bw, h: bh, action: 'cancel' }
    const b2 = { x: b1.x + bw + gap, y: b1.y, w: bw, h: bh, action: 'confirm' }
    this._drawSettleBtn(ctx, b1, '#3a4a66', '取消')
    this._drawSettleBtn(ctx, b2, '#8a3a3a', '确定')
    this._exitDialogBtns = [b1, b2]
    this._exitDialogPanel = { x: px, y: py, w: dw, h: dh }
  }

  // 道具弹窗：列出 mock 道具（名称/效果/数量 + 使用按钮）
  _drawItemDialog(ctx) {
    const w = this.game.width
    const h = this.game.height
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, 0, w, h)
    const dw = Math.min(380, w - 48)
    const rowH = 64
    const dh = Math.min(56 + ITEM_DEFS.length * rowH + 16, h - 80)
    const px = (w - dw) / 2
    const py = (h - dh) / 2
    ctx.fillStyle = '#222d3f'
    this._roundRect(ctx, px, py, dw, dh, 12)
    ctx.fill()
    ctx.strokeStyle = '#e8c96a'
    ctx.lineWidth = 2
    this._roundRect(ctx, px, py, dw, dh, 12)
    ctx.stroke()
    // 标题
    ctx.fillStyle = '#e8c96a'
    ctx.font = 'bold 18px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText('使用道具', px + 20, py + 28)
    // 关闭按钮（叉号）
    const closeS = 26
    const closeBtn = { x: px + dw - closeS - 12, y: py + 15, w: closeS, h: closeS }
    ctx.strokeStyle = '#8a9bb5'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(closeBtn.x + 6, closeBtn.y + 6)
    ctx.lineTo(closeBtn.x + closeS - 6, closeBtn.y + closeS - 6)
    ctx.moveTo(closeBtn.x + closeS - 6, closeBtn.y + 6)
    ctx.lineTo(closeBtn.x + 6, closeBtn.y + closeS - 6)
    ctx.stroke()
    this._itemDialogClose = closeBtn
    this._itemDialogPanel = { x: px, y: py, w: dw, h: dh }

    // 道具列表：名称+数量 / 效果描述 / 使用按钮（数量为0则置灰）
    this._itemDialogBtns = []
    const canUse = !!this.current && this.current.side === 'hero' && !this.over && !this._skipPending
    let ry = py + 48
    ITEM_DEFS.forEach(def => {
      const rowY = ry
      ctx.strokeStyle = 'rgba(232,201,106,0.2)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(px + 16, rowY)
      ctx.lineTo(px + dw - 16, rowY)
      ctx.stroke()

      const count = (gameData.player.items && gameData.player.items[def.id]) || 0
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 15px sans-serif'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(def.name + '  ×' + count, px + 20, rowY + 10)
      ctx.fillStyle = '#8a9bb5'
      ctx.font = '12px sans-serif'
      ctx.fillText(def.desc, px + 20, rowY + 32)

      const enabled = count > 0 && canUse
      const bw = 64
      const bh2 = 32
      const bx2 = px + dw - bw - 16
      const by2 = rowY + (rowH - bh2) / 2
      ctx.fillStyle = enabled ? '#3a6a4a' : '#2a2f3a'
      this._roundRect(ctx, bx2, by2, bw, bh2, 6)
      ctx.fill()
      ctx.strokeStyle = enabled ? '#7fffaa' : '#555f70'
      ctx.lineWidth = 1.5
      this._roundRect(ctx, bx2 + 0.5, by2 + 0.5, bw - 1, bh2 - 1, 6)
      ctx.stroke()
      ctx.fillStyle = enabled ? '#fff' : '#8a9bb5'
      ctx.font = 'bold 13px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('使用', bx2 + bw / 2, by2 + bh2 / 2)
      this._itemDialogBtns.push({ x: bx2, y: by2, w: bw, h: bh2, id: def.id, enabled })
      ry += rowH
    })
  }

  // 圆角矩形路径（兼容老 canvas）
  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  }

  // ---- 网格 / 单位辅助 ----
  _cellAt(x, y) {
    const c = Math.floor((x - this.ox) / this.cell)
    const r = Math.floor((y - this.oy) / this.cell)
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return null
    return { r, c }
  }

  _unitAt(r, c) {
    return this.units.find(u => !u.dead && u.r === r && u.c === c) || null
  }

  _inBounds(r, c) {
    return r >= 0 && r < this.rows && c >= 0 && c < this.cols
  }

  _isMountain(r, c) {
    return this.map[r][c] === TERRAIN.MOUNTAIN
  }

  _occupied(r, c, except) {
    return this.units.some(u => !u.dead && u !== except && u.r === r && u.c === c)
  }

  _passable(r, c, except) {
    return this._inBounds(r, c) && !this._isMountain(r, c) && !this._occupied(r, c, except)
  }

  _dist(a, b) {
    return Math.max(Math.abs(a.r - b.r), Math.abs(a.c - b.c))
  }

  // 曼哈顿距离：单体技能/道具的施法距离判定（横+竖，不含斜向捷径）
  _manhattan(a, b) {
    return Math.abs(a.r - b.r) + Math.abs(a.c - b.c)
  }

  // 有效攻击力（含增益）
  _effAtk(u) {
    return Math.round(u.atk * Math.max(0, 1 + (u.atkBuff || 0) - (u.atkDebuff || 0)))
  }

  // 统一伤害公式（普攻与技能共用同一套结算，梦幻西游经典公式）：
  // baseDamage = max(1, 攻击者有效攻击力 − 目标有效防御)（atkBuff/atkDebuff/defDebuff/defBuffFlat 已含于 _effAtk/_effDef）
  // finalDamage = round(baseDamage × skillMultiplier × damageBonus × random(0.9, 1.1))
  // - skillMultiplier：普攻 = 1，技能 = skill.value（倍率，非百分比加成）
  // - damageBonus = 1 + (称号「技能威力」% + 装备绑定英雄技能伤害%) / 100，仅对我方英雄生效，普攻与技能均适用
  _calcDamage(attacker, target, skill) {
    const baseDamage = Math.max(1, this._effAtk(attacker) - this._effDef(target))
    const skillMultiplier = skill && skill.value != null ? skill.value : 1
    const damageBonus = attacker.side === 'hero' ? 1 + (currentTitleEffects().skillDmg + (attacker.skillDmgPct || 0)) / 100 : 1
    const fluctuation = 0.9 + Math.random() * 0.2
    const finalDamage = baseDamage * skillMultiplier * damageBonus * fluctuation
    return Math.max(1, Math.round(finalDamage))
  }

  // 有效防御（含减益 + 护甲符固定加成）
  _effDef(u) {
    return Math.round(u.def * (1 - (u.defDebuff || 0)) + (u.defBuffFlat || 0))
  }

  // 我方英雄治疗技能公式（与 _calcDamage 同一套结算路径，仅去掉"减去目标防御"这一步，因为治疗没有防御概念）：
  // heal = round(施法者有效攻击力 × 治疗倍率(skill.value) × damageBonus × random(0.9, 1.1))
  // 敌方（BOSS）自愈技能不走此公式，仍沿用原最大血量百分比结算（见 _resolveSkillEffect）
  _calcHeal(caster, skill) {
    const baseHeal = this._effAtk(caster)
    const skillMultiplier = skill && skill.value != null ? skill.value : 1
    const damageBonus = 1 + (currentTitleEffects().skillDmg + (caster.skillDmgPct || 0)) / 100
    const fluctuation = 0.9 + Math.random() * 0.2
    const finalHeal = baseHeal * skillMultiplier * damageBonus * fluctuation
    return Math.max(1, Math.round(finalHeal))
  }

  // BFS 可达范围（移动力步内、不进山、不进已占格），同时记录来源格用于路径回溯
  _bfsReachable(unit) {
    const seen = {}
    const came = {}
    seen[unit.r + ',' + unit.c] = 0
    const q = [{ r: unit.r, c: unit.c, s: 0 }]
    while (q.length) {
      const cur = q.shift()
      if (cur.s >= unit.move) continue
      for (const [dr, dc] of DIRS) {
        const nr = cur.r + dr
        const nc = cur.c + dc
        if (!this._passable(nr, nc, unit)) continue
        const key = nr + ',' + nc
        if (seen[key] !== undefined && seen[key] <= cur.s + 1) continue
        seen[key] = cur.s + 1
        came[key] = cur.r + ',' + cur.c
        q.push({ r: nr, c: nc, s: cur.s + 1 })
      }
    }
    return { seen, came }
  }

  // 可移动格列表
  _movableCells(unit) {
    const { seen } = this._bfsReachable(unit)
    const startKey = unit.r + ',' + unit.c
    const result = []
    for (const key in seen) {
      if (key === startKey) continue
      const [r, c] = key.split(',').map(Number)
      result.push({ r, c })
    }
    return result
  }

  // 回溯出从单位当前所在格到目标格的逐格路径（不含起点），用于移动动画；不可达返回 null
  _pathTo(unit, tr, tc) {
    const { seen, came } = this._bfsReachable(unit)
    const targetKey = tr + ',' + tc
    if (seen[targetKey] === undefined) return null
    const startKey = unit.r + ',' + unit.c
    const path = []
    let curKey = targetKey
    while (curKey !== startKey) {
      const [r, c] = curKey.split(',').map(Number)
      path.unshift({ r, c })
      curKey = came[curKey]
    }
    return path
  }

  // 单位武器系配置（射程/伤害倍率等），未知武器系兜底为剑
  _weaponMeta(unit) {
    return WEAPON_TYPE_META[unit.weaponType] || WEAPON_TYPE_META.jian
  }

  // 目标是否在攻击者武器系的攻击射程内（切比雪夫距离，与 _adjacent/_dist 同一距离度量）：
  // 弓 2~3 格（无法攻击相邻目标）、枪/戟 1~2 格、刀/剑 1 格（近战）
  _inAttackRange(attacker, target) {
    const wt = this._weaponMeta(attacker)
    const d = this._dist(attacker, target)
    return d >= (wt.minRange || 1) && d <= wt.range
  }

  // 当前单位武器系射程内的可攻击敌方
  _attackableEnemies(unit) {
    return this.units.filter(u => !u.dead && u.side !== unit.side && this._inAttackRange(unit, u))
  }

  // 背击判定：攻击者位于目标朝向反向的相邻格
  _isBackstab(attacker, target) {
    const fr = target.r - target.facing.dr
    const fc = target.c - target.facing.dc
    return attacker.r === fr && attacker.c === fc
  }

  // 移动单位并更新朝向
  _moveUnit(unit, r, c) {
    const dr = r - unit.r
    const dc = c - unit.c
    if (dr !== 0 || dc !== 0) unit.facing = { dr, dc }
    unit.r = r
    unit.c = c
  }

  // 普通攻击结算：按攻击者武器系应用伤害倍率（dmgMult），剑（迅捷）连续攻击两次，戟（横扫）额外命中
  // 目标周围1格内的其他敌方（半伤）；基础伤害仍走统一公式 _calcDamage（不含技能威力项），森林受伤-30%、背击+30%
  _attack(attacker, target) {
    const wt = this._weaponMeta(attacker)
    if (wt.doubleHit) {
      this._attackHit(attacker, target, wt.dmgMult * 0.75)
      if (!target.dead) this._attackHit(attacker, target, wt.dmgMult * 0.75)
    } else {
      this._attackHit(attacker, target, wt.dmgMult)
    }
    if (wt.sweep) {
      this.units.filter(u => !u.dead && u !== target && u.side !== attacker.side && this._dist(target, u) <= 1)
        .forEach(u => this._attackHit(attacker, u, wt.dmgMult * 0.5, true))
    }
  }

  // 单次打击结算（供普攻/剑连击/戟横扫复用）：sweep=true 时日志标注"横扫"
  _attackHit(attacker, target, dmgMult, sweep) {
    let dmg = Math.max(1, Math.round(this._calcDamage(attacker, target) * dmgMult))
    const terrain = this.map[target.r][target.c]
    if (terrain === TERRAIN.FOREST) dmg = Math.round(dmg * 0.7)
    const backstab = this._isBackstab(attacker, target)
    if (backstab) dmg = Math.round(dmg * 1.3)
    this._applyDamage(target, dmg)
    // 飘字
    this._spawnFloater(target, (backstab ? '背击 ' : '') + '-' + dmg, '#ff5b4d')
    // 战斗日志
    const tags = []
    if (backstab) tags.push('背击')
    if (terrain === TERRAIN.FOREST) tags.push('森林减伤')
    if (sweep) tags.push('横扫')
    this._addLog(attacker.name + ' 普攻 ' + target.name + '：' + dmg + ' 伤害' + (tags.length ? '（' + tags.join('，') + '）' : ''), '#ff9b8a')
    if (target.hp <= 0) {
      target.hp = 0
      target.dead = true
      this._addLog(target.name + ' 被击败', '#d75b5b')
    }
  }

  // ---- 技能系统 ----

  // 点击技能按钮：无需选目标的技能直接释放，其余进入选目标状态
  _startSkillSelect(skill) {
    const caster = this.current
    // 无需选目标：self / allAlly / allEnemy / rangeEnemies（威震以施法者自身为中心，即时释放）
    if (skill.target === 'self' || skill.target === 'allAlly' || skill.target === 'allEnemy' || skill.target === 'rangeEnemies') {
      this._useSkill(caster, skill, null)
      return
    }
    // 进入选目标状态：施法射程与该单位普攻射程同一来源（武器系射程，见 _inAttackRange），不再使用独立的固定距离
    this.skillSelecting = { skill, unit: caster }
    this.movableCells = []
    const wt = this._weaponMeta(caster)
    if (skill.target === 'oneAlly') {
      this.hint = '选择射程内（' + wt.name + (wt.minRange || 1) + '~' + wt.range + '格）我方单位释放「' + skill.name + '」'
    } else if (skill.target === 'oneEnemy') {
      this.hint = '选择射程内（' + wt.name + (wt.minRange || 1) + '~' + wt.range + '格）敌方单位释放「' + skill.name + '」'
    }
  }

  // 技能选目标状态：点击格子后判定目标是否合法（含施法距离，与武器射程一致）并释放；
  // 点击高亮的合法目标 → 释放技能；点击其它任何位置（超出射程/无单位/己方单位等）→ 取消本次技能选择
  _resolveSkillTarget(cell) {
    const { skill, unit: caster } = this.skillSelecting
    const t = this._unitAt(cell.r, cell.c)
    if (skill.target === 'oneAlly') {
      if (t && !t.dead && t.side === caster.side && this._inAttackRange(caster, t)) {
        this._useSkill(caster, skill, cell)
        return
      }
    } else if (skill.target === 'oneEnemy') {
      if (t && !t.dead && t.side !== caster.side && this._inAttackRange(caster, t)) {
        this._useSkill(caster, skill, cell)
        return
      }
    }
    // 点击外部/无效目标：取消技能选择
    this.skillSelecting = null
    this._setHint()
  }

  // 释放技能入口：怒气校验后，第3个技能（大招）先播放过场动画，动画结束后才真正结算；其余技能直接结算
  _useSkill(caster, skill, targetCell) {
    // 怒气不足则拒绝释放（正常路径下由按钮置灰/AI 候选过滤提前拦截，此处为兜底防护）
    if ((caster.rage || 0) < skill.cost) return false
    // 需要单体目标格的技能（oneAlly/oneEnemy/areaEnemy）若目标格缺失或越界，直接拒绝释放，避免空引用崩溃
    const needsCell = skill.target === 'oneAlly' || skill.target === 'oneEnemy' || skill.target === 'areaEnemy'
    if (needsCell && (!targetCell || !this._inBounds(targetCell.r, targetCell.c))) {
      console.warn('[battle] _useSkill 目标格无效，已跳过释放：', skill.id, targetCell)
      return false
    }
    if (caster.skills.indexOf(skill) === 2) {
      this._startCutscene(caster, skill, targetCell)
      return true
    }
    return this._resolveSkillEffect(caster, skill, targetCell)
  }

  // 按 type/target 分支处理技能效果，释放后结束本回合（大招在过场动画结束后调用，其余技能立即调用）
  _resolveSkillEffect(caster, skill, targetCell) {
    const allies = this.units.filter(u => u.side === caster.side && !u.dead)
    const enemies = this.units.filter(u => u.side !== caster.side && !u.dead)

    switch (skill.type) {
      case 'heal': {
        // 我方英雄治疗技能：与技能伤害同一套结算路径（施法者有效攻击力 × 治疗倍率），见 _calcHeal；
        // 敌方（如 BOSS「符水」自愈）不受此调整，仍按最大血量百分比结算，避免影响 BOSS 强度
        if (skill.target === 'allAlly') {
          // 全体恢复
          allies.forEach(a => {
            const heal = caster.side === 'hero' ? this._calcHeal(caster, skill) : Math.round(a.maxHp * skill.value)
            a.hp = Math.min(a.maxHp, a.hp + heal)
            this._spawnFloater(a, '+' + heal, '#4caf50')
            this._spawnEffect('heal', a)
          })
          this._addLog(caster.name + ' 释放 ' + skill.name + '：我方全体恢复', '#8fe6a0')
        } else if (skill.target === 'oneAlly') {
          // 单体恢复：目标格缺失/越界或目标已失效（阵亡/不在场/非我方）时安全跳过
          if (!targetCell || !this._inBounds(targetCell.r, targetCell.c)) {
            console.warn('[battle] heal oneAlly 目标格无效：', targetCell)
            return false
          }
          const t = this._unitAt(targetCell.r, targetCell.c)
          if (!t || t.side !== caster.side || t.dead) return false
          const heal = caster.side === 'hero' ? this._calcHeal(caster, skill) : Math.round(t.maxHp * skill.value)
          t.hp = Math.min(t.maxHp, t.hp + heal)
          this._spawnFloater(t, '+' + heal, '#4caf50')
          this._spawnEffect('heal', t)
          this._addLog(caster.name + ' 释放 ' + skill.name + '：治疗 ' + t.name + ' +' + heal, '#8fe6a0')
        } else if (skill.target === 'self') {
          // 自身恢复（如"符水"，敌方 BOSS 技能，仍按最大血量百分比结算）
          const heal = caster.side === 'hero' ? this._calcHeal(caster, skill) : Math.round(caster.maxHp * skill.value)
          caster.hp = Math.min(caster.maxHp, caster.hp + heal)
          this._spawnFloater(caster, '+' + heal, '#4caf50')
          this._spawnEffect('heal', caster)
          this._addLog(caster.name + ' 释放 ' + skill.name + '：自身恢复 +' + heal, '#8fe6a0')
        }
        break
      }
      case 'debuffAtk': {
        // 敌方全体攻击降低（如"妖术"）：必定触发
        enemies.forEach(e => {
          e.atkDebuff += skill.value
          e.atkDebuffTurns = Math.max(e.atkDebuffTurns, skill.duration)
          this._spawnFloater(e, '攻击-' + Math.round(skill.value * 100) + '%', '#c9a8e0')
          this._spawnEffect('buff', e, '#c9a8e0')
        })
        this._addLog(caster.name + ' 释放 ' + skill.name + '：敌方全体攻击-' + Math.round(skill.value * 100) + '%', '#c9a8e0')
        break
      }
      case 'buffAtk': {
        // 攻击增益：正面效果，必定触发
        const targets = skill.target === 'self' ? [caster]
          : skill.target === 'allAlly' ? allies : []
        targets.forEach(t => {
          t.atkBuff += skill.value
          t.atkBuffTurns = Math.max(t.atkBuffTurns, skill.duration)
          this._spawnFloater(t, '攻击+' + Math.round(skill.value * 100) + '%', '#e8c96a')
          this._spawnEffect('buff', t, '#e8c96a')
        })
        this._addLog(caster.name + ' 释放 ' + skill.name + '：' + (skill.target === 'self' ? '自身' : '我方全体') + '攻击+' + Math.round(skill.value * 100) + '%', '#e8c96a')
        break
      }
      case 'debuffDef': {
        // 敌方全体防御降低：必定触发
        enemies.forEach(e => {
          e.defDebuff += skill.value
          e.defDebuffTurns = Math.max(e.defDebuffTurns, skill.duration)
          this._spawnFloater(e, '防御-' + Math.round(skill.value * 100) + '%', '#ff5b4d')
          this._spawnEffect('buff', e, '#ff5b4d')
        })
        this._addLog(caster.name + ' 释放 ' + skill.name + '：敌方全体防御-' + Math.round(skill.value * 100) + '%', '#f0a858')
        break
      }
      case 'damage': {
        if (skill.target === 'oneEnemy') {
          // 单体伤害：目标格缺失/越界或目标已失效（阵亡/不在场/己方）时安全跳过
          if (!targetCell || !this._inBounds(targetCell.r, targetCell.c)) {
            console.warn('[battle] damage oneEnemy 目标格无效：', targetCell)
            return false
          }
          const t = this._unitAt(targetCell.r, targetCell.c)
          if (!t || t.side === caster.side || t.dead) return false
          const dmg = this._calcDamage(caster, t, skill)
          this._applyDamage(t, dmg)
          this._spawnFloater(t, '-' + dmg, '#ff5b4d')
          this._spawnEffect('impact', t, this._skillEffectColor(caster))
          this._addLog(caster.name + ' 释放 ' + skill.name + ' → ' + t.name + '：' + dmg + ' 伤害', '#ff9b8a')
          if (t.hp <= 0) { t.hp = 0; t.dead = true; this._addLog(t.name + ' 被击败', '#d75b5b') }
        } else if (skill.target === 'rangeEnemies') {
          // 以施法者自身为中心，AREA_RANGE 格范围内的敌方
          const inRange = enemies.filter(e => this._dist(caster, e) <= AREA_RANGE)
          if (!inRange.length) {
            this.hint = '范围内无敌方单位'
            return false
          }
          const parts = []
          inRange.forEach(e => {
            const dmg = this._calcDamage(caster, e, skill)
            this._applyDamage(e, dmg)
            this._spawnFloater(e, '-' + dmg, '#ff5b4d')
            parts.push(e.name + '-' + dmg)
            if (e.hp <= 0) { e.hp = 0; e.dead = true; this._addLog(e.name + ' 被击败', '#d75b5b') }
          })
          this._spawnEffect('area', caster, this._skillEffectColor(caster))
          this._addLog(caster.name + ' 释放 ' + skill.name + ' 范围：' + parts.join('，'), '#ff9b8a')
        } else if (skill.target === 'areaEnemy') {
          // 以目标格为中心，radius 格范围内的敌方（如"雷法"3x3）
          const center = targetCell
          if (!center || !this._inBounds(center.r, center.c)) {
            console.warn('[battle] areaEnemy 目标格无效：', center)
            return false
          }
          const radius = skill.radius || 1
          const inRange = enemies.filter(e => Math.max(Math.abs(e.r - center.r), Math.abs(e.c - center.c)) <= radius)
          if (!inRange.length) {
            this.hint = '范围内无敌方单位'
            return false
          }
          const parts = []
          inRange.forEach(e => {
            const dmg = this._calcDamage(caster, e, skill)
            this._applyDamage(e, dmg)
            this._spawnFloater(e, '-' + dmg, '#ff5b4d')
            parts.push(e.name + '-' + dmg)
            if (e.hp <= 0) { e.hp = 0; e.dead = true; this._addLog(e.name + ' 被击败', '#d75b5b') }
          })
          this._spawnEffect('area', center, this._skillEffectColor(caster))
          this._addLog(caster.name + ' 释放 ' + skill.name + ' 范围：' + parts.join('，'), '#ff9b8a')
        }
        break
      }
      case 'damageStun': {
        // 单体伤害 + 眩晕1回合：目标格缺失/越界或目标已失效时安全跳过
        // 伤害始终结算，眩晕改为概率触发（命中后眩晕持续时间不变）
        if (!targetCell || !this._inBounds(targetCell.r, targetCell.c)) {
          console.warn('[battle] damageStun 目标格无效：', targetCell)
          return false
        }
        const t = this._unitAt(targetCell.r, targetCell.c)
        if (!t || t.side === caster.side || t.dead) return false
        const dmg = this._calcDamage(caster, t, skill)
        this._applyDamage(t, dmg)
        const stunTriggered = Math.random() <= STUN_PROC_CHANCE
        if (stunTriggered) {
          t.stunned = 1
          this._spawnFloater(t, '-' + dmg + ' 眩晕', '#ff5b4d')
          this._addLog(caster.name + ' 释放 ' + skill.name + ' → ' + t.name + '：' + dmg + ' 伤害 + 眩晕', '#ff9b8a')
        } else {
          this._spawnFloater(t, '-' + dmg, '#ff5b4d')
          this._addLog(caster.name + ' 释放 ' + skill.name + ' → ' + t.name + '：' + dmg + ' 伤害（眩晕未触发）', '#ff9b8a')
        }
        this._spawnEffect('impact', t, this._skillEffectColor(caster))
        if (t.hp <= 0) { t.hp = 0; t.dead = true; this._addLog(t.name + ' 被击败', '#d75b5b') }
        break
      }
      case 'dashDamage': {
        // 突进到目标相邻格并攻击：目标格缺失/越界或目标已失效时安全跳过
        if (!targetCell || !this._inBounds(targetCell.r, targetCell.c)) {
          console.warn('[battle] dashDamage 目标格无效：', targetCell)
          return false
        }
        const t = this._unitAt(targetCell.r, targetCell.c)
        if (!t || t.side === caster.side || t.dead) return false
        const spot = this._findAdjacentSpot(t, caster)
        if (!spot) {
          this.hint = '目标周围无可突进位置'
          return false
        }
        const fromCell = { r: caster.r, c: caster.c } // 突进特效起点：施法者移动前的格子
        this._moveUnit(caster, spot.r, spot.c)
        const dmg = this._calcDamage(caster, t, skill)
        this._applyDamage(t, dmg)
        this._spawnFloater(t, '-' + dmg, '#ff5b4d')
        this._spawnDashEffect(fromCell, t, this._skillEffectColor(caster))
        this._addLog(caster.name + ' 释放 ' + skill.name + ' 突进 → ' + t.name + '：' + dmg + ' 伤害', '#ff9b8a')
        if (t.hp <= 0) { t.hp = 0; t.dead = true; this._addLog(t.name + ' 被击败', '#d75b5b') }
        break
      }
    }

    // 扣减怒气，标记本回合已用技能，释放后结束行动
    caster.rage = Math.max(0, (caster.rage || 0) - skill.cost)
    caster.skillUsed = true
    caster.moved = true
    this.movableCells = []
    this.skillSelecting = null

    this._checkSettle()
    if (this.over) return true
    this._endTurn()
    return true
  }

  // 找目标相邻的可通行格（猛进用），优先离施法者最近的
  _findAdjacentSpot(target, caster) {
    let best = null
    let bestDist = Infinity
    for (const [dr, dc] of DIRS) {
      const nr = target.r + dr
      const nc = target.c + dc
      if (!this._passable(nr, nc, caster)) continue
      const d = Math.max(Math.abs(nr - caster.r), Math.abs(nc - caster.c))
      if (d < bestDist) { bestDist = d; best = { r: nr, c: nc } }
    }
    return best
  }

  // ---- 道具系统 ----
  // 道具选目标状态：点格子后判定目标是否合法并使用（仅 oneAlly 类道具需要选目标）
  _resolveItemTarget(cell) {
    const def = this.itemSelecting.item
    const caster = this.current
    const t = this._unitAt(cell.r, cell.c)
    if (t && !t.dead && t.side === 'hero') {
      if (this._manhattan(caster, t) > SKILL_RANGE) {
        this.hint = '目标过远，需' + SKILL_RANGE + '格内（当前' + this._manhattan(caster, t) + '格）'
        return
      }
      this._useItem(def.id, cell)
    } else {
      this.hint = '请选择我方单位'
    }
  }

  // 使用道具：扣减 gameData.player.items 计数并应用效果；不计入"1技能/回合"限制，不结束本回合
  _useItem(itemId, targetCell) {
    const def = ITEM_DEFS.find(i => i.id === itemId)
    if (!def) return
    const items = gameData.player.items
    if (!items || (items[itemId] || 0) <= 0) return

    if (def.target === 'oneAlly') {
      const t = this._unitAt(targetCell.r, targetCell.c)
      if (!t || t.dead || t.side !== 'hero') return
      if (def.type === 'heal') {
        const heal = Math.round(t.maxHp * def.value)
        t.hp = Math.min(t.maxHp, t.hp + heal)
        this._spawnFloater(t, '+' + heal, '#4caf50')
        this._spawnEffect('heal', t)
        this._addLog('使用 ' + def.name + '：治疗 ' + t.name + ' +' + heal, '#8fe6a0')
      } else if (def.type === 'buffDefFlat') {
        t.defBuffFlat = (t.defBuffFlat || 0) + def.value
        t.defBuffFlatTurns = Math.max(t.defBuffFlatTurns || 0, def.duration)
        this._spawnFloater(t, '防御+' + def.value, '#e8c96a')
        this._spawnEffect('buff', t, '#e8c96a')
        this._addLog('使用 ' + def.name + '：' + t.name + ' 防御+' + def.value + '（' + def.duration + '回合）', '#e8c96a')
      }
    } else if (def.target === 'allAlly' && def.type === 'healAll') {
      const allies = this.units.filter(u => u.side === 'hero' && !u.dead)
      allies.forEach(a => {
        const heal = Math.round(a.maxHp * def.value)
        a.hp = Math.min(a.maxHp, a.hp + heal)
        this._spawnFloater(a, '+' + heal, '#4caf50')
        this._spawnEffect('heal', a)
      })
      this._addLog('使用 ' + def.name + '：我方全体恢复 ' + Math.round(def.value * 100) + '% 血量', '#8fe6a0')
    }

    items[itemId]--
    saveGame()
    this.itemSelecting = null
    this.itemDialog = false
    this._setHint()
  }

  // ---- 敌方 AI ----
  // 行动顺序：原地可攻击 → 评估技能是否比普攻更优 → 普攻；
  // 原地不可攻击 → 先尝试射程内的技能，否则用 BFS 可达范围移动到最优目标身边 → 移动后立即再判定攻击/技能。
  // 核心原则：只要能打到目标就绝不放弃这次攻击（技能只在“不劣于普攻”或“保命/无攻击可选”时才会取代普攻）。
  // unit 可以是敌方单位（常规敌方 AI）或开启「自动」后的我方英雄，逻辑通用：目标始终取"对方阵营"单位
  _aiAct(unit) {
    const targets = this.units.filter(u => u.side !== unit.side && !u.dead)
    if (!targets.length) { this._endTurn(); return }

    // 原地已可攻击到目标：先判断技能是否比普攻更优，否则直接普攻
    const atkNow = this._attackableEnemies(unit)
    if (atkNow.length) {
      if (this._aiTryUseSkill(unit, targets, atkNow)) return
      this._aiDoAttack(unit, atkNow)
      return
    }

    // 原地不可攻击：尝试射程内的技能（如"雷法""横扫"等无需贴身的技能）
    if (this._aiTryUseSkill(unit, targets, [])) return

    // 按优先级（可斩杀 > 血量最低 > 攻击力最高）选出本回合的进攻目标，再用可达范围移动靠近（始终使用满移动力寻优）
    const moveTarget = this._aiChooseAttackTarget(unit, targets)
    const dest = this._aiFindMoveDest(unit, moveTarget)
    unit.moved = true
    const path = dest ? this._pathTo(unit, dest.r, dest.c) : null
    if (!path) {
      this._endTurn()
      return
    }
    this._startMove(unit, path, () => {
      const livingTargets = this.units.filter(u => u.side !== unit.side && !u.dead)
      const atk = this._attackableEnemies(unit)
      if (atk.length) {
        if (this._aiTryUseSkill(unit, livingTargets, atk)) return
        this._aiDoAttack(unit, atk)
        return
      }
      this._endTurn()
    })
  }

  // 执行普通攻击：按优先级从可攻击目标中选出最优目标并结算
  _aiDoAttack(unit, candidates) {
    const target = this._aiChooseAttackTarget(unit, candidates)
    if (!target) { this._endTurn(); return }
    this._attack(unit, target)
    unit.attacked = true
    this._endTurn()
  }

  // 按优先级从候选目标中选出最优目标：
  // a) 本次攻击（或技能，valueMult 为技能伤害倍率）可击杀的目标 —— 命中即可击杀时优先解决攻击力最高（威胁最大）者
  // b) 无法击杀时，取血量最低的目标
  // c) 血量并列时，取攻击力最高（威胁最大）的目标
  _aiChooseAttackTarget(unit, candidates, valueMult) {
    if (!candidates || !candidates.length) return null
    const mult = valueMult || 1
    const dmgTo = u => Math.max(1, Math.round(this._effAtk(unit) * mult - this._effDef(u)))
    const killable = candidates.filter(u => dmgTo(u) >= u.hp)
    const pool = killable.length ? killable : candidates
    let best = pool[0]
    for (const u of pool) {
      if (killable.length) {
        if (this._effAtk(u) > this._effAtk(best)) best = u
      } else if (u.hp < best.hp || (u.hp === best.hp && this._effAtk(u) > this._effAtk(best))) {
        best = u
      }
    }
    return best
  }

  // 用 BFS 可达范围（this.move 步内）寻找本回合最佳移动落点：
  // 优先选择能落入自身武器系攻击射程[minRange,maxRange]的格子（步数最少）；若本回合无法进入射程，
  // 则选择能尽量贴近射程的格子，避免"移动一步就不管距离"的随意移动，充分利用移动力。
  _aiFindMoveDest(unit, target) {
    if (!target) return null
    const wt = this._weaponMeta(unit)
    const minR = wt.minRange || 1
    const maxR = wt.range
    const { seen } = this._bfsReachable(unit)
    let dest = null
    let bestSteps = Infinity
    let bestDistToRange = Infinity
    for (const key in seen) {
      const [r, c] = key.split(',').map(Number)
      if (r === unit.r && c === unit.c) continue
      const steps = seen[key]
      const d = this._dist({ r, c }, target)
      const inRange = d >= minR && d <= maxR
      if (inRange) {
        if (bestDistToRange > 0 || steps < bestSteps) { bestSteps = steps; bestDistToRange = 0; dest = { r, c } }
      } else if (bestDistToRange > 0) {
        const distToRange = d > maxR ? d - maxR : (minR - d)
        if (distToRange < bestDistToRange || (distToRange === bestDistToRange && steps < bestSteps)) {
          bestDistToRange = distToRange; bestSteps = steps; dest = { r, c }
        }
      }
    }
    return dest
  }

  // 敌方 AI 尝试释放技能：
  // - 残血（< 60% 血量）时优先释放治疗/自疗类技能，保命优先，不受"是否有可攻击目标"影响
  // - 增益/减益类技能只在本回合原地无法攻击时才释放，绝不会因此放弃可用的普攻
  // - 伤害类技能：小兵唯一技能时，只要能命中目标就使用（视为比普攻更优的技能替代普攻）；
  //   BOSS 则按预估收益（命中数/是否可斩杀）与普攻比较，优于普攻才使用
  // 释放成功时内部已调用 _useSkill（会自动结束回合），返回 true；不释放则返回 false（由调用方继续走普攻/移动逻辑）
  _aiTryUseSkill(unit, heroes, atkNow) {
    if (!unit.skills || !unit.skills.length || unit.skillUsed) return false
    // 冷却已就绪 且 怒气足够（按技能消耗 40/50/80）才纳入候选
    const candidates = unit.skills.filter(s => !(s.cd > 0) && (unit.rage || 0) >= s.cost)
    if (!candidates.length) return false
    const hasAttackNow = !!(atkNow && atkNow.length)
    const attackTarget = hasAttackNow ? this._aiChooseAttackTarget(unit, atkNow) : null
    const attackDmg = attackTarget ? Math.max(1, this._effAtk(unit) - this._effDef(attackTarget)) : 0

    // 治疗/自疗：残血时优先释放，保命第一
    const heal = candidates.find(s => s.type === 'heal' && unit.hp < unit.maxHp * 0.6)
    if (heal && this._aiCastSkill(unit, heal, heroes)) return true

    // 增益/减益类：只在本回合无法攻击时才释放，避免浪费可用的攻击
    const buffDebuff = candidates.filter(s => s.type === 'buffAtk' || s.type === 'debuffAtk' || s.type === 'debuffDef')
    if (!hasAttackNow && buffDebuff.length) {
      if (unit.skills.length === 1) {
        // 小兵唯一技能为增益/减益类：约 80% 概率使用
        if (Math.random() < 0.8 && this._aiCastSkill(unit, buffDebuff[0], heroes)) return true
      } else {
        const sorted = buffDebuff.slice().sort((a, b) => this._aiSkillScore(unit, b, heroes) - this._aiSkillScore(unit, a, heroes))
        for (const s of sorted) {
          if (this._aiCastSkill(unit, s, heroes)) return true
        }
      }
    }

    // 伤害类技能：有可用普攻时，只有收益明显优于普攻（收益 > 普攻伤害）才会取代普攻；
    // 原地/移动后均无法普攻时，只要收益为正就释放，绝不放弃可用的进攻手段
    const dmgSkills = candidates.filter(s => s.type === 'damage' || s.type === 'damageStun' || s.type === 'dashDamage')
    if (dmgSkills.length) {
      const sorted = dmgSkills.slice().sort((a, b) => this._aiSkillScore(unit, b, heroes) - this._aiSkillScore(unit, a, heroes))
      for (const s of sorted) {
        const score = this._aiSkillScore(unit, s, heroes)
        if (hasAttackNow && score <= attackDmg) continue
        if (score <= 0) continue
        if (this._aiCastSkill(unit, s, heroes)) return true
      }
    }
    return false
  }

  // 技能收益估分：
  // - 治疗：残血时给高分，否则不建议使用
  // - 增益：未处于增益状态时给基础分，已叠加则不建议重复释放
  // - 减益：给固定基础分
  // - 伤害类：估算命中目标的总伤害（多目标技能命中数越多分越高），可斩杀目标额外大幅加分
  _aiSkillScore(unit, skill, heroes) {
    if (skill.type === 'heal') return unit.hp < unit.maxHp * 0.6 ? 999 : -1
    if (skill.type === 'buffAtk') return unit.atkBuffTurns > 0 ? -1 : 30
    if (skill.type === 'debuffAtk' || skill.type === 'debuffDef') return 25
    if (skill.type === 'damage' || skill.type === 'damageStun' || skill.type === 'dashDamage') {
      const targets = this._aiSkillTargets(unit, skill, heroes)
      if (!targets.length) return -1
      let total = 0
      targets.forEach(t => {
        const dmg = this._calcDamage(unit, t, skill)
        total += Math.min(dmg, t.hp)
        if (dmg >= t.hp) total += 1000 // 可斩杀目标：大幅加分，优先释放
      })
      return total
    }
    return 20
  }

  // 估算技能能命中的目标集合（选取逻辑与实际释放 _aiCastSkill 保持一致，用于收益打分）
  _aiSkillTargets(unit, skill, heroes) {
    if (skill.target === 'rangeEnemies') {
      // 以施法者自身为中心，AREA_RANGE 格范围内的我方目标
      return heroes.filter(h => this._dist(unit, h) <= AREA_RANGE)
    }
    if (skill.target === 'areaEnemy') {
      // 先选定施法距离内最优的中心目标，再统计其 radius 范围内的目标
      const inRange = heroes.filter(h => this._manhattan(unit, h) <= SKILL_RANGE)
      const center = this._aiChooseAttackTarget(unit, inRange, skill.value || 1)
      if (!center) return []
      const radius = skill.radius || 1
      return heroes.filter(h => Math.max(Math.abs(h.r - center.r), Math.abs(h.c - center.c)) <= radius)
    }
    if (skill.target === 'oneEnemy') {
      // 单体技能射程与该单位普攻射程同一来源（武器系射程），与玩家手动施法选目标逻辑一致
      const inRange = heroes.filter(h => this._inAttackRange(unit, h))
      const best = this._aiChooseAttackTarget(unit, inRange, skill.value || 1)
      return best ? [best] : []
    }
    return []
  }

  // 实际释放：为需要选目标的技能（oneEnemy/areaEnemy/oneAlly）自动按优先级选取施法距离内的最优目标；释放成功则记录冷却
  _aiCastSkill(unit, skill, heroes) {
    let cell = null
    if (skill.target === 'oneEnemy') {
      // 单体伤害技能：射程与普攻同一来源（武器系射程），不再享有超出武器射程的额外施法距离
      const inRange = heroes.filter(h => !h.dead && this.units.indexOf(h) !== -1 && this._inAttackRange(unit, h))
      const best = this._aiChooseAttackTarget(unit, inRange, skill.value || 1)
      if (!best || best.dead || !this._inBounds(best.r, best.c)) return false
      cell = { r: best.r, c: best.c }
    } else if (skill.target === 'areaEnemy') {
      // BOSS 专属范围技能（如"雷法"）：施法中心选取距离沿用既有 SKILL_RANGE，不受武器射程统一化影响，避免削弱 BOSS 强度
      const inRange = heroes.filter(h => !h.dead && this.units.indexOf(h) !== -1 && this._manhattan(unit, h) <= SKILL_RANGE)
      const best = this._aiChooseAttackTarget(unit, inRange, skill.value || 1)
      if (!best || best.dead || !this._inBounds(best.r, best.c)) return false
      cell = { r: best.r, c: best.c }
    } else if (skill.target === 'oneAlly') {
      // 目标为我方：射程内（武器系射程，与普攻/oneEnemy 技能同一来源）选血量百分比最低的我方存活单位（治疗/单体增益类技能）
      const allies = this.units.filter(u => u.side === unit.side && !u.dead && this._inAttackRange(unit, u))
      if (!allies.length) return false
      let best = allies[0]
      allies.forEach(a => { if (a.hp / a.maxHp < best.hp / best.maxHp) best = a })
      if (!best || best.dead || !this._inBounds(best.r, best.c)) return false
      cell = { r: best.r, c: best.c }
    }
    const ok = this._useSkill(unit, skill, cell)
    if (ok && skill.cooldown) skill.cd = skill.cooldown
    return !!ok
  }

  // 恢复默认操作提示（取消选择后用）
  _setHint() {
    const cur = this.current
    if (!cur || cur.side !== 'hero') { this.hint = ''; return }
    if (!cur.moved) this.hint = '点绿格移动，点敌方攻击，或点左侧普攻/技能'
    else this.hint = '点敌方攻击，或点左侧普攻/技能/结束'
  }

  // 是否允许撤回移动：仅当前我方单位、非自动战斗、已移动、且尚未提交攻击/技能（含大招过场中）时可用
  _canUndoMove() {
    const cur = this.current
    if (!cur || cur.side !== 'hero' || this.autoBattle || this._skipPending || cur.moving) return false
    if (this.cutscene) return false
    // 只能是当前回合正在行动的单位（与回合队列中的行动对象严格同一引用），已结束行动的单位一律不可回退
    if (cur !== this.queue[this.qIdx] || cur.acted) return false
    return !!(cur.moved && !cur.attacked && !cur.skillUsed && this._turnStartPos)
  }

  // 撤回移动：单位回到本回合起始格，重新显示可移动格供玩家再次选择；仅在未提交攻击/技能前允许（见 _canUndoMove）
  _undoMove() {
    if (!this._canUndoMove()) return
    const cur = this.current
    cur.r = this._turnStartPos.r
    cur.c = this._turnStartPos.c
    cur.moved = false
    this.attackSelecting = null
    this.skillSelecting = null
    this.itemSelecting = null
    this.movableCells = this._movableCells(cur)
    this.hint = '已回退，点绿格移动，点敌方攻击，或点左侧普攻/技能'
  }

  // ---- 交互 ----
  onTouch(x, y) {
    if (!this.ready) return
    // 大招过场动画播放期间：屏蔽全部输入
    if (this.cutscene) return
    // 结算弹窗按钮
    if (this.over) {
      for (const b of this._dialogBtns) {
        if (this.hitRect(x, y, b.x, b.y, b.w, b.h)) {
          if (b.action === 'restart') this._initBattle()
          else if (b.action === 'maincity') this.game.switch('maincity', { openCampaign: true })
          return
        }
      }
      return
    }
    // 退出确认弹窗：任意时刻（含敌方回合/眩晕）均可响应
    if (this.exitConfirm) {
      for (const b of this._exitDialogBtns) {
        if (this.hitRect(x, y, b.x, b.y, b.w, b.h)) {
          if (b.action === 'confirm') this.game.switch('maincity')
          else this.exitConfirm = false
          return
        }
      }
      // 点击弹窗外部关闭
      const p = this._exitDialogPanel
      if (!p || !this.hitRect(x, y, p.x, p.y, p.w, p.h)) this.exitConfirm = false
      return
    }

    // 道具弹窗：优先处理弹窗内交互
    if (this.itemDialog) {
      if (this._itemDialogClose && this.hitRect(x, y, this._itemDialogClose.x, this._itemDialogClose.y, this._itemDialogClose.w, this._itemDialogClose.h)) {
        this.itemDialog = false
        return
      }
      for (const b of this._itemDialogBtns) {
        if (this.hitRect(x, y, b.x, b.y, b.w, b.h)) {
          if (!b.enabled) return
          const def = ITEM_DEFS.find(i => i.id === b.id)
          if (def.target === 'allAlly') {
            this._useItem(def.id, null)
          } else {
            this.itemDialog = false
            this.itemSelecting = { item: def }
            this.attackSelecting = null
            this.skillSelecting = null
            this.movableCells = []
            this.hint = '选择我方单位使用「' + def.name + '」'
          }
          return
        }
      }
      // 点击弹窗外部关闭
      const p = this._itemDialogPanel
      if (!p || !this.hitRect(x, y, p.x, p.y, p.w, p.h)) this.itemDialog = false
      return
    }

    // 退出战斗按钮：任意时刻（含敌方回合/眩晕）均可点击
    if (this._exitBtn && this.hitRect(x, y, this._exitBtn.x, this._exitBtn.y, this._exitBtn.w, this._exitBtn.h)) {
      this.exitConfirm = true
      return
    }

    // 自动战斗开关：任意时刻（含敌方回合）均可切换；开启后我方英雄回合由 AI 接管
    if (this._autoBtn && this.hitRect(x, y, this._autoBtn.x, this._autoBtn.y, this._autoBtn.w, this._autoBtn.h)) {
      this.autoBattle = !this.autoBattle
      this.attackSelecting = null
      this.skillSelecting = null
      this.itemSelecting = null
      if (this.current && this.current.side === 'hero' && !this.current.moving) {
        // 关闭自动后交还手动控制：重新计算可移动格与提示
        this.movableCells = (!this.autoBattle && !this.current.moved) ? this._movableCells(this.current) : []
        this._setHint()
      }
      return
    }

    // 敌方回合 / 眩晕等待 不响应玩家操作
    if (!this.current || this.current.side !== 'hero' || this._skipPending) return
    // 自动战斗开启时英雄由 AI 接管，不响应手动点击
    if (this.autoBattle) return
    // 移动动画进行中：阻止对当前单位发起新行动
    if (this.current.moving) return

    // 右侧日志栏触摸 → 启动拖动滚动（不处理点击）
    if (x >= this.rightBarX) {
      this._logDrag = { startY: y, startTop: this.logScrollTop }
      return
    }

    const cur = this.current

    // 使用道具按钮：打开道具弹窗
    if (this._itemBtn && this._itemBtn.enabled &&
      this.hitRect(x, y, this._itemBtn.x, this._itemBtn.y, this._itemBtn.w, this._itemBtn.h)) {
      this.itemDialog = true
      this.attackSelecting = null
      this.skillSelecting = null
      return
    }

    // 回退按钮：撤回本回合移动，回到起始格重新选择落点
    if (this._undoBtn && this._undoBtn.enabled &&
      this.hitRect(x, y, this._undoBtn.x, this._undoBtn.y, this._undoBtn.w, this._undoBtn.h)) {
      this._undoMove()
      return
    }

    // 结束行动按钮
    if (this._endBtn && this._endBtn.enabled &&
      this.hitRect(x, y, this._endBtn.x, this._endBtn.y, this._endBtn.w, this._endBtn.h)) {
      this.attackSelecting = null
      this.skillSelecting = null
      this._endTurn()
      return
    }

    // 普通攻击按钮：进入/退出选目标状态
    if (this._attackBtn && this._attackBtn.enabled &&
      this.hitRect(x, y, this._attackBtn.x, this._attackBtn.y, this._attackBtn.w, this._attackBtn.h)) {
      if (this.attackSelecting) {
        this.attackSelecting = null
        this._setHint()
      } else {
        this.attackSelecting = { unit: cur }
        this.skillSelecting = null
        this.movableCells = []
        this.hint = '选择红色高亮的敌方单位进行普通攻击'
      }
      return
    }

    // 技能按钮
    if (this._skillBtns && this._skillBtns.length) {
      for (const sb of this._skillBtns) {
        if (this.hitRect(x, y, sb.x, sb.y, sb.w, sb.h)) {
          if (sb.enabled) {
            this.attackSelecting = null
            // 再次点击已选中技能 → 取消选择
            if (this.skillSelecting && this.skillSelecting.skill === sb.skill) {
              this.skillSelecting = null
              this._setHint()
            } else {
              this._startSkillSelect(sb.skill)
            }
          }
          return
        }
      }
    }

    // 技能选目标状态：点格子选目标
    if (this.skillSelecting) {
      const cell = this._cellAt(x, y)
      if (cell) this._resolveSkillTarget(cell)
      return
    }

    // 道具选目标状态：点格子选目标
    if (this.itemSelecting) {
      const cell = this._cellAt(x, y)
      if (cell) this._resolveItemTarget(cell)
      return
    }

    // 普通攻击选目标状态：点敌方执行普攻，否则取消
    if (this.attackSelecting) {
      const cell = this._cellAt(x, y)
      if (cell) {
        const target = this._unitAt(cell.r, cell.c)
        if (target && target.side === 'enemy' && !cur.attacked && this._inAttackRange(cur, target)) {
          this._attack(cur, target)
          cur.attacked = true
          this.movableCells = []
          this.attackSelecting = null
          this._endTurn()
          return
        }
      }
      this.attackSelecting = null
      this._setHint()
      return
    }

    const cell = this._cellAt(x, y)
    if (!cell) return
    const target = this._unitAt(cell.r, cell.c)

    // 点可移动绿格 → 沿路径逐格滑动移动
    if (!cur.moved && this.movableCells.some(m => m.r === cell.r && m.c === cell.c)) {
      const path = this._pathTo(cur, cell.r, cell.c)
      if (!path) return
      cur.moved = true
      this.movableCells = []
      this._startMove(cur, path, () => {
        if (this._attackableEnemies(cur).length) this.hint = '点敌方攻击，或点左侧普攻/技能/结束'
        else this.hint = '附近无可攻击敌人，可点技能或「结束」'
      })
      return
    }

    // 点射程内敌方 → 直接攻击（与左侧普攻按钮并存）
    if (!cur.attacked && target && target.side === 'enemy' && this._inAttackRange(cur, target)) {
      this._attack(cur, target)
      cur.attacked = true
      this.movableCells = []
      this._endTurn()
      return
    }

    // 点当前单位 → 未移动时重新显示可移动格；已移动但未提交攻击/技能时视为「点单位再次点击=撤回移动」
    if (target === cur && !cur.moved) {
      this.movableCells = this._movableCells(cur)
      this.hint = '点绿格移动，点敌方攻击，或点左侧普攻/技能'
      return
    }
    if (target === cur && this._canUndoMove()) {
      this._undoMove()
      return
    }

    // 点其它我方单位 → 提示未到其行动
    if (target && target.side === 'hero') {
      this.hint = '未到 ' + target.name + ' 行动'
      return
    }

    // 点远处敌方 → 提示距离不足
    if (target && target.side === 'enemy' && !cur.attacked) {
      this.hint = '目标不在攻击范围'
      return
    }

    this.hint = '点绿格移动，点敌方攻击，或点左侧普攻/技能'
  }

  // 触摸移动：日志栏拖动滚动
  onTouchMove(x, y) {
    if (!this._logDrag) return
    const contentH = this.log.length * this.lineH
    const maxScroll = Math.max(0, contentH - this.logViewH)
    let ns = this._logDrag.startTop - (y - this._logDrag.startY)
    if (ns < 0) ns = 0
    if (ns > maxScroll) ns = maxScroll
    this.logScrollTop = ns
  }

  // 触摸结束：停止日志拖动
  onTouchEnd() {
    this._logDrag = null
  }
}
