// Run manually:
//   npm run seed           -> deletes ALL existing data, then inserts sample data
//   npm run seed:destroy   -> deletes ALL data only
require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('./config/db.mongo');
const User = require('./models/userModel');
const Product = require('./models/productModel');
const Cart = require('./models/cartModel');
const Order = require('./models/orderModel');
const Review = require('./models/reviewModel');

const destroyData = async () => {
  await Review.deleteMany({});
  await Order.deleteMany({});
  await Cart.deleteMany({});
  await Product.deleteMany({});
  await User.deleteMany({});
  console.log('All data deleted');
};

const importData = async () => {
  await destroyData();

  // create() is used (not insertMany) so the password-hashing hook runs
  const admin = await User.create({ name: 'Admin User', email: 'admin@example.com', password: 'Admin123', role: 'admin' });
  const moderator = await User.create({ name: 'Moderator User', email: 'mod@example.com', password: 'Moderator123', role: 'moderator' });
  await User.create({ name: 'Normal User', email: 'user@example.com', password: 'User1234', role: 'user' });

  const products = [
    { name: 'Wireless Headphones', description: 'Bluetooth over-ear headphones with noise cancellation', price: 2999, category: 'electronics', brand: 'SoundMax', stock: 25 },
    { name: 'Smartphone X10', description: '6.5 inch display smartphone with 128GB storage', price: 18999, category: 'electronics', brand: 'TechNova', stock: 15 },
    { name: 'Cotton T-Shirt', description: 'Soft 100% cotton round neck t-shirt for daily wear', price: 499, category: 'clothing', brand: 'UrbanWear', stock: 100 },
    { name: 'Denim Jacket', description: 'Classic blue denim jacket with a regular fit', price: 1899, category: 'clothing', brand: 'UrbanWear', stock: 40 },
    { name: 'Organic Green Tea', description: 'Pack of 100 organic green tea bags, naturally refreshing', price: 350, category: 'food', brand: 'LeafPure', stock: 60 },
    { name: 'JavaScript Basics', description: 'A beginner friendly book to learn JavaScript step by step', price: 650, category: 'books', brand: 'CodePress', stock: 30 },
    { name: 'Node.js in Practice', description: 'Build real REST APIs with Node.js, Express and MongoDB', price: 899, category: 'books', brand: 'CodePress', stock: 20 },
    { name: 'Desk Organizer', description: 'Wooden desk organizer with multiple compartments', price: 749, category: 'other', brand: 'HomeNest', stock: 35 },
  ].map((product, index) => ({ ...product, createdBy: index % 2 === 0 ? admin._id : moderator._id }));

  await Product.insertMany(products);

  console.log('Sample data inserted');
  console.log('  admin@example.com  / Admin123      (admin)');
  console.log('  mod@example.com    / Moderator123  (moderator)');
  console.log('  user@example.com   / User1234      (user)');
};

const run = async () => {
  if (process.env.NODE_ENV === 'production') {
    console.error('Seeder is disabled when NODE_ENV=production');
    process.exit(1);
  }

  try {
    await connectDB();

    if (process.argv.includes('--destroy')) {
      await destroyData();
    } else {
      await importData();
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error(`Seeder failed: ${error.message}`);
    process.exit(1);
  }
};

run();
