import { MessageCircle, X } from "lucide-react";
import { useState } from "react";

export function AssistantLauncher() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        className="assistant-launcher"
        type="button"
        aria-label={isOpen ? "Close Diagnostix Assistant" : "Open Diagnostix Assistant"}
        aria-controls="assistant-panel"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        {isOpen ? <X size={21} aria-hidden="true" /> : <MessageCircle size={21} aria-hidden="true" />}
      </button>
      {isOpen && (
        <section className="assistant-panel" id="assistant-panel" aria-labelledby="assistant-title">
          <div className="assistant-panel__header">
            <span className="assistant-panel__mark">
              <MessageCircle size={17} aria-hidden="true" />
            </span>
            <h2 id="assistant-title">Diagnostix Assistant</h2>
            <button
              className="app-icon-button assistant-panel__close"
              type="button"
              aria-label="Close assistant"
              onClick={() => setIsOpen(false)}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <p>AI assistant coming soon.</p>
        </section>
      )}
    </>
  );
}