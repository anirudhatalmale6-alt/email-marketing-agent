'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

type BlockType = 'logo' | 'header' | 'text' | 'image' | 'button' | 'imageText' | 'box' | 'divider' | 'spacer' | 'signature';

interface EditorBlock {
  id: string;
  type: BlockType;
  data: Record<string, any>;
}

interface TemplateEditorProps {
  templateId?: string;
  onSaved?: () => void;
  onCancel?: () => void;
}

interface PropDef {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'color' | 'select' | 'url' | 'range' | 'html';
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}

let _bc = 100;
const uid = () => `blk-${++_bc}-${Math.random().toString(36).slice(2, 6)}`;

const BLOCK_DEFAULTS: Record<BlockType, () => Record<string, any>> = {
  logo: () => ({ imageUrl: '', width: 180, alignment: 'center', linkUrl: '', bgColor: '#ffffff', padding: 20 }),
  header: () => ({ title: 'Your Company', subtitle: '', bgColor: '#3b82f6', textColor: '#ffffff', subtitleColor: '#bfdbfe', padding: 32 }),
  text: () => ({ html: '<p style="color:#475569;margin:0;font-size:15px;line-height:1.6">Enter your text here. Use the toolbar to make it <b>bold</b>, <i>italic</i>, or add links.</p>', padding: 24 }),
  image: () => ({ imageUrl: '', altText: '', width: '100%', alignment: 'center', linkUrl: '', borderRadius: 0, padding: 16 }),
  button: () => ({ text: 'Click Here', url: '#', bgColor: '#3b82f6', textColor: '#ffffff', borderRadius: 8, alignment: 'center', padding: 16, fontSize: 15 }),
  imageText: () => ({ imageUrl: '', imagePosition: 'left', title: 'Feature Title', description: 'Describe the feature or product here.', imageWidth: '40%', padding: 24 }),
  box: () => ({ layout: '2col', title1: 'Smart Inventory', desc1: 'AI-powered inventory management that predicts your needs before you do.', bgColor1: '#f0fdf4', title2: 'Analytics', desc2: 'Real-time insights and reporting to track your business performance.', bgColor2: '#eff6ff', title3: 'Automation', desc3: 'Streamline your workflows with intelligent automation tools.', bgColor3: '#fef3c7', borderColor: '#0f766e', titleColor: '#0f766e', textColor: '#475569', borderRadius: 8, padding: 20, margin: 16 }),
  divider: () => ({ color: '#e2e8f0', thickness: 1, style: 'solid', padding: 8 }),
  spacer: () => ({ height: 24 }),
  signature: () => ({ name: '', jobTitle: '', company: '', phone: '', email: '', website: '', imageUrl: '' }),
};

const BLOCK_LABELS: Record<BlockType, string> = {
  logo: 'Logo', header: 'Header', text: 'Text', image: 'Image',
  button: 'Button', imageText: 'Image + Text', box: 'Box',
  divider: 'Divider', spacer: 'Spacer', signature: 'Signature',
};

