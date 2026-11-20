import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const gradle = path.join(root, 'gradle-lib');
const lab = path.join(root, '.lab');
const at = process.argv[2] || 'start';
const force = process.argv[3] === '1';
const files = ['gradle-lib/settings.gradle.kts', 'gradle-lib/build.gradle.kts', 'gradle-lib/gradle/verification-metadata.xml'];
const stateFile = path.join(lab, 'goto-verification-files.json');
const tracked = Object.fromEntries(files.slice(0, 2).map(file => [file,
  execFileSync('git', ['show', `HEAD:${file}`], { cwd: root, encoding: 'utf8' })]));
const hash = value => value === null ? null : createHash('sha256').update(value).digest('hex');
const read = file => fs.existsSync(file) ? fs.readFileSync(file) : null;
function run(command, args, cwd = root, env = process.env) {
  console.log(`$ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit', timeout: 900_000 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} 종료 코드 ${result.status ?? '없음'}`);
}
function gradleRun(label, args, expected, env) {
  console.log(`$ ./gradlew ${args.join(' ')}`);
  const result = spawnSync('./gradlew', ['--no-daemon', ...args], { cwd: gradle, env, encoding: 'utf8', timeout: 600_000 });
  if (result.error) throw result.error;
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  const destination = path.join(lab, 'lesson-6-2', `${label}.txt`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, `# ./gradlew --no-daemon ${args.join(' ')}\n# 종료 코드: ${result.status ?? '없음'}\n${output}`);
  for (const line of output.split('\n').filter(item => item.includes('Dependency verification failed') || item.includes('One artifact failed') || item.includes('Open this report') || item.includes('BUILD SUCCESSFUL') || item.includes('BUILD FAILED'))) console.log(line);
  if (result.status !== expected) throw new Error(`${label} Gradle 종료 코드 ${result.status ?? '없음'} (예상 ${expected})`);
  return output;
}

if (!['start', 'done'].includes(at)) throw new Error('사용법: make goto L=6-2 [AT=done] [FORCE=1]');
fs.mkdirSync(lab, { recursive: true });
let previous = {};
try { previous = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch {}
const changed = files.filter(file => {
  const actual = hash(read(path.join(root, file)));
  const expected = previous.hashes?.[file] ?? hash(tracked[file] ?? null);
  return actual !== expected;
});
if (changed.length && !force) throw new Error(`수정한 Gradle 파일이 있습니다: ${changed.join(', ')}. 저장한 뒤 FORCE=1로 사본을 남기고 이동하세요.`);
if (changed.length) {
  const backup = path.join(lab, 'backup', `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID().slice(0, 8)}`);
  for (const file of changed) {
    const source = path.join(root, file);
    if (!fs.existsSync(source)) continue;
    const destination = path.join(backup, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  }
  console.log(`변경 파일 사본: ${path.relative(root, backup)}`);
}

fs.rmSync(path.join(lab, 'lesson-6-2'), { recursive: true, force: true });
fs.writeFileSync(path.join(root, files[0]), tracked[files[0]]);
fs.writeFileSync(path.join(root, files[1]), tracked[files[1]]);
fs.rmSync(path.join(root, files[2]), { force: true });
for (const file of ['verification-keyring.gpg', 'verification-keyring.keys']) fs.rmSync(path.join(gradle, 'gradle', file), { force: true });
run('make', ['maven-up']);
run('make', ['attack-undo', 'A=maven-swap']);

if (at === 'done') {
  const env = { ...process.env, GRADLE_USER_HOME: path.join(lab, 'gradle-home') };
  fs.rmSync(path.join(env.GRADLE_USER_HOME, 'caches', 'modules-2'), { recursive: true, force: true });
  const args = ['--refresh-dependencies', '--write-verification-metadata', 'sha256', 'clean', 'build'];
  const recorded = gradleRun('record-sha256', args, 0, env);
  if (!recorded.includes('BUILD SUCCESSFUL')) throw new Error('검증 파일을 쓰는 빌드가 성공하지 않았습니다.');
  const metadata = fs.readFileSync(path.join(root, files[2]), 'utf8');
  if (!metadata.includes('text-utils-2.0.0.jar') || !metadata.includes('pricing-1.2.0.jar')) throw new Error('검증 파일에 두 jar 해시가 없습니다.');
  gradleRun('build-before', ['--refresh-dependencies', 'clean', 'build'], 0, env);
  run('make', ['attack', 'A=maven-swap']);
  try {
    const failed = gradleRun('swap-failed', ['--refresh-dependencies', 'clean', 'build'], 1, env);
    if (!failed.includes('Dependency verification failed') || !failed.includes('text-utils-2.0.0.jar')) throw new Error('바꿔 친 jar의 체크섬 실패를 확인하지 못했습니다.');
    const report = /Open this report for more details: (file:\/\/[^\s]+)/.exec(failed)?.[1];
    if (!report) throw new Error('Gradle 검증 보고서 경로가 없습니다.');
    const reportPath = decodeURIComponent(new URL(report).pathname);
    if (!fs.existsSync(reportPath)) throw new Error('Gradle 검증 보고서 파일이 없습니다.');
    fs.copyFileSync(reportPath, path.join(lab, 'lesson-6-2', 'dependency-verification-report.html'));
  } finally {
    run('make', ['attack-undo', 'A=maven-swap']);
  }
  gradleRun('restored', ['--refresh-dependencies', 'clean', 'build'], 0, env);
  const buildFile = path.join(root, files[1]);
  fs.writeFileSync(buildFile, fs.readFileSync(buildFile, 'utf8').replace('com.parts.internal:pricing:1.2.0', 'com.parts.internal:pricing:1.3.0'));
  gradleRun('bumped', args, 0, env);
  const updated = fs.readFileSync(path.join(root, files[2]), 'utf8');
  if (!updated.includes('pricing-1.3.0.jar')) throw new Error('올린 버전의 jar 해시가 검증 파일에 없습니다.');
  fs.writeFileSync(path.join(lab, 'lesson-6-2', 'metadata-before.xml'), metadata);
  fs.writeFileSync(path.join(lab, 'lesson-6-2', 'metadata-after.xml'), updated);
}

const hashes = Object.fromEntries(files.map(file => [file, hash(read(path.join(root, file)))]));
fs.writeFileSync(stateFile, JSON.stringify({ lesson: '6-2', at, hashes }, null, 2) + '\n');
fs.writeFileSync(path.join(lab, 'checkpoint.json'), JSON.stringify({ lesson: '6-2', at }) + '\n');
console.log(`지점: 6-2 ${at === 'done' ? '끝' : '시작'}`);
