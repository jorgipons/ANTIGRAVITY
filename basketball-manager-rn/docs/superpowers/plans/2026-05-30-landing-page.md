# Landing Page partits. — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `basketball-manager/landing.html` — a single-page marketing landing for partits. with ES/VAL toggle, CSS matrix mockup, and 3-column pricing, deployed via Firebase Hosting.

**Architecture:** Single static HTML file using Tailwind CDN + vanilla JS (no build step), following the same pattern as `subscribe.html`. Language toggle via `data-es`/`data-val` attributes swapped by a JS function. Firebase Hosting rewrite maps `/landing` → `landing.html`.

**Tech Stack:** HTML5, Tailwind CDN, vanilla JS, Firebase Hosting

**Spec:** `docs/superpowers/specs/2026-05-30-landing-page-design.md`

---

### Task 1: Add `/landing` rewrite to firebase.json

**Files:**
- Modify: `basketball-manager/firebase.json`

- [ ] **Step 1: Open firebase.json and locate the rewrites array**

Current rewrites end with the catch-all:
```json
{ "source": "**", "destination": "/index.html" }
```

- [ ] **Step 2: Insert the `/landing` rewrite before the `**` catch-all**

The final rewrites array must be:
```json
"rewrites": [
  { "source": "/attendance",          "destination": "/attendance.html" },
  { "source": "/subscribe",           "destination": "/subscribe.html" },
  { "source": "/subscribe-success",   "destination": "/subscribe-success.html" },
  { "source": "/manage",              "destination": "/manage.html" },
  { "source": "/club-subscribe",      "destination": "/club-subscribe.html" },
  { "source": "/club-subscribe-success", "destination": "/club-subscribe-success.html" },
  { "source": "/landing",             "destination": "/landing.html" },
  { "source": "**",                   "destination": "/index.html" }
]
```

- [ ] **Step 3: Verify**

Open `basketball-manager/firebase.json`. Confirm `/landing` entry appears before `**` and the JSON is valid.

---

### Task 2: Create landing.html — full page

**Files:**
- Create: `basketball-manager/landing.html`

- [ ] **Step 1: Create the file with the complete HTML**

Create `basketball-manager/landing.html` with this exact content:

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>partits. — Gestor de baloncesto FBCV Pasarela</title>
  <meta name="description" content="Gestiona la reglamentación Pasarela 8P de la FBCV con facilidad. Matriz de periodos, convocatoria y sincronización con el calendario federativo.">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .matrix-cell {
      width: 34px; height: 28px; border-radius: 5px;
      display: flex; align-items: center; justify-content: center;
      font-size: 10px; font-weight: 700;
    }
  </style>
