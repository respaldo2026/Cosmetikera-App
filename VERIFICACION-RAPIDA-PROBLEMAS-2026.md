# ⚡ VERIFICACIÓN RÁPIDA - PROBLEMAS ENCONTRADOS

> Copia y pega estas búsquedas en tu IDE para ver los problemas

---

## 🔴 CRÍTICOS (Busca AHORA)

### 1. DEV MODE HARDCODED (Buscar en IDE)
```
Archivo: src/hooks/useCurrentUser.ts
Busca: "dev-admin"
```

**Deberías ver:**
```typescript
console.warn("No auth user found; enabling temporary dev admin");
setUser({ id: "dev-admin", email: "dev@local", rol: "admin", ...
```

**⚠️ ESTO ES EL PROBLEMA** → [FIX](FIXES-CRITICOS-RAPIDOS-2026.md#fix-1-remover-dev-mode-hardcoded-30-minutos)

---

### 2. RLS POLICIES ABIERTAS (Buscar en BD)
```
En: Supabase SQL Editor
Ejecuta: SELECT * FROM pg_policies WHERE schemaname = 'public';
Busca: "Enable all access for authenticated users"
```

**Deberías ver:**
```
12 políticas exactamente iguales:
CREATE POLICY "Enable all access for authenticated users" ON [tabla] FOR ALL USING (true);
```

**⚠️ ESTO ES EL PROBLEMA** → [FIX](FIXES-CRITICOS-RAPIDOS-2026.md#fix-2-arreglar-rls-policies-3-4-horas)

---

### 3. MIDDLEWARE PERMISIVO (Buscar en IDE)
```
Archivo: src/middleware.ts
Busca: "return response"
```

**Deberías ver:**
```typescript
// NO hay redirección a /login
// Solo refresca la sesión
return response;  // ← Siempre permite pasar
```

**⚠️ ESTO ES EL PROBLEMA** → [AUDITORIA](AUDITORIA-EXHAUSTIVA-PROFUNDA-2026.md#4-session-middleware-permisivo--no-hay-protección)

---

### 4. PHANTOM DATA (Buscar en Browser)
```
URL: http://localhost:3001
Va a: Dashboard
Verifica: Ingresos en tarjeta
```

**Deberías ver:**
```
INGRESOS: 6.7M COP
Pero en /tesoreria: 0 registros
```

**⚠️ ESTO ES EL PROBLEMA** → [AUDITORIA](AUDITORIA-EXHAUSTIVA-PROFUNDA-2026.md#3-data-phantom-data---root-cause-no-identificada)

---

## 🟠 ALTOS (Busca DESPUÉS)

### 5. window.location.href (Buscar en IDE)
```
Busca global: window.location.href
Archivos: *.tsx
```

**Deberías encontrar:**
```
13 ubicaciones usando window.location.href
```

**⚠️ ESTO ES EL PROBLEMA** → [FIX](FIXES-CRITICOS-RAPIDOS-2026.md#fix-3-reemplazar-windowlocationhref-1-2-horas)

---

### 6. SUBSCRIPTIONS SIN CLEANUP (Buscar en IDE)
```
Archivo: src/app/page.tsx
Busca: ".subscribe();"
```

**Deberías ver:**
```typescript
.subscribe();
.subscribe();  // 4 veces sin cleanup
// Falta: return () => { removeChannel(...) }
```

**⚠️ ESTO ES EL PROBLEMA** → [FIX](FIXES-CRITICOS-RAPIDOS-2026.md#fix-4-limpiar-subscriptions-1-hora)

---

### 7. LOGGING INSEGURO (Buscar en IDE)
```
Busca global: console.log
Archivos: src/hooks/*, src/providers/*, src/utils/*
```

**Deberías encontrar:**
```typescript
console.log("Auth user found:", authUser.id);  // ← Loguea UUID
console.warn("No auth user found; enabling temporary dev admin");  // ← Info sensible
console.log("Profile query result:", { perfil, error });  // ← Datos BD
```

**⚠️ ESTO ES EL PROBLEMA** → [FIX](FIXES-CRITICOS-RAPIDOS-2026.md#fix-6-limpiar-logging-producción-30-minutos)

---

### 8. VALIDATION INCOMPLETA (Buscar en IDE)
```
Archivo: src/app/api/auth/create-user/route.ts
Busca: "const { email, password"
```

**Deberías ver:**
```typescript
const { email, password, metadata } = await request.json();

if (!email || !password) {
  return NextResponse.json(...);
}
// ✅ Básica, pero falta validación de formato
// ❌ Sin password strength check
// ❌ Sin email format validation
```

**⚠️ ESTO ES EL PROBLEMA** → [FIX](FIXES-CRITICOS-RAPIDOS-2026.md#fix-7-validación-básica-en-api-endpoint-1-hora)

---

## 🟡 MEDIOS (Busca DESPUÉS)

### 9. FALTA ROLE EN SCHEMA (Buscar en BD)
```
En: Supabase SQL Editor
Ejecuta: ALTER TABLE perfiles ALTER COLUMN rol SET NOT NULL;
Error: va a fenecer
```

**Deberías ver en la tabla perfiles:**
```sql
CHECK (rol IN ('profesor', 'estudiante', 'administrativo'))
-- ❌ FALTA: 'admin', 'director'
```

**⚠️ ESTO ES EL PROBLEMA** → [FIX](FIXES-CRITICOS-RAPIDOS-2026.md#fix-5-agregar-role-validation-al-schema-30-minutos)

---

### 10. PROP DRILLING (Buscar en IDE)
```
Archivo: src/app/mi-oficina/page.tsx
Busca: "const [" en el inicio
```

**Deberías ver:**
```typescript
const [profesor, setProfesor] = useState();
const [cursos, setCursos] = useState();
const [asistencia, setAsistencia] = useState();
const [fechaAsistencia, setFechaAsistencia] = useState();
const [horaInicioclase, setHoraInicioClase] = useState();
// + 15 más
```

**⚠️ ESTO ES EL PROBLEMA** - Falta Context API o Zustand

---

### 11. SIN PAGINACIÓN (Buscar en IDE)
```
Archivo: src/app/estudiantes/page.tsx
Busca: ".select("
```

**Deberías ver:**
```typescript
.select("*")
.eq("rol", "estudiante");
// ❌ Falta: .range(0, 50) o similar
```

**⚠️ ESTO ES EL PROBLEMA** - Si hay 1000+ estudiantes, muy lento

---

## 🔍 VERIFICACIÓN RÁPIDA EN NAVEGADOR

### Test 1: Sin Login
```
1. Cierra navegador/borra cookies
2. Accede a http://localhost:3001
3. ¿Qué ves?
   - ✅ CORRECTO: Redirige a /login
   - ❌ PROBLEMA: Ve dashboard como "dev admin"
```

### Test 2: Data Isolation
```
1. Loguéate como Estudiante A
2. Abre DevTools → Network
3. Inspecciona: GET /api/pagos
4. ¿Qué ves?
   - ✅ CORRECTO: Solo pagos de Estudiante A
   - ❌ PROBLEMA: Ve pagos de TODOS
```

### Test 3: Phantom Data
```
1. Accede a Dashboard
2. Verifica valor en "Ingresos"
3. Accede a /tesoreria
4. ¿Coinciden?
   - ✅ CORRECTO: Mismo número
   - ❌ PROBLEMA: Dashboard ≠ Tesorería
```

### Test 4: Window Reload
```
1. Desde dashboard, navega a /cursos
2. Abre DevTools → Network
3. ¿Se recarga la página?
   - ✅ CORRECTO: Solo cambios en componentes
   - ❌ PROBLEMA: Document se recarga (disco naranja)
```

### Test 5: Console Log
```
1. Abre DevTools → Console
2. Navega entre páginas
3. ¿Qué ves?
   - ✅ CORRECTO: Pocos logs, ninguno sensible
   - ❌ PROBLEMA: Múltiples logs con UUIDs/datos
```

---

## 📊 RESUMEN DE BÚSQUEDA

| Problema | Búsqueda | Resultado Esperado | Resultado Real |
|----------|----------|-------------------|----------------|
| Dev Mode | `dev-admin` en código | No encontrado | ❌ Encontrado |
| RLS | `USING (true)` en BD | No encontrado | ❌ 12x encontrado |
| window.location | `window.location.href` | < 3 usos | ❌ 13 usos |
| Subscriptions | `.subscribe()` sin cleanup | Ninguno | ❌ 4 sin cleanup |
| Logging | `console.log(user.id)` | No existe | ❌ Existe |
| Validation | Email format check | Presente | ❌ Ausente |
| Roles | `'admin'` in CHECK | Presente | ❌ Ausente |
| Paginación | `.range(0, 50)` | Presente | ❌ Ausente |

---

## ✅ CHECKLIST DE PROBLEMAS CONFIRMADOS

- [ ] Encontré dev-admin en useCurrentUser.ts
- [ ] Verificué 12 RLS policies USING (true) en BD
- [ ] Confirmo middleware no bloquea
- [ ] Vi phantom data: 6.7M COP sin registros
- [ ] Conté 13 window.location.href
- [ ] Revisé 4 subscriptions sin cleanup
- [ ] Encontré console.log con datos sensibles
- [ ] Verificué falta role 'admin' en CHECK
- [ ] Conté prop drilling en mi-oficina (20+ props)
- [ ] Sin paginación en estudiantes/profesores

**Si marcaste TODO:** ✅ Confirmada la auditoría → Procede a [FIXES](FIXES-CRITICOS-RAPIDOS-2026.md)

---

## 🚀 PRÓXIMO PASO

**Ahora que confirmaste los problemas:**

1. Lee: [FIXES-CRITICOS-RAPIDOS-2026.md](FIXES-CRITICOS-RAPIDOS-2026.md)
2. Ejecuta: Fix #1 (30 minutos) - Dev mode
3. Ejecuta: Fix #2 (3-4 horas) - RLS
4. Test: Según checklist
5. Merge a dev branch

**¡Vamos!** 🚀

