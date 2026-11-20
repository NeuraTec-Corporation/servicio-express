# Servicio Express

MVP privado de consulta y cotización de ofertas mayoristas. Código público por decisión del titular; datos, fuentes y secretos privados. No usar datos reales hasta completar validación de accesos.

## Operación

1. Entrar con la clave privada del piloto (sesión de 8 horas).
2. Cargar precios: indicar proveedor, pegar texto o subir CSV/XLSX. Formato de texto inequívoco: `Apple | iPhone 13 | 128 GB negro libre | 400 | USD`.
3. Revisar marca, modelo, variante, proveedor, costo y moneda. Abrir Condiciones para disponibilidad, fecha, entrega, horarios, logística, garantía y devoluciones. Confirmar cada fila. Un cambio invalida su revisión.
4. Publicar precios validados. El lote se publica una sola vez, de forma atómica; reemplaza únicamente la oferta activa del mismo proveedor/variante/moneda, conservando historial.
5. Buscar y filtrar. Guardar el recargo con ✓: por oferta o predeterminado por variante. Un ajuste de oferta tiene prioridad; «Heredar variante» lo elimina.
6. Copiar cotización. Abrir el proveedor para ver condiciones, fuente e historial.

Recargo porcentual sobre costo + logística conocida, o suma fija en la moneda de la oferta. No hay conversión monetaria. Impuestos y cargos desconocidos no se inventan. Sin recargo configurado no se presenta precio de venta. Una lista no acredita stock ni compra.

## Dashboard gerencial

La pestaña superior separa **Compras, ventas y servicios reales** de **Ofertas de proveedores**. Filtros: año, mes, marca, modelo, parte, pieza, técnico, oficina, proveedor, moneda, operación y categoría. Los valores provienen de registros disponibles; no se fabrican técnicos, sucursales ni movimientos. Para ver totales con varias monedas hay que elegir una.

Usar **Registrar operación** para anotar una compra, venta, reparación/servicio o gasto efectivamente realizado: fecha, categoría, cantidad, moneda e importe unitario; contexto de modelo, técnico, oficina y, opcionalmente, parte, pieza, variante y proveedor. El costo desconocido se deja vacío, no en cero. La utilidad bruta se calcula solo para ventas/servicios con costo conocido; las compras de inventario se muestran aparte y no se descuentan una segunda vez como costo de venta. No es un cálculo de utilidad neta contable ni inventario autoritativo.

Gráficos: evolución mensual, comparación de costos/ingresos, distribución por categoría, desglose por modelo/parte/pieza/técnico/oficina/proveedor, servicios por técnico y mapa mensual de oficinas. Los períodos sin actividad se incluyen con cero en la serie. La vista de proveedores presenta costos ofertados e historial, nunca ventas reales. Exportación CSV conserva filtros, moneda y procedencia. Edición y eliminación de registros manuales tienen auditoría; los históricos de compras/ventas existentes se consultan sin editarlos desde esta vista.

`db/002_management.sql` es una migración versionada. Puede aplicarse con `npm run db:migrate`; el piloto también la aplica una sola vez bajo bloqueo transaccional al primer acceso autenticado al dashboard o a la limpieza. Vercel incluye explícitamente el SQL en el paquete. Los reportes del piloto están limitados a 10.000 registros por dominio; si se supera el límite, se muestra error y no se presentan totales parciales. Antes de ampliar el volumen se requiere agregación de servidor y paginación de origen.

## Limpiar datos

**Limpiar datos** permite borrar solo catálogo (ofertas históricas/actuales, fuentes originales y variantes no referenciadas) o todo el laboratorio, incluido el registro gerencial y compras/ventas históricas. Muestra el alcance antes de actuar y exige escribir `BORRAR` y confirmar la clave. Es irreversible desde la aplicación; exportar antes lo necesario. No se ejecuta automáticamente al instalar. La limpieza es transaccional y exclusiva del tenant del piloto; conserva acceso, migraciones, auditoría y límites de intentos. La auditoría de modificaciones puede conservar valores anteriores. La eliminación individual también requiere clave y confirmación.

## Desarrollo

Node 22 o 24, npm. `npm ci`, copiar `.env.example` a `.env.local`, configurar variables privadas, `npm run db:migrate`, `npm run dev`. `npm run check`, `npm test`, `npm run build`.

Variables: `DATABASE_URL` (PostgreSQL SSL), `AUTH_SECRET` (32 caracteres aleatorios mínimo), `ACCESS_PASSWORD_HASH` (`salt:scrypt64hex`). No publicar `.env.local` ni claves. `scripts/setup-access.mjs` genera acceso privado local sin imprimir secretos.

Migraciones SQL versionadas en `db/`, registro y bloqueo transaccional en `schema_migrations`. PostgreSQL portable; `scripts/migrate.mjs` no modifica otros proyectos.

## Arquitectura y límites

