'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function NewStrategyRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/strategies/?new=1');
  }, [router]);

  return null;
}
