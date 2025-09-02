import { Router } from "express";
import oracledb from "oracledb";
import { getPool } from "../db.js";

const router = Router();

/**
 * Cache SOLO para la columna de origen en BOLETA_VENTA (no cambia en runtime).
 * Preferencias: ID_UBICACION_ORIGEN -> ID_UBICACION -> ORIGEN_UBICACION
 */
let BV_ORIGEN_COL:
  | "ID_UBICACION_ORIGEN"
  | "ID_UBICACION"
  | "ORIGEN_UBICACION"
  | null = null;

async function detectBoletaOrigenColumn(conn: oracledb.Connection) {
  if (BV_ORIGEN_COL) return BV_ORIGEN_COL;
  const q = `
    SELECT column_name AS COLUMN_NAME
    FROM user_tab_columns
    WHERE table_name = 'BOLETA_VENTA'
      AND column_name IN ('ID_UBICACION_ORIGEN','ID_UBICACION','ORIGEN_UBICACION')
    ORDER BY CASE column_name
               WHEN 'ID_UBICACION_ORIGEN' THEN 1
               WHEN 'ID_UBICACION'        THEN 2
               ELSE 3
             END
  `;
  const r = await conn.execute<{ COLUMN_NAME: string }>(q, [], {
    outFormat: oracledb.OUT_FORMAT_OBJECT,
  });
  const name = r.rows?.[0]?.COLUMN_NAME;
  BV_ORIGEN_COL = (name as any) ?? "ORIGEN_UBICACION"; // fallback compatible
  return BV_ORIGEN_COL;
}

/**
 * SQL helper: obtener precio vigente sin depender de la vista V_PRECIO_ACTUAL.
 * Se usa JOIN inline contra LISTA_PRECIO/DET + PARAMETRO_SISTEMA.
 */
const SEL_PRECIO_INLINE = `
  SELECT d.precio_con_iva AS PRECIO
  FROM APP_PYME.LISTA_PRECIO_DET d
  JOIN APP_PYME.LISTA_PRECIO lp ON lp.id_lista = d.id_lista
  WHERE d.id_producto = :id_producto
    AND lp.id_lista = (
      SELECT valor_num
      FROM APP_PYME.PARAMETRO_SISTEMA
      WHERE codigo = 'PRECIO_LISTA_ACTIVA_ID'
    )
`;

async function getPrecioConIva(
  conn: oracledb.Connection,
  idProducto: number
): Promise<number | null> {
  const r = await conn.execute<{ PRECIO: number }>(
    SEL_PRECIO_INLINE,
    { id_producto: idProducto },
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );
  return r.rows?.[0]?.PRECIO != null ? Number(r.rows[0].PRECIO) : null;
}

/**
 * Preflight: valida existencia/visibilidad de objetos clave.
 * Si algo falta, quedará claro en el log cuál SELECT falló.
 */
async function preflightObjects(conn: oracledb.Connection) {
  const checks = [
    "SELECT 1 FROM APP_PYME.LISTA_PRECIO WHERE ROWNUM=1",
    "SELECT 1 FROM APP_PYME.LISTA_PRECIO_DET WHERE ROWNUM=1",
    // valor_num debe existir para la lista activa
    "SELECT 1 FROM APP_PYME.PARAMETRO_SISTEMA WHERE codigo='PRECIO_LISTA_ACTIVA_ID' AND valor_num IS NOT NULL",
    "SELECT 1 FROM APP_PYME.BOLETA_VENTA WHERE ROWNUM=1",
    "SELECT 1 FROM APP_PYME.BOLETA_VENTA_DETALLE WHERE ROWNUM=1",
  ];
  for (const sql of checks) {
    try {
      await conn.execute(sql);
    } catch (err: any) {
      console.error("OBJETO FALTANTE/INVISIBLE:", sql, String(err?.message || err));
      throw err;
    }
  }
}

