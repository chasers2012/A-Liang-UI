'use client';

import { useParams } from 'next/navigation';

import { DataSetForm } from '../../ui/data-set-form';

export default function EditDataSetPage() {
  const params = useParams<{ id: string }>();
  const raw = params.id;
  const id = Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '');

  if (!id) {
    return (
      <div className="p-6 md:p-8">
        <p className="text-sm text-muted-foreground">无效的数据集 id</p>
      </div>
    );
  }

  return <DataSetForm mode="edit" dataSetId={id} />;
}
