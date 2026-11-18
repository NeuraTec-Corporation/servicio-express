import {authenticated} from '@/lib/auth';
import Workspace from './workspace';
import Login from './login';
export const dynamic='force-dynamic';
export default async function Page(){return await authenticated()?<Workspace/>:<Login/>}
