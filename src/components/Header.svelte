<script>
  import { assessmentActions } from '../stores/assessment.js';
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  function newAssessment() {
    assessmentActions.clearAssessment();
    dispatch('newAssessment');
  }
  
  function saveAssessment() {
    dispatch('saveAssessment');
  }
  
  function exportQTI() {
    dispatch('exportQTI');
  }
</script>

<header class="header">
  <div class="header-content">
    <h1>QTI Generator for Canvas LMS</h1>
    <div class="toolbar">
      <button class="btn btn-primary" on:click={newAssessment}>
        New Assessment
      </button>
      <button class="btn btn-secondary" on:click={saveAssessment}>
        Save
      </button>
      <button class="btn btn-success" on:click={exportQTI}>
        Export QTI
      </button>
    </div>
  </div>
</header>

<style>
  .header {
    background: #2c3e50;
    color: white;
    padding: 20px;
    border-bottom: 3px solid #34495e;
  }
  
  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 15px;
  }
  
  h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 300;
  }
  
  .toolbar {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  
  @media (max-width: 768px) {
    .header-content {
      flex-direction: column;
      align-items: stretch;
    }
    
    .toolbar {
      justify-content: center;
    }
  }
</style>