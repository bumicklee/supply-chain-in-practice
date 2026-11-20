#!/usr/bin/env node
// 지금 구현된 수업의 시작/끝 상태를 Git 이력과 무관하게 다시 만든다.
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const lesson = process.argv[2] || '';
const at = process.argv[3] || 'start';
const force = process.argv[4] === '1';
const lab = path.join(root, '.lab');
const stateFile = path.join(lab, 'goto-files.json');
const files = [
  'parts-api/package.json',
  'parts-api/package-lock.json',
  'parts-api/.npmrc',
  'parts-api/src/app.js',
  'registries/verdaccio-internal/config.yaml',
];
const generated = [
  'parts-api/sbom/parts-api.cdx.json',
  'parts-api/sbom/parts-api.spdx.json',
  'parts-api/sbom/parts-api.syft.json',
];
const policy = 'policy/triage.yaml';
const vex = 'vex/parts-api.openvex.json';
if (!['1-1', '2-1', '2-2', '2-3', '2-4', '3-1', '3-2', '4-1', '4-2', '5-1', '5-2'].includes(lesson) || !['start', 'done'].includes(at)) {
  console.error('사용법: make goto L=1-1|2-1|2-2|2-3|2-4|3-1|3-2|4-1|4-2|5-1|5-2 [AT=done] [FORCE=1]');
  console.error('다른 수업의 지점은 아직 구현되지 않았습니다.');
  process.exit(2);
}

function run(command, args, cwd = root, env = process.env) {
  console.log(`$ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit', timeout: 900_000 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} 종료 코드 ${result.status ?? '없음'}`);
}
function hash(file) {
  return fs.existsSync(file) ? createHash('sha256').update(fs.readFileSync(file)).digest('hex') : null;
}
function remove(relative) {
  fs.rmSync(path.join(root, relative), { recursive: true, force: true });
}
function labEnv() {
  const env = { ...process.env };
  for (const line of fs.readFileSync(path.join(lab, 'env'), 'utf8').split('\n')) {
    const match = /^export ([A-Z_]+)=(.*)$/.exec(line);
    if (match) env[match[1]] = match[2];
  }
  return env;
}
function probeNpm(args, cwd, env, output) {
  console.log(`$ npm ${args.join(' ')}`);
  const result = spawnSync('npm', args, { cwd, env, encoding: 'utf8', timeout: 300_000 });
  if (result.error) throw result.error;
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `# 명령: npm ${args.join(' ')}\n# 종료 코드: ${result.status ?? '없음'}\n${result.stdout || ''}${result.stderr || ''}`);
  return { status: result.status, text: `${result.stdout || ''}${result.stderr || ''}` };
}
function recordMake(args, output) {
  console.log(`$ make ${args.join(' ')}`);
  const result = spawnSync('make', args, { cwd: root, encoding: 'utf8', timeout: 900_000 });
  if (result.error) throw result.error;
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `# 명령: make ${args.join(' ')}\n# 종료 코드: ${result.status ?? '없음'}\n${result.stdout || ''}${result.stderr || ''}`);
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  if (result.status !== 0) throw new Error(`make ${args[0]} 종료 코드 ${result.status ?? '없음'}`);
}
function recordCommand(command, args, output) {
  console.log(`$ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout: 900_000 });
  if (result.error) throw result.error;
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `# 명령: ${command} ${args.join(' ')}\n# 종료 코드: ${result.status ?? '없음'}\n${result.stdout || ''}${result.stderr || ''}`);
  if (result.status !== 0) throw new Error(`${command} 종료 코드 ${result.status ?? '없음'}`);
}
function recordJson(command, args, output) {
  console.log(`$ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout: 900_000 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} 종료 코드 ${result.status ?? '없음'}: ${result.stderr || ''}`);
  JSON.parse(result.stdout);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, result.stdout);
}

