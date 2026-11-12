"use client";

import {
  GripVertical,
  Image as ImageIcon,
  Images,
  Loader2,
  Mic,
  Music,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { usePageManagerContext } from "@/contexts/BookEditorContext";

const hasFiles = (e: React.DragEvent) => e.dataTransfer.types.includes("Files");

function readEntry(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) {
    return new Promise((resolve) =>
      (entry as FileSystemFileEntry).file((file) => resolve([file]), () => resolve([]))
    );
  }
  if (!entry.isDirectory) return Promise.resolve([]);
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  // readEntries returns batches (~100 in Chrome); keep reading until empty.
  return new Promise((resolve) => {
    const all: FileSystemEntry[] = [];
    const readBatch = () =>
      reader.readEntries(async (batch) => {
        if (batch.length === 0) {
          resolve((await Promise.all(all.map(readEntry))).flat());
          return;
        }
        all.push(...batch);
        readBatch();
      }, () => resolve([]));
    readBatch();
  });
}

/** Files from a drop, descending into dropped folders. */
async function collectDroppedFiles(dataTransfer: DataTransfer): Promise<File[]> {
  // Entries must be grabbed synchronously, before the drop event ends.
  const entries = Array.from(dataTransfer.items)
    .map((item) => item.webkitGetAsEntry?.())
    .filter((entry): entry is FileSystemEntry => Boolean(entry));
  if (entries.length === 0) return Array.from(dataTransfer.files);
  return (await Promise.all(entries.map(readEntry))).flat();
}