const BLOCK_PROPS: Record<BlockType, PropDef[]> = {
  logo: [
    { key: 'imageUrl', label: 'Logo Image URL', type: 'url', placeholder: 'https://your-logo.png' },
    { key: 'linkUrl', label: 'Click URL', type: 'url', placeholder: 'https://yoursite.com' },
    { key: 'width', label: 'Width (px)', type: 'range', min: 40, max: 400, step: 10 },
    { key: 'alignment', label: 'Alignment', type: 'select', options: [{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }] },
    { key: 'bgColor', label: 'Background', type: 'color' },
    { key: 'padding', label: 'Padding', type: 'range', min: 0, max: 60, step: 4 },
  ],
  header: [
    { key: 'title', label: 'Title', type: 'text', placeholder: 'Company Name or Headline' },
    { key: 'subtitle', label: 'Subtitle', type: 'text', placeholder: 'Optional tagline' },
    { key: 'bgColor', label: 'Background', type: 'color' },
    { key: 'textColor', label: 'Title Color', type: 'color' },
    { key: 'subtitleColor', label: 'Subtitle Color', type: 'color' },
    { key: 'padding', label: 'Padding', type: 'range', min: 8, max: 60, step: 4 },
  ],
  text: [
    { key: 'html', label: 'Content', type: 'html' },
    { key: 'padding', label: 'Padding', type: 'range', min: 0, max: 60, step: 4 },
  ],
  image: [
    { key: 'imageUrl', label: 'Image URL', type: 'url', placeholder: 'https://your-image.jpg' },
    { key: 'altText', label: 'Alt Text', type: 'text', placeholder: 'Image description' },
    { key: 'linkUrl', label: 'Click URL', type: 'url', placeholder: 'https://...' },
    { key: 'width', label: 'Width', type: 'text', placeholder: '100% or 400px' },
    { key: 'alignment', label: 'Alignment', type: 'select', options: [{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }] },
    { key: 'borderRadius', label: 'Rounded Corners', type: 'range', min: 0, max: 30, step: 2 },
    { key: 'padding', label: 'Padding', type: 'range', min: 0, max: 60, step: 4 },
  ],
  button: [
    { key: 'text', label: 'Button Text', type: 'text', placeholder: 'Get Started' },
    { key: 'url', label: 'Button URL', type: 'url', placeholder: 'https://...' },
    { key: 'bgColor', label: 'Button Color', type: 'color' },
    { key: 'textColor', label: 'Text Color', type: 'color' },
    { key: 'borderRadius', label: 'Corner Radius', type: 'range', min: 0, max: 30, step: 2 },
    { key: 'fontSize', label: 'Font Size', type: 'range', min: 12, max: 24, step: 1 },
    { key: 'alignment', label: 'Alignment', type: 'select', options: [{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }] },
    { key: 'padding', label: 'Padding', type: 'range', min: 0, max: 60, step: 4 },
  ],
  imageText: [
    { key: 'imageUrl', label: 'Image URL', type: 'url', placeholder: 'https://product-image.jpg' },
    { key: 'imagePosition', label: 'Image Side', type: 'select', options: [{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }] },
    { key: 'imageWidth', label: 'Image Width', type: 'select', options: [{ value: '30%', label: 'Small (30%)' }, { value: '40%', label: 'Medium (40%)' }, { value: '50%', label: 'Half (50%)' }] },
    { key: 'title', label: 'Title', type: 'text', placeholder: 'Product or Feature Name' },
    { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Describe the product or feature...' },
    { key: 'padding', label: 'Padding', type: 'range', min: 0, max: 60, step: 4 },
  ],
  box: [
    { key: 'layout', label: 'Layout', type: 'select', options: [{ value: '1col', label: '1 Box' }, { value: '2col', label: '2 Boxes' }, { value: '3col', label: '3 Boxes' }] },
    { key: 'title1', label: 'Box 1 Title', type: 'text', placeholder: 'Feature title' },
    { key: 'desc1', label: 'Box 1 Description', type: 'textarea', placeholder: 'Feature description...' },
    { key: 'bgColor1', label: 'Box 1 Background', type: 'color' },
    { key: 'title2', label: 'Box 2 Title', type: 'text', placeholder: 'Feature title' },
    { key: 'desc2', label: 'Box 2 Description', type: 'textarea', placeholder: 'Feature description...' },
    { key: 'bgColor2', label: 'Box 2 Background', type: 'color' },
    { key: 'title3', label: 'Box 3 Title', type: 'text', placeholder: 'Feature title' },
    { key: 'desc3', label: 'Box 3 Description', type: 'textarea', placeholder: 'Feature description...' },
    { key: 'bgColor3', label: 'Box 3 Background', type: 'color' },
    { key: 'borderColor', label: 'Left Border Color', type: 'color' },
    { key: 'titleColor', label: 'Title Color', type: 'color' },
    { key: 'textColor', label: 'Text Color', type: 'color' },
    { key: 'borderRadius', label: 'Corner Radius', type: 'range', min: 0, max: 20, step: 2 },
    { key: 'padding', label: 'Inner Padding', type: 'range', min: 8, max: 40, step: 4 },
    { key: 'margin', label: 'Outer Margin', type: 'range', min: 0, max: 40, step: 4 },
  ],
  divider: [
    { key: 'color', label: 'Color', type: 'color' },
    { key: 'thickness', label: 'Thickness', type: 'range', min: 1, max: 5, step: 1 },
    { key: 'style', label: 'Style', type: 'select', options: [{ value: 'solid', label: 'Solid' }, { value: 'dashed', label: 'Dashed' }, { value: 'dotted', label: 'Dotted' }] },
    { key: 'padding', label: 'Padding', type: 'range', min: 0, max: 40, step: 4 },
  ],
  spacer: [
    { key: 'height', label: 'Height (px)', type: 'range', min: 8, max: 80, step: 4 },
  ],
  signature: [
    { key: 'imageUrl', label: 'Photo URL', type: 'url', placeholder: 'https://your-photo.jpg' },
    { key: 'name', label: 'Full Name', type: 'text', placeholder: 'John Doe' },
    { key: 'jobTitle', label: 'Job Title', type: 'text', placeholder: 'Sales Manager' },
    { key: 'company', label: 'Company', type: 'text', placeholder: 'Your Company' },
    { key: 'phone', label: 'Phone', type: 'text', placeholder: '+1 234 567 8900' },
    { key: 'email', label: 'Email', type: 'text', placeholder: 'you@company.com' },
    { key: 'website', label: 'Website', type: 'url', placeholder: 'https://yoursite.com' },
  ],
};

function esc(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderBlockHtml(block: EditorBlock): string {
  const d = block.data;
  switch (block.type) {
    case 'logo': {
      const img = d.imageUrl
        ? `<img src="${esc(d.imageUrl)}" alt="Logo" width="${d.width}" style="display:inline-block;max-width:100%;height:auto">`
        : `<div style="display:inline-block;width:${d.width}px;height:60px;background:#e2e8f0;border-radius:8px;line-height:60px;color:#94a3b8;font-size:13px;text-align:center">[ Your Logo ]</div>`;
      const inner = d.linkUrl ? `<a href="${esc(d.linkUrl)}" style="text-decoration:none">${img}</a>` : img;
      return `<div style="padding:${d.padding}px 24px;text-align:${d.alignment};background-color:${d.bgColor}">${inner}</div>`;
    }
    case 'header':
      return `<div style="background-color:${d.bgColor};padding:${d.padding}px 24px;text-align:center;border-radius:8px 8px 0 0"><h1 style="color:${d.textColor};margin:0;font-size:28px;font-weight:700">${esc(d.title)}</h1>${d.subtitle ? `<p style="color:${d.subtitleColor};margin:8px 0 0;font-size:14px">${esc(d.subtitle)}</p>` : ''}</div>`;
    case 'text':
      return `<div style="padding:${d.padding}px 24px;overflow:hidden;word-wrap:break-word;overflow-wrap:break-word">${d.html}</div>`;
    case 'image': {
      const img = d.imageUrl
        ? `<img src="${esc(d.imageUrl)}" alt="${esc(d.altText)}" style="max-width:100%;width:${d.width};border-radius:${d.borderRadius}px;display:block;margin:0 auto">`
        : `<div style="width:100%;height:200px;background:#e2e8f0;border-radius:${d.borderRadius}px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:14px">[ Paste image URL in properties ]</div>`;
      const wrapped = d.linkUrl ? `<a href="${esc(d.linkUrl)}" style="text-decoration:none;display:block">${img}</a>` : img;
      return `<div style="padding:${d.padding}px 24px;text-align:${d.alignment}">${wrapped}</div>`;
    }
    case 'button':
      return `<div style="padding:${d.padding}px 24px;text-align:${d.alignment}"><a href="${esc(d.url || '#')}" style="display:inline-block;background-color:${d.bgColor};color:${d.textColor};padding:14px 32px;border-radius:${d.borderRadius}px;text-decoration:none;font-weight:600;font-size:${d.fontSize}px;mso-padding-alt:0;text-align:center">${esc(d.text)}</a></div>`;
    case 'imageText': {
      const imgSrc = d.imageUrl
        ? `<img src="${esc(d.imageUrl)}" alt="" style="width:100%;border-radius:8px;display:block">`
        : `<div style="background:#e2e8f0;border-radius:8px;height:160px;display:flex;align-items:center;justify-content:center"><span style="color:#94a3b8;font-size:13px">[ Image ]</span></div>`;
      const pad = d.imagePosition === 'right' ? 'left' : 'right';
      const imgTd = `<td width="${d.imageWidth}" style="vertical-align:top;padding-${pad}:16px">${imgSrc}</td>`;
      const textTd = `<td style="vertical-align:top"><h3 style="color:#1e293b;margin:0 0 8px;font-size:18px">${esc(d.title)}</h3><p style="color:#475569;margin:0;font-size:14px;line-height:1.5;word-wrap:break-word;overflow-wrap:break-word">${esc(d.description)}</p></td>`;
      const cells = d.imagePosition === 'right' ? textTd + imgTd : imgTd + textTd;
      return `<div style="padding:${d.padding}px 24px"><table width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed"><tr>${cells}</tr></table></div>`;
    }
    case 'box': {
      const boxStyle = (bg: string) => `background-color:${bg};border-radius:${d.borderRadius}px;padding:${d.padding}px;border-left:4px solid ${d.borderColor}`;
      const titleStyle = `color:${d.titleColor};margin:0 0 8px;font-size:16px;font-weight:700`;
      const descStyle = `color:${d.textColor};margin:0;font-size:14px;line-height:1.5;word-wrap:break-word;overflow-wrap:break-word`;
      const box1 = `<div style="${boxStyle(d.bgColor1 || '#f0fdf4')}"><h3 style="${titleStyle}">${esc(d.title1 || '')}</h3><p style="${descStyle}">${esc(d.desc1 || '')}</p></div>`;
      if (d.layout === '1col') {
        return `<div style="padding:${d.margin}px 24px">${box1}</div>`;
      }
      const box2 = `<div style="${boxStyle(d.bgColor2 || '#eff6ff')}"><h3 style="${titleStyle}">${esc(d.title2 || '')}</h3><p style="${descStyle}">${esc(d.desc2 || '')}</p></div>`;
      if (d.layout === '3col') {
        const box3 = `<div style="${boxStyle(d.bgColor3 || '#fef3c7')}"><h3 style="${titleStyle}">${esc(d.title3 || '')}</h3><p style="${descStyle}">${esc(d.desc3 || '')}</p></div>`;
        return `<div style="padding:${d.margin}px 24px"><table width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed"><tr><td width="31%" style="vertical-align:top">${box1}</td><td width="3%"></td><td width="31%" style="vertical-align:top">${box2}</td><td width="3%"></td><td width="31%" style="vertical-align:top">${box3}</td></tr></table></div>`;
      }
      return `<div style="padding:${d.margin}px 24px"><table width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed"><tr><td width="48%" style="vertical-align:top">${box1}</td><td width="4%"></td><td width="48%" style="vertical-align:top">${box2}</td></tr></table></div>`;
    }
    case 'divider':
      return `<div style="padding:${d.padding}px 24px"><hr style="border:none;border-top:${d.thickness}px ${d.style} ${d.color};margin:0"></div>`;
    case 'spacer':
      return `<div style="height:${d.height}px;line-height:${d.height}px;font-size:1px">&nbsp;</div>`;
    case 'signature': {
      const lines: string[] = [];
      if (d.name) lines.push(`<p style="margin:0;font-size:16px;font-weight:700;color:#1e293b">${esc(d.name)}</p>`);
      if (d.jobTitle) lines.push(`<p style="margin:2px 0 0;font-size:13px;color:#64748b">${esc(d.jobTitle)}</p>`);
      if (d.company) lines.push(`<p style="margin:2px 0 0;font-size:13px;font-weight:600;color:#475569">${esc(d.company)}</p>`);
      const contact: string[] = [];
      if (d.phone) contact.push(`<p style="margin:0;font-size:12px;color:#64748b">Phone: ${esc(d.phone)}</p>`);
      if (d.email) contact.push(`<p style="margin:0;font-size:12px;color:#64748b">Email: <a href="mailto:${esc(d.email)}" style="color:#3b82f6">${esc(d.email)}</a></p>`);
      if (d.website) contact.push(`<p style="margin:0;font-size:12px;color:#64748b">Web: <a href="${esc(d.website)}" style="color:#3b82f6">${esc(d.website)}</a></p>`);
      if (contact.length) lines.push(`<div style="margin-top:8px">${contact.join('')}</div>`);
      const imgCell = d.imageUrl ? `<td style="vertical-align:top;padding-right:16px"><img src="${esc(d.imageUrl)}" width="70" style="border-radius:50%;display:block" alt=""></td>` : '';
      if (!lines.length) lines.push('<p style="margin:0;font-size:13px;color:#94a3b8;font-style:italic">Fill in your signature details in the properties panel</p>');
      return `<div style="padding:24px;border-top:1px solid #e2e8f0"><table cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif"><tr>${imgCell}<td style="vertical-align:top">${lines.join('')}</td></tr></table></div>`;
    }
    default:
      return '';
  }
}

const FONT_SIZES = [
  { value: '1', label: '10px' },
  { value: '2', label: '13px' },
  { value: '3', label: '16px' },
  { value: '4', label: '18px' },
  { value: '5', label: '24px' },
  { value: '6', label: '32px' },
  { value: '7', label: '48px' },
];

function HtmlEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const colorRef = useRef<HTMLInputElement>(null);
  const bgColorRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = value;
  }, []);

  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const btnClass = 'rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors';
  const sep = <span className="w-px bg-gray-200 mx-0.5" />;

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-2 p-1.5 bg-gray-50 rounded-lg border border-gray-200">
        {/* Text style */}
        <button type="button" onClick={() => exec('bold')} className={btnClass} title="Bold"><b>B</b></button>
        <button type="button" onClick={() => exec('italic')} className={btnClass} title="Italic"><i>I</i></button>
        <button type="button" onClick={() => exec('underline')} className={btnClass} title="Underline"><u>U</u></button>
        <button type="button" onClick={() => exec('strikeThrough')} className={btnClass} title="Strikethrough"><s>S</s></button>
        {sep}
        {/* Font size */}
        <select
          onChange={(e) => { if (e.target.value) exec('fontSize', e.target.value); e.target.value = ''; }}
          defaultValue=""
          className="rounded px-1 py-1 text-xs font-medium text-gray-600 bg-transparent hover:bg-gray-200 transition-colors border-none outline-none cursor-pointer"
          title="Font Size"
        >
          <option value="" disabled>Size</option>
          {FONT_SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {sep}
        {/* Text color */}
        <div className="relative">
          <button type="button" onClick={() => colorRef.current?.click()} className={btnClass} title="Text Color">
            <span style={{ borderBottom: '3px solid #ef4444' }}>A</span>
          </button>
          <input ref={colorRef} type="color" className="absolute opacity-0 w-0 h-0" onChange={(e) => exec('foreColor', e.target.value)} />
        </div>
        <div className="relative">
          <button type="button" onClick={() => bgColorRef.current?.click()} className={btnClass} title="Highlight Color">
            <span className="px-0.5 bg-yellow-200 rounded-sm text-xs">A</span>
          </button>
          <input ref={bgColorRef} type="color" defaultValue="#ffff00" className="absolute opacity-0 w-0 h-0" onChange={(e) => exec('hiliteColor', e.target.value)} />
        </div>
        {sep}
        {/* Headings */}
        <button type="button" onClick={() => exec('formatBlock', '<h1>')} className={btnClass} title="Heading 1">H1</button>
        <button type="button" onClick={() => exec('formatBlock', '<h2>')} className={btnClass} title="Heading 2">H2</button>
        <button type="button" onClick={() => exec('formatBlock', '<h3>')} className={btnClass} title="Heading 3">H3</button>
        <button type="button" onClick={() => exec('formatBlock', '<p>')} className={btnClass} title="Paragraph">P</button>
        {sep}
        {/* Alignment */}
        <button type="button" onClick={() => exec('justifyLeft')} className={btnClass} title="Align Left">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M3 6h18M3 12h12M3 18h16"/></svg>
        </button>
        <button type="button" onClick={() => exec('justifyCenter')} className={btnClass} title="Align Center">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M3 6h18M6 12h12M4 18h16"/></svg>
        </button>
        <button type="button" onClick={() => exec('justifyRight')} className={btnClass} title="Align Right">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M3 6h18M9 12h12M5 18h16"/></svg>
        </button>
        {sep}
        {/* Lists */}
        <button type="button" onClick={() => exec('insertUnorderedList')} className={btnClass} title="Bullet List">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M4 6h.01M4 12h.01M4 18h.01M8 6h13M8 12h13M8 18h13"/></svg>
        </button>
        <button type="button" onClick={() => exec('insertOrderedList')} className={btnClass} title="Numbered List">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M4 6h.01M4 12h.01M4 18h.01M8 6h13M8 12h13M8 18h13"/><text x="2" y="8" fontSize="7" fill="currentColor" stroke="none">1</text></svg>
        </button>
        <button type="button" onClick={() => exec('indent')} className={btnClass} title="Indent">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M3 6h18M9 12h12M9 18h12M3 11l3 1.5L3 14"/></svg>
        </button>
        <button type="button" onClick={() => exec('outdent')} className={btnClass} title="Outdent">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M3 6h18M9 12h12M9 18h12M6 11l-3 1.5L6 14"/></svg>
        </button>
        {sep}
        {/* Links & extras */}
        <button type="button" onClick={() => exec('formatBlock', '<blockquote>')} className={btnClass} title="Quote">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/></svg>
        </button>
        <button type="button" onClick={() => exec('insertHorizontalRule')} className={btnClass} title="Horizontal Line">&#8213;</button>
        <button type="button" onClick={() => { const u = prompt('Enter URL:'); if (u) exec('createLink', u); }} className={btnClass} title="Insert Link">Link</button>
        <button type="button" onClick={() => exec('unlink')} className={btnClass} title="Remove Link">Unlink</button>
        {sep}
        <button type="button" onClick={() => exec('removeFormat')} className={btnClass} title="Clear Formatting">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={() => { if (ref.current) onChange(ref.current.innerHTML); }}
        onBlur={() => { if (ref.current) onChange(ref.current.innerHTML); }}
        className="min-h-[140px] max-h-[300px] overflow-y-auto p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 leading-relaxed"
      />
    </div>
  );
}

