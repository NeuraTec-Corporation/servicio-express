import {currentUser} from '@/lib/auth';
import {canManage} from '@/lib/access';
import {db,TENANT} from '@/lib/db';
export async function GET(){const u=await currentUser();if(!u||u.must_change)return new Response(null,{status:401});const users=await db()`SELECT code,display_name,office FROM app_users WHERE tenant_id=${TENANT} AND active=true AND role='technician'`;return Response.json({users:canManage(u.role)?users:users.filter(v=>v.office===u.office)})}
