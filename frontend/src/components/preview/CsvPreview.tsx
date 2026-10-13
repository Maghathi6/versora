import React, { useState, useMemo } from 'react';
import { CsvPreviewResult, ArtifactItem } from '../../types/artifact';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { IconTable, IconDownload, IconClose, IconSearch, IconAlertCircle, IconEdit } from '../common/Icons';

interface CsvPreviewProps {
  artifact: ArtifactItem;
  data: CsvPreviewResult;
  onEditInCodeEditor?: () => void;
  onDownload: () => void;
  onClose: () => void;
}

export const CsvPreview: React.FC<CsvPreviewProps> = ({
  artifact,
  data,
  onEditInCodeEditor,
  onDownload,
  onClose,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');

  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return data.rows;
    const lower = searchTerm.toLowerCase();
    return data.rows.filter((row) =>
      row.some((cell) => cell.toLowerCase().includes(lower))
    );
  }, [data.rows, searchTerm]);

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
          <span style={{ color: '#06b6d4', flexShrink: 0 }}>
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
              <Badge variant="info">CSV Dataset</Badge>
              <Badge variant="neutral">Table View</Badge>
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
              {data.totalRows.toLocaleString()} rows &bull; {data.totalCols} columns
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Search Filter */}
          <div style={{ position: 'relative', width: '200px' }}>
            <input
              type="text"
              placeholder="Filter table..."
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

          {onEditInCodeEditor && (
            <Button
              variant="outline"
              size="sm"
              icon={<IconEdit size={14} />}
              onClick={onEditInCodeEditor}
              title="Open raw CSV in Monaco code editor"
            >
              Edit in Code Editor
            </Button>
          )}

          <Button
            variant="primary"
            size="sm"
            icon={<IconDownload size={14} />}
            onClick={onDownload}
            title="Download original .csv file"
          >
            Download CSV
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

      {/* Truncation notice */}
      {data.isTruncated && (
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
            Large dataset truncated for browser display. Showing first {data.rows.length} of{' '}
            {data.totalRows.toLocaleString()} rows. Download the file to view the full dataset.
          </span>
        </div>
      )}

      {/* Table Content */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          background: 'var(--bg-surface)',
          position: 'relative',
        }}
      >
        {data.headers.length === 0 && data.rows.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            CSV file is empty.
          </div>
        ) : filteredRows.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No rows match "{searchTerm}".
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
                <th
                  style={{
                    width: '45px',
                    minWidth: '45px',
                    padding: '0.45rem 0.5rem',
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
                {data.headers.map((hdr, hIdx) => (
                  <th
                    key={hIdx}
                    style={{
                      padding: '0.45rem 0.75rem',
                      textAlign: 'left',
                      minWidth: '120px',
                      maxWidth: '300px',
                      background: 'var(--bg-surface-elevated)',
                      borderRight: '1px solid var(--border-subtle)',
                      borderBottom: '1px solid var(--border-medium)',
                      color: 'var(--text-primary)',
                      fontWeight: 700,
                    }}
                  >
                    {hdr || `Col ${hIdx + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  style={{
                    background: rIdx % 2 === 0 ? 'var(--bg-card)' : 'rgba(255, 255, 255, 0.015)',
                    transition: 'background 0.1s ease',
                  }}
                >
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
                    {rIdx + 1}
                  </td>
                  {data.headers.map((_, cIdx) => {
                    const val = row[cIdx] ?? '';
                    return (
                      <td
                        key={cIdx}
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRight: '1px solid var(--border-subtle)',
                          borderBottom: '1px solid var(--border-subtle)',
                          color: val ? 'var(--text-primary)' : 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '320px',
                        }}
                        title={val}
                      >
                        {val}
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
