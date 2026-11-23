# Taller rápido y entregas

Recepción: seleccionar marca frecuente (arrastrable para ordenar favoritos en este navegador), modelo dependiente de marca, oficina y técnico. Si falta una opción, buscar/escribir o usar + en el catálogo. Oficinas y técnicos se toman de datos/cuentas existentes; no se inventan tres oficinas si solo hay una o dos.

Ticket del POS o código interno: número impreso del ticket, opcional. No consulta el POS. Nombre del cliente es el nombre de la persona; teléfono es la búsqueda principal. Ambos son privados y nunca se muestran en TV. PIN/clave de desbloqueo del dispositivo se guarda aparte; no aparece en TV, CSV ni en los datos serializados del reporte para el cliente.

Una fila por falla (hasta30). Fotos/ticket opcionales al recibir, con archivo/cámara/arrastre/pegado. La lectura de una foto/PDF es local con revisión: seleccionar las fallas extraídas para cargarlas en la tabla. No se conecta ni lee automáticamente el POS. El original adjunto queda privado después de guardar.

La ficha tiene accesos directos superiores a Recepción, Daños y proceso, Presupuesto y autorización, Fotos y documentos, Historial y tiempos, Cobro registrado. Cada daño V2 tiene diagnóstico/solución/pieza/estado independiente; una falla puede quedar pendiente mientras se diagnostican otras. Se confirma el plan completo antes de pedir o reparar. Fotos de seguridad obligatorias únicamente cuando el técnico lo marca por daño; las fotografías esperada/recibida de una solicitud de mayorista mantienen sus controles de comparación.

Tiempos de30/60/90/120min y1/2días son estimaciones manuales, no promesas calculadas por IA. También puede elegirse fecha/hora. Garantía con0/7/15/30/60/90días y entrada personalizada. Pruebas frecuentes se marcan por botón/checkbox y se confirman explícitamente.

## Dos entregas diferentes

1. Listo para entregar habilita Entregar a recepción: constancia, operador y hora. Sale de las tarjetas activas del taller y de la TV; aparece en la tabla inferior de recepción pendiente de cliente. Compatible con órdenes V1 yV2 sin borrar diagnóstico, piezas, presupuesto ni historia.
2. Recepción usa Entregar al cliente: constancia, operador/hora y satisfacción opcional. Pasa al histórico final, consultable por estado y los filtros de teléfono/nombre/oficina/técnico. No se registra un ingreso automáticamente. Importe/referencia de la entrega son informativos; el cobro efectivo sigue siendo un registro explícito separado.

## Estadísticas, exportación y stock

Actualizar estadísticas recarga desde la base órdenes, piezas, presupuesto y eventos. Muestra cantidad de órdenes y hora, incluso cuando no cambian los valores. No genera movimientos de inventario ni recalcula precios.

Exportar órdenes CSV descarga solo las órdenes seleccionadas por filtros para abrir en Excel. No es un respaldo completo ni modifica datos.

Historial y tiempos usa los eventos guardados al pulsar acciones, no tiempos inventados según marca o repuesto. V2 recorta diagnóstico/reparación/armado/pruebas/limpieza a la jornada configurada (15–20 por defecto) y excluye pausas; secado es calendario. V1 conserva intervalos anteriores sin presentarlos como fichaje. DEMO ejecutado en segundos puede mostrar0min. Los gráficos de piezas agrupan cantidades consumidas por componente para una comparación útil; puede cambiarse a nombre/modelo exacto. No se inflan cifras para variar las barras.

Trasladar a otra oficina registra un movimiento físico ya verificado: descuenta unidades sin reserva del origen y crea un lote en destino conservando costo/condición. No es una venta ni organiza transporte. Confirmar recepción registra cantidad/factura físicamente verificadas y genera stock/compra. Ambos muestran ventanas centradas con campos, límites y confirmación explícita.

Los datos históricos se conservan. La adopción V2 de una orden V1 sigue siendo explícita y sujeta a los controles de piezas/etapa; no se inventa retrospectivamente un diagnóstico por daño. Los enlaces de proveedores continúan temporales hasta recibir los reales. No se integra POS, envían mensajes, contratan servicios ni cambian planes.
