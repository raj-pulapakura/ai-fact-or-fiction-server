import { Module } from '@nestjs/common';
import { QuestionsService } from './questions.service';
import { LlmService } from 'src/services/llm.service';

@Module({
    providers: [QuestionsService, LlmService],
    exports: [QuestionsService],
})
export class QuestionsModule { }
