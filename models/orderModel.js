const mongoose = require('mongoose');

const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'];
// Mock payment only. No real payment gateway is connected.
const PAYMENT_METHODS = ['mock_card', 'cash_on_delivery'];

// A copy of the product data at the time of purchase (name and price can change later)
const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: [0, 'Price cannot be negative'] },
    quantity: { type: Number, required: true, min: [1, 'Quantity must be at least 1'] },
  },
  { _id: false }
);

const shippingAddressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: [true, 'Full name is required'], trim: true },
    phone: { type: String, required: [true, 'Phone is required'], trim: true },
    street: { type: String, required: [true, 'Street is required'], trim: true },
    city: { type: String, required: [true, 'City is required'], trim: true },
    state: { type: String, trim: true, default: '' },
    postalCode: { type: String, required: [true, 'Postal code is required'], trim: true },
    country: { type: String, required: [true, 'Country is required'], trim: true },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: {
      type: [orderItemSchema],
      validate: {
        validator: (items) => items.length > 0,
        message: 'An order must contain at least one item',
      },
    },
    totalAmount: { type: Number, required: true, min: [0, 'Total amount cannot be negative'] },
    shippingAddress: { type: shippingAddressSchema, required: true },
    paymentMethod: {
      type: String,
      enum: { values: PAYMENT_METHODS, message: `Payment method must be one of: ${PAYMENT_METHODS.join(', ')}` },
      default: 'mock_card',
    },
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: 'pending',
    },
    orderStatus: {
      type: String,
      enum: ORDER_STATUSES,
      default: 'pending',
    },
  },
  {
    timestamps: true,
  }
);

orderSchema.index({ user: 1, createdAt: -1 });

const Order = mongoose.model('Order', orderSchema);

Order.ORDER_STATUSES = ORDER_STATUSES;
Order.PAYMENT_STATUSES = PAYMENT_STATUSES;
Order.PAYMENT_METHODS = PAYMENT_METHODS;

module.exports = Order;
