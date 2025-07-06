require('@testing-library/jest-dom');

global.ipcRenderer = {
  invoke: jest.fn(),
  on: jest.fn(),
  send: jest.fn()
};

global.require = jest.fn((module) => {
  if (module === 'electron') {
    return {
      ipcRenderer: global.ipcRenderer
    };
  }
  return jest.requireActual(module);
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

global.alert = jest.fn();

// Mock electron-log for testing
jest.mock('electron-log/main.js', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  transports: {
    file: { level: 'info' },
    console: { level: 'debug' }
  }
}));

// Mock electron-log for renderer (alternative import)
jest.mock('electron-log', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  transports: {
    file: { level: 'info' },
    console: { level: 'debug' }
  }
}));