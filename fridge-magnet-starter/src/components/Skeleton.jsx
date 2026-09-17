// Grey bars in the shape of the rows that are about to appear. Shown
// while the database is answering, so the screen keeps its shape instead
// of flashing empty and then jumping.
export default function SkeletonRows({ rows = 4 }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="fm-skeleton-row">
          <div
            className="fm-skeleton"
            style={{ height: '0.95rem', width: `${50 + ((index * 17) % 35)}%` }}
          />
          <div className="fm-skeleton" style={{ height: '0.8rem', width: '2.5rem' }} />
        </div>
      ))}
      <span className="fm-visually-hidden">Loading</span>
    </div>
  )
}
