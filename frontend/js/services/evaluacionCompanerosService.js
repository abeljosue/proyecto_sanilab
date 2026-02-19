const API_URL = window.location.origin + '/api';

class EvaluacionCompanerosService {
  constructor() {
    this.baseURL = `${API_URL}/evaluacion-companeros`;
  }

  getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  async puedeEvaluar() {
    try {
      const response = await fetch(`${this.baseURL}/puede-evaluar`, {
        headers: this.getAuthHeaders()
      });
      return await response.json();
    } catch (error) {
      console.error('Error verificando evaluación:', error);
      throw error;
    }
  }

  async obtenerPersonasEvaluables() {
    try {
      const response = await fetch(`${this.baseURL}/personas-evaluables`, {
        headers: this.getAuthHeaders()
      });
      return await response.json();
    } catch (error) {
      console.error('Error obteniendo personas evaluables:', error);
      throw error;
    }
  }

  async crearEvaluacion(evaluacionData) {
    try {
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(evaluacionData)
      });
      return await response.json();
    } catch (error) {
      console.error('Error creando evaluación:', error);
      throw error;
    }
  }

  async obtenerHistorial() {
    try {
      const response = await fetch(`${this.baseURL}/historial`, {
        headers: this.getAuthHeaders()
      });
      return await response.json();
    } catch (error) {
      console.error('Error obteniendo historial:', error);
      throw error;
    }
  }
}

const evaluacionCompanerosService = new EvaluacionCompanerosService();
export default evaluacionCompanerosService;
