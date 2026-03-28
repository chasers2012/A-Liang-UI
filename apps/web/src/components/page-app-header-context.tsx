"use client";

import { createContext } from "react";

export type PageAppHeaderContextValue = {
  suppressBackLink: (suppress: boolean) => void;
};

export const PageAppHeaderContext =
  createContext<PageAppHeaderContextValue | null>(null);
