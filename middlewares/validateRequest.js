const Product = require('../models/productModel');
const User = require('../models/userModel');
const Order = require('../models/orderModel');

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const objectIdPattern = /^[0-9a-fA-F]{24}$/;
const phonePattern = /^[0-9+\-\s]{7,15}$/;

// Helper: send a 400 error to the central error handler
const sendValidationError = (next, message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return next(error);
};

const isPositiveInteger = (value) => Number.isInteger(value) && value > 0;
const isObjectId = (value) => typeof value === 'string' && objectIdPattern.test(value);
const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

// ---------- Auth validators ----------

const validateRegister = (req, res, next) => {
  const { name, email, password } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return sendValidationError(next, 'Name is required and must be at least 2 characters');
  }

  if (!email || typeof email !== 'string' || !emailPattern.test(email.trim())) {
    return sendValidationError(next, 'A valid email address is required');
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    return sendValidationError(next, 'Password is required and must be at least 6 characters');
  }

  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return sendValidationError(next, 'Password must contain at least one letter and one number');
  }

  req.body.name = name.trim();
  req.body.email = email.trim().toLowerCase();

  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;

  if (!email || typeof email !== 'string' || !emailPattern.test(email.trim())) {
    return sendValidationError(next, 'A valid email address is required');
  }

  if (!password || typeof password !== 'string') {
    return sendValidationError(next, 'Password is required');
  }

  req.body.email = email.trim().toLowerCase();

  next();
};

// ---------- ObjectId validator ----------

// Usage: router.get('/:id', validateObjectId('id'), handler)
const validateObjectId = (paramName = 'id') => {
  return (req, res, next) => {
    const value = req.params[paramName];

    if (!objectIdPattern.test(value)) {
      return sendValidationError(next, `Invalid ${paramName}: "${value}" is not a valid ID`);
    }

    next();
  };
};

// ---------- User validator (admin updates a user) ----------

const validateUpdateUser = (req, res, next) => {
  const { name, email, role, password } = req.body;

  if (name === undefined && email === undefined && role === undefined && password === undefined) {
    return sendValidationError(next, 'Send at least one field to update: name, email, role, password');
  }

  if (name !== undefined && (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 50)) {
    return sendValidationError(next, 'Name must be a string between 2 and 50 characters');
  }

  if (email !== undefined && (typeof email !== 'string' || !emailPattern.test(email.trim()))) {
    return sendValidationError(next, 'A valid email address is required');
  }

  if (role !== undefined && !User.ROLES.includes(role)) {
    return sendValidationError(next, `Role must be one of: ${User.ROLES.join(', ')}`);
  }

  if (password !== undefined) {
    if (typeof password !== 'string' || password.length < 6) {
      return sendValidationError(next, 'Password must be at least 6 characters');
    }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      return sendValidationError(next, 'Password must contain at least one letter and one number');
    }
  }

  next();
};

// ---------- Product validators ----------

// Checks the product fields that are present in the body.
// Returns an error message string, or null when everything is valid.
const checkProductFields = (body) => {
  const { name, description, price, category, brand, images, stock } = body;

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
      return 'Product name must be a string between 2 and 100 characters';
    }
  }

  if (description !== undefined) {
    if (typeof description !== 'string' || description.trim().length < 10 || description.trim().length > 2000) {
      return 'Description must be a string between 10 and 2000 characters';
    }
  }

  if (price !== undefined) {
    if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) {
      return 'Price must be a number that is zero or greater';
    }
  }

  if (category !== undefined) {
    if (typeof category !== 'string' || !Product.CATEGORIES.includes(category.toLowerCase())) {
      return `Category must be one of: ${Product.CATEGORIES.join(', ')}`;
    }
  }

  if (brand !== undefined) {
    if (typeof brand !== 'string' || brand.length > 50) {
      return 'Brand must be a string of at most 50 characters';
    }
  }

  if (images !== undefined) {
    if (!Array.isArray(images) || images.some((image) => typeof image !== 'string')) {
      return 'Images must be an array of image URL strings';
    }
  }

  if (stock !== undefined) {
    if (typeof stock !== 'number' || !Number.isInteger(stock) || stock < 0) {
      return 'Stock must be a whole number that is zero or greater';
    }
  }

  return null;
};

// POST /api/products: required fields must exist
const validateCreateProduct = (req, res, next) => {
  const { name, description, price, category } = req.body;

  if (name === undefined || description === undefined || price === undefined || category === undefined) {
    return sendValidationError(next, 'name, description, price and category are required');
  }

  const message = checkProductFields(req.body);
  if (message) {
    return sendValidationError(next, message);
  }

  next();
};

// PUT /api/products/:id: all fields optional, but at least one must be sent
const validateUpdateProduct = (req, res, next) => {
  const updatableFields = ['name', 'description', 'price', 'category', 'brand', 'images', 'stock'];
  const hasAtLeastOneField = updatableFields.some((field) => req.body[field] !== undefined);

  if (!hasAtLeastOneField) {
    return sendValidationError(next, `Send at least one field to update: ${updatableFields.join(', ')}`);
  }

  const message = checkProductFields(req.body);
  if (message) {
    return sendValidationError(next, message);
  }

  next();
};

