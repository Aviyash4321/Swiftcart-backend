const User = require('../models/userModel');
const Cart = require('../models/cartModel');
const Review = require('../models/reviewModel');

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// GET /api/users  (admin)  Query: role, page, limit
const getUsers = async (req, res, next) => {
  try {
    const filter = {};

    if (req.query.role !== undefined) {
      if (!User.ROLES.includes(req.query.role)) {
        return next(createError(`role must be one of: ${User.ROLES.join(', ')}`, 400));
      }
      filter.role = req.query.role;
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const skip = (page - 1) * limit;

    const total = await User.countDocuments(filter);
    const users = await User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);

    res.status(200).json({
      success: true,
      message: 'Users fetched successfully',
      data: users,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/users/:id  (admin)
const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return next(createError('User not found', 404));
    }

    res.status(200).json({
      success: true,
      message: 'User fetched successfully',
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/users/:id  (admin)  Body: any of name, email, role, password
const updateUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return next(createError('User not found', 404));
    }

    const { name, email, role, password } = req.body;

    // Stops an admin from locking themselves (and possibly everyone) out of admin access
    const isSelf = user._id.toString() === req.user._id.toString();
    if (isSelf && role !== undefined && role !== user.role) {
      return next(createError('You cannot change your own role', 400));
    }

    if (name !== undefined) user.name = name.trim();
    if (email !== undefined) user.email = email.trim().toLowerCase();
    if (role !== undefined) user.role = role;
    if (password !== undefined) user.password = password; // hashed by the pre-save hook

    await user.save(); // duplicate emails are caught by the error handler (409)

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/users/:id  (admin)
const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return next(createError('User not found', 404));
    }

    if (user._id.toString() === req.user._id.toString()) {
      return next(createError('You cannot delete your own account', 400));
    }

    // Remove the user's reviews and fix the affected products' ratings.
    // Orders are kept on purpose as sales records.
    const reviews = await Review.find({ user: user._id });
    const affectedProductIds = [...new Set(reviews.map((review) => review.product.toString()))];

    await Review.deleteMany({ user: user._id });
    for (const productId of affectedProductIds) {
      await Review.updateProductRatings(productId);
    }

    await Cart.deleteOne({ user: user._id });
    await user.deleteOne();

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
      data: { _id: user._id },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getUsers, getUserById, updateUser, deleteUser };
