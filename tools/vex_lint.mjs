import { readFileSync, readdirSync } from 'node:fs';

const root = 'vex';
const files = readdirSync(root).filter(name => name.endsWith('.openvex.json'));
let failed = 0;
let investigating = 0;
for (const file of files) {
  const doc = JSON.parse(readFileSync(`${root}/${file}`, 'utf8'));
  if (!doc['@context'] || !doc['@id'] || !doc.author || !doc.timestamp || !doc.version || !Array.isArray(doc.statements)) {
    console.log(`✗ ${file}: 문서 필수 칸 누락`);
    failed++;
    continue;
  }
  for (const [index, statement] of doc.statements.entries()) {
    const label = `${file} #${index + 1}`;
    if (!statement.vulnerability?.name || !statement.products?.length || !['not_affected', 'affected', 'fixed', 'under_investigation'].includes(statement.status)) {
      console.log(`✗ ${label}: 취약점·제품·상태 확인 필요`);
      failed++;
      continue;
    }
    if (statement.status === 'under_investigation') {
      investigating++;
      console.log(`△ ${label}: 조사 중`);
      continue;
    }
    if (statement.status === 'not_affected') {
      if (!statement.justification || !statement.impact_statement || !/\d{4}-\d{2}-\d{2}/.test(statement.impact_statement)) {
        console.log(`✗ ${label}: 근거·영향 설명·확인 날짜 필요`);
        failed++;
        continue;
      }
      const symbol = statement.x_lab_check_symbol || 'template';
      const source = readdirSync('parts-api/src').filter(name => name.endsWith('.js')).map(name => readFileSync(`parts-api/src/${name}`, 'utf8')).join('\n');
      if (new RegExp(`\\b${symbol}\\b`).test(source)) {
        console.log(`✗ ${label}: VEX 검토일 지남 또는 코드에 ${symbol} 호출 있음`);
        failed++;
        continue;
      }
    }
    if (statement.status === 'affected' && !statement.action_statement) {
      console.log(`✗ ${label}: 영향 있음에는 조치 문장 필요`);
      failed++;
      continue;
    }
    console.log(`✓ ${label}: ${statement.status}`);
  }
}
if (!files.length) { console.log('✗ OpenVEX 문서 없음'); failed++; }
console.log(`${failed ? 0 : files.length} passed, ${failed} failed, 조사 중 ${investigating}건`);
process.exit(failed ? 1 : 0);
