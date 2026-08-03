import { Scene } from './scene.js'
import {
  gameData,
  getUpgradeCost,
  capOf,
  canUpgrade,
  upgradeBuilding,
  buildingDesc,
  RECRUIT_COST,
  RECRUIT_COST_TEN,
  recruitOnce,
  recruitTen,
  campaignChapters,
  campaignStages,
  isStageUnlocked,
  shopGoods,
  canBuyShopItem,
  buyShopItem,
  HERO_IDS,
  HERO_META,
  FACTION_COLOR,
  heroUpgradeCost,
  canUpgradeHero,
  upgradeHero,
  isSoundOn,
  isMusicOn,
  toggleSound,
  toggleMusic,
  TITLE_LIST,
  QUALITY_META,
  getTitleById,
  titleEffectDesc,
  equipTitle,
  isTitleOwned,
  EQUIP_LIST,
  getEquipById,
  equipEffectDesc,
  canBuyEquip,
  buyEquip,
  ownedEquipCount,
  equipToHero,
  unequipHero,
  isEquipUsableByHero,
  WEAPON_TYPE_META,
  HERO_UNLOCK_SHARDS,
  canUnlockHero,
  unlockHero,
  BATTLE_ROSTER,
  saveGame,
  computePower
} from '../data.js'
import { playMainBg, stopMainBg } from '../audio.js'

// 主城场景：背景铺满 + 顶部金币栏 + 中部建筑热区 + 建筑详情弹窗 + 底部功能栏（商店/背包/招募/英雄/出征）
export class MainCityScene extends Scene {
  constructor(game, params) {
    super(game)
    // 战斗结算后返回：openCampaign 为 true 时 enter() 自动打开出征关卡列表弹窗
    this.openCampaign = !!(params && params.openCampaign)
  }

  enter() {
    const w = this.game.width
    const h = this.game.height

    // 顶部资源栏与底部功能栏高度
    this.topBarH = 56
    this.bottomBarH = 90

    // 进入主城：播放主城背景音乐（若音乐开关关闭则不播放）
    playMainBg()

    // 图片清单：[缓存key, 路径]
    this.imgList = [
      ['bg', 'assets/bg_maincity.jpg'],
      ['icon_gold', 'assets/icon_gold.png'],
      ['icon_shop', 'assets/icon_shop.png'],
      ['btn_recruit', 'assets/btn_recruit.png'],
      ['btn_expedition', 'assets/btn_expedition.png'],
      ['btn_bag', 'assets/btn_bag.png'],
      ['btn_hero', 'assets/btn_hero.png'],
      ...HERO_IDS.map(id => ['hero_' + id, `assets/hero/${id}.png`])
    ]
    this.imgs = {}
    this.loadedCount = 0
    this.ready = false
    this._loadImages()

    // 建筑热区
    this._buildHotzones()

    // 弹窗与提示状态
    this.dialog = null      // 当前打开的弹窗 id（建筑 id / 'player' / 'recruit' / 'campaign' / 'shopgoods' / 'bag' / 'hero' / 'team'）
    this.pendingStage = null    // 出战编队弹窗：等待确认出征的关卡 { id, name }
    this.teamSelected = []      // 出战编队弹窗：当前已选英雄id列表（1~4人）
    this.teamHeroBtns = null    // 出战编队弹窗内英雄卡片热区列表（绘制时更新）
    this.toast = null       // { text, expire(秒) }
    this.elapsed = 0        // 场景累计时间（秒）
    this.recruitResult = null   // 招募结果：单抽 { heroId } 或十连 { heroIds: [] }
    this.campaignLevels = null  // 出征弹窗内关卡热区列表（绘制时更新，仅含已解锁关卡）
    this.campaignScroll = 0     // 出征弹窗列表滚动偏移
    this._campaignMaxScroll = 0 // 出征弹窗列表最大滚动距离（绘制时计算）
    this._campaignScrollPending = false // 出征弹窗是否需要在下次绘制时自动滚动到最新解锁关卡（仅弹窗打开时触发一次）
    this.heroScroll = 0         // 英雄弹窗列表滚动偏移
    this._heroMaxScroll = 0     // 英雄弹窗列表最大滚动距离（绘制时计算）
    this.titleScroll = 0        // 称号弹窗列表滚动偏移
    this._titleMaxScroll = 0    // 称号弹窗列表最大滚动距离（绘制时计算）
    this.shopBuyBtns = null     // 商店弹窗内商品购买按钮热区（绘制时更新）
    this.shopTabBtns = null     // 商店弹窗分页按钮热区（绘制时更新）
    this.shopTab = 'goods'      // 商店弹窗当前分页：'goods'(道具) / 'equip'(装备)
    this.shopScroll = 0         // 商店弹窗列表滚动偏移
    this._shopMaxScroll = 0     // 商店弹窗列表最大滚动距离（绘制时计算）
    this.heroUpgradeBtns = null // 英雄弹窗内升级按钮热区（绘制时更新）
    this.heroEquipBtns = null   // 英雄弹窗内"装备"按钮热区（绘制时更新）
    this.heroUnlockBtns = null  // 英雄弹窗内"兑换"按钮热区（绘制时更新）
    this.titleRows = null       // 称号弹窗内每行热区（绘制时更新，点击装备）
    this.equipHeroId = null     // 当前打开装备弹窗所属的英雄 id
    this.equipRows = null       // 装备弹窗内每行热区（绘制时更新，点击装备/卸下）
    this.equipScroll = 0        // 装备弹窗列表滚动偏移
    this._equipMaxScroll = 0    // 装备弹窗列表最大滚动距离（绘制时计算）
    this.bagScroll = 0          // 背包弹窗列表滚动偏移
    this._bagMaxScroll = 0      // 背包弹窗列表最大滚动距离（绘制时计算）
    this._touchStart = null     // 触摸起点信息 { x, y, target }
    this._touchMoved = false    // 触摸是否已移动超过阈值（区分点击与拖动）
    this._lastTouchY = 0       // 上次触摸 Y 坐标（计算增量）

    // 战斗结算后带 openCampaign 标记返回：自动打开出征关卡列表弹窗
    if (this.openCampaign) {
      this.dialog = 'campaign'
      this.campaignScroll = 0
      this._campaignScrollPending = true
      this.openCampaign = false
    }
  }

