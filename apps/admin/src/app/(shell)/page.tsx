import { redirect } from 'next/navigation';
import { DEFAULT_PATH } from '@/lib/safe-next-path';

export default function Home() {
  redirect(DEFAULT_PATH);
}
