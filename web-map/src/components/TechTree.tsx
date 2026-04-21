import React from 'react';
import { Tech } from '../types';

const NODE_W = 80;
const NODE_H = 80;
const COL_GAP = 40;
const ROW_GAP = 60;

const STRIDE_X = NODE_W + COL_GAP;
const STRIDE_Y = NODE_H + ROW_GAP;

function computeDepths(techs: Tech[]): Map<string, number> {
  const techMap = new Map(techs.map(t => [t.key, t]));
  const memo = new Map<string, number>();

  function depth(key: string): number {
    if (memo.has(key)) return memo.get(key)!;
    const tech = techMap.get(key);
    if (!tech || !tech.prerequisites.length) {
      memo.set(key, 0);
      return 0;
    }
    const d = Math.max(...tech.prerequisites.filter(p => techMap.has(p)).map(depth)) + 1;
    memo.set(key, d);
    return d;
  }

  techs.forEach(t => depth(t.key));
  return memo;
}

/**
 * Assigns each tech a (row, col) grid coordinate.
 * Rule: if a tech has exactly 1 prerequisite AND that prerequisite has exactly 1
 * child, place the child in the same column as the parent (directly below).
 * All other techs get the next free column in their row.
 */
function computePositions(techs: Tech[]): Map<string, { row: number; col: number }> {
  const techMap = new Map(techs.map(t => [t.key, t]));
  const depths = computeDepths(techs);

  // Build children map
  const childrenMap = new Map<string, string[]>();
  techs.forEach(t => childrenMap.set(t.key, []));
  techs.forEach(t => {
    t.prerequisites.forEach(p => {
      if (childrenMap.has(p)) childrenMap.get(p)!.push(t.key);
    });
  });

  const positions = new Map<string, { row: number; col: number }>();
  const takenCols = new Map<number, Set<number>>(); // row → used columns

  function isFree(row: number, col: number): boolean {
    return !(takenCols.get(row)?.has(col));
  }

  function claim(row: number, col: number) {
    if (!takenCols.has(row)) takenCols.set(row, new Set());
    takenCols.get(row)!.add(col);
  }

  function nextFreeCol(row: number, start = 0): number {
    let col = start;
    while (!isFree(row, col)) col++;
    return col;
  }

  function hasPreferredCol(tech: Tech): boolean {
    const validPrereqs = tech.prerequisites.filter(p => techMap.has(p));
    if (validPrereqs.length !== 1) return false;
    const parentChildren = childrenMap.get(validPrereqs[0]) ?? [];
    return parentChildren.length === 1;
  }

  // Process in depth order; within same depth, nodes with an inherited column come first
  // so they claim their column before free-floating nodes fill it.
  const sorted = [...techs].sort((a, b) => {
    const da = depths.get(a.key) ?? 0;
    const db = depths.get(b.key) ?? 0;
    if (da !== db) return da - db;
    return (hasPreferredCol(b) ? 1 : 0) - (hasPreferredCol(a) ? 1 : 0);
  });

  for (const tech of sorted) {
    const row = depths.get(tech.key) ?? 0;
    const validPrereqs = tech.prerequisites.filter(p => techMap.has(p));

    let preferredCol: number | undefined;

    if (validPrereqs.length === 1) {
      const parentKey = validPrereqs[0];
      const parentChildren = childrenMap.get(parentKey) ?? [];
      if (parentChildren.length === 1 && positions.has(parentKey)) {
        preferredCol = positions.get(parentKey)!.col;
      }
    }

    const col = preferredCol !== undefined && isFree(row, preferredCol)
      ? preferredCol
      : nextFreeCol(row, preferredCol ?? 0);

    claim(row, col);
    positions.set(tech.key, { row, col });
  }

  return positions;
}

interface Props {
  techs: Tech[];
}

export const TechTree: React.FC<Props> = ({ techs }) => {
  if (!techs.length) return null;

  const positions = computePositions(techs);

  const allPositions = Array.from(positions.values());
  const maxRow = Math.max(...allPositions.map(p => p.row));
  const maxCol = Math.max(...allPositions.map(p => p.col));

  const canvasW = (maxCol + 1) * STRIDE_X - COL_GAP;
  const canvasH = (maxRow + 1) * STRIDE_Y - ROW_GAP;

  const nodeX = (col: number) => col * STRIDE_X;
  const nodeY = (row: number) => row * STRIDE_Y;
  const centerX = (col: number) => nodeX(col) + NODE_W / 2;
  const centerY = (row: number) => nodeY(row) + NODE_H / 2;

  return (
    <div style={{ overflowX: 'auto', overflowY: 'auto', padding: 16, display: 'flex', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: canvasW, height: canvasH }}>
        {/* SVG lines */}
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: canvasW,
            height: canvasH,
            pointerEvents: 'none',
          }}
        >
          {techs.map(tech =>
            tech.prerequisites
              .filter(p => positions.has(p))
              .map(prereqKey => {
                const child = positions.get(tech.key)!;
                const parent = positions.get(prereqKey)!;
                return (
                  <line
                    key={`${prereqKey}->${tech.key}`}
                    x1={centerX(parent.col)}
                    y1={nodeY(parent.row) + NODE_H}
                    x2={centerX(child.col)}
                    y2={nodeY(child.row)}
                    stroke="#555"
                    strokeWidth={2}
                  />
                );
              })
          )}
        </svg>

        {/* Nodes */}
        {techs.map(tech => {
          const pos = positions.get(tech.key)!;
          return (
            <div
              key={tech.key}
              title={`${tech.name}\n${tech.description}\nCost: ${tech.cost}`}
              style={{
                position: 'absolute',
                left: nodeX(pos.col),
                top: nodeY(pos.row),
                width: NODE_W,
                height: NODE_H,
                border: '2px solid black',
                backgroundColor: 'white',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 4,
                boxSizing: 'border-box',
              }}
            >
              {/* icon placeholder */}
              <div
                style={{
                  width: 24,
                  height: 24,
                  border: '1px solid #aaa',
                  borderRadius: 4,
                  marginBottom: 4,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 9, textAlign: 'center', lineHeight: 1.2, color: '#111' }}>
                {tech.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
