# Plan de acción para advertencias `react-hooks/exhaustive-deps`

## Prioridad Alta (afectan datos o side effects)
- `src/app/asistencias/page.tsx`: encapsular `calcularEstadisticas` dentro del `useEffect` o memorizarlo con `useCallback` para evitar reprocesos.
- `src/app/matriculas/page.tsx`: mover `calcularAsistencias` dentro del efecto o declarar `useCallback`; evita consultas repetidas.
- `src/app/nomina/page.tsx`: envolver `pagarClaseIndividual` y `calcularNomina` en `useCallback` identificando dependencias reales; previene ejecuciones dobles.
- `src/app/configuracion/page.tsx`: exponer `cargarConfiguracionAcademia` con `useCallback` y lista de deps mínima para que el efecto de carga corra exactamente una vez.

## Prioridad Media (impacto moderado en render o rendimiento)
- `src/app/estudiantes/page.tsx`: convertir las listas `activoEstados`/`graduadoEstados` en constantes internas del `useMemo` o extraerlas fuera del componente.
- `src/app/dashboard/admin.tsx`: revisar si `initialLoading` debe formar parte de `useCallback`; en caso contrario, convertirlo en `useRef` estático.
- `src/components/AttendanceCard_new.tsx`: extraer `calcularAsistencia` a `useCallback` y compartirlo sólo donde sea necesario.
- `src/components/GestorPensum.tsx`: envolver `cargarPrograma`, `cargarPensums` y helpers relacionados en `useCallback` para evitar fetchs duplicados.

## Prioridad Baja (advertencias que podemos documentar o silenciar puntualmente)
- Efectos que dependen de clientes Supabase (`supabaseBrowserClient`): documentar con comentario `// eslint-disable-next-line` sólo si el cliente es estático.
- Dependencias memoizadas que sólo formatean datos (`dataSource`, `dayjs`): migrar a constantes fuera del componente o aceptar la advertencia con disable local cuando el costo sea mínimo.

## Recomendación de política
1. Corregir prioridad alta antes del próximo `deploy` para evitar efectos colaterales.
2. Programar una sesión para evaluar prioridad media y decidir caso por caso entre refactor y `eslint-disable-next-line` documentado.
3. Mantener un registro actualizado en este archivo; si se deshabilita una regla, justificar el motivo y fecha.
