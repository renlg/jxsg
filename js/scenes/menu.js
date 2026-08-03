import { Scene } from './scene.js'

// 主菜单场景
export class MenuScene extends Scene {
  enter() {
    const w = this.game.width
    const h = this.game.height
    // 按钮矩形（居中）
    this.btn = {
      x: w / 2 - 100,
      y: h / 2 + 40,
      w: 200,
      h: 60
    }
  }

  render(ctx) {
    const w = this.game.width
    const h = this.game.height

    // 背景
    const bg = ctx.createLinearGradient(0, 0, 0, h)
    bg.addColorStop(0, '#1a2332')
    bg.addColorStop(1, '#0d1117')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)

    // 标题
    ctx.fillStyle = '#e8c96a'
    ctx.font = 'bold 48px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('将星三国', w / 2, h / 2 - 60)
    ctx.fillStyle = '#8a9bb5'
    ctx.font = '20px sans-serif'
    ctx.fillText('类英雄无敌·回合制战棋', w / 2, h / 2 - 10)

    // 开始按钮
    ctx.fillStyle = '#b3392b'
    ctx.fillRect(this.btn.x, this.btn.y, this.btn.w, this.btn.h)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 26px sans-serif'
    ctx.fillText('开始游戏', w / 2, this.btn.y + this.btn.h / 2)
  }

  onTouch(x, y) {
    if (this.hitRect(x, y, this.btn.x, this.btn.y, this.btn.w, this.btn.h)) {
      this.game.switch('maincity')
    }
  }
}
