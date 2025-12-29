import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { Video } from 'lucide-react';
import RecentCalls from '../components/RecentCalls';
import { getRecentCalls } from '../utils/callHistory';
import type { RecentCall } from '../utils/callHistory';

const Home: React.FC = () => {
    const navigate = useNavigate();
    const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);
    const [roomStatuses, setRoomStatuses] = useState<Record<string, number>>({});

    useEffect(() => {
        const calls = getRecentCalls();
        setRecentCalls(calls);

        if (calls.length > 0) {
            const fetchStatuses = async () => {
                try {
                    const rids = calls.map(c => `rids=${c.roomId}`).join('&');
                    const response = await fetch(`/api/rooms/status?${rids}`);
                    if (response.ok) {
                        const data = await response.json();
                        setRoomStatuses(data);
                    }
                } catch (error) {
                    console.error('Failed to fetch room statuses:', error);
                }
            };

            fetchStatuses();
            const interval = setInterval(fetchStatuses, 15000); // Poll every 15s
            return () => clearInterval(interval);
        }
    }, []);

    const startCall = () => {
        const roomId = uuidv4();
        navigate(`/call/${roomId}`);
    };

    return (
        <div className={`page-container center-content ${recentCalls.length > 0 ? 'compact' : ''}`}>
            <div className="home-content">
                <h1 className="title">Connected</h1>
                <p className="subtitle">
                    Simple, instant video calls for everyone. <br />
                    No accounts, no downloads.
                </p>

                <button onClick={startCall} className="btn-primary btn-large">
                    <Video className="icon" />
                    Start Call
                </button>

                <RecentCalls calls={recentCalls} roomStatuses={roomStatuses} />
            </div>
        </div>
    );
};

export default Home;
