import { readFileSync } from 'node:fs';

const key = readFileSync('.lab/dt-api-key', 'utf8').trim();
const base = 'http://127.0.0.1:8181/api/v1';
const get = async path => {
  const response = await fetch(`${base}${path}`, {
    headers: { 'X-Api-Key': key }, signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
};

for (const version of ['1.0.0', '1.1.0', '1.2.0']) {
  const project = await get(`/project/lookup?name=parts-api&version=${version}`);
  const metrics = project.metrics || {};
  console.log(JSON.stringify({
    version, project: project.uuid, components: metrics.components,
    vulnerabilities: metrics.vulnerabilities, critical: metrics.critical,
    policyViolationsFail: metrics.policyViolationsFail,
  }));
}
