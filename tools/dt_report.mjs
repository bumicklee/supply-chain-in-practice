import { readFileSync } from 'node:fs';

const key = readFileSync('.lab/dt-api-key', 'utf8').trim();
const base = 'http://127.0.0.1:8181/api/v1';

const versions = process.argv.slice(2);
for (const version of versions.length ? versions : ['1.0.0', '1.1.0', '1.2.0']) {
  const response = await fetch(`${base}/project/lookup?name=parts-api&version=${version}`, {
    headers: { 'X-Api-Key': key }, signal: AbortSignal.timeout(30_000),
  });
  if (response.status === 404 && versions.length === 0) continue;
  if (!response.ok) throw new Error(`parts-api ${version}: HTTP ${response.status}`);
  const project = await response.json();
  const metrics = project.metrics || {};
  console.log(JSON.stringify({
    version, project: project.uuid, components: metrics.components,
    vulnerabilities: metrics.vulnerabilities, critical: metrics.critical,
    policyViolationsFail: metrics.policyViolationsFail,
  }));
}
