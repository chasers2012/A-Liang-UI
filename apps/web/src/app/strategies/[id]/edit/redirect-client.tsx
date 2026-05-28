'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function EditStrategyRedirect() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    const id = params.id;
    if (!id || id === '_') return;
    router.replace(`/strategies/?strategyId=${encodeURIComponent(id)}&edit=1`);
  }, [params.id, router]);

  return null;
}
