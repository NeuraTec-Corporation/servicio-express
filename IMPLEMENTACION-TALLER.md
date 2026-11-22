# Taller — implementación y continuidad

Decisiones del titular: 2026-11-21. Fuente: https://app.notion.com/p/41e839ef360281a2addfe13c210c252c

## Alcance implementado

Órdenes vinculadas al POS; técnico/oficina; recepción y diagnóstico; etapas, pausas, estimación, pruebas, entrega/garantía; panel TV con proyección privada y actualización de 30 s. Inventario por lotes con pedido, recepción/factura, reserva por orden, consumo, devolución utilizable, traslado y devolución física a proveedor. Presupuestos versionados con importes y evidencia de aprobación/rechazo; piezas/cantidades reservadas sujetas al presupuesto vigente aprobado. Fotografías/PDF privados, OCR local de orden con texto revisable y campos completados manualmente, historial y tiempos por etapa, reporte imprimible/PDF. Estadísticas de taller en el dashboard y CSV.

Recepciones generan compras vinculadas al registro gerencial. El cobro final solo se consolida con confirmación manual del importe efectivamente cobrado en POS, después de entregar. No se duplica por reintento. Costo de mano de obra desconocido o mezcla de monedas deja el costo total desconocido; no genera utilidad inventada. Una devolución física a proveedor no equivale a reembolso financiero. Registros derivados se corrigen desde la operación, con auditoría; no se editan como entradas manuales.

## Persistencia y publicación

Migraciones aditivas 003 y 004; sesión/origen, transacciones, control de versión, idempotencia por UUID/digest, auditoría y proyección TV por campos permitidos. La conexión se utiliza desde Vercel sin extraer secretos; se habilitó su disponibilidad en preview para verificar el código. Preview y producción comparten la base de laboratorio; las pruebas deben identificar y limpiar únicamente sus registros ficticios mediante borrado individual autenticado. No ejecutar limpieza integral para probar.

Estado al preparar esta revisión: código y 44 pruebas locales aprobados; verificación remota/publicación en curso. No declarar persistencia o publicación completa hasta guardar evidencia real. La carpeta local no es un checkout Git; se comparó con main d4066f79174463f5aa28000a3e3e155fae60ccef y se publicará mediante árbol/commit del conector GitHub, preservando los archivos restantes.

## Límites explícitos

IA de comunicaciones diferida: el propietario aportará curso/código. No activar llamadas, mensajes, nuevas APIs IA o servicios pagos. Autenticación compartida de laboratorio de ocho horas; cuentas/roles individuales siguen diferidos. Técnicos y oficinas se asignan por nombre; no hay administración de identidades ni directorio de personal. La TV sigue requiriendo sesión propia, sin cuenta Google.

Las estimaciones son del técnico; intervalos por etapa excluyen esperas/pausas registradas, no fichaje laboral. El OCR no garantiza campos estructurados ni publica sin revisión. Evidencias hasta 4 MB, 12 por orden y 100 MB en el piloto; revisar capacidad antes de ampliarla. Respaldo/recuperación programados, inventario con mínimos, contabilidad fiscal y conciliación automática de POS permanecen fuera de esta entrega. No se contrataron recursos adicionales ni planes.


## Ampliación de continuidad y cierre de pendientes

Se añade migración 005: controles de reposición/cancelación y almacenamiento temporal de fragmentos cifrados de recuperación. Respaldo portátil y comprobación de restauración aislada; restauración definitiva únicamente sobre negocio vacío, nunca sobre los datos existentes. Copias externas programadas continúan pendientes de definir destino/custodia y verificar costo; no se activó servicio externo. Mínimos/objetivos y corrección/cancelación de pedidos sin recepción incorporados. Rotación de TV y etiquetas accesibles añadidas. Se evita duplicar el pipeline por push/PR; una sola comprobación final para esta ampliación, de acuerdo con el titular.
