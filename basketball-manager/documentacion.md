# Documentación de la Aplicación: Gestor Basket Pasarela

## 1. Introducción
**Gestor Basket Pasarela** es una aplicación progresiva (PWA) diseñada para ayudar a los entrenadores de baloncesto a gestionar sus equipos y partidos, cumpliendo estrictamente con la normativa de juego "Pasarela". La aplicación permite el seguimiento en tiempo real de los jugadores, sus roles y el tiempo de juego, con persistencia de datos en la nube a través de Firebase.

---

## 2. Funcionalidades Principales

### 2.1 Gestión de Equipos y Jugadores
*   **Creación de Equipos**: Permite registrar múltiples equipos.
*   **Gestión de Plantilla**: Añadir, editar o eliminar jugadores de cada equipo.
*   **Roles Personalizados**: Cada equipo tiene un conjunto de roles (por defecto: Receptor, Medio, Largo, Sacador) que pueden ser personalizados con nombres y colores específicos.

### 2.2 Gestión de Partidos
*   **Configuración de Partido**: Registro de rival, fecha, hora, jornada y si el equipo juega como local o visitante.
*   **Convocatoria**: Selección de los jugadores que participarán en un partido específico.
*   **Jugadores Tardíos**: Posibilidad de añadir jugadores a la convocatoria una vez iniciado el partido.

### 2.3 Seguimiento en Vivo (Matriz de Periodos)
*   **Control de Periodos**: Seguimiento detallado de quién juega en cada uno de los 6 o más periodos.
*   **Asignación de Roles**: Al hacer clic en la matriz, se asignan roles a los jugadores. El sistema sugiere por defecto el rol asignado al jugador en su ficha.
*   **Modo Edición Total**: Permite corregir errores en periodos pasados o planificar periodos futuros desbloqueando la matriz.
*   **Sustituciones por Lesión**: Función específica para registrar cambios obligados por lesión, manteniendo la integridad de las estadísticas de tiempo jugado.

---

## 3. Normativa Pasarela y Validaciones
La aplicación incluye un motor de validación que alerta en tiempo real si se incumple la normativa:
*   **Mínimo de Juego**: Cada jugador debe jugar al menos 2 periodos en los primeros 6.
*   **Máximo de Juego**: Ningún jugador puede jugar más de 4 periodos en los primeros 6.
*   **Descanso Obligatorio**: Cada jugador debe descansar al menos 2 periodos en los primeros 6.
*   **Alertas Visuales**: Los errores se muestran claramente en la cabecera del partido y resaltan al jugador afectado en la tabla.

---

## 4. Guía de Usuario

### 4.1 Crear un Partido
1. Selecciona tu equipo en la pantalla principal.
2. Pulsa en "+ Nuevo Partido".
3. Rellena los datos del rival y selecciona a los jugadores convocados.
4. Pulsa "Crear Partido" para acceder a la matriz.

### 4.2 Gestionar la Matriz
*   **Clic simple**: Añade al jugador al periodo con su rol por defecto.
*   **Clics sucesivos**: Cicla entre los diferentes roles disponibles para ese equipo.
*   **Ciclo final**: Elimina al jugador del periodo.
*   **Cerrar Periodo**: Una vez configurado el quinteto (5 jugadores), pulsa el botón de flecha para avanzar al siguiente periodo.

---

## 5. Aspectos Técnicos y Despliegue

### 5.1 Tecnologías Utilizadas
*   **Frontend**: React (v18), Tailwind CSS, Lucide Icons.
*   **Backend**: Firebase Firestore (Base de datos en tiempo real).
*   **Arquitectura**: Single-page application integrada en un único archivo HTML para facilitar la portabilidad.

### 5.2 Instalación como App (PWA)
Al ser una PWA, no es estrictamente necesario instalarla desde una tienda:
1. Abre la URL en Chrome (Android) o Safari (iOS).
2. Selecciona "Añadir a la pantalla de inicio" o "Instalar".
3. La app aparecerá con su icono y funcionará a pantalla completa sin barras de navegación.

### 5.3 Generación de APK (Android)
Para obtener un archivo `.apk` para Android:
1. Despliega el código en GitHub Pages.
2. Utiliza [PWABuilder.com](https://www.pwabuilder.com/) introduciendo la URL de la web.
3. Configura la "Signing Key" para generar el paquete.

---

## 6. Mantenimiento y Configuración de Datos
Todos los datos se guardan en Firebase. Si se necesita cambiar la base de datos, se debe actualizar la constante `firebaseConfig` en el archivo `index.html` con las nuevas credenciales de proyecto.
