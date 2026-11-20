// Set up the local 5-1 policy and webhook. The API key stays in ignored .lab/.
import { readFileSync } from 'node:fs';

const key = readFileSync('.lab/dt-api-key', 'utf8').trim();
const base = 'http://127.0.0.1:8181/api/v1';
const headers = { 'Content-Type': 'application/json', 'X-Api-Key': key };

async function request(method, route, body) {
  const response = await fetch(`${base}${route}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`${method} ${route}: HTTP ${response.status} ${raw.slice(0, 400)}`);
  return raw ? JSON.parse(raw) : null;
}

const policyName = 'Lab Critical findings';
const policies = await request('GET', '/policy');
let policy = policies.find(item => item.name === policyName);
if (!policy) {
  policy = await request('PUT', '/policy', {
    name: policyName, operator: 'ANY', violationState: 'FAIL', global: true,
    onlyLatestProjectVersion: false,
  });
  console.log('✓ 두 릴리스에 적용할 Critical 정책 생성');
} else {
  console.log('✓ 기존 Critical 정책 확인');
}
const fullPolicy = await request('GET', `/policy/${policy.uuid}`);
if (!fullPolicy.policyConditions?.some(item => item.subject === 'SEVERITY' && item.operator === 'IS' && item.value === 'CRITICAL')) {
  await request('PUT', `/policy/${policy.uuid}/condition`, {
    subject: 'SEVERITY', operator: 'IS', value: 'CRITICAL',
  });
  console.log('✓ 심각도 Critical 조건 생성');
} else {
  console.log('✓ 기존 심각도 Critical 조건 확인');
}

const publisher = (await request('GET', '/notification/publisher'))
  .find(item => item.publisherClass === 'org.dependencytrack.notification.publisher.WebhookPublisher');
if (!publisher) throw new Error('Outbound Webhook 발행자가 없습니다.');
const ruleName = 'Lab new vulnerability webhook';
const rules = await request('GET', '/notification/rule');
let existing = rules.find(item => item.name === ruleName);
const expectedGroups = ['NEW_VULNERABILITY', 'NEW_VULNERABLE_DEPENDENCY', 'POLICY_VIOLATION'];
if (!existing) {
  existing = await request('PUT', '/notification/rule', {
    name: ruleName, enabled: true, scope: 'PORTFOLIO',
    notificationLevel: 'INFORMATIONAL', notifyOn: expectedGroups,
    publisher: { uuid: publisher.uuid },
    publisherConfig: JSON.stringify({ destination: 'http://collector:4880/dt' }),
  });
}
// DT 4.14.5 accepts PUT, but does not persist notifyOn or publisherConfig
// until a subsequent POST update. Read back the saved record to catch this.
const config = JSON.parse(existing.publisherConfig || '{}');
if (!existing.enabled || existing.scope !== 'PORTFOLIO' ||
    !expectedGroups.every(group => existing.notifyOn?.includes(group)) ||
    config.destination !== 'http://collector:4880/dt') {
  await request('POST', '/notification/rule', {
    ...existing, enabled: true, scope: 'PORTFOLIO',
    notificationLevel: 'INFORMATIONAL', notifyOn: expectedGroups,
    publisher, publisherConfig: JSON.stringify({ destination: 'http://collector:4880/dt' }),
  });
}
const savedRule = (await request('GET', '/notification/rule')).find(item => item.name === ruleName);
const savedConfig = JSON.parse(savedRule?.publisherConfig || '{}');
if (!savedRule?.enabled || !expectedGroups.every(group => savedRule.notifyOn?.includes(group)) ||
    savedConfig.destination !== 'http://collector:4880/dt') {
  throw new Error('알림 규칙의 이벤트 또는 웹훅 주소가 저장되지 않았습니다.');
}
console.log('✓ 새 취약점·정책 위반 웹훅 규칙 저장 확인');
