import { readFileSync } from 'node:fs';

const key = readFileSync('.lab/dt-api-key', 'utf8').trim();
const base = 'http://127.0.0.1:8181/api/v1';
const vulnId = 'INT-LAB-0001';
const replay = process.argv.includes('--replay');
const headers = { 'Content-Type': 'application/json', 'X-Api-Key': key };
const request = (path, options = {}) => fetch(`${base}${path}`, {
  headers,
  signal: AbortSignal.timeout(120_000),
  ...options,
});

let existing = await request(`/vulnerability/source/INTERNAL/vuln/${vulnId}`);
if (replay && existing.ok) {
  const data = await existing.json();
  if (!data.description?.startsWith('실습용 내부 취약점.') ||
      !data.affectedComponents?.some(component => component.identity === 'pkg:npm/%40parts/price-rules@1.2.0')) {
    throw new Error(`${vulnId}이 실습용 취약점과 달라 재연을 중지합니다.`);
  }
  // DT refuses to delete a vulnerability while a portfolio component uses it.
  // The 1.0.0 project is this lesson's disposable example; remove only that
  // exact project before recreating the event. The 1.1.0 comparison remains.
  const projectResponse = await request('/project/lookup?name=parts-api&version=1.0.0');
  if (projectResponse.ok) {
    const project = await projectResponse.json();
    if (project.name !== 'parts-api' || project.version !== '1.0.0') {
      throw new Error('재연 대상 프로젝트의 이름과 버전이 예상과 달라 중지합니다.');
    }
    const deletedProject = await request(`/project/${project.uuid}`, { method: 'DELETE' });
    if (deletedProject.status !== 204) {
      throw new Error(`기존 1.0.0 실습 프로젝트 삭제 실패: HTTP ${deletedProject.status}`);
    }
    console.log('✓ 기존 1.0.0 실습 프로젝트를 재연용으로 정리');
  } else if (projectResponse.status !== 404) {
    throw new Error(`기존 1.0.0 실습 프로젝트 조회 실패: HTTP ${projectResponse.status}`);
  }
  const removed = await request(`/vulnerability/${data.uuid}`, { method: 'DELETE' });
  if (!removed.ok) throw new Error(`기존 실습용 취약점 삭제 실패: HTTP ${removed.status}`);
  console.log(`✓ 기존 실습용 취약점 ${vulnId}을 재연용으로 정리`);
  existing = await request(`/vulnerability/source/INTERNAL/vuln/${vulnId}`);
}
if (existing.status === 404) {
  const payload = {
    source: 'INTERNAL',
    vulnId,
    title: 'Lab: vulnerable price rule 1.2.0',
    description: '실습용 내부 취약점. @parts/price-rules 1.2.0만 영향받으며 1.2.1에서 수정했습니다. 실제 CVE가 아닙니다.',
    severity: 'CRITICAL',
    affectedComponents: [{
      identityType: 'PURL',
      identity: 'pkg:npm/%40parts/price-rules@1.2.0',
      versionType: 'EXACT',
      version: '1.2.0',
    }],
  };
  const created = await request('/vulnerability', { method: 'PUT', body: JSON.stringify(payload) });
  if (created.status !== 201) {
    console.error(`내부 취약점 생성 실패: HTTP ${created.status} ${await created.text()}`);
    process.exit(1);
  }
  console.log(`✓ 실습용 내부 취약점 ${vulnId} 생성`);
} else if (existing.ok) {
  const data = await existing.json();
  const match = data.severity === 'CRITICAL'
    && data.affectedComponents?.some(component => component.identity === 'pkg:npm/%40parts/price-rules@1.2.0'
      && component.versionType === 'EXACT');
  if (!match) {
    console.error(`${vulnId}이 이미 있지만 심각도나 대상 부품이 실습 설정과 다릅니다.`);
    process.exit(1);
  }
  console.log(`✓ 실습용 내부 취약점 ${vulnId} 존재, Critical/1.2.0 일치`);
} else {
  console.error(`내부 취약점 조회 실패: HTTP ${existing.status} ${await existing.text()}`);
  process.exit(1);
}

const bom = readFileSync('.lab/sbom-1.0.0.cdx.json').toString('base64');
const uploaded = await request('/bom', {
  method: 'PUT',
  body: JSON.stringify({ projectName: 'parts-api', projectVersion: '1.0.0', autoCreate: true, bom }),
});
if (!uploaded.ok) {
  console.error(`1.0.0 재분석 요청 실패: HTTP ${uploaded.status} ${await uploaded.text()}`);
  process.exit(1);
}
console.log('✓ 1.0.0 SBOM 재업로드로 내부 취약점 분석 요청');
