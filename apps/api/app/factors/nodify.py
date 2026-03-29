from factor.factor import Factor
from workflow import workflow_node, workflow_socket


def nodify_factor(cls: type[Factor]) -> type[Factor]:
    return workflow_node(
        input_sockets=[
            workflow_socket("data", required=True, value_type="factor_data"),
        ],
        output_sockets=[
            workflow_socket("result", required=True, value_type="factor_result"),
        ],
    )(cls)
