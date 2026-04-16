# ⚡ GUÍA DE FIXES RÁPIDOS - PRIORIDAD CRÍTICA

## Orden de Ejecución: LUNES - MIÉRCOLES (Bloqueadores)

---

## FIX #1: REMOVER DEV MODE HARDCODED (30 minutos)

**Archivo:** `src/hooks/useCurrentUser.ts`

**Cambio:**
```diff
- if (!authUser) {
-   console.warn("No auth user found; enabling temporary dev admin");
-   setUser({ id: "dev-admin", email: "dev@local", rol: "admin", nombre_completo: "Dev Admin" });
-   setLoading(false);
-   return;
- }
+ if (!authUser) {
+   console.error("No auth user - redirecting to login");
+   if (typeof window !== 'undefined') {
+     window.location.href = "/login";
+   }
+   return;
+ }
```

**Por qué:** Permite entrar a la app sin login.

---

## FIX #2: ARREGLAR RLS POLICIES (3-4 horas)

**Archivo:** `schema.sql`

**Script para ejecutar en Supabase SQL Editor:**

```sql
-- Deshabilitar todas las políticas inseguras
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON perfiles;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON pagos;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON matriculas;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON cursos;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON sesiones_clase;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON asistencias;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON temas_curso;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON profesores_info;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON configuracion;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON inventario;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON pagos_nomina;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON pagos_profesores;

-- ==========================================
-- NUEVAS POLÍTICAS (SEGURAS)
-- ==========================================

-- TABLA: PERFILES
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;

-- Usuarios ven su propio perfil
CREATE POLICY "Users can view own profile" ON perfiles
  FOR SELECT
  USING (auth.uid() = id);

-- Admin/Director ven todos
CREATE POLICY "Admins can view all profiles" ON perfiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM perfiles 
      WHERE id = auth.uid() 
      AND rol IN ('admin', 'director')
    )
  );

-- Solo admin puede crear/actualizar
CREATE POLICY "Only admins can insert" ON perfiles
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM perfiles 
      WHERE id = auth.uid() 
      AND rol IN ('admin', 'director')
    )
  );

-- ==========================================
-- TABLA: PAGOS
-- ==========================================
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;

-- Estudiantes ven sus propios pagos
CREATE POLICY "Students view own payments" ON pagos
  FOR SELECT
  USING (estudiante_id = auth.uid());

-- Admin/Director/Administrativo ven todos
CREATE POLICY "Staff view all payments" ON pagos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM perfiles 
      WHERE id = auth.uid() 
      AND rol IN ('admin', 'director', 'administrativo')
    )
  );

-- Administrativo puede crear pagos
CREATE POLICY "Admins can insert payments" ON pagos
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM perfiles 
      WHERE id = auth.uid() 
      AND rol IN ('admin', 'director', 'administrativo')
    )
  );

-- ==========================================
-- TABLA: MATRICULAS
-- ==========================================
ALTER TABLE matriculas ENABLE ROW LEVEL SECURITY;

-- Estudiantes ven sus matriculas
CREATE POLICY "Students view own enrollments" ON matriculas
  FOR SELECT
  USING (estudiante_id = auth.uid());

-- Profesores ven sus cursos (via curso_id)
CREATE POLICY "Professors view their courses" ON matriculas
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cursos c 
      WHERE c.id = matriculas.curso_id 
      AND c.profesor_id = auth.uid()
    )
  );

-- Admins ven todo
CREATE POLICY "Admins view all" ON matriculas
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM perfiles 
      WHERE id = auth.uid() 
      AND rol IN ('admin', 'director', 'administrativo')
    )
  );

-- ==========================================
-- TABLA: CURSOS
-- ==========================================
ALTER TABLE cursos ENABLE ROW LEVEL SECURITY;

-- Todos ven cursos activos
CREATE POLICY "Everyone views active courses" ON cursos
  FOR SELECT
  USING (estado = 'activo' OR estado = 'proximo');

-- Profesores ven sus cursos
CREATE POLICY "Professors view own courses" ON cursos
  FOR SELECT
  USING (profesor_id = auth.uid());

-- Admins ven todo
CREATE POLICY "Admins view all courses" ON cursos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM perfiles 
      WHERE id = auth.uid() 
      AND rol IN ('admin', 'director')
    )
  );

-- ==========================================
-- TABLA: SESIONES_CLASE
-- ==========================================
ALTER TABLE sesiones_clase ENABLE ROW LEVEL SECURITY;

-- Profesor ve sus sesiones
CREATE POLICY "Professors view own sessions" ON sesiones_clase
  FOR SELECT
  USING (profesor_id = auth.uid());

-- Admins ven todo
CREATE POLICY "Admins view all sessions" ON sesiones_clase
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM perfiles 
      WHERE id = auth.uid() 
      AND rol IN ('admin', 'director')
    )
  );

-- ==========================================
-- TABLA: ASISTENCIAS
-- ==========================================
ALTER TABLE asistencias ENABLE ROW LEVEL SECURITY;

-- Estudiantes ven sus asistencias
CREATE POLICY "Students view own attendance" ON asistencias
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM matriculas m 
      WHERE m.id = matriculas.id 
      AND m.estudiante_id = auth.uid()
    )
  );

-- Profesor ve asistencias de sus estudiantes
CREATE POLICY "Professors view attendance" ON asistencias
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM matriculas m 
      JOIN cursos c ON c.id = m.curso_id 
      WHERE m.id = asistencias.matricula_id 
      AND c.profesor_id = auth.uid()
    )
  );

-- Admins ven todo
CREATE POLICY "Admins view all attendance" ON asistencias
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM perfiles 
      WHERE id = auth.uid() 
      AND rol IN ('admin', 'director')
    )
  );

-- ==========================================
-- TABLA: PAGOS_NOMINA
-- ==========================================
ALTER TABLE pagos_nomina ENABLE ROW LEVEL SECURITY;

-- Profesor ve su nómina
CREATE POLICY "Professors view own payroll" ON pagos_nomina
  FOR SELECT
  USING (profesor_id = auth.uid());

-- Admin ve todo
CREATE POLICY "Admins view all payroll" ON pagos_nomina
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM perfiles 
      WHERE id = auth.uid() 
      AND rol IN ('admin', 'director')
    )
  );

-- Solo admin puede crear nómina
CREATE POLICY "Admins create payroll" ON pagos_nomina
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM perfiles 
      WHERE id = auth.uid() 
      AND rol IN ('admin', 'director')
    )
  );
```

