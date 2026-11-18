import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const attack = process.argv[2];
const list = {
  confusion: ['price-rules-1.99.0', 'price-rules-99.0.0'],
  'confusion-scoped': ['scoped-price-rules-1.99.0'],
  typo: ['string-paddr-2.4.0'],
  hijack: ['string-padder-2.4.1'],
};
if (!list[attack]) {
  console.error(`알 수 없는 공격 재연: ${attack}`);
  process.exit(2);
}
if (!existsSync('.lab/seed.npmrc')) {
  console.error('먼저 make up을 실행하세요.');
  process.exit(1);
}
console.log(`교육용: ${attack} — 로컬 127.0.0.1:4874에만 게시`);
for (const folder of list[attack]) {
  const path = `./attacker-sim/${folder}`;
  const pkg = JSON.parse((await import('node:fs')).readFileSync(`${path}/package.json`, 'utf8'));
  const view = spawnSync('npm', ['view', `${pkg.name}@${pkg.version}`, 'version', '--registry', 'http://127.0.0.1:4874/', '--fetch-retries=0'], { encoding: 'utf8' });
  if (view.status === 0) { console.log(`이미 게시됨: ${pkg.name}@${pkg.version}`); continue; }
  const result = spawnSync('npm', ['publish', path, '--registry', 'http://127.0.0.1:4874/', '--userconfig', '.lab/seed.npmrc', '--access', 'public', '--ignore-scripts'], { encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(result.stderr);
    process.exit(result.status || 1);
  }
  console.log(`게시: ${pkg.name}@${pkg.version}`);
}
