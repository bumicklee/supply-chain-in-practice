import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const folder = '.lab/seed/price-rules-1.2.1';
mkdirSync(folder, { recursive: true });
writeFileSync(`${folder}/package.json`, JSON.stringify({
  name: '@parts/price-rules', version: '1.2.1', main: 'index.js',
  publishConfig: { registry: 'http://127.0.0.1:4873/' },
}, null, 2));
writeFileSync(`${folder}/index.js`, 'exports.price = (base, quantity) => Math.round(base * quantity * 0.9);\n');
const result = spawnSync('npm', ['publish', folder, '--registry', 'http://127.0.0.1:4873/', '--userconfig', '.lab/seed.npmrc', '--access', 'public', '--ignore-scripts'], { encoding: 'utf8' });
if (result.status !== 0 && !result.stderr.includes('cannot publish over the previously published versions')) {
  console.error(result.stderr);
  process.exit(result.status || 1);
}
console.log('사내 실습 패키지 @parts/price-rules@1.2.1 준비');