**Por qué:** Actualmente todos pueden ver todos los datos. Esto lo restringe por rol.

---

## FIX #3: REEMPLAZAR window.location.href (1-2 horas)

**Ubicaciones a cambiar:**

```bash
src/app/mi-oficina/page.tsx:108
src/app/matriculas/page.tsx:295, 325, 380, 689
src/app/tesoreria/create/page.tsx:148
src/app/page.tsx:433
src/app/cursos/page.tsx:322
src/app/profesores/show/[id]/page.tsx:531
src/app/estudiantes/show/[id]/page.tsx:512
src/app/asistencias/page.tsx:144
```

**Template para cambio:**

**Antes:**
```typescript
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(...);

// En algún evento:
window.location.href = "/login";
setTimeout(() => window.location.reload(), 1000);
```

**Después:**
```typescript
import { useRouter } from "next/navigation";

export default function Component() {
  const router = useRouter();
  
  // En algún evento:
  router.push("/login");
  // No necesita timeout, React rerender es instantáneo
}
```

**Por qué:** Evita reload completo de página, mantiene state, mejor UX.

---

## FIX #4: LIMPIAR SUBSCRIPTIONS (1 hora)

**Archivo:** `src/app/page.tsx` líneas 70-130

**Cambio:**

```diff
  useEffect(() => {
    cargarDashboardGeneral();
    
    const subscriptionPagos = supabaseBrowserClient
      .channel('pagos-changes')
      .on('postgres_changes', { ... }, () => { ... })
      .subscribe();

    const subscriptionNomina = supabaseBrowserClient
      .channel('nomina-changes')
      .on('postgres_changes', { ... }, () => { ... })
      .subscribe();
      
    const subscriptionMatriculas = supabaseBrowserClient
      .channel('matriculas-changes')
      .on('postgres_changes', { ... }, () => { ... })
      .subscribe();
      
    const subscriptionCursos = supabaseBrowserClient
      .channel('cursos-changes')
      .on('postgres_changes', { ... }, () => { ... })
      .subscribe();

+   // CLEANUP: Unsubscribe cuando se desmonta el componente
+   return () => {
+     supabaseBrowserClient.removeChannel(subscriptionPagos);
+     supabaseBrowserClient.removeChannel(subscriptionNomina);
+     supabaseBrowserClient.removeChannel(subscriptionMatriculas);
+     supabaseBrowserClient.removeChannel(subscriptionCursos);
+   };
  }, []);
```

