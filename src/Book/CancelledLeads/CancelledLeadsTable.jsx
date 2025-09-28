import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import '../../styles/CancelledLeadsTable.module.css';
import Tbody from './Tbody';
import BackButton from "../../components/BackButton";

const CancelledLeadsTable = () => {
    const [leads, setLeads] = useState([]);
    const [filteredLeads, setFilteredLeads] = useState([]);
    const [editingField, setEditingField] = useState({});
    const [editing, setEditing] = useState({});
    const [searchTerm, setSearchTerm] = useState("");

    const moveLeadToDrop = async (leadId, removeOriginal = false) => {
        try {
            const leadRef = doc(db, 'cancelledBookings', leadId);
            const leadSnap = await getDoc(leadRef);

            if (!leadSnap.exists()) {
                console.error('Lead not found:', leadId);
                return;
            }

            const leadData = leadSnap.data();

            // Save to dropLeads collection
            const dropRef = doc(db, 'prebookings', leadId);
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

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this lead permanently?")) {
            try {
                await deleteDoc(doc(db, 'cancelledBookings', id));
                setLeads(prev => prev.filter(lead => lead.id !== id));
                setFilteredLeads(prev => prev.filter(lead => lead.id !== id));
            } catch (err) {
                console.error("Failed to delete:", err);
                alert("Delete failed");
            }
        }
    };

    useEffect(() => {
        const fetchLeads = async () => {
            try {
                const snapshot = await getDocs(collection(db, 'cancelledBookings'));
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
            const leadRef = doc(db, 'bookingLeads', leadId);
            await updateDoc(leadRef, updates);
            setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...updates } : l));
            setFilteredLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...updates } : l));
        } catch (error) {
            console.error('Error updating lead:', error);
        }
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

    const maxRefundCount = Math.max(...leads.map(lead => lead.refundPayments?.length || 0));

    return (
        <div className="leads-table-container">
            <div className="table-header-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div> <BackButton />  </div>
                <div style={{ flex: 1, textAlign: 'center' }}> <h2 className="leads-header" style={{ margin: 0 }}>Cancelled Bookings</h2> </div>
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
                                {['Sl', 'Event Date', 'Party Name', 'Date Booked On', 'Month', 'Event', 'Contact Number1', 'Contact Number2', 'Hall Charges', 
                                'GST', 'Extra Booking Amenities', 'Total', 'Applied GST', 'Menu', 'Rate', 'PAX',
                                 'Extra Plates', 'Sub Total', 'Total Advance', 'Total Refunded'
                                ].map(header => (
                                    <th key={header}>{header}</th>
                                ))}

                                {Array.from({ length: maxRefundCount }).map((_, i) => (
                                    <th key={`Refund_Payment_${i + 1}`}>Refund Payment {i + 1}</th>
                                ))}

                                {['Source Of Customer', 'Book Again',
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
                            handleDelete={handleDelete}
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

export default CancelledLeadsTable; 