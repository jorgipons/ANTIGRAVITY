# Guía de Despliegue en GitHub Pages

Esta aplicación es "estática" (solo HTML, CSS y JS), por lo que **no necesita compilación**. Puedes alojarla gratuitamente en **GitHub Pages**.

## Pasos para Publicar

### 1. Preparar el repositorio local
Abre una terminal en la carpeta `basketball-trainer`:

```bash
cd c:\Users\jorgi\Documents\ANTIGRAVITY\basketball-trainer
git init
git add .
git commit -m "Initial commit: Basketball Trainer App"
```

### 2. Crear el repositorio en GitHub
1.  Ve a [GitHub.com](https://github.com) y loguéate.
2.  Haz clic en el botón **"New"** (Nuevo repositorio).
3.  Nombre del repositorio: `basketball-trainer` (o el que quieras).
4.  Público o Privado: Elige **Público** (gratis para GitHub Pages) o Privado (si tienes cuenta Pro).
5.  Haz clic en **Create repository**.

### 3. Subir el código
Copia los comandos que te da GitHub en la sección "…or push an existing repository from the command line". Serán algo así:

```bash
git remote add origin https://github.com/TU_USUARIO/basketball-trainer.git
git branch -M main
git push -u origin main
```

### 4. Activar GitHub Pages
1.  En la página de tu repositorio en GitHub, ve a **Settings** (Configuración).
2.  En el menú lateral izquierdo, haz clic en **Pages**.
3.  En "Source", selecciona **Deploy from a branch**.
4.  En "Branch", selecciona **main** y la carpeta **/(root)**.
5.  Haz clic en **Save**.

### 5. ¡Listo!
GitHub tardará unos segundos/minutos. Verás un mensaje arriba que dice:
> "Your site is live at https://TU_USUARIO.github.io/basketball-trainer/"

Haz clic en ese enlace y podrás usar tu aplicación desde cualquier dispositivo.
