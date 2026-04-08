import { cn } from "@/lib/utils";
import { Handle, Position, type HandleProps } from "reactflow";

type WorkflowHandleProps = Omit<HandleProps, "className" | 'type' | 'position'> & {
  className?: string;
  /** 只在拖线时生效：类型不匹配时显示 disabled 色并禁用连接 */
  mismatch?: boolean;
  /** 是否隐藏（用于 param 的 handle：未连接且未 hover 时隐藏） */
  hidden?: boolean;
  /** 是否禁用连接 */
  disabled?: boolean;
  isInput?: boolean;
};

export function WorkflowHandle(
  props: WorkflowHandleProps,
) {
  const {
    mismatch = false,
    hidden = false,
    disabled = false,
    className,
    isConnectable,
    isInput = false,
    ...rest
  } = props;

  const disabledByMismatch = Boolean(mismatch);

  return <Handle
    {...rest}
    position={isInput ? Position.Left : Position.Right}
    type={isInput ? 'target' : 'source'}
    className={cn(
      className,
      "h-2! w-2!",
      {
        "hidden": hidden,
        "bg-muted-foreground/30! border-muted-foreground/40! opacity-60": disabledByMismatch,
      }
    )}
    isConnectable={Boolean(
      isConnectable ?? !disabled,
    )}
  />;
}

