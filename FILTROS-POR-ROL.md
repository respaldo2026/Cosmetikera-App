# Implementación de Filtros por Rol

## Resumen
Se han implementado filtros dinámicos en todas las páginas principales para que cada usuario vea solo los datos relevantes según su rol:

- **Profesor**: Ve solo sus cursos, sus estudiantes matriculados, sus asistencias, sus pagos y sus pagos de nómina
- **Estudiante**: Ve solo sus cursos
- **Admin/Director/Administrativo**: Ven todos los datos (sin restricciones)

## Cambios Realizados

### 1. Nuevo Hook: `useCurrentUser` 
**Archivo**: `src/hooks/useCurrentUser.ts`
- Hook personalizado que obtiene el usuario actual y su rol
- Maneja sincronización con Supabase Auth
- Retorna `{ user, loading }` con información de rol

```typescript
const { user, loading } = useCurrentUser();
// user = { id, email, rol, nombre_completo }
```

### 2. Páginas Actualizadas con Filtros

#### **Cursos** (`src/app/cursos/page.tsx`)
- Importa `useCurrentUser`
- Filtros dinámicos:
  - Profesor: `eq("profesor_id", user.id)`
  - Estudiante: `eq("perfiles.id", user.id)`
  - Admin/otros: sin filtro

#### **Estudiantes** (`src/app/estudiantes/page.tsx`)
- Importa `useCurrentUser`
- Construcción dinámica de filtros con función `permanentFilters()`
- Profesor: solo ve estudiantes de sus cursos
- Otros: ven todos los estudiantes

#### **Asistencias** (`src/app/asistencias/page.tsx`)
- Importa `useCurrentUser`
- Selector de cursos filtra por rol del profesor
- Profesor: solo ve sus cursos en el selector

#### **Matrículas** (`src/app/matriculas/page.tsx`)
- Importa `useCurrentUser`
- Profesor: `eq("cursos.profesor_id", user.id)`
- Otros: ven todas las matrículas

#### **Tesorería/Pagos** (`src/app/tesoreria/page.tsx`)
- Importa `useCurrentUser`
- Profesor: solo ve sus pagos (`eq("perfiles.id", user.id)`)
- Otros: ven todos los pagos

#### **Nómina** (`src/app/nomina/page.tsx`)
- Importa `useCurrentUser`
- Profesor: solo ve su propia nómina
- Admin: ve nómina de todos los profesores
- Filtra profesores en la query principal

## Patrón de Implementación

```typescript
// 1. Importar el hook
import { useCurrentUser } from "@hooks/useCurrentUser";

// 2. Usar el hook en el componente
const { user } = useCurrentUser();

// 3. Construir filtros dinámicamente
const permanentFilters = () => {
    const filters: any[] = [];
    
    if (user?.rol === "profesor") {
        filters.push({ field: "profesor_id", operator: "eq", value: user.id });
    }
    
    return filters;
};

// 4. Pasar filtros a useTable
const { tableProps } = useTable({
    resource: "...",
    filters: {
        permanent: permanentFilters()
    }
});
```

## Próximos Pasos

1. **Refine RLS si es necesario**: Las políticas de Supabase pueden complementarse con filtros adicionales en la UI
2. **Pruebas**: Verificar que cada rol ve solo sus datos
3. **Mensajes informativos**: Mostrar alertas cuando un profesor intenta acceder a cursos ajenos
4. **Auditoría**: Registrar accesos a datos en casos sensibles

## Notas Técnicas

- Los filtros se aplican **en el cliente** usando Refine's `useTable`
- Para mayor seguridad, también deben estar protegidos **en el servidor** con RLS de Supabase
- El hook `useCurrentUser` es reutilizable en otros componentes
- Los estudiantes solo ven sus propios cursos (futura mejora: mostrar catálogo disponible)
