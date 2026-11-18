const { mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
if (process.env.LAB_MARKER_DIR) {
  mkdirSync(process.env.LAB_MARKER_DIR, { recursive: true });
  writeFileSync(join(process.env.LAB_MARKER_DIR, 'scoped-price-rules-1.99.0.txt'), '교육용 설치 표식\n');
}

