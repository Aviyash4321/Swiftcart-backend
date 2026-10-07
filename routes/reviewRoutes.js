const express = require('express');
const {
  getProductReviews,
  createReview,
  updateReview,
  deleteReview,
} = require('../controllers/reviewController');
const { protect } = require('../middlewares/authMiddleware');
const {
  validateObjectId,
  validateCreateReview,
  validateUpdateReview,
} = require('../middlewares/validateRequest');

// mergeParams lets this router read :productId from the parent route (productRoutes.js)
const router = express.Router({ mergeParams: true });

router.get('/', validateObjectId('productId'), getProductReviews);
router.post('/', protect, validateObjectId('productId'), validateCreateReview, createReview);
router.put(
  '/:reviewId',
  protect,
  validateObjectId('productId'),
  validateObjectId('reviewId'),
  validateUpdateReview,
  updateReview
);
router.delete(
  '/:reviewId',
  protect,
  validateObjectId('productId'),
  validateObjectId('reviewId'),
  deleteReview
);

module.exports = router;
