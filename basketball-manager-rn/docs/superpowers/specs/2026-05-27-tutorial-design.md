# Tutorial / Onboarding — Diseño

**Fecha:** 2026-05-27
**Proyecto:** basketball-manager-rn (partits.)
**Estado:** Aprobado

---

## Resumen

Añadir un sistema de tutorial en tres capas a la app partits.:

1. **Onboarding Carousel** — aparece automáticamente la primera vez que se abre la app
2. **HelpScreen** — pantalla de ayuda completa accesible desde el drawer en cualquier momento
3. **Ayuda contextual (`?`)** — botón en el header de cada pantalla principal con explicación específica de esa sección

---

## Capa 1 — Onboarding Carousel

### Comportamiento
- Se muestra automáticamente al abrir la app si `AsyncStorage.getItem('tutorial_seen')` devuelve null
- Tras completarlo o saltarlo, se escribe `AsyncStorage.setItem('tutorial_seen', 'true')`
- El carrusel es de **primer inicio únicamente**; la re-consulta posterior se hace desde HelpScreen (ver Capa 2)

### Estructura
Modal de pantalla completa con 5 tarjetas deslizables. Diseño dark con gradiente azul, consistente con el lenguaje visual de la app.

| # | Título | Descripción |
|---|--------|-------------|
| 1 | Bienvenido a partits. | Qué es la app y para qué sirve. Logo + tagline |
| 2 | Tu equipo | Crear equipo, añadir jugadores con número y posición, elegir modo (Pasarela 8P / 6P / Libre) |
| 3 | Tus partidos | Crear partidos, rellenar datos (rival, fecha, hora, lugar), enlace de convocatoria para jugadores |
| 4 | La Matriz y sustituciones | Cuadrícula jugadores × periodos. Tocar una celda para asignar/quitar un jugador en un periodo. Colores: verde/amarillo/rojo según Pasarela. Prórroga |
| 5 | ¡Listo! | CTA: botón "Empezar" → cierra el carrusel |

### UI
- Botón "Saltar" en esquina superior derecha (siempre visible)
- Dots de progreso centrados en la parte inferior
- Swipe horizontal entre tarjetas (o botones Anterior / Siguiente)
- Botón "Empezar" solo visible en la última tarjeta

### Componente
`src/components/OnboardingCarousel.js` — Modal de React Native (`transparent: false`, pantalla completa)

---

## Capa 2 — HelpScreen

### Comportamiento
- Pantalla de navegación completa (añadida al Stack como `Help`)
- Accesible desde el drawer: entrada "Cómo usar" entre Calendar y Settings
- Mismas secciones que el carrusel pero en formato scrollable y más detallado

### UI
- Header con gradiente igual al resto de pantallas (botón `Menu` para abrir drawer)
- Cards por sección con icono + título + texto explicativo
- Sin interactividad más allá del scroll

### Archivo
`src/screens/HelpScreen.js`

---

## Capa 3 — Ayuda contextual por pantalla

### Comportamiento
- Botón `?` (icono `HelpCircle` de lucide) en el header de cada pantalla principal
- Al pulsarlo abre un bottom-sheet modal con contenido específico de esa pantalla
- Mismo estilo dark bottom-sheet ya usado en la app (transparent modal + animación)

### Contenido por pantalla

| Pantalla | Contenido |
|---|---|
| TeamsListScreen | Cómo crear y gestionar equipos |
| TeamDetailScreen | Jugadores, posiciones, roles y modo de partido (Pasarela 8P / 6P / Libre) |
| MatchListScreen | Crear partidos, estados (pendiente / en curso / finalizado) y enlace de convocatoria |
| MatchMatrixScreen | Reglas Pasarela (colores, periodos, checkpoints), cómo hacer sustituciones en la cuadrícula, prórroga |
| CalendarScreen | Cómo leer el calendario multi-equipo |

### Componente
`src/components/HelpModal.js` — recibe `screenKey` (string) y un mapa de contenido por clave. Renderiza el bottom-sheet con título + texto/secciones.

---

## Archivos a crear / modificar

### Nuevos
- `src/components/OnboardingCarousel.js` — carrusel de onboarding
- `src/components/HelpModal.js` — modal contextual reutilizable
- `src/screens/HelpScreen.js` — pantalla de ayuda completa

### Modificados
- `src/components/AppDrawer.js` — añadir entrada "Cómo usar" → navega a `Help`; lógica para forzar el onboarding (re-ver tutorial)
- `src/navigation/RootNavigation.js` — añadir `Stack.Screen name="Help"` component={HelpScreen}
- `src/screens/TeamsListScreen.js` — añadir `HelpButton` en header + lógica de primer arranque (comprueba AsyncStorage, muestra OnboardingCarousel)
- `src/screens/TeamDetailScreen.js` — añadir `HelpButton` en header
- `src/screens/MatchListScreen.js` — añadir `HelpButton` en header
- `src/screens/MatchMatrixScreen.js` — añadir `HelpButton` en header
- `src/screens/CalendarScreen.js` — añadir `HelpButton` en header

---

## Decisiones de diseño

- **Sin librerías externas**: todo con React Native primitivas (Modal, Animated, FlatList)
- **AsyncStorage** para persistir el estado "tutorial visto"
- **Contenido hardcodeado en español** (mismo idioma que el resto de la app)
- **El onboarding no bloquea la app**: el botón "Saltar" siempre está visible
- La comprobación del tutorial se hace en `TeamsListScreen` (primera pantalla autenticada), no en el Navigator
