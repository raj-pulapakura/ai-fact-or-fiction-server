import {
    WebSocketGateway,
    SubscribeMessage,
    MessageBody,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

interface Player {
    name: string;
    isHost: boolean;
    points: number;
}

interface Game {
    gameId: string;
    players: Record<string, Player>; // {socketId: Player}
    maxRounds: number;
    currentRound: string;
    currentRoundIndex: number;
    isRoundActive: boolean;
    roundTimeLimit: number;
}

@WebSocketGateway()
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server: Server;

    private games: Game[] = []; // Store active games

    // Handle new connection
    handleConnection(client: Socket) {
        console.log(`Client connected: ${client.id}`);
    }

    // Handle disconnection
    handleDisconnect(client: Socket) {
        console.log(`Client disconnected: ${client.id}`);

        // Remove the player from all games
        this.games.forEach(game => {
            delete game.players[client.id];
        });
    }

    // Emit an event to all players in a game
    private emitToGame(gameId: string, event: string, data: any) {
        const game = this.games.find(g => g.gameId === gameId);
        if (game) {
            Object.keys(game.players).forEach(socketId => {
                this.server.to(socketId).emit(event, data);
            });
        }
    }

    // Create a new game
    @SubscribeMessage('createGame')
    createGame(client: Socket, data: { playerName: string, maxRounds: number }) {
        const gameId = this.generateGameId();
        const newGame: Game = {
            gameId,
            players: { [client.id]: { name: data.playerName, isHost: true, points: 0 } },
            maxRounds: data.maxRounds,
            currentRound: '',
            currentRoundIndex: -1,
            isRoundActive: false,
            roundTimeLimit: 30
        };

        this.games.push(newGame);
        client.emit('gameCreated', { gameId, hostName: 'Host' });
        this.emitToGame(gameId, 'updatePlayers', { players: newGame.players });

        console.log(`Game created: ${gameId}`);
    }

    // Join an existing game
    @SubscribeMessage('joinGame')
    joinGame(
        client: Socket,
        data: { gameId: string; playerName: string }
    ) {
        const game = this.games.find(g => g.gameId === data.gameId);
        if (game) {
            game.players[client.id] = { name: data.playerName, isHost: false, points: 0 };
            client.emit('gameJoined', { players: game.players });
            this.emitToGame(data.gameId, 'updatePlayers', { players: game.players });

            console.log(`${data.playerName} joined game: ${data.gameId}`);
        } else {
            client.emit('error', 'Game not found');
        }
    }

    @SubscribeMessage('startGame')
    startGame(client: Socket, @MessageBody() gameId: string) {
        const game = this.games.find(g => g.gameId === gameId);
        if (game && Object.keys(game.players).length > 1) {
            this.emitToGame(gameId, 'gameStarted', {});
        }
    }

    // Start a new round with a random fact
    @SubscribeMessage('startRound')
    startRound(client: Socket | null, gameId: string) {
        const game = this.games.find(g => g.gameId === gameId);

        if (game && !game.isRoundActive) {
            console.log("STARTING ROUND")
            const fact = this.generateRandomFact();
            const roundIndex = game.currentRoundIndex + 1;
            game.isRoundActive = true;
            game.currentRound = fact;
            this.emitToGame(gameId, 'newRound', { fact, roundIndex });
            let countdown = game.roundTimeLimit;
            this.emitToGame(gameId, 'countdown', countdown);
            const interval = setInterval(() => {
                countdown--;
                console.log('Countdown:', countdown);
                this.emitToGame(gameId, 'countdown', countdown);
                if (!game.isRoundActive || countdown === 0) {
                    clearInterval(interval);
                    this.emitToGame(gameId, 'countdown', 0);

                    if (countdown === 0) {
                        this.endRound(game);
                    }
                }
            }, 1000);
            console.log('New round started for game:', gameId);
        }
    }

    // Submit a player's vote
    @SubscribeMessage('submitVote')
    submitVote(client: Socket, data: { vote: string, timeRemaining: number }) {
        const game = this.findGameByPlayerSocket(client.id);
        if (game && game.isRoundActive) {
            const correctAnswer = this.getCorrectAnswer(game.currentRound); // Assume a function that checks the answer
            const pointsAwarded =
                data.vote !== correctAnswer
                    ? 0
                    : Math.round((1 - ((game.roundTimeLimit - data.timeRemaining) / game.roundTimeLimit)) * 1000);
            game.players[client.id].points += pointsAwarded;
        }
    }

    // End the round and calculate results
    private endRound(game: Game) {
        game.isRoundActive = false;

        const correctAnswer = this.getCorrectAnswer(game.currentRound);

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
        if (game.currentRoundIndex + 1 === game.maxRounds) {
            // Calculate winner
            this.emitToGame(game.gameId, 'gameOver', { results: currentResults });
            return;
        }

        // Start counter for next round
        let countdown = 5;
        this.emitToGame(game.gameId, 'next-round-countdown', countdown);
        const interval = setInterval(() => {
            countdown--;
            console.log('Starting next round in', countdown);
            this.emitToGame(game.gameId, 'next-round-countdown', countdown);
            if (countdown === 0) {
                clearInterval(interval);
                this.startRound(null, game.gameId);
            }
        }, 1000);
    }

    // Helper to get the game object by player socket ID
    private findGameByPlayerSocket(socketId: string): Game | undefined {
        return this.games.find(game => socketId in game.players);
    }

    // Helper to generate a random fact (you can replace this with an actual service)
    private generateRandomFact(): string {
        const facts = [
            'The AI was invented in the 1950s.',
            'AI can never surpass human intelligence.',
            'Machine learning is a subset of AI.',
        ];
        return facts[Math.floor(Math.random() * facts.length)];
    }

    // Helper to generate a unique game ID
    private generateGameId(): string {
        return Math.random().toString(36).substring(2, 15);
    }

    // Helper to get the correct answer for a round (stubbed for now)
    private getCorrectAnswer(fact: string): string {
        if (fact === 'The AI was invented in the 1950s.') {
            return 'fact';
        }
        if (fact === 'AI can never surpass human intelligence.') {
            return 'fiction';
        }
        return 'fact';
    }
}
