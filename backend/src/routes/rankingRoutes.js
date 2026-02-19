const express = require('express');
const router = express.Router();
const rankingController = require('../controllers/rankingController');
const auth = require('../middlewares/authMiddleware'); 

router.get('/', auth.verifyToken, rankingController.getAllRankings);
router.get('/mi-posicion', auth.verifyToken, rankingController.getMiPosicion);
router.get('/:id', auth.verifyToken, rankingController.getRankingById);
router.post('/actualizar', auth.verifyToken, rankingController.actualizarRankingUsuario);
router.post('/recalcular', auth.verifyToken, rankingController.recalcularRanking);

module.exports = router;
