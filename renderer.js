const { ipcRenderer } = require('electron');

class QTIGenerator {
    constructor() {
        this.assessment = {
            title: '',
            description: '',
            timeLimit: 0,
            questions: []
        };
        this.questionCounter = 0;
        this.init();
    }

    init() {
        this.bindEvents();
        this.setupIPCListeners();
    }

    bindEvents() {
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
        return text.toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new QTIGenerator();
});