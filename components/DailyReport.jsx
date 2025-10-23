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

    // ✅ Use this formatDate function globally
    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    };

    useEffect(() => {
        if (!selectedDate) return;

        const fetchBalances = async () => {
            const formattedDate = formatDate(selectedDate);

            // Previous day
            const prevDateObj = new Date(selectedDate);
            prevDateObj.setDate(prevDateObj.getDate() - 1);
            const prevDate = formatDate(prevDateObj);

            let openingBalance = 0,
                totalCreditsToday = 0,
                totalDebitsToday = 0,
                boi = 0,
                sbi = 0,
                ashishAcc = 0,
                shivaAcc = 0,
                pettyCash = 0,
                lockerBalance = 0;

            const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
            const selectedMonthYear = `${monthNames[selectedDate.getMonth()]}${selectedDate.getFullYear()}`;
            const prevMonthYear = `${monthNames[prevDateObj.getMonth()]}${prevDateObj.getFullYear()}`;

            // 1️⃣ Opening balance (all receipts till prevDate)
            const prevMonthRef = doc(db, "moneyReceipts", prevMonthYear);
            const prevSnap = await getDoc(prevMonthRef);
            if (prevSnap.exists()) {
                const dataMap = prevSnap.data();
                Object.values(dataMap).forEach(data => {
                    if (!data || data.approval !== "Accepted") return;
                    if (data.receiptDate > prevDate) return;

                    const amt = Number(data.amount) || 0;
                    openingBalance += (data.paymentFor === "Debit" ? -amt : amt);
                });
            }

            // 2️⃣ Today's transactions
            const todayMonthRef = doc(db, "moneyReceipts", selectedMonthYear);
            const todaySnap = await getDoc(todayMonthRef);
            if (todaySnap.exists()) {
                const dataMap = todaySnap.data();
                Object.values(dataMap).forEach(data => {
                    if (!data || data.approval !== "Accepted") return;
                    if (data.receiptDate !== formattedDate) return;

                    const amt = Number(data.amount) || 0;
                    if (data.paymentFor === "Credit") totalCreditsToday += amt;
                    else totalDebitsToday += amt;

                    const signed = data.paymentFor === "Debit" ? -amt : amt;
                    if (data.mode === "BOI") boi += signed;
                    if (data.mode === "SBI") sbi += signed;
                    if (data.cashTo === "AshishBank") ashishAcc += signed;
                    if (data.cashTo === "ShivaBank") shivaAcc += signed;
                    if (data.cashTo === "pettyCash") pettyCash += signed;
                    if (data.cashTo === "lockerBalance") lockerBalance += signed;
                });
            }

            const totalBusiness = totalCreditsToday - totalDebitsToday;
            const closingBalance = openingBalance + totalBusiness;
            const totalBank = boi + sbi;
            const totalCash = ashishAcc + shivaAcc;

            setReport({
                date: formattedDate,
                openingBalance,
                closingBalance,
                totalBusiness,
                boi,
                sbi,
                ashishAcc,
                shivaAcc,
                pettyCash,
                lockerBalance,
                totalBank,
                totalCash
            });
        };

        fetchBalances().catch(console.error);
    }, [selectedDate]);

    // Click outside calendar to close
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (calendarRef.current && !calendarRef.current.contains(event.target)) {
                setShowCalendar(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    if (!report) return <div style={{ padding: 20, textAlign: "center" }}>Loading Daily Report...</div>;

    return (
        <div style={{ maxWidth: 600, padding: "10px 20px", fontFamily: "Arial", backgroundColor: "#f9f9f9", borderRadius: 12, boxShadow: "0 4px 8px rgba(0,0,0,0.1)", position: "relative" }}>
            <div style={{ position: "relative" }} ref={calendarRef}>
                <button onClick={() => setShowCalendar(prev => !prev)} style={{ position: "absolute", right: "10px", top: "10px", padding: "5px", cursor: "pointer", border: "1px solid #ccc", borderRadius: "6px", background: "#fff" }}>
                    📅
                </button>
                {showCalendar && (
                    <div style={{ position: "absolute", top: "40px", right: "0px", zIndex: 1000, background: "#fff", border: "1px solid #ccc", borderRadius: "6px", boxShadow: "0 4px 8px rgba(0,0,0,0.1)" }}>
                        <Calendar value={selectedDate} onChange={(date) => { setSelectedDate(date); setShowCalendar(false); }} prev2Label={null} next2Label={null} />
                    </div>
                )}
            </div>

            <h4>Date: {new Date(report.date).toLocaleDateString()}</h4>

            <div>
                <h4>🏦 Bank Balance: ₹{report.totalBank.toLocaleString("en-IN")}</h4>
                <ul>
                    <li>BOI: ₹{report.boi.toLocaleString("en-IN")}</li>
                    <li>SBI: ₹{report.sbi.toLocaleString("en-IN")}</li>
                </ul>
            </div>

            <div>
                <h4>💵 Cash In-hand: ₹{report.totalCash.toLocaleString("en-IN")}</h4>
                <ul>
                    <li>Ashish Jee A/C Bal: ₹{report.ashishAcc.toLocaleString("en-IN")}</li>
                    <li>Shiva Jee A/C Bal: ₹{report.shivaAcc.toLocaleString("en-IN")}</li>
                </ul>
            </div>

            <div>
                <h4>🔒 Locker Balance: ₹{report.lockerBalance.toLocaleString("en-IN")}</h4>
            </div>

            <div>
                <h4>🪙 Petty Cash: ₹{report.pettyCash.toLocaleString("en-IN")}</h4>
            </div>

            <div>
                <span style={{ color: report.openingBalance >= 0 ? "#0077ffff" : "crimson" }}>Opening: ₹{report.openingBalance.toLocaleString("en-IN")}</span> - 
                <span style={{ color: report.closingBalance >= 0 ? "green" : "crimson" }}>Closing: ₹{report.closingBalance.toLocaleString("en-IN")}</span>
                <h4 style={{ color: report.totalBusiness >= 0 ? "#ff7700ff" : "crimson" }}>Today's Business: ₹{report.totalBusiness.toLocaleString("en-IN")}</h4>
            </div>
        </div>
    );
}
