const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 7860;

app.use(cors({
  origin: [
    'https://auditiq-ezyd.vercel.app',
    'http://localhost:5173',
  ],
  credentials: true,
}));
app.use(express.json());

// Health check — Hugging Face Spaces requires a responsive root route
app.get('/', (req, res) => {
  res.json({ status: 'AuditIQ Ninja Engine Online', port: PORT });
});

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

const auditRouter = require('./routes/audit');
app.use('/api', auditRouter);
app.get('/api/ping', (req, res) => {
  res.json({ status: 'ok', message: 'AuditIQ server is running' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});