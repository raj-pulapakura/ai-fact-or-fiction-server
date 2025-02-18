import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { QuestionsModule } from '../questions/questions.module';

@Module({
    imports: [QuestionsModule],
    providers: [GameGateway],
})
export class GameModule { }
