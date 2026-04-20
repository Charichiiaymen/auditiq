const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 7860;

// ─── CORS Whitelisting ─────────────────────────────────────────────────────
// Production: only allow the Vercel frontend domain.
// Development: allow localhost for convenience.
const PRODUCTION_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:3000'];

const allowedOrigins = process.env.NODE_ENV === 'production'
  ? PRODUCTION_ORIGINS
  : [...PRODUCTION_ORIGINS, ...DEV_ORIGINS];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, HF health checks)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Rate Limiting ──────────────────────────────────────────────────────────
// General API rate limit (looser — covers ping, PDF, etc.)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Audit endpoints: strict limit (10 requests per 15 min per IP)
const auditLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Too many audit requests. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json({ limit: '5mb' }));

// ─── Health & Warmup Routes (BEFORE rate limiting) ───────────────────────────
// HF Spaces health check
app.get('/', (req, res) => {
  res.json({ status: 'AuditIQ Ninja Engine Online', port: PORT });
});

// Frontend warmup ping — must be before rate-limited routes so cold-start
// pings are never rejected
app.get('/api/ping', (req, res) => {
  res.json({ status: 'ok', message: 'AuditIQ server is running', timestamp: new Date().toISOString() });
});

// ─── Rate-limited API routes ─────────────────────────────────────────────────
app.use('/api', apiLimiter);
app.use('/api/audit', auditLimiter);

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

const auditRouter = require('./routes/audit');
const pdfRouter = require('./routes/pdf');
app.use('/api', auditRouter);
app.use('/api', pdfRouter);

// ─── High-Performance Timeout Configuration ─────────────────────────────────
// Ensure long-running audits don't timeout (120s window for deep analysis)
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[AUDIT] Server running on http://0.0.0.0:${PORT}`);
});
server.timeout = 120000;           // 2 minutes for deep audits
server.keepAliveTimeout = 121000;   // Slightly higher than timeout to prevent socket hangup
console.log(`[AUDIT] Server timeouts configured: timeout=${server.timeout}ms, keepAlive=${server.keepAliveTimeout}ms`);