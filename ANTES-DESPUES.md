# 🔄 Antes y Después - Reestructuración de Cursos

## ❌ ESTRUCTURA ANTERIOR (Confusa)

### Tabla: `cursos`
```
id | nombre                      | profesor_id | duracion | precio | dias_semana | hora_inicio | ...
---|----------------------------|-------------|----------|--------|-------------|-------------|----
1  | Micropigmentación          | uuid-123    | 3 meses  | 2.5M   | L, Mi       | 09:00       |
2  | Micropigmentación          | uuid-456    | 3 meses  | 2.5M   | Sábados     | 14:00       |
3  | Micropigmentación          | uuid-789    | 3 meses  | 2.5M   | Ma, Ju      | 18:00       |
4  | Cejas y Pestañas           | uuid-234    | 2 meses  | 1.8M   | Mi, Vi      | 10:00       |
```

### ⚠️ Problemas:
- ❌ Misma información duplicada (nombre, duración, precio) en múltiples registros
- ❌ No está claro que las filas 1, 2, 3 son el mismo curso con distintos horarios
- ❌ Difícil actualizar precios globalmente (hay que cambiar en todos los registros)
- ❌ Confusión: ¿"curso" es el programa académico o la clase con horario?
- ❌ Reportes complicados (¿cuántos estudiantes tiene Micropigmentación en total?)

---

## ✅ ESTRUCTURA NUEVA (Clara y Escalable)

### Tabla 1: `programas` (Nivel Superior)
```
id | nombre                      | duracion | precio | descripcion              | contenido          |
---|-----------------------------|----------|--------|--------------------------|-------------------|
1  | Micropigmentación           | 3 meses  | 2.5M   | Curso completo de...     | Módulo 1: ...     |
2  | Cejas y Pestañas            | 2 meses  | 1.8M   | Técnicas avanzadas...    | Tema 1: ...       |
3  | Extensión de Pestañas       | 6 semanas| 1.2M   | Profesionaliza tu...     | Introducción: ... |
```

### Tabla 2: `cursos` → ahora son GRUPOS/COHORTES (Nivel Secundario)
```
id | programa_id | nombre            | profesor_id | dias_semana | hora_inicio | hora_fin | cupos | fecha_inicio |
---|-------------|-------------------|-------------|-------------|-------------|----------|-------|--------------|
1  | 1           | Grupo Mañana      | uuid-123    | L, Mi       | 09:00       | 12:00    | 15    | 2025-01-13   |
2  | 1           | Grupo Fin Semana  | uuid-456    | Sábados     | 14:00       | 18:00    | 12    | 2025-01-18   |
3  | 1           | Grupo Nocturno    | uuid-789    | Ma, Ju      | 18:00       | 21:00    | 10    | 2025-01-20   |
4  | 2           | Grupo A           | uuid-234    | Mi, Vi      | 10:00       | 13:00    | 20    | 2025-02-01   |
5  | 3           | Grupo Intensivo   | uuid-567    | Lun-Vie     | 08:00       | 11:00    | 8     | 2025-02-10   |
```

### ✅ Ventajas:
- ✅ **Información única** del programa en un solo lugar
- ✅ **Relación clara:** Programa → Múltiples Grupos
- ✅ **Fácil actualización:** Cambiar precio del programa afecta a todos los grupos
- ✅ **Semántica clara:** "Programa" es el curso, "Grupo" es la instancia con horario
- ✅ **Reportes simples:** `SELECT * FROM grupos WHERE programa_id = 1` para ver todos los horarios de Micropigmentación
- ✅ **Escalable:** Agregar nuevos grupos sin duplicar info del programa

---

## 📊 Visualización Conceptual

### ANTES
```
CURSOS (Todo mezclado)
├── Micropigmentación L-Mi 9am   (duplica info)
├── Micropigmentación Sábados    (duplica info)
├── Micropigmentación Ma-Ju 6pm  (duplica info)
├── Cejas Mi-Vi                  (duplica info)
└── Extensión Lun-Vie            (duplica info)
```

