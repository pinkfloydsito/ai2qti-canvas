import { writable } from 'svelte/store';

// LLM configuration store
export const llmStore = writable({
  provider: 'gemini',
  apiKey: '',
  isConfigured: false,
  isGenerating: false,
  lastError: null
});

// AI generation parameters store
export const aiGenerationStore = writable({
  contextText: '',
  pdfFile: null,
  fileName: '',
  questionCount: 5,
  difficultyLevel: 'hard',
  questionTypes: ['multiple_choice'],
  includeMath: true,
  isExtracting: false,
  extractionProgress: 0
});

// Helper functions for LLM operations
export const llmActions = {
  updateConfig: (config) => {
    llmStore.update(store => ({
      ...store,
      ...config,
      isConfigured: !!(config.apiKey && config.provider)
    }));
  },

  setGenerating: (isGenerating) => {
    llmStore.update(store => ({
      ...store,
      isGenerating
    }));
  },

  setError: (error) => {
    llmStore.update(store => ({
      ...store,
      lastError: error,
      isGenerating: false
    }));
  },

  clearError: () => {
    llmStore.update(store => ({
      ...store,
      lastError: null
    }));
  }
};

export const aiGenerationActions = {
  updateParams: (params) => {
    aiGenerationStore.update(store => ({
      ...store,
      ...params
    }));
  },

  setPdfFile: (file, fileName) => {
    aiGenerationStore.update(store => ({
      ...store,
      pdfFile: file,
      fileName: fileName
    }));
  },

  setExtracting: (isExtracting, progress = 0) => {
    aiGenerationStore.update(store => ({
      ...store,
      isExtracting,
      extractionProgress: progress
    }));
  },

  clearPdf: () => {
    aiGenerationStore.update(store => ({
      ...store,
      pdfFile: null,
      fileName: '',
      contextText: ''
    }));
  }
};
