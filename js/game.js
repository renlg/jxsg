// 游戏核心：管理画布、主循环、场景切换
export class Game {
  constructor() {
    this.canvas = tt.createCanvas()
    this.ctx = this.canvas.getContext('2d')

    const info = tt.getSystemInfoSync()
    this.width = info.windowWidth
    this.height = info.windowHeight
    const dpr = info.pixelRatio || 1
    this.canvas.width = Math.round(this.width * dpr)
    this.canvas.height = Math.round(this.height * dpr)
    this.ctx.scale(dpr, dpr)
    this.dpr = dpr

    this.scenes = {}
    this.current = null
    this.lastTime = 0

    this._bindTouch()
  }

  register(name, SceneClass) {
    this.scenes[name] = SceneClass
  }

  switch(name, params) {
    if (!this.scenes[name]) {
      console.error('[Game] 场景不存在:', name)
      return
    }
    // 离开当前场景前先做清理（如停止背景音乐、销毁音频上下文），避免多实例叠加
    if (this.current && typeof this.current.leave === 'function') {
      this.current.leave()
    }
    this.current = new this.scenes[name](this, params)
    this.current.enter()
  }

  start(name) {
    this.switch(name)
    const loop = (t) => {
      const dt = Math.min((t - this.lastTime) / 1000, 0.1)
      this.lastTime = t
      if (this.current) {
        this.current.update(dt)
        this.current.render(this.ctx)
      }
      this._raf(loop)
    }
    this._raf(loop)
  }

  // 帧循环兼容：抖音小游戏 canvas 无 requestAnimationFrame，
  // 优先用全局 API，否则用 setTimeout 模拟约 60fps
  _raf(fn) {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(fn)
    } else {
      setTimeout(fn, 16)
    }
  }

  _bindTouch() {
    tt.onTouchStart((e) => {
      const t = e.touches && e.touches[0]
      if (t && this.current) {
        this.current.onTouch(t.clientX, t.clientY)
      }
    })
    // 触摸移动：商店列表滚动用
    if (typeof tt.onTouchMove === 'function') {
      tt.onTouchMove((e) => {
        const t = e.touches && e.touches[0]
        if (t && this.current) {
          this.current.onTouchMove(t.clientX, t.clientY)
        }
      })
    }
    // 触摸结束：区分点击与拖动后执行操作
    if (typeof tt.onTouchEnd === 'function') {
      tt.onTouchEnd((e) => {
        const t = e.changedTouches && e.changedTouches[0]
        if (t && this.current) {
          this.current.onTouchEnd(t.clientX, t.clientY)
        }
      })
    }
  }
}
