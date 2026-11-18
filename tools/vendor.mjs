import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const lockPath = 'parts-api/package-lock.json';
const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
const token = readFileSync('.lab/seed.npmrc', 'utf8').match(/\/\/127\.0\.0\.1:4873\/:_authToken=(.+)/)?.[1];
if (!token) throw new Error('make up을 먼저 실행하세요.');
mkdirSync('parts-api/vendor', { recursive: true });
let changed = 0;
for (const [key, entry] of Object.entries(lock.packages)) {
  const local = key.startsWith('node_modules/@parts/') || key === 'node_modules/string-padder';
  if (!local || !entry.resolved?.startsWith('http://127.0.0.1:4873/')) continue;
  const name = key.slice('node_modules/'.length).replace('@', '').replaceAll('/', '-');
  const filename = `${name}-${entry.version}.tgz`;
  const response = await fetch(entry.resolved, { headers: { authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`${key} 다운로드 실패: HTTP ${response.status}`);
  const data = Buffer.from(await response.arrayBuffer());
  const actual = `sha512-${createHash('sha512').update(data).digest('base64')}`;
  if (actual !== entry.integrity) throw new Error(`${key} tarball 지문 불일치`);
  writeFileSync(`parts-api/vendor/${filename}`, data);
  entry.resolved = `file:vendor/${filename}`;
  console.log(`✓ ${key} → vendor/${filename}`);
  changed++;
}
let publicUrls = 0;
for (const [key, entry] of Object.entries(lock.packages)) {
  if (!entry.resolved?.startsWith('http://127.0.0.1:4873/')) continue;
  if (key.startsWith('node_modules/@parts/') || key === 'node_modules/string-padder') {
    throw new Error(`${key} 사내 tarball이 vendor에 고정되지 않았습니다.`);
  }
  entry.resolved = entry.resolved.replace('http://127.0.0.1:4873/', 'https://registry.npmjs.org/');
  publicUrls++;
}
if (!changed) console.log('이미 고정된 사내 tarball을 확인합니다.');
writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
console.log(`vendor 완료: 사내 tarball ${changed}개, 공개 URL ${publicUrls}개 변경`);
