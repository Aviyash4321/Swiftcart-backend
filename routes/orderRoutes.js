const express = require('express');
const {
  createOrder,
  getMyOrders,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
} = require('../controllers/orderController');
const { protect, authorize } = require('../middlewares/authMiddleware');
const {
  validateObjectId,
  validateCreateOrder,
  validateOrderStatus,
} = require('../middlewares/validateRequest');

const router = express.Router();

router.use(protect); // every order route needs login

router.post('/', validateCreateOrder, createOrder);
router.get('/', getMyOrders);

// IMPORTANT: '/all' must come BEFORE '/:id', otherwise Express treats "all" as an id
router.get('/all', authorize('admin'), getAllOrders);

router.get('/:id', validateObjectId('id'), getOrderById);
router.put('/:id/status', authorize('admin'), validateObjectId('id'), validateOrderStatus, updateOrderStatus);

module.exports = router;
