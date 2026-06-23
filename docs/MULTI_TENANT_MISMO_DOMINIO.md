# DEPRECADO: enfoque multi-base por tenant

Este documento quedó obsoleto.

Decisión actual del proyecto:

- Modelo SaaS con un solo proyecto Supabase.
- Aislamiento multi-tienda por tenant_id + filtros por tenant en API.
- Migración por fases documentada en docs/SAAS_FASE_1_2_3.md.

Si necesitas retomar el enfoque de "una base por tienda", abrir un documento nuevo para no mezclar estrategias.
