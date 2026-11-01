import type { Cell } from '@tanstack/react-table';

/** Column title for a cell, used by the phone layout (each cell shows its own label when rows become cards). */
export function cellLabel<T>(cell: Cell<T, unknown>): string {
  const h = cell.column.columnDef.header;
  return typeof h === 'string' ? h : '';
}
