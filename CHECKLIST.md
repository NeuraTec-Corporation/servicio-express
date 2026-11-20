# Servicio Express — implementación

Fuente: Notion 3e6839ef36028140a85dcff094d58f2d; mandato del titular 2026-11-16 autoriza recursos exclusivos del MVP.

| Entregable | Estado | Evidencia |
|---|---|---|
| Leer y conciliar Notion | Completado | Requisitos consultados; mandato actual sustituye restricciones cloud anteriores |
| Modelo de datos y reglas | Completado | Migración 001_initial.sql ejecutada en Neon |
| Repositorio público GitHub | Completado | NeuraTec-Corporation/servicio-express; PR 1, rama codex/mvp |
| Neon y variables seguras | Completado | Proyecto icy-boat-13975230, Free; conexión privada y secretos en Vercel |
| Aplicación compacta | Completado | Meridian aprobado, desplegado y verificado en escritorio y móvil |
| Importación y revisión humana | En curso | TXT/CSV/XLSX implementados; PDF/imágenes con transcripción manual; prueba integral completa pendiente |
| Historial de ofertas y políticas | Completado | Separado de compras y ventas, auditoría y consulta por variante |
| Autenticación y auditoría | Completado | Acceso de laboratorio comprobado; clave compartida por solicitud del titular |
| Pruebas funcionales y técnicas | En curso | TypeScript y 7/7 pruebas pasan; Meridian: búsqueda, selección, historial y carga comprobados; prueba integral completa de importación/publicación pendiente |
| Vercel privado y verificación URL | Completado | Meridian READY, commit 946d1f12a4a6c35785644e7175fe9d4da9863c36; URL y acceso verificados |
| Documentación Notion y operación | En curso | Página 41a839ef36028175b471e7c436ba77b6 y README |

Sin POS, automatización WhatsApp, datos reales, dominios ni contratación de planes.

## Diseño aprobado

Meridian, con cinco columnas por variante. El nombre del proveedor selecciona el detalle del panel derecho, centrado verticalmente; copiar cotización está en ese panel. La tabla se adapta a filas de dos columnas en móvil para evitar desplazamiento horizontal. Fuentes e historial permanecen accesibles.


## Dashboard gerencial y limpieza — 2026-11-18

Completados y desplegados: pestaña gerencial, 12 filtros, seis gráficos, registro/edición de operaciones y exportación CSV. Ofertas separadas de operación real; sin sumar monedas distintas ni inventar costos desconocidos.

Limpieza por catálogo o laboratorio completo con clave y confirmación BORRAR. No se ejecutó la limpieza global. Se retiraron únicamente tres operaciones temporales de QA; quedaron cero operaciones y se conservaron las dos ofertas originales.

Verificación: TypeScript y 18/18 pruebas; persistencia API, filtros, CSV, gráficos y móvil sin desbordamiento. Despliegue READY dpl_B8Cnv6FhTfXxWL7xfhNv73tRKyzw. PR 2 fusionado, commit f28e79e1701d0c10d2da6aa8e4aa8ec483b78ae2. Documentación Notion actualizada.

## Lectura de documentos — 2026-11-20

Implementados: PDF digital y escaneado, OCR de capturas PNG/JPG/WEBP en navegador, arrastrar/soltar, pegar imagen con Ctrl+V, vista previa, progreso, cancelar y texto extraído editable. Motores e idiomas en el propio sitio, sin API OCR de pago.

TypeScript y 26 pruebas pasan. Captura, PDF digital y PDF escaneado produjeron tres candidatos con importes 480/520/180 USD; el PDF digital usa extracción de texto directa. API CSV/XLSX conserva originales byte por byte. No se publicaron ofertas QA: las dos originales permanecen. Los borradores QA identificados como ficticios se conservaron como evidencia de carga. Se verificó bloqueo de publicación sin revisión y rechazo de fuentes sin productos o imágenes sin extracción. PDF de 21 páginas rechazado sin carga parcial. La cancelación devuelve el control inmediatamente. Límites visibles: 4 MB, 20 páginas, 100.000 caracteres y 500 productos.
