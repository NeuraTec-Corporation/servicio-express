# Auditoría e implementación V2

Alcance autorizado: ingreso manual duplicado, sin integración POS. Máximo cinco mayoristas temporales. Conservar los siete casos DEMO y todas las operaciones existentes. Sin contratación ni APIs pagadas.

| Hallazgo | Evidencia | Ajuste |
|---|---|---|
| Una falla/diagnóstico por orden | `orderFields`, ficha y reporte | Daños estructurados con diagnóstico/solución y solicitudes por daño |
| Autorización inicial puede avanzar sin presupuesto | `validateOrder` acepta `pos`; reservas sin última cotización admitidas | V2 exige versión aprobada y vinculada a revisión del plan antes de pedido, reserva e inicio |
| Cambiar diagnóstico no invalida aprobación | Presupuesto compara únicamente estado/evidencia | Revisión del plan; cualquier cambio material exige nueva versión/aprobación |
| Inventario no registra condición/SKU/compatibilidad | `stock_batches` contiene nombres libres | Datos verificables por lote; lo histórico queda pendiente de verificación, sin inventar condición |
| Pedido no está ligado a daño/orden | Alta de lote general | Solicitudes vinculadas con referencia, fotos y comparación de recepción |
| Etapa/estado de piezas editables manualmente | Formulario de orden | Acciones de servidor controladas para V2, sin aceptar cambios protegidos por el endpoint antiguo |
| Tiempos son intervalos de calendario | `stageDurations` | Recortar ejecución activa al horario registrado y separar esperas; no reinterpretar históricos como fichaje |
| Alta exige técnico ya asignado | Esquema y alcance técnico | Cola de oficina y toma de orden atómica |
| Proveedor y catálogos libres, sin configuración | Inventario y ficha | Catálogos ampliables; cinco enlaces temporales marcados, sin pedidos externos automáticos |
| Interfaz solo español | Etiquetas y reportes literales | Preferencia ES/EN, traducción de interfaz y formatos; datos libres conservan idioma original |
| Restauración/limpieza dependen de esquema | Listado explícito de tablas y referencias | Incluir configuración V2 y validar referencias embebidas; conservar permisos de IT y respaldo previo |
| Historial de catálogo aceptaba cualquier UUID de entidad | `/api/history?variant=` podía alcanzar auditoría de una orden si se conocía su ID | Exigir variante real del tenant antes de consultar auditoría; finanzas y recuperación también validan rol dentro de su ruta |
| UI ofrece acciones no permitidas al perfil | Operaciones muestra controles generales | Controles según rol y validación obligatoria en servidor |

Diseño: migración aditiva; los daños y solicitudes forman parte del agregado JSON de cada orden, con validación tipada, revisión optimista, operaciones idempotentes y auditoría. Los lotes, cotizaciones, evidencias y libro financiero conservan sus tablas y relaciones. Las referencias embebidas se comprueban al operar y recuperar. No borrar ni convertir silenciosamente órdenes V1.

La recepción física del ticket y el momento de incorporación al sistema se registran por separado. La autorización puede provenir del POS, presencial, teléfono, SMS o WhatsApp; registrar evidencia no envía comunicaciones ni implica integración. Confirmar recepción habilita el inicio, pero el cronómetro comienza al pulsar Iniciar reparación.

Secado de tratamiento y curado de preentrega son pasos opcionales diferentes. Las pruebas fallidas vuelven a reparación sin borrar historial. Entrega y satisfacción son confirmaciones separadas. Listo exige daños aceptados resueltos, piezas consumidas y pruebas aprobadas.

Verificación: comprobaciones enfocadas en autorización, compatibilidad, stock concurrente, recepción no conforme, varios daños, permisos, jornada y traducción. Una ejecución CI y un recorrido final por el nuevo flujo; no repetir los recorridos completos de V1 ni usar borrado general como prueba.
