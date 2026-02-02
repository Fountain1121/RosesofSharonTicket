const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.static('public'));

// MongoDB Schemas – email removed
const counterSchema = new mongoose.Schema({
  _id: String,
  current: Number,
  total: Number,
});
const Counter = mongoose.model('Counter', counterSchema);

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true }, // WhatsApp number only
  ticketCode: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
const User = mongoose.model('User', userSchema);

// Connect to MongoDB & Initialize Counter
mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    let counter = await Counter.findById('ticket');
    if (!counter) {
      // Initial setup – set default total (change this to your preferred default)
      const defaultTotal = 300; // You can change this initial value here, or set in DB after
      counter = new Counter({ _id: 'ticket', current: 0, total: defaultTotal });
      await counter.save();
      console.log(`Counter initialized with total: ${defaultTotal} tickets`);
    } else {
      console.log(`Counter loaded from DB with total: ${counter.total} tickets`);
    }
    console.log('MongoDB connected and counter ready');

    const port = process.env.PORT || 3000;
    app.listen(port, () => console.log(`Server running on port ${port}`));
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/tickets-left', async (req, res) => {
  try {
    const counter = await Counter.findById('ticket');
    if (!counter) throw new Error('Counter not found');
    res.json({ 
      left: counter.total - counter.current,
      total: counter.total
    });
  } catch (err) {
    console.error('Tickets-left error:', err);
    res.status(500).json({ error: 'Failed to fetch ticket info' });
  }
});

app.post('/api/register', async (req, res) => {
  let { name, phone } = req.body;

  if (!name?.trim() || !phone?.trim()) {
    return res.status(400).json({ error: 'Name and WhatsApp number are required' });
  }

  try {
    // Normalize WhatsApp number
    let normalizedPhone = phone.trim().replace(/\D/g, '');

    if (!normalizedPhone) {
      return res.status(400).json({ error: 'Invalid phone number' });
    }

    const possiblePrefixes = ['233', '00233', '000233', '2633', '0233'];
    for (const prefix of possiblePrefixes) {
      if (normalizedPhone.startsWith(prefix)) {
        normalizedPhone = normalizedPhone.substring(prefix.length);
        console.log(`Removed duplicated prefix: ${prefix}`);
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

    // Fetch current counter from DB (reads total from DB every time)
    const counter = await Counter.findById('ticket');
    if (!counter) {
      return res.status(500).json({ error: 'Ticket system error – please contact support' });
    }

    const MAX_TICKETS = counter.total; // Read total from DB dynamically

    const updatedCounter = await Counter.findOneAndUpdate(
      { _id: 'ticket', current: { $lt: MAX_TICKETS } },
      { $inc: { current: 1 } },
      { new: true }
    );

    if (!updatedCounter) {
      return res.status(410).json({ 
        error: 'No tickets left – event is fully booked. All available tickets have been claimed.' 
      });
    }

    const ticketNumber = updatedCounter.current;
    const ticketCode = `ROS-${String(ticketNumber).padStart(4, '0')}`;

    // Save registration (only name, phone, ticketCode)
    const user = new User({
      name: name.trim(),
      phone,
      ticketCode,
    });
    await user.save();

    // Respond to user immediately
    res.json({
      success: true,
      ticketCode,
      message: `Registration successful!\n\nYour ticket code is ${ticketCode}.\n\nPlease keep this code safe.\nWe will contact you soon via WhatsApp with further details.\nThank you! ♥`
    });

  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Server error – please try again or contact support' });
  }
});

// TEMPORARY RESET – REMOVE BEFORE PRODUCTION!
app.post('/api/reset-test', async (req, res) => {
  try {
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