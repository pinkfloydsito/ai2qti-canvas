<script>
  import { onMount, onDestroy } from "svelte";
  import { thinkingLogStore } from "../stores/thinking-log.js";
  import { t } from "../stores/localization.js";

  let logs = [];
  let isVisible = true;
  let autoScroll = true;
  let logContainer;

  const unsubscribe = thinkingLogStore.subscribe((value) => {
    logs = value.logs;
    isVisible = value.isVisible;

    // Auto-scroll to bottom when new logs arrive
    if (autoScroll && logContainer) {
      setTimeout(() => {
        logContainer.scrollTop = logContainer.scrollHeight;
      }, 10);
    }
  });

  onDestroy(() => {
    unsubscribe();
  });

  function toggleAutoScroll() {
    autoScroll = !autoScroll;
  }

  function clearLogs() {
    thinkingLogStore.update((store) => ({ ...store, logs: [] }));
  }

  function getLogIcon(type) {
    switch (type) {
      case "info":
        return "💡";
      case "success":
        return "✅";
      case "warning":
        return "⚠️";
      case "error":
        return "❌";
      case "thinking":
        return "🤔";
      case "processing":
        return "⚙️";
      default:
        return "📝";
    }
  }

  function getLogClass(type) {
    return `log-entry log-${type}`;
  }

  function formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }
</script>

{#if isVisible}
  <div class="thinking-canvas">
    <div class="thinking-header">
      <h3>{$t("thinking.title")}</h3>
      <div class="thinking-controls">
        <button
          class="btn-icon"
          class:active={autoScroll}
          on:click={toggleAutoScroll}
          title={$t("thinking.autoScroll")}
        >
          📜
        </button>
        <button
          class="btn-icon"
          on:click={clearLogs}
          title={$t("thinking.clearLogs")}
        >
          🗑️
        </button>
      </div>
    </div>

    <div class="thinking-content" bind:this={logContainer}>
      {#if logs.length === 0}
        <div class="empty-state">
          <div class="empty-icon">🧠</div>
          <p>{$t("thinking.empty")}</p>
        </div>
      {:else}
        {#each logs as log (log.id)}
          <div class={getLogClass(log.type)}>
            <div class="log-meta">
              <span class="log-icon">{getLogIcon(log.type)}</span>
              <span class="log-timestamp">{formatTimestamp(log.timestamp)}</span
              >
            </div>
            <div class="log-message">{log.message}</div>
            {#if log.details}
              <div class="log-details">{log.details}</div>
            {/if}
          </div>
        {/each}
      {/if}
    </div>
  </div>
{/if}

<style>
  .thinking-canvas {
    background: #f8f9fa;
    border: 1px solid #dee2e6;
    border-radius: 8px;
    margin: 1rem 0;
    max-height: 400px;
    display: flex;
    flex-direction: column;
    font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
    font-size: 0.9rem;
  }

  .thinking-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #dee2e6;
    background: #e9ecef;
    border-radius: 8px 8px 0 0;
  }

  .thinking-header h3 {
    margin: 0;
    font-size: 1rem;
    color: #495057;
  }

  .thinking-controls {
    display: flex;
    gap: 0.5rem;
  }

  .btn-icon {
    background: none;
    border: none;
    font-size: 1.2rem;
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 4px;
    transition: background-color 0.2s;
  }

  .btn-icon:hover {
    background: rgba(0, 0, 0, 0.1);
  }

  .btn-icon.active {
    background: #007bff;
  }

  .thinking-content {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    max-height: 300px;
  }

  .empty-state {
    text-align: center;
    padding: 2rem;
    color: #6c757d;
  }

  .empty-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .log-entry {
    margin-bottom: 0.75rem;
    padding: 0.5rem;
    border-radius: 4px;
    border-left: 4px solid #dee2e6;
  }

  .log-info {
    background: #e7f3ff;
    border-left-color: #0066cc;
  }

  .log-success {
    background: #e8f5e8;
    border-left-color: #28a745;
  }

  .log-warning {
    background: #fff3e0;
    border-left-color: #ffc107;
  }

  .log-error {
    background: #ffeaea;
    border-left-color: #dc3545;
  }

  .log-thinking {
    background: #f0e6ff;
    border-left-color: #6f42c1;
  }

  .log-processing {
    background: #e6f7ff;
    border-left-color: #17a2b8;
  }

  .log-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }

  .log-icon {
    font-size: 1.1rem;
  }

  .log-timestamp {
    font-size: 0.8rem;
    color: #6c757d;
    font-weight: 500;
  }

  .log-message {
    color: #212529;
    line-height: 1.4;
  }

  .log-details {
    margin-top: 0.25rem;
    font-size: 0.8rem;
    color: #6c757d;
    opacity: 0.8;
  }

  /* Scrollbar styling */
  .thinking-content::-webkit-scrollbar {
    width: 8px;
  }

  .thinking-content::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 4px;
  }

  .thinking-content::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 4px;
  }

  .thinking-content::-webkit-scrollbar-thumb:hover {
    background: #a8a8a8;
  }
</style>

