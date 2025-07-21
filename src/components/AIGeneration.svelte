<script>
  import { aiGenerationStore, aiGenerationActions } from "../stores/llm.js";
  import { llmStore } from "../stores/llm.js";
  import { assessmentActions } from "../stores/assessment.js";
  import { createEventDispatcher } from "svelte";
  import { t } from "../stores/localization.js";

  const dispatch = createEventDispatcher();

  let aiParams = $aiGenerationStore;
  let llmConfig = $llmStore;
  let fileInput;
  let attachedFiles = [];

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
      const ext = file.name.toLowerCase().split('.').pop();
      
      if (!['pdf', 'tex', 'txt'].includes(ext)) {
        alert(`Unsupported file type: .${ext}. Supported: .pdf, .tex, .txt`);
        continue;
      }
      
      // Create temporary file path for processing
      const tempPath = await window.electronAPI.saveTemporaryFile(file);
      
      attachedFiles = [...attachedFiles, {
        name: file.name,
        path: tempPath,
        type: ext,
        size: file.size
      }];
    }
    
    // Clear file input
    if (fileInput) {
      fileInput.value = '';
    }
  }

  function triggerFileUpload() {
    fileInput?.click();
  }
  
  function removeFile(index) {
    attachedFiles = attachedFiles.filter((_, i) => i !== index);
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

  async function generateQuestions() {
    console.log("🤖 AIGeneration: Generate button clicked");
    console.log("🔧 AIGeneration: LLM configured?", llmConfig.isConfigured);
    console.log(
      "📝 AIGeneration: Context text:",
      aiParams.contextText?.substring(0, 100) + "...",
    );
    console.log("📄 AIGeneration: PDF file:", aiParams.pdfFile?.name);
    console.log("🎯 AIGeneration: Question types:", aiParams.questionTypes);

    if (!llmConfig.isConfigured) {
      alert("Please configure your LLM provider first.");
      return;
    }

    if (!aiParams.contextText && !aiParams.pdfFile && attachedFiles.length === 0) {
      alert($t("messages.errors.noContext"));
      return;
    }

    if (aiParams.questionTypes.length === 0) {
      alert($t("messages.errors.noQuestionTypes"));
      return;
    }

    console.log("🚀 AIGeneration: Dispatching generateQuestions event");
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
                <button class="btn-clear-file" on:click={() => removeFile(index)}>×</button>
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
        on:input={handleQuestionCountChange}
      />
    </div>

    <div class="form-group">
      <label for="difficultyLevel">{$t("aiGeneration.difficulty")}</label>
      <select
        id="difficultyLevel"
        value={aiParams.difficultyLevel}
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
    </div>

    <div class="form-group">
      <label>{$t("aiGeneration.questionTypes")}</label>
      <div class="checkbox-group">
        {#each questionTypeOptions as option}
          <label class="checkbox-label">
            <input
              type="checkbox"
              value={option.value}
              checked={aiParams.questionTypes.includes(option.value)}
              on:change={handleQuestionTypeChange}
            />
            {option.label}
          </label>
        {/each}
      </div>
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

