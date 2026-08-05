'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  isNumeric?: boolean;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  emptyMessage?: string;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = 'No historical records found.',
  className,
}: DataTableProps<T>) {
  return (
    <div className={cn('w-full overflow-x-auto bg-[#111827] border border-[#1F2937] rounded-xl', className)}>
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="bg-[#0B0F0E] border-b border-[#1F2937]">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-[#9CA3AF] font-semibold',
                  col.isNumeric && 'text-right',
                  col.className
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1F2937]">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-[#9CA3AF] font-sans text-xs">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={keyExtractor(row)}
                className="hover:bg-[#1A1F2E] transition-colors group"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      'px-4 py-3 text-[#F0FDF4] font-sans text-xs',
                      col.isNumeric && 'text-right font-mono tabular-nums',
                      col.className
                    )}
                  >
                    {col.render ? col.render(row) : (row as any)[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
