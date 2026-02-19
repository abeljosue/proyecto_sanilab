const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const { verifyToken } = require('../middlewares/authMiddleware');

router.use(verifyToken);

router.post('/chatbot', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Mensaje vacío' });
    }

    // ✅ MODO GRATUITO / SIN CONFIGURACIÓN
    // Si no hay API KEY o es el valor placeholder, devolvemos una respuesta simulada
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes('no_openai_key') || process.env.OPENAI_API_KEY.includes('tu_api_key')) {
      return res.json({
        answer: "⚠️ **Modo Demo (Sin OpenAI)**\n\nEl chatbot no está configurado con una API Key real. Para activarlo, configura `OPENAI_API_KEY` en el archivo `.env`.\n\nPor ahora, soy un robot simple. 🤖",
        action: null
      });
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Eres el asistente del sistema web "Checklist" de Sanilab. ' +
            'Además de responder en texto, debes detectar si el usuario quiere realizar una acción ' +
            '(registrar asistencia, ver autoevaluaciones, abrir página de autoevaluación, etc.). ' +
            'Cuando detectes una acción, devuelve AL FINAL de tu respuesta una línea JSON clara ' +
            'con la forma: ACTION: {"tipo":"...","datos":{...}}. ' +
            'Tipos posibles: "registrar_asistencia", "abrir_autoevaluacion", "ver_autoevaluaciones".'
        },
        { role: 'user', content: message },
      ],
    });

    const raw = completion.choices[0].message.content || '';
    let answer = raw;
    let action = null;

    const match = raw.match(/ACTION:\s*(\{.*\})/s);
    if (match) {
      try {
        action = JSON.parse(match[1]);
        answer = raw.replace(match[0], '').trim();
      } catch (e) {
        console.error('Error parsing ACTION JSON', e);
      }
    }

    res.json({ answer, action });
  } catch (err) {
    console.error('Error en chatbot:', err);
    // No devolvemos error 500 para no romper el frontend, sino un mensaje amigable
    res.json({
      answer: "❌ Hubo un error al conectar con la inteligencia artificial. Por favor verifica los logs del servidor.",
      action: null
    });
  }
});

module.exports = router;
