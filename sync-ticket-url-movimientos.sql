-- ================================================
-- Sync ticket_url desde pagos a movimientos_financieros
-- ================================================

-- Copiar ticket_url a movimientos_financieros usando pago_id
UPDATE movimientos_financieros mf
SET ticket_url = p.ticket_url
FROM pagos p
WHERE mf.pago_id = p.id
  AND p.ticket_url IS NOT NULL
  AND (mf.ticket_url IS NULL OR mf.ticket_url = '');

-- Verificar resultados
SELECT COUNT(*) AS movimientos_actualizados
FROM movimientos_financieros mf
JOIN pagos p ON p.id = mf.pago_id
WHERE p.ticket_url IS NOT NULL
  AND mf.ticket_url = p.ticket_url;
