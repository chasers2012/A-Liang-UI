import { redirect } from 'next/navigation';

export default function NewStrategyPage() {
  redirect('/strategies?new=1');
}
