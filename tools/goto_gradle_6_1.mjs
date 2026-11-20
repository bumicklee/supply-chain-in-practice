import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const gradle = path.join(root, 'gradle-lib');
const lab = path.join(root, '.lab');
const at = process.argv[2] || 'start';
const force = process.argv[3] === '1';
const files = ['gradle-lib/settings.gradle.kts', 'gradle-lib/build.gradle.kts'];
const stateFile = path.join(lab, 'goto-gradle-files.json');
const settingsBefore = fs.readFileSync(path.join(root, 'solutions/6-1-before.settings.gradle.kts'), 'utf8');
const tracked = Object.fromEntries(files.map(file => [file,
  execFileSync('git', ['show', `HEAD:${file}`], { cwd: root, encoding: 'utf8' })]));
const hash = value => createHash('sha256').update(value).digest('hex');
function run(command, args, cwd = root, env = process.env) {
  console.log(`$ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit', timeout: 900_000 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} 종료 코드 ${result.status ?? '없음'}`);
}
function capture(label, env) {
  const evidence = path.join(lab, 'lesson-6-1');
  fs.mkdirSync(evidence, { recursive: true });
  const args = ['--no-daemon', '--refresh-dependencies', '--info', 'dependencyInsight', '--dependency', 'pricing', '--configuration', 'runtimeClasspath'];
  console.log(`$ ./gradlew ${args.join(' ')}`);
  const result = spawnSync('./gradlew', args, { cwd: gradle, env, encoding: 'utf8', timeout: 600_000 });
  if (result.error) throw result.error;
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  fs.writeFileSync(path.join(evidence, `${label}.txt`), `# ./gradlew ${args.join(' ')}\n# 종료 코드: ${result.status ?? '없음'}\n${output}`);
  if (result.status !== 0) throw new Error(`${label} Gradle 검사 실패: ${output.slice(-400)}`);
  for (const line of output.split('\n').filter(item => item.includes('com.parts.internal:pricing:') || item.includes('pricing-1.2.0.pom') || item.includes('pricing-1.99.0.pom') || item.includes('pricing-1.3.0.pom'))) {
    console.log(line);
  }
  return output;
}
function setVersion(version) {
  const file = path.join(gradle, 'build.gradle.kts');
  const current = fs.readFileSync(file, 'utf8');
  const next = current.replace(/com\.parts\.internal:pricing:[^"\n]+/, `com.parts.internal:pricing:${version}`);
  if (next === current && !current.includes(`com.parts.internal:pricing:${version}`)) throw new Error('pricing 의존성 줄을 찾지 못했습니다.');
  fs.writeFileSync(file, next);
}

if (!['start', 'done'].includes(at)) throw new Error('사용법: make goto L=6-1 [AT=done] [FORCE=1]');
fs.mkdirSync(lab, { recursive: true });
let previous = {};
try { previous = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch {}
const changed = files.filter(file => {
  const actual = fs.readFileSync(path.join(root, file), 'utf8');
  return hash(actual) !== (previous.hashes?.[file] || hash(tracked[file]));
});
if (changed.length && !force) {
  throw new Error(`수정한 Gradle 파일이 있습니다: ${changed.join(', ')}. 저장한 뒤 FORCE=1로 사본을 남기고 이동하세요.`);
}
if (changed.length) {
  const backup = path.join(lab, 'backup', `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID().slice(0, 8)}`);
  for (const file of changed) {
    const destination = path.join(backup, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(root, file), destination);
  }
  console.log(`변경 파일 사본: ${path.relative(root, backup)}`);
}

run('make', ['maven-down']);
for (const folder of ['maven-public', 'maven-internal', 'maven-staging', 'maven-backup', 'lesson-6-1']) {
  fs.rmSync(path.join(lab, folder), { recursive: true, force: true });
}
fs.writeFileSync(path.join(gradle, 'settings.gradle.kts'), settingsBefore);
fs.writeFileSync(path.join(gradle, 'build.gradle.kts'), tracked['gradle-lib/build.gradle.kts']);
run('make', ['maven-up']);
run('make', ['attack', 'A=maven-confusion']);

if (at === 'done') {
  const env = { ...process.env, GRADLE_USER_HOME: path.join(lab, 'gradle-home') };
  fs.rmSync(path.join(env.GRADLE_USER_HOME, 'caches', 'modules-2'), { recursive: true, force: true });
  const exactBefore = capture('exact-before', env);
  if (!exactBefore.includes('com.parts.internal:pricing:1.2.0')) throw new Error('칸막이 전 고정 버전 1.2.0을 선택하지 않았습니다.');
  if (!exactBefore.includes('http://127.0.0.1:8082/com/parts/internal/pricing/1.2.0/')) throw new Error('칸막이 전 공개 역할 저장소 8082 출처를 확인하지 못했습니다.');
  setVersion('1.+');
  const dynamicBefore = capture('dynamic-before', env);
  if (!dynamicBefore.includes('com.parts.internal:pricing:1.+ -> 1.99.0')) throw new Error('칸막이 전 동적 버전 1.99.0을 선택하지 않았습니다.');
  fs.writeFileSync(path.join(gradle, 'settings.gradle.kts'), tracked['gradle-lib/settings.gradle.kts']);
  const dynamicAfter = capture('dynamic-after', env);
  if (!dynamicAfter.includes('com.parts.internal:pricing:1.+ -> 1.3.0')) throw new Error('칸막이 뒤 사내 최고 버전 1.3.0을 선택하지 않았습니다.');
  setVersion('1.2.0');
  fs.rmSync(path.join(env.GRADLE_USER_HOME, 'caches', 'modules-2'), { recursive: true, force: true });
  const exactAfter = capture('exact-after', env);
  if (!exactAfter.includes('com.parts.internal:pricing:1.2.0')) throw new Error('칸막이 뒤 고정 버전 1.2.0을 선택하지 않았습니다.');
  if (!exactAfter.includes('http://127.0.0.1:8081/com/parts/internal/pricing/1.2.0/')) throw new Error('칸막이 뒤 사내 저장소 8081 출처를 확인하지 못했습니다.');
}

const hashes = Object.fromEntries(files.map(file => [file, hash(fs.readFileSync(path.join(root, file), 'utf8'))]));
fs.writeFileSync(stateFile, JSON.stringify({ lesson: '6-1', at, hashes }, null, 2) + '\n');
fs.writeFileSync(path.join(lab, 'checkpoint.json'), JSON.stringify({ lesson: '6-1', at }) + '\n');
console.log(`지점: 6-1 ${at === 'done' ? '끝' : '시작'}`);
