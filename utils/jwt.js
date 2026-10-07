const jwt = require('jsonwebtoken');

// Create a token that contains the user's id
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });
};

// Verify a token. Throws JsonWebTokenError or TokenExpiredError if invalid.
const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

module.exports = { generateToken, verifyToken };
