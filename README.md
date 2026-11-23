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


## Taller, inventario y evidencias

Pestaña Taller con órdenes vinculadas al POS, técnico/oficina, diagnóstico, etapas, pausas, estimación manual, pruebas, entrega y garantía. Panel `/taller/tv` autenticado, actualizado cada 30 segundos, con proyección de campos sin cliente, teléfono, número POS, diagnóstico ni evidencia privada. La sesión actual caduca a las ocho horas.

Inventario por lotes: pedido, recepción con referencia de factura, reservas por orden, consumo, devolución utilizable a stock, traslado de unidades disponibles entre oficinas y devolución a proveedor. Cantidades transaccionales, costo original y auditoría; no convierte ofertas del catálogo en compras. Los presupuestos preservan versiones, conceptos, costos/base, recargos por unidad, total anterior aprobado, diferencia y respuesta explícita del cliente. Solo la última versión pendiente admite respuesta; reservar piezas con presupuesto exige el lote/cantidad aprobados. El rechazo o falta de respuesta bloquea la ejecución adicional.

Fotografías/PDF privados de orden, diagnóstico, pieza y factura en PostgreSQL existente. Imágenes comprimidas en el navegador; archivos hasta 4 MB, 12 evidencias por orden y tope de 100 MB de evidencias del piloto para frenar crecimiento antes de evaluar capacidad/costo. Lectura de orden por foto/PDF con PDF.js/Tesseract existentes, drag-and-drop, texto revisable y traslado manual de campos; no se inventa extracción estructurada. Historial y tiempos por etapa excluyen pausas/esperas registradas y no equivalen a fichaje laboral.

Dashboard → Taller y reparaciones: filtros por fecha de recepción, marca/modelo, técnico, oficina, pieza, proveedor y moneda; modelos, etapas, piezas usadas, tiempos y CSV. Presupuestos aprobados son importes acordados, no ingresos cobrados. Costos de piezas consumidas no incluyen mano de obra/gastos ni representan utilidad. La recepción confirmada genera una compra real vinculada en el registro gerencial. Al entregar se puede consolidar el cobro efectivamente confirmado en POS, una sola vez por orden: piezas consumidas más mano de obra conocida determinan el costo; si falta mano de obra o hay monedas distintas, el costo total queda desconocido y no se inventa utilidad. Estos registros derivados no se editan sueltos desde el dashboard. Corregir una consolidación exige clave y conserva auditoría; no realiza un reembolso en POS. Devolver físicamente una pieza al proveedor no registra automáticamente una nota de crédito ni devolución de dinero. No hay sincronización automática con POS. Reporte técnico imprimible/PDF con diagnóstico, pruebas, garantía, presupuesto y fotografías privadas.

Migraciones aditivas `003_workshop.sql` y `004_workshop_operations.sql`, aplicadas bajo bloqueo al primer acceso de taller o mediante `npm run db:migrate` con conexión privada configurada. No imprimir ni publicar secretos. Operaciones idempotentes por UUID/digest, bloqueo de escritura, control de versión, auditoría, sesión y origen. Limpieza integral incluye taller/inventario/evidencias; solo catálogo los conserva. Borrado individual exige clave y BORRAR y conserva auditoría.

IA de comunicaciones diferida expresamente: el propietario aportará curso/código. No hay llamadas, mensajes automáticos, nuevas APIs de IA ni servicios pagos activados por esta entrega. Guía de continuidad y estado de publicación en `IMPLEMENTACION-TALLER.md`.


## Respaldo, recuperación y reposición

El botón Respaldo descarga un archivo `.sebackup` completo del negocio, originales, evidencias e historial. AES-256-GCM, clave derivada con scrypt y sal/nonce aleatorios. La clave de respaldo es elegida por el titular, de al menos 12 caracteres, y no se guarda; las credenciales de infraestructura y sesiones no se exportan. Conservar archivo y clave separados, fuera de la aplicación.

La comprobación de recuperación reconstruye registros en tablas temporales con las restricciones del esquema y verifica sus referencias, sin modificar las tablas de negocio. Recuperar definitivamente requiere RESTAURAR, clave de acceso, clave de respaldo y una instancia sin datos de negocio. No borra ni sobrescribe la base existente. Identificadores de eventos de auditoría/cronología pueden reasignarse; se conserva la referencia original de auditoría en el detalle restaurado. Archivos de hasta 128 MB cifrados, carga en fragmentos de 2 MB, JSON descomprimido acotado a 256 MB y hasta 100.000 registros. Requiere la misma versión de migraciones; volúmenes superiores o cambios de versión necesitan procedimiento de base de datos. Fragmentos cifrados son temporales y se retiran tras comprobar/recuperar; cargas abandonadas caducan y se limpian al siguiente uso.

