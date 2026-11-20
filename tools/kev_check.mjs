#!/usr/bin/env node
// Grype 경보의 CVE 별칭과 수업 날짜의 CISA KEV 목록을 대조한다.
import fs from 'node:fs';

const scanPath = process.argv[2] || '.lab/lesson-4-1/scan-before.json';
const catalogPath = 'fixtures/kev/known_exploited_vulnerabilities.json';
try {
  const scan = JSON.parse(fs.readFileSync(scanPath, 'utf8'));
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  if (!Array.isArray(scan.matches) || !Array.isArray(catalog.vulnerabilities)) throw new Error('JSON 구조가 예상과 다릅니다.');
  const kev = new Set(catalog.vulnerabilities.map(item => item.cveID));
  const ids = new Set();
  for (const match of scan.matches) {
    if (/^CVE-\d{4}-\d+$/.test(match.vulnerability?.id || '')) ids.add(match.vulnerability.id);
    for (const related of match.relatedVulnerabilities || []) {
      if (/^CVE-\d{4}-\d+$/.test(related.id || '')) ids.add(related.id);
    }
  }
  const hits = [...ids].filter(id => kev.has(id)).sort();
  console.log(`CISA KEV 스냅샷: ${catalog.catalogVersion} (${catalog.dateReleased})`);
  console.log(`Grype 경보: ${scan.matches.length}건, 연결된 CVE: ${ids.size}개`);
  console.log(`KEV 일치: ${hits.length}건`);
  for (const id of hits) console.log(`✓ ${id}`);
  console.log('일치 0건은 이 스냅샷과 경보의 CVE 별칭을 비교한 결과입니다.');
} catch (error) {
  console.error(`KEV 대조 실패: ${error.message}`);
  process.exit(1);
}
