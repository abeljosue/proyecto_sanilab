const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/login', authController.login);
router.post('/registro', authController.registro);
router.post('/cambiar-password', authController.cambiarPassword);

module.exports = router;
