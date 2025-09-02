-- DROP seguro (ignora si no existe)
BEGIN
  EXECUTE IMMEDIATE 'DROP MATERIALIZED VIEW mv_ventas_diarias';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

CREATE MATERIALIZED VIEW mv_ventas_diarias
BUILD IMMEDIATE
REFRESH COMPLETE ON DEMAND
ENABLE QUERY REWRITE
AS
SELECT TRUNC(b.fecha) dia,
       SUM(b.total) total_ventas,
       SUM(b.neto)  total_neto,
       SUM(b.iva)   total_iva
FROM boleta_venta b
WHERE b.estado = 'PAGADA'
GROUP BY TRUNC(b.fecha)
/
CREATE INDEX ix_mv_ventas_diarias__dia ON mv_ventas_diarias(dia)
/

BEGIN
  EXECUTE IMMEDIATE 'DROP MATERIALIZED VIEW mv_ventas_por_producto';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

CREATE MATERIALIZED VIEW mv_ventas_por_producto
BUILD IMMEDIATE
REFRESH COMPLETE ON DEMAND
ENABLE QUERY REWRITE
AS
SELECT p.id_producto,
       p.sku, p.nombre, p.formato,
       SUM(d.cantidad)                           unidades_vendidas,
       SUM(d.subtotal)                           monto_vendido,
       SUM(d.cantidad * p.costo)                 costo_estimado,
       SUM(d.subtotal) - SUM(d.cantidad*p.costo) utilidad_estimada
FROM boleta_venta_detalle d
JOIN boleta_venta b ON b.id_boleta = d.id_boleta AND b.estado = 'PAGADA'
JOIN producto p     ON p.id_producto = d.id_producto
GROUP BY p.id_producto, p.sku, p.nombre, p.formato
/
CREATE INDEX ix_mv_vpp__sku ON mv_ventas_por_producto(sku)
/
