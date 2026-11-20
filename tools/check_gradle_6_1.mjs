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
check(state.lesson === '6-1', '6-1 실습 지점 선택됨', 'make goto L=6-1을 먼저 실행하세요.');
check(state.at === 'done', '6-1 끝 지점임', '현재는 시작 지점입니다. 끝 지점으로 이동하세요.');

const settings = read('gradle-lib/settings.gradle.kts');
const build = read('gradle-lib/build.gradle.kts');
check(settings.includes('exclusiveContent') && settings.includes('includeGroup("com.parts.internal")') &&
  settings.includes('http://127.0.0.1:8081/') && settings.includes('http://127.0.0.1:8082/'),
  '사내 그룹을 8081에만 묶는 exclusiveContent 설정', 'settings.gradle.kts에 사내 그룹 칸막이를 설정하세요.');
check(build.includes('com.parts.internal:pricing:1.2.0'),
  '데모 뒤 pricing 고정 버전 1.2.0으로 복구', 'build.gradle.kts의 pricing을 1.2.0으로 되돌리세요.');

const exactBefore = read('.lab/lesson-6-1/exact-before.txt');
const dynamicBefore = read('.lab/lesson-6-1/dynamic-before.txt');
const dynamicAfter = read('.lab/lesson-6-1/dynamic-after.txt');
const exactAfter = read('.lab/lesson-6-1/exact-after.txt');
check(exactBefore.includes('com.parts.internal:pricing:1.2.0') && exactBefore.includes('http://127.0.0.1:8082/com/parts/internal/pricing/1.2.0/'),
  '칸막이 전 고정 1.2.0을 공개 역할 저장소 8082에서 선택', '고정 버전 1.2.0의 8082 출처 기록을 다시 만드세요.');
check(dynamicBefore.includes('com.parts.internal:pricing:1.+ -> 1.99.0'),
  '칸막이 전 동적 버전이 공개 1.99.0 선택', '동적 버전 1.+의 변경 전 결과를 다시 확인하세요.');
check(dynamicAfter.includes('com.parts.internal:pricing:1.+ -> 1.3.0'),
  '칸막이 뒤 동적 버전이 사내 1.3.0 선택', 'exclusiveContent 뒤 동적 버전 결과를 다시 확인하세요.');
check(exactAfter.includes('com.parts.internal:pricing:1.2.0') && exactAfter.includes('http://127.0.0.1:8081/com/parts/internal/pricing/1.2.0/'),
  '칸막이 뒤 고정 1.2.0을 사내 저장소 8081에서 선택', '고정 버전 1.2.0의 8081 출처 기록을 다시 만드세요.');

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
