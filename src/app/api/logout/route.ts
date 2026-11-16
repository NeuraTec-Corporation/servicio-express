import {NextResponse} from 'next/server';
import {sameOrigin} from '@/lib/auth';
export async function POST(request:Request){if(!sameOrigin(request))return new Response(null,{status:403});const r=NextResponse.json({ok:true});r.cookies.delete('se_session');return r}
