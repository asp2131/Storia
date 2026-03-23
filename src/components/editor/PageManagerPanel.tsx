"use client";

import {
  ArrowLeft,
  BookOpen,
  GripVertical,
  Image as ImageIcon,
  Plus,
  Trash2,
  Mic,
  Music,
} from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { usePageManagerContext } from "@/contexts/BookEditorContext";

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
  } = usePageManagerContext();

  return (
    <aside className="w-72 bg-white border-r border-slate-200 flex flex-col shadow-[4px_0_24px_-12px_rgba(0,0,0,0.05)] z-20 shrink-0">
      <div className="h-16 flex items-center px-5 border-b border-slate-100">
        <a href="/admin/books" className="flex items-center gap-2 text-teal-600 hover:text-teal-700">
          <ArrowLeft className="w-4 h-4" />
          <BookOpen className="w-6 h-6" />
          <span className="font-bold tracking-tight text-slate-900">Storia</span>
        </a>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pages</div>
          {draggedSound && (
            <span className="text-[10px] text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full font-medium animate-pulse">
              Drop on a page
            </span>
          )}
        </div>

        <DragDropContext onDragEnd={handleDragEndPages}>
          <Droppable droppableId="pages-list">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="space-y-4"
              >
                {localPages.map((page, index) => {
                  const isActive = page.number === activePage;
                  const pageHasOverlay = page.overlay && page.overlay.elements.length > 0;
                  const audioStatus = pageAudioMap[page.number];
                  const isDropTarget = dropTargetPage === page.number;

                  return (
                    <Draggable key={`page-${page.id || page.number}`} draggableId={`page-${page.id || page.number}`} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          style={{
                            ...provided.draggableProps.style,
                            opacity: snapshot.isDragging ? 0.8 : 1,
                          }}
                          role="button"
                          tabIndex={0}
                          onClick={() => setActivePage(page.number)}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActivePage(page.number); } }}
                          onDragOver={draggedSound ? (e) => handlePageDragOver(e, page.number) : undefined}
                          onDragLeave={draggedSound ? handlePageDragLeave : undefined}
                          onDrop={draggedSound ? (e) => handlePageDrop(e, page.number) : undefined}
                          className={`group relative block text-left w-full cursor-pointer ${snapshot.isDragging ? "z-50" : "z-auto"}`}
                        >
                          <div
                            {...provided.dragHandleProps}
                            className={`absolute -left-2 top-1/2 -translate-y-1/2 ${isActive ? "opacity-100 text-teal-400" : "opacity-0 text-slate-400"} group-hover:opacity-100 cursor-grab active:cursor-grabbing`}
                          >
                            <GripVertical className="w-4 h-4" />
                          </div>
                          {localPages.length > 1 && (
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => { e.stopPropagation(); handleDeletePage(page.number); }}
                              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); handleDeletePage(page.number); } }}
                              className={`absolute right-0 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"} z-10`}
                              aria-label="Delete page"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </span>
                          )}
                          <div className="flex items-start gap-3">
                            <span className={`text-xs w-4 pt-1 ${isActive ? "font-bold text-teal-600" : "font-medium text-slate-400"}`}>
                              {page.number}
                            </span>
                            <div className={`w-full aspect-3/4 bg-white rounded-md overflow-hidden transition-all relative ${
                              isDropTarget
                                ? "border-2 border-teal-400 ring-2 ring-teal-200 shadow-lg scale-[1.02] bg-teal-50/30"
                                : isActive
                                  ? "border-2 border-teal-500 ring-2 ring-teal-100 shadow-md"
                                  : "border border-slate-200 shadow-sm group-hover:shadow-md group-hover:-translate-y-0.5"
                            }`}>
                              {page.compositedImageUrl || page.imageUrl ? (
                                <img
                                  src={page.compositedImageUrl || page.imageUrl}
                                  alt={`Page ${page.number}`}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center p-2">
                                  <div className="w-full h-1/2 bg-slate-50 rounded-sm mb-2 flex items-center justify-center text-slate-300">
                                    <ImageIcon className="w-5 h-5" />
                                  </div>
                                  <div className="space-y-1 w-full">
                                    <div className="h-1 w-full bg-slate-100 rounded-full"></div>
                                    <div className="h-1 w-4/5 bg-slate-100 rounded-full"></div>
                                  </div>
                                </div>
                              )}

                              {/* Drop target overlay */}
                              {isDropTarget && (
                                <div className="absolute inset-0 bg-teal-500/10 flex items-center justify-center pointer-events-none">
                                  <div className="bg-teal-600 text-white text-[9px] px-2 py-1 rounded-full font-bold shadow-sm">
                                    Drop here
                                  </div>
                                </div>
                              )}

                              {/* Badges row */}
                              <div className="absolute top-1 right-1 flex items-center gap-0.5">
                                {page.compositedImageUrl ? (
                                  <div className="bg-teal-500 text-white text-[8px] px-1.5 py-0.5 rounded-full font-medium">Overlay</div>
                                ) : pageHasOverlay ? (
                                  <div className="bg-blue-500 text-white text-[8px] px-1.5 py-0.5 rounded-full font-medium">Text</div>
                                ) : null}
                              </div>

                              {/* Audio badges at bottom */}
                              {(audioStatus?.hasNarration || audioStatus?.hasSoundscape) && (
                                <div className="absolute bottom-1 left-1 flex items-center gap-0.5">
                                  {audioStatus.hasNarration && (
                                    <div className="bg-orange-500 text-white rounded-full w-4 h-4 flex items-center justify-center" title="Has narration">
                                      <Mic className="w-2.5 h-2.5" />
                                    </div>
                                  )}
                                  {audioStatus.hasSoundscape && (
                                    <div className="bg-amber-500 text-white rounded-full w-4 h-4 flex items-center justify-center" title="Has soundscape">
                                      <Music className="w-2.5 h-2.5" />
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
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

      <div className="p-4 border-t border-slate-100 bg-white">
        <button
          type="button"
          onClick={handleAddPage}
          className="w-full flex items-center justify-center gap-2 py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 font-medium rounded-lg border border-slate-200 border-dashed transition-all hover:border-teal-400 hover:text-teal-600 group"
        >
          <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
          Add Page
        </button>
      </div>
    </aside>
  );
}
