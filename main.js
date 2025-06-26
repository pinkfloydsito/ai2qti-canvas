import { app, BrowserWindow, Menu, dialog, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets/icon.png')
  });

  // Check if we're in development mode
  const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Assessment',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('new-assessment');
          }
        },
        {
          label: 'Open Assessment',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openFile'],
              filters: [
                { name: 'JSON Files', extensions: ['json'] }
              ]
            });
            
            if (!result.canceled) {
              mainWindow.webContents.send('open-assessment', result.filePaths[0]);
            }
          }
        },
        {
          label: 'Save Assessment',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow.webContents.send('save-assessment');
          }
        },
        { type: 'separator' },
        {
          label: 'Export QTI',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            mainWindow.webContents.send('export-qti');
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

ipcMain.handle('save-file', async (event, data, defaultPath) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultPath,
    filters: [
      { name: 'QTI Files', extensions: ['xml'] },
      { name: 'JSON Files', extensions: ['json'] }
    ]
  });

  if (!result.canceled) {
    try {
      fs.writeFileSync(result.filePath, data);
      return { success: true, filePath: result.filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  return { success: false, canceled: true };
});

ipcMain.handle('load-file', async (event, filePath) => {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Export QTI handler
ipcMain.handle('export-qti', async (event, qtiXML) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: 'assessment.xml',
      filters: [
        { name: 'QTI Files', extensions: ['xml'] },
        { name: 'XML Files', extensions: ['xml'] }
      ]
    });

    if (!result.canceled) {
      fs.writeFileSync(result.filePath, qtiXML);
      return { success: true, filePath: result.filePath };
    }
    
    return { success: false, canceled: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Save assessment handler
ipcMain.handle('save-assessment', async (event, assessmentData) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: 'assessment.json',
      filters: [
        { name: 'JSON Files', extensions: ['json'] }
      ]
    });

    if (!result.canceled) {
      fs.writeFileSync(result.filePath, JSON.stringify(assessmentData, null, 2));
      return { success: true, filePath: result.filePath };
    }
    
    return { success: false, canceled: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Load assessment handler
ipcMain.handle('load-assessment', async (event) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'JSON Files', extensions: ['json'] }
      ]
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      const data = fs.readFileSync(result.filePaths[0], 'utf8');
      const assessment = JSON.parse(data);
      return { success: true, assessment };
    }
    
    return { success: false, canceled: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Select PDF file handler
ipcMain.handle('select-pdf-file', async (event) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'PDF Files', extensions: ['pdf'] }
      ]
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      return { success: true, filePath: result.filePaths[0] };
    }
    
    return { success: false, canceled: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

app.whenReady().then(() => {
  createWindow();
  createMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});