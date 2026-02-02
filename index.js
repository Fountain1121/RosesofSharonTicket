const express = require('express');
const path = require('path');

const app = express();
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Optional reset (keep if needed)
app.post('/api/reset-test', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    await mongoose.connect(process.env.MONGO_URI);
    const User = mongoose.model('User');
    const Counter = mongoose.model('Counter');

    await User.deleteMany({});
    await Counter.findOneAndUpdate(
      { _id: 'ticket' },
      { $set: { current: 0 } },
      { upsert: true, new: true }
    );
    res.json({ success: true, message: 'Reset complete' });
  } catch (err) {
    res.status(500).json({ error: 'Reset failed' });
  }
});

module.exports = app;