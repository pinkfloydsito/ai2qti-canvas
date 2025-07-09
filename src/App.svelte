<script>
  import Header from "./components/Header.svelte";
  import LLMConfiguration from "./components/LLMConfiguration.svelte";
  import AIGeneration from "./components/AIGeneration.svelte";
  // import ThinkingCanvas from "./components/ThinkingCanvas.svelte";
  import AssessmentDetails from "./components/AssessmentDetails.svelte";
  import QuestionsSection from "./components/QuestionsSection.svelte";
  import { assessmentStore } from "./stores/assessment.js";
  import { llmStore } from "./stores/llm.js";
  import { t } from "./stores/localization.js";

  // Initialize services (dynamically imported to avoid conflicts)
  let qtiGenerator;
  
  // Initialize QTI generator on component mount
  import { onMount } from 'svelte';
  onMount(async () => {
    const { qtiGenerator: generator } = await import('./services/qti-generator.js');
    qtiGenerator = generator;
  });

  let assessment = $assessmentStore;
  let llmConfig = $llmStore;

  // Subscribe to store changes
  assessmentStore.subscribe((value) => {
    assessment = value;
  });

  llmStore.subscribe((value) => {
    llmConfig = value;
  });

  // Event handlers
  async function handleNewAssessment() {
    qtiGenerator.newAssessment();
  }

  async function handleSaveAssessment() {
    try {
      await qtiGenerator.saveAssessment(assessment);
      alert("Assessment saved successfully!");
    } catch (error) {
      alert(`Error saving assessment: ${error.message}`);
    }
  }

  async function handleExportQTI() {
    try {
      if (assessment.questions.length === 0) {
        alert($t("messages.errors.noQuestions"));
        return;
      }

      await qtiGenerator.exportQTI(assessment);
      alert($t("messages.success.qtiExported"));
    } catch (error) {
      alert($t("messages.errors.exportError", { error: error.message }));
    }
  }

  async function handlePdfUploaded(event) {
    try {
      const { file } = event.detail;
      await qtiGenerator.processPDF(file);
    } catch (error) {
      alert(`Error processing PDF: ${error.message}`);
    }
  }

  async function handleGenerateQuestions(event) {
    try {
      console.log("📱 App: Received generateQuestions event");
      const params = event.detail;
      console.log("📱 App: Event params:", params);

      const result = await qtiGenerator.generateQuestions(params);
      console.log("📱 App: Generation result:", result);

      if (result.success) {
        alert(
          $t("messages.success.questionsGenerated", {
            count: result.questions.length,
          }),
        );
      } else {
        alert($t("messages.errors.generationError", { error: result.error }));
      }
    } catch (error) {
      console.error("📱 App: Exception in handleGenerateQuestions:", error);
      alert($t("messages.errors.generationError", { error: error.message }));
    }
  }
</script>

<main class="app">
  <Header
    on:newAssessment={handleNewAssessment}
    on:saveAssessment={handleSaveAssessment}
    on:exportQTI={handleExportQTI}
  />

  <div class="content">
    <LLMConfiguration />
    <AIGeneration
      on:pdfUploaded={handlePdfUploaded}
      on:generateQuestions={handleGenerateQuestions}
    />
    <!-- <ThinkingCanvas /> -->
    <AssessmentDetails />
    <QuestionsSection />
  </div>
</main>

<style>
  :global(*) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      sans-serif;
    background-color: #f5f5f5;
    color: #333;
    line-height: 1.6;
  }

  .app {
    max-width: 1200px;
    margin: 0 auto;
    background: white;
    min-height: 100vh;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
  }

  .content {
    padding: 20px;
  }

  :global(.btn) {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.2s;
    text-decoration: none;
    display: inline-block;
  }

  :global(.btn-primary) {
    background: #3498db;
    color: white;
  }

  :global(.btn-primary:hover) {
    background: #2980b9;
  }

  :global(.btn-secondary) {
    background: #95a5a6;
    color: white;
  }

  :global(.btn-secondary:hover) {
    background: #7f8c8d;
  }

  :global(.btn-success) {
    background: #27ae60;
    color: white;
  }

  :global(.btn-success:hover) {
    background: #219a52;
  }

  :global(.btn-danger) {
    background: #e74c3c;
    color: white;
  }

  :global(.btn-danger:hover) {
    background: #c0392b;
  }

  :global(.form-group) {
    margin-bottom: 15px;
  }

  :global(.form-group label) {
    display: block;
    margin-bottom: 5px;
    font-weight: 500;
  }

  :global(.form-group input, .form-group select, .form-group textarea) {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
  }

  :global(
      .form-group input:focus,
      .form-group select:focus,
      .form-group textarea:focus
    ) {
    outline: none;
    border-color: #3498db;
    box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
  }

  :global(.form-group small) {
    color: #666;
    font-size: 12px;
    margin-top: 5px;
    display: block;
  }

  :global(.form-group small a) {
    color: #3498db;
    text-decoration: none;
  }

  :global(.form-group small a:hover) {
    text-decoration: underline;
  }
</style>
