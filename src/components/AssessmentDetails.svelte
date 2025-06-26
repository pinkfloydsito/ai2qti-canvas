<script>
  import { assessmentStore, assessmentActions } from '../stores/assessment.js';
  
  let assessment = $assessmentStore;
  
  // Subscribe to store changes
  assessmentStore.subscribe(value => {
    assessment = value;
  });
  
  function handleTitleChange(event) {
    assessmentActions.updateAssessment({ title: event.target.value });
  }
  
  function handleDescriptionChange(event) {
    assessmentActions.updateAssessment({ description: event.target.value });
  }
  
  function handleTimeLimitChange(event) {
    const value = parseInt(event.target.value) || 0;
    assessmentActions.updateAssessment({ timeLimit: value });
  }
</script>

<section class="assessment-details">
  <h2>Assessment Details</h2>
  <div class="details-form">
    <div class="form-group">
      <label for="assessmentTitle">Title:</label>
      <input 
        type="text" 
        id="assessmentTitle" 
        placeholder="Enter assessment title"
        value={assessment.title}
        on:input={handleTitleChange}
      />
    </div>
    
    <div class="form-group">
      <label for="assessmentDescription">Description:</label>
      <textarea 
        id="assessmentDescription" 
        placeholder="Enter assessment description"
        rows="3"
        value={assessment.description}
        on:input={handleDescriptionChange}
      ></textarea>
    </div>
    
    <div class="form-group">
      <label for="timeLimit">Time Limit (minutes):</label>
      <input 
        type="number" 
        id="timeLimit" 
        placeholder="0 for no limit"
        min="0"
        value={assessment.timeLimit || ''}
        on:input={handleTimeLimitChange}
      />
      <small>
        {#if assessment.timeLimit > 0}
          Students will have {assessment.timeLimit} minutes to complete this assessment.
        {:else}
          No time limit - students can take as long as needed.
        {/if}
      </small>
    </div>
    
    {#if assessment.questions.length > 0}
      <div class="assessment-summary">
        <h3>Assessment Summary</h3>
        <div class="summary-stats">
          <div class="stat">
            <strong>{assessment.questions.length}</strong>
            <span>Questions</span>
          </div>
          <div class="stat">
            <strong>{assessment.questions.reduce((sum, q) => sum + (q.points || 0), 0)}</strong>
            <span>Total Points</span>
          </div>
          <div class="stat">
            <strong>{assessment.timeLimit || 'No'}</strong>
            <span>Time Limit</span>
          </div>
        </div>
        
        <div class="question-types-summary">
          <h4>Question Types:</h4>
          <div class="type-counts">
            {#each Object.entries(assessment.questions.reduce((acc, q) => {
              acc[q.type] = (acc[q.type] || 0) + 1;
              return acc;
            }, {})) as [type, count]}
              <span class="type-badge">
                {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}: {count}
              </span>
            {/each}
          </div>
        </div>
      </div>
    {/if}
  </div>
</section>

<style>
  .assessment-details {
    background: #fff3cd;
    border: 1px solid #ffeaa7;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 20px;
  }
  
  .assessment-details h2 {
    margin-bottom: 15px;
    color: #856404;
    font-size: 18px;
    font-weight: 600;
  }
  
  .details-form {
    display: grid;
    gap: 15px;
  }
  
  .assessment-summary {
    background: #f8f9fa;
    border: 1px solid #dee2e6;
    border-radius: 8px;
    padding: 15px;
    margin-top: 10px;
  }
  
  .assessment-summary h3 {
    margin-bottom: 10px;
    color: #495057;
    font-size: 16px;
  }
  
  .summary-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: 15px;
    margin-bottom: 15px;
  }
  
  .stat {
    text-align: center;
    padding: 10px;
    background: white;
    border-radius: 4px;
    border: 1px solid #e9ecef;
  }
  
  .stat strong {
    display: block;
    font-size: 24px;
    color: #007bff;
    margin-bottom: 2px;
  }
  
  .stat span {
    font-size: 12px;
    color: #6c757d;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .question-types-summary h4 {
    margin-bottom: 8px;
    color: #495057;
    font-size: 14px;
  }
  
  .type-counts {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  
  .type-badge {
    background: #007bff;
    color: white;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
  }
  
  @media (max-width: 768px) {
    .summary-stats {
      grid-template-columns: repeat(2, 1fr);
    }
    
    .type-counts {
      flex-direction: column;
    }
  }
</style>