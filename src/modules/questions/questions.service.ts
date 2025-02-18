import { Injectable } from '@nestjs/common';
import { LlmService } from 'src/services/llm.service';
import { TrueFalseQuestion } from './entities/TrueFalseQuestion.interface';

@Injectable()
export class QuestionsService {
    constructor(
        private readonly llmService: LlmService,
    ) { }

    async generateTrueFalseQuestion(): Promise<TrueFalseQuestion> {
        const response = await this.llmService.generateJSON({
            prompt: "Generate a true or false question about a random topic. Ensure the answer you specify IS the correct answer to the question.",
            jsonResponseFormat: `{
                "question": string,
                "answer": boolean
            }`
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