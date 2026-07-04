import { createServer } from 'vite';
import net from 'node:net';

const requestedMode = process.argv[2] ?? 'owner';
const react = (await import('@vitejs/plugin-react')).default();
const preferredTargets =
  requestedMode === 'both'
    ? [
        ['owner', 5173],
        ['tablet', 5174],
      ]
    : [[requestedMode, Number(process.argv[3] ?? (requestedMode === 'tablet' ? 5174 : 5173))]];

const usedPorts = new Set();
const targets = [];
for (const [mode, preferredPort] of preferredTargets) {
  const port = await findAvailablePort(preferredPort, usedPorts);
  usedPorts.add(port);
  targets.push([mode, port]);
}

const tabletTarget = targets.find(([mode]) => mode === 'tablet');
const tabletOrigin = tabletTarget ? `http://localhost:${tabletTarget[1]}` : 'http://localhost:5174';

const servers = await Promise.all(
  targets.map(async ([mode, port]) => {
    const server = await createServer({
      mode,
      configFile: false,
      plugins: [react],
      define: {
        'import.meta.env.VITE_TABLET_ORIGIN': JSON.stringify(tabletOrigin),
      },
      server: {
        host: '0.0.0.0',
        port,
        strictPort: true,
      },
    });
    await server.listen();
    return { mode, port, server };
  }),
);

for (const { mode, port, server } of servers) {
  console.log(`\n${mode === 'owner' ? 'Owner' : 'Tablet'} local: http://localhost:${port}`);
  server.printUrls();
}

setInterval(() => undefined, 60_000);

function findAvailablePort(startPort, reservedPorts) {
  return new Promise((resolve, reject) => {
    const tryPort = (port) => {
      if (reservedPorts.has(port)) {
        tryPort(port + 1);
        return;
      }

      const tester = net.createServer();
      tester.once('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          tryPort(port + 1);
          return;
        }
        reject(error);
      });
      tester.once('listening', () => {
        tester.close(() => resolve(port));
      });
      tester.listen(port, '0.0.0.0');
    };

    tryPort(startPort);
  });
}
