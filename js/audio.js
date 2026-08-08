// 音频管理：背景音乐（主城/战斗）与攻击/受击音效的创建、播放与销毁
import { isSoundOn, isMusicOn } from './data.js'

let mainBgCtx = null
let battleBgCtx = null
let hitCtx = null
let attackCtx = null
const lastSfxTime = { hit: 0, attack: 0 }
const SFX_MIN_INTERVAL = 50 // 毫秒：同类音效最多每 50ms 播放一次，避免同帧刷屏叠音

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
  stopBattleBg()
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
  stopMainBg()
  if (!isMusicOn()) return
  if (battleBgCtx) return
  battleBgCtx = createLoopMusic('assets/sound/battle_bg.mp3')
  battleBgCtx.play()
}

export function stopBattleBg() {
  stopAndDestroy(battleBgCtx)
  battleBgCtx = null
}

// ---- 攻击/受击音效 ----
function playSfx(kind, src, currentCtx) {
  if (!isSoundOn()) return
  const now = Date.now()
  if (now - lastSfxTime[kind] < SFX_MIN_INTERVAL) return
  lastSfxTime[kind] = now
  // 每次播放重新创建音频上下文，避免上一次播放未结束时被打断/重叠
  stopAndDestroy(currentCtx)
  const ctx = tt.createInnerAudioContext()
  ctx.src = src
  ctx.play()
  return ctx
}

export function playAttack() {
  attackCtx = playSfx('attack', 'assets/sound/attack.mp3', attackCtx) || attackCtx
}

export function playHit() {
  hitCtx = playSfx('hit', 'assets/sound/hit.mp3', hitCtx) || hitCtx
}
