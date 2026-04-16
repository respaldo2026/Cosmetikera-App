// Suprimir warnings específicos conocidos de librerías (antd v5 con React 19)
if (typeof window !== 'undefined') {
  const originalWarn = console.warn;
  const originalError = console.error;

  const warningsToIgnore = [
    'antd: Menu',
    'antd: compatible',
    'antd: Descriptions',
    'useForm',
    'GoTrueClient',
  ];

  console.warn = function (...args: any[]) {
    const message = args[0]?.toString?.() || '';
    const shouldIgnore = warningsToIgnore.some(w => message.includes(w));
    
    if (!shouldIgnore) {
      originalWarn.apply(console, args);
    }
  };

  console.error = function (...args: any[]) {
    const message = args[0]?.toString?.() || '';
    const shouldIgnore = warningsToIgnore.some(w => message.includes(w));
    
    if (!shouldIgnore) {
      originalError.apply(console, args);
    }
  };
}
