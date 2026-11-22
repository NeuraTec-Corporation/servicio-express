# Servicio Express — acceso, custodia y borrado

Decisión aprobada 22/11/2026. El POS no se integra en esta etapa. Teléfono normalizado (7–15 dígitos, sin inferir país) identifica al cliente; admite múltiples equipos y órdenes. Nombre y teléfono son privados y no salen en TV. La referencia externa es opcional.

## Cuentas

| Perfil | Primera cuenta | Alcance |
|---|---|---|
| IT NeuraTec | SEIT001 | Cuentas, custodia, recuperación y administración |
| Dueños | SEDUE001 | Administración comercial y taller; borrado protegido |
| Manager | SEMGR001 | Administración comercial y taller; borrado protegido |
| Técnico | SETEC001 | Órdenes asignadas a su código/nombre y oficina, diagnóstico, piezas y presupuestos |
| Staff | SESTF001 | Recepción y datos del cliente de su oficina; entrada y recepción de piezas |

Claves individuales aleatorias entregadas en archivo privado, nunca en GitHub ni Notion. Los perfiles operativos cambian su clave al primer ingreso. IT recibe una clave aleatoria privada y puede cambiarla mediante su perfil. Las sesiones incluyen identificador individual, caducan en ocho horas y comprueban estado/versión de cuenta en la base. Desactivar, cambiar oficina o restablecer clave revoca sesiones. No hay acceso con la antigua clave compartida. Solo IT crea, edita o restablece cuentas. Código/cargo permanentes; nuevas cuentas incrementan 002, 003, etc.

No se contrató autenticación externa. Los permisos se validan en servidor, incluyendo evidencias, reportes, inventario y órdenes. La TV conserva su lista explícita de campos públicos; requiere sesión.

## Destino y copia

Se reutiliza Google Drive Desktop del equipo corporativo, con una carpeta propia de Servicio Express. La carpeta y ruta son configuración de servidor fija. Solo IT recibe su ruta, identificadores y enlaces en la API. Dueños/manager ven únicamente estado de copia y disponibilidad de borrado. No existe editor de ruta en ningún perfil.

Los scripts `scripts/install-backup-agent.ps1` y `scripts/backup-agent.ps1` usan un token independiente, emitido por IT, y una clave AES independiente de Landscape. No reutilizan claves/tokens de otros proyectos. Configuración protegida con DPAPI CurrentUser; guardar la clave de recuperación fuera de Drive y del equipo, bajo custodia IT. El agente usa cuenta de Windows sin elevar privilegios, permanece activo al iniciar sesión, atiende solicitudes cada minuto y genera una copia diaria cuando no hay una de las últimas 23 horas. Requiere equipo encendido, sesión de Windows y Drive conectado. El token se puede revocar desde IT. No lee ni modifica datos comerciales por otros endpoints.

El instalador está preparado; desde el entorno de Codex Windows denegó acceso a G: y al programador de tareas incluso con permiso adicional. **No se declara instalada ni activa la nueva tarea hasta ejecutarlo con el usuario de Windows que tiene Drive.** No se cambia la tarea existente de Landscape. No se realizan borrados ni retención automática de archivos.

El archivo cifrado contiene tablas comerciales, clientes, originales, evidencias, auditoría y cuentas con hashes; excluye sesiones, tokens de agentes, secretos de infraestructura y configuración de destino. La recuperación conserva cuentas ya existentes con el mismo código; no reinstala contraseñas sobre cuentas activas. Las migraciones deben coincidir. La restauración comercial solo admite una base vacía; no sobrescribe datos.

**Copiado local no equivale a sincronización remota.** El agente verifica SHA-256 después de escribir en Drive Desktop, y marca `copied`. IT abre Drive, comprueba carpeta/tamaño, descarga el archivo y compara SHA-256. Solo entonces confirma su ID remoto con su propia clave. Queda auditoría de la atestación del custodio. No hay OAuth de aplicación ni verificación remota automática instalada: la conexión de Drive del chat no transfiere credenciales al servidor ni al agente. Este paso manual es explícito y no se sustituye por una casilla de otro perfil.

Google Drive ya contiene copias anteriores de Landscape y se creó la carpeta propia sin contratar planes. No se comprobó la cuota disponible de la cuenta: el espacio se comparte con Gmail/Fotos. No se garantiza almacenamiento ilimitado ni ausencia de costos futuros. Antes de ampliar cuota, cambiar plan o activar un proveedor de pago se consulta al usuario.

## Borrado protegido

IT, dueños y manager son los únicos perfiles autorizados. Antes de cualquier limpieza de catálogo o total se requiere copia externa confirmada de la **misma revisión** de datos, confirmada hace menos de 15 minutos y no utilizada. Cualquier cambio comercial o de cuentas invalida la habilitación. La ventana ofrece crear/consultar el respaldo y mantiene bloqueado el botón hasta cumplirlo. El servidor vuelve a verificar con bloqueos transaccionales antes de eliminar; no acepta `backupDone=true`. Exige BORRAR y clave propia. El comprobante se consume en la misma transacción. Conserva cuentas, auditoría y configuración de custodia.

La primera activación no realiza ninguna limpieza. Las comprobaciones básicas no deben borrar información real ni simular recibos de respaldo.
