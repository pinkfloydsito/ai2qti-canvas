import { writable } from 'svelte/store';

// Thinking log store for displaying generation process logs
export const thinkingLogStore = writable({
  logs: [],
  isVisible: false,
  maxLogs: 100 // Keep only last 100 logs for performance
});

// Helper functions for thinking log operations
export const thinkingLogActions = {
  show: () => {
    thinkingLogStore.update(store => ({ ...store, isVisible: true }));
  },

  hide: () => {
    thinkingLogStore.update(store => ({ ...store, isVisible: false }));
  },

  toggle: () => {
    thinkingLogStore.update(store => ({ ...store, isVisible: !store.isVisible }));
  },

  addLog: (type, message, details = null) => {
    const log = {
      id: Date.now() + Math.random(),
      type, // 'info', 'success', 'warning', 'error', 'thinking', 'processing'
      message,
      details,
      timestamp: Date.now()
    };

    thinkingLogStore.update(store => {
      const logs = [...store.logs, log];
      // Keep only the last maxLogs entries
      if (logs.length > store.maxLogs) {
        logs.splice(0, logs.length - store.maxLogs);
      }
      return { ...store, logs };
    });
  },

  clearLogs: () => {
    thinkingLogStore.update(store => ({ ...store, logs: [] }));
  },

  // Convenience methods for different log types
  info: (message, details) => thinkingLogActions.addLog('info', message, details),
  success: (message, details) => thinkingLogActions.addLog('success', message, details),
  warning: (message, details) => thinkingLogActions.addLog('warning', message, details),
  error: (message, details) => thinkingLogActions.addLog('error', message, details),
  thinking: (message, details) => thinkingLogActions.addLog('thinking', message, details),
  processing: (message, details) => thinkingLogActions.addLog('processing', message, details)
};