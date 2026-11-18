import { createServer } from 'node:http';
import { appendFileSync, mkdirSync } from 'node:fs';

const logPath = '/work/.lab/collector.log';
mkdirSync('/work/.lab', { recursive: true });

createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    response.writeHead(200, { 'content-type': 'text/plain' });
    response.end('ok\n');
    return;
  }
  if (request.method !== 'POST' || !['/marker', '/dt'].includes(request.url)) {
    response.writeHead(404);
    response.end();
    return;
  }
  let body = '';
  request.on('data', chunk => { body += chunk.toString('utf8'); });
  request.on('end', () => {
    let notification;
    if (request.url === '/dt') {
      try {
        const parsed = JSON.parse(body).notification;
        notification = {
          level: parsed?.level,
          group: parsed?.group,
          title: parsed?.title,
          project: parsed?.subject?.project?.name,
          version: parsed?.subject?.project?.version,
          component: parsed?.subject?.component?.name,
          componentVersion: parsed?.subject?.component?.version,
          vulnerability: parsed?.subject?.vulnerability?.vulnId
            ?? parsed?.subject?.vulnerabilities?.[0]?.vulnId,
        };
      } catch {
        notification = { parseError: true };
      }
    }
    const event = {
      at: new Date().toISOString(),
      path: request.url,
      ...(notification ? { notification } : {}),
      body: body.slice(0, 1000),
    };
    appendFileSync(logPath, `${JSON.stringify(event)}\n`);
    response.writeHead(204);
    response.end();
  });
}).listen(4880, '0.0.0.0');

