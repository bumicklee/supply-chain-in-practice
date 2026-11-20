const app = require('./app');
const port = Number(process.env.PORT || 3000);
app.listen(port, '127.0.0.1', () => console.log(`parts-api listening on 127.0.0.1:${port}`));
