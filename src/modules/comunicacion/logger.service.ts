// Servicio de logging centralizado
export const logger = {
  info: (...args: any[]) => console.info(...args),
  warn: (...args: any[]) => console.warn(...args),
  error: (...args: any[]) => console.error(...args),
  log: (...args: any[]) => console.log(...args),
};
