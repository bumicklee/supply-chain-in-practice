const { test } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');

async function withServer(run) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('health', async () => withServer(async base => {
  const response = await fetch(`${base}/health`);
  assert.deepEqual(await response.json(), { status: 'ok' });
}));

test('price uses the internal rule', async () => withServer(async base => {
  const response = await fetch(`${base}/price?base=1000&quantity=2`);
  assert.deepEqual(await response.json(), { amount: 1800 });
}));

test('price rejects invalid quantity', async () => withServer(async base => {
  const response = await fetch(`${base}/price?quantity=0`);
  assert.equal(response.status, 400);
}));

test('quote formats the amount', async () => withServer(async base => {
  const response = await fetch(`${base}/quote`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sku: '  A-01 ', quantity: 2 }),
  });
  assert.deepEqual(await response.json(), { sku: 'A-01', amount: 1800, display: '001800' });
}));

test('quote requires a SKU', async () => withServer(async base => {
  const response = await fetch(`${base}/quote`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ quantity: 1 }),
  });
  assert.equal(response.status, 400);
}));
