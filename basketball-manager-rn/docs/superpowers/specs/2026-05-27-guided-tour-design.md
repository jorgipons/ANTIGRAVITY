# Guided Tour (Spotlight Walkthrough) — Diseño

**Fecha:** 2026-05-27
**Proyecto:** basketball-manager-rn (partits.)
**Estado:** Aprobado

---

## Resumen

Reemplazar el `HelpModal` estático (bottom-sheet con texto) por una guía interactiva paso a paso que resalta elementos reales de la UI usando la técnica de 4 rectángulos oscuros alrededor del elemento (spotlight sin librerías externas). Se activa al pulsar el botón `?` en el header de cada pantalla.

---

## Componente Principal — GuidedTourOverlay

### Archivo
`src/components/GuidedTourOverlay.js`

### Props
```js
{
  steps: Array<{ ref: React.RefObject, title: string, text: string }>,
  visible: boolean,
  onClose: () => void,
}
```

### Comportamiento

1. Al activarse (`visible` → true), mide el elemento del paso 0 con `ref.current.measureInWindow()`
2. Renderiza el overlay de 4 rectángulos semitransparentes dejando el área del elemento visible
3. Añade un borde naranja (`T.orange`) alrededor del área resaltada con animación de opacidad pulsante
4. Muestra el tooltip (título, texto, "Paso N de M") encima o debajo del spotlight según el espacio disponible:
   - Si `spotY > H / 2` → tooltip encima (`bottom: H - spotY + padding`)
   - Si `spotY <= H / 2` → tooltip debajo (`top: spotY + spotH + padding`)
5. Botones: Anterior (deshabilitado en paso 0) / Siguiente / Cerrar (siempre visible)
6. Al avanzar al siguiente paso, mide el nuevo ref y actualiza las coordenadas

### Gestión de elementos fuera del viewport
Si `measureInWindow` devuelve `y < 0` o `y + h > screenHeight`, el spotlight no se renderiza para ese paso (todos los rectángulos cubren la pantalla completa) y el tooltip se muestra centrado. El título y texto siguen siendo visibles.

### Animaciones
- Overlay: `Animated.timing` opacity 0 → 0.72 al aparecer
- Borde pulsante: `Animated.loop` + `Animated.sequence` entre opacity 0.5 y 1.0
- Sin animación de transición entre pasos (snap inmediato para simplicidad)

### Estilo
- Overlay: `rgba(0,0,0,0.72)`
- Borde spotlight: 2px, color `T.orange`, borderRadius 8
- Tooltip: fondo `#0F1826`, esquinas redondeadas 16, texto blanco, misma paleta que HelpModal
- Contador de pasos: `T.fontMed`, color `rgba(255,255,255,0.45)`

---

## Modificaciones a pantallas existentes

En cada pantalla, el cambio es mínimo:
1. Añadir refs para los elementos del tour (`useRef(null)`)
2. Adjuntar los refs a los elementos JSX: `ref={menuRef}`
3. Cambiar `helpOpen` → `tourActive` (renombrar estado)
4. Sustituir `<HelpModal ... />` por `<GuidedTourOverlay steps={TOUR_STEPS} visible={tourActive} onClose={() => setTourActive(false)} />`
5. Definir `TOUR_STEPS` como constante fuera del componente (para no recrearla en cada render)

---

## Pasos por pantalla

### TeamsListScreen (4 pasos)
| # | Elemento | Title | Text |
|---|---|---|---|
| 1 | Botón menú (hamburger) | Menú lateral | Accede al calendario, a la guía de uso y a los ajustes desde aquí. |
| 2 | Icono calendario (header) | Calendario | Ve todos los partidos de todos tus equipos en una sola vista. |
| 3 | Botón + (header) | Nuevo equipo | Crea un nuevo equipo de baloncesto. |
| 4 | Primera tarjeta de equipo | Tu equipo | Toca la tarjeta para gestionar jugadores, partidos y configuración del equipo. |

### TeamDetailScreen (4 pasos)
| # | Elemento | Title | Text |
|---|---|---|---|
| 1 | Botón menú | Menú lateral | Navega a otras secciones de la app. |
| 2 | Botón configurar equipo (engranaje/icono) | Configurar equipo | Cambia el nombre, el modo de partido (Pasarela 8P, 6P o Libre) y los roles y colores de cada posición. |
| 3 | Cabecera de la lista de jugadores | Jugadores | Aquí aparece la plantilla completa con número de dorsal y posición. |
| 4 | Botón + jugador | Añadir jugador | Añade un nuevo jugador con su nombre, dorsal y posición. |

