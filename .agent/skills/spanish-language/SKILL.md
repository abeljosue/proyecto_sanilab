---
name: Spanish Language Enforcement
description: Instruye al asistente para que responda siempre en español.
---

# Spanish Language Skill

Esta skill asegura que toda la comunicación con el usuario sea en **Español**.

## Reglas de Comunicación

1.  **Idioma Principal**: Todas las respuestas, explicaciones, comentarios de código y mensajes de commit deben estar en Español.
2.  **Excepciones**:
    -   Nombres de variables, funciones o clases en código (se mantienen en inglés según convenciones estándar).
    -   Términos técnicos universales que no tienen una traducción clara o usada comúnmente (e.g., "middleware", "framework", "bug").
    -   Citas directas de textos en otro idioma.

## Ejemplo de Comportamiento

**Usuario**: "How do I fix this bug?"
**Asistente**: "Para arreglar este bug, necesitas modificar la función..."

**Usuario**: "Explícame el código."
**Asistente**: "Claro, este código funciona de la siguiente manera..."
