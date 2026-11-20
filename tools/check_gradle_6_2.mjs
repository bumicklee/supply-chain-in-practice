import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const read = relative => {
  try { return fs.readFileSync(path.join(root, relative), 'utf8'); } catch { return ''; }
};
let passed = 0;
let failed = 0;
function check(ok, good, bad) {
  console.log(`${ok ? '✓' : '✗'} ${ok ? good : bad}`);
  if (ok) passed++; else failed++;
}
check(spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0,
  'Git 사용 가능', 'Git을 설치하세요.');
let state = {};
try { state = JSON.parse(read('.lab/checkpoint.json')); } catch {}
check(state.lesson === '6-2', '6-2 실습 지점 선택됨', 'make goto L=6-2를 먼저 실행하세요.');
check(state.at === 'done', '6-2 끝 지점임', '현재는 시작 지점입니다. 끝 지점으로 이동하세요.');

const build = read('gradle-lib/build.gradle.kts');
const settings = read('gradle-lib/settings.gradle.kts');
const metadata = read('gradle-lib/gradle/verification-metadata.xml');
check(settings.includes('exclusiveContent') && settings.includes('includeGroup("com.parts.internal")'),
  '앞 수업의 사내 저장소 칸막이 유지', '6-1 끝의 exclusiveContent를 복구하세요.');
check(build.includes('com.parts.internal:pricing:1.3.0'),
  'pricing을 1.3.0으로 올림', 'build.gradle.kts에서 pricing을 1.3.0으로 올리세요.');
check(metadata.includes('<verify-metadata>true</verify-metadata>') &&
  metadata.includes('text-utils-2.0.0.jar') && metadata.includes('pricing-1.3.0.jar') &&
  /<sha256 value="[a-f0-9]{64}"/.test(metadata),
  'jar와 POM의 SHA-256 검증 파일 생성', 'build 작업으로 sha256 검증 파일을 다시 생성하세요.');

const before = read('.lab/lesson-6-2/build-before.txt');
const failedLog = read('.lab/lesson-6-2/swap-failed.txt');
const restored = read('.lab/lesson-6-2/restored.txt');
const bumped = read('.lab/lesson-6-2/bumped.txt');
check(before.includes('# 종료 코드: 0') && before.includes('BUILD SUCCESSFUL'),
  '원래 jar로 빌드 성공', '원래 jar 빌드 기록이 없습니다.');
check(failedLog.includes('# 종료 코드: 1') && failedLog.includes('Dependency verification failed') && failedLog.includes('text-utils-2.0.0.jar'),
  '같은 버전의 바꿔 친 jar에서 검증 실패', '바꿔 친 jar의 실패 기록을 다시 만드세요.');
check(read('.lab/lesson-6-2/dependency-verification-report.html').includes('text-utils'),
  '실패 원인을 보여 주는 Gradle HTML 보고서 보관', 'Gradle 검증 보고서가 없습니다.');
check(restored.includes('# 종료 코드: 0') && restored.includes('BUILD SUCCESSFUL'),
  '원래 jar 복구 뒤 빌드 성공', 'jar를 되돌리고 빌드를 다시 실행하세요.');
check(bumped.includes('# 종료 코드: 0') && bumped.includes('BUILD SUCCESSFUL') && read('.lab/lesson-6-2/metadata-after.xml').includes('pricing-1.3.0.jar'),
  '의존성 버전 변경 뒤 해시 기록과 빌드 성공', '올린 버전으로 검증 파일을 갱신하고 빌드하세요.');

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
