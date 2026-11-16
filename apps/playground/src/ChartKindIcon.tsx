const paths = {
  plot2d: "M3 3v18h18M5 16c3 0 3-9 7-9s4 8 9 5",
  circle: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 12h6",
  surface3d: "m2 15 6 5 14-6-6-5M2 15c3-1 4-8 8-9 4-1 5 7 12 8M5 17c3-1 4-7 8-8 4-1 5 6 7 6M8 20c3-2 4-7 8-8",
  curve3d: "M6 20c8 2 14-2 11-5-2-2-10-1-10-4 0-3 12-3 12-6 0-2-4-3-8-2",
  vectorfield2d: "m3 9 5-5M5 4h3v3m6 2 5-5m-3 0h3v3M3 20l5-5m-3 0h3v3m6 2 5-5m-3 0h3v3",
  slider: "M3 12h7m4 0h7M10 8h4v8h-4z",
  parametric2d: "M4 12a8 5 0 1 0 16 0 8 5 0 1 0-16 0m6-7 3 2-3 2",
  experiment: "M3 4h18v16H3zM3 9h18M9 4v16m3-4 3-4 3 2",
  flow2d: "M3 8c6-8 12 8 18 0M3 14c6-8 12 8 18 0M3 20c6-8 12 8 18 0",
  calculus: "M3 4v16h18M6 17V14h4v3m0 0v-6h4v6m0 0V7h4v10M5 16c5 0 10-6 14-11",
  crossproduct: "M12 18V4m-3 3 3-3 3 3M12 18l8-5m-4-1 4 1-1 4m-7 1-9-4m1 4-1-4 4-1",
  waves: "M3 12c3 0 3-6 6-6s3 6 6 6 3-4 6-4M3 17c3 0 3-6 6-6s3 6 6 6 3-4 6-4",
  bowl: "M3 7c2 8 5 13 9 13s7-5 9-13M3 7a9 3 0 1 0 18 0 9 3 0 1 0-18 0",
  saddle: "M3 5c5 0 5 13 9 13s4-13 9-13M3 19c5 0 5-13 9-13s4 13 9 13",
  plane: "m3 15 6-8 12 2-6 8zM6 11l12 2m-7-5-6 8m11-7-6 8",
};

export function ChartKindIcon({ kind }: { kind: keyof typeof paths }) {
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    <path d={paths[kind]} />
  </svg>;
}
