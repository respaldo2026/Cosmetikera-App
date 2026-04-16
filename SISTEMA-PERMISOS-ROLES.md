# Sistema de Permisos por Rol

## Descripción

Se ha implementado un sistema completo de control de permisos por rol que permite a los administradores configurar dinámicamente qué módulos/pestañas puede ver cada rol en la aplicación.

## Componentes

### 1. Tabla Supabase: `role_permissions`

```sql
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY,
  rol VARCHAR(50) UNIQUE NOT NULL,
  permisos JSONB NOT NULL,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Estructura de `permisos`:**
```json
{
  "cursos": true,
  "estudiantes": true,
  "matriculas": true,
  "asistencias": true,
  "profesores": true,
  "tesoreria": true,
  "nomina": true,
  "perfiles": true,
  "leads": true,
  "inventario": true,
  "planificador": true,
  "portal-estudiante": true
}
```

### 2. Hook: `useRolePermissions`

**Ubicación:** `src/hooks/useRolePermissions.ts`

**Funcionalidades:**
- `cargarPermisos()` - Obtiene permisos de Supabase
- `guardarPermisos(rol, permisos)` - Guarda cambios de permisos
- `tienePermiso(rol, modulo)` - Verifica si un rol tiene acceso a un módulo

**Uso:**
```typescript
const { permisos, tienePermiso, guardarPermisos } = useRolePermissions();

// Verificar permiso
if (tienePermiso("profesor", "cursos")) {
  // mostrar módulo
}

// Actualizar permiso
await guardarPermisos("profesor", { cursos: true, asistencias: true });
```

### 3. Hook: `useModuleAccess`

**Ubicación:** `src/hooks/useModuleAccess.ts`

**Uso:**
```typescript
const { tieneAcceso, modulosAccesibles } = useModuleAccess();

if (tieneAcceso("cursos")) {
  // mostrar módulo
}
```

### 4. Página de Configuración

**Ubicación:** `src/app/configuracion/page.tsx`

**Nuevas Pestañas:**
- **Datos de la Academia** - Información general (existente)
- **Permisos por Rol** - Gestión de permisos (nuevo)

En la sección de permisos:
- Se muestran todos los roles disponibles en tarjetas
- Para cada rol hay checkboxes con los módulos disponibles
- Los cambios se guardan automáticamente

## Roles y Permisos por Defecto

### Admin (acceso total)
- ✅ Cursos
- ✅ Estudiantes
- ✅ Matrículas
- ✅ Asistencias
- ✅ Profesores
- ✅ Tesorería
- ✅ Nómina
- ✅ Perfiles
- ✅ Leads
- ✅ Inventario
- ✅ Planificador
- ✅ Portal Estudiante

### Director
- ✅ Cursos
- ✅ Estudiantes
- ✅ Matrículas
- ✅ Asistencias
- ✅ Profesores
- ✅ Tesorería
- ❌ Nómina
- ✅ Perfiles
- ✅ Leads
- ✅ Inventario
- ✅ Planificador
- ❌ Portal Estudiante

### Administrativo
- ✅ Cursos
- ✅ Estudiantes
- ✅ Matrículas
- ✅ Asistencias
- ❌ Profesores
- ✅ Tesorería
- ❌ Nómina
- ❌ Perfiles
- ✅ Leads
- ✅ Inventario
- ❌ Planificador
- ❌ Portal Estudiante

### Profesor
- ✅ Cursos (solo sus cursos)
- ✅ Estudiantes (solo sus estudiantes)
- ✅ Matrículas (solo sus matrículas)
- ✅ Asistencias (solo sus asistencias)
- ❌ Profesores
- ❌ Tesorería
- ✅ Nómina (solo su nómina)
- ❌ Perfiles
- ❌ Leads
- ❌ Inventario
- ✅ Planificador
- ❌ Portal Estudiante

### Estudiante
- ❌ Cursos
- ❌ Estudiantes
- ❌ Matrículas
- ❌ Asistencias
- ❌ Profesores
- ❌ Tesorería
- ❌ Nómina
- ❌ Perfiles
- ❌ Leads
- ❌ Inventario
- ❌ Planificador
- ✅ Portal Estudiante (solo su portal)

## Instalación

1. **Ejecutar Migration SQL:**
   - Copiar contenido de `migrations-role-permissions.sql`
   - Ejecutar en Supabase SQL Editor
   - Esto crea la tabla y los permisos por defecto

2. **Usar en Componentes:**

```typescript
// En una página que quiera restringirse
"use client";

import { useModuleAccess } from "@hooks/useModuleAccess";

export default function MiPagina() {
  const { tieneAcceso } = useModuleAccess();

  if (!tieneAcceso("mi-modulo")) {
    return <div>No tienes acceso a este módulo</div>;
  }

  return <div>Contenido del módulo</div>;
}
```

3. **Filtrar Menú en Layout:**

Si deseas filtrar el menú del layout basado en permisos, usa:

```typescript
const { modulosAccesibles } = useModuleAccess();

// En los items del Menu, filtra:
items = items.filter(item => 
  modulosAccesibles.includes(item.key)
);
```

## Notas de Seguridad

- ✅ RLS habilitado en `role_permissions`: solo admin/director leen, solo admin escribe
- ✅ Se recomienda complementar con RLS en tablas de datos
- ✅ El hook `useCurrentUser` valida el rol desde la BD
- ✅ Los permisos se verifican tanto en cliente como en servidor

## Próximos Pasos

1. **Integrar en el Layout** - Filtrar menú según permisos
2. **Proteger Rutas** - Redirigir si no hay acceso
3. **Auditoría** - Registrar cambios de permisos
4. **Refinación** - Permisos más granulares (CRUD por módulo)
