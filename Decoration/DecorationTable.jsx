// Upcoming 

import React, { useEffect, useState } from 'react';
import { getDoc, collection, onSnapshot, doc, updateDoc, arrayUnion, serverTimestamp, setDoc, deleteField } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import '../styles/DecorationTable.css';
import BackButton from "../components/BackButton";
import { useNavigate } from 'react-router-dom';
import { getAuth } from "firebase/auth";
import BottomNavigationBar from "../components/BottomNavigationBar";

const convertToISTDate = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    const istTime = new Date(date.getTime() + 5.5 * 60 * 60 * 1000); // UTC + 5:30
    return istTime.toLocaleDateString("en-GB").replace(/\//g, "-");
};

const convertToIST12Hour = (timeStr) => {
    if (!timeStr) return "-";
    const [hours, minutes] = timeStr.split(":").map(Number);
    let istHours = (hours + 5) % 24;
    let istMinutes = minutes + 30;
    if (istMinutes >= 60) {
        istMinutes -= 60;
        istHours = (istHours + 1) % 24;
    }
    const ampm = istHours >= 12 ? "PM" : "AM";
    const hour12 = istHours % 12 || 12;
    return `${hour12}:${String(istMinutes).padStart(2, "0")} ${ampm}`;
};

const DecorationTable = () => {
    const [allBookings, setAllBookings] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedDecoration] = useState(null);
    const [amount, setAmount] = useState("");
    const [showPopup, setShowPopup] = useState(false);
    const [sortOrder, setSortOrder] = useState("desc"); // ✅ default descending
    const navigate = useNavigate();
    const [userAppType, setUserAppType] = useState(null);

    useEffect(() => {
        const fetchUserAppType = async () => {
            const auth = getAuth();
            const user = auth.currentUser;
            if (user) {
                try {
                    const userRef = doc(db, 'usersAccess', user.email);
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                        const data = userSnap.data();
                        setUserAppType(data.accessToApp);
                    }
                } catch (err) {
                    console.error("Error fetching user app type:", err);
                }
            }
        };
        fetchUserAppType();
    }, []);

    useEffect(() => {
        const decorationCollection = collection(db, "decoration");
        const prebookingsCollection = collection(db, "prebookings");

        // Real-time listeners
        const unsubscribeDecoration = onSnapshot(
            decorationCollection,
            (decorationSnap) => {
                const decorations = [];
                decorationSnap.docs.forEach((monthDoc) => {
                    const monthData = monthDoc.data().data || monthDoc.data() || {};
                    Object.keys(monthData).forEach((key) => {
                        const v = monthData[key];
                        decorations.push({
                            id: key,
                            month: monthDoc.id,
                            ...v,
                            finalDate: v.date,
                        });
                    });
                });

                const decorationKeys = new Set();
                const makeKey = (name, contact, eventType, date) =>
                    `${(name || "").trim().toLowerCase()}|${(contact || "")
                        .replace(/\s+/g, "")
                        .replace(/[^\d]/g, "")}|${(eventType || "").trim().toLowerCase()}|${date ? new Date(date).toISOString().split("T")[0] : ""}`;

                decorations.forEach((v) => {
                    const key = makeKey(v.customerName, v.contactNo, v.eventType || v.typeOfEvent, v.finalDate);
                    decorationKeys.add(key);
                });

                // Now listen to prebookings
                const unsubscribePre = onSnapshot(
                    prebookingsCollection,
                    (preSnap) => {
                        const prebookings = [];
                        preSnap.docs.forEach((monthDoc) => {
                            const monthData = monthDoc.data().data || monthDoc.data() || {};
                            Object.keys(monthData).forEach((key) => {
                                const pre = monthData[key];
                                prebookings.push({
                                    id: key,
                                    month: monthDoc.id,
                                    ...pre,
                                });
                            });
                        });

                        // Filter prebookings not in decorations
                        const filteredPre = prebookings
                            .filter((pre) => {
                                const contact = [pre.mobile1, pre.mobile2].find(Boolean) || "";
                                const key = makeKey(pre.name, contact, pre.functionType, pre.functionDate);
                                return !decorationKeys.has(key);
                            })
                            .map((pre) => ({
                                id: pre.id,
                                customerName: pre.name,
                                contactNo: pre.mobile1 || pre.mobile2 || "",
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
                        filteredPre.sort((a, b) => new Date(b.finalDate || 0) - new Date(a.finalDate || 0));

                        setAllBookings(filteredPre);
                    },
                    (error) => console.error("❌ Error fetching prebookings real-time:", error)
                );

                // Cleanup prebookings listener
                return () => unsubscribePre();
            },
            (error) => console.error("❌ Error fetching decoration real-time:", error)
        );

        // Cleanup decoration listener
        return () => unsubscribeDecoration();
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

    const handleSaveAmount = async () => {
        if (!selectedDecoration || !amount) return;
        try {
            const decorationRef = doc(db, "decoration", selectedDecoration.id);
            await updateDoc(decorationRef, {
                advance: arrayUnion({
                    amount: Number(amount),
                    date: new Date().toISOString(),
                }),
            });
            alert("Amount added successfully ✅");
            setAmount("");
            setShowPopup(false);
        } catch (error) {
            console.error("❌ Error updating decoration:", error);
        }
    };

    return (
        <>

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
                    <div className="decoration-table-container">
                        <table className="main-decoration-table">
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
                                            <td>{v.finalDate ? convertToISTDate(v.finalDate) : "-"}</td>
                                            <td>{v.customerName}</td>
                                            <td><a href={`tel:${v.contactNo}`} style={{ color: "black", textDecoration: "none" }}>{v.contactNo}</a></td>
                                            <td>{v.eventType}</td>
                                            <td>{v.venueType}</td>
                                            <td>{convertToIST12Hour(v.startTime)} - {convertToIST12Hour(v.endTime)}</td>

                                            <td>
                                                {/* Update / Book button */}
                                                {!v.dropReason && (
                                                    <button
                                                        onClick={() => navigate("/Decoration", { state: { decorationData: v } })}
                                                        style={{
                                                            backgroundColor: v.source === "decoration" ? "#4CAF50" : "#2196F3",
                                                            color: "white",
                                                            padding: "6px 10px",
                                                            borderRadius: "6px",
                                                        }}
                                                    >
                                                        {v.source === "decoration" ? "✏️ Update" : "📘 Book"}
                                                    </button>
                                                )}

                                                {/* Drop / Book Again buttons */}
                                                {v.dropReason ? (
                                                    // Book Again
                                                    <button
                                                        onClick={async () => {
                                                            try {
                                                                const monthKey = new Date(v.finalDate).toLocaleString("en-US", {
                                                                    month: "short",
                                                                    year: "numeric",
                                                                }).replace(" ", ""); // e.g., "Apr2025"

                                                                const ref = doc(db, "decoration", monthKey);
                                                                await updateDoc(ref, {
                                                                    [`${v.id}.dropReason`]: deleteField(),
                                                                    [`${v.id}.dropAt`]: deleteField(),
                                                                });

                                                                alert("✅ Booking restored!");
                                                            } catch (err) {
                                                                console.error(err);
                                                                alert("❌ Failed to restore booking.");
                                                            }
                                                        }}
                                                        style={{
                                                            backgroundColor: "#FF9800",
                                                            color: "white",
                                                            padding: "6px 10px",
                                                            borderRadius: "6px",
                                                            marginLeft: "5px",
                                                        }}
                                                    >
                                                        📘 Book Again
                                                    </button>
                                                ) : (
                                                    // Drop
                                                    <button
                                                        onClick={async () => {
                                                            const reason = prompt("Enter drop reason:");
                                                            if (!reason) return;

                                                            try {
                                                                const monthKey = new Date(v.finalDate).toLocaleString("en-US", {
                                                                    month: "short",
                                                                    year: "numeric",
                                                                }).replace(" ", ""); // e.g., "Apr2025"

                                                                const ref = doc(db, "decoration", monthKey);

                                                                if (v.source !== "decoration") {
                                                                    // Booking not yet in decoration, create month doc & add drop reason
                                                                    await setDoc(
                                                                        ref,
                                                                        {
                                                                            [v.id]: {
                                                                                ...v,
                                                                                source: "decoration",
                                                                                dropReason: reason,
                                                                                createdAt: serverTimestamp(),
                                                                            },
                                                                        },
                                                                        { merge: true }
                                                                    );
                                                                } else {
                                                                    // Booking already exists, update drop reason inside month doc
                                                                    await updateDoc(ref, {
                                                                        [`${v.id}.dropReason`]: reason,
                                                                        [`${v.id}.dropAt`]: serverTimestamp(),
                                                                    });
                                                                }

                                                                // alert("✅ Drop reason saved!");
                                                            } catch (err) {
                                                                console.error(err);
                                                                alert("❌ Failed to save drop reason.");
                                                            }
                                                        }}
                                                        style={{
                                                            backgroundColor: "#f44336",
                                                            color: "white",
                                                            padding: "6px 10px",
                                                            borderRadius: "6px",
                                                            marginLeft: "5px",
                                                        }}
                                                    >
                                                        ⛔ Drop
                                                    </button>
                                                )}
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

            <div style={{ marginBottom: "50px" }}></div>
            <BottomNavigationBar navigate={navigate} userAppType={userAppType} />
        </>
    )
}

export default DecorationTable;