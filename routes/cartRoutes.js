const express = require('express');
const { getCart, addItem, updateItem, removeItem, clearCart } = require('../controllers/cartController');
const { protect } = require('../middlewares/authMiddleware');
const { validateObjectId, validateCartItem, validateQuantity } = require('../middlewares/validateRequest');

const router = express.Router();

// Every cart route needs login. The cart is always found by req.user,
// so a user can never reach another user's cart.
router.use(protect);

router.get('/', getCart);
router.delete('/', clearCart);
router.post('/items', validateCartItem, addItem);
router.put('/items/:productId', validateObjectId('productId'), validateQuantity, updateItem);
router.delete('/items/:productId', validateObjectId('productId'), removeItem);

module.exports = router;
