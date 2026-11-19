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
if (!['1-1', '2-1', '2-2'].includes(lesson) || !['start', 'done'].includes(at)) {
  console.error('사용법: make goto L=1-1|2-1|2-2 [AT=done] [FORCE=1]');
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

try {
  const template = path.join(root, 'solutions', 'checkpoints', '1-1');
  const previous = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : null;
  const changed = files.filter(rel => {
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
  run('docker', ['compose', 'down', '-v', '--remove-orphans']);
  for (const rel of ['.lab/seeded', '.lab/seed.npmrc', '.lab/env', '.lab/markers', '.lab/collector.log', '.lab/npm-cache-2-1']) remove(rel);
  remove('parts-api/node_modules');
  for (const rel of files) {
    const destination = path.join(root, rel);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(template, rel), destination);
  }
  if (lesson === '2-2' && at === 'done') {
    for (const rel of files.filter(item => item !== 'parts-api/package-lock.json')) {
      fs.copyFileSync(path.join(root, 'solutions', 'checkpoints', '2-2', rel), path.join(root, rel));
    }
  }

  if (at === 'done' || lesson !== '1-1') {
    run('make', ['up']);
    const env = labEnv();
    const api = path.join(root, 'parts-api');
    if (lesson === '2-2' && at === 'done') {
      run('make', ['attack', 'A=confusion']);
      run('make', ['attack', 'A=confusion-scoped']);
      remove('parts-api/package-lock.json');
      run('npm', ['install', '--no-audit', '--no-fund', '--cache', path.join(lab, 'npm-cache-2-1')], api, env);
    } else if (lesson === '2-1' && at === 'done' || lesson === '2-2' && at === 'start') {
      run('make', ['attack', 'A=confusion']);
      remove('parts-api/package-lock.json');
      run('npm', ['install', '--no-audit', '--no-fund', '--cache', path.join(lab, 'npm-cache-2-1')], api, env);
    } else {
      run('npm', ['ci', '--no-audit', '--no-fund'], api, env);
    }
  }

  const hashes = Object.fromEntries(files.map(rel => [rel, hash(path.join(root, rel))]));
  fs.writeFileSync(stateFile, JSON.stringify({ lesson, at, hashes }, null, 2) + '\n');
  fs.writeFileSync(path.join(lab, 'checkpoint.json'), JSON.stringify({ lesson, at }) + '\n');
  console.log(`지점: ${lesson} ${at === 'done' ? '끝' : '시작'}`);
} catch (error) {
  console.error(`지점 이동 실패: ${error.message}`);
  process.exit(1);
}
