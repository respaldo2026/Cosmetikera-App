# 🔍 TABLA DE REFERENCIA RÁPIDA - AUDITORÍA 2026

## BUSCA TU PROBLEMA - ENCUENTRA LA SOLUCIÓN

---

## 🔴 CRÍTICOS

### Problema: "Veo todos los datos de otros usuarios"
**Root Cause:** RLS policies configuradas con `USING (true)`  
**Archivo:** `schema.sql` líneas 295-339  
**Fix:** [AUDITORIA-EXHAUSTIVA-PROFUNDA-2026.md](AUDITORIA-EXHAUSTIVA-PROFUNDA-2026.md#1-security-rls-policies-completamente-inseguras)  
**Tiempo:** 3-4 horas  
**Prioridad:** 🔴 CRÍTICA

### Problema: "Entra a la app sin login como dev-admin"
**Root Cause:** Fallback hardcoded en useCurrentUser  
**Archivo:** `src/hooks/useCurrentUser.ts` líneas 31-35  
**Fix:** [FIXES-CRITICOS-RAPIDOS-2026.md](FIXES-CRITICOS-RAPIDOS-2026.md#fix-1-remover-dev-mode-hardcoded-30-minutos)  
**Tiempo:** 30 minutos  
**Prioridad:** 🔴 CRÍTICA

### Problema: "Dashboard muestra 6.7M COP pero Tesorería está vacío"
**Root Cause:** Phantom data, queries sin filtros, caching confundido  
**Archivo:** src/app/page.tsx + schema.sql  
**Fix:** [AUDITORIA-EXHAUSTIVA-PROFUNDA-2026.md](AUDITORIA-EXHAUSTIVA-PROFUNDA-2026.md#3-data-phantom-data---root-cause-no-identificada)  
**Tiempo:** Investigación + 2-4 horas  
**Prioridad:** 🔴 CRÍTICA

### Problema: "Puedo acceder a /tesoreria sin estar logueado"
**Root Cause:** Middleware no bloquea, solo refresca  
**Archivo:** `src/middleware.ts` líneas 67-82  
**Fix:** [AUDITORIA-EXHAUSTIVA-PROFUNDA-2026.md](AUDITORIA-EXHAUSTIVA-PROFUNDA-2026.md#4-session-middleware-permisivo--no-hay-protección)  
**Tiempo:** 2 horas  
**Prioridad:** 🔴 CRÍTICA

---

## 🟠 ALTOS

### Problema: "La app se queda pegada esperando respuesta"
**Root Cause:** Calls sin timeout, promises sin await  
**Archivo:** Múltiples (src/app/matriculas, src/app/tesoreria, etc)  
**Fix:** [AUDITORIA-EXHAUSTIVA-PROFUNDA-2026.md](AUDITORIA-EXHAUSTIVA-PROFUNDA-2026.md#5-error-handling-try-catch-blocks-incompletos)  
**Tiempo:** 2 horas  
**Prioridad:** 🟠 ALTA

### Problema: "Componente se renderiza infinite veces"
**Root Cause:** useEffect con dependencies incompletas  
**Archivo:** src/app/page.tsx, src/app/mi-oficina/page.tsx  
**Fix:** [AUDITORIA-EXHAUSTIVA-PROFUNDA-2026.md](AUDITORIA-EXHAUSTIVA-PROFUNDA-2026.md#6-react-useeffect-dependencies-incompletas)  
**Tiempo:** 1 hora  
**Prioridad:** 🟠 ALTA

### Problema: "TypeScript no detecta errores en auth"
**Root Cause:** Uso de `any` type en providers  
**Archivo:** src/providers/auth-provider/*.ts  
**Fix:** [AUDITORIA-EXHAUSTIVA-PROFUNDA-2026.md](AUDITORIA-EXHAUSTIVA-PROFUNDA-2026.md#7-typing-abuso-de-any-type)  
**Tiempo:** 2 horas  
**Prioridad:** 🟠 ALTA

### Problema: "Console lleno de logs en producción"
**Root Cause:** console.log/warn/error no filtrados por NODE_ENV  
**Archivo:** src/hooks/useCurrentUser.ts, src/providers/*, etc  
**Fix:** [FIXES-CRITICOS-RAPIDOS-2026.md](FIXES-CRITICOS-RAPIDOS-2026.md#fix-6-limpiar-logging-producción-30-minutos)  
**Tiempo:** 30 minutos  
**Prioridad:** 🟠 ALTA

### Problema: "Página se recarga completa cuando navego"
**Root Cause:** Uso de window.location.href en React  
**Archivo:** 13 ubicaciones listadas en auditoría  
**Fix:** [FIXES-CRITICOS-RAPIDOS-2026.md](FIXES-CRITICOS-RAPIDOS-2026.md#fix-3-reemplazar-windowlocationhref-1-2-horas)  
**Tiempo:** 1-2 horas  
**Prioridad:** 🟠 ALTA

### Problema: "Memory leak cuando navego entre páginas"
**Root Cause:** Subscriptions sin cleanup  
**Archivo:** src/app/page.tsx líneas 93-129  
**Fix:** [FIXES-CRITICOS-RAPIDOS-2026.md](FIXES-CRITICOS-RAPIDOS-2026.md#fix-4-limpiar-subscriptions-1-hora)  
**Tiempo:** 1 hora  
**Prioridad:** 🟠 ALTA

### Problema: "No puedo crear admin/director en BD"
**Root Cause:** Constraint en perfiles solo permite 3 roles  
**Archivo:** schema.sql línea 20  
**Fix:** [FIXES-CRITICOS-RAPIDOS-2026.md](FIXES-CRITICOS-RAPIDOS-2026.md#fix-5-agregar-role-validation-al-schema-30-minutos)  
**Tiempo:** 30 minutos  
**Prioridad:** 🟠 ALTA

### Problema: "Puedo crear user con email inválido"
**Root Cause:** API endpoint sin validación
**Archivo:** src/app/api/auth/create-user/route.ts
**Fix:** [FIXES-CRITICOS-RAPIDOS-2026.md](FIXES-CRITICOS-RAPIDOS-2026.md#fix-7-validación-básica-en-api-endpoint-1-hora)
**Tiempo:** 1 hora
**Prioridad:** 🟠 ALTA

---

## 🟡 MEDIO

### Problema: "Prop drilling = código difícil de mantener"
**Root Cause:** No hay Context API  
**Ubicación:** src/app/mi-oficina/page.tsx, src/app/page.tsx  
**Solución:** Usar React Context o Zustand  
**Tiempo:** 4 horas  
**Prioridad:** 🟡 MEDIA

### Problema: "Listar 1000 estudiantes es lento"
**Root Cause:** No hay paginación  
**Ubicación:** src/app/estudiantes/page.tsx, src/app/profesores/page.tsx  
**Solución:** Implementar pagination con limit/offset  
**Tiempo:** 2 horas  
**Prioridad:** 🟡 MEDIA

### Problema: "Entrada de usuario puede romper la BD"
**Root Cause:** No hay input sanitization  
**Ubicación:** Todos los formularios  
**Solución:** Validar/sanitizar en cliente y servidor  
**Tiempo:** 3 horas  
**Prioridad:** 🟡 MEDIA

### Problema: "No sé quién hizo qué en pagos/nómina"
**Root Cause:** No hay audit logging  
**Ubicación:** Ninguno - no existe  
**Solución:** Crear tabla audit_log + triggers  
**Tiempo:** 8 horas  
**Prioridad:** 🟡 MEDIA

### Problema: "Tengo 20 scripts SQL mezclados"
**Root Cause:** No hay versionamiento de BD  
**Ubicación:** Raíz del proyecto  
**Solución:** Migrar a Prisma/Supabase migrations  
**Tiempo:** 6 horas  
**Prioridad:** 🟡 MEDIA

### Problema: "Tengo AttendanceCard.tsx y AttendanceCard_new.tsx"
**Root Cause:** Código duplicado  
**Ubicación:** src/components/  
**Solución:** Consolidar en uno  
**Tiempo:** 1 hora  
**Prioridad:** 🟡 MEDIA

---

## 🟢 BAJO

### Problema: "Fotos de usuarios son lentas de cargar"
**Solución:** Usar next/image en lugar de <img>  
**Tiempo:** 1 hora

### Problema: "Quiero offline support"
**Solución:** Implementar Service Worker  
**Tiempo:** 4 horas

### Problema: "TypeScript muy permisivo"
**Solución:** Refactorizar tipos  
**Tiempo:** 3 horas

### Problema: "Dark mode no funciona bien"
**Solución:** Mejorar ColorModeContext  
**Tiempo:** 2 horas

### Problema: "Quiero keyboard shortcuts"
**Solución:** Agregar hotkeys en dashboard  
**Tiempo:** 2 horas

---

## 📊 MATRIZ DE IMPACTO vs ESFUERZO

```
IMPACTO ALTO
│
│  🔴 Critical       🟠 High Priority
│  (4 issues)       (8 issues)
│  FIX FIRST        FIX SECOND
│
│
│  🟡 Medium        🟢 Low
│  (12 issues)     (6 issues)
│  FIX THIRD       FIX LAST
└─────────────────────────────────────
  ESFUERZO BAJO      ESFUERZO ALTO
```

**Recomendación:** Fila de ejecución
1. Críticos (30-60min = valor máximo)
2. Altos (1-2 horas = buena relación)
3. Medio (2-4 horas = valor mediano)
4. Bajo (1h+ = nice to have)

---

## 🚀 VELOCIDAD DE EJECUCIÓN

### SPRINT 1 (Lunes-Miércoles)
**Objetivo:** Arreglar bloqueadores críticos  
**Issues:** #1, #2, #3, #4, #9  
**Tiempo:** 8-10 horas  
**Resultado:** ✅ App segura para testing

### SPRINT 2 (Jueves-Viernes)
**Objetivo:** Arreglar altos  
**Issues:** #5, #6, #7, #8, #10, #11, #12  
**Tiempo:** 8-10 horas  
**Resultado:** ✅ Funcionalidad completa

### SPRINT 3 (Siguiente semana)
**Objetivo:** Medium + testing  
**Issues:** #13-22  
**Tiempo:** 20-30 horas  
**Resultado:** ✅ Producción lista

---

## ✅ CHECKLIST DE LANZAMIENTO

### Antes de ir a Staging:
- [ ] Fix #1 (Dev mode) - ✅
- [ ] Fix #2 (RLS) - ✅
- [ ] Fix #3 (Router) - ✅
- [ ] Fix #4 (Subscriptions) - ✅
- [ ] `npm run build` sin errores - ✅
- [ ] Tests de seguridad básicos - ✅

### Antes de ir a Producción:
- [ ] Todos los críticos + altos arreglados - ✅
- [ ] Audit log implementado - ✅
- [ ] Backups automáticos configurados - ✅
- [ ] Disaster recovery plan escrito - ✅
- [ ] Auditoría de seguridad externa (opcional) - ✅
- [ ] Performance test con 10k+ usuarios - ✅
- [ ] Load test de BD - ✅

---

## 📞 REFERENCIAS CRUZADAS

| Issue | Documento Principal | Fix Rápido | Auditoría Profunda |
|-------|-------------------|------------|-------------------|
| #1 | AUDITORIA-EXHAUSTIVA | [FIXES](FIXES-CRITICOS-RAPIDOS-2026.md#fix-2) | Sec 1 |
| #2 | AUDITORIA-EXHAUSTIVA | [FIXES](FIXES-CRITICOS-RAPIDOS-2026.md#fix-1) | Sec 2 |
| #3 | AUDITORIA-EXHAUSTIVA | [FIXES](FIXES-CRITICOS-RAPIDOS-2026.md#faq) | Sec 3 |
| #4 | AUDITORIA-EXHAUSTIVA | [FIXES](FIXES-CRITICOS-RAPIDOS-2026.md#fix-3) | Sec 4 |
| ... | ... | ... | ... |

---

## 💡 TIPS DE IMPLEMENTACIÓN

1. **Ejecuta fixes en orden:** No cambies el orden (algunas dependen de otras)
2. **Test cada fix:** Verifica en navegador antes de siguiente
3. **Usa git branches:** `git checkout -b fix/rls-policies` 
4. **Commit después de cada fix:** `git commit -m "fix: remove dev-admin"`
5. **Build antes de merge:** `npm run build` sin errores

---

## 🆘 PREGUNTAS FRECUENTES

**P: ¿Puedo lanzar producción antes de hacer todos los fixes?**  
A: ❌ No. Mínimo haz los 4 críticos.

**P: ¿Cuánto tiempo toma todo?**  
A: 50-75 horas (2-3 semanas).

**P: ¿Necesito auditoría externa?**  
A: Sí, si es app crítica. Presupuesta $3-5k.

**P: ¿Qué hago con los datos actuales?**  
A: Limpia datos de prueba antes de producción con `TRUNCATE CASCADE`.

**P: ¿Y si lanzo y pasó un issue?**  
A: Data breach probable. Recomendamos fix preventivo.

