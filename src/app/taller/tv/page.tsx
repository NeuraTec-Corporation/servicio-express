import {authenticated} from '@/lib/auth';
import {redirect} from 'next/navigation';
import WorkshopBoard from '../../workshop-board';
export const dynamic='force-dynamic';
export default async function WorkshopTV(){
  if(!await authenticated())redirect('/');
  return <WorkshopBoard tv/>;
}
