import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
let passed = 0;
let failed = 0;
function check(ok, good, bad) {
  console.log(`${ok ? '✓' : '✗'} ${ok ? good : bad}`);
  if (ok) passed++; else failed++;
}
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')); } catch { return null; }
}

check(spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0,
  'Git 사용 가능', 'Git을 설치한 뒤 다시 확인하세요.');
const checkpoint = readJson('.lab/checkpoint.json');
check(checkpoint?.lesson === '5-1',
  '5-1 실습 지점 선택됨', 'make goto L=5-1을 먼저 실행하세요.');
check(checkpoint?.at === 'done',
  '5-1 끝 지점임', '현재는 시작 지점입니다. 실습을 마친 뒤 끝 지점에서 확인하세요.');

for (const version of ['1.0.0', '1.1.0']) {
  const bom = readJson(`.lab/sbom-${version}.cdx.json`);
  check(bom?.bomFormat === 'CycloneDX' && bom.metadata?.component?.version === version && bom.components?.length === 76,
    `${version} 릴리스 SBOM에 76개 부품과 버전 기록`, `${version} 릴리스 SBOM을 Syft로 다시 생성하세요.`);
}

const keyFile = path.join(root, '.lab/dt-api-key');
const key = fs.existsSync(keyFile) ? fs.readFileSync(keyFile, 'utf8').trim() : '';
check(Boolean(key), '로컬 DT API 키 있음', '관리자 화면에서 키를 만들고 .lab/dt-api-key에 저장하세요.');
const base = 'http://127.0.0.1:8181/api/v1';
async function get(route) {
  const response = await fetch(`${base}${route}`, {
    headers: { 'X-Api-Key': key }, signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`${route}: HTTP ${response.status}`);
  return response.json();
}
let projects = [];
if (key) {
  try {
    projects = await Promise.all(['1.0.0', '1.1.0'].map(version =>
      get(`/project/lookup?name=parts-api&version=${version}`)));
  } catch (error) {
    console.error(`DT 프로젝트 조회 실패: ${error.message}`);
  }
}
check(projects.length === 2 && projects.every((item, index) => item.version === ['1.0.0', '1.1.0'][index]),
  'DT에 1.0.0·1.1.0 프로젝트가 따로 있음', 'make dt-up 뒤 두 릴리스 SBOM을 각각 업로드하세요.');
check(projects.length === 2 && projects.every(item => item.metrics?.components === 76),
  '두 릴리스 모두 DT에 76개 부품으로 등록됨', 'DT의 BOM 분석 완료를 기다리고 두 프로젝트의 부품 수를 확인하세요.');

let findings = [];
if (projects.length === 2) {
  try { findings = await Promise.all(projects.map(item => get(`/finding/project/${item.uuid}`))); }
  catch (error) { console.error(`DT 취약점 조회 실패: ${error.message}`); }
}
const hasInternal = list => Array.isArray(list) && list.some(item => item.vulnerability?.vulnId === 'INT-LAB-0001');
check(findings.length === 2 && hasInternal(findings[0]) && !hasInternal(findings[1]),
  '실습용 내부 취약점이 1.0.0에만 붙음', 'make dt-new-vuln 뒤 분석 완료를 기다리고 두 버전의 취약점 탭을 비교하세요.');
check(projects.length === 2 && projects[0].metrics?.policyViolationsFail >= 1 &&
  projects[0].metrics.policyViolationsFail > (projects[1].metrics?.policyViolationsFail ?? Infinity),
  '1.0.0의 정책 FAIL 수가 1.1.0보다 큼', 'Critical 정책을 저장하고 두 버전의 재분석이 끝날 때까지 기다리세요.');

let policies = [], rules = [];
if (key) {
  try { [policies, rules] = await Promise.all([get('/policy'), get('/notification/rule')]); }
  catch (error) { console.error(`DT 설정 조회 실패: ${error.message}`); }
}
check(policies.some(item => item.name === 'Lab Critical findings' && item.violationState === 'FAIL'),
  'Critical FAIL 정책 있음', 'make dt-setup-5-1로 정책을 만드세요.');
const rule = rules.find(item => item.name === 'Lab new vulnerability webhook');
let destination = '';
try { destination = JSON.parse(rule?.publisherConfig || '{}').destination || ''; } catch {}
check(Boolean(rule?.enabled) && rule.notifyOn?.includes('NEW_VULNERABILITY') &&
  destination === 'http://collector:4880/dt',
  '새 취약점 웹훅 이벤트와 수집기 주소가 저장됨', 'make dt-setup-5-1로 알림 규칙을 저장하세요.');

const collectorFile = path.join(root, '.lab/collector.log');
const events = fs.existsSync(collectorFile)
  ? fs.readFileSync(collectorFile, 'utf8').split('\n').filter(Boolean).flatMap(line => {
    try { return [JSON.parse(line)]; } catch { return []; }
  }) : [];
check(events.some(item => item.path === '/dt' && item.notification?.version === '1.0.0' &&
  item.notification?.vulnerability === 'INT-LAB-0001'),
  '1.0.0 내부 취약점의 실제 웹훅 도착', '수집기와 알림 규칙을 확인하고 새 내부 취약점 이벤트를 다시 재연하세요.');

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
fs.writeFileSync(path.join(root, '.lab/checkpoint.json'), JSON.stringify({ lesson: '5-1', at: 'done' }) + '\n');
