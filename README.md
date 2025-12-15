# 🎮 FREE BUSSI

**FREE BUSSI** es un juego *endless runner* en 2D desarrollado con **Phaser 3**, enfocado en una experiencia arcade fluida, controles simples y mecánicas claras. El proyecto fue creado como parte de un portafolio profesional, utilizando una arquitectura moderna basada en **Node.js**, **npm** y **Vite**, sin dependencias vía CDN.

---

## 🚍 Descripción del juego

El jugador controla un bus que avanza automáticamente por una pista. El objetivo es **sobrevivir el mayor tiempo posible**, esquivando obstáculos y aprovechando *power-ups* estratégicamente para alcanzar la mejor puntuación.

### Mecánicas principales
- 🏃 Auto-run continuo
- ⬆️ **Salto** (Space / Up / Tap)
- ⬇️ **Fast fall** en el aire (caída rápida + giro)
- 🔄 **Salto con giro** (animación aérea)
- 🛡️ **Invencibilidad tipo escudo** (1 vida extra)
- ⚡ Power-ups no acumulables (solo uno activo a la vez)

---

## ✨ Power-ups

### 🛡️ Invencibilidad (Escudo)
- Actúa como **una vida extra**
- No tiene límite de tiempo
- Se consume en el **primer choque**
- No es acumulable

### ⚡ Super Salto
- Incrementa la altura del salto
- Dura un tiempo limitado
- Cambia el color del bus mientras está activo

---

## 🏆 Sistema de puntuación

- Puntuación incremental por distancia recorrida
- **Top 5** persistente usando `localStorage`
- Ingreso de **iniciales (3 letras)** al obtener un nuevo récord
- Interfaz clara de *Game Over* con ranking visible

---

## 📱 Controles

| Acción | Teclado | Móvil |
|------|--------|-------|
| Saltar | Space / ↑ | Tap |
| Caer rápido | ↓ | Swipe abajo |

---

## 🛠️ Tecnologías utilizadas

- **Phaser 3** (motor de juego)
- **JavaScript (ES Modules)**
- **Node.js**
- **npm**
- **Vite** (dev server + build)

---

## 📁 Estructura del proyecto

```
free-bussi/
├─ index.html
├─ package.json
├─ vite.config.js
├─ public/
│  └─ assets/
│     ├─ sounds/
│     └─ images/
├─ src/
│  ├─ main.js
│  ├─ scenes/
│  │  ├─ StartScene.js
│  │  └─ GameScene.js
│  ├─ utils/
│  │  └─ storage.js
│  └─ styles/
│     └─ main.css
└─ README.md
```

---

## ▶️ Instalación y ejecución

### Requisitos
- Node.js v18+
- npm

### Pasos

```bash
# instalar dependencias
npm install

# ejecutar en desarrollo
npm run dev

# build de producción
npm run build

# previsualizar build
npm run preview
```

---

## 🚀 Build y despliegue

El proyecto está preparado para despliegue en:
- **Netlify**
- **GitHub Pages**
- **Vercel**

El build de producción se genera en la carpeta `dist/`.

---

## 🎯 Enfoque profesional

Este proyecto fue diseñado con las siguientes buenas prácticas:
- Arquitectura modular por escenas
- Separación de lógica, UI y utilidades
- Sin dependencias por CDN
- Persistencia local de datos
- UX consistente para desktop y móvil

---

## 👤 Autor

Desarrollado por **Pedro Varela**  
Proyecto de portafolio – Desarrollo de videojuegos 2D con Phaser

---

## 📄 Licencia

Este proyecto se distribuye bajo la licencia **MIT**.

---

> *Free BUSSI* — Un proyecto arcade moderno, simple y divertido 🚍🎮

