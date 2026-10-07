const User = require('../models/userModel');
const { verifyToken } = require('../utils/jwt');

// Requires a valid "Authorization: Bearer <token>" header
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const error = new Error('Authentication required. Please provide a Bearer token');
      error.statusCode = 401;
      return next(error);
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token); // invalid/expired tokens throw and go to errorHandler

    // Load the user fresh from the database so role changes and deletions apply immediately
    const user = await User.findById(decoded.id);

    if (!user) {
      const error = new Error('The user belonging to this token no longer exists');
      error.statusCode = 401;
      return next(error);
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

// Allows only the listed roles. Must be used AFTER protect.
// Example: router.delete('/:id', protect, authorize('admin'), deleteProduct);
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      const error = new Error('You do not have permission to perform this action');
      error.statusCode = 403;
      return next(error);
    }
    next();
  };
};

module.exports = { protect, authorize };
