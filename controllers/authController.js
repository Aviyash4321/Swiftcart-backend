const User = require('../models/userModel');
const { generateToken } = require('../utils/jwt');

// POST /api/auth/register
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      const error = new Error('A user with this email already exists');
      error.statusCode = 409;
      return next(error);
    }

    // The role is NOT taken from the request, so nobody can register themselves as admin.
    // It defaults to 'user'. Admins are created by the seeder or by another admin.
    const user = await User.create({ name, email, password });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: { token, user },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // password has select:false in the schema, so we ask for it explicitly here
    const user = await User.findOne({ email }).select('+password');

    // Same message for "no user" and "wrong password" so attackers cannot guess which emails exist
    if (!user || !(await user.comparePassword(password))) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      return next(error);
    }

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: { token, user }, // toJSON removes the password hash
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/auth/me
const getMe = async (req, res, next) => {
  try {
    // req.user was loaded by the protect middleware
    res.status(200).json({
      success: true,
      message: 'Current user fetched successfully',
      data: req.user,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, getMe };
