const express = require('express');
const priceRules = require('@parts/price-rules');
const stringPadder = require('string-padder');
const lodash = require('lodash');

const app = express();
app.use(express.json({ limit: '16kb' }));

app.get('/health', (_request, response) => response.json({ status: 'ok' }));

app.get('/price', (request, response) => {
  const base = Number(request.query.base ?? 1000);
  const quantity = Number(request.query.quantity ?? 1);
  if (!Number.isFinite(base) || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
    return response.status(400).json({ error: 'invalid price input' });
  }
  return response.json({ amount: priceRules.price(base, quantity) });
});

app.post('/quote', (request, response) => {
  const sku = String(request.body?.sku ?? '').slice(0, 30);
  const quantity = Number(request.body?.quantity ?? 1);
  if (!sku || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
    return response.status(400).json({ error: 'invalid quote input' });
  }
  const amount = priceRules.price(1000, quantity);
  return response.json({ sku: lodash.trim(sku), amount, display: stringPadder.pad(amount) });
});

module.exports = app;
