import { Injectable } from '@nestjs/common';
import { LlmService } from 'src/services/llm.service';
import { TrueFalseQuestion } from './entities/TrueFalseQuestion.interface';
import { MultipleChoiceQuestion } from './entities/MultipleChoiceQuestion.interface';

@Injectable()
export class QuestionsService {
    constructor(
        private readonly llmService: LlmService,
    ) { }

    async generateMultipleChoiceQuestion(category: string): Promise<MultipleChoiceQuestion> {
        const response = await this.llmService.generateJSON({
            prompt: `Generate a multiple choice question on the following topic ${category}. Ensure the answer you specify IS the correct answer to the question.
Use zero-based indexing for the correct answer. For example, if the correct answer is the first option, specify 0 as the answer.`,
            jsonResponseFormat: `{
    "question": string,
    "options": [string, string, string, string],
    "answer": number
            }`,
            temperature: 0.9
        });

        if (!response) {
            throw new Error("Failed to generate multiple choice question");
        }

        return {
            question: response.json.question,
            options: response.json.options,
            answer: response.json.answer
        }
    }

    async generateTrueFalseQuestion(category: string): Promise<TrueFalseQuestion> {
        const response = await this.llmService.generateJSON({
            prompt: `Generate a true or false question on the following topic ${category}. Ensure the answer you specify IS the correct answer to the question.`,
            jsonResponseFormat: `{
                "question": string,
                "answer": boolean
            }`,
            temperature: 0.9
        });

        if (!response) {
            throw new Error("Failed to generate true/false question");
        }

        return {
            question: response.json.question,
            answer: response.json.answer
        }
    }
}