import { redirect } from 'next/navigation';

export default function LeaguesIndexRedirect() {
  redirect('/competitions');
}
