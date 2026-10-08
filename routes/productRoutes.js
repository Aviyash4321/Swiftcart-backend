const express = require('express');
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} = require('../controllers/productController');
const { protect, authorize } = require('../middlewares/authMiddleware');
const {
  validateObjectId,
  validateCreateProduct,
  validateUpdateProduct,
} = require('../middlewares/validateRequest');
const {
  uploadProductImage,
  adminOnlyImage,
  parseProductFormFields,
} = require('../middlewares/uploadMiddleware');
const reviewRoutes = require('./reviewRoutes');

const router = express.Router();

// Reviews live under a product: /api/products/:productId/reviews
router.use('/:productId/reviews', reviewRoutes);

// Public routes
router.get('/', getProducts);
router.get('/:id', validateObjectId('id'), getProductById);

// Moderator and admin. Both accept JSON (as before) or a multipart form with an optional "image" file.
// Only admins may send an image (adminOnlyImage).
router.post(
  '/',
  protect,
  authorize('moderator', 'admin'),
  uploadProductImage,
  adminOnlyImage,
  parseProductFormFields,
  validateCreateProduct,
  createProduct
);
router.put(
  '/:id',
  protect,
  authorize('moderator', 'admin'),
  validateObjectId('id'),
  uploadProductImage,
  adminOnlyImage,
  parseProductFormFields,
  validateUpdateProduct,
  updateProduct
);

// Admin only
router.delete('/:id', protect, authorize('admin'), validateObjectId('id'), deleteProduct);

module.exports = router;
