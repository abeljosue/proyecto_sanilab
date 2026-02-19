
# 📄 Guía de Configuración de Google Sheets y OpenAI

Para que el sistema funcione al 100% (incluyendo el chatbot y la exportación de datos), necesitas configurar dos servicios externos.

## 1. Configuración de Google Sheets (Para exportar datos)

### Paso 1: Crear un Proyecto en Google Cloud
1.  Ve a [Google Cloud Console](https://console.cloud.google.com/).
2.  Inicia sesión con tu cuenta de Google.
3.  Arriba a la izquierda, haz clic en el selector de proyectos y selecciona **"Nuevo Proyecto"**.
4.  Ponle un nombre (ej: `Sistema-Checklist`) y dale a **Crear**.

### Paso 2: Habilitar la API de Google Sheets
1.  En el menú lateral, ve a **APIs y servicios > Biblioteca**.
2.  Busca **"Google Sheets API"**.
3.  Haz clic en ella y luego en **Habilitar**.

### Paso 3: Crear Credenciales (Service Account)
1.  Ve a **APIs y servicios > Credenciales**.
2.  Arriba, haz clic en **+ CREAR CREDENCIALES** > **Cuenta de servicio**.
3.  Ponle un nombre (ej: `bot-checklist`) y dale a **Crear y continuar**.
4.  En "Rol", selecciona **Propietario** (o Editor) y dale a **Continuar** y luego **Listo**.
5.  En la lista de Cuentas de servicio, haz clic en el lápiz (o el email) de la cuenta que acabas de crear.
6.  Ve a la pestaña **CLAVES**.
7.  Haz clic en **Agregar clave > Crear clave nueva**.
8.  Selecciona **JSON** y dale a **Crear**.
9.  **¡IMPORTANTE!** Se descargará un archivo `.json` a tu computadora.
    *   Renómbralo a: `google-credentials.json`
    *   Muévelo a la carpeta: `c:\Users\LENOVO\Desktop\proyectochecklist\Checklist\backend\` (Reemplaza el archivo *dummy* que puse yo).

### Paso 4: Crear la Hoja de Cálculo y Conectar
1.  Ve a [Google Sheets](https://docs.google.com/spreadsheets) y crea una **hoja nueva**.
2.  Ponle un nombre (ej: `Reportes Sistema`).
3.  Copia el **ID de la hoja** de la URL.
    *   URL ejemplo: `https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKbBdB_.../edit`
    *   El ID es la parte larga entre `/d/` y `/edit`.
    *   En este ejemplo: `1BxiMVs0XRA5nFMdKbBdB_...`
4.  Edita el archivo `.env` en la carpeta principal del proyecto y pon ese ID:
    ```env
    GOOGLE_SHEETS_ID=tú_id_copiado_aquí
    ```
5.  **COMPARTIR**: En tu hoja de Google Sheets, dale al botón **Compartir**.
    *   Copia el "correo electrónico" de tu cuenta de servicio (el que aparece en el archivo JSON o en la consola de google, algo como `bot-checklist@sistema-checklist.iam.gserviceaccount.com`).
    *   Pégalo en "Agregar personas" y dale permisos de **Editor**.
    *   ¡Esto es vital! Si no lo compartes, el sistema no podrá escribir.

---

## 2. Configuración de OpenAI (Para el Chatbot)

1.  Ve a [OpenAI Platform](https://platform.openai.com/).
2.  Inicia sesión o crea una cuenta.
3.  Ve a **API Keys** en el menú lateral.
4.  Haz clic en **+ Create new secret key**.
5.  Copia la clave (empieza con `sk-...`).
6.  Edita el archivo `.env` y pégala:
    ```env
    OPENAI_API_KEY=sk-tu_clave_secreta_aqui
    ```

**Nota:** Necesitas tener créditos en tu cuenta de OpenAI para que esto funcione.

---

## ✅ Resumen de Archivos a Modificar

1.  **`backend/google-credentials.json`**: Reemplazar con el archivo descargado de Google.
2.  **`.env`**: Actualizar con el `GOOGLE_SHEETS_ID` y `OPENAI_API_KEY`.
