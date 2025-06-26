<script>
  import { assessmentStore, assessmentActions } from '../stores/assessment.js';
  import QuestionItem from './QuestionItem.svelte';
  
  let assessment = $assessmentStore;
  let selectedQuestionType = 'multiple_choice';
  
  // Subscribe to store changes
  assessmentStore.subscribe(value => {
    assessment = value;
  });
  
  const questionTypes = [
    { value: 'multiple_choice', label: 'Multiple Choice' },
    { value: 'true_false', label: 'True/False' },
    { value: 'short_answer', label: 'Short Answer' },
    { value: 'essay', label: 'Essay' },
    { value: 'fill_in_blank', label: 'Fill in the Blank' }
  ];
  
  function addQuestion() {
    const newQuestion = {
      type: selectedQuestionType,
      text: '',
      points: selectedQuestionType === 'essay' ? 5 : 1,
      choices: selectedQuestionType === 'multiple_choice' ? [
        { text: '', correct: true },
        { text: '', correct: false }
      ] : undefined,
      correctAnswer: selectedQuestionType === 'true_false' ? 'true' : undefined
    };
    
    assessmentActions.addQuestion(newQuestion);
  }
  
  function removeQuestion(questionId) {
    assessmentActions.removeQuestion(questionId);
  }
  
  function updateQuestion(questionId, updates) {
    assessmentActions.updateQuestion(questionId, updates);
  }
</script>

<section class="questions-section">
  <div class="questions-header">
    <h2>Questions ({assessment.questions.length})</h2>
    <div class="question-controls">
      <select bind:value={selectedQuestionType}>
        {#each questionTypes as type}
          <option value={type.value}>{type.label}</option>
        {/each}
      </select>
      <button class="btn btn-primary" on:click={addQuestion}>
        Add Question
      </button>
    </div>
  </div>
  
  <div class="questions-container">
    {#if assessment.questions.length === 0}
      <div class="empty-state">
        <div class="empty-icon">📝</div>
        <h3>No Questions Yet</h3>
        <p>Add your first question using the controls above, or generate questions with AI.</p>
      </div>
    {:else}
      {#each assessment.questions as question, index (question.id)}
        <QuestionItem 
          {question}
          questionNumber={index + 1}
          on:update={(event) => updateQuestion(question.id, event.detail)}
          on:remove={() => removeQuestion(question.id)}
        />
      {/each}
    {/if}
  </div>
</section>

<style>
  .questions-section {
    background: #f8f9fa;
    border: 1px solid #dee2e6;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 20px;
  }
  
  .questions-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    flex-wrap: wrap;
    gap: 15px;
  }
  
  .questions-header h2 {
    margin: 0;
    color: #495057;
    font-size: 18px;
    font-weight: 600;
  }
  
  .question-controls {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  
  .question-controls select {
    padding: 6px 10px;
    border: 1px solid #ced4da;
    border-radius: 4px;
    background: white;
    font-size: 14px;
  }
  
  .questions-container {
    display: grid;
    gap: 20px;
  }
  
  .empty-state {
    text-align: center;
    padding: 40px 20px;
    color: #6c757d;
  }
  
  .empty-icon {
    font-size: 48px;
    margin-bottom: 15px;
  }
  
  .empty-state h3 {
    margin-bottom: 10px;
    color: #495057;
  }
  
  .empty-state p {
    max-width: 400px;
    margin: 0 auto;
    line-height: 1.5;
  }
  
  @media (max-width: 768px) {
    .questions-header {
      flex-direction: column;
      align-items: stretch;
    }
    
    .question-controls {
      justify-content: stretch;
    }
    
    .question-controls select,
    .question-controls button {
      flex: 1;
    }
  }
</style>