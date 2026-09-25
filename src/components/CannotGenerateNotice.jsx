export function CannotGenerateNotice({ info }) {
  if (!info) {
    return null;
  }

  return (
    <div className="cannot-generate-card" role="status">
      <div className="cannot-gen-header">
        <svg
          className="cannot-gen-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <h3 className="cannot-gen-title">Recipe could not be created</h3>
      </div>
      <p className="cannot-gen-reason">{info.reason}</p>

      {info.suggestions && info.suggestions.length > 0 && (
        <div className="cannot-gen-suggestions">
          <h4 className="suggestions-title">Suggestions to try:</h4>
          <ul className="suggestions-list">
            {info.suggestions.map((suggestion, idx) => (
              <li key={idx}>{suggestion}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
