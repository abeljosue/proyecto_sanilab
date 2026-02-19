class Ranking {
  constructor({ id, usuarioId, quincena, puntajeTotal, posicion, tieneRubro }) {
    this.id = id;
    this.usuarioId = usuarioId;
    this.quincena = quincena;
    this.puntajeTotal = puntajeTotal;
    this.posicion = posicion;
    this.tieneRubro = tieneRubro;
  }
}

module.exports = Ranking;
