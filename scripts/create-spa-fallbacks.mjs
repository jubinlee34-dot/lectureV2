import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

const distDir = path.resolve("dist");
const indexFile = path.join(distDir, "index.html");
const routes = [
  "setup",
  "calendar",
  "todos",
  "workflow",
  "profile",
  "lectures",
  "search",
];

await Promise.all(
  routes.map(async (route) => {
    const routeDir = path.join(distDir, route);
    await mkdir(routeDir, { recursive: true });
    await copyFile(indexFile, path.join(routeDir, "index.html"));
  })
);
