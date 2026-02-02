const mongoose = require('mongoose');
require('dotenv').config();

let cachedDb = null;

async function connectDb() {
  if (cachedDb) return cachedDb;
  await mongoose.connect(process.env.MONGO_URI);
  cachedDb = mongoose.connection;
  return cachedDb;
}

const counterSchema = new mongoose.Schema({
  _id: String,
  current: Number,
  total: Number,
});
const Counter = mongoose.model('Counter', counterSchema);

  module.exports = async (req, res) => {
  try {
    await connectDb();
    let counter = await Counter.findById('ticket');
    if (!counter) {
      // Create with default total if missing
      counter = new Counter({ _id: 'ticket', current: 0, total: 300 });
      await counter.save();
      console.log('Counter document created with total 300');
    }

    res.status(200).json({
      left: counter.total - counter.current,
      total: counter.total
    });
  } catch (err) {
    console.error('tickets-left failed:', err.message);
    res.status(500).json({ error: 'Failed to fetch ticket info' });
  }
  module.exports = async (req, res) => {
  console.log('tickets-left function started');
  console.log('MONGO_URI exists:', !!process.env.MONGO_URI);

  try {
    await connectDb();
    console.log('DB connected');
    // ... rest
  } catch (err) {
    console.error('Full error:', err);
    res.status(500).json({ error: 'Failed to fetch ticket info', details: err.message });
  }
};
};