'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface Block {
  id: string;
  type: 'header' | 'text' | 'image-text' | 'cta' | 'footer' | 'divider';
  content: string;
}

interface TemplateEditorProps {
  templateId?: string;
  initialName?: string;
  initialSubject?: string;
  initialBlocks?: Block[];
  initialCategory?: string;
  onSaved?: () => void;
  onCancel?: () => void;
}

const defaultBlocks: Block[] = [
  {
    id: 'block-1',
    type: 'header',
    content: '<div style="background-color:#3b82f6;padding:32px 24px;text-align:center;border-radius:8px 8px 0 0"><h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:700">Your Company Name</h1><p style="color:#bfdbfe;margin:8px 0 0;font-size:14px">Newsletter / Announcement</p></div>',
  },
  {
    id: 'block-2',
    type: 'text',
    content: '<div style="padding:24px"><h2 style="color:#1e293b;margin:0 0 12px;font-size:20px">Hello {{firstName}},</h2><p style="color:#475569;margin:0;font-size:15px;line-height:1.6">Thank you for being part of our community. We have exciting news to share with you today.</p></div>',
  },
  {
    id: 'block-3',
    type: 'cta',
    content: '<div style="padding:16px 24px;text-align:center"><a href="#" style="display:inline-block;background-color:#3b82f6;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">Learn More</a></div>',
  },
  {
    id: 'block-4',
    type: 'footer',
    content: '<div style="padding:24px;text-align:center;border-top:1px solid #e2e8f0"><p style="color:#94a3b8;margin:0;font-size:12px">You received this email because you signed up on our website.<br /><a href="{{unsubscribeUrl}}" style="color:#3b82f6;text-decoration:underline">Unsubscribe</a></p></div>',
  },
];

const blockTypeLabels: Record<Block['type'], string> = {
  header: 'Header',
  text: 'Text Block',
  'image-text': 'Image + Text',
  cta: 'CTA Button',
  footer: 'Footer',
  divider: 'Divider',
};

const blockTypeIcons: Record<Block['type'], React.ReactNode> = {
  header: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
    </svg>
  ),
  text: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  ),
  'image-text': (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  cta: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
    </svg>
  ),
  footer: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2zM3 17h18" />
    </svg>
  ),
  divider: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h16" />
    </svg>
  ),
};

const newBlockContent: Record<Block['type'], string> = {
  header: '<div style="background-color:#3b82f6;padding:32px 24px;text-align:center"><h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:700">Header Title</h1></div>',
  text: '<div style="padding:24px"><p style="color:#475569;margin:0;font-size:15px;line-height:1.6">Enter your text content here. You can write about your product, share updates, or tell a story.</p></div>',
  'image-text': '<div style="padding:24px"><table width="100%" cellpadding="0" cellspacing="0"><tr><td width="40%" style="vertical-align:top;padding-right:16px"><div style="background:#e2e8f0;border-radius:8px;height:160px;display:flex;align-items:center;justify-content:center"><span style="color:#94a3b8;font-size:13px">[Image placeholder]</span></div></td><td width="60%" style="vertical-align:top"><h3 style="color:#1e293b;margin:0 0 8px;font-size:18px">Feature Title</h3><p style="color:#475569;margin:0;font-size:14px;line-height:1.5">Describe the feature or product here. Add relevant details.</p></td></tr></table></div>',
  cta: '<div style="padding:16px 24px;text-align:center"><a href="#" style="display:inline-block;background-color:#3b82f6;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">Click Here</a></div>',
  footer: '<div style="padding:24px;text-align:center;border-top:1px solid #e2e8f0"><p style="color:#94a3b8;margin:0;font-size:12px">Your Company | Address<br /><a href="{{unsubscribeUrl}}" style="color:#3b82f6;text-decoration:underline">Unsubscribe</a></p></div>',
  divider: '<div style="padding:8px 24px"><hr style="border:none;border-top:1px solid #e2e8f0;margin:0" /></div>',
};

let blockCounter = 100;

