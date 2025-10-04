// --- API ABSTRACTION ---
export const apiService = {
    async generate(systemPrompt, userPrompt, state) {
        const model = state.model;
        if (model === 'deepseek') {
            return this._callDeepSeek(systemPrompt, userPrompt, state);
        } else if (model === 'openrouter') {
            return this._callOpenRouter(systemPrompt, userPrompt, state);
        }
        throw new Error("Invalid model selected.");
    },
    
    async _callApiWithRetry(apiCallFunction) {
        let lastError = null;
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const result = await apiCallFunction();
                if (result) return result;
                lastError = new Error("Model returned no text content.");
            } catch (error) {
                lastError = error;
                if (error.status && error.status < 500 && error.status >= 400) {
                     throw lastError;
                }
            }
            if (attempt < 2) {
                await new Promise(res => setTimeout(res, 1000 * Math.pow(2, attempt)));
            }
        }
        throw lastError || new Error("API call failed after multiple retries.");
    },


    async _callDeepSeek(systemPrompt, userPrompt, state) {
        return this._callApiWithRetry(async () => {
            const apiUrl = 'https://api.deepseek.com/v1/chat/completions';
            const payload = {
                model: "deepseek-chat",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ]
            };
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${state.apiKey}`
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
    },

    async _callOpenRouter(systemPrompt, userPrompt, state) {
        return this._callApiWithRetry(async () => {
            const apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
            const payload = {
                model: "openrouter/auto",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ]
            };
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${state.apiKey}`
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
