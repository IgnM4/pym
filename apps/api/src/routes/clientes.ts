import { Router } from "express";
import oracledb from "oracledb";

const router = Router();

// GET /api/clientes  -> lista últimos 100
router.get("/", async (_req, res) => {
  try {
    const conn = await oracledb.getPool().getConnection();
    try {
      const result = await conn.execute(
        `SELECT 
           ID         as "id",
           RUT        as "rut",
           NOMBRE     as "nombre",
           DIRECCION  as "direccion",
           TELEFONO   as "telefono",
           EMAIL      as "email",
           CREATED_AT as "createdAt"
         FROM CLIENTES
         ORDER BY ID DESC
         FETCH FIRST 100 ROWS ONLY`,
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      res.json(result.rows ?? []);
    } finally {
      await conn.close();
    }
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});

// GET /api/clientes/:id
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "id inválido" });
  try {
    const conn = await oracledb.getPool().getConnection();
    try {
      const result = await conn.execute(
        `SELECT 
           ID         as "id",
           RUT        as "rut",
           NOMBRE     as "nombre",
           DIRECCION  as "direccion",
           TELEFONO   as "telefono",
           EMAIL      as "email",
           CREATED_AT as "createdAt"
         FROM CLIENTES
         WHERE ID = :id`,
        { id },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const row = (result.rows ?? [])[0] as any;
      if (!row) return res.status(404).json({ error: "No encontrado" });
      res.json(row);
    } finally {
      await conn.close();
    }
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});

// POST /api/clientes
router.post("/", async (req, res) => {
  const { rut, nombre, direccion, telefono, email } = req.body ?? {};
  if (!rut || !nombre) {
    return res.status(400).json({ error: "rut y nombre son obligatorios" });
  }
  try {
    const conn = await oracledb.getPool().getConnection();
    try {
      const result = await conn.execute(
        `INSERT INTO CLIENTES (RUT, NOMBRE, DIRECCION, TELEFONO, EMAIL)
         VALUES (:rut, :nombre, :direccion, :telefono, :email)
         RETURNING ID INTO :id`,
        {
          rut,
          nombre,
          direccion,
          telefono,
          email,
          id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
        },
        { autoCommit: true }
      );
      const id = (result.outBinds as any).id?.[0];
      res.status(201).json({ id, rut, nombre, direccion, telefono, email });
    } finally {
      await conn.close();
    }
  } catch (err: any) {
    console.error(err);
    // Si configuras un índice único en RUT, esto mapea el ORA-00001 a 409
    if (typeof err?.message === "string" && err.message.includes("ORA-00001")) {
      return res.status(409).json({ error: "RUT ya existe" });
    }
    res.status(500).json({ error: err.message ?? String(err) });
  }
});

// PUT /api/clientes/:id  (actualiza)
router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "id inválido" });

  const { rut, nombre, direccion, telefono, email } = req.body ?? {};
  if (!rut || !nombre) return res.status(400).json({ error: "rut y nombre son obligatorios" });

  try {
    const conn = await oracledb.getPool().getConnection();
    try {
      const result = await conn.execute(
        `UPDATE CLIENTES
           SET RUT=:rut, NOMBRE=:nombre, DIRECCION=:direccion, TELEFONO=:telefono, EMAIL=:email
         WHERE ID=:id`,
        { id, rut, nombre, direccion, telefono, email },
        { autoCommit: true }
      );
      if ((result.rowsAffected ?? 0) === 0) return res.status(404).json({ error: "No encontrado" });
      res.json({ id, rut, nombre, direccion, telefono, email });
    } finally {
      await conn.close();
    }
  } catch (err: any) {
    console.error(err);
    if (typeof err?.message === "string" && err.message.includes("ORA-00001")) {
      return res.status(409).json({ error: "RUT ya existe" });
    }
    res.status(500).json({ error: err.message ?? String(err) });
  }
});

// DELETE /api/clientes/:id
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "id inválido" });
  try {
    const conn = await oracledb.getPool().getConnection();
    try {
      const result = await conn.execute(
        `DELETE FROM CLIENTES WHERE ID=:id`,
        { id },
        { autoCommit: true }
      );
      if ((result.rowsAffected ?? 0) === 0) return res.status(404).json({ error: "No encontrado" });
      res.status(204).send();
    } finally {
      await conn.close();
    }
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message ?? String(err) });
  }
});

export default router;
