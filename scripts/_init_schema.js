require('dotenv').config();
const { initSchema } = require('../src/lib/db');
initSchema()
  .then(() => { console.log('Schema initialized OK'); process.exit(0); })
  .catch(e => { console.error('Schema init failed:', e); process.exit(1); });
