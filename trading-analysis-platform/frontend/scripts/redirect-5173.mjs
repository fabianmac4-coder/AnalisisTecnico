// Redirector minimo: la app vive en http://localhost:5174 (puerto fijo).
// Este proceso escucha en 5173 (URL antigua/marcadores viejos) y redirige,
// para que "la pagina en blanco" por puerto equivocado no vuelva a pasar.
// Uso: node scripts/redirect-5173.mjs
import http from "node:http";

const TARGET = "http://localhost:5174";

http
  .createServer((req, res) => {
    res.writeHead(307, { Location: `${TARGET}${req.url ?? "/"}` });
    res.end(`La app se movio a ${TARGET}`);
  })
  .listen(5173, () => {
    console.log(`Redirigiendo http://localhost:5173 -> ${TARGET}`);
  })
  .on("error", (err) => {
    // Si 5173 esta ocupado (p. ej. otro proyecto), no es critico: solo avisa.
    console.warn(`No se pudo escuchar en 5173: ${err.message}`);
  });
