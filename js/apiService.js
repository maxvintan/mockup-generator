// --- API ABSTRACTION ---
export const apiService = {
    /**
     * Verifies an OpenRouter API key and fetches the user's available models.
     * @param {string} apiKey - The user's OpenRouter API key.
     * @returns {Promise<Array>} A promise that resolves to an array of model objects.
     */
    async verifyAndFetchModels(apiKey) {
        // Get user's accessible models
        const userModelsResponse = await fetch('https://openrouter.ai/api/v1/models/user', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });

        if (!userModelsResponse.ok) {
            const err = new Error(`API key verification failed with status: ${userModelsResponse.status}.`);
            err.status = userModelsResponse.status;
            throw err;
        }

        // Get all models for pricing information
        const allModelsResponse = await fetch('https://openrouter.ai/api/v1/models', {
            method: 'GET'
        });

        if (!allModelsResponse.ok) {
            // If pricing fetch fails, proceed with user models only
            const userResult = await userModelsResponse.json();
            return userResult.data.map(model => ({ ...model, pricing: { prompt: "0", completion: "0" } }));
        }

        const userResult = await userModelsResponse.json();
        const allResult = await allModelsResponse.json();

        // Create pricing map from all models
        const pricingMap = {};
        allResult.data.forEach(model => {
            pricingMap[model.id] = model.pricing;
        });

        // Merge pricing into user models
        return userResult.data.map(userModel => ({
            ...userModel,
            pricing: pricingMap[userModel.id] || { prompt: "0", completion: "0" }
        }));
    },

    /**
     * Generates content using a specific OpenRouter model.
     * @param {string} systemPrompt - The system prompt for the AI.
     * @param {string} userPrompt - The user prompt for the AI.
     * @param {string} apiKey - The user's OpenRouter API key.
     * @param {string} modelId - The ID of the model to use (e.g., "anthropic/claude-3-haiku").
     * @returns {Promise<string>} A promise that resolves to the generated text content.
     */
    async generate(systemPrompt, userPrompt, apiKey, modelId) {
        // Now it directly calls the OpenRouter function
        return this._callOpenRouter(systemPrompt, userPrompt, apiKey, modelId);
    },
    
    // Internal function with retry logic for the generation call
    async _callApiWithRetry(apiCallFunction) {
        let lastError = null;
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const result = await apiCallFunction();
                if (result) return result;
                lastError = new Error("Model returned no text content.");
            } catch (error) {
                lastError = error;
                // Don't retry on client-side errors like 401 Unauthorized
                if (error.status && error.status < 500 && error.status >= 400) {
                     throw lastError;
                }
            }
            // Wait before retrying
            if (attempt < 2) {
                await new Promise(res => setTimeout(res, 1000 * Math.pow(2, attempt)));
            }
        }
        throw lastError || new Error("API call failed after multiple retries.");
    },

    // Updated to accept a specific modelId
    async _callOpenRouter(systemPrompt, userPrompt, apiKey, modelId) {
        return this._callApiWithRetry(async () => {
            const apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
            const payload = {
                model: modelId, // Use the selected model ID here
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ]
            };
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const err = new Error(`API call failed with status: ${response.status}.`);
                err.status = response.status;
                throw err;
            }
            const result = await response.json();
            return result.choices?.[0]?.message?.content;
        });
    }
};
