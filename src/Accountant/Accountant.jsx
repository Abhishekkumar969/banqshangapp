import React, { useEffect, useState } from "react";
import { collection, onSnapshot, doc, updateDoc, getDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../firebaseConfig";
import BackButton from "../components/BackButton";
import styles from "../styles/accountant.module.css";
import { useNavigate } from 'react-router-dom';

const AccountantDetails = () => {
    const navigate = useNavigate();
    const [records, setRecords] = useState([]);
    const [currentUserEmail, setCurrentUserEmail] = useState("");
    const [totals, setTotals] = useState({ ashish: 0, shiva: 0, locker: 0 });
    const [totalCash, setTotalCash] = useState(0);
    const [sortOrder, setSortOrder] = useState("desc");

    const [userAppType, setUserAppType] = useState(null);

    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [fyOptions, setFyOptions] = useState([]);
    const [rawTransactions, setRawTransactions] = useState([]);

    useEffect(() => {
        const fetchUser = async () => {
            const auth = getAuth();
            if (auth.currentUser) {
                setCurrentUserEmail(auth.currentUser.email);
            }
        };
        fetchUser();
    }, []);

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, "accountant"), (querySnap) => {
            const allTransactions = [];

            querySnap.forEach((docSnap) => {
                const data = docSnap.data();
                const docId = docSnap.id;
                if (Array.isArray(data.transactions)) {
                    const formatted = data.transactions.map((t) => ({
                        ...t,
                        docId,
                        email: data.email || "",
                        name: data.name || docId,
                        userType: docId.includes("Locker")
                            ? "Locker"
                            : docId.toLowerCase().includes("cash")
                                ? "Cash"
                                : "Bank"
                    }));
                    allTransactions.push(...formatted);
                }
            });

            // ✅ Raw filtered (only approved + non-Cash)
            const baseTransactions = allTransactions.filter(
                (t) => t.userType !== "Cash"
            );

            setRawTransactions(baseTransactions); // save for filter effect
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!rawTransactions.length) return;

        let filtered = [...rawTransactions];

        if (fromDate && toDate) {
            filtered = filtered.filter((t) => {
                const d = new Date(t.createdAt).toISOString().split("T")[0];
                return d >= fromDate && d <= toDate;
            });
        }

        filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const userTotals = {};
        filtered.forEach((t) => {
            if (t.approval === "denied") return;
            const amt = Number(t.amount || 0);
            const finalAmount = t.type === "Credit" ? amt : -amt;
            const key = `${t.name} - (${t.userType})`;
            userTotals[key] = (userTotals[key] || 0) + finalAmount;
        });

        setTotals({ userTotals });
        setRecords(filtered);
    }, [rawTransactions, fromDate, toDate]);

    useEffect(() => {
        if (!rawTransactions.length) return;

        const fySet = new Set();

        rawTransactions.forEach((t) => {
            let d;
            if (t.createdAt?.toDate) {
                d = t.createdAt.toDate();
            } else if (t.createdAt) {
                d = new Date(t.createdAt);
            } else if (t.date) {
                d = new Date(t.date);
            } else {
                return;
            }

            if (isNaN(d)) return;

            const fyStartYear = d.getMonth() + 1 < 4 ? d.getFullYear() - 1 : d.getFullYear();
            const fyEndYear = fyStartYear + 1;

            const formatDate = (d) => {
                const dd = String(d.getDate()).padStart(2, "0");
                const mm = String(d.getMonth() + 1).padStart(2, "0");
                const yyyy = d.getFullYear();
                return `${yyyy}-${mm}-${dd}`;
            };

            const start = formatDate(new Date(fyStartYear, 3, 1)); // 1 April
            const end = formatDate(new Date(fyEndYear, 2, 31));    // 31 March
            const label = `FY ${fyStartYear}-${fyEndYear.toString().slice(-2)}`;

            fySet.add(JSON.stringify({ label, start, end }));
        });

        const fyArr = Array.from(fySet).map(fy => JSON.parse(fy));
        fyArr.sort((a, b) => b.start.localeCompare(a.start));
        setFyOptions(fyArr);

        // ✅ Set default FY to current FY
        const today = new Date();
        const currentFYStartYear = today.getMonth() + 1 < 4 ? today.getFullYear() - 1 : today.getFullYear();
        const currentFYEndYear = currentFYStartYear + 1;
        const currentFYStart = `${currentFYStartYear}-${String(4).padStart(2, "0")}-01`;
        const currentFYEnd = `${currentFYEndYear}-${String(3).padStart(2, "0")}-31`;

        setFromDate(currentFYStart);
        setToDate(currentFYEnd);

    }, [rawTransactions]);

    const handleDateSort = () => {
        const newOrder = sortOrder === "asc" ? "desc" : "asc";
        setSortOrder(newOrder);

        const sorted = [...records].sort((a, b) => {
            if (newOrder === "asc") {
                return new Date(a.createdAt) - new Date(b.createdAt);
            } else {
                return new Date(b.createdAt) - new Date(a.createdAt);
            }
        });

        setRecords(sorted);
    };

    useEffect(() => {
        const receiptsUnsub = onSnapshot(collection(db, "moneyReceipts"), (snap) => {
            let cashSum = 0;

            snap.forEach(docSnap => {
                const data = docSnap.data();

                Object.values(data).forEach(receipt => {
                    if ((receipt.mode || "").toLowerCase() !== "cash") return;

                    let receiptDate;
                    if (receipt.addedAt?.toDate) {
                        receiptDate = receipt.addedAt.toDate();
                    } else if (receipt.addedAt) {
                        receiptDate = new Date(receipt.addedAt);
                    } else {
                        return;
                    }

                    const receiptDateStr = receiptDate.toISOString().split("T")[0];

                    // ✅ Only filter if fromDate/toDate exist
                    if (fromDate && toDate) {
                        if (receiptDateStr < fromDate || receiptDateStr > toDate) return;
                    }

                    const amt = Number(receipt.amount || 0);
                    cashSum += (receipt.paymentFor || "").toLowerCase() === "credit" ? amt : -amt;
                });
            });

            setTotalCash(cashSum);
        });

        return () => receiptsUnsub();
    }, [fromDate, toDate]);

    const handleApprove = async (record) => {
        try {
            if (record.email !== currentUserEmail) {
                alert("You are not authorized to approve this transaction.");
                return;
            }

            const personRef = doc(db, "accountant", record.docId);
            const personSnap = await getDoc(personRef);
            if (!personSnap.exists()) return;

            const transactions = personSnap.data().transactions || [];
            const updatedTransactions = transactions.map((t) =>
                t.createdAt === record.createdAt ? { ...t, approval: "approved" } : t
            );

            await updateDoc(personRef, { transactions: updatedTransactions });
            console.log("Transaction approved successfully");
        } catch (err) {
            console.error("Error approving transaction:", err);
        }
    };

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

    return (
        <div className={styles.container}>
            <BackButton />
            <h2 className={styles.title} style={{ marginTop: '40px' }}>Account Records</h2>

            {(userAppType === 'A' || userAppType === 'F') && (
                <>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '10px 0' }}>
                        <button
                            onClick={() => navigate('/AccountantForm')}
                            style={{
                                padding: '10px 20px',
                                backgroundColor: '#4CAF50',
                                color: 'white',
                                border: 'none',
                                borderRadius: '5px',
                                cursor: 'pointer',
                            }}
                        >
                            Go To Cashflow
                        </button>
                    </div>
                </>
            )}

            <div className={styles.filterBar}>
                <label>
                    From:{" "}
                    <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        placeholder="Select From"
                    />
                </label>
                <label>
                    To:{" "}
                    <input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        placeholder="Select To"
                    />
                </label>

                <label>
                    Financial Year:{" "}
                    <select
                        value={fromDate && toDate ? `${fromDate}_${toDate}` : "all_all"}
                        onChange={(e) => {
                            const [start, end] = e.target.value.split("_");
                            if (start === "all" && end === "all") {
                                setFromDate("");
                                setToDate("");
                            } else {
                                setFromDate(start);
                                setToDate(end);
                            }
                        }}
                    >
                        <option value="all_all">All</option>
                        {fyOptions.map((fy, i) => (
                            <option key={i} value={`${fy.start}_${fy.end}`}>
                                {fy.label}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            <div style={{ marginBottom: "15px", overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                    <thead>
                        <tr>
                            <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #ccc" }}>Account</th>
                            <th style={{ textAlign: "right", padding: "8px", borderBottom: "1px solid #ccc" }}>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.keys(totals.userTotals || {}).map((user) => {
                            if (user.includes("Cash")) return null; // Skip Cash

                            let type = "Bank";
                            if (user.includes("Locker")) type = "Locker";

                            const color = type === "Locker" ? "#d35400" : "#2c3e50";

                            return (
                                <tr key={user}>
                                    <td style={{ padding: "8px", color, textAlign: "left" }}>{user}</td>
                                    <td style={{ padding: "8px", textAlign: "right", color }}>
                                        ₹{totals.userTotals[user].toLocaleString()}
                                    </td>
                                </tr>
                            );
                        })}

                        {(() => {
                            let lockerTotal = 0;
                            let bankTotal = 0;

                            Object.keys(totals.userTotals || {}).forEach((user) => {
                                if (user.includes("Locker")) {
                                    lockerTotal += totals.userTotals[user];
                                } else if (!user.includes("Cash")) {
                                    bankTotal += totals.userTotals[user];
                                }
                            });

                            const TotalDistributed = lockerTotal + bankTotal;

                            return (
                                <>
                                    <tr style={{ fontWeight: "bold", background: "#f3f2f2ff" }}>
                                        <td style={{ padding: "8px", textAlign: "left", color: "#d35400" }}>
                                            Locker Total
                                        </td>
                                        <td style={{ padding: "8px", textAlign: "right", color: "#d35400" }}>
                                            ₹{lockerTotal.toLocaleString()}
                                        </td>
                                    </tr>
                                    <tr style={{ fontWeight: "bold", background: "#ecececff" }}>
                                        <td style={{ padding: "8px", textAlign: "left", color: "#2c3e50" }}>
                                            Bank Total
                                        </td>
                                        <td style={{ padding: "8px", textAlign: "right", color: "#2c3e50" }}>
                                            ₹{bankTotal.toLocaleString()}
                                        </td>
                                    </tr>
                                    <tr style={{ fontWeight: "bold", background: "#dcdcdcff" }}>
                                        <td style={{ padding: "8px", textAlign: "left", fontSize: '15px' }}>Cash Total</td>
                                        <td style={{ padding: "8px", textAlign: "right", fontSize: '15px' }}>
                                            ₹{totalCash.toLocaleString()}
                                        </td>
                                    </tr>
                                    <tr style={{ fontWeight: "bold", background: "#d0d0d0ff" }}>
                                        <td style={{ padding: "8px", textAlign: "left", fontSize: '15px' }}>Cash Distributed</td>
                                        <td style={{ padding: "8px", textAlign: "right", fontSize: '15px' }}>
                                            ₹{TotalDistributed.toLocaleString()}
                                        </td>
                                    </tr>
                                    <tr style={{ fontWeight: "bold", background: "#d0d0d0ff" }}>
                                        <td style={{ padding: "8px", textAlign: "left", fontSize: '15px' }}>Cash In Hand</td>
                                        <td style={{ padding: "8px", textAlign: "right", fontSize: '15px' }}>
                                            ₹{totalCash.toLocaleString() - TotalDistributed.toLocaleString()}
                                        </td>
                                    </tr>
                                </>
                            );
                        })()}

                    </tbody>

                </table>
            </div>

            <div style={{ overflowY: "auto", overflowX: "auto", maxHeight: "70vh" }}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th
                                onClick={handleDateSort}
                                style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap", }}
                            >
                                Created At {sortOrder === "asc" ? "" : ""}
                            </th>
                            <th>Name</th>
                            <th>Credit</th>
                            <th>Debit</th>
                            <th>Amount</th>
                            <th>Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        {records.length > 0 ? (
                            records.map((rec, idx) => {
                                const isDenied = rec.approval === "denied";
                                const canApprove = isDenied && rec.email === currentUserEmail;

                                return (
                                    <tr
                                        key={idx}
                                        style={{
                                            whiteSpace: "nowrap",
                                            color: rec.type?.toLowerCase() === "credit" ? "green" : "red",
                                        }}
                                    >
                                        {/* Date & Time */}
                                        <td>
                                            {rec.date ? rec.date.split('-').reverse().join('-') : '-'}
                                        </td>

                                        {/* Name & User Type */}
                                        <td style={{ textAlign: "left" }}>
                                            {rec.name} - ({rec.userType})
                                        </td>

                                        {/* Type Columns */}
                                        <td>{rec.type === "Credit" ? rec.type : ""}</td>
                                        <td>{rec.type === "Debit" ? rec.type : ""}</td>

                                        {/* Amount & Approval */}
                                        <td>
                                            ₹{rec.amount || "-"}{" "}
                                            {isDenied && !canApprove && (
                                                <span
                                                    style={{
                                                        background: "red",
                                                        color: "white",
                                                        padding: "5px 7px",
                                                        borderRadius: "7px",
                                                        marginLeft: "10px",
                                                        display: "inline-block",
                                                    }}
                                                >
                                                    Not Accepted
                                                </span>
                                            )}
                                            {canApprove && (
                                                <button
                                                    className={styles.approveBtn}
                                                    onClick={() => handleApprove(rec)}
                                                    style={{
                                                        background: "green",
                                                        color: "white",
                                                        padding: "5px 10px",
                                                        borderRadius: "5px",
                                                        border: "none",
                                                        marginLeft: "10px",
                                                        cursor: "pointer",
                                                    }}
                                                >
                                                    Accept
                                                </button>
                                            )}
                                        </td>

                                        {/* Description */}
                                        <td>{rec.description || "-"}</td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan="6" style={{ textAlign: "center", padding: "15px" }}>
                                    No records found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

};

export default AccountantDetails;