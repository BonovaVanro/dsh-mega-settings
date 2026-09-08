/**
 * 构建 client 半单体 bundle（lib/client.js）：
 * dsh 平台契约：根级单文件 + window.__ModuleLoader__.load 注册包装（官方 tsdown 产物同构）。
 * 附加：注入 src/client/styles.css（style[data-plugin] 标签，HMR 可清理）。
 */
import { build } from 'esbuild'
import { readFileSync, writeFileSync, rmSync } from 'node:fs'

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

// 注入包版本（徽章展示真实版本；SettingsCenter 内 ambient 声明引用）
const versionBlock = `const MGS_VERSION = ${JSON.stringify(pkg.version)};
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