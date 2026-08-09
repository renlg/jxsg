import { Scene } from './scene.js'
import { getLocalAssetPath } from '../config.js'
import { ASSET_MANIFEST } from '../asset_manifest.js'

// 开始页：水墨山水背景 + 游戏标题 + "开始游戏" 按钮，点击后进入主页面
export class StartScene extends Scene {
  enter() {
    this.bgImg = null
    this.isLoading = false
    this.loadedCount = 0
    this.totalCount = ASSET_MANIFEST.length
    this.hasLeft = false
    const img = tt.createImage()
    img.onload = () => { this.bgImg = img }
    getLocalAssetPath('assets/pvz_bg.jpg').then(path => { img.src = path })

    const w = this.game.width
    const h = this.game.height
    const btnW = 220
    const btnH = 64
    this.startBtnRect = {
      x: w / 2 - btnW / 2,
      y: h / 2 + 40,
      w: btnW,
      h: btnH
    }
  }

  leave() {
    this.hasLeft = true
  }

  update(dt) {}

  render(ctx) {
    const w = this.game.width
    const h = this.game.height

    ctx.fillStyle = '#0d1117'
    ctx.fillRect(0, 0, w, h)
    if (this.bgImg) {
      ctx.drawImage(this.bgImg, 0, 0, w, h)
    }

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    if (this.isLoading) {
      this._renderLoading(ctx, w, h)
      return
    }

    ctx.fillStyle = '#c9a227'
    ctx.font = 'bold 56px sans-serif'
    ctx.fillText('汉末将星', w / 2, h / 2 - 60)

    const btn = this.startBtnRect
    ctx.fillStyle = '#c9a227'
    this._roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 12)
    ctx.fill()
    ctx.strokeStyle = '#fff3c4'
    ctx.lineWidth = 2
    this._roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 12)
    ctx.stroke()

    ctx.fillStyle = '#2b1d0a'
    ctx.font = 'bold 26px sans-serif'
    ctx.fillText('开始游戏', btn.x + btn.w / 2, btn.y + btn.h / 2 + 1)
  }

  // 按已处理文件数绘制真实进度；缓存命中的素材会快速跳过
  _renderLoading(ctx, w, h) {
    const progress = this.totalCount > 0 ? this.loadedCount / this.totalCount : 1
    const percent = Math.floor(progress * 100)
    const barW = Math.min(360, w - 56)
    const barH = 24
    const barX = (w - barW) / 2
    const barY = h / 2 + 12

    ctx.fillStyle = '#c9a227'
    ctx.font = 'bold 44px sans-serif'
    ctx.fillText('汉末将星', w / 2, h / 2 - 70)

    ctx.fillStyle = '#fff3c4'
    ctx.font = '22px sans-serif'
    ctx.fillText(`素材加载中 ${percent}%`, w / 2, h / 2 - 18)

    ctx.fillStyle = 'rgba(13, 17, 23, 0.78)'
    this._roundRect(ctx, barX, barY, barW, barH, barH / 2)
    ctx.fill()

    if (progress > 0) {
      const filledW = barW * progress
      ctx.fillStyle = '#c9a227'
      this._roundRect(ctx, barX, barY, filledW, barH, Math.min(barH / 2, filledW / 2))
      ctx.fill()
    }

    ctx.strokeStyle = '#fff3c4'
    ctx.lineWidth = 2
    this._roundRect(ctx, barX, barY, barW, barH, barH / 2)
    ctx.stroke()
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

  async _precacheAssets() {
    let nextIndex = 0

    // 6 个 worker 共用游标，保证最多同时下载 6 个素材
    const worker = async () => {
      while (nextIndex < this.totalCount) {
        const index = nextIndex++
        try {
          await getLocalAssetPath(ASSET_MANIFEST[index])
        } catch (err) {
          // config.js 正常会回退远程地址；额外兜底避免单个异常卡住加载页
          console.warn('[Start] 素材预缓存异常，继续加载:', ASSET_MANIFEST[index], err)
        } finally {
          this.loadedCount++
        }
      }
    }

    await Promise.all(Array.from({ length: 6 }, () => worker()))

    // 让 100% 状态短暂显示后再进入主城
    await new Promise(resolve => setTimeout(resolve, 300))
    if (!this.hasLeft) this.game.switch('main')
  }

  onTouch(x, y) {
    if (this.isLoading) return

    if (this.hitRect(x, y, this.startBtnRect.x, this.startBtnRect.y, this.startBtnRect.w, this.startBtnRect.h)) {
      this.isLoading = true
      this._precacheAssets()
    }
  }
}
