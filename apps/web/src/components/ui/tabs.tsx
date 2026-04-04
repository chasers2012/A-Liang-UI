"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"

function Tabs({ ...props }: TabsPrimitive.Root.Props) {
  return <TabsPrimitive.Root data-slot="tabs" {...props} />
}

function TabsList({ ...props }: TabsPrimitive.List.Props) {
  return <TabsPrimitive.List data-slot="tabs-list" {...props} />
}

function TabsTrigger({ ...props }: TabsPrimitive.Tab.Props) {
  return <TabsPrimitive.Tab data-slot="tabs-trigger" {...props} />
}

function TabsContent({ ...props }: TabsPrimitive.Panel.Props) {
  return <TabsPrimitive.Panel data-slot="tabs-content" {...props} />
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
