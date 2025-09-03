import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import app from "../src/app.js";
import * as service from "../src/services/ventas.service.js";

describe("POST /api/ventas", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("crea venta", async () => {
    vi.spyOn(service, "createVenta").mockResolvedValue({
      ok: true,
      idBoleta: 1,
      numero: "B-1",
      idCliente: 1,
      origenUbicacion: 2,
      items: [{ idProducto: 1, cantidad: 1 }],
      totales: { neto: 100, iva: 19, total: 119 },
    });
    const res = await request(app)
      .post("/api/ventas")
      .set("x-user-id", "1")
      .send({
        numero: "B-1",
        idCliente: 1,
        origenUbicacion: 2,
        items: [{ idProducto: 1, cantidad: 1 }],
      });
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
  });

  it("body inválido -> 400", async () => {
    const res = await request(app)
      .post("/api/ventas")
      .set("x-user-id", "1")
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation error");
  });
});
