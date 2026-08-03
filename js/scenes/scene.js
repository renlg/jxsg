// 场景基类：每个场景实现 enter/update/render/onTouch
export class Scene {
  constructor(game) {
    this.game = game
    this.touchHandlers = []
  }

  enter() {}

  // 离开场景（切换到其他场景前调用，用于清理音频等资源）
  leave() {}

  update(dt) {}

  render(ctx) {}

  onTouch(x, y) {}

  // 触摸移动（拖动滚动用）
  onTouchMove(x, y) {}

  // 触摸结束（区分点击与拖动后执行操作）
  onTouchEnd(x, y) {}

  // 检测点是否在矩形内（用于按钮点击）
  hitRect(x, y, rx, ry, rw, rh) {
    return x >= rx && x <= rx + rw && y >= ry && y <= ry + rh
  }
}
