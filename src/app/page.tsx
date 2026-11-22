import {currentUser} from '@/lib/auth';
import Workspace from './workspace';
import Login from './login';
import PasswordChange from './password-change';
export const dynamic='force-dynamic';
export default async function Page(){const user=await currentUser();return user?(user.must_change?<PasswordChange code={user.code}/>:<Workspace user={user}/>):<Login/>}