try {
  if (lesson === '5-1' && at === 'done' && !fs.existsSync(path.join(lab, 'dt-api-key'))) {
    throw new Error('먼저 make goto L=5-1, make down, make dt-up, make dt-bootstrap을 실행하세요.');
  }
  const template = path.join(root, 'solutions', 'checkpoints', '1-1');
  const previous = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : null;
  const changed = [...files, ...generated, policy, vex].filter(rel => {
    const expected = previous?.hashes?.[rel] ?? hash(path.join(template, rel));
    return hash(path.join(root, rel)) !== expected;
  });
  if (changed.length && !force) {
    console.error('고친 파일이 있어 지점 이동을 멈췄습니다:');
    for (const rel of changed) console.error(`  ${rel}`);
    console.error('변경 내용을 직접 저장하거나, FORCE=1로 .lab/backup에 사본을 만든 뒤 이동하세요.');
    process.exit(1);
  }

  fs.mkdirSync(lab, { recursive: true });
  if (changed.length) {
    const backup = path.join(lab, 'backup', `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID().slice(0, 8)}`);
    for (const rel of changed) {
      const original = path.join(root, rel);
      if (!fs.existsSync(original)) continue;
      const destination = path.join(backup, rel);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(original, destination);
    }
    console.log(`변경 파일 사본: ${path.relative(root, backup)}`);
  }

  run('node', ['tools/compose_id.mjs']);
  // Keep the Dependency-Track volume across lessons. Only the two registry
  // volumes represent disposable attack state.
  run('docker', ['compose', '--profile', 'dt', '--profile', 'maven', 'down', '--remove-orphans']);
  const composeName = /^COMPOSE_PROJECT_NAME=(.+)$/m.exec(fs.readFileSync(path.join(root, '.env'), 'utf8'))?.[1];
  if (!composeName) throw new Error('.env에 COMPOSE_PROJECT_NAME이 없습니다.');
  for (const name of [`${composeName}_public-data`, `${composeName}_internal-data`]) {
    const found = spawnSync('docker', ['volume', 'inspect', name], { cwd: root, stdio: 'ignore' });
    if (found.status === 0) run('docker', ['volume', 'rm', name]);
  }
  for (const rel of ['.lab/seeded', '.lab/seed.npmrc', '.lab/env', '.lab/markers', '.lab/collector.log', '.lab/npm-cache-2-1', '.lab/lesson-2-3', '.lab/lesson-2-4', '.lab/lesson-3-2', '.lab/lesson-4-1', '.lab/lesson-4-2', '.lab/lesson-5-1', '.lab/lesson-5-2', '.lab/sbom-1.0.0.cdx.json', '.lab/sbom-1.1.0.cdx.json']) remove(rel);
  remove('parts-api/node_modules');
  for (const rel of generated) remove(rel);
  remove(policy);
  remove(vex);
  for (const rel of files) {
    const destination = path.join(root, rel);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(template, rel), destination);
  }
  const scopedBase = ['2-3', '2-4', '3-1', '3-2', '4-1', '4-2', '5-1', '5-2'].includes(lesson) || lesson === '2-2' && at === 'done';
  if (scopedBase) {
    for (const rel of files.filter(item => item !== 'parts-api/package-lock.json')) {
      fs.copyFileSync(path.join(root, 'solutions', 'checkpoints', '2-2', rel), path.join(root, rel));
    }
  }
  if (['2-4', '3-1', '3-2', '4-1', '4-2', '5-1', '5-2'].includes(lesson)) {
    for (const rel of ['parts-api/package.json', 'parts-api/src/app.js']) {
      fs.copyFileSync(path.join(root, 'solutions', 'checkpoints', '2-4', 'start', rel), path.join(root, rel));
    }
  }
  if (['3-1', '3-2', '4-1', '4-2', '5-1', '5-2'].includes(lesson)) {
    fs.copyFileSync(path.join(root, 'solutions', 'checkpoints', '2-4', 'done', 'parts-api', '.npmrc'), path.join(root, 'parts-api', '.npmrc'));
  }
  if (lesson === '4-1') {
    const source = path.join(root, 'solutions', 'checkpoints', '4-1', at, policy);
    const destination = path.join(root, policy);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  }
  if (lesson === '4-2') {
    for (const [rel, source] of [
      [policy, path.join(root, 'solutions', 'checkpoints', '4-1', 'done', policy)],
      [vex, path.join(root, 'solutions', 'checkpoints', '4-2', 'start', vex)],
    ]) {
      const destination = path.join(root, rel);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(source, destination);
    }
  }
  if (lesson === '5-1' || lesson === '5-2') {
    for (const [rel, source] of [
      [policy, path.join(root, 'solutions', 'checkpoints', '4-1', 'done', policy)],
      [vex, path.join(root, 'solutions', 'checkpoints', '4-2', 'done', vex)],
    ]) {
      const destination = path.join(root, rel);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(source, destination);
    }
  }

  if (at === 'done' || lesson !== '1-1') {
    run('make', ['up']);
    const env = labEnv();
    const api = path.join(root, 'parts-api');
    if (scopedBase) {
      run('make', ['attack', 'A=confusion']);
      run('make', ['attack', 'A=confusion-scoped']);
      remove('parts-api/package-lock.json');
      run('npm', ['install', '--no-audit', '--no-fund', '--cache', path.join(lab, 'npm-cache-2-1')], api, env);
      if (lesson === '2-3' && at === 'done') {
        const evidence = path.join(lab, 'lesson-2-3');
        fs.mkdirSync(evidence, { recursive: true });
        run('make', ['attack', 'A=typo']);
        run('npm', ['install', 'string-paddr', '--no-audit', '--no-fund'], api, env);
        const installed = spawnSync('npm', ['ls', 'string-paddr'], { cwd: api, env, encoding: 'utf8' });
        fs.writeFileSync(path.join(evidence, 'typo-installed.txt'), installed.stdout || installed.stderr || '');
        if (installed.status !== 0) throw new Error('오타 패키지 설치 확인 실패');
        run('npm', ['uninstall', 'string-paddr', '--no-audit', '--no-fund'], api, env);
        const lock = path.join(api, 'package-lock.json');
        const originalLock = path.join(evidence, 'lock-before-swap.json');
        fs.copyFileSync(lock, originalLock);
        let swapped = false;
        try {
          run('make', ['attack', 'A=swap']);
          swapped = true;
          const ci = probeNpm(['ci', '--cache', path.join(evidence, 'fresh-ci-cache'), '--no-audit', '--no-fund', '--fetch-retries=0'], api, env, path.join(evidence, 'ci-swapped.txt'));
          if (ci.status === 0 || !ci.text.includes('EINTEGRITY')) throw new Error('바꿔 친 tarball이 EINTEGRITY로 거부되지 않았습니다.');
          const install = probeNpm(['install', '--cache', path.join(evidence, 'fresh-install-cache'), '--no-audit', '--no-fund', '--fetch-retries=0'], api, env, path.join(evidence, 'install-swapped.txt'));
          console.log(`변조 중 npm install 종료 코드: ${install.status}`);
        } finally {
          if (swapped) run('make', ['attack-undo', 'A=swap']);
        }
        fs.copyFileSync(originalLock, lock);
        run('npm', ['ci', '--no-audit', '--no-fund'], api, env);
      }
      if (lesson === '2-4' && at === 'done') {
        const evidence = path.join(lab, 'lesson-2-4');
        fs.mkdirSync(evidence, { recursive: true });
        run('make', ['collector-clear']);
        run('make', ['attack', 'A=hijack']);
        run('make', ['padder-cache-refresh']);
        run('npm', ['install', 'string-padder@2.4.1', '--no-audit', '--no-fund'], api, env);
        const collector = path.join(lab, 'collector.log');
        for (let n = 0; n < 30 && (!fs.existsSync(collector) || fs.statSync(collector).size === 0); n++) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (!fs.existsSync(collector) || !fs.readFileSync(collector, 'utf8').includes('LAB_FAKE_TOKEN_DO_NOT_USE')) {
          throw new Error('스크립트가 켜진 설치에서 가짜 토큰이 수집기에 도착하지 않았습니다.');
        }
        fs.copyFileSync(collector, path.join(evidence, 'collector-leak.jsonl'));
        fs.copyFileSync(path.join(root, 'solutions', 'checkpoints', '2-4', 'done', 'parts-api', '.npmrc'), path.join(api, '.npmrc'));
        run('make', ['collector-clear']);
        run('npm', ['ci', '--no-audit', '--no-fund'], api, env);
        const broken = probeNpm(['test'], api, env, path.join(evidence, 'missing-build.txt'));
        if (broken.status === 0 || !broken.text.includes('Cannot find module')) throw new Error('스크립트 차단 뒤 빠진 빌드 파일을 재현하지 못했습니다.');
        run('npm', ['rebuild', '@parts/fast-hash', '--ignore-scripts=false'], api, env);
        run('npm', ['test'], api, env);
        run('npm', ['install', 'string-padder@2.4.0', '--no-audit', '--no-fund'], api, env);
        run('npm', ['test'], api, env);
        if (fs.existsSync(collector) && fs.statSync(collector).size !== 0) throw new Error('스크립트 차단 후 수집기 기록이 새로 생겼습니다.');
        fs.writeFileSync(path.join(evidence, 'collector-after.txt'), '# ignore-scripts=true 뒤 수집기 기록 0바이트\n');
      }
      if (['3-1', '3-2', '4-1', '4-2', '5-1', '5-2'].includes(lesson)) {
        run('npm', ['rebuild', '@parts/fast-hash', '--ignore-scripts=false'], api, env);
        run('npm', ['test'], api, env);
        if (['4-2', '5-1'].includes(lesson)) run('npm', ['install', 'minimist@0.2.4', '--no-audit', '--no-fund', '--ignore-scripts'], api, env);
        if (lesson === '5-2') run('npm', ['install', `minimist@${at === 'done' ? '1.2.8' : '0.0.8'}`, '--no-audit', '--no-fund', '--ignore-scripts'], api, env);
        if (['3-2', '4-1', '4-2', '5-2'].includes(lesson) || at === 'done') {
          fs.mkdirSync(path.join(api, 'sbom'), { recursive: true });
          run('make', ['sbom']);
        }
        if (lesson === '3-2' && at === 'done') {
          recordMake(['ntia-check', 'SBOM=parts-api/sbom/parts-api.cdx.json'], path.join(lab, 'lesson-3-2', 'ntia.txt'));
        }
        if (lesson === '4-1') {
          run('make', ['grype-db']);
          const evidence = path.join(lab, 'lesson-4-1');
          const sbom = 'sbom:parts-api/sbom/parts-api.cdx.json';
          recordCommand('./bin/grype', [sbom, '--sort-by', 'severity'], path.join(evidence, 'severity-before.txt'));
          recordCommand('./bin/grype', [sbom, '--sort-by', 'epss'], path.join(evidence, 'epss-before.txt'));
          recordJson('./bin/grype', [sbom, '-o', 'json'], path.join(evidence, 'scan-before.json'));
          recordMake(['kev-check'], path.join(evidence, 'kev.txt'));
          if (at === 'done') {
            run('npm', ['install', 'minimist@0.2.4', '--no-audit', '--no-fund', '--ignore-scripts'], api, env);
            run('make', ['sbom']);
            recordCommand('./bin/grype', [sbom, '--sort-by', 'severity'], path.join(evidence, 'severity-after.txt'));
            recordJson('./bin/grype', [sbom, '-o', 'json'], path.join(evidence, 'scan-after.json'));
            recordMake(['triage-check'], path.join(lab, 'lesson-4-1', 'triage.txt'));
          }
        }
        if (lesson === '4-2') {
          run('make', ['grype-db']);
          const evidence = path.join(lab, 'lesson-4-2');
          const sbom = 'sbom:parts-api/sbom/parts-api.syft.json';
          const target = 'GHSA-35jh-r3h4-6jhm';
          recordCommand('./bin/grype', [sbom], path.join(evidence, 'scan-before.txt'));
          recordCommand('./bin/grype', [sbom, '--vex', vex], path.join(evidence, 'investigating.txt'));
          if (!fs.readFileSync(path.join(evidence, 'investigating.txt'), 'utf8').includes(target)) throw new Error('조사 중 VEX가 lodash 경보를 남기지 않았습니다.');
          if (at === 'done') {
            fs.copyFileSync(path.join(root, 'solutions', 'checkpoints', '4-2', 'done', vex), path.join(root, vex));
            recordMake(['vex-lint'], path.join(evidence, 'lint-ok.txt'));
            recordCommand('./bin/grype', [sbom, '--vex', vex], path.join(evidence, 'suppressed.txt'));
            recordCommand('./bin/grype', [sbom, '--vex', vex, '--show-suppressed'], path.join(evidence, 'show-suppressed.txt'));
            if (fs.readFileSync(path.join(evidence, 'suppressed.txt'), 'utf8').includes(target)) throw new Error('영향 없음 VEX에서 대상 경보가 숨겨지지 않았습니다.');
            if (!fs.readFileSync(path.join(evidence, 'show-suppressed.txt'), 'utf8').includes(`${target}`) || !fs.readFileSync(path.join(evidence, 'show-suppressed.txt'), 'utf8').includes('(suppressed by VEX)')) throw new Error('숨긴 경보를 다시 보여 주지 못했습니다.');
            const patch = 'solutions/replay/4-2-template-call.patch';
            run('git', ['apply', patch]);
            try {
              recordCommand('./bin/grype', [sbom, '--vex', vex], path.join(evidence, 'replay-suppressed.txt'));
              if (fs.readFileSync(path.join(evidence, 'replay-suppressed.txt'), 'utf8').includes(target)) throw new Error('코드에 template 호출을 추가했는데 Grype가 VEX 억제를 유지하지 않았습니다.');
              const lint = spawnSync('make', ['vex-lint'], { cwd: root, encoding: 'utf8', timeout: 30_000 });
              fs.writeFileSync(path.join(evidence, 'replay-lint.txt'), `# 명령: make vex-lint (재연 패치 적용 뒤)\n# 종료 코드: ${lint.status ?? '없음'}\n${lint.stdout || ''}${lint.stderr || ''}`);
              if (lint.status === 0 || !`${lint.stdout}${lint.stderr}`.includes('template 호출 있음')) throw new Error('코드 호출 뒤 낡은 VEX를 검출하지 못했습니다.');
            } finally {
              run('git', ['apply', '-R', patch]);
            }
            recordMake(['vex-lint'], path.join(evidence, 'lint-restored.txt'));
          }
        }
        if (lesson === '5-1') {
          run('make', ['seed-release']);
          run('make', ['release-fixtures']);
          if (at === 'done') {
            const evidence = path.join(lab, 'lesson-5-1');
            for (const version of ['1.0.0', '1.1.0']) {
              recordCommand('./bin/syft', ['scan', `dir:fixtures/releases/${version}`, '--source-name', 'parts-api', '--source-version', version, '-o', `cyclonedx-json=.lab/sbom-${version}.cdx.json`], path.join(evidence, `sbom-${version}.txt`));
            }
            run('make', ['down']);
            recordMake(['dt-up'], path.join(evidence, 'dt-up.txt'));
            recordMake(['dt-setup-5-1'], path.join(evidence, 'setup.txt'));
            for (const version of ['1.0.0', '1.1.0']) {
              recordMake(['dt-upload', `V=${version}`, `SBOM=.lab/sbom-${version}.cdx.json`], path.join(evidence, `upload-${version}.txt`));
            }
            run('make', ['collector-clear']);
            recordMake(['dt-new-vuln', 'REPLAY=1'], path.join(evidence, 'new-vulnerability.txt'));
          }
        }
        if (lesson === '5-2' && at === 'done') {
          const evidence = path.join(lab, 'lesson-5-2');
          fs.mkdirSync(evidence, { recursive: true });
          run('make', ['grype-db']);
          const base = 'b78b1ff2c150a96257a3c8fc5b4ea089c4800374';
          const cases = [
            ['vulnerable', '5d187cbd33facc68c3c26c65e222faeddda7a94c'],
            ['fixed', '4798897d7371de85064c0d01a1472a6dca6af439'],
          ];
          for (const [name, head] of cases) {
            const args = ['pr-gate-local', `BASE=${base}`, `HEAD=${head}`];
            const result = spawnSync('make', args, { cwd: root, encoding: 'utf8', timeout: 300_000 });
            if (result.error) throw result.error;
            const output = `${result.stdout || ''}${result.stderr || ''}`;
            fs.writeFileSync(path.join(evidence, `${name}.txt`), `# Git 기준: ${base} → ${head}\n# make 종료 코드: ${result.status ?? '없음'}\n${output}`);
            if (name === 'vulnerable' && (result.status !== 2 || !output.includes('GHSA-xvch-5gv4-984h Critical') || !output.includes('PR 관문: 실패'))) {
              throw new Error('취약한 minimist 버전의 Git PR 비교가 실패하지 않았습니다.');
            }
            if (name === 'fixed' && (result.status !== 0 || !output.includes('PR 관문: 통과'))) {
              throw new Error('수정한 minimist 버전의 Git PR 비교가 통과하지 않았습니다.');
            }
            process.stdout.write(output);
          }
        }
      }
    } else if (lesson === '2-1' && at === 'done' || lesson === '2-2' && at === 'start') {
      run('make', ['attack', 'A=confusion']);
      remove('parts-api/package-lock.json');
      run('npm', ['install', '--no-audit', '--no-fund', '--cache', path.join(lab, 'npm-cache-2-1')], api, env);
    } else {
      run('npm', ['ci', '--no-audit', '--no-fund'], api, env);
    }
  }

  const hashes = Object.fromEntries([...files, ...generated, policy, vex].map(rel => [rel, hash(path.join(root, rel))]));
  fs.writeFileSync(stateFile, JSON.stringify({ lesson, at, hashes }, null, 2) + '\n');
  fs.writeFileSync(path.join(lab, 'checkpoint.json'), JSON.stringify({ lesson, at }) + '\n');
  console.log(`지점: ${lesson} ${at === 'done' ? '끝' : '시작'}`);
} catch (error) {
  console.error(`지점 이동 실패: ${error.message}`);
  process.exit(1);
}
