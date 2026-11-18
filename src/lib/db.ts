import postgres from 'postgres';
export const TENANT='00000000-0000-4000-8000-000000000001';
const globalDb=globalThis as unknown as {seSql?:ReturnType<typeof postgres>};
export function db(){if(!process.env.DATABASE_URL)throw new Error('Base de datos pendiente de configuración');return globalDb.seSql??=postgres(process.env.DATABASE_URL,{ssl:'require',max:3,prepare:false,idle_timeout:20,connect_timeout:15})}
