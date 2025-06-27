const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Assessment operations
  saveAssessment: (assessmentData) => ipcRenderer.invoke('save-assessment', assessmentData),
  loadAssessment: () => ipcRenderer.invoke('load-assessment'),
  exportQTI: (qtiXML) => ipcRenderer.invoke('export-qti', qtiXML),

  // File operations
  selectPDFFile: () => ipcRenderer.invoke('select-pdf-file'),

  // Menu events
  onNewAssessment: (callback) => ipcRenderer.on('new-assessment', callback),
  onOpenAssessment: (callback) => ipcRenderer.on('open-assessment', callback),
  onSaveAssessment: (callback) => ipcRenderer.on('save-assessment-menu', callback),
  onExportQTI: (callback) => ipcRenderer.on('export-qti-menu', callback),
  extractText: (arrayBuffer) => ipcRenderer.invoke('extract-pdf-text', arrayBuffer),

  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),

  // System info
  platform: process.platform,
  versions: process.versions
});
