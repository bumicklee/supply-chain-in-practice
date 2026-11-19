#!/usr/bin/env node
// 수업별 끝 상태 확인. 구현하지 않은 수업을 통과로 위장하지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const progress = path.join(root, '.lab', 'checkpoint.json');
const lesson = process.argv[2] || '';

if (lesson === '--where') {
  if (!fs.existsSync(progress)) {
    console.log('지점: 아직 지정되지 않음');
    process.exit(0);
  }
  try {
    const state = JSON.parse(fs.readFileSync(progress, 'utf8'));
    console.log(`지점: ${state.lesson} ${state.at === 'done' ? '끝' : '시작'}`);
    process.exit(0);
  } catch {
    console.error('✗ 지점 기록을 읽을 수 없습니다: .lab/checkpoint.json');
    process.exit(1);
  }
}

if (!/^\d+-\d+$/.test(lesson)) {
  console.error('사용법: make check L=N-M');
  process.exit(2);
}
if (!['1-1', '2-1', '2-2', '2-3'].includes(lesson)) {
  console.error(`✗ ${lesson} 끝 상태 확인은 아직 구현되지 않았습니다.`);
  process.exit(2);
}

let passed = 0;
let failed = 0;
function check(ok, success, failure) {
  console.log(`${ok ? '✓' : '✗'} ${ok ? success : failure}`);
  if (ok) passed++; else failed++;
}
const run = (cmd, args, cwd=root) => spawnSync(cmd, args, { cwd, encoding: 'utf8', timeout: 15000 });

check(run('git', ['--version']).status === 0,
  'Git 명령을 실행할 수 있음', 'Git이 없습니다. Git을 설치한 뒤 make doctor를 다시 실행하세요.');
const running = run('docker', ['compose', 'ps', '--status', 'running', '--services']);
const services = new Set((running.stdout || '').trim().split(/\s+/));
for (const name of ['verdaccio-public', 'verdaccio-internal', 'collector']) {
  check(running.status === 0 && services.has(name),
    `${name} 실행 중`, `${name}이 실행 중이지 않습니다. make up을 실행하세요.`);
}
check(fs.existsSync(path.join(root, 'parts-api', 'node_modules')),
  'parts-api 의존성 설치됨', 'parts-api/node_modules가 없습니다. make up 뒤 parts-api에서 npm ci를 실행하세요.');

const pkg = path.join(root, 'parts-api', 'package.json');
let deps = {};
try { deps = JSON.parse(fs.readFileSync(pkg, 'utf8')).dependencies || {}; } catch {}
const name = ['2-2', '2-3'].includes(lesson) ? '@parts/price-rules' : 'price-rules';
check(Object.hasOwn(deps, name),
  `${name} 이름으로 설치를 준비함`, `${name} 의존성이 없습니다. 현재 파일은 다른 수업 지점일 수 있습니다.`);

