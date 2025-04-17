import http from 'http';

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Servidor de prueba funcionando correctamente');
});

const PORT = 9000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor de prueba escuchando en http://localhost:${PORT}`);
}); 