El destino externo aprobado es Google Drive corporativo. Agente Windows y tarea preparados; activación pendiente del instalador por restricciones del host. Copia local y confirmación remota de IT son estados distintos. El borrado requiere comprobante externo vigente para la revisión actual. No hay retención destructiva automática. Véase ACCESO-Y-RESPALDOS.md.

Inventario incorpora mínimos/objetivo por referencia exacta y oficina; sugiere cantidad considerando disponibles y pedidos por llegar. No envía compras. Pedidos sin recepción pueden corregirse o cancelarse con auditoría y versión; lo recibido conserva costo e historial. TV rota páginas de ocho equipos cada 20 segundos, sin consultas adicionales por rotación. Filtros del taller tienen etiquetas accesibles explícitas.

Se retiraron las CLI de Vercel/Neon de las dependencias de desarrollo de la aplicación: despliegue y administración usan los conectores, sin incluir herramientas operativas innecesarias. Verify se ejecuta una vez por PR, sin duplicar por push de rama/main. La entrega utiliza una sola comprobación final enfocada en la nueva recuperación, sin repetir los 22 recorridos de taller ya verificados.


## Cuentas y búsqueda por teléfono

Migración 006: cuentas nominativas IT/dueños/manager/técnicos/staff, permisos de servidor, asignación por oficina, cliente por teléfono y borrado condicionado a copia externa. Sin integración POS. La referencia externa es opcional. Las claves iniciales son privadas; no se publica ninguna en el repositorio. Guía operativa: [ACCESO-Y-RESPALDOS.md](ACCESO-Y-RESPALDOS.md).


## V2 — daños, stock y acciones rápidas

La auditoría está en [AUDITORIA-V2.md](AUDITORIA-V2.md). Migración 007 aditiva: catálogos bilingües, cinco mayoristas, condición/SKU/compatibilidad por lote, referencias de evidencias y versión del plan en presupuestos. Los daños y solicitudes tipados viven en el agregado JSON de cada orden. Las siete órdenes DEMO V1 mantienen datos e historial; las nuevas utilizan V2. Adopción explícita de V1 solo en recibido/diagnóstico sin piezas activas.

V2 exige diagnóstico y solución confirmados, presupuesto vigente del plan aprobado con canal/respondente/evidencia, piezas compatibles y verificadas, reserva y recepción conforme antes de iniciar reparación. Registrar recepción no inicia trabajo. Pruebas, cierre técnico, curado aplicable, limpieza y entrega usan botones y validaciones de servidor. Fotos de pieza dañada/pedida/recibida se vinculan con su daño/solicitud. Pegar/arrastrar imágenes y cámara del dispositivo; no hay captura remota de pantallas ajenas.

La captura es manual y duplicada respecto al POS por mandato. No existe conector ni envío de compras/comunicaciones. Los enlaces temporales solo admiten registros de pedido explícitamente DEMO; manager/IT/dueños reemplazan hasta cinco enlaces desde Inventario. Los lotes antiguos quedan físicamente contabilizados pero sin condición verificada: comprobarlos antes de usarlos en V2. No se infiere que sean nuevos o aptos.

Selector ES/EN persistente en interfaz, TV y reporte. Los datos libres de cliente/técnico no se reescriben ni se traducen mediante IA. Jornada por orden configurable (inicial 15:00–20:00, America/New_York); los eventos guardan su horario para no recalcular el pasado con ajustes posteriores. El tiempo activo V2 excluye mañanas/noches fuera de jornada y pausas; curado mantiene duración de calendario. V1 conserva su semántica histórica, sin presentarla como fichaje.

Los respaldos nuevos incluyen configuración V2 y validan referencias de daños/piezas/evidencias. Se exige coincidencia de migraciones para recuperar: los archivos anteriores a 007 necesitan un procedimiento de migración y no se aplican sobre este esquema automáticamente. No se realizó limpieza general ni recuperación destructiva.

## Taller rápido y entrega a recepción

La ficha permite fallas múltiples desde recepción, accesos rápidos arrastrables, PIN privado, evidencias iniciales y navegación directa a presupuesto/fotos/tiempos. Entrega de taller a recepción y de recepción al cliente se registran separadas; las tarjetas/TV solo muestran equipos que siguen en taller. Filtros analíticos sin solapamientos y actualización con confirmación visible. [Guía funcional y explicación de controles](GUIA-TALLER-RAPIDO.md).

## Operación y conteo

Avisos operativos, autorización por reparación, recepción parcial, favoritos por cuenta y toma de inventario con lector/teclado. El saldo inicial no genera compras; costo desconocido permanece pendiente. [Guía de operación y toma de inventario](OPERACION-Y-CONTEO.md). Sin cambios de plan ni integración POS; IA pendiente del repositorio del titular.
