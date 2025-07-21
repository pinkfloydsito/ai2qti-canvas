const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Assessment operations
  saveAssessment: (assessmentData) => ipcRenderer.invoke('save-assessment', assessmentData),
  loadAssessment: () => ipcRenderer.invoke('load-assessment'),
  exportQTI: (qtiXML) => ipcRenderer.invoke('export-qti', qtiXML),

  // File operations - PDF disabled to prevent DOMMatrix issues
  // selectPDFFile: () => ipcRenderer.invoke('select-pdf-file'),
  // extractText: (arrayBuffer) => ipcRenderer.invoke('extract-pdf-text', arrayBuffer),
  
  // File upload operations for AI attachments
  saveTemporaryFile: async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await ipcRenderer.invoke('save-temporary-file', arrayBuffer, file.name);
    return result.tempPath;
  },
  cleanupTemporaryFiles: () => ipcRenderer.invoke('cleanup-temporary-files'),

  // LLM operations
  configureLLM: (provider, apiKey) => ipcRenderer.invoke('configure-llm', provider, apiKey),
  testApiKey: (provider, apiKey) => ipcRenderer.invoke('test-api-key', provider, apiKey),
  generateQuestions: (context, options) => ipcRenderer.invoke('generate-questions', context, options),
  getCachedApiKey: (provider) => ipcRenderer.invoke('get-cached-api-key', provider),

  // Menu events
  onNewAssessment: (callback) => ipcRenderer.on('new-assessment', callback),
  onOpenAssessment: (callback) => ipcRenderer.on('open-assessment', callback),
  onSaveAssessment: (callback) => ipcRenderer.on('save-assessment-menu', callback),
  onExportQTI: (callback) => ipcRenderer.on('export-qti-menu', callback),

  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),

  // System info
  platform: process.platform,
  versions: process.versions
});
