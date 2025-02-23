# triv.ai 🏆📝

![Group 4](https://github.com/user-attachments/assets/2f0350e4-1055-493e-a4b1-8bd7cc6fcb36)

**A multiplayer trivia game like Kahoot.it**

## Overview

1. Join/Create a game
2. Each person picks a category they want to play (or 5 random categories will be chosen)
3. Answer trivia questions
4. See your results at the end
5. Both your speed and accuracy affect your points!

## How it works

An LLM is used to generate the questions and the answers. Since the questions are AI-generated, the answers can very rarely be incorrect sorry about this :)

Your score for a particular question is determined by a formula that rewards you for answering fast. Of course, if you get the answer wrong, you won't get any points ;)

## Tech stack

- Frontend: Vite + React.js + Tailwind.CSS
- Backend: Node.js + Nest.js
- AI: OpenAI API
- Deployment: Azure
