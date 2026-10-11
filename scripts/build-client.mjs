/**
 * 构建 client 半单体 bundle（lib/client.js）：
 * dsh 平台契约：根级单文件 + window.__ModuleLoader__.load 注册包装（官方 tsdown 产物同构）。
 * 附加：注入 src/client/styles.css（style[data-plugin] 标签，HMR 可清理）。
 */
import { build } from 'esbuild'
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

await build({
  entryPoints: ['src/client/index.ts'],
  bundle: true,
  platform: 'browser',
  format: 'cjs',
  jsx: 'automatic',
  outfile: 'lib/.client.bundle.cjs',
  external: ['@deepseek-ai/*', 'react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
  sourcemap: false,
  // 生产压缩：减小发布包体积（插件自身代码为主）
  minify: true,
  logLevel: 'info',
})

const body = readFileSync('lib/.client.bundle.cjs', 'utf8')
rmSync('lib/.client.bundle.cjs')

// 样式注入（data-plugin 标签；HMR 拆卸移除后重载重建）
let cssBlock = ''
try {
  const cssFile = readFileSync(new URL('../src/client/styles.css', import.meta.url), 'utf8')
  if (cssFile.trim()) {
    cssBlock = `
if (typeof document !== 'undefined') {
  try {
    if (!document.getElementById('mgs-styles')) {
      var mgsStyle = document.createElement('style');
      mgsStyle.id = 'mgs-styles';
      mgsStyle.setAttribute('data-plugin', ${JSON.stringify('__PKG__')});
      mgsStyle.textContent = ${JSON.stringify(cssFile)};
      document.head.appendChild(mgsStyle);
    }
  } catch (mgsErr) { /* 样式注入失败不影响逻辑 */ }
}
`.replace('__PKG__', pkg.name)
  }
} catch { /* 无样式文件则跳过 */ }

// 注入包版本 + 构建戳（徽章用；同时用于排查「装的是不是最新代码」）
const git = (() => {
  try {
    return {
      sha: execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(),
      date: execFileSync('git', ['show', '-s', '--format=%cI', 'HEAD'], { encoding: 'utf8' }).trim(),
    }
  } catch {
    return { sha: 'unknown', date: '' }
  }
})()
const buildStamp = `${pkg.version}+${git.sha}`
const versionBlock = `const MGS_VERSION = ${JSON.stringify(pkg.version)};
const MGS_BUILD = ${JSON.stringify(buildStamp)};
/* 构建标记（可用性排查）：控制台搜 "[mgs-build]" 或读 window.__MGS_BUILD__ */
try {
  window.__MGS_BUILD__ = { version: MGS_VERSION, build: MGS_BUILD, sha: ${JSON.stringify(git.sha)}, commitDate: ${JSON.stringify(git.date)}, builtAt: ${JSON.stringify(new Date().toISOString())} };
  console.info('[mgs-build] dsh-mega-settings ' + MGS_BUILD + ' · commit ' + ${JSON.stringify(git.sha)} + ' · ' + ${JSON.stringify(git.date)});
} catch (e) { /* 非浏览器环境忽略 */ }
`

const out = `window.__ModuleLoader__.load({
	id: ${JSON.stringify(pkg.name)},
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
${cssBlock}${versionBlock}${body}
		return module.exports;
	}
});
`

writeFileSync('lib/client.js', out)
console.log(`lib/client.js written (${out.length} bytes)`)