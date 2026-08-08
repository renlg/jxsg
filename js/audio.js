// 音频管理：背景音乐（主城/战斗）与攻击/受击音效的创建、播放与销毁
import { isSoundOn, isMusicOn } from './data.js'
import { getLocalAssetPath } from './config.js'

let mainBgCtx = null
let battleBgCtx = null
let hitCtx = null
let attackCtx = null
let mainBgRequest = 0
let battleBgRequest = 0
const lastSfxTime = { hit: 0, attack: 0 }
const SFX_MIN_INTERVAL = 50 // 毫秒：同类音效最多每 50ms 播放一次，避免同帧刷屏叠音
const AUDIO_ASSETS = {
  mainBg: 'assets/sound/main_bg.mp3',
  battleBg: 'assets/sound/battle_bg.mp3',
  attack: 'assets/sound/attack.mp3',
  hit: 'assets/sound/hit.mp3'
}
const resolvedAudioPaths = {}
const resolvingAudioPaths = {}

// 首次使用时解析并缓存本地音频路径；后续播放直接同步取得最终路径。
function withAudioPath(kind, callback) {
  if (resolvedAudioPaths[kind]) {
    callback(resolvedAudioPaths[kind])
    return
  }
  if (!resolvingAudioPaths[kind]) {
    resolvingAudioPaths[kind] = getLocalAssetPath(AUDIO_ASSETS[kind]).then(path => {
      resolvedAudioPaths[kind] = path
      delete resolvingAudioPaths[kind]
      return path
    })
  }
  resolvingAudioPaths[kind].then(callback)
}

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
  const request = ++mainBgRequest
  withAudioPath('mainBg', path => {
    if (request !== mainBgRequest || !isMusicOn() || mainBgCtx) return
    mainBgCtx = createLoopMusic(path)
    mainBgCtx.play()
  })
}

export function stopMainBg() {
  mainBgRequest++
  stopAndDestroy(mainBgCtx)
  mainBgCtx = null
}

// ---- 战斗背景音乐 ----
export function playBattleBg() {
  stopMainBg()
  if (!isMusicOn()) return
  if (battleBgCtx) return
  const request = ++battleBgRequest
  withAudioPath('battleBg', path => {
    if (request !== battleBgRequest || !isMusicOn() || battleBgCtx) return
    battleBgCtx = createLoopMusic(path)
    battleBgCtx.play()
  })
}

export function stopBattleBg() {
  battleBgRequest++
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
  withAudioPath('attack', path => {
    attackCtx = playSfx('attack', path, attackCtx) || attackCtx
  })
}

export function playHit() {
  withAudioPath('hit', path => {
    hitCtx = playSfx('hit', path, hitCtx) || hitCtx
  })
}
