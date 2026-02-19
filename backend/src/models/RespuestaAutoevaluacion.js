class RespuestaAutoevaluacion {
  constructor({ id, autoevaluacionId, preguntaId, respuesta, puntaje }) {
    this.id = id;
    this.autoevaluacionId = autoevaluacionId;
    this.preguntaId = preguntaId;
    this.respuesta = respuesta;
    this.puntaje = puntaje;
  }
}

module.exports = RespuestaAutoevaluacion;
