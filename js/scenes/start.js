import { Scene } from './scene.js'
import { getLocalAssetPath } from '../config.js'

// 开始页：水墨山水背景 + 游戏标题 + "开始游戏" 按钮，点击后进入主页面
export class StartScene extends Scene {
  enter() {
    this.bgImg = null
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

  leave() {}

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

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  }

  onTouch(x, y) {
    if (this.hitRect(x, y, this.startBtnRect.x, this.startBtnRect.y, this.startBtnRect.w, this.startBtnRect.h)) {
      this.game.switch('main')
    }
  }
}
