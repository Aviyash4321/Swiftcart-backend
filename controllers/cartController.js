const Cart = require('../models/cartModel');
const Product = require('../models/productModel');

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const roundMoney = (amount) => Math.round(amount * 100) / 100;

// Turns a cart document into a clean response with subtotals and a total.
// Items whose product was deleted are left out.
const buildCartResponse = async (cart) => {
  await cart.populate('items.product', 'name price stock images');

  const items = cart.items
    .filter((item) => item.product)
    .map((item) => ({
      product: item.product,
      quantity: item.quantity,
      subtotal: roundMoney(item.product.price * item.quantity),
      available: item.product.stock >= item.quantity, // false if stock dropped below the quantity
    }));

  const totalAmount = roundMoney(items.reduce((sum, item) => sum + item.subtotal, 0));

  return {
    _id: cart._id,
    user: cart.user,
    items,
    totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
    totalAmount,
    updatedAt: cart.updatedAt,
  };
};

// GET /api/cart
const getCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });

    // A user without a cart simply has an empty cart
    const data = cart
      ? await buildCartResponse(cart)
      : { user: req.user._id, items: [], totalItems: 0, totalAmount: 0 };

    res.status(200).json({
      success: true,
      message: 'Cart fetched successfully',
      data,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/cart/items   Body: { productId, quantity }
const addItem = async (req, res, next) => {
  try {
    const { productId, quantity } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return next(createError('Product not found', 404));
    }

    if (product.stock < 1) {
      return next(createError(`"${product.name}" is out of stock`, 400));
    }

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = new Cart({ user: req.user._id, items: [] });
    }

    const existingItem = cart.items.find((item) => item.product.toString() === productId);
    const newQuantity = (existingItem ? existingItem.quantity : 0) + quantity;

    if (newQuantity > product.stock) {
      return next(createError(`Only ${product.stock} unit(s) of "${product.name}" available`, 400));
    }

    if (existingItem) {
      existingItem.quantity = newQuantity;
    } else {
      cart.items.push({ product: product._id, quantity });
    }

    await cart.save();

    res.status(existingItem ? 200 : 201).json({
      success: true,
      message: existingItem ? 'Cart item quantity updated' : 'Product added to cart',
      data: await buildCartResponse(cart),
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/cart/items/:productId   Body: { quantity }
const updateItem = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;

    const cart = await Cart.findOne({ user: req.user._id });
    const item = cart ? cart.items.find((cartItem) => cartItem.product.toString() === productId) : null;

    if (!item) {
      return next(createError('Product not found in your cart', 404));
    }

    const product = await Product.findById(productId);
    if (!product) {
      // Product was deleted: clean it out of the cart
      cart.items = cart.items.filter((cartItem) => cartItem.product.toString() !== productId);
      await cart.save();
      return next(createError('This product no longer exists and was removed from your cart', 404));
    }

    if (quantity > product.stock) {
      return next(createError(`Only ${product.stock} unit(s) of "${product.name}" available`, 400));
    }

    item.quantity = quantity;
    await cart.save();

    res.status(200).json({
      success: true,
      message: 'Cart item updated successfully',
      data: await buildCartResponse(cart),
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/cart/items/:productId
const removeItem = async (req, res, next) => {
  try {
    const { productId } = req.params;

    const cart = await Cart.findOne({ user: req.user._id });
    const hasItem = cart && cart.items.some((item) => item.product.toString() === productId);

    if (!hasItem) {
      return next(createError('Product not found in your cart', 404));
    }

    cart.items = cart.items.filter((item) => item.product.toString() !== productId);
    await cart.save();

    res.status(200).json({
      success: true,
      message: 'Product removed from cart',
      data: await buildCartResponse(cart),
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/cart
const clearCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });

    if (cart) {
      cart.items = [];
      await cart.save();
    }

    res.status(200).json({
      success: true,
      message: 'Cart cleared successfully',
      data: { user: req.user._id, items: [], totalItems: 0, totalAmount: 0 },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getCart, addItem, updateItem, removeItem, clearCart };
