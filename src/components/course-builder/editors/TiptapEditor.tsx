"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Youtube from "@tiptap/extension-youtube";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { uploadLibraryFileToBlob } from "@/lib/library/upload-client";

export type TiptapEditorHandle = {
  getContent: () => { json: unknown; html: string } | null;
};

function youtubeIdFromUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (url.hostname.includes("youtu.be")) {
      return url.pathname.replace(/^\//, "").split("/")[0] || null;
    }
    if (url.hostname.includes("youtube.com")) {
      if (url.pathname.startsWith("/embed/")) {
        return url.pathname.split("/")[2] || null;
      }
      if (url.pathname.startsWith("/shorts/")) {
        return url.pathname.split("/")[2] || null;
      }
      return url.searchParams.get("v");
    }
  } catch {
    // fall through
  }
  return /^[\w-]{11}$/.test(raw.trim()) ? raw.trim() : null;
}

export const TiptapEditor = forwardRef<
  TiptapEditorHandle,
  {
    content: unknown;
    onChange: (json: unknown, html: string) => void;
    placeholder?: string;
  }
>(function TiptapEditor(
  { content, onChange, placeholder = "Write lesson content…" },
  ref,
) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadImageRef = useRef<(file: File) => Promise<void>>(async () => {});
  const [uploading, setUploading] = useState(false);
  const [toolbarError, setToolbarError] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Placeholder.configure({ placeholder }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        HTMLAttributes: {
          class: "tiptap-link",
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      Image.configure({
        allowBase64: false,
        HTMLAttributes: {
          class: "tiptap-image",
        },
      }),
      Youtube.configure({
        controls: true,
        nocookie: true,
        width: 640,
        height: 360,
        HTMLAttributes: {
          class: "tiptap-youtube",
        },
      }),
    ],
    content: content && typeof content === "object" ? content : undefined,
    immediatelyRender: false,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getJSON(), ed.getHTML());
    },
    onBlur: ({ editor: ed }) => {
      onChange(ed.getJSON(), ed.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "lesson-content tiptap-editor-body min-h-[220px] px-3 py-2 focus:outline-none",
      },
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of items) {
          if (item.type.startsWith("image/")) {
            event.preventDefault();
            const file = item.getAsFile();
            if (file) void uploadImageRef.current(file);
            return true;
          }
        }
        return false;
      },
      handleDrop: (_view, event) => {
        const files = event.dataTransfer?.files;
        if (!files?.length) return false;
        const image = [...files].find((f) => f.type.startsWith("image/"));
        if (!image) return false;
        event.preventDefault();
        void uploadImageRef.current(image);
        return true;
      },
    },
  });

  const uploadImageFile = useCallback(
    async (file: File) => {
      if (!editor) return;
      setToolbarError("");
      setUploading(true);
      try {
        const uploaded = await uploadLibraryFileToBlob(file);
        editor
          .chain()
          .focus()
          .setImage({ src: uploaded.blobUrl, alt: uploaded.filename })
          .run();
      } catch (err) {
        setToolbarError(err instanceof Error ? err.message : "Image upload failed");
      } finally {
        setUploading(false);
      }
    },
    [editor],
  );

  useEffect(() => {
    uploadImageRef.current = uploadImageFile;
  }, [uploadImageFile]);

  useImperativeHandle(ref, () => ({
    getContent: () => {
      if (!editor) return null;
      // Plain clones only — TipTap objects must not cross the Server Action boundary.
      const json = JSON.parse(JSON.stringify(editor.getJSON())) as unknown;
      return { json, html: editor.getHTML() };
    },
  }));

  useEffect(() => {
    if (!editor) return;
    const next =
      content && typeof content === "object"
        ? content
        : { type: "doc", content: [{ type: "paragraph" }] };
    const current = editor.getJSON();
    if (JSON.stringify(current) !== JSON.stringify(next)) {
      editor.commands.setContent(next as object, { emitUpdate: false });
    }
  }, [content, editor]);

  if (!editor) {
    return <div className="min-h-[220px] rounded-lg border bg-storm-light-grey/30" />;
  }

  const ed = editor;

  function setLink() {
    setToolbarError("");
    const previous = ed.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", previous ?? "https://");
    if (url === null) return;
    const trimmed = url.trim();
    if (!trimmed) {
      ed.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    ed.chain().focus().extendMarkRange("link").setLink({ href: trimmed }).run();
  }

  function setYoutube() {
    setToolbarError("");
    const raw = window.prompt("YouTube URL or video ID");
    if (!raw) return;
    const id = youtubeIdFromUrl(raw);
    if (!id) {
      setToolbarError("Enter a valid YouTube URL (watch, youtu.be, or embed).");
      return;
    }
    ed.commands.setYoutubeVideo({
      src: `https://www.youtube.com/watch?v=${id}`,
    });
  }

  function setIframeEmbed() {
    setToolbarError("");
    const raw = window.prompt("Embed URL (https://…)");
    if (!raw) return;
    let href = raw.trim();
    if (!/^https?:\/\//i.test(href)) href = `https://${href}`;
    try {
      new URL(href);
    } catch {
      setToolbarError("Enter a valid https URL for the embed.");
      return;
    }
    const safeHref = href.replace(/"/g, "&quot;");
    const safeText = href.replace(/</g, "&lt;");
    ed.chain()
      .focus()
      .insertContent(
        `<p><a href="${safeHref}" target="_blank" rel="noopener noreferrer">${safeText}</a></p>`,
      )
      .run();
  }

  return (
    <div className="rounded-lg border border-storm-light-blue/60 bg-white">
      <div className="sticky top-0 z-20 border-b border-storm-light-blue/40 bg-white/95 p-2 shadow-sm backdrop-blur-sm supports-[backdrop-filter]:bg-white/90">
        <div className="flex flex-wrap items-center gap-1">
        <ToolbarBtn
          onClick={() => ed.chain().focus().toggleBold().run()}
          active={ed.isActive("bold")}
          label="B"
          title="Bold"
        />
        <ToolbarBtn
          onClick={() => ed.chain().focus().toggleItalic().run()}
          active={ed.isActive("italic")}
          label="I"
          title="Italic"
        />
        <ToolbarBtn
          onClick={() => ed.chain().focus().toggleUnderline().run()}
          active={ed.isActive("underline")}
          label="U"
          title="Underline"
        />
        <ToolbarBtn
          onClick={() => ed.chain().focus().toggleStrike().run()}
          active={ed.isActive("strike")}
          label="S"
          title="Strikethrough"
        />
        <Sep />
        <ToolbarBtn
          onClick={() => ed.chain().focus().toggleHeading({ level: 1 }).run()}
          active={ed.isActive("heading", { level: 1 })}
          label="H1"
          title="Heading 1"
        />
        <ToolbarBtn
          onClick={() => ed.chain().focus().toggleHeading({ level: 2 }).run()}
          active={ed.isActive("heading", { level: 2 })}
          label="H2"
          title="Heading 2"
        />
        <ToolbarBtn
          onClick={() => ed.chain().focus().toggleHeading({ level: 3 }).run()}
          active={ed.isActive("heading", { level: 3 })}
          label="H3"
          title="Heading 3"
        />
        <ToolbarBtn
          onClick={() => ed.chain().focus().setParagraph().run()}
          active={ed.isActive("paragraph") && !ed.isActive("heading")}
          label="P"
          title="Paragraph"
        />
        <Sep />
        <ToolbarBtn
          onClick={() => ed.chain().focus().toggleBulletList().run()}
          active={ed.isActive("bulletList")}
          label="• List"
          title="Bullet list"
        />
        <ToolbarBtn
          onClick={() => ed.chain().focus().toggleOrderedList().run()}
          active={ed.isActive("orderedList")}
          label="1. List"
          title="Numbered list"
        />
        <ToolbarBtn
          onClick={() => ed.chain().focus().toggleBlockquote().run()}
          active={ed.isActive("blockquote")}
          label="Quote"
          title="Blockquote"
        />
        <ToolbarBtn
          onClick={() => ed.chain().focus().setHorizontalRule().run()}
          active={false}
          label="—"
          title="Horizontal rule"
        />
        <Sep />
        <ToolbarBtn
          onClick={setLink}
          active={ed.isActive("link")}
          label="Link"
          title="Add or edit link"
        />
        <ToolbarBtn
          onClick={() => fileInputRef.current?.click()}
          active={false}
          label={uploading ? "…" : "Photo"}
          title="Upload image"
          disabled={uploading}
        />
        <ToolbarBtn
          onClick={setYoutube}
          active={ed.isActive("youtube")}
          label="YouTube"
          title="Embed YouTube video"
        />
        <ToolbarBtn
          onClick={setIframeEmbed}
          active={false}
          label="Embed"
          title="Insert link embed"
        />
        <Sep />
        <ToolbarBtn
          onClick={() => ed.chain().focus().undo().run()}
          active={false}
          label="Undo"
          title="Undo"
        />
        <ToolbarBtn
          onClick={() => ed.chain().focus().redo().run()}
          active={false}
          label="Redo"
          title="Redo"
        />
        </div>
        {(toolbarError || uploading) && (
          <p className="mt-1.5 text-xs text-storm-navy/70">
            {uploading ? "Uploading image…" : toolbarError}
          </p>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void uploadImageFile(file);
        }}
      />
      <EditorContent editor={ed} />
    </div>
  );
});

function Sep() {
  return <span className="mx-0.5 h-5 w-px bg-storm-light-blue/50" aria-hidden />;
}

function ToolbarBtn({
  onClick,
  active,
  label,
  title,
  disabled,
}: {
  onClick: () => void;
  active: boolean;
  label: string;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => {
        // Keep editor selection when clicking toolbar buttons.
        e.preventDefault();
      }}
      onClick={onClick}
      className={`min-h-8 rounded px-2 text-xs font-semibold disabled:opacity-50 ${
        active ? "bg-storm-medium-blue text-white" : "bg-storm-light-grey text-storm-navy"
      }`}
    >
      {label}
    </button>
  );
}
