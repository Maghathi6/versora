import React, { useState, useMemo } from 'react';
import { XlsxPreviewResult, ArtifactItem } from '../../types/artifact';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { IconTable, IconDownload, IconClose, IconSearch, IconAlertCircle } from '../common/Icons';

interface XlsxPreviewProps {
  artifact: ArtifactItem;
  data: XlsxPreviewResult;
  onDownload: () => void;
  onClose: () => void;
}

function getColumnLetter(colIndex: number): string {
  let letter = '';
  let temp = colIndex;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

export const XlsxPreview: React.FC<XlsxPreviewProps> = ({
  artifact,
  data,
  onDownload,
  onClose,
}) => {
  const [activeSheetName, setActiveSheetName] = useState<string>(
    data.activeSheet || data.sheetNames[0] || ''
  );
  const [searchTerm, setSearchTerm] = useState<string>('');

  const currentSheet = data.sheets[activeSheetName];

  // Filter rows based on search term
  const filteredRows = useMemo(() => {
    if (!currentSheet || !currentSheet.rows) return [];
    if (!searchTerm.trim()) return currentSheet.rows;
    const lower = searchTerm.toLowerCase();
    return currentSheet.rows.filter((row) =>
      row.some((cell) => cell !== null && cell !== undefined && String(cell).toLowerCase().includes(lower))
    );
  }, [currentSheet, searchTerm]);

  const maxCols = useMemo(() => {
    if (!currentSheet || !currentSheet.rows) return 0;
    return currentSheet.totalCols || (currentSheet.rows[0]?.length ?? 0);
  }, [currentSheet]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: '600px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      {/* Top Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          padding: '0.65rem 1rem',
          background: 'var(--bg-surface-elevated)',
          borderBottom: '1px solid var(--border-medium)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
          <span style={{ color: '#10b981', flexShrink: 0 }}>
            <IconTable size={18} />
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  color: 'var(--text-primary)',
                  fontFamily: 'monospace',
                }}
              >
                {artifact.name}
              </span>
              <Badge variant="success">Excel Spreadsheet</Badge>
              <Badge variant="neutral">Read-Only Table</Badge>
            </div>
            <span
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {data.sheetNames.length} sheet{data.sheetNames.length === 1 ? '' : 's'} &bull;{' '}
              {currentSheet ? `${currentSheet.totalRows.toLocaleString()} rows × ${currentSheet.totalCols} cols` : ''}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Quick cell filter */}
          <div style={{ position: 'relative', width: '200px' }}>
            <input
              type="text"
              placeholder="Search sheet..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input"
              style={{
                width: '100%',
                padding: '0.35rem 0.6rem 0.35rem 1.85rem',
                fontSize: '0.82rem',
                height: '32px',
              }}
            />
            <span
              style={{
                position: 'absolute',
                left: '0.55rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                pointerEvents: 'none',
              }}
            >
              <IconSearch size={13} />
            </span>
          </div>

          <Button
            variant="primary"
            size="sm"
            icon={<IconDownload size={14} />}
            onClick={onDownload}
            title="Download original .xlsx file"
          >
            Download Spreadsheet
          </Button>

          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: '0.35rem', color: 'var(--text-muted)' }}
            onClick={onClose}
            title="Close preview"
          >
            <IconClose size={18} />
          </button>
        </div>
      </div>

      {/* Truncation Notice if applicable */}
      {currentSheet?.isTruncated && (
        <div
          style={{
            padding: '0.45rem 1rem',
            background: 'rgba(245, 158, 11, 0.1)',
            borderBottom: '1px solid rgba(245, 158, 11, 0.25)',
            color: '#f59e0b',
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <IconAlertCircle size={15} />
          <span>
            Large worksheet truncated for browser performance. Showing first {currentSheet.rows.length} rows of{' '}
            {currentSheet.totalRows.toLocaleString()} rows. Download the file to view the complete dataset.
          </span>
        </div>
      )}

      {/* Worksheet Tab Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.35rem 0.75rem',
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-medium)',
          overflowX: 'auto',
        }}
      >
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginRight: '0.4rem', textTransform: 'uppercase' }}>
          Sheets:
        </span>
        {data.sheetNames.map((sheetName) => {
          const isActive = sheetName === activeSheetName;
          return (
            <button
              key={sheetName}
              type="button"
              onClick={() => {
                setActiveSheetName(sheetName);
                setSearchTerm('');
              }}
              style={{
                padding: '0.25rem 0.75rem',
                fontSize: '0.82rem',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#10b981' : 'var(--text-secondary)',
                background: isActive ? 'var(--bg-surface-elevated)' : 'transparent',
                border: isActive ? '1px solid var(--border-medium)' : '1px solid transparent',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
            >
              {sheetName}
            </button>
          );
        })}
      </div>

      {/* Spreadsheet Table View */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          background: 'var(--bg-surface)',
          position: 'relative',
        }}
      >
        {!currentSheet || filteredRows.length === 0 ? (
          <div
            style={{
              padding: '3rem',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.9rem',
            }}
          >
            {searchTerm ? `No cells match "${searchTerm}" in sheet "${activeSheetName}".` : 'Sheet is empty.'}
          </div>
        ) : (
          <table
            style={{
              width: 'max-content',
              minWidth: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.85rem',
              fontFamily: 'monospace',
            }}
          >
            <thead>
              <tr style={{ background: 'var(--bg-surface-elevated)', position: 'sticky', top: 0, zIndex: 10 }}>
                {/* Top-left corner box */}
                <th
                  style={{
                    width: '50px',
                    minWidth: '50px',
                    padding: '0.4rem 0.5rem',
                    textAlign: 'center',
                    background: 'var(--bg-surface-elevated)',
                    borderRight: '1px solid var(--border-medium)',
                    borderBottom: '1px solid var(--border-medium)',
                    color: 'var(--text-muted)',
                    fontSize: '0.75rem',
                  }}
                >
                  #
                </th>
                {Array.from({ length: Math.min(maxCols, 50) }).map((_, colIdx) => (
                  <th
                    key={colIdx}
                    style={{
                      padding: '0.4rem 0.75rem',
                      textAlign: 'left',
                      minWidth: '110px',
                      maxWidth: '300px',
                      background: 'var(--bg-surface-elevated)',
                      borderRight: '1px solid var(--border-subtle)',
                      borderBottom: '1px solid var(--border-medium)',
                      color: 'var(--text-secondary)',
                      fontWeight: 700,
                    }}
                  >
                    {getColumnLetter(colIdx)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  style={{
                    background: rowIdx % 2 === 0 ? 'var(--bg-card)' : 'rgba(255, 255, 255, 0.015)',
                    transition: 'background 0.1s ease',
                  }}
                >
                  {/* Row index indicator */}
                  <td
                    style={{
                      padding: '0.35rem 0.5rem',
                      textAlign: 'center',
                      background: 'var(--bg-surface-elevated)',
                      borderRight: '1px solid var(--border-medium)',
                      borderBottom: '1px solid var(--border-subtle)',
                      color: 'var(--text-muted)',
                      fontSize: '0.75rem',
                      userSelect: 'none',
                    }}
                  >
                    {rowIdx + 1}
                  </td>
                  {Array.from({ length: Math.min(maxCols, 50) }).map((_, colIdx) => {
                    const cellVal = row[colIdx];
                    const isNonEmpty = cellVal !== null && cellVal !== undefined && cellVal !== '';
                    return (
                      <td
                        key={colIdx}
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRight: '1px solid var(--border-subtle)',
                          borderBottom: '1px solid var(--border-subtle)',
                          color: isNonEmpty ? 'var(--text-primary)' : 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '320px',
                        }}
                        title={isNonEmpty ? String(cellVal) : ''}
                      >
                        {isNonEmpty ? String(cellVal) : ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
