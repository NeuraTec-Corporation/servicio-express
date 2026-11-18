import {randomBytes,scryptSync} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
const password=randomBytes(20).toString('base64url');const salt=randomBytes(16).toString('hex');
let content=await readFile('.env.local','utf8').catch(()=> '');
content=content.split(/\r?\n/).filter(l=>!l.startsWith('AUTH_SECRET=')&&!l.startsWith('ACCESS_PASSWORD_HASH=')).join('\n').trim();
await writeFile('.env.local',content+'\nAUTH_SECRET='+randomBytes(48).toString('hex')+'\nACCESS_PASSWORD_HASH='+salt+':'+scryptSync(password,salt,64).toString('hex')+'\n');
await writeFile('ACCESS-PRIVATE.txt','Servicio Express — clave privada de piloto\n'+password+'\nNo compartir ni publicar. Cambiar antes de uso real.\n');
console.log('Acceso generado. Clave guardada en ACCESS-PRIVATE.txt; secretos no impresos.');