function PropertiesPanel({ block, onChange }: { block: EditorBlock; onChange: (key: string, value: any) => void }) {
  const props = BLOCK_PROPS[block.type];
  if (!props) return null;

  const layout = block.data.layout;
  const visibleProps = block.type === 'box'
    ? props.filter((p) => {
        if (layout === '1col') return !p.key.match(/^(title[23]|desc[23]|bgColor[23])$/);
        if (layout === '2col') return !p.key.match(/^(title3|desc3|bgColor3)$/);
        return true;
      })
    : props;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-blue-100 text-blue-600 text-xs font-bold">
          {BLOCK_LABELS[block.type]?.charAt(0)}
        </span>
        <span className="text-sm font-semibold text-gray-700">{BLOCK_LABELS[block.type]} Properties</span>
      </div>
      {visibleProps.map((p) => (
        <div key={p.key}>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">{p.label}</label>
          {p.type === 'text' && (
            <input
              type="text"
              value={block.data[p.key] || ''}
              onChange={(e) => onChange(p.key, e.target.value)}
              placeholder={p.placeholder}
              className="w-full h-9 rounded-lg border border-gray-200 px-3 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          )}
          {p.type === 'textarea' && (
            <textarea
              value={block.data[p.key] || ''}
              onChange={(e) => onChange(p.key, e.target.value)}
              placeholder={p.placeholder}
              rows={3}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-y"
            />
          )}
          {p.type === 'url' && (
            <input
              type="url"
              value={block.data[p.key] || ''}
              onChange={(e) => onChange(p.key, e.target.value)}
              placeholder={p.placeholder}
              className="w-full h-9 rounded-lg border border-gray-200 px-3 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          )}
          {p.type === 'color' && (
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={block.data[p.key] || '#000000'}
                onChange={(e) => onChange(p.key, e.target.value)}
                className="h-9 w-12 rounded border border-gray-200 cursor-pointer"
              />
              <input
                type="text"
                value={block.data[p.key] || ''}
                onChange={(e) => onChange(p.key, e.target.value)}
                className="flex-1 h-9 rounded-lg border border-gray-200 px-3 text-sm text-gray-700 font-mono focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          )}
          {p.type === 'range' && (
            <div className="flex items-center gap-3">
              <input
                type="range"
                value={block.data[p.key] ?? p.min ?? 0}
                onChange={(e) => onChange(p.key, Number(e.target.value))}
                min={p.min} max={p.max} step={p.step}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <span className="text-xs text-gray-500 font-mono w-8 text-right">{block.data[p.key] ?? p.min}</span>
            </div>
          )}
          {p.type === 'select' && (
            <select
              value={block.data[p.key] || ''}
              onChange={(e) => onChange(p.key, e.target.value)}
              className="w-full h-9 rounded-lg border border-gray-200 px-3 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              {p.options?.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}
          {p.type === 'html' && (
            <HtmlEditor
              key={block.id}
              value={block.data[p.key] || ''}
              onChange={(html) => onChange(p.key, html)}
            />
          )}
        </div>
      ))}
    </div>
  );
}

const PALETTE_ORDER: BlockType[] = ['logo', 'header', 'text', 'image', 'button', 'imageText', 'box', 'divider', 'spacer', 'signature'];

const PALETTE_ICONS: Record<BlockType, React.ReactNode> = {
  logo: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  header: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" /></svg>,
  text: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h10" /></svg>,
  image: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  button: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" /></svg>,
  imageText: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 5h7v7H4V5zm9 0h7M13 9h7M13 13h7M4 17h16" /></svg>,
  box: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" /><path strokeLinecap="round" d="M8 9h8M8 13h5" /></svg>,
  divider: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 12h16" /></svg>,
  spacer: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16M4 16h16" /></svg>,
  signature: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
};

const INITIAL_BLOCKS: EditorBlock[] = [
  { id: 'i-1', type: 'header', data: BLOCK_DEFAULTS.header() },
  { id: 'i-2', type: 'text', data: { html: '<h2 style="color:#1e293b;margin:0 0 12px;font-size:20px">Hello {{firstName}},</h2><p style="color:#475569;margin:0;font-size:15px;line-height:1.6">Thank you for your interest. We have something exciting to share with you today.</p>', padding: 24 } },
  { id: 'i-3', type: 'button', data: BLOCK_DEFAULTS.button() },
  { id: 'i-4', type: 'divider', data: BLOCK_DEFAULTS.divider() },
  { id: 'i-5', type: 'signature', data: BLOCK_DEFAULTS.signature() },
];

export default function TemplateEditor({ templateId, onSaved, onCancel }: TemplateEditorProps) {
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('general');
  const [blocks, setBlocks] = useState<EditorBlock[]>(INITIAL_BLOCKS);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showTestEmail, setShowTestEmail] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [fontFamily, setFontFamily] = useState('Arial, Helvetica, sans-serif');
  const htmlFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!templateId) return;
    fetch(`/api/templates/${templateId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.name) setName(data.name);
        if (data.subject) setSubject(data.subject);
        if (data.category) setCategory(data.category);
        if (data.jsonLayout) {
          try {
            const parsed = JSON.parse(data.jsonLayout);
            if (Array.isArray(parsed) && parsed.length > 0) {
              if (parsed[0].data) {
                setBlocks(parsed);
              } else if (parsed[0].content) {
                setBlocks(parsed.map((old: any) => ({
                  id: old.id || uid(),
                  type: 'text' as BlockType,
                  data: { html: old.content, padding: 0 },
                })));
              }
            }
          } catch { /* ignore */ }
        } else if (data.htmlContent) {
          let html = data.htmlContent as string;
          html = html.replace(new RegExp('<!DOCTYPE[^>]*>', 'i'), '');
          html = html.replace(new RegExp('</?html[^>]*>', 'gi'), '');
          html = html.replace(new RegExp('<head[\\s\\S]*?</head>', 'gi'), '');
          html = html.replace(new RegExp('</?body[^>]*>', 'gi'), '');
          html = html.replace(new RegExp('<div style="max-width:600px[^"]*">', 'i'), '');
          html = html.trim();
          if (html.endsWith('</div>')) html = html.slice(0, -6);
          setBlocks([{ id: uid(), type: 'text', data: { html: html.trim(), padding: 0 } }]);
        }
      })
      .catch(console.error);
  }, [templateId]);

  const getFullHtml = useCallback(() => {
    const body = blocks.map((b) => renderBlockHtml(b)).join('\n');
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background-color:#f1f5f9;font-family:${fontFamily}"><div style="max-width:600px;margin:0 auto;background-color:#ffffff;overflow:hidden;box-sizing:border-box">${body}</div></body></html>`;
  }, [blocks, fontFamily]);

  const addBlock = (type: BlockType) => {
    const b: EditorBlock = { id: uid(), type, data: BLOCK_DEFAULTS[type]() };
    setBlocks((prev) => [...prev, b]);
    setActiveId(b.id);
  };

  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const duplicateBlock = (id: string) => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx < 0) return prev;
      const copy: EditorBlock = { id: uid(), type: prev[idx].type, data: { ...prev[idx].data } };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  };

  const moveBlock = (idx: number, dir: -1 | 1) => {
    const ni = idx + dir;
    if (ni < 0 || ni >= blocks.length) return;
    setBlocks((prev) => {
      const next = [...prev];
      [next[idx], next[ni]] = [next[ni], next[idx]];
      return next;
    });
  };

  const updateBlockData = (id: string, key: string, value: any) => {
    setBlocks((prev) => prev.map((b) => b.id === id ? { ...b, data: { ...b.data, [key]: value } } : b));
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    setBlocks((prev) => {
      const next = [...prev];
      const [d] = next.splice(dragIdx, 1);
      next.splice(idx, 0, d);
      return next;
    });
    setDragIdx(idx);
  };

  const handleSave = async () => {
    if (!name.trim() || !subject.trim()) {
      alert('Please enter a template name and subject line.');
      return;
    }
    setSaving(true);
    try {
      const url = templateId ? `/api/templates/${templateId}` : '/api/templates';
      const res = await fetch(url, {
        method: templateId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, subject, category,
          htmlContent: getFullHtml(),
          jsonLayout: JSON.stringify(blocks),
        }),
      });
      if (res.ok) onSaved?.();
      else {
        const d = await res.json();
        alert(d.error || 'Failed to save');
      }
    } catch {
      alert('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (!testEmail.trim()) return;
    setTestSending(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/templates/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: testEmail.trim(),
          subject: subject || 'Test Email - Template Preview',
          htmlContent: getFullHtml(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setTestResult({ type: 'success', message: 'Test email sent! Check your inbox.' });
      } else {
        setTestResult({ type: 'error', message: data.error || 'Failed to send test email' });
      }
    } catch {
      setTestResult({ type: 'error', message: 'Network error. Please try again.' });
    } finally {
      setTestSending(false);
    }
  };

  const handleImportHtml = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      let html = ev.target?.result as string;
      html = html.replace(/<!DOCTYPE[^>]*>/i, '');
      html = html.replace(/<\/?html[^>]*>/gi, '');
      html = html.replace(/<head[\s\S]*?<\/head>/gi, '');
      html = html.replace(/<\/?body[^>]*>/gi, '');
      html = html.trim();
      const b: EditorBlock = { id: uid(), type: 'text', data: { html, padding: 0 } };
      setBlocks([b]);
      setActiveId(b.id);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const activeBlock = blocks.find((b) => b.id === activeId) || null;

  return (
    <div className="flex flex-col h-full min-h-[600px]">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <input type="text" placeholder="Template name..." value={name} onChange={(e) => setName(e.target.value)}
            className="h-9 w-48 rounded-lg border border-gray-200 px-3 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" />
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="h-9 rounded-lg border border-gray-200 px-3 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100">
            <option value="general">General</option>
            <option value="welcome">Welcome</option>
            <option value="promotional">Promotional</option>
            <option value="followup">Follow-up</option>
            <option value="newsletter">Newsletter</option>
            <option value="transactional">Transactional</option>
          </select>
          <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}
            className="h-9 rounded-lg border border-gray-200 px-3 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" title="Email font">
            <option value="Arial, Helvetica, sans-serif">Arial</option>
            <option value="'Helvetica Neue', Helvetica, Arial, sans-serif">Helvetica</option>
            <option value="Georgia, 'Times New Roman', Times, serif">Georgia</option>
            <option value="'Times New Roman', Times, serif">Times New Roman</option>
            <option value="Verdana, Geneva, sans-serif">Verdana</option>
            <option value="Tahoma, Geneva, sans-serif">Tahoma</option>
            <option value="'Trebuchet MS', Helvetica, sans-serif">Trebuchet MS</option>
            <option value="'Lucida Sans', 'Lucida Grande', sans-serif">Lucida Sans</option>
            <option value="'Courier New', Courier, monospace">Courier New</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input ref={htmlFileRef} type="file" accept=".html,.htm" onChange={handleImportHtml} className="hidden" />
          <button onClick={() => htmlFileRef.current?.click()}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors" title="Import HTML file">
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              Import HTML
            </span>
          </button>
          <button onClick={() => setShowPreview(true)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors" title="Preview email">
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              Preview
            </span>
          </button>
          <button onClick={() => { setShowTestEmail(true); setTestResult(null); }}
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition-colors" title="Send test email">
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
              Send Test
            </span>
          </button>
          {onCancel && (
            <button onClick={onCancel} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
          )}
          <button onClick={handleSave} disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-5 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50 transition-colors shadow-sm">
            {saving && <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
            Save Template
          </button>
        </div>
      </div>

      {/* Subject line */}
      <div className="border-b border-gray-200 bg-gray-50 px-6 py-3">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-500 whitespace-nowrap">Subject:</label>
          <input type="text" placeholder="Enter email subject line..." value={subject} onChange={(e) => setSubject(e.target.value)}
            className="h-9 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" />
        </div>
      </div>

      {/* Main editor */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Block palette */}
        <div className="w-52 flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto">
          <div className="p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Add Blocks</p>
            <div className="space-y-0.5">
              {PALETTE_ORDER.map((type) => (
                <button key={type} onClick={() => addBlock(type)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-700 transition-colors">
                  <span className="text-gray-400">{PALETTE_ICONS[type]}</span>
                  {BLOCK_LABELS[type]}
                </button>
              ))}
            </div>
          </div>
          <div className="border-t border-gray-200 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Merge Tags</p>
            <p className="text-[10px] text-gray-400 mb-2">Click to copy, then paste in text blocks</p>
            <div className="space-y-0.5 text-xs">
              {['{{firstName}}', '{{lastName}}', '{{company}}', '{{email}}', '{{unsubscribeUrl}}'].map((v) => (
                <button key={v} onClick={() => navigator.clipboard.writeText(v)}
                  className="block w-full text-left rounded px-2 py-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 font-mono transition-colors" title="Click to copy">
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Center: Visual canvas */}
        <div className="flex-1 overflow-y-auto bg-gray-100 p-6">
          <div className="mx-auto max-w-[600px] bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {blocks.length === 0 && (
              <div className="py-16 text-center text-gray-400">
                <svg className="mx-auto h-10 w-10 mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <p className="text-sm font-medium">No blocks yet</p>
                <p className="text-xs mt-1">Click blocks on the left panel to add them</p>
              </div>
            )}
            {blocks.map((block, idx) => (
              <div
                key={block.id}
                draggable
                onDragStart={() => setDragIdx(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={() => setDragIdx(null)}
                onClick={() => setActiveId(block.id)}
                className={`group relative transition-all cursor-pointer ${
                  activeId === block.id
                    ? 'ring-2 ring-blue-400 ring-inset'
                    : dragIdx === idx
                    ? 'opacity-50 ring-2 ring-blue-200 ring-inset'
                    : 'hover:ring-1 hover:ring-gray-300 hover:ring-inset'
                }`}
              >
                {/* Block controls */}
                <div className={`absolute -top-3 right-2 flex items-center gap-0.5 z-10 ${activeId === block.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                  <span className="rounded-l bg-blue-500 px-2 py-0.5 text-[10px] font-medium text-white select-none">
                    {BLOCK_LABELS[block.type]}
                  </span>
                  <button onClick={(e) => { e.stopPropagation(); moveBlock(idx, -1); }} disabled={idx === 0}
                    className="bg-white border border-gray-200 p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 shadow-sm" title="Move up">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); moveBlock(idx, 1); }} disabled={idx === blocks.length - 1}
                    className="bg-white border border-gray-200 p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 shadow-sm" title="Move down">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); duplicateBlock(block.id); }}
                    className="bg-white border border-gray-200 p-0.5 text-gray-400 hover:text-blue-500 shadow-sm" title="Duplicate">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); removeBlock(block.id); }}
                    className="rounded-r bg-white border border-gray-200 p-0.5 text-gray-400 hover:text-red-500 shadow-sm" title="Delete">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
                {/* Rendered block preview */}
                <div className="pointer-events-none template-preview" dangerouslySetInnerHTML={{ __html: renderBlockHtml(block) }} />
              </div>
            ))}
          </div>
        </div>

        {/* Right: Properties panel */}
        <div className="w-80 flex-shrink-0 border-l border-gray-200 bg-white overflow-y-auto">
          {activeBlock ? (
            <div className="p-4">
              <PropertiesPanel
                key={activeBlock.id}
                block={activeBlock}
                onChange={(key, value) => updateBlockData(activeBlock.id, key, value)}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <svg className="h-12 w-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
              </svg>
              <p className="text-sm font-medium text-gray-500">Click a block to edit</p>
              <p className="text-xs text-gray-400 mt-1">Select any block in the center to see its properties here</p>
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowPreview(false)}>
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Email Preview</h3>
                {subject && <p className="text-sm text-gray-500 mt-0.5">Subject: {subject}</p>}
              </div>
              <button onClick={() => setShowPreview(false)} className="rounded-lg p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-gray-100">
              <div className="mx-auto max-w-[600px] bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <iframe
                  srcDoc={getFullHtml()}
                  className="w-full border-0"
                  style={{ minHeight: '500px', height: '600px' }}
                  title="Email Preview"
                  sandbox="allow-same-origin"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send Test Email Modal */}
      {showTestEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowTestEmail(false)}>
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Send Test Email</h3>
              <button onClick={() => setShowTestEmail(false)} className="rounded-lg p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Recipient Email</label>
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendTest(); }}
                  autoFocus
                />
                <p className="mt-1.5 text-xs text-gray-400">The email will be sent using your configured SMTP settings</p>
              </div>
              {testResult && (
                <div className={`rounded-lg px-4 py-3 text-sm ${testResult.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                  {testResult.message}
                </div>
              )}
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowTestEmail(false)} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={handleSendTest} disabled={testSending || !testEmail.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm">
                  {testSending && <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                  {testSending ? 'Sending...' : 'Send Test'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