**Por qué:** Memory leak - subscriptions nunca se cierran.

---

## FIX #5: AGREGAR ROLE VALIDATION AL SCHEMA (30 minutos)

**Archivo:** `schema.sql` línea 20

**Cambio:**
```sql
-- Antes:
rol TEXT NOT NULL CHECK (rol IN ('profesor', 'estudiante', 'administrativo'))

-- Después:
rol TEXT NOT NULL CHECK (rol IN ('profesor', 'estudiante', 'administrativo', 'admin', 'director'))
```

**Por qué:** Actualmente no se puede crear admin/director en tabla.

---

## FIX #6: LIMPIAR LOGGING PRODUCCIÓN (30 minutos)

**Archivos:**
- src/hooks/useCurrentUser.ts
- src/hooks/useRolePermissions.ts
- src/providers/auth-provider/auth-provider.client.ts

**Template:**

```diff
- console.warn("No auth user found; enabling temporary dev admin");
- console.log("Auth user found:", authUser.id);
- console.log("Profile query result:", { perfil, error });

+ if (process.env.NODE_ENV === 'development') {
+   console.log("Auth user found:", authUser.id);
+ }
```

**Por qué:** Los logs en producción revelan estructura + info sensible.

---

## FIX #7: VALIDACIÓN BÁSICA EN API ENDPOINT (1 hora)

**Archivo:** `src/app/api/auth/create-user/route.ts`

```typescript
// Agregar después de const { email, password, metadata } = ...

// Validar email
if (!email.includes('@') || email.length < 5) {
  return NextResponse.json(
    { success: false, error: "Email inválido" },
    { status: 400 }
  );
}

// Validar contraseña
if (password.length < 4) {
  return NextResponse.json(
    { success: false, error: "Contraseña muy corta (mínimo 4 caracteres)" },
    { status: 400 }
  );
}

// Validar que el service key existe
if (!process.env.SUPABASE_SERVICE_KEY) {
  console.error("SUPABASE_SERVICE_KEY not configured");
  return NextResponse.json(
    { success: false, error: "Server misconfigured" },
    { status: 500 }
  );
}
```

**Por qué:** Sin validación, se pueden crear users con datos inválidos.

---

## 🎯 TESTING DESPUÉS DE CADA FIX

### Fix #1 (Dev Mode):
```
✓ Sin login → Va a /login (no dev-admin)
✓ Con login → Va a dashboard correctamente
```

### Fix #2 (RLS):
```
✓ Profesor A no ve pagos de Profesor B
✓ Estudiante A no ve cuotas de Estudiante B
✓ Admin ve todo
```

### Fix #3 (Router):
```
✓ Sin reload visual
✓ Sin parpadeo de pantalla
```

### Fix #4 (Subscriptions):
```
✓ Navega a otra página y vuelve → No hay múltiples listeners
✓ Chrome DevTools → No hay memory leak
```

### Fix #5 (Role):
```
✓ Crear admin en BD directamente funciona
```

### Fix #6 (Logging):
```
✓ Build production: npm run build
✓ No hay console.log sobre datos sensibles
```

### Fix #7 (Validation):
```
✓ Intenta crear user con email=123 → Error
✓ Intenta crear user con password="" → Error
```

---

## ⏱️ TIEMPO ESTIMADO
- Fix #1: 30 min
- Fix #2: 3-4 horas (incluye testing)
- Fix #3: 1-2 horas
- Fix #4: 1 hora
- Fix #5: 30 min
- Fix #6: 30 min
- Fix #7: 1 hora

**TOTAL: 8-10 horas** (Lunes-Miércoles en 8h/día)

---

## ✅ CHECKLIST DE COMPLETITUD

- [ ] Fix #1 completado y testeado
- [ ] Fix #2 completado y testeado
- [ ] Fix #3 completado y testeado
- [ ] Fix #4 completado y testeado
- [ ] Fix #5 completado
- [ ] Fix #6 completado
- [ ] Fix #7 completado y testeado
- [ ] Build sin errores: `npm run build`
- [ ] No hay console.error en browser
- [ ] RLS test: datos aislados por usuario

