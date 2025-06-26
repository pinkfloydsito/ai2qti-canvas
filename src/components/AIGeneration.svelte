<script>
  import { aiGenerationStore, aiGenerationActions } from '../stores/llm.js';
  import { llmStore } from '../stores/llm.js';
  import { assessmentActions } from '../stores/assessment.js';
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  let aiParams = $aiGenerationStore;
  let llmConfig = $llmStore;
  let fileInput;
  
  // Subscribe to store changes
  aiGenerationStore.subscribe(value => {
    aiParams = value;
  });
  
  llmStore.subscribe(value => {
    llmConfig = value;
  });
  
  // Question type options
  const questionTypeOptions = [
    { value: 'multiple_choice', label: 'Multiple Choice' },
    { value: 'true_false', label: 'True/False' },
    { value: 'short_answer', label: 'Short Answer' },
    { value: 'essay', label: 'Essay' }
  ];
  
  function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      aiGenerationActions.setPdfFile(file, file.name);
      dispatch('pdfUploaded', { file });
    }
  }
  
  function triggerFileUpload() {
    fileInput.click();
  }
  
  function handleContextTextChange(event) {
    aiGenerationActions.updateParams({ contextText: event.target.value });
  }
  
  function handleQuestionCountChange(event) {
    aiGenerationActions.updateParams({ questionCount: parseInt(event.target.value) });
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
      newTypes = newTypes.filter(type => type !== value);
    }
    
    aiGenerationActions.updateParams({ questionTypes: newTypes });
  }
  
  function handleIncludeMathChange(event) {
    aiGenerationActions.updateParams({ includeMath: event.target.checked });
  }
  
  async function generateQuestions() {
    if (!llmConfig.isConfigured) {
      alert('Please configure your LLM provider first.');
      return;
    }
    
    if (!aiParams.contextText && !aiParams.pdfFile) {
      alert('Please provide either text context or upload a PDF file.');
      return;
    }
    
    if (aiParams.questionTypes.length === 0) {
      alert('Please select at least one question type.');
      return;
    }
    
    dispatch('generateQuestions', {
      contextText: aiParams.contextText,
      pdfFile: aiParams.pdfFile,
      questionCount: aiParams.questionCount,
      difficultyLevel: aiParams.difficultyLevel,
      questionTypes: aiParams.questionTypes,
      includeMath: aiParams.includeMath
    });
  }
  
  function clearPdf() {
    aiGenerationActions.clearPdf();
    if (fileInput) {
      fileInput.value = '';
    }
  }
</script>

<section class="ai-generation-section">
  <h2>AI Question Generation</h2>
  <div class="ai-controls">
    <div class="form-group">
      <label for="pdfUpload">Upload PDF or Enter Text:</label>
      <div class="upload-area">
        <input 
          type="file" 
          bind:this={fileInput}
          accept=".pdf" 
          style="display: none;"
          on:change={handleFileUpload}
        />
        <button class="btn btn-secondary" on:click={triggerFileUpload}>
          Choose PDF File
        </button>
        {#if aiParams.fileName}
          <span class="file-name">
            📄 {aiParams.fileName}
            <button class="btn-clear-file" on:click={clearPdf}>×</button>
          </span>
        {/if}
        {#if aiParams.isExtracting}
          <div class="extraction-progress">
            <div class="progress-bar">
              <div class="progress-fill" style="width: {aiParams.extractionProgress}%"></div>
            </div>
            <span>Extracting PDF... {aiParams.extractionProgress}%</span>
          </div>
        {/if}
      </div>
    </div>
    
    <div class="form-group">
      <label for="contextText">Or Enter Text Context:</label>
      <textarea 
        id="contextText" 
        placeholder="Enter the content/context for question generation... (If PDF upload fails, copy and paste your content here)" 
        rows="6"
        value={aiParams.contextText}
        on:input={handleContextTextChange}
      ></textarea>
      <small>💡 Tip: If PDF extraction doesn't work, you can copy text from your PDF and paste it here manually.</small>
    </div>
    
    <div class="form-group">
      <label for="questionCount">Number of Questions:</label>
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
      <label for="difficultyLevel">Difficulty Level:</label>
      <select 
        id="difficultyLevel" 
        value={aiParams.difficultyLevel}
        on:change={handleDifficultyChange}
      >
        <option value="easy">Easy</option>
        <option value="medium">Medium</option>
        <option value="hard">Hard</option>
        <option value="mixed">Mixed</option>
      </select>
    </div>
    
    <div class="form-group">
      <label>Question Types:</label>
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
        Include LaTeX math notation for mathematical content
      </label>
    </div>
    
    <button 
      class="btn btn-primary generate-btn" 
      on:click={generateQuestions}
      disabled={llmConfig.isGenerating || !llmConfig.isConfigured}
    >
      {#if llmConfig.isGenerating}
        🤖 Generating Questions...
      {:else}
        Generate Questions with AI
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