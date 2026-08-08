import { Scene } from './scene.js'
import { playAttack, playBattleBg, playHit, stopBattleBg, stopMainBg } from '../audio.js'
import { getLocalAssetPath } from '../config.js'

const HERO_NAMES = ['guanyu', 'liubei', 'zhangfei', 'zhaoyun', 'zhugeliang']

const HERO_CN_NAME = {
  guanyu: '关羽',
  liubei: '刘备',
  zhangfei: '张飞',
  zhaoyun: '赵云',
  zhugeliang: '诸葛亮'
}

const HERO_RARITY_COLOR = {
  guanyu: '#c0392b',
  zhangfei: '#e6a817',
  zhaoyun: '#9b59b6',
  liubei: '#2e86de',
  zhugeliang: '#16a085'
}

// 武将属性总表（单一数据源）：maxHp 最大生命 / damage 攻击力 / attackRange 攻击射程（格数）/
// attackCooldown 攻击冷却（秒，越大攻速越慢）/ animFps 攻击动作播放帧率——攻速与动作播放速度挂钩，
// 攻速慢的武将动作播得慢，攻速快的播得快，命中判定点（hitAt = 播放时长）也随之提前或延后；
// 刘备是辅助治疗单位，damage 为 0，额外带 healAmount（单次回血量）/ healRange（治疗范围，格数）
// 关羽：血量多、攻击力高、射程近（1 格）、攻速慢
// 张飞：血量中等、攻击力一般、射程 2 格、攻速慢，额外带 10% 眩晕概率（见 STUN_PROC_CHANCE）
// 赵云：血量中等、攻击力一般、射程 2 格、攻速快
// 诸葛亮：血量少、攻击力高、射程远（4 格）、攻速慢
// 刘备：血量高、加血少、治疗范围覆盖周边 3 格、施法慢
const HERO_STATS = {
  guanyu: { maxHp: 160, damage: 20, attackRange: 0.8, attackCooldown: 1.8, animFps: 7 },
  zhangfei: { maxHp: 120, damage: 10, attackRange: 2, attackCooldown: 1.6, animFps: 8 },
  zhaoyun: { maxHp: 120, damage: 10, attackRange: 2, attackCooldown: 0.6, animFps: 14 },
  zhugeliang: { maxHp: 80, damage: 20, attackRange: 4, attackCooldown: 2.0, animFps: 7 },
  liubei: { maxHp: 180, damage: 0, attackRange: 0, attackCooldown: 2.0, animFps: 7, healAmount: 10, healRange: 3 }
}

// 张飞攻击命中时触发眩晕的概率，以及眩晕怪物无法行动/攻击（含攻击动作冻结在原地）的持续时间（秒）
const STUN_PROC_CHANCE = 0.10
const STUN_DURATION = 1.5

const PULL_FLIP_STAGGER = 0.15
const PULL_FLIP_DUR = 0.35
const PULL_DONE_HOLD = 0.25

// 赵云动作关键帧（攻击前摇/顶点/回收/待机），来源于同一段动作视频的关键帧截取
const ZHAOYUN_FRAMES = ['06', '09', '15', '21', '28', '46', '55', '61', '80', '110']

// 诸葛亮动作关键帧（施法前摇/顶点/回收），11 帧
const ZHUGELIANG_FRAME_COUNT = 11

// 关羽动作关键帧（攻击前摇/挥刀/回收），来源于同一段动作视频的关键帧截取，18 帧
const GUANYU_FRAMES = ['08', '11', '15', '20', '23', '27', '33', '39', '43', '47', '63', '67', '71', '75', '79', '143', '147', '151']

// 张飞动作关键帧（攻击前摇/挥矛/回收），来源于同一段动作视频的关键帧截取，18 帧
const ZHANGFEI_FRAMES = ['07', '11', '15', '19', '23', '27', '31', '39', '47', '55', '63', '71', '79', '87', '99', '123', '159', '167']

// 刘备动作关键帧（举剑施法前摇/挥举/回收，作为治疗的施法动作），来源于同一段动作视频的关键帧截取，18 帧
const LIUBEI_FRAMES = ['12', '16', '19', '22', '25', '28', '31', '34', '37', '40', '43', '46', '49', '52', '55', '58', '70', '100']

// 小兵攻击动画帧数（小兵.mp4，朝左），来源于同一段动作视频的关键帧截取
const XIAOBING_FRAME_COUNT = 11

// 小兵行走动画帧数（小兵走路.mp4，朝左）
const XIAOBING_WALK_FRAME_COUNT = 10

// 刀斧手/弓箭手素材帧号不连续，按文件名排序后的顺序播放
const DAOFU_FRAMES = ['006', '009', '011', '014', '015', '018', '031', '034', '035', '038', '091', '095', '099', '103', '107', '110']
const DAOFU_WALK_FRAMES = ['006', '014', '022', '030', '038', '046', '054', '062', '070', '078', '086', '094', '102', '110', '118', '126']
const LB_FRAMES = ['011', '019', '027', '035', '043', '051', '059', '067', '075', '083', '091', '099', '107', '115', '123', '131', '139', '147', '155', '163', '171', '179', '187']
const LB_WALK_FRAMES = ['008', '020', '032', '044', '056', '068', '080', '092', '104', '116', '128', '140', '152', '164', '176', '188']
const GONGJIAN_FRAMES = ['003', '006', '007', '010', '011', '018', '042', '047', '095', '099', '103', '106', '149', '151', '155', '159']
const GONGJIAN_WALK_FRAMES = ['006', '014', '022', '030', '038', '046', '054', '062', '070', '078', '086', '094', '102', '110', '118', '126']
const ZJ_FRAMES = ['051', '055', '062', '066', '074', '087', '091', '122', '127', '135', '143', '151', '155', '163', '167']
const ZJ_WALK_FRAMES = ['008', '020', '032', '044', '056', '068', '080', '092', '104', '116', '128', '140', '152', '164', '176', '188']
const DZ_FRAMES = ['007', '013', '019', '025', '031', '037', '043', '049', '083', '091', '095', '099', '103', '107', '111', '115', '119', '123']
const DZ_WALK_FRAMES = ['008', '015', '022', '029', '036', '043', '050', '057', '064', '071', '078', '085', '092', '099', '106', '113']

const ATTACK_ANIM_DUR = 0.35
// 近战命中判定点：动作播放到此比例时才是"打实"的一刻（挥砍/突刺到位），之前不结算伤害
const ATTACK_HIT_POINT = ATTACK_ANIM_DUR * 0.6

// 诸葛亮扇子挥动动画完整播放一轮（11 帧）所需时长（帧率取自 HERO_STATS.zhugeliang.animFps）：
// 法球必须等整段施法动作（前摇->挥出->回收）全部播完之后才生成并发射，而不是像近战武将那样在
// 动作播到命中点时就结算

// 有独立动作帧的攻击动画（赵云/关羽/张飞/刘备/诸葛亮）单轮播放帧率统一取自 HERO_STATS[heroId].animFps，
// 攻击触发后帧序号按各自帧率单次播完，不再循环——攻速越快帧率越高，动作播得越快
// 小兵挥击动作帧率（与 _renderMonsters 保持一致）
const XIAOBING_ATTACK_FPS = 8
const MONSTER_ATTACK_FPS = 8

// 后摇停顿（所有攻击动作播完后的静止/保持收势姿态时长）：攻击动画播放结束 -> 后摇停顿 -> 冷却允许时才能开始下一次攻击，
// 避免攻击动作首尾相接、循环播放造成的"抽搐感"。取值需要清晰可见但不拖沓，故选 0.3s
const ATTACK_RECOVERY_PAUSE = 0.3
// 小兵挥击动作播完一轮所需时长，用于叠加后摇停顿，防止小兵攻击帧无间断循环
const XIAOBING_ATTACK_PLAY_DUR = XIAOBING_FRAME_COUNT / XIAOBING_ATTACK_FPS
// 小兵两次挥击之间的最小间隔：取"原有 1.0s 攻击节奏"与"挥击动作播完 + 后摇停顿"两者中较大值，
// 不改变原有 1.0s 节奏本身，只是在动作+后摇更长时顺延下一次攻击，避免动作被打断/循环
const MONSTER_ATTACK_GAP = Math.max(1.0, XIAOBING_ATTACK_PLAY_DUR + ATTACK_RECOVERY_PAUSE)

// 战役共 15 关；每关守住 60 秒即胜利，怪物属性和出怪间隔在进关时按关卡等级计算。
const LEVEL_COUNT = 15
const BATTLE_TIME_LIMIT = 180
const MONSTER_SPAWN_FIRST = 1.5
const MONSTER_MAX_ALIVE = 8
const MONSTER_ATTACK_COOLDOWN = 1.0
const MONSTER_SPAWN_INTERVAL_BASE = 2.8
const MONSTER_SPAWN_INTERVAL_STEP = 0.22
const MONSTER_SPAWN_INTERVAL_MIN = 0.6

// 根据剩余血量百分比返回血条填充色：>70% 默认绿色，<=70% 黄色，<=30% 红色
function hpBarColor(hp, maxHp) {
  const pct = maxHp > 0 ? hp / maxHp : 0
  if (pct <= 0.3) return '#e53935'
  if (pct <= 0.7) return '#ffca28'
  return '#4caf50'
}

const MONSTER_RANGE_CELLS = 0.8
const RANGED_RANGE_CELLS = 2
const ZHANGJIAO_AOE_RANGE_CELLS = 1
const ZHANGJIAO_AOE_MAX_TARGETS = 6
const RANGED_ATTACK_RELEASE_POINT = 0.6
const PROJECTILE_SPEED = 300
const PROJECTILE_HIT_DIST = 14
const PROJECTILE_MAX_ALIVE = 12
const HIT_FLASH_DUR = 0.25
const DYING_DUR = 0.35
const HERO_DYING_DUR = 0.45
const DMG_TEXT_DUR = 0.4
const DRAG_MOVE_THRESHOLD = 10
const MONSTER_GOLD_BASE = 10 // 1 级怪物的基础掉落金币；实际掉落按怪物等级线性增长
const GACHA_TOAST_DUR = 0.8
const REFRESH_COST_BASE = 30

// 武将升级：等级属于该武将本身（同一武将的多个部署副本共享等级），每级 +50% 攻击力、+15% 最大生命；
// 升级花费随当前等级线性增长（level -> level+1 花费 UPGRADE_COST_BASE * level 金币 + FRAGMENT_COST_PER_LV * level 碎片），可调；
// 碎片来自主页面抽卡（main.js），金币/碎片二者缺一不可
const UPGRADE_COST_BASE = 200
const FRAGMENT_COST_PER_LV = 5
const HERO_HP_LEVEL_BONUS = 0.15
const HERO_DAMAGE_LEVEL_BONUS = 0.5
function upgradeCost(level) {
  return UPGRADE_COST_BASE * level
}
function upgradeFragmentCost(level) {
  return FRAGMENT_COST_PER_LV * level
}

// PVZ 风格首页场景：上方草坪地图 + 下方随机武将卡组、抽卡刷新、部署武将上阵
export class HomeScene extends Scene {
  constructor(game, params) {
    super(game)
    this.params = params || {}
  }

  enter() {
    const w = this.game.width
    const h = this.game.height

    stopMainBg()
    playBattleBg()

    this.rows = 3
    this.cols = 8
    this.lawnWidthRatio = 0.70
    this.leftPad = 30

    // 顶部状态栏（头像 + 金币），布局详见 _renderTopBar；topMargin 需为其预留空间，避免与草坪重叠
    this.avatarSize = 40
    this.topBarY = 10
    this.topBarH = this.topBarY + this.avatarSize + 8

    // 右上角预留 138px 给抖音系统胶囊；退出按钮紧靠预留区左侧，始终位于战斗页最上方。
    const topActionW = 52
    const topActionH = 28
    const capsuleReserveW = 138
    const topActionRight = w - capsuleReserveW - 8
    this.exitBtnRect = { x: topActionRight - topActionW, y: this.topBarY + 6, w: topActionW, h: topActionH }
    this.speed = 1
    this.speedBtnRect = { x: this.leftPad + this.avatarSize + 12, y: this.topBarY + 6, w: 44, h: topActionH }
    // 金币栏紧邻退出按钮左侧；渲染时会按实际数字宽度微调 coinCx。
    this.coinCx = this.exitBtnRect.x - 10 - 40 - 6 - 10
    this.coinCy = this.exitBtnRect.y + this.exitBtnRect.h / 2

    this.topMargin = this.topBarH + 8
    this.bottomMargin = 0

    const lawnAreaW = w * this.lawnWidthRatio
    const availH = h - this.topMargin - this.bottomMargin
    this.cell = Math.max(1, Math.floor(Math.min(lawnAreaW / this.cols, (availH * 0.72) / this.rows)))

    this.lawnW = this.cell * this.cols
    this.lawnH = this.cell * this.rows
    this.lawnX = Math.floor((lawnAreaW - this.lawnW) / 2) + this.leftPad
    if (this.lawnX + this.lawnW > w) {
      this.cell = Math.max(1, Math.floor((w - this.leftPad) / this.cols))
      this.lawnW = this.cell * this.cols
      this.lawnH = this.cell * this.rows
      this.lawnX = this.leftPad
    }
    this.lawnY = this.topMargin + 4

    // 3 张卡 + 2 个 20px 间隔 + 刷新按钮（0.75 张卡宽）+ 两侧 14px 内边距，始终收在描金卡槽内。
    this.cardW = Math.max(40, Math.min(104, (this.lawnW - 68) / 3.75))
    this.cardH = this.cardW * 1.15
    this.stripY = this.lawnY + this.lawnH + 6
    this.stripH = h - this.stripY

    if (this.cardH > this.stripH - 8) {
      this.cardH = Math.max(40, this.stripH - 8)
      this.cardW = this.cardH / 1.15
    }

    this.imgs = {}
    this.stoneImg = null
    this._stoneReady = false
    this.heroImgs = {}
    this.zyImgs = {}
    this.gyImgs = {}
    this.zfImgs = {}
    this.zglImgs = {}
    this.lbImgs = {}
    this.xbImgs = {}
    this.xbwImgs = {}
    this.dfImgs = {}
    this.dfwImgs = {}
    this.lvbuImgs = {}
    this.lvbuwImgs = {}
    this.gjsImgs = {}
    this.gjswImgs = {}
    this.zjImgs = {}
    this.zjwImgs = {}
    this.dzImgs = {}
    this.dzwImgs = {}
    this.loaded = false
    this.hand = this._drawHand()
    // 金币与武将等级为跨场景共享存档，读档失败/首次进入则使用默认值（含测试初始金币）
    this._loadProgress()
    const requestedLevel = Number(this.params.level || this.game.currentLevel || this.savedLevel || 1)
    this.level = Math.max(1, Math.min(LEVEL_COUNT, Math.floor(requestedLevel) || 1))
    this.game.currentLevel = this.level
    this.battleGold = 120
    this.refreshCount = 0
    this.monsterSpeed = 30 * (1 + 0.05 * (this.level - 1))
    const spawnInterval = Math.max(MONSTER_SPAWN_INTERVAL_MIN, MONSTER_SPAWN_INTERVAL_BASE - MONSTER_SPAWN_INTERVAL_STEP * (this.level - 1))
    this.monsterSpawnInterval = spawnInterval
    this.battleTime = 0
    this.avatarImg = null
    this._loadAvatar()
    this._loadImages()
    this._loadZhaoyunFrames()
    this._loadGuanyuFrames()
    this._loadZhangfeiFrames()
    this._loadZhugeliangFrames()
    this._loadLiubeiFrames()
    this._loadXiaobingFrames()
    this._loadXiaobingWalkFrames()
    this._loadDaofuFrames()
    this._loadDaofuWalkFrames()
    this._loadLvbuFrames()
    this._loadLvbuWalkFrames()
    this._loadGongjianFrames()
    this._loadGongjianWalkFrames()
    this._loadZhangjiaoFrames()
    this._loadZhangjiaoWalkFrames()
    this._loadDongzhuoFrames()
    this._loadDongzhuoWalkFrames()

    this._layoutButtons()

    this.deployed = [] // [{ heroId, r, c }] - same heroId can appear in multiple cells
    this.selectedHero = null
    this.selectedCardIndex = null
    this.pull = null
    this.cardRects = []

    // 拖拽状态：手牌可拖到空格部署；已部署武将可拖到其他格子，hp/level 等属性全程不变
    this._touchStart = null
    this._dragging = false
    this._dragEntry = null
    this._dragCard = null
    this._dragX = 0
    this._dragY = 0
    this._dragHoverR = -1
    this._dragHoverC = -1
    this._dragHoverValid = false

    this.animT = 0
    this.monsters = []
    this.monsterSpawnT = MONSTER_SPAWN_FIRST
    this.monsterIdSeq = 0
    this.monstersSpawned = 0
    this.bossSpawned = false
    this.lastAtkT = {} // key: `${heroId}_${r}_${c}` -> last attack time
    this.fx = [] // [{ x, y, t, dur, kind, text }]
    this.goldPop = 0
    this.projectiles = [] // kind: 'magic'（诸葛亮法球）或 'arrow'（弓箭手箭矢）
    this.projectileIdSeq = 0
    this.pendingHits = [] // [{ t, delay, kind: 'hero'|'monster', heroEntry, monster, target, dmg, resolved }]
    this.gameOver = false
    this.levelCleared = false
    this.retryBtnRect = null
    this.nextLevelBtnRect = null
    this.returnBtnRect = null
  }

  leave() {
    this._resetDragState()
    stopBattleBg()
  }

