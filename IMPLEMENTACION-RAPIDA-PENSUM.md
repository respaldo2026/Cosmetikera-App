# 🚀 Guía de Implementación Rápida - Pensum y Materiales

## ⚡ En 3 Pasos Estará Todo Funcionando

### Paso 1: Ejecutar Migración (2 minutos)

```
1. Abre: Supabase Dashboard → SQL Editor
2. Abre el archivo: migration-pensum-materiales-2026.sql
3. Copia TODO el contenido
4. Pégalo en Supabase
5. Haz clic en RUN
6. ¡Listo! ✅
```

### Paso 2: Crear Bucket de Storage (1 minuto)

```
1. Supabase Dashboard → Storage → Create new bucket
2. Nombre: material_didactico
3. ❌ Desactiva "Private bucket"
4. Create bucket
5. ¡Listo! ✅
```

### Paso 3: Usar en la Aplicación (Ahora)

```
1. Ve a: http://localhost:3001/programas
2. Haz clic en "Gestionar Pensum/Material" de un programa
3. ¡Ya puedes crear pensum y subir materiales! 🎉
```

---

## 📋 Checklist de Verificación

- [ ] Migración ejecutada en Supabase sin errores
- [ ] Bucket `material_didactico` creado y es público
- [ ] Puedo entrar a la página /programas
- [ ] Puedo hacer clic en "Gestionar Pensum/Material"
- [ ] Puedo crear un nuevo ciclo
- [ ] Puedo agregar cursos al ciclo
- [ ] Puedo subir un archivo de prueba
- [ ] Puedo descargar el archivo desde el listado

---

## 🎬 Primera Ejecución (Ejemplo Real)

### Crear Pensum para "Micropigmentación Profesional"

1. **Crear Ciclo 1**:
   - Número: 1
   - Nombre: Ciclo Introductorio
   - Duración: 4 semanas
   - Horas: 40
   - Descripción: Fundamentos y seguridad

2. **Agregar cursos al Ciclo 1**:
   - **Seguridad e Higiene** | 8 horas | Obligatorio
   - **Anatomía Facial** | 16 horas | Obligatorio
   - **Pigmentos** | 10 horas | Obligatorio
   - **Herramientas** | 6 horas | Complementario

3. **Subir materiales**:
   - Archivo: "Guía-Seguridad.pdf" | Documento
   - Archivo: "Tutorial-Anatomia.mp4" | Video
   - Archivo: "Plantilla-Practica.xlsx" | Recurso

4. **Crear grupos para el programa**:
   - Los grupos heredarán automáticamente este pensum

---

## 📞 Próximas Características (Roadmap)

- [ ] Integración automática de pensum en creación de grupos
- [ ] Visualización de pensum en portal del estudiante
- [ ] Visualización de materiales en oficina del profesor
- [ ] Estadísticas de descargas de materiales
- [ ] Control de progreso por ciclo
- [ ] Evaluaciones asociadas a cada ciclo

---

## 🔧 Cambios Realizados en el Código

### Archivos Nuevos:
- `migration-pensum-materiales-2026.sql` - Migración completa
- `src/components/GestorPensum.tsx` - Componente principal
- `GUIA-PENSUM-MATERIALES.md` - Documentación completa

### Archivos Modificados:
- `src/app/programas/page.tsx` - Integración del gestor

### No requiere cambios en otros archivos

---

## 🆘 Si Algo No Funciona

**1. Migración fallida**
```
→ Copia el error exacto y busca la línea problemática
→ Verifica que no haya ejecutado antes (usa CREATE IF NOT EXISTS)
```

**2. Bucket de storage no es público**
```
→ Ve a Storage → Selecciona material_didactico
→ Settings → Desactiva "Private bucket"
```

**3. No veo el botón "Gestionar Pensum/Material"**
```
→ Recarga la página (Ctrl+F5)
→ Verifica que estés en /programas
```

**4. Error al subir archivo**
```
→ Verifica el tamaño (empieza con archivos pequeños)
→ Verifica el formato
→ Ve a Storage y crea manualmente un archivo de prueba
```

---

¡Listo! 🎉 Ahora tu sistema de pensum está en producción.
