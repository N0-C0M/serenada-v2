export interface RecentCall {
    roomId: string;
    startTime: number;
    duration: number; // in seconds
}

const STORAGE_KEY = 'connected_call_history';
const MAX_RECENT_CALLS = 3;

export const saveCall = (call: RecentCall) => {
    try {
        const historyJson = localStorage.getItem(STORAGE_KEY);
        let history: RecentCall[] = historyJson ? JSON.parse(historyJson) : [];

        // Remove previous entry for this room if it exists
        history = history.filter(item => item.roomId !== call.roomId);

        // Add new call to the beginning
        history.unshift(call);

        // Limit to MAX_RECENT_CALLS
        history = history.slice(0, MAX_RECENT_CALLS);

        localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
        console.error('Failed to save call history:', error);
    }
};

export const getRecentCalls = (): RecentCall[] => {
    try {
        const historyJson = localStorage.getItem(STORAGE_KEY);
        return historyJson ? JSON.parse(historyJson) : [];
    } catch (error) {
        console.error('Failed to get call history:', error);
        return [];
    }
};
