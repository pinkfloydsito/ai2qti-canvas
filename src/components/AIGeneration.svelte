<script>
  import { aiGenerationStore, aiGenerationActions } from "../stores/llm.js";
  import { llmStore } from "../stores/llm.js";
  import { createEventDispatcher } from "svelte";
  import { t } from "../stores/localization.js";

  const dispatch = createEventDispatcher();

  let aiParams = $aiGenerationStore;
  let llmConfig = $llmStore;
  let fileInput;
  let attachedFiles = [];
  let useAttachmentOnly = false;

  // Default prompt for attachment-only mode
  const attachmentOnlyPrompt = `Generar preguntas basadas únicamente en los archivos adjuntos. 
      No usar texto adicional, considerar uso de las tildes, sen en vez de sin para las funciones in latex. Considerar que los ejercicios empiezan en \\begin{ejerc}, tomar todos los ejercicios y no solo el primero. 
      No usar el texto de contexto, solo los archivos adjuntos.`;

  // Reactive variable to track if files are attached
  $: hasAttachedFiles = attachedFiles.length > 0 || aiParams.fileName;

  // Subscribe to store changes
  aiGenerationStore.subscribe((value) => {
    aiParams = value;
  });

  llmStore.subscribe((value) => {
    llmConfig = value;
  });

  // Question type options
  $: questionTypeOptions = [
    {
      value: "multiple_choice",
      label: $t("aiGeneration.typeLabels.multipleChoice"),
    },
    { value: "true_false", label: $t("aiGeneration.typeLabels.trueFalse") },
    { value: "short_answer", label: $t("aiGeneration.typeLabels.shortAnswer") },
    { value: "essay", label: $t("aiGeneration.typeLabels.essay") },
  ];

  // File upload functionality
  async function handleFileUpload(event) {
    const files = Array.from(event.target.files);

    for (const file of files) {
      const ext = file.name.toLowerCase().split(".").pop();

      if (!["pdf", "tex", "txt"].includes(ext)) {
        alert(`Unsupported file type: .${ext}. Supported: .pdf, .tex, .txt`);
        continue;
      }

      // Create temporary file path for processing
      const tempPath = await window.electronAPI.saveTemporaryFile(file);

      attachedFiles = [
        ...attachedFiles,
        {
          name: file.name,
          path: tempPath,
          type: ext,
          size: file.size,
        },
      ];
    }

    // Clear file input
    if (fileInput) {
      fileInput.value = "";
    }

    // If attachment-only mode is enabled, update context text
    if (useAttachmentOnly && hasAttachedFiles) {
      aiGenerationActions.updateParams({ contextText: attachmentOnlyPrompt });
    }
  }

  function triggerFileUpload() {
    fileInput?.click();
  }

  function removeFile(index) {
    attachedFiles = attachedFiles.filter((_, i) => i !== index);

    // If no files remain and attachment-only mode is enabled, clear context text
    if (attachedFiles.length === 0 && useAttachmentOnly) {
      aiGenerationActions.updateParams({ contextText: "" });
    }
  }

  function handleContextTextChange(event) {
    aiGenerationActions.updateParams({ contextText: event.target.value });
  }

  function handleQuestionCountChange(event) {
    aiGenerationActions.updateParams({
      questionCount: parseInt(event.target.value),
    });
  }

  function handleDifficultyChange(event) {
    aiGenerationActions.updateParams({ difficultyLevel: event.target.value });
  }

  function handleQuestionTypeChange(event) {
    const checkbox = event.target;
    const value = checkbox.value;
    let newTypes = [...aiParams.questionTypes];

    if (checkbox.checked) {
      if (!newTypes.includes(value)) {
        newTypes.push(value);
      }
    } else {
      newTypes = newTypes.filter((type) => type !== value);
    }

    aiGenerationActions.updateParams({ questionTypes: newTypes });
  }

  function handleIncludeMathChange(event) {
    aiGenerationActions.updateParams({ includeMath: event.target.checked });
  }

  function handleAttachmentOnlyChange(event) {
    useAttachmentOnly = event.target.checked;

    if (useAttachmentOnly && hasAttachedFiles) {
      // Set the default prompt when enabling attachment-only mode
      aiGenerationActions.updateParams({ contextText: attachmentOnlyPrompt });
    } else if (!useAttachmentOnly) {
      // Clear the prompt when disabling attachment-only mode
      aiGenerationActions.updateParams({ contextText: "" });
    }
  }

  function useAttachmentOnlyPrompt() {
    aiGenerationActions.updateParams({ contextText: attachmentOnlyPrompt });
    useAttachmentOnly = true;
  }

  async function generateQuestions() {
    console.log("🔧 AIGeneration: LLM configured?", llmConfig.isConfigured);
    console.log(
      "📝 AIGeneration: Context text:",
      aiParams.contextText?.substring(0, 100) + "...",
    );
    console.log("AIGeneration: Question types:", aiParams.questionTypes);

    if (!llmConfig.isConfigured) {
      alert("Please configure your LLM provider first.");
      return;
    }

    if (!aiParams.contextText && attachedFiles.length === 0) {
      alert($t("messages.errors.noContext"));
      return;
    }

    if (aiParams.questionTypes.length === 0) {
      alert($t("messages.errors.noQuestionTypes"));
      return;
    }

    console.log("AIGeneration: Dispatching generateQuestions event");
    dispatch("generateQuestions", {
      contextText: aiParams.contextText,
      pdfFile: aiParams.pdfFile,
      attachments: attachedFiles,
      questionCount: aiParams.questionCount,
      difficultyLevel: aiParams.difficultyLevel,
      questionTypes: aiParams.questionTypes,
      includeMath: aiParams.includeMath,
    });
  }

  function clearPdf() {
    aiGenerationActions.clearPdf();
    if (fileInput) {
      fileInput.value = "";
    }

    // If attachment-only mode is enabled and no files remain, clear context text
    if (useAttachmentOnly && !hasAttachedFiles) {
      aiGenerationActions.updateParams({ contextText: "" });
    }
  }
