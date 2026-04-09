import { ApiError, deleteDatasource, testDatasource } from "@/lib/quant-agent-api";
import type { DatasourceDetailState } from "@/models/datasource/detail.atom";
import type { DataSourcePublic } from "@/models/datasource/dto";

type SetDetailState = (
  update: (prev: DatasourceDetailState) => DatasourceDetailState,
) => void;

export type DatasourceDetailRouter = { push: (href: string) => void };

function messageFromUnknown(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function testConnectionErrorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  return messageFromUnknown(e);
}

export async function runDatasourceConnectionTest(
  id: string,
  setState: SetDetailState,
): Promise<void> {
  if (!id) return;
  setState((s) => ({ ...s, busy: true, testHint: null }));
  try {
    const r = await testDatasource(id);
    setState((s) => ({ ...s, testHint: { ok: r.ok, message: r.message } }));
  } catch (e) {
    setState((s) => ({
      ...s,
      testHint: { ok: false, message: testConnectionErrorMessage(e) },
    }));
  } finally {
    setState((s) => ({ ...s, busy: false }));
  }
}

export async function confirmDeleteDatasource(
  ds: DataSourcePublic,
  router: DatasourceDetailRouter,
  setState: SetDetailState,
): Promise<void> {
  setState((s) => ({ ...s, deleting: true }));
  try {
    await deleteDatasource(ds.id);
    setState((s) => ({ ...s, deleteOpen: false }));
    router.push("/data/datasources");
  } catch (e) {
    setState((s) => ({
      ...s,
      error: messageFromUnknown(e),
    }));
  } finally {
    setState((s) => ({ ...s, deleting: false }));
  }
}

