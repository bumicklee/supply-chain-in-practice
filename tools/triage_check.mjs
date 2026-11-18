import { readFileSync } from 'node:fs';

const text = readFileSync('policy/triage.yaml', 'utf8');
const items = text.split(/^  - /m).slice(1).map(block => {
  const fields = {};
  for (const line of block.split('\n')) {
    const match = line.match(/^\s*([a-z]+):\s*(.*?)\s*$/);
    if (match) fields[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
  return fields;
});
const today = process.env.LAB_FAKE_NOW || new Date().toISOString().slice(0, 10);
let failed = 0;
for (const item of items) {
  if (!item.id || !item.package || !['fix', 'defer'].includes(item.decision) || !item.reason || !item.owner) {
    console.log(`✗ 필수 칸 누락: ${item.id || '(id 없음)'}`);
    failed++;
    continue;
  }
  if (item.decision === 'defer' && (!/^\d{4}-\d{2}-\d{2}$/.test(item.due || '') || item.due < today)) {
    console.log(`✗ 미룸 기한 지남 또는 없음: ${item.id} (${item.due || '없음'}, 오늘 ${today})`);
    failed++;
  } else {
    console.log(`✓ ${item.id}: ${item.decision}${item.due ? `, 기한 ${item.due}` : ''}`);
  }
}
if (!items.length) { console.log('✗ 판단 기록 없음'); failed++; }
console.log(`${items.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
