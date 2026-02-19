document.addEventListener('DOMContentLoaded', () => {
  const steps = [
    {
      numero: 1,
      titulo: 'Ingreso a la Comunidad Oficial',
      descripcion:
        'Únete al grupo oficial de WhatsApp SANILAB para iniciar tu integración y recibir todas las comunicaciones importantes.'
    },
    {
      numero: 2,
      titulo: 'Integración a Grupos de Trabajo',
      descripcion:
        'Súmate al grupo SANILAB - GENERAL y al grupo de WhatsApp específico de tu área (GTH, Gerencia, Proyectos, Medio Ambiente, Marketing, etc.).'
    },
    {
      numero: 3,
      titulo: 'Activación de Correo',
      descripcion:
        'Activa tu correo institucional de SANILAB siguiendo el manual de configuración, evitando problemas por límite de cuentas Gmail.'
    },
    {
      numero: 4,
      titulo: 'Presentación en SANILAB GENERAL',
      descripcion:
        'Preséntate en el grupo SANILAB - GENERAL indicando nombres, área, líder, compañeros, correos adicionales, fecha de inicio y horarios detallados.'
    },
    {
      numero: 5,
      titulo: 'Capacitación y Recursos de Bienvenida',
      descripcion:
        'Revisa el video de inducción, la presentación PPT y los manuales de herramientas como Tactiq y Google Calendar antes de empezar.'
    },
    {
      numero: 6,
      titulo: 'Manuales Específicos por Área',
      descripcion:
        'Lee los manuales del área que te corresponde (GTH, Gerencia, Infraestructura, Talleres, Proyectos, Marketing, Comercial, Medio Ambiente, etc.).'
    },
    {
      numero: 7,
      titulo: 'Cultura y Sostenibilidad',
      descripcion:
        'Explora los artículos sobre innovación social, soluciones urbanas, calidad de vida y medio ambiente para conocer mejor los proyectos de SANILAB.'
    },
    {
      numero: 8,
      titulo: 'Reglamento y Carta de Compromiso',
      descripcion:
        'Revisa el reglamento interno, el protocolo de reuniones y completa/adjunta tu Carta de Compromiso usando el formulario en sanilabperu.com/pasos-para-los-nuevos-integrantes.'
    },
    {
      numero: 9,
      titulo: 'Evaluación Final de Onboarding',
      descripcion:
        'Realiza el examen de onboarding para validar tu ingreso y cerrar oficialmente tu proceso de integración a SANILAB.'
    }
  ];

  const cont = document.getElementById('onboarding-steps');
  if (!cont) return;

  steps.forEach(step => {
    const card = document.createElement('div');
    card.className = 'onboarding-card';
    card.innerHTML = `
      <div class="onboarding-card__header">
        <div class="onboarding-card__badge">${step.numero}</div>
        <div class="onboarding-card__title">${step.titulo}</div>
      </div>
      <div class="onboarding-card__description">
        ${step.descripcion}
      </div>
    `;
    cont.appendChild(card);
  });
});
