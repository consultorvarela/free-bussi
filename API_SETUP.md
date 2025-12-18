# API Setup para Free Bussi

Este juego usa una API REST segura hospedada en Render para gestionar las puntuaciones altas.

## Arquitectura

```
Navegador (Juego Phaser)
    ↓ fetch()
API REST (Flask en Render)
    ↓ Firebase Admin SDK
Firebase Firestore
```

## Ventajas de esta arquitectura:

✅ **Credenciales seguras**: Las credenciales de Firebase nunca se exponen al navegador
✅ **Validación en servidor**: Los puntajes se validan antes de guardarse
✅ **Sin ofuscación necesaria**: El código del juego puede ser público
✅ **Control total**: Puedes agregar rate limiting, filtros, logs, etc.

## API Endpoint

La API está desplegada en: **https://free-bussi-backend.onrender.com**

### Endpoints disponibles:

#### `GET /api/highscores`
Obtener las 5 mejores puntuaciones

**Respuesta:**
```json
[
  {"score": 1500, "initials": "PLAYER"},
  {"score": 1200, "initials": "BUSSI1"}
]
```

#### `POST /api/highscores`
Guardar una nueva puntuación

**Request:**
```json
{
  "score": 1500,
  "initials": "PLAYER"
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Score saved successfully"
}
```

#### `POST /api/highscores/qualify`
Verificar si un puntaje califica para el top 5

**Request:**
```json
{
  "score": 1500
}
```

**Respuesta:**
```json
{
  "qualifies": true
}
```

## Cómo funciona en el código

El archivo `src/firebase.js` hace peticiones HTTP a la API:

```javascript
const API_URL = 'https://free-bussi-backend.onrender.com/api';

export async function loadHighScores() {
  const response = await fetch(`${API_URL}/highscores`);
  return await response.json();
}

export async function saveHighScore(score, initials) {
  await fetch(`${API_URL}/highscores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ score, initials })
  });
  return await loadHighScores();
}
```

## Fallback a localStorage

Si la API no responde (ej: Render está "despertando" o hay problemas de red), el juego automáticamente usa `localStorage` como respaldo:

```javascript
// Si fetch falla
catch (error) {
  console.warn('Falling back to localStorage');
  return loadHighScoresFromLocalStorage();
}
```

## Backend

El código del backend está en un repositorio separado.

- **Repositorio**: (tu repo del backend)
- **Tecnología**: Flask + Firebase Admin SDK
- **Hosting**: Render.com (plan gratuito)
- **Documentación**: Ver README.md del backend

## Limitaciones del plan gratuito de Render

⚠️ El servicio se "duerme" después de 15 minutos de inactividad
⚠️ La primera request tarda ~30-60 segundos en responder (mientras "despierta")
⏱️ 750 horas/mes de uso

**Solución**: El juego tiene fallback a localStorage, así que sigue funcionando mientras la API despierta.

## Actualizar la URL de la API

Si cambias el dominio del backend, actualiza la constante en `src/firebase.js`:

```javascript
const API_URL = 'https://tu-nueva-url.onrender.com/api';
```

Luego reconstruye:

```bash
npm run build
```

## Seguridad

✅ **Credenciales protegidas**: Firebase Admin SDK solo en el servidor
✅ **CORS configurado**: Solo permite requests desde GitHub Pages
✅ **Validación en servidor**: Los puntajes se validan (0-1,000,000)
✅ **Rate limiting**: Incluido en Flask
✅ **Código público**: El juego puede estar en GitHub sin riesgos

---

Para más información sobre el backend, consulta el repositorio del backend Flask.
