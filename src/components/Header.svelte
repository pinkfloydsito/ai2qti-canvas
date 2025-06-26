<script>
  import { assessmentActions } from '../stores/assessment.js';
  import { createEventDispatcher } from 'svelte';
  import { t, currentLanguage, setLanguage } from '../stores/localization.js';
  
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
  
  function handleLanguageChange(event) {
    setLanguage(event.target.value);
  }
</script>

<header class="header">
  <div class="header-content">
    <h1>{$t('app.title')}</h1>
    <div class="toolbar">
      <button class="btn btn-primary" on:click={newAssessment}>
        {$t('app.toolbar.newAssessment')}
      </button>
      <button class="btn btn-secondary" on:click={saveAssessment}>
        {$t('app.toolbar.save')}
      </button>
      <button class="btn btn-success" on:click={exportQTI}>
        {$t('app.toolbar.exportQTI')}
      </button>
      <select class="language-selector" value={$currentLanguage} on:change={handleLanguageChange}>
        <option value="en">English</option>
        <option value="es">Español</option>
      </select>
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
    align-items: center;
  }
  
  .language-selector {
    padding: 8px 12px;
    border: 1px solid #34495e;
    border-radius: 4px;
    background: white;
    color: #2c3e50;
    font-size: 14px;
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