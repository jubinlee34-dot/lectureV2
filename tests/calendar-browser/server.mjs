// Isolated UI fixture: never loaded by the production app or its Vite config.
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(root, "../..");
const server = await createServer({
  configFile: false,
  root,
  envFile: false,
  define: {
    "import.meta.env.VITE_GOOGLE_CLIENT_ID": JSON.stringify("fixture-client"),
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      {
        find: "@/contexts/AuthContext",
        replacement: path.join(root, "auth.tsx"),
      },
      { find: "@", replacement: path.join(repo, "client/src") },
      { find: "@shared", replacement: path.join(repo, "shared") },
    ],
  },
  server: {
    host: "127.0.0.1",
    port: 4184,
    strictPort: true,
    fs: { allow: [repo] },
  },
});
await server.listen();
server.printUrls();