Next.js App Router / React / TypeScript, PostgreSQL Neon vía postgres.js. Rutas internas autenticadas; cookie HTTPOnly, SameSite Strict, Secure en producción; comprobación de origen en escrituras y límite persistente de intentos de acceso. Tenant fijo de piloto en servidor, sin selección desde cliente. Actor compartido «operador»: permisos individuales, invitaciones y auditoría nominativa pendientes antes de ampliar usuarios. No es una plataforma multiempresa expuesta.

Entidades: organización, fuente original, variante, ofertas versionadas, compras reales, ventas reales, auditoría y control de intentos. Compras/ventas no se generan desde ofertas y se muestran sin historial hasta una importación autorizada futura. Inventario, reparaciones y POS no implementados ni conectados.

Importación TXT/CSV/XLSX, PDF digital o escaneado y capturas PNG/JPG/WEBP. Arrastrar y soltar, seleccionar archivo o pegar captura con Ctrl+V. Lectura automática en navegador con PDF.js y Tesseract.js; motores e idiomas español/inglés servidos desde el sitio (prebuild/predev), sin servicios OCR de pago. Límites: un archivo de hasta 4 MB, 20 páginas PDF, 100.000 caracteres, 500 productos, 40 columnas XLSX. Muestra progreso y permite cancelar. El texto detectado se puede corregir; cada fila exige revisión antes de publicar. Los PDF protegidos requieren una copia sin contraseña. El original se conserva al preparar correctamente la revisión y se descarga como adjunto. El símbolo $ por sí solo no determina moneda.

Respaldos: ejecutar exportación `pg_dump` en un entorno autorizado y probar restauración en base aislada antes de uso real. No se presume que el historial de Neon sustituye respaldos exportables. Establecer política de retención de fuentes y borradores según límites de almacenamiento antes de operación continua.

La URL de la aplicación incluye `noindex` y robots restrictivo; el acceso real lo controla autenticación. El repositorio público puede ser indexado y clonado.

## Selección y ficha del catálogo

Al pulsar el modelo, un proveedor o una zona no editable de su fila se abre una ficha modal con cotización, condiciones, fuente e historial. El modelo y la oferta elegidos quedan destacados en morado con una marca visible. Se eliminó el panel lateral que quedaba centrado fuera de la vista en catálogos largos. Cerrar, Escape o pulsar fuera de la ficha vuelve al mismo lugar del catálogo. Los controles de recargo mantienen su comportamiento sin abrir la ficha.

## Recargos individuales y masivos

Las casillas marcan ofertas/modelos para recargo masivo y no abren la ficha. El nombre abre el detalle. Seleccionar un modelo marca sus ofertas visibles; se puede marcar cada proveedor individualmente o seleccionar todos los visibles. Las ofertas marcadas fuera de los filtros permanecen incluidas y el contador muestra la selección completa. Aplicar a seleccionados muestra vista previa y actualiza todas las ofertas indicadas en una transacción con auditoría; no hay cambios parciales. Los importes fijos requieren una sola moneda y los porcentajes conservan cada moneda.

El editor se comparte entre tabla y ficha: el precio cambia al escribir y se identifica como vista previa hasta guardar. Enter, Tab/salir del campo o Guardar persisten el cambio. Se muestra Guardando, Guardado o el error con opción de reintentar; se impiden solicitudes duplicadas por Enter/blur. No se copia una cotización con cambios pendientes o inválidos. El predeterminado del modelo respeta recargos individuales; Heredar modelo quita la excepción de la oferta.

## Entrada y fuentes del dashboard

El dashboard abre Catálogo y recargos cuando existen listas publicadas. Muestra el número de ofertas vigentes y operaciones recibidas de la base; cada vista tiene sus filtros. Catálogo habilita año/mes de publicación, marca, modelo, proveedor y moneda; muestra seis gráficos, costos y precios sugeridos con los recargos guardados, tabla de ofertas y CSV con recargo/precio. Cambiar marca reinicia modelo/proveedor y acota sus opciones. Las operaciones reales siguen separadas: si no existen, se explica por qué y se ofrecen acciones para consultar catálogo o registrar la primera operación. No se fabrican compras/ventas desde ofertas.

## Gráficos y documentación gobernada

Dashboard con Apache ECharts6.1 modular, carga diferida y SVG. Barras con ejes/valores, series temporales con leyendas, distribución con total correcto y colores únicos, actividad por oficinas, tablas accesibles, selección Top5/Top8/Todos y descarga SVG. El histórico de un solo mes se muestra como un período disponible, sin inventar una tendencia. Tarjetas de altura adaptable y disposición por columnas evitan grandes espacios vacíos. Tooltips richText evitan interpretar etiquetas como HTML.

Raíz canónica en Notion: Servicio Express — Governed Project, página41a839ef-3602-8175-b471-e7c436ba77b6, bajo04 — Governed Projects & Client Solutions. Mantiene documentos de gobierno/prioridad, estado, riesgos, decisiones/evidencia histórica, arquitectura/contratos, operación y mandato original. El traslado conserva la identidad y los registros previos.
