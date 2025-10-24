import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../firebaseConfig';
import { runTransaction, collection, getDocs, doc, updateDoc, getDoc, setDoc, arrayUnion, onSnapshot } from 'firebase/firestore';
import '../styles/MoneyReceipt.css';
import { useNavigate } from 'react-router-dom';
import BackButton from "../components/BackButton";
import { getAuth } from "firebase/auth";
import BottomNavigationBar from "../components/BottomNavigationBar";

const MoneyReceipt = () => {
    const [search, setSearch] = useState('');
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [amount, setAmount] = useState('');
    const [amountWords, setAmountWords] = useState('');
    const [mode, setMode] = useState('Cash');
    const [nextSlNo, setNextSlNo] = useState(null);
    const [nextRefundSlNo, setNextRefundSlNo] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [receiptType, setReceiptType] = useState('Cash');
    const [paymentFor, setPaymentFor] = useState('Advance');
    const [receiver, setReceiver] = useState('');
    const [description, setDescription] = useState("");
    const [cashTo, setCashTo] = useState('');
    const [activeSource, setActiveSource] = useState("prebookings");
    const navigate = useNavigate();
    const [assignedUsers, setAssignedUsers] = useState([]);
    const [userAppType, setUserAppType] = useState(null);
    const [banks, setBanks] = useState([]);

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

    // Convert a JS Date to IST date string (yyyy-mm-dd)
    const getISTDateString = (date = new Date()) => {
        const istOffset = 5.5 * 60; // IST = UTC+5:30 in minutes
        const localTime = date.getTime();
        const localOffset = date.getTimezoneOffset() * 60000;
        const istTime = new Date(localTime + localOffset + istOffset * 60000);
        const yyyy = istTime.getFullYear();
        const mm = String(istTime.getMonth() + 1).padStart(2, '0');
        const dd = String(istTime.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };

    // Format date string in DD-MM-YYYY IST
    const formatISTDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const istOffset = 5.5 * 60 * 60000;
        const istDate = new Date(d.getTime() + istOffset);
        const dd = String(istDate.getDate()).padStart(2, '0');
        const mm = String(istDate.getMonth() + 1).padStart(2, '0');
        const yyyy = istDate.getFullYear();
        return `${dd}-${mm}-${yyyy}`;
    };

    const [manualDate, setManualDate] = useState(getISTDateString());

    useEffect(() => {
        const unsubscribeAssignBank = onSnapshot(doc(db, "accountant", "AssignBank"), (bankSnap) => {
            let users = [];
            if (bankSnap.exists()) {
                const bankUsers = bankSnap.data().users || [];
                users = users.concat(
                    bankUsers.map(u => ({
                        name: u.name,
                        email: u.email,
                        type: "Bank"
                    }))
                );
            }

            // Remove duplicates based on email + type
            const uniqueUsers = Object.values(
                users.reduce((acc, u) => {
                    const key = `${u.email}-${u.type}`;
                    acc[key] = u;
                    return acc;
                }, {})
            );

            setAssignedUsers(uniqueUsers);
        });

        const unsubscribeBanks = onSnapshot(doc(db, "accountant", "BankNames"), (snap) => {
            if (snap.exists()) {
                setBanks(snap.data().banks || []);
            } else {
                setBanks([]);
            }
        });

        // Cleanup on unmount
        return () => {
            unsubscribeAssignBank();
            unsubscribeBanks();
        };
    }, []);



    useEffect(() => {
        const fetchUserName = async () => {
            const user = getAuth().currentUser;
            if (user) {
                const docRef = doc(db, "usersAccess", user.email);
                const snap = await getDoc(docRef);
                if (snap.exists()) setReceiver(snap.data().name || user.email);
                else setReceiver(user.email);
            }
        };
        fetchUserName();
    }, []);

    useEffect(() => {
        const fetchCustomers = async () => {
            const source = paymentFor === "Refund" ? "cancelledBookings" : activeSource;
            const res = [];

            const processDocs = (docs, isNested = true) => {
                docs.forEach(docSnap => {
                    const data = docSnap.data();
                    if (isNested) {
                        Object.entries(data).forEach(([id, booking]) => {
                            res.push({
                                monthDoc: docSnap.id,
                                id,
                                name: booking.customerName || booking.name || 'Unknown',
                                mobile1: booking.contactNo || booking.mobile1 || '-',
                                functionType: booking.eventType || booking.functionType || '-',
                                functionDate: booking.date || booking.functionDate || '-',
                                summary: booking.summary || {},
                                source
                            });
                        });
                    } else {
                        res.push({
                            id: docSnap.id,
                            name: data.customerName || data.name || 'Unknown',
                            mobile1: data.contactNo || data.mobile1 || '-',
                            functionType: data.eventType || data.functionType || '-',
                            functionDate: data.date || data.functionDate || '-',
                            summary: data.summary || {},
                            source
                        });
                    }
                });
            };

            if (["prebookings", "vendor", "decoration"].includes(source)) {
                const colSnap = await getDocs(collection(db, source));
                processDocs(colSnap.docs);
            } else {
                const colSnap = await getDocs(collection(db, source));
                processDocs(colSnap.docs, false);
            }

            setCustomers(res);
        };

        fetchCustomers();
    }, [paymentFor, activeSource]);

    useEffect(() => setAmountWords(amount ? convertToWords(parseInt(amount)) : ''), [amount]);

    const convertToWords = (num) => {
        const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
        const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
        if (num === 0) return 'Zero only';
        if (num > 99999999) return 'Overflow';

        const numToWords = n => {
            if (n < 20) return a[n];
            if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '');
            if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + numToWords(n % 100) : '');
            if (n < 100000) return numToWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + numToWords(n % 1000) : '');
            if (n < 10000000) return numToWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + numToWords(n % 100000) : '');
            return numToWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + numToWords(n % 10000000) : '');
        };
        return numToWords(num).trim() + ' only';
    };

    const fetchNextSlNo = useCallback(async () => {
        try {
            const counterSnap = await getDoc(doc(db, 'settings', 'slCounter'));
            const data = counterSnap.exists() ? counterSnap.data() : {};
            if (receiptType === 'Cash') setNextSlNo((data.cashMoneyReceipt || 0) + 1);
            else setNextSlNo((data.moneyReceipt || 0) + 1);
        } catch (err) { console.error(err); setNextSlNo(null); }
    }, [receiptType]);

    const fetchNextRefundSlNo = useCallback(async () => {
        try {
            const counterSnap = await getDoc(doc(db, 'settings', 'slCounter'));
            const data = counterSnap.exists() ? counterSnap.data() : {};
            setNextRefundSlNo(`R${(data.refundMoneyReceipt || 0) + 1}`);
        } catch (err) { console.error(err); setNextRefundSlNo(null); }
    }, []);

    useEffect(() => { if (selectedCustomer && paymentFor === 'Refund') fetchNextRefundSlNo(); }, [selectedCustomer, paymentFor, fetchNextRefundSlNo]);
    useEffect(() => { if (selectedCustomer && paymentFor === 'Advance') fetchNextSlNo(); }, [receiptType, selectedCustomer, fetchNextSlNo, paymentFor]);

    const handleSubmit = async () => {
        if (!selectedCustomer || !amount || !mode || (paymentFor === 'Advance' && !receiver)) {
            alert('Please fill all fields');
            return;
        }
        if (paymentFor === 'Advance' && mode === 'Cash' && !cashTo) {
            alert('Please select where the cash will be deposited');
            return;
        }
        if (!selectedCustomer?.id) {
            alert('❌ Cannot save: Customer ID is missing.');
            return;
        }
        if (isSaving) return;

        setIsSaving(true);

        try {
            const counterRef = doc(db, 'settings', 'slCounter');
            let slNo = '';

            // --- GENERATE SL NO ---
            await runTransaction(db, async (transaction) => {
                const counterDoc = await transaction.get(counterRef);
                const data = counterDoc.exists() ? counterDoc.data() : {};
                if (paymentFor === 'Refund') {
                    const current = data.refundMoneyReceipt || 0;
                    slNo = `R${current + 1}`;
                    transaction.set(counterRef, { refundMoneyReceipt: current + 1 }, { merge: true });
                } else {
                    if (receiptType === 'Cash') {
                        const current = data.cashMoneyReceipt || 0;
                        slNo = `C${current + 1}`;
                        transaction.set(counterRef, { cashMoneyReceipt: current + 1 }, { merge: true });
                    } else {
                        const current = data.moneyReceipt || 0;
                        slNo = `${current + 1}`;
                        transaction.set(counterRef, { moneyReceipt: current + 1 }, { merge: true });
                    }
                }
            });

            // --- DETERMINE MONTH DOCUMENT ---
            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const d = new Date(manualDate);
            const month = monthNames[d.getMonth()];
            const year = d.getFullYear();
            const monthYear = `${month}${year}`;

            const newPayment = {
                addedAt: new Date(new Date(manualDate).getTime() + 5.5 * 60 * 60000).toISOString(), // IST
                receiptDate: manualDate,
                amount: parseFloat(amount),
                amountWords,
                mode,
                receiver: receiver?.trim() || "Counter",
                slNo,
                cashTo: mode === 'Cash' ? cashTo : '',
                description,
                myName: receiver?.trim() || "Counter",
                partyName: selectedCustomer.name,
                particularNature: description,
                approval: 'Accepted',
                type: receiptType,
                mobile: selectedCustomer.mobile1 || '',
                eventType: selectedCustomer.functionType || '',
                eventDate: selectedCustomer.functionDate || '',
                paymentFor: paymentFor === 'Advance' ? 'Credit' : 'Debit'
            };

            // --- SAVE IN moneyReceipts ---
            const monthRef = doc(db, 'moneyReceipts', monthYear);
            const snap = await getDoc(monthRef);
            if (snap.exists()) {
                await updateDoc(monthRef, { [slNo]: newPayment });
            } else {
                await setDoc(monthRef, { [slNo]: newPayment }, { merge: true });
            }

            // --- UPDATE prebookings OR cancelledBookings ---
            if (paymentFor === 'Advance') {
                if (!selectedCustomer.monthDoc) throw new Error('Month document is missing for this customer');
                const ref = doc(db, 'prebookings', selectedCustomer.monthDoc);
                const snap = await getDoc(ref);

                const existingCustomerData = snap.exists() && snap.data()[selectedCustomer.id]
                    ? snap.data()[selectedCustomer.id]
                    : { ...selectedCustomer, advancePayments: [] };

                const updatedCustomerData = {
                    ...existingCustomerData,
                    advancePayments: [...(existingCustomerData.advancePayments || []), newPayment]
                };

                await setDoc(ref, { [selectedCustomer.id]: updatedCustomerData }, { merge: true });

            } else if (paymentFor === 'Refund') {
                const ref = doc(db, 'cancelledBookings', selectedCustomer.id);
                const snap = await getDoc(ref);
                const existingRefunds = snap.exists() ? snap.data().refundPayments || [] : [];
                await setDoc(ref, { refundPayments: [...existingRefunds, newPayment] }, { merge: true });
            }

            // Extra Step: Save in accountant (if CashTo is selected)
            if (mode === 'Cash' && cashTo && cashTo !== "Cash") {
                try {
                    // Example: cashTo = "Abhishek-Bank" or "Abhishek-Locker"
                    const accountantRef = doc(db, "accountant", cashTo);

                    const newTransaction = {
                        slNo, // 👈 save the slNo here
                        amount: parseFloat(amount),
                        approval: "approved",
                        createdAt: new Date().toISOString(),
                        date: manualDate,
                        description,
                        type: paymentFor === "Advance" ? "Credit" : "Debit",
                        receiver: receiver?.trim() || "Counter", // optional, helps update logic
                        cashTo, // optional, for reference
                    };

                    const snap = await getDoc(accountantRef);

                    if (snap.exists()) {
                        await updateDoc(accountantRef, {
                            transactions: arrayUnion(newTransaction),
                        });
                    } else {
                        await setDoc(accountantRef, {
                            slNo, // 👈 also save slNo in the accountant doc root (optional)
                            name: cashTo.split("-")[0], // Abhishek
                            email: "",
                            transactions: [newTransaction],
                            type: cashTo.includes("Locker") ? "Locker" : "Bank",
                        });
                    }
                } catch (err) {
                    console.error("❌ Error saving in accountant:", err);
                    alert("❌ Error saving in accountant");
                }
            }

            navigate('/MoneyReceipts');

        } catch (err) {
            console.error('❌ Error saving receipt:', err);
            alert(`❌ Error saving receipt: ${err.message || err}`);
        } finally {
            setIsSaving(false);
            setAmount('');
            setMode('Cash');
            setSelectedCustomer(null);
            setNextSlNo(null);
            setSearch('');
        }
    };

    return (
        <>
            <div>
                <div style={{ marginBottom: '30px' }}><BackButton /></div>
                <div className="receipt-container">
                    <h2 className="title">🧾 Money Receipt</h2>

                    <div className="input-row">
                        <label>Payment For</label>
                        <select value={paymentFor} onChange={e => setPaymentFor(e.target.value)}>
                            <option value="Advance">Advance</option>
                            <option value="Refund">Refund</option>
                        </select>
                    </div>

                    <input type="text" placeholder="🔍 Search by name, 20-07-2025, mobile, or event" value={search} onChange={e => setSearch(e.target.value)} />

                    <div className="source-buttons" style={{ margin: "20px 0", display: "flex", gap: "10px" }}>
                        {[
                            { key: "prebookings", label: "Prebookings" },
                            { key: "vendor", label: "Vendor" },
                            { key: "decoration", label: "Decoration" },
                        ].map(({ key, label, hidden }) => (
                            <button key={key} style={{
                                backgroundColor: activeSource === key ? "#25baffff" : "#d7f2ffff",
                                borderRadius: "15px", padding: "8px 16px", color: "black", fontWeight: "600", border: "none", cursor: "pointer",
                                display: hidden ? "none" : "inline-block"
                            }} onClick={() => setActiveSource(key)}>{label}</button>
                        ))}
                    </div>

                    {selectedCustomer && (
                        <div className="receipt-form">
                            <div className="receipt-box">

                                <p><strong>Sl No.:</strong> {paymentFor === 'Refund' ? (nextRefundSlNo ?? 'Loading...') : (nextSlNo !== null ? (receiptType === 'Cash' ? `C${nextSlNo}` : nextSlNo) : 'Loading...')}</p>
                                <p><strong>{paymentFor === 'Refund' ? 'Refund to' : 'Received with thanks from'}:</strong> {selectedCustomer.prefix || ''} {selectedCustomer.name || ''}</p>
                                <p><strong>Customer Mobile:</strong> {selectedCustomer.mobile1 || ''}</p>
                                {selectedCustomer.functionType && <p><strong>Event:</strong> {selectedCustomer.functionType}</p>}
                                {selectedCustomer.functionDate && (
                                    <p><strong>Event Date:</strong> {formatISTDate(selectedCustomer.functionDate)}</p>
                                )}

                                {/* Mode Selection */}
                                {paymentFor === 'Advance' && (
                                    <div className="mode-group">
                                        {[...banks, 'Card', 'Cheque', 'Cash'].map(m => (
                                            <button style={{ whiteSpace: 'nowrap' }} key={m} className={`mode-button ${mode === m ? 'active' : ''}`} onClick={() => { setMode(m); setReceiptType(m === 'Cash' ? 'Cash' : 'Money Receipt'); }}>{m === 'Card' ? 'Credit Card' : m}</button>
                                        ))}
                                    </div>
                                )}

                                {paymentFor === 'Advance' && mode === 'Cash' && (
                                    <div className="input-row">
                                        <label>Cash To</label>
                                        <select value={cashTo} onChange={e => setCashTo(e.target.value)}>
                                            <option value="">-- Select --</option>
                                            <option value="Cash-Cash">Cash</option>
                                            {assignedUsers.map(u => (
                                                <option key={`${u.email}-${u.type}`} value={`${u.name}-${u.type}`}>
                                                    {u.name} - ({u.type})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div className="input-row">
                                    <label>Amount (₹)</label>
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        value={amount}
                                        onChange={(e) => {
                                            let val = e.target.value.replace(/[^0-9.]/g, "");
                                            if ((val.match(/\./g) || []).length > 1) val = val.slice(0, -1);
                                            setAmount(val);
                                        }}
                                    />
                                </div>


                                <p><strong>Amount in Words:</strong> {amountWords}</p>

                                <div className="input-row">
                                    <label>Description</label>
                                    <input type="text" value={description} onChange={e => setDescription(e.target.value)} />
                                </div>

                                <div className="input-row">
                                    <label>Date</label>
                                    <input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} />
                                </div>

                                <div className="submit-row">
                                    <button onClick={handleSubmit} disabled={isSaving}>{isSaving ? '⏳ Saving...' : paymentFor === 'Refund' ? '💸 Save Refund' : '📝 Save & Print'}</button>
                                </div>

                            </div>
                        </div>
                    )}

                    <div className="match-list">
                        {customers
                            .filter(c => {
                                const searchLower = search.toLowerCase();

                                // Function Date ko DD-MM-YYYY & DD/MM/YYYY me convert karo
                                const formattedDateDash = formatISTDate(c.functionDate); // 25-08-2025

                                const formattedDateSlash = formattedDateDash.replace(/-/g, '-'); // 25-08-2025

                                return (
                                    c.name?.toLowerCase().includes(searchLower) ||
                                    c.mobile1?.includes(search) ||
                                    c.functionType?.toLowerCase().includes(searchLower) ||
                                    formattedDateDash.includes(search) ||
                                    formattedDateSlash.includes(search)
                                );
                            })
                            .map(cust => (
                                <div
                                    key={cust.id}
                                    className="match-item"
                                    onClick={async () => {
                                        setSelectedCustomer(cust);
                                        if (paymentFor === "Advance") await fetchNextSlNo();
                                    }}
                                >
                                    {cust.name} - {cust.mobile1} - (
                                    {new Date(cust.functionDate)
                                        .toLocaleDateString("en-GB")
                                        .replace(/\//g, "-")}
                                    ) {cust.functionType ? `(${cust.functionType})` : ""}
                                </div>
                            ))}
                    </div>
                </div>
            </div>

            <div style={{ marginBottom: "50px" }}></div>
            <BottomNavigationBar navigate={navigate} userAppType={userAppType} />
        </>
    );
};

export default MoneyReceipt;
