// 音频管理：背景音乐（主城/战斗）与受击音效的创建、播放与销毁
import { isSoundOn, isMusicOn } from './data.js'

let mainBgCtx = null
let battleBgCtx = null
let hitCtx = null
let lastHitTime = 0
const HIT_MIN_INTERVAL = 50 // 毫秒：同一帧多次受击时，最多每 50ms 播放一次音效，避免刷屏叠音

function createLoopMusic(src) {
  const ctx = tt.createInnerAudioContext()
  ctx.src = src
  ctx.loop = true
  return ctx
}

function stopAndDestroy(ctx) {
  if (!ctx) return
  ctx.stop()
  ctx.destroy()
}

// ---- 主城背景音乐 ----
export function playMainBg() {
  if (!isMusicOn()) return
  if (mainBgCtx) return // 已在播放，避免重复创建
  mainBgCtx = createLoopMusic('assets/sound/main_bg.mp3')
  mainBgCtx.play()
}

export function stopMainBg() {
  stopAndDestroy(mainBgCtx)
  mainBgCtx = null
}

// ---- 战斗背景音乐 ----
export function playBattleBg() {
  if (!isMusicOn()) return
  if (battleBgCtx) return
  battleBgCtx = createLoopMusic('assets/sound/battle_bg.mp3')
  battleBgCtx.play()
}

export function stopBattleBg() {
  stopAndDestroy(battleBgCtx)
  battleBgCtx = null
}

// ---- 受击音效 ----
export function playHit() {
  if (!isSoundOn()) return
  const now = Date.now()
  if (now - lastHitTime < HIT_MIN_INTERVAL) return
  lastHitTime = now
  // 每次播放重新创建音频上下文，避免上一次播放未结束时被打断/重叠
  stopAndDestroy(hitCtx)
  hitCtx = tt.createInnerAudioContext()
  hitCtx.src = 'assets/sound/hit.mp3'
  hitCtx.play()
}
