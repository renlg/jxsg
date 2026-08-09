import { Scene } from './scene.js'
import { isMusicOn, isSoundOn, toggleMusic, toggleSound } from '../data.js'
import { playMainBg, stopBattleBg, stopMainBg } from '../audio.js'
import { assetUrl, getLocalAssetPath } from '../config.js'

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

// 主页面抽卡（碎片）消耗金币，需与 home.js 的 GACHA_COST 保持一致（战斗页面刷新按钮沿用同一数值）
const GACHA_COST = 100
// 单次抽卡获得的目标武将碎片数量范围（含两端），用于升级战斗页面的武将（见 home.js 的 FRAGMENT_COST_PER_LV）
const FRAGMENT_GAIN_MIN = 1
const FRAGMENT_GAIN_MAX = 3
const PULL_FLIP_DUR = 0.35
const PULL_DONE_HOLD = 0.6
const GACHA_TOAST_DUR = 0.8
const LEVEL_COUNT = 15
const LEVEL_DRAG_THRESHOLD = 8
const NAV_ITEMS = [
  { id: 'hero', label: '英雄', asset: 'assets/nav/nav_hero.png?v=3' },
  { id: 'bag', label: '背包', asset: 'assets/nav/nav_bag.png?v=3' },
  { id: 'level', label: '关卡', asset: 'assets/nav/nav_level.png?v=3' },
  { id: 'rank', label: '排行', asset: 'assets/nav/nav_rank.png?v=3' }
]

// 英雄面板展示数值，与 home.js 保持一致。
const HERO_PANEL_STATS = {
  guanyu: { damage: 40, maxHp: 200, attackCooldown: 1.8 },
  zhangfei: { damage: 20, maxHp: 120, attackCooldown: 1.6 },
  zhaoyun: { damage: 20, maxHp: 120, attackCooldown: 0.6 },
  zhugeliang: { damage: 100, maxHp: 100, attackCooldown: 2.0 },
  liubei: { damage: 0, maxHp: 300, attackCooldown: 2.0 }
}
const HERO_ATTACK_SPEED_BONUS_BY_LEVEL = [0, 0.1, 0.2, 0.3, 0.5]
const GUANYU_DAMAGE_BY_LEVEL = [40, 76, 122, 196, 314]
const GUANYU_HP_BY_LEVEL = [200, 320, 512, 820, 1312]
const HERO_SKILL_TEXT = {
  guanyu: '对选中行所有怪物造成伤害，伤害 = 当前最高等级伤害 × 等级',
  zhangfei: '全屏怪物眩晕，持续 3 + (等级-1)×0.5 秒',
  zhaoyun: '全体英雄攻速 +100%，持续 3 + (等级-1) 秒',
  zhugeliang: '对 3×3 范围内怪物造成伤害，伤害 = 当前最高等级伤害',
  liubei: '3×3 范围内英雄每秒回血（回血量 = 最高等级血量），持续 1 + (等级-1) 秒'
}
const NAV_PANEL = { hero: 'heroList', bag: 'bag', level: 'levels', rank: 'rank' }

// 主页面（大厅）：水墨山水背景 + 顶部玩家栏 + 武将陈列 + 关卡选择入口
export class MainScene extends Scene {
  enter() {
    const w = this.game.width
    const h = this.game.height

    this.bgImg = null
    const bg = tt.createImage()
    bg.onload = () => { this.bgImg = bg }
    getLocalAssetPath('assets/pvz_bg.jpg').then(path => { bg.src = path })

    this.cloudImg = null
    const cloud = tt.createImage()
    cloud.onload = () => { this.cloudImg = cloud }
    cloud.src = assetUrl('assets/cloud_main.png?v=6')

    this.cloudSubImg = null
    const cloudSub = tt.createImage()
    cloudSub.onload = () => { this.cloudSubImg = cloudSub }
    cloudSub.src = assetUrl('assets/cloud_sub.png?v=5')

    // safeArea 固定按 0 处理；资源栏内容仍保留至少 30px 的横向安全边距。
    this.safeArea = 0
    this.leftPad = Math.max(30, Math.round(w * 0.045))
    this.topBarY = this.safeArea
    this.topBarH = Math.max(66, Math.min(82, Math.round(h * 0.14)))
    this.avatarSize = Math.max(42, Math.min(54, this.topBarH - 22))
    this.avatarImg = null
    this.settingsOpen = false
    this.settingsPanelRect = null
    this.settingsMusicRect = null
    this.settingsSoundRect = null
    this.settingsCloseRect = null
    this.panel = null
    this.detailHeroId = null
    this.panelRect = null
    this.panelCloseRect = null
    this.heroListRects = []
    this.playerNickname = '主公'
    this._loadAvatar()

    stopBattleBg()
    playMainBg()

    // 金币/武将等级/武将碎片为跨场景共享存档，读档失败/首次进入则使用默认值（含测试初始金币）
    this._loadProgress()
    this._saveProgress()

    this.heroImgs = {}
    this._loadHeroImgs()
    this.navImgs = {}
    this._loadNavImgs()

    this._layoutLobby(w, h)
    // 进入大厅时预置关卡面板滚动位置，打开时还会按最新进度再次校正。
    this.scrollOffset = this._clampLevelScroll((this.level - 1) * this.levelCardStep)
    this.levelTouch = null
    this.pull = null
    this.fx = []
    this.animT = 0
    this.pressedCard = null
    this.pressedCardT = 0
    this.cardRects = []
    this.particles = this._createParticles(w, h)
  }

  leave() {
    stopMainBg()
  }

  _layoutLobby(w, h) {
    // 导航按钮放大并与屏幕底边保持距离，避免图标和文字贴底。
    const navBottomPad = Math.max(14, Math.min(20, Math.round(h * 0.035)))
    const navSidePad = Math.max(12, Math.round(w * 0.035))
    const navGap = Math.max(8, Math.min(18, Math.round(w * 0.025)))
    const availableButtonW = (w - navSidePad * 2 - navGap * 3) / NAV_ITEMS.length
    const navButtonSize = Math.max(72, Math.min(96, Math.round(h * 0.23), availableButtonW))
    this.navH = navButtonSize + navBottomPad
    const navLift = Math.max(20, Math.round(h * 0.04))
    this.navY = h - this.navH - navLift
    const navTotalW = navButtonSize * NAV_ITEMS.length + navGap * (NAV_ITEMS.length - 1)
    const navStartX = (w - navTotalW) / 2
    this.navRects = NAV_ITEMS.map((item, i) => ({
      id: item.id,
      label: item.label,
      x: navStartX + i * (navButtonSize + navGap),
      y: this.navY,
      w: navButtonSize,
      h: navButtonSize
    }))

    const rowTop = this.topBarH + Math.max(16, Math.round(h * 0.035))
    const maxCardH = Math.max(72, Math.min(118, h * 0.25))
    const cardGap = Math.max(7, Math.min(14, Math.round(w * 0.016)))
    this.cardW = Math.max(52, Math.min(104, (w - this.leftPad * 2 - cardGap * 4) / HERO_NAMES.length, maxCardH / 1.48))
    this.cardH = this.cardW * 1.48
    this.cardGap = cardGap
    this.heroRowY = rowTop

    const selectorTop = this.heroRowY + this.cardH + Math.max(24, Math.round(h * 0.045))
    // 关卡选择器使用导航栏上方的余下空间，并与武将行组成居中的主内容区。
    const selectorBottom = this.navY - Math.max(12, Math.round(h * 0.02))
    const selectorH = Math.max(64, selectorBottom - selectorTop)
    this.levelViewport = { x: this.leftPad, y: selectorTop, w: w - this.leftPad * 2, h: selectorH }
    this.levelCardH = Math.max(58, Math.min(180, selectorH - 24))
    this.levelCardW = Math.max(92, Math.min(156, this.levelCardH * 1.28, this.levelViewport.w * 0.48))
    this.levelCardGap = Math.max(14, Math.min(24, Math.round(w * 0.025)))
    this.levelCardStep = this.levelCardW + this.levelCardGap
    this.levelSidePad = Math.max(0, (this.levelViewport.w - this.levelCardW) / 2)
    this.maxScroll = Math.max(0, (LEVEL_COUNT - 1) * this.levelCardStep)
  }

