import { readFileSync } from 'node:fs';

const key = readFileSync('.lab/dt-api-key', 'utf8').trim();
const base = 'http://127.0.0.1:8181/api/v1';
const vulnId = 'INT-LAB-0001';
const headers = { 'Content-Type': 'application/json', 'X-Api-Key': key };
const request = (path, options = {}) => fetch(`${base}${path}`, {
  headers,
  signal: AbortSignal.timeout(120_000),
  ...options,
});

const existing = await request(`/vulnerability/source/INTERNAL/vuln/${vulnId}`);
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
