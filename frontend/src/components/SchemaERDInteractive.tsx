/**
 * SchemaERDInteractive — dynamic canvas-based Entity-Relationship Diagram.
 * Supports zooming, panning, table dragging, column viewing, PK/FK highlighting,
 * and custom QueryMind theming (dark/light mode).
 */

import { useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2, RefreshCw, ZoomIn, ZoomOut, Database, ArrowRight } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

interface ERDColumn {
  name: string;
  type: string;
  nullable?: boolean;
}

interface ERDForeignKey {
  column: string;
  ref_table: string;
  ref_column: string;
}

interface ERDTable {
  table: string;
  columns?: number;
  column_details?: ERDColumn[];
  rows?: number;
  indexes?: number;
  primary_key?: string[];
  foreign_keys?: ERDForeignKey[];
  x?: number; // Position on canvas
  y?: number;
  w?: number;
  h?: number;
}

interface SchemaERDInteractiveProps {
  schema: ERDTable[];
}

export function SchemaERDInteractive({ schema }: SchemaERDInteractiveProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { isDark } = useTheme();

  const [tables, setTables] = useState<ERDTable[]>([]);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 50, y: 50 });
  const [draggingTable, setDraggingTable] = useState<number | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showPanHint, setShowPanHint] = useState(true);

  // Initialize tables with smart layout coordinates
  useEffect(() => {
    if (!schema || schema.length === 0) return;

    // Arrange tables in a grid or circle
    const initialTables = schema.map((t, index) => {
      const cols = 3;
      const row = Math.floor(index / cols);
      const col = index % cols;
      const x = col * 320 + 50;
      const y = row * 240 + 50;

      // Estimate height based on columns count
      const colCount = t.column_details?.length || 5;
      const h = 40 + colCount * 22 + 10;
      const w = 220;

      return {
        ...t,
        x,
        y,
        w,
        h,
      };
    });

    setTables(initialTables);
  }, [schema]);

  // Trackpad / Wheel listener for panning and pinch-to-zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey) {
        // Pinch-to-zoom
        setZoom((prev) => {
          const factor = e.deltaY < 0 ? 1.05 : 0.95;
          return Math.max(0.5, Math.min(2.0, prev * factor));
        });
      } else {
        // Standard pan
        setOffset((prev) => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY,
        }));
      }
      setShowPanHint(false);
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, []);

  // Main rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas dimensions based on container
    const rect = containerRef.current?.getBoundingClientRect();
    canvas.width = (rect?.width || 800) * window.devicePixelRatio;
    canvas.height = (rect?.height || 500) * window.devicePixelRatio;
    canvas.style.width = "100%";
    canvas.style.height = "100%";

    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Apply scaling/pan transformations
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(zoom, zoom);

    // Colors based on theme
    const themeColors = {
      bg: isDark ? "#09090b" : "#fafafa",
      tableBg: isDark ? "#111113" : "#ffffff",
      tableBorder: isDark ? "#27272a" : "#e4e4e7",
      tableHeaderBg: isDark ? "#1c1c20" : "#f4f4f5",
      headerText: isDark ? "#fafafa" : "#09090b",
      columnText: isDark ? "#a1a1aa" : "#52525b",
      pkText: isDark ? "#06b6d4" : "#0891b2",
      line: isDark ? "#06b6d480" : "#0891b280",
      lineActive: isDark ? "#06b6d4" : "#0891b2",
    };

    // Draw connection lines first (under tables)
    tables.forEach((table) => {
      if (!table.foreign_keys) return;

      table.foreign_keys.forEach((fk) => {
        const refTable = tables.find((t) => t.table === fk.ref_table);
        if (!refTable) return;

        // Calculate positions
        const startX = (table.x || 0) + (table.w || 0) / 2;
        const startY = (table.y || 0) + (table.h || 0) / 2;
        const endX = (refTable.x || 0) + (refTable.w || 0) / 2;
        const endY = (refTable.y || 0) + (refTable.h || 0) / 2;

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = themeColors.line;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Draw dot on reference table
        ctx.beginPath();
        ctx.arc(endX, endY, 4, 0, Math.PI * 2);
        ctx.fillStyle = themeColors.pkText;
        ctx.fill();
      });
    });

    // Draw table nodes
    tables.forEach((table) => {
      const tx = table.x || 0;
      const ty = table.y || 0;
      const tw = table.w || 220;
      const th = table.h || 120;

      // Table card container
      ctx.fillStyle = themeColors.tableBg;
      ctx.beginPath();
      ctx.roundRect(tx, ty, tw, th, 8);
      ctx.fill();

      ctx.strokeStyle = themeColors.tableBorder;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Header block
      ctx.fillStyle = themeColors.tableHeaderBg;
      ctx.beginPath();
      ctx.roundRect(tx, ty, tw, 36, [8, 8, 0, 0]);
      ctx.fill();

      // Header text
      ctx.fillStyle = themeColors.headerText;
      ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
      ctx.fillText(table.table, tx + 12, ty + 22);

      // Columns list
      const cols = table.column_details || [];
      cols.forEach((col, i) => {
        const colY = ty + 56 + i * 22;

        // Check if primary key
        const isPk = table.primary_key?.includes(col.name);

        ctx.font = isPk
          ? "bold 11px system-ui, -apple-system, sans-serif"
          : "11px system-ui, -apple-system, sans-serif";

        ctx.fillStyle = isPk ? themeColors.pkText : themeColors.columnText;
        ctx.fillText(
          `${isPk ? "🔑 " : "  "}${col.name}`,
          tx + 12,
          colY
        );

        ctx.fillStyle = themeColors.columnText;
        ctx.font = "10px monospace";
        ctx.fillText(
          col.type.toLowerCase(),
          tx + tw - 60,
          colY
        );
      });
    });

    ctx.restore();
  }, [tables, zoom, offset, isDark]);

  // Zoom helpers
  const zoomIn = () => setZoom((prev) => Math.min(prev + 0.1, 2));
  const zoomOut = () => setZoom((prev) => Math.max(prev - 0.1, 0.5));
  const resetZoom = () => {
    setZoom(1);
    setOffset({ x: 50, y: 50 });
  };

  // Mouse handlers for dragging/panning
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - offset.x) / zoom;
    const y = (e.clientY - rect.top - offset.y) / zoom;

    // Check if clicked a table
    const tableIndex = tables.findIndex(
      (t) =>
        x >= (t.x || 0) &&
        x <= (t.x || 0) + (t.w || 220) &&
        y >= (t.y || 0) &&
        y <= (t.y || 0) + (t.h || 120)
    );

    if (tableIndex !== -1) {
      setDraggingTable(tableIndex);
      setDragStart({ x: x - (tables[tableIndex].x || 0), y: y - (tables[tableIndex].y || 0) });
      setShowPanHint(false);
    } else {
      setIsPanning(true);
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      setShowPanHint(false);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (draggingTable !== null) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left - offset.x) / zoom;
      const y = (e.clientY - rect.top - offset.y) / zoom;

      setTables((prev) =>
        prev.map((t, idx) =>
          idx === draggingTable
            ? { ...t, x: x - dragStart.x, y: y - dragStart.y }
            : t
        )
      );
    } else if (isPanning) {
      setOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setDraggingTable(null);
    setIsPanning(false);
  };

  if (!schema || schema.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-text-muted">
        <Database size={32} className="mb-2 opacity-50" />
        <span className="text-xs font-mono">No tables discovered in schema. Connect a database or run a scan.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[400px] border border-border rounded-xl bg-background overflow-hidden relative">
      {/* Control overlay */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-panel/85 backdrop-blur-sm border border-border rounded-lg p-1.5 shadow-md">
        <button
          onClick={zoomOut}
          className="p-1 hover:bg-elevated rounded text-text-secondary hover:text-text-primary transition-colors"
          title="Zoom Out"
        >
          <ZoomOut size={13} />
        </button>
        <input
          type="range"
          min="0.5"
          max="2"
          step="0.1"
          value={zoom}
          onChange={(e) => setZoom(parseFloat(e.target.value))}
          className="w-16 md:w-20 h-1 bg-border rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
        />
        <button
          onClick={zoomIn}
          className="p-1 hover:bg-elevated rounded text-text-secondary hover:text-text-primary transition-colors"
          title="Zoom In"
        >
          <ZoomIn size={13} />
        </button>
        <span className="text-[10px] font-mono text-text-muted border-l border-border pl-2 pr-1 min-w-[34px] text-right">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={resetZoom}
          className="p-1 hover:bg-elevated rounded text-text-secondary hover:text-text-primary transition-colors"
          title="Reset Zoom"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      <div className="absolute top-3 right-3 z-10 text-[10px] bg-panel/80 backdrop-blur-sm border border-border rounded-lg px-2.5 py-1 text-text-disabled font-mono shadow-md flex items-center gap-1.5">
        <Maximize2 size={10} /> Drag tables · Pan / Scroll canvas
      </div>

      {/* Floating horizontal slide indicator */}
      {showPanHint && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 pointer-events-none bg-panel/95 backdrop-blur border border-primary/45 py-2 px-3 rounded-full shadow-lg text-primary flex items-center gap-1.5 text-[11px] font-mono animate-pulse">
          <span>Pan / Swipe</span>
          <ArrowRight size={13} className="animate-bounce" />
        </div>
      )}

      <div ref={containerRef} className="flex-1 w-full h-full cursor-grab active:cursor-grabbing">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>
    </div>
  );
}
