// Optional local-only shortcut for an empty DT database. Never prints secrets.
import fs from 'node:fs';
import { randomBytes } from 'node:crypto';

const folder = '.lab';
const keyFile = `${folder}/dt-api-key`;
const passwordFile = `${folder}/dt-admin-password`;
if (fs.existsSync(keyFile) && fs.statSync(keyFile).size) {
  console.log('✓ 로컬 DT API 키가 이미 있습니다.');
  process.exit(0);
}
fs.mkdirSync(folder, { recursive: true });
const password = randomBytes(24).toString('base64url');
const base = 'http://127.0.0.1:8181/api/v1';
async function form(route, values) {
  const response = await fetch(`${base}${route}`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(values), signal: AbortSignal.timeout(30_000),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`${route}: HTTP ${response.status} ${body.slice(0, 150)}`);
  return body;
}
async function json(method, route, token) {
  const response = await fetch(`${base}${route}`, {
    method, headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30_000),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`${route}: HTTP ${response.status} ${body.slice(0, 150)}`);
  return JSON.parse(body);
}

await form('/user/forceChangePassword', {
  username: 'admin', password: 'admin', newPassword: password, confirmPassword: password,
});
fs.writeFileSync(passwordFile, `${password}\n`, { mode: 0o600 });
const token = await form('/user/login', { username: 'admin', password });
const team = (await json('GET', '/team', token)).find(item => item.name === 'Administrators');
if (!team) throw new Error('Administrators 팀이 없습니다.');
const key = (await json('PUT', `/team/${team.uuid}/key`, token)).key;
if (!/^odt_[A-Za-z0-9]{8}_[A-Za-z0-9]{32}$/.test(key || '')) {
  throw new Error('생성된 DT API 키의 형식이 예상과 다릅니다.');
}
fs.writeFileSync(keyFile, `${key}\n`, { mode: 0o600 });
console.log('✓ 초기 관리자 암호 변경·로컬 API 키 생성 완료 (.lab 안에만 저장)');
