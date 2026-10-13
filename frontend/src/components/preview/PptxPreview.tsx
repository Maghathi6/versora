import React, { useState } from 'react';
import { PptxPreviewResult, ArtifactItem } from '../../types/artifact';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { IconPresentation, IconDownload, IconClose } from '../common/Icons';

interface PptxPreviewProps {
  artifact: ArtifactItem;
  data: PptxPreviewResult;
  onDownload: () => void;
  onClose: () => void;
}

export const PptxPreview: React.FC<PptxPreviewProps> = ({
  artifact,
  data,
  onDownload,
  onClose,
}) => {
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(0);
  const [showRawText, setShowRawText] = useState<boolean>(false);

  const currentSlide = data.slides[activeSlideIndex] || data.slides[0];

  const handlePrev = () => {
    setActiveSlideIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setActiveSlideIndex((prev) => Math.min(data.slides.length - 1, prev + 1));
  };

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
          <span style={{ color: '#ef4444', flexShrink: 0 }}>
            <IconPresentation size={18} />
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
              <Badge variant="danger">PowerPoint Presentation</Badge>
              <Badge variant="neutral">Slide Text Preview</Badge>
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
              {data.totalSlides} slide{data.totalSlides === 1 ? '' : 's'} &bull; Slide {activeSlideIndex + 1} of{' '}
              {data.slides.length}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowRawText((v) => !v)}
            title="Toggle between structured slide view and raw text"
          >
            {showRawText ? 'Slide View' : 'Raw Text'}
          </Button>

          <Button
            variant="primary"
            size="sm"
            icon={<IconDownload size={14} />}
            onClick={onDownload}
            title="Download original .pptx file"
          >
            Download Presentation
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

      {/* Main Workspace Layout (Sidebar of slides + Slide Stage) */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Slide Selector Sidebar */}
        <div
          style={{
            width: '240px',
            minWidth: '200px',
            background: 'var(--bg-surface)',
            borderRight: '1px solid var(--border-medium)',
            overflowY: 'auto',
            padding: '0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: '0.25rem',
              padding: '0 0.25rem',
            }}
          >
            Slides ({data.slides.length})
          </div>

          {data.slides.map((slide, idx) => {
            const isSelected = idx === activeSlideIndex;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveSlideIndex(idx)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  padding: '0.65rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  background: isSelected ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-card)',
                  border: isSelected ? '1px solid #ef4444' : '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  width: '100%',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '0.2rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isSelected ? '#ef4444' : 'var(--text-muted)' }}>
                    Slide {slide.index}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {slide.paragraphs.length} item{slide.paragraphs.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    width: '100%',
                  }}
                >
                  {slide.title || '(Untitled Slide)'}
                </div>
              </button>
            );
          })}
        </div>

        {/* Center Presentation Stage */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-surface)',
            padding: '2rem',
            overflowY: 'auto',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Active Slide Canvas */}
          <div
            style={{
              width: '100%',
              maxWidth: '780px',
              minHeight: '440px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.35)',
              padding: '2.5rem 3rem',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Slide Number Watermark */}
            <div
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.5rem',
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                fontWeight: 600,
              }}
            >
              Slide {currentSlide ? currentSlide.index : 1}
            </div>

            {currentSlide ? (
              showRawText ? (
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
                    {currentSlide.title}
                  </h3>
                  <pre
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '0.9rem',
                      lineHeight: 1.6,
                      color: 'var(--text-secondary)',
                      whiteSpace: 'pre-wrap',
                      background: 'var(--bg-surface)',
                      padding: '1rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    {currentSlide.rawText || '(No text extracted for this slide)'}
                  </pre>
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {/* Slide Title */}
                  <div
                    style={{
                      borderBottom: '2px solid rgba(239, 68, 68, 0.4)',
                      paddingBottom: '1rem',
                      marginBottom: '1.75rem',
                    }}
                  >
                    <h2
                      style={{
                        fontSize: '1.65rem',
                        fontWeight: 800,
                        color: 'var(--text-primary)',
                        lineHeight: 1.3,
                        margin: 0,
                      }}
                    >
                      {currentSlide.title || `Slide ${currentSlide.index}`}
                    </h2>
                  </div>

                  {/* Slide Content Points */}
                  <div style={{ flex: 1 }}>
                    {currentSlide.paragraphs.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.95rem' }}>
                        (Slide contains visual elements or no additional body text)
                      </p>
                    ) : (
                      <ul style={{ paddingLeft: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                        {currentSlide.paragraphs.map((point, pIdx) => (
                          <li
                            key={pIdx}
                            style={{
                              fontSize: '1.05rem',
                              lineHeight: 1.6,
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {point}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )
            ) : (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No slide selected.
              </div>
            )}
          </div>

          {/* Slide Navigation Controls */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              marginTop: '1.5rem',
              background: 'var(--bg-surface-elevated)',
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-full, 9999px)',
              border: '1px solid var(--border-medium)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <Button
              variant="ghost"
              size="sm"
              disabled={activeSlideIndex === 0}
              onClick={handlePrev}
            >
              Previous Slide
            </Button>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {activeSlideIndex + 1} / {data.slides.length}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={activeSlideIndex >= data.slides.length - 1}
              onClick={handleNext}
            >
              Next Slide
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
