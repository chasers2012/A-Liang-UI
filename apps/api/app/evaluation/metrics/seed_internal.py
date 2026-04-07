import os

from evaluate import EvaluationMetric

from app.common.datetime_utils import utc_now_iso
from app.common.packages import find_subclass_files
from app.evaluation.metrics.constants import INTERNAL_EVALUATION_METRIC_PACKAGES
from app.evaluation.metrics.controller import (
    create_evaluation_metric,
    get_metric_record,
    update_metric_record,
    write_metric_source,
)
from app.evaluation.metrics.redistry import EvaluationMetricsRegistry
from app.evaluation.metrics.schemas import EvaluationMetricCreate


def _is_truthy(value: str | None) -> bool:
    if value is None:
        return False
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def seed_internal_evaluation_metric_package() -> None:
    print("seeding internal evaluation metric package")
    origins = []
    overwrite = _is_truthy(os.getenv("EVALUATION_METRIC_SEED_OVERWRITE", "false"))

    try:
        for package_name in INTERNAL_EVALUATION_METRIC_PACKAGES:
            files = find_subclass_files(package_name, EvaluationMetric)

            origins.extend(files)
    except Exception as e:
        print(f"finding internal evaluation metric packages failed: {e}")
    print(f"found {len(origins)} internal evaluation metric packages")

    for source_path in origins:
        try:
            with open(source_path, encoding="utf-8") as f:
                source = f.read()
                if overwrite:
                    metric_id = EvaluationMetricsRegistry.generate_id(source_path)
                    existing = get_metric_record(metric_id)
                    if existing is not None:
                        write_metric_source(existing, source)

                        def _touch(rec):
                            rec.updated_at = utc_now_iso()

                        update_metric_record(metric_id, _touch)
                        continue
                create_evaluation_metric(EvaluationMetricCreate(source=source), source_path)
        except Exception as e:
            print(f"seeding internal evaluation metric package failed: {e}")
    print("seeding internal evaluation metric package done")
