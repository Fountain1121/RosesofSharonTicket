const mongoose = require('mongoose');
require('dotenv').config();

let cachedDb = null;

async function connectDb() {
  if (cachedDb) return cachedDb;
  await mongoose.connect(process.env.MONGO_URI);
  cachedDb = mongoose.connection;
  return cachedDb;
}

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  ticketCode: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
const User = mongoose.model('User', userSchema);

const counterSchema = new mongoose.Schema({
  _id: String,
  current: Number,
  total: Number,
});
const Counter = mongoose.model('Counter', counterSchema);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let { name, phone } = req.body;

  if (!name?.trim() || !phone?.trim()) {
    return res.status(400).json({ error: 'Name and WhatsApp number are required' });
  }

  try {
    await connectDb();

    // Normalize phone
    let normalizedPhone = phone.trim().replace(/\D/g, '');
    if (!normalizedPhone) return res.status(400).json({ error: 'Invalid phone number' });

    const possiblePrefixes = ['233', '00233', '000233', '2633', '0233'];
    for (const prefix of possiblePrefixes) {
      if (normalizedPhone.startsWith(prefix)) {
        normalizedPhone = normalizedPhone.substring(prefix.length);
        break;
      }
    }

    if (normalizedPhone.startsWith('0')) {
      normalizedPhone = normalizedPhone.substring(1);
    }

    if (!normalizedPhone.startsWith('+')) {
      normalizedPhone = '+233' + normalizedPhone;
    }

    const digitsAfterCode = normalizedPhone.replace('+', '').length;
    if (digitsAfterCode < 8 || digitsAfterCode > 15) {
      return res.status(400).json({ error: 'WhatsApp number must be 8-15 digits long after country code' });
    }

    phone = normalizedPhone;

    // Claim ticket atomically
    const MAX_TICKETS = parseInt(process.env.TOTAL_TICKETS || '300', 10);
    const counter = await Counter.findOneAndUpdate(
      { _id: 'ticket', current: { $lt: MAX_TICKETS } },
      { $inc: { current: 1 } },
      { new: true }
    );

    if (!counter) {
      return res.status(410).json({ 
        error: 'No tickets left – event is fully booked.' 
      });
    }

    const ticketCode = `ROS-${String(counter.current).padStart(4, '0')}`;

    // Save
    const user = new User({
      name: name.trim(),
      phone,
      ticketCode,
    });
    await user.save();

    res.status(200).json({
      success: true,
      ticketCode,
      message: `Registration successful!\nYour ticket code is ${ticketCode}.\nKeep it safe. We will contact you via WhatsApp. ♥`
    });
  } catch (err) {
    console.error('Register failed:', err.message);
    res.status(500).json({ error: 'Server error – try again' });
  }
};