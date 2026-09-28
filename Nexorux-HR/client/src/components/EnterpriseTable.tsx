import React, { useMemo, useState } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, Filter, X } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';

export type SortDirection = 'asc' | 'desc' | null;

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  width?: number | string;
  minWidth?: number;
  render?: (value: any, row: T, index: number) => React.ReactNode;
  filterType?: 'text' | 'select' | 'date' | 'number' | 'boolean';
  filterOptions?: { label: string; value: string | number | boolean }[];
}

export interface EnterpriseTableProps<T> {
  data: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  selectable?: boolean;
  selectedKeys?: Set<string>;
  onSelectionChange?: (keys: Set<string>) => void;
  bulkActions?: React.ReactNode;
  emptyMessage?: string;
  pageSize?: number;
  serverSide?: boolean;
  totalItems?: number;
  page?: number;
  onPageChange?: (page: number) => void;
}

export function EnterpriseTable<T>({
  data,
  columns,
  rowKey,
  isLoading = false,
  selectable = false,
  selectedKeys = new Set(),
  onSelectionChange,
  bulkActions,
  emptyMessage = 'No hay datos',
  pageSize = 50,
  serverSide = false,
  totalItems,
  page = 1,
  onPageChange
}: EnterpriseTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [showFilters, setShowFilters] = useState(false);
  const parentRef = React.useRef<HTMLDivElement>(null);

  const filteredData = useMemo(() => {
    let result = [...data];

    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '' || value === false) return;
      const col = columns.find(c => c.key === key);
      if (!col) return;

      result = result.filter(row => {
        const cell = (row as any)[key];
        if (value instanceof RegExp) return value.test(String(cell ?? ''));
        if (col.filterType === 'boolean') return Boolean(cell) === Boolean(value);
        return String(cell ?? '').toLowerCase().includes(String(value).toLowerCase());
      });
    });

    if (sortKey && sortDir) {
      result.sort((a, b) => {
        const aVal = (a as any)[sortKey];
        const bVal = (b as any)[sortKey];
        if (aVal === bVal) return 0;
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        const cmp = aVal < bVal ? -1 : 1;
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [data, filters, sortKey, sortDir, columns]);

  const virtualizer = useVirtualizer({
    count: filteredData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 20,
  });

  const visibleData = useMemo(() => {
    if (serverSide) return data;
    const start = (page - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [data, filteredData, serverSide, page, pageSize]);

  const totalPages = serverSide && totalItems
    ? Math.ceil(totalItems / pageSize)
    : Math.ceil(filteredData.length / pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc');
      if (sortDir === 'desc') setSortKey(null);
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilter = (key: string) => {
    setFilters(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!onSelectionChange) return;
    const allSelected = visibleData.every(row => selectedKeys.has(rowKey(row)));
    const next = new Set(selectedKeys);
    if (allSelected) {
      visibleData.forEach(row => next.delete(rowKey(row)));
    } else {
      visibleData.forEach(row => next.add(rowKey(row)));
    }
    onSelectionChange(next);
  };

  const toggleSelectRow = (row: T) => {
    if (!onSelectionChange) return;
    const key = rowKey(row);
    const next = new Set(selectedKeys);
    next.has(key) ? next.delete(key) : next.add(key);
    onSelectionChange(next);
  };

  const activeFilterCount = Object.values(filters).filter(v => v !== undefined && v !== null && v !== '' && v !== false).length;

  return (
    <div className="enterprise-table-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn-secondary"
            style={{ position: 'relative' }}
          >
            <Filter size={14} />
            <span>Filtros</span>
            {activeFilterCount > 0 && (
              <span style={{
                position: 'absolute', top: '-6px', right: '-6px',
                background: 'var(--brand-primary)', color: '#fff',
                fontSize: '10px', fontWeight: 700, padding: '1px 5px',
                borderRadius: '999px', minWidth: '18px', textAlign: 'center'
              }}>
                {activeFilterCount}
              </span>
            )}
          </button>
          {activeFilterCount > 0 && (
            <button onClick={() => setFilters({})} className="btn-secondary" style={{ padding: '6px 10px', fontSize: '11px' }}>
              <X size={12} />
              <span>Limpiar</span>
            </button>
          )}
          {selectable && selectedKeys.size > 0 && bulkActions && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{selectedKeys.size} seleccionados</span>
              {bulkActions}
            </div>
          )}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {serverSide && totalItems ? `Total: ${totalItems} registros` : `${filteredData.length} registros`}
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="glass-panel animate-fade-in" style={{ padding: '16px', borderRadius: 'var(--radius-md)', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-end' }}>
          {columns.filter(c => c.filterable !== false).map(col => (
            <div key={col.key} style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '160px', flex: '1 1 180px' }}>
              <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {col.label}
              </label>
              {col.filterType === 'select' && col.filterOptions ? (
                <select
                  className="input-field"
                  value={filters[col.key] ?? ''}
                  onChange={e => handleFilterChange(col.key, e.target.value || undefined)}
                  style={{ fontSize: '12px' }}
                >
                  <option value="">Todos</option>
                  {col.filterOptions.map(opt => (
                    <option key={String(opt.value)} value={String(opt.value)}>{opt.label}</option>
                  ))}
                </select>
              ) : col.filterType === 'boolean' ? (
                <select
                  className="input-field"
                  value={filters[col.key] === true ? 'true' : filters[col.key] === false ? 'false' : ''}
                  onChange={e => handleFilterChange(col.key, e.target.value === 'true' ? true : e.target.value === 'false' ? false : undefined)}
                  style={{ fontSize: '12px' }}
                >
                  <option value="">Todos</option>
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </select>
              ) : (
                <input
                  className="input-field"
                  type={col.filterType === 'number' ? 'number' : col.filterType === 'date' ? 'date' : 'text'}
                  placeholder={`Filtrar por ${col.label.toLowerCase()}...`}
                  value={filters[col.key] ?? ''}
                  onChange={e => handleFilterChange(col.key, e.target.value || undefined)}
                  style={{ fontSize: '12px' }}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="data-table-container" style={{ flex: 1, minHeight: 0 }}>
        <table className="data-table" style={{ tableLayout: 'auto' }}>
          <thead>
            <tr>
              {selectable && (
                <th style={{ width: '40px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={visibleData.length > 0 && visibleData.every(row => selectedKeys.has(rowKey(row)))}
                    onChange={toggleSelectAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
              )}
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  style={{
                    width: col.width,
                    minWidth: col.minWidth,
                    cursor: col.sortable !== false ? 'pointer' : 'default',
                    userSelect: 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{col.label}</span>
                    {col.sortable !== false && (
                      <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1 }}>
                        {sortKey === col.key && sortDir === 'asc' ? <ChevronUp size={12} color="var(--brand-primary)" /> :
                         sortKey === col.key && sortDir === 'desc' ? <ChevronDown size={12} color="var(--brand-primary)" /> :
                         <ChevronsUpDown size={12} color="var(--text-muted)" />}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Cargando datos...
                </td>
              </tr>
            ) : visibleData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              visibleData.map((row, idx) => {
                const key = rowKey(row);
                const isSelected = selectedKeys.has(key);
                return (
                  <tr
                    key={key}
                    style={{
                      background: isSelected ? 'rgba(99, 102, 241, 0.08)' : undefined,
                      borderLeft: isSelected ? '3px solid var(--brand-primary)' : '3px solid transparent'
                    }}
                  >
                    {selectable && (
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(row)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                    )}
                    {columns.map(col => (
                      <td key={col.key} style={{ minWidth: col.minWidth }}>
                        {col.render
                          ? col.render((row as any)[col.key], row, idx)
                          : String((row as any)[col.key] ?? '—')
                        }
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px', fontSize: '12px', color: 'var(--text-muted)' }}>
          <div>
            {serverSide && totalItems
              ? `Mostrando ${(page - 1) * pageSize + 1}-{Math.min(page * pageSize, totalItems)} de ${totalItems}`
              : `Mostrando ${(page - 1) * pageSize + 1}-{Math.min(page * pageSize, filteredData.length)} de ${filteredData.length}`
            }
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button
              className="btn-secondary"
              disabled={page <= 1}
              onClick={() => onPageChange?.(page - 1)}
              style={{ padding: '5px 10px', fontSize: '11px', opacity: page <= 1 ? 0.5 : 1 }}
            >
              Anterior
            </button>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {page} / {totalPages}
            </span>
            <button
              className="btn-secondary"
              disabled={page >= totalPages}
              onClick={() => onPageChange?.(page + 1)}
              style={{ padding: '5px 10px', fontSize: '11px', opacity: page >= totalPages ? 0.5 : 1 }}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
