/**
 * AI Chat Manager
 * 
 * Unified interface for multiple AI providers:
 * - Google Gemini
 * - OpenAI GPT
 * - Anthropic Claude (via Copilot)
 * - xAI Grok
 * - DeepSeek
 */

const axios = require('axios');
const database = require('./database');
const logger = require('./logger');

// AI Provider configurations
const AI_PROVIDERS = {
    gemini: {
        name: 'Google Gemini',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        models: ['gemini-2.0-flash-exp', 'gemini-2.0-flash', 'gemini-2.0-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro', 'gemini-3.0-flash', 'gemini-pro'],
        requiresKey: true
    },
    openai: {
        name: 'OpenAI GPT',
        baseUrl: 'https://api.openai.com/v1',
        models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
        requiresKey: true
    },
    grok: {
        name: 'xAI Grok',
        baseUrl: 'https://api.x.ai/v1',
        models: ['grok-beta'],
        requiresKey: true
    },
    deepseek: {
        name: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com/v1',
        models: ['deepseek-chat', 'deepseek-coder'],
        requiresKey: true
    },
    copilot: {
        name: 'GitHub Copilot',
        baseUrl: 'https://api.githubcopilot.com/chat',
        models: ['copilot-chat'],
        requiresKey: true
    }
};

class AIManager {
    constructor() {
        this.apiKeys = {
            gemini: process.env.GEMINI_API_KEY || '',
            openai: process.env.OPENAI_API_KEY || '',
            grok: process.env.GROK_API_KEY || '',
            deepseek: process.env.DEEPSEEK_API_KEY || '',
            copilot: process.env.COPILOT_API_KEY || ''
        };

        this.chatHistory = new Map(); // In-memory chat history cache
    }

    /**
     * Check if provider is available
     */
    isProviderAvailable(provider) {
        return !!this.apiKeys[provider] && AI_PROVIDERS[provider];
    }

    /**
     * Get available providers
     */
    getAvailableProviders() {
        const availableProviders = Object.entries(AI_PROVIDERS)
            .filter(([key]) => this.isProviderAvailable(key))
            .map(([key, config]) => ({
                id: key,
                name: config.name,
                models: config.models,
                available: true,
                default: key === 'gemini' // Gemini as default
            }));

        // If no providers available, show all as unavailable
        if (availableProviders.length === 0) {
            return Object.entries(AI_PROVIDERS).map(([key, config]) => ({
                id: key,
                name: config.name,
                models: config.models,
                available: false,
                default: false
            }));
        }

        return availableProviders;
    }

    /**
     * Send message to Gemini
     */
    async sendToGemini(message, model = 'gemini-pro', conversationHistory = []) {
        try {
            const apiKey = this.apiKeys.gemini;
            const url = `${AI_PROVIDERS.gemini.baseUrl}/models/${model}:generateContent?key=${apiKey}`;

            // Format conversation history for Gemini
            const contents = [
                ...conversationHistory.map(msg => ({
                    role: msg.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: msg.content }]
                })),
                {
                    role: 'user',
                    parts: [{ text: message }]
                }
            ];

