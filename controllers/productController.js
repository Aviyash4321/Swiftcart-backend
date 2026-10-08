const Product = require('../models/productModel');
const Review = require('../models/reviewModel');
const { uploadImage, deleteImage, productImageOptions } = require('../config/cloudinary');

// Fields a client is allowed to send when creating or updating a product
const allowedFields = ['name', 'description', 'price', 'category', 'brand', 'images', 'stock'];

// Allowed values for ?sort=
const sortOptions = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  name: { name: 1 },
};

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// Copy only the allowed fields from the request body
const pickAllowedFields = (body) => {
  const data = {};
  allowedFields.forEach((field) => {
    if (body[field] !== undefined) {
      data[field] = body[field];
    }
  });
  return data;
};

// Make user search text safe to use inside a regular expression
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/products
// Query: search, category, minPrice, maxPrice, sort, page, limit
const getProducts = async (req, res, next) => {
  try {
    const { search, category, minPrice, maxPrice, sort } = req.query;
    const filter = {};

    // Search in name, description and brand (case-insensitive)
    if (search !== undefined) {
      if (typeof search !== 'string') {
        return next(createError('search must be a single text value', 400));
      }
      if (search.trim()) {
        const pattern = new RegExp(escapeRegex(search.trim()), 'i');
        filter.$or = [{ name: pattern }, { description: pattern }, { brand: pattern }];
      }
    }

    // Filter by category
    if (category !== undefined) {
      if (typeof category !== 'string' || !Product.CATEGORIES.includes(category.toLowerCase())) {
        return next(createError(`category must be one of: ${Product.CATEGORIES.join(', ')}`, 400));
      }
      filter.category = category.toLowerCase();
    }

    // Filter by price range
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};

      if (minPrice !== undefined) {
        const min = Number(minPrice);
        if (Number.isNaN(min) || min < 0) {
          return next(createError('minPrice must be a number that is zero or greater', 400));
        }
        filter.price.$gte = min;
      }

      if (maxPrice !== undefined) {
        const max = Number(maxPrice);
        if (Number.isNaN(max) || max < 0) {
          return next(createError('maxPrice must be a number that is zero or greater', 400));
        }
        filter.price.$lte = max;
      }

      if (filter.price.$gte !== undefined && filter.price.$lte !== undefined && filter.price.$gte > filter.price.$lte) {
        return next(createError('minPrice cannot be greater than maxPrice', 400));
      }
    }

    // Sorting
    let sortBy = sortOptions.newest;
    if (sort !== undefined) {
      if (!sortOptions[sort]) {
        return next(createError(`sort must be one of: ${Object.keys(sortOptions).join(', ')}`, 400));
      }
      sortBy = sortOptions[sort];
    }

    // Pagination (limit is capped at 100)
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const skip = (page - 1) * limit;

    const total = await Product.countDocuments(filter);
    const products = await Product.find(filter).sort(sortBy).skip(skip).limit(limit);

    res.status(200).json({
      success: true,
      message: 'Products fetched successfully',
      data: products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/products/:id
const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).populate('createdBy', 'name email');

    if (!product) {
      return next(createError('Product not found', 404));
    }

    res.status(200).json({
      success: true,
      message: 'Product fetched successfully',
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/products  (moderator, admin)
const createProduct = async (req, res, next) => {
  try {
    const data = pickAllowedFields(req.body);
    data.createdBy = req.user._id;

    // Optional image (multipart form field "image"). It becomes the main image.
    let uploaded = null;
    if (req.file) {
      uploaded = await uploadImage(req.file.buffer, productImageOptions);
      data.images = [uploaded.url];
      data.imagePublicId = uploaded.publicId;
    }

    let product;
    try {
      product = await Product.create(data);
    } catch (error) {
      if (uploaded) await deleteImage(uploaded.publicId); // do not leave an unused file behind
      throw error;
    }

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/products/:id  (moderator, admin)
// Also used for stock management: send { "stock": 50 }
const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return next(createError('Product not found', 404));
    }

    // Apply the changes, then save() so Mongoose validation runs again
    Object.assign(product, pickAllowedFields(req.body));

    // A new image replaces the old main image (and the old file is deleted afterwards)
    const oldPublicId = product.imagePublicId;
    let uploaded = null;

    if (req.file) {
      uploaded = await uploadImage(req.file.buffer, productImageOptions);
      product.images = [uploaded.url];
      product.imagePublicId = uploaded.publicId;
    }

    try {
      await product.save();
    } catch (error) {
      if (uploaded) await deleteImage(uploaded.publicId);
      throw error;
    }

    if (uploaded) await deleteImage(oldPublicId);

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/products/:id  (admin only)
const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return next(createError('Product not found', 404));
    }

    await product.deleteOne();
    await Review.deleteMany({ product: product._id }); // remove the product's reviews too
    await deleteImage(product.imagePublicId); // and its image file

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
      data: { _id: product._id },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};