</head>
<body class="bg-white text-gray-900 antialiased">

  <!-- NAV -->
  <nav class="fixed top-0 w-full bg-white/95 backdrop-blur-sm border-b border-gray-100 z-50">
    <div class="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
      <a href="/landing" class="font-black text-2xl tracking-tight">
        partits<span class="text-orange-500">.</span>
      </a>
      <div class="flex items-center gap-3">
        <div class="flex rounded-full border border-gray-200 overflow-hidden text-sm">
          <button id="btn-es" onclick="setLang('es')" class="px-3 py-1.5 font-semibold transition-colors">ES</button>
          <button id="btn-val" onclick="setLang('val')" class="px-3 py-1.5 font-semibold transition-colors">VAL</button>
        </div>
        <a href="/"
           data-es="Entrar" data-val="Entrar"
           class="bg-gray-900 hover:bg-gray-700 text-white font-bold text-sm px-5 py-2 rounded-full transition-colors">Entrar</a>
      </div>
    </div>
  </nav>

  <!-- HERO -->
  <section class="pt-28 pb-20 px-6 bg-gradient-to-b from-gray-50 to-white">
    <div class="max-w-4xl mx-auto text-center">
      <div class="inline-flex items-center gap-2 bg-orange-50 text-orange-600 text-xs font-bold tracking-widest uppercase px-4 py-2 rounded-full mb-8">
        <span>⚡</span><span>FBCV · Pasarela 8P</span>
      </div>
      <h1 class="text-5xl md:text-6xl font-black tracking-tight leading-none mb-6"
          data-es="El gestor de partidos<br>para tu equipo"
          data-val="El gestor de partits<br>per al teu equip">
        El gestor de partidos<br>para tu equipo
      </h1>
      <p class="text-xl text-gray-500 max-w-xl mx-auto mb-10"
         data-es="Controla minutos, gestiona la convocatoria y cumple el reglamento Pasarela 8P sin esfuerzo."
         data-val="Controla minuts, gestiona la convocatòria i compleix el reglament Pasarela 8P sense esforç.">
        Controla minutos, gestiona la convocatoria y cumple el reglamento Pasarela 8P sin esfuerzo.
      </p>
      <div class="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
        <a href="/"
           class="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white font-black text-lg px-10 py-4 rounded-2xl transition-colors shadow-lg shadow-orange-100"
           data-es="Empieza gratis" data-val="Comença gratis">Empieza gratis</a>
        <a href="#pricing"
           class="w-full sm:w-auto text-gray-600 font-semibold text-lg px-10 py-4 rounded-2xl border border-gray-200 hover:bg-gray-50 transition-colors text-center"
           data-es="Ver planes" data-val="Veure plans">Ver planes</a>
      </div>

      <!-- CSS MATRIX MOCKUP -->
      <div class="bg-gray-900 rounded-3xl p-6 max-w-2xl mx-auto shadow-2xl overflow-x-auto">
        <div class="text-left mb-4 flex items-center justify-between">
          <div>
            <div class="text-xs font-bold text-orange-400 tracking-widest uppercase mb-1"
                 data-es="PARTIDO EN CURSO" data-val="PARTIT EN CURS">PARTIDO EN CURSO</div>
            <div class="text-white font-black text-lg">FC Alicante B</div>
          </div>
          <div class="text-right">
            <div class="text-gray-400 text-xs font-bold"
                 data-es="PERÍODO" data-val="PERÍODE">PERÍODO</div>
            <div class="text-white font-black text-3xl">4</div>
          </div>
        </div>
        <div class="inline-block min-w-full">
          <!-- Period headers -->
          <div class="flex gap-1 mb-2 pl-24">
            <div class="matrix-cell text-gray-500 text-xs">P1</div>
            <div class="matrix-cell text-gray-500 text-xs">P2</div>
            <div class="matrix-cell text-gray-500 text-xs">P3</div>
            <div class="matrix-cell text-gray-500 text-xs">P4</div>
            <div class="matrix-cell text-gray-500 text-xs">P5</div>
            <div class="matrix-cell text-gray-500 text-xs">P6</div>
            <div class="matrix-cell text-gray-500 text-xs">P7</div>
            <div class="matrix-cell text-gray-500 text-xs">P8</div>
          </div>
          <!-- Row 1: valid -->
          <div class="flex gap-1 items-center mb-1.5">
            <div class="w-24 text-gray-300 text-xs font-semibold truncate pr-2">#4 García</div>
            <div class="matrix-cell bg-orange-500/20 text-orange-400">✓</div>
            <div class="matrix-cell bg-orange-500/20 text-orange-400">✓</div>
            <div class="matrix-cell bg-gray-700/50"></div>
            <div class="matrix-cell bg-orange-500/20 text-orange-400">✓</div>
            <div class="matrix-cell bg-gray-700/50"></div>
            <div class="matrix-cell bg-gray-700/50"></div>
            <div class="matrix-cell bg-gray-700/50"></div>
            <div class="matrix-cell bg-gray-700/50"></div>
          </div>
          <!-- Row 2: valid -->
          <div class="flex gap-1 items-center mb-1.5">
            <div class="w-24 text-gray-300 text-xs font-semibold truncate pr-2">#7 Martínez</div>
            <div class="matrix-cell bg-gray-700/50"></div>
            <div class="matrix-cell bg-orange-500/20 text-orange-400">✓</div>
            <div class="matrix-cell bg-orange-500/20 text-orange-400">✓</div>
            <div class="matrix-cell bg-gray-700/50"></div>
            <div class="matrix-cell bg-orange-500/20 text-orange-400">✓</div>
            <div class="matrix-cell bg-gray-700/50"></div>
            <div class="matrix-cell bg-gray-700/50"></div>
            <div class="matrix-cell bg-gray-700/50"></div>
          </div>
          <!-- Row 3: too many periods (4/6 before checkpoint = error) -->
          <div class="flex gap-1 items-center mb-1.5">
            <div class="w-24 text-red-400 text-xs font-semibold truncate pr-2">#11 López</div>
            <div class="matrix-cell bg-red-500/20 text-red-400">✕</div>
            <div class="matrix-cell bg-red-500/20 text-red-400">✕</div>
            <div class="matrix-cell bg-red-500/20 text-red-400">✕</div>
            <div class="matrix-cell bg-red-500/20 text-red-400">✕</div>
            <div class="matrix-cell bg-gray-700/50"></div>
            <div class="matrix-cell bg-gray-700/50"></div>
            <div class="matrix-cell bg-gray-700/50"></div>
            <div class="matrix-cell bg-gray-700/50"></div>
          </div>
          <!-- Row 4: valid -->
          <div class="flex gap-1 items-center mb-1.5">
            <div class="w-24 text-gray-300 text-xs font-semibold truncate pr-2">#14 Pérez</div>
            <div class="matrix-cell bg-gray-700/50"></div>
            <div class="matrix-cell bg-gray-700/50"></div>
            <div class="matrix-cell bg-orange-500/20 text-orange-400">✓</div>
            <div class="matrix-cell bg-gray-700/50"></div>
            <div class="matrix-cell bg-orange-500/20 text-orange-400">✓</div>
            <div class="matrix-cell bg-orange-500/20 text-orange-400">✓</div>
            <div class="matrix-cell bg-gray-700/50"></div>
            <div class="matrix-cell bg-gray-700/50"></div>
          </div>
          <!-- Row 5: needs to play more -->
          <div class="flex gap-1 items-center">
            <div class="w-24 text-gray-300 text-xs font-semibold truncate pr-2">#17 Ruiz</div>
            <div class="matrix-cell bg-orange-500/20 text-orange-400">✓</div>
            <div class="matrix-cell bg-gray-700/50"></div>
            <div class="matrix-cell bg-gray-700/50"></div>
            <div class="matrix-cell bg-gray-700/50"></div>
            <div class="matrix-cell bg-gray-700/50"></div>
            <div class="matrix-cell bg-gray-700/50"></div>
            <div class="matrix-cell bg-gray-700/50"></div>
            <div class="matrix-cell bg-gray-700/50"></div>
          </div>
        </div>
        <!-- Legend -->
        <div class="mt-4 flex gap-4 text-xs">
          <span class="flex items-center gap-1.5 text-orange-400">
            <span class="w-3 h-3 rounded bg-orange-500/30 inline-block"></span>
            <span data-es="Jugando" data-val="Jugant">Jugando</span>
          </span>
          <span class="flex items-center gap-1.5 text-red-400">
            <span class="w-3 h-3 rounded bg-red-500/30 inline-block"></span>
            <span data-es="Error Pasarela" data-val="Error Pasarela">Error Pasarela</span>
          </span>
        </div>
      </div>
    </div>
  </section>

  <!-- PROBLEMA → SOLUCIÓN -->
  <section class="py-20 px-6 bg-white">
    <div class="max-w-4xl mx-auto">
      <div class="text-center mb-12">
        <h2 class="text-4xl font-black tracking-tight mb-4"
            data-es="La Pasarela tiene reglas.<br>Nosotros las controlamos."
            data-val="La Pasarela té regles.<br>Nosaltres les controlem.">
          La Pasarela tiene reglas.<br>Nosotros las controlamos.
        </h2>
        <p class="text-gray-400 text-lg max-w-xl mx-auto"
           data-es="La normativa FBCV exige que cada jugador juegue un mínimo y un máximo de periodos. partits. lo calcula en tiempo real."
           data-val="La normativa FBCV exigeix que cada jugador jugue un mínim i un màxim de períodes. partits. ho calcula en temps real.">
          La normativa FBCV exige que cada jugador juegue un mínimo y un máximo de periodos. partits. lo calcula en tiempo real.
        </p>
      </div>
      <div class="grid md:grid-cols-3 gap-6">
        <div class="bg-gray-50 rounded-2xl p-6 border border-gray-100">
          <div class="text-3xl mb-4">⚡</div>
          <h3 class="font-black text-lg mb-2"
              data-es="Mínimos y máximos automáticos"
              data-val="Mínims i màxims automàtics">Mínimos y máximos automáticos</h3>
          <p class="text-gray-500 text-sm"
             data-es="Calcula en tiempo real cuántos periodos puede jugar cada jugador según las reglas Pasarela 8P."
             data-val="Calcula en temps real quants períodes pot jugar cada jugador segons les regles Pasarela 8P.">
            Calcula en tiempo real cuántos periodos puede jugar cada jugador según las reglas Pasarela 8P.
          </p>
        </div>
        <div class="bg-gray-50 rounded-2xl p-6 border border-gray-100">
          <div class="text-3xl mb-4">🔔</div>
          <h3 class="font-black text-lg mb-2"
              data-es="Alertas al convocar"
              data-val="Alertes en convocar">Alertas al convocar</h3>
          <p class="text-gray-500 text-sm"
             data-es="Si una alineación infringe el reglamento, lo ves al momento con colores y mensajes claros."
             data-val="Si una alineació infringeix el reglament, ho veus al moment amb colors i missatges clars.">
            Si una alineación infringe el reglamento, lo ves al momento con colores y mensajes claros.
          </p>
        </div>
        <div class="bg-gray-50 rounded-2xl p-6 border border-gray-100">
          <div class="text-3xl mb-4">📅</div>
          <h3 class="font-black text-lg mb-2"
              data-es="Calendario federativo"
              data-val="Calendari federatiu">Calendario federativo</h3>
          <p class="text-gray-500 text-sm"
             data-es="Importa los partidos directamente del calendario FBCV. Sin copiar y pegar."
             data-val="Importa els partits directament del calendari FBCV. Sense copiar i enganxar.">
            Importa los partidos directamente del calendario FBCV. Sin copiar y pegar.
          </p>
        </div>
      </div>
    </div>
  </section>

  <!-- FEATURES ENTRENADORES -->
  <section class="py-20 px-6 bg-gray-50">
    <div class="max-w-4xl mx-auto">
      <div class="mb-10">
        <span class="text-xs font-black tracking-widest text-orange-500 uppercase"
              data-es="PARA ENTRENADORES" data-val="PER A ENTRENADORS">PARA ENTRENADORES</span>
        <h2 class="text-3xl font-black tracking-tight mt-2"
            data-es="Todo lo que necesitas en la banda"
            data-val="Tot el que necessites a la banda">Todo lo que necesitas en la banda</h2>
      </div>
      <div class="grid md:grid-cols-3 gap-6">
        <div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div class="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center mb-4 text-xl">📊</div>
          <h3 class="font-black text-lg mb-2"
              data-es="Matriz de periodos" data-val="Matriu de períodes">Matriz de periodos</h3>
          <p class="text-gray-500 text-sm"
             data-es="Cuadrícula visual con validación Pasarela 8P en tiempo real. Verde = válido, rojo = infracción."
             data-val="Quadrícula visual amb validació Pasarela 8P en temps real. Verd = vàlid, roig = infracció.">
            Cuadrícula visual con validación Pasarela 8P en tiempo real. Verde = válido, rojo = infracción.
          </p>
        </div>
        <div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div class="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center mb-4 text-xl">📋</div>
          <h3 class="font-black text-lg mb-2"
              data-es="Convocatoria y asistencia" data-val="Convocatòria i assistència">Convocatoria y asistencia</h3>
          <p class="text-gray-500 text-sm"
             data-es="Comparte un enlace para que los jugadores confirmen asistencia desde el móvil. Sin registro."
             data-val="Comparteix un enllaç perquè els jugadors confirmen assistència des del mòbil. Sense registre.">
            Comparte un enlace para que los jugadores confirmen asistencia desde el móvil. Sin registro.
          </p>
        </div>
        <div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div class="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center mb-4 text-xl">🔄</div>
          <h3 class="font-black text-lg mb-2"
              data-es="Sincronización FBCV" data-val="Sincronització FBCV">Sincronización FBCV</h3>
          <p class="text-gray-500 text-sm"
             data-es="Importa automáticamente el calendario de la federación. Detección inteligente de duplicados."
             data-val="Importa automàticament el calendari de la federació. Detecció intel·ligent de duplicats.">
            Importa automáticamente el calendario de la federación. Detección inteligente de duplicados.
          </p>
          <span class="mt-3 inline-block text-xs font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">PRO</span>
        </div>
      </div>
    </div>
  </section>

  <!-- FEATURES CLUBS -->
  <section class="py-20 px-6 bg-white">
    <div class="max-w-4xl mx-auto">
      <div class="mb-10">
        <span class="inline-block text-xs font-black tracking-widest text-gray-900 uppercase bg-gray-100 px-3 py-1 rounded-full"
              data-es="PARA CLUBS" data-val="PER A CLUBS">PARA CLUBS</span>
        <h2 class="text-3xl font-black tracking-tight mt-4"
            data-es="Un club, todos los entrenadores"
            data-val="Un club, tots els entrenadors">Un club, todos los entrenadores</h2>
      </div>
      <div class="grid md:grid-cols-2 gap-6">
        <div class="bg-gray-900 text-white rounded-2xl p-8">
          <div class="text-3xl mb-4">🏀</div>
          <h3 class="font-black text-xl mb-3"
              data-es="Gestión centralizada" data-val="Gestió centralitzada">Gestión centralizada</h3>
          <p class="text-gray-400"
             data-es="El admin del club paga una suscripción y todos los entrenadores tienen acceso Pro. Sin tarjetas individuales."
             data-val="L'admin del club paga una subscripció i tots els entrenadors tenen accés Pro. Sense targetes individuals.">
            El admin del club paga una suscripción y todos los entrenadores tienen acceso Pro. Sin tarjetas individuales.
          </p>
        </div>
        <div class="bg-orange-500 text-white rounded-2xl p-8">
          <div class="text-3xl mb-4">🔑</div>
          <h3 class="font-black text-xl mb-3"
              data-es="Código de invitación" data-val="Codi d'invitació">Código de invitación</h3>
          <p class="text-orange-100"
             data-es="Añade entrenadores con un código PARTITS-XXXXXX. Se unen en segundos, sin burocracia."
             data-val="Afig entrenadors amb un codi PARTITS-XXXXXX. S'uneixen en segons, sense burocràcia.">
            Añade entrenadores con un código PARTITS-XXXXXX. Se unen en segundos, sin burocracia.
          </p>
        </div>
      </div>
    </div>
  </section>

  <!-- PRICING -->
  <section id="pricing" class="py-20 px-6 bg-gray-50">
    <div class="max-w-4xl mx-auto">
      <div class="text-center mb-12">
        <h2 class="text-4xl font-black tracking-tight mb-3"
            data-es="Planes y precios" data-val="Plans i preus">Planes y precios</h2>
        <p class="text-gray-400 text-lg"
           data-es="Empieza gratis. Escala cuando lo necesites."
           data-val="Comença gratis. Escala quan ho necessites.">Empieza gratis. Escala cuando lo necesites.</p>
      </div>
      <div class="grid md:grid-cols-3 gap-6 items-start">
        <!-- Gratis -->
        <div class="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
          <div class="text-xs font-black tracking-widest text-gray-400 uppercase mb-4"
               data-es="GRATIS" data-val="GRATIS">GRATIS</div>
          <div class="text-4xl font-black mb-1">€0</div>
          <div class="text-gray-400 text-sm mb-8"
               data-es="Para siempre" data-val="Per sempre">Para siempre</div>
          <ul class="space-y-3 text-sm text-gray-600 mb-8">
            <li class="flex gap-2"><span class="text-green-500 font-bold">✓</span>
              <span data-es="1 equipo" data-val="1 equip">1 equipo</span></li>
            <li class="flex gap-2"><span class="text-green-500 font-bold">✓</span>
              <span data-es="8 partidos" data-val="8 partits">8 partidos</span></li>
            <li class="flex gap-2"><span class="text-green-500 font-bold">✓</span>
              <span data-es="Matriz y convocatoria" data-val="Matriu i convocatòria">Matriz y convocatoria</span></li>
          </ul>
          <a href="/"
             class="block text-center bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold py-3 rounded-xl transition-colors"
             data-es="Empezar gratis" data-val="Començar gratis">Empezar gratis</a>
        </div>
        <!-- Pro -->
        <div class="bg-gray-900 text-white rounded-2xl p-8 shadow-xl relative">
          <div class="absolute -top-3 left-1/2 -translate-x-1/2">
            <span class="bg-orange-500 text-white text-xs font-black px-4 py-1 rounded-full tracking-wide"
                  data-es="MÁS POPULAR" data-val="MÉS POPULAR">MÁS POPULAR</span>
          </div>
          <div class="text-xs font-black tracking-widest text-orange-400 uppercase mb-4">PRO</div>
          <div class="flex items-baseline gap-1 mb-1">
            <span class="text-4xl font-black">€1.99</span>
            <span class="text-gray-400">/mes</span>
          </div>
          <div class="text-gray-400 text-sm mb-8"
               data-es="o €16.99/año (~30% dto.)" data-val="o €16.99/any (~30% dte.)">o €16.99/año (~30% dto.)</div>
          <ul class="space-y-3 text-sm text-gray-300 mb-8">
            <li class="flex gap-2"><span class="text-orange-400 font-bold">✓</span>
              <span data-es="Equipos ilimitados" data-val="Equips il·limitats">Equipos ilimitados</span></li>
            <li class="flex gap-2"><span class="text-orange-400 font-bold">✓</span>
              <span data-es="Partidos ilimitados" data-val="Partits il·limitats">Partidos ilimitados</span></li>
            <li class="flex gap-2"><span class="text-orange-400 font-bold">✓</span>
              <span data-es="Sincronización FBCV" data-val="Sincronització FBCV">Sincronización FBCV</span></li>
            <li class="flex gap-2"><span class="text-orange-400 font-bold">✓</span>
              <span data-es="Funciones futuras" data-val="Funcions futures">Funciones futuras</span></li>
          </ul>
          <a href="/subscribe"
             class="block text-center bg-orange-500 hover:bg-orange-600 text-white font-black py-3 rounded-xl transition-colors"
             data-es="Hazte Pro" data-val="Fes-te Pro">Hazte Pro</a>
        </div>
        <!-- Club -->
        <div class="bg-white rounded-2xl p-8 border-2 border-gray-900 shadow-sm">
          <div class="text-xs font-black tracking-widest text-gray-400 uppercase mb-4"
               data-es="CLUB" data-val="CLUB">CLUB</div>
          <div class="flex items-baseline gap-1 mb-1">
            <span class="text-xl text-gray-400 font-semibold"
                  data-es="desde " data-val="des de ">desde </span>
            <span class="text-4xl font-black">€9.99</span>
            <span class="text-gray-400">/mes</span>
          </div>
          <div class="text-gray-400 text-sm mb-8"
               data-es="Hasta 10, 20 o 30 entrenadores" data-val="Fins a 10, 20 o 30 entrenadors">Hasta 10, 20 o 30 entrenadores</div>
          <ul class="space-y-3 text-sm text-gray-600 mb-8">
            <li class="flex gap-2"><span class="text-green-500 font-bold">✓</span>
              <span data-es="Todo lo de Pro" data-val="Tot el de Pro">Todo lo de Pro</span></li>
            <li class="flex gap-2"><span class="text-green-500 font-bold">✓</span>
              <span data-es="Gestión centralizada" data-val="Gestió centralitzada">Gestión centralizada</span></li>
            <li class="flex gap-2"><span class="text-green-500 font-bold">✓</span>
              <span data-es="Código de invitación" data-val="Codi d'invitació">Código de invitación</span></li>
          </ul>
          <a href="/club-subscribe"
             class="block text-center bg-gray-900 hover:bg-gray-700 text-white font-black py-3 rounded-xl transition-colors"
             data-es="Ver plan Club" data-val="Veure pla Club">Ver plan Club</a>
        </div>
      </div>
    </div>
  </section>

  <!-- CTA FINAL -->
  <section class="py-24 px-6 bg-gray-900 text-white text-center">
    <div class="max-w-2xl mx-auto">
      <div class="text-6xl font-black mb-2 tracking-tight">
        partits<span class="text-orange-500">.</span>
      </div>
      <h2 class="text-3xl font-black mb-4"
          data-es="Empieza gratis hoy" data-val="Comença gratis avui">Empieza gratis hoy</h2>
      <p class="text-gray-400 text-lg mb-10"
         data-es="Sin tarjeta de crédito. Sin compromiso."
         data-val="Sense targeta de crèdit. Sense compromís.">Sin tarjeta de crédito. Sin compromiso.</p>
      <a href="/"
         class="inline-block bg-orange-500 hover:bg-orange-600 text-white font-black text-xl px-12 py-5 rounded-2xl transition-colors shadow-lg shadow-orange-900/30"
         data-es="Crear cuenta gratis" data-val="Crear compte gratis">Crear cuenta gratis</a>
    </div>
  </section>

  <!-- FOOTER -->
  <footer class="py-10 px-6 bg-gray-950 text-gray-500">
    <div class="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
      <div class="font-black text-white text-lg tracking-tight">
        partits<span class="text-orange-500">.</span>
      </div>
      <div class="flex gap-6">
        <a href="#"
           class="hover:text-gray-300 transition-colors"
           data-es="Política de privacidad" data-val="Política de privacitat">Política de privacidad</a>
        <a href="mailto:jorgibeni7@gmail.com"
           class="hover:text-gray-300 transition-colors"
           data-es="Contacto" data-val="Contacte">Contacto</a>
      </div>
      <div data-es="© 2026 partits." data-val="© 2026 partits.">© 2026 partits.</div>
    </div>
  </footer>

  <script>
    function setLang(lang) {
      document.querySelectorAll('[data-es]').forEach(function(el) {
        var val = el.dataset[lang];
        if (val !== undefined) el.innerHTML = val;
      });
      var activeClass = 'px-3 py-1.5 font-semibold transition-colors bg-gray-900 text-white';
      var inactiveClass = 'px-3 py-1.5 font-semibold transition-colors text-gray-500 hover:text-gray-900';
      document.getElementById('btn-es').className = lang === 'es' ? activeClass : inactiveClass;
      document.getElementById('btn-val').className = lang === 'val' ? activeClass : inactiveClass;
      localStorage.setItem('lang', lang);
    }
    setLang(localStorage.getItem('lang') || 'es');
  </script>
