import React, { useEffect, useState } from "react";
import { collection, onSnapshot, doc, getDoc, setDoc, updateDoc, arrayUnion, getDocs } from "firebase/firestore";
import { db } from "../firebaseConfig";
import BackButton from "../components/BackButton";
import styles from "../styles/accountant.module.css";
import { useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth";
import BottomNavigationBar from "../components/BottomNavigationBar";

const AccountantCashReceipts = () => {
    const [totalCash, setTotalCash] = useState(0);
    const [distribution, setDistribution] = useState([]);
    const [cashInHand, setCashInHand] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState("");
    const [modalName, setModalName] = useState("");
    const [modalEmail, setModalEmail] = useState("");
    const [modalAmount, setModalAmount] = useState("");
    const [modalDescription, setModalDescription] = useState("");
    const [totalLockerBalance, setTotalLockerBalance] = useState(0);
    const [modalUserType, setModalUserType] = useState("");
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
        const receiptsUnsub = onSnapshot(collection(db, "moneyReceipts"), async (snap) => {
            let cashSum = 0;

            snap.forEach(docSnap => {
                const data = docSnap.data(); // data = { receiptId1: {...}, receiptId2: {...} }

                // iterate over all receipts inside this monthYear doc
                Object.values(data).forEach(receipt => {
                    if ((receipt.mode || "").toLowerCase() === "cash") {
                        const amt = Number(receipt.amount || 0);
                        cashSum += (receipt.paymentFor || "").toLowerCase() === "credit" ? amt : -amt;
                    }
                });
            });

            const bankRef = doc(db, "accountant", "AssignBank");
            const lockerRef = doc(db, "accountant", "AssignLocker");
            const [bankSnap, lockerSnap] = await Promise.all([getDoc(bankRef), getDoc(lockerRef)]);

            let assignedUsers = [];
            if (bankSnap.exists()) assignedUsers.push(...(bankSnap.data().users || []).map(u => ({ ...u, type: "Bank" })));
            if (lockerSnap.exists()) assignedUsers.push(...(lockerSnap.data().users || []).map(u => ({ ...u, type: "Locker" })));

            // Unique users by email + type
            const uniqueUsers = Object.values(assignedUsers.reduce((acc, u) => {
                const key = `${u.email}-${u.type}`;
                acc[key] = u;
                return acc;
            }, {}));

            const accountantUnsub = onSnapshot(collection(db, "accountant"), (accSnap) => {
                const distributed = uniqueUsers.map(u => {
                    const docId = `${u.name}-${u.type}`;
                    const personSnap = accSnap.docs.find(d => d.id === docId);

                    let personTotal = 0;
                    let hasDenied = false;

                    if (personSnap) {
                        const transactions = personSnap.data().transactions || [];
                        let approvedTransactions;

                        if (u.name === "Ashish Bank" || u.name === "Shiva Bank") {
                            approvedTransactions = transactions;
                            hasDenied = false;
                        } else {
                            approvedTransactions = transactions.filter(t => t.approval === "approved");
                            hasDenied = transactions.some(t => t.approval === "denied");
                        }

                        approvedTransactions.forEach(t => {
                            const amt = Number(t.amount || 0);
                            personTotal += (t.type || "").toLowerCase() === "credit" ? amt : -amt;
                        });
                    }

                    return { ...u, amount: personTotal, hasDenied };
                });

                const lockerTotal = distributed
                    .filter(p => p.name !== "Ashish Bank" && p.name !== "Shiva Bank")
                    .reduce((sum, p) => sum + p.amount, 0);

                const totalDistributed = distributed.reduce((sum, p) => sum + p.amount, 0);
                const newCashInHand = cashSum - totalDistributed;

                setDistribution(distributed);
                setTotalLockerBalance(lockerTotal);
                setCashInHand(newCashInHand);
                setTotalCash(cashSum);
            });

            return () => accountantUnsub();
        });

        return () => receiptsUnsub();
    }, []);

    const handleTransaction = async () => {
        const amount = parseFloat(modalAmount);
        if (isNaN(amount) || amount <= 0) { alert("Invalid amount"); return; }
        if (!modalDescription.trim()) { alert("Enter description"); return; }

        setIsProcessing(true);
        setProgress(0);
        let progressVal = 0;
        const interval = setInterval(() => { progressVal += 5; setProgress(progressVal); }, 100);

        try {
            const user = distribution.find(u => u.name === modalName && u.type === modalUserType);
            if (!user) throw new Error("User not found in distribution list");

            const docId = `${modalName}-${user.type}`;
            const personDocRef = doc(db, "accountant", docId);

            const approvalStatus = user.type === "Bank" ? "approved" : "denied";

            // IST = UTC + 5:30
            const nowUTC = new Date();
            const nowIST = new Date(nowUTC.getTime() + 5.5 * 60 * 60 * 1000);

            const yyyy = nowIST.getFullYear();
            const mm = String(nowIST.getMonth() + 1).padStart(2, '0');
            const dd = String(nowIST.getDate()).padStart(2, '0');
            const hh = String(nowIST.getHours()).padStart(2, '0');
            const min = String(nowIST.getMinutes()).padStart(2, '0');
            const sec = String(nowIST.getSeconds()).padStart(2, '0');

            const newTransaction = {
                amount,
                type: modalType,
                approval: approvalStatus,
                description: modalDescription,
                date: `${yyyy}-${mm}-${dd}`,          // YYYY-MM-DD IST
                createdAt: `${yyyy}-${mm}-${dd}T${hh}:${min}:${sec}+05:30` // Full IST timestamp
            };


            const personSnap = await getDoc(personDocRef);
            if (personSnap.exists()) {
                await updateDoc(personDocRef, { transactions: arrayUnion(newTransaction) });
            } else {
                await setDoc(personDocRef, {
                    name: modalName,
                    email: modalEmail,
                    type: user.type,
                    transactions: [newTransaction]
                });
            }

            const accSnap = await getDocs(collection(db, "accountant"));
            setDistribution(prev => prev.map(item => {
                const docId = `${item.name}-${item.type}`;
                const personSnap = accSnap.docs.find(d => d.id === docId);
                if (personSnap) {
                    const transactions = personSnap.data().transactions || [];
                    let personTotal = 0;
                    let hasDenied = false;
                    const approvedTransactions =
                        item.name === "Ashish Bank" || item.name === "Shiva Bank"
                            ? transactions
                            : transactions.filter(t => t.approval === "approved");
                    hasDenied = transactions.some(t => t.approval === "denied");
                    approvedTransactions.forEach(t => {
                        const amt = Number(t.amount || 0);
                        personTotal += t.type?.toLowerCase() === "credit" ? amt : -amt;
                    });
                    return { ...item, amount: personTotal, hasDenied };
                }
                return item;
            }));

            setProgress(100);
            clearInterval(interval);
            setTimeout(() => {
                setIsProcessing(false);
                setShowModal(false);
                setModalAmount("");
                setModalDescription("");
                navigate("/accountant");
            }, 500);

        } catch (error) {
            console.error("Error saving transaction:", error);
            clearInterval(interval);
            setIsProcessing(false);
        }
    };

    return (
        <>
            <div className={styles.container}>
                <BackButton />
                <div className={styles.header} style={{ marginTop: '40px' }}>
                    <h2 className={styles.title}>Cashflow</h2>
                </div>

                <div className={styles.cashInHand}>
                    <span>💰 Total Cash Bal A/C: <span> ₹{totalCash.toLocaleString("en-IN")}</span></span>
                    <span>🏦 Total Locker Bal: <span> ₹{totalLockerBalance.toLocaleString("en-IN")}</span></span>
                    <span>💵 Cash in Hand: <span> ₹{cashInHand.toLocaleString("en-IN")}</span></span>
                </div>

                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Amount</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {distribution.map((item, index) => (
                                <tr key={index} style={{ whiteSpace: 'nowrap' }}>
                                    <td style={{ display: "flex", alignItems: "center", gap: "8px", height: "100%" }}>
                                        <span
                                            style={{
                                                display: "inline-block",
                                                width: "12px",
                                                height: "12px",
                                                borderRadius: "50%",
                                                backgroundColor: item.hasDenied ? "red" : "transparent",
                                                flexShrink: 0,
                                            }}
                                            title={item.hasDenied ? "Pending approval" : "All approved"}
                                        ></span>
                                        <span style={{ lineHeight: "2" }}>{item.name} - ({item.type})</span>
                                    </td>

                                    <td>₹{item.amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                                    <td>
                                        <button
                                            className={styles.creditBtn}
                                            onClick={() => {
                                                setModalName(item.name);
                                                setModalEmail(item.email);
                                                setModalType("Credit");
                                                setModalUserType(item.type);
                                                setShowModal(true);
                                            }}
                                        >
                                            Credit
                                        </button>
                                        <button
                                            className={styles.debitBtn}
                                            onClick={() => {
                                                setModalName(item.name);
                                                setModalEmail(item.email);
                                                setModalType("Debit");
                                                setModalUserType(item.type);
                                                setShowModal(true);
                                            }}
                                        >
                                            Debit
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {showModal && (
                    <div className={styles.modalOverlay}>
                        <div className={styles.modal}>
                            <h3>{modalType} for {modalName}</h3>
                            {isProcessing && (
                                <div className={styles.progressWrapper}>
                                    <div className={styles.progressBar} style={{ width: `${progress}%` }} />
                                </div>
                            )}

                            <textarea
                                placeholder="Enter description"
                                value={modalDescription}
                                onChange={(e) => setModalDescription(e.target.value)}
                                className={styles.textArea}
                            />

                            <input
                                type="text"
                                inputMode="decimal"
                                placeholder="Enter amount"
                                value={modalAmount}
                                onChange={(e) => {
                                    let val = e.target.value.replace(/[^0-9.]/g, "");
                                    if ((val.match(/\./g) || []).length > 1) val = val.slice(0, -1);
                                    setModalAmount(val);
                                }}
                            />


                            <div className={styles.modalActions}>
                                <button className={styles.saveBtn} onClick={handleTransaction}>Save</button>
                                <button className={styles.cancelBtn} onClick={() => setShowModal(false)}>Cancel</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <BottomNavigationBar navigate={navigate} userAppType={userAppType} />
        </>
    );
};

export default AccountantCashReceipts;
