# 🏆 ARQUITECTURA JERÁRQUICA DE ACADEMIAS

## 📋 Descripción General

El sistema ahora implementa una **jerarquía de roles multi-nivel** que permite:
- **Un Director** (propietario) crea y gestiona su academia
- **Administradores** apoyan con operaciones (pagos, matrículas, cursos)
- **Asesores** se dedican solo a gestionar leads
- **Profesores** gestionan sus cursos y cargan asistencias
- **Estudiantes** ven sus cursos y pagos

---

## 🏗️ ESTRUCTURA DE TABLAS

### 1. **Tabla `academias`** (NUEVA)
```sql
id UUID PRIMARY KEY
nombre TEXT
nit TEXT UNIQUE
direccion TEXT
telefono TEXT
email TEXT
ciudad TEXT
pais TEXT DEFAULT 'Colombia'
moneda TEXT DEFAULT 'COP'
website TEXT
instagram TEXT
facebook TEXT
director_id UUID REFERENCES perfiles(id)
estado TEXT DEFAULT 'activo'
created_at TIMESTAMP
updated_at TIMESTAMP
```

**Propósito:** Agrupar todos los usuarios, cursos, pagos, etc. de una academia.

### 2. **Tabla `perfiles`** (ACTUALIZADA)

Nuevas columnas agregadas:
- `academia_id UUID` - Vincula el perfil a una academia
- `nivel_jerarquico TEXT` - director|administrador|asesor|profesor|estudiante
- `creado_por_id UUID` - El director/admin que lo creó
- `permisos JSONB` - Permisos específicos en JSON (flexible para futuras expansiones)
- Columna `rol` se mantiene para compatibilidad backward

---

## 👥 JERARQUÍA Y PERMISOS

### 🏆 DIRECTOR (nivel 5)
**Perfil:** Propietario/Dueño de la Academia

| Funcionalidad | Acceso |
|---|---|
| Dashboard Ejecutivo | ✅ |
| Configuración de Academia | ✅ |
| Crear Perfiles Subordinados | ✅ |
| Gestionar Cursos | ✅ |
| Registrar Pagos | ✅ |
| Ver Reportes | ✅ |
| Crear Matrículas | ✅ |
| Gestionar Leads | ✅ |
| Ver Nómina | ✅ |
| Eliminar Usuarios | ✅ |

**Acceso de Menú:**
- Dashboard (/)
- Configuración > Perfiles
- Tesorería
- Matrículas
- Cursos
- Estudiantes
- Profesores
- Leads
- Nómina

---

### 👔 ADMINISTRADOR (nivel 4)
**Perfil:** Apoyo al director, gestión operativa diaria

| Funcionalidad | Acceso |
|---|---|
| Dashboard Ejecutivo | ✅ |
| Configuración de Academia | ❌ |
| Crear Perfiles | ❌ |
| Gestionar Cursos | ✅ |
| Registrar Pagos | ✅ |
| Ver Reportes | ✅ |
| Crear Matrículas | ✅ |
| Gestionar Leads | ✅ |
| Ver Nómina | ✅ |
| Eliminar Usuarios | ❌ |

**Acceso de Menú:**
- Dashboard (/)
- Tesorería
- Matrículas
- Cursos
- Estudiantes
- Leads
- Nómina

---

### 📞 ASESOR (nivel 3)
**Perfil:** Especialista en captación con acceso a operaciones clave

| Funcionalidad | Acceso |
|---|---|
| Dashboard Ejecutivo | ❌ |
| Gestionar Leads | ✅ |
| Crear Matrículas | ✅ |
| Registrar Pagos | ✅ |
| Gestionar Cursos | ❌ |
| Ver Reportes | ❌ |
| Ver Nómina | ❌ |
| Eliminar Usuarios | ❌ |

**Acceso de Menú:**
- Leads (gestión de captaciones)
- Matrículas (crear)
- Tesorería (registrar pagos de estudiantes)
- Información general de cursos (lectura)

---

### 🎓 PROFESOR (nivel 2)
**Perfil:** Docente de la academia

| Funcionalidad | Acceso |
|---|---|
| Mi Oficina (Mis Cursos) | ✅ |
| Cargar Asistencias | ✅ |
| Ver Mi Nómina | ✅ |
| Calificar Estudiantes | ✅ |

---

### 👨‍🎓 ESTUDIANTE (nivel 1)
**Perfil:** Aprendiz

| Funcionalidad | Acceso |
|---|---|
| Ver Mis Cursos | ✅ |
| Ver Mis Pagos | ✅ |
| Descargar Certificados | ✅ |

---

## 🔧 IMPLEMENTACIÓN

