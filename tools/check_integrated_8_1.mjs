import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const read = rel => { try { return fs.readFileSync(path.join(root, rel), 'utf8'); } catch { return ''; } };
const exists = rel => fs.existsSync(path.join(root, rel));
let passed = 0;
let failed = 0;
function check(ok, good, bad) {
  console.log(`${ok ? '✓' : '✗'} ${ok ? good : bad}`);
  if (ok) passed++; else failed++;
}
let state = {}, elapsed = {}, report = [];
try { state = JSON.parse(read('.lab/checkpoint.json')); } catch {}
try { elapsed = JSON.parse(read('.lab/lesson-8-1/elapsed.json')); } catch {}
try { report = read('.lab/lesson-8-1/dt-report.txt').split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line)); } catch {}
check(spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0,
  'Git 사용 가능', 'Git을 설치하세요.');
check(state.lesson === '8-1', '8-1 실습 지점 선택됨', 'make goto L=8-1을 먼저 실행하세요.');
check(state.at === 'done', '8-1 끝 지점임', '현재는 시작 지점입니다.');
const vulnerable = read('.lab/lesson-8-1/pr-vulnerable.txt');
check(vulnerable.includes('minimist@0.0.8') && vulnerable.includes('PR 관문: 실패') && !vulnerable.includes('# 종료 코드: 0'),
  '취약한 minimist 변경 PR이 실제 실패', 'PR 실패 기록을 확인하세요.');
check(read('.lab/lesson-8-1/pr-fixed.txt').includes('PR 관문: 통과'),
  '수정 버전 변경 PR이 통과', 'PR 통과 기록을 확인하세요.');
check(exists('.lab/lesson-8-1/dl/parts-api-1.2.0.tgz') && exists('.lab/lesson-8-1/dl/parts-api-1.2.0.cdx.json'),
  'v1.2.0 릴리스의 tgz·SBOM 두 파일 보관', '릴리스 첨부 두 파일을 받으세요.');
check(read('.lab/lesson-8-1/dt-upload.txt').includes('parts-api 1.2.0 SBOM 접수'),
  'v1.2.0 SBOM을 Dependency-Track에 접수', 'make dt-upload 결과를 확인하세요.');
check(['1.0.0', '1.1.0', '1.2.0'].every(version => report.some(row => row.version === version)) &&
  report.find(row => row.version === '1.2.0')?.components === 75,
  '세 릴리스와 v1.2.0 부품 75개 확인', 'make dt-report로 세 버전을 확인하세요.');
const latest = report.find(row => row.version === '1.2.0');
check(Number.isInteger(latest?.policyViolationsFail) && Number.isInteger(latest?.critical),
  `취약점 정책과 Critical 수치 기록: FAIL ${latest?.policyViolationsFail ?? '?'}`, '정책과 취약점 분석 완료를 확인하세요.');
check(read('.lab/lesson-8-1/deploy-pass.txt').includes('배포: 통과(v1.2.0)') && exists('.lab/deploy/v1.2.0/package/npm-shrinkwrap.json'),
  '정상 v1.2.0 출처·SBOM 검증 뒤 배포', '정상 tgz로 make deploy를 실행하세요.');
check(read('.lab/lesson-8-1/deploy-reject.txt').includes('배포: 거부(출처 증명)') &&
  !read('.lab/lesson-8-1/deploy-reject.txt').includes('# 종료 코드: 0'),
  '변조 tgz가 출처 증명 단계에서 거부됨', '바꾼 tgz의 거부 기록을 확인하세요.');
check(elapsed.replaySeconds > 0 && elapsed.note?.includes('제외'),
  '재연 시간과 제외한 대기 시간 구분', 'elapsed.json의 측정 범위를 확인하세요.');
console.log('이 지점은 기존 GitHub PR·릴리스를 재사용합니다. 새 PR·태그 생성은 수강생 포크에서 진행합니다.');
console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
