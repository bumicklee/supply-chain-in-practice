import { readFileSync } from 'node:fs';

const path = process.argv[2] ?? '.lab/collector.log';
const lines = readFileSync(path, 'utf8').split('\n').filter(Boolean);
for (const line of lines) {
  const event = JSON.parse(line);
  if (event.path !== '/dt') continue;
  const body = event.body ?? '';
  const field = name => body.match(new RegExp(`"${name}"\\s*:\\s*"([^"\\n]+)"`))?.[1] ?? '';
  const notice = event.notification ?? {};
  const group = notice.group ?? field('group');
  const title = notice.title ?? field('title');
  const vulnerability = notice.vulnerability ?? field('vulnId');
  console.log([event.at, group, title, vulnerability].filter(Boolean).join(' | '));
}
