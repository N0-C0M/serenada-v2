import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Calendar } from 'lucide-react';
import type { RecentCall } from '../utils/callHistory';

interface RecentCallsProps {
    calls: RecentCall[];
}

const RecentCalls: React.FC<RecentCallsProps> = ({ calls }) => {
    const navigate = useNavigate();

    const formatDuration = (seconds: number) => {
        if (seconds < 60) return `${seconds}s`;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    };

    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    if (calls.length === 0) return null;

    return (
        <div className="recent-calls">
            <h3 className="recent-calls-label">Recent calls</h3>
            <div className="recent-calls-table-container">
                <table className="recent-calls-table">
                    <thead>
                        <tr>
                            <th>Date & Time</th>
                            <th className="text-right">Duration</th>
                        </tr>
                    </thead>
                    <tbody>
                        {calls.map((call, index) => (
                            <tr
                                key={`${call.roomId}-${index}`}
                                className="recent-call-row"
                                onClick={() => navigate(`/call/${call.roomId}`)}
                            >
                                <td>
                                    <div className="recent-call-date-cell">
                                        <Calendar size={14} className="recent-call-icon" />
                                        <span>{formatDate(call.startTime)} at {formatTime(call.startTime)}</span>
                                    </div>
                                </td>
                                <td className="text-right">
                                    <div className="recent-call-duration-cell">
                                        <Clock size={14} className="recent-call-icon" />
                                        <span>{formatDuration(call.duration)}</span>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default RecentCalls;
