import {
    WebSocketGateway,
    SubscribeMessage,
    MessageBody,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { QuestionsService } from '../questions/questions.service';
import { TrueFalseQuestion } from '../questions/entities/TrueFalseQuestion.interface';
import { MultipleChoiceQuestion } from '../questions/entities/MultipleChoiceQuestion.interface';
import { QuestionType } from 'src/types/QuestionType.enum';
import { Logger } from '@nestjs/common';


interface Player {
    name: string;
    isHost: boolean;
    points: number;
}

interface Game {
    gameId: string;
    players: Record<string, Player>; // {socketId: Player}
    categories: { value: string, playerName: string }[];
    numRounds: number;
    questions: ({ question: MultipleChoiceQuestion, type: QuestionType.MULTIPLE_CHOICE } | { question: TrueFalseQuestion, type: QuestionType.TRUE_FALSE })[];
    currentCategoryIndex: number;
    currentRoundIndex: number;
    isRoundActive: boolean;
    roundTimeLimit: number;
}

@WebSocketGateway()
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly logger = new Logger(GameGateway.name);

    @WebSocketServer() server: Server;

    constructor(
        private readonly questionsService: QuestionsService
    ) { }

    private games: Game[] = [];

    handleConnection(client: Socket) {
        this.logger.log(`Client connected: ${client.id}`);
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`Client disconnected: ${client.id}`);

        this.games.forEach(game => {
            delete game.players[client.id];
            this.emitToGame(game.gameId, 'updatePlayers', { players: game.players });
        });
    }

    private emitToGame(gameId: string, event: string, data: any) {
        const game = this.games.find(g => g.gameId === gameId);
        if (game) {
            Object.keys(game.players).forEach(socketId => {
                this.server.to(socketId).emit(event, data);
            });
        }
    }

    @SubscribeMessage('createGame')
    async createGame(client: Socket, data: { playerName: string, numRounds: number }) {

        const gameId = this.generateGameId();
        const newGame: Game = {
            gameId,
            players: { [client.id]: { name: data.playerName, isHost: true, points: 0 } },
            categories: [],
            currentCategoryIndex: 0,
            numRounds: data.numRounds,
            currentRoundIndex: 0,
            isRoundActive: false,
            roundTimeLimit: 15,
            questions: [],
        };

        this.games.push(newGame);
        client.emit('gameCreated', { gameId, hostName: 'Host' });
        this.emitToGame(gameId, 'updatePlayers', { players: newGame.players });
    }

    @SubscribeMessage('joinGame')
    joinGame(
        client: Socket,
        data: { gameId: string; playerName: string }
    ) {
        const game = this.games.find(g => g.gameId === data.gameId);
        if (game) {
            game.players[client.id] = { name: data.playerName, isHost: false, points: 0 };
            client.emit('gameJoined', { players: game.players, selectedCategories: game.categories });
            this.emitToGame(data.gameId, 'updatePlayers', { players: game.players });
        } else {
            client.emit('error', 'Game not found');
        }
    }

    @SubscribeMessage('startGame')
    startGame(client: Socket, @MessageBody() gameId: string) {
        const game = this.games.find(g => g.gameId === gameId);
        if (game && Object.keys(game.players).length > 1) {
            this.emitToGame(gameId, 'gameStarted', {});
            this.startRound(gameId);
        }
    }

    @SubscribeMessage('selectCategory')
    selectCategory(client: Socket, data: { gameId: string, category: string }) {
        const game = this.games.find(g => g.gameId === data.gameId);
        if (game) {
            const player = game.players[client.id];

            game.categories.push({ value: data.category, playerName: player.name });
            this.emitToGame(data.gameId, 'categorySelected',
                { category: data.category, playerName: player.name }
            );
        }
    }

    async startRound(gameId: string) {
        const game = this.games.find(g => g.gameId === gameId);

        if (game && !game.isRoundActive) {
            const categoryIndex = game.currentCategoryIndex;
            const category = game.categories[categoryIndex].value;
            const roundIndex = game.currentRoundIndex;

            if (roundIndex == 0) {
                this.emitToGame(gameId, 'newCategory', category);

                // Display category to user
                let countdown = 5;
                this.emitToGame(gameId, 'categoryCountdown', countdown);
                await new Promise<void>((resolve) => {
                    const interval = setInterval(() => {
                        countdown--;
                        this.emitToGame(gameId, 'categoryCountdown', countdown);
                        if (countdown === 0) {
                            clearInterval(interval);
                            resolve()
                        }
                    }, 1000);
                });
            }

            let questionObj;

            if (Math.random() > 0) {
                const question = await this.questionsService.generateMultipleChoiceQuestion(category);
                questionObj = { question: question, type: QuestionType.MULTIPLE_CHOICE };
            }
            else {
                const question = await this.questionsService.generateTrueFalseQuestion(category);
                questionObj = { question: question, type: QuestionType.TRUE_FALSE };
            }

            game.questions.push(questionObj);
            game.isRoundActive = true;

            this.emitToGame(gameId, 'newRound',
                {
                    question: questionObj.question.question,
                    questionType: questionObj.type,
                    answers: questionObj.type === QuestionType.MULTIPLE_CHOICE ? questionObj.question.options : null,
                    roundIndex
                }
            );

            let countdown = game.roundTimeLimit;
            this.emitToGame(gameId, 'countdown', countdown);

            const interval = setInterval(() => {
                countdown--;
                this.emitToGame(gameId, 'countdown', countdown);
                if (!game.isRoundActive || countdown === 0) {
                    clearInterval(interval);
                    this.emitToGame(gameId, 'countdown', 0);

                    if (countdown === 0) {
                        this.endRound(game);
                    }
                }
            }, 1000);
        }
    }

    @SubscribeMessage('submitVote')
    submitVote(client: Socket, data: { vote: any, timeRemaining: number }) {
        const game = this.games.find(g => Object.keys(g.players).includes(client.id));

        if (game && game.isRoundActive) {

            const questionObj = game.questions[game.currentRoundIndex];
            let correctAnswer = questionObj.question.answer;

            const pointsAwarded =
                data.vote !== correctAnswer
                    ? 0
                    : Math.round((1 - ((game.roundTimeLimit - data.timeRemaining) / game.roundTimeLimit)) * 1000);

            game.players[client.id].points += pointsAwarded;
        }
    }

    private endRound(game: Game) {
        game.isRoundActive = false;

        // Emit round results
        const correctAnswer = game.questions[0].question.question;

        const currentResults: { socketId: string, name: string, points: number }[]
            = Object.entries(game.players).map(([socketId, player]) => {
                return { socketId, name: player.name, points: player.points };
            });

        currentResults.sort((a, b) => b.points - a.points);

        this.emitToGame(game.gameId, 'roundResults', {
            correctAnswer,
            results: currentResults
        });

        // Check if the game is over
        if (game.currentRoundIndex + 1 === game.numRounds && game.currentCategoryIndex + 1 === game.categories.length) {
            this.emitToGame(game.gameId, 'gameOver', { results: currentResults });
            return;
        }
        // If the category is over, move to the next category
        else if (game.currentRoundIndex + 1 === game.numRounds) {
            game.currentRoundIndex = 0;
            game.currentCategoryIndex++;
        }
        // Move to the next round
        else {
            game.currentRoundIndex++;
        }


        // Start counter for next round if game is not over
        let countdown = 5;
        this.emitToGame(game.gameId, 'next-round-countdown', countdown);
        const interval = setInterval(() => {
            countdown--;
            this.emitToGame(game.gameId, 'next-round-countdown', countdown);
            if (countdown === 0) {
                clearInterval(interval);
                this.startRound(game.gameId);
            }
        }, 1000);
    }


    private generateGameId(): string {
        return Math.random().toString(36).substring(2, 15);
    }
}
