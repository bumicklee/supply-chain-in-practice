import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

const state = '.lab/seeded';
mkdirSync('.lab', { recursive: true });
function writeEnv(token) {
  writeFileSync('.lab/env', `export NPM_LAB_TOKEN=${token}\nexport LAB_FAKE_CI_TOKEN=LAB_FAKE_TOKEN_DO_NOT_USE\nexport LAB_MARKER_DIR=${join(process.cwd(), '.lab/markers')}\n`, { mode: 0o600 });
}
if (existsSync(state)) {
  const token = readFileSync('.lab/seed.npmrc', 'utf8').match(/\/\/127\.0\.0\.1:4873\/:_authToken=(.+)/)?.[1];
  if (!token) throw new Error('시드 표시가 있지만 토큰이 없습니다.');
  writeEnv(token);
  console.log('실습 패키지 게시 완료 상태');
  process.exit(0);
}

const packages = [
  { name: 'price-rules', version: '1.2.0', port: 4873,
    source: 'exports.price = (base, quantity) => Math.round(base * quantity * 0.9);\n' },
  { name: '@parts/price-rules', version: '1.2.0', port: 4873,
    source: 'exports.price = (base, quantity) => Math.round(base * quantity * 0.9);\n' },
  { name: 'string-padder', version: '2.4.0', port: 4874,
    source: 'exports.pad = value => String(value).padStart(6, "0");\n' },
  { name: '@parts/fast-hash', version: '1.0.0', port: 4873,
    source: 'exports.hash = value => require("./build/binding.js").hash(value);\n',
    scripts: { install: 'node build.js' },
    extra: { 'build.js': 'require("node:fs").mkdirSync("build", {recursive:true}); require("node:fs").writeFileSync("build/binding.js", "exports.hash = value => require(\\"node:crypto\\").createHash(\\"sha256\\").update(String(value)).digest(\\"hex\\");\\n");\n' } },
];

const npmrc = '.lab/seed.npmrc';
const tokens = new Map();
for (const port of [4873, 4874]) {
  const username = `lab${port}`;
  const response = await fetch(`http://127.0.0.1:${port}/-/user/org.couchdb.user:${username}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: username, password: randomBytes(18).toString('base64url'), email: `${username}@example.invalid`, type: 'user', roles: [] }),
  });
  if (!response.ok) throw new Error(`로컬 레지스트리 ${port} 사용자 생성 실패: HTTP ${response.status}`);
  const body = await response.json();
  if (!body.token) throw new Error(`로컬 레지스트리 ${port} 토큰 없음`);
  tokens.set(port, body.token);
  console.log(`로컬 레지스트리 ${port} 사용자 생성`);
}
writeFileSync(npmrc, [...tokens].map(([port, value]) => `//127.0.0.1:${port}/:_authToken=${value}`).join('\n') + '\n', { mode: 0o600 });
const token = tokens.get(4873);
if (!token) throw new Error('사내 레지스트리 토큰을 얻지 못했습니다.');
writeEnv(token);

for (const pkg of packages) {
  const folder = join('.lab', 'seed', pkg.name.replaceAll('/', '__'));
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, 'package.json'), JSON.stringify({ name: pkg.name, version: pkg.version, main: 'index.js', scripts: pkg.scripts || {}, publishConfig: { registry: `http://127.0.0.1:${pkg.port}/` } }, null, 2));
  writeFileSync(join(folder, 'index.js'), pkg.source);
  for (const [name, content] of Object.entries(pkg.extra || {})) writeFileSync(join(folder, name), content);
  const result = spawnSync('npm', ['publish', folder, '--registry', `http://127.0.0.1:${pkg.port}/`, '--userconfig', npmrc, '--access', 'public', '--ignore-scripts'], { encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(`${pkg.name}@${pkg.version} 게시 실패:\n${result.stderr}\n${result.stdout}`);
    process.exit(result.status || 1);
  }
  console.log(`게시: ${pkg.name}@${pkg.version} → 127.0.0.1:${pkg.port}`);
}
writeFileSync(state, `${new Date().toISOString()}\n`);
