import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import '../styles/Calendar.css';
import { db } from '../firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';

const parseToDate = (val) => {
    if (!val) return new Date();
    if (val instanceof Date) return val;
    if (typeof val === "string") {
        const [y, m, d] = val.split("-").map(Number);
        return new Date(y, m - 1, d);
    }
    return new Date();
};

const CalendarInput = ({
    isOpen,
    onClose,
    onDateSelect,
    injectedEvents = {},
    selectedDate,
}) => {
    const [date, setDate] = useState(parseToDate(selectedDate));
    const [events, setEvents] = useState({});
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");

    const toDateKey = (d) => {
        if (!(d instanceof Date)) d = parseToDate(d);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    };

    // ✅ Convert yyyy-mm-dd string -> dd-mm-yyyy display
    const formatDate = (str) => {
        if (!str) return "-";
        const [y, m, d] = str.split("-");
        return `${d}-${m}-${y}`;
    };

    useEffect(() => {
        if (selectedDate) {
            setDate(parseToDate(selectedDate)); // always Date object inside
        }
    }, [selectedDate]);

    useEffect(() => {
        if (!isOpen) return;

        const fetchEvents = async () => {
            try {
                const prebookingsSnapshot = await getDocs(collection(db, 'prebookings'));
                const bookingLeadsSnapshot = await getDocs(collection(db, 'bookingLeads'));
                const enquirySnapshot = await getDocs(collection(db, 'enquiry'));

                const eventDates = {};

                // ✅ PREBOOKINGS
                prebookingsSnapshot.forEach((doc) => {
                    const fields = doc.data();
                    Object.values(fields).forEach((item) => {
                        if (item.functionDate) {
                            const key = item.functionDate; // already in yyyy-mm-dd
                            const type = item.functionType || 'Event';
                            const venueType = item.venueType || 'Event';

                            if (!eventDates[key]) eventDates[key] = [];
                            eventDates[key].push(`[Event] For ${type} ${venueType}`);
                        }
                    });
                });

                // ✅ BOOKING LEADS
                bookingLeadsSnapshot.forEach((doc) => {
                    const fields = doc.data();
                    Object.values(fields).forEach((item) => {
                        if (item.functionDate) {
                            const key = item.functionDate;
                            const type = item.functionType || 'Hold';
                            const venueType = item.venueType || 'Hold';

                            if (!eventDates[key]) eventDates[key] = [];
                            eventDates[key].push(`[Hold] For ${type} ${venueType}`);
                        }
                    });
                });

                // ✅ ENQUIRIES
                enquirySnapshot.forEach((doc) => {
                    const fields = doc.data();
                    Object.values(fields).forEach((item) => {
                        if (item.functionDate) {   // 🔹 correct field for enquiries
                            const key = item.functionDate;
                            const pax = item.pax || 'N/A';
                            const fname = item.functionName || 'Enquiry';

                            if (!eventDates[key]) eventDates[key] = [];
                            eventDates[key].push(`[Enquiry] ${fname} (Pax: ${pax})`);
                        }
                    });
                });

                // merge injectedEvents
                const merged = { ...eventDates, ...injectedEvents };
                setEvents(merged);
            } catch (error) {
                console.error('Error fetching events:', error);
            }
        };

        fetchEvents();
    }, [isOpen, injectedEvents]);

    const tileClassName = ({ date: tileDate }) => {
        const key = toDateKey(tileDate);
        const eventsForDay = events[key];

        if (eventsForDay?.some(e => e.startsWith('[Hold]'))) {
            return 'hold-date'; // orange
        }
        if (eventsForDay?.some(e => e.startsWith('[Enquiry]'))) {
            return 'enquiry-date'; // green
        }
        if (eventsForDay) return 'has-event'; // blue
        return 'no-event';
    };

    const handleDateClick = (clickedDate) => {
        const key = toDateKey(clickedDate); // yyyy-mm-dd
        setDate(clickedDate); // ✅ Date object
        setSelectedEvent(events[key] || null);

        if (onDateSelect) {
            onDateSelect(key); // ✅ string for parent
        }
    };

    // ✅ SEARCH HANDLER
    const handleSearch = (value) => {
        setSearchTerm(value);

        if (!value.trim()) return;

        const parts = value.split("-");
        if (parts.length === 3) {
            const [d, m, y] = parts.map(Number);
            if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
                const searchDate = new Date(y, m - 1, d);
                const key = toDateKey(searchDate);

                setDate(searchDate);
                setSelectedEvent(events[key] || []);
            }
        }
    };

    if (!isOpen) return null;


    return (
        <div style={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="calendar-title">
            <div style={styles.modal}>
                <button
                    onClick={onClose}
                    style={styles.closeBtn}
                    aria-label="Close calendar"
                    title="Close"
                >
                    ✖
                </button>

                <h2 id="calendar-title" style={{ fontSize: 24, marginBottom: 10 }}>
                    📅 Monthly Calendar
                </h2>

                {/* 🔎 Search Box */}
                <div style={{ textAlign: "center", marginBottom: 15 }}>
                    <input
                        type="text"
                        placeholder="Search date (e.g., 17-08-2025)"
                        value={searchTerm}
                        onChange={(e) => handleSearch(e.target.value)}
                        style={{
                            padding: "6px 10px",
                            width: "80%",
                            maxWidth: "300px",
                            borderRadius: "5px",
                        }}
                    />
                </div>

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <Calendar
                        onChange={setDate}
                        value={date}
                        tileClassName={tileClassName}
                        onClickDay={handleDateClick}
                        prev2Label={null}
                        next2Label={null}
                    />
                </div>

                {selectedEvent && selectedEvent.length > 0 ? (
                    <div style={styles.eventList}>
                        {selectedEvent.map((name, i) => (
                            <div key={i} style={styles.eventItem}>
                                <p style={styles.eventDate}>
                                    <strong>Selected Date:</strong> {formatDate(toDateKey(date))}
                                </p>

                                <p>{name}</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={styles.noEvent}>
                        <p style={styles.eventDate}>
                            <strong>Selected Date:</strong> {formatDate(toDateKey(date))}
                        </p>

                        <p>No events for this date.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const styles = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 999,
    },
    modal: {
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 10,
        width: '90%',
        maxWidth: 600,
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
        position: 'relative',
    },
    closeBtn: {
        position: 'absolute',
        top: 10,
        right: 10,
        background: 'transparent',
        border: 'none',
        fontSize: 18,
        color: 'red',
        cursor: 'pointer',
    },
    eventList: {
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
    },
    eventItem: {
        color: '#333',
        fontSize: 18,
    },
    eventDate: {
        fontSize: 18,
        marginBottom: 5,
    },
    noEvent: {
        marginTop: 20,
        textAlign: 'center',
        color: '#555',
    },
};

export default CalendarInput;
