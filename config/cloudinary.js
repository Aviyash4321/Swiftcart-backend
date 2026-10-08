const { v2: cloudinary } = require('cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const isCloudinaryConfigured = () =>
  Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );

// Upload an image held in memory (req.file.buffer) to Cloudinary.
// Returns { url, publicId }.
const uploadImage = (buffer, { folder, transformation }) => {
  if (!isCloudinaryConfigured()) {
    const error = new Error('Image uploads are not configured on the server');
    error.statusCode = 503;
    return Promise.reject(error);
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image', transformation },
      (error, result) => {
        if (error) {
          const uploadError = new Error('Image upload failed. Please try again');
          uploadError.statusCode = 502;
          console.error('Cloudinary upload error:', error.message);
          return reject(uploadError);
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
};

// Delete an image from Cloudinary. It never throws: a failed cleanup must not break the request.
const deleteImage = async (publicId) => {
  if (!publicId || !isCloudinaryConfigured()) return;

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  } catch (error) {
    console.error(`Could not delete image ${publicId}: ${error.message}`);
  }
};

// Image sizes and folders used by the app
const productImageOptions = {
  folder: 'ecommerce/products',
  transformation: [{ width: 1200, height: 1200, crop: 'limit' }, { quality: 'auto', fetch_format: 'auto' }],
};

const profileImageOptions = {
  folder: 'ecommerce/profiles',
  transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'auto' }, { quality: 'auto', fetch_format: 'auto' }],
};

module.exports = {
  cloudinary,
  isCloudinaryConfigured,
  uploadImage,
  deleteImage,
  productImageOptions,
  profileImageOptions,
};
