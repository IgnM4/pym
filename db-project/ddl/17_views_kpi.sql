-- Vistas “amigables” para consumo de reportes o BI (sobre MVs)

CREATE OR REPLACE VIEW v_kpi_ventas_diarias AS
SELECT
  dia,
  total_ventas,
  total_neto,
  total_iva
FROM mv_ventas_diarias;

CREATE OR REPLACE VIEW v_kpi_ventas_por_producto AS
SELECT
  sku,
  nombre,
  unidades_vendidas,
  monto_vendido,
  costo_estimado,
  utilidad_estimada
FROM mv_ventas_por_producto;
