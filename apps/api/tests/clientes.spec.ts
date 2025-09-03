import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import app from "../src/app.js";
import * as service from "../src/services/clientes.service.js";

const sample = {
  id: 1,
  rut: "1-9",
  nombre: "Juan",
  direccion: "dir",
  telefono: "123",
  email: "a@b.c",
};

describe("GET /api/clientes/:id", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("retorna cliente", async () => {
    vi.spyOn(service, "getCliente").mockResolvedValue(sample);
    const res = await request(app).get("/api/clientes/1");
    expect(res.status).toBe(200);
    expect(res.body).toEqual(sample);
  });

  it("id inválido -> 400", async () => {
    const res = await request(app).get("/api/clientes/abc");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation error");
  });
});
