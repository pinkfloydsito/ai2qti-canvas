# Generador de QTI para Canvas LMS - Instalador de Windows

Esta guía te ayudará a crear un instalador para Windows del Generador de QTI, permitiendo a los usuarios instalar la aplicación fácilmente sin conocimientos técnicos.

## Requisitos Previos

Antes de crear el instalador, asegúrate de tener:

1. **Node.js** (versión 16 o superior) instalado en Windows
2. **Git** para descargar el código
3. **Herramientas de construcción de Windows** (build tools)

## Paso 1: Preparar el Entorno

### Instalar Node.js
1. Descargar Node.js desde [nodejs.org](https://nodejs.org/)
2. Elegir la versión LTS (recomendada)
3. Ejecutar el instalador y seguir las instrucciones
4. Verificar la instalación abriendo PowerShell y ejecutando:
   ```powershell
   node --version
   npm --version
   ```

### Instalar Git
1. Descargar Git desde [git-scm.com](https://git-scm.com/)
2. Ejecutar el instalador con configuración predeterminada
3. Verificar con: `git --version`

## Paso 2: Descargar y Configurar el Proyecto

```powershell
# Clonar el repositorio
git clone https://github.com/tu-usuario/qti-generator.git
cd qti-generator

# Instalar dependencias
npm install

# Instalar herramientas de empaquetado
npm install -g electron-builder
npm install electron-builder --save-dev
```

## Paso 3: Configurar Electron Builder

Actualizar el archivo `package.json` con la configuración de Windows:

```json
{
  "name": "qti-generator",
  "version": "1.0.0",
  "description": "Generador de QTI para Canvas LMS",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "test": "jest",
    "build": "electron-builder",
    "build:win": "electron-builder --win",
    "dist": "electron-builder --publish=never"
  },
  "build": {
    "appId": "com.qtigenerator.app",
    "productName": "Generador de QTI",
    "directories": {
      "output": "dist"
    },
    "files": [
      "**/*",
      "!**/node_modules/**/*",
      "!**/*.md",
      "!**/tests/**/*"
    ],
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": ["x64", "ia32"]
        },
        {
          "target": "portable",
          "arch": ["x64"]
        }
      ],
      "icon": "assets/icon.ico",
      "requestedExecutionLevel": "asInvoker"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "installerIcon": "assets/icon.ico",
      "uninstallerIcon": "assets/icon.ico",
      "installerHeaderIcon": "assets/icon.ico",
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "Generador de QTI",
      "include": "installer.nsh"
    },
    "portable": {
      "artifactName": "GeneradorQTI-Portable-${version}.${ext}"
    }
  }
}
```

## Paso 4: Crear Recursos del Instalador

### Crear Iconos
1. Crear carpeta `assets/` en la raíz del proyecto
2. Añadir icono de la aplicación:
   - `icon.ico` (256x256 píxeles, formato ICO)
   - `icon.png` (512x512 píxeles, formato PNG)

### Script NSIS Personalizado
Crear archivo `installer.nsh`:

```nsis
!macro customInstall
  DetailPrint "Instalando Generador de QTI..."
  ; Crear accesos directos adicionales
  CreateShortCut "$DESKTOP\Generador de QTI.lnk" "$INSTDIR\Generador de QTI.exe"
!macroend

!macro customUnInstall
  DetailPrint "Desinstalando Generador de QTI..."
  ; Limpiar archivos de configuración
  RMDir /r "$APPDATA\qti-generator"
  Delete "$DESKTOP\Generador de QTI.lnk"
!macroend
```

## Paso 5: Construir el Instalador

### Preparar para Producción
```powershell
# Limpiar dependencias de desarrollo
npm prune --production

# Construir solo para Windows
npm run build:win
```

### Construir Múltiples Formatos
```powershell
# Construir instalador NSIS y versión portable
electron-builder --win --x64 --ia32
```

## Paso 6: Estructura de Salida

Después de la construcción, encontrarás en la carpeta `dist/`:

```
dist/
├── GeneradorQTI Setup 1.0.0.exe          # Instalador NSIS (64-bit)
├── GeneradorQTI Setup 1.0.0-ia32.exe     # Instalador NSIS (32-bit)
├── GeneradorQTI-Portable-1.0.0.exe       # Versión portable
└── win-unpacked/                          # Archivos sin empaquetar
```

## Paso 7: Personalización del Instalador

### Idioma Español
Crear archivo `build/installer-es.nsh`:

```nsis
LangString ^NameDA ${LANG_SPANISH} "Generador de QTI para Canvas LMS"
LangString ^UninstallLink ${LANG_SPANISH} "Desinstalar Generador de QTI"
LangString ^Shortcut ${LANG_SPANISH} "Generador de QTI"
```

### Licencia en Español
Crear archivo `build/license-es.txt`:

```
ACUERDO DE LICENCIA DE SOFTWARE

Este software se proporciona "tal como está", sin garantías de ningún tipo.
El uso de este software está sujeto a los términos y condiciones aquí establecidos.

Al instalar este software, usted acepta:
- Usar el software únicamente para fines educativos
- No redistribuir el software sin autorización
- Reportar errores y problemas al desarrollador

Para más información, visite: https://github.com/tu-usuario/qti-generator
```

## Paso 8: Automatización con Scripts

### Script de Construcción (`build.bat`)
```bat
@echo off
echo Construyendo Generador de QTI para Windows...

REM Limpiar directorio de distribución
if exist "dist" rmdir /s /q "dist"

REM Instalar dependencias
npm install

REM Construir aplicación
npm run build:win

echo.
echo ¡Construcción completada!
echo Los archivos se encuentran en la carpeta 'dist/'
pause
```

### Script de Desarrollo (`dev.bat`)
```bat
@echo off
echo Iniciando Generador de QTI en modo desarrollo...

REM Instalar dependencias si es necesario
if not exist "node_modules" npm install

REM Iniciar aplicación
npm start
```

## Paso 9: Distribución

### Opciones de Distribución

1. **Instalador NSIS** (`GeneradorQTI Setup 1.0.0.exe`)
   - Instalación tradicional de Windows
   - Crea entradas en Programas y características
   - Accesos directos en escritorio y menú inicio

2. **Versión Portable** (`GeneradorQTI-Portable-1.0.0.exe`)
   - No requiere instalación
   - Se puede ejecutar desde USB
   - No modifica el registro de Windows

### Subir a GitHub Releases

```powershell
# Crear release en GitHub
gh release create v1.0.0 dist/*.exe --title "Generador de QTI v1.0.0" --notes "Primera versión estable"
```

## Paso 10: Instalación para Usuarios Finales

### Instrucciones para Usuarios

1. **Descarga**: Visitar [releases en GitHub](https://github.com/tu-usuario/qti-generator/releases)
2. **Elegir versión**:
   - Instalador completo: `GeneradorQTI Setup 1.0.0.exe`
   - Versión portable: `GeneradorQTI-Portable-1.0.0.exe`
3. **Ejecutar instalador** y seguir instrucciones
4. **Configurar clave API** de Gemini en la aplicación

### Requisitos del Sistema
- Windows 10 o superior (64-bit recomendado)
- 100 MB de espacio libre
- Conexión a internet para usar la IA
- Clave API de Google Gemini

## Solución de Problemas

### Errores Comunes

1. **"La aplicación no puede iniciarse"**
   - Verificar que Visual C++ Redistributable esté instalado
   - Descargar desde Microsoft si es necesario

2. **"Error de permisos"**
   - Ejecutar como administrador
   - Verificar permisos de carpeta de instalación

3. **"Node.js no encontrado"**
   - El instalador incluye Node.js empaquetado
   - No es necesario instalar Node.js por separado

### Logs de Depuración
Los logs se encuentran en:
- `%APPDATA%\qti-generator\logs\`
- Activar modo desarrollo con `Ctrl+Shift+I`

## Mantenimiento

### Actualizaciones
1. Modificar versión en `package.json`
2. Construir nuevo instalador
3. Subir a GitHub Releases
4. Notificar a usuarios

### Feedback de Usuarios
- Configurar sistema de reporte de errores
- Crear formulario de feedback en GitHub Issues
- Documentar casos de uso comunes

---

Con estas instrucciones, puedes crear un instalador profesional de Windows para el Generador de QTI que será fácil de usar para profesores y administradores educativos.