### DESPUÉS
```
PROGRAMAS (Nivel Superior - Info General)
│
├── 📚 Micropigmentación (3 meses, $2.5M)
│   ├── 👥 Grupo Mañana (L-Mi 9am)        ← Los estudiantes se matriculan aquí
│   ├── 👥 Grupo Fin Semana (Sáb 2pm)     ← Los estudiantes se matriculan aquí
│   └── 👥 Grupo Nocturno (Ma-Ju 6pm)     ← Los estudiantes se matriculan aquí
│
├── 📚 Cejas y Pestañas (2 meses, $1.8M)
│   └── 👥 Grupo A (Mi-Vi 10am)           ← Los estudiantes se matriculan aquí
│
└── 📚 Extensión de Pestañas (6 sem, $1.2M)
    └── 👥 Grupo Intensivo (Lun-Vie 8am)  ← Los estudiantes se matriculan aquí
```

---

## 🔄 Flujo de Trabajo Comparado

### ANTES (Confuso)
```
1. Usuario quiere crear "Micropigmentación los sábados"
   ↓
2. Crea un nuevo "curso" llamado "Micropigmentación"
   ↓
3. Llena TODA la información (nombre, descripción, duración, precio...)
   ↓
4. Agrega horario sábados
   ↓
5. ⚠️ Problema: Ya existe otro "Micropigmentación" con info duplicada
```

### DESPUÉS (Claro)
```
1. Usuario quiere crear "Micropigmentación los sábados"
   ↓
2. Va a "Programas" → Verifica que "Micropigmentación" ya existe
   ↓
3. Va a "Grupos/Cohortes" → "Nueva Cohorte"
   ↓
4. Selecciona programa: "Micropigmentación"
   ↓
5. Solo ingresa: nombre grupo, días (sábados), horario, profesor, cupos
   ↓
6. ✅ El precio, duración, contenido se heredan del programa automáticamente
```

---

## 📱 Interfaz de Usuario - Comparación

### ANTES: Lista Plana
```
Cursos
─────────────────────────────────────────────
[+] Crear Curso

📖 Micropigmentación                    $2.5M
   Lunes y Miércoles 9am-12pm
   [Gestionar] [Editar]

📖 Micropigmentación                    $2.5M  ← Duplicado!
   Sábados 2pm-6pm
   [Gestionar] [Editar]

📖 Micropigmentación                    $2.5M  ← Duplicado!
   Martes y Jueves 6pm-9pm
   [Gestionar] [Editar]

📖 Cejas y Pestañas                     $1.8M
   Miércoles y Viernes 10am-1pm
   [Gestionar] [Editar]
```

### DESPUÉS: Jerárquica y Clara
```
Oferta Académica
─────────────────────────────────────────────
[+] Nueva Cohorte

▼ 📚 Micropigmentación                   
  3 meses | $2.5M | 37 estudiantes
  [2 Activos] [1 Próximo] [5 Terminados]
  
  🟢 Cohortes Activas (2)
  ┌────────────────────────────────────────┐
  │ Grupo Mañana | 13 Ene 2025            │
  │ 📅 Lunes, Miércoles                    │
  │ 🕒 09:00 - 12:00                       │
  │ 👤 Prof. María García                  │
  │ 👥 12/15 estudiantes                   │
  │         [Gestionar] [Editar]           │
  └────────────────────────────────────────┘
  
  ┌────────────────────────────────────────┐
  │ Grupo Fin de Semana | 18 Ene 2025     │
  │ 📅 Sábados                             │
  │ 🕒 14:00 - 18:00                       │
  │ 👤 Prof. Juan Pérez                    │
  │ 👥 10/12 estudiantes                   │
  │         [Gestionar] [Editar]           │
  └────────────────────────────────────────┘
  
  🔵 Próximos Inicios (1)
  ┌────────────────────────────────────────┐
  │ Grupo Nocturno | 20 Ene 2025          │
  │ 📅 Martes, Jueves                      │
  │ 🕒 18:00 - 21:00                       │
  │ 👤 Prof. Ana López                     │
  │ 👥 8/10 estudiantes                    │
  │         [Gestionar] [Editar]           │
  └────────────────────────────────────────┘

▼ 📚 Cejas y Pestañas
  2 meses | $1.8M | 15 estudiantes
  [1 Activo] [0 Próximos] [2 Terminados]
  ...
```

