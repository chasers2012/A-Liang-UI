"use client";

import { useLayoutEffect } from "react";
import { useParams, useRouter } from "next/navigation";

import {
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** 编辑入口已并入列表 + 预览/源码；旧链接重定向到对应节点页。 */
export default function NodeEditRedirectPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const raw = params.id;
  const id = Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";

  useLayoutEffect(() => {
    if (id) {
      router.replace(`/nodes/${encodeURIComponent(id)}`);
    } else {
      router.replace("/nodes");
    }
  }, [id, router]);

  return (
    <>
      <CardHeader className="shrink-0">
        <CardTitle>节点</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">正在跳转…</p>
      </CardContent>
    </>
  );
}
