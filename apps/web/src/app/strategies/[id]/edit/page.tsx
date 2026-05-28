import { EditStrategyRedirect } from './redirect-client';

export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function EditStrategyRedirectPage() {
  return <EditStrategyRedirect />;
}
