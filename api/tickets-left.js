const mongoose = require('mongoose');
require('dotenv').config();

// Define Counter model (same as in app.js)
const counterSchema = new mongoose.Schema({
  _id: String,
  current: Number,
  total: Number,
});
const Counter = mongoose.model('Counter', counterSchema);

// Cache connection for serverless (Vercel runs this file per request)
let cachedDb = null;

async function connectDb() {
  if (cachedDb) return cachedDb;
  await mongoose.connect(process.env.MONGO_URI);
  cachedDb = mongoose.connection;
  return cachedDb;
}

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
    console.error('Tickets-left error:', err);
    res.status(500).json({ error: 'Failed to fetch ticket info' });
  }
};