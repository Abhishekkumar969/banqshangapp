import React, { useState, useEffect } from "react";
import { db } from "../firebaseConfig";
import { collection, updateDoc, doc, onSnapshot, getDocs, getDoc } from "firebase/firestore";
import BackButton from "../components/BackButton";
import { getAuth } from "firebase/auth";

export default function ApprovalPage() {
    const [receipts, setReceipts] = useState([]);
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    // 🔹 Fetch all pending receipts
    useEffect(() => {
        const monthsRef = collection(db, "moneyReceipts");

        const unsubscribe = onSnapshot(monthsRef, (monthsSnap) => {
            let allReceipts = [];

            monthsSnap.forEach((monthDoc) => {
                const monthData = monthDoc.data(); // receipts as map
                Object.entries(monthData).forEach(([receiptId, receipt]) => {
                    if (receipt.approval === "No") {
                        allReceipts.push({
                            mapId: receiptId, // Firestore map key
                            ...receipt,
                            month: monthDoc.id, // e.g. "Sep2025"
                        });
                    }
                });
            });

            // Sort by createdAt desc safely
            allReceipts.sort(
                (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
            );

            setReceipts(allReceipts);
            setMessage(
                allReceipts.length === 0 ? "✅ All receipts are approved." : ""
            );
        });

        return () => unsubscribe();
    }, []);

    // 🔹 Get current approver's name
    const getApproverName = async () => {
        const auth = getAuth();
        const currentUser = auth.currentUser;
        if (!currentUser) return "Unknown";

        try {
            const usersRef = collection(db, "usersAccess");
            const snap = await getDocs(usersRef);
            let approver = "Unknown";
            snap.forEach((docSnap) => {
                if (
                    docSnap.data().email?.toLowerCase() ===
                    currentUser.email.toLowerCase()
                ) {
                    approver = docSnap.data().name || "Unknown";
                }
            });
            return approver;
        } catch (err) {
            console.error("Error fetching approver name:", err);
            return "Unknown";
        }
    };

    // ✅ Approve single receipt
    const approveReceipt = async (month, mapId) => {
        setLoading(true);
        try {
            const approvedByName = await getApproverName();
            const monthRef = doc(db, "moneyReceipts", month);

            // Get current month data
            const monthSnap = await getDoc(monthRef);
            if (!monthSnap.exists()) throw new Error("Month document not found");

            const monthData = monthSnap.data();

            // Update only the specific receipt
            if (monthData[mapId]) {
                await updateDoc(monthRef, {
                    [mapId]: {
                        ...monthData[mapId],
                        approval: "Accepted",
                        approvedBy: approvedByName,
                    },
                });
            }
        } catch (error) {
            console.error("Error updating approval:", error);
            alert("⚠ Error updating approval.");
        } finally {
            setLoading(false);
        }
    };

    // ✅ Approve all receipts
    const approveAllReceipts = async () => {
        if (receipts.length === 0) return;
        setLoading(true);
        try {
            const approvedByName = await getApproverName();

            // Group by month
            const grouped = receipts.reduce((acc, r) => {
                if (!acc[r.month]) acc[r.month] = [];
                acc[r.month].push(r.mapId);
                return acc;
            }, {});

            for (const [month, ids] of Object.entries(grouped)) {
                const monthRef = doc(db, "moneyReceipts", month);
                const monthSnap = await getDoc(monthRef);
                if (!monthSnap.exists()) continue;

                const monthData = monthSnap.data();
                const updatedMonthData = { ...monthData };

                ids.forEach((mapId) => {
                    if (updatedMonthData[mapId]) {
                        updatedMonthData[mapId] = {
                            ...updatedMonthData[mapId],
                            approval: "Accepted",
                            approvedBy: approvedByName,
                        };
                    }
                });

                await updateDoc(monthRef, updatedMonthData);
            }
        } catch (error) {
            console.error("Error approving all:", error);
            alert("⚠ Error approving all receipts.");
        } finally {
            setLoading(false);
        }
    };

    // 🔹 Format date in IST
    const formatDate = (date) => {
        if (!date) return "-";
        const d = new Date(date);
        // Convert to IST
        const istDate = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
        return istDate.toISOString().split("T")[0].split("-").reverse().join("-"); // DD-MM-YYYY
    };


    return (
        <div style={{ maxWidth: "95%", margin: "0 auto", padding: "10px" }}>
            <div style={{ marginBottom: "60px" }}>
                <BackButton />
            </div>

            <h3 style={{ textAlign: "center", marginBottom: "15px", fontSize: "24px" }}>
                📜 Pending Approvals
            </h3>

            {message && (
                <p style={{ textAlign: "center", color: "blue", fontSize: "13px" }}>
                    {message}
                </p>
            )}

            {receipts.length > 0 && (
                <div style={{ textAlign: "center", marginBottom: "15px" }}>
                    <button
                        onClick={approveAllReceipts}
                        disabled={loading}
                        style={{
                            background: "#5cbf0a",
                            color: "#fff",
                            padding: "12px 20px",
                            border: "none",
                            borderRadius: "6px",
                            fontSize: "16px",
                            cursor: loading ? "not-allowed" : "pointer",
                        }}
                    >
                        {loading ? "Approving..." : "✅ Approve All"}
                    </button>
                </div>
            )}

            {receipts.length > 0 && (
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                            <tr
                                style={{
                                    border: "1px solid #ccc",
                                    padding: "8px 6px",
                                    background: "#31b3ff",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                <th style={{ border: '2px solid #8e8e8eff' }}>SL.</th>
                                <th style={{ border: '2px solid #8e8e8eff' }}>SL. No</th>
                                <th style={{ border: '2px solid #8e8e8eff' }}>Party</th>
                                <th style={{ border: '2px solid #8e8e8eff' }}>Amount</th>
                                <th style={{ border: '2px solid #8e8e8eff' }}>Mode</th>
                                <th style={{ border: '2px solid #8e8e8eff' }}>Cash</th>
                                <th style={{ border: '2px solid #8e8e8eff' }}>Credit</th>
                                <th style={{ border: '2px solid #8e8e8eff' }}>Debit</th>
                                <th style={{ border: '2px solid #8e8e8eff' }}>Date-Time</th>
                                <th style={{ border: '2px solid #8e8e8eff' }}>Particulars</th>
                                <th style={{ border: '2px solid #8e8e8eff' }}>Approve</th>
                            </tr>
                        </thead>
                        <tbody>
                            {receipts.map((r, index) => (
                                <tr key={`${r.month}-${r.mapId}`} style={{ whiteSpace: "nowrap" }}>
                                    <td style={{ border: '2px solid #8e8e8eff' }}>{receipts.length - index}</td>
                                    <td style={{ border: '2px solid #8e8e8eff' }}>#{r.slNo || "-"}</td>
                                    <td style={{ border: '2px solid #8e8e8eff' }}>{r.customerName || r.partyName || "-"}</td>
                                    <td style={{ border: '2px solid #8e8e8eff' }}> ₹{r.amount || 0} </td>
                                    <td style={{ border: '2px solid #8e8e8eff' }}> {r.mode || "-"} </td>
                                    <td style={{ border: '2px solid #8e8e8eff' }}> {r.cashTo} </td>
                                    <td style={{ border: '2px solid #8e8e8eff' }}> {r.paymentFor === "Credit" ? "Credit" : " "} </td>
                                    <td style={{ border: '2px solid #8e8e8eff' }}> {r.paymentFor === "Debit" ? "Debit" : " "} </td>
                                    <td style={{ border: '2px solid #8e8e8eff' }}>
                                        <span>{formatDate(r.createdAt)}</span>
                                        <br />
                                        {r.createdAt && (
                                            <span style={{ fontSize: "0.85em", color: "#555" }}>
                                                {new Date(r.createdAt + 5.5 * 60 * 60 * 1000).toLocaleTimeString("en-US", {
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                    hour12: true,
                                                })}
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ border: '2px solid #8e8e8eff' }}>{r.particularNature || r.description || "-"}</td>
                                    <td style={{ border: '2px solid #8e8e8eff' }}>
                                        <button
                                            onClick={() => approveReceipt(r.month, r.mapId)}
                                            disabled={loading}
                                            style={{
                                                background: "#5cbf0a",
                                                color: "#fff",
                                                padding: "10px",
                                                border: "none",
                                                borderRadius: "4px",
                                                cursor: loading ? "not-allowed" : "pointer",
                                            }}
                                        >
                                            ✅
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
