import { createServer } from 'vite';

const mode = process.argv[2] ?? 'owner';
const port = Number(process.argv[3] ?? (mode === 'tablet' ? 5174 : 5173));

const server = await createServer({
  mode,
  configFile: false,
  plugins: [(await import('@vitejs/plugin-react')).default()],
  server: {
    host: '0.0.0.0',
    port,
    strictPort: true,
  },
});

await server.listen();
server.printUrls();

setInterval(() => undefined, 60_000);
