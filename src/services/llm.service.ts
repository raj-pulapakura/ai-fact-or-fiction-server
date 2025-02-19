import { Injectable } from '@nestjs/common';
import { GenerateResponse } from './llm/schema/GenerateResponse';
import OpenAI from 'openai';

@Injectable()
export class LlmService {
    client: OpenAI;

    constructor() {
        this.client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        })
    }

    async generateJSON(request: GenerateRequest): Promise<GenerateResponse | null> {
        let prompt = request.prompt;
        const model = request.model || "gpt-4o";
        const temperature = request.temperature ?? 0.5;
        const responseFormat = request.jsonResponseFormat;

        let result: GenerateResponse = {
            content: "",
            inputTokens: 0,
            outputTokens: 0,
        };

        if (responseFormat)
            prompt += "\n\nReturn your response in the following JSON format:\n\n" + responseFormat;

        let retries = 3;

        while (retries-- > 0) {
            const response = await this.client.chat.completions.create({
                messages: [
                    {
                        role: "user",
                        content: prompt,
                    }
                ],
                model: model,
                temperature: temperature,
            })

            let jsonString = response.choices[0].message.content;

            if (!jsonString) {
                continue;
            }

            try {
                // clean up
                jsonString = jsonString
                    .replace(/^[^{\[]*/, '')
                    .replace(/[^}\]]*$/, '');
                // parse
                result.json = JSON.parse(jsonString);
                return result;
            }
            catch (error) {
                console.error(error);
                console.log(jsonString)
                continue;
            }
        }

        return null;
    }
}