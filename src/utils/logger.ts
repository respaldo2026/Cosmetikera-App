// src/utils/logger.ts
// Simple advanced logger for browser and server

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const isProd = process.env.NODE_ENV === 'production';

function formatMsg(level: LogLevel, ...args: any[]) {
  const prefix = `[${level.toUpperCase()}][AcademiaCrystal]`;
  return [prefix, ...args];
}

export const logger = {
  info: (...args: any[]) => {
    if (!isProd) console.info(...formatMsg('info', ...args));
  },
  warn: (...args: any[]) => {
    if (!isProd) console.warn(...formatMsg('warn', ...args));
  },
  error: (...args: any[]) => {
    // Siempre mostrar errores en consola, pero se puede integrar con Sentry aquí
    console.error(...formatMsg('error', ...args));
    // Ejemplo: enviar a Sentry
    // if (isProd && window.Sentry) window.Sentry.captureException(args[0]);
  },
  debug: (...args: any[]) => {
    if (!isProd) console.debug(...formatMsg('debug', ...args));
  },
};
