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