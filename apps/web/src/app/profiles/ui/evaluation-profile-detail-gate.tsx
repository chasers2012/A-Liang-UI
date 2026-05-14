import { Alert, AlertDescription } from '@/components/ui/alert';
import type { EvaluationProfilePublic } from '@/models/evaluation-profile/dto';

export function evaluationProfileDetailGate(
  selectedId: string | null,
  error: string | null,
  row: EvaluationProfilePublic | null,
) {
  if (!selectedId) {
    return (
      <Alert>
        <AlertDescription>请选择左侧评价方案。</AlertDescription>
      </Alert>
    );
  }
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  if (!row) {
    return <p className="p-6 text-sm text-muted-foreground">加载中…</p>;
  }
  return null;
}
