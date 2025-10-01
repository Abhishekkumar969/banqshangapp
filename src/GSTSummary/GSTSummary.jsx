import React, { useState, useEffect, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import './GSTSummary.css';
import BackButton from "../components/BackButton";

const GSTSummary = () => {
    const [data, setData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [paymentMode, setPaymentMode] = useState('');
    const [loading, setLoading] = useState(true);
    const [financialYear, setFinancialYear] = useState(null);
    const [financialYears, setFinancialYears] = useState([]);
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [sortConfig, setSortConfig] = useState({ key: "date", direction: "desc" }); // ✅ sort config

    const parseDate = (dateStr) => {
        if (!dateStr) return new Date();
        const [year, month, day] = dateStr.split("-").map(Number);
        return new Date(year, month - 1, day);
    };

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const snapshot = await getDocs(collection(db, 'prebookings'));
                const bookings = [];
                const fySet = new Set();

                snapshot.forEach(doc => {
                    const d = doc.data();

                    if (!d.advancePayments || d.advancePayments.length === 0) return;

                    d.advancePayments.forEach((payment, index) => {
                        if (!payment.amount || !payment.receiptDate) return;

                        // Skip Cash payments
                        if (payment.mode === 'Cash') return;

                        const dateObj = parseDate(payment.receiptDate);

                        // Determine financial year
                        const fyYear = dateObj.getMonth() + 1 >= 4
                            ? dateObj.getFullYear()
                            : dateObj.getFullYear() - 1;
                        fySet.add(fyYear);

                        bookings.push({
                            name: d.partyName || d.name || 'Unknown',
                            functionDate: d.functionDate || "",
                            date: payment.receiptDate,
                            mode: payment.mode,
                            amount: payment.amount,
                            slNo: payment.slNo || "",
                            bookingId: doc.id + '-' + index,
                            dateObj
                        });
                    });
                });

                const yearsArray = Array.from(fySet).sort((a, b) => b - a);
                setData(bookings);
                setFinancialYears(yearsArray);

                if (yearsArray.length > 0) {
                    setFinancialYear(yearsArray[0]);
                }

            } catch (err) {
                console.error("Error fetching prebookings:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const handleFilter = useCallback(() => {
        let filtered = data;

        if (financialYear) {
            const fyStart = new Date(`${financialYear}-04-01`);
            const fyEnd = new Date(`${financialYear + 1}-03-31`);

            filtered = filtered.filter(entry => {
                const entryDate = new Date(entry.date);
                return entryDate >= fyStart && entryDate <= fyEnd;
            });
        }

        if (fromDate && toDate) {
            const from = new Date(fromDate);
            const to = new Date(toDate);

            filtered = filtered.filter(entry => {
                const entryDate = new Date(entry.date);
                return entryDate >= from && entryDate <= to;
            });
        }

        if (paymentMode) {
            filtered = filtered.filter(entry => entry.mode === paymentMode);
        }

        if (sortConfig.key) {
            filtered.sort((a, b) => {
                let dateA = sortConfig.key === "functionDate" ? new Date(a.functionDate) : new Date(a.date);
                let dateB = sortConfig.key === "functionDate" ? new Date(b.functionDate) : new Date(b.date);

                return sortConfig.direction === "asc" ? dateA - dateB : dateB - dateA;
            });
        }

        setFilteredData(filtered);
    }, [data, financialYear, fromDate, toDate, paymentMode, sortConfig]);

    useEffect(() => {
        if (data.length > 0) {
            handleFilter();
        }
    }, [data, financialYear, fromDate, toDate, paymentMode, sortConfig, handleFilter]);

    const handlePrint = () => {
        window.print();
    };

    const toggleSort = (key) => {
        setSortConfig((prev) => {
            if (prev.key === key) {
                return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
            }
            return { key, direction: "asc" };
        });
    };

    const getTotalByMode = (mode) => {
        return filteredData
            .filter(entry => entry.mode === mode)
            .reduce((acc, curr) => acc + Number(curr.amount), 0);
    };

    const getTotalByModes = (modes) => {
        return filteredData
            .filter(entry => modes.includes(entry.mode))
            .reduce((acc, curr) => acc + curr.amount, 0);
    };

    const totalBOI = getTotalByModes(['BOI']);
    const totalSBI = getTotalByModes(['SBI']);
    const totalCheque = getTotalByMode('Cheque');
    const totalCard = getTotalByMode('Card');
    const totalBank = totalSBI + totalBOI;
    const totalAll = totalBOI + totalSBI + totalCheque + totalCard;
    const gst = totalAll * 0.18;
    const baseAmt = totalAll - gst;

    return (
        <div className="gst-summary-wrapper">
            <div style={{ marginBottom: '30px' }}>
                <BackButton />
            </div>

            <h2 className="gst-title">📊 GST Summary (FY: {financialYear}-{financialYear + 1})</h2>

            {/* Filters */}
            <div className="filters no-print">
                <select
                    value={financialYear ?? ''}
                    onChange={e => setFinancialYear(Number(e.target.value))}
                >
                    {financialYears.length === 0 ? (
                        <option value="">No FY Found</option>
                    ) : (
                        financialYears.map(y => (
                            <option key={y} value={y}>
                                FY {y}-{y + 1}
                            </option>
                        ))
                    )}
                </select>

                {/* From & To Date Pickers */}
                <label>
                    From:
                    <input
                        type="date"
                        value={fromDate}
                        onChange={e => setFromDate(e.target.value)}
                    />
                </label>

                <label>
                    To:
                    <input
                        type="date"
                        value={toDate}
                        onChange={e => setToDate(e.target.value)}
                    />
                </label>

                <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
                    <option value="">All Modes</option>
                    <option value="SBI">SBI</option>
                    <option value="BOI">BOI</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Card">Card</option>
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
                            <p><strong>BOI:</strong> ₹{totalSBI.toLocaleString('en-IN')}</p>
                            <p><strong>SBI:</strong> ₹{totalBOI.toLocaleString('en-IN')}</p>
                            <p><strong>Total Bank Account:</strong> ₹{totalBank.toLocaleString('en-IN')}</p>
                            <br />
                            <p><strong>Total Cheque:</strong> ₹{totalCheque.toLocaleString('en-IN')}</p>
                            <p><strong>Total Card:</strong> ₹{totalCard.toLocaleString('en-IN')}</p>
                            <p style={{ fontWeight: 'bold', color: '#006db6' }}>
                                <strong>Total Amount:</strong> ₹{totalAll.toLocaleString('en-IN')} (including GST)
                            </p>

                            <p style={{ fontWeight: 'bold', color: 'red' }}>
                                <strong>GST @18%:</strong> ₹{gst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                            <p style={{ fontWeight: 'bold', color: '#006db6' }}>
                                <strong>Base Amount:</strong> ₹{baseAmt.toLocaleString('en-IN')} (excluding GST)
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
                                                    <button style={{ backgroundColor: 'transparent', padding: '0px' }} onClick={() => toggleSort("functionDate")}>
                                                        Function Date {sortConfig.key === "functionDate" ? (sortConfig.direction === "asc" ? "▲" : "▼") : ""}
                                                    </button>
                                                </th>
                                                <th>
                                                    <button style={{ backgroundColor: 'transparent', padding: '0px' }} onClick={() => toggleSort("date")}>
                                                        Receipt Date {sortConfig.key === "date" ? (sortConfig.direction === "asc" ? "▲" : "▼") : ""}
                                                    </button>
                                                </th>
                                                <th>Amount</th>
                                                <th>Payment Mode</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredData.map((entry, idx) => (
                                                <tr key={idx}>
                                                    <td>{filteredData.length - idx}.</td>
                                                    <td>{entry.name}</td>
                                                    <td>
                                                        {entry.functionDate
                                                            ? new Date(entry.functionDate).toLocaleDateString("en-GB")
                                                            : "-"}
                                                    </td>
                                                    <td>{new Date(entry.date).toLocaleDateString("en-GB")}</td>
                                                    <td>₹{Number(entry.amount).toLocaleString("en-IN")}</td>
                                                    <td>{entry.mode}</td>
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
    );
};

export default GSTSummary;