router.post("/", async (req, res) => {
  const pool = await getPool();
  let conn: oracledb.Connection | undefined;
  let step = "init";

  try {
    conn = await pool.getConnection();
    step = "header";

    // 1) Header obligatorio (usuario)
    const userId = Number(req.get("x-user-id"));
    if (!Number.isInteger(userId)) {
      return res.status(400).json({ error: "Falta header x-user-id (numérico)" });
    }

    // 2) Normalización de payload
    const b: any = req.body ?? {};
    const numero: string | undefined = b.numero ?? b.NUMERO;
    const idCliente = Number(b.idCliente ?? b.id_cliente);
    let origenUbicacion: any = b.origenUbicacion ?? b.origen_ubicacion;

    const itemsRaw = b.items ?? b.detalle ?? [];
    const items: Array<{ idProducto: number; cantidad: number }> = Array.isArray(itemsRaw)
      ? itemsRaw.map((it: any) => ({
          idProducto: Number(it.idProducto ?? it.id_producto),
          cantidad: Number(it.cantidad ?? it.cant ?? it.qty),
        }))
      : [];

    // 3) Validación de payload
    if (
      !numero ||
      !Number.isInteger(idCliente) ||
      !Array.isArray(items) ||
      items.length === 0 ||
      items.some(
        (it) =>
          !Number.isInteger(it.idProducto) ||
          !Number.isInteger(it.cantidad) ||
          it.cantidad <= 0
      )
    ) {
      return res.status(400).json({
        error: "Payload inválido",
        ejemplo: {
          numero: "B-API-20250101010101",
          idCliente: 1,
          origenUbicacion: 2,
          items: [{ idProducto: 1, cantidad: 1 }],
        },
      });
    }

    // 4) Origen por defecto: LOCAL (prefix APP_PYME)
    step = "resolve-origen";
    if (!Number.isInteger(Number(origenUbicacion))) {
      const r = await conn.execute<{ ID: number }>(
        `SELECT id_ubicacion AS ID FROM APP_PYME.UBICACION WHERE nombre='LOCAL'`,
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      origenUbicacion = r.rows?.[0]?.ID ?? 2;
    }
    origenUbicacion = Number(origenUbicacion);

    // 5) Detectar columna real de origen (cacheada)
    step = "detect-cols";
    const origenCol = await detectBoletaOrigenColumn(conn);

    // Fuerza explícitamente la columna de usuario que existe en tu esquema.
    const usuarioCol = "ID_USUARIO_VENDE" as const;

    console.log("cols detectadas =>", { origenCol, usuarioCol, userId });

    // 6) Preflight de objetos base
    step = "preflight";
    await preflightObjects(conn);

    // 7) Transacción
    step = "savepoint";
    await conn.execute(`SAVEPOINT sp_ini`);

    // 7.1) Insert cabecera con usuario y origen (prefix APP_PYME)
    step = "insert-cabecera";
    const outId = { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } as const;

    const cols = `numero, id_cliente, fecha, estado, neto, iva, total, ${origenCol}, ${usuarioCol}`;
    const vals = `:numero, :id_cliente, SYSTIMESTAMP, 'PAGADA', 0, 0, 0, :origen, :user_id`;

    const sqlInsCab = `
      INSERT INTO APP_PYME.BOLETA_VENTA (${cols})
      VALUES (${vals})
      RETURNING id_boleta INTO :id_boleta
    `;

    const rIns = await conn.execute(sqlInsCab, {
      numero,
      id_cliente: idCliente,
      origen: origenUbicacion,
      user_id: userId,
      id_boleta: outId,
    });
    const idBoleta: number = (rIns.outBinds as any).id_boleta[0];

    // 7.2) Insert detalle con precio vigente (inline)
    step = "insert-detalle";
    let detallesInsertados = 0;
    for (const it of items) {
      const precio = await getPrecioConIva(conn, it.idProducto);
      if (precio == null) {
        throw new Error(`No hay precio vigente para producto ${it.idProducto}`);
      }

      const rDet = await conn.execute(
        `INSERT INTO APP_PYME.BOLETA_VENTA_DETALLE (id_boleta, id_producto, cantidad, precio_unitario)
         VALUES (:id_boleta, :id_producto, :cantidad, :precio)`,
        {
          id_boleta: idBoleta,
          id_producto: it.idProducto,
          cantidad: it.cantidad,
          precio,
        }
      );

      if (rDet.rowsAffected) detallesInsertados += rDet.rowsAffected;
    }

    if (detallesInsertados === 0) {
      throw new Error("No se insertó ningún detalle");
    }

    // 7.3) Totales (IVA 19%) (prefix APP_PYME)
    step = "sum-totales";
    const rSum = await conn.execute<{ TOTAL: number }>(
      `SELECT SUM(cantidad * precio_unitario) AS TOTAL
         FROM APP_PYME.BOLETA_VENTA_DETALLE
        WHERE id_boleta = :id_boleta`,
      { id_boleta: idBoleta },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const total = Number(rSum.rows?.[0]?.TOTAL ?? 0);
    const neto = Math.round(total / 1.19);
    const iva = total - neto;

    step = "update-cabecera";
    await conn.execute(
      `UPDATE APP_PYME.BOLETA_VENTA
          SET neto = :neto, iva = :iva, total = :total
        WHERE id_boleta = :id_boleta`,
      { neto, iva, total, id_boleta: idBoleta }
    );

    // 7.4) Inventario / idempotencia
    step = "pr_registrar_venta";
    await conn.execute(`BEGIN APP_PYME.pr_registrar_venta(:p_id); END;`, {
      p_id: idBoleta,
    });

    // 8) Commit y respuesta
    step = "commit";
    await conn.commit();

    return res.status(201).json({
      ok: true,
      idBoleta,
      numero,
      idCliente,
      origenUbicacion,
      items,
      totales: { neto, iva, total },
    });
  } catch (e: any) {
    const msg = `${step}: ${String(e?.message || e)}`;
    try {
      await conn?.rollback();
    } catch {
      /* ignore */
    }

    // Mapeo de errores comunes:
    if (/ORA-00001/.test(msg)) {
      return res
        .status(409)
        .json({ error: "Duplicado (probablemente 'numero' ya existe)" });
    }
    if (/No hay precio vigente para producto/.test(msg)) {
      return res.status(422).json({ error: msg });
    }

    // Si fue ORA-00942, el preflight habrá dejado en el log cuál objeto falta.
    console.error("ERROR /api/ventas:", e);
    return res.status(400).json({ error: msg });
  } finally {
    try {
      await conn?.close();
    } catch {
      /* ignore */
    }
  }
});

export default router;
