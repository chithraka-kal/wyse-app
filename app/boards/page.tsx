"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, DragStartEvent, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Board, Item } from "@/types/wyse";

export default function BoardsPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBoardName, setNewBoardName] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function loadData() {
    try {
      const [boardsRes, itemsRes] = await Promise.all([
        fetch("/api/boards"),
        fetch("/api/items")
      ]);
      
      if (boardsRes.ok && itemsRes.ok) {
        setBoards(await boardsRes.json());
        setItems(await itemsRes.json());
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function createBoard(e: React.FormEvent) {
    e.preventDefault();
    if (!newBoardName.trim()) return;
    
    const res = await fetch("/api/boards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newBoardName })
    });
    
    if (res.ok) {
      setNewBoardName("");
      void loadData();
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    
    if (!over) return;
    
    const activeId = String(active.id);
    const overId = String(over.id);

    const activeItem = items.find(i => i._id === activeId);
    if (!activeItem) return;

    let targetBoardId: string | null = null;

    // Check if dropping on a board container
    if (boards.some(b => b._id === overId) || overId === "unassigned") {
      targetBoardId = overId === "unassigned" ? null : overId;
    } else {
      // Dropped on an item
      const overItem = items.find(i => i._id === overId);
      if (overItem) {
        targetBoardId = overItem.boardId || null;
      }
    }

    if (activeItem.boardId !== targetBoardId) {
      setItems((prev) => 
        prev.map(i => i._id === activeId ? { ...i, boardId: targetBoardId } : i)
      );
      
      await fetch(`/api/items/${activeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardId: targetBoardId })
      });
    }
  }

  if (loading) return <div className="p-8">Loading boards...</div>;

  const getItemsForBoard = (boardId: string | null) => 
    items.filter(i => (i.boardId || null) === boardId);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#d6f5ec,_#f8fafc_55%)] p-4 text-slate-900 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 rounded-3xl border border-teal-200 bg-white/80 p-5 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#0F6E56]">Custom Boards</h1>
            <p className="text-sm text-slate-600">Organize your items into custom lists</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Link href="/" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
              Back to Home
            </Link>
            <form onSubmit={createBoard} className="flex gap-2">
              <input 
                value={newBoardName}
                onChange={e => setNewBoardName(e.target.value)}
                placeholder="New board name..."
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-[#0F6E56]"
              />
              <button type="submit" className="rounded-lg bg-[#0F6E56] px-4 py-2 text-sm font-semibold text-white">
                Create
              </button>
            </form>
          </div>
        </header>

        <DndContext 
          sensors={sensors} 
          collisionDetection={closestCorners} 
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-200px)]">
            <BoardColumn id="unassigned" name="Unassigned" items={getItemsForBoard(null)} />
            {boards.map(board => (
              <BoardColumn key={board._id} id={board._id} name={board.name} items={getItemsForBoard(board._id)} />
            ))}
          </div>
          
          <DragOverlay>
            {activeId ? (
              <SortableItem item={items.find(i => i._id === activeId)!} />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </main>
  );
}

function BoardColumn({ id, name, items }: { id: string, name: string, items: Item[] }) {
  const { setNodeRef } = useSortable({ id, data: { type: 'Board' } });
  
  return (
    <div ref={setNodeRef} className="w-80 flex-shrink-0 flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm max-h-full">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
        <h2 className="font-semibold text-slate-800">{name}</h2>
        <span className="text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded-full">{items.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <SortableContext items={items.map(i => i._id)} strategy={verticalListSortingStrategy}>
          {items.map(item => (
            <SortableItem key={item._id} item={item} />
          ))}
        </SortableContext>
        {items.length === 0 && (
          <div className="text-center py-8 text-sm text-slate-400 italic">Drop items here</div>
        )}
      </div>
    </div>
  );
}

function SortableItem({ item }: { item: Item }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: item._id, data: { type: 'Item', item } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm cursor-grab active:cursor-grabbing hover:border-teal-300 hover:shadow-md transition-all touch-none"
    >
      <h3 className="font-medium text-slate-900 text-sm mb-1">{item.name}</h3>
      <div className="flex justify-between items-center">
        <span className="text-xs font-semibold text-[#0F6E56]">LKR {item.price.toLocaleString()}</span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${item.zone === 'wishlist' ? 'bg-purple-100 text-purple-700' : item.zone === 'saving' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
          {item.zone}
        </span>
      </div>
    </div>
  );
}
