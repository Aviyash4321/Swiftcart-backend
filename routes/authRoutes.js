const express = require('express');
const { register, login, getMe, changePassword, updateProfileImage } = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');
const { validateRegister, validateLogin, validateChangePassword } = require('../middlewares/validateRequest');
const { uploadProfileImage } = require('../middlewares/uploadMiddleware');

const router = express.Router();

router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);
router.get('/me', protect, getMe);
router.put('/change-password', protect, validateChangePassword, changePassword);
router.put('/profile-image', protect, uploadProfileImage, updateProfileImage);

module.exports = router;