// ---------- Cart validators ----------

// POST /api/cart/items  { productId, quantity }
const validateCartItem = (req, res, next) => {
  const { productId, quantity } = req.body;

  if (!isObjectId(productId)) {
    return sendValidationError(next, 'productId is required and must be a valid ID');
  }

  if (!isPositiveInteger(quantity)) {
    return sendValidationError(next, 'Quantity must be a whole number greater than zero');
  }

  next();
};

// PUT /api/cart/items/:productId  { quantity }
const validateQuantity = (req, res, next) => {
  if (!isPositiveInteger(req.body.quantity)) {
    return sendValidationError(next, 'Quantity must be a whole number greater than zero');
  }

  next();
};

// ---------- Order validators ----------

// POST /api/orders
// Body: { shippingAddress: {...}, paymentMethod?, items?: [{ productId, quantity }] }
// If items is not sent, the order is created from the user's cart.
const validateCreateOrder = (req, res, next) => {
  const { shippingAddress, paymentMethod, items } = req.body;

  if (!isPlainObject(shippingAddress)) {
    return sendValidationError(next, 'shippingAddress is required');
  }

  const requiredFields = ['fullName', 'phone', 'street', 'city', 'postalCode', 'country'];
  const cleanAddress = {};

  for (const field of requiredFields) {
    const value = shippingAddress[field];
    if (typeof value !== 'string' || value.trim() === '') {
      return sendValidationError(next, `shippingAddress.${field} is required`);
    }
    cleanAddress[field] = value.trim();
  }

  if (!phonePattern.test(cleanAddress.phone)) {
    return sendValidationError(next, 'shippingAddress.phone must be a valid phone number');
  }

  if (shippingAddress.state !== undefined) {
    if (typeof shippingAddress.state !== 'string') {
      return sendValidationError(next, 'shippingAddress.state must be a string');
    }
    cleanAddress.state = shippingAddress.state.trim();
  }

  if (paymentMethod !== undefined && !Order.PAYMENT_METHODS.includes(paymentMethod)) {
    return sendValidationError(next, `paymentMethod must be one of: ${Order.PAYMENT_METHODS.join(', ')}`);
  }

  if (items !== undefined) {
    if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
      return sendValidationError(next, 'items must be a non-empty array (maximum 50 items)');
    }

    for (const item of items) {
      if (!isPlainObject(item) || !isObjectId(item.productId)) {
        return sendValidationError(next, 'Each item needs a valid productId');
      }
      if (!isPositiveInteger(item.quantity)) {
        return sendValidationError(next, 'Each item quantity must be a whole number greater than zero');
      }
    }
  }

  req.body.shippingAddress = cleanAddress;

  next();
};

// PUT /api/orders/:id/status  { orderStatus?, paymentStatus? }
const validateOrderStatus = (req, res, next) => {
  const { orderStatus, paymentStatus } = req.body;

  if (orderStatus === undefined && paymentStatus === undefined) {
    return sendValidationError(next, 'Send orderStatus and/or paymentStatus');
  }

  if (orderStatus !== undefined && !Order.ORDER_STATUSES.includes(orderStatus)) {
    return sendValidationError(next, `orderStatus must be one of: ${Order.ORDER_STATUSES.join(', ')}`);
  }

  if (paymentStatus !== undefined && !Order.PAYMENT_STATUSES.includes(paymentStatus)) {
    return sendValidationError(next, `paymentStatus must be one of: ${Order.PAYMENT_STATUSES.join(', ')}`);
  }

  next();
};

// ---------- Review validators ----------

const checkReviewFields = (body) => {
  const { rating, comment } = body;

  if (rating !== undefined) {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return 'Rating must be a whole number between 1 and 5';
    }
  }

  if (comment !== undefined) {
    if (typeof comment !== 'string' || comment.length > 1000) {
      return 'Comment must be a string of at most 1000 characters';
    }
  }

  return null;
};

// POST /api/products/:productId/reviews
const validateCreateReview = (req, res, next) => {
  if (req.body.rating === undefined) {
    return sendValidationError(next, 'Rating is required');
  }

  const message = checkReviewFields(req.body);
  if (message) {
    return sendValidationError(next, message);
  }

  next();
};

// PUT /api/products/:productId/reviews/:reviewId
const validateUpdateReview = (req, res, next) => {
  if (req.body.rating === undefined && req.body.comment === undefined) {
    return sendValidationError(next, 'Send at least one field to update: rating, comment');
  }

  const message = checkReviewFields(req.body);
  if (message) {
    return sendValidationError(next, message);
  }

  next();
};

module.exports = {
  validateRegister,
  validateLogin,
  validateObjectId,
  validateUpdateUser,
  validateCreateProduct,
  validateUpdateProduct,
  validateCartItem,
  validateQuantity,
  validateCreateOrder,
  validateOrderStatus,
  validateCreateReview,
  validateUpdateReview,
};
