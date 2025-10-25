import React, { useEffect, useState, useRef } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";

export default function DailyReport() {
    const [report, setReport] = useState(null);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showCalendar, setShowCalendar] = useState(false);
    const calendarRef = useRef(null);

    const formatDate = (date) => {
        const istDate = new Date(
            date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
        );

        const year = istDate.getFullYear();
        const month = String(istDate.getMonth() + 1).padStart(2, "0");
        const day = String(istDate.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    };


    const formatDateIST = (date) =>
        new Date(date).toLocaleDateString("en-IN", {
            timeZone: "Asia/Kolkata",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });

    useEffect(() => {
        const fetchBalances = async () => {
            const formattedDate = formatDate(selectedDate);
            const prevDateObj = new Date(selectedDate);
            prevDateObj.setDate(prevDateObj.getDate() - 1);
            const prevDate = formatDate(prevDateObj);

            let openingBalance = 0;
            let totalCreditsToday = 0;
            let totalDebitsToday = 0;

            const bankBalances = {};
            const cashBalances = {};

            const monthNames = [
                "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
            ];
            const selectedMonthYear = `${monthNames[selectedDate.getMonth()]}${selectedDate.getFullYear()}`;
            const prevMonthYear = `${monthNames[prevDateObj.getMonth()]}${prevDateObj.getFullYear()}`;

            // Opening balance (all receipts till prevDate)
            const prevMonthRef = doc(db, "moneyReceipts", prevMonthYear);
            const prevSnap = await getDoc(prevMonthRef);
            if (prevSnap.exists()) {
                Object.values(prevSnap.data()).forEach((trx) => {
                    if (!trx || trx.approval !== "Accepted") return;
                    if (trx.receiptDate > prevDate) return;
                    const amt = Number(trx.amount) || 0;
                    openingBalance += trx.paymentFor === "Credit" ? amt : -amt;
                });
            }

            // Today's transactions
            const todayMonthRef = doc(db, "moneyReceipts", selectedMonthYear);
            const todaySnap = await getDoc(todayMonthRef);
            if (todaySnap.exists()) {
                Object.values(todaySnap.data()).forEach((trx) => {
                    if (!trx) return; // keep only null check
                    if (trx.receiptDate !== formattedDate) return;

                    const amt = Number(trx.amount) || 0;
                    const signed = trx.paymentFor === "Credit" ? amt : -amt;

                    // Bank balances
                    if (trx.mode && trx.mode !== "Cash") {
                        if (!bankBalances[trx.mode]) bankBalances[trx.mode] = 0;
                        bankBalances[trx.mode] += signed;
                    }

                    // Cash accounts
                    if (trx.cashTo && trx.cashTo !== "pettyCash" && trx.cashTo !== "lockerBalance") {
                        if (!cashBalances[trx.cashTo]) cashBalances[trx.cashTo] = 0;
                        cashBalances[trx.cashTo] += signed;
                    }


                    // Total credits/debits
                    if (trx.paymentFor === "Credit") totalCreditsToday += amt;
                    else totalDebitsToday += amt;
                });

            }

            const totalBusiness = totalCreditsToday - totalDebitsToday;
            const closingBalance = openingBalance + totalBusiness;

            setReport({
                date: formattedDate,
                openingBalance,
                closingBalance,
                totalBusiness,
                bankBalances,
                cashBalances,
                totalBank: Object.values(bankBalances).reduce((a, b) => a + b, 0),
                totalCash: Object.values(cashBalances).reduce((a, b) => a + b, 0),
            });
        };

        fetchBalances().catch(console.error);
    }, [selectedDate]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (calendarRef.current && !calendarRef.current.contains(e.target)) setShowCalendar(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    if (!report) return <div style={{ padding: 20, textAlign: "center" }}>Loading Daily Report...</div>;

    return (
        <div
            style={{
                maxWidth: 600,
                padding: "10px 20px",
                fontFamily: "Arial",
                backgroundColor: "#e7ecffff",
                borderRadius: 12,
                boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
                position: "relative",
                minHeight: '400px',
                margin: '10px auto'
            }}
        >
            <div style={{ position: "relative" }} ref={calendarRef}>
                <button
                    onClick={() => setShowCalendar((prev) => !prev)}
                    style={{
                        position: "absolute",
                        right: 10,
                        top: 10,
                        padding: "5px",
                        cursor: "pointer",
                        border: "1px solid #ccc",
                        borderRadius: 6,
                        background: "#fff",
                    }}
                >
                    📅
                </button>
                {showCalendar && (
                    <div
                        style={{
                            position: "absolute",
                            top: 40,
                            right: 0,
                            zIndex: 1000,
                            background: "#fff",
                            border: "1px solid #ccc",
                            borderRadius: 6,
                            boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
                        }}
                    >
                        <Calendar
                            value={selectedDate}
                            onChange={(date) => {
                                setSelectedDate(date);
                                setShowCalendar(false);
                            }}
                            prev2Label={null}
                            next2Label={null}
                        />
                    </div>
                )}
            </div>

            <h4>Date: {formatDateIST(report.date)}</h4>

            <div>
                <h4>🏦 Bank Balance: ₹{report.totalBank.toLocaleString("en-IN")}</h4>
                <ul>
                    {Object.entries(report.bankBalances).map(([name, amt]) => (
                        <li key={name}>
                            {name}: ₹{amt.toLocaleString("en-IN")}
                        </li>
                    ))}
                </ul>
            </div>

            <div>
                <h4>💵 Cash In-hand: ₹{report.totalCash.toLocaleString("en-IN")}</h4>
                <ul>
                    {Object.entries(report.cashBalances).map(([name, amt]) => (
                        <li key={name}>
                            {name}: ₹{amt.toLocaleString("en-IN")}
                        </li>
                    ))}
                </ul>
            </div>

            {/* <div>
                <h4>🔒 Locker Balance: ₹{report.lockerBalance.toLocaleString("en-IN")}</h4>
                <h4>🪙 Petty Cash: ₹{report.pettyCash.toLocaleString("en-IN")}</h4>
            </div> */}

            <div>
                <span style={{ color: report.openingBalance >= 0 ? "#0077ffff" : "crimson" }}>
                    Opening: ₹{report.openingBalance.toLocaleString("en-IN")}
                </span>{" "}
                -{" "}
                <span style={{ color: report.closingBalance >= 0 ? "green" : "crimson" }}>
                    Closing: ₹{report.closingBalance.toLocaleString("en-IN")}
                </span>
                <h4 style={{ color: report.totalBusiness >= 0 ? "#ff7700ff" : "crimson" }}>
                    Today's Business: ₹{report.totalBusiness.toLocaleString("en-IN")}
                </h4>
                {/* <div style={{ marginBottom: '150px' }}></div> */}
            </div>
        </div>
    );
}