</script>

<section class="ai-generation-section">
  <h2>{$t("aiGeneration.title")}</h2>
  <div class="ai-controls">
    <div class="form-group">
      <label for="pdfUpload">{$t("aiGeneration.uploadPdf")}</label>
      <div class="upload-area">
        <input
          type="file"
          bind:this={fileInput}
          accept=".pdf,.tex,.txt"
          multiple
          style="display: none;"
          on:change={handleFileUpload}
        />
        <button class="btn btn-secondary" on:click={triggerFileUpload}>
          📎 {$t("aiGeneration.chooseFile")}
        </button>
        {#if aiParams.fileName}
          <span class="file-name">
            📄 {aiParams.fileName}
            <button class="btn-clear-file" on:click={clearPdf}>×</button>
          </span>
        {/if}

        {#if attachedFiles.length > 0}
          <div class="attached-files">
            {#each attachedFiles as file, index}
              <span class="attached-file">
                📎 {file.name} ({(file.size / 1024).toFixed(1)}KB)
                <button
                  class="btn-clear-file"
                  on:click={() => removeFile(index)}>×</button
                >
              </span>
            {/each}
          </div>
        {/if}
        {#if aiParams.isExtracting}
          <div class="extraction-progress">
            <div class="progress-bar">
              <div
                class="progress-fill"
                style="width: {aiParams.extractionProgress}%"
              ></div>
            </div>
            <span
              >{$t("processing.extractingPdf")}
              {aiParams.extractionProgress}%</span
            >
          </div>
        {/if}
      </div>
    </div>

    <div class="form-group">
      <label for="contextText">{$t("aiGeneration.contextText")}</label>
      <div class="context-controls">
        <button
          class="btn btn-outline"
          type="button"
          on:click={useAttachmentOnlyPrompt}
          disabled={!hasAttachedFiles}
        >
          📎 Use Attachment Content
        </button>
      </div>
      <textarea
        id="contextText"
        placeholder={$t("aiGeneration.contextPlaceholder")}
        rows="6"
        value={aiParams.contextText}
        on:input={handleContextTextChange}
      ></textarea>
      <small>{$t("aiGeneration.tip")}</small>
    </div>

    <div class="form-group">
      <label for="questionCount">{$t("aiGeneration.questionCount")}</label>
      <input
        type="number"
        id="questionCount"
        value={aiParams.questionCount}
        min="1"
        max="20"
        disabled={hasAttachedFiles && useAttachmentOnly}
        on:input={handleQuestionCountChange}
      />
      {#if hasAttachedFiles && useAttachmentOnly}
        <small class="disabled-note"
          >Question count disabled when using attachment-only mode</small
        >
      {/if}
    </div>

    <div class="form-group">
      <label for="difficultyLevel">{$t("aiGeneration.difficulty")}</label>
      <select
        id="difficultyLevel"
        value={aiParams.difficultyLevel}
        disabled={hasAttachedFiles && useAttachmentOnly}
        on:change={handleDifficultyChange}
      >
        <option value="easy">{$t("aiGeneration.difficultyLevels.easy")}</option>
        <option value="medium"
          >{$t("aiGeneration.difficultyLevels.medium")}</option
        >
        <option value="hard">{$t("aiGeneration.difficultyLevels.hard")}</option>
        <option value="mixed"
          >{$t("aiGeneration.difficultyLevels.mixed")}</option
        >
      </select>
      {#if hasAttachedFiles && useAttachmentOnly}
        <small class="disabled-note"
          >Difficulty disabled when using attachment-only mode</small
        >
      {/if}
    </div>

    <div class="form-group">
      <label>{$t("aiGeneration.questionTypes")}</label>
      <div class="checkbox-group">
        {#each questionTypeOptions as option}
          <label
            class="checkbox-label"
            class:disabled={hasAttachedFiles && useAttachmentOnly}
          >
            <input
              type="checkbox"
              value={option.value}
              checked={aiParams.questionTypes.includes(option.value)}
              disabled={hasAttachedFiles && useAttachmentOnly}
              on:change={handleQuestionTypeChange}
            />
            {option.label}
          </label>
        {/each}
      </div>
      {#if hasAttachedFiles && useAttachmentOnly}
        <small class="disabled-note"
          >Question types disabled when using attachment-only mode</small
        >
      {/if}
    </div>

    <div class="form-group">
      <label class="checkbox-label">
        <input
          type="checkbox"
          checked={aiParams.includeMath}
          on:change={handleIncludeMathChange}
        />
        {$t("aiGeneration.includeMath")}
      </label>
    </div>

    <div class="form-group">
      <label class="checkbox-label">
        <input
          type="checkbox"
          checked={useAttachmentOnly}
          disabled={!hasAttachedFiles}
          on:change={handleAttachmentOnlyChange}
        />
        Generar preguntas solo con archivos adjuntos
      </label>
      {#if !hasAttachedFiles}
        <small class="disabled-note">Attach files to enable this option</small>
      {/if}
    </div>

    <button
      class="btn btn-primary generate-btn"
      on:click={generateQuestions}
      disabled={llmConfig.isGenerating || !llmConfig.isConfigured}
    >
      {#if llmConfig.isGenerating}
        🤖 {$t("aiGeneration.generating")}
      {:else}
        {$t("aiGeneration.generateBtn")}
      {/if}
    </button>
  </div>
</section>

<style>
  .ai-generation-section {
    background: #e8f4fd;
    border: 1px solid #bee5eb;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 20px;
  }

  .ai-generation-section h2 {
    margin-bottom: 15px;
    color: #0c5460;
    font-size: 18px;
    font-weight: 600;
  }

  .ai-controls {
    display: grid;
    gap: 15px;
  }

  .upload-area {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .file-name {
    display: flex;
    align-items: center;
    gap: 5px;
    background: #d4edda;
    padding: 5px 10px;
    border-radius: 4px;
    color: #155724;
    font-size: 14px;
  }

  .btn-clear-file {
    background: none;
    border: none;
    cursor: pointer;
    color: #155724;
    font-size: 16px;
    padding: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 2px;
  }

  .btn-clear-file:hover {
    background: rgba(0, 0, 0, 0.1);
  }

  .attached-files {
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin-top: 10px;
  }

  .attached-file {
    display: flex;
    align-items: center;
    gap: 5px;
    background: #e7f3ff;
    padding: 5px 10px;
    border-radius: 4px;
    color: #004085;
    font-size: 14px;
  }

  .extraction-progress {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    color: #0c5460;
  }

  .progress-bar {
    width: 200px;
    height: 8px;
    background: #ccc;
    border-radius: 4px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #17a2b8, #20c997);
    transition: width 0.3s ease;
  }

  .checkbox-group {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 10px;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-weight: normal;
  }

  .checkbox-label input[type="checkbox"] {
    width: auto;
    margin: 0;
  }

  .generate-btn {
    padding: 12px 24px;
    font-size: 16px;
    font-weight: 600;
    justify-self: start;
    min-width: 200px;
  }

  .generate-btn:disabled {
    background: #6c757d;
    cursor: not-allowed;
  }

  .context-controls {
    margin-bottom: 10px;
  }

  .btn-outline {
    background: transparent;
    border: 1px solid #17a2b8;
    color: #17a2b8;
    padding: 6px 12px;
    font-size: 14px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-outline:hover:not(:disabled) {
    background: #17a2b8;
    color: white;
  }

  .btn-outline:disabled {
    border-color: #6c757d;
    color: #6c757d;
    cursor: not-allowed;
  }

  .disabled-note {
    color: #6c757d;
    font-style: italic;
    margin-top: 5px;
    display: block;
  }

  .checkbox-label.disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  input:disabled,
  select:disabled {
    background-color: #e9ecef;
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    .upload-area {
      flex-direction: column;
      align-items: stretch;
    }

    .checkbox-group {
      grid-template-columns: 1fr;
    }

    .generate-btn {
      justify-self: stretch;
    }
  }
</style>
