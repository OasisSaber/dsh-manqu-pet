// assets 静态服务守卫：路径净化 + MIME 映射（纯函数，零宿主依赖，可单测）。
// 契约：从请求 pathname 提取相对 assets 目录的安全子路径；含 `..`/`.`/空段/`\\`（Windows 分隔符）/绝对路径即拒绝。
import { ASSETS_PATH } from './routes.mjs'
export { ASSETS_PATH }

export function sanitizeAssetPath(pathname, prefix = ASSETS_PATH) {
  if (!pathname.startsWith(`${prefix}/`)) return null
  const rel = pathname.slice(prefix.length + 1)
  if (rel === '' || rel.includes('\0')) return null
  const segments = rel.split('/')
  for (const s of segments) {
    if (s === '' || s === '.' || s === '..' || s.includes('\\')) return null
  }
  return rel
}

const MIME = {
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8',
}

export function contentTypeFor(rel) {
  const dot = rel.lastIndexOf('.')
  const ext = dot === -1 ? '' : rel.slice(dot).toLowerCase()
  return MIME[ext] ?? 'application/octet-stream'
}
