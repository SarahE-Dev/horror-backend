const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth');
const auth = require('../middleware/middleware');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/profile', auth, authController.getProfile);

module.exports = router;