export default function TemplateEditor({
  templateId,
  initialName = '',
  initialSubject = '',
  initialBlocks,
  initialCategory = 'general',
  onSaved,
  onCancel,
}: TemplateEditorProps) {
  const [name, setName] = useState(initialName);
  const [subject, setSubject] = useState(initialSubject);
  const [category, setCategory] = useState(initialCategory);
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks ?? defaultBlocks);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  // Load template data when editing
  useEffect(() => {
    if (templateId && !initialBlocks) {
      fetch(`/api/templates/${templateId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.name) setName(data.name);
          if (data.subject) setSubject(data.subject);
          if (data.category) setCategory(data.category);
          if (data.jsonLayout) {
            try {
              setBlocks(JSON.parse(data.jsonLayout));
            } catch {
              // Fall back to default blocks if JSON parse fails
            }
          }
        })
        .catch(console.error);
    }
  }, [templateId, initialBlocks]);

  const getFullHtml = useCallback(() => {
    const body = blocks.map((b) => b.content).join('\n');
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif"><div style="max-width:600px;margin:0 auto;background-color:#ffffff">${body}</div></body></html>`;
  }, [blocks]);

  const addBlock = (type: Block['type']) => {
    blockCounter++;
    const newBlock: Block = {
      id: `block-${blockCounter}`,
      type,
      content: newBlockContent[type],
    };
    setBlocks((prev) => [...prev, newBlock]);
    setActiveBlockId(newBlock.id);
  };

  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    if (activeBlockId === id) setActiveBlockId(null);
  };

  const moveBlock = (idx: number, direction: -1 | 1) => {
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= blocks.length) return;
    setBlocks((prev) => {
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
  };

  const updateBlockContent = (id: string, content: string) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, content } : b))
    );
  };

  const handleDragStart = (idx: number) => {
    setDraggedIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;
    setBlocks((prev) => {
      const next = [...prev];
      const [dragged] = next.splice(draggedIdx, 1);
      next.splice(idx, 0, dragged);
      return next;
    });
    setDraggedIdx(idx);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
  };

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
  };

  const handleSave = async () => {
    if (!name.trim() || !subject.trim()) {
      alert('Please enter a template name and subject line.');
      return;
    }

    setSaving(true);
    try {
      const url = templateId ? `/api/templates/${templateId}` : '/api/templates';
      const method = templateId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          subject,
          category,
          htmlContent: getFullHtml(),
          jsonLayout: JSON.stringify(blocks),
        }),
      });

      if (res.ok) {
        onSaved?.();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to save template');
      }
    } catch (err) {
      console.error('Save failed:', err);
      alert('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-[600px]">
      {/* Top toolbar */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <input
            type="text"
            placeholder="Template name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-9 w-48 rounded-lg border border-gray-200 px-3 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-9 rounded-lg border border-gray-200 px-3 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="general">General</option>
            <option value="welcome">Welcome</option>
            <option value="promotional">Promotional</option>
            <option value="followup">Follow-up</option>
            <option value="newsletter">Newsletter</option>
            <option value="transactional">Transactional</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              onClick={onCancel}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-5 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50 transition-colors shadow-sm"
          >
            {saving && (
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            Save Template
          </button>
        </div>
      </div>

      {/* Subject line */}
      <div className="border-b border-gray-200 bg-gray-50 px-6 py-3">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-500 whitespace-nowrap">Subject:</label>
          <input
            type="text"
            placeholder="Enter email subject line..."
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="h-9 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>

      {/* Main editor area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Block palette + formatting toolbar */}
        <div className="w-56 flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto">
          {/* Formatting toolbar */}
          <div className="border-b border-gray-200 p-3">
            <p className="text-xs font-semibold uppercase text-gray-400 mb-2">Formatting</p>
            <div className="flex flex-wrap gap-1">
              <button onClick={() => execCommand('bold')} className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors" title="Bold">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
                </svg>
              </button>
              <button onClick={() => execCommand('italic')} className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors" title="Italic">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 4h4m-2 0v16m-4 0h8" transform="skewX(-10)" />
                </svg>
              </button>
              <button onClick={() => execCommand('formatBlock', '<h2>')} className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors" title="Heading">
                <span className="text-xs font-bold">H</span>
              </button>
              <button onClick={() => execCommand('insertImage', prompt('Image URL:') || '')} className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors" title="Insert Image">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
              <button onClick={() => execCommand('insertHorizontalRule')} className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors" title="Divider">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h16" />
                </svg>
              </button>
              <button onClick={() => execCommand('createLink', prompt('Link URL:') || '')} className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors" title="Insert Link">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </button>
            </div>
          </div>

          {/* Block palette */}
          <div className="p-3">
            <p className="text-xs font-semibold uppercase text-gray-400 mb-2">Insert Block</p>
            <div className="space-y-1">
              {(Object.keys(blockTypeLabels) as Block['type'][]).map((type) => (
                <button
                  key={type}
                  onClick={() => addBlock(type)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                >
                  <span className="text-gray-400">{blockTypeIcons[type]}</span>
                  {blockTypeLabels[type]}
                </button>
              ))}
            </div>
          </div>

          {/* Variables */}
          <div className="border-t border-gray-200 p-3">
            <p className="text-xs font-semibold uppercase text-gray-400 mb-2">Variables</p>
            <div className="space-y-1 text-xs">
              {['{{firstName}}', '{{lastName}}', '{{company}}', '{{email}}', '{{unsubscribeUrl}}'].map((v) => (
                <button
                  key={v}
                  onClick={() => {
                    navigator.clipboard.writeText(v);
                  }}
                  className="block w-full text-left rounded px-2 py-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 font-mono transition-colors"
                  title="Click to copy"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Center: Block editor */}
        <div className="flex-1 overflow-y-auto bg-gray-100 p-6" ref={editorRef}>
          <div className="mx-auto max-w-[600px] bg-white rounded-lg shadow-sm border border-gray-200">
            {blocks.length === 0 && (
              <div className="py-16 text-center text-gray-400">
                <p className="text-sm">No blocks yet. Add blocks from the left panel.</p>
              </div>
            )}
            {blocks.map((block, idx) => (
              <div
                key={block.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                onClick={() => setActiveBlockId(block.id)}
                className={`group relative border-2 transition-colors cursor-move ${
                  activeBlockId === block.id
                    ? 'border-blue-400'
                    : draggedIdx === idx
                    ? 'border-blue-200 opacity-50'
                    : 'border-transparent hover:border-gray-200'
                }`}
              >
                {/* Block toolbar */}
                <div className={`absolute -top-3 left-2 flex items-center gap-0.5 z-10 ${activeBlockId === block.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                  <span className="rounded bg-blue-500 px-2 py-0.5 text-[10px] font-medium text-white">
                    {blockTypeLabels[block.type]}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); moveBlock(idx, -1); }}
                    disabled={idx === 0}
                    className="rounded bg-white border border-gray-200 p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 shadow-sm"
                    title="Move up"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); moveBlock(idx, 1); }}
                    disabled={idx === blocks.length - 1}
                    className="rounded bg-white border border-gray-200 p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 shadow-sm"
                    title="Move down"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeBlock(block.id); }}
                    className="rounded bg-white border border-gray-200 p-0.5 text-gray-400 hover:text-red-500 shadow-sm"
                    title="Remove"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Editable content */}
                <div
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => updateBlockContent(block.id, e.currentTarget.innerHTML)}
                  dangerouslySetInnerHTML={{ __html: block.content }}
                  className="outline-none min-h-[40px]"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Right: Live preview */}
        <div className="w-80 flex-shrink-0 border-l border-gray-200 bg-white overflow-y-auto hidden xl:block">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">Live Preview</h3>
            <p className="text-xs text-gray-400 mt-0.5">How it looks in an inbox</p>
          </div>
          <div className="p-4">
            {/* Email client chrome */}
            <div className="rounded-lg border border-gray-200 overflow-hidden shadow-sm">
              <div className="bg-gray-50 border-b border-gray-200 px-3 py-2">
                <p className="text-[10px] text-gray-400">From: <span className="text-gray-600">Your Company</span></p>
                <p className="text-[10px] text-gray-400">Subject: <span className="text-gray-600 font-medium">{subject || '(no subject)'}</span></p>
              </div>
              <div className="bg-white">
                <div
                  className="origin-top-left"
                  style={{ transform: 'scale(0.45)', width: '222%', height: 'auto' }}
                  dangerouslySetInnerHTML={{ __html: blocks.map((b) => b.content).join('') }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
