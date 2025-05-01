import '@testing-library/jest-dom';

// Mock de window.matchMedia
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

// Mock de SweetAlert2
jest.mock('sweetalert2', () => ({
  fire: jest.fn(),
  close: jest.fn(),
  showLoading: jest.fn(),
  getPopup: jest.fn(),
  getHtmlContainer: jest.fn(),
  update: jest.fn()
}));

// Mock de socket.io-client
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    on: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn()
  }))
})); 