document.addEventListener('DOMContentLoaded', () => {
  const steps = [
    {
      numero: 1,
      titulo: 'Ingreso a la Comunidad Oficial',
      descripcion: 'Únete al grupo oficial de WhatsApp SANILAB para iniciar tu integración y recibir todas las comunicaciones importantes.',
      url: 'https://chat.whatsapp.com/BjeXyueHRXE22tE5RFxBlp'
    },
    {
      numero: 2,
      titulo: 'Integración a Grupos de Trabajo',
      descripcion: 'Súmate al grupo SANILAB - GENERAL y al grupo de WhatsApp específico de tu área (GTH, Gerencia, Proyectos, Medio Ambiente, Marketing, etc.).',
      url: 'https://chat.whatsapp.com/FpHkGyZQ6R8B7aPsiSNqKw'
    },
    {
      numero: 3,
      titulo: 'Activación de Correo',
      descripcion: 'Activa tu correo institucional de SANILAB siguiendo el manual de configuración, evitando problemas por límite de cuentas Gmail.',
      url: 'https://docs.google.com/document/d/1lQOGkURyIVj7xXRciafzSFyf4j7w2OcM/edit?usp=sharing'
    },
    {
      numero: 4,
      titulo: 'Presentación en SANILAB GENERAL',
      descripcion: 'Preséntate en el grupo SANILAB - GENERAL indicando nombres, área, líder, compañeros, correos adicionales, fecha de inicio y horarios detallados.',
      url: 'https://chat.whatsapp.com/FpHkGyZQ6R8B7aPsiSNqKw'
    },
    {
      numero: 5,
      titulo: 'Capacitación y Recursos de Bienvenida',
      descripcion: 'Revisa el video de inducción, la presentación PPT y los manuales de herramientas como Tactiq y Google Calendar antes de empezar. Luego completa el formulario de verificación.',
      multipleUrls: [
        { nombre: '📁 Videos de Inducción', url: 'https://drive.google.com/drive/folders/1nifpMZN0VvbHHQ1bkhNCjDt5lx0ZuOOU' },
        { nombre: '📊 PPT de Inducción', url: 'https://docs.google.com/presentation/d/1rQdkJ1tKiic3Qj8Hwvj5vIcfAhnSi4pM/edit?slide=id.p1' },
        { nombre: '📝 Formulario de Verificación', url: 'https://forms.gle/MiGUst382HLo4FQm6' },
        { nombre: '📖 Manual para usar Tactiq', url: 'https://docs.google.com/document/d/11lVhpRn-B0WTHoome5nLQI_DgupWRQulVE4xEpy4fkg/edit?tab=t.0' },
        { nombre: '🎥 Video Guía: Google Calendar', url: 'https://www.youtube.com/watch?v=77FT2QpVRGM' }
      ]
    },
    {
      numero: 6,
      titulo: 'Manuales Específicos por Área',
      descripcion: 'Lee los manuales del área que te corresponde (GTH, Gerencia, Infraestructura, Talleres, Proyectos, Marketing, Comercial, Medio Ambiente, etc.).',
      url: ''
    },
    {
      numero: 7,
      titulo: 'Cultura y Sostenibilidad',
      descripcion: 'Explora los artículos sobre innovación social, soluciones urbanas, calidad de vida y medio ambiente para conocer mejor los proyectos de SANILAB.',
      url: ''
    },
    {
      numero: 8,
      titulo: 'Reglamento y Carta de Compromiso',
      descripcion: 'Revisa el reglamento interno, el protocolo de reuniones y completa/adjunta tu Carta de Compromiso usando el formulario en sanilabperu.com/pasos-para-los-nuevos-integrantes.',
      url: 'https://sanilabperu.com/pasos-para-los-nuevos-integrantes'
    },
    {
      numero: 9,
      titulo: 'Evaluación Final de Onboarding',
      descripcion: 'Realiza el examen de onboarding para validar tu ingreso y cerrar oficialmente tu proceso de integración a SANILAB.',
      url: ''
    }
  ];

  const cont = document.getElementById('onboarding-steps');
  if (!cont) return;

  // Función para mostrar modal con opciones múltiples (solo paso 5)
  function showMultipleUrlsModal(step) {
    const buttons = step.multipleUrls.map(item => 
      `<button class="modal-btn" data-url="${item.url}" style="display:block; width:100%; margin:8px 0; padding:12px; background:#007bff; color:white; border:none; border-radius:8px; cursor:pointer; font-size:16px;">${item.nombre}</button>`
    ).join('');
    
    const modalHtml = `
      <div id="modal-overlay" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; z-index:9999;">
        <div style="background:white; border-radius:16px; padding:24px; max-width:400px; width:90%; text-align:center;">
          <h3 style="margin-top:0;">${step.titulo}</h3>
          <p>Selecciona el recurso que deseas abrir:</p>
          <div style="margin:20px 0;">
            ${buttons}
          </div>
          <button id="modal-cerrar" style="background:#6c757d; border:none; padding:8px 16px; border-radius:8px; cursor:pointer; color:white;">Cerrar</button>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    document.querySelectorAll('.modal-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const url = btn.getAttribute('data-url');
        window.open(url, '_blank');
      });
    });
    
    document.getElementById('modal-cerrar').addEventListener('click', () => {
      document.getElementById('modal-overlay').remove();
    });
    
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'modal-overlay') {
        document.getElementById('modal-overlay').remove();
      }
    });
  }

  steps.forEach(step => {
    const card = document.createElement('div');
    card.className = 'onboarding-card';
    card.style.cursor = 'pointer';
    
    card.innerHTML = `
      <div class="onboarding-card__header">
        <div class="onboarding-card__badge">${step.numero}</div>
        <div class="onboarding-card__title">${step.titulo}</div>
      </div>
      <div class="onboarding-card__description">
        ${step.descripcion}
      </div>
    `;
    
    card.addEventListener('click', () => {
      if (step.multipleUrls && step.multipleUrls.length > 0) {
        showMultipleUrlsModal(step);
      }
      else if (step.url && step.url.trim() !== '') {
        window.open(step.url, '_blank');
      }
      else {
        alert(`⚠️ El paso ${step.numero} aún no tiene un enlace configurado.\n\n📌 Por favor, contacta al equipo de GTH para obtenerlo.`);
      }
    });
    
    cont.appendChild(card);
  });
});