### PASO 1: Ejecutar la Migración

```bash
# En Supabase SQL Editor, ejecutar:
\i migration-hierarchy-academias-2026.sql
```

**Qué hace:**
- ✅ Crea tabla `academias`
- ✅ Agrega columnas a `perfiles`
- ✅ Crea índices
- ✅ Crea triggers y funciones
- ✅ Habilita RLS

### PASO 2: Crear una Academia de Prueba

```sql
-- En Supabase SQL Editor:
INSERT INTO academias (nombre, nit, ciudad, email)
VALUES ('Academia Crystal Diamante', '123456789', 'Medellín', 'info@academiacrystal.com')
RETURNING id;

-- Copiar el ID y actualizar configuracion:
UPDATE configuracion 
SET academy_id = '<uuid-del-paso-anterior>'
WHERE id = '<config-id>';
```

### PASO 3: Crear un Director

```sql
-- Opción 1: Vía auth.signUp (recomendado para producción)
-- Se hace por UI de login

-- Opción 2: SQL directo (solo desarrollo)
INSERT INTO perfiles (
  id,
  nombre_completo,
  email,
  identificacion,
  rol,
  nivel_jerarquico,
  academia_id,
  permisos
) VALUES (
  gen_random_uuid(),
  'Juan Pérez - Director',
  'director@academiacrystal.com',
  '1234567890',
  'administrativo',
  'director',
  '<academy-id>',
  '{"dashboard": true, "config_academia": true, ...}'::jsonb
);
```

### PASO 4: Director Crea Subordinados

Acceder a:
```
/configuracion/perfiles
```

Botón **"Agregar Perfil"** → Crear Administrador, Asesor o Profesor

El sistema:
1. Crea usuario en `auth.users`
2. El trigger `handle_new_user()` crea automáticamente el `perfil`
3. Asigna `academia_id` y `nivel_jerarquico`
4. Calcula permisos por defecto
5. Envía enlace de confirmación al email

---

## 🎯 FLUJOS DE USO

### Flujo 1: Director Crea Administrador
```
Director → /configuracion/perfiles 
         → Clic "Agregar Perfil"
         → Email: admin@academia.com
         → Rol: Administrador
         → Sistema envía link confirmación
         → Administrador confirma email
         → Accede a dashboard con permisos limitados
```

### Flujo 2: Director Crea Asesor
```
Director → /configuracion/perfiles 
         → Clic "Agregar Perfil"
         → Email: asesor@academia.com
         → Rol: Asesor
         → Sistema envía link confirmación
         → Asesor ve SOLO módulo de Leads
         → NO puede crear matrículas ni registrar pagos
```

### Flujo 3: Administrador Crea Profesor (FUTURO)
```
Administrador → /configuracion/perfiles
             → Clic "Agregar Perfil" (si permiso activo)
             → Email: profesor@academia.com
             → Rol: Profesor
             → Profesor accede a /mi-oficina
             → Ve sus cursos y puede cargar asistencias
```

---

## 🔐 SEGURIDAD Y RLS

**Cambios en Row Level Security (RLS):**

Cada tabla ahora puede filtrar por `academia_id`:

```sql
-- EJEMPLO (para implementar luego):
CREATE POLICY "Usuarios ven solo su academia" ON perfiles
  FOR SELECT
  USING (academia_id = (
    SELECT academia_id FROM perfiles WHERE id = auth.uid()
  ));
```

**Estado Actual:** RLS permisivo en desarrollo (se recomienda restricción en producción)

---

## 📊 ESTRUCTURA EN BD

```
academias (1)
    ├─ director_id ──┐
    │                │ 
    ├─ perfiles (N)  │◄── 1:N
    │    ├─ id = director_id ◄─┘
    │    ├─ academia_id (FK)
    │    ├─ nivel_jerarquico
    │    ├─ creado_por_id
    │    └─ permisos (JSON)
    │
    ├─ cursos (N)
    │    ├─ profesor_id (FK → perfiles)
    │    └─ ...
    │
    ├─ matriculas (N)
    │    ├─ estudiante_id (FK → perfiles)
    │    ├─ curso_id (FK)
    │    └─ ...
    │
    └─ pagos (N)
         ├─ estudiante_id (FK → perfiles)
         ├─ matricula_id (FK)
         └─ ...
```

---

## 🚀 PÁGINAS Y COMPONENTES CREADOS

| Página | Ruta | Rol Requerido | Funcionalidad |
|---|---|---|---|
| Gestionar Perfiles | `/configuracion/perfiles` | Director, Admin | CRUD de perfiles |
| Mi Oficina | `/mi-oficina` | Profesor | Mis cursos |
| Dashboard | `/` | Director, Admin | KPIs y reportes |
| Tesorería | `/tesoreria` | Admin, Director | Registrar pagos |
| Leads | `/leads` | Asesor, Admin, Director | Gestionar captaciones |