  // 跨场景共享存档：主页面金币仅保留，战斗页只读写武将等级/碎片和解锁关卡；战斗金币不入存档。
  // 读档失败或首次进入时回退到默认值（含测试初始金币 9999999）
  _loadProgress() {
    let save = null
    if (typeof tt !== 'undefined' && tt.getStorageSync) {
      try { save = tt.getStorageSync('jxsg_td_save') } catch (e) { save = null }
    }
    if (save && save.gold !== undefined && save.heroLevel) {
      this.gold = save.gold
      this.heroLevel = save.heroLevel
    } else {
      this.gold = 9999999
      this.heroLevel = { guanyu: 1, zhangfei: 1, zhaoyun: 1, zhugeliang: 1, liubei: 1 }
    }
    // 碎片来自主页面抽卡（main.js 写入同一存档），旧存档没有该字段时全部默认为 0，向后兼容
    this.heroFragments = (save && save.heroFragments) || { guanyu: 0, zhangfei: 0, zhaoyun: 0, zhugeliang: 0, liubei: 0 }
    this.savedLevel = Math.max(1, Math.min(LEVEL_COUNT, Math.floor(Number(save && save.level) || 1)))
  }

  _saveProgress() {
    if (typeof tt === 'undefined' || !tt.setStorageSync) return
    try {
      tt.setStorageSync('jxsg_td_save', { gold: this.gold, heroLevel: this.heroLevel, heroFragments: this.heroFragments, level: this.savedLevel })
    } catch (e) {}
  }

  // 每次生成三张独立的 1 级手牌；每张都从完整卡池抽取，因此允许出现相同武将。
  _drawHand() {
    const hand = []
    for (let i = 0; i < 3; i++) {
      const heroId = HERO_NAMES[Math.floor(Math.random() * HERO_NAMES.length)]
      hand.push({ heroId, level: 1 })
    }
    return hand
  }

  // 指定卡牌/实例等级下的实际属性：伤害每级 +50%，最大生命每级 +15%。
  _heroDamage(heroId, level = 1) {
    const base = HERO_STATS[heroId]
    let damage = Math.round(base.damage * (1 + HERO_DAMAGE_LEVEL_BONUS * (level - 1)))
    return damage
  }

  _heroEffectiveStats(heroId, level = 1) {
    const base = HERO_STATS[heroId]
    let maxHp = Math.round(base.maxHp * (1 + HERO_HP_LEVEL_BONUS * (level - 1)))
    return {
      maxHp,
      damage: this._heroDamage(heroId, level)
    }
  }

  // 全局武将升级仅保留进度与存档兼容，不再改动已部署实例的等级或属性。
  upgradeHero(heroId) {
    if (!heroId) return
    const level = this.heroLevel[heroId] || 1
    const cost = upgradeCost(level)
    const fragCost = upgradeFragmentCost(level)
    const x = this.game.width / 2
    const y = 0
    if (this.battleGold < cost) {
      this.fx.push({ x, y, t: 0, dur: GACHA_TOAST_DUR, kind: 'dmg', text: '金币不足', color: '#ff6b6b' })
      return
    }
    if ((this.heroFragments[heroId] || 0) < fragCost) {
      this.fx.push({ x, y, t: 0, dur: GACHA_TOAST_DUR, kind: 'dmg', text: '碎片不足', color: '#ff6b6b' })
      return
    }
    this.battleGold -= cost
    this.heroFragments[heroId] -= fragCost
    this.heroLevel[heroId] = level + 1
    this._saveProgress()
  }

  // 返回手牌中第一对同武将、同等级的可合成卡牌。
  _findFusablePair() {
    const counts = {}
    for (let i = 0; i < this.hand.length; i++) {
      const card = this.hand[i]
      const key = `${card.heroId}_${card.level}`
      if (counts[key] !== undefined) {
        return { heroId: card.heroId, level: card.level, indices: [counts[key], i] }
      }
      counts[key] = i
    }
    return null
  }

  fuseHandPair() {
    const pair = this._findFusablePair()
    if (!pair) return
    const { heroId, level, indices } = pair
    const fusedLevel = level + 1
    this.hand.splice(indices[1], 1)
    this.hand.splice(indices[0], 1, { heroId, level: fusedLevel })
    this.selectedHero = null
    this.selectedCardIndex = null
    this.fx.push({
      x: this.lawnX + this.lawnW / 2,
      y: this.lawnY + this.lawnH / 2,
      t: 0,
      dur: 1,
      kind: 'fusion',
      text: `${HERO_CN_NAME[heroId]} 合成! Lv.${fusedLevel}`,
      color: HERO_RARITY_COLOR[heroId] || '#ffd76a'
    })
  }

  _layoutButtons() {
    const pad = 14
    const slotX = this.lawnX
    const slotW = this.lawnW

    const btnSize = this.cardW * 0.75
    this.slotX = slotX
    this.slotW = slotW
    this.cardsGroupX = slotX + pad
    this.refreshBtn = {
      x: slotX + slotW - pad - btnSize,
      y: this.stripY + this.stripH / 2 - btnSize / 2,
      w: btnSize,
      h: btnSize
    }
  }

  // 左上角头像：优先取用户头像（tt.getUserInfo），失败或无授权时回退到关羽立绘
  _loadAvatar() {
    const fallback = () => {
      const img = tt.createImage()
      img.onload = () => { this.avatarImg = img }
      getLocalAssetPath('assets/pvz_heroes/guanyu.png').then(path => { img.src = path })
    }
    if (typeof tt !== 'undefined' && tt.getUserInfo) {
      tt.getUserInfo({
        success: res => {
          const url = res && res.userInfo && res.userInfo.avatarUrl
          if (!url) { fallback(); return }
          const img = tt.createImage()
          img.onload = () => { this.avatarImg = img }
          img.onerror = fallback
          img.src = url
        },
        fail: fallback
      })
    } else {
      fallback()
    }
  }

  // 金币数量千分位格式化，避免依赖 toLocaleString 在小游戏 JS 引擎下的兼容性问题
  _formatGold(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }

  _loadImages() {
    this.stoneImg = tt.createImage()
    this.stoneImg.onload = () => { this._stoneReady = true }
    getLocalAssetPath('assets/pvz_tiles/石头.png').then(path => { this.stoneImg.src = path })

    const list = [
      ['bg', 'assets/pvz_bg.jpg'],
      ['g1', 'assets/pvz_tiles/草地1_鲜绿.png'],
      ['g2', 'assets/pvz_tiles/草地2_深绿.png'],
      ['g3', 'assets/pvz_tiles/草地3_野花.png'],
      ['g4', 'assets/pvz_tiles/草地4_干草.png'],
      ['dirt', 'assets/pvz_tiles/泥土1.png']
    ]
    const heroList = this.hand.map(card => [card.heroId, `assets/pvz_heroes/${card.heroId}.png`])
    const total = list.length + heroList.length
    let loadedCount = 0
    const finish = () => {
      loadedCount++
      if (loadedCount >= total) this.loaded = true
    }
    list.forEach(([key, path]) => {
      const img = tt.createImage()
      img.onload = () => { this.imgs[key] = img; finish() }
      img.onerror = () => { console.error('[Home] 图片加载失败:', key, path); finish() }
      getLocalAssetPath(path).then(localPath => { img.src = localPath })
    })
    heroList.forEach(([key, path]) => {
      const img = tt.createImage()
      img.onload = () => { this.heroImgs[key] = img; finish() }
      img.onerror = () => { console.error('[Home] 武将头像加载失败:', key, path); finish() }
      getLocalAssetPath(path).then(localPath => { img.src = localPath })
    })
  }

  // 刷新时只增量加载新手牌缺少的头像，不影响静态场景的 loaded 状态与战斗渲染。
  _loadHeroImages() {
    const missingHeroIds = [...new Set(this.hand.map(card => card.heroId))]
      .filter(heroId => !this.heroImgs[heroId])
    missingHeroIds.forEach(heroId => {
      const path = `assets/pvz_heroes/${heroId}.png`
      const img = tt.createImage()
      img.onload = () => { this.heroImgs[heroId] = img }
      img.onerror = () => { console.error('[Home] 武将头像加载失败:', heroId, path) }
      getLocalAssetPath(path).then(localPath => { img.src = localPath })
    })
  }

  // 赵云动作帧只加载一次（部署刷新不影响，也无需等待其加载完成才能显示其他内容）
  _loadZhaoyunFrames() {
    if (this._zyLoadStarted) return
    this._zyLoadStarted = true
    ZHAOYUN_FRAMES.forEach((suffix, i) => {
      const key = `zy_${i}`
      const img = tt.createImage()
      img.onload = () => { this.zyImgs[key] = img }
      img.onerror = () => { console.error('[Home] 赵云动作帧加载失败:', key, suffix) }
      getLocalAssetPath(`assets/zhaoyun_anim/赵云_${suffix}.png`).then(path => { img.src = path })
    })
  }

  // 关羽动作帧只加载一次；单帧加载失败时回退到静态头像，避免动画整体不可用
  _loadGuanyuFrames() {
    if (this._gyLoadStarted) return
    this._gyLoadStarted = true
    GUANYU_FRAMES.forEach((suffix, i) => {
      const key = `gy_${i}`
      const img = tt.createImage()
      img.onload = () => { this.gyImgs[key] = img }
      img.onerror = () => {
        console.error('[Home] 关羽动作帧加载失败:', key, suffix)
        this.gyImgs[key] = this.heroImgs.guanyu || null
      }
      getLocalAssetPath(`assets/guanyu_anim/gy_${suffix}.png`).then(path => { img.src = path })
    })
  }

  // 张飞动作帧只加载一次；单帧加载失败时回退到静态头像，避免动画整体不可用
  _loadZhangfeiFrames() {
    if (this._zfLoadStarted) return
    this._zfLoadStarted = true
    ZHANGFEI_FRAMES.forEach((suffix, i) => {
      const key = `zf_${i}`
      const img = tt.createImage()
      img.onload = () => { this.zfImgs[key] = img }
      img.onerror = () => {
        console.error('[Home] 张飞动作帧加载失败:', key, suffix)
        this.zfImgs[key] = this.heroImgs.zhangfei || null
      }
      getLocalAssetPath(`assets/zhangfei_anim/zf_${suffix}.png`).then(path => { img.src = path })
    })
  }

  _loadZhugeliangFrames() {
    if (this._zglLoadStarted) return
    this._zglLoadStarted = true
    for (let i = 0; i < ZHUGELIANG_FRAME_COUNT; i++) {
      const key = `zgl_${i}`
      const suffix = String(i).padStart(2, '0')
      const img = tt.createImage()
      img.onload = () => { this.zglImgs[key] = img }
      img.onerror = () => { console.error('[Home] 诸葛亮动作帧加载失败:', key, suffix) }
      getLocalAssetPath(`assets/zhugeliang_anim/zgl_${suffix}.png`).then(path => { img.src = path })
    }
  }

  // 刘备动作帧只加载一次；单帧加载失败时回退到静态头像，避免动画整体不可用
  _loadLiubeiFrames() {
    if (this._lbLoadStarted) return
    this._lbLoadStarted = true
    LIUBEI_FRAMES.forEach((suffix, i) => {
      const key = `lb_${i}`
      const img = tt.createImage()
      img.onload = () => { this.lbImgs[key] = img }
      img.onerror = () => {
        console.error('[Home] 刘备动作帧加载失败:', key, suffix)
        this.lbImgs[key] = this.heroImgs.liubei || null
      }
      getLocalAssetPath(`assets/liubei_anim/lb_${suffix}.png`).then(path => { img.src = path })
    })
  }

  // 小兵动作帧只加载一次，所有怪物共用同一套动画
  _loadXiaobingFrames() {
    if (this._xbLoadStarted) return
    this._xbLoadStarted = true
    for (let i = 0; i < XIAOBING_FRAME_COUNT; i++) {
      const key = `xb_${i}`
      const suffix = String(i).padStart(2, '0')
      const img = tt.createImage()
      img.onload = () => { this.xbImgs[key] = img }
      img.onerror = () => { console.error('[Home] 小兵动作帧加载失败:', key, suffix) }
      getLocalAssetPath(`assets/xiaobing_anim/xb_${suffix}.png`).then(path => { img.src = path })
    }
  }

  _xiaobingFramesReady() {
    for (let i = 0; i < XIAOBING_FRAME_COUNT; i++) {
      if (!this.xbImgs[`xb_${i}`]) return false
    }
    return true
  }

  // 小兵走路帧只加载一次，所有怪物共用同一套动画
  _loadXiaobingWalkFrames() {
    if (this._xbwLoadStarted) return
    this._xbwLoadStarted = true
    for (let i = 0; i < XIAOBING_WALK_FRAME_COUNT; i++) {
      const key = `xbw_${i}`
      const suffix = String(i).padStart(2, '0')
      const img = tt.createImage()
      img.onload = () => { this.xbwImgs[key] = img }
      img.onerror = () => { console.error('[Home] 小兵走路帧加载失败:', key, suffix) }
      getLocalAssetPath(`assets/xiaobing_walk/xbw_${suffix}.png`).then(path => { img.src = path })
    }
  }

  _xiaobingWalkFramesReady() {
    for (let i = 0; i < XIAOBING_WALK_FRAME_COUNT; i++) {
      if (!this.xbwImgs[`xbw_${i}`]) return false
    }
    return true
  }

  _loadDaofuFrames() {
    if (this._dfLoadStarted) return
    this._dfLoadStarted = true
    DAOFU_FRAMES.forEach((suffix, i) => {
      const key = `df_${i}`
      const img = tt.createImage()
      img.onload = () => { this.dfImgs[key] = img }
      img.onerror = () => { console.error('[Home] 刀斧手动作帧加载失败:', key, suffix) }
      getLocalAssetPath(`assets/daofushou_anim/df_${suffix}.png`).then(path => { img.src = path })
    })
  }

  _daofuFramesReady() {
    return DAOFU_FRAMES.every((_, i) => this.dfImgs[`df_${i}`])
  }

  _loadDaofuWalkFrames() {
    if (this._dfwLoadStarted) return
    this._dfwLoadStarted = true
    DAOFU_WALK_FRAMES.forEach((suffix, i) => {
      const key = `dfw_${i}`
      const img = tt.createImage()
      img.onload = () => { this.dfwImgs[key] = img }
      img.onerror = () => { console.error('[Home] 刀斧手走路帧加载失败:', key, suffix) }
      getLocalAssetPath(`assets/daofushou_walk/dfw_${suffix}.png`).then(path => { img.src = path })
    })
  }

  _daofuWalkFramesReady() {
    return DAOFU_WALK_FRAMES.every((_, i) => this.dfwImgs[`dfw_${i}`])
  }

  _loadLvbuFrames() {
    if (this._lvbuLoadStarted) return
    this._lvbuLoadStarted = true
    LB_FRAMES.forEach((suffix, i) => {
      const key = `lvbu_${i}`
      const img = tt.createImage()
      img.onload = () => { this.lvbuImgs[key] = img }
      img.onerror = () => { console.error('[Home] 吕布动作帧加载失败:', key, suffix) }
      getLocalAssetPath(`assets/lvbu_anim/lb_${suffix}.png`).then(path => { img.src = path })
    })
  }

  _lvbuFramesReady() {
    return LB_FRAMES.every((_, i) => this.lvbuImgs[`lvbu_${i}`])
  }

  _loadLvbuWalkFrames() {
    if (this._lvbuwLoadStarted) return
    this._lvbuwLoadStarted = true
    LB_WALK_FRAMES.forEach((suffix, i) => {
      const key = `lvbuw_${i}`
      const img = tt.createImage()
      img.onload = () => { this.lvbuwImgs[key] = img }
      img.onerror = () => { console.error('[Home] 吕布走路帧加载失败:', key, suffix) }
      getLocalAssetPath(`assets/lvbu_walk/lbw_${suffix}.png`).then(path => { img.src = path })
    })
  }

  _lvbuWalkFramesReady() {
    return LB_WALK_FRAMES.every((_, i) => this.lvbuwImgs[`lvbuw_${i}`])
  }

  _loadGongjianFrames() {
    if (this._gjsLoadStarted) return
    this._gjsLoadStarted = true
    GONGJIAN_FRAMES.forEach((suffix, i) => {
      const key = `gjs_${i}`
      const img = tt.createImage()
      img.onload = () => { this.gjsImgs[key] = img }
      img.onerror = () => { console.error('[Home] 弓箭手动作帧加载失败:', key, suffix) }
      getLocalAssetPath(`assets/gongjianshou_anim/gjs_${suffix}.png`).then(path => { img.src = path })
    })
  }

  _gongjianFramesReady() {
    return GONGJIAN_FRAMES.every((_, i) => this.gjsImgs[`gjs_${i}`])
  }

  _loadGongjianWalkFrames() {
    if (this._gjswLoadStarted) return
    this._gjswLoadStarted = true
    GONGJIAN_WALK_FRAMES.forEach((suffix, i) => {
      const key = `gjsw_${i}`
      const img = tt.createImage()
      img.onload = () => { this.gjswImgs[key] = img }
      img.onerror = () => { console.error('[Home] 弓箭手走路帧加载失败:', key, suffix) }
      getLocalAssetPath(`assets/gongjianshou_walk/gjsw_${suffix}.png`).then(path => { img.src = path })
    })
  }

  _gongjianWalkFramesReady() {
    return GONGJIAN_WALK_FRAMES.every((_, i) => this.gjswImgs[`gjsw_${i}`])
  }

  _loadZhangjiaoFrames() {
    if (this._zjLoadStarted) return
    this._zjLoadStarted = true
    ZJ_FRAMES.forEach((suffix, i) => {
      const key = `zj_${i}`
      const img = tt.createImage()
      img.onload = () => { this.zjImgs[key] = img }
      img.onerror = () => { console.error('[Home] 张角动作帧加载失败:', key, suffix) }
      getLocalAssetPath(`assets/zhangjiao_anim/zj_${suffix}.png`).then(path => { img.src = path })
    })
  }

  _zhangjiaoFramesReady() {
    return ZJ_FRAMES.every((_, i) => this.zjImgs[`zj_${i}`])
  }

  _loadZhangjiaoWalkFrames() {
    if (this._zjwLoadStarted) return
    this._zjwLoadStarted = true
    ZJ_WALK_FRAMES.forEach((suffix, i) => {
      const key = `zjw_${i}`
      const img = tt.createImage()
      img.onload = () => { this.zjwImgs[key] = img }
      img.onerror = () => { console.error('[Home] 张角走路帧加载失败:', key, suffix) }
      getLocalAssetPath(`assets/zhangjiao_walk/zjw_${suffix}.png`).then(path => { img.src = path })
    })
  }

