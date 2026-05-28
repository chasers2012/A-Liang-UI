'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

const TableOptionsContext = React.createContext<{ compact: boolean }>({
  compact: false,
});

function useTableOptions() {
  return React.useContext(TableOptionsContext);
}

function Table({
  className,
  compact = false,
  ...props
}: React.ComponentProps<'table'> & {
  compact?: boolean;
}) {
  const ctx = React.useMemo(() => ({ compact }), [compact]);
  return (
    <TableOptionsContext.Provider value={ctx}>
      <div
        data-slot="table-container"
        className="group/table relative w-full overflow-x-auto text-sm text-card-foreground"
      >
        <table data-slot="table" className={cn('w-full caption-bottom border-collapse', className)} {...props} />
      </div>
    </TableOptionsContext.Provider>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        '[&_tr]:border-b [&_tr]:border-border/80 [&_tr]:bg-muted/40 [&_tr]:transition-colors [&_tr:hover]:bg-muted/50',
        className,
      )}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return <tbody data-slot="table-body" className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn('border-t bg-muted/50 font-medium [&>tr]:last:border-b-0', className)}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  const { compact } = useTableOptions();
  return (
    <tr
      data-slot="table-row"
      className={cn(
        'border-b border-border/60 transition-colors data-[state=selected]:bg-muted',
        compact ? 'hover:bg-muted/25' : 'hover:bg-muted/30',
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  const { compact } = useTableOptions();
  return (
    <th
      data-slot="table-head"
      className={cn(
        'text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0',
        compact ? 'h-9 px-2 text-xs whitespace-nowrap' : 'h-10 px-3 whitespace-nowrap',
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  const { compact } = useTableOptions();
  return (
    <td
      data-slot="table-cell"
      className={cn(
        'align-middle [&:has([role=checkbox])]:pr-0',
        compact ? 'p-1.5 text-xs' : 'px-3 py-2 whitespace-nowrap',
        className,
      )}
      {...props}
    />
  );
}

function TableCaption({ className, ...props }: React.ComponentProps<'caption'>) {
  return (
    <caption data-slot="table-caption" className={cn('mt-4 text-sm text-muted-foreground', className)} {...props} />
  );
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
