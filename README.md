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

Importación TXT/CSV/XLSX. PDF/fotos se conservan como fuentes y se transcriben en revisión; OCR no implementado para evitar servicios de pago y extracción sin validar. Máximo 5 MB, 500 filas/40 columnas. Unidades grandes y documentos de terceros requieren controles adicionales antes de uso masivo. Fuentes descargadas como adjuntos sin ejecución.

Respaldos: ejecutar exportación `pg_dump` en un entorno autorizado y probar restauración en base aislada antes de uso real. No se presume que el historial de Neon sustituye respaldos exportables. Establecer política de retención de fuentes y borradores según límites de almacenamiento antes de operación continua.

La URL de la aplicación incluye `noindex` y robots restrictivo; el acceso real lo controla autenticación. El repositorio público puede ser indexado y clonado.