  _zhangjiaoWalkFramesReady() {
    return ZJ_WALK_FRAMES.every((_, i) => this.zjwImgs[`zjw_${i}`])
  }

  _loadDongzhuoFrames() {
    if (this._dzLoadStarted) return
    this._dzLoadStarted = true
    DZ_FRAMES.forEach((suffix, i) => {
      const key = `dz_${i}`
      const img = tt.createImage()
      img.onload = () => { this.dzImgs[key] = img }
      img.onerror = () => { console.error('[Home] 董卓动作帧加载失败:', key, suffix) }
      getLocalAssetPath(`assets/dongzhuo_anim/dz_${suffix}.png`).then(path => { img.src = path })
    })
  }

  _dongzhuoFramesReady() {
    return DZ_FRAMES.every((_, i) => this.dzImgs[`dz_${i}`])
  }

  _loadDongzhuoWalkFrames() {
    if (this._dzwLoadStarted) return
    this._dzwLoadStarted = true
    DZ_WALK_FRAMES.forEach((suffix, i) => {
      const key = `dzw_${i}`
      const img = tt.createImage()
      img.onload = () => { this.dzwImgs[key] = img }
      img.onerror = () => { console.error('[Home] 董卓走路帧加载失败:', key, suffix) }
      getLocalAssetPath(`assets/dongzhuo_walk/dzw_${suffix}.png`).then(path => { img.src = path })
    })
  }

  _dongzhuoWalkFramesReady() {
    return DZ_WALK_FRAMES.every((_, i) => this.dzwImgs[`dzw_${i}`])
  }

  reRollHeroes() {
    this.hand = this._drawHand()
    this._loadHeroImages()
    this._layoutButtons()
    this.selectedHero = null
    this.selectedCardIndex = null
  }

  _refreshCost(n) {
    const ramp = Math.min(n, 4)
    let cost = REFRESH_COST_BASE + 10 * ramp * (ramp + 1) / 2
    if (n > 4) cost += (n - 4) * 50
    return cost
  }

  // 刷新按钮抽卡：费用增量依次为 10、20、30、40，之后每次增加 50 金币；余额足够才重新随机并逐张翻牌。
  startRefreshPull() {
    this._resetDragState()
    if (this.pull) return
    const cost = this._refreshCost(this.refreshCount)
    if (this.battleGold < cost) {
      const x = this.refreshBtn.x + this.refreshBtn.w / 2
      const y = this.refreshBtn.y
      this.fx.push({ x, y, t: 0, dur: GACHA_TOAST_DUR, kind: 'dmg', text: '金币不足', color: '#ff6b6b' })
      return
    }
    this.battleGold -= cost
    this.refreshCount += 1
    this.goldPop = 0.25
    this.reRollHeroes()
    this.pull = { phase: 'flip', t: 0 }
  }

  _easeOutBack(t) {
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  }

  update(dt) {
    const sdt = dt * this.speed
    this.animT = (this.animT || 0) + sdt

    if (this.pull) {
      const p = this.pull
      p.t += dt

      if (p.phase === 'flip') {
        const flipTotal = PULL_FLIP_STAGGER * 2 + PULL_FLIP_DUR
        if (p.t >= flipTotal) {
          p.phase = 'done'
          p.t = 0
        }
      } else if (p.phase === 'done') {
        if (p.t >= PULL_DONE_HOLD) {
          this.pull = null
        }
      }
    }

    if (!this.gameOver && !this.levelCleared) {
      this.battleTime = Math.min(BATTLE_TIME_LIMIT, this.battleTime + sdt)
      this._updateMonsterSpawn(sdt)
      this._updateMonsters(sdt)
      this._updateAttacks(sdt)
      this._updateHeals(sdt)
      this._updatePendingHits(sdt)
      this._updateProjectiles(sdt)
      this._updateFx(sdt)
      this._checkGameOver()
      this._checkLevelCleared()
    }
  }

  _updateMonsterSpawn(dt) {
    // 计时结束即停止出怪；BOSS 关在最后 20 秒生成唯一 BOSS，且它是本关最后一只怪物。
    if (this.battleTime >= BATTLE_TIME_LIMIT) return
    const bossType = this.level === 5 ? 'zhangjiao' : this.level === 10 ? 'dongzhuo' : this.level === 15 ? 'lvbu' : null
    if (bossType && !this.bossSpawned && this.battleTime >= BATTLE_TIME_LIMIT - 20) {
      this._spawnMonster(bossType)
      this.bossSpawned = true
      return
    }
    if (this.bossSpawned) return

    this.monsterSpawnT -= dt
    if (this.monsterSpawnT <= 0) {
      this.monsterSpawnT += this.monsterSpawnInterval
      if (this.monsters.length < MONSTER_MAX_ALIVE) {
        const monsterLevel = this.level
        // 已解锁类型按权重抽取：小兵 : 刀斧手 : 弓箭手 = 2 : 1 : 1
        const typeRoll = Math.random() * (monsterLevel >= 3 ? 4 : monsterLevel >= 2 ? 3 : 2)
        const monsterType = typeRoll < 2 ? 'xiaobing' : typeRoll < 3 ? 'daofu' : 'gongjian'
        this._spawnMonster(monsterType)
      }
    }
  }

  _spawnMonster(monsterType) {
    const monsterLevel = this.level
    const monsterLevelMultiplier = Math.pow(2, monsterLevel - 1)
    let monsterHp = Math.round(6 * monsterLevelMultiplier)
    let monsterDamage = monsterType === 'xiaobing'
      ? monsterLevelMultiplier
      : Math.round(1.5 * monsterLevelMultiplier)
    let walkFrameCount = monsterType === 'xiaobing'
      ? XIAOBING_WALK_FRAME_COUNT
      : monsterType === 'daofu' ? DAOFU_WALK_FRAMES.length : GONGJIAN_WALK_FRAMES.length

    if (monsterType === 'daofu') {
      // 刀斧手血量翻倍（6 → 12 基础值，随关卡翻倍）
      monsterHp = Math.round(12 * monsterLevelMultiplier)
    } else if (monsterType === 'zhangjiao') {
      monsterHp = 40 * monsterLevelMultiplier
      monsterDamage = 4 * monsterLevelMultiplier
      walkFrameCount = ZJ_WALK_FRAMES.length
    } else if (monsterType === 'dongzhuo') {
      monsterHp = 80 * monsterLevelMultiplier
      monsterDamage = 6 * monsterLevelMultiplier
      walkFrameCount = DZ_WALK_FRAMES.length
    } else if (monsterType === 'lvbu') {
      monsterHp = 120 * monsterLevelMultiplier
      monsterDamage = 8 * monsterLevelMultiplier
      walkFrameCount = LB_WALK_FRAMES.length
    }

    this.monsters.push({
      id: this.monsterIdSeq++,
      type: monsterType,
      r: ['zhangjiao', 'dongzhuo', 'lvbu'].includes(monsterType) ? 1 : Math.floor(Math.random() * this.rows),
      x: this.game.width + 40,
      hp: monsterHp,
      maxHp: monsterHp,
      level: monsterLevel,
      speed: this.monsterSpeed,
      damage: monsterDamage,
      hitT: 0,
      state: 'walking',
      dead: false,
      killT: 0,
      attacking: false,
      attackT: 0,
      dmgCd: 0,
      lastAttackT: -Infinity,
      stunT: 0,
      wpid: Math.random() * walkFrameCount
    })
    this.monstersSpawned++
  }

  // 判断怪物当前位置是否进入对已部署武将的停止/攻击范围（同行直线距离，PVZ 式）
  _monsterInHeroRange(m) {
    if (m.type === 'zhangjiao') return this._zhangjiaoAoeTargets(m).length > 0
    if (m.type === 'dongzhuo') return this._bossColumnTargets(m, 1).length > 0
    if (m.type === 'lvbu') return this._bossColumnTargets(m, 1).length > 0
    const range = m.type === 'gongjian' ? RANGED_RANGE_CELLS : MONSTER_RANGE_CELLS
    return this.deployed.some(entry => {
      if (entry.dying) return false
      return this._cellDistToMonster(entry, m) <= range
    })
  }

  // 武将 hp 归零后进入 dying 状态（缩小淡出），播放死亡特效，动画结束后再从部署列表移除
  _killHero(entry) {
    if (entry.dying) return
    entry.dying = true
    entry.killT = HERO_DYING_DUR
    const rect = this._cellRect(entry.r, entry.c)
    const color = HERO_RARITY_COLOR[entry.heroId] || '#ffd76a'
    this.fx.push({ x: rect.x + rect.w / 2, y: rect.y + rect.h * 0.6, t: 0, dur: 0.5, kind: 'heroDeath', color })
  }

  // 打怪掉落金币：从怪物死亡位置飞向顶部金币栏，到达后才结算；掉落量为基础值 * 怪物等级
  _grantMonsterGold(m, x, y) {
    this.fx.push({
      x,
      y,
      tx: this.coinCx,
      ty: this.coinCy,
      t: 0,
      dur: 0.5,
      amount: MONSTER_GOLD_BASE * m.level,
      kind: 'coinFly'
    })
  }

  _updateMonsters(dt) {
    this.deployed.forEach(entry => {
      if (entry.hurtT > 0) entry.hurtT = Math.max(0, entry.hurtT - dt)
      if (entry.dying) entry.killT -= dt
    })
    this.deployed = this.deployed.filter(entry => !(entry.dying && entry.killT <= 0))
    this.monsters.forEach(m => {
      if (m.hitT > 0) m.hitT = Math.max(0, m.hitT - dt)
      if (m.state === 'walking') {
        if (m.stunT > 0) {
          // 眩晕：不能动、不能攻击；若正处于挥击动作中，把起手时刻随 dt 同步后移，
          // 使 (animT - lastAttackT) 保持不变，从而把攻击动作"冻结"在原来的姿态上，
          // 眩晕结束后从冻结处继续播完，而不是从头重播或跳过
          m.stunT = Math.max(0, m.stunT - dt)
          if (m.attacking) m.lastAttackT += dt
          return
        }
        const inAttackRange = this._monsterInHeroRange(m)
        m.attacking = inAttackRange
        if (inAttackRange) {
          if (m.attackT > 0) m.attackT -= dt
          if (m.dmgCd > 0) m.dmgCd -= dt
          // 攻击节奏本身仍以 MONSTER_ATTACK_COOLDOWN 为基础；16 帧新怪需等各自动作播完并经过后摇。
          if (m.dmgCd <= 0 && this.animT - m.lastAttackT >= this._monsterAttackGap(m)) {
            this._monsterAttackHero(m)
            m.dmgCd = MONSTER_ATTACK_COOLDOWN
          }
        } else {
          m.x -= m.speed * dt
        }
      } else if (m.state === 'dying') {
        if (m.attackT > 0) m.attackT -= dt
        m.killT -= dt
        if (m.killT <= 0) m.dead = true
      }
    })
    this.monsters = this.monsters.filter(m => !m.dead)
  }

  _monsterAttackPlayDur(m) {
    if (m.type === 'xiaobing') return XIAOBING_ATTACK_PLAY_DUR
    if (m.type === 'zhangjiao') return ZJ_FRAMES.length / MONSTER_ATTACK_FPS
    if (m.type === 'dongzhuo') return DZ_FRAMES.length / MONSTER_ATTACK_FPS
    if (m.type === 'lvbu') return LB_FRAMES.length / MONSTER_ATTACK_FPS
    const frameCount = m.type === 'gongjian' ? GONGJIAN_FRAMES.length : DAOFU_FRAMES.length
    return frameCount / MONSTER_ATTACK_FPS
  }

  _monsterAttackGap(m) {
    if (m.type === 'xiaobing') return MONSTER_ATTACK_GAP
    return Math.max(MONSTER_ATTACK_COOLDOWN, this._monsterAttackPlayDur(m) + ATTACK_RECOVERY_PAUSE)
  }

  // 近战怪物在动作播完时结算挥击；弓箭手则在动作约 60% 处放箭，伤害延后至箭矢命中。
  _monsterAttackHero(m) {
    if (m.type === 'zhangjiao') {
      const targets = this._zhangjiaoAoeTargets(m)
      if (targets.length === 0) return
      m.lastAttackT = this.animT
      this.pendingHits.push({
        t: 0,
        hitAt: this._monsterAttackPlayDur(m),
        kind: 'zhangjiaoLightning',
        monster: m,
        targets,
        dmg: m.damage,
        resolved: false
      })
      return
    }
    if (m.type === 'dongzhuo' || m.type === 'lvbu') {
      const range = 1
      const targets = this._bossColumnTargets(m, range)
      if (targets.length === 0) return
      m.lastAttackT = this.animT
      this.pendingHits.push({
        t: 0,
        hitAt: this._monsterAttackPlayDur(m),
        kind: m.type === 'dongzhuo' ? 'dongzhuoSwordQi' : 'lvbuSlashWave',
        monster: m,
        targets,
        dmg: m.damage,
        resolved: false
      })
      return
    }
    const target = this._monsterDamageTarget(m)
    if (!target) return
    m.lastAttackT = this.animT
    const ranged = m.type === 'gongjian'
    this.pendingHits.push({
      t: 0,
      hitAt: ranged ? this._monsterAttackPlayDur(m) * RANGED_ATTACK_RELEASE_POINT : this._monsterAttackPlayDur(m),
      kind: ranged ? 'monsterRangedCast' : 'monsterMelee',
      monster: m,
      target,
      dmg: m.damage,
      resolved: false
    })
  }

