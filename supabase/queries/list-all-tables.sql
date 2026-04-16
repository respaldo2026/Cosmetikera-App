-- Script para ver todas las tablas y sus campos en Supabase
-- Ejecuta esto en SQL Editor de Supabase

SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM 
  information_schema.columns
WHERE 
  table_schema = 'public'
ORDER BY 
  table_name, 
  ordinal_position;
