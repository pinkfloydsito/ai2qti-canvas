const { ipcRenderer } = require('electron');
const LLMService = require('./src/llm-service');
const LaTeXRenderer = require('./src/latex-renderer');

class QTIGenerator {
    constructor() {
        this.assessment = {
            title: '',
            description: '',
            timeLimit: 0,
            questions: []
        };
        this.questionCounter = 0;
        this.llmService = new LLMService();
        this.latexRenderer = new LaTeXRenderer();
        this.init();
    }

    init() {
        this.bindEvents();
        this.setupIPCListeners();
    }

    bindEvents() {
        // Original events
        document.getElementById('newAssessment').addEventListener('click', () => this.newAssessment());
        document.getElementById('saveAssessment').addEventListener('click', () => this.saveAssessment());
        document.getElementById('exportQTI').addEventListener('click', () => this.exportQTI());
        document.getElementById('addQuestion').addEventListener('click', () => this.addQuestion());

        document.getElementById('assessmentTitle').addEventListener('input', (e) => {
            this.assessment.title = e.target.value;
        });
        
        document.getElementById('assessmentDescription').addEventListener('input', (e) => {
            this.assessment.description = e.target.value;
        });
        
        document.getElementById('timeLimit').addEventListener('input', (e) => {
            this.assessment.timeLimit = parseInt(e.target.value) || 0;
        });

        // New AI and PDF events
        document.getElementById('uploadBtn').addEventListener('click', () => {
            document.getElementById('pdfUpload').click();
        });

        document.getElementById('pdfUpload').addEventListener('change', (e) => {
            this.handlePDFUpload(e);
        });

        document.getElementById('generateQuestions').addEventListener('click', () => {
            this.generateQuestionsWithAI();
        });

        // LaTeX preview events
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('question-text') || e.target.classList.contains('choice-text')) {
                this.updateMathPreview(e.target);
            }
        });

        // API key validation
        document.getElementById('apiKey').addEventListener('blur', () => {
            this.validateApiKey();
        });
    }

    setupIPCListeners() {
        ipcRenderer.on('new-assessment', () => this.newAssessment());
        ipcRenderer.on('save-assessment', () => this.saveAssessment());
        ipcRenderer.on('export-qti', () => this.exportQTI());
        ipcRenderer.on('open-assessment', (event, filePath) => this.openAssessment(filePath));
    }

    newAssessment() {
        this.assessment = {
            title: '',
            description: '',
            timeLimit: 0,
            questions: []
        };
        this.questionCounter = 0;
        
        document.getElementById('assessmentTitle').value = '';
        document.getElementById('assessmentDescription').value = '';
        document.getElementById('timeLimit').value = '';
        document.getElementById('questionsContainer').innerHTML = '';
    }

    addQuestion() {
        const questionType = document.getElementById('questionType').value;
        const template = document.getElementById(this.getTemplateId(questionType));
        const questionElement = template.content.cloneNode(true);
        
        this.questionCounter++;
        const questionItem = questionElement.querySelector('.question-item');
        questionItem.setAttribute('data-question-id', this.questionCounter);
        questionItem.querySelector('.question-number').textContent = `Question ${this.questionCounter}`;
        
        this.bindQuestionEvents(questionItem);
        document.getElementById('questionsContainer').appendChild(questionElement);
        
        this.updateAssessmentData();
    }

    getTemplateId(questionType) {
        const templateMap = {
            'multiple_choice': 'multipleChoiceTemplate',
            'true_false': 'trueFalseTemplate',
            'short_answer': 'shortAnswerTemplate',
            'essay': 'essayTemplate',
            'fill_in_blank': 'shortAnswerTemplate'
        };
        return templateMap[questionType] || 'multipleChoiceTemplate';
    }

    bindQuestionEvents(questionItem) {
        const removeBtn = questionItem.querySelector('.btn-remove');
        removeBtn.addEventListener('click', () => {
            questionItem.remove();
            this.renumberQuestions();
            this.updateAssessmentData();
        });

        const inputs = questionItem.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            input.addEventListener('input', () => this.updateAssessmentData());
        });

        if (questionItem.dataset.type === 'multiple_choice') {
            this.bindMultipleChoiceEvents(questionItem);
        }
    }

    bindMultipleChoiceEvents(questionItem) {
        const addChoiceBtn = questionItem.querySelector('.btn-add-choice');
        addChoiceBtn.addEventListener('click', () => {
            const choicesContainer = questionItem.querySelector('.choices-container');
            const choiceCount = choicesContainer.querySelectorAll('.choice-item').length;
            
            const choiceDiv = document.createElement('div');
            choiceDiv.className = 'choice-item';
            choiceDiv.innerHTML = `
                <input type="radio" name="correct-choice-${questionItem.dataset.questionId}" value="${choiceCount}">
                <input type="text" class="choice-text" placeholder="Choice ${String.fromCharCode(65 + choiceCount)}">
                <button class="btn-remove-choice">×</button>
            `;
            
            choicesContainer.insertBefore(choiceDiv, addChoiceBtn);
            
            choiceDiv.querySelector('.btn-remove-choice').addEventListener('click', () => {
                choiceDiv.remove();
                this.updateAssessmentData();
            });
            
            choiceDiv.querySelector('input').addEventListener('input', () => this.updateAssessmentData());
            choiceDiv.querySelector('.choice-text').addEventListener('input', () => this.updateAssessmentData());
        });

        const removeChoiceBtns = questionItem.querySelectorAll('.btn-remove-choice');
        removeChoiceBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.parentElement.remove();
                this.updateAssessmentData();
            });
        });
    }

    renumberQuestions() {
        const questions = document.querySelectorAll('.question-item');
        questions.forEach((question, index) => {
            question.querySelector('.question-number').textContent = `Question ${index + 1}`;
        });
    }

    updateAssessmentData() {
        this.assessment.questions = [];
        const questionItems = document.querySelectorAll('.question-item');
        
        questionItems.forEach((item, index) => {
            const questionData = {
                id: index + 1,
                type: item.dataset.type,
                text: item.querySelector('.question-text').value,
                points: parseInt(item.querySelector('.question-points').value) || 1
            };

            if (item.dataset.type === 'multiple_choice') {
                questionData.choices = [];
                questionData.correctAnswer = null;
                
                const choiceItems = item.querySelectorAll('.choice-item');
                choiceItems.forEach((choice, choiceIndex) => {
                    const choiceText = choice.querySelector('.choice-text').value;
                    const isCorrect = choice.querySelector('input[type="radio"]').checked;
                    
                    questionData.choices.push({
                        id: choiceIndex,
                        text: choiceText
                    });
                    
                    if (isCorrect) {
                        questionData.correctAnswer = choiceIndex;
                    }
                });
            } else if (item.dataset.type === 'true_false') {
                questionData.correctAnswer = item.querySelector('.correct-answer').value;
            } else if (item.dataset.type === 'short_answer' || item.dataset.type === 'fill_in_blank') {
                const sampleAnswer = item.querySelector('.sample-answer');
                if (sampleAnswer) {
                    questionData.sampleAnswer = sampleAnswer.value;
                }
            } else if (item.dataset.type === 'essay') {
                const rubric = item.querySelector('.grading-rubric');
                if (rubric) {
                    questionData.gradingRubric = rubric.value;
                }
            }

            this.assessment.questions.push(questionData);
        });
    }

    async saveAssessment() {
        this.updateAssessmentData();
        const assessmentData = JSON.stringify(this.assessment, null, 2);
        const defaultPath = this.assessment.title ? `${this.assessment.title}.json` : 'assessment.json';
        
        const result = await ipcRenderer.invoke('save-file', assessmentData, defaultPath);
        
        if (result.success) {
            alert('Assessment saved successfully!');
        } else if (!result.canceled) {
            alert(`Error saving assessment: ${result.error}`);
        }
    }

    async openAssessment(filePath) {
        const result = await ipcRenderer.invoke('load-file', filePath);
        
        if (result.success) {
            try {
                this.assessment = JSON.parse(result.data);
                this.loadAssessmentIntoUI();
                alert('Assessment loaded successfully!');
            } catch (error) {
                alert('Error parsing assessment file');
            }
        } else {
            alert(`Error loading assessment: ${result.error}`);
        }
    }

    loadAssessmentIntoUI() {
        document.getElementById('assessmentTitle').value = this.assessment.title || '';
        document.getElementById('assessmentDescription').value = this.assessment.description || '';
        document.getElementById('timeLimit').value = this.assessment.timeLimit || '';
        
        document.getElementById('questionsContainer').innerHTML = '';
        this.questionCounter = 0;
        
        this.assessment.questions.forEach(question => {
            this.loadQuestionIntoUI(question);
        });
    }

    loadQuestionIntoUI(questionData) {
        const template = document.getElementById(this.getTemplateId(questionData.type));
        const questionElement = template.content.cloneNode(true);
        
        this.questionCounter++;
        const questionItem = questionElement.querySelector('.question-item');
        questionItem.setAttribute('data-question-id', this.questionCounter);
        questionItem.querySelector('.question-number').textContent = `Question ${this.questionCounter}`;
        questionItem.querySelector('.question-text').value = questionData.text || '';
        questionItem.querySelector('.question-points').value = questionData.points || 1;
        
        if (questionData.type === 'multiple_choice' && questionData.choices) {
            const choicesContainer = questionItem.querySelector('.choices-container');
            const existingChoices = choicesContainer.querySelectorAll('.choice-item');
            
            existingChoices.forEach(choice => choice.remove());
            
            questionData.choices.forEach((choice, index) => {
                const choiceDiv = document.createElement('div');
                choiceDiv.className = 'choice-item';
                choiceDiv.innerHTML = `
                    <input type="radio" name="correct-choice-${this.questionCounter}" value="${index}" ${questionData.correctAnswer === index ? 'checked' : ''}>
                    <input type="text" class="choice-text" value="${choice.text}" placeholder="Choice ${String.fromCharCode(65 + index)}">
                    <button class="btn-remove-choice">×</button>
                `;
                choicesContainer.insertBefore(choiceDiv, choicesContainer.querySelector('.btn-add-choice'));
            });
        } else if (questionData.type === 'true_false') {
            questionItem.querySelector('.correct-answer').value = questionData.correctAnswer || 'true';
        }
        
        this.bindQuestionEvents(questionItem);
        document.getElementById('questionsContainer').appendChild(questionElement);
    }

    async exportQTI() {
        this.updateAssessmentData();
        const qtiXML = this.generateQTI();
        const defaultPath = this.assessment.title ? `${this.assessment.title}.xml` : 'assessment.xml';
        
        const result = await ipcRenderer.invoke('save-file', qtiXML, defaultPath);
        
        if (result.success) {
            alert('QTI file exported successfully!');
        } else if (!result.canceled) {
            alert(`Error exporting QTI: ${result.error}`);
        }
    }

    generateQTI() {
        const assessmentId = this.generateId();
        const timestamp = new Date().toISOString();
        
        let qti = `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.imsglobal.org/xsd/ims_qtiasiv1p2 http://www.imsglobal.org/xsd/ims_qtiasiv1p2p1.xsd">
  <assessment ident="${assessmentId}" title="${this.escapeXML(this.assessment.title)}">
    <qtimetadata>
      <qtimetadatafield>
        <fieldlabel>cc_maxattempts</fieldlabel>
        <fieldentry>1</fieldentry>
      </qtimetadatafield>`;

        if (this.assessment.timeLimit > 0) {
            qti += `
      <qtimetadatafield>
        <fieldlabel>cc_timelimit</fieldlabel>
        <fieldentry>${this.assessment.timeLimit}</fieldentry>
      </qtimetadatafield>`;
        }

        qti += `
    </qtimetadata>
    <section ident="root_section">
      <qtimetadata>
        <qtimetadatafield>
          <fieldlabel>question_references</fieldlabel>
          <fieldentry>${this.assessment.questions.map(q => this.generateQuestionId(q.id)).join(',')}</fieldentry>
        </qtimetadatafield>
      </qtimetadata>`;

        this.assessment.questions.forEach(question => {
            qti += this.generateQuestionXML(question);
        });

        qti += `
    </section>
  </assessment>
</questestinterop>`;

        return qti;
    }

    generateQuestionXML(question) {
        const questionId = this.generateQuestionId(question.id);
        
        switch (question.type) {
            case 'multiple_choice':
                return this.generateMultipleChoiceXML(question, questionId);
            case 'true_false':
                return this.generateTrueFalseXML(question, questionId);
            case 'short_answer':
            case 'fill_in_blank':
                return this.generateShortAnswerXML(question, questionId);
            case 'essay':
                return this.generateEssayXML(question, questionId);
            default:
                return '';
        }
    }

    generateMultipleChoiceXML(question, questionId) {
        let xml = `
      <item ident="${questionId}" title="Question ${question.id}">
        <itemmetadata>
          <qtimetadata>
            <qtimetadatafield>
              <fieldlabel>question_type</fieldlabel>
              <fieldentry>multiple_choice_question</fieldentry>
            </qtimetadatafield>
            <qtimetadatafield>
              <fieldlabel>points_possible</fieldlabel>
              <fieldentry>${question.points}</fieldentry>
            </qtimetadatafield>
          </qtimetadata>
        </itemmetadata>
        <presentation>
          <material>
            <mattext texttype="text/html">${this.escapeXML(question.text)}</mattext>
          </material>
          <response_lid ident="response1" rcardinality="Single">
            <render_choice>`;

        question.choices.forEach((choice, index) => {
            xml += `
              <response_label ident="${index}">
                <material>
                  <mattext texttype="text/plain">${this.escapeXML(choice.text)}</mattext>
                </material>
              </response_label>`;
        });

        xml += `
            </render_choice>
          </response_lid>
        </presentation>
        <resprocessing>
          <outcomes>
            <decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/>
          </outcomes>
          <respcondition continue="No">
            <conditionvar>
              <varequal respident="response1">${question.correctAnswer}</varequal>
            </conditionvar>
            <setvar action="Set" varname="SCORE">100</setvar>
          </respcondition>
        </resprocessing>
      </item>`;

        return xml;
    }

    generateTrueFalseXML(question, questionId) {
        const correctValue = question.correctAnswer === 'true' ? 'True' : 'False';
        
        return `
      <item ident="${questionId}" title="Question ${question.id}">
        <itemmetadata>
          <qtimetadata>
            <qtimetadatafield>
              <fieldlabel>question_type</fieldlabel>
              <fieldentry>true_false_question</fieldentry>
            </qtimetadatafield>
            <qtimetadatafield>
              <fieldlabel>points_possible</fieldlabel>
              <fieldentry>${question.points}</fieldentry>
            </qtimetadatafield>
          </qtimetadata>
        </itemmetadata>
        <presentation>
          <material>
            <mattext texttype="text/html">${this.escapeXML(question.text)}</mattext>
          </material>
          <response_lid ident="response1" rcardinality="Single">
            <render_choice>
              <response_label ident="True">
                <material>
                  <mattext texttype="text/plain">True</mattext>
                </material>
              </response_label>
              <response_label ident="False">
                <material>
                  <mattext texttype="text/plain">False</mattext>
                </material>
              </response_label>
            </render_choice>
          </response_lid>
        </presentation>
        <resprocessing>
          <outcomes>
            <decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/>
          </outcomes>
          <respcondition continue="No">
            <conditionvar>
              <varequal respident="response1">${correctValue}</varequal>
            </conditionvar>
            <setvar action="Set" varname="SCORE">100</setvar>
          </respcondition>
        </resprocessing>
      </item>`;
    }

    generateShortAnswerXML(question, questionId) {
        return `
      <item ident="${questionId}" title="Question ${question.id}">
        <itemmetadata>
          <qtimetadata>
            <qtimetadatafield>
              <fieldlabel>question_type</fieldlabel>
              <fieldentry>short_answer_question</fieldentry>
            </qtimetadatafield>
            <qtimetadatafield>
              <fieldlabel>points_possible</fieldlabel>
              <fieldentry>${question.points}</fieldentry>
            </qtimetadatafield>
          </qtimetadata>
        </itemmetadata>
        <presentation>
          <material>
            <mattext texttype="text/html">${this.escapeXML(question.text)}</mattext>
          </material>
          <response_str ident="response1" rcardinality="Single">
            <render_fib>
              <response_label ident="answer1"/>
            </render_fib>
          </response_str>
        </presentation>
        <resprocessing>
          <outcomes>
            <decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/>
          </outcomes>
        </resprocessing>
      </item>`;
    }

    generateEssayXML(question, questionId) {
        return `
      <item ident="${questionId}" title="Question ${question.id}">
        <itemmetadata>
          <qtimetadata>
            <qtimetadatafield>
              <fieldlabel>question_type</fieldlabel>
              <fieldentry>essay_question</fieldentry>
            </qtimetadatafield>
            <qtimetadatafield>
              <fieldlabel>points_possible</fieldlabel>
              <fieldentry>${question.points}</fieldentry>
            </qtimetadatafield>
          </qtimetadata>
        </itemmetadata>
        <presentation>
          <material>
            <mattext texttype="text/html">${this.escapeXML(question.text)}</mattext>
          </material>
          <response_str ident="response1" rcardinality="Single">
            <render_fib>
              <response_label ident="answer1"/>
            </render_fib>
          </response_str>
        </presentation>
        <resprocessing>
          <outcomes>
            <decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/>
          </outcomes>
        </resprocessing>
      </item>`;
    }

    generateId() {
        return 'i' + Math.random().toString(36).substr(2, 9);
    }

    generateQuestionId(questionNumber) {
        return `question_${questionNumber}_${this.generateId()}`;
    }

    escapeXML(text) {
        if (!text) return '';
        // First process LaTeX for QTI, then escape XML
        const processedText = this.latexRenderer.prepareForQTI(text);
        return processedText.toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    // New methods for AI and LaTeX functionality

    async handlePDFUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const fileName = document.getElementById('fileName');
        fileName.textContent = file.name;

        try {
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const extractedText = await this.llmService.extractTextFromPDF(buffer);
            
            document.getElementById('contextText').value = extractedText;
            alert('PDF text extracted successfully!');
        } catch (error) {
            console.error('PDF extraction error:', error);
            alert(`Error extracting text from PDF: ${error.message}`);
        }
    }

    async generateQuestionsWithAI() {
        const generateBtn = document.getElementById('generateQuestions');
        const originalText = generateBtn.textContent;
        
        try {
            generateBtn.textContent = 'Generating...';
            generateBtn.disabled = true;

            // Get generation parameters
            const context = document.getElementById('contextText').value.trim();
            const questionCount = parseInt(document.getElementById('questionCount').value) || 5;
            const difficulty = document.getElementById('difficultyLevel').value;
            const includeMath = document.getElementById('includeMath').checked;

            // Get selected question types
            const questionTypes = Array.from(
                document.querySelectorAll('.checkbox-group input:checked')
            ).map(input => input.value);

            if (!context) {
                alert('Please provide context text or upload a PDF first.');
                return;
            }

            if (questionTypes.length === 0) {
                alert('Please select at least one question type.');
                return;
            }

            // Validate API key
            const provider = document.getElementById('llmProvider').value;
            const apiKey = document.getElementById('apiKey').value.trim();
            
            if (!apiKey) {
                alert('Please enter your API key first.');
                return;
            }

            // Generate questions
            const questions = await this.llmService.generateQuestions(context, {
                questionCount,
                difficulty,
                questionTypes,
                includeMath
            });

            // Add generated questions to assessment
            this.addGeneratedQuestions(questions);
            
            alert(`Successfully generated ${questions.length} questions!`);

        } catch (error) {
            console.error('Question generation error:', error);
            alert(`Error generating questions: ${error.message}`);
        } finally {
            generateBtn.textContent = originalText;
            generateBtn.disabled = false;
        }
    }

    addGeneratedQuestions(questions) {
        questions.forEach(question => {
            // Set the question type in the UI
            document.getElementById('questionType').value = question.type;
            
            // Add the question
            this.addQuestion();
            
            // Get the last added question element
            const questionItems = document.querySelectorAll('.question-item');
            const lastQuestion = questionItems[questionItems.length - 1];
            
            // Populate the question data
            this.populateQuestionData(lastQuestion, question);
        });
        
        this.updateAssessmentData();
    }

    populateQuestionData(questionElement, questionData) {
        // Set question text
        const questionTextArea = questionElement.querySelector('.question-text');
        questionTextArea.value = questionData.text;
        
        // Set points
        const pointsInput = questionElement.querySelector('.question-points');
        pointsInput.value = questionData.points;

        // Handle type-specific data
        if (questionData.type === 'multiple_choice') {
            // Clear existing choices
            const choicesContainer = questionElement.querySelector('.choices-container');
            const existingChoices = choicesContainer.querySelectorAll('.choice-item');
            existingChoices.forEach(choice => choice.remove());

            // Add new choices
            questionData.choices.forEach((choice, index) => {
                this.addChoiceToQuestion(questionElement, choice.text, index === questionData.correctAnswer);
            });

        } else if (questionData.type === 'true_false') {
            const correctAnswerSelect = questionElement.querySelector('.correct-answer');
            correctAnswerSelect.value = questionData.correctAnswer;

        } else if (questionData.type === 'short_answer') {
            const sampleAnswerTextarea = questionElement.querySelector('.sample-answer');
            if (sampleAnswerTextarea && questionData.sampleAnswer) {
                sampleAnswerTextarea.value = questionData.sampleAnswer;
            }

        } else if (questionData.type === 'essay') {
            const gradingRubricTextarea = questionElement.querySelector('.grading-rubric');
            if (gradingRubricTextarea && questionData.gradingRubric) {
                gradingRubricTextarea.value = questionData.gradingRubric;
            }
        }

        // Update math preview
        this.updateMathPreview(questionTextArea);
    }

    addChoiceToQuestion(questionElement, choiceText, isCorrect = false) {
        const choicesContainer = questionElement.querySelector('.choices-container');
        const addButton = choicesContainer.querySelector('.btn-add-choice');
        const choiceCount = choicesContainer.querySelectorAll('.choice-item').length;
        
        const choiceDiv = document.createElement('div');
        choiceDiv.className = 'choice-item';
        choiceDiv.innerHTML = `
            <input type="radio" name="correct-choice-${questionElement.dataset.questionId}" value="${choiceCount}" ${isCorrect ? 'checked' : ''}>
            <input type="text" class="choice-text" value="${choiceText}" placeholder="Choice ${String.fromCharCode(65 + choiceCount)}">
            <button class="btn-remove-choice">×</button>
        `;
        
        choicesContainer.insertBefore(choiceDiv, addButton);
        
        // Bind events for the new choice
        choiceDiv.querySelector('.btn-remove-choice').addEventListener('click', () => {
            choiceDiv.remove();
            this.updateAssessmentData();
        });
        
        choiceDiv.querySelector('input').addEventListener('input', () => this.updateAssessmentData());
        choiceDiv.querySelector('.choice-text').addEventListener('input', (e) => {
            this.updateMathPreview(e.target);
            this.updateAssessmentData();
        });
    }

    updateMathPreview(inputElement) {
        if (!inputElement) return;
        
        const text = inputElement.value;
        let previewElement = inputElement.parentElement.querySelector('.math-preview');
        
        if (!previewElement) {
            previewElement = document.createElement('div');
            previewElement.className = 'math-preview';
            inputElement.parentElement.appendChild(previewElement);
        }
        
        this.latexRenderer.previewMath(text, previewElement);
    }

    async validateApiKey() {
        const provider = document.getElementById('llmProvider').value;
        const apiKey = document.getElementById('apiKey').value.trim();
        
        if (!apiKey) return;
        
        try {
            const isValid = await this.llmService.testApiKey(provider, apiKey);
            const apiKeyInput = document.getElementById('apiKey');
            
            if (isValid) {
                apiKeyInput.style.borderColor = '#27ae60';
                apiKeyInput.title = 'API key is valid';
            } else {
                apiKeyInput.style.borderColor = '#e74c3c';
                apiKeyInput.title = 'API key is invalid';
            }
        } catch (error) {
            console.error('API key validation error:', error);
            const apiKeyInput = document.getElementById('apiKey');
            apiKeyInput.style.borderColor = '#e74c3c';
            apiKeyInput.title = 'Error validating API key';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new QTIGenerator();
});