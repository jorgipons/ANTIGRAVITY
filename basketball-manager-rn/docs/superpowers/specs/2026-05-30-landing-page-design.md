# Landing Page partits. — Design Spec

## Goal

Create a single-page marketing landing at `landing.html` (Firebase Hosting) that presents partits. to coaches and club directors, and drives them to register/create an account in the app.

## Architecture

- **File:** `basketball-manager/landing.html`
- **Stack:** Tailwind CDN + vanilla JS, no build step — same pattern as `subscribe.html`
- **Hosting:** Firebase Hosting, rewrite `/landing` → `landing.html` added to `firebase.json`
- **Languages:** Spanish (default) + Valencian toggle. All strings stored in `data-es` / `data-val` attributes on each text element. A single JS function swaps them on click. Language preference saved to `localStorage`.

## Page Sections

### 1. Nav
- Logo `partits.` with orange dot
- Language toggle button `ES / VAL`
- CTA button "Entrar" — links to the web app (`/`)

### 2. Hero
- Eyebrow: `FBCV · Pasarela`
- Headline: `El gestor de partits per al teu equip` / `El gestor de partidos para tu equipo`
- Subheadline: one sentence about managing the Pasarela ruleset without headaches
- Primary CTA button: `Empieza gratis` — links to app web login (`/`)
- Secondary link: `Ver planes` — anchor to pricing section
- **CSS mockup** of the match matrix: a grid of player rows × period columns with colored cells (orange = assigned, green = valid, gray = empty). No images, pure HTML/CSS.

### 3. Problema → Solución
- Title: `La Pasarela tiene reglas. Nosotros las controlamos.`
- 3 icon + text points:
  1. Mínimos y máximos por jugador calculados automáticamente
  2. Alertas en tiempo real al convocar
  3. Sincronización con el calendario FBCV

### 4. Features — Para entrenadores
- Section label: `PARA ENTRENADORES`
- 3 feature cards:
  1. **Matriz de periodos** — cuadrícula visual con validación en tiempo real
  2. **Convocatoria y asistencia** — enlace público para que los jugadores confirmen
  3. **Sincronización FBCV** — importa el calendario de la federación con un clic (Pro)

### 5. Features — Para clubs
- Section label: `PARA CLUBS`
- 2 feature cards:
  1. **Gestión centralizada** — todos los entrenadores del club bajo una suscripción
  2. **Código de invitación** — añade entrenadores con un código PARTITS-XXXXXX

### 6. Pricing
- 3 columns: **Gratis** / **Pro** / **Club**

| Plan | Precio | Límites |
|---|---|---|
| Gratis | €0 | 1 equipo, 8 partidos |
| Pro | €1.99/mes o €16.99/año | Ilimitado, sync FBCV |
| Club Small | €9.99/mes o €95.99/año | Hasta 10 entrenadores |
| Club Medium | €17.99/mes o €172.99/año | Hasta 20 entrenadores |
| Club Large | €24.99/mes o €239.99/año | Hasta 30 entrenadores |

The pricing section shows the 3 main tiers (Gratis / Pro / Club). Club shows the Small price with "desde" and a note that larger tiers are available. Each column has a CTA button linking to the relevant subscribe page.

### 7. CTA Final
- Title: `Empieza gratis hoy`
- Subtitle: `Sin tarjeta de crédito. Sin compromiso.`
- Big CTA button: `Crear cuenta gratis` → links to app web login

### 8. Footer
- Logo + tagline
- Links: Política de privacidad, Contacto (email)
- `© 2026 partits.`

## Language Toggle Implementation

```html
<!-- Each translatable element has both attributes -->
<h1 data-es="El gestor de partidos" data-val="El gestor de partits">El gestor de partidos</h1>
```

```js
function setLang(lang) {
  document.querySelectorAll('[data-es]').forEach(el => {
    el.textContent = el.dataset[lang];
  });
  localStorage.setItem('lang', lang);
}
// On load: setLang(localStorage.getItem('lang') || 'es')
```

## CSS Matrix Mockup

A `<div>` grid with:
- Rows: 5 fake player names (left column)
- Columns: 8 period headers (P1–P8)
- Cells colored: orange (assigned), green (✓ valid), red (error), gray (empty)
- No images, no external assets

## Routing

Add to `basketball-manager/firebase.json` rewrites array:
```json
{ "source": "/landing", "destination": "/landing.html" }
```