### MatchListScreen (4 pasos)
| # | Elemento | Title | Text |
|---|---|---|---|
| 1 | Botón menú | Menú lateral | Navega a otras secciones de la app. |
| 2 | Botón + (header) | Nuevo partido | Crea un partido con rival, fecha, hora y lugar. |
| 3 | Primera tarjeta de partido | Partido | Toca para abrir la matriz de sustituciones. Mantén la ficha del partido para editarla o eliminarla. |
| 4 | Badge de estado del partido | Estado | Pendiente → En curso → Finalizado. Cambia el estado desde la ficha del partido. |

### MatchMatrixScreen (13 pasos)
| # | Elemento | Title | Text |
|---|---|---|---|
| 1 | Botón menú | Menú lateral | Navega a otras secciones de la app. |
| 2 | Cabecera del partido (rival + fecha) | Información del partido | Nombre del rival y fecha. Puedes editar los datos del partido desde aquí. |
| 3 | Botones de vista (matriz/compacta/lista) | Vistas | Cambia entre vista de cuadrícula completa, compacta o lista según tu preferencia. |
| 4 | Botón ordenar jugadores | Ordenar jugadores | Ordena la plantilla por posición o por número de dorsal. |
| 5 | Toggle "Edición libre" | Edición libre | Actívalo para desactivar las restricciones de Pasarela y asignar periodos libremente. |
| 6 | Cabecera de periodos (números) | Periodos | Los 8 periodos del partido. El periodo actual aparece resaltado. |
| 7 | Botón avanzar periodo (flecha) | Avanzar periodo | Marca el periodo actual como jugado y avanza al siguiente. |
| 8 | Nombre de jugador (primera fila) | Jugador | El nombre y la posición de cada jugador aparecen a la izquierda. |
| 9 | Celda de la cuadrícula | Asignar periodo | Toca una celda para asignar ese jugador a ese periodo. Vuelve a tocarla para quitarlo. |
| 10 | Color de celda (verde/amarillo/rojo) | Colores Pasarela | 🟢 Cumple el reglamento · 🟡 En el límite · 🔴 Infringe la norma. |
| 11 | Barra de progreso del jugador | Progreso | Muestra cuántos de los 8 periodos lleva jugados ese jugador. |
| 12 | Celda de la cuadrícula (long press) | Vaciar jugador | Mantén pulsada una celda para quitar a ese jugador de todos los periodos de golpe. |
| 13 | Botón + Prórroga | Prórroga | Añade periodos extra si el partido va a prórroga. El botón de papelera permite eliminarlos. |

### CalendarScreen (3 pasos)
| # | Elemento | Title | Text |
|---|---|---|---|
| 1 | Botón menú | Menú lateral | Navega a otras secciones de la app. |
| 2 | Vista de calendario (widget) | Calendario | Navega por los meses para ver en qué días tienes partidos. Los días con partido aparecen marcados. |
| 3 | Sección "Próximos partidos" | Próximos partidos | Lista de los partidos más cercanos de todos tus equipos. Toca uno para ir a su matriz. |

---

## Archivos a crear / modificar

### Nuevo
- `src/components/GuidedTourOverlay.js` — componente de spotlight + tooltip

### Modificados
- `src/screens/TeamsListScreen.js` — refs + TOUR_STEPS + swap HelpModal → GuidedTourOverlay
- `src/screens/TeamDetailScreen.js` — ídem
- `src/screens/MatchListScreen.js` — ídem
- `src/screens/MatchMatrixScreen.js` — ídem (13 refs)
- `src/screens/CalendarScreen.js` — ídem

### Sin cambios
- `src/components/HelpModal.js` — conservado (no se usa en headers, disponible para otros usos futuros)
- `src/screens/HelpScreen.js` — sin cambios (referencia textual completa desde el drawer)

---

## Decisiones de diseño

- **Sin librerías externas nuevas**: overlay con 4 vistas React Native
- **`measureInWindow`** en lugar de `measure`: funciona correctamente dentro de ScrollViews y FlatLists
- **Fallback para elementos fuera del viewport**: si `y < 0` o `y + h > screenHeight`, overlay cubre toda la pantalla y el tooltip se muestra centrado
- **TOUR_STEPS como constante fuera del componente**: evita recreación en cada render
- **Borde pulsante naranja**: `Animated.loop` para indicar el elemento activo
- **Tooltip posicionado dinámicamente**: encima si el elemento está en la mitad inferior, debajo si está en la mitad superior
