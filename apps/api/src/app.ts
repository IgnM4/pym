import express, { Request, Response, NextFunction } from "express";
import "dotenv/config";
import cors from "cors";

import ventas from "./routes/ventas.js";
import clientes from "./routes/clientes.js";
import { initPool, isDbHealthy, closePool } from "./db.js";

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Health
app.get("/health", (_req: Request, res: Response) => {
  res.json({ db: isDbHealthy() ? "up" : "down" });
});

// Rutas
app.use("/api/ventas", ventas);
app.use("/api/clientes", clientes);

// Config puertos
const PORT: number = Number(process.env.API_PORT ?? process.env.PORT ?? 4000);
const allowStartWithoutDb: boolean = process.env.ALLOW_START_WITHOUT_DB === "true";

// Arranque
initPool()
  .catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("No se pudo conectar a la base de datos:", msg);
    if (!allowStartWithoutDb) {
      process.exit(1);
    }
    console.warn("Continuando sin conexión a la BD por ALLOW_START_WITHOUT_DB=true");
  })
  .finally(() => {
    const server = app.listen(PORT, () => {
      console.log(`API en http://localhost:${PORT}`);
    });

    server.on("error", (err: unknown) => {
      const e = err as NodeJS.ErrnoException;
      if (e && e.code === "EADDRINUSE") {
        console.error(`Puerto ${PORT} en uso.`);
      } else {
        console.error(e);
      }
      process.exit(1);
    });
  });

// 404 y handler de errores
app.use((_req: Request, res: Response) => res.status(404).json({ error: "Not found" }));

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const msg = err instanceof Error ? err.message : "Internal error";
  console.error("Unhandled error:", err);
  res.status(500).json({ error: msg });
});

// Graceful shutdown
async function shutdown(signal: NodeJS.Signals): Promise<void> {
  console.log(`\nRecibido ${signal}, cerrando...`);
  try {
    await closePool();
  } catch (e) {
    console.error("Error al cerrar pool:", e);
    process.exit(1);
    return;
  }
  process.exit(0);
}

process.on("SIGINT", () => { void shutdown("SIGINT"); });
process.on("SIGTERM", () => { void shutdown("SIGTERM"); });

// (opcional) exporta app para tests e2e/supertest
export default app;