  // 张角雷击覆盖自身前后相邻行、水平 2 格内的所有武将，并优先命中距离最近的 6 人。
  _zhangjiaoAoeTargets(m) {
    return this.deployed
      .filter(entry => !entry.dying && Math.abs(entry.r - m.r) <= 1)
      .map(entry => {
        return { entry, dist: this._cellDistToMonster(entry, m, false) }
      })
      .filter(candidate => candidate.dist <= ZHANGJIAO_AOE_RANGE_CELLS)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, ZHANGJIAO_AOE_MAX_TARGETS)
      .map(candidate => candidate.entry)
  }

  // 董卓/吕布攻击怪物前方的整列区域：忽略行，只按与怪物的连续水平格距锁定所有武将。
  _bossColumnTargets(m, range) {
    return this.deployed.filter(entry => {
      if (entry.dying) return false
      return this._cellDistToMonster(entry, m, false) <= range
    })
  }

  // 选取怪物停止范围内同行且距离最近的武将作为受击目标；治疗单位刘备也必须可被攻击。
  _monsterDamageTarget(m) {
    const range = m.type === 'gongjian' ? RANGED_RANGE_CELLS : MONSTER_RANGE_CELLS
    let best = null
    let bestDist = Infinity
    this.deployed.forEach(entry => {
      if (entry.dying) return
      const dist = this._cellDistToMonster(entry, m)
      if (dist > range) return
      if (dist < bestDist) {
        bestDist = dist
        best = entry
      }
    })
    return best
  }

  _updateAttacks(dt) {
    const now = this.animT
    this.deployed.forEach(entry => {
      if (entry.dying) return
      // 刘备是治疗单位，不参与对怪物的近战攻击判定，其加血节奏在 _updateHeals 中单独处理
      if (entry.heroId === 'liubei') return
      const key = `${entry.heroId}_${entry.r}_${entry.c}`
      const last = this.lastAtkT[key] || -Infinity
      // 冷却值本身不变（HERO_STATS[heroId].attackCooldown），但下一次攻击还需等上一次攻击动画播完 + 后摇停顿，
      // 两者取较大值，避免攻击动作还没播完/还在后摇就被打断重新开始
      if (now - last < this._attackRequiredGap(entry.heroId)) return

      const range = HERO_STATS[entry.heroId].attackRange
      let target = null
      this.monsters.forEach(m => {
        if (m.state !== 'walking') return
        if (this._cellDistToMonster(entry, m) > range) return
        if (!target || m.x < target.x) target = m
      })

      if (!target) return
      this.lastAtkT[key] = now
      entry.attackAnimT = now
      playAttack()

      if (entry.heroId === 'zhugeliang') {
        // 法球不在起手瞬间生成，也不在动作播到一半的命中点生成，而是等整段施法动画
        // （前摇 -> 挥扇 -> 回收，共 _attackAnimPlayDur('zhugeliang') 秒）完全播放结束后才生成并发射
        this.pendingHits.push({ t: 0, hitAt: this._attackAnimPlayDur('zhugeliang'), kind: 'zhugeliangCast', heroEntry: entry, target, resolved: false })
        return
      }

      target.attacking = true
      target.attackT = ATTACK_ANIM_DUR
      // 近战伤害不在起手瞬间结算，而是等该武将挥砍动作播完（_attackAnimPlayDur，动作结束的一刻）才扣血——
      // 之后的 ATTACK_RECOVERY_PAUSE 只是保持收势姿态的视觉停顿，不再延后伤害
      this.pendingHits.push({ t: 0, hitAt: this._attackAnimPlayDur(entry.heroId), kind: 'heroMelee', heroEntry: entry, target, dmg: entry.damage, resolved: false })
    })
  }

  // 在治疗单位（刘备）的射程内，从所有已部署武将（含自己）中选出血量比例最低者作为治疗目标；
  // 若比例并列则取绝对血量更低者；场上所有人满血则返回 null（不加血、不进入施法）
  _findHealTarget(entry) {
    let best = null
    let bestRatio = Infinity
    let bestHp = Infinity
    this.deployed.forEach(other => {
      if (other.dying) return
      if (other.hp >= other.maxHp) return
      const dr = other.r - entry.r
      const dc = other.c - entry.c
      if (Math.sqrt(dr * dr + dc * dc) > HERO_STATS[entry.heroId].healRange) return
      const ratio = other.hp / other.maxHp
      if (ratio < bestRatio || (ratio === bestRatio && other.hp < bestHp)) {
        bestRatio = ratio
        bestHp = other.hp
        best = other
      }
    })
    return best
  }

  // 判断该治疗单位射程内当前是否存在值得治疗的目标，用于决定是否播放刘备的施法动作循环
  _hasHealTargetInRange(entry) {
    return !!this._findHealTarget(entry)
  }

  // 刘备的加血节奏：与其余武将共用同一套冷却/动作播完+后摇的节拍系统（lastAtkT/_attackRequiredGap），
  // 但目标是射程内血量比例最低的己方武将，且全员满血时不起手、不进入冷却
  _updateHeals(dt) {
    const now = this.animT
    this.deployed.forEach(entry => {
      if (entry.dying) return
      if (entry.heroId !== 'liubei') return
      const key = `${entry.heroId}_${entry.r}_${entry.c}`
      const last = this.lastAtkT[key] || -Infinity
      if (now - last < this._attackRequiredGap(entry.heroId)) return

      const target = this._findHealTarget(entry)
      if (!target) return
      this.lastAtkT[key] = now
      entry.attackAnimT = now

      // 加血同样不在起手瞬间结算，而是等施法动作播完（_attackAnimPlayDur，动作结束的一刻）才回血
      this.pendingHits.push({ t: 0, hitAt: this._attackAnimPlayDur(entry.heroId), kind: 'heroHeal', heroEntry: entry, target, heal: HERO_STATS[entry.heroId].healAmount, resolved: false })
    })
  }

  // 结算所有等待中的命中/施法：近战在挥砍动作播完之前目标不掉血，诸葛亮施法则要等整段动画播完，
  // 到点后统一扣血（近战/怪物，动作结束的一刻，不含后摇视觉停顿）或生成法球（诸葛亮，伤害延后到弹体命中时才结算）
  _updatePendingHits(dt) {
    this.pendingHits.forEach(hit => {
      if (hit.resolved) return
      // 怪物被眩晕期间，其挥击命中判定也一并冻结（与动画帧冻结保持一致），眩晕结束后从冻结处继续计时
      if ((hit.kind === 'monsterMelee' || hit.kind === 'monsterRangedCast' || hit.kind === 'zhangjiaoLightning' || hit.kind === 'dongzhuoSwordQi' || hit.kind === 'lvbuSlashWave') && hit.monster.stunT > 0) return
      hit.t += dt
      if (hit.t >= hit.hitAt) {
        hit.resolved = true
        if (hit.kind === 'heroMelee') {
          this._resolveHeroMeleeHit(hit)
        } else if (hit.kind === 'monsterMelee') {
          this._resolveMonsterMeleeHit(hit)
        } else if (hit.kind === 'monsterRangedCast') {
          this._resolveMonsterRangedCast(hit)
        } else if (hit.kind === 'zhangjiaoLightning') {
          this._resolveZhangjiaoLightningHit(hit)
        } else if (hit.kind === 'dongzhuoSwordQi') {
          this._resolveDongzhuoSwordQiHit(hit)
        } else if (hit.kind === 'lvbuSlashWave') {
          this._resolveLvbuSlashWaveHit(hit)
        } else if (hit.kind === 'zhugeliangCast') {
          this._resolveZhugeliangCast(hit)
        } else if (hit.kind === 'heroHeal') {
          this._resolveHeroHeal(hit)
        }
      }
    })
    this.pendingHits = this.pendingHits.filter(hit => !hit.resolved)
  }

  // 刘备施法动作播完后才回血：施法者、目标此时都仍需在场上，目标仍在射程内且仍是伤兵才生效，
  // 否则视为治疗落空（目标已脱离射程/阵亡/已被其他来源治满），不做任何回血
  _resolveHeroHeal(hit) {
    const entry = hit.heroEntry
    const target = hit.target
    if (this.deployed.indexOf(entry) === -1 || entry.dying) return
    if (!target || target.dying || this.deployed.indexOf(target) === -1) return
    if (target.hp >= target.maxHp) return
    const dr = target.r - entry.r
    const dc = target.c - entry.c
    if (Math.sqrt(dr * dr + dc * dc) > HERO_STATS[entry.heroId].healRange) return
    target.hp = Math.min(target.maxHp, target.hp + hit.heal)
    const rect = this._cellRect(target.r, target.c)
    // 简单绿色浮空 "+N" 文字提示回血，复用现有 dmg 浮字特效，通过 f.color 覆盖默认红色
    this.fx.push({ x: rect.x + rect.w / 2, y: rect.y + rect.h * 0.3, t: 0, dur: DMG_TEXT_DUR, kind: 'dmg', text: `+${hit.heal}`, color: '#4caf50' })
    // 治疗特效：记录目标 entry 引用而非静态坐标，绘制时按 entry.r/entry.c 实时取格，避免被拖拽移动后特效错位
    this.fx.push({ entry: target, t: 0, dur: 0.5, kind: 'heal' })
  }

  // 武将挥砍命中：目标此时仍存活行进中才结算，避免动画播放期间目标已被其他来源击杀而重复处理
  _resolveHeroMeleeHit(hit) {
    const target = hit.target
    if (!target || target.dead || target.state !== 'walking') return
    target.hp -= hit.dmg
    target.hitT = HIT_FLASH_DUR
    const fxY = this.lawnY + hit.heroEntry.r * this.cell + this.cell * 0.5
    this.fx.push({ x: target.x, y: fxY, t: 0, dur: 0.25, kind: 'slash' })
    this.fx.push({ x: target.x, y: fxY, t: 0, dur: DMG_TEXT_DUR, kind: 'dmg', text: `-${hit.dmg}` })
    // 张飞每次命中有 STUN_PROC_CHANCE（10%）概率使目标眩晕 STUN_DURATION 秒：不能动、不能攻击，
    // 头顶叠加眩晕特效（见 _renderMonsters 中 m.stunT 的渲染分支）
    if (target.hp > 0 && hit.heroEntry.heroId === 'zhangfei' && Math.random() < STUN_PROC_CHANCE) {
      target.stunT = STUN_DURATION
    }
    if (target.hp <= 0) {
      target.state = 'dying'
      target.killT = DYING_DUR
      this._grantMonsterGold(target, target.x, fxY)
    }
  }

  // 怪物挥砍命中：目标武将此时仍部署在场上才结算
  _resolveMonsterMeleeHit(hit) {
    const target = hit.target
    if (!target || target.dying || this.deployed.indexOf(target) === -1) return
    target.hp -= hit.dmg
    playHit()
    target.hurtT = 0.25
    const rect = this._cellRect(target.r, target.c)
    this.fx.push({ x: rect.x + rect.w / 2, y: rect.y + rect.h * 0.5, t: 0, dur: 0.25, kind: 'slash', color: '#ff4d4d' })
    this.fx.push({ x: rect.x + rect.w / 2, y: rect.y + rect.h * 0.3, t: 0, dur: DMG_TEXT_DUR, kind: 'dmg', text: `-${hit.dmg}` })
    if (target.hp <= 0) {
      this._killHero(target)
    }
  }

  // 张角雷击命中：一次结算起手时锁定的所有仍在场目标，音效只播放一次。
  _resolveZhangjiaoLightningHit(hit) {
    let hitAny = false
    hit.targets.forEach(target => {
      if (!target || target.dying || this.deployed.indexOf(target) === -1) return
      target.hp -= hit.dmg
      target.hurtT = 0.25
      hitAny = true
      const rect = this._cellRect(target.r, target.c)
      this.fx.push({
        x: rect.x + rect.w / 2,
        y: rect.y + rect.h * 0.5,
        t: 0,
        dur: 0.3,
        kind: 'lightning',
        seed: Math.random()
      })
      this.fx.push({ x: rect.x + rect.w / 2, y: rect.y + rect.h * 0.3, t: 0, dur: DMG_TEXT_DUR, kind: 'dmg', text: `-${hit.dmg}` })
      if (target.hp <= 0) this._killHero(target)
    })
    if (hitAny) playHit()
  }

  // 董卓剑气命中：整列目标同时受伤，剑气特效只生成一次并覆盖草坪全部行。
  _resolveDongzhuoSwordQiHit(hit) {
    let hitAny = false
    hit.targets.forEach(target => {
      if (!target || target.dying || this.deployed.indexOf(target) === -1) return
      target.hp -= hit.dmg
      target.hurtT = 0.25
      hitAny = true
      const rect = this._cellRect(target.r, target.c)
      this.fx.push({ x: rect.x + rect.w / 2, y: rect.y + rect.h * 0.3, t: 0, dur: DMG_TEXT_DUR, kind: 'dmg', text: `-${hit.dmg}` })
      if (target.hp <= 0) this._killHero(target)
    })
    if (hitAny) {
      this.fx.push({ x: hit.monster.x - this.cell * 0.5, y: this.lawnY + this.lawnH / 2, t: 0, dur: 0.35, kind: 'swordQi' })
      playHit()
    }
  }

  // 吕布剑浪命中：覆盖怪物前方两格的所有行，伤害与浮字逐目标结算。
  _resolveLvbuSlashWaveHit(hit) {
    let hitAny = false
    hit.targets.forEach(target => {
      if (!target || target.dying || this.deployed.indexOf(target) === -1) return
      target.hp -= hit.dmg
      target.hurtT = 0.25
      hitAny = true
      const rect = this._cellRect(target.r, target.c)
      this.fx.push({ x: rect.x + rect.w / 2, y: rect.y + rect.h * 0.3, t: 0, dur: DMG_TEXT_DUR, kind: 'dmg', text: `-${hit.dmg}` })
      if (target.hp <= 0) this._killHero(target)
    })
    if (hitAny) {
      this.fx.push({ x: hit.monster.x - this.cell, y: this.lawnY + this.lawnH / 2, t: 0, dur: 0.35, kind: 'slashWave' })
      playHit()
    }
  }

  // 弓箭手放箭时再次确认双方仍存活且目标仍在同一行射程内；失去目标时本次射击落空。
  _resolveMonsterRangedCast(hit) {
    const m = hit.monster
    const target = hit.target
    if (!m || m.dead || m.state !== 'walking' || m.type !== 'gongjian') return
    if (!target || target.dying || this.deployed.indexOf(target) === -1) return
    if (this._cellDistToMonster(target, m) > RANGED_RANGE_CELLS) return
    const targetRect = this._cellRect(target.r, target.c)
    this.projectiles.push({
      id: this.projectileIdSeq++,
      kind: 'arrow',
      x: m.x - this.cell * 0.16,
      y: this.lawnY + m.r * this.cell + this.cell * 0.48,
      target,
      speed: PROJECTILE_SPEED,
      t: 0,
      monster: m,
      dmg: hit.dmg,
      angle: Math.atan2(targetRect.y + targetRect.h / 2 - (this.lawnY + m.r * this.cell + this.cell * 0.48), targetRect.x + targetRect.w / 2 - m.x)
    })
  }

  // 诸葛亮整段施法动画（_attackAnimPlayDur('zhugeliang')，前摇->挥扇->回收全部播完）结束后才生成法球并发射，
  // 目标此时仍存活行进中才发射；伤害仍在 _updateProjectiles 中弹体命中目标那一刻结算，不受此处影响
  _resolveZhugeliangCast(hit) {
    const entry = hit.heroEntry
    const target = hit.target
    if (!target || target.dead || target.state !== 'walking') return
    if (this.deployed.indexOf(entry) === -1) return
    const rect = this._cellRect(entry.r, entry.c)
    this.projectiles.push({
      id: this.projectileIdSeq++,
      kind: 'magic',
      x: rect.x + rect.w / 2,
      y: rect.y + rect.h / 2,
      target,
      speed: PROJECTILE_SPEED,
      t: 0,
      heroId: entry.heroId,
      heroEntry: entry,
      dmg: entry.damage
    })
  }

  // 统一更新诸葛亮法球和弓箭手箭矢；箭矢不改锁，原目标死亡后直接消失。
  _updateProjectiles(dt) {
    if (this.projectiles.length > PROJECTILE_MAX_ALIVE) {
      this.projectiles = this.projectiles.slice(this.projectiles.length - PROJECTILE_MAX_ALIVE)
    }
    this.projectiles.forEach(p => {
      if (p.dead) return
      if (p.kind === 'arrow') {
        this._updateArrowProjectile(p, dt)
        return
      }
      if (!p.target || p.target.dead || p.target.state !== 'walking') {
        p.target = this._retargetProjectile(p)
      }
      if (!p.target) { p.dead = true; return }
      const cell = this.cell
      const targetY = this.lawnY + p.target.r * cell + cell * 0.5
      const dx = p.target.x - p.x
      const dy = targetY - p.y
      const dist = Math.hypot(dx, dy)
      p.px = p.x
      p.py = p.y
      if (dist < PROJECTILE_HIT_DIST) {
        p.target.hp -= p.dmg
        p.target.hurtT = 0.25
        p.target.hitT = HIT_FLASH_DUR
        this.fx.push({ x: p.target.x, y: targetY, t: 0, dur: DMG_TEXT_DUR, kind: 'dmg', text: `-${p.dmg}` })
        this.fx.push({ x: p.target.x, y: targetY, t: 0, dur: 0.35, kind: 'magicHit' })
        if (p.target.hp <= 0) {
          p.target.state = 'dying'
          p.target.killT = DYING_DUR
          this._grantMonsterGold(p.target, p.target.x, targetY)
        }
        p.dead = true
        return
      }
      const nx = dx / dist
      const ny = dy / dist
      p.x += nx * p.speed * dt
      p.y += ny * p.speed * dt
    })
    this.projectiles = this.projectiles.filter(p => !p.dead)
  }

  _updateArrowProjectile(p, dt) {
    const target = p.target
    if (!target || target.dying || this.deployed.indexOf(target) === -1) {
      p.dead = true
      return
    }
    const rect = this._cellRect(target.r, target.c)
    const targetX = rect.x + rect.w / 2
    const targetY = rect.y + rect.h / 2
    const dx = targetX - p.x
    const dy = targetY - p.y
    const dist = Math.hypot(dx, dy)
    p.px = p.x
    p.py = p.y
    p.angle = Math.atan2(dy, dx)
    if (dist < PROJECTILE_HIT_DIST) {
      target.hp -= p.dmg
      playHit()
      target.hurtT = 0.25
      this.fx.push({ x: targetX, y: targetY - this.cell * 0.2, t: 0, dur: DMG_TEXT_DUR, kind: 'dmg', text: `-${p.dmg}` })
      this.fx.push({ x: targetX, y: targetY, t: 0, dur: 0.2, kind: 'slash', color: '#d8b06a' })
      if (target.hp <= 0) this._killHero(target)
      p.dead = true
      return
    }
    p.x += (dx / dist) * p.speed * dt
    p.y += (dy / dist) * p.speed * dt
  }

  // 目标死亡时，尝试在武将射程内改锁最近的存活怪物（同行直线距离），否则弹体消失
  _retargetProjectile(p) {
    const entry = p.heroEntry
    if (!entry || entry.dying) return null
    const range = HERO_STATS[entry.heroId].attackRange
    let best = null
    let bestDist = Infinity
    this.monsters.forEach(m => {
      if (m.state !== 'walking') return
      if (this._cellDistToMonster(entry, m) > range) return
      const d = Math.abs(m.x - p.x)
      if (d < bestDist) { bestDist = d; best = m }
    })
    return best
  }

  _updateFx(dt) {
    if (this.goldPop > 0) this.goldPop = Math.max(0, this.goldPop - dt)
    this.fx.forEach(f => {
      f.t += dt
      if (f.kind === 'coinFly' && f.t >= f.dur && !f.collected) {
        f.collected = true
        this.battleGold += f.amount
        this.goldPop = 0.25
      }
    })
    this.fx = this.fx.filter(f => f.t < f.dur)
  }

  _checkGameOver() {
    const threshold = this.lawnX + this.cell * 0.3
    if (this.monsters.some(m => m.state === 'walking' && m.x < threshold)) {
      this.gameOver = true
    }
  }

  _checkLevelCleared() {
    if (this.gameOver || this.levelCleared) return
    if (this.battleTime < BATTLE_TIME_LIMIT) return
    if (this.monsters.some(m => !m.dead && m.state !== 'dying')) return
    this.levelCleared = true
    this.savedLevel = Math.max(this.savedLevel, Math.min(this.level + 1, LEVEL_COUNT))
    this._saveProgress()
  }

  render(ctx) {
    const w = this.game.width
    const h = this.game.height

    ctx.fillStyle = '#0d1117'
    ctx.fillRect(0, 0, w, h)

    if (this.loaded && this.imgs.bg) {
      ctx.drawImage(this.imgs.bg, 0, 0, w, h)
    }

    this._renderLawn(ctx)
    this._renderTopBar(ctx)
    this._renderBattleProgress(ctx)
    this._renderDeployedHeroes(ctx)
    this._renderMonsters(ctx)
    this._renderProjectiles(ctx)
    this._renderFx(ctx)
    this._renderCardSlot(ctx)
    this._renderHeroRow(ctx)
    this._renderRefreshButton(ctx)
    this._renderPullEffect(ctx)
    this._renderDragGhost(ctx)
    this._renderGameOver(ctx)
    this._renderLevelCleared(ctx)
  }

  // 卡片槽位边框：底部卡组 + 刷新按钮的深色描金容器
  _renderCardSlot(ctx) {
    const slotX = this.slotX
    const slotY = this.stripY + 2
    const slotW = this.slotW
    const slotH = this.stripH - 4

    ctx.fillStyle = 'rgba(10,12,18,0.72)'
    this._roundRect(ctx, slotX, slotY, slotW, slotH, 14)
    ctx.fill()

    ctx.strokeStyle = '#c9a227'
    ctx.lineWidth = 3
    this._roundRect(ctx, slotX, slotY, slotW, slotH, 14)
    ctx.stroke()
  }

  _renderLawn(ctx) {
    const { lawnX, lawnY, cell, rows, cols } = this

    // 草坪右缘到屏幕右缘是怪物出生/行走区：重复铺泥土地，图片缺失时回退为纯棕色。
    const dirtX = lawnX + this.lawnW
    const dirtRight = this.game.width
    ctx.fillStyle = '#77502f'
    ctx.fillRect(dirtX, lawnY, Math.max(0, dirtRight - dirtX), this.lawnH)
    if (this.imgs.dirt) {
      for (let dy = lawnY; dy < lawnY + this.lawnH; dy += cell) {
        for (let dx = dirtX; dx < dirtRight; dx += cell) {
          const dw = Math.min(cell, dirtRight - dx)
          const dh = Math.min(cell, lawnY + this.lawnH - dy)
          ctx.drawImage(this.imgs.dirt, 0, 0, 1024 * dw / cell, 1024 * dh / cell, dx, dy, dw, dh)
        }
      }
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const dx = lawnX + c * cell
        const dy = lawnY + r * cell
        const useFirst = (r + c) % 2 === 0
        if (this.loaded) {
          const img = useFirst ? this.imgs.g1 : this.imgs.g2
          ctx.drawImage(img, 0, 0, 1024, 1024, dx, dy, cell, cell)
        } else {
          ctx.fillStyle = useFirst ? '#4caf50' : '#3d8b40'
          ctx.fillRect(dx, dy, cell, cell)
        }
        if (c === 0) this._renderStoneCell(ctx, r)
      }
    }

    const grad = ctx.createLinearGradient(lawnX, 0, lawnX + this.lawnW, 0)
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(1, 'rgba(0,0,0,0.15)')
    ctx.fillStyle = grad
    ctx.fillRect(lawnX, lawnY, this.lawnW, this.lawnH)

    ctx.save()
    ctx.strokeStyle = 'rgba(94, 72, 46, 0.85)'
    ctx.lineWidth = 4
    this._roundRect(ctx, lawnX - 2, lawnY - 2, this.lawnW + 4, this.lawnH + 4, 8)
    ctx.stroke()
    ctx.restore()
  }

  // 最左列为不可部署的石柱装饰；素材加载完成前使用 Canvas 石块占位。
  _renderStoneCell(ctx, r) {
    const rect = this._cellRect(r, 0)
    const { x, y, w, h } = rect

    if (this._stoneReady && this.stoneImg) {
      // 石头图片底部贴地，宽度占格子的 90%。
      const sw = w * 0.9
      const sh = sw * (this.stoneImg.height / this.stoneImg.width)
      ctx.drawImage(this.stoneImg, x + (w - sw) / 2, y + h - sh, sw, sh)
      return
    }

    ctx.save()

    // 石块落在地面上的柔和阴影。
    ctx.fillStyle = 'rgba(40,32,24,0.3)'
    ctx.beginPath()
    ctx.ellipse(x + w * 0.5, y + h * 0.86, w * 0.38, h * 0.09, 0, 0, Math.PI * 2)
    ctx.fill()

    // 略不规则的圆润岩石主体。
    const body = ctx.createLinearGradient(0, y + h * 0.12, 0, y + h * 0.88)
    body.addColorStop(0, '#8a8378')
    body.addColorStop(1, '#6b6559')
    ctx.beginPath()
    ctx.moveTo(x + w * 0.2, y + h * 0.82)
    ctx.bezierCurveTo(x + w * 0.1, y + h * 0.68, x + w * 0.12, y + h * 0.38, x + w * 0.25, y + h * 0.2)
    ctx.bezierCurveTo(x + w * 0.37, y + h * 0.08, x + w * 0.66, y + h * 0.1, x + w * 0.78, y + h * 0.22)
    ctx.bezierCurveTo(x + w * 0.9, y + h * 0.38, x + w * 0.91, y + h * 0.68, x + w * 0.79, y + h * 0.82)
    ctx.bezierCurveTo(x + w * 0.65, y + h * 0.91, x + w * 0.35, y + h * 0.91, x + w * 0.2, y + h * 0.82)
    ctx.closePath()
    ctx.fillStyle = body
    ctx.fill()
    ctx.strokeStyle = '#4a4038'
    ctx.lineWidth = Math.max(2, w * 0.035)
    ctx.lineJoin = 'round'
    ctx.stroke()

    // 简单切面让石块保持扁平卡通感，同时有清楚的体积层次。
    ctx.fillStyle = 'rgba(68,62,54,0.42)'
    ctx.beginPath()
    ctx.moveTo(x + w * 0.22, y + h * 0.59)
    ctx.lineTo(x + w * 0.4, y + h * 0.48)
    ctx.lineTo(x + w * 0.37, y + h * 0.8)
    ctx.lineTo(x + w * 0.24, y + h * 0.76)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = 'rgba(61,56,49,0.34)'
    ctx.beginPath()
    ctx.moveTo(x + w * 0.58, y + h * 0.25)
    ctx.lineTo(x + w * 0.77, y + h * 0.34)
    ctx.lineTo(x + w * 0.72, y + h * 0.62)
    ctx.lineTo(x + w * 0.53, y + h * 0.52)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = '#b5aea2'
    ctx.beginPath()
    ctx.ellipse(x + w * 0.34, y + h * 0.3, w * 0.1, h * 0.055, -0.35, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }

  // 草坪上方居中的 60 秒守关进度条，不遮挡顶部状态栏、部署网格或底部卡槽。
  _renderBattleProgress(ctx) {
    const progress = Math.min(1, this.battleTime / BATTLE_TIME_LIMIT)
    const barW = Math.min(240, this.lawnW * 0.48)
    const barH = 8
    const barX = this.lawnX + (this.lawnW - barW) / 2
    const barY = this.lawnY - barH - 3

    ctx.fillStyle = 'rgba(20, 14, 5, 0.72)'
    this._roundRect(ctx, barX, barY, barW, barH, barH / 2)
    ctx.fill()

    const fillW = barW * progress
    if (fillW > 0) {
      ctx.fillStyle = '#f2c14e'
      this._roundRect(ctx, barX, barY, fillW, barH, Math.min(barH / 2, fillW / 2))
      ctx.fill()
    }
  }

  // 顶部状态栏：头像留在左上角，金币栏紧邻右上角退出按钮左侧。
  _renderTopBar(ctx) {
    const avatarSize = this.avatarSize
    const cx = this.leftPad + avatarSize / 2
    const cy = this.topBarY + avatarSize / 2

    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, avatarSize / 2, 0, Math.PI * 2)
    ctx.closePath()
    ctx.clip()
    if (this.avatarImg) {
      ctx.drawImage(this.avatarImg, cx - avatarSize / 2, cy - avatarSize / 2, avatarSize, avatarSize)
    } else {
      ctx.fillStyle = '#2b2f3a'
      ctx.fillRect(cx - avatarSize / 2, cy - avatarSize / 2, avatarSize, avatarSize)
    }
    ctx.restore()

    ctx.beginPath()
    ctx.arc(cx, cy, avatarSize / 2, 0, Math.PI * 2)
    ctx.strokeStyle = '#c9a227'
    ctx.lineWidth = 3
    ctx.stroke()

    const coinR = 10
    const goldText = this._formatGold(this.battleGold)
    const goldTextRight = this.exitBtnRect.x - 10
    ctx.font = 'bold 16px sans-serif'
    this.coinCx = goldTextRight - ctx.measureText(goldText).width - 6 - coinR
    this.coinCy = this.exitBtnRect.y + this.exitBtnRect.h / 2
    const coinCx = this.coinCx
    const coinCy = this.coinCy

    const coinGrad = ctx.createRadialGradient(coinCx - 3, coinCy - 3, 1, coinCx, coinCy, coinR)
    coinGrad.addColorStop(0, '#fff3c4')
    coinGrad.addColorStop(1, '#e0a72c')
    ctx.beginPath()
    ctx.arc(coinCx, coinCy, coinR, 0, Math.PI * 2)
    ctx.fillStyle = coinGrad
    ctx.fill()
    ctx.strokeStyle = '#8a6412'
    ctx.lineWidth = 2
    ctx.stroke()

    const popProgress = this.goldPop > 0 ? this.goldPop / 0.25 : 0
    const goldScale = 1 + popProgress * 0.18
    ctx.save()
    ctx.translate(goldTextRight, coinCy)
    ctx.scale(goldScale, goldScale)
    ctx.font = 'bold 16px sans-serif'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillText(goldText, 1, 1)
    ctx.fillStyle = this.goldPop > 0 ? '#fff4a3' : '#fff8dc'
    ctx.fillText(goldText, 0, 0)
    ctx.restore()

    this._renderTopActionButton(ctx, this.speedBtnRect, `x${this.speed}`, '#f2c14e')
    this._renderTopActionButton(ctx, this.exitBtnRect, '退出')
  }

  // 战斗页顶部操作按钮沿用大厅的深色底、金色描边风格。
  _renderTopActionButton(ctx, rect, label, textColor = '#fff3c4') {
    ctx.fillStyle = 'rgba(28, 22, 14, 0.88)'
    this._roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 9)
    ctx.fill()
    ctx.strokeStyle = '#c9a227'
    ctx.lineWidth = 2
    this._roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 9)
    ctx.stroke()
    ctx.fillStyle = textColor
    ctx.font = 'bold 14px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2)
  }

  _cellRect(r, c) {
    return {
      x: this.lawnX + c * this.cell,
      y: this.lawnY + r * this.cell,
      w: this.cell,
      h: this.cell
    }
  }

  // 怪物当前所处的格子列号（用于按格计算射程距离）
  _monsterCol(m) {
    return Math.floor((m.x - this.lawnX) / this.cell)
  }

  // 武将格子 (entry.r, entry.c) 与怪物之间的直线攻击距离（PVZ 式同行直线判定）：
  // 只有当怪物与武将处于同一行时才计算水平格子距离，否则视为不可达（返回 Infinity），
  // 攻击永远不会跨行命中。距离按连续像素换算为格数（而非取整列号之差），
  // 这样 0.5/0.7 这类小于 1 格的射程才能真正生效
  _cellDistToMonster(entry, m, sameRowOnly = true) {
    if (sameRowOnly && m.r !== entry.r) return Infinity
    const heroCenterX = this.lawnX + entry.c * this.cell + this.cell / 2
    return Math.abs(m.x - heroCenterX) / this.cell
  }

  // 在草坪格子上绘制已部署的武将小人（含品质色地面标记）
  _renderDeployedHeroes(ctx) {
    // 下面格子的人物图层需盖在上面格子之上，按行列排序后再绘制（不修改 this.deployed 本身的插入顺序）
    const sorted = this.deployed.slice().sort((a, b) => a.r - b.r || a.c - b.c)
    sorted.forEach(entry => {
      const { heroId, r, c } = entry
      if (entry.maxHp === undefined) {
        const level = entry.level || 1
        const stats = this._heroEffectiveStats(heroId, level)
        entry.hp = stats.maxHp
        entry.maxHp = stats.maxHp
        entry.damage = stats.damage
        entry.level = level
      }
      if (entry.hurtT === undefined) entry.hurtT = 0
      const rect = this._cellRect(r, c)
      const img = this.heroImgs[heroId]
      const color = HERO_RARITY_COLOR[heroId] || '#e8c96a'

      const groundCx = rect.x + rect.w / 2
      const groundCy = rect.y + rect.h * 0.92
      const dying = !!entry.dying
      const killScale = dying ? Math.max(0, entry.killT / HERO_DYING_DUR) : 1

      ctx.save()
      ctx.globalAlpha = killScale
      if (dying) {
        ctx.translate(groundCx, groundCy)
        ctx.scale(killScale, killScale)
        ctx.translate(-groundCx, -groundCy)
      }

      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.ellipse(groundCx, groundCy, rect.w * 0.32, rect.h * 0.12, 0, 0, Math.PI * 2)
      ctx.stroke()

      let flashInfo = null
      if (heroId === 'zhaoyun' && this._zhaoyunFrameReady() && (this._hasTargetInRange(entry) || this._inAttackAnim(entry)) && !dying) {
        flashInfo = this._renderZhaoyunFrame(ctx, entry, rect)
      } else if (heroId === 'guanyu' && this._guanyuFrameReady() && (this._hasTargetInRange(entry) || this._inAttackAnim(entry)) && !dying) {
        flashInfo = this._renderGuanyuFrame(ctx, entry, rect)
      } else if (heroId === 'zhangfei' && this._zhangfeiFrameReady() && (this._hasTargetInRange(entry) || this._inAttackAnim(entry)) && !dying) {
        flashInfo = this._renderZhangfeiFrame(ctx, entry, rect)
      } else if (heroId === 'zhugeliang' && this._zhugeliangFramesReady() && (this._hasTargetInRange(entry) || this._inAttackAnim(entry)) && !dying) {
        flashInfo = this._renderZhugeliangFrame(ctx, entry, rect)
      } else if (heroId === 'liubei' && this._liubeiFramesReady() && (this._hasHealTargetInRange(entry) || this._inAttackAnim(entry)) && !dying) {
        flashInfo = this._renderLiubeiFrame(ctx, entry, rect)
      } else if (this.loaded && img) {
        let targetH = rect.h * 1.2
        let scale = targetH / img.height
        let dw = img.width * scale
        let dh = targetH
        if (dw > rect.w * 1.2) {
          scale = (rect.w * 1.2) / img.width
          dw = rect.w * 1.2
          dh = img.height * scale
        }
        const dx = rect.x + (rect.w - dw) / 2
        const phase = r * 0.7 + c * 1.1
        // 后摇停顿期间（挥击动作播完 -> ATTACK_RECOVERY_PAUSE 期间）保持静止收势姿态，
        // 不参与待机摇摆，避免刚打完立刻又开始晃动显得像连续动作
        const inRecovery = !dying && this._isInAttackRecovery(entry)
        let dy = (dying || inRecovery) ? rect.y - rect.h * 0.15 : rect.y - rect.h * 0.15 + Math.sin((this.animT || 0) * 3.6 + phase) * 2
        if (dy < 2) dy = 2
        const rot = (dying || inRecovery) ? 0 : Math.sin((this.animT || 0) * 1.8 + phase) * 0.05
        // 无独立攻击帧的武将（刘备）：起手到命中点向右前扑，命中点后收回，做出简单的挥击动作
        const lunge = dying ? 0 : this._meleeLungeOffset(entry)
        const footX = dx + dw / 2 + lunge
        const footY = dy + dh
        ctx.save()
        ctx.translate(footX, footY)
        ctx.rotate(rot)
        ctx.drawImage(img, -dw / 2, dy - footY, dw, dh)
        ctx.restore()
        flashInfo = { img, dx: dx + lunge, dy, dw, dh }
      }

      if (entry.hurtT > 0 && flashInfo) {
        const flashAlpha = Math.min(0.6, (entry.hurtT / 0.25) * 0.6)
        this._drawSilhouetteFlash(ctx, flashInfo.img, flashInfo.dx, flashInfo.dy, flashInfo.dw, flashInfo.dh, '#ff2d2d', flashAlpha)
      }

      ctx.restore()

      if (!dying) this._renderHeroStats(ctx, entry, rect)
    })
  }

  // 在武将头顶绘制血条与等级
  _renderHeroStats(ctx, entry, rect) {
    const cell = this.cell
    const portraitTop = rect.y - rect.h * 0.15
    const barW = cell * 0.7
    const barH = 6
    const cx = rect.x + rect.w / 2
    const barX = cx - barW / 2
    const barY = portraitTop - 3

    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(barX, barY, barW, barH)
    ctx.fillStyle = hpBarColor(entry.hp, entry.maxHp)
    ctx.fillRect(barX, barY, barW * Math.max(0, entry.hp / entry.maxHp), barH)

    const lvY = barY - 10
    ctx.font = `bold ${Math.round(cell * 0.16)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(0,0,0,0.7)'
    ctx.fillText(`Lv.${entry.level}`, cx + 1, lvY + 1)
    ctx.fillStyle = '#ffe066'
    ctx.fillText(`Lv.${entry.level}`, cx, lvY)
  }

  _zhaoyunFrameReady() {
    return ZHAOYUN_FRAMES.every((_, i) => !!this.zyImgs[`zy_${i}`])
  }

  // 判断该武将攻击范围内是否有存活的行进中怪物，用于决定是否播放赵云的攻击帧循环
  _hasTargetInRange(entry) {
    const range = HERO_STATS[entry.heroId].attackRange
    return this.monsters.some(m => m.state === 'walking' && this._cellDistToMonster(entry, m) <= range)
  }

  // 该武将攻击动作单轮播完所需时长：帧数 / HERO_STATS[heroId].animFps，攻速越快帧率越高、播得越快，
  // 命中/回血也随之提前——有独立动作帧的武将按各自帧数计算，其余（无独立帧的兜底）用统一的挥击动画时长
  _attackAnimPlayDur(heroId) {
    const fps = HERO_STATS[heroId] ? HERO_STATS[heroId].animFps : null
    if (!fps) return ATTACK_ANIM_DUR
    if (heroId === 'zhaoyun') return ZHAOYUN_FRAMES.length / fps
    if (heroId === 'guanyu') return GUANYU_FRAMES.length / fps
    if (heroId === 'zhangfei') return ZHANGFEI_FRAMES.length / fps
    if (heroId === 'zhugeliang') return ZHUGELIANG_FRAME_COUNT / fps
    if (heroId === 'liubei') return LIUBEI_FRAMES.length / fps
    return ATTACK_ANIM_DUR
  }

  // 两次攻击之间的最小间隔：取"该武将自身攻击冷却"与"攻击动画播完 + 后摇停顿"两者中较大值，
  // 不改变 HERO_STATS[heroId].attackCooldown 本身，只在动作+后摇更长时顺延下一次攻击的触发时机
  _attackRequiredGap(heroId) {
    return Math.max(HERO_STATS[heroId].attackCooldown, this._attackAnimPlayDur(heroId) + ATTACK_RECOVERY_PAUSE)
  }

  // 当前是否正处于攻击动画播放窗口内（从触发时刻起算，动作播完即结束，不含后摇）。
  // 用于目标死亡/脱离射程时仍把当前这轮攻击动画播完，避免挥到一半被硬切回待机。
  _inAttackAnim(entry) {
    const last = this._entryAttackAnimStart(entry)
    if (last === null) return false
    const elapsed = (this.animT || 0) - last
    return elapsed >= 0 && elapsed < this._attackAnimPlayDur(entry.heroId)
  }

  // 判断该武将当前是否处于"攻击动作已播完、正在后摇停顿"的窗口内，用于让无独立动作帧的武将
  // （如刘备）在后摇阶段保持静止收势姿态，而不是立刻恢复待机摇摆
  _isInAttackRecovery(entry) {
    const last = this._entryAttackAnimStart(entry)
    if (last === null) return false
    const elapsed = (this.animT || 0) - last
    const playDur = this._attackAnimPlayDur(entry.heroId)
    return elapsed >= playDur && elapsed < playDur + ATTACK_RECOVERY_PAUSE
  }

  // 有独立动作帧的攻击动画的帧序号：以部署实例记录的本次攻击触发时刻为起点单次播放一轮，
  // 播完（含后摇停顿期间）后停留在最后一帧（收势姿态），不再从头循环，直到下一次攻击真正触发
  _attackFrameIndex(entry, frameCount, fps) {
    const last = this._entryAttackAnimStart(entry)
    if (last === null) return 0
    const elapsed = (this.animT || 0) - last
    if (elapsed < 0) return 0
    const playDur = frameCount / fps
    if (elapsed < playDur) return Math.floor(elapsed * fps)
    return frameCount - 1
  }

  // 无独立攻击帧的武将（刘备）挥击位移：起手到命中点（ATTACK_HIT_POINT）向目标方向前扑，
  // 命中点后收回，位移峰值正好落在命中点上，让"打实"的一刻有明显的挥砍/突刺感
  _meleeLungeOffset(entry) {
    const last = this._entryAttackAnimStart(entry)
    if (last === null) return 0
    const dt = (this.animT || 0) - last
    if (dt < 0 || dt >= ATTACK_ANIM_DUR) return 0
    const hitP = ATTACK_HIT_POINT / ATTACK_ANIM_DUR
    const p = dt / ATTACK_ANIM_DUR
    const amt = p < hitP ? p / hitP : 1 - (p - hitP) / (1 - hitP)
    return amt * this.cell * 0.16
  }

  // 动作时间跟随部署实例，避免合成/拖动后仅按格子键查找而丢失攻击帧状态；
  // lastAtkT 仍只负责原有攻击冷却与伤害节奏。
  _entryAttackAnimStart(entry) {
    if (Number.isFinite(entry.attackAnimT)) return entry.attackAnimT
    const key = `${entry.heroId}_${entry.r}_${entry.c}`
    const last = this.lastAtkT[key]
    return Number.isFinite(last) ? last : null
  }

  // 返回绘制信息（图片 + 目标矩形），供命中闪光按角色轮廓裁剪使用
  _renderZhaoyunFrame(ctx, entry, rect) {
    // 单次播完攻击帧循环后停在最后一帧（后摇收势），不再无间断循环，见 _attackFrameIndex
    const frameIdx = this._attackFrameIndex(entry, ZHAOYUN_FRAMES.length, HERO_STATS.zhaoyun.animFps)
    const img = this.zyImgs[`zy_${frameIdx}`]
    if (!img) return null

    let targetH = rect.h * 1.2
    const scale = targetH / img.height
    const dw = img.width * scale
    const dh = targetH
    const dx = rect.x + (rect.w - dw) / 2
    const dy = rect.y + rect.h * 0.05 - rect.h * 0.12
    ctx.drawImage(img, dx, dy, dw, dh)
    return { img, dx, dy, dw, dh }
  }

  _guanyuFrameReady() {
    return GUANYU_FRAMES.every((_, i) => !!this.gyImgs[`gy_${i}`])
  }

  // 返回绘制信息（图片 + 目标矩形），供命中闪光按角色轮廓裁剪使用；entry.r/entry.c 实时读取，拖拽换格后自动跟随新位置
  _renderGuanyuFrame(ctx, entry, rect) {
    // 单次播完攻击帧循环后停在最后一帧（后摇收势），不再无间断循环，见 _attackFrameIndex
    const frameIdx = this._attackFrameIndex(entry, GUANYU_FRAMES.length, HERO_STATS.guanyu.animFps)
    const img = this.gyImgs[`gy_${frameIdx}`]
    if (!img) return null

    const targetH = rect.h * 1.2
    const scale = targetH / img.height
    const dw = img.width * scale
    const dh = targetH
    const dx = rect.x + (rect.w - dw) / 2
    const dy = rect.y + rect.h * 0.05 - rect.h * 0.12
    ctx.drawImage(img, dx, dy, dw, dh)
    return { img, dx, dy, dw, dh }
  }

  _zhangfeiFrameReady() {
    return ZHANGFEI_FRAMES.every((_, i) => !!this.zfImgs[`zf_${i}`])
  }

  // 返回绘制信息（图片 + 目标矩形），供命中闪光按角色轮廓裁剪使用；entry.r/entry.c 实时读取，拖拽换格后自动跟随新位置
  _renderZhangfeiFrame(ctx, entry, rect) {
    // 单次播完攻击帧循环后停在最后一帧（后摇收势），不再无间断循环，见 _attackFrameIndex
    const frameIdx = this._attackFrameIndex(entry, ZHANGFEI_FRAMES.length, HERO_STATS.zhangfei.animFps)
    const img = this.zfImgs[`zf_${frameIdx}`]
    if (!img) return null

    const targetH = rect.h * 1.2
    const scale = targetH / img.height
    const dw = img.width * scale
    const dh = targetH
    const dx = rect.x + (rect.w - dw) / 2
    const dy = rect.y + rect.h * 0.05 - rect.h * 0.12
    ctx.drawImage(img, dx, dy, dw, dh)
    return { img, dx, dy, dw, dh }
  }

  _liubeiFramesReady() {
    return LIUBEI_FRAMES.every((_, i) => !!this.lbImgs[`lb_${i}`])
  }

  // 返回绘制信息（图片 + 目标矩形），供命中闪光按角色轮廓裁剪使用；刘备的"攻击帧"实为举剑施法（治疗）动作
  _renderLiubeiFrame(ctx, entry, rect) {
    // 单次播完施法帧循环后停在最后一帧（后摇收势），不再无间断循环，见 _attackFrameIndex
    const frameIdx = this._attackFrameIndex(entry, LIUBEI_FRAMES.length, HERO_STATS.liubei.animFps)
    const img = this.lbImgs[`lb_${frameIdx}`]
    if (!img) return null

    const targetH = rect.h * 1.2
    const scale = targetH / img.height
    const dw = img.width * scale
    const dh = targetH
    const dx = rect.x + (rect.w - dw) / 2
    const dy = rect.y + rect.h * 0.05 - rect.h * 0.12
    ctx.drawImage(img, dx, dy, dw, dh)
    return { img, dx, dy, dw, dh }
  }

  _zhugeliangFramesReady() {
    for (let i = 0; i < ZHUGELIANG_FRAME_COUNT; i++) {
      if (!this.zglImgs[`zgl_${i}`]) return false
    }
    return true
  }

  // 返回绘制信息（图片 + 目标矩形），供命中闪光按角色轮廓裁剪使用
  _renderZhugeliangFrame(ctx, entry, rect) {
    // 单次播完施法帧循环后停在最后一帧（后摇收势），不再无间断循环，见 _attackFrameIndex
    const frameIdx = this._attackFrameIndex(entry, ZHUGELIANG_FRAME_COUNT, HERO_STATS.zhugeliang.animFps)
    const img = this.zglImgs[`zgl_${frameIdx}`]
    if (!img) return null

    const targetH = rect.h * 1.2
    const scale = targetH / img.height
    const dw = img.width * scale
    const dh = targetH
    const dx = rect.x + (rect.w - dw) / 2
    const dy = rect.y + rect.h * 0.05 - rect.h * 0.12
    ctx.drawImage(img, dx, dy, dw, dh)
    return { img, dx, dy, dw, dh }
  }

  // 离屏缓冲画布（复用，避免每帧新建），用于命中闪光的轮廓裁剪合成
  _getFlashCanvas(w, h) {
    if (!this._flashCanvas) {
      this._flashCanvas = tt.createCanvas()
    }
    const c = this._flashCanvas
    if (c.width !== w || c.height !== h) {
      c.width = w
      c.height = h
    }
    return c
  }

  // 命中闪光裁剪到角色实际轮廓（透明通道）内绘制，而不是整张矩形立绘图片，
  // 避免玩家看到立绘矩形边框、暴露"其实是张平面图片"
  _drawSilhouetteFlash(ctx, img, dx, dy, dw, dh, color, alpha) {
    if (!img || dw <= 0 || dh <= 0 || alpha <= 0) return
    const w = Math.max(1, Math.round(dw))
    const h = Math.max(1, Math.round(dh))
    const off = this._getFlashCanvas(w, h)
    const octx = off.getContext('2d')
    octx.clearRect(0, 0, w, h)
    octx.drawImage(img, 0, 0, w, h)
    octx.globalCompositeOperation = 'source-atop'
    octx.fillStyle = color
    octx.fillRect(0, 0, w, h)
    octx.globalCompositeOperation = 'source-over'

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.drawImage(off, dx, dy, dw, dh)
    ctx.restore()
  }

  _renderMonsters(ctx) {
    const cell = this.cell
    const xiaobingAttackReady = this._xiaobingFramesReady()
    const xiaobingWalkReady = this._xiaobingWalkFramesReady()
    const daofuAttackReady = this._daofuFramesReady()
    const daofuWalkReady = this._daofuWalkFramesReady()
    const gongjianAttackReady = this._gongjianFramesReady()
    const gongjianWalkReady = this._gongjianWalkFramesReady()
    const zhangjiaoAttackReady = this._zhangjiaoFramesReady()
    const zhangjiaoWalkReady = this._zhangjiaoWalkFramesReady()
    const dongzhuoAttackReady = this._dongzhuoFramesReady()
    const dongzhuoWalkReady = this._dongzhuoWalkFramesReady()
    const lvbuAttackReady = this._lvbuFramesReady()
    const lvbuWalkReady = this._lvbuWalkFramesReady()
    this.monsters.forEach(m => {
      const cellTop = this.lawnY + m.r * cell
      const cy = cellTop + cell * 0.5
      const scale = m.state === 'dying' ? Math.max(0, m.killT / DYING_DUR) : 1

      let spriteTop = cy - cell * 0.35

      const type = m.type || 'xiaobing'
      let attackFramesReady = xiaobingAttackReady
      let walkFramesReady = xiaobingWalkReady
      let attackFrameCount = XIAOBING_FRAME_COUNT
      let walkFrameCount = XIAOBING_WALK_FRAME_COUNT
      let attackFps = XIAOBING_ATTACK_FPS
      let attackImgs = this.xbImgs
      let walkImgs = this.xbwImgs
      let attackPrefix = 'xb'
      let walkPrefix = 'xbw'
      let attackFlip = false
      let walkFlip = false
      if (type === 'daofu') {
        attackFramesReady = daofuAttackReady
        walkFramesReady = daofuWalkReady
        attackFrameCount = DAOFU_FRAMES.length
        walkFrameCount = DAOFU_WALK_FRAMES.length
        attackFps = MONSTER_ATTACK_FPS
        attackImgs = this.dfImgs
        walkImgs = this.dfwImgs
        attackPrefix = 'df'
        walkPrefix = 'dfw'
        attackFlip = false
        walkFlip = false
      } else if (type === 'gongjian') {
        attackFramesReady = gongjianAttackReady
        walkFramesReady = gongjianWalkReady
        attackFrameCount = GONGJIAN_FRAMES.length
        walkFrameCount = GONGJIAN_WALK_FRAMES.length
        attackFps = MONSTER_ATTACK_FPS
        attackImgs = this.gjsImgs
        walkImgs = this.gjswImgs
        attackPrefix = 'gjs'
        walkPrefix = 'gjsw'
        attackFlip = false
        walkFlip = false
      } else if (type === 'zhangjiao') {
        attackFramesReady = zhangjiaoAttackReady
        walkFramesReady = zhangjiaoWalkReady
        attackFrameCount = ZJ_FRAMES.length
        walkFrameCount = ZJ_WALK_FRAMES.length
        attackFps = MONSTER_ATTACK_FPS
        attackImgs = this.zjImgs
        walkImgs = this.zjwImgs
        attackPrefix = 'zj'
        walkPrefix = 'zjw'
        attackFlip = false
        walkFlip = false
      } else if (type === 'dongzhuo') {
        attackFramesReady = dongzhuoAttackReady
        walkFramesReady = dongzhuoWalkReady
        attackFrameCount = DZ_FRAMES.length
        walkFrameCount = DZ_WALK_FRAMES.length
        attackFps = MONSTER_ATTACK_FPS
        attackImgs = this.dzImgs
        walkImgs = this.dzwImgs
        attackPrefix = 'dz'
        walkPrefix = 'dzw'
        attackFlip = false
        walkFlip = false
      } else if (type === 'lvbu') {
        attackFramesReady = lvbuAttackReady
        walkFramesReady = lvbuWalkReady
        attackFrameCount = LB_FRAMES.length
        walkFrameCount = LB_WALK_FRAMES.length
        attackFps = MONSTER_ATTACK_FPS
        attackImgs = this.lvbuImgs
        walkImgs = this.lvbuwImgs
        attackPrefix = 'lvbu'
        walkPrefix = 'lvbuw'
        attackFlip = true
        walkFlip = true
      }

      const useAttack = m.attacking && attackFramesReady
      const useWalk = !useAttack && walkFramesReady
      let img = null
      let flip = false
      if (useAttack) {
        // 以本次攻击触发时刻为起点单次播完，随后停在最后一帧等待后摇结束。
        const elapsed = (this.animT || 0) - m.lastAttackT
        const playDur = attackFrameCount / attackFps
        const frameIdx = (elapsed >= 0 && elapsed < playDur)
          ? Math.floor(elapsed * attackFps)
          : attackFrameCount - 1
        img = attackImgs[`${attackPrefix}_${frameIdx}`]
        flip = attackFlip
      } else if (useWalk) {
        // 眩晕期间不再推进走路循环帧（避免站定不动却还在"跑腿"），停在被眩晕那一刻的姿态上
        const frameIdx = m.stunT > 0
          ? Math.floor(m.wpid) % walkFrameCount
          : Math.floor((this.animT || 0) * 8 + m.wpid) % walkFrameCount
        img = walkImgs[`${walkPrefix}_${frameIdx}`]
        flip = walkFlip
      }

      if (img) {
        const bossScale = (m.type === 'zhangjiao' || m.type === 'dongzhuo' || m.type === 'lvbu') ? 2 : 1
        const targetH = cell * 1.0 * bossScale
        let dscale = targetH / img.height
        let dw = img.width * dscale
        let dh = targetH
        if (dw > cell * 1.1 * bossScale) {
          dscale = (cell * 1.1 * bossScale) / img.width
          dw = cell * 1.1 * bossScale
          dh = img.height * dscale
        }
        const dx = m.x - dw / 2
        const dy = cellTop + cell - dh + 2
        spriteTop = dy

        ctx.save()
        ctx.translate(m.x, dy + dh / 2)
        ctx.scale(scale, scale)
        ctx.translate(-m.x, -(dy + dh / 2))

        if (flip) {
          ctx.save()
          ctx.translate(m.x, 0)
          ctx.scale(-1, 1)
          ctx.drawImage(img, -dw / 2, dy, dw, dh)
          ctx.restore()
        } else {
          ctx.drawImage(img, dx, dy, dw, dh)
        }

        if (m.hitT > 0) {
          if (flip) {
            ctx.save()
            ctx.translate(m.x, 0)
            ctx.scale(-1, 1)
            this._drawSilhouetteFlash(ctx, img, -dw / 2, dy, dw, dh, '#ffffff', 0.55)
            ctx.restore()
          } else {
            this._drawSilhouetteFlash(ctx, img, dx, dy, dw, dh, '#ffffff', 0.55)
          }
        }

        ctx.restore()
      } else {
        const radius = cell * 0.35
        ctx.save()
        ctx.translate(m.x, cy)
        ctx.scale(scale, scale)

        ctx.fillStyle = m.hitT > 0 ? '#ffffff' : '#7a1f1f'
        ctx.strokeStyle = '#4a0f0f'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(0, 0, radius, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()

        ctx.fillStyle = '#ffffff'
        ctx.font = `bold ${Math.round(cell * 0.4)}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('怪', 0, 2)
        ctx.restore()
      }

      if (m.state === 'walking') {
        const barW = cell * 0.7
        const barH = 5
        const bx = m.x - barW / 2
        const by = spriteTop - 12
        ctx.fillStyle = 'rgba(0,0,0,0.5)'
        ctx.fillRect(bx, by, barW, barH)
        ctx.fillStyle = hpBarColor(m.hp, m.maxHp)
        ctx.fillRect(bx, by, barW * Math.max(0, m.hp / m.maxHp), barH)

        const lvY = by - 12
        ctx.font = `bold ${Math.round(cell * 0.16)}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = 'rgba(0,0,0,0.7)'
        ctx.fillText(`Lv.${m.level}`, m.x + 1, lvY + 1)
        ctx.fillStyle = '#ffe066'
        ctx.fillText(`Lv.${m.level}`, m.x, lvY)

        if (m.stunT > 0) this._renderStunFx(ctx, m.x, by - 16)
      }
    })
  }

  // 眩晕特效：头顶绘制若干围绕中心旋转的黄色小星星（纯 canvas 绘制，不依赖任何图片资源）
  _renderStunFx(ctx, cx, cy) {
    const t = this.animT || 0
    const r = this.cell * 0.16
    const starCount = 3
    ctx.save()
    for (let i = 0; i < starCount; i++) {
      const ang = t * 4 + (Math.PI * 2 * i) / starCount
      const sx = cx + Math.cos(ang) * r
      const sy = cy + Math.sin(ang) * r * 0.5
      this._drawStar(ctx, sx, sy, this.cell * 0.07, '#ffe066')
    }
    ctx.restore()
  }

  // 绘制单颗五角星（用于眩晕特效）
  _drawStar(ctx, cx, cy, size, color) {
    ctx.save()
    ctx.fillStyle = color
    ctx.beginPath()
    for (let i = 0; i < 5; i++) {
      const outerAng = (Math.PI * 2 * i) / 5 - Math.PI / 2
      const innerAng = outerAng + Math.PI / 5
      const ox = cx + Math.cos(outerAng) * size
      const oy = cy + Math.sin(outerAng) * size
      const ix = cx + Math.cos(innerAng) * size * 0.45
      const iy = cy + Math.sin(innerAng) * size * 0.45
      if (i === 0) ctx.moveTo(ox, oy)
      else ctx.lineTo(ox, oy)
      ctx.lineTo(ix, iy)
    }
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  // 箭矢画成带箭头和尾羽的短木杆；诸葛亮法球保留原有发光弹体与拖尾。
  _renderProjectiles(ctx) {
    const r = Math.max(3, this.cell * 0.16)
    this.projectiles.forEach(p => {
      if (p.kind === 'arrow') {
        this._renderArrowProjectile(ctx, p)
        return
      }
      if (p.px !== undefined) {
        ctx.save()
        ctx.globalAlpha = 0.35
        ctx.strokeStyle = '#4fc3f7'
        ctx.lineWidth = r * 0.7
        ctx.beginPath()
        ctx.moveTo(p.px, p.py)
        ctx.lineTo(p.x, p.y)
        ctx.stroke()
        ctx.restore()
      }
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r)
      grad.addColorStop(0, '#d8f3ff')
      grad.addColorStop(1, '#4fc3f7')
      ctx.save()
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    })
  }

  _renderArrowProjectile(ctx, p) {
    const len = this.cell * 0.38
    const head = Math.max(4, this.cell * 0.07)
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.angle || Math.PI)
    ctx.strokeStyle = '#6d421f'
    ctx.lineWidth = Math.max(2, this.cell * 0.035)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(-len / 2, 0)
    ctx.lineTo(len / 2, 0)
    ctx.stroke()
    ctx.fillStyle = '#d9d2bd'
    ctx.beginPath()
    ctx.moveTo(len / 2 + head, 0)
    ctx.lineTo(len / 2 - head * 0.35, -head * 0.55)
    ctx.lineTo(len / 2 - head * 0.35, head * 0.55)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = '#b53a32'
    ctx.lineWidth = Math.max(1, this.cell * 0.025)
    ctx.beginPath()
    ctx.moveTo(-len / 2, 0)
    ctx.lineTo(-len / 2 + head, -head * 0.65)
    ctx.moveTo(-len / 2, 0)
    ctx.lineTo(-len / 2 + head, head * 0.65)
    ctx.stroke()
    ctx.restore()
  }

  _renderFx(ctx) {
    this.fx.forEach(f => {
      const progress = f.t / f.dur
      const alpha = Math.max(0, 1 - progress)
      if (f.kind === 'slash') {
        ctx.save()
        ctx.globalAlpha = alpha
        ctx.strokeStyle = f.color || '#ffe9a8'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(f.x, f.y, this.cell * 0.3, -Math.PI * 0.3, Math.PI * 0.3)
        ctx.stroke()
        ctx.restore()
      } else if (f.kind === 'swordQi') {
        const height = this.lawnH * (0.9 + progress * 0.1)
        const bend = this.cell * 0.25
        ctx.save()
        ctx.globalAlpha = alpha
        ctx.lineCap = 'round'
        ctx.shadowColor = '#8ff5ff'
        ctx.shadowBlur = this.cell * 0.2
        ctx.strokeStyle = '#8ff5ff'
        ctx.lineWidth = Math.max(6, this.cell * 0.1) * (1 - progress * 0.5)
        ctx.beginPath()
        ctx.moveTo(f.x - bend, f.y + height / 2)
        ctx.quadraticCurveTo(f.x + bend, f.y, f.x - bend * 0.35, f.y - height / 2)
        ctx.stroke()
        ctx.shadowBlur = 0
        ctx.strokeStyle = '#fffde7'
        ctx.lineWidth = Math.max(2, this.cell * 0.035)
        ctx.stroke()
        ctx.restore()
      } else if (f.kind === 'slashWave') {
        const height = this.lawnH * (0.92 + progress * 0.08)
        ctx.save()
        ctx.globalAlpha = alpha
        ctx.lineCap = 'round'
        ctx.shadowColor = '#ffd76a'
        ctx.shadowBlur = this.cell * 0.24
        ;[-0.45, 0.45].forEach((offset, i) => {
          const x = f.x + offset * this.cell
          const bend = (i === 0 ? 1 : -1) * this.cell * 0.28
          ctx.strokeStyle = '#ffd76a'
          ctx.lineWidth = Math.max(7, this.cell * 0.11) * (1 - progress * 0.5)
          ctx.beginPath()
          ctx.moveTo(x - bend, f.y + height / 2)
          ctx.quadraticCurveTo(x + bend, f.y, x - bend * 0.25, f.y - height / 2)
          ctx.stroke()
          ctx.shadowBlur = 0
          ctx.strokeStyle = '#fffdf2'
          ctx.lineWidth = Math.max(2, this.cell * 0.035)
          ctx.stroke()
          ctx.shadowBlur = this.cell * 0.24
        })
        ctx.restore()
      } else if (f.kind === 'lightning') {
        const points = []
        let seed = Math.floor(f.seed * 0x7fffffff) || 1
        const random = () => {
          seed = (seed * 48271) % 0x7fffffff
          return seed / 0x7fffffff
        }
        const pointCount = 5 + Math.floor(random() * 3)
        for (let i = 0; i < pointCount; i++) {
          points.push({
            x: f.x + (i === 0 || i === pointCount - 1 ? 0 : (random() * 2 - 1) * this.cell * 0.15),
            y: f.y - this.cell * 1.2 + (this.cell * 1.2 * i) / (pointCount - 1)
          })
        }
        const drawBolt = () => {
          ctx.beginPath()
          ctx.moveTo(points[0].x, points[0].y)
          for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y)
          ctx.stroke()
        }
        ctx.save()
        ctx.globalAlpha = alpha
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.strokeStyle = '#4fc3f7'
        ctx.lineWidth = 3
        ctx.shadowColor = '#4fc3f7'
        ctx.shadowBlur = this.cell * 0.18
        drawBolt()
        ctx.shadowBlur = 0
        ctx.strokeStyle = '#aef3ff'
        ctx.lineWidth = 2.5
        drawBolt()
        ctx.strokeStyle = '#e8fbff'
        ctx.lineWidth = 2
        drawBolt()
        ctx.restore()
      } else if (f.kind === 'coinFly') {
        const coinProgress = Math.min(1, progress)
        const coinX = f.x + (f.tx - f.x) * coinProgress
        const coinY = f.y + (f.ty - f.y) * coinProgress - Math.sin(coinProgress * Math.PI) * 40
        const coinR = 9
        const coinGrad = ctx.createRadialGradient(coinX - 3, coinY - 3, 1, coinX, coinY, coinR)
        coinGrad.addColorStop(0, '#fff3c4')
        coinGrad.addColorStop(1, '#e0a72c')
        ctx.save()
        ctx.beginPath()
        ctx.arc(coinX, coinY, coinR, 0, Math.PI * 2)
        ctx.fillStyle = coinGrad
        ctx.fill()
        ctx.strokeStyle = '#8a6412'
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.restore()
      } else if (f.kind === 'dmg') {
        ctx.save()
        ctx.globalAlpha = alpha
        ctx.fillStyle = f.color || '#ff6b6b'
        ctx.font = `bold ${Math.round(this.cell * 0.3)}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(f.text, f.x, f.y - 14 - progress * 16)
        ctx.restore()
      } else if (f.kind === 'fusion') {
        ctx.save()
        const radius = this.cell * (0.35 + progress * 1.2)
        const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, radius)
        grad.addColorStop(0, `rgba(255,245,180,${alpha * 0.9})`)
        grad.addColorStop(0.45, `rgba(255,199,64,${alpha * 0.55})`)
        grad.addColorStop(1, 'rgba(255,180,0,0)')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(f.x, f.y, radius, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = alpha
        ctx.fillStyle = f.color || '#ffd76a'
        ctx.font = `bold ${Math.round(this.cell * 0.38)}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(f.text, f.x, f.y - progress * this.cell * 0.4)
        ctx.restore()
      } else if (f.kind === 'magicHit') {
        ctx.save()
        for (let ring = 0; ring < 3; ring++) {
          const ringP = Math.min(1, Math.max(0, progress - ring * 0.2))
          ctx.globalAlpha = Math.max(0, 1 - ringP) * 0.75
          ctx.strokeStyle = ring % 2 === 0 ? '#6fc3ff' : '#b06fff'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(f.x, f.y, this.cell * (0.08 + ringP * 0.3), 0, Math.PI * 2)
          ctx.stroke()
        }
        ctx.restore()
      } else if (f.kind === 'heroDeath') {
        ctx.save()
        ctx.strokeStyle = f.color || '#ffd76a'
        ctx.lineWidth = 2
        for (let ring = 0; ring < 3; ring++) {
          const ringP = Math.min(1, Math.max(0, progress - ring * 0.15))
          ctx.globalAlpha = Math.max(0, 1 - ringP) * 0.8
          ctx.beginPath()
          ctx.arc(f.x, f.y, this.cell * (0.15 + ringP * 0.45), 0, Math.PI * 2)
          ctx.stroke()
        }
        ctx.fillStyle = f.color || '#ffd76a'
        for (let p = 0; p < 3; p++) {
          const ang = (Math.PI * 2 * p) / 3 - Math.PI / 2
          const dist = this.cell * 0.5 * progress
          ctx.globalAlpha = alpha
          ctx.beginPath()
          ctx.arc(f.x + Math.cos(ang) * dist, f.y + Math.sin(ang) * dist, 3, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
      } else if (f.kind === 'heal') {
        const rect = this._cellRect(f.entry.r, f.entry.c)
        const cx = rect.x + rect.w / 2
        const cy = rect.y + rect.h * 0.55
        ctx.save()
        // 柔和绿色光晕闪现
        ctx.globalAlpha = alpha * 0.5
        ctx.fillStyle = '#4caf50'
        ctx.beginPath()
        ctx.arc(cx, cy, this.cell * 0.5 * (0.6 + progress * 0.4), 0, Math.PI * 2)
        ctx.fill()
        // 上升的绿色十字
        const crossY = cy - progress * this.cell * 0.5
        const crossSize = this.cell * 0.18
        ctx.globalAlpha = alpha
        ctx.strokeStyle = '#7cffa0'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(cx - crossSize, crossY)
        ctx.lineTo(cx + crossSize, crossY)
        ctx.moveTo(cx, crossY - crossSize)
        ctx.lineTo(cx, crossY + crossSize)
        ctx.stroke()
        // 环绕上升的绿色光点
        ctx.fillStyle = '#a8ffc0'
        for (let p = 0; p < 4; p++) {
          const ang = (Math.PI * 2 * p) / 4 + progress * Math.PI
          const dist = this.cell * 0.35 * progress
          ctx.globalAlpha = alpha * 0.8
          ctx.beginPath()
          ctx.arc(cx + Math.cos(ang) * dist, cy - progress * this.cell * 0.4 + Math.sin(ang) * dist * 0.3, 2.5, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
      }
    })
  }

  _renderGameOver(ctx) {
    if (!this.gameOver) return
    const w = this.game.width
    const h = this.game.height

    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(0, 0, w, h)

    ctx.fillStyle = '#e74c3c'
    ctx.font = 'bold 54px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('失败', w / 2, h / 2 - 54)

    ctx.fillStyle = '#cccccc'
    ctx.font = '22px sans-serif'
    ctx.fillText('小怪入侵成功', w / 2, h / 2 - 4)

    const btnW = Math.min(190, (w - 60) / 2)
    const btnH = 56
    const gap = 18
    const btnY = h / 2 + 38
    const startX = w / 2 - btnW - gap / 2
    this.retryBtnRect = { x: startX, y: btnY, w: btnW, h: btnH }
    this.returnBtnRect = { x: w / 2 + gap / 2, y: btnY, w: btnW, h: btnH }
    this._renderOverlayButton(ctx, this.retryBtnRect, '重试本关')
    this._renderOverlayButton(ctx, this.returnBtnRect, '返回主页面')
  }

  _renderLevelCleared(ctx) {
    if (!this.levelCleared) return
    const w = this.game.width
    const h = this.game.height
    ctx.fillStyle = 'rgba(0,0,0,0.65)'
    ctx.fillRect(0, 0, w, h)

    ctx.fillStyle = '#ffd76a'
    ctx.font = 'bold 48px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(this.level === LEVEL_COUNT ? '全部通关!' : '第' + this.level + '关通过!', w / 2, h / 2 - 48)

    const btnW = Math.min(190, (w - 60) / 2)
    const btnH = 56
    const gap = 18
    const btnY = h / 2 + 30
    if (this.level < LEVEL_COUNT) {
      this.nextLevelBtnRect = { x: w / 2 - btnW - gap / 2, y: btnY, w: btnW, h: btnH }
      this.returnBtnRect = { x: w / 2 + gap / 2, y: btnY, w: btnW, h: btnH }
      this._renderOverlayButton(ctx, this.nextLevelBtnRect, '下一关')
    } else {
      this.nextLevelBtnRect = null
      this.returnBtnRect = { x: w / 2 - btnW / 2, y: btnY, w: btnW, h: btnH }
    }
    this._renderOverlayButton(ctx, this.returnBtnRect, '返回主页面')
  }

  _renderOverlayButton(ctx, rect, text) {
    ctx.fillStyle = '#c9a227'
    this._roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 10)
    ctx.fill()
    ctx.strokeStyle = '#fff3c4'
    ctx.lineWidth = 2
    this._roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 10)
    ctx.stroke()
    ctx.fillStyle = '#2b1d0a'
    ctx.font = 'bold 22px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1)
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  }

  // 绘制一张炉石风格武将卡：厚边框 + 立绘渐隐 + 底部名条 + 品质色线 + 斜向高光
  _renderHeroCard(ctx, name, x, y, cardW, cardH, opts) {
    opts = opts || {}
    const selected = !!opts.selected
    const color = HERO_RARITY_COLOR[name] || '#e8c96a'
    const r = 12

    ctx.save()
    if (opts.scaleX !== undefined) {
      const cx = x + cardW / 2
      const cy = y + cardH / 2
      ctx.translate(cx, cy)
      ctx.scale(opts.scaleX, 1)
      ctx.translate(-cx, -cy)
    }

    const liftY = selected ? -4 : 0
    y += liftY

    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.beginPath()
    ctx.ellipse(x + cardW / 2, y + cardH + 6, cardW * 0.42, 8, 0, 0, Math.PI * 2)
    ctx.fill()

    // 卡片底
    ctx.fillStyle = '#1c1e26'
    this._roundRect(ctx, x, y, cardW, cardH, r)
    ctx.fill()

    const portraitH = cardH * 0.68
    const nameBarH = cardH - portraitH

    // 立绘区
    ctx.save()
    this._roundRect(ctx, x, y, cardW, portraitH, r)
    ctx.clip()
    ctx.fillStyle = '#10121a'
    ctx.fillRect(x, y, cardW, portraitH)

    const img = this.heroImgs[name]
    if (this.loaded && img) {
      const pad = 6
      const innerW = cardW - pad * 2
      const innerH = portraitH - pad * 2
      const scale = Math.min(innerW / img.width, innerH / img.height)
      const dw = img.width * scale
      const dh = img.height * scale
      const dx = x + (cardW - dw) / 2
      const dy = y + (portraitH - dh) / 2
      ctx.drawImage(img, dx, dy, dw, dh)
    }

    // 底部渐隐融入名条
    const fadeGrad = ctx.createLinearGradient(0, y + portraitH * 0.6, 0, y + portraitH)
    fadeGrad.addColorStop(0, 'rgba(20,22,28,0)')
    fadeGrad.addColorStop(1, 'rgba(20,22,28,0.9)')
    ctx.fillStyle = fadeGrad
    ctx.fillRect(x, y + portraitH * 0.6, cardW, portraitH * 0.4)

    // 斜向高光
    ctx.globalAlpha = 0.06
    ctx.fillStyle = '#ffffff'
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(-Math.PI / 6)
    ctx.fillRect(-cardW * 0.3, -cardH * 0.2, cardW * 0.5, cardH * 1.4)
    ctx.restore()
    ctx.globalAlpha = 1
    ctx.restore()

    // 等级徽标（左上角），展示该武将当前等级——同一武将不论抽到几次卡片都共享同一等级
    if (opts.level) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      this._roundRect(ctx, x + 4, y + 4, cardW * 0.34, cardH * 0.13, 6)
      ctx.fill()
      ctx.fillStyle = '#ffe066'
      ctx.font = `bold ${Math.round(cardW * 0.12)}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`Lv.${opts.level}`, x + 4 + cardW * 0.17, y + 4 + cardH * 0.065)
    }

    // 名条底
    ctx.fillStyle = '#14161c'
    ctx.fillRect(x, y + portraitH, cardW, nameBarH)

    // 武将中文名
    ctx.fillStyle = '#e8c96a'
    ctx.font = `bold ${Math.round(cardW * 0.16)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(HERO_CN_NAME[name] || name, x + cardW / 2, y + portraitH + nameBarH / 2)

    // 品质色底部细线
    ctx.fillStyle = color
    ctx.fillRect(x, y + cardH - 3, cardW, 3)

    // 外层深色描边
    ctx.strokeStyle = '#1a1a1f'
    ctx.lineWidth = 4
    this._roundRect(ctx, x, y, cardW, cardH, r)
    ctx.stroke()

    // 内层品质色描边
    ctx.strokeStyle = selected ? '#ffd76a' : color
    ctx.lineWidth = selected ? 4 : 3
    this._roundRect(ctx, x + 3, y + 3, cardW - 6, cardH - 6, r - 2)
    ctx.stroke()

    // 顶部高光细线
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x + r, y + 2)
    ctx.lineTo(x + cardW - r, y + 2)
    ctx.stroke()

    if (selected) {
      ctx.strokeStyle = 'rgba(255,215,90,0.55)'
      ctx.lineWidth = 6
      this._roundRect(ctx, x - 3, y - 3, cardW + 6, cardH + 6, r + 3)
      ctx.stroke()
    }

    ctx.restore()
  }

  _renderHeroRow(ctx) {
    // 抽卡翻牌动画进行中时由 _renderPullEffect 接管卡片绘制
    if (this.pull) return

    const { cardW, cardH, stripY, stripH, hand } = this
    const cardY = stripY + (stripH - cardH) / 2
    const gap = 20
    let x = this.cardsGroupX
    this.cardRects = []

    hand.forEach((card, index) => {
      const selected = this.selectedCardIndex === index
      // 选中只保留卡牌描边，卡牌上方不绘制额外操作文字或按钮。
      this._renderHeroCard(ctx, card.heroId, x, cardY, cardW, cardH, { selected, level: card.level })
      this.cardRects.push({ id: card.heroId, index, x, y: cardY, w: cardW, h: cardH })
      x += cardW + gap
    })
  }

  _renderRefreshButton(ctx) {
    const { x, y, w, h } = this.refreshBtn
    const cx = x + w / 2
    const cy = y + h / 2
    const r = Math.min(w, h) / 2
    const nextCost = this._refreshCost(this.refreshCount)

    // 外层柔和阴影/光晕
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.beginPath()
    ctx.arc(cx + 2, cy + 2, r, 0, Math.PI * 2)
    ctx.fill()

    // 外圈金色描边
    ctx.fillStyle = '#e8c96a'
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()

    // 主体渐变圆
    const innerR = r * 0.88
    const grad = ctx.createLinearGradient(cx, cy - innerR, cx, cy + innerR)
    grad.addColorStop(0, '#f0c75e')
    grad.addColorStop(1, '#b8860b')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2)
    ctx.fill()

    // 内层高光细圈
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(cx, cy, innerR - 2, 0, Math.PI * 2)
    ctx.stroke()

    // 环形箭头图标
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.48, -Math.PI * 0.15, Math.PI * 1.5)
    ctx.stroke()

    // 箭头三角
    const ax = cx + r * 0.48 * Math.cos(-Math.PI * 0.15)
    const ay = cy + r * 0.48 * Math.sin(-Math.PI * 0.15)
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.moveTo(ax - 6, ay - 5)
    ctx.lineTo(ax + 7, ay)
    ctx.lineTo(ax - 6, ay + 5)
    ctx.closePath()
    ctx.fill()

    // 按钮内显示本次点击将支付的刷新费用
    const priceY = cy + r * 0.62
    ctx.fillStyle = 'rgba(72,45,0,0.78)'
    this._roundRect(ctx, cx - r * 0.72, priceY - 12, r * 1.44, 17, 8)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${Math.max(9, Math.min(12, r * 0.28))}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${nextCost}金币`, cx, priceY - 3.5)
  }

  // 抽卡刷新特效：逐张翻牌 + 落地闪光
  _renderPullEffect(ctx) {
    if (!this.pull) return
    const p = this.pull

    if (p.phase === 'flip' || p.phase === 'done') {
      const { cardW, cardH, stripY, stripH, hand } = this
      const cardY = stripY + (stripH - cardH) / 2
      const gap = 20
      let x = this.cardsGroupX
      this.cardRects = []

      hand.forEach((card, i) => {
        const delay = i * PULL_FLIP_STAGGER
        let localT = p.phase === 'done' ? PULL_FLIP_DUR : p.t - delay
        localT = Math.max(0, Math.min(PULL_FLIP_DUR, localT))
        const progress = localT / PULL_FLIP_DUR
        const eased = progress > 0 ? this._easeOutBack(progress) : 0
        const scaleX = Math.max(0.1, eased)

        this._renderHeroCard(ctx, card.heroId, x, cardY, cardW, cardH, { scaleX, level: card.level })

        if (progress >= 1 && localT === PULL_FLIP_DUR) {
          const cx = x + cardW / 2
          const cy = cardY + cardH / 2
          const flashAlpha = 1 - Math.min(1, (p.t - delay - PULL_FLIP_DUR) / 0.2)
          if (flashAlpha > 0) {
            ctx.strokeStyle = `rgba(255,215,90,${Math.max(0, flashAlpha) * 0.8})`
            ctx.lineWidth = 5
            this._roundRect(ctx, x - 4, cy - cardH / 2 - 4, cardW + 8, cardH + 8, 14)
            ctx.stroke()
          }
        }

        this.cardRects.push({ id: card.heroId, index: i, x, y: cardY, w: cardW, h: cardH })
        x += cardW + gap
      })
    }
  }

  _hitRect(rect, x, y) {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h
  }

  onTouch(x, y) {
    if (this.speedBtnRect && this._hitRect(this.speedBtnRect, x, y)) {
      this.speed = this.speed >= 3 ? 1 : this.speed + 1
      return
    }

    if (this.exitBtnRect && this._hitRect(this.exitBtnRect, x, y)) {
      this.game.switch('main')
      return
    }

    if (this.gameOver) {
      if (this.retryBtnRect && this._hitRect(this.retryBtnRect, x, y)) {
        this.game.switch('home', { level: this.level })
        return
      }
      if (this.returnBtnRect && this._hitRect(this.returnBtnRect, x, y)) {
        this.game.switch('main')
      }
      return
    }

    if (this.levelCleared) {
      if (this.nextLevelBtnRect && this._hitRect(this.nextLevelBtnRect, x, y)) {
        this.game.switch('home', { level: Math.min(this.level + 1, LEVEL_COUNT) })
        return
      }
      if (this.returnBtnRect && this._hitRect(this.returnBtnRect, x, y)) {
        this.game.switch('main')
      }
      return
    }

    if (this.pull) return

    if (this._hitRect(this.refreshBtn, x, y)) {
      this.startRefreshPull()
      return
    }

    for (let i = 0; i < this.cardRects.length; i++) {
      const rect = this.cardRects[i]
      if (this._hitRect(rect, x, y)) {
        this._touchStart = { type: 'card', index: rect.index, heroId: rect.id, x, y }
        return
      }
    }

    if (x >= this.lawnX && x <= this.lawnX + this.lawnW && y >= this.lawnY && y <= this.lawnY + this.lawnH) {
      const c = Math.floor((x - this.lawnX) / this.cell)
      const r = Math.floor((y - this.lawnY) / this.cell)

      const occupantIndex = this.deployed.findIndex(e => e.r === r && e.c === c)

      if (occupantIndex !== -1) {
        // 先记录按下状态，不立即撤回：等 onTouchEnd 判断是点击（撤回）还是拖拽（移动）
        this._touchStart = { x, y, r, c, entry: this.deployed[occupantIndex] }
        return
      }

      if (c === 0) return

      if (this.selectedHero) {
        const card = this.hand[this.selectedCardIndex]
        if (!card) {
          this.selectedHero = null
          this.selectedCardIndex = null
          return
        }
        const heroId = card.heroId
        const baseStats = HERO_STATS[heroId]
        const maxHp = Math.round(baseStats.maxHp * (1 + HERO_HP_LEVEL_BONUS * (card.level - 1)))
        const damage = this._heroDamage(heroId, card.level)
        const entry = { heroId, r, c, hp: maxHp, maxHp, damage, hurtT: 0, attackAnimT: null }
        entry.level = card.level
        this.deployed.push(entry)
        // 部署会消耗这张手牌；只有付费刷新才会重新生成三张牌。
        this.hand.splice(this.selectedCardIndex, 1)
        this.selectedHero = null
        this.selectedCardIndex = null
        return
      }
      return
    }

    // 点击草坪外空白处：取消选中
    this.selectedHero = null
    this.selectedCardIndex = null
  }

  // 判断某格是否可作为拖拽落点：需在草坪范围内，且未被其他武将占用（拖拽中的武将自身不计入占用）
  _dragCellValid(r, c) {
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols || c === 0) return false
    return !this.deployed.some(e => e !== this._dragEntry && e.r === r && e.c === c)
  }

  _resetDragState() {
    this._touchStart = null
    this._dragging = false
    this._dragEntry = null
    this._dragCard = null
    this._dragHoverR = -1
    this._dragHoverC = -1
    this._dragHoverValid = false
  }

  // 格子拖拽合成：仅同武将、同部署等级可合成；合成升级只对本次战斗中的目标实例生效。
  _dragFuse(source, target) {
    if (!source || !target || source.heroId !== target.heroId || source.level !== target.level) return false

    const heroId = source.heroId
    const sourceIndex = this.deployed.indexOf(source)
    if (sourceIndex === -1) return false

    const newMaxHp = Math.round((source.maxHp + target.maxHp) * 0.8)
    const newDamage = Math.round((source.damage + target.damage) * 0.8)
    this.deployed.splice(sourceIndex, 1)
    target.maxHp = newMaxHp
    target.damage = newDamage
    target.hp = newMaxHp
    target.level += 1
    if (!Number.isFinite(target.attackAnimT)) {
      const targetKey = `${target.heroId}_${target.r}_${target.c}`
      const last = this.lastAtkT[targetKey]
      target.attackAnimT = Number.isFinite(last) ? last : null
    }

    const rect = this._cellRect(target.r, target.c)
    this.fx.push({
      x: rect.x + rect.w / 2,
      y: rect.y + rect.h / 2,
      t: 0,
      dur: 1,
      kind: 'fusion',
      text: `${HERO_CN_NAME[heroId]} 升级! Lv.${target.level}`,
      color: HERO_RARITY_COLOR[heroId] || '#ffd76a'
    })
    this._saveProgress()
    return true
  }

  // 手牌拖拽到同武将、同等级的已部署武将时，直接消耗手牌并合成升级。
  _fuseCardOntoHero(card, cardIndex, target) {
    if (!card || !target || card.heroId !== target.heroId || card.level !== target.level) return false

    const heroId = card.heroId
    const baseStats = HERO_STATS[heroId]
    const cardMaxHp = Math.round(baseStats.maxHp * (1 + HERO_HP_LEVEL_BONUS * (card.level - 1)))
    const cardDamage = this._heroDamage(heroId, card.level)
    const newMaxHp = Math.round((cardMaxHp + target.maxHp) * 0.8)
    const newDamage = Math.round((cardDamage + target.damage) * 0.8)
    this.hand.splice(cardIndex, 1)
    target.maxHp = newMaxHp
    target.damage = newDamage
    target.hp = newMaxHp
    target.level += 1
    if (!Number.isFinite(target.attackAnimT)) {
      const targetKey = `${target.heroId}_${target.r}_${target.c}`
      const last = this.lastAtkT[targetKey]
      target.attackAnimT = Number.isFinite(last) ? last : null
    }

    const rect = this._cellRect(target.r, target.c)
    this.fx.push({
      x: rect.x + rect.w / 2,
      y: rect.y + rect.h / 2,
      t: 0,
      dur: 1,
      kind: 'fusion',
      text: `${HERO_CN_NAME[heroId]} 升级! Lv.${target.level}`,
      color: HERO_RARITY_COLOR[heroId] || '#ffd76a'
    })
    this._saveProgress()
    return true
  }

  onTouchMove(x, y) {
    if (!this._touchStart) return

    if (!this._dragging) {
      const dx = x - this._touchStart.x
      const dy = y - this._touchStart.y
      if (Math.hypot(dx, dy) < DRAG_MOVE_THRESHOLD) return
      this._dragging = true
      if (this._touchStart.type === 'card') {
        this._dragCard = { index: this._touchStart.index, heroId: this._touchStart.heroId }
        this._dragEntry = null
      } else {
        this._dragEntry = this._touchStart.entry
      }
    }

    this._dragX = x
    this._dragY = y

    if (x >= this.lawnX && x <= this.lawnX + this.lawnW && y >= this.lawnY && y <= this.lawnY + this.lawnH) {
      const c = Math.floor((x - this.lawnX) / this.cell)
      const r = Math.floor((y - this.lawnY) / this.cell)
      this._dragHoverR = r
      this._dragHoverC = c
      if (this._dragCard) {
        const card = this.hand[this._dragCard.index]
        const target = this.deployed.find(e => e.r === r && e.c === c)
        this._dragHoverValid = r >= 0 && r < this.rows && c >= 0 && c < this.cols &&
          !!card && card.heroId === this._dragCard.heroId &&
          (target
            ? target.heroId === card.heroId && target.level === card.level
            : c !== 0)
      } else {
        this._dragHoverValid = this._dragCellValid(r, c)
      }
    } else {
      this._dragHoverR = -1
      this._dragHoverC = -1
      this._dragHoverValid = false
    }
  }

  onTouchEnd(x, y) {
    if (!this._touchStart) return

    if (this._dragging && this._dragCard) {
      if (this._dragHoverValid) {
        const card = this.hand[this._dragCard.index]
        if (card && card.heroId === this._dragCard.heroId) {
          const heroId = card.heroId
          const target = this.deployed.find(e => e.r === this._dragHoverR && e.c === this._dragHoverC)
          if (target) {
            this._fuseCardOntoHero(card, this._dragCard.index, target)
          } else {
            const baseStats = HERO_STATS[heroId]
            const maxHp = Math.round(baseStats.maxHp * (1 + HERO_HP_LEVEL_BONUS * (card.level - 1)))
            const damage = this._heroDamage(heroId, card.level)
            const entry = { heroId, r: this._dragHoverR, c: this._dragHoverC, hp: maxHp, maxHp, damage, hurtT: 0, attackAnimT: null }
            entry.level = card.level
            this.deployed.push(entry)
            this.hand.splice(this._dragCard.index, 1)
            const rect = this._cellRect(entry.r, entry.c)
            this.fx.push({
              x: rect.x + rect.w / 2,
              y: rect.y + rect.h / 2,
              t: 0,
              dur: 0.45,
              kind: 'fusion',
              text: '部署!',
              color: '#78d978'
            })
          }
        }
      }
      // 手牌拖拽无论部署成功与否都取消当前选中状态。
      this.selectedHero = null
      this.selectedCardIndex = null
    } else if (this._dragging) {
      const entry = this._dragEntry
      if (this._dragHoverR !== -1) {
        const target = this.deployed.find(e => e !== entry && e.r === this._dragHoverR && e.c === this._dragHoverC)
        if (target) {
          if (!this._dragFuse(entry, target)) {
            // 不同武将或不同等级：交换位置，实例属性保持不变。
            const tmpR = entry.r
            const tmpC = entry.c
            entry.r = target.r
            entry.c = target.c
            target.r = tmpR
            target.c = tmpC

            for (const swapped of [entry, target]) {
              const rect = this._cellRect(swapped.r, swapped.c)
              this.fx.push({
                x: rect.x + rect.w / 2,
                y: rect.y + rect.h / 2,
                t: 0,
                dur: 0.4,
                kind: 'fusion',
                text: '交换',
                color: '#7fd0ff'
              })
            }
          }
        } else if (this._dragHoverValid) {
          // 空格：沿用原移动逻辑，hp/maxHp/level 等属性原样保留。
          entry.r = this._dragHoverR
          entry.c = this._dragHoverC
        }
      }
      // 否则落点无效，武将保持在原格子（不做任何改动，即"回弹"）
    } else if (this._touchStart.type === 'card') {
      // 未超过拖拽阈值时保留原有点击选中/取消选中行为。
      if (this.selectedCardIndex === this._touchStart.index) {
        this.selectedCardIndex = null
        this.selectedHero = null
      } else {
        this.selectedCardIndex = this._touchStart.index
        this.selectedHero = this._touchStart.heroId
      }
    }
    // 未触发拖拽阈值，视为点击已部署武将：不做任何改动，武将保持部署状态

    this._resetDragState()
  }

  // 拖拽中：高亮悬停格子（绿=可放置，红=不可放置），并在手指位置绘制半透明的被拖拽武将
  _renderDragGhost(ctx) {
    if (!this._dragging || (!this._dragEntry && !this._dragCard)) return

    if (this._dragHoverR !== -1) {
      const rect = this._cellRect(this._dragHoverR, this._dragHoverC)
      ctx.save()
      ctx.fillStyle = this._dragHoverValid ? 'rgba(76,175,80,0.45)' : 'rgba(229,57,53,0.45)'
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
      ctx.restore()
    }

    const heroId = this._dragCard ? this._dragCard.heroId : this._dragEntry.heroId
    const img = this.heroImgs[heroId]
    const size = this.cell * 0.9

    ctx.save()
    ctx.globalAlpha = 0.75
    if (this.loaded && img) {
      const scale = Math.min(size / img.width, size / img.height)
      const dw = img.width * scale
      const dh = img.height * scale
      ctx.drawImage(img, this._dragX - dw / 2, this._dragY - dh / 2 - 12, dw, dh)
    } else if (this._dragCard) {
      const cardW = Math.min(this.cardW, this.cell * 0.72)
      const cardH = cardW * 1.15
      const cardX = this._dragX - cardW / 2
      const cardY = this._dragY - cardH / 2 - 12
      ctx.fillStyle = '#1c1e26'
      this._roundRect(ctx, cardX, cardY, cardW, cardH, 8)
      ctx.fill()
      ctx.strokeStyle = HERO_RARITY_COLOR[heroId] || '#e8c96a'
      ctx.lineWidth = 3
      this._roundRect(ctx, cardX, cardY, cardW, cardH, 8)
      ctx.stroke()
    } else {
      ctx.fillStyle = HERO_RARITY_COLOR[heroId] || '#e8c96a'
      ctx.beginPath()
      ctx.arc(this._dragX, this._dragY - 12, this.cell * 0.3, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }
}
