const express = require('express');
const path = require('path');

const app = express();
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Optional: keep reset-test here or move it too
app.post('/api/reset-test', async (req, res) => {
  // ... your reset code ...
});

module.exports = app;