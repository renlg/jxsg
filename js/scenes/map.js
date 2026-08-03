import { Scene } from './scene.js'

// 地形类型
const TERRAIN = {
  GRASS: 0, // 草地
  MOUNTAIN: 1, // 山
  WATER: 2, // 水
  FOREST: 3, // 森林
  CITY: 4 // 城池
}

const TERRAIN_COLORS = {
  [TERRAIN.GRASS]: '#3d7a3a',
  [TERRAIN.MOUNTAIN]: '#6b6257',
  [TERRAIN.WATER]: '#2a5f8f',
  [TERRAIN.FOREST]: '#2c5e2e',
  [TERRAIN.CITY]: '#a8915c'
}

// 战棋地图场景（10x7 网格）
export class MapScene extends Scene {
  enter() {
    const w = this.game.width
    const h = this.game.height
    this.cols = 10
    this.rows = 7
    // 网格尺寸：适配横屏
    this.cell = Math.floor(Math.min((w - 40) / this.cols, (h - 90) / this.rows))
    this.ox = Math.floor((w - this.cell * this.cols) / 2)
    this.oy = Math.floor((h - 90 - this.cell * this.rows) / 2 + 10)

    // 预置地图：0=草 1=山 2=水 3=林 4=城
    this.map = [
      [0, 0, 3, 3, 0, 0, 0, 2, 2, 0],
      [0, 0, 3, 0, 0, 1, 0, 2, 2, 0],
      [4, 0, 0, 0, 0, 1, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 1, 0, 0, 0, 4],
      [0, 1, 0, 0, 0, 0, 0, 0, 3, 3],
      [0, 1, 0, 0, 2, 2, 0, 3, 0, 0],
      [0, 0, 0, 0, 2, 2, 0, 0, 0, 0]
    ]

    // 英雄位置（行, 列）
    this.hero = { r: 3, c: 0 }
    this.selected = null
    this.msg = '点击英雄或城池，点空地移动'

    this._buildBack()
  }

  _buildBack() {
    // 背景缓存在离屏 canvas，避免每帧重绘地形
    const off = tt.createCanvas()
    off.width = this.game.width
    off.height = this.game.height
    const ctx = off.getContext('2d')
    ctx.fillStyle = '#10151c'
    ctx.fillRect(0, 0, off.width, off.height)

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const x = this.ox + c * this.cell
        const y = this.oy + r * this.cell
        ctx.fillStyle = TERRAIN_COLORS[this.map[r][c]]
        ctx.fillRect(x, y, this.cell - 2, this.cell - 2)
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'
        ctx.strokeRect(x, y, this.cell - 2, this.cell - 2)
      }
    }
    this._backCanvas = off
  }

  _cellAt(x, y) {
    const c = Math.floor((x - this.ox) / this.cell)
    const r = Math.floor((y - this.oy) / this.cell)
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return null
    return { r, c }
  }

  update(dt) {}

  render(ctx) {
    ctx.drawImage(this._backCanvas, 0, 0)

    // 英雄
    const hx = this.ox + this.hero.c * this.cell
    const hy = this.oy + this.hero.r * this.cell
    ctx.fillStyle = '#d43d2a'
    ctx.beginPath()
    ctx.arc(hx + this.cell / 2, hy + this.cell / 2, this.cell * 0.35, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${Math.floor(this.cell * 0.4)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('将', hx + this.cell / 2, hy + this.cell / 2)

    // 底部信息栏
    const w = this.game.width
    const h = this.game.height
    ctx.fillStyle = '#1c2530'
    ctx.fillRect(0, h - 70, w, 70)
    ctx.fillStyle = '#c9d4e3'
    ctx.font = '18px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(this.msg, 20, h - 40)
    ctx.textAlign = 'right'
    ctx.fillText('行 ' + (this.hero.r + 1) + ' 列 ' + (this.hero.c + 1), w - 20, h - 40)
  }

  onTouch(x, y) {
    const cell = this._cellAt(x, y)
    if (!cell) return

    const t = this.map[cell.r][cell.c]
    const isHero = cell.r === this.hero.r && cell.c === this.hero.c

    if (isHero) {
      this.selected = cell
      this.msg = '已选中英雄，点空地移动'
    } else if (this.selected) {
      // 简单规则：只能移动到草地/森林/城池，山和水不能走
      if (t === TERRAIN.MOUNTAIN || t === TERRAIN.WATER) {
        this.msg = '山和水不能走'
        return
      }
      this.hero = { r: cell.r, c: cell.c }
      this.selected = null
      this.msg = t === TERRAIN.CITY ? '入城！' : '已移动'
    }
  }
}
