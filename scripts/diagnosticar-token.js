#!/usr/bin/env node

/**
 * Script para diagnosticar exactamente qué hay en .env.local
 */

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');

const lines = envContent.split('\n');
const tokenLine = lines.find(l => l.startsWith('WHATSAPP_ACCESS_TOKEN='));

if (tokenLine) {
  const token = tokenLine.split('=')[1];
  
  console.log('📋 DIAGNÓSTICO DEL TOKEN:\n');
  console.log(`Línea completa: ${tokenLine}`);
  console.log(`\nToken sin procesar:`);
  console.log(`  Comienza con: ${token.substring(0, 10)}`);
  console.log(`  Termina con: ${token.substring(token.length - 10)}`);
  console.log(`  Longitud total: ${token.length} caracteres`);
  console.log(`  Contiene espacios: ${token.includes(' ')}`);
  console.log(`  Contiene saltos: ${token.includes('\n')}`);
  console.log(`  Contiene tabulaciones: ${token.includes('\t')}`);
  
  // Limpieza
  const tokenLimpio = token.trim();
  console.log(`\n✨ Token limpio:`);
  console.log(`  Longitud: ${tokenLimpio.length} caracteres`);
  
  if (tokenLimpio.length < 200) {
    console.log(`\n⚠️  ADVERTENCIA: Token parece incompleto (< 200 chars)`);
    console.log(`   Tokens de Meta típicamente tienen 300-500 caracteres`);
  } else if (tokenLimpio.length > 500) {
    console.log(`\n⚠️  ADVERTENCIA: Token parece muy largo (> 500 chars)`);
  } else {
    console.log(`\n✅ Longitud del token parece normal`);
  }
} else {
  console.log('❌ No encontré WHATSAPP_ACCESS_TOKEN en .env.local');
}
