'use client';

import type { SetStateAction } from 'react';

import { CronField } from '@/components/cron-field';

export function DataSyncCronField(props: {
  value: string;
  setValue: (v: SetStateAction<string>) => void;
  readOnly: boolean;
  className?: string;
  id?: string;
  ariaLabelledBy?: string;
}) {
  const { value, setValue, readOnly, className, id, ariaLabelledBy } = props;

  return (
    <CronField
      id={id}
      ariaLabelledBy={ariaLabelledBy}
      value={value}
      readOnly={readOnly}
      className={className}
      onValueChange={(next) => setValue(next)}
    />
  );
}
