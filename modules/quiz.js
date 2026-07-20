/**
 * Quiz mixin — Earthquake safety quiz logic.
 * Mixed into JaviAlertApp.prototype at startup.
 */
import { QUIZ_QUESTIONS } from '../quiz-questions.js';

export const quizMixin = {
  _showQuiz() {
    const modal = document.getElementById('quizModal');
    if (!modal) return;
    this._resetQuiz();
    modal.classList.remove('hidden');
  },

  _resetQuiz() {
    this.quizState.current = 0;
    this.quizState.score = 0;
    this.quizState.selected = null;
    this.quizState.completed = false;
    this.quizState.order = QUIZ_QUESTIONS.map((_, index) => index);
    for (let i = this.quizState.order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.quizState.order[i], this.quizState.order[j]] = [this.quizState.order[j], this.quizState.order[i]];
    }
    this.quizState.order = this.quizState.order.slice(0, 20);
    this._renderQuizQuestion();
  },

  _renderQuizQuestion() {
    const questionLabel = document.getElementById('quizQuestionLabel');
    const progressFill = document.getElementById('quizProgressFill');
    const scoreDisplay = document.getElementById('quizScore');
    const questionText = document.getElementById('quizQuestionText');
    const options = document.getElementById('quizOptions');
    const nextBtn = document.getElementById('quizNextBtn');
    const total = this.quizState.order.length;
    const current = this.quizState.current;

    const TXT = {
      score: 'Score:',
      completed: 'Quiz completed',
      summary: 'Test your earthquake knowledge. Choose the correct answer and find out if you\'re ready!',
      correct: 'Correct answer:',
      close: 'Close',
      question: 'Question',
      of: 'of',
      submit: 'Submit',
      next: 'Next',
    };
    const t = TXT;

    if (scoreDisplay) {
      scoreDisplay.textContent = t.score + ' ' + this.quizState.score + ' / ' + total;
    }

    if (current >= total) {
      this.quizState.completed = true;
      questionLabel.textContent = t.completed;
      progressFill.style.width = '100%';
      questionText.innerHTML = '<p>' + t.summary + '</p>';
      const answersHtml = this.quizState.order.map((questionIndex, index) => {
        const item = QUIZ_QUESTIONS[questionIndex];
        const correctText = item.choices[item.answer];
        return '<div class="quiz-review"><strong>' + (index + 1) + '. ' + item.question + '</strong>' +
          '<div class="quiz-review-answer">' + t.correct + ' ' + correctText + '</div></div>';
      }).join('');
      options.innerHTML = answersHtml;
      nextBtn.textContent = t.close;
      nextBtn.disabled = false;
      return;
    }

    const question = QUIZ_QUESTIONS[this.quizState.order[current]];
    questionLabel.textContent = t.question + ' ' + (current + 1) + ' ' + t.of + ' ' + total;
    progressFill.style.width = Math.round((current / total) * 100) + '%';
    questionText.textContent = question.question;

    const shuffledChoices = question.choices.map((choice, index) => ({
      text: choice,
      originalIndex: index
    }));
    for (let i = shuffledChoices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledChoices[i], shuffledChoices[j]] = [shuffledChoices[j], shuffledChoices[i]];
    }

    this.quizState.currentChoices = shuffledChoices;
    options.innerHTML = shuffledChoices.map((choice) =>
      '<button class="quiz-option" type="button" data-index="' + choice.originalIndex + '">' + choice.text + '</button>'
    ).join('');

    this.quizState.selected = null;
    nextBtn.textContent = current === total - 1 ? t.submit : t.next;
    nextBtn.disabled = true;

    const restartBtn = document.getElementById('quizRestartBtn');
    if (restartBtn) restartBtn.textContent = 'Restart';

    options.querySelectorAll('.quiz-option').forEach((btn) => {
      btn.addEventListener('click', () => this._selectQuizOption(btn));
    });
  },

  _selectQuizOption(button) {
    if (this.quizState.completed) return;
    if (this.quizState.selected !== null) return;
    const selected = parseInt(button.dataset.index, 10);
    const current = this.quizState.current;
    const questionIndex = this.quizState.order[current];
    const correct = QUIZ_QUESTIONS[questionIndex].answer;
    const optionButtons = document.querySelectorAll('#quizOptions .quiz-option');

    this.quizState.selected = selected;
    optionButtons.forEach((btn) => {
      const idx = parseInt(btn.dataset.index, 10);
      btn.classList.remove('selected', 'correct', 'incorrect');
    });
    optionButtons.forEach((btn) => {
      const idx = parseInt(btn.dataset.index, 10);
      if (idx === selected) btn.classList.add('selected');
      if (idx === correct) btn.classList.add('correct');
      else if (idx === selected) btn.classList.add('incorrect');
    });

    const nextBtn = document.getElementById('quizNextBtn');
    if (nextBtn) nextBtn.disabled = false;
  },

  _nextQuizQuestion() {
    const total = this.quizState.order.length;
    if (this.quizState.completed) {
      document.getElementById('quizModal').classList.add('hidden');
      return;
    }
    const current = this.quizState.current;
    const selected = this.quizState.selected;
    if (selected === null) return;
    const questionIndex = this.quizState.order[current];
    const correct = QUIZ_QUESTIONS[questionIndex].answer;
    if (selected === correct) this.quizState.score += 1;
    this.quizState.current += 1;
    this.quizState.selected = null;
    this._renderQuizQuestion();
  },
};
