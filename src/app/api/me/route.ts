import {currentUser} from '@/lib/auth';
export async function GET(){const user=await currentUser();return Response.json(user?{user}:{error:'Sesión requerida'},{status:user?200:401})}
