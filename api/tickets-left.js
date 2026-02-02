const mongoose = require('mongoose');
require('dotenv').config();

// Cache DB connection for serverless efficiency
let cachedDb = null;

async function connectDb() {
  if (cachedDb) return cachedDb;
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not set');
  }
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
    const counter = await Counter.findById('ticket');
    if (!counter) throw new Error('Counter not found');

    res.status(200).json({
      left: counter.total - counter.current,
      total: counter.total
    });
  } catch (err) {
    console.error('Tickets-left failed:', err.message);
    res.status(500).json({ error: 'Failed to fetch ticket info' });
  }
};