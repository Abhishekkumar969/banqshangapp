import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import '../../../styles/BookingLeadsTable.css';
import Tbody from './DroppedTbody';
import FilterPopupWrapper from '../FilterPopupWrapper';
import BackButton from "../../../components/BackButton";

const BookingLeadsTable = () => {
    const [leads, setLeads] = useState([]);
    const [filteredLeads, setFilteredLeads] = useState([]);
    const [editingField, setEditingField] = useState({});
    const [editing, setEditing] = useState({});
    const [searchTerm, setSearchTerm] = useState("");

    const moveLeadToDrop = async (leadId, removeOriginal = false) => {
        try {
            const leadRef = doc(db, 'dropLeads', leadId);
            const leadSnap = await getDoc(leadRef);

            if (!leadSnap.exists()) {
                console.error('Lead not found:', leadId);
                return;
            }

            const leadData = leadSnap.data();

            // Save to dropLeads collection
            const dropRef = doc(db, 'bookingLeads', leadId);
            await setDoc(dropRef, {
                ...leadData,
                droppedAt: new Date() // Add timestamp
            });

            if (removeOriginal) {
                await deleteDoc(leadRef);

                // 🔥 Remove from local state
                setLeads(prev => prev.filter(l => l.id !== leadId));
                setFilteredLeads(prev => prev.filter(l => l.id !== leadId));
            }

            console.log(`Lead ${leadId} moved to dropLeads`);
        } catch (error) {
            console.error('Error moving lead to dropLeads:', error);
        }
    };

    useEffect(() => {
        const fetchLeads = async () => {
            try {
                const snapshot = await getDocs(collection(db, 'dropLeads'));
                const data = snapshot.docs.map(docSnap => {
                    const d = docSnap.data();
                    return {
                        id: docSnap.id,
                        ...d,
                    };
                });

                const sortedData = data.sort((a, b) => {
                    const dateA = a.functionDate ? new Date(a.functionDate) : new Date(0);
                    const dateB = b.functionDate ? new Date(b.functionDate) : new Date(0);
                    return dateB - dateA;
                });

                setLeads(sortedData);
                setFilteredLeads(sortedData);
            } catch (error) {
                console.error('Error fetching leads:', error);
            }
        };

        fetchLeads();
    }, []);

    const updateLead = async (leadId, updates) => {
        try {
            const leadRef = doc(db, 'dropLeads', leadId);
            await updateDoc(leadRef, updates);
            setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...updates } : l));
            setFilteredLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...updates } : l));
        } catch (error) {
            console.error('Error updating lead:', error);
        }
    };

    const handleFilters = (filters) => {
        let filtered = [...leads];

        if (filters.winMin) {
            filtered = filtered.filter(l => Number(l.winProbability) >= Number(filters.winMin));
        }
        if (filters.winMax) {
            filtered = filtered.filter(l => Number(l.winProbability) <= Number(filters.winMax));
        }
        if (filters.followUpBefore) {
            filtered = filtered.filter(l => {
                const validDates = (l.followUpDates || []).filter(Boolean).sort();
                return validDates.length && validDates[0] <= filters.followUpBefore;
            });
        }
        if (filters.followUpAfter) {
            filtered = filtered.filter(l => {
                const validDates = (l.followUpDates || []).filter(Boolean).sort();
                return validDates.length && validDates[0] >= filters.followUpAfter;
            });
        }
        if (filters.contactSearch) {
            filtered = filtered.filter(l => l.mobile1?.toLowerCase().includes(filters.contactSearch.toLowerCase()));
        }
        if (filters.nameSearch) {
            filtered = filtered.filter(l => l.name?.toLowerCase().includes(filters.nameSearch.toLowerCase()));
        }
        if (filters.holdDateFrom) {
            filtered = filtered.filter(l => l.holdDate && l.holdDate >= filters.holdDateFrom);
        }
        if (filters.holdDateTo) {
            filtered = filtered.filter(l => l.holdDate && l.holdDate <= filters.holdDateTo);
        }
        if (filters.functionDateFrom) {
            filtered = filtered.filter(l => l.functionDate && l.functionDate >= filters.functionDateFrom);
        }
        if (filters.functionDateTo) {
            filtered = filtered.filter(l => l.functionDate && l.functionDate <= filters.functionDateTo);
        }

        setFilteredLeads(filtered);
    };

    const handleFieldChange = async (id, field, value) => {
        setLeads(prev => prev.map(lead =>
            lead.id === id ? { ...lead, [field]: value } : lead
        ));
        setFilteredLeads(prev => prev.map(lead =>
            lead.id === id ? { ...lead, [field]: value } : lead
        ));

        try {
            await updateLead(id, { [field]: value });
        } catch (err) {
            console.error("Firestore update failed:", err);
            // Optionally: Show toast or rollback local update
        }

        setEditingField(prev => ({
            ...prev,
            [id]: { ...prev[id], [field]: false }
        }));
    };

    const handleDateChange = (id, index, date) => {
        const lead = leads.find(l => l.id === id);
        const updatedDates = [...(lead.followUpDates || [])];
        updatedDates[index] = date;
        updateLead(id, { followUpDates: updatedDates });
        setEditing(prev => ({ ...prev, [id]: { ...prev[id], [index]: false } }));
    };

    const startEdit = (leadId, field) => {
        setEditingField(prev => {
            if (!leadId || !field) return {}; // exit edit mode
            return {
                ...prev,
                [leadId]: { ...(prev[leadId] || {}), [field]: true }
            };
        });
    };

    const handleEdit = (id, index) => setEditing(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [index]: true } }));
    const isEditing = (id, field) => editingField[id]?.[field];

    useEffect(() => {
        const term = searchTerm.toLowerCase();
        const filtered = leads.filter((booking) =>
            Object.values(booking).some((val) =>
                typeof val === "string" && val.toLowerCase().includes(term)
            )
        );
        setFilteredLeads(filtered);

    }, [searchTerm, leads]);

    return (
        <div className="leads-table-container">
            <div className="table-header-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div> <BackButton />  </div>
                <div style={{ flex: 1, textAlign: 'center' }}> <h2 className="leads-header" style={{ margin: 0 }}>🗑️ Dropped Leads</h2> </div>
                <div> <FilterPopupWrapper onFilter={handleFilters} /> </div>
            </div>

            <div>
                <input
                    type="text"
                    placeholder="Search by name, Event or phone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                        padding: "0.5rem 1rem",
                        marginTop: "1rem",
                        width: "100%",
                        maxWidth: "290px",
                        borderRadius: "30px",
                        border: "1px solid #ccc",
                    }}
                />
            </div>

            <div className="win-prob-legend">
                <strong>🎯 Lead Win Probability :</strong>
                <ul>
                    <li><span className="legend-box low-prob" /> Less than 25% (Red)</li>
                    <li><span className="legend-box medium-prob" /> 25% - 50% (Orange)</li>
                    <li><span className="legend-box high-prob" /> 50% - 75% (Yellow)</li>
                    <li><span className="legend-box very-high-prob" /> 75% - 100% (Green)</li>
                </ul>
            </div>

            <div style={{ position: 'relative' }}>
                {/* Scrollable Table */}
                <div
                    className="table-scroll-container"
                    id="lead-table-scroll"
                    style={{
                        overflowX: 'auto',
                        scrollBehavior: 'smooth',
                    }}
                >
                    <table className="leads-table">
                        <thead>
                            <tr>
                                {[
                                    'Sl', 'Win_Probability', 'Event_Date', 'Party_Name', 'Date_Booked_On', 'Month', 'Event_(Function_Type)', 'Contact_Number1', 'Contact_Number2', 'Jaimala', 'Paan', 'Extra_Booking_Amenities', 'Menu_Name_(RateOfPlates_x_NoOfPlates)', 'Hall_Charges', 'GST', 'Applicable_GST', 'grandTotal', 'Hold_Up_Date', 'Follow_Up_Date_1', 'Follow_Up_Date_2', 'Follow_Up_Date_3', 'Follow_Up_Date_4', 'Follow_Up_Date_5', 'Source_Of_Customer', 'Drop_Reason', 'UnDrop',
                                ].map(header => (
                                    <th key={header}>{header}</th>
                                ))}
                            </tr>
                        </thead>
                        <Tbody
                            leads={filteredLeads}
                            isEditing={isEditing}
                            editing={editing}
                            handleFieldChange={handleFieldChange}
                            handleEdit={handleEdit}
                            handleDateChange={handleDateChange}
                            startEdit={startEdit}
                            moveLeadToDrop={moveLeadToDrop}
                        />
                    </table>
                </div>

                {/* Left Scroll Button - Fixed on screen */}
                <button
                    onClick={() =>
                        document.getElementById('lead-table-scroll')?.scrollBy({ left: -300, behavior: 'smooth' })
                    }
                    style={{
                        position: 'fixed',
                        left: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        zIndex: 999,
                        background: 'rgba(255, 255, 255, 0.33)',
                        border: '1px solid #ccc',
                        borderRadius: '50%',
                        width: '40px',
                        height: '40px',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                        cursor: 'pointer',
                        color: "black"

                    }}
                >
                    ◀
                </button>

                {/* Right Scroll Button - Fixed on screen */}
                <button
                    onClick={() =>
                        document.getElementById('lead-table-scroll')?.scrollBy({ left: 300, behavior: 'smooth' })
                    }
                    style={{
                        position: 'fixed',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        zIndex: 999,
                        background: 'rgba(255, 255, 255, 0.33)',
                        border: '1px solid #ccc',
                        borderRadius: '50%',
                        width: '40px',
                        height: '40px',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                        cursor: 'pointer',
                        color: "black"
                    }}
                >
                    ▶
                </button>
            </div>
            <div style={{marginBottom:'50px'}}></div>
        </div>
    );
};

export default BookingLeadsTable; 