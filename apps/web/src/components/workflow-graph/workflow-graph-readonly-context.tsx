"use client";

import { createContext, useContext, type ReactNode } from "react";

const WorkflowGraphReadOnlyContext = createContext(false);

export function WorkflowGraphReadOnlyProvider(props: {
  readOnly: boolean;
  children: ReactNode;
}) {
  return (
    <WorkflowGraphReadOnlyContext.Provider value={props.readOnly}>
      {props.children}
    </WorkflowGraphReadOnlyContext.Provider>
  );
}

export function useWorkflowGraphReadOnly(): boolean {
  return useContext(WorkflowGraphReadOnlyContext);
}