const npm = run('npm', ['ls', name, '--json', '--all'], path.join(root, 'parts-api'));
let version = '';
try { version = JSON.parse(npm.stdout).dependencies?.[name]?.version || ''; } catch {}
if (lesson === '1-1') {
  check(npm.status === 0 && version === '1.2.0',
    'price-rules 1.2.0 설치 확인', 'price-rules 1.2.0이 설치되지 않았습니다. parts-api에서 npm ci를 다시 실행하세요.');
} else if (lesson === '2-1') {
  const view = run('npm', ['view', 'price-rules', 'versions', '--json', '--registry', 'http://127.0.0.1:4873/', '--prefer-online', '--fetch-retries=0']);
  let versions = [];
  try { versions = JSON.parse(view.stdout); } catch {}
  check(view.status === 0 && ['1.2.0', '1.99.0', '99.0.0'].every(v => versions.includes(v)),
    '사내 주소에서 내부·공개 역할 버전 세 개가 함께 보임', '사내 주소에 공개 역할 버전이 함께 보이지 않습니다. make attack A=confusion 결과와 프록시 설정을 확인하세요.');
  check(npm.status === 0 && version === '1.99.0',
    '범위 안의 공개 역할 버전 1.99.0 설치 확인', 'price-rules 1.99.0이 설치되지 않았습니다. 잠금 파일을 새로 만든 설치 결과를 확인하세요.');
  const marker = path.join(root, '.lab', 'markers', 'price-rules-1.99.0.txt');
  check(fs.existsSync(marker),
    '설치 스크립트 표식 확인', '설치 스크립트 표식이 없습니다. source .lab/env 뒤 다시 설치하세요.');
  let lock = {};
  try { lock = JSON.parse(fs.readFileSync(path.join(root, 'parts-api', 'package-lock.json'), 'utf8')); } catch {}
  const locked = lock.packages?.['node_modules/price-rules'];
  check(locked?.version === '1.99.0' && Boolean(locked.resolved) && Boolean(locked.integrity),
    '잠금 파일에 버전·받은 주소·지문 기록', '잠금 파일에 1.99.0의 버전·받은 주소·지문이 없습니다.');
} else {
  const npmrc = fs.readFileSync(path.join(root, 'parts-api', '.npmrc'), 'utf8');
  check(npmrc.includes('@parts:registry=http://127.0.0.1:4873/'),
    '.npmrc에 사내 스코프 주소 기록', '.npmrc에 @parts 스코프 레지스트리 주소가 없습니다.');
  check(npmrc.includes(':_authToken=${NPM_LAB_TOKEN}'),
    '토큰 값 대신 환경 변수 이름 사용', '.npmrc 토큰 줄에는 실제 값 대신 ${NPM_LAB_TOKEN}을 쓰세요.');
  const config = fs.readFileSync(path.join(root, 'registries', 'verdaccio-internal', 'config.yaml'), 'utf8');
  const scoped = /'@parts\/\*':([\s\S]*?)(?=\n  '[^']+':|\nlog:|$)/.exec(config)?.[1] || '';
  check(Boolean(scoped) && !/^\s+proxy:/m.test(scoped),
    '사내 스코프의 공개 프록시가 꺼짐', "registries/verdaccio-internal/config.yaml의 '@parts/*'에서 proxy 줄을 지우세요.");
  const publicView = run('npm', ['view', '@parts/price-rules', 'versions', '--json', '--registry', 'http://127.0.0.1:4874/', '--fetch-retries=0']);
  const internalView = run('npm', ['view', '@parts/price-rules', 'versions', '--json', '--registry', 'http://127.0.0.1:4873/', '--userconfig', path.join(root, '.lab', 'seed.npmrc'), '--prefer-online', '--fetch-retries=0']);
  let publicVersions = [], internalVersions = [];
  try { publicVersions = JSON.parse(publicView.stdout); } catch {}
  try { internalVersions = JSON.parse(internalView.stdout); } catch {}
  check(publicView.status === 0 && publicVersions.includes('1.99.0'),
    '공개 역할 저장소에 같은 스코프의 공격 버전 있음', '공개 역할 저장소에 스코프 공격 버전이 없습니다. make attack A=confusion-scoped를 실행하세요.');
  check(internalView.status === 0 && internalVersions.length === 1 && internalVersions[0] === '1.2.0',
    '사내 주소에는 사내 버전 1.2.0만 보임', '사내 주소에 공개 버전이 남아 있습니다. 스코프 프록시와 캐시를 확인하세요.');
  check(npm.status === 0 && version === '1.2.0',
    '@parts/price-rules 1.2.0 설치 확인', '@parts/price-rules 1.2.0이 설치되지 않았습니다. 잠금 파일을 새로 만들고 다시 설치하세요.');
  const marker = path.join(root, '.lab', 'markers', 'scoped-price-rules-1.99.0.txt');
  check(!fs.existsSync(marker),
    '스코프 공격 설치 표식 없음', '스코프 공격 설치 표식이 있습니다. 이미 공격 버전이 설치됐는지 확인하세요.');
  let lock = {};
  try { lock = JSON.parse(fs.readFileSync(path.join(root, 'parts-api', 'package-lock.json'), 'utf8')); } catch {}
  const locked = lock.packages?.['node_modules/@parts/price-rules'];
  check(locked?.version === '1.2.0' && Boolean(locked.resolved) && Boolean(locked.integrity),
    '잠금 파일에 사내 스코프 버전·주소·지문 기록', '잠금 파일에 사내 스코프 1.2.0의 버전·주소·지문이 없습니다.');
  if (lesson === '2-3') {
    const evidence = path.join(root, '.lab', 'lesson-2-3');
    const typo = path.join(evidence, 'typo-installed.txt');
    check(fs.existsSync(typo) && fs.readFileSync(typo, 'utf8').includes('string-paddr@2.4.0'),
      '오타 패키지가 실제로 설치됐던 기록', '오타 패키지 설치 기록이 없습니다. 공개 역할 저장소에 올린 뒤 npm install string-paddr를 실행하세요.');
    check(!Object.hasOwn(deps, 'string-paddr') && !lock.packages?.['node_modules/string-paddr'],
      '오타 의존성이 소스·잠금 파일에서 제거됨', '오타 의존성이 남아 있습니다. npm uninstall string-paddr 뒤 잠금 파일을 확인하세요.');
    const ci = path.join(evidence, 'ci-swapped.txt');
    check(fs.existsSync(ci) && fs.readFileSync(ci, 'utf8').includes('EINTEGRITY'),
      '바꿔 친 tarball을 새 캐시 npm ci가 거부한 기록', '새 캐시 npm ci의 EINTEGRITY 기록이 없습니다. tarball 바꿔치기 재연을 확인하세요.');
    const install = path.join(evidence, 'install-swapped.txt');
    check(fs.existsSync(install) && fs.readFileSync(install, 'utf8').includes('EINTEGRITY'),
      '새 캐시 npm install도 무결성 오류로 멈춘 기록', '바꿔 친 tarball에서 npm install의 EINTEGRITY 기록이 없습니다.');
    const restored = run('docker', ['compose', 'exec', '-T', 'verdaccio-internal', 'test', '!', '-f', '/verdaccio/storage/string-padder/string-padder-2.4.0.tgz.original']);
    check(restored.status === 0,
      '로컬 tarball 원본 복구됨', '로컬 tarball 백업이 남아 있습니다. make attack-undo A=swap을 실행하세요.');
  }
}

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
fs.mkdirSync(path.dirname(progress), { recursive: true });
fs.writeFileSync(progress, JSON.stringify({ lesson, at: 'done' }) + '\n');
