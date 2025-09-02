import express from "express";
import "dotenv/config";
import cors from "cors";
import oracledb from "oracledb";

import ventas from "./routes/ventas.js";
import clientes from "./routes/clientes.js";
import { initPool, isDbHealthy } from "./db.js";

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Health
app.get("/health", (_req, res) => {
  res.json({ db: isDbHealthy() ? "up" : "down" });
});

// Rutas
app.use("/api/ventas", ventas);
app.use("/api/clientes", clientes);

// Config puertos
const PORT = Number(process.env.API_PORT ?? process.env.PORT ?? 4000);
const allowStartWithoutDb = process.env.ALLOW_START_WITHOUT_DB === "true";

// Arranque
initPool()
  .catch((err: any) => {
    console.error("No se pudo conectar a la base de datos:", err?.message ?? err);
    if (!allowStartWithoutDb) {
      process.exit(1);
    }
    console.warn("Continuando sin conexión a la BD por ALLOW_START_WITHOUT_DB=true");
  })
  .finally(() => {
    const server = app.listen(PORT, () => {
      console.log(`API en http://localhost:${PORT}`);
    });

    server.on("error", (err: any) => {
      if (err && err.code === "EADDRINUSE") {
        console.error(`Puerto ${PORT} en uso.`);
      } else {
        console.error(err);
      }
      process.exit(1);
    });
  });

// 404 y handler de errores
app.use((_req, res) => res.status(404).json({ error: "Not found" }));
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: err?.message ?? "Internal error" });
});

// Graceful shutdown
function shutdown(signal: string) {
  console.log(`\nRecibido ${signal}, cerrando...`);
  Promise.resolve()
    .then(async () => {
      try {
        // cierra el pool si existe
        const pool = oracledb.getPool();
        await pool.close(5);
      } catch {
        // pool no iniciado o ya cerrado
      }
    })
    .finally(() => process.exit(0))
    .catch((err) => {
      console.error("Error al cerrar pool:", err);
      process.exit(1);
    });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// (opcional) exporta app para tests e2e/supertest
export default app;
