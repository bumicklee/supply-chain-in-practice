import { readFileSync } from 'node:fs';

const path = process.argv[2];
if (!path) { console.error('사용법: node tools/ntia_check.mjs <CycloneDX JSON>'); process.exit(2); }
const bom = JSON.parse(readFileSync(path, 'utf8'));
const components = bom.components || [];
const checks = [
  ['공급자 이름', components.every(c => c.supplier?.name || c.publisher) ? '✓' : components.some(c => c.supplier?.name || c.publisher) ? '△' : '✗'],
  ['부품 이름', components.length && components.every(c => c.name) ? '✓' : '✗'],
  ['부품 버전', components.length && components.every(c => c.version) ? '✓' : '△'],
  ['고유 식별자', components.length && components.every(c => c.purl || c['bom-ref']) ? '✓' : '△'],
  ['의존 관계', (bom.dependencies || []).length ? '✓' : '✗'],
  ['SBOM 작성 주체', (bom.metadata?.authors || bom.metadata?.tools) ? '✓' : '✗'],
  ['생성 시각', bom.metadata?.timestamp ? '✓' : '✗'],
];
for (const [label, state] of checks) console.log(`${state} ${label}`);
console.log(`결과: ✓ ${checks.filter(c => c[1] === '✓').length}, △ ${checks.filter(c => c[1] === '△').length}, ✗ ${checks.filter(c => c[1] === '✗').length}`);
