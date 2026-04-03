"use client";

import { createContext, useContext, type ReactNode } from "react";

interface WorkflowGraphContextValue {
  readOnly: boolean;
}

const DEFAULT_CONTEXT_VALUE: WorkflowGraphContextValue = {
  readOnly: false,
};

const WorkflowGraphReadOnlyContext = createContext<WorkflowGraphContextValue>(DEFAULT_CONTEXT_VALUE);

export function WorkflowGraphContextProvider(props: {
  readOnly: boolean;
  children: ReactNode;
}) {
  const { children, ...rest } = props;
  return (
    <WorkflowGraphReadOnlyContext.Provider value={rest}>
      {children}
    </WorkflowGraphReadOnlyContext.Provider>
  );
}

export function useWorkflowGraphContext(): WorkflowGraphContextValue {
  return useContext(WorkflowGraphReadOnlyContext);
}
