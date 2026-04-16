#!/usr/bin/env node

/**
 * Script para generar og-image.png desde og-image.svg
 * Ejecutar: node generate-og-image.js
 */

const fs = require('fs');
const path = require('path');

// Crear una imagen PNG minimalista con el logo
// Usando Canvas si está disponible, sino fallback
try {
  const { createCanvas } = require('canvas');
  
  const width = 1200;
  const height = 630;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Gradiente de fondo (púrpura/dorado como Academia Crystal)
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#6b2c91');
  gradient.addColorStop(1, '#c88141');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  // Texto principal
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 72px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Academia Crystal', width / 2, height / 2 - 60);
  
  // Texto secundario
  ctx.font = '48px Arial';
  ctx.fillStyle = '#f0d696';
  ctx.fillText('Diamante', width / 2, height / 2 + 40);
  
  // Subtítulo
  ctx.font = '32px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Programas de Belleza y Estética', width / 2, height / 2 + 100);
  
  // Guardar como PNG
  const buffer = canvas.toBuffer('image/png');
  const outputPath = path.join(__dirname, 'public', 'og-image.png');
  fs.writeFileSync(outputPath, buffer);
  console.log(`✓ og-image.png generada exitosamente en ${outputPath}`);
  
} catch (error) {
  console.log('Canvas no disponible. Instalando dependencias...');
  console.log('Para generar og-image.png, ejecuta: npm install canvas');
  console.log('\nMientras tanto, asegúrate de que og-image.svg esté en public/');
}
