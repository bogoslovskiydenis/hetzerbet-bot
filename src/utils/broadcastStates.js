/**
 * Общее хранилище состояний для системы рассылок
 * В production рекомендуется использовать Redis
 */

class BroadcastStateManager {
    constructor() {
        this.states = new Map();
    }

    /**
     * Инициализировать новое состояние рассылки
     */
    init(userId, audience) {
        this.states.set(userId, {
            audience,
            text: null,
            media: null,
            mediaType: null,
            buttons: [],
            scheduled: false,
            scheduledTime: null,
            step: 'text' // text, media, buttons, scheduling, awaiting_datetime, preview
        });
        console.log(`📝 Initialized broadcast state for user ${userId}`);
    }

    /**
     * Получить состояние пользователя
     */
    get(userId) {
        return this.states.get(userId) || null;
    }

    /**
     * Обновить состояние
     */
    update(userId, updates) {
        const current = this.states.get(userId);
        if (current) {
            this.states.set(userId, { ...current, ...updates });
        }
    }

    /**
     * Удалить состояние
     */
    delete(userId) {
        this.states.delete(userId);
        console.log(`🗑️ Cleared broadcast state for user ${userId}`);
    }

    /**
     * Проверить, находится ли пользователь в процессе создания рассылки
     */
    isActive(userId) {
        return this.states.has(userId);
    }

    /**
     * Получить текущий шаг
     */
    getStep(userId) {
        const state = this.states.get(userId);
        return state?.step || null;
    }

    /**
     * Проверить, ожидается ли текст
     */
    isAwaitingText(userId) {
        const state = this.states.get(userId);
        return state && state.step === 'text' && state.text === null;
    }

    /**
     * Проверить, ожидается ли медиа
     */
    isAwaitingMedia(userId) {
        const state = this.states.get(userId);
        return state && state.step === 'media' && state.text !== null && state.media === null;
    }

    /**
     * Проверить, ожидаются ли кнопки
     */
    isAwaitingButtons(userId) {
        const state = this.states.get(userId);
        return state && state.step === 'buttons' && state.text !== null && state.buttons.length === 0;
    }

    /**
     * Проверить, ожидается ли ввод даты/времени
     */
    isAwaitingDateTime(userId) {
        const state = this.states.get(userId);
        return state && state.step === 'awaiting_datetime';
    }

    /**
     * Получить статистику активных состояний
     */
    getStats() {
        return {
            active: this.states.size,
            users: Array.from(this.states.keys())
        };
    }
}

// Экспортируем singleton
export const broadcastStates = new BroadcastStateManager();