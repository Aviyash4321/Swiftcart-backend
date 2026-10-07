const express = require('express');
const { getUsers, getUserById, updateUser, deleteUser } = require('../controllers/userController');
const { protect, authorize } = require('../middlewares/authMiddleware');
const { validateObjectId, validateUpdateUser } = require('../middlewares/validateRequest');

const router = express.Router();

// All user management routes are admin only
router.use(protect, authorize('admin'));

router.get('/', getUsers);
router.get('/:id', validateObjectId('id'), getUserById);
router.put('/:id', validateObjectId('id'), validateUpdateUser, updateUser);
router.delete('/:id', validateObjectId('id'), deleteUser);

module.exports = router;
