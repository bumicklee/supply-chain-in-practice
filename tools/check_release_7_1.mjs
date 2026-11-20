import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const read = rel => { try { return fs.readFileSync(path.join(root, rel), 'utf8'); } catch { return ''; } };
let passed = 0;
let failed = 0;
function check(ok, good, bad) {
  console.log(`${ok ? '✓' : '✗'} ${ok ? good : bad}`);
  if (ok) passed++; else failed++;
}
let state = {}, pkg = {}, lock = {}, fixture = {}, bom = {};
for (const [rel, assign] of [
  ['.lab/checkpoint.json', value => state = value],
  ['parts-api/package.json', value => pkg = value],
  ['parts-api/package-lock.json', value => lock = value],
  ['solutions/checkpoints/7-1/parts-api/package-lock.json', value => fixture = value],
  ['.lab/releases/parts-api-1.1.0.cdx.json', value => bom = value],
]) { try { assign(JSON.parse(read(rel))); } catch {} }
check(spawnSync('git', ['--version'], { cwd: root, encoding: 'utf8' }).status === 0,
  'Git 사용 가능', 'Git을 설치하세요.');
check(state.lesson === '7-1', '7-1 실습 지점 선택됨', 'make goto L=7-1을 먼저 실행하세요.');
check(state.at === 'done', '7-1 끝 지점임', '현재는 시작 지점입니다.');
check(pkg.version === '1.1.0' && lock.version === '1.1.0',
  '패키지와 잠금 파일 모두 1.1.0', '1.1.0 시작 지점을 다시 만드세요.');
check(read('parts-api/.npmrc').includes('ignore-scripts=true'),
  '프로젝트 설정에서 설치·묶기 스크립트 차단', 'parts-api/.npmrc에 ignore-scripts=true를 두세요.');
check(['prepack', 'prepare', 'postpack', 'prepublishOnly'].every(name => !pkg.scripts?.[name]),
  '묶기 전후 스크립트 없음', 'package.json의 묶기 스크립트를 확인하세요.');
const entries = Object.entries(lock.packages ?? {});
const local = entries.filter(([key]) => key.startsWith('node_modules/@parts/') || key === 'node_modules/string-padder');
check(local.length === 3 && local.every(([, item]) => item.resolved?.startsWith('file:vendor/')),
  '사내 전용 부품 3개를 vendor 파일로 고정', 'make vendor를 실행하세요.');
let integrity = true;
for (const [, item] of local) {
  try {
    const data = fs.readFileSync(path.join(root, 'parts-api', item.resolved.slice(5)));
    if (`sha512-${createHash('sha512').update(data).digest('base64')}` !== item.integrity) integrity = false;
  } catch { integrity = false; }
}
check(integrity, 'vendor tarball 3개의 SHA-512 지문 일치', 'make vendor-check로 지문을 확인하세요.');
const same = entries.length === Object.keys(fixture.packages ?? {}).length && entries.every(([key, item]) => {
  const before = fixture.packages?.[key];
  return before && JSON.stringify({ ...item, resolved: before.resolved }) === JSON.stringify(before);
});
check(same, '잠금 파일에서 받은 주소만 변경, 버전·지문 유지', '잠금 파일의 버전·integrity가 바뀌었는지 확인하세요.');
const workflow = read('.github/workflows/release.yml');
check((workflow.match(/uses: actions\/attest@/g) ?? []).length === 2 &&
  (workflow.match(/subject-path: \$\{\{ steps\.pack\.outputs\.tgz \}\}/g) ?? []).length === 2 &&
  workflow.includes('sbom-path:') && !workflow.includes('secrets.'),
  '릴리스 워크플로의 출처·SBOM 증명과 비밀값 참조 0개', 'release.yml의 두 증명 단계와 권한을 확인하세요.');
const tgz = '.lab/releases/parts-api-1.1.0.tgz';
const archive = spawnSync('tar', ['-tzf', tgz], { cwd: root, encoding: 'utf8' });
const listing = archive.stdout ?? '';
check(archive.status === 0 && listing.includes('package/npm-shrinkwrap.json') && listing.includes('package/vendor/') && !listing.includes('node_modules/'),
  '로컬 tgz에 잠금 목록·vendor 포함, node_modules 제외', 'make release-local V=1.1.0을 실행하세요.');
check(bom.bomFormat === 'CycloneDX' && (bom.components?.length ?? 0) > 70,
  '운영 의존성 SBOM 생성', '운영 의존성 설치 후 Syft SBOM을 확인하세요.');
check(read('.lab/release-7-1/release-local.txt').includes('pass 5') &&
  read('.lab/release-7-1/release-compare.txt').includes('운영 부품 목록 일치'),
  '릴리스 전 API 시험 5건과 운영 부품 대조 통과', '릴리스 생성 시험과 SBOM 부품 대조를 확인하세요.');
console.log('GitHub 출처·SBOM 증명은 별도 공개 포크에서 확인합니다. 이 검사는 로컬 릴리스 경로입니다.');
console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
