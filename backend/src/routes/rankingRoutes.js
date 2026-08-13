const express = require('express');
const router = express.Router();
const rankingController = require('../controllers/rankingController');
const auth = require('../middlewares/authMiddleware'); 

// OJO CON EL ORDEN: todas las rutas de texto fijo van ANTES que '/:id'.
// Express casa por orden de declaracion, asi que '/retos' declarado despues
// entraba por '/:id' con id="retos", findById reventaba con un CastError y el
// endpoint devolvia siempre un 500. Estuvo roto desde que se añadio.
router.get('/', auth.verifyToken, rankingController.getAllRankings);
router.get('/mi-posicion', auth.verifyToken, rankingController.getMiPosicion);
router.get('/retos', auth.verifyToken, rankingController.getRetosUsuario);
router.get('/:id', auth.verifyToken, rankingController.getRankingById);

router.post('/actualizar', auth.verifyToken, rankingController.actualizarRankingUsuario);
router.post('/recalcular', auth.verifyToken, rankingController.recalcularRanking);

module.exports = router;