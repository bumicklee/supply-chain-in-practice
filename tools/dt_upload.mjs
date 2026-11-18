import { readFileSync, existsSync } from 'node:fs';

const [version, path] = process.argv.slice(2);
if (!version || !path || !existsSync(path)) {
  console.error('사용법: make dt-upload V=<버전> SBOM=<CycloneDX JSON>');
  process.exit(2);
}
const key = readFileSync('.lab/dt-api-key', 'utf8').trim();
const bom = readFileSync(path).toString('base64');
const response = await fetch('http://127.0.0.1:8181/api/v1/bom', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json', 'X-Api-Key': key },
  body: JSON.stringify({ projectName: 'parts-api', projectVersion: version, autoCreate: true, bom }),
});
const data = await response.text();
if (!response.ok) { console.error(`업로드 실패: HTTP ${response.status} ${data}`); process.exit(1); }
const token = JSON.parse(data).token;
console.log(`✓ parts-api ${version} SBOM 접수`);
console.log(`처리 토큰: ${token || '(없음)'}`);