  // 离开主城场景：停止主城背景音乐，销毁音频上下文，避免切场景后多实例叠加播放
  leave() {
    stopMainBg()
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
      // 加载失败也计数，避免卡在 loading；打印 key 方便排查具体哪张图未加载成功
      img.onerror = () => { console.error('[MainCity] 图片加载失败:', key, path); finish() }
      img.src = path
    })
  }

  // 计算建筑热区矩形：根据屏幕尺寸按比例布局
  _buildHotzones() {
    const w = this.game.width
    const h = this.game.height
    const midTop = this.topBarH + 8
    const midBot = h - this.bottomBarH - 8
    const midH = midBot - midTop
    const upperY = midTop + midH * 0.30
    const lowerY = midTop + midH * 0.74
    const bw = Math.max(96, w * 0.11)
    const bh = Math.max(92, h * 0.15)
    const big = 1.35

    // 建筑定义：id 对应 data.js，cx 为横向比例，cy 为屏幕纵坐标
    // tavern/drillground/campaign/shop 为功能入口（分别跳转 招募/英雄/出征/商店 弹窗），不走通用升级弹窗
    const defs = [
      { id: 'maincity', name: '主城', cx: 0.50, cy: upperY, big: true },
      { id: 'farm', name: '农田', cx: 0.29, cy: upperY },
      { id: 'iron', name: '铁矿', cx: 0.71, cy: upperY },
      { id: 'drillground', name: '校场', cx: 0.09, cy: upperY },
      { id: 'campaign', name: '出征大厅', cx: 0.91, cy: upperY },
      { id: 'barracks', name: '兵营', cx: 0.22, cy: lowerY },
      { id: 'tavern', name: '酒馆', cx: 0.55, cy: lowerY },
      { id: 'shop', name: '商店', cx: 0.84, cy: lowerY }
    ]
    this.buildings = defs.map(d => {
      const sc = d.big ? big : 1
      const w0 = bw * sc
      const h0 = bh * sc
      return {
        id: d.id,
        name: d.name,
        x: d.cx * w - w0 / 2,
        y: d.cy * h - h0 / 2,
        w: w0,
        h: h0
      }
    })
  }

  // 弹窗面板尺寸：不同弹窗高度不同（招募/出征/英雄内容更多，需更高）
  _panelSize() {
    const w = this.game.width
    const h = this.game.height
    const dw = Math.min(460, w - 48)
    if (this.dialog === 'recruit') return { dw, dh: Math.min(490 + this._recruitResultExtraH(), h - 70) }
    if (this.dialog === 'campaign') return { dw, dh: Math.min(520, h - 60) }
    if (this.dialog === 'shopgoods') return { dw, dh: Math.min(460, h - 70) }
    if (this.dialog === 'hero') return { dw, dh: Math.min(520, h - 60) }
    if (this.dialog === 'equip') return { dw, dh: Math.min(480, h - 70) }
    if (this.dialog === 'title') return { dw, dh: Math.min(480, h - 70) }
    if (this.dialog === 'bag') return { dw, dh: Math.min(480, h - 70) }
    if (this.dialog === 'team') return { dw, dh: Math.min(520, h - 60) }
    // 人物介绍弹窗：昵称 + 称号 + 更换称号按钮，面板较矮
    if (this.dialog === 'player') return { dw, dh: Math.min(280, h - 120) }
    return { dw, dh: Math.min(360, h - 120) }
  }

  // 弹窗面板矩形（居中）
  _dialogPanel() {
    const w = this.game.width
    const h = this.game.height
    const { dw, dh } = this._panelSize()
    return { x: (w - dw) / 2, y: (h - dh) / 2, w: dw, h: dh }
  }

  // 弹窗内按钮矩形（单按钮弹窗通用：建筑升级 / 关闭）
  _dialogBtns() {
    const p = this._dialogPanel()
    const close = { x: p.x + p.w - 38, y: p.y + 8, w: 28, h: 28 }
    const upg = { x: p.x + p.w / 2 - 70, y: p.y + p.h - 56, w: 140, h: 42 }
    return { close, upgrade: upg }
  }

  // 招募结果所占行数：单抽 1 行；十连按每行至多 5 项换行；无结果时 0 行
  _recruitResultLineCount() {
    if (!this.recruitResult) return 0
    if (this.recruitResult.heroId) return 1
    const counts = {}
    this.recruitResult.heroIds.forEach(id => { counts[id] = (counts[id] || 0) + 1 })
    const itemCount = HERO_IDS.filter(id => counts[id]).length
    const perLine = 5
    return Math.max(1, Math.ceil(itemCount / perLine))
  }

  // 招募结果区域需要额外预留的弹窗高度（超过默认 1 行时按行数补足）
  _recruitResultExtraH() {
    const lines = this._recruitResultLineCount()
    const lineH = 17
    return Math.max(0, (lines - 1)) * lineH
  }

  // 招募弹窗底部双按钮矩形（招募一次 / 招募十次）
  _recruitBtns() {
    const p = this._dialogPanel()
    const close = { x: p.x + p.w - 38, y: p.y + 8, w: 28, h: 28 }
    const gap = 12
    const btnW = (p.w - 40 - gap) / 2
    const btnH = 46
    const y = p.y + p.h - 58
    return {
      close,
      once: { x: p.x + 20, y, w: btnW, h: btnH },
      ten: { x: p.x + 20 + btnW + gap, y, w: btnW, h: btnH }
    }
  }

  // 出战编队弹窗底部双按钮矩形（取消 / 出战）
  _teamBtns() {
    const p = this._dialogPanel()
    const close = { x: p.x + p.w - 38, y: p.y + 8, w: 28, h: 28 }
    const gap = 12
    const btnW = (p.w - 40 - gap) / 2
    const btnH = 46
    const y = p.y + p.h - 58
    return {
      close,
      cancel: { x: p.x + 20, y, w: btnW, h: btnH },
      confirm: { x: p.x + 20 + btnW + gap, y, w: btnW, h: btnH }
    }
  }

  update(dt) {
    this.elapsed += dt
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

  // 通用列表滚动条：轨道 + 滑块，仅在内容溢出（maxScroll > 0）时绘制
  // 加宽滑块并提高不透明度，避免像之前那样细到几乎看不见
  _drawScrollbar(ctx, listX, listY, listW, listH, scroll, maxScroll, totalH) {
    if (maxScroll <= 0) return
    const barW = 6
    const bx = listX + listW - barW
    // 轨道（半透明底条，标出可滚动区域范围）
    ctx.fillStyle = 'rgba(255,255,255,0.10)'
    this._roundRect(ctx, bx, listY, barW, listH, barW / 2)
    ctx.fill()
    // 滑块（高亮金色，尺寸按可见区域占总内容比例计算）
    const thumbH = Math.max(28, listH * (listH / totalH))
    const thumbY = listY + (scroll / maxScroll) * (listH - thumbH)
    ctx.fillStyle = 'rgba(232,201,106,0.9)'
    this._roundRect(ctx, bx, thumbY, barW, thumbH, barW / 2)
    ctx.fill()
  }

  // 按字符宽度换行，仅计算不绘制，供需要预先算出行数（从而确定所需高度）的场景使用
  // 使用当前 ctx.font 测量，调用前需先设置好字号
  _wrapLines(ctx, text, maxW) {
    const lines = []
    let line = ''
    for (const ch of text) {
      const test = line + ch
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line)
        line = ch
      } else {
        line = test
      }
    }
    if (line) lines.push(line)
    return lines
  }

  // 简单的按字符换行绘制
  _drawTextWrapped(ctx, text, x, y, maxW, lineH) {
    const lines = this._wrapLines(ctx, text, maxW)
    lines.forEach((line, i) => ctx.fillText(line, x, y + i * lineH))
    return y + (lines.length - 1) * lineH
  }

  // 数字千分位格式化
  _fmt(n) {
    return Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
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

    // 背景：保持比例居中裁剪铺满（cover）
    this._drawBg(ctx)

    // 顶部资源栏
    this._drawTopBar(ctx)

    // 中部建筑热区与徽标
    this._drawBuildings(ctx)

    // 底部功能栏
    this._drawBottomBar(ctx)

    // 各类弹窗
    if (this.dialog === 'player') this._drawCharDialog(ctx)
    else if (this.dialog === 'settings') this._drawSettingsDialog(ctx)
    else if (this.dialog === 'recruit') this._drawRecruitDialog(ctx)
    else if (this.dialog === 'campaign') this._drawCampaignDialog(ctx)
    else if (this.dialog === 'shopgoods') this._drawShopDialog(ctx)
    else if (this.dialog === 'bag') this._drawBagDialog(ctx)
    else if (this.dialog === 'hero') this._drawHeroDialog(ctx)
    else if (this.dialog === 'equip') this._drawEquipDialog(ctx)
    else if (this.dialog === 'title') this._drawTitleDialog(ctx)
    else if (this.dialog === 'team') this._drawTeamDialog(ctx)
    else if (this.dialog) this._drawDialog(ctx)

    // 提示 toast
    this._drawToast(ctx)
  }

  _drawBg(ctx) {
    const w = this.game.width
    const h = this.game.height
    const img = this.imgs.bg
    if (!img || !img.width) {
      ctx.fillStyle = '#1a2332'
      ctx.fillRect(0, 0, w, h)
      return
    }
    const iw = img.width
    const ih = img.height
    const scale = Math.max(w / iw, h / ih)
    const dw = iw * scale
    const dh = ih * scale
    const dx = (w - dw) / 2
    const dy = (h - dh) / 2
    ctx.drawImage(img, dx, dy, dw, dh)
  }

  // 占位玩家头像：背景圆 + 金色描边 + 圆内人形简笔画（头与肩）
  _drawAvatar(ctx, cx, cy, r) {
    ctx.fillStyle = '#3a4258'
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#e8c96a'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.clip()
    ctx.fillStyle = '#c9d4e3'
    // 头部小圆
    ctx.beginPath()
    ctx.arc(cx, cy - r * 0.3, r * 0.34, 0, Math.PI * 2)
    ctx.fill()
    // 肩部大圆（下沉，只露弧形）
    ctx.beginPath()
    ctx.arc(cx, cy + r * 0.85, r * 0.78, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // 势力徽标：小圆底色 + 势力单字，绘制在头像右下角
  _drawFactionBadge(ctx, cx, cy, r, faction) {
    ctx.save()
    ctx.fillStyle = FACTION_COLOR[faction] || '#666'
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${Math.round(r * 1.1)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(faction, cx, cy + 1)
    ctx.restore()
  }

  // 代码绘制：背包图标（梯形袋身 + 顶部提手）
  _drawBagIcon(ctx, x, y, s) {
    ctx.save()
    ctx.strokeStyle = '#e8c96a'
    ctx.lineWidth = 2
    ctx.fillStyle = '#3a4a66'
    const bx = x + s * 0.12
    const by = y + s * 0.34
    const bw = s * 0.76
    const bh = s * 0.54
    this._roundRect(ctx, bx, by, bw, bh, 4)
    ctx.fill()
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x + s / 2, y + s * 0.32, s * 0.18, Math.PI, 0)
    ctx.stroke()
    ctx.restore()
  }

  // 代码绘制：头盔图标（弧形盔顶 + 护面横条），代表「英雄」入口
  _drawHelmetIcon(ctx, x, y, s) {
    ctx.save()
    ctx.strokeStyle = '#e8c96a'
    ctx.lineWidth = 2
    ctx.fillStyle = '#3a4a66'
    ctx.beginPath()
    ctx.arc(x + s / 2, y + s * 0.52, s * 0.36, Math.PI, 0)
    ctx.lineTo(x + s * 0.86, y + s * 0.6)
    ctx.lineTo(x + s * 0.14, y + s * 0.6)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x + s * 0.2, y + s * 0.56)
    ctx.lineTo(x + s * 0.8, y + s * 0.56)
    ctx.stroke()
    ctx.restore()
  }

  // 代码绘制：齿轮图标（圆环 + 8 个齿），代表「设置」入口
  _drawGearIcon(ctx, x, y, s) {
    ctx.save()
    const cx = x + s / 2
    const cy = y + s / 2
    const rOuter = s * 0.44
    const rInner = s * 0.24
    ctx.fillStyle = '#e8c96a'
    ctx.beginPath()
    const teeth = 8
    for (let i = 0; i < teeth * 2; i++) {
      const ang = (Math.PI * 2 * i) / (teeth * 2)
      const r = i % 2 === 0 ? rOuter : rOuter * 0.72
      const px = cx + Math.cos(ang) * r
      const py = cy + Math.sin(ang) * r
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#222d3f'
    ctx.beginPath()
    ctx.arc(cx, cy, rInner, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  _drawTopBar(ctx) {
    const barH = 52
    const pad = 8
    const iconSize = 32
    const iconTextGap = 5

    // ---- 左侧玩家信息：圆形头像 + 等级/称号两行文字（可点击）----
    const pX = 60
    const pY = 8
    const ar = 18
    const acx = pX + ar + 4
    const acy = pY + barH / 2
    const tx = acx + ar + 8
    const powerText = `战力 ${this._fmt(computePower())}`
    const titleText = (getTitleById(gameData.player.currentTitle) || TITLE_LIST[0]).name
    ctx.font = 'bold 14px sans-serif'
    const textW = Math.max(ctx.measureText(powerText).width, ctx.measureText(titleText).width)
    const pW = tx - pX + textW + 12
    ctx.fillStyle = 'rgba(50,50,55,0.55)'
    this._roundRect(ctx, pX, pY, pW, barH, 10)
    ctx.fill()
    this._drawAvatar(ctx, acx, acy, ar)
    // 第一行：战力；第二行：称号/职位（白字小号）
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 14px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(powerText, tx, acy - 9)
    ctx.fillText(titleText, tx, acy + 9)
    // 记录头像热区，供点击弹出人物介绍
    this.avatarBtn = { x: pX, y: pY, w: pW, h: barH }

    // ---- 金币栏：紧贴玩家信息栏右侧（左侧区域），避免被右上角抖音退出/分享胶囊按钮遮挡 ----
    const goldText = this._fmt(gameData.resources.gold)
    ctx.font = 'bold 15px sans-serif'
    const totalW = iconSize + iconTextGap + ctx.measureText(goldText).width + pad * 2
    const bx = pX + pW + 10
    const by = 8
    ctx.fillStyle = 'rgba(50,50,55,0.55)'
    this._roundRect(ctx, bx, by, totalW, barH, 10)
    ctx.fill()
    const sx = bx + pad
    const sy = by + (barH - iconSize) / 2
    const img = this.imgs.icon_gold
    if (img) ctx.drawImage(img, sx, sy, iconSize, iconSize)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 15px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(goldText, sx + iconSize + iconTextGap, sy + iconSize / 2)
  }

  _drawBuildings(ctx) {
    this.buildings.forEach(b => {
      const data = gameData.buildings[b.id]
      // 热区淡色高亮（提示可点）
      ctx.fillStyle = 'rgba(255,255,255,0.05)'
      ctx.fillRect(b.x, b.y, b.w, b.h)

      // 名称+等级徽标（热区顶部居中）
      const bw = 92, bh2 = 26
      const bx = b.x + b.w / 2 - bw / 2
      const by = b.y - bh2 - 2
      ctx.fillStyle = 'rgba(20,30,48,0.85)'
      this._roundRect(ctx, bx, by, bw, bh2, 6)
      ctx.fill()
      ctx.strokeStyle = 'rgba(232,201,106,0.6)'
      ctx.lineWidth = 1
      this._roundRect(ctx, bx, by, bw, bh2, 6)
      ctx.stroke()
      ctx.fillStyle = '#e8c96a'
      ctx.font = 'bold 15px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${b.name} Lv.${data.level}`, bx + bw / 2, by + bh2 / 2)

      // 可升级时显示红色升级箭头
      if (canUpgrade(b.id)) {
        ctx.fillStyle = '#ff5b4d'
        ctx.font = 'bold 18px sans-serif'
        ctx.fillText('↑', bx + bw + 8, by + bh2 / 2)
      }
    })
  }

  _drawBottomBar(ctx) {
    const w = this.game.width
    const h = this.game.height
    const px = 8
    const py = h - this.bottomBarH - 8
    const pw = w - 16
    const ph = this.bottomBarH
    // 半透明底板
    ctx.fillStyle = 'rgba(10,18,30,0.62)'
    this._roundRect(ctx, px, py, pw, ph, 10)
    ctx.fill()

    // 5 个底部按钮：商店 / 背包 / 招募 / 英雄 / 出征（背包、英雄为代码绘制图标）
    const btns = [
      { key: 'icon_shop', label: '商店', action: 'shopgoods' },
      { key: 'btn_bag', icon: 'bag', label: '背包', action: 'bag' },
      { key: 'btn_recruit', label: '招募', action: 'recruit' },
      { key: 'btn_hero', icon: 'helmet', label: '英雄', action: 'hero' },
      { key: 'btn_expedition', label: '出征', action: 'campaign' }
    ]
    const slot = pw / btns.length
    // 5 个按钮时槽位变窄，缩小图标与槽位的间隙以保证紧凑排列
    const iconSize = Math.min(44, Math.max(28, slot - 6))
    this.bottomBtns = btns.map((it, i) => {
      const cx = px + slot * i + slot / 2
      const cy = py + ph / 2 - 8
      return {
        ...it,
        x: cx - iconSize / 2,
        y: cy - iconSize / 2,
        w: iconSize,
        h: iconSize,
        cx,
        cy
      }
    })
    this.bottomBtns.forEach(b => {
      const img = b.key ? this.imgs[b.key] : null
      if (img && img.width) {
        // 图片按钮：直接绘制图标
        ctx.drawImage(img, b.x, b.y, b.w, b.h)
      } else {
        // 代码绘制按钮：圆角渐变底 + 金边 + 居中图标（背包/英雄）
        const g = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h)
        g.addColorStop(0, '#3a4a66')
        g.addColorStop(1, '#222d3f')
        ctx.fillStyle = g
        this._roundRect(ctx, b.x, b.y, b.w, b.h, 8)
        ctx.fill()
        ctx.strokeStyle = '#e8c96a'
        ctx.lineWidth = 1.5
        this._roundRect(ctx, b.x, b.y, b.w, b.h, 8)
        ctx.stroke()
        if (b.icon === 'bag') this._drawBagIcon(ctx, b.x, b.y, b.w)
        else if (b.icon === 'helmet') this._drawHelmetIcon(ctx, b.x, b.y, b.w)
      }
      // 所有按钮下方统一标签文字
      ctx.fillStyle = '#c9d4e3'
      ctx.font = '13px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(b.label, b.cx, b.y + b.h + 2)
    })
  }

  _drawDialog(ctx) {
    const p = this._dialogPanel()
    // 遮罩
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.fillRect(0, 0, this.game.width, this.game.height)
    // 面板
    ctx.fillStyle = '#222d3f'
    this._roundRect(ctx, p.x, p.y, p.w, p.h, 12)
    ctx.fill()
    ctx.strokeStyle = '#e8c96a'
    ctx.lineWidth = 2
    this._roundRect(ctx, p.x, p.y, p.w, p.h, 12)
    ctx.stroke()

    const b = gameData.buildings[this.dialog]
    const cost = getUpgradeCost(this.dialog)
    const upg = canUpgrade(this.dialog)

    // 标题栏
    ctx.fillStyle = '#2c3a52'
    this._roundRect(ctx, p.x, p.y, p.w, 44, 12)
    ctx.fill()
    ctx.fillStyle = '#e8c96a'
    ctx.font = 'bold 22px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(b.name, p.x + 18, p.y + 22)
    // 关闭按钮
    const btns = this._dialogBtns()
    ctx.fillStyle = '#b3392b'
    this._roundRect(ctx, btns.close.x, btns.close.y, btns.close.w, btns.close.h, 6)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 20px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('✕', btns.close.x + btns.close.w / 2, btns.close.y + btns.close.h / 2)

    // 当前等级 + 上限
    let ty = p.y + 64
    ctx.fillStyle = '#ffffff'
    ctx.font = '19px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(`当前等级：Lv.${b.level}  （上限 Lv.${capOf(this.dialog)}）`, p.x + 20, ty)

    // 功能说明（换行）
    ty += 36
    ctx.fillStyle = '#c9d4e3'
    ctx.font = '16px sans-serif'
    this._drawTextWrapped(ctx, buildingDesc(this.dialog), p.x + 20, ty, p.w - 40, 22)

    // 升级消耗标题
    ty = p.y + p.h - 110
    ctx.fillStyle = '#e8c96a'
    ctx.font = 'bold 17px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText('升级消耗：', p.x + 20, ty)

    // 消耗金币图标 + 数值（不足红色）
    const cx = p.x + 110
    const cy = ty - 4
    const iconSize = 26
    const val = cost.gold || 0
    const img = this.imgs.icon_gold
    if (img) ctx.drawImage(img, cx, cy, iconSize, iconSize)
    const lack = gameData.resources.gold < val
    ctx.fillStyle = lack ? '#ff5b4d' : '#ffffff'
    ctx.font = 'bold 17px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(`金 ${this._fmt(val)}`, cx + iconSize + 4, cy + iconSize / 2)

    // 升级按钮
    ctx.fillStyle = upg ? '#2e8b57' : '#555f70'
    this._roundRect(ctx, btns.upgrade.x, btns.upgrade.y, btns.upgrade.w, btns.upgrade.h, 8)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 20px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const label = b.level >= capOf(this.dialog) ? '已达等级上限' : '升级'
    ctx.fillText(label, btns.upgrade.x + btns.upgrade.w / 2, btns.upgrade.y + btns.upgrade.h / 2)
  }

  // 人物介绍弹窗（复用建筑弹窗面板与按钮样式）
  _drawCharDialog(ctx) {
    const p = this._dialogPanel()
    // 遮罩
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.fillRect(0, 0, this.game.width, this.game.height)
    // 面板
    ctx.fillStyle = '#222d3f'
    this._roundRect(ctx, p.x, p.y, p.w, p.h, 12)
    ctx.fill()
    ctx.strokeStyle = '#e8c96a'
    ctx.lineWidth = 2
    this._roundRect(ctx, p.x, p.y, p.w, p.h, 12)
    ctx.stroke()

    const pl = gameData.player
    const btns = this._dialogBtns()

    // 标题栏
    ctx.fillStyle = '#2c3a52'
    this._roundRect(ctx, p.x, p.y, p.w, 44, 12)
    ctx.fill()
    ctx.fillStyle = '#e8c96a'
    ctx.font = 'bold 22px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText('人物介绍', p.x + 18, p.y + 22)
    // 关闭按钮
    ctx.fillStyle = '#b3392b'
    this._roundRect(ctx, btns.close.x, btns.close.y, btns.close.w, btns.close.h, 6)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 20px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('✕', btns.close.x + btns.close.w / 2, btns.close.y + btns.close.h / 2)

    // 设置按钮（齿轮图标，关闭按钮左侧），点击打开设置弹窗
    const gearBtn = { x: btns.close.x - 36, y: btns.close.y, w: 28, h: 28 }
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    this._roundRect(ctx, gearBtn.x, gearBtn.y, gearBtn.w, gearBtn.h, 6)
    ctx.fill()
    this._drawGearIcon(ctx, gearBtn.x + 3, gearBtn.y + 3, gearBtn.w - 6)
    this.gearBtn = gearBtn

    // 放大头像（居中）
    const ar = 40
    const acx = p.x + p.w / 2
    const acy = p.y + 44 + 52
    this._drawAvatar(ctx, acx, acy, ar)

    // 昵称（抖音昵称，金色）
    ctx.fillStyle = '#e8c96a'
    ctx.font = 'bold 22px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(pl.nickName, acx, acy + ar + 10)

    // 当前称号（按品质显示对应颜色）
    const curTitle = getTitleById(pl.currentTitle) || TITLE_LIST[0]
    ctx.fillStyle = QUALITY_META[curTitle.quality].color
    ctx.font = 'bold 15px sans-serif'
    ctx.fillText(curTitle.name, acx, acy + ar + 38)

    // 更换称号按钮
    const btnW = 120
    const btnH = 34
    const changeBtn = { x: acx - btnW / 2, y: acy + ar + 62, w: btnW, h: btnH }
    ctx.fillStyle = '#3a4a68'
    this._roundRect(ctx, changeBtn.x, changeBtn.y, changeBtn.w, changeBtn.h, 8)
    ctx.fill()
    ctx.strokeStyle = '#e8c96a'
    ctx.lineWidth = 1
    this._roundRect(ctx, changeBtn.x, changeBtn.y, changeBtn.w, changeBtn.h, 8)
    ctx.stroke()
    ctx.fillStyle = '#e8c96a'
    ctx.font = 'bold 14px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('更换称号', changeBtn.x + btnW / 2, changeBtn.y + btnH / 2)
    this.changeTitleBtn = changeBtn
  }

  // 设置弹窗：音效/音乐开关（点击切换开/关，暂无音频资源，仅存档状态）
  _drawSettingsDialog(ctx) {
    const p = this._dialogPanel()
    this._drawDialogFrame(ctx, '设置')

    const rows = [
      { key: 'sound', label: '音效', on: isSoundOn() },
      { key: 'music', label: '音乐', on: isMusicOn() }
    ]
    const lx = p.x + 24
    const rowH = 52
    let ry = p.y + 64
    const btnW = 64
    const btnH = 34
    this.settingsBtns = []
    rows.forEach(r => {
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 16px sans-serif'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(r.label, lx, ry + rowH / 2)

      const bx = p.x + p.w - 24 - btnW
      const by = ry + (rowH - btnH) / 2
      ctx.fillStyle = r.on ? '#2e8b57' : '#555f70'
      this._roundRect(ctx, bx, by, btnW, btnH, 8)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 15px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(r.on ? '开' : '关', bx + btnW / 2, by + btnH / 2)
      this.settingsBtns.push({ key: r.key, x: bx, y: by, w: btnW, h: btnH })

      ry += rowH
    })
  }

  // 通用弹窗框架：遮罩 + 面板 + 标题栏 + 关闭按钮（招募/出征/商店/背包/英雄弹窗复用，与建筑弹窗样式一致）
  _drawDialogFrame(ctx, title) {
    const p = this._dialogPanel()
    // 遮罩
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.fillRect(0, 0, this.game.width, this.game.height)
    // 面板
    ctx.fillStyle = '#222d3f'
    this._roundRect(ctx, p.x, p.y, p.w, p.h, 12)
    ctx.fill()
    ctx.strokeStyle = '#e8c96a'
    ctx.lineWidth = 2
    this._roundRect(ctx, p.x, p.y, p.w, p.h, 12)
    ctx.stroke()
    // 标题栏
    ctx.fillStyle = '#2c3a52'
    this._roundRect(ctx, p.x, p.y, p.w, 44, 12)
    ctx.fill()
    ctx.fillStyle = '#e8c96a'
    ctx.font = 'bold 22px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(title, p.x + 18, p.y + 22)
    // 关闭按钮
    const btns = this._dialogBtns()
    ctx.fillStyle = '#b3392b'
    this._roundRect(ctx, btns.close.x, btns.close.y, btns.close.w, btns.close.h, 6)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 20px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('✕', btns.close.x + btns.close.w / 2, btns.close.y + btns.close.h / 2)
  }

  // 招募弹窗：12 名英雄卡片（4列3行网格，等几率抽取，含已持有碎片数）+ 招募一次(1000金)/招募十次(10000金) 按钮
  _drawRecruitDialog(ctx) {
    const p = this._dialogPanel()
    this._drawDialogFrame(ctx, '招募')

    // 招募说明 + 当前金币：窄屏下两段文字可能碰到一起，测宽后自动换成两行避免重叠
    ctx.fillStyle = '#c9d4e3'
    ctx.font = '14px sans-serif'
    ctx.textBaseline = 'top'
    const costText = `招募一次：${RECRUIT_COST} 金币`
    const goldText = `当前金币：${this._fmt(gameData.resources.gold)}`
    ctx.textAlign = 'left'
    const costW = ctx.measureText(costText).width
    ctx.textAlign = 'right'
    const goldW = ctx.measureText(goldText).width
    const headerOneLine = costW + goldW + 16 <= p.w - 40
    ctx.textAlign = 'left'
    ctx.fillText(costText, p.x + 20, p.y + 42)
    ctx.textAlign = 'right'
    ctx.fillText(goldText, p.x + p.w - 20, p.y + (headerOneLine ? 42 : 62))

    // 12 张英雄卡片，4列3行网格，卡片尺寸随弹窗高度自适应
    const pad = 16
    const gap = 8
    const cols = 4
    const rows = 3
    const cw = (p.w - pad * 2 - gap * (cols - 1)) / cols
    const btns0 = this._recruitBtns()
    const gridTop = p.y + (headerOneLine ? 72 : 92)
    // 结果文字多于 1 行时（十连按每行 5 项换行），网格底部相应上移，预留结果区域，避免遮挡卡片
    const gridBottom = btns0.once.y - 54 - this._recruitResultExtraH()
    const ch = (gridBottom - gridTop - gap * (rows - 1)) / rows
    HERO_IDS.forEach((id, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const meta = HERO_META[id]
      const h = gameData.player.heroes[id]
      const cx0 = p.x + pad + col * (cw + gap)
      const cy0 = gridTop + row * (ch + gap)

      // 标准卡牌布局：整卡分为「头像区（上~68%）」+「信息条（下~32%）」两段，文字与立绘互不侵入
      const portraitH = ch * 0.68
      const infoY = cy0 + portraitH
      const infoH = ch - portraitH

      // 卡框（羊皮纸/木质暖色调），未解锁整卡置灰
      ctx.fillStyle = h.unlocked ? '#e9dcb8' : '#3a382f'
      this._roundRect(ctx, cx0, cy0, cw, ch, 8)
      ctx.fill()
      ctx.strokeStyle = h.unlocked ? '#a9823f' : 'rgba(150,150,150,0.35)'
      ctx.lineWidth = 1.5
      this._roundRect(ctx, cx0, cy0, cw, ch, 8)
      ctx.stroke()

      // 头像区：立绘铺满卡片上半部分（矩形裁剪，不与文字重叠）
      ctx.save()
      this._roundRect(ctx, cx0 + 2, cy0 + 2, cw - 4, portraitH - 2, 6)
      ctx.clip()
      if (!h.unlocked) ctx.globalAlpha = 0.45
      const portrait = this.imgs[meta.portrait]
      if (portrait && portrait.width) {
        // 立绘按比例完整显示在头像区内并居中（不裁剪，全身立绘的脚部才不会被切掉）
        const scale = Math.min(cw / portrait.width, portraitH / portrait.height)
        const dw = portrait.width * scale
        const dh = portrait.height * scale
        ctx.drawImage(portrait, cx0 + (cw - dw) / 2, cy0 + (portraitH - dh) / 2, dw, dh)
      } else {
        ctx.fillStyle = '#5a5138'
        ctx.fillRect(cx0, cy0, cw, portraitH)
        ctx.fillStyle = '#e8c96a'
        ctx.font = `bold ${Math.round(portraitH * 0.4)}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(meta.name.charAt(0), cx0 + cw / 2, cy0 + portraitH / 2)
      }
      ctx.restore()
      // 势力徽标固定在头像区右上角，不遮挡信息条文字
      ctx.save()
      if (!h.unlocked) ctx.globalAlpha = 0.45
      const badgeR = Math.max(7, ch * 0.09)
      this._drawFactionBadge(ctx, cx0 + cw - badgeR - 4, cy0 + badgeR + 4, badgeR, meta.faction)
      ctx.restore()

      // 信息条：底部深色背景条，与头像区分隔清晰
      ctx.fillStyle = h.unlocked ? 'rgba(58,42,20,0.88)' : 'rgba(20,20,20,0.7)'
      this._roundRect(ctx, cx0 + 2, infoY, cw - 4, infoH - 2, 4)
      ctx.fill()

      // 信息条文字严格裁剪在本卡范围内：碎片数无上限（集齐后仍可继续获得重复碎片，如"碎片 12/5"），
      // 文字变长若不裁剪会横向溢出，被后续绘制的相邻/下一行卡片覆盖，这里兜底避免遮挡
      ctx.save()
      this._roundRect(ctx, cx0 + 2, infoY, cw - 4, infoH - 2, 4)
      ctx.clip()

      // 两行文字按字号堆叠定位（而非按 infoH 百分比），避免卡片较矮时两行文字互相重叠
      const cardCx = cx0 + cw / 2
      const nameFontSize = Math.max(10, Math.min(13, Math.round(ch * 0.12)))
      let subFontSize = Math.max(9, Math.min(11, Math.round(ch * 0.1)))
      const lineGap = 2
      const textBlockH = nameFontSize + lineGap + subFontSize
      const topPad = Math.max(2, (infoH - textBlockH) / 2)
      const nameY = infoY + topPad
      const subY = nameY + nameFontSize + lineGap

      // 第一行：英雄名（居中加粗）
      ctx.fillStyle = h.unlocked ? '#ffe9b0' : '#9a9a9a'
      ctx.font = `bold ${nameFontSize}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(meta.name, cardCx, nameY)

      // 第二行：已解锁显示等级，未解锁显示碎片进度（集齐时高亮金色）；
      // 字号先按卡片高度算出，若测宽后仍超出卡宽则逐步缩小，确保不越界
      const shardReady = h.shards >= HERO_UNLOCK_SHARDS
      ctx.fillStyle = h.unlocked ? '#cfead1' : (shardReady ? '#ffd35c' : '#9aa3ad')
      const infoText = h.unlocked ? `等级 Lv.${h.level}` : `碎片 ${h.shards}/${HERO_UNLOCK_SHARDS}`
      const maxTextW = cw - 6
      ctx.font = `${subFontSize}px sans-serif`
      while (subFontSize > 7 && ctx.measureText(infoText).width > maxTextW) {
        subFontSize -= 1
        ctx.font = `${subFontSize}px sans-serif`
      }
      ctx.fillText(infoText, cardCx, subY)
      ctx.restore()
    })

    // 招募结果（若有）：单抽单行显示；十连结果项数较多，按每行至多5项换行，避免单行溢出弹窗
    const btns = this._recruitBtns()
    if (this.recruitResult) {
      ctx.fillStyle = '#e8c96a'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      if (this.recruitResult.heroId) {
        ctx.font = 'bold 15px sans-serif'
        const text = `获得 ${HERO_META[this.recruitResult.heroId].name} 碎片 x1`
        ctx.fillText(text, p.x + p.w / 2, btns.once.y - 16)
      } else {
        const counts = {}
        this.recruitResult.heroIds.forEach(id => { counts[id] = (counts[id] || 0) + 1 })
        const items = HERO_IDS.filter(id => counts[id]).map(id => `${HERO_META[id].name}碎片x${counts[id]}`)
        const perLine = 5
        const lines = []
        for (let i = 0; i < items.length; i += perLine) {
          lines.push((i === 0 ? '获得：' : '') + items.slice(i, i + perLine).join('  '))
        }
        ctx.font = 'bold 13px sans-serif'
        const lineH = 17
        const baseY = btns.once.y - 16
        const startY = baseY - (lines.length - 1) * lineH
        lines.forEach((line, i) => {
          ctx.fillText(line, p.x + p.w / 2, startY + i * lineH)
        })
      }
    }

    // 招募一次 / 招募十次按钮
    const canOnce = gameData.resources.gold >= RECRUIT_COST
    const canTen = gameData.resources.gold >= RECRUIT_COST_TEN
    ctx.fillStyle = canOnce ? '#2e8b57' : '#555f70'
    this._roundRect(ctx, btns.once.x, btns.once.y, btns.once.w, btns.once.h, 8)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 16px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`招募一次`, btns.once.x + btns.once.w / 2, btns.once.y + btns.once.h / 2 - 10)
    ctx.font = '12px sans-serif'
    ctx.fillText(`${RECRUIT_COST} 金币`, btns.once.x + btns.once.w / 2, btns.once.y + btns.once.h / 2 + 10)

    ctx.fillStyle = canTen ? '#2e8b57' : '#555f70'
    this._roundRect(ctx, btns.ten.x, btns.ten.y, btns.ten.w, btns.ten.h, 8)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 16px sans-serif'
    ctx.fillText(`招募十次`, btns.ten.x + btns.ten.w / 2, btns.ten.y + btns.ten.h / 2 - 10)
    ctx.font = '12px sans-serif'
    ctx.fillText(`${RECRUIT_COST_TEN} 金币`, btns.ten.x + btns.ten.w / 2, btns.ten.y + btns.ten.h / 2 + 10)
  }

  // 出战编队弹窗：已解锁英雄网格（4列，最多12人），点选切换出战(最多4人)，取消返回出征关卡列表，出战开始战斗
  _drawTeamDialog(ctx) {
    const p = this._dialogPanel()
    this._drawDialogFrame(ctx, `出战编队 - ${this.pendingStage ? this.pendingStage.name : ''}`)

    const unlockedIds = HERO_IDS.filter(id => gameData.player.heroes[id].unlocked)

    ctx.fillStyle = '#c9d4e3'
    ctx.font = '14px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(`已选 ${this.teamSelected.length}/4`, p.x + 20, p.y + 50)

    const pad = 16
    const gap = 8
    const cols = 4
    const rows = Math.max(1, Math.ceil(unlockedIds.length / cols))
    const cw = (p.w - pad * 2 - gap * (cols - 1)) / cols
    const btns0 = this._teamBtns()
    const gridTop = p.y + 72
    const gridBottom = btns0.confirm.y - 14
    const ch = Math.min((gridBottom - gridTop - gap * (rows - 1)) / rows, 120)
    const ar = Math.max(14, Math.min(24, ch * 0.28))

    this.teamHeroBtns = []
    unlockedIds.forEach((id, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const meta = HERO_META[id]
      const h = gameData.player.heroes[id]
      const selected = this.teamSelected.includes(id)
      const cx0 = p.x + pad + col * (cw + gap)
      const cy0 = gridTop + row * (ch + gap)
      ctx.fillStyle = selected ? '#2e8b57' : '#2c3a52'
      this._roundRect(ctx, cx0, cy0, cw, ch, 8)
      ctx.fill()
      ctx.strokeStyle = selected ? '#e8c96a' : 'rgba(232,201,106,0.35)'
      ctx.lineWidth = selected ? 2 : 1
      this._roundRect(ctx, cx0, cy0, cw, ch, 8)
      ctx.stroke()

      const acx = cx0 + cw / 2
      const acy = cy0 + ar + 6
      const portrait = this.imgs[meta.portrait]
      if (portrait && portrait.width) {
        ctx.save()
        ctx.beginPath()
        ctx.arc(acx, acy, ar, 0, Math.PI * 2)
        ctx.clip()
        // 等比完整显示（不裁剪/不拉伸），全身立绘在圆形头像内完整可见
        const scale = Math.min((ar * 2) / portrait.width, (ar * 2) / portrait.height)
        const dw = portrait.width * scale
        const dh = portrait.height * scale
        ctx.drawImage(portrait, acx - dw / 2, acy - dh / 2, dw, dh)
        ctx.restore()
        ctx.strokeStyle = '#e8c96a'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(acx, acy, ar, 0, Math.PI * 2)
        ctx.stroke()
      } else {
        ctx.fillStyle = '#3a4258'
        ctx.beginPath()
        ctx.arc(acx, acy, ar, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#e8c96a'
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.fillStyle = '#e8c96a'
        ctx.font = `bold ${Math.round(ar * 0.7)}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(meta.name.charAt(0), acx, acy + 1)
      }
      this._drawFactionBadge(ctx, acx + ar * 0.72, acy + ar * 0.72, Math.max(7, ar * 0.34), meta.faction)

      ctx.fillStyle = '#ffffff'
      ctx.font = `bold ${Math.max(11, Math.round(ch * 0.12))}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(meta.name, acx, acy + ar + 4)
      ctx.fillStyle = '#8fb3d1'
      ctx.font = `${Math.max(10, Math.round(ch * 0.1))}px sans-serif`
      ctx.fillText(`Lv.${h.level}`, acx, acy + ar + 4 + Math.max(13, ch * 0.15))

      if (selected) {
        ctx.fillStyle = '#e8c96a'
        ctx.font = 'bold 12px sans-serif'
        ctx.textAlign = 'right'
        ctx.textBaseline = 'top'
        ctx.fillText('已选', cx0 + cw - 6, cy0 + 4)
      }

      this.teamHeroBtns.push({ id, x: cx0, y: cy0, w: cw, h: ch })
    })

    // 取消 / 出战 按钮
    const btns = this._teamBtns()
    ctx.fillStyle = '#3a4a66'
    this._roundRect(ctx, btns.cancel.x, btns.cancel.y, btns.cancel.w, btns.cancel.h, 8)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 16px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('取消', btns.cancel.x + btns.cancel.w / 2, btns.cancel.y + btns.cancel.h / 2)

    const canConfirm = this.teamSelected.length >= 1
    ctx.fillStyle = canConfirm ? '#2e8b57' : '#555f70'
    this._roundRect(ctx, btns.confirm.x, btns.confirm.y, btns.confirm.w, btns.confirm.h, 8)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.fillText('出战', btns.confirm.x + btns.confirm.w / 2, btns.confirm.y + btns.confirm.h / 2)
  }

  // 出征弹窗：3 章节 × 5 关列表，每关显示推荐战力，锁定关卡置灰+锁图标，支持拖动滚动
  _drawCampaignDialog(ctx) {
    const p = this._dialogPanel()
    this._drawDialogFrame(ctx, '出征')

    // 当前战力（供与推荐战力对照）
    ctx.fillStyle = '#c9d4e3'
    ctx.font = '14px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(`当前战力：${this._fmt(computePower())}`, p.x + 20, p.y + 48)

    // 列表几何：标题+推荐战力行高、章节标题高、章节间距
    const listX = p.x + 20
    const listW = p.w - 40
    const rowH = 40
    const chHeaderH = 28
    const chGap = 8
    const scrollY = p.y + 74
    const scrollH = p.y + p.h - scrollY - 14

    // 预计算总高度以求最大滚动距离
    let totalH = 0
    campaignChapters.forEach(ch => { totalH += chHeaderH + ch.stages.length * rowH + chGap })
    this._campaignMaxScroll = Math.max(0, totalH - scrollH)

    // 弹窗刚打开时：自动滚动到最新解锁关卡（当前进度最前沿），置于可视区偏上位置，避免每次从头滚动
    if (this._campaignScrollPending) {
      this._campaignScrollPending = false
      const targetIdx = Math.max(0, Math.min(gameData.player.campaignUnlocked - 1, campaignStages.length - 1))
      const targetStage = campaignStages[targetIdx]
      if (targetStage) {
        this.campaignScroll = this._campaignStageOffset(targetStage.id, chHeaderH, rowH, chGap) - scrollH * 0.3
      }
    }

    if (this.campaignScroll > this._campaignMaxScroll) this.campaignScroll = this._campaignMaxScroll
    if (this.campaignScroll < 0) this.campaignScroll = 0

    ctx.save()
    ctx.beginPath()
    ctx.rect(listX, scrollY, listW, scrollH)
    ctx.clip()

    let ry = scrollY - this.campaignScroll
    this.campaignLevels = []
    campaignChapters.forEach(ch => {
      if (ry + chHeaderH > scrollY && ry < scrollY + scrollH) {
        ctx.fillStyle = '#e8c96a'
        ctx.font = 'bold 16px sans-serif'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(ch.name, listX, ry + chHeaderH / 2)
      }
      ry += chHeaderH
      ch.stages.forEach(st => {
        const unlocked = isStageUnlocked(st.id)
        const rh = rowH - 4
        if (ry + rh > scrollY && ry < scrollY + scrollH) {
          ctx.fillStyle = unlocked ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)'
          this._roundRect(ctx, listX, ry, listW, rh, 6)
          ctx.fill()
          ctx.fillStyle = unlocked ? '#ffffff' : '#5a6478'
          ctx.font = '15px sans-serif'
          ctx.textAlign = 'left'
          ctx.textBaseline = 'middle'
          ctx.fillText(`${st.id} ${st.name}${st.boss ? ' [BOSS]' : ''}`, listX + 10, ry + rh / 2)
          if (unlocked) {
            ctx.fillStyle = '#c9d4e3'
            ctx.font = '13px sans-serif'
            ctx.textAlign = 'right'
            ctx.fillText(`推荐 ${this._fmt(st.power)}`, listX + listW - 10, ry + rh / 2)
          } else {
            this._drawLockIcon(ctx, listX + listW - 30, ry + rh / 2 - 9, 18)
          }
        }
        if (unlocked) {
          // 仅记录已解锁关卡的热区，供 onTouch 命中；锁定关卡不可点击
          this.campaignLevels.push({ id: st.id, name: st.name, x: listX, y: ry, w: listW, h: rh })
        }
        ry += rowH
      })
      ry += chGap
    })

    ctx.restore()

    // 滚动条提示
    this._drawScrollbar(ctx, listX, scrollY, listW, scrollH, this.campaignScroll, this._campaignMaxScroll, totalH)
  }

  // 计算指定关卡行在出征列表内容中的顶部偏移（相对内容起点，几何与 _drawCampaignDialog 绘制循环一致），供自动滚动定位
  _campaignStageOffset(stageId, chHeaderH, rowH, chGap) {
    let offset = 0
    for (const ch of campaignChapters) {
      offset += chHeaderH
      for (const st of ch.stages) {
        if (st.id === stageId) return offset
        offset += rowH
      }
      offset += chGap
    }
    return 0
  }

  // 装备综合评分：攻防按 10 倍权重折算（与生命值量级对齐，参考英雄基础属性 atk/def 远小于 hp 的比例），用于同品质内排序
  _equipScore(e) {
    const eff = e.effects || {}
    return (eff.atk || 0) * 10 + (eff.def || 0) * 10 + (eff.hp || 0)
  }

  // 装备列表排序：品质降序（红>黄>紫>蓝>白），同品质按综合评分降序，供装备弹窗/商店装备页/背包装备列表复用
  _sortEquipList(list) {
    return [...list].sort((a, b) => b.quality - a.quality || this._equipScore(b) - this._equipScore(a))
  }

  // 代码绘制：锁图标（弧形锁环 + 矩形锁身），用于未解锁关卡
  _drawLockIcon(ctx, x, y, s) {
    ctx.save()
    ctx.strokeStyle = '#8a93a8'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(x + s / 2, y + s * 0.32, s * 0.22, Math.PI, 0)
    ctx.stroke()
    ctx.fillStyle = '#5a6478'
    this._roundRect(ctx, x + s * 0.14, y + s * 0.32, s * 0.72, s * 0.6, 3)
    ctx.fill()
    ctx.restore()
  }

  // 商店弹窗：分「道具」/「装备」两页，金币购买；装备购买后加入背包，需到英雄弹窗装备
  _drawShopDialog(ctx) {
    const p = this._dialogPanel()
    this._drawDialogFrame(ctx, '商店')

    // 分页按钮
    const tabs = [{ key: 'goods', label: '道具' }, { key: 'equip', label: '装备' }]
    const tabW = 90
    const tabH = 30
    const tabY = p.y + 50
    this.shopTabBtns = tabs.map((t, i) => {
      const tx = p.x + 16 + i * (tabW + 8)
      const active = this.shopTab === t.key
      ctx.fillStyle = active ? '#2e8b57' : 'rgba(255,255,255,0.08)'
      this._roundRect(ctx, tx, tabY, tabW, tabH, 6)
      ctx.fill()
      ctx.fillStyle = active ? '#fff' : '#c9d4e3'
      ctx.font = 'bold 14px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(t.label, tx + tabW / 2, tabY + tabH / 2)
      return { key: t.key, x: tx, y: tabY, w: tabW, h: tabH }
    })

    const listX = p.x + 16
    const listW = p.w - 32
    const listY = tabY + tabH + 10
    const listH = p.y + p.h - listY - 14
    const baseRowH = 68
    const descLineH = 16
    const gap = 10
    const btnW = 64
    const btnH = 40
    const iconSize = 18
    // 说明文字可用宽度：预留右侧价格 + 购买按钮所占的列宽，避免装备属性描述换行后压到按钮
    const descMaxW = listW - 24 - (btnW + 8 + 82)

    // 红装（quality 5）仅可通过战斗掉落获得，商店不出售
    const goods = this.shopTab === 'equip' ? this._sortEquipList(EQUIP_LIST.filter(e => e.quality < 5)) : shopGoods
    // 装备说明可能较长需要换行，逐项预算所需行数与行高，行数越多该行越高，避免遮挡下方内容
    ctx.font = '13px sans-serif'
    const isEquipTab = this.shopTab === 'equip'
    const descLinesList = goods.map(g => this._wrapLines(ctx, isEquipTab ? equipEffectDesc(g) : g.desc, descMaxW))
    const rowHeights = descLinesList.map(lines => baseRowH + Math.max(0, lines.length - 1) * descLineH)
    const totalH = rowHeights.reduce((s, rh) => s + rh + gap, 0)
    this._shopMaxScroll = Math.max(0, totalH - listH)
    if (this.shopScroll > this._shopMaxScroll) this.shopScroll = this._shopMaxScroll
    if (this.shopScroll < 0) this.shopScroll = 0

    ctx.save()
    ctx.beginPath()
    ctx.rect(listX, listY, listW, listH)
    ctx.clip()

    this.shopBuyBtns = []
    let ry = listY - this.shopScroll
    goods.forEach((g, gi) => {
      const isEquip = this.shopTab === 'equip'
      const can = isEquip ? canBuyEquip(g.id) : canBuyShopItem(g.id)
      const owned = isEquip ? ownedEquipCount(g.id) : (gameData.player.items[g.id] || 0)
      const descLines = descLinesList[gi]
      const rowH = rowHeights[gi]
      const price = g.price
      const bx = listX + listW - btnW - 8
      const by = ry + (rowH - btnH) / 2
      if (ry + rowH > listY && ry < listY + listH) {
        // 行底
        ctx.fillStyle = 'rgba(255,255,255,0.06)'
        this._roundRect(ctx, listX, ry, listW, rowH, 8)
        ctx.fill()
        // 名称（左上）：装备按品质着色并标注品质，道具白色
        ctx.fillStyle = isEquip ? QUALITY_META[g.quality].color : '#ffffff'
        ctx.font = 'bold 16px sans-serif'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        ctx.fillText(isEquip ? `${g.name}（${QUALITY_META[g.quality].name}·${(WEAPON_TYPE_META[g.weaponType] || WEAPON_TYPE_META.jian).name}）` : g.name, listX + 12, ry + 8)
        // 说明（左中，按可用宽度换行）
        ctx.fillStyle = '#c9d4e3'
        ctx.font = '13px sans-serif'
        descLines.forEach((line, i) => ctx.fillText(line, listX + 12, ry + 30 + i * descLineH))
        // 持有数量
        ctx.fillStyle = '#8fb3d1'
        ctx.font = '13px sans-serif'
        ctx.fillText(`持有 x${owned}`, listX + 12, ry + 30 + descLines.length * descLineH + 2)
        // 价格（按钮左侧：金币图标 + 数字，不足红色）
        const priceText = `${price}`
        ctx.font = 'bold 15px sans-serif'
        const priceW = iconSize + 4 + ctx.measureText(priceText).width
        const priceX = bx - 12 - priceW
        const priceY = ry + rowH / 2
        const goldImg = this.imgs.icon_gold
        if (goldImg) ctx.drawImage(goldImg, priceX, priceY - iconSize / 2, iconSize, iconSize)
        ctx.fillStyle = can ? '#ffffff' : '#ff5b4d'
        ctx.font = 'bold 15px sans-serif'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(priceText, priceX + iconSize + 4, priceY)
        // 购买按钮（金币不足置灰）
        ctx.fillStyle = can ? '#2e8b57' : '#555f70'
        this._roundRect(ctx, bx, by, btnW, btnH, 6)
        ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 14px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('购买', bx + btnW / 2, by + btnH / 2)
      }
      this.shopBuyBtns.push({ id: g.id, name: g.name, equip: isEquip, x: bx, y: by, w: btnW, h: btnH })
      ry += rowH + gap
    })

    ctx.restore()
    this._drawScrollbar(ctx, listX, listY, listW, listH, this.shopScroll, this._shopMaxScroll, totalH)
  }

  // 背包弹窗：战斗道具数量 + 英雄碎片数量 + 未装备的装备，纯展示列表，内容可能溢出故支持拖动滚动
  _drawBagDialog(ctx) {
    const p = this._dialogPanel()
    this._drawDialogFrame(ctx, '背包')

    const listX = p.x + 16
    const listW = p.w - 32
    const listY = p.y + 56
    const listH = p.y + p.h - listY - 14
    const lx = listX + 8
    const rx = listX + listW - 8

    // 只展示已拥有的条目：战斗道具（数量>0）、英雄碎片（数量>0）、装备（已拥有）
    const itemNames = { herb: '金疮药', charm: '护甲符', pill: '回春丹' }
    const ownedItems = Object.keys(itemNames).filter(id => (gameData.player.items[id] || 0) > 0)
    const ownedShards = HERO_IDS.filter(id => gameData.player.heroes[id].shards > 0)
    const ownedEquips = this._sortEquipList(EQUIP_LIST.filter(e => ownedEquipCount(e.id) > 0))
    const isEmpty = !ownedItems.length && !ownedShards.length && !ownedEquips.length

    // 装备条目的效果描述可能较长，需要换行；预先算出每件装备的换行行数与对应行高
    const equipDescMaxW = listW - 16 - 4
    const equipDescLineH = 15
    ctx.font = '12px sans-serif'
    const equipDescLinesList = ownedEquips.map(e => this._wrapLines(ctx, equipEffectDesc(e), equipDescMaxW))
    const equipRowHeights = equipDescLinesList.map(lines => 18 + lines.length * equipDescLineH + 10)

    // 预计算内容总高度（各分区：标题46 + N行*28，装备分区改为逐项累加实际行高，无条目分区不占高度）
    const totalH = (ownedItems.length ? 46 + ownedItems.length * 28 : 0) +
      (ownedShards.length ? 46 + ownedShards.length * 28 : 0) +
      (ownedEquips.length ? 46 + equipRowHeights.reduce((s, h) => s + h, 0) : 0)
    this._bagMaxScroll = Math.max(0, totalH - listH)
    if (this.bagScroll > this._bagMaxScroll) this.bagScroll = this._bagMaxScroll
    if (this.bagScroll < 0) this.bagScroll = 0

    ctx.save()
    ctx.beginPath()
    ctx.rect(listX, listY, listW, listH)
    ctx.clip()

    let ly = listY - this.bagScroll + 6

    if (isEmpty) {
      ctx.fillStyle = '#6b7690'
      ctx.font = '15px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('空空如也', listX + listW / 2, listY + listH / 2)
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
    }

    if (ownedItems.length) {
      ctx.fillStyle = '#e8c96a'
      ctx.font = 'bold 16px sans-serif'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText('战斗道具', lx, ly)
      ly += 30

      ownedItems.forEach(id => {
        ctx.fillStyle = '#ffffff'
        ctx.font = '15px sans-serif'
        ctx.fillText(`${itemNames[id]}`, lx, ly)
        ctx.fillStyle = '#c9d4e3'
        ctx.textAlign = 'right'
        ctx.fillText(`x${gameData.player.items[id] || 0}`, rx, ly)
        ctx.textAlign = 'left'
        ly += 28
      })
      ly += 16
    }

    if (ownedShards.length) {
      ctx.fillStyle = '#e8c96a'
      ctx.font = 'bold 16px sans-serif'
      ctx.fillText('英雄碎片', lx, ly)
      ly += 30

      ownedShards.forEach(id => {
        const meta = HERO_META[id]
        const h = gameData.player.heroes[id]
        ctx.fillStyle = '#ffffff'
        ctx.font = '15px sans-serif'
        ctx.fillText(`${meta.name}碎片`, lx, ly)
        ctx.fillStyle = '#c9d4e3'
        ctx.textAlign = 'right'
        ctx.fillText(`x${h.shards}`, rx, ly)
        ctx.textAlign = 'left'
        ly += 28
      })
      ly += 16
    }

    if (ownedEquips.length) {
      ctx.fillStyle = '#e8c96a'
      ctx.font = 'bold 16px sans-serif'
      ctx.fillText('装备（未装备）', lx, ly)
      ly += 30

      ownedEquips.forEach((e, ei) => {
        ctx.fillStyle = QUALITY_META[e.quality].color
        ctx.font = '15px sans-serif'
        ctx.fillText(`${e.name}【${(WEAPON_TYPE_META[e.weaponType] || WEAPON_TYPE_META.jian).name}】`, lx, ly)
        ctx.fillStyle = '#c9d4e3'
        ctx.textAlign = 'right'
        ctx.fillText(`x${ownedEquipCount(e.id)}`, rx, ly)
        ctx.textAlign = 'left'
        // 效果描述另起换行显示，避免与名称/数量同行导致溢出
        ctx.fillStyle = '#8fb3d1'
        ctx.font = '12px sans-serif'
        const descLines = equipDescLinesList[ei]
        descLines.forEach((line, i) => ctx.fillText(line, lx, ly + 18 + i * equipDescLineH))
        ly += equipRowHeights[ei]
      })
    }

    ctx.restore()
    this._drawScrollbar(ctx, listX, listY, listW, listH, this.bagScroll, this._bagMaxScroll, totalH)
  }

  // 英雄弹窗：英雄列表，展示头像(含势力徽标)/等级/攻血防/碎片/已装备物品，碎片不足则升级按钮置灰
  // 英雄数量可能超过弹窗可视高度，列表区裁剪显示并支持拖动滚动（与出征弹窗滚动实现一致）
  _drawHeroDialog(ctx) {
    const p = this._dialogPanel()
    this._drawDialogFrame(ctx, '英雄')

    const rowH = 116
    const gap = 10
    const listX = p.x + 16
    const listW = p.w - 32
    const listY = p.y + 56
    const listH = p.y + p.h - listY - 14

    // 预计算总高度以求最大滚动距离
    const totalH = HERO_IDS.length * (rowH + gap)
    this._heroMaxScroll = Math.max(0, totalH - listH)
    if (this.heroScroll > this._heroMaxScroll) this.heroScroll = this._heroMaxScroll
    if (this.heroScroll < 0) this.heroScroll = 0

    ctx.save()
    ctx.beginPath()
    ctx.rect(listX, listY, listW, listH)
    ctx.clip()

    let ry = listY - this.heroScroll
    this.heroUpgradeBtns = []
    this.heroEquipBtns = []
    this.heroUnlockBtns = []
    HERO_IDS.forEach(id => {
      const meta = HERO_META[id]
      const h = gameData.player.heroes[id]
      const cost = heroUpgradeCost(h.level)
      const can = canUpgradeHero(id)
      const equip = h.equip ? getEquipById(h.equip) : null
      const canUnlock = canUnlockHero(id)

      if (ry + rowH > listY && ry < listY + listH) {
        // 行底：未解锁则整行置灰
        ctx.fillStyle = h.unlocked ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)'
        this._roundRect(ctx, listX, ry, listW, rowH, 8)
        ctx.fill()

        // 头像 + 势力徽标（未解锁时降低透明度表示置灰）
        const ar = 32
        const acx = listX + 20 + ar
        const acy = ry + rowH / 2
        ctx.save()
        if (!h.unlocked) ctx.globalAlpha = 0.4
        const portrait = this.imgs[meta.portrait]
        if (portrait && portrait.width) {
          ctx.save()
          ctx.beginPath()
          ctx.arc(acx, acy, ar, 0, Math.PI * 2)
          ctx.clip()
          // 等比完整显示（不裁剪/不拉伸），全身立绘在圆形头像内完整可见
          const scale = Math.min((ar * 2) / portrait.width, (ar * 2) / portrait.height)
          const dw = portrait.width * scale
          const dh = portrait.height * scale
          ctx.drawImage(portrait, acx - dw / 2, acy - dh / 2, dw, dh)
          ctx.restore()
        } else {
          ctx.fillStyle = '#3a4258'
          ctx.beginPath()
          ctx.arc(acx, acy, ar, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.strokeStyle = '#e8c96a'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(acx, acy, ar, 0, Math.PI * 2)
        ctx.stroke()
        this._drawFactionBadge(ctx, acx + ar * 0.72, acy + ar * 0.72, 11, meta.faction)
        ctx.restore()

        // 文本区
        const tx = acx + ar + 14
        ctx.fillStyle = h.unlocked ? '#ffffff' : '#8a93a5'
        ctx.font = 'bold 16px sans-serif'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'

        if (!h.unlocked) {
          // 未解锁：仅显示名称 + 碎片进度，不显示升级/装备信息与按钮
          ctx.fillText(meta.name, tx, ry + 10)
          ctx.fillStyle = '#8fb3d1'
          ctx.font = '13px sans-serif'
          ctx.fillText(`${h.shards}/${HERO_UNLOCK_SHARDS} 碎片`, tx, ry + 34)

          if (canUnlock) {
            // 碎片已集齐：显示「兑换」按钮
            const btnW = 80
            const btnH = 32
            const bx = listX + listW - btnW - 14
            const by = ry + rowH / 2 - btnH / 2
            ctx.fillStyle = '#c0392b'
            this._roundRect(ctx, bx, by, btnW, btnH, 6)
            ctx.fill()
            ctx.fillStyle = '#fff'
            ctx.font = 'bold 14px sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText('兑换', bx + btnW / 2, by + btnH / 2)
            this.heroUnlockBtns.push({ id, x: bx, y: by, w: btnW, h: btnH })
          }
        } else {
          const wtMeta = WEAPON_TYPE_META[h.weaponType] || WEAPON_TYPE_META.jian
          ctx.fillText(`${meta.name}  Lv.${h.level}  【${wtMeta.name}】`, tx, ry + 10)
          ctx.fillStyle = '#c9d4e3'
          ctx.font = '13px sans-serif'
          ctx.fillText(`攻击 ${h.atk}  血量 ${h.hp}  防御 ${h.def}`, tx, ry + 34)
          ctx.fillStyle = '#8fb3d1'
          ctx.fillText(`碎片 ${h.shards} / 升级需 ${cost}`, tx, ry + 56)
          ctx.fillStyle = equip ? QUALITY_META[equip.quality].color : '#6b7690'
          ctx.fillText(`装备：${equip ? equip.name : '无'}`, tx, ry + 78)

          // 升级/装备按钮（右侧竖排，碎片不足则升级按钮置灰）
          const btnW = 80
          const btnH = 32
          const bx = listX + listW - btnW - 14
          const upgBy = ry + rowH / 2 - btnH - 3
          const eqBy = ry + rowH / 2 + 3
          ctx.fillStyle = can ? '#2e8b57' : '#555f70'
          this._roundRect(ctx, bx, upgBy, btnW, btnH, 6)
          ctx.fill()
          ctx.fillStyle = '#fff'
          ctx.font = 'bold 14px sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('升级', bx + btnW / 2, upgBy + btnH / 2)
          this.heroUpgradeBtns.push({ id, x: bx, y: upgBy, w: btnW, h: btnH })

          ctx.fillStyle = '#3a4a68'
          this._roundRect(ctx, bx, eqBy, btnW, btnH, 6)
          ctx.fill()
          ctx.strokeStyle = '#e8c96a'
          ctx.lineWidth = 1
          this._roundRect(ctx, bx, eqBy, btnW, btnH, 6)
          ctx.stroke()
          ctx.fillStyle = '#e8c96a'
          ctx.font = 'bold 14px sans-serif'
          ctx.fillText('装备', bx + btnW / 2, eqBy + btnH / 2)
          this.heroEquipBtns.push({ id, x: bx, y: eqBy, w: btnW, h: btnH })
        }
      }

      ry += rowH + gap
    })

    ctx.restore()

    // 滚动条提示（可滚动时才显示）
    this._drawScrollbar(ctx, listX, listY, listW, listH, this.heroScroll, this._heroMaxScroll, totalH)
  }

  // 装备弹窗：某英雄持有的装备列表（含当前已装备），滚动展示，点击未装备项装备之，点击已装备项卸下
  // 装备限制：仅列出与该英雄武器系相同的装备（同标签限定），其余武器系的装备完全不展示（非置灰）
  _drawEquipDialog(ctx) {
    const p = this._dialogPanel()
    const heroId = this.equipHeroId
    const meta = HERO_META[heroId]
    const wtMeta = WEAPON_TYPE_META[meta && meta.weaponType] || WEAPON_TYPE_META.jian
    this._drawDialogFrame(ctx, `装备 - ${meta ? meta.name : ''}【${wtMeta.name}】`)

    const hero = gameData.player.heroes[heroId]
    const listX = p.x + 16
    const listW = p.w - 32
    const listY = p.y + 56
    const listH = p.y + p.h - listY - 14
    const baseRowH = 62
    const descLineH = 16
    const gap = 8
    // 说明文字可用宽度：预留右侧状态文案（已装备/持有xN）所占的列宽
    const descMaxW = listW - 28 - 150

    // 仅展示与英雄武器系（weaponType）相同的装备：非同武器系的持有装备完全隐藏，不在此列表出现
    const rows = this._sortEquipList(EQUIP_LIST.filter(e => e.weaponType === hero.weaponType && (ownedEquipCount(e.id) > 0 || hero.equip === e.id)))

    if (!rows.length) {
      ctx.fillStyle = '#8a93a8'
      ctx.font = '15px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`暂无【${wtMeta.name}】类持有装备，先去商店购买`, listX + listW / 2, listY + listH / 2)
      this.equipRows = []
      this._equipMaxScroll = 0
      return
    }

    // 装备说明可能换行，逐项预算行数以确定行高
    ctx.font = '13px sans-serif'
    const descLinesList = rows.map(e => this._wrapLines(ctx, equipEffectDesc(e), descMaxW))
    const rowHeights = descLinesList.map(lines => baseRowH + Math.max(0, lines.length - 1) * descLineH)
    const totalH = rowHeights.reduce((s, rh) => s + rh + gap, 0)
    this._equipMaxScroll = Math.max(0, totalH - listH)
    if (this.equipScroll > this._equipMaxScroll) this.equipScroll = this._equipMaxScroll
    if (this.equipScroll < 0) this.equipScroll = 0

    ctx.save()
    ctx.beginPath()
    ctx.rect(listX, listY, listW, listH)
    ctx.clip()

    let ry = listY - this.equipScroll
    this.equipRows = []
    rows.forEach((e, ei) => {
      const isCur = hero.equip === e.id
      const count = ownedEquipCount(e.id)
      const descLines = descLinesList[ei]
      const rowH = rowHeights[ei]
      if (ry + rowH > listY && ry < listY + listH) {
        ctx.fillStyle = isCur ? 'rgba(232,201,106,0.18)' : 'rgba(255,255,255,0.06)'
        this._roundRect(ctx, listX, ry, listW, rowH, 8)
        ctx.fill()
        if (isCur) {
          ctx.strokeStyle = '#e8c96a'
          ctx.lineWidth = 1.5
          this._roundRect(ctx, listX, ry, listW, rowH, 8)
          ctx.stroke()
        }
        ctx.fillStyle = QUALITY_META[e.quality].color
        ctx.font = 'bold 16px sans-serif'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        ctx.fillText(`${e.name}（${QUALITY_META[e.quality].name}）`, listX + 14, ry + 8)
        ctx.fillStyle = '#c9d4e3'
        ctx.font = '13px sans-serif'
        descLines.forEach((line, i) => ctx.fillText(line, listX + 14, ry + 32 + i * descLineH))
        ctx.fillStyle = isCur ? '#e8c96a' : '#8fb3d1'
        ctx.font = 'bold 13px sans-serif'
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        ctx.fillText(isCur ? '已装备（点击卸下）' : `持有 x${count}（点击装备）`, listX + listW - 14, ry + rowH / 2)
        this.equipRows.push({ id: e.id, x: listX, y: ry, w: listW, h: rowH })
      }
      ry += rowH + gap
    })

    ctx.restore()
    this._drawScrollbar(ctx, listX, listY, listW, listH, this.equipScroll, this._equipMaxScroll, totalH)
  }

  // 称号弹窗：20 个称号列表（滚动），每行显示品质色称号名 + 效果描述，当前装备高亮，点击装备
  _drawTitleDialog(ctx) {
    const p = this._dialogPanel()
    this._drawDialogFrame(ctx, '称号')

    // 固定头部：标题栏下方展示当前装备称号，不随列表滚动
    const curTitle = getTitleById(gameData.player.currentTitle) || TITLE_LIST[0]
    const headerY = p.y + 44
    const headerH = 34
    ctx.fillStyle = 'rgba(255,255,255,0.05)'
    ctx.fillRect(p.x, headerY, p.w, headerH)
    ctx.font = '14px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#c9d4e3'
    ctx.fillText('当前装备：', p.x + 16, headerY + headerH / 2)
    ctx.fillStyle = QUALITY_META[curTitle.quality].color
    ctx.font = 'bold 14px sans-serif'
    ctx.fillText(`${curTitle.name}（${QUALITY_META[curTitle.quality].name}）`, p.x + 84, headerY + headerH / 2)

    const rowH = 62
    const gap = 8
    const listX = p.x + 16
    const listW = p.w - 32
    const listY = headerY + headerH + 10
    const listH = p.y + p.h - listY - 14

    // 已获得称号排前，未获得置后；同为已获得/未获得时按品质降序（红>黄>紫>蓝>白）
    const sortedTitles = [...TITLE_LIST].sort((a, b) => {
      const ao = isTitleOwned(a.id) ? 1 : 0
      const bo = isTitleOwned(b.id) ? 1 : 0
      if (ao !== bo) return bo - ao
      return b.quality - a.quality
    })

    const totalH = sortedTitles.length * (rowH + gap)
    this._titleMaxScroll = Math.max(0, totalH - listH)
    if (this.titleScroll > this._titleMaxScroll) this.titleScroll = this._titleMaxScroll
    if (this.titleScroll < 0) this.titleScroll = 0

    ctx.save()
    ctx.beginPath()
    ctx.rect(listX, listY, listW, listH)
    ctx.clip()

    let ry = listY - this.titleScroll
    this.titleRows = []
    const curId = gameData.player.currentTitle
    sortedTitles.forEach(t => {
      if (ry + rowH > listY && ry < listY + listH) {
        const owned = isTitleOwned(t.id)
        const isCur = t.id === curId
        ctx.fillStyle = isCur ? 'rgba(232,201,106,0.18)' : (owned ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)')
        this._roundRect(ctx, listX, ry, listW, rowH, 8)
        ctx.fill()
        if (isCur) {
          ctx.strokeStyle = '#e8c96a'
          ctx.lineWidth = 1.5
          this._roundRect(ctx, listX, ry, listW, rowH, 8)
          ctx.stroke()
        }

        const tx = listX + 14
        ctx.fillStyle = owned ? QUALITY_META[t.quality].color : 'rgba(183,188,196,0.4)'
        ctx.font = 'bold 16px sans-serif'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        ctx.fillText(`${owned ? '' : '🔒 '}${t.name}（${QUALITY_META[t.quality].name}）`, tx, ry + 10)
        ctx.fillStyle = owned ? '#c9d4e3' : 'rgba(201,212,227,0.35)'
        ctx.font = '13px sans-serif'
        ctx.fillText(owned ? titleEffectDesc(t) : '未获得，击败关卡有几率掉落', tx, ry + 34)

        if (isCur) {
          ctx.fillStyle = '#e8c96a'
          ctx.font = 'bold 13px sans-serif'
          ctx.textAlign = 'right'
          ctx.textBaseline = 'middle'
          ctx.fillText('已装备', listX + listW - 14, ry + rowH / 2)
        } else if (!owned) {
          ctx.fillStyle = 'rgba(201,212,227,0.4)'
          ctx.font = 'bold 13px sans-serif'
          ctx.textAlign = 'right'
          ctx.textBaseline = 'middle'
          ctx.fillText('未获得', listX + listW - 14, ry + rowH / 2)
        }
        if (owned) this.titleRows.push({ id: t.id, x: listX, y: ry, w: listW, h: rowH })
      }
      ry += rowH + gap
    })

    ctx.restore()

    this._drawScrollbar(ctx, listX, listY, listW, listH, this.titleScroll, this._titleMaxScroll, totalH)
  }

  _drawToast(ctx) {
    if (!this.toast) return
    if (this.elapsed > this.toast.expire) { this.toast = null; return }
    const w = this.game.width
    const h = this.game.height
    ctx.font = '18px sans-serif'
    const tw = ctx.measureText(this.toast.text).width + 48
    const th = 44
    const x = (w - tw) / 2
    const y = this.topBarH + 14
    ctx.fillStyle = 'rgba(0,0,0,0.75)'
    this._roundRect(ctx, x, y, tw, th, 10)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(this.toast.text, x + tw / 2, y + th / 2)
  }

  showToast(text, dur = 2) {
    this.toast = { text, expire: this.elapsed + dur }
  }

  // 关闭弹窗并清理招募结果等临时状态
  _closeDialog() {
    this.dialog = null
    this.recruitResult = null
  }

  onTouch(x, y) {
    if (!this.ready) return

    // 出征/英雄/称号/装备/商店弹窗：延迟到 touchEnd 处理（支持列表拖动滚动）
    if (this.dialog === 'campaign' || this.dialog === 'hero' || this.dialog === 'title' || this.dialog === 'equip' || this.dialog === 'shopgoods' || this.dialog === 'bag') {
      this._scrollDialogTouchStart(x, y)
      return
    }

    // 弹窗打开时：优先处理弹窗内交互
    if (this.dialog) {
      const p = this._dialogPanel()

      if (this.dialog === 'recruit') {
        const btns = this._recruitBtns()
        if (this.hitRect(x, y, btns.close.x, btns.close.y, btns.close.w, btns.close.h)) {
          this._closeDialog()
          return
        }
        if (this.hitRect(x, y, btns.once.x, btns.once.y, btns.once.w, btns.once.h)) {
          const heroId = recruitOnce()
          if (!heroId) {
            this.showToast('金币不足，无法招募')
          } else {
            this.recruitResult = { heroId }
            this.showToast(`招募成功：${HERO_META[heroId].name} 碎片 x1`)
          }
          return
        }
        if (this.hitRect(x, y, btns.ten.x, btns.ten.y, btns.ten.w, btns.ten.h)) {
          const heroIds = recruitTen()
          if (!heroIds) {
            this.showToast('金币不足，无法招募')
          } else {
            this.recruitResult = { heroIds }
            this.showToast('十连招募成功！')
          }
          return
        }
        if (!this.hitRect(x, y, p.x, p.y, p.w, p.h)) this._closeDialog()
        return
      }

      if (this.dialog === 'team') {
        const btns = this._teamBtns()
        if (this.hitRect(x, y, btns.close.x, btns.close.y, btns.close.w, btns.close.h)) {
          this._closeDialog()
          this.pendingStage = null
          return
        }
        if (this.teamHeroBtns) {
          for (const hb of this.teamHeroBtns) {
            if (this.hitRect(x, y, hb.x, hb.y, hb.w, hb.h)) {
              const idx = this.teamSelected.indexOf(hb.id)
              if (idx >= 0) {
                this.teamSelected.splice(idx, 1)
              } else if (this.teamSelected.length < 4) {
                this.teamSelected.push(hb.id)
              } else {
                this.showToast('最多选择4名英雄')
              }
              return
            }
          }
        }
        if (this.hitRect(x, y, btns.cancel.x, btns.cancel.y, btns.cancel.w, btns.cancel.h)) {
          this.dialog = 'campaign'
          this.pendingStage = null
          return
        }
        if (this.hitRect(x, y, btns.confirm.x, btns.confirm.y, btns.confirm.w, btns.confirm.h)) {
          if (!this.teamSelected.length) {
            this.showToast('请至少选择1名英雄')
            return
          }
          const stage = this.pendingStage
          const team = this.teamSelected.slice()
          // 记住本次出战编队，下次打开弹窗默认选中
          gameData.player.lastTeam = team.slice()
          saveGame()
          this._closeDialog()
          this.pendingStage = null
          this.game.switch('battle', { levelId: stage.id, levelName: stage.name, team })
          return
        }
        if (!this.hitRect(x, y, p.x, p.y, p.w, p.h)) {
          this._closeDialog()
          this.pendingStage = null
        }
        return
      }

      const btns = this._dialogBtns()
      // 关闭按钮（其余弹窗通用）
      if (this.hitRect(x, y, btns.close.x, btns.close.y, btns.close.w, btns.close.h)) {
        this._closeDialog()
        return
      }
      if (this.dialog === 'bag') {
        // 纯展示，仅关闭/外部点击关闭
      } else if (this.dialog === 'settings') {
        if (this.settingsBtns) {
          for (const sb of this.settingsBtns) {
            if (this.hitRect(x, y, sb.x, sb.y, sb.w, sb.h)) {
              if (sb.key === 'sound') {
                const on = toggleSound()
                this.showToast(`音效已${on ? '开启' : '关闭'}`)
              } else if (sb.key === 'music') {
                const on = toggleMusic()
                // 立即生效：开则重新播放主城音乐，关则停止
                if (on) playMainBg()
                else stopMainBg()
                this.showToast(`音乐已${on ? '开启' : '关闭'}`)
              }
              return
            }
          }
        }
      } else if (this.dialog === 'player') {
        // 人物介绍弹窗：设置按钮（齿轮图标）打开设置弹窗
        if (this.gearBtn && this.hitRect(x, y, this.gearBtn.x, this.gearBtn.y, this.gearBtn.w, this.gearBtn.h)) {
          this._openDialog('settings')
          return
        }
        // 更换称号按钮：打开称号列表弹窗
        if (this.changeTitleBtn && this.hitRect(x, y, this.changeTitleBtn.x, this.changeTitleBtn.y, this.changeTitleBtn.w, this.changeTitleBtn.h)) {
          this._openDialog('title')
          return
        }
      } else if (this.dialog !== 'player') {
        // 建筑弹窗：升级按钮
        if (this.hitRect(x, y, btns.upgrade.x, btns.upgrade.y, btns.upgrade.w, btns.upgrade.h)) {
          const b = gameData.buildings[this.dialog]
          if (b.level >= capOf(this.dialog)) {
            this.showToast('已达等级上限')
          } else if (upgradeBuilding(this.dialog)) {
            this.showToast(`${b.name} 升级成功！Lv.${b.level}`)
          } else {
            this.showToast('金币不足，无法升级')
          }
          return
        }
      }
      // 点击弹窗外部关闭
      if (!this.hitRect(x, y, p.x, p.y, p.w, p.h)) {
        this._closeDialog()
      }
      return
    }

    // 头像区域：点击弹出人物介绍
    if (this.avatarBtn && this.hitRect(x, y, this.avatarBtn.x, this.avatarBtn.y, this.avatarBtn.w, this.avatarBtn.h)) {
      this.dialog = 'player'
      return
    }

    // 底部功能按钮
    if (this.bottomBtns) {
      for (const b of this.bottomBtns) {
        if (this.hitRect(x, y, b.x, b.y, b.w, b.h)) {
          this._openDialog(b.action)
          return
        }
      }
    }

    // 建筑热区：点击弹出详情（酒馆/校场/出征大厅/商店为功能入口，直接跳转对应弹窗）
    for (const b of this.buildings) {
      if (this.hitRect(x, y, b.x, b.y, b.w, b.h)) {
        const shortcut = { tavern: 'recruit', drillground: 'hero', campaign: 'campaign', shop: 'shopgoods' }
        if (shortcut[b.id]) {
          this._openDialog(shortcut[b.id])
        } else {
          this.dialog = b.id
        }
        return
      }
    }
  }

  // 打开指定弹窗并重置相关滚动/结果状态
  _openDialog(action) {
    this.dialog = action
    if (action === 'recruit') this.recruitResult = null
    else if (action === 'campaign') { this.campaignScroll = 0; this._campaignScrollPending = true }
    else if (action === 'hero') this.heroScroll = 0
    else if (action === 'title') this.titleScroll = 0
    else if (action === 'shopgoods') { this.shopTab = 'goods'; this.shopScroll = 0 }
    else if (action === 'bag') this.bagScroll = 0
  }

  // 出征前打开出战编队弹窗：默认选中上次出战编队（lastTeam，需全部仍已解锁），无记录则回退桃园三兄弟（无则取前3名已解锁英雄）
  _openTeamSelect(lv) {
    this.pendingStage = { id: lv.id, name: lv.name }
    const lastTeam = gameData.player.lastTeam || []
    const lastTeamValid = lastTeam.length && lastTeam.every(id => gameData.player.heroes[id] && gameData.player.heroes[id].unlocked)
    if (lastTeamValid) {
      this.teamSelected = lastTeam.slice(0, 4)
    } else {
      const unlockedRoster = BATTLE_ROSTER.filter(id => gameData.player.heroes[id].unlocked)
      const fallback = HERO_IDS.filter(id => gameData.player.heroes[id].unlocked).slice(0, 3)
      this.teamSelected = (unlockedRoster.length ? unlockedRoster : fallback).slice(0, 4)
    }
    this.dialog = 'team'
  }

  // 出征/英雄弹窗：记录触摸起点与命中目标（延迟到 touchEnd 执行，支持拖动滚动）
  _scrollDialogTouchStart(x, y) {
    const btns = this._dialogBtns()
    const p = this._dialogPanel()
    this._touchStart = { x, y, target: null }
    this._touchMoved = false
    this._lastTouchY = y

    if (this.hitRect(x, y, btns.close.x, btns.close.y, btns.close.w, btns.close.h)) {
      this._touchStart.target = { type: 'close' }
      return
    }
    if (this.dialog === 'campaign' && this.campaignLevels) {
      for (const lv of this.campaignLevels) {
        if (this.hitRect(x, y, lv.x, lv.y, lv.w, lv.h)) {
          this._touchStart.target = { type: 'stage', lv }
          return
        }
      }
    }
    if (this.dialog === 'hero' && this.heroUpgradeBtns) {
      for (const hb of this.heroUpgradeBtns) {
        if (this.hitRect(x, y, hb.x, hb.y, hb.w, hb.h)) {
          this._touchStart.target = { type: 'upgrade', hb }
          return
        }
      }
    }
    if (this.dialog === 'hero' && this.heroEquipBtns) {
      for (const eb of this.heroEquipBtns) {
        if (this.hitRect(x, y, eb.x, eb.y, eb.w, eb.h)) {
          this._touchStart.target = { type: 'openEquip', eb }
          return
        }
      }
    }
    if (this.dialog === 'hero' && this.heroUnlockBtns) {
      for (const ub of this.heroUnlockBtns) {
        if (this.hitRect(x, y, ub.x, ub.y, ub.w, ub.h)) {
          this._touchStart.target = { type: 'unlockHero', ub }
          return
        }
      }
    }
    if (this.dialog === 'equip' && this.equipRows) {
      for (const er of this.equipRows) {
        if (this.hitRect(x, y, er.x, er.y, er.w, er.h)) {
          this._touchStart.target = { type: 'equipRow', er }
          return
        }
      }
    }
    if (this.dialog === 'shopgoods' && this.shopTabBtns) {
      for (const tb of this.shopTabBtns) {
        if (this.hitRect(x, y, tb.x, tb.y, tb.w, tb.h)) {
          this._touchStart.target = { type: 'shopTab', tb }
          return
        }
      }
    }
    if (this.dialog === 'shopgoods' && this.shopBuyBtns) {
      for (const sb of this.shopBuyBtns) {
        if (this.hitRect(x, y, sb.x, sb.y, sb.w, sb.h)) {
          this._touchStart.target = { type: 'shopBuy', sb }
          return
        }
      }
    }
    if (this.dialog === 'title' && this.titleRows) {
      for (const tr of this.titleRows) {
        if (this.hitRect(x, y, tr.x, tr.y, tr.w, tr.h)) {
          this._touchStart.target = { type: 'titleRow', tr }
          return
        }
      }
    }
    if (!this.hitRect(x, y, p.x, p.y, p.w, p.h)) {
      this._touchStart.target = { type: 'outside' }
    } else {
      this._touchStart.target = { type: 'scroll' }
    }
  }

  // 触摸移动：拖动滚动出征关卡列表 / 英雄列表 / 称号列表 / 装备列表
  onTouchMove(x, y) {
    if (!this.ready) return
    if (!this._touchStart) return
    if (this.dialog !== 'campaign' && this.dialog !== 'hero' && this.dialog !== 'title' && this.dialog !== 'equip' && this.dialog !== 'shopgoods' && this.dialog !== 'bag') return

    const deltaY = y - this._lastTouchY
    this._lastTouchY = y

    // 移动超过阈值时标记为拖动（非点击）
    if (Math.abs(y - this._touchStart.y) > 10) {
      this._touchMoved = true
    }

    const t = this._touchStart.target.type
    if (t === 'scroll' || t === 'stage' || t === 'upgrade' || t === 'openEquip' || t === 'titleRow' || t === 'equipRow' || t === 'shopBuy') {
      if (this.dialog === 'campaign') {
        this.campaignScroll -= deltaY
        if (this.campaignScroll < 0) this.campaignScroll = 0
        if (this.campaignScroll > this._campaignMaxScroll) this.campaignScroll = this._campaignMaxScroll
      } else if (this.dialog === 'hero') {
        this.heroScroll -= deltaY
        if (this.heroScroll < 0) this.heroScroll = 0
        if (this.heroScroll > this._heroMaxScroll) this.heroScroll = this._heroMaxScroll
      } else if (this.dialog === 'title') {
        this.titleScroll -= deltaY
        if (this.titleScroll < 0) this.titleScroll = 0
        if (this.titleScroll > this._titleMaxScroll) this.titleScroll = this._titleMaxScroll
      } else if (this.dialog === 'equip') {
        this.equipScroll -= deltaY
        if (this.equipScroll < 0) this.equipScroll = 0
        if (this.equipScroll > this._equipMaxScroll) this.equipScroll = this._equipMaxScroll
      } else if (this.dialog === 'shopgoods') {
        this.shopScroll -= deltaY
        if (this.shopScroll < 0) this.shopScroll = 0
        if (this.shopScroll > this._shopMaxScroll) this.shopScroll = this._shopMaxScroll
      } else if (this.dialog === 'bag') {
        this.bagScroll -= deltaY
        if (this.bagScroll < 0) this.bagScroll = 0
        if (this.bagScroll > this._bagMaxScroll) this.bagScroll = this._bagMaxScroll
      }
    }
  }

  // 触摸结束：未拖动则执行点击操作
  onTouchEnd(x, y) {
    if (!this.ready) return
    if (!this._touchStart) return
    if (this.dialog !== 'campaign' && this.dialog !== 'hero' && this.dialog !== 'title' && this.dialog !== 'equip' && this.dialog !== 'shopgoods' && this.dialog !== 'bag') return

    if (!this._touchMoved) {
      const target = this._touchStart.target
      if (target) {
        if (target.type === 'close') {
          this._closeDialog()
        } else if (target.type === 'stage') {
          const lv = target.lv
          this._openTeamSelect(lv)
        } else if (target.type === 'upgrade') {
          const id = target.hb.id
          if (upgradeHero(id)) {
            this.showToast(`${HERO_META[id].name} 升级成功！`)
          } else {
            this.showToast('碎片不足，无法升级')
          }
        } else if (target.type === 'openEquip') {
          this.equipHeroId = target.eb.id
          this.equipScroll = 0
          this.dialog = 'equip'
        } else if (target.type === 'unlockHero') {
          const id = target.ub.id
          if (unlockHero(id)) {
            this.showToast(`${HERO_META[id].name} 兑换成功！`)
          } else {
            this.showToast('碎片不足，无法兑换')
          }
        } else if (target.type === 'equipRow') {
          const id = target.er.id
          const heroId = this.equipHeroId
          const hero = gameData.player.heroes[heroId]
          const eq = getEquipById(id)
          if (hero.equip === id) {
            if (unequipHero(heroId)) this.showToast(`已卸下：${eq.name}`)
          } else if (!isEquipUsableByHero(heroId, id)) {
            // 装备限制：武器系不匹配，拒绝装备并提示（正常流程下列表已按武器系过滤，此处为兜底保护）
            this.showToast(`武器系不符，${HERO_META[heroId].name}无法装备【${(WEAPON_TYPE_META[eq.weaponType] || WEAPON_TYPE_META.jian).name}】类装备`)
          } else {
            if (equipToHero(heroId, id)) this.showToast(`已装备：${eq.name}`)
          }
        } else if (target.type === 'titleRow') {
          const id = target.tr.id
          const t = getTitleById(id)
          if (equipTitle(id)) {
            this.showToast(`已装备称号：${t.name}`)
          }
        } else if (target.type === 'shopTab') {
          this.shopTab = target.tb.key
          this.shopScroll = 0
        } else if (target.type === 'shopBuy') {
          const sb = target.sb
          if (sb.equip) {
            if (buyEquip(sb.id)) this.showToast(`购买 ${sb.name} 成功！`)
            else this.showToast('金币不足，无法购买')
          } else {
            if (buyShopItem(sb.id)) this.showToast(`购买 ${sb.name} 成功！`)
            else this.showToast('金币不足，无法购买')
          }
        } else if (target.type === 'outside') {
          this._closeDialog()
        }
      }
    }
    // 重置触摸状态
    this._touchStart = null
    this._touchMoved = false
  }
}
