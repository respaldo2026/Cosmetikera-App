# 🎁 Sistema de Entrega de Materiales (Camisetas y Kits)

## ✅ Lo que se creó:

### 1. **Base de Datos** (`migration-entregas-materiales.sql`)
- ✅ Tabla `entregas_materiales` para registrar cada entrega
- ✅ Campos: tipo (camiseta/kit), talla, mes/ciclo, fecha, quien entregó
- ✅ Políticas RLS: Todos ven, solo profes/admins registran
- ✅ Función `obtener_resumen_entregas()` para estadísticas rápidas
- ✅ Vista `v_entregas_materiales_completa` con nombres completos

### 2. **Componentes React** (`src/components/EntregaMaterialModal.tsx`)
- ✅ `EntregaMaterialModal`: Modal para registrar entregas
- ✅ `HistorialEntregas`: Tabla con historial completo
- ✅ Resumen visual: badges de camiseta entregada y total de kits

---

## 📋 Pasos para activar:

### **Paso 1: Ejecutar migración en Supabase**
1. Abre Supabase → SQL Editor
2. Copia TODO el contenido de `migration-entregas-materiales.sql`
3. Ejecuta (RUN)
4. Verifica que salga: "Tabla entregas_materiales creada correctamente"

### **Paso 2: Integrar en la oficina del profesor**
Agregar botón de entrega en `/mi-oficina/page.tsx`:

```tsx
// 1. Importar componentes (agregar al inicio)
import { EntregaMaterialModal } from "@components/EntregaMaterialModal";
import { GiftOutlined } from "@ant-design/icons";

// 2. Agregar estados (dentro del componente)
const [modalEntregaVisible, setModalEntregaVisible] = useState(false);
const [estudianteSeleccionado, setEstudianteSeleccionado] = useState<any>(null);

// 3. Función para abrir modal
const abrirModalEntrega = (estudiante: any) => {
  setEstudianteSeleccionado(estudiante);
  setModalEntregaVisible(true);
};

// 4. Agregar botón en la tabla de estudiantes (columna Acciones)
<Button
  size="small"
  icon={<GiftOutlined />}
  onClick={() => abrirModalEntrega(record)}
>
  Entregar Material
</Button>

// 5. Agregar modal al final del componente
<EntregaMaterialModal
  visible={modalEntregaVisible}
  onCancel={() => setModalEntregaVisible(false)}
  onSuccess={() => {
    // Opcional: recargar lista si es necesario
  }}
  estudianteId={estudianteSeleccionado?.id}
  estudianteNombre={estudianteSeleccionado?.nombre_completo}
  profesorId={user?.id} // ID del profesor actual
/>
```

### **Paso 3: Mostrar en perfil del estudiante**
En `/estudiantes/show/[id]/page.tsx`:

```tsx
// 1. Importar componente
import { HistorialEntregas } from "@components/EntregaMaterialModal";

// 2. Agregar sección (después de pagos/cursos)
<Card 
  title="🎁 Materiales Entregados" 
  style={{ marginTop: 16 }}
>
  <HistorialEntregas estudianteId={params.id} />
</Card>
```

### **Paso 4: Dashboard del estudiante** (Portal estudiante)
En `/portal-estudiante/page.tsx`:

```tsx
// Similar al paso 3
<Card title="🎁 Mis Materiales">
  <HistorialEntregas estudianteId={user?.id} />
</Card>
```

---

## 🎯 Funcionalidades:

### ✅ **Para Profesores:**
- Registrar entrega de camiseta (con talla)
- Registrar entrega de kit mensual
- Ver historial de lo entregado a cada estudiante

### ✅ **Para Estudiantes:**
- Ver sus materiales recibidos
- Ver badges: "✅ Camiseta entregada" y "📦 3 Kits recibidos"

### ✅ **Para Administradores:**
- Ver todos los registros
- Generar reportes de entregas
- Ver quién NO ha recibido su camiseta o kit del mes

---

## 📊 Campos del registro:

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| `tipo_material` | camiseta o kit | "camiseta" |
| `talla` | Solo para camisetas | "M", "XL" |
| `mes_ciclo` | Solo para kits | "Enero 2026", "Ciclo 1" |
| `descripcion` | Detalles del material | "Kit con cuaderno y lapiceros" |
| `fecha_entrega` | Cuándo se entregó | 2026-01-15 |
| `entregado_por` | Quién lo entregó | ID del profesor |
| `observaciones` | Notas adicionales | "Estudiante pidió talla especial" |

---

## 🚀 Próximos pasos opcionales:

1. **Reportes por mes:** Ver qué estudiantes faltan por recibir el kit del mes actual
2. **Alertas automáticas:** Notificar cuando un estudiante lleva X meses sin kit
3. **Inventario:** Controlar stock de camisetas por talla
4. **Fotos:** Permitir subir foto de la entrega como evidencia

---

¿Quieres que implemente alguna de estas integraciones ahora o primero pruebas la migración? 👍
