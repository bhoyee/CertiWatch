"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TiptapImage from "@tiptap/extension-image";
import TiptapLink from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import DOMPurify from "dompurify";

export function sanitizeHtml(html: string): string {
  if (typeof window === "undefined") return "";
  return DOMPurify.sanitize(html, { ADD_ATTR: ["target", "rel"] });
}

// Shared prose styling for both the live editor and read-only rendered content, defined once via
// Next.js's built-in styled-jsx (global, deduped by content hash) rather than a Tailwind
// typography plugin - this is the only place in the app that renders arbitrary rich text.
function RichTextStyles() {
  return (
    <style jsx global>{`
      .cw-richtext {
        color: #1e293b;
        font-size: 0.875rem;
        line-height: 1.65;
        word-break: break-word;
      }
      .cw-richtext p {
        margin: 0 0 0.6em;
      }
      .cw-richtext p:last-child {
        margin-bottom: 0;
      }
      .cw-richtext ul,
      .cw-richtext ol {
        margin: 0.25em 0 0.6em 1.35em;
      }
      .cw-richtext ul {
        list-style: disc;
      }
      .cw-richtext ol {
        list-style: decimal;
      }
      .cw-richtext li {
        margin: 0.15em 0;
      }
      .cw-richtext a {
        color: #4f46e5;
        text-decoration: underline;
      }
      .cw-richtext strong {
        font-weight: 600;
        color: #0f172a;
      }
      .cw-richtext blockquote {
        border-left: 3px solid #cbd5e1;
        padding-left: 0.75em;
        color: #475569;
        margin: 0.5em 0;
      }
      .cw-richtext code {
        background: #f1f5f9;
        padding: 0.1em 0.4em;
        border-radius: 0.3em;
        font-size: 0.85em;
      }
      .cw-richtext img {
        max-width: 100%;
        border-radius: 0.6em;
        margin: 0.5em 0;
        display: block;
        border: 1px solid #e2e8f0;
      }
      .cw-richtext h2 {
        font-size: 1.1rem;
        font-weight: 600;
        margin: 0.6em 0 0.3em;
        color: #0f172a;
      }
      .cw-richtext h3 {
        font-size: 1rem;
        font-weight: 600;
        margin: 0.5em 0 0.25em;
        color: #0f172a;
      }
      .cw-richtext-editable {
        outline: none;
      }
      .cw-richtext-editable p.is-editor-empty:first-child::before {
        content: attr(data-placeholder);
        color: #94a3b8;
        float: left;
        height: 0;
        pointer-events: none;
      }
    `}</style>
  );
}

export function RichTextContent({ html, className = "" }: { html: string; className?: string }) {
  return (
    <>
      <div className={`cw-richtext ${className}`} dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />
      <RichTextStyles />
    </>
  );
}

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  onUploadImage: (file: File) => Promise<string>;
  placeholder?: string;
  disabled?: boolean;
  minHeightClassName?: string;
};

