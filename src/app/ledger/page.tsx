import { redirect } from 'next/navigation';

export default function PublicLedgerRedirect() {
  redirect('/app/ledger');
}

