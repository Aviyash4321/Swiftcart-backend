const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 200,               // max requests per IP per window
  standardHeaders: true,    // send RateLimit-* headers
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many requests, please try again later',
    });
  },
});

module.exports = { apiLimiter };
