import { writable } from 'svelte/store';

// Assessment store for managing assessment data
export const assessmentStore = writable({
  title: '',
  description: '',
  timeLimit: 0,
  questions: []
});

// Helper functions for assessment operations
export const assessmentActions = {
  updateAssessment: (updates) => {
    assessmentStore.update(assessment => ({
      ...assessment,
      ...updates
    }));
  },
  
  addQuestion: (question) => {
    assessmentStore.update(assessment => ({
      ...assessment,
      questions: [...assessment.questions, { ...question, id: Date.now() }]
    }));
  },
  
  updateQuestion: (questionId, updates) => {
    assessmentStore.update(assessment => ({
      ...assessment,
      questions: assessment.questions.map(q => 
        q.id === questionId ? { ...q, ...updates } : q
      )
    }));
  },
  
  removeQuestion: (questionId) => {
    assessmentStore.update(assessment => ({
      ...assessment,
      questions: assessment.questions.filter(q => q.id !== questionId)
    }));
  },
  
  clearAssessment: () => {
    assessmentStore.set({
      title: '',
      description: '',
      timeLimit: 0,
      questions: []
    });
  },
  
  loadAssessment: (assessmentData) => {
    assessmentStore.set(assessmentData);
  }
};