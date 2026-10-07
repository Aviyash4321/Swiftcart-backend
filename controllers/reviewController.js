const Review = require('../models/reviewModel');
const Product = require('../models/productModel');

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// GET /api/products/:productId/reviews  (public)
const getProductReviews = async (req, res, next) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId);
    if (!product) {
      return next(createError('Product not found', 404));
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const skip = (page - 1) * limit;

    const total = await Review.countDocuments({ product: productId });
    const reviews = await Review.find({ product: productId })
      .populate('user', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      message: 'Reviews fetched successfully',
      data: reviews,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/products/:productId/reviews  (logged-in user)
const createReview = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { rating, comment } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return next(createError('Product not found', 404));
    }

    const existingReview = await Review.findOne({ product: productId, user: req.user._id });
    if (existingReview) {
      return next(createError('You have already reviewed this product', 409));
    }

    const review = await Review.create({
      user: req.user._id,
      product: productId,
      rating,
      comment,
    });

    await Review.updateProductRatings(productId);

    res.status(201).json({
      success: true,
      message: 'Review created successfully',
      data: review,
    });
  } catch (error) {
    next(error);
  }
};

// Loads a review that belongs to the product in the URL and checks that the logged-in user owns it.
// Returns the review, or null after sending an error to next().
const findOwnReview = async (req, next) => {
  const { productId, reviewId } = req.params;

  const review = await Review.findOne({ _id: reviewId, product: productId });
  if (!review) {
    next(createError('Review not found', 404));
    return null;
  }

  if (review.user.toString() !== req.user._id.toString()) {
    next(createError('You can only change your own review', 403));
    return null;
  }

  return review;
};

// PUT /api/products/:productId/reviews/:reviewId  (review owner)
const updateReview = async (req, res, next) => {
  try {
    const review = await findOwnReview(req, next);
    if (!review) return;

    if (req.body.rating !== undefined) review.rating = req.body.rating;
    if (req.body.comment !== undefined) review.comment = req.body.comment;
    await review.save();

    await Review.updateProductRatings(review.product);

    res.status(200).json({
      success: true,
      message: 'Review updated successfully',
      data: review,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/products/:productId/reviews/:reviewId  (review owner)
const deleteReview = async (req, res, next) => {
  try {
    const review = await findOwnReview(req, next);
    if (!review) return;

    await review.deleteOne();
    await Review.updateProductRatings(review.product);

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully',
      data: { _id: review._id },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getProductReviews, createReview, updateReview, deleteReview };