---

## 🔄 CÓMO FUNCIONA EL TRIGGER

Cuando alguien se registra vía `auth.signUp`:

```typescript
// auth.signUp en frontend
const { data, error } = await supabase.auth.signUp({
  email: "nuevo@academia.com",
  password: "xxx",
  options: {
    data: {
      nombre_completo: "Pedro García",
      identificacion: "98765432",
      academia_id: "uuid-academy", // ← Director establece
      rol: "administrativo",        // ← Director especifica
    }
  }
});
```

**El trigger `handle_new_user()` automáticamente:**

1. Lee `raw_user_meta_data`
2. Extrae: `nombre_completo`, `identificacion`, `academia_id`, `rol`
3. Mapea `rol` → `nivel_jerarquico` (administrativo → administrador)
4. Llama `obtener_permisos_por_nivel(nivel)`
5. Inserta en tabla `perfiles` con permisos pre-calculados

```sql
INSERT INTO perfiles (
  id,              -- auth.users.id
  nombre_completo, -- de metadata
  email,           -- auth.users.email
  identificacion,  -- de metadata
  rol,             -- de metadata
  nivel_jerarquico,-- calculado
  academia_id,     -- de metadata
  permisos         -- calculado
) VALUES (...)
```

---

## 📝 PERMISOS EN JSON

**Estructura de `permisos` en perfiles:**

```json
{
  "dashboard": true,
  "config_academia": true,
  "crear_perfiles": true,
  "gestionar_cursos": true,
  "registrar_pagos": true,
  "ver_reportes": true,
  "crear_matriculas": true,
  "gestionar_leads": true,
  "ver_nomina": true,
  "eliminar_usuarios": true,
  "custom_field_1": true  // Extensible para permisos personalizados
}
```

---

## 🎮 USO DEL HOOK `useRolePermissions`

En componentes React:

```typescript
import { useRolePermissions } from "@hooks/useRolePermissions";

export default function MiComponente() {
  const { tienePermiso, rol, usuario } = useRolePermissions();

  if (!tienePermiso("registrar_pagos")) {
    return <div>No tienes permiso para registrar pagos</div>;
  }

  return (
    <div>
      <h1>Registrar Pago</h1>
      {/* ... */}
    </div>
  );
}
```

---

## 🔗 PRÓXIMOS PASOS

### CORTO PLAZO (Esta semana)
- [ ] Ejecutar migración SQL
- [ ] Probar creación de Director
- [ ] Probar creación de Administrador desde Director
- [ ] Verificar redirecciones por rol

### MEDIANO PLAZO (Este mes)
- [ ] Implementar RLS restrictivo por `academia_id`
- [ ] Crear página de edición de permisos por director
- [ ] Agregar auditoría de acciones por rol
- [ ] Crear reportes de roles activos

### LARGO PLAZO
- [ ] Soporte multi-academia (una empresa con varias academias)
- [ ] Permisos granulares por curso
- [ ] Roles personalizados
- [ ] API pública con limitaciones por rol

---

## 📚 ARCHIVOS CLAVE

| Archivo | Descripción |
|---|---|
| `migration-hierarchy-academias-2026.sql` | Migración completa (ejecutar una sola vez) |
| `src/app/configuracion/perfiles/page.tsx` | UI para gestionar perfiles |
| `src/hooks/useRolePermissions.ts` | Hook para verificar permisos |
| `src/providers/auth-provider/auth-provider.client.ts` | Lógica de login y redirección por rol |

---

## ❓ FAQ

**P: ¿Puedo crear multi-academia?**
A: Sí, la tabla `academias` permite N academias. Un usuario solo ve su academia (por `academy_id`).

**P: ¿Qué pasa si un director elimina su perfil?**
A: Por diseño, el director NO puede ser eliminado. Solo otros roles subordinados.

**P: ¿Los permisos se pueden personalizar?**
A: Sí, vía la columna `permisos` (JSONB). Puedes agregar cualquier campo booleano.

**P: ¿El asesor puede ver reportes?**
A: No, tiene acceso SOLO a leads. No ve dashboard ni reportes.

---

## 📞 SOPORTE

Para preguntas sobre esta implementación, revisar:
1. `migration-hierarchy-academias-2026.sql` (estructura SQL)
2. `src/app/configuracion/perfiles/page.tsx` (UI)
3. `src/hooks/useRolePermissions.ts` (lógica de permisos)
