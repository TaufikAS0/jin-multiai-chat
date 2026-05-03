const express = require('express');
const path = require('path');
const { PORT } = require('./src/config');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/models',   require('./src/routes/models'));
app.use('/api/sessions', require('./src/routes/sessions'));
app.use('/api/chat',     require('./src/routes/chat'));
app.use('/api/agent',    require('./src/routes/agent'));

app.listen(PORT, () => {
  console.log(`\n  JIN MultiAI Chat`);
  console.log(`  http://localhost:${PORT}\n`);
});
