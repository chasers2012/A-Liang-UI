import { redirect } from 'next/navigation';

type Props = { params: Promise<{ id: string }> };

export default async function EditStrategyPage(props: Props) {
  const { id } = await props.params;
  redirect(`/strategies?strategyId=${encodeURIComponent(id)}&edit=1`);
}
