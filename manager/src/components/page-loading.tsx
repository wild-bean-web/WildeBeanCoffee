export function PageLoading() {
  return (
    <div className="page-loading" role="status" aria-live="polite">
      <div className="route-progress" />
      <p className="page-loading-label">Loading</p>
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-line" />
      <div className="skeleton-grid">
        <div className="skeleton skeleton-card" />
        <div className="skeleton skeleton-card" />
        <div className="skeleton skeleton-card" />
        <div className="skeleton skeleton-card" />
      </div>
      <div className="skeleton skeleton-panel" />
    </div>
  );
}
