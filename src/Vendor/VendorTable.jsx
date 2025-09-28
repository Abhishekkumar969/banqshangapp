import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc, arrayUnion, serverTimestamp, setDoc, deleteField } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import '../styles/VendorTable.css';
import BackButton from "../components/BackButton";
import { useNavigate } from 'react-router-dom';

const VendorTable = () => {
    const [allBookings, setAllBookings] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedVendor] = useState(null);
    const [amount, setAmount] = useState("");
    const [showPopup, setShowPopup] = useState(false);
    const [sortOrder, setSortOrder] = useState("desc"); // ✅ default descending
    const navigate = useNavigate();

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch vendors
                const vendorSnap = await getDocs(collection(db, "vendor"));
                const vendors = vendorSnap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    finalDate: doc.data().date
                }));

                // Make vendor keys
                const vendorKeys = new Set();
                const makeKey = (name, contact, eventType, date) =>
                    `${(name || "").toLowerCase()}|${(contact || "").replace(/\s+/g, "")}|${(eventType || "").toLowerCase()}|${date ? new Date(date).toISOString().split("T")[0] : ""}`;

                vendors.forEach(v => {
                    const key = makeKey(v.customerName, v.contactNo, v.eventType || v.typeOfEvent, v.finalDate);
                    vendorKeys.add(key);
                });

                // Fetch prebookings
                const preSnap = await getDocs(collection(db, "prebookings"));
                const prebookings = preSnap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                }));

                // Filter only those prebookings which are NOT in vendorKeys
                const filteredPre = prebookings.filter(pre => {
                    const contact = [pre.mobile1, pre.mobile2].filter(Boolean).join("/");
                    const key = makeKey(pre.name, contact, pre.functionType, pre.functionDate);
                    return !vendorKeys.has(key); // ❌ agar vendor me hai toh skip
                }).map(pre => ({
                    id: pre.id,
                    customerName: pre.name,
                    contactNo: pre.mobile1,
                    address: pre.address || " ",
                    eventType: pre.functionType,
                    venueType: pre.venueType,
                    date: pre.functionDate,
                    finalDate: pre.functionDate,
                    startTime: "16:00",
                    endTime: "21:00",
                    source: "Shangrila",
                }));

                // Sort latest first
                filteredPre.sort((a, b) => {
                    const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || a.finalDate || 0);
                    const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || b.finalDate || 0);
                    return dateB - dateA;
                });

                setAllBookings(filteredPre);

            } catch (error) {
                console.error("❌ Error fetching data:", error);
            }
        };
        fetchData();
    }, []);

    const sortedBookings = [...allBookings].sort((a, b) => {
        const dateA = new Date(a.finalDate || 0);
        const dateB = new Date(b.finalDate || 0);
        return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
    });

    const filteredBookings = sortedBookings.filter(v => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        const dateStr = v.finalDate ? new Date(v.finalDate).toLocaleDateString("en-GB").replace(/\//g, "-") : "";
        return (
            v.customerName?.toLowerCase().includes(q) ||
            v.contactNo?.toLowerCase().includes(q) ||
            v.eventType?.toLowerCase().includes(q) ||
            dateStr.includes(q)
        );
    });

    const toggleSort = () => {
        setSortOrder(prev => (prev === "asc" ? "desc" : "asc"));
    };

    const convertTo12Hour = (timeStr) => {
        if (!timeStr) return "-";
        const [hours, minutes] = timeStr.split(':').map(Number);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const hour12 = hours % 12 || 12;
        return `${hour12}:${String(minutes).padStart(2, '0')} ${ampm}`;
    };

    const handleSaveAmount = async () => {
        if (!selectedVendor || !amount) return;
        try {
            const vendorRef = doc(db, "vendor", selectedVendor.id);
            await updateDoc(vendorRef, {
                advance: arrayUnion({
                    amount: Number(amount),
                    date: new Date().toISOString(),
                }),
            });
            alert("Amount added successfully ✅");
            setAmount("");
            setShowPopup(false);
        } catch (error) {
            console.error("❌ Error updating vendor:", error);
        }
    };

    return (
        <div>
            <BackButton />
            <div style={{ marginTop: '60px' }}>
                <div style={{ textAlign: 'center' }}><h3>📋 New Orders</h3></div>
                <div style={{ textAlign: "center", margin: "15px 0" }}>
                    <input
                        type="text"
                        placeholder="Search by Name, Contact, Event Type, Date (dd-mm-yyyy)"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ width: "70%", padding: "8px", borderRadius: "8px", border: "1px solid #ccc", fontSize: "14px" }}
                    />
                </div>
                <div className="vendor-table-container">
                    <table className="main-vendor-table">
                        <thead>
                            <tr>
                                <th>Sl No.</th>
                                <th style={{ cursor: "pointer" }} onClick={toggleSort}>
                                    Function Date {sortOrder === "asc" ? "▲" : "▼"}
                                </th>
                                <th>Name</th>
                                <th>Contact</th>
                                <th>Event Type</th>
                                <th>Venue Type</th>
                                <th>Time</th>
                                <th>Book / Drop</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredBookings.map((v, idx) => {
                                return (
                                    <tr key={v.id}>
                                        <td>{filteredBookings.length - idx}</td>
                                        <td>{v.finalDate ? new Date(v.finalDate).toLocaleDateString("en-GB").replace(/\//g, "-") : "-"}</td>
                                        <td>{v.customerName}</td>
                                        <td><a href={`tel:${v.contactNo}`} style={{ color: "black", textDecoration: "none" }}>{v.contactNo}</a></td>
                                        <td>{v.eventType}</td>
                                        <td>{v.venueType}</td>
                                        <td>{convertTo12Hour(v.startTime)} - {convertTo12Hour(v.endTime)}</td>
                                        <td>
                                            {!v.dropReason && <button onClick={() => navigate("/Vendor", { state: { vendorData: v } })} style={{ backgroundColor: v.source === 'vendor' ? '#4CAF50' : '#2196F3', color: 'white', padding: '6px 10px', borderRadius: '6px' }}>{v.source === 'vendor' ? '✏️Update' : '📘 Book'}</button>}
                                            {v.dropReason ?
                                                <button onClick={async () => {
                                                    try { const ref = doc(db, 'vendor', v.id); await updateDoc(ref, { dropReason: deleteField(), dropAt: deleteField() }); alert("✅ Booking restored!"); }
                                                    catch (err) { console.error(err); alert("Failed to restore booking."); }
                                                }} style={{ backgroundColor: '#FF9800', color: 'white', padding: '6px 10px', borderRadius: '6px', marginLeft: '5px' }}>📘 Book Again</button> :
                                                <button onClick={async () => {
                                                    const reason = prompt("Enter drop reason:");
                                                    if (reason) {
                                                        try {
                                                            const ref = doc(db, 'vendor', v.id);
                                                            if (v.source !== 'vendor') await setDoc(ref, { ...v, source: 'vendor', dropReason: reason, createdAt: serverTimestamp() });
                                                            else await updateDoc(ref, { dropReason: reason, dropAt: serverTimestamp() });
                                                            alert("✅ Drop reason saved!");
                                                        } catch (err) { console.error(err); alert("Failed to save drop reason."); }
                                                    }
                                                }} style={{ backgroundColor: '#f44336', color: 'white', padding: '6px 10px', borderRadius: '6px', marginLeft: '5px' }}>⛔ Drop</button>
                                            }
                                        </td>
                                    </tr>
                                )
                            })}

                        </tbody>
                    </table>

                    {showPopup && (
                        <div className="popup-overlay">
                            <div className="popup-box">
                                <h3>Add Advance Amount</h3>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={amount}
                                    placeholder="Enter amount"
                                    onChange={(e) => {
                                        let val = e.target.value.replace(/[^0-9.]/g, "");
                                        if ((val.match(/\./g) || []).length > 1) val = val.slice(0, -1);
                                        setAmount(val);
                                    }}
                                />
                                <div className="popup-actions">
                                    <button onClick={handleSaveAmount}>Save</button>
                                    <button onClick={() => setShowPopup(false)}>Cancel</button>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    )
}

export default VendorTable;
