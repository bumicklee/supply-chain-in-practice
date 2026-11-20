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
const git = spawnSync('git', ['--version'], { cwd: root, encoding: 'utf8' });
check(git.status === 0, 'Git 사용 가능', 'Git을 설치해야 합니다.');
let checkpoint = {};
try { checkpoint = JSON.parse(read('.lab/checkpoint.json')); } catch {}
check(checkpoint.lesson === '5-2', '5-2 실습 지점 선택됨', 'make goto L=5-2를 먼저 실행하세요.');
check(checkpoint.at === 'done', '5-2 끝 지점임', '현재는 시작 지점입니다. 끝 지점으로 이동하세요.');

const gate = read('.github/workflows/pr-dependency-review.yml');
const comment = read('.github/workflows/pr-dependency-comment.yml');
const pin = 'actions/dependency-review-action@bbc44d14a204704ccc493733616cd1e93a0321ec';
check(gate.includes('pull_request:') && gate.includes(pin) && gate.includes('fail-on-severity: high') && gate.includes('license-check: false'),
  'PR 검사 워크플로의 이벤트·커밋 해시·실패 기준 확인', 'PR 검사 워크플로의 이벤트·커밋 해시·실패 기준을 확인하세요.');
check(comment.includes('pull_request_target:') && comment.includes(pin) && comment.includes('warn-only: true') && comment.includes('comment-summary-in-pr: always') && !comment.includes('actions/checkout@'),
  '댓글 워크플로는 별도 권한으로 실행하며 PR 코드를 체크아웃하지 않음', '댓글 워크플로의 권한과 코드 체크아웃 여부를 확인하세요.');

let pkg = {}, lock = {};
try { pkg = JSON.parse(read('parts-api/package.json')); } catch {}
try { lock = JSON.parse(read('parts-api/package-lock.json')); } catch {}
check(pkg.dependencies?.minimist === '^1.2.8' && lock.packages?.['node_modules/minimist']?.version === '1.2.8',
  '수정 버전 minimist 1.2.8이 매니페스트와 잠금 파일에 기록됨', 'minimist를 1.2.8로 올리고 잠금 파일을 갱신하세요.');

const vulnerable = read('.lab/lesson-5-2/vulnerable.txt');
const fixed = read('.lab/lesson-5-2/fixed.txt');
check(vulnerable.includes('# make 종료 코드: 2') && vulnerable.includes('+ minimist@0.0.8') &&
  vulnerable.includes('GHSA-xvch-5gv4-984h Critical') && vulnerable.includes('PR 관문: 실패'),
  'Git의 취약 버전 변경은 로컬 관문에서 실제 실패', 'make goto L=5-2 AT=done에서 Git 비교 실패 기록을 다시 만드세요.');
check(fixed.includes('# make 종료 코드: 0') && fixed.includes('PR 관문: 통과'),
  'Git의 수정 버전은 로컬 관문에서 실제 통과', 'make goto L=5-2 AT=done에서 Git 비교 통과 기록을 다시 만드세요.');

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
