"use client";

import type { ReactNode } from "react";
import { ScrollableTable } from "./ScrollableTable";

export interface ResponsiveColumn<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  /** Visible arriba de la tarjeta en mobile (máximo 2 recomendado). */
  mobilePrimary?: boolean;
  /** Oculta la columna en mobile (ej. acciones que van en el menú "⋯"). */
  hideOnMobile?: boolean;
}

/** Tabla en escritorio (md+, sin cambios visuales); debajo de md, lista de
 * tarjetas: las columnas `mobilePrimary` arriba y el resto en filas plegadas
 * dentro de la tarjeta. Un solo lugar para la lógica, así la misma tabla no
 * se duplica por pantalla. */
export function ResponsiveTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty,
}: {
  columns: ResponsiveColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
}) {
  if (rows.length === 0) return <>{empty ?? null}</>;

  const primary = columns.filter((c) => c.mobilePrimary);
  const secondary = columns.filter((c) => !c.mobilePrimary && !c.hideOnMobile);

  return (
    <>
      <div className="hidden md:block">
        <ScrollableTable>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default text-left text-xs font-medium text-neutral-500">
                {columns.map((c) => (
                  <th key={c.key} className="px-3 py-2 font-medium">
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={onRowClick ? "cursor-pointer border-b border-border-default/60 hover:bg-surface-2" : "border-b border-border-default/60"}
                >
                  {columns.map((c) => (
                    <td key={c.key} className="px-3 py-2">
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableTable>
      </div>

      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((row) => (
          <li
            key={rowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className="rounded-2xl border border-border-default bg-surface-1 p-3"
          >
            {primary.length > 0 && (
              <div className="flex flex-col gap-0.5">
                {primary.map((c) => (
                  <div key={c.key} className="text-sm font-semibold text-foreground">
                    {c.render(row)}
                  </div>
                ))}
              </div>
            )}
            {secondary.length > 0 && (
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                {secondary.map((c) => (
                  <div key={c.key} className="contents">
                    <dt className="text-neutral-500">{c.header}</dt>
                    <dd className="truncate text-foreground">{c.render(row)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
