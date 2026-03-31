import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// В dev иногда прилетают unhandledrejection с reason как plain object (например, из сетевых/axios ошибок),
// из-за чего CRA показывает "красный экран" с [object Object]. Здесь нормализуем и не даём оверлею
// засорять экран, но реальные Error'ы по-прежнему будут видны.
if (process.env.NODE_ENV !== 'production') {
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason: any = (event as any).reason;
    if (reason && typeof reason === 'object' && !(reason instanceof Error)) {
      // предотвращаем стандартный overlay для non-Error объектов
      event.preventDefault();
      // логируем детально в консоль
      // eslint-disable-next-line no-console
      console.error('Unhandled promise rejection (object):', reason);
    }
  });

  // Аналогично: некоторые библиотеки кидают plain object синхронно → CRA показывает [object Object].
  // Сохраняем лог в консоль и не даём оверлею “захватить” экран, если это не Error.
  window.addEventListener('error', (event: ErrorEvent) => {
    const err: any = (event as any).error;
    const msg = String((event as any).message || '');
    const isPlainObjectError = err && typeof err === 'object' && !(err instanceof Error);
    const looksLikeObjectString = msg.includes('[object Object]');
    if (isPlainObjectError || looksLikeObjectString) {
      event.preventDefault();
      // eslint-disable-next-line no-console
      console.error('Window error (object):', { message: msg, error: err, filename: event.filename, lineno: event.lineno, colno: event.colno });
    }
  }, true);
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
