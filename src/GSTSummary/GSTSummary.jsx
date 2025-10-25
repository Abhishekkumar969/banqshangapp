import React, { useState, useEffect, useCallback } from "react";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../firebaseConfig";
import "./GSTSummary.css";
import { getAuth } from "firebase/auth";
import BackButton from "../components/BackButton";
import BottomNavigationBar from "../components/BottomNavigationBar";
import { useNavigate } from "react-router-dom";

const GSTSummary = () => {
    const navigate = useNavigate();
    const [data, setData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [paymentMode, setPaymentMode] = useState("");
    const [loading, setLoading] = useState(true);
    const [financialYear, setFinancialYear] = useState(null);
    const [financialYears, setFinancialYears] = useState([]);
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [sortConfig, setSortConfig] = useState({ key: "functionDate", direction: "desc" });
    const [userAppType, setUserAppType] = useState(null);
    const [uniqueModes, setUniqueModes] = useState([]);



    // Converts Firestore date string / Timestamp to IST Date
    const toISTDate = (dateInput) => {
        if (!dateInput) return new Date();

        let d;
        if (typeof dateInput === "string") {
            d = new Date(dateInput); // Firestore UTC string
        } else if (dateInput.toDate) {
            d = dateInput.toDate(); // Firestore Timestamp
        } else {
            d = dateInput;
        }

        // Convert UTC -> IST by adding 5.5 hours
        const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
        return ist;
    };

    const today = toISTDate(new Date());
    today.setHours(0, 0, 0, 0);


    // Format IST date as DD-MM-YYYY
    // Format Firestore date string / Timestamp as DD-MM-YYYY in IST (ignoring local timezone)
    const formatDateIST = (dateInput) => {
        if (!dateInput) return "-";

        let d;
        if (typeof dateInput === "string") {
            // Treat string as YYYY-MM-DD or ISO string, parse as UTC
            d = new Date(dateInput + "T00:00:00Z");
        } else if (dateInput.toDate) {
            // Firestore Timestamp
            d = dateInput.toDate();
        } else {
            d = dateInput;
        }

        // Convert to IST manually
        const utcYear = d.getUTCFullYear();
        const utcMonth = d.getUTCMonth();
        const utcDate = d.getUTCDate();

        // Add 5.5 hours to get IST date
        const istDate = new Date(Date.UTC(utcYear, utcMonth, utcDate, 5, 30));

        const day = String(istDate.getUTCDate()).padStart(2, "0");
        const month = String(istDate.getUTCMonth() + 1).padStart(2, "0");
        const year = istDate.getUTCFullYear();

        return `${day}-${month}-${year}`;
    };


    const parseDate = useCallback((dateStr) => {
        if (!dateStr) return new Date();
        const [year, month, day] = dateStr.split("-").map(Number);
        return toISTDate(new Date(year, month - 1, day));
    }, []);

    // ✅ Fetch user app type
    useEffect(() => {
        const fetchUserAppType = async () => {
            const auth = getAuth();
            const user = auth.currentUser;
            if (user) {
                try {
                    const userRef = doc(db, "usersAccess", user.email);
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                        setUserAppType(userSnap.data().accessToApp);
                    }
                } catch (err) {
                    console.error("Error fetching user app type:", err);
                }
            }
        };
        fetchUserAppType();
    }, []);

    // ✅ Fetch and merge Firestore data
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const snapshot = await getDocs(collection(db, "prebookings"));
                const bookingMap = new Map();
                const fySet = new Set();
                const modeSet = new Set();

                snapshot.forEach((outerDoc) => {
                    const docData = outerDoc.data();
                    Object.entries(docData).forEach(([subId, subData]) => {
                        if (!subData?.advancePayments || subData.advancePayments.length === 0) return;

                        const key = `${subData.partyName || subData.name}-${subData.functionDate}`;

                        subData.advancePayments.forEach((payment) => {
                            if (!payment.amount || !payment.receiptDate) return;
                            if (payment.mode === "Cash") return;

                            const amount = Number(payment.amount) || 0;
                            const receiptDate = payment.receiptDate;

                            modeSet.add(payment.mode);

                            if (!bookingMap.has(key)) {
                                bookingMap.set(key, {
                                    name: subData.partyName || subData.name || "Unknown",
                                    functionDate: subData.functionDate,
                                    payments: [],
                                });
                            }

                            bookingMap.get(key).payments.push({
                                mode: payment.mode,
                                amount,
                                receiptDate,
                            });
                        });
                    });
                });

                // Convert Map to array and calculate totals
                const bookings = Array.from(bookingMap.values()).map((b) => {
                    const totalAmount = b.payments.reduce((sum, p) => sum + p.amount, 0);
                    const dateObj = parseDate(b.functionDate);
                    const fyYear = dateObj.getMonth() + 1 >= 4 ? dateObj.getFullYear() : dateObj.getFullYear() - 1;
                    fySet.add(fyYear);

                    return {
                        ...b,
                        amount: totalAmount,
                        dateObj,
                    };
                });

                setData(bookings);
                setFinancialYears(Array.from(fySet).sort((a, b) => b - a));
                setUniqueModes(Array.from(modeSet));
                if (fySet.size > 0) setFinancialYear(Math.max(...fySet));
            } catch (err) {
                console.error("Error fetching prebookings:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [parseDate]);

    // ✅ Filtering logic
    const handleFilter = useCallback(() => {
        let filtered = data;

        // Only past functionDate
        filtered = filtered.filter((entry) => {
            if (!entry.functionDate) return false;
            const fDate = toISTDate(new Date(entry.functionDate));
            return fDate <= today;
        });

        // Financial year filter
        if (financialYear) {
            const fyStart = toISTDate(new Date(`${financialYear}-04-01`));
            const fyEnd = toISTDate(new Date(`${financialYear + 1}-03-31`));
            filtered = filtered.filter((entry) => {
                const fDate = toISTDate(new Date(entry.functionDate));
                return fDate >= fyStart && fDate <= fyEnd;
            });
        }

        // From/To date filter
        if (fromDate && toDate) {
            const from = toISTDate(new Date(fromDate));
            const to = toISTDate(new Date(toDate));
            filtered = filtered.filter((entry) => {
                const fDate = toISTDate(new Date(entry.functionDate));
                return fDate >= from && fDate <= to;
            });
        }

        // Payment mode filter
        if (paymentMode) {
            filtered = filtered.filter((entry) => entry.payments.some((p) => p.mode === paymentMode));
        }

        // Sorting
        if (sortConfig.key) {
            filtered.sort((a, b) => {
                const dateA = sortConfig.key === "functionDate" ? toISTDate(new Date(a.functionDate)) : toISTDate(new Date(a.payments[0]?.receiptDate));
                const dateB = sortConfig.key === "functionDate" ? toISTDate(new Date(b.functionDate)) : toISTDate(new Date(b.payments[0]?.receiptDate));
                return sortConfig.direction === "asc" ? dateA - dateB : dateB - dateA;
            });
        }

        setFilteredData(filtered);
    }, [data, financialYear, fromDate, toDate, paymentMode, sortConfig, today]);

    useEffect(() => {
        if (data.length > 0) handleFilter();
    }, [data, financialYear, fromDate, toDate, paymentMode, sortConfig, handleFilter]);

    // ✅ Totals
    const totalAll = filteredData.reduce((acc, curr) => acc + curr.amount, 0);
    const gst = totalAll * 0.18;
    const baseAmt = totalAll - gst;

    const getTotalByMode = (mode) =>
        filteredData.reduce(
            (sum, entry) =>
                sum +
                entry.payments.filter((p) => p.mode === mode).reduce((s, p) => s + p.amount, 0),
            0
        );

    const modeTotals = uniqueModes.map((mode) => ({
        mode,
        total: getTotalByMode(mode),
    }));

    const handlePrint = () => {
        if (!filteredData.length) return;

        // Generate HTML table rows dynamically
        const rowsHTML = filteredData
            .map((entry, idx) => `
            <tr>
                <td>${filteredData.length - idx}.</td>
                <td>${entry.name}</td>
                <td>${entry.functionDate ? formatDateIST(entry.functionDate) : '-'}</td>
                <td>
                    ${entry.payments.map(p => formatDateIST(p.receiptDate)).join('<br>')}
                </td>
                <td>₹${entry.amount.toLocaleString("en-IN")}</td>
                <td>${entry.payments.map(p => p.mode).join('<br>')}</td>
            </tr>
        `).join('');

        const totalsHTML = `
        <p><strong>Total Amount:</strong> ₹${totalAll.toLocaleString("en-IN")} (incl. GST)</p>
        <p><strong>GST @18%:</strong> ₹${gst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
    `;

        const fromToHTML = (fromDate && toDate)
            ? `<p><strong>From:</strong> ${fromDate} &nbsp;&nbsp; <strong>To:</strong> ${toDate}</p>`
            : '';

        const printHTML = `
        <html>
        <head>
            <title>GST Summary (FY: ${financialYear}-${financialYear + 1})</title>
            <style>
                body { font-family: Arial, sans-serif; font-size: 12px; padding: 20px; }
                h2 { text-align: center; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #000; padding: 4px 6px; text-align: left; font-size: 12px; }
                th { background-color: #eef6ff; }
                p { font-weight: bold; margin: 4px 0; }
            </style>
        </head>
        <body>
            <h2>📊 GST Summary (FY: ${financialYear}-${financialYear + 1})</h2>
            ${fromToHTML}
            ${totalsHTML}
            <table>
                <thead>
                    <tr>
                        <th>Sl No.</th>
                        <th>Name</th>
                        <th>Function Date</th>
                        <th>Receipt Dates</th>
                        <th>Amount</th>
                        <th>Payment Modes</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHTML}
                </tbody>
            </table>
        </body>
        </html>
    `;

        // Create hidden iframe and print
        const iframe = document.createElement("iframe");
        iframe.style.position = "fixed";
        iframe.style.right = "0";
        iframe.style.bottom = "0";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "0";
        document.body.appendChild(iframe);

        iframe.contentDocument.open();
        iframe.contentDocument.write(printHTML);
        iframe.contentDocument.close();

        iframe.contentWindow.focus();
        iframe.contentWindow.print();
    };



    return (
        <>
            <div className="gst-summary-wrapper">
                <div style={{ marginBottom: "30px" }}>
                    <BackButton />
                </div>

                <h2 className="gst-title">
                    📊 GST Summary (FY: {financialYear}-{financialYear + 1})
                </h2>

                {/* Filters */}
                <div className="filters no-print">
                    <select value={financialYear ?? ""} onChange={(e) => setFinancialYear(Number(e.target.value))}>
                        {financialYears.length === 0 ? (
                            <option value="">No FY Found</option>
                        ) : (
                            financialYears.map((y) => (
                                <option key={y} value={y}>
                                    FY {y}-{y + 1}
                                </option>
                            ))
                        )}
                    </select>

                    <label>
                        From:
                        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                    </label>

                    <label>
                        To:
                        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                    </label>

                    <select style={{ display: "none" }} value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                        <option value="">All Modes</option>
                        {uniqueModes.map((m) => (
                            <option key={m} value={m}>
                                {m}
                            </option>
                        ))}
                    </select>

                    <div className="filter-buttons">
                        <button onClick={handleFilter}>🔍 Apply</button>
                        <button onClick={handlePrint}>🖨️ Print</button>
                    </div>
                </div>

                <div id="print-area">
                    {loading ? (
                        <p className="loading">Loading data...</p>
                    ) : (
                        <>
                            <div className="gst-summary">
                                {modeTotals.map(
                                    (mt) =>
                                        mt.total > 0 && (
                                            <p key={mt.mode}>
                                                <strong>{mt.mode}:</strong> ₹{mt.total.toLocaleString("en-IN")}
                                            </p>
                                        )
                                )}
                                <p style={{ fontWeight: "bold", color: "#006db6" }}>
                                    <strong>Total Amount:</strong> ₹{totalAll.toLocaleString("en-IN")} (incl. GST)
                                </p>
                                <p style={{ fontWeight: "bold", color: "red" }}>
                                    <strong>GST @18%:</strong>{" "}
                                    ₹{gst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                                <p style={{ fontWeight: "bold", color: "#006db6" }}>
                                    <strong>Base Amount:</strong> ₹{baseAmt.toLocaleString("en-IN")} (excl. GST)
                                </p>
                            </div>

                            {filteredData.length > 0 ? (
                                <div className="gst-table-wrapper">
                                    <div style={{ overflowX: "auto" }}>
                                        <table className="gst-table">
                                            <thead>
                                                <tr>
                                                    <th>Sl No.</th>
                                                    <th>Name</th>
                                                    <th>
                                                        <button
                                                            style={{ backgroundColor: "transparent", padding: "0px" }}
                                                            onClick={() =>
                                                                setSortConfig({
                                                                    key: "functionDate",
                                                                    direction: sortConfig.direction === "asc" ? "desc" : "asc",
                                                                })
                                                            }
                                                        >
                                                            Function Date {sortConfig.key === "functionDate" ? (sortConfig.direction === "asc" ? "▲" : "▼") : ""}
                                                        </button>
                                                    </th>
                                                    <th>Receipt Dates</th>
                                                    <th>Amount</th>
                                                    <th>Payment Modes</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredData.map((entry, idx) => (
                                                    <tr key={idx}>
                                                        <td>{filteredData.length - idx}.</td>
                                                        <td>{entry.name}</td>
                                                        <td>{entry.functionDate ? formatDateIST(entry.functionDate) : "-"}</td>
                                                        <td>
                                                            {entry.payments.map((p, i) => (
                                                                <div key={i}>{p.receiptDate ? formatDateIST(p.receiptDate) : "-"}</div>
                                                            ))}
                                                        </td>


                                                        <td>₹{entry.amount.toLocaleString("en-IN")}</td>
                                                        <td>
                                                            {entry.payments.map((p, i) => (
                                                                <div key={i}>{p.mode}</div>
                                                            ))}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                <p className="no-records">No records match the filters.</p>
                            )}
                        </>
                    )}
                </div>
            </div>

            <div style={{ marginBottom: "50px" }}></div>
            <BottomNavigationBar navigate={navigate} userAppType={userAppType} />
        </>
    );
};

export default GSTSummary;
