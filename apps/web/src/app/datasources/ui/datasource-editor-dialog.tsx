"use client";

import type { Dispatch, FormEvent, SetStateAction } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { DataSourceType, SqlPublic } from "@/lib/quant-agent-api";

import type {
  ColumnMapRow,
  EditorMode,
  FormState,
  SqlDriverForm,
} from "../form-model";
import { emptyColumnMapRows } from "../form-model";
import { ColumnMapEditor } from "./column-map-editor";
import { FieldPair, FormSection } from "./form-section";

/** Base UI Select：提供 items 后触发器上的 SelectValue 显示 label 而非 value */
const DATASOURCE_TYPE_ITEMS: Record<DataSourceType, string> = {
  sql: "SQL 表",
  csv: "CSV 文件",
};

const DB_DRIVER_ITEMS: Record<SqlDriverForm, string> = {
  postgresql: "PostgreSQL",
  mysql: "MySQL / MariaDB",
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editorMode: EditorMode;
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  editingSql: SqlPublic | undefined;
  formError: string | null;
  submitting: boolean;
  onSubmit: (e: FormEvent) => void;
};

export function DatasourceEditorDialog({
  open,
  onOpenChange,
  editorMode,
  form,
  setForm,
  editingSql,
  formError,
  submitting,
  onSubmit,
}: Props) {
  const set = (patch: Partial<FormState>) =>
    setForm((f) => ({ ...f, ...patch }));

  const updateColumnRow = (
    index: number,
    field: keyof ColumnMapRow,
    value: string,
  ) => {
    setForm((f) => ({
      ...f,
      column_map_rows: f.column_map_rows.map((row, i) =>
        i === index ? { ...row, [field]: value } : row,
      ),
    }));
  };

  const addColumnRow = () => {
    setForm((f) => ({
      ...f,
      column_map_rows: [...f.column_map_rows, { factor: "", column: "" }],
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader title={editorMode === "create" ? "新增数据源" : "编辑数据源"}>
          {editorMode === "create"
            ? "连接信息保存在服务端 workspace；接口不会返回密码明文。"
            : "密码留空表示保留原值。填写主机或库名并保存后，将从旧版整段 URL 迁移为分字段。"}
        </DialogHeader>
        <form
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          onSubmit={(e) => void onSubmit(e)}
        >
          <DialogBody variant="inset">
            {editorMode === "create" && (
              <div className="grid gap-2">
                <Label htmlFor="ds-type">类型</Label>
                <Select
                  modal={false}
                  items={DATASOURCE_TYPE_ITEMS}
                  value={form.type}
                  onValueChange={(v) =>
                    set({ type: v as DataSourceType })
                  }
                >
                  <SelectTrigger
                    id="ds-type"
                    className="w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[200]">
                    <SelectItem value="sql">
                      SQL 表
                    </SelectItem>
                    <SelectItem value="csv">
                      CSV 文件
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <FormSection title="基本设置">
              <div className="grid gap-2">
                <Label htmlFor="ds-name">显示名称</Label>
                <Input
                  id="ds-name"
                  required
                  value={form.name}
                  onChange={(e) =>
                    set({ name: e.target.value })
                  }
                />
              </div>
              <div className="flex flex-wrap gap-8 pt-1">
                <Label
                  htmlFor="ds-enabled"
                  className="flex cursor-pointer items-center gap-2 font-normal"
                >
                  <Switch
                    id="ds-enabled"
                    checked={form.enabled}
                    onCheckedChange={(v) =>
                      set({ enabled: v })
                    }
                  />
                  <span className="text-sm font-medium">
                    启用
                  </span>
                </Label>
                <Label
                  htmlFor="ds-default"
                  className="flex cursor-pointer items-center gap-2 font-normal"
                >
                  <Switch
                    id="ds-default"
                    checked={form.is_default}
                    disabled={!form.enabled}
                    onCheckedChange={(v) =>
                      set({ is_default: v })
                    }
                  />
                  <span className="text-sm font-medium">
                    设为默认
                  </span>
                </Label>
              </div>
            </FormSection>

            {form.type === "sql" && (
              <>
                {editorMode === "edit" &&
                  editingSql?.has_legacy_engine_url && (
                    <Alert className="border-amber-500/40 bg-amber-500/5">
                      <AlertTitle className="text-amber-950 dark:text-amber-100">
                        旧版连接串
                      </AlertTitle>
                      <AlertDescription className="text-amber-900/90 dark:text-amber-50/90">
                        填写下方主机、库名等信息并保存后，将改为分字段存储并清除旧
                        URL。
                      </AlertDescription>
                    </Alert>
                  )}

                <FormSection
                  title="数据库连接"
                  description="端口留空时使用默认值：PostgreSQL 5432，MySQL 3306。"
                >
                  <div className="grid gap-2">
                    <Label htmlFor="ds-db-driver">
                      数据库类型
                    </Label>
                    <Select
                      modal={false}
                      items={DB_DRIVER_ITEMS}
                      value={form.db_driver}
                      onValueChange={(v) =>
                        set({
                          db_driver:
                            v as SqlDriverForm,
                        })
                      }
                    >
                      <SelectTrigger
                        id="ds-db-driver"
                        className="w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[200]">
                        <SelectItem value="postgresql">
                          PostgreSQL
                        </SelectItem>
                        <SelectItem value="mysql">
                          MySQL / MariaDB
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <FieldPair>
                    <div className="grid gap-2">
                      <Label htmlFor="ds-host">
                        主机（IP）
                      </Label>
                      <Input
                        id="ds-host"
                        required={
                          editorMode === "create"
                        }
                        placeholder="127.0.0.1"
                        value={form.db_host}
                        onChange={(e) =>
                          set({
                            db_host: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="ds-port">
                        端口
                      </Label>
                      <Input
                        id="ds-port"
                        inputMode="numeric"
                        placeholder={
                          form.db_driver === "mysql"
                            ? "默认 3306"
                            : "默认 5432"
                        }
                        value={form.db_port}
                        onChange={(e) =>
                          set({
                            db_port: e.target.value,
                          })
                        }
                      />
                    </div>
                  </FieldPair>
                  <div className="grid gap-2">
                    <Label htmlFor="ds-dbname">
                      数据库名
                    </Label>
                    <Input
                      id="ds-dbname"
                      required={editorMode === "create"}
                      value={form.db_name}
                      onChange={(e) =>
                        set({ db_name: e.target.value })
                      }
                    />
                  </div>
                  <FieldPair>
                    <div className="grid gap-2">
                      <Label htmlFor="ds-user">
                        用户名
                      </Label>
                      <Input
                        id="ds-user"
                        autoComplete="off"
                        value={form.db_username}
                        onChange={(e) =>
                          set({
                            db_username:
                              e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="ds-pass">
                        密码
                      </Label>
                      <Input
                        id="ds-pass"
                        type="password"
                        autoComplete="new-password"
                        placeholder={
                          editorMode === "edit" &&
                            editingSql?.has_password
                            ? "留空则保留已保存"
                            : "可选"
                        }
                        value={form.db_password}
                        onChange={(e) =>
                          set({
                            db_password:
                              e.target.value,
                          })
                        }
                      />
                    </div>
                  </FieldPair>
                </FormSection>

                <FormSection
                  title="表面板列"
                  description="长表格式：每行一条 (日期, 资产) 观测。"
                >
                  <div className="grid gap-2">
                    <Label htmlFor="ds-table">
                      表名（可含 schema）
                    </Label>
                    <Input
                      id="ds-table"
                      required
                      value={form.table}
                      onChange={(e) =>
                        set({ table: e.target.value })
                      }
                    />
                  </div>
                  <FieldPair>
                    <div className="grid gap-2">
                      <Label htmlFor="ds-dcol">
                        日期列
                      </Label>
                      <Input
                        id="ds-dcol"
                        required
                        value={form.date_column}
                        onChange={(e) =>
                          set({
                            date_column:
                              e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="ds-acol">
                        资产列
                      </Label>
                      <Input
                        id="ds-acol"
                        required
                        value={form.asset_column}
                        onChange={(e) =>
                          set({
                            asset_column:
                              e.target.value,
                          })
                        }
                      />
                    </div>
                  </FieldPair>
                </FormSection>

                <FormSection title="字段映射（column_map）">
                  <ColumnMapEditor
                    rows={form.column_map_rows}
                    onChangeRow={updateColumnRow}
                    onAddRow={addColumnRow}
                    onRemoveRow={removeColumnRow}
                  />
                </FormSection>
              </>
            )}

            {form.type === "csv" && (
              <FormSection
                title="CSV 文件"
                description="路径可为绝对路径，或相对于 workspace 根目录的相对路径。"
              >
                <div className="grid gap-2">
                  <Label htmlFor="ds-csvpath">文件路径</Label>
                  <Input
                    id="ds-csvpath"
                    required
                    value={form.csv_path}
                    onChange={(e) =>
                      set({ csv_path: e.target.value })
                    }
                  />
                </div>
                <FieldPair>
                  <div className="grid gap-2">
                    <Label htmlFor="ds-csv-dcol">
                      日期列
                    </Label>
                    <Input
                      id="ds-csv-dcol"
                      required
                      value={form.csv_date_column}
                      onChange={(e) =>
                        set({
                          csv_date_column:
                            e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="ds-csv-acol">
                      资产列
                    </Label>
                    <Input
                      id="ds-csv-acol"
                      required
                      value={form.csv_asset_column}
                      onChange={(e) =>
                        set({
                          csv_asset_column:
                            e.target.value,
                        })
                      }
                    />
                  </div>
                </FieldPair>
                <div className="grid gap-2">
                  <Label htmlFor="ds-kw">
                    read_csv_kwargs（JSON）
                  </Label>
                  <Textarea
                    id="ds-kw"
                    className="min-h-[88px] font-mono text-xs leading-relaxed"
                    value={form.read_csv_kwargs_json}
                    onChange={(e) =>
                      set({
                        read_csv_kwargs_json:
                          e.target.value,
                      })
                    }
                  />
                </div>
              </FormSection>
            )}

            {formError && (
              <Alert variant="destructive">
                <AlertTitle>校验失败</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
          </DialogBody>

          <DialogFooter variant="plain">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "保存中…" : "保存"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