---

## 💾 Impacto en Base de Datos

### Storage Efficiency
**ANTES:**
- 3 filas de "Micropigmentación" = 3 × (nombre + descripción + duracion + precio + contenido) = ~600 bytes × 3 = 1800 bytes

**DESPUÉS:**
- 1 fila en `programas` (600 bytes) + 3 filas en `cursos` (100 bytes cada) = 900 bytes
- **Ahorro: 50% de espacio** para misma información

### Update Performance
**ANTES:**
```sql
-- Cambiar precio de Micropigmentación en los 3 grupos
UPDATE cursos SET precio = 2800000 WHERE nombre = 'Micropigmentación';
-- Afecta múltiples filas, riesgo de inconsistencia
```

**DESPUÉS:**
```sql
-- Cambiar precio del programa (un solo registro)
UPDATE programas SET precio = 2800000 WHERE id = 1;
-- Todos los grupos heredan el nuevo precio automáticamente
```

---

## 🎯 Casos de Uso Mejorados

### 1. Reporte: "¿Cuántos estudiantes tiene Micropigmentación?"

**ANTES:**
```sql
SELECT SUM(matriculas_count)
FROM cursos c
LEFT JOIN (
  SELECT curso_id, COUNT(*) as matriculas_count
  FROM matriculas
  GROUP BY curso_id
) m ON c.id = m.curso_id
WHERE c.nombre LIKE '%Micropigmentación%';
-- Complejo, puede fallar si los nombres varían
```

**DESPUÉS:**
```sql
SELECT COUNT(*)
FROM matriculas m
JOIN cursos c ON m.curso_id = c.id
WHERE c.programa_id = 1;
-- Simple, confiable, rápido
```

### 2. Crear Nueva Cohorte

**ANTES:** 15 campos a llenar (incluye info duplicada)
**DESPUÉS:** 7 campos (programa_id, nombre grupo, días, horarios, profesor, cupos, fechas)

### 3. Actualizar Contenido del Curso

**ANTES:** Actualizar manualmente en cada "curso" individual
**DESPUÉS:** Actualizar una vez en `programas`, todos los grupos reflejan el cambio

---

## 🚀 Escalabilidad Futura

Con esta estructura es fácil agregar:

### Nivel Programa:
- ✅ Requisitos previos
- ✅ Certificación otorgada
- ✅ Temario completo
- ✅ Materiales incluidos
- ✅ Política de cancelación

### Nivel Grupo:
- ✅ Aula asignada
- ✅ Modalidad (presencial/virtual/híbrida)
- ✅ Material físico entregado por grupo
- ✅ Evaluaciones específicas del grupo
- ✅ Fotografías/testimonios del grupo

### Análisis:
- Rendimiento académico por grupo
- Comparación entre horarios (¿mañana vs noche tienen mejor rendimiento?)
- Preferencias de horario por demografía
- Ocupación promedio por tipo de grupo

---

## ✨ Conclusión

| Aspecto | Antes | Después |
|---------|-------|---------|
| **Claridad** | ⭐⭐ Confuso | ⭐⭐⭐⭐⭐ Muy claro |
| **Mantenimiento** | ⭐⭐ Tedioso | ⭐⭐⭐⭐⭐ Sencillo |
| **Escalabilidad** | ⭐⭐ Limitada | ⭐⭐⭐⭐⭐ Excelente |
| **Storage** | ⭐⭐ Duplicación | ⭐⭐⭐⭐ Optimizado |
| **Reportes** | ⭐⭐ Complejos | ⭐⭐⭐⭐⭐ Simples |
| **UX** | ⭐⭐⭐ Aceptable | ⭐⭐⭐⭐⭐ Intuitiva |

**Resultado:** Sistema profesional, escalable y fácil de mantener 🎉
