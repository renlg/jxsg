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
// 同一路径的下载 Promise 去重：防止多个场景/多次预加载并发对同一文件重复 downloadFile
const _downloadingPromises = {}

// 真机 tt.createImage()/InnerAudioContext 对网络 URL 不遵守 HTTP 缓存，每次切场景都会重新从
// TOS 拉取同一批素材；这里把远程素材首次下载后落盘到 USER_DATA_PATH，后续直接读本地文件路径，
// 从根本上避免重复联网下载。REMOTE_ASSETS 为 false（本地开发）时行为与 assetUrl 完全一致。
export async function getLocalAssetPath(p) {
  if (!REMOTE_ASSETS) return p

  const remoteUrl = REMOTE_BASE + p
  const canCache = typeof tt !== 'undefined' && tt.env && tt.env.USER_DATA_PATH &&
    typeof tt.downloadFile === 'function' && typeof tt.getFileSystemManager === 'function'
  if (!canCache) return remoteUrl

  const localPath = tt.env.USER_DATA_PATH + '/' + p.replace(/\//g, '_')

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
        if (res && (res.statusCode === 200 || res.filePath)) {
          _localPathCache[localPath] = true
          resolve(localPath)
        } else {
          console.warn('[Assets] 下载状态异常，回退远程地址:', p, res)
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
