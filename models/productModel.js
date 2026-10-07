const mongoose = require('mongoose');

const CATEGORIES = ['electronics', 'clothing', 'food', 'books', 'other'];

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      minlength: [2, 'Product name must be at least 2 characters'],
      maxlength: [100, 'Product name cannot be more than 100 characters'],
    },
    description: {
      type: String,
      required: [true, 'Product description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters'],
      maxlength: [2000, 'Description cannot be more than 2000 characters'],
    },
    price: {
      type: Number,
      required: [true, 'Product price is required'],
      min: [0, 'Price cannot be negative'],
    },
    category: {
      type: String,
      required: [true, 'Product category is required'],
      enum: {
        values: CATEGORIES,
        message: `Category must be one of: ${CATEGORIES.join(', ')}`,
      },
      lowercase: true,
    },
    brand: {
      type: String,
      trim: true,
      maxlength: [50, 'Brand cannot be more than 50 characters'],
      default: '',
    },
    images: {
      type: [String], // image URLs
      default: [],
    },
    stock: {
      type: Number,
      required: [true, 'Product stock is required'],
      min: [0, 'Stock cannot be negative'],
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Stock must be a whole number',
      },
    },
    // Filled automatically by the review module. Clients cannot set it.
    ratings: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0, min: 0 },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

productSchema.index({ category: 1, price: 1 });
productSchema.index({ createdAt: -1 });

const Product = mongoose.model('Product', productSchema);

// Share the category list with the validator so it is defined only once
Product.CATEGORIES = CATEGORIES;

module.exports = Product;
