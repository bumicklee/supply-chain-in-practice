import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const userconfig = resolve(root, '.lab/seed.npmrc');
for (const [version, rules] of [['1.0.0', '1.2.0'], ['1.1.0', '1.2.1']]) {
  const dir = resolve(root, `fixtures/releases/${version}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/package.json`, JSON.stringify({
    name: 'parts-api', version, private: true,
    dependencies: {
      '@parts/fast-hash': '1.0.0', '@parts/price-rules': rules,
      express: '4.21.2', lodash: '4.17.20', minimist: '0.2.4', 'string-padder': '2.4.0',
    },
  }, null, 2) + '\n');
  const result = spawnSync('npm', ['install', '--package-lock-only', '--ignore-scripts', '--registry=http://127.0.0.1:4873/', '--userconfig', userconfig, '--cache', resolve(root, '.lab/npm-cache-fixtures')], { cwd: dir, encoding: 'utf8' });
  if (result.status !== 0) { console.error(result.stderr); process.exit(result.status || 1); }
  console.log(`✓ 릴리스 ${version}: @parts/price-rules@${rules} 잠금 목록 생성`);
}
