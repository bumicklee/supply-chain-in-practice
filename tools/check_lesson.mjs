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
if (lesson === '5-1') {
  const result = spawnSync('node', ['tools/check_dt_5_1.mjs'], { cwd: root, stdio: 'inherit', timeout: 180_000 });
  if (result.error) console.error(result.error.message);
  process.exit(result.status ?? 1);
}
if (lesson === '5-2') {
  const result = spawnSync('node', ['tools/check_pr_5_2.mjs'], { cwd: root, stdio: 'inherit', timeout: 180_000 });
  if (result.error) console.error(result.error.message);
  process.exit(result.status ?? 1);
}
if (!['1-1', '2-1', '2-2', '2-3', '2-4', '3-1', '3-2', '4-1', '4-2'].includes(lesson)) {
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
const name = ['2-2', '2-3', '2-4', '3-1', '3-2', '4-1', '4-2'].includes(lesson) ? '@parts/price-rules' : 'price-rules';
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
  if (lesson === '2-4') {
    const api = path.join(root, 'parts-api');
    const evidence = path.join(root, '.lab', 'lesson-2-4');
    check(Object.hasOwn(deps, '@parts/fast-hash') && fs.existsSync(path.join(api, 'node_modules', '@parts', 'fast-hash', 'build', 'binding.js')),
      '필요한 사내 패키지의 빌드 결과가 있음', '@parts/fast-hash 빌드 파일이 없습니다. 해당 패키지만 npm rebuild 하세요.');
    check(npmrc.includes('ignore-scripts=true'),
      '프로젝트 설치 스크립트가 기본 차단됨', 'parts-api/.npmrc에 ignore-scripts=true를 추가하세요.');
    const leak = path.join(evidence, 'collector-leak.jsonl');
    check(fs.existsSync(leak) && fs.readFileSync(leak, 'utf8').includes('LAB_FAKE_TOKEN_DO_NOT_USE'),
      '차단 전 가짜 토큰 수집 기록 보관', '스크립트가 켜진 설치에서 가짜 토큰이 수집기에 온 기록이 없습니다.');
    const collector = path.join(root, '.lab', 'collector.log');
    check(!fs.existsSync(collector) || fs.statSync(collector).size === 0,
      '차단 뒤 로컬 수집기에 새 기록 없음', '수집기 기록이 남아 있습니다. make collector-clear 뒤 차단된 설치를 다시 확인하세요.');
    const broken = path.join(evidence, 'missing-build.txt');
    check(fs.existsSync(broken) && fs.readFileSync(broken, 'utf8').includes('Cannot find module'),
      '스크립트 차단으로 필요한 빌드가 빠진 실패 기록', '스크립트 차단 뒤 필요한 빌드가 빠진 시험 결과가 없습니다.');
    const padder = lock.packages?.['node_modules/string-padder'];
    check(padder?.version === '2.4.0',
      '정상 string-padder 2.4.0으로 복귀', '잠금 파일에 정상 string-padder 2.4.0이 없습니다.');
    const tested = run('npm', ['test'], api);
    check(tested.status === 0 && /pass 5/.test(tested.stdout),
      '예외 패키지 재빌드 뒤 API 시험 5건 통과', 'API 시험이 통과하지 않습니다. @parts/fast-hash만 다시 빌드하세요.');
  }
  if (['3-1', '3-2', '4-1', '4-2'].includes(lesson)) {
    const api = path.join(root, 'parts-api');
    check(Object.hasOwn(deps, '@parts/fast-hash') && fs.existsSync(path.join(api, 'node_modules', '@parts', 'fast-hash', 'build', 'binding.js')),
      '앞 수업에서 필요한 사내 빌드 결과 유지', '@parts/fast-hash 빌드 파일이 없습니다. npm rebuild @parts/fast-hash --ignore-scripts=false를 실행하세요.');
    check(npmrc.includes('ignore-scripts=true'),
      '설치 스크립트 기본 차단 유지', 'parts-api/.npmrc에 ignore-scripts=true가 없습니다.');
    const folder = path.join(api, 'sbom');
    let cdx = {}, spdx = {};
    try { cdx = JSON.parse(fs.readFileSync(path.join(folder, 'parts-api.cdx.json'), 'utf8')); } catch {}
    try { spdx = JSON.parse(fs.readFileSync(path.join(folder, 'parts-api.spdx.json'), 'utf8')); } catch {}
    check(cdx.bomFormat === 'CycloneDX' && Array.isArray(cdx.components) && cdx.components.length > 50,
      'CycloneDX 부품 목록 생성', 'CycloneDX 파일이 없거나 부품이 비었습니다. make sbom을 실행하세요.');
    check(typeof spdx.spdxVersion === 'string' && spdx.spdxVersion.startsWith('SPDX-') && Array.isArray(spdx.packages) && spdx.packages.length > 50,
      'SPDX 부품 목록 생성', 'SPDX 파일이 없거나 부품이 비었습니다. make sbom을 실행하세요.');
    check(Boolean(cdx.metadata?.timestamp) && Boolean(spdx.creationInfo?.created),
      '두 서식에 생성 시각 기록', 'SBOM의 생성 시각이 비었습니다. make sbom으로 다시 생성하세요.');
    if (lesson === '3-2') {
      const report = path.join(root, '.lab', 'lesson-3-2', 'ntia.txt');
      const output = fs.existsSync(report) ? fs.readFileSync(report, 'utf8') : '';
      check(output.includes('공급자 이름') && output.includes('의존 관계') && output.includes('결과:'),
        '최소 요소 일곱 칸 점검 결과 보관', '최소 요소 점검표가 없습니다. make ntia-check SBOM=parts-api/sbom/parts-api.cdx.json을 실행하세요.');
    }
    if (lesson === '4-1') {
      const pre = path.join(root, '.lab', 'lesson-4-1');
      const severity = fs.existsSync(path.join(pre, 'severity-before.txt')) ? fs.readFileSync(path.join(pre, 'severity-before.txt'), 'utf8') : '';
      const epss = fs.existsSync(path.join(pre, 'epss-before.txt')) ? fs.readFileSync(path.join(pre, 'epss-before.txt'), 'utf8') : '';
      const after = fs.existsSync(path.join(pre, 'severity-after.txt')) ? fs.readFileSync(path.join(pre, 'severity-after.txt'), 'utf8') : '';
      const first = output => output.split('\n').find(line => /^\S+\s+\d+\.\d+\.\d+\s/.test(line)) || '';
      check(first(severity).startsWith('minimist ') && first(epss).startsWith('lodash '),
        '심각도 순과 EPSS 순의 맨 위가 실제로 다름', '두 정렬 결과가 없습니다. make goto L=4-1에서 검사 출력을 만들고 비교하세요.');
      const kev = path.join(pre, 'kev.txt');
      check(fs.existsSync(kev) && fs.readFileSync(kev, 'utf8').includes('KEV 일치: 0건'),
        '고정 CISA 목록과 CVE 별칭을 대조해 KEV 일치 0건 기록', 'KEV 대조 결과가 없습니다. make kev-check로 고정 목록을 확인하세요.');
      const min = lock.packages?.['node_modules/minimist'];
      check(min?.version === '0.2.4' && !after.includes('minimist        0.0.8'),
        'minimist 0.2.4로 고치고 SBOM 재검사', 'minimist 0.2.4 설치 뒤 make sbom과 Grype 재검사를 실행하세요.');
      const triage = run('make', ['triage-check']);
      check(triage.status === 0 && triage.stdout.includes('2 passed, 0 failed'),
        '고침·미룸 기록과 기한 점검 통과', 'policy/triage.yaml에 고침과 미룸의 사유·담당·기한을 적고 make triage-check를 실행하세요.');
      const saved = path.join(pre, 'triage.txt');
      check(fs.existsSync(saved) && fs.readFileSync(saved, 'utf8').includes('2 passed, 0 failed'),
        '4-1 끝 상태의 판단 점검 출력 보관', '판단 점검 출력이 없습니다. make goto L=4-1 AT=done을 실행하세요.');
    }
    if (lesson === '4-2') {
      const folder = path.join(root, '.lab', 'lesson-4-2');
      const read = name => {
        const file = path.join(folder, name);
        return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      };
      check(lock.packages?.['node_modules/minimist']?.version === '0.2.4',
        '앞 수업에서 고친 minimist 0.2.4 유지', 'minimist가 0.2.4가 아닙니다. 4-1 끝 지점부터 확인하세요.');
      check(run('make', ['triage-check']).status === 0,
        '앞 수업의 고침·미룸 판단 유지', 'policy/triage.yaml의 4-1 판단 기록을 확인하세요.');
      let doc = {};
      try { doc = JSON.parse(fs.readFileSync(path.join(root, 'vex', 'parts-api.openvex.json'), 'utf8')); } catch {}
      const statement = doc.statements?.[0] || {};
      check(statement.status === 'not_affected' && statement.justification === 'vulnerable_code_not_in_execute_path' && Boolean(statement.impact_statement),
        '영향 없음 VEX에 근거·설명 기록', 'VEX 문서가 조사 중이거나 영향 없음의 근거·설명이 없습니다.');
      check(statement.vulnerability?.name === 'GHSA-35jh-r3h4-6jhm' && statement.products?.[0]?.['@id'] === 'pkg:generic/parts-api@1.0.0' && statement.products?.[0]?.subcomponents?.[0]?.['@id'] === 'pkg:npm/lodash@4.17.20',
        'Syft 원본 SBOM의 제품·lodash 부품과 VEX 대상 일치', 'VEX의 제품·하위 부품 purl이 Syft 원본 SBOM과 다릅니다.');
      check(run('make', ['vex-lint']).status === 0,
        '현재 코드에서 VEX 근거 점검 통과', 'make vex-lint가 실패합니다. template 호출이나 근거 칸을 확인하세요.');
      check(read('scan-before.txt').includes('GHSA-35jh-r3h4-6jhm') && read('investigating.txt').includes('GHSA-35jh-r3h4-6jhm'),
        '조사 중에는 lodash 경보 유지', '조사 중 검사 결과가 없습니다. Syft 원본 SBOM으로 다시 검사하세요.');
      check(Boolean(read('suppressed.txt')) && !read('suppressed.txt').includes('GHSA-35jh-r3h4-6jhm'),
        '영향 없음 VEX에서 대상 경보만 숨김', 'VEX를 넣은 검사에서 대상 경보가 남았습니다. Syft 원본 SBOM을 사용하세요.');
      check(read('show-suppressed.txt').includes('GHSA-35jh-r3h4-6jhm') && read('show-suppressed.txt').includes('(suppressed by VEX)'),
        '숨긴 대상 경보를 표시와 함께 다시 확인', '--show-suppressed 검사 결과가 없습니다.');
      check(Boolean(read('replay-suppressed.txt')) && !read('replay-suppressed.txt').includes('GHSA-35jh-r3h4-6jhm'),
        '취약 함수 호출 뒤에도 낡은 VEX는 경보를 숨김', '코드 변경 뒤 VEX 억제 재검사 결과가 없습니다.');
      check(read('replay-lint.txt').includes('template 호출 있음') && read('replay-lint.txt').includes('종료 코드: 2') && read('lint-restored.txt').includes('1 passed, 0 failed'),
        '코드 호출 재연에서 VEX 경고 후 패치 복구', '재연 패치 적용·VEX 경고·되돌림 결과를 확인하세요.');
    }
  }
}

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
fs.mkdirSync(path.dirname(progress), { recursive: true });
fs.writeFileSync(progress, JSON.stringify({ lesson, at: 'done' }) + '\n');
