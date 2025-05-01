// Mock de socket.io
jest.mock('socket.io', () => ({
  Server: jest.fn(() => ({
    on: jest.fn(),
    emit: jest.fn()
  }))
}));

// Mock de las variables de entorno
process.env.PUBMED_API_KEY = 'test_pubmed_key';
process.env.CLAUDE_API_KEY = 'test_claude_key'; 