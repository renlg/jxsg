// 远程资源开关：本地开发默认 false（素材从包内 assets/ 加载，行为与之前完全一致）
// 分包体积超过抖音小游戏 30MB 限制时，将素材上传至抖音云 TOS 对象存储后，
// 打包发布前手动置为 true，使图片/音频改为从 REMOTE_BASE 加载
export const REMOTE_ASSETS = true

// 抖音云 TOS 对象存储基础地址（已验证 assets/... 路径均可直接拼接访问）
export const REMOTE_BASE = 'https://tt5dfd2b40c39801bd02-env-igrgycscux.tos-cn-beijing.volces.com/'

// 统一资源路径解析：REMOTE_ASSETS 为 true 时拼接远程地址，否则原样返回本地相对路径
export function assetUrl(p) {
  return REMOTE_ASSETS ? REMOTE_BASE + p : p
}

// 已确认存在于本地文件系统的缓存路径，避免每次进场景都调用 accessSync 做同步 IO
const _localPathCache = {}
// downloadFile 真机实现可能忽略 filePath，记录每个资源实际返回的可用路径
const _pathMap = {}
// 实际落盘路径可能在临时目录，持久化映射后重启仍可直接复用
const ASSET_PATH_MAP_STORAGE_KEY = 'jxsg_asset_path_map'
// 同一路径的下载 Promise 去重：防止多个场景/多次预加载并发对同一文件重复 downloadFile
const _downloadingPromises = {}
// 环境能力诊断每个会话只打印一次
let _diagLogged = false

// 存储能力不可用或数据异常时静默降级，保持原有运行行为
function restoreAssetMap() {
  if (typeof tt === 'undefined' || typeof tt.getStorageSync !== 'function') return

  try {
    const storedMap = tt.getStorageSync(ASSET_PATH_MAP_STORAGE_KEY)
    if (!storedMap || typeof storedMap !== 'object' || Array.isArray(storedMap)) return

    Object.keys(storedMap).forEach(p => {
      const actualPath = storedMap[p]
      if (typeof actualPath !== 'string' || !actualPath) return
      _pathMap[p] = actualPath
      _localPathCache[actualPath] = true
    })
  } catch (e) {
    // 持久化存储不可用，不影响资源正常下载
  }
}

function persistAssetMap() {
  if (typeof tt === 'undefined' || typeof tt.setStorageSync !== 'function') return

  try {
    const storedMap = typeof tt.getStorageSync === 'function'
      ? tt.getStorageSync(ASSET_PATH_MAP_STORAGE_KEY)
      : null
    const nextMap = storedMap && typeof storedMap === 'object' && !Array.isArray(storedMap)
      ? Object.assign({}, storedMap, _pathMap)
      : Object.assign({}, _pathMap)
    tt.setStorageSync(ASSET_PATH_MAP_STORAGE_KEY, nextMap)
  } catch (e) {
    // 写入失败只影响下次启动的缓存复用，不影响本次游戏
  }
}

restoreAssetMap()

// 真机 tt.createImage()/InnerAudioContext 对网络 URL 不遵守 HTTP 缓存，每次切场景都会重新从
// TOS 拉取同一批素材；这里把远程素材首次下载后落盘到 USER_DATA_PATH，后续直接读本地文件路径，
// 从根本上避免重复联网下载。REMOTE_ASSETS 为 false（本地开发）时行为与 assetUrl 完全一致。
export async function getLocalAssetPath(p) {
  if (!_diagLogged) {
    _diagLogged = true
    console.log('[Assets] env:', JSON.stringify({
      hasEnv: typeof tt !== 'undefined',
      hasUserDataPath: !!(typeof tt !== 'undefined' && tt.env && tt.env.USER_DATA_PATH),
      userDataPath: (typeof tt !== 'undefined' && tt.env && tt.env.USER_DATA_PATH) || null,
      hasDownload: typeof tt !== 'undefined' && typeof tt.downloadFile === 'function',
      hasFSM: typeof tt !== 'undefined' && typeof tt.getFileSystemManager === 'function'
    }))
  }

  if (!REMOTE_ASSETS) return p

  const remoteUrl = REMOTE_BASE + p
  const canCache = typeof tt !== 'undefined' && tt.env && tt.env.USER_DATA_PATH &&
    typeof tt.downloadFile === 'function' && typeof tt.getFileSystemManager === 'function'
  if (!canCache) return remoteUrl

  const localPath = tt.env.USER_DATA_PATH + '/' + p.replace(/\//g, '_')

  if (_pathMap[p]) return _pathMap[p]
  if (_localPathCache[localPath]) return localPath

  try {
    tt.getFileSystemManager().accessSync(localPath)
    _localPathCache[localPath] = true
    return localPath
  } catch (e) {
    // 文件不存在，走下载流程
  }

  if (_downloadingPromises[localPath]) return _downloadingPromises[localPath]

  const promise = new Promise(resolve => {
    tt.downloadFile({
      url: remoteUrl,
      filePath: localPath,
      success: (res) => {
        try {
          const actualPath = (res && (res.filePath || res.tempFilePath)) || localPath
          console.log('[Assets] dl ok:', p, '-> assumed', localPath, '| actual', actualPath || '?', '| status', res && res.statusCode)
          if (res && (res.statusCode === 200 || res.filePath || res.tempFilePath)) {
            _pathMap[p] = actualPath
            _localPathCache[localPath] = true
            if (typeof actualPath === 'string' && actualPath && actualPath !== localPath) {
              _localPathCache[actualPath] = true
            }
            // 每个成功素材立即落库，避免退出或异常中断时丢失已下载映射
            persistAssetMap()
            if (typeof actualPath === 'string' && actualPath && actualPath !== localPath) {
              resolve(actualPath)
            } else {
              resolve(localPath)
            }
          } else {
            console.warn('[Assets] 下载状态异常，回退远程地址:', p, res)
            resolve(remoteUrl)
          }
        } catch (err) {
          console.warn('[Assets] 处理本地缓存结果失败，回退远程地址:', p, err)
          resolve(remoteUrl)
        }
      },
      fail: (err) => {
        console.warn('[Assets] 本地缓存下载失败，回退远程地址:', p, err)
        resolve(remoteUrl)
      }
    })
  }).finally(() => {
    delete _downloadingPromises[localPath]
  })
  _downloadingPromises[localPath] = promise
  return promise
}
