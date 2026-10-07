const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES = ['user', 'moderator', 'admin'];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name cannot be more than 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [emailPattern, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // not returned by queries unless asked with .select('+password')
    },
    role: {
      type: String,
      enum: {
        values: ROLES,
        message: 'Role must be user, moderator or admin',
      },
      default: 'user',
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt automatically
  }
);

// Hash the password before saving (only when it is new or changed)
userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }
  this.password = await bcrypt.hash(this.password, 10);
});

// Compare a plain text password with the stored hash
userSchema.methods.comparePassword = async function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

// Never include the password hash in JSON responses
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

const User = mongoose.model('User', userSchema);

// Share the role list with the validator so it is defined only once
User.ROLES = ROLES;

module.exports = User;