  _clampLevelScroll(offset) {
    return Math.max(0, Math.min(this.maxScroll || 0, offset || 0))
  }

  _createParticles(w, h) {
    const seeds = [0.08, 0.19, 0.31, 0.44, 0.58, 0.71, 0.84, 0.93]
    return seeds.map((seed, i) => ({
      x: w * seed,
      baseY: this.topBarH + (h - this.topBarH) * (0.12 + ((i * 37) % 71) / 100),
      r: 1.2 + (i % 3) * 0.8,
      speed: 0.22 + (i % 4) * 0.07,
      phase: i * 1.37
    }))
  }

  // 金币/武将等级/武将碎片/战役关卡读取与战斗页面共用的存档；旧存档缺少 level 时从第 1 关开始。
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
    // 旧存档没有该字段时全部默认为 0，向后兼容
    this.heroFragments = (save && save.heroFragments) || { guanyu: 0, zhangfei: 0, zhaoyun: 0, zhugeliang: 0, liubei: 0 }
    this.level = Math.max(1, Math.min(LEVEL_COUNT, Math.floor(Number(save && save.level) || 1)))
  }

  _saveProgress() {
    if (typeof tt === 'undefined' || !tt.setStorageSync) return
    try {
      tt.setStorageSync('jxsg_td_save', { gold: this.gold, heroLevel: this.heroLevel, heroFragments: this.heroFragments, level: this.level })
    } catch (e) {}
  }

  _loadAvatar() {
    const fallback = () => {
      const img = tt.createImage()
      img.onload = () => { this.avatarImg = img }
      getLocalAssetPath('assets/pvz_heroes/guanyu.png').then(path => { img.src = path })
    }
    if (typeof tt !== 'undefined' && tt.getUserInfo) {
      tt.getUserInfo({
        success: res => {
          const userInfo = res && res.userInfo
          const url = userInfo && userInfo.avatarUrl
          this.playerNickname = (userInfo && (userInfo.nickName || userInfo.nickname)) || '主公'
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

  _loadHeroImgs() {
    HERO_NAMES.forEach(name => {
      const img = tt.createImage()
      img.onload = () => { this.heroImgs[name] = img }
      getLocalAssetPath(`assets/pvz_heroes/${name}.png`).then(path => { img.src = path })
    })
  }

  // 导航图标绕过 downloadFile 缓存链路，使用 TOS 远程地址让 createImage 直接加载。
  _loadNavImgs() {
    NAV_ITEMS.forEach(item => {
      const img = tt.createImage()
      img.onload = () => { this.navImgs[item.id] = img }
      img.src = assetUrl(item.asset)
    })
  }

  // 抽卡：先扣除 GACHA_COST 金币，金币不足则不抽卡，仅弹出提示文字；
  // 扣费成功后随机抽中一名武将并获得 1~3 个该武将碎片，走原有翻牌状态机。
  startGachaPull() {
    if (this.pull) return
    if (this.gold < GACHA_COST) {
      this.fx.push({ x: this.game.width / 2, y: this.levelViewport.y, t: 0, dur: GACHA_TOAST_DUR, kind: 'dmg', text: '金币不足', color: '#ff6b6b' })
      return
    }
    this.gold -= GACHA_COST
    const heroId = HERO_NAMES[Math.floor(Math.random() * HERO_NAMES.length)]
    const gain = FRAGMENT_GAIN_MIN + Math.floor(Math.random() * (FRAGMENT_GAIN_MAX - FRAGMENT_GAIN_MIN + 1))
    this.heroFragments[heroId] = (this.heroFragments[heroId] || 0) + gain
    this._saveProgress()
    this.pull = { phase: 'flip', t: 0, heroId, gain }
  }

  _easeOutBack(t) {
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  }

  update(dt) {
    this.animT += dt
    if (this.pressedCardT > 0) {
      this.pressedCardT -= dt
      if (this.pressedCardT <= 0) this.pressedCard = null
    }
    if (this.pull) {
      const p = this.pull
      p.t += dt
      if (p.phase === 'flip') {
        if (p.t >= PULL_FLIP_DUR) {
          p.phase = 'done'
          p.t = 0
        }
      } else if (p.phase === 'done') {
        if (p.t >= PULL_DONE_HOLD) {
          this.pull = null
        }
      }
    }
    this._updateFx(dt)
  }

  _updateFx(dt) {
    this.fx.forEach(f => { f.t += dt })
    this.fx = this.fx.filter(f => f.t < f.dur)
  }

  render(ctx) {
    const w = this.game.width
    const h = this.game.height

    ctx.fillStyle = '#0d1117'
    ctx.fillRect(0, 0, w, h)
    if (this.bgImg) ctx.drawImage(this.bgImg, 0, 0, w, h)

    this._renderBackdrop(ctx)
    this._renderParticles(ctx)
    this._renderLobbyDecoration(ctx)
    this._renderTopBar(ctx)
    this._renderBottomNav(ctx)
    this._renderFx(ctx)
    if (this.panel) this._renderPanel(ctx)
    if (this.settingsOpen) this._renderSettingsPanel(ctx)
  }

  // 祥云仅装饰无面板的主屏，不参与任何触摸命中。
  _renderLobbyDecoration(ctx) {
    if (this.panel || !this.cloudImg) return

    const w = this.game.width
    const h = this.game.height
    const sourceW = this.cloudImg.width || 512
    const sourceH = this.cloudImg.height || 512
    const availableH = Math.max(1, this.navY - this.topBarH - 16)
    const scale = Math.min(1, w * 0.4 / sourceW, availableH / sourceH)
    const drawW = sourceW * scale
    const drawH = sourceH * scale
    const minCenterY = this.topBarH + drawH / 2 + 8
    const maxCenterY = this.navY - drawH / 2 - 8
    const centerY = Math.max(minCenterY, Math.min(h * 0.375, maxCenterY))
    const offsetX = Math.sin(this.animT * 0.3) * 40
    let centerX = Math.max(drawW / 2, Math.min(w * 0.34 + offsetX, w - drawW / 2))

    ctx.globalAlpha = 0.8
    if (this.cloudSubImg) {
      const subSourceW = this.cloudSubImg.width || 512
      const subSourceH = this.cloudSubImg.height || 512
      const subScale = Math.min(1, w * 0.26 / subSourceW, availableH / subSourceH)
      const subDrawW = subSourceW * subScale
      const subDrawH = subDrawW * subSourceH / subSourceW
      const subMinCenterY = this.topBarH + subDrawH / 2 + 8
      const subMaxCenterY = this.navY - subDrawH / 2 - 8
      const subCenterY = Math.max(subMinCenterY, Math.min(h * 0.4, subMaxCenterY))
      const subOffsetX = Math.sin(this.animT * 0.3 + 1.3) * 30
      const desiredSubCenterX = Math.max(subDrawW / 2, Math.min(w * 0.72 + subOffsetX, w - subDrawW / 2))
      const cloudGap = Math.max(4, w * 0.01)
      const minSubCenterX = centerX + drawW / 2 + subDrawW / 2 + cloudGap
      const subCenterX = Math.min(w - subDrawW / 2, Math.max(desiredSubCenterX, minSubCenterX))
      if (subCenterX < minSubCenterX) {
        centerX = Math.max(drawW / 2, subCenterX - subDrawW / 2 - drawW / 2 - cloudGap)
      }
      const subX = subCenterX - subDrawW / 2
      const subY = subCenterY - subDrawH / 2
      ctx.drawImage(this.cloudSubImg, subX, subY, subDrawW, subDrawH)
    }

    ctx.drawImage(this.cloudImg, centerX - drawW / 2, centerY - drawH / 2, drawW, drawH)
    ctx.globalAlpha = 1
  }

  _renderPanel(ctx) {
    const w = this.game.width
    const h = this.game.height
    const panelW = Math.min(760, w - 32)
    const panelH = Math.min(h - 36, Math.max(300, h * 0.82))
    const panelX = (w - panelW) / 2
    const panelY = (h - panelH) / 2
    this.panelRect = { x: panelX, y: panelY, w: panelW, h: panelH }
    const closeH = Math.max(36, Math.min(40, Math.round(h * 0.065)))
    const closeW = Math.max(72, Math.min(84, closeH * 2))
    // 渲染和触摸命中共用同一个矩形，避免关闭按钮坐标偏移。
    this.panelCloseRect = { x: panelX + panelW - closeW - 14, y: panelY + 10, w: closeW, h: closeH }

    ctx.save()
    ctx.fillStyle = 'rgba(2,3,6,0.78)'
    ctx.fillRect(0, 0, w, h)
    ctx.shadowColor = 'rgba(0,0,0,0.72)'
    ctx.shadowBlur = 22
    this._roundRect(ctx, panelX, panelY, panelW, panelH, 17)
    ctx.fillStyle = '#151922'
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.strokeStyle = '#b8872b'
    ctx.lineWidth = 2
    ctx.stroke()

    const titles = { heroList: '英 雄', heroDetail: '英 雄 详 情', levels: '关 卡', bag: '背 包', rank: '排 行' }
    ctx.fillStyle = '#f1d486'
    ctx.font = 'bold 22px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(titles[this.panel] || '', w / 2, panelY + 31)
    ctx.strokeStyle = 'rgba(205,166,72,0.28)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(panelX + 16, panelY + 54)
    ctx.lineTo(panelX + panelW - 16, panelY + 54)
    ctx.stroke()

    const close = this.panelCloseRect
    this._roundRect(ctx, close.x, close.y, close.w, close.h, 7)
    ctx.fillStyle = 'rgba(184,135,43,0.2)'
    ctx.fill()
    ctx.strokeStyle = '#d8bd78'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.fillStyle = '#f4e4b7'
    ctx.font = 'bold 15px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('关闭', close.x + close.w / 2, close.y + close.h / 2)

    if (this.panel === 'heroList') this._renderHeroListPanel(ctx)
    else if (this.panel === 'heroDetail') this._renderHeroDetailPanel(ctx)
    else if (this.panel === 'levels') this._renderLevelsPanel(ctx)
    else if (this.panel === 'bag') this._renderBagPanel(ctx)
    else if (this.panel === 'rank') this._renderRankPanel(ctx)
    ctx.restore()
  }

  _renderHeroListPanel(ctx) {
    const panel = this.panelRect
    const gap = Math.max(6, Math.min(14, panel.w * 0.018))
    const innerW = panel.w - 36
    const maxCardW = (innerW - gap * (HERO_NAMES.length - 1)) / HERO_NAMES.length
    const cardW = Math.max(40, Math.min(104, maxCardW, (panel.h - 94) / 1.48))
    const cardH = cardW * 1.48
    const totalW = cardW * HERO_NAMES.length + gap * (HERO_NAMES.length - 1)
    const startX = panel.x + (panel.w - totalW) / 2
    const y = panel.y + 66 + Math.max(0, (panel.h - 76 - cardH) / 2)
    this.heroListRects = []
    HERO_NAMES.forEach((heroId, i) => {
      const x = startX + i * (cardW + gap)
      this._renderHeroCard(ctx, heroId, x, y, cardW, cardH, {})
      this.heroListRects.push({ id: heroId, x, y, w: cardW, h: cardH })
    })
  }

  _heroPanelStat(heroId, level, key) {
    if (heroId === 'guanyu') {
      return key === 'damage' ? GUANYU_DAMAGE_BY_LEVEL[level - 1] : GUANYU_HP_BY_LEVEL[level - 1]
    }
    const base = HERO_PANEL_STATS[heroId]
    return Math.round(base[key] * Math.pow(1.6, level - 1))
  }

  _renderHeroDetailPanel(ctx) {
    const panel = this.panelRect
    const heroId = this.detailHeroId || HERO_NAMES[0]
    const stats = HERO_PANEL_STATS[heroId]
    const contentY = panel.y + 66
    const portraitSize = Math.max(62, Math.min(112, panel.w * 0.19, panel.h * 0.31))
    const portraitX = panel.x + 20
    const portraitY = contentY + 4

    this._roundRect(ctx, portraitX, portraitY, portraitSize, portraitSize, 12)
    ctx.fillStyle = '#252a35'
    ctx.fill()
    ctx.strokeStyle = HERO_RARITY_COLOR[heroId]
    ctx.lineWidth = 2
    ctx.stroke()
    const img = this.heroImgs[heroId]
    if (img) {
      const scale = Math.min((portraitSize - 8) / img.width, (portraitSize - 8) / img.height)
      const dw = img.width * scale
      const dh = img.height * scale
      ctx.drawImage(img, portraitX + (portraitSize - dw) / 2, portraitY + portraitSize - dh - 4, dw, dh)
    }
    ctx.fillStyle = '#fff0b5'
    ctx.font = 'bold 18px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(HERO_CN_NAME[heroId], portraitX + portraitSize / 2, portraitY + portraitSize + 18)

    const tableX = portraitX + portraitSize + 18
    const tableW = panel.x + panel.w - 20 - tableX
    const rowH = Math.max(23, Math.min(30, (panel.h - 132) / 6))
    const tableY = contentY
    const columns = [0.08, 0.29, 0.53, 0.79]
    const headers = ['等级', '伤害', '血量', '攻击间隔']
    ctx.fillStyle = 'rgba(184,135,43,0.18)'
    this._roundRect(ctx, tableX, tableY, tableW, rowH * 6, 8)
    ctx.fill()
    for (let i = 0; i <= 6; i++) {
      ctx.strokeStyle = 'rgba(225,195,119,0.22)'
      ctx.beginPath()
      ctx.moveTo(tableX, tableY + i * rowH)
      ctx.lineTo(tableX + tableW, tableY + i * rowH)
      ctx.stroke()
    }
    ctx.font = `bold ${Math.max(10, Math.min(13, tableW * 0.045))}px sans-serif`
    ctx.textAlign = 'left'
    headers.forEach((label, i) => {
      ctx.fillStyle = '#ead293'
      ctx.fillText(label, tableX + tableW * columns[i], tableY + rowH / 2)
    })
    for (let level = 1; level <= 5; level++) {
      const damage = this._heroPanelStat(heroId, level, 'damage')
      const hp = this._heroPanelStat(heroId, level, 'maxHp')
      const interval = (stats.attackCooldown / (1 + HERO_ATTACK_SPEED_BONUS_BY_LEVEL[level - 1])).toFixed(2)
      const values = [`LV${level}`, String(damage), String(hp), `${interval}s`]
      values.forEach((value, i) => {
        ctx.fillStyle = level === (this.heroLevel[heroId] || 1) ? '#fff0ad' : '#d8dbe3'
        ctx.fillText(value, tableX + tableW * columns[i], tableY + rowH * (level + 0.5))
      })
    }

    const skillY = Math.max(portraitY + portraitSize + 43, tableY + rowH * 6 + 12)
    const skillX = panel.x + 20
    const skillW = panel.w - 40
    const skillH = panel.y + panel.h - 16 - skillY
    this._roundRect(ctx, skillX, skillY, skillW, Math.max(44, skillH), 9)
    ctx.fillStyle = 'rgba(255,255,255,0.045)'
    ctx.fill()
    ctx.fillStyle = '#f0d58a'
    ctx.font = 'bold 15px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('技能效果', skillX + 12, skillY + 18)
    ctx.fillStyle = '#e0e2e8'
    ctx.font = '13px sans-serif'
    this._drawWrappedText(ctx, HERO_SKILL_TEXT[heroId], skillX + 12, skillY + 40, skillW - 24, 20, 3)
  }

  _renderLevelsPanel(ctx) {
    const panel = this.panelRect
    this.levelViewport = { x: panel.x + 18, y: panel.y + 72, w: panel.w - 36, h: panel.h - 90 }
    this.levelCardH = Math.max(80, Math.min(180, this.levelViewport.h - 26))
    this.levelCardW = Math.max(92, Math.min(156, this.levelCardH * 1.28, this.levelViewport.w * 0.48))
    this.levelCardGap = Math.max(14, Math.min(24, Math.round(this.game.width * 0.025)))
    this.levelCardStep = this.levelCardW + this.levelCardGap
    this.levelSidePad = Math.max(0, (this.levelViewport.w - this.levelCardW) / 2)
    this.maxScroll = Math.max(0, (LEVEL_COUNT - 1) * this.levelCardStep)
    if (this.panelNeedsLevelCenter) {
      // 沿用原 enter 的零基索引公式，让最新进度关卡默认居中。
      this.scrollOffset = this._clampLevelScroll((this.level - 1) * this.levelCardStep)
      this.panelNeedsLevelCenter = false
    } else {
      this.scrollOffset = this._clampLevelScroll(this.scrollOffset)
    }
    this._renderLevelSelector(ctx)
  }

  _renderBagPanel(ctx) {
    const panel = this.panelRect
    ctx.fillStyle = '#d5d8df'
    ctx.font = 'bold 20px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('背包空空如也', panel.x + panel.w / 2, panel.y + panel.h / 2 + 12)
  }

  _renderRankPanel(ctx) {
    const panel = this.panelRect
    const row = { x: panel.x + 28, y: panel.y + 78, w: panel.w - 56, h: Math.min(78, panel.h * 0.22) }
    this._roundRect(ctx, row.x, row.y, row.w, row.h, 10)
    ctx.fillStyle = 'rgba(184,135,43,0.16)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(226,189,88,0.5)'
    ctx.stroke()
    const avatarSize = Math.min(52, row.h - 14)
    const avatarX = row.x + 16
    const avatarY = row.y + (row.h - avatarSize) / 2
    ctx.save()
    ctx.beginPath()
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2)
    ctx.clip()
    if (this.avatarImg) ctx.drawImage(this.avatarImg, avatarX, avatarY, avatarSize, avatarSize)
    else {
      ctx.fillStyle = '#303643'
      ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize)
    }
    ctx.restore()
    ctx.fillStyle = '#fff0b5'
    ctx.font = 'bold 18px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('主公', avatarX + avatarSize + 16, row.y + row.h / 2)
    ctx.fillStyle = '#f0c95d'
    ctx.textAlign = 'right'
    ctx.fillText('第 1 名', row.x + row.w - 18, row.y + row.h / 2)
    ctx.fillStyle = '#989ca7'
    ctx.font = '14px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('暂无其他玩家', panel.x + panel.w / 2, row.y + row.h + 34)
  }

  _drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    let line = ''
    let lineIndex = 0
    for (let i = 0; i < text.length && lineIndex < maxLines; i++) {
      const testLine = line + text[i]
      if (line && ctx.measureText(testLine).width > maxWidth) {
        ctx.fillText(line, x, y + lineIndex * lineHeight)
        line = text[i]
        lineIndex++
      } else {
        line = testLine
      }
    }
    if (line && lineIndex < maxLines) ctx.fillText(line, x, y + lineIndex * lineHeight)
  }

  _renderSettingsPanel(ctx) {
    const w = this.game.width
    const h = this.game.height
    const panelW = Math.min(330, w - 48)
    const panelH = Math.min(260, h - 64)
    const panelX = (w - panelW) / 2
    const panelY = (h - panelH) / 2
    const rowH = Math.min(66, (panelH - 78) / 2)
    const rowX = panelX + 20
    const rowW = panelW - 40
    const firstRowY = panelY + 62

    this.settingsPanelRect = { x: panelX, y: panelY, w: panelW, h: panelH }
    this.settingsMusicRect = { x: rowX, y: firstRowY, w: rowW, h: rowH }
    this.settingsSoundRect = { x: rowX, y: firstRowY + rowH + 12, w: rowW, h: rowH }
    this.settingsCloseRect = { x: panelX + panelW - 46, y: panelY + 12, w: 32, h: 32 }

    ctx.save()
    ctx.fillStyle = 'rgba(2,3,6,0.72)'
    ctx.fillRect(0, 0, w, h)

    ctx.shadowColor = 'rgba(0,0,0,0.65)'
    ctx.shadowBlur = 22
    this._roundRect(ctx, panelX, panelY, panelW, panelH, 16)
    ctx.fillStyle = '#171a22'
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.strokeStyle = '#b8872b'
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.fillStyle = '#f1d486'
    ctx.font = 'bold 24px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('设置', w / 2, panelY + 34)

    this._renderSettingRow(ctx, this.settingsMusicRect, '音乐', isMusicOn())
    this._renderSettingRow(ctx, this.settingsSoundRect, '音效', isSoundOn())

    const close = this.settingsCloseRect
    ctx.strokeStyle = '#d8bd78'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(close.x + 9, close.y + 9)
    ctx.lineTo(close.x + close.w - 9, close.y + close.h - 9)
    ctx.moveTo(close.x + close.w - 9, close.y + 9)
    ctx.lineTo(close.x + 9, close.y + close.h - 9)
    ctx.stroke()
    ctx.restore()
  }

  _renderSettingRow(ctx, rect, label, enabled) {
    this._roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 10)
    ctx.fillStyle = 'rgba(255,255,255,0.045)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(205,166,72,0.28)'
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.fillStyle = '#f4e4b7'
    ctx.font = 'bold 18px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, rect.x + 18, rect.y + rect.h / 2)

    const toggleW = 62
    const toggleH = 30
    const toggleX = rect.x + rect.w - toggleW - 14
    const toggleY = rect.y + (rect.h - toggleH) / 2
    this._roundRect(ctx, toggleX, toggleY, toggleW, toggleH, toggleH / 2)
    ctx.fillStyle = enabled ? '#b8872b' : '#454852'
    ctx.fill()
    ctx.fillStyle = '#fff7dc'
    ctx.beginPath()
    ctx.arc(toggleX + (enabled ? toggleW - toggleH / 2 : toggleH / 2), toggleY + toggleH / 2, toggleH / 2 - 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = enabled ? '#f6d77e' : '#b8bbc4'
    ctx.font = 'bold 10px sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(enabled ? 'ON' : 'OFF', toggleX - 8, toggleY + toggleH / 2)
  }

  _renderBackdrop(ctx) {
    const w = this.game.width
    const h = this.game.height

    const topGrad = ctx.createLinearGradient(0, 0, 0, this.topBarH + 24)
    topGrad.addColorStop(0, 'rgba(8,10,15,0.92)')
    topGrad.addColorStop(0.72, 'rgba(15,17,24,0.72)')
    topGrad.addColorStop(1, 'rgba(15,17,24,0)')
    ctx.fillStyle = topGrad
    ctx.fillRect(0, 0, w, this.topBarH + 24)

    const bottomGrad = ctx.createLinearGradient(0, h * 0.5, 0, h)
    bottomGrad.addColorStop(0, 'rgba(5,6,10,0)')
    bottomGrad.addColorStop(0.72, 'rgba(7,8,13,0.48)')
    bottomGrad.addColorStop(1, 'rgba(3,4,8,0.9)')
    ctx.fillStyle = bottomGrad
    ctx.fillRect(0, h * 0.5, w, h * 0.5)

    // 左右角金色折线纹样，保持轻量但强化大厅边框感。
    ctx.save()
    ctx.strokeStyle = 'rgba(231,192,95,0.38)'
    ctx.lineWidth = 1.5
    this._drawCornerFlourish(ctx, 18, this.topBarH + 12, 1)
    this._drawCornerFlourish(ctx, w - 18, this.topBarH + 12, -1)
    ctx.restore()
  }

  _drawCornerFlourish(ctx, x, y, direction) {
    ctx.beginPath()
    ctx.moveTo(x, y + 22)
    ctx.lineTo(x, y)
    ctx.lineTo(x + 54 * direction, y)
    ctx.lineTo(x + 64 * direction, y + 9)
    ctx.lineTo(x + 89 * direction, y + 9)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x + 7 * direction, y + 7, 3, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(245,207,104,0.55)'
    ctx.fill()
  }

  _renderParticles(ctx) {
    ctx.save()
    this.particles.forEach(p => {
      const y = p.baseY + Math.sin(this.animT * p.speed + p.phase) * 11
      const alpha = 0.16 + (Math.sin(this.animT * 0.7 + p.phase) + 1) * 0.09
      ctx.beginPath()
      ctx.arc(p.x, y, p.r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255,217,112,${alpha})`
      ctx.fill()
    })
    ctx.restore()
  }

  _renderTopBar(ctx) {
    const w = this.game.width
    const avatarSize = this.avatarSize
    const cx = this.leftPad + avatarSize / 2
    const cy = this.topBarY + this.topBarH / 2

    // 头像外圈：暗金底环 + 明金内环 + 顶部高光。
    ctx.beginPath()
    ctx.arc(cx, cy, avatarSize / 2 + 5, 0, Math.PI * 2)
    const ringGrad = ctx.createLinearGradient(cx, cy - avatarSize / 2, cx, cy + avatarSize / 2)
    ringGrad.addColorStop(0, '#fff0a8')
    ringGrad.addColorStop(0.38, '#c9952e')
    ringGrad.addColorStop(1, '#6f4513')
    ctx.fillStyle = ringGrad
    ctx.fill()
    ctx.strokeStyle = '#3c260d'
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, avatarSize / 2, 0, Math.PI * 2)
    ctx.clip()
    if (this.avatarImg) {
      ctx.drawImage(this.avatarImg, cx - avatarSize / 2, cy - avatarSize / 2, avatarSize, avatarSize)
    } else {
      const avatarGrad = ctx.createLinearGradient(0, cy - avatarSize / 2, 0, cy + avatarSize / 2)
      avatarGrad.addColorStop(0, '#343948')
      avatarGrad.addColorStop(1, '#171a22')
      ctx.fillStyle = avatarGrad
      ctx.fillRect(cx - avatarSize / 2, cy - avatarSize / 2, avatarSize, avatarSize)
    }
    ctx.restore()

    ctx.strokeStyle = 'rgba(255,242,188,0.85)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(cx, cy, avatarSize / 2 + 1.5, Math.PI * 1.08, Math.PI * 1.86)
    ctx.stroke()

    const nicknameX = cx + avatarSize / 2 + 13
    const nicknameMaxW = Math.max(70, w * 0.31)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.font = `bold ${Math.max(16, Math.min(21, Math.round(this.topBarH * 0.27)))}px sans-serif`
    ctx.fillStyle = 'rgba(0,0,0,0.72)'
    ctx.fillText(this.playerNickname, nicknameX + 1, cy + 2, nicknameMaxW)
    ctx.fillStyle = '#fff5d3'
    ctx.fillText(this.playerNickname, nicknameX, cy, nicknameMaxW)
    ctx.fillStyle = '#caa95d'
    ctx.font = `${Math.max(10, Math.round(this.topBarH * 0.15))}px sans-serif`
    ctx.fillText('乱世英豪', nicknameX, cy + avatarSize * 0.32, nicknameMaxW)

  }

  _renderSectionTitle(ctx) {
    const y = this.heroRowY - Math.max(9, Math.round(this.cardW * 0.12))
    const cx = this.game.width / 2
    const lineW = Math.min(82, this.game.width * 0.11)
    ctx.strokeStyle = 'rgba(224,185,86,0.58)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(cx - 128, y)
    ctx.lineTo(cx - 128 + lineW, y)
    ctx.moveTo(cx + 128 - lineW, y)
    ctx.lineTo(cx + 128, y)
    ctx.stroke()
    ctx.fillStyle = '#efd68d'
    ctx.font = `bold ${Math.max(13, Math.min(18, Math.round(this.cardW * 0.18)))}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('麾 下 名 将', cx, y)
  }

  // 五名武将展示行；抽卡翻牌动画进行中时由 _renderPullEffect 接管卡片绘制
  _renderHeroRow(ctx) {
    if (this.pull) return

    const w = this.game.width
    const n = HERO_NAMES.length
    const { cardW, cardH, cardGap } = this
    const totalW = cardW * n + cardGap * (n - 1)
    const startX = w / 2 - totalW / 2
    const y = this.heroRowY
    this.cardRects = []

    HERO_NAMES.forEach((name, i) => {
      const x = startX + i * (cardW + cardGap)
      const pressed = this.pressedCard === name
      this._renderHeroCard(ctx, name, x, y, cardW, cardH, {
        scale: pressed ? 0.965 : 1
      })
      this.cardRects.push({ id: name, x, y, w: cardW, h: cardH })
    })
  }

  // 炉石风格武将卡：双层描边、立绘渐隐、金色名条及品质色线。
  _renderHeroCard(ctx, name, x, y, cardW, cardH, opts) {
    opts = opts || {}
    const color = HERO_RARITY_COLOR[name] || '#e8c96a'
    const r = Math.max(7, Math.round(cardW * 0.1))
    const scale = opts.scale === undefined ? 1 : opts.scale

    ctx.save()
    const cx = x + cardW / 2
    const cy = y + cardH / 2
    ctx.translate(cx, cy)
    if (opts.scaleX !== undefined) ctx.scale(opts.scaleX, 1)
    ctx.scale(scale, scale)
    ctx.translate(-cx, -cy)

    // 柔和投影与厚重卡底。
    ctx.fillStyle = 'rgba(0,0,0,0.4)'
    ctx.beginPath()
    ctx.ellipse(x + cardW / 2, y + cardH + 5, cardW * 0.43, Math.max(4, cardW * 0.08), 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#171920'
    this._roundRect(ctx, x, y, cardW, cardH, r)
    ctx.fill()

    const portraitH = cardH * 0.62
    const infoY = y + portraitH
    const infoH = cardH - portraitH

    ctx.save()
    this._roundRect(ctx, x + 3, y + 3, cardW - 6, portraitH + 4, Math.max(4, r - 2))
    ctx.clip()
    const portraitBg = ctx.createLinearGradient(0, y, 0, infoY)
    portraitBg.addColorStop(0, '#2b2d38')
    portraitBg.addColorStop(1, '#0d0f15')
    ctx.fillStyle = portraitBg
    ctx.fillRect(x, y, cardW, portraitH + 5)

    const img = this.heroImgs[name]
    if (img) {
      const pad = Math.max(4, cardW * 0.05)
      const innerW = cardW - pad * 2
      const innerH = portraitH - pad * 0.6
      const imgScale = Math.min(innerW / img.width, innerH / img.height)
      const dw = img.width * imgScale
      const dh = img.height * imgScale
      ctx.drawImage(img, x + (cardW - dw) / 2, y + portraitH - dh, dw, dh)
    }

    const fadeGrad = ctx.createLinearGradient(0, y + portraitH * 0.52, 0, y + portraitH)
    fadeGrad.addColorStop(0, 'rgba(15,17,23,0)')
    fadeGrad.addColorStop(1, 'rgba(15,17,23,0.96)')
    ctx.fillStyle = fadeGrad
    ctx.fillRect(x, y + portraitH * 0.5, cardW, portraitH * 0.5)

    ctx.save()
    ctx.globalAlpha = 0.07
    ctx.fillStyle = '#ffffff'
    ctx.translate(x, y)
    ctx.rotate(-Math.PI / 7)
    ctx.fillRect(-cardW * 0.32, -cardH * 0.2, cardW * 0.42, cardH * 1.3)
    ctx.restore()
    ctx.restore()

    // 信息区：暗金名条与品质线。
    const infoGrad = ctx.createLinearGradient(0, infoY, 0, y + cardH)
    infoGrad.addColorStop(0, '#312711')
    infoGrad.addColorStop(0.42, '#171920')
    infoGrad.addColorStop(1, '#0d0f14')
    ctx.fillStyle = infoGrad
    ctx.fillRect(x + 3, infoY, cardW - 6, infoH - 3)

    ctx.fillStyle = '#f0d58a'
    ctx.font = `bold ${Math.max(11, Math.round(cardW * 0.16))}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(HERO_CN_NAME[name] || name, x + cardW / 2, infoY + infoH * 0.3)

    ctx.fillStyle = color
    ctx.fillRect(x + cardW * 0.18, infoY + infoH * 0.5, cardW * 0.64, Math.max(2, cardH * 0.018))

    // 外层深色厚边 + 内层品质色描边。
    ctx.strokeStyle = '#111218'
    ctx.lineWidth = Math.max(3, cardW * 0.045)
    this._roundRect(ctx, x, y, cardW, cardH, r)
    ctx.stroke()
    ctx.strokeStyle = color
    ctx.lineWidth = Math.max(2, cardW * 0.028)
    this._roundRect(ctx, x + 3, y + 3, cardW - 6, cardH - 6, Math.max(4, r - 2))
    ctx.stroke()
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x + r, y + 2)
    ctx.lineTo(x + cardW - r, y + 2)
    ctx.stroke()
    ctx.restore()
  }

  // 横向关卡选择器：仅绘制视口内卡片，关卡 1..level-1 已通关、level 为当前、其后锁定。
  _renderLevelSelector(ctx) {
    const view = this.levelViewport
    const cardY = view.y + (view.h - this.levelCardH) / 2
    const first = Math.max(0, Math.floor((this.scrollOffset - this.levelSidePad) / this.levelCardStep) - 1)
    const last = Math.min(LEVEL_COUNT - 1, Math.ceil((this.scrollOffset + view.w - this.levelSidePad) / this.levelCardStep) + 1)

    ctx.save()
    ctx.beginPath()
    ctx.rect(view.x, view.y, view.w, view.h)
    ctx.clip()

    for (let i = first; i <= last; i++) {
      const level = i + 1
      const x = view.x + this.levelSidePad + i * this.levelCardStep - this.scrollOffset
      this._renderLevelCard(ctx, level, x, cardY, this.levelCardW, this.levelCardH)
    }
    ctx.restore()

    const titleY = view.y - Math.max(10, Math.round(this.game.height * 0.018))
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `bold ${Math.max(13, Math.min(18, this.levelCardH * 0.2))}px sans-serif`
    ctx.fillStyle = '#f2d889'
    ctx.fillText('选 择 关 卡', this.game.width / 2, titleY)

    // 视口两侧渐隐提示横向仍有内容。
    const fadeW = Math.min(32, view.w * 0.08)
    if (this.scrollOffset > 0) {
      const leftFade = ctx.createLinearGradient(view.x, 0, view.x + fadeW, 0)
      leftFade.addColorStop(0, 'rgba(6,8,12,0.78)')
      leftFade.addColorStop(1, 'rgba(6,8,12,0)')
      ctx.fillStyle = leftFade
      ctx.fillRect(view.x, view.y, fadeW, view.h)
    }
    if (this.scrollOffset < this.maxScroll) {
      const rightFade = ctx.createLinearGradient(view.x + view.w - fadeW, 0, view.x + view.w, 0)
      rightFade.addColorStop(0, 'rgba(6,8,12,0)')
      rightFade.addColorStop(1, 'rgba(6,8,12,0.78)')
      ctx.fillStyle = rightFade
      ctx.fillRect(view.x + view.w - fadeW, view.y, fadeW, view.h)
    }
  }

  _renderLevelCard(ctx, level, x, y, w, h) {
    const cleared = level < this.level
    const current = level === this.level
    const locked = level > this.level
    const radius = Math.max(9, Math.min(16, h * 0.12))
    const pulse = (Math.sin(this.animT * 3.4) + 1) / 2

    ctx.save()
    if (locked) ctx.globalAlpha = 0.48

    ctx.fillStyle = 'rgba(0,0,0,0.42)'
    this._roundRect(ctx, x + 2, y + 5, w, h, radius)
    ctx.fill()

    const grad = ctx.createLinearGradient(0, y, 0, y + h)
    if (current) {
      grad.addColorStop(0, '#514323')
      grad.addColorStop(1, '#17150f')
    } else if (cleared) {
      grad.addColorStop(0, '#263329')
      grad.addColorStop(1, '#111914')
    } else {
      grad.addColorStop(0, '#30323a')
      grad.addColorStop(1, '#15171c')
    }
    ctx.fillStyle = grad
    this._roundRect(ctx, x, y, w, h, radius)
    ctx.fill()

    ctx.strokeStyle = current ? `rgba(255,214,102,${0.72 + pulse * 0.28})` : (cleared ? '#b99647' : '#646873')
    ctx.lineWidth = current ? 3 + pulse * 1.5 : 2
    this._roundRect(ctx, x, y, w, h, radius)
    ctx.stroke()
    if (current) {
      ctx.strokeStyle = `rgba(255,205,72,${0.12 + pulse * 0.22})`
      ctx.lineWidth = 7 + pulse * 3
      this._roundRect(ctx, x + 2, y + 2, w - 4, h - 4, Math.max(6, radius - 2))
      ctx.stroke()
    }

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `bold ${Math.max(22, Math.min(40, h * 0.34))}px sans-serif`
    ctx.fillStyle = locked ? '#a6a9b0' : '#fff1bd'
    ctx.fillText(`第${level}关`, x + w / 2, y + h * (cleared ? 0.42 : 0.51))

    if (cleared) {
      const badgeW = Math.min(w - 18, Math.max(62, w * 0.62))
      const badgeH = Math.max(19, Math.min(28, h * 0.23))
      const badgeX = x + (w - badgeW) / 2
      const badgeY = y + h - badgeH - Math.max(7, h * 0.07)
      ctx.fillStyle = '#b8871e'
      this._roundRect(ctx, badgeX, badgeY, badgeW, badgeH, badgeH / 2)
      ctx.fill()
      ctx.fillStyle = '#fff4c7'
      ctx.font = `bold ${Math.max(11, Math.min(15, badgeH * 0.58))}px sans-serif`
      ctx.fillText('✓ 已通关', x + w / 2, badgeY + badgeH / 2 + 0.5)
    } else if (locked) {
      this._drawLock(ctx, x + w / 2, y + h * 0.76, Math.max(8, Math.min(13, h * 0.11)))
    } else {
      ctx.fillStyle = '#e8c761'
      ctx.font = `bold ${Math.max(10, Math.min(14, h * 0.13))}px sans-serif`
      ctx.fillText('当前关卡', x + w / 2, y + h * 0.78)
    }
    ctx.restore()
  }

  // 底部横排导航：栏底色与顶部玩家栏主色一致，按钮本身保持透明。
  _renderBottomNav(ctx) {
    const w = this.game.width
    const h = this.game.height
    const firstRect = this.navRects[0]
    const firstLabelH = Math.max(20, firstRect.h * 0.25)
    const firstIconSize = Math.max(38, Math.min(firstRect.w - 10, firstRect.h - firstLabelH - 4))
    const firstIconY = firstRect.y
    const dividerY = firstIconY + firstIconSize * 0.5

    ctx.save()
    const navGrad = ctx.createLinearGradient(0, dividerY, 0, h)
    navGrad.addColorStop(0, 'rgba(8,10,15,0.92)')
    navGrad.addColorStop(0.72, 'rgba(15,17,24,0.72)')
    navGrad.addColorStop(1, 'rgba(15,17,24,0)')
    ctx.fillStyle = navGrad
    ctx.fillRect(0, dividerY, w, h - dividerY)

    // 先绘制分隔线，再绘制图标和文字，使按钮内容覆盖在线之上。
    ctx.strokeStyle = 'rgba(229,190,91,0.48)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, dividerY)
    ctx.lineTo(w, dividerY)
    ctx.stroke()

    this.navRects.forEach(rect => {
      const active = NAV_PANEL[rect.id] === this.panel
      const labelH = Math.max(20, rect.h * 0.25)
      const iconSize = Math.max(38, Math.min(rect.w - 10, rect.h - labelH - 4))
      const iconX = rect.x + (rect.w - iconSize) / 2
      const iconY = rect.y
      const img = this.navImgs[rect.id]
      if (img) {
        ctx.drawImage(img, iconX, iconY, iconSize, iconSize)
      }

      ctx.fillStyle = active ? '#ffe49a' : '#e7d8ae'
      ctx.font = `bold ${Math.max(11, Math.min(14, rect.w * 0.18))}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(rect.label, rect.x + rect.w / 2, rect.y + rect.h - labelH / 2)
    })
    ctx.restore()
  }

  _drawLock(ctx, cx, cy, size) {
    ctx.strokeStyle = '#d3d5db'
    ctx.lineWidth = Math.max(2, size * 0.2)
    ctx.beginPath()
    ctx.arc(cx, cy - size * 0.42, size * 0.55, Math.PI, 0)
    ctx.stroke()
    ctx.fillStyle = '#b6b9c1'
    this._roundRect(ctx, cx - size * 0.75, cy - size * 0.35, size * 1.5, size * 1.15, size * 0.18)
    ctx.fill()
    ctx.fillStyle = '#555861'
    ctx.beginPath()
    ctx.arc(cx, cy + size * 0.12, size * 0.14, 0, Math.PI * 2)
    ctx.fill()
  }

  // 抽卡翻牌特效：单张卡片 scaleX 0.1->1 的 ease-out-back 翻转 + 落地闪光，完成后展示获得碎片的结果文字
  _renderPullEffect(ctx) {
    if (!this.pull) return
    const p = this.pull
    const w = this.game.width

    const cardW = this.cardW * 1.6
    const cardH = this.cardH * 1.6
    const x = w / 2 - cardW / 2
    const y = this.heroRowY - (cardH - this.cardH) / 2

    let localT = p.phase === 'done' ? PULL_FLIP_DUR : p.t
    localT = Math.max(0, Math.min(PULL_FLIP_DUR, localT))
    const progress = localT / PULL_FLIP_DUR
    const eased = progress > 0 ? this._easeOutBack(progress) : 0
    const scaleX = Math.max(0.1, eased)

    this._renderHeroCard(ctx, p.heroId, x, y, cardW, cardH, {
      scaleX,
      level: this.heroLevel[p.heroId],
      fragments: this.heroFragments[p.heroId] || 0
    })

    if (progress >= 1) {
      const flashAlpha = 1 - Math.min(1, (p.t - PULL_FLIP_DUR) / 0.2)
      if (flashAlpha > 0) {
        ctx.strokeStyle = `rgba(255,215,90,${Math.max(0, flashAlpha) * 0.8})`
        ctx.lineWidth = 5
        this._roundRect(ctx, x - 4, y - 4, cardW + 8, cardH + 8, 14)
        ctx.stroke()
      }
    }

    if (p.phase === 'done') {
      ctx.save()
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = 'bold 20px sans-serif'
      ctx.fillStyle = 'rgba(0,0,0,0.7)'
      ctx.fillText(`获得 ${HERO_CN_NAME[p.heroId]}碎片 x${p.gain}`, w / 2 + 1, y + cardH + 25)
      ctx.fillStyle = '#fff2b7'
      ctx.fillText(`获得 ${HERO_CN_NAME[p.heroId]}碎片 x${p.gain}`, w / 2, y + cardH + 24)
      ctx.restore()
    }
  }

  _renderFx(ctx) {
    this.fx.forEach(f => {
      const progress = f.t / f.dur
      const alpha = Math.max(0, 1 - progress)
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.fillStyle = f.color || '#ff6b6b'
      ctx.font = 'bold 20px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(f.text, f.x, f.y - 14 - progress * 16)
      ctx.restore()
    })
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

  _levelAtPoint(x, y) {
    const view = this.levelViewport
    if (!this.hitRect(x, y, view.x, view.y, view.w, view.h)) return null
    const contentX = x - view.x + this.scrollOffset - this.levelSidePad
    const index = Math.floor(contentX / this.levelCardStep)
    const withinCard = contentX - index * this.levelCardStep
    if (index < 0 || index >= LEVEL_COUNT || withinCard < 0 || withinCard > this.levelCardW) return null
    return index + 1
  }

  _closePanel() {
    this.panel = null
    this.detailHeroId = null
    this.levelTouch = null
    this.heroListRects = []
  }

  _openPanel(panel) {
    this.panel = panel
    this.detailHeroId = null
    this.levelTouch = null
    if (panel === 'levels') this.panelNeedsLevelCenter = true
  }

  onTouch(x, y) {
    if (this.settingsOpen) {
      if (this.settingsCloseRect && this.hitRect(x, y, this.settingsCloseRect.x, this.settingsCloseRect.y, this.settingsCloseRect.w, this.settingsCloseRect.h)) {
        this.settingsOpen = false
      } else if (this.settingsMusicRect && this.hitRect(x, y, this.settingsMusicRect.x, this.settingsMusicRect.y, this.settingsMusicRect.w, this.settingsMusicRect.h)) {
        if (toggleMusic()) playMainBg()
        else {
          stopMainBg()
          stopBattleBg()
        }
      } else if (this.settingsSoundRect && this.hitRect(x, y, this.settingsSoundRect.x, this.settingsSoundRect.y, this.settingsSoundRect.w, this.settingsSoundRect.h)) {
        toggleSound()
      } else if (!this.settingsPanelRect || !this.hitRect(x, y, this.settingsPanelRect.x, this.settingsPanelRect.y, this.settingsPanelRect.w, this.settingsPanelRect.h)) {
        this.settingsOpen = false
      }
      return
    }

    // 面板命中优先于头像、导航和主屏内容，打开时完全暂停底层交互。
    if (this.panel) {
      if (this.panelCloseRect && this.hitRect(x, y, this.panelCloseRect.x, this.panelCloseRect.y, this.panelCloseRect.w, this.panelCloseRect.h)) {
        this._closePanel()
        return
      }
      if (this.panel === 'heroList') {
        const card = this.heroListRects.find(rect => this.hitRect(x, y, rect.x, rect.y, rect.w, rect.h))
        if (card) {
          this.detailHeroId = card.id
          this.panel = 'heroDetail'
        }
        return
      }
      if (this.panel === 'levels' && this.hitRect(x, y, this.levelViewport.x, this.levelViewport.y, this.levelViewport.w, this.levelViewport.h)) {
        this.levelTouch = { startX: x, startY: y, startOffset: this.scrollOffset, moved: false }
      }
      return
    }

    const avatarCx = this.leftPad + this.avatarSize / 2
    const avatarCy = this.topBarY + this.topBarH / 2
    if (Math.hypot(x - avatarCx, y - avatarCy) <= this.avatarSize / 2 + 5) {
      this.levelTouch = null
      this.settingsOpen = true
      return
    }

    if (this.pull) return
    const nav = this.navRects.find(rect => this.hitRect(x, y, rect.x, rect.y, rect.w, rect.h))
    if (nav) {
      this.levelTouch = null
      this._openPanel(NAV_PANEL[nav.id])
      return
    }
  }

  onTouchMove(x, y) {
    if (this.panel !== 'levels' || !this.levelTouch) return
    const dx = x - this.levelTouch.startX
    const dy = y - this.levelTouch.startY
    if (!this.levelTouch.moved && Math.hypot(dx, dy) >= LEVEL_DRAG_THRESHOLD) {
      this.levelTouch.moved = true
    }
    if (this.levelTouch.moved) {
      this.scrollOffset = this._clampLevelScroll(this.levelTouch.startOffset - dx)
    }
  }

  onTouchEnd(x, y) {
    if (this.panel !== 'levels' || !this.levelTouch) return
    const touch = this.levelTouch
    this.levelTouch = null

    if (touch.moved) {
      // 松手后吸附到最近的关卡，使卡片稳定居中。
      this.scrollOffset = this._clampLevelScroll(Math.round(this.scrollOffset / this.levelCardStep) * this.levelCardStep)
      return
    }

    const selectedLevel = this._levelAtPoint(x, y)
    if (selectedLevel === null) return
    if (selectedLevel > this.level) {
      this.fx.push({ x, y, t: 0, dur: GACHA_TOAST_DUR, text: '未解锁', color: '#d7d9df' })
      return
    }
    this.game.switch('home', { level: selectedLevel })
  }
}
