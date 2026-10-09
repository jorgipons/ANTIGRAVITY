export const ONBOARDING_SLIDES = [
  {
    key: 'welcome',
    icon: '🏀',
    title: 'Bienvenido a partits.',
    body: 'La app para gestionar tu equipo de baloncesto siguiendo el reglamento de Pasarela de la FBCV. Convocatorias, partidos, sustituciones y mucho más.',
  },
  {
    key: 'team',
    icon: '👥',
    title: 'Tu equipo',
    body: 'Crea tu equipo y añade jugadores con su número y posición. Elige el modo de partido: Pasarela 8P (reglamento oficial FBCV), Pasarela 6P o Libre.',
  },
  {
    key: 'matches',
    icon: '📋',
    title: 'Tus partidos',
    body: 'Crea partidos con rival, fecha, hora y lugar. Comparte el enlace de convocatoria con los padres para que confirmen asistencia desde su móvil sin instalar la app.',
  },
  {
    key: 'matrix',
    icon: '🔢',
    title: 'La Matriz',
    body: 'La cuadrícula muestra jugadores × periodos. Toca una celda para asignar o quitar un jugador.\n\n🟢 Verde — cumple Pasarela\n🟡 Amarillo — en el límite\n🔴 Rojo — infringe la norma\n\nUsa el botón ⓘ de cada pantalla para un tour guiado paso a paso.',
  },
  {
    key: 'ready',
    icon: '🎉',
    title: '¡Todo listo!',
    body: 'Ya puedes empezar a gestionar tus partidos. En cada pantalla encontrarás el botón ? para un tour guiado que explica cada elemento. Consulta esta guía cuando quieras desde el menú lateral.',
  },
];

