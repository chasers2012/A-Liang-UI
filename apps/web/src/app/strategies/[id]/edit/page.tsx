'use client';

import { useParams } from 'next/navigation';
import { StrategyFormPage } from '../../ui/strategy-form-page';

export default function EditStrategyPage() {
  const params = useParams<{ id?: string | string[] }>();
  const rawId = params?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  return <StrategyFormPage id={id} />;
}
