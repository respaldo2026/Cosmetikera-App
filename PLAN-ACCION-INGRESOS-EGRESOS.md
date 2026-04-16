# Plan de acción — Registro integral de ingresos y egresos

## 1. Migraciones y preparación en Supabase
- Ejecutar `fix-movimientos-financieros.sql` para crear la tabla `movimientos_financieros`, índices, políticas base y la vista `vw_movimientos_saldos_diarios`.
- Revisar/ajustar políticas RLS según roles reales (admin, tesorería, secretaría). Añadir excepciones si se usa `service_role` desde el backend.
- Validar que el bucket `pagos-tickets` cubra ingresos y decidir si se requiere un nuevo bucket `egresos-comprobantes` con políticas similares.
- Correr `fix-pagos-ticket-url.sql` si aún no se ha añadido la columna `ticket_url`.

## 2. Back-end y servicios
- Integrar `src/modules/finanzas/movimientos.service.ts` al contenedor de servicios Refine (agregar resource `movimientos-financieros`).
- Ajustar `pagos.service.ts` para que, al marcar un pago como pagado, también llame a `registrarIngresoDesdePago` guardando el movimiento.
- Crear servicio para migración histórica: script que recorra `pagos` con estado pagado y los inserte en `movimientos_financieros` (evitando duplicados). Guardar el script en `/scripts/migraciones/seed-movimientos.ts`.
- Exponer helpers para adjuntar comprobantes en egresos (reutilizar `subirTicketPago`, o clonar lógica hacia `subirComprobanteEgreso`).

## 3. UI Tesorería / panel administrativo
- Reemplazar la tabla actual en `src/app/tesoreria/page.tsx` por datos provenientes de `movimientos_financieros`, mostrando columnas: fecha, tipo, categoría, concepto, monto (con signo), método, persona, ticket/comprobante, estado de conciliación.
- Añadir filtros por tipo, categoría, rango de fecha, monto mínimo/máximo, conciliado y buscador general.
- Incorporar tarjetas de resumen: ingresos del periodo, egresos del periodo, saldo neto, saldo acumulado.
- Añadir acciones:
  1. `Registrar ingreso manual` (para aportes, ventas, etc.).
  2. `Registrar egreso` (nómina, proveedores, servicios). Cada uno abre form en modal/drawer con campos personalizables.
  3. Botón `Conciliar` para marcar movimientos revisados.
- Conectar con WhatsApp/email si se necesita notificar a responsables o enviar comprobantes.

## 4. Formularios y validaciones
- Crear páginas/formularios: `src/app/tesoreria/movimientos/create-ingreso.tsx` y `create-egreso.tsx` (o un único formulario con selector de tipo).
- Permitir subir comprobantes desde el formulario y guardar el `ticket_url`.
- Validar montos positivos, requerir conceptos y categorías, y establecer defaults (ej.: categoría `matriculas` para ingresos provenientes de pagos).
- En egresos, permitir asociar proveedor (relación con perfiles o tabla proveedores) y registrar método de pago.

## 5. Reportes y conciliación
- Construir componente `SaldoTimeline` usando la vista `vw_movimientos_saldos_diarios`.
- Exportar a CSV/Excel filtrado desde Tesorería para auditorías.
- Implementar bandera `conciliado` con historial (`conciliado_el`, `conciliado_por`). Mostrar en UI y filtros.

## 6. Pruebas y verificación
- Escribir tests manuales/automatizados para:
  - Registrar ingreso desde pago (secretaría y tesorería) y confirmar que aparece en movimientos.
  - Registrar egreso manual y verificar filtros/cómputos.
  - Conciliar movimientos y revisar permisos (secretaría debería ver solo ingresos; egresos solo tesorería/admin).
- Verificar que resúmenes (ingresos, egresos, saldo) concuerden con queries SQL manuales.
- Probar exportaciones y notificaciones.

## 7. Despliegue y comunicación
- Documentar en `README` Tesorería el nuevo flujo y roles responsables.
- Comunicar a tesorería/administración la necesidad de registrar todos los egresos y usar categorías estándar.
- Planear migración histórica en horario controlado para evitar duplicados.

## 8. Pendientes abiertos / decisiones
- Confirmar listado de categorías oficiales (marketing, nómina, proveedores, etc.).
- Definir si los egresos deben vincularse a facturas externas o a otra entidad (proveedores).
- Evaluar si se requiere aprobación de egresos (workflow de autorización) antes de marcarlos como conciliar.