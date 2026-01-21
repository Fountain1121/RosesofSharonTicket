const express = require('express');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const axios = require('axios');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.static('public'));

// MongoDB Schemas (unchanged)
const counterSchema = new mongoose.Schema({
  _id: String,
  current: Number,
  total: Number,
});
const Counter = mongoose.model('Counter', counterSchema);

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, required: true, lowercase: true },
  phone: { type: String, required: true },
  ticketCode: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
const User = mongoose.model('User', userSchema);

// Connect to MongoDB & Initialize Counter (unchanged)
mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    let counter = await Counter.findById('ticket');
    if (!counter) {
      const total = parseInt(process.env.TOTAL_TICKETS || '300', 10);
      counter = new Counter({ _id: 'ticket', current: 0, total });
      await counter.save();
      console.log(`Counter initialized with total: ${total} tickets`);
    }
    console.log('MongoDB connected and counter ready');

    const port = process.env.PORT || 3000;
    app.listen(port, () => console.log(`Server running on port ${port}`));
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Routes (unchanged except register)
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
  let { name, email, phone } = req.body;

  if (!name?.trim() || !email?.trim() || !phone?.trim()) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    // Normalize phone (unchanged)
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
      return res.status(400).json({ error: 'Phone number must be 8-15 digits long after country code' });
    }

    phone = normalizedPhone;

    // Prevent duplicates (unchanged)
    const existing = await User.findOne({ email: email.trim().toLowerCase() });
    if (existing) {
      return res.status(400).json({ error: 'This email is already registered' });
    }

    // Claim ticket (unchanged)
    const MAX_TICKETS = parseInt(process.env.TOTAL_TICKETS || '300', 10);
    const counter = await Counter.findOneAndUpdate(
      { _id: 'ticket', current: { $lt: MAX_TICKETS } },
      { $inc: { current: 1 } },
      { new: true }
    );

    if (!counter) {
      return res.status(410).json({ error: 'No tickets left – event is fully booked' });
    }

    const ticketNumber = counter.current;
    const ticketCode = `ROS-${String(ticketNumber).padStart(4, '0')}`;

    // Save user (unchanged)
    const user = new User({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone,
      ticketCode,
    });
    await user.save();

    // Respond immediately
    res.json({
      success: true,
      ticketCode,
      message: `Registration successful! Your ticket (${ticketCode}) is confirmed.\nWe're sending it to your email & SMS right now — check in a minute (also check spam).`,
      delivery: { emailSent: false, smsSent: false }
    });

    // Background sending
    (async () => {
      let emailSuccess = false;
      let smsSuccess = false;

      // Event details (unchanged)
      const eventDate = '13th February, 2026';
      const eventTime = '6:00 PM';
      const eventLocation = 'Love Country Church, Dayspring, Haatso, Accra, Ghana';
      const mapUrl = 'https://www.google.com/maps/search/?api=1&query=Love+Country+Church%2C+Dayspring%2C+Haatso%2C+Accra%2C+Ghana';

      // Email with Brevo SMTP
      const transporter = nodemailer.createTransport({
        host: 'smtp-relay.brevo.com',
        port: 587,
        secure: false,
        auth: {
          user: process.env.BREVO_SMTP_USER,
          pass: process.env.BREVO_SMTP_PASS
        },
      });

      try {
        const info = await transporter.sendMail({
          from: `"Roses of Sharon Team" <${process.env.BREVO_SMTP_USER}>`,
          to: email.trim(),
          subject: 'Your Roses of Sharon Virtual Ticket ♥',
          html: `
            <html>
              <body style="font-family: Arial, sans-serif; color: #333; background-color: #f8f8f8; padding: 20px;">
                <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                  <h2 style="color: #c2185b; text-align: center;">Welcome to Roses of Sharon!</h2>
                  <p>Dear ${name.trim()},</p>
                  <p>Thank you for registering for our special Valentine's Day celebration.</p>
                  <p style="font-size: 1.2em; font-weight: bold;">Your Ticket Code: ${ticketCode}</p>
                  <p><strong>Event Details:</strong></p>
                  <ul style="list-style: none; padding-left: 0;">
                    <li>📅 <strong>Date:</strong> ${eventDate}</li>
                    <li>🕕 <strong>Time:</strong> ${eventTime}</li>
                    <li>📍 <strong>Location:</strong> ${eventLocation}</li>
                  </ul>
                  <p>Find your way easily: <a href="${mapUrl}" style="color: #c2185b; text-decoration: none; font-weight: bold;">View on Google Maps</a></p>
                  <img src="cid:ticketImage" alt="Roses of Sharon Ticket" style="max-width: 100%; margin: 20px 0; border-radius: 8px;" />
                  <p>We look forward to sharing this beautiful evening of love, worship, and fellowship with you!</p>
                  <p style="text-align: center; color: #777; font-size: 0.9em;">Blessings,<br>The Church Team</p>
                </div>
              </body>
            </html>
          `,
          attachments: [
            {
              filename: 'ticket.png',
              path: path.join(__dirname, 'public', 'ticket.png'),
              cid: 'ticketImage',
            },
          ],
        });
        console.log('Background email sent → ID:', info.messageId);
        emailSuccess = true;
      } catch (emailErr) {
        console.error('Background email failed:', emailErr.message);
      }

      // SMS with Brevo API
      try {
        await axios.post(
          'https://api.brevo.com/v3/transactionalSMS/sms',
          {
            sender: process.env.BREVO_SMS_SENDER,
            recipient: phone,
            content: `Dear ${name.trim()},\n\nThank you for registering for Roses of Sharon!\n\nYour Ticket Code: ${ticketCode}\nDate: ${eventDate}\nTime: ${eventTime}\nLocation: ${eventLocation}\nMap: ${mapUrl}\n\nWe can't wait to see you there! ♥\nThe Church Team`,
            type: 'transactional'
          },
          {
            headers: {
              'accept': 'application/json',
              'api-key': process.env.BREVO_API_KEY,
              'content-type': 'application/json'
            }
          }
        );
        console.log('Background SMS sent successfully');
        smsSuccess = true;
      } catch (smsErr) {
        console.error('Background SMS failed:', smsErr.message);
      }
    })();

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