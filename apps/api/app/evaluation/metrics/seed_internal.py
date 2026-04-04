from evaluate import EvaluationMetric

from app.common.packages import find_subclass_files
from app.evaluation.metrics.constants import INTERNAL_EVALUATION_METRIC_PACKAGES
from app.evaluation.metrics.metric_schemas import EvaluationMetricCreate
from app.evaluation.metrics.metrics_store import EvaluationMetricsRegistry


def seed_internal_evaluation_metric_package() -> None:
    print("seeding internal evaluation metric package")
    origins = []

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
                EvaluationMetricsRegistry.create_evaluation_metric(
                    EvaluationMetricCreate(source=source), source_path
                )
        except Exception as e:
            print(f"seeding internal evaluation metric package failed: {e}")
    print("seeding internal evaluation metric package done")
