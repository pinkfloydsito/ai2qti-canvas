<script>
  import { llmStore, llmActions } from '../stores/llm.js';
  
  let config = $llmStore;
  
  // Subscribe to store changes
  llmStore.subscribe(value => {
    config = value;
  });
  
  // Provider options with help links
  const providers = [
    { 
      value: 'gemini', 
      label: 'Google Gemini (Recommended)', 
      helpLink: 'https://makersuite.google.com/app/apikey' 
    },
    { 
      value: 'mistral', 
      label: 'Mistral AI (Free)', 
      helpLink: 'https://console.mistral.ai/' 
    },
    { 
      value: 'deepseek', 
      label: 'DeepSeek (Math-focused)', 
      helpLink: 'https://platform.deepseek.com/api_keys' 
    },
    { 
      value: 'huggingface', 
      label: 'Hugging Face (Free)', 
      helpLink: 'https://huggingface.co/settings/tokens' 
    }
  ];
  
  function handleProviderChange(event) {
    const newProvider = event.target.value;
    llmActions.updateConfig({ 
      provider: newProvider,
      apiKey: config.apiKey // Keep existing API key
    });
  }
  
  function handleApiKeyChange(event) {
    const newApiKey = event.target.value;
    llmActions.updateConfig({ 
      provider: config.provider,
      apiKey: newApiKey 
    });
  }
  
  $: currentProvider = providers.find(p => p.value === config.provider);
</script>

<section class="settings-section">
  <h2>LLM Configuration</h2>
  <div class="settings-controls">
    <div class="form-group">
      <label for="llmProvider">LLM Provider:</label>
      <select 
        id="llmProvider" 
        value={config.provider} 
        on:change={handleProviderChange}
      >
        {#each providers as provider}
          <option value={provider.value}>{provider.label}</option>
        {/each}
      </select>
    </div>
    
    <div class="form-group">
      <label for="apiKey">API Key:</label>
      <input 
        type="password" 
        id="apiKey" 
        placeholder="Enter your API key"
        value={config.apiKey}
        on:input={handleApiKeyChange}
      />
      {#if currentProvider}
        <small>
          Get your free API key from 
          <a href={currentProvider.helpLink} target="_blank" rel="noopener noreferrer">
            {currentProvider.label.split(' ')[0]} {currentProvider.label.includes('Google') ? 'AI Studio' : 'API Console'}
          </a>
        </small>
      {/if}
    </div>
    
    {#if config.lastError}
      <div class="error-message">
        <strong>Error:</strong> {config.lastError}
        <button class="btn-close" on:click={() => llmActions.clearError()}>×</button>
      </div>
    {/if}
    
    {#if config.isConfigured}
      <div class="success-message">
        ✅ LLM provider configured successfully
      </div>
    {/if}
  </div>
</section>

<style>
  .settings-section {
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 20px;
  }
  
  .settings-section h2 {
    margin-bottom: 15px;
    color: #2c3e50;
    font-size: 18px;
    font-weight: 600;
  }
  
  .settings-controls {
    display: grid;
    gap: 15px;
  }
  
  .error-message {
    background: #f8d7da;
    color: #721c24;
    padding: 10px;
    border-radius: 4px;
    border: 1px solid #f5c6cb;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .success-message {
    background: #d4edda;
    color: #155724;
    padding: 10px;
    border-radius: 4px;
    border: 1px solid #c3e6cb;
  }
  
  .btn-close {
    background: none;
    border: none;
    font-size: 18px;
    cursor: pointer;
    color: #721c24;
    padding: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .btn-close:hover {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 2px;
  }
  
  @media (min-width: 768px) {
    .settings-controls {
      grid-template-columns: 1fr 2fr;
      align-items: start;
    }
  }
</style>