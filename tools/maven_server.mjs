import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

const [rootArg, portArg] = process.argv.slice(2);
const root = resolve(rootArg);
const port = Number(portArg);
createServer(async (request, response) => {
  if (request.url === '/health') { response.writeHead(200); response.end('ok\n'); return; }
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
  let name;
  try { name = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { response.writeHead(400); response.end(); return; }
  const file = resolve(root, `.${name}`);
  if (!file.startsWith(`${root}${sep}`)) { response.writeHead(403); response.end(); return; }
  try {
    if (!(await stat(file)).isFile()) throw new Error('not a file');
    const content = await readFile(file);
    response.writeHead(200, { 'Content-Type': file.endsWith('.xml') || file.endsWith('.pom') ? 'application/xml' : 'application/java-archive' });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch { response.writeHead(404); response.end(); }
}).listen(port, '0.0.0.0');
