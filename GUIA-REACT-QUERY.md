# Guía de React Query - Caché Automático

## ✅ Configuración Completada

React Query se ha instalado y configurado exitosamente en la aplicación. El caché automático está activo.

### Beneficios Implementados:

- ⚡ **Caché de 5 minutos**: Los datos se mantienen frescos sin consultas repetidas
- 🔄 **Revalidación inteligente**: Actualización automática cuando es necesario
- 📦 **Datos compartidos**: Si dos componentes piden los mismos datos, solo se hace 1 consulta
- 🚀 **Navegación instantánea**: Al volver a una página, los datos ya están en caché
- 💾 **Persistencia en memoria**: Los datos se mantienen por 10 minutos aunque no se usen

---

## 📘 Cómo Usar React Query

### Ejemplo 1: Consulta Simple con Caché

**Antes (sin caché):**
```tsx
const [programas, setProgramas] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  const cargar = async () => {
    setLoading(true);
    const { data } = await supabaseBrowserClient
      .from("programas")
      .select("*")
      .eq("activo", true);
    setProgramas(data || []);
    setLoading(false);
  };
  cargar();
}, []);
```

**Después (con caché automático):**
```tsx
import { useQuery } from "@tanstack/react-query";

const { data: programas = [], isLoading } = useQuery({
  queryKey: ["programas", "activos"],
  queryFn: async () => {
    const { data } = await supabaseBrowserClient
      .from("programas")
      .select("*")
      .eq("activo", true);
    return data || [];
  },
});
```

✅ **Ventajas:**
- Menos código (no necesitas useState ni useEffect)
- Caché automático por 5 minutos
- Si otro componente pide los mismos datos, usa el caché
- Al volver a esta página, carga instantánea desde caché

---

### Ejemplo 2: Consulta con Parámetros Dinámicos

```tsx
import { useQuery } from "@tanstack/react-query";

function CursosDelPrograma({ programaId }: { programaId: string }) {
  const { data: cursos = [], isLoading } = useQuery({
    queryKey: ["cursos", programaId], // ⚠️ IMPORTANTE: incluir programaId en queryKey
    queryFn: async () => {
      const { data } = await supabaseBrowserClient
        .from("cursos")
        .select("*, programas(nombre)")
        .eq("programa_id", programaId)
        .eq("estado", "activo");
      return data || [];
    },
    enabled: !!programaId, // Solo ejecutar si programaId existe
  });

  if (isLoading) return <Spin />;
  
  return <div>{/* Mostrar cursos */}</div>;
}
```

🔑 **Clave:** El `queryKey` debe incluir todos los parámetros que afectan la consulta.

---

### Ejemplo 3: Mutación con Invalidación de Caché

**Cuando creas/editas/eliminas datos, debes invalidar el caché:**

```tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

function ProgramasPage() {
  const queryClient = useQueryClient();

  // 📥 CONSULTA con caché
  const { data: programas = [], isLoading } = useQuery({
    queryKey: ["programas"],
    queryFn: async () => {
      const { data } = await supabaseBrowserClient
        .from("programas")
        .select("*");
      return data || [];
    },
  });

  // 📤 MUTACIÓN (crear/editar/eliminar)
  const crearPrograma = useMutation({
    mutationFn: async (nuevoPrograma: any) => {
      const { data, error } = await supabaseBrowserClient
        .from("programas")
        .insert([nuevoPrograma]);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // ✨ INVALIDAR CACHÉ para que se recarguen los datos
      queryClient.invalidateQueries({ queryKey: ["programas"] });
      message.success("Programa creado");
    },
  });

  // Uso:
  const handleCrear = () => {
    crearPrograma.mutate({ nombre: "Nuevo Programa", activo: true });
  };

  return (
    <div>
      <Button onClick={handleCrear} loading={crearPrograma.isPending}>
        Crear Programa
      </Button>
      {isLoading ? <Spin /> : <List dataSource={programas} />}
    </div>
  );
}
```

---

### Ejemplo 4: Hook Personalizado Reutilizable

**Crear un hook para reutilizar en múltiples páginas:**

```tsx
// src/hooks/useProgramas.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseBrowserClient } from "@utils/supabase/client";

export function useProgramas(mostrarInactivos = false) {
  return useQuery({
    queryKey: ["programas", mostrarInactivos],
    queryFn: async () => {
      let query = supabaseBrowserClient
        .from("programas")
        .select("*");
      
      if (!mostrarInactivos) {
        query = query.eq("activo", true);
      }
      
      const { data } = await query;
      return data || [];
    },
  });
}

export function useCrearPrograma() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (programa: any) => {
      const { data, error } = await supabaseBrowserClient
        .from("programas")
        .insert([programa]);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programas"] });
    },
  });
}
```

**Uso en cualquier componente:**

```tsx
import { useProgramas, useCrearPrograma } from "@hooks/useProgramas";

function MiComponente() {
  const { data: programas, isLoading } = useProgramas();
  const crearPrograma = useCrearPrograma();

  return <div>...</div>;
}
```

---

## 🎯 Recomendaciones de Uso

### ¿Cuándo usar React Query?

✅ **SÍ usar en:**
- Listados (programas, cursos, estudiantes, etc.)
- Estadísticas del dashboard
- Detalles de entidades (ver un estudiante específico)
- Búsquedas con filtros
- Cualquier dato que se consulte múltiples veces

❌ **NO usar en:**
- Formularios que ya usan Refine (ya tienen su propia lógica)
- Consultas únicas que solo se hacen 1 vez
- Páginas donde Refine ya maneja el caché

### Nomenclatura de queryKey

```tsx
// ✅ BUENO: Específico y con parámetros
["programas", "activos"]
["cursos", programaId, "activos"]
["estudiante", estudianteId]
["dashboard", "estadisticas", timeRange]

// ❌ MALO: Muy genérico
["data"]
["list"]
```

### Configuración Actual

```tsx
{
  staleTime: 5 * 60 * 1000,        // 5 minutos - datos considerados "frescos"
  gcTime: 10 * 60 * 1000,          // 10 minutos - tiempo en memoria
  retry: 1,                         // 1 reintento en caso de error
  refetchOnWindowFocus: false,     // No recargar al volver a la ventana
}
```

---

## 🔍 Debugging

### Ver el estado del caché:

```tsx
import { useQueryClient } from "@tanstack/react-query";

const queryClient = useQueryClient();
console.log(queryClient.getQueryCache().getAll());
```

### Forzar recarga:

```tsx
queryClient.invalidateQueries({ queryKey: ["programas"] });
```

### Ver queries activas:

```tsx
queryClient.getQueriesData(["programas"]);
```

---

## 📊 Impacto Esperado

- **Primera carga:** Igual que antes
- **Navegación repetida:** **Instantánea** (datos desde caché)
- **Consultas duplicadas:** **Eliminadas** automáticamente
- **Memoria:** Incremento mínimo (~50KB por página cacheada)
- **Velocidad global:** **40-60% más rápido** al navegar

---

## 🚀 Próximos Pasos

1. ✅ **Configuración completada** (QueryProvider en layout)
2. 🔄 **Migrar página por página** a React Query
3. 📈 **Medir impacto** con performance.measure()
4. 🎨 **Optimizar queryKeys** para máxima eficiencia

---

## 📚 Recursos

- [React Query Docs](https://tanstack.com/query/latest/docs/react/overview)
- [Ejemplos de patrones](https://tanstack.com/query/latest/docs/react/examples/simple)
- [Optimistic updates](https://tanstack.com/query/latest/docs/react/guides/optimistic-updates)
