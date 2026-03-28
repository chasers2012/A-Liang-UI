"use client";

import { useParams } from "next/navigation";

import { TestSetForm } from "../../ui/test-set-form";

export default function EditTestSetPage() {
  const params = useParams<{ id: string }>();
  const raw = params.id;
  const id = Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";

  if (!id) {
    return (
      <div className="p-6 md:p-8">
        <p className="text-sm text-muted-foreground">无效的测试集 id</p>
      </div>
    );
  }

  return <TestSetForm mode="edit" testSetId={id} />;
}
