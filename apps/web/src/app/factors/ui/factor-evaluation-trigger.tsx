import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { dataSetAtoms } from '@/models/data-set/panel-detail.atom';
import { listAtoms } from '@/models/evaluation-profile/list-detail.atom';
import { runEvaluationActionAtom } from '@/models/evaluation-run';
import { useAtomValue, useSetAtom } from 'jotai';
import { useMemo, useState } from 'react';

const EMPTY_DATA_SETS: { id: string; name: string }[] = [];
const EMPTY_EVALUATION_PROFILES: { id: string; name: string }[] = [];

export function FactorEvaluationTrigger(props: { factorId: string }) {
  const { factorId } = props;

  const dataSets = useAtomValue(dataSetAtoms.valueAtom) ?? EMPTY_DATA_SETS;
  const evaluationProfiles = useAtomValue(listAtoms.valueAtom) ?? EMPTY_EVALUATION_PROFILES;
  const runEvaluation = useSetAtom(runEvaluationActionAtom);

  const [runProfileId, setRunProfileId] = useState<string>('');
  const [runDataSetId, setRunDataSetId] = useState<string>('');

  const profileSelectItems = useMemo(() => {
    return Object.fromEntries(evaluationProfiles.map((p) => [p.id, p.name]));
  }, [evaluationProfiles]);

  const dataSetSelectItems = useMemo(() => {
    return Object.fromEntries(dataSets.map((d) => [d.id, d.name]));
  }, [dataSets]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <FieldGroup className="flex w-full flex-col gap-3 sm:flex-1 sm:flex-row sm:flex-wrap sm:items-end sm:gap-3">
        <Field className="min-w-0 flex-1 gap-1.5 sm:max-w-xs">
          <FieldLabel
            htmlFor="factor-eval-profile-card"
            className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground"
          >
            评价方案
          </FieldLabel>
          <Select
            modal={false}
            items={profileSelectItems}
            value={runProfileId ?? ''}
            onValueChange={(v) => {
              if (!v) return;
              setRunProfileId(v);
            }}
            disabled={evaluationProfiles.length === 0}
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
        </Field>
        <Field className="min-w-0 flex-1 gap-1.5 sm:max-w-xs">
          <FieldLabel
            htmlFor="factor-eval-dataset-card"
            className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground"
          >
            数据集
          </FieldLabel>
          <Select
            modal={false}
            items={dataSetSelectItems}
            value={runDataSetId ?? ''}
            onValueChange={(v) => {
              if (!v) return;
              setRunDataSetId(v);
            }}
            disabled={dataSets.length === 0}
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
        </Field>
      </FieldGroup>
      <Button
        type="button"
        variant="secondary"
        className="w-full gap-1.5 sm:w-auto"
        disabled={!runProfileId || !runDataSetId}
        onClick={() => {
          void runEvaluation({
            factorId,
            evaluationProfileId: runProfileId,
            dataSetId: runDataSetId,
          });
        }}
      >
        运行评价
      </Button>
    </div>
  );
}