export const SCREEN_HELP = {
  teams: {
    title: 'Mis Equipos',
    icon: '🏠',
    sections: [
      {
        heading: 'Crear un equipo',
        text: 'Pulsa el botón + en la esquina superior derecha. Dale un nombre, selecciona el modo de partido y añade jugadores desde la ficha del equipo.',
      },
      {
        heading: 'Tarjeta del equipo',
        text: 'Cada tarjeta muestra el nombre del equipo, el número de jugadores y el próximo partido (rival, fecha, hora y si es en casa o fuera). Toca la tarjeta para abrir la ficha.',
      },
      {
        heading: 'Tour guiado',
        text: 'Pulsa el botón ? en el header de cualquier pantalla para activar el tour interactivo, que señala y explica cada elemento de la pantalla paso a paso.',
      },
    ],
  },
  teamDetail: {
    title: 'Ficha del Equipo',
    icon: '📋',
    sections: [
      {
        heading: 'Jugadores',
        text: 'Añade jugadores con nombre, número de dorsal y posición. Los jugadores se guardan en el equipo y están disponibles para todos los partidos. Puedes editar o eliminar cualquier jugador tocando su tarjeta.',
      },
      {
        heading: 'Configurar equipo',
        text: 'Desde el botón "Configurar" puedes cambiar el nombre del equipo, el modo de partido y los roles y colores de cada posición. Aquí también introduces el ID de federación FBCV para sincronizar partidos automáticamente.',
      },
      {
        heading: 'Modos de partido',
        text: 'Pasarela 8P — reglamento oficial FBCV: 8 periodos, mínimo 2 y máximo 3 en los primeros 6, checkpoint en el periodo 6.\n\nPasarela 6P — versión de 6 periodos para categorías menores.\n\nLibre — sin restricciones de minutos.',
      },
      {
        heading: 'Sincronización FBCV',
        text: 'Si introduces el ID de federación, aparece la tarjeta "Federació FBCV". Usa el botón Sincro para importar automáticamente el calendario de partidos desde la web de la FBCV. También muestra la clasificación actual del equipo.',
      },
    ],
  },
  matchList: {
    title: 'Partidos',
    icon: '🗓️',
    sections: [
      {
        heading: 'Crear un partido',
        text: 'Pulsa + para añadir un nuevo partido. Rellena rival, fecha, hora, lugar, si es en casa o fuera, y la hora de llamada. Todos estos datos se incluyen en el mensaje de convocatoria que compartes.',
      },
      {
        heading: 'Estados del partido',
        text: 'Pendiente → aún no ha empezado, puedes editar todos los datos.\nEn curso → acceso activo a la matriz de sustituciones.\nFinalizado → el partido ha terminado, los datos quedan guardados.',
      },
      {
        heading: 'Acciones rápidas',
        text: 'Cada partido tiene tres acciones directas:\n\n👥 Asistencia — abre la pantalla de convocatoria para ver quién viene.\n✏️ Editar — modifica los datos del partido.\n🏀 Partido — abre la matriz de sustituciones.',
      },
    ],
  },
  matchAttendance: {
    title: 'Convocatoria',
    icon: '👥',
    sections: [
      {
        heading: 'Cómo funciona',
        text: 'El flujo es: (1) convocas a los jugadores desde la pantalla del partido, (2) compartes el enlace con los padres, (3) los padres confirman desde su móvil sin instalar la app, (4) ves en tiempo real quién viene y quién no.',
      },
      {
        heading: 'Convocar jugadores',
        text: 'Los jugadores convocados se gestionan desde la pantalla del partido. El icono X gris junto al nombre retira a un jugador de la convocatoria. Despliega la sección "CONVOCADOS" para ver y gestionar la lista completa.',
      },
      {
        heading: 'Confirmar asistencia',
        text: 'Como entrenador puedes marcar manualmente: ✓ verde si un jugador viene, ✗ rojo si no viene. Los jugadores y padres también pueden confirmar directamente desde el enlace web, sin instalar la app.',
      },
      {
        heading: 'Compartir convocatoria',
        text: 'El botón de compartir (esquina superior derecha) ofrece varias opciones:\n\n• Convocatoria completa (info + lista de convocados) en castellano o valenciano — ideal para WhatsApp.\n• Solo info del partido — para recordatorios de última hora.\n• Link Padres — enlace web donde confirman asistencia.\n• Link Entrenador — vista completa con todos los estados.',
      },
      {
        heading: 'Resumen de asistencia',
        text: 'Los contadores del header muestran en tiempo real cuántos jugadores vienen (verde), no vienen (rojo) y están pendientes de responder (gris).',
      },
    ],
  },
  matchMatrix: {
    title: 'Matriz de Sustituciones',
    icon: '🔢',
    sections: [
      {
        heading: 'Cómo funciona',
        text: 'La cuadrícula muestra un jugador por fila y un periodo por columna. Toca una celda para asignar ese jugador a ese periodo. Vuelve a tocarla para quitarlo. Pulsación larga sobre una celda para vaciar todos los periodos de ese jugador de golpe.',
      },
      {
        heading: 'Colores Pasarela',
        text: '⬜ Sin color — el jugador puede jugar ese periodo sin problema.\n🟡 Naranja — está en el límite (puede jugar, pero con cuidado).\n🔴 Rojo — infringe la norma Pasarela (mínimo o máximo superado).',
      },
      {
        heading: 'Reglamento Pasarela 8P',
        text: 'En los primeros 6 periodos, cada jugador debe jugar mínimo 2 y máximo 3. Checkpoint en el periodo 6: todo el mundo debe haber jugado ya su mínimo. El total son 8 periodos regulares + prórrogas opcionales.',
      },
      {
        heading: 'Gestionar jugadores',
        text: 'Toca la posición de un jugador para cambiar su rol en este partido. El icono X gris al lado del nombre retira al jugador de la convocatoria. Los jugadores se pueden ordenar por posición o por número de dorsal.',
      },
      {
        heading: 'Vistas',
        text: 'La matriz ofrece tres formas de ver los datos:\n\n• Cuadrícula — vista completa jugadores × periodos.\n• Por periodos — lista de qué jugadores hay en cada periodo.\n• Compacta — resumen visual con los contadores de cada jugador.',
      },
      {
        heading: 'Prórroga y edición libre',
        text: 'Pulsa "+ Prórroga" para añadir periodos extra al partido. El toggle "Edición libre" desactiva la validación Pasarela para distribuir jugadores sin restricciones.',
      },
    ],
  },
  calendar: {
    title: 'Calendario',
    icon: '📅',
    sections: [
      {
        heading: 'Vista multi-equipo',
        text: 'El calendario muestra los partidos de todos tus equipos juntos. Los días con partido aparecen marcados. Navega por los meses con las flechas.',
      },
      {
        heading: 'Lista de próximos partidos',
        text: 'Debajo del calendario aparece la lista de los próximos partidos ordenados por fecha, con equipo, rival, hora y si es en casa o fuera. Toca cualquiera para ir directamente a su matriz de sustituciones.',
      },
    ],
  },
};
