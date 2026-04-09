"use client";

import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { SqlPublic } from "@/lib/quant-agent-api";
import { fetchSqlTableColumns } from "@/lib/quant-agent-api";

import type {
  EditorMode,
  FormState,
  SqlDriverForm,
} from "../form-model";
import { parseOptionalPort } from "../form-model";
import { FieldPair, FormSection } from "./form-section";

const DB_DRIVER_ITEMS: Record<SqlDriverForm, string> = {
  postgresql: "PostgreSQL",
  mysql: "MySQL / MariaDB",
};

type Props = {
  editorMode: EditorMode;
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  editingSql: SqlPublic | undefined;
  editingDatasourceId: string | null;
};

export function DatasourceFormSql({
  editorMode,
  form,
  setForm,
  editingSql,
  editingDatasourceId,
}: Props) {
  const set = (patch: Partial<FormState>) =>
    setForm((f) => ({ ...f, ...patch }));

  const [loadingCols, setLoadingCols] = useState(false);
  const [loadColsError, setLoadColsError] = useState<string | null>(null);
  const [apiColumns, setApiColumns] = useState<string[]>([]);
  const loadGenerationRef = useRef(0);

  const loadColumns = useCallback(async () => {
    const t = form.table.trim();
    if (!t) {
      setLoadColsError("请先填写表名");
      return;
    }
    const host = form.db_host.trim();
    const dbName = form.db_name.trim();
    if (editorMode === "create" && (!host || !dbName)) {
      setLoadColsError("请先填写主机与数据库名");
      return;
    }
    const generation = ++loadGenerationRef.current;
    setLoadColsError(null);
    setLoadingCols(true);
    try {
      const dbPort = parseOptionalPort(form.db_port) ?? null;
      const { columns } = await fetchSqlTableColumns({
        datasource_id: editorMode === "edit" ? editingDatasourceId : null,
        db_driver: form.db_driver,
        db_host: host,
        db_port: dbPort,
        db_username: form.db_username.trim(),
        db_password: form.db_password,
        db_name: dbName,
        table: t,
      });
      if (generation !== loadGenerationRef.current) return;
      setApiColumns(columns);
      if (columns.length === 0) {
        setLoadColsError("未返回任何列（请确认表名与权限）");
      }
    } catch (e) {
      if (generation === loadGenerationRef.current) {
        setLoadColsError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      if (generation === loadGenerationRef.current) {
        setLoadingCols(false);
      }
    }
  }, [
    editorMode,
    editingDatasourceId,
    form.db_driver,
    form.db_host,
    form.db_port,
    form.db_username,
    form.db_password,
    form.db_name,
    form.table,
  ]);

  const loadColumnsRef = useRef(loadColumns);
  loadColumnsRef.current = loadColumns;

  useEffect(() => {
    const t = form.table.trim();
    if (!t) return;
    const host = form.db_host.trim();
    const dbName = form.db_name.trim();
    if (editorMode === "create" && (!host || !dbName)) return;
    const timer = window.setTimeout(() => {
      void loadColumnsRef.current();
    }, 480);
    return () => clearTimeout(timer);
  }, [
    editorMode,
    form.table,
    form.db_host,
    form.db_name,
    form.db_driver,
    form.db_port,
    form.db_username,
    form.db_password,
  ]);

  return (
    <>
      <FormSection
        title="数据库连接"
        description="端口留空时使用默认值：PostgreSQL 5432，MySQL 3306。"
      >
        <div className="grid gap-2">
          <Label htmlFor="ds-db-driver">数据库类型</Label>
          <Select
            modal={false}
            items={DB_DRIVER_ITEMS}
            value={form.db_driver}
            onValueChange={(v) => set({ db_driver: v as SqlDriverForm })}
          >
            <SelectTrigger id="ds-db-driver" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="postgresql">PostgreSQL</SelectItem>
              <SelectItem value="mysql">MySQL / MariaDB</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <FieldPair>
          <div className="grid gap-2">
            <Label htmlFor="ds-host">主机（IP）</Label>
            <Input
              id="ds-host"
              required={editorMode === "create"}
              placeholder="127.0.0.1"
              value={form.db_host}
              onChange={(e) => set({ db_host: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ds-port">端口</Label>
            <Input
              id="ds-port"
              inputMode="numeric"
              placeholder={
                form.db_driver === "mysql" ? "默认 3306" : "默认 5432"
              }
              value={form.db_port}
              onChange={(e) => set({ db_port: e.target.value })}
            />
          </div>
        </FieldPair>
        <div className="grid gap-2">
          <Label htmlFor="ds-dbname">数据库名</Label>
          <Input
            id="ds-dbname"
            required={editorMode === "create"}
            value={form.db_name}
            onChange={(e) => set({ db_name: e.target.value })}
          />
        </div>
        <FieldPair>
          <div className="grid gap-2">
            <Label htmlFor="ds-user">用户名</Label>
            <Input
              id="ds-user"
              autoComplete="off"
              value={form.db_username}
              onChange={(e) => set({ db_username: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ds-pass">密码</Label>
            <Input
              id="ds-pass"
              type="password"
              autoComplete="new-password"
              placeholder={
                editorMode === "edit" && editingSql?.has_password
                  ? "留空则保留已保存"
                  : "可选"
              }
              value={form.db_password}
              onChange={(e) => set({ db_password: e.target.value })}
            />
          </div>
        </FieldPair>
      </FormSection>

      <FormSection
        title="表面板列"
        description="填写要读取的数据表；字段映射与 date/asset 列请在「数据集」页面配置。"
      >
        <div className="grid gap-2">
          <Label htmlFor="ds-table">表名（可含 schema）</Label>
          <Input
            id="ds-table"
            required
            value={form.table}
            onChange={(e) => set({ table: e.target.value })}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            列名就绪后会自动刷新；也可手动点击刷新。
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={loadingCols}
            onClick={() => void loadColumns()}
          >
            {loadingCols ? "刷新中…" : "刷新列名"}
          </Button>
        </div>
        {loadColsError ? (
          <p className="text-xs text-destructive">{loadColsError}</p>
        ) : null}
        {apiColumns.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            已读取列名：<span className="font-mono">{apiColumns.join(", ")}</span>
          </p>
        ) : null}
      </FormSection>
    </>
  );
}
