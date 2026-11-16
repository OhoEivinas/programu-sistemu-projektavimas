import { createApp } from './api.ts';

const port = Number(process.env.PORT ?? '3000');
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT turi būti sveikasis skaičius nuo 1 iki 65535');
}

// Vietinis prototipas, pagal nutylėjimą nepasiekiamas iš išorinio tinklo.
createApp().listen(port, '127.0.0.1', () => {
  console.log(`Klinikos pamainų sistemos II etapas: http://127.0.0.1:${port}`);
  console.log('Sustabdyti: Ctrl+C');
});