export function PageManagerPanel() {
  const {
    localPages,
    activePage,
    setActivePage,
    handleAddPage,
    handleDeletePage,
    handleDragEndPages,
    pageAudioMap,
    draggedSound,
    dropTargetPage,
    handlePageDragOver,
    handlePageDragLeave,
    handlePageDrop,
    uploading,
    handleImageFiles,
  } = usePageManagerContext();
  // null = not dragging files; 0 = over the panel but not a page (start at active page).
  const [fileDropPage, setFileDropPage] = useState<number | null>(null);

  const dropFiles = (e: React.DragEvent, startPage: number) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.stopPropagation();
    setFileDropPage(null);
    if (uploading) return;
    void collectDroppedFiles(e.dataTransfer).then((files) => handleImageFiles(files, startPage));
  };

  return (
    <aside
      className={`flex w-[236px] shrink-0 flex-col border-r border-zinc-200/80 bg-[#fbfbfc] max-[1180px]:w-52 max-[900px]:hidden ${fileDropPage === 0 ? "ring-2 ring-inset ring-[var(--editor-accent)]" : ""}`}
      onDragOver={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setFileDropPage((prev) => prev ?? 0);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFileDropPage(null);
      }}
      onDrop={(e) => dropFiles(e, activePage)}
    >
      <div className="flex h-[46px] shrink-0 items-center justify-between border-b border-zinc-200/70 px-4">
        <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-zinc-400">
          Pages
        </span>
        <div className="flex items-center gap-2">
          {(draggedSound || fileDropPage !== null) && (
            <span className="animate-pulse text-[10px] font-semibold text-[var(--editor-accent)]">
              {draggedSound ? "Drop on page" : `Fill from page ${fileDropPage || activePage}`}
            </span>
          )}
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-400">
            {localPages.length}
          </span>
        </div>
      </div>

      <div className="editor-scroll flex-1 overflow-y-auto p-3.5">
        <DragDropContext onDragEnd={handleDragEndPages}>
          <Droppable droppableId="pages-list">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="space-y-3"
              >
                {localPages.map((page, index) => {
                  const isActive = page.number === activePage;
                  const pageHasOverlay = Boolean(page.overlay?.elements.length);
                  const audioStatus = pageAudioMap[page.number];
                  const isDropTarget =
                    dropTargetPage === page.number || fileDropPage === page.number;

                  return (
                    <Draggable
                      key={`page-${page.id || page.number}`}
                      draggableId={`page-${page.id || page.number}`}
                      index={index}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          style={{
                            ...provided.draggableProps.style,
                            opacity: snapshot.isDragging ? 0.82 : 1,
                          }}
                          role="button"
                          tabIndex={0}
                          aria-label={`Select page ${page.number}`}
                          aria-current={isActive ? "page" : undefined}
                          onClick={() => setActivePage(page.number)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setActivePage(page.number);
                            }
                          }}
                          onDragOver={(event) => {
                            if (draggedSound) return handlePageDragOver(event, page.number);
                            if (!hasFiles(event)) return;
                            event.preventDefault();
                            event.stopPropagation();
                            event.dataTransfer.dropEffect = "copy";
                            setFileDropPage(page.number);
                          }}
                          onDragLeave={(event) => {
                            if (draggedSound) return handlePageDragLeave();
                            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                              setFileDropPage(0);
                            }
                          }}
                          onDrop={(event) =>
                            draggedSound ? handlePageDrop(event, page.number) : dropFiles(event, page.number)
                          }
                          className={`group relative flex cursor-pointer items-start gap-2.5 outline-none ${snapshot.isDragging ? "z-50" : ""}`}
                        >
                          <span className={`w-3 shrink-0 pt-1 text-right text-xs ${isActive ? "font-bold text-[var(--editor-accent)]" : "font-semibold text-zinc-400"}`}>
                            {page.number}
                          </span>

                          <div
                            className={`relative aspect-[4/5] min-w-0 flex-1 overflow-hidden rounded-[10px] bg-white transition-all ${
                              isDropTarget
                                ? "scale-[1.02] border-2 border-[var(--editor-accent)] ring-4 ring-[var(--editor-accent-soft)]"
                                : isActive
                                  ? "border-2 border-[var(--editor-accent)] shadow-[0_2px_10px_rgba(91,87,230,0.16)]"
                                  : "border-2 border-zinc-200 shadow-sm group-hover:-translate-y-0.5 group-hover:border-zinc-300 group-hover:shadow-md"
                            }`}
                          >
                            {page.compositedImageUrl || page.imageUrl ? (
                              <img
                                src={page.compositedImageUrl || page.imageUrl}
                                alt={`Page ${page.number}`}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-[#fdf6ef] via-[#f3f0fb] to-[#eaf0f7] text-[#c9b79f]">
                                <ImageIcon className="h-8 w-8" strokeWidth={1.4} />
                              </div>
                            )}

                            {isDropTarget && (
                              <div className="pointer-events-none absolute inset-0 grid place-items-center bg-[color-mix(in_srgb,var(--editor-accent)_12%,transparent)]">
                                <span className="rounded-full bg-[var(--editor-accent)] px-2 py-1 text-[9px] font-bold text-[var(--editor-on-accent)] shadow-sm">
                                  Drop here
                                </span>
                              </div>
                            )}

                            <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
                              {page.compositedImageUrl ? (
                                <span className="rounded-md bg-[var(--editor-accent-soft)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--editor-accent)]">
                                  OVERLAY
                                </span>
                              ) : pageHasOverlay ? (
                                <span className="rounded-md bg-[var(--editor-accent-soft)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--editor-accent)]">
                                  TEXT
                                </span>
                              ) : null}
                            </div>

                            {(audioStatus?.hasNarration || audioStatus?.hasSoundscape) && (
                              <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1">
                                {audioStatus.hasNarration && (
                                  <span className="grid h-5 w-5 place-items-center rounded-full bg-orange-500 text-white shadow-sm" title="Has narration">
                                    <Mic className="h-3 w-3" />
                                  </span>
                                )}
                                {audioStatus.hasSoundscape && (
                                  <span className="grid h-5 w-5 place-items-center rounded-full bg-amber-500 text-white shadow-sm" title="Has ambient sound">
                                    <Music className="h-3 w-3" />
                                  </span>
                                )}
                              </div>
                            )}

                            <div
                              {...provided.dragHandleProps}
                              className={`absolute bottom-1.5 right-1.5 grid h-6 w-6 place-items-center rounded-md bg-white/90 text-zinc-400 shadow-sm transition-opacity ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                              title="Drag to reorder"
                            >
                              <GripVertical className="h-3.5 w-3.5" />
                            </div>

                            {localPages.length > 1 && (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleDeletePage(page.number);
                                }}
                                className="absolute left-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-md bg-white/90 text-zinc-400 opacity-0 shadow-sm transition group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-500"
                                aria-label={`Delete page ${page.number}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>

      <div className="shrink-0 border-t border-zinc-200/70 p-3.5">
        <button
          type="button"
          onClick={handleAddPage}
          className="flex h-[38px] w-full items-center justify-center gap-1.5 rounded-[9px] border border-dashed border-zinc-300 bg-white text-[13px] font-semibold text-zinc-700 transition hover:border-[var(--editor-accent)] hover:bg-[var(--editor-accent-faint)] hover:text-[var(--editor-accent)]"
        >
          <Plus className="h-4 w-4" />
          Add Page
        </button>
        <label
          title={`Images fill pages in filename order, starting at page ${activePage}. You can also drop files or a folder onto a page.`}
          className={`mt-2 flex h-[38px] w-full cursor-pointer items-center justify-center gap-1.5 rounded-[9px] border border-dashed border-zinc-300 bg-white text-[13px] font-semibold text-zinc-700 transition hover:border-[var(--editor-accent)] hover:bg-[var(--editor-accent-faint)] hover:text-[var(--editor-accent)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--editor-accent)] ${uploading ? "pointer-events-none opacity-60" : ""}`}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Images className="h-4 w-4" />}
          {uploading ? "Uploading…" : "Upload Images"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            multiple
            disabled={uploading}
            className="sr-only"
            onChange={(e) => {
              const files = e.target.files;
              if (files?.length) void handleImageFiles(files);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    </aside>
  );
}
