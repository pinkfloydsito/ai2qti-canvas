<script>
  import { createEventDispatcher } from 'svelte';
  
  export let question;
  export let questionNumber;
  
  const dispatch = createEventDispatcher();
  
  function updateQuestion(updates) {
    dispatch('update', updates);
  }
  
  function removeQuestion() {
    dispatch('remove');
  }
  
  function handleTextChange(event) {
    updateQuestion({ text: event.target.value });
  }
  
  function handlePointsChange(event) {
    updateQuestion({ points: parseInt(event.target.value) || 0 });
  }
  
  function handleCorrectAnswerChange(event) {
    updateQuestion({ correctAnswer: event.target.value });
  }
  
  function addChoice() {
    const newChoices = [...(question.choices || []), { text: '', correct: false }];
    updateQuestion({ choices: newChoices });
  }
  
  function removeChoice(index) {
    const newChoices = question.choices.filter((_, i) => i !== index);
    updateQuestion({ choices: newChoices });
  }
  
  function updateChoice(index, text) {
    const newChoices = question.choices.map((choice, i) => 
      i === index ? { ...choice, text } : choice
    );
    updateQuestion({ choices: newChoices });
  }
  
  function setCorrectChoice(index) {
    const newChoices = question.choices.map((choice, i) => ({
      ...choice,
      correct: i === index
    }));
    updateQuestion({ choices: newChoices, correctAnswer: index });
  }
  
  $: questionTypeLabel = question.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
</script>

<div class="question-item" data-type={question.type}>
  <div class="question-header">
    <div class="question-info">
      <span class="question-number">Question {questionNumber}</span>
      <span class="question-type">{questionTypeLabel}</span>
    </div>
    <button class="btn-remove" on:click={removeQuestion} title="Remove question">
      ×
    </button>
  </div>
  
  <div class="question-content">
    <div class="form-group">
      <label>Question Text:</label>
      <textarea 
        class="question-text" 
        placeholder="Enter your question (LaTeX supported: use $ for inline math, $$ for display math)"
        value={question.text}
        on:input={handleTextChange}
        rows="3"
      ></textarea>
      <!-- TODO: Add math preview -->
    </div>
    
    <div class="form-group">
      <label>Points:</label>
      <input 
        type="number" 
        class="question-points" 
        value={question.points || 0} 
        min="0"
        on:input={handlePointsChange}
      />
    </div>
    
    {#if question.type === 'multiple_choice'}
      <div class="choices-container">
        <label>Answer Choices:</label>
        {#each question.choices || [] as choice, index}
          <div class="choice-item">
            <input 
              type="radio" 
              name="correct-choice-{question.id}" 
              checked={choice.correct}
              on:change={() => setCorrectChoice(index)}
            />
            <input 
              type="text" 
              class="choice-text" 
              placeholder="Choice {String.fromCharCode(65 + index)} (LaTeX supported)"
              value={choice.text}
              on:input={(e) => updateChoice(index, e.target.value)}
            />
            {#if question.choices.length > 2}
              <button class="btn-remove-choice" on:click={() => removeChoice(index)}>×</button>
            {/if}
          </div>
        {/each}
        <button class="btn-add-choice" on:click={addChoice}>Add Choice</button>
      </div>
    {/if}
    
    {#if question.type === 'true_false'}
      <div class="form-group">
        <label>Correct Answer:</label>
        <select 
          class="correct-answer"
          value={question.correctAnswer || 'true'}
          on:change={handleCorrectAnswerChange}
        >
          <option value="true">True</option>
          <option value="false">False</option>
        </select>
      </div>
    {/if}
    
    {#if question.type === 'short_answer'}
      <div class="form-group">
        <label>Sample Answer (optional):</label>
        <textarea 
          class="sample-answer" 
          placeholder="Enter a sample answer for grading reference"
          value={question.sampleAnswer || ''}
          on:input={(e) => updateQuestion({ sampleAnswer: e.target.value })}
          rows="2"
        ></textarea>
      </div>
    {/if}
    
    {#if question.type === 'essay'}
      <div class="form-group">
        <label>Grading Rubric (optional):</label>
        <textarea 
          class="grading-rubric" 
          placeholder="Enter grading criteria"
          value={question.gradingRubric || ''}
          on:input={(e) => updateQuestion({ gradingRubric: e.target.value })}
          rows="3"
        ></textarea>
      </div>
    {/if}
  </div>
</div>

<style>
  .question-item {
    background: white;
    border: 1px solid #dee2e6;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  .question-header {
    background: #f8f9fa;
    padding: 15px 20px;
    border-bottom: 1px solid #dee2e6;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .question-info {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  
  .question-number {
    font-weight: 600;
    color: #495057;
  }
  
  .question-type {
    background: #007bff;
    color: white;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
  }
  
  .btn-remove {
    background: #dc3545;
    color: white;
    border: none;
    border-radius: 50%;
    width: 30px;
    height: 30px;
    cursor: pointer;
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.2s;
  }
  
  .btn-remove:hover {
    background: #c82333;
  }
  
  .question-content {
    padding: 20px;
  }
  
  .choices-container {
    margin-top: 15px;
  }
  
  .choices-container label {
    display: block;
    margin-bottom: 10px;
    font-weight: 500;
  }
  
  .choice-item {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }
  
  .choice-item input[type="radio"] {
    width: auto;
    margin: 0;
  }
  
  .choice-text {
    flex: 1;
  }
  
  .btn-remove-choice {
    background: #6c757d;
    color: white;
    border: none;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .btn-remove-choice:hover {
    background: #545b62;
  }
  
  .btn-add-choice {
    background: #28a745;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 6px 12px;
    cursor: pointer;
    font-size: 14px;
    margin-top: 5px;
  }
  
  .btn-add-choice:hover {
    background: #218838;
  }
  
  .question-text,
  .sample-answer,
  .grading-rubric {
    min-height: 60px;
    resize: vertical;
  }
  
  @media (max-width: 768px) {
    .question-header {
      padding: 10px 15px;
    }
    
    .question-content {
      padding: 15px;
    }
    
    .choice-item {
      flex-wrap: wrap;
    }
    
    .choice-text {
      min-width: 200px;
    }
  }
</style>