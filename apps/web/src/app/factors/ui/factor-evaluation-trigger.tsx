import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { dataSetsItemsAtom } from '@/models/data-set/panel-detail.atom';
import { evaluationProfilesListItemsAtom } from '@/models/evaluation-profile/list-detail.atom';
import { evaluationRunRunningAtom, runEvaluationActionAtom } from '@/models/evaluation-run';
import { factorDetailStateAtomFamily } from '@/models/factor';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { Loader2 } from 'lucide-react';
import { useMemo } from 'react';

const EMPTY_DATA_SETS: { id: string; name: string }[] = [];

export function FactorEvaluationTrigger(props: { factorId: string }) {
  const { factorId } = props;
  const [state, setState] = useAtom(factorDetailStateAtomFamily(factorId));
  const dataSets = useAtomValue(dataSetsItemsAtom) ?? EMPTY_DATA_SETS;
  const evaluationProfiles = useAtomValue(evaluationProfilesListItemsAtom);
  const evaluationRunning = useAtomValue(evaluationRunRunningAtom);
  const runEvaluation = useSetAtom(runEvaluationActionAtom);
  const { detail, runProfileId, runDataSetId } = state;
  const evaluatingThis = evaluationRunning != null && evaluationRunning.factorId === factorId;
  const evaluatingOther = evaluationRunning != null && evaluationRunning.factorId !== factorId;
  const otherEvaluatingFactorName = evaluatingOther ? evaluationRunning?.factorName : undefined;
  const profileSelectItems = useMemo(() => {
    const o: Record<string, string> = {};
    for (const p of evaluationProfiles) o[p.id] = p.name;
    return o;
  }, [evaluationProfiles]);
  const dataSetSelectItems = useMemo(() => {
    const o: Record<string, string> = {};
    for (const ds of dataSets) o[ds.id] = ds.name;
    return o;
  }, [dataSets]);

  const selectDisabled = evaluatingThis || evaluatingOther;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-xs">
        <Label
          htmlFor="factor-eval-profile-card"
          className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground"
        >
          评价方案
        </Label>
        <Select
          modal={false}
          items={profileSelectItems}
          value={runProfileId ?? ''}
          onValueChange={(v) => {
            if (!v) return;
            setState((prev) => ({ ...prev, runProfileId: v }));
          }}
          disabled={selectDisabled || evaluationProfiles.length === 0}
        >
          <SelectTrigger id="factor-eval-profile-card" size="sm" className="w-full min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {evaluationProfiles.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-xs">
        <Label
          htmlFor="factor-eval-dataset-card"
          className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground"
        >
          数据集
        </Label>
        <Select
          modal={false}
          items={dataSetSelectItems}
          value={runDataSetId ?? ''}
          onValueChange={(v) => {
            if (!v) return;
            setState((prev) => ({ ...prev, runDataSetId: v }));
          }}
          disabled={selectDisabled || dataSets.length === 0}
        >
          <SelectTrigger id="factor-eval-dataset-card" size="sm" className="w-full min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {dataSets.map((ds) => (
              <SelectItem key={ds.id} value={ds.id}>
                {ds.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        type="button"
        variant="secondary"
        className="w-full gap-1.5 sm:w-auto"
        disabled={selectDisabled}
        title={evaluatingOther ? `「${otherEvaluatingFactorName ?? ''}」正在评价中` : undefined}
        onClick={() => {
          void runEvaluation({
            factorId,
            factorName: detail?.name ?? '当前因子',
            evaluationProfileId: runProfileId,
            dataSetId: runDataSetId,
            setLoadError: (message) => {
              setState((prev) => ({ ...prev, loadError: message }));
            },
            onSucceeded: (row) => {
              setState((prev) => ({ ...prev, evalRow: row }));
            },
          });
        }}
      >
        {evaluatingThis ? <Loader2 className="size-4 animate-spin" /> : null}
        {evaluatingThis ? '评价中…' : '运行评价'}
      </Button>
    </div>
  );
}