</body>
</html>
```

- [ ] **Step 2: Open landing.html in browser and verify all sections**

Open `basketball-manager/landing.html` directly in a browser (file:// or via `npx serve .` from the basketball-manager directory).

Expected: all 8 sections visible — nav, hero with matrix mockup, problema, features entrenadores, features clubs, pricing (3 columns), CTA final, footer.

- [ ] **Step 3: Verify language toggle**

Click "VAL" in the nav toggle. Expected: all text changes to Valencian, toggle button highlights VAL. Reload the page — Expected: VAL still active (localStorage persisted). Click "ES" — Expected: returns to Spanish.

- [ ] **Step 4: Verify pricing CTAs**

- "Empezar gratis" → links to `/`
- "Hazte Pro" → links to `/subscribe`
- "Ver plan Club" → links to `/club-subscribe`
- "Entrar" in nav → links to `/`
- "Empieza gratis" hero → links to `/`
- "Ver planes" → scrolls to `#pricing`

- [ ] **Step 5: Verify responsive layout**

Resize browser to mobile width (~375px). Expected: hero buttons stack vertically, feature cards stack to 1 column, pricing cards stack to 1 column, nav remains usable.

- [ ] **Step 6: Verify matrix mockup appearance**

In the hero mockup: row 3 (#11 López) shows red cells with ✕ (error state), rows 1/2/4 show orange cells with ✓ (valid), row 5 has only 1 period assigned. Legend shows orange and red indicators.
