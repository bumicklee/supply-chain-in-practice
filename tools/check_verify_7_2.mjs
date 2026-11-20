import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const read = rel => { try { return fs.readFileSync(path.join(root, rel), 'utf8'); } catch { return ''; } };
let passed = 0;
let failed = 0;
function check(ok, good, bad) {
  console.log(`${ok ? '✓' : '✗'} ${ok ? good : bad}`);
  if (ok) passed++; else failed++;
}
let state = {};
try { state = JSON.parse(read('.lab/checkpoint.json')); } catch {}
check(spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0,
  'Git 사용 가능', 'Git을 설치하세요.');
check(state.lesson === '7-2', '7-2 실습 지점 선택됨', 'make goto L=7-2를 먼저 실행하세요.');
check(state.at === 'done', '7-2 끝 지점임', '현재는 시작 지점입니다.');
const script = read('parts-api/scripts/deploy.sh');
check(script.includes('--repo "$repo"') && script.includes('--signer-workflow "$signer"') && script.includes('--source-ref "$source_ref"'),
  '배포 전 저장소·서명 워크플로·태그 고정', 'deploy.sh의 신원 고정 옵션을 확인하세요.');
check(script.indexOf('gh attestation verify "$tgz"') < script.indexOf('tar -xzf "$tgz"'),
  '출처 증명 검증 뒤에 압축 해제', '검증을 설치보다 먼저 실행하세요.');
check(script.includes('npm ci --omit=dev --ignore-scripts') && script.includes('--predicate-type https://cyclonedx.org/bom'),
  '검증된 tgz 잠금 목록으로 운영 설치 후 SBOM 증명 확인', '운영 설치와 SBOM 증명 순서를 확인하세요.');
const offline = read('.lab/lesson-7-2/offline-pass.txt');
check(offline.includes('통과(https://slsa.dev/provenance/v1)') && offline.includes('통과(https://cyclonedx.org/bom)'),
  '오프라인 출처·SBOM 증명 둘 다 통과', 'make verify-offline을 실행하세요.');
const rejected = read('.lab/lesson-7-2/offline-reject.txt');
check(rejected.includes('오프라인 검증: 거부') && !rejected.includes('# 종료 코드: 0'),
  '변조 tgz의 지문 불일치로 거부', '변조 파일을 같은 번들로 검증하세요.');
const deployed = read('.lab/lesson-7-2/deploy-pass.txt');
check(deployed.includes('배포: 통과(v1.1.0)') && deployed.includes('SBOM 증명 확인'),
  '실제 GitHub 증명 확인 후 v1.1.0 배포 통과', '정상 tgz로 make deploy를 실행하세요.');
check(state.at === 'done' && fs.existsSync(path.join(root, '.lab/deploy/v1.1.0/package/npm-shrinkwrap.json')),
  '검증한 패키지의 잠금 목록으로 설치됨', '배포 폴더의 잠금 목록을 확인하세요.');
console.log('다른 저장소·워크플로·태그 거부는 저자용 별도 실측 기록을 참조하세요.');
console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
