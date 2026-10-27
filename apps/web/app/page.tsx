import { redirect } from 'next/navigation';

/** Root page — skip the landing page, go straight to the dashboard. */
export default function RootPage() {
  redirect('/app');
}
