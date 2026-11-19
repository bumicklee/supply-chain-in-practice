#!/usr/bin/env node
// 클론마다 독립된 Compose 프로젝트·볼륨을 쓴다. .env에는 비밀값이 없다.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = fs.realpathSync(path.resolve(import.meta.dirname, '..'));
const suffix = createHash('sha256').update(root).digest('hex').slice(0, 8);
const name = `scl-${suffix}`;
const file = path.join(root, '.env');
const content = `COMPOSE_PROJECT_NAME=${name}\nLAB_COMPOSE_PREFIX=${name}\n`;
if (fs.existsSync(file)) {
  const old = fs.readFileSync(file, 'utf8');
  if (old === content) process.exit(0);
  console.error('.env가 현재 클론과 다릅니다. 기존 Compose 서비스를 정리하고 이 파일을 백업한 뒤 다시 실행하세요.');
  process.exit(1);
}
fs.writeFileSync(file, content, { flag: 'wx', mode: 0o600 });
console.log(`이 클론의 로컬 서비스 이름: ${name}`);
