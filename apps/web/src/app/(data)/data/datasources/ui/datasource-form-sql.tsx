"use client";

import type { Dispatch, SetStateAction } from "react";
import { useCallback } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SqlPublic } from "@/lib/quant-agent-api";

import type {
  ColumnMapRow,
  EditorMode,
  FormState,
  SqlDriverForm,
} from "../form-model";
import { emptyColumnMapRows, mergeLoadedSqlColumns } from "../form-model";
import { ColumnMapEditor } from "./column-map-editor";
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

  const updateColumnRow = (
    index: number,
    field: keyof ColumnMapRow,
    value: string | boolean,
  ) => {
    setForm((f) => ({
      ...f,
      column_map_rows: f.column_map_rows.map((row, i) =>
        i === index ? { ...row, [field]: value } : row,
      ),
    }));
  };

  const applyLoadedSqlColumns = useCallback(
    (apiColumns: string[]) => {
      setForm((f) => ({
        ...f,
        column_map_rows: mergeLoadedSqlColumns(apiColumns, f.column_map_rows),
      }));
    },
    [setForm],
  );

  const addColumnRow = () => {
    setForm((f) => ({
      ...f,
      column_map_rows: [
        ...f.column_map_rows,
        { factor: "", column: "", enabled: true },
      ],
    }));
  };

  const removeColumnRow = (index: number) => {
    setForm((f) => {
      const next = f.column_map_rows.filter((_, i) => i !== index);
      return {
        ...f,
        column_map_rows: next.length > 0 ? next : emptyColumnMapRows(),
      };
    });
  };

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
        description="填写要读取的数据表；日期列与资产列在下方「字段映射」中选择。"
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
      </FormSection>

      <FormSection
        title="字段映射（column_map）"
        description="从数据库加载列后，用下拉框选择日期列与资产列，并配置因子字段映射。"
      >
        <ColumnMapEditor
          rows={form.column_map_rows}
          dateColumn={form.date_column}
          assetColumn={form.asset_column}
          onDateColumnChange={(v) => set({ date_column: v })}
          onAssetColumnChange={(v) => set({ asset_column: v })}
          onChangeRow={updateColumnRow}
          onApplyLoadedColumns={applyLoadedSqlColumns}
          onAddRow={addColumnRow}
          onRemoveRow={removeColumnRow}
          inspectContext={{
            datasourceId: editorMode === "edit" ? editingDatasourceId : null,
            db_driver: form.db_driver,
            db_host: form.db_host,
            db_port: form.db_port,
            db_username: form.db_username,
            db_password: form.db_password,
            db_name: form.db_name,
            table: form.table,
          }}
        />
      </FormSection>
    </>
  );
}
