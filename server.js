require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const connectDB = require('./config/db.mongo');
const { isCloudinaryConfigured } = require('./config/cloudinary');
const { apiLimiter } = require('./middlewares/rateLimiter');
const { notFound, errorHandler } = require('./middlewares/errorHandler');

const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');

// Stop immediately if required configuration is missing
const requiredEnvVariables = ['MONGO_URI', 'JWT_SECRET'];
const missingVariables = requiredEnvVariables.filter((name) => !process.env[name]);

if (missingVariables.length > 0) {
    console.error(`Missing required environment variables: ${missingVariables.join(', ')}`);
    process.exit(1);
}

// Image uploads need Cloudinary. The rest of the API works without it, so only warn.
if (!isCloudinaryConfigured()) {
    console.warn('Cloudinary is not configured: image uploads will return 503 until CLOUDINARY_* variables are set');
}

const app = express();

// Security and logging middleware
app.use(helmet());
app.use(cors({
    origin: [
        "https://swiftcart-fromtend.vercel.app",
        "http://localhost:5173"
    ],
    credentials: true
}));
if (process.env.NODE_ENV !== 'test') {
    app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting for all /api routes
app.use('/api', apiLimiter);

// Routes (review routes are mounted inside productRoutes as /api/products/:productId/reviews)
app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);

// 404 handler and global error handler (must be last)
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async() => {
    try {
        await connectDB();

        app.listen(PORT, () => {
            console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
        });
    } catch (error) {
        console.error(`Failed to start server: ${error.message}`);
        process.exit(1); // do not run without a database
    }
};

startServer();