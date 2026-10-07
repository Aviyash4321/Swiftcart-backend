const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot be more than 5'],
      validate: {
        validator: Number.isInteger,
        message: 'Rating must be a whole number',
      },
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [1000, 'Comment cannot be more than 1000 characters'],
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// One review per user per product (database-level protection)
reviewSchema.index({ product: 1, user: 1 }, { unique: true });

// Recalculate the product's average rating and review count.
// Called by the review controller after a review is created, updated or deleted.
reviewSchema.statics.updateProductRatings = async function (productId) {
  const stats = await this.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId) } },
    { $group: { _id: '$product', average: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);

  const average = stats.length > 0 ? Math.round(stats[0].average * 10) / 10 : 0;
  const count = stats.length > 0 ? stats[0].count : 0;

  await mongoose.model('Product').findByIdAndUpdate(productId, {
    ratings: { average, count },
  });
};

module.exports = mongoose.model('Review', reviewSchema);
