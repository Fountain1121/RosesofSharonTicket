const express = require('express');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.static('public'));

// Only static page + other routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Temporary reset (remove later)
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
    res.json({ success: true, message: 'Test data cleared – counter reset' });
  } catch (err) {
    console.error('Reset failed:', err);
    res.status(500).json({ error: 'Reset failed' });
  }
});

module.exports = app;