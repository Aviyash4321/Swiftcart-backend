const mongoose = require('mongoose');

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not defined in the .env file');
  }

  // Log connection problems that happen AFTER the first successful connection
  mongoose.connection.on('error', (error) => {
    console.error(`MongoDB connection error: ${error.message}`);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected');
  });

  const connection = await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000, // give up after 5 seconds instead of hanging
  });

  console.log(`Success: MongoDB Atlas connected successfully`);
  return connection;
};

module.exports = connectDB;
