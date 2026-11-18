import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = '.lab/pack-matrix';
mkdirSync(dir, { recursive: true });
mkdirSync('.lab/npm-cache', { recursive: true });
const marker = join(dir, 'markers.txt');
const npmrc = join(dir, '.npmrc');
const pkg = {
  name: 'pack-scripts-probe', version: '1.0.0',
  scripts: Object.fromEntries(['prepack', 'prepare', 'postpack'].map(name =>
    [name, `node -e "require('fs').appendFileSync('markers.txt','${name}\\n')"`]))
};
writeFileSync(join(dir, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
const run = (...args) => {
  const result = spawnSync('npm', args, { cwd: dir, encoding: 'utf8', env: { ...process.env, NPM_CONFIG_USERCONFIG: '/dev/null', NPM_CONFIG_CACHE: `${process.cwd()}/.lab/npm-cache` } });
  if (result.status !== 0) throw new Error(`npm ${args.join(' ')} 실패: ${result.stderr}`);
};
run('install', '--package-lock-only', '--ignore-scripts', '--offline');
const cases = [
  ['① 프로젝트 .npmrc ignore-scripts=true', true, false, []],
  ['② .npmrc 없음', false, false, []],
  ['③ npm ci --ignore-scripts 뒤 npm pack', false, true, []],
  ['④ npm pack --ignore-scripts', false, false, ['--ignore-scripts']],
];
console.log('경우 | prepack | prepare | postpack');
console.log('--- | --- | --- | ---');
for (const [label, ignoredByFile, priorCi, packArgs] of cases) {
  rmSync(marker, { force: true });
  if (ignoredByFile) writeFileSync(npmrc, 'ignore-scripts=true\n');
  else rmSync(npmrc, { force: true });
  if (priorCi) run('ci', '--ignore-scripts', '--offline');
  run('pack', ...packArgs);
  const seen = readFileSync(marker, { encoding: 'utf8', flag: 'a+' }).split('\n');
  console.log(`${label} | ${['prepack', 'prepare', 'postpack'].map(name => seen.includes(name) ? '실행' : '미실행').join(' | ')}`);
}
