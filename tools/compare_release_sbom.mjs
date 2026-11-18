import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const version = process.argv[2];
if (!version) { console.error('사용법: make release-compare V=<버전>'); process.exit(2); }
const bom = JSON.parse(readFileSync(`.lab/releases/parts-api-${version}.cdx.json`, 'utf8'));
const result = spawnSync('npm', ['ls', '--json', '--omit=dev', '--all', '--prefix', 'release-stage/installed/package'], { encoding: 'utf8' });
if (result.status !== 0) { console.error(result.stderr); process.exit(result.status || 1); }
const tree = JSON.parse(result.stdout);
const installed = new Set();
function walk(node, name) {
  installed.add(`${name}@${node.version}`);
  for (const [childName, child] of Object.entries(node.dependencies || {})) walk(child, childName);
}
walk(tree, tree.name);
const scanned = new Set((bom.components || []).map(c => `${c.name}@${c.version}`));
const missing = [...installed].filter(x => !scanned.has(x));
const extra = [...scanned].filter(x => !installed.has(x));
console.log(`npm 운영 부품: ${installed.size}개`);
console.log(`SBOM 부품: ${scanned.size}개`);
for (const name of missing) console.log(`✗ SBOM 누락: ${name}`);
for (const name of extra) console.log(`✗ 설치 목록에 없음: ${name}`);
console.log(missing.length || extra.length ? '대조 실패' : '운영 부품 목록 일치');
process.exit(missing.length || extra.length ? 1 : 0);
