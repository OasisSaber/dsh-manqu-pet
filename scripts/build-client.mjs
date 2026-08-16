// 生成器：.dsh-plugin/client/index.mjs → .dsh-plugin/client.js（bundle 产物，随插件分发）。
// 契约：--check 模式在内存生成后与已提交 .dsh-plugin/client.js 逐字节比对，不一致非零退出。
// 用 esbuild JS API（Windows 下 .bin CLI 是 sh 脚本，node spawnSync 直跑会失败）。
import { join } from 'node:path'
import { build } from 'esbuild'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = resolve(import.meta.dirname, '..')
const ENTRY = '.dsh-plugin/client/index.mjs'
const OUTPUT = join(ROOT, '.dsh-plugin', 'client.js')

async function bundle() {
  const res = await build({
    entryPoints: [ENTRY],
    bundle: true,
    format: 'cjs',
    platform: 'browser',
    target: 'es2020',
    write: false,
    logLevel: 'silent',
  })
  return res.outputFiles[0].text
}

export async function generate({ check = false, root = ROOT } = {}) {
  let body
  try {
    body = await bundle()
  } catch (error) {
    return { ok: false, errors: ['esbuild 失败：' + (error instanceof Error ? error.message : String(error))] }
  }
  const wrapper = [
    'window.__ModuleLoader__.load({',
    '\tid: "dsh-manqu-pet",',
    '\tfactory: (require) => {',
    '\t\tvar module = { exports: {} };',
    '\t\tvar exports = module.exports;',
  ].join('\n')
  const tail = '\n\t\treturn module.exports;\n\t}\n});\n'
  const code = Buffer.from(wrapper + '\n' + body.replace(/\n$/, '') + tail)
  const outputPath = join(root, '.dsh-plugin', 'client.js')
  if (!check) {
    writeFileSync(outputPath, code)
    return { ok: true }
  }
  let committed = null
  try {
    committed = readFileSync(outputPath)
  } catch {
    return { ok: false, errors: [outputPath + ' 不存在：运行 node scripts/build-client.mjs 生成'] }
  }
  if (Buffer.compare(committed, code) !== 0) {
    return { ok: false, errors: ['client.js 与生成器输出不一致：运行 node scripts/build-client.mjs 重新生成（手改生成物禁止）'] }
  }
  return { ok: true }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const check = process.argv.includes('--check')
  const result = await generate({ check })
  if (!result.ok) {
    for (const e of result.errors ?? []) console.error('[build-client] ' + e)
    process.exit(1)
  }
  console.log(check ? '[build-client] client.js 新鲜（--check OK）' : '[build-client] client.js 已生成')
}