            const response = await axios.post(url, {
                contents,
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 2048
                }
            }, {
                timeout: 30000
            });

            const reply = response.data.candidates[0].content.parts[0].text;
            const tokensUsed = response.data.usageMetadata?.totalTokenCount || 0;

            return {
                success: true,
                response: reply,
                tokensUsed,
                model
            };
        } catch (error) {
            logger.error('Gemini API error', {
                error: error.message,
                response: error.response?.data
            });

            return {
                success: false,
                error: error.response?.data?.error?.message || error.message
            };
        }
    }

    /**
     * Send message to OpenAI GPT
     */
    async sendToOpenAI(message, model = 'gpt-3.5-turbo', conversationHistory = []) {
        try {
            const apiKey = this.apiKeys.openai;
            const url = `${AI_PROVIDERS.openai.baseUrl}/chat/completions`;

            const messages = [
                ...conversationHistory.map(msg => ({
                    role: msg.role,
                    content: msg.content
                })),
                {
                    role: 'user',
                    content: message
                }
            ];

            const response = await axios.post(url, {
                model,
                messages,
                temperature: 0.7,
                max_tokens: 2048
            }, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });

            const reply = response.data.choices[0].message.content;
            const tokensUsed = response.data.usage?.total_tokens || 0;

            return {
                success: true,
                response: reply,
                tokensUsed,
                model
            };
        } catch (error) {
            logger.error('OpenAI API error', {
                error: error.message,
                response: error.response?.data
            });

            return {
                success: false,
                error: error.response?.data?.error?.message || error.message
            };
        }
    }

    /**
     * Send message to Grok
     */
    async sendToGrok(message, model = 'grok-beta', conversationHistory = []) {
        try {
            const apiKey = this.apiKeys.grok;
            const url = `${AI_PROVIDERS.grok.baseUrl}/chat/completions`;

            const messages = [
                {
                    role: 'system',
                    content: 'You are Grok, a helpful AI assistant.'
                },
                ...conversationHistory.map(msg => ({
                    role: msg.role,
                    content: msg.content
                })),
                {
                    role: 'user',
                    content: message
                }
            ];

            const response = await axios.post(url, {
                model,
                messages,
                temperature: 0.7,
                max_tokens: 2048
            }, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });

            const reply = response.data.choices[0].message.content;
            const tokensUsed = response.data.usage?.total_tokens || 0;

            return {
                success: true,
                response: reply,
                tokensUsed,
                model
            };
        } catch (error) {
            logger.error('Grok API error', {
                error: error.message,
                response: error.response?.data
            });

            return {
                success: false,
                error: error.response?.data?.error?.message || error.message
            };
        }
    }

    /**
     * Send message to DeepSeek
     */
    async sendToDeepSeek(message, model = 'deepseek-chat', conversationHistory = []) {
        try {
            const apiKey = this.apiKeys.deepseek;
            const url = `${AI_PROVIDERS.deepseek.baseUrl}/chat/completions`;

            const messages = [
                ...conversationHistory.map(msg => ({
                    role: msg.role,
                    content: msg.content
                })),
                {
                    role: 'user',
                    content: message
                }
            ];

            const response = await axios.post(url, {
                model,
                messages,
                temperature: 0.7,
                max_tokens: 2048
            }, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });

            const reply = response.data.choices[0].message.content;
            const tokensUsed = response.data.usage?.total_tokens || 0;

            return {
                success: true,
                response: reply,
                tokensUsed,
                model
            };
        } catch (error) {
            logger.error('DeepSeek API error', {
                error: error.message,
                response: error.response?.data
            });

            return {
                success: false,
                error: error.response?.data?.error?.message || error.message
            };
        }
    }

    /**
     * Send message to Copilot
     */
    async sendToCopilot(message, model = 'copilot-chat', conversationHistory = []) {
        try {
            const apiKey = this.apiKeys.copilot;
            const url = `${AI_PROVIDERS.copilot.baseUrl}/completions`;

            const messages = [
                ...conversationHistory.map(msg => ({
                    role: msg.role,
                    content: msg.content
                })),
                {
                    role: 'user',
                    content: message
                }
            ];

            const response = await axios.post(url, {
                messages,
                model,
                temperature: 0.7,
                max_tokens: 2048
            }, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });

            const reply = response.data.choices[0].message.content;
            const tokensUsed = response.data.usage?.total_tokens || 0;

            return {
                success: true,
                response: reply,
                tokensUsed,
                model
            };
        } catch (error) {
            logger.error('Copilot API error', {
                error: error.message,
                response: error.response?.data
            });

            return {
                success: false,
                error: error.response?.data?.error?.message || error.message
            };
        }
    }

    /**
     * Send message to any provider
     */
    async sendMessage(provider, message, model, conversationHistory = [], userId = null, sessionId = null) {
        try {
            if (!this.isProviderAvailable(provider)) {
                return {
                    success: false,
                    error: `Provider ${provider} is not configured or not available`
                };
            }

            let result;

            switch (provider) {
                case 'gemini':
                    result = await this.sendToGemini(message, model, conversationHistory);
                    break;
                case 'openai':
                    result = await this.sendToOpenAI(message, model, conversationHistory);
                    break;
                case 'grok':
                    result = await this.sendToGrok(message, model, conversationHistory);
                    break;
                case 'deepseek':
                    result = await this.sendToDeepSeek(message, model, conversationHistory);
                    break;
                case 'copilot':
                    result = await this.sendToCopilot(message, model, conversationHistory);
                    break;
                default:
                    return {
                        success: false,
                        error: 'Unknown provider'
                    };
            }

            // Store in database if available and user is authenticated
            if (result.success && userId && database.isConnected()) {
                await this.saveToHistory(userId, provider, model, message, result.response, result.tokensUsed, sessionId);
            }

            return result;
        } catch (error) {
            logger.error('AI message send error', {
                error: error.message,
                provider
            });

            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Save chat to history
     */
    async saveToHistory(userId, provider, model, message, response, tokensUsed, sessionId) {
        try {
            await database.query(
                `INSERT INTO chat_history (user_id, provider, model, message, response, tokens_used, session_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [userId, provider, model, message, response, tokensUsed, sessionId]
            );
        } catch (error) {
            logger.error('Failed to save chat history', {
                error: error.message,
                userId
            });
        }
    }

    /**
     * Get chat history for user
     */
    async getChatHistory(userId, sessionId = null, limit = 50) {
        try {
            if (!database.isConnected()) {
                return [];
            }

            let query, params;

            if (sessionId) {
                query = `SELECT * FROM chat_history 
                 WHERE user_id = $1 AND session_id = $2 
                 ORDER BY created_at DESC LIMIT $3`;
                params = [userId, sessionId, limit];
            } else {
                query = `SELECT * FROM chat_history 
                 WHERE user_id = $1 
                 ORDER BY created_at DESC LIMIT $2`;
                params = [userId, limit];
            }

            const result = await database.query(query, params);
            return result.rows.reverse(); // Oldest first for conversation
        } catch (error) {
            logger.error('Failed to get chat history', {
                error: error.message,
                userId
            });
            return [];
        }
    }

    /**
     * Clear chat history
     */
    async clearChatHistory(userId, sessionId = null) {
        try {
            if (!database.isConnected()) {
                return { success: false, error: 'Database not available' };
            }

            if (sessionId) {
                await database.query(
                    'DELETE FROM chat_history WHERE user_id = $1 AND session_id = $2',
                    [userId, sessionId]
                );
            } else {
                await database.query(
                    'DELETE FROM chat_history WHERE user_id = $1',
                    [userId]
                );
            }

            return { success: true };
        } catch (error) {
            logger.error('Failed to clear chat history', {
                error: error.message,
                userId
            });
            return { success: false, error: error.message };
        }
    }
}

// Export singleton instance
module.exports = new AIManager();