export function RichTextEditor({
  value,
  onChange,
  onUploadImage,
  placeholder,
  disabled,
  minHeightClassName = "min-h-[130px]"
}: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      TiptapLink.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } }),
      TiptapImage,
      Placeholder.configure({ placeholder: placeholder ?? "Write a description..." })
    ],
    content: value,
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: `cw-richtext cw-richtext-editable px-3 py-2 ${minHeightClassName}`
      }
    }
  });

  // Lets the parent reset the editor (e.g. clearing the form after a successful submit) without
  // fighting TipTap's own internal state on every keystroke.
  useEffect(() => {
    if (!editor) return;
    if (value === editor.getHTML()) return;
    if (!value && editor.isEmpty) return;
    editor.commands.setContent(value || "", { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  const insertImage = useCallback(
    async (file: File) => {
      if (!editor) return;
      setUploading(true);
      setUploadError(null);
      try {
        const url = await onUploadImage(file);
        editor.chain().focus().setImage({ src: url, alt: file.name }).run();
      } catch (err: any) {
        setUploadError(err?.message ?? "Failed to upload image");
      } finally {
        setUploading(false);
      }
    },
    [editor, onUploadImage]
  );

  const setLink = useCallback(() => {
    if (!editor) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", previous ?? "https://");
    if (url === null) return;
    if (url.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }, [editor]);

  if (!editor) {
    return <div className={`rounded-lg border border-slate-200 bg-slate-50 ${minHeightClassName}`} />;
  }

  return (
    <div
      className={`overflow-hidden rounded-lg border border-slate-200 bg-white transition focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 ${
        disabled ? "opacity-60" : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-1.5 py-1">
        <ToolbarButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <ToolbarIcon name="bold" />
        </ToolbarButton>
        <ToolbarButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <ToolbarIcon name="italic" />
        </ToolbarButton>
        <ToolbarButton label="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <ToolbarIcon name="strike" />
        </ToolbarButton>
        <Divider />
        <ToolbarButton label="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <ToolbarIcon name="bulletList" />
        </ToolbarButton>
        <ToolbarButton label="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ToolbarIcon name="orderedList" />
        </ToolbarButton>
        <ToolbarButton label="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <ToolbarIcon name="quote" />
        </ToolbarButton>
        <Divider />
        <ToolbarButton label="Link" active={editor.isActive("link")} onClick={setLink}>
          <ToolbarIcon name="link" />
        </ToolbarButton>
        <ToolbarButton label="Insert image" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          <ToolbarIcon name="image" />
        </ToolbarButton>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void insertImage(file);
            e.target.value = "";
          }}
        />
        <div className="ml-auto flex items-center gap-0.5">
          <ToolbarButton label="Undo" onClick={() => editor.chain().focus().undo().run()}>
            <ToolbarIcon name="undo" />
          </ToolbarButton>
          <ToolbarButton label="Redo" onClick={() => editor.chain().focus().redo().run()}>
            <ToolbarIcon name="redo" />
          </ToolbarButton>
        </div>
      </div>
      {uploading && <div className="border-b border-slate-100 bg-indigo-50 px-3 py-1 text-xs text-indigo-700">Uploading image...</div>}
      {uploadError && <div className="border-b border-rose-100 bg-rose-50 px-3 py-1 text-xs text-rose-700">{uploadError}</div>}
      <EditorContent editor={editor} />
      <RichTextStyles />
    </div>
  );
}

function ToolbarButton({
  children,
  label,
  active,
  disabled,
  onClick
}: {
  children: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={!!active}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-md transition disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? "bg-indigo-100 text-indigo-700" : "text-slate-600 hover:bg-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="mx-1 h-5 w-px shrink-0 bg-slate-200" />;
}

type ToolbarIconName = "bold" | "italic" | "strike" | "bulletList" | "orderedList" | "quote" | "link" | "image" | "undo" | "redo";

function ToolbarIcon({ name }: { name: ToolbarIconName }) {
  const common = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, className: "h-4 w-4" };
  switch (name) {
    case "bold":
      return (
        <svg {...common}>
          <path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z" />
        </svg>
      );
    case "italic":
      return (
        <svg {...common}>
          <path d="M10 5h7M7 19h7M13 5 11 19" />
        </svg>
      );
    case "strike":
      return (
        <svg {...common}>
          <path d="M5 12h14" />
          <path d="M8 7c0-1.5 1.8-2.5 4-2.5s4 1 4 2.3M8 17c0 1.5 1.8 2.5 4 2.5s4-1 4-2.5" />
        </svg>
      );
    case "bulletList":
      return (
        <svg {...common}>
          <circle cx="4.5" cy="6" r="1" fill="currentColor" stroke="none" />
          <circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="4.5" cy="18" r="1" fill="currentColor" stroke="none" />
          <path d="M9 6h11M9 12h11M9 18h11" />
        </svg>
      );
    case "orderedList":
      return (
        <svg {...common}>
          <path d="M9 6h11M9 12h11M9 18h11" />
          <path d="M4.5 5.5v3M4.5 5.5h-1M4.5 8.5h1M4 12.5h1.5v1.5H4v1h1.5M4 18h1.5l-1.5 1.5H5.5" />
        </svg>
      );
    case "quote":
      return (
        <svg {...common}>
          <path d="M7 8c-1.7 0-3 1.3-3 3v5h5v-5H7c0-1.1.9-2 2-2z" />
          <path d="M16 8c-1.7 0-3 1.3-3 3v5h5v-5h-2c0-1.1.9-2 2-2z" />
        </svg>
      );
    case "link":
      return (
        <svg {...common}>
          <path d="M9.5 14.5 14.5 9.5" />
          <path d="M11 6.5 12.6 4.9a3.5 3.5 0 0 1 5 5L16 11.5" />
          <path d="M13 17.5 11.4 19.1a3.5 3.5 0 0 1-5-5L8 12.5" />
        </svg>
      );
    case "image":
      return (
        <svg {...common}>
          <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
          <circle cx="8.5" cy="9.5" r="1.5" fill="currentColor" stroke="none" />
          <path d="m4 17 5-5 3.5 3.5L16 12l4 4" />
        </svg>
      );
    case "undo":
      return (
        <svg {...common}>
          <path d="M4 10h9a5 5 0 0 1 0 10h-2" />
          <path d="M8 6 4 10l4 4" />
        </svg>
      );
    case "redo":
      return (
        <svg {...common}>
          <path d="M20 10h-9a5 5 0 0 0 0 10h2" />
          <path d="m16 6 4 4-4 4" />
        </svg>
      );
  }
}
