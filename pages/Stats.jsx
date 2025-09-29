import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../firebaseConfig';
import {
  collection, getDocs, doc, getDoc, setDoc
} from 'firebase/firestore';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import "../styles/StatsPage.css";
import BackButton from "../components/BackButton";

const StatsPage = () => {
  const [target, setTarget] = useState(1000000);
  const [monthlyData, setMonthlyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [viewMode, setViewMode] = useState("monthly");
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const loadTarget = useCallback(async () => {
    const targetDoc = await getDoc(doc(db, 'settings', 'stats'));
    if (targetDoc.exists()) {
      const data = targetDoc.data();
      if (data?.yearlyTarget) setTarget(data.yearlyTarget);
    }
  }, []);

  const saveTarget = async (newTarget) => {
    await setDoc(doc(db, 'settings', 'stats'), {
      yearlyTarget: newTarget
    }, { merge: true });
  };

  const fetchMonthlyRevenue = useCallback(async () => {
    setLoading(true);
    const snapshot = await getDocs(collection(db, 'prebookings'));
    const monthMap = {};

    snapshot.forEach(doc => {
      const data = doc.data();
      const payments = data.advancePayments || [];

      payments.forEach(p => {
        const date = new Date(p.receiptDate);
        if (isNaN(date)) return;

        const applyRange = fromDate && toDate;
        const from = new Date(fromDate);
        const to = new Date(toDate);
        const fyStart = new Date(currentYear, 2, 1); // March 1
        const fyEnd = new Date(currentYear + 1, 1, 28); // February 28/29

        // Apply filters
        if (applyRange) {
          if (date < from || date > to) return;
        } else {
          if (date < fyStart || date > fyEnd) return;
        }

        const monthIndex = date.getMonth();
        if (!monthMap[monthIndex]) {
          monthMap[monthIndex] = { cash: 0, bank: 0 };
        }
        if (p.mode === 'Cash') {
          monthMap[monthIndex].cash += Number(p.amount || 0);
        } else {
          monthMap[monthIndex].bank += Number(p.amount || 0);
        }
      });
    });

    // NEW:
    const months = [
      'April', 'May', 'June', 'July', 'August',
      'September', 'October', 'November', 'December', 'January', 'February', 'March'
    ];
    // const actualIndex = (idx + 2) % 12;

    const allData = months.map((month, idx) => {
      const actualIndex = (idx + 3) % 12;
      const cash = monthMap[actualIndex]?.cash || 0;
      const bank = monthMap[actualIndex]?.bank || 0;
      const generated = cash + bank;
      return {
        month,
        cash,
        bank,
        generated,
        target: target / 12
      };
    });

    let finalData = allData;

    if (viewMode === 'quarterly') {
      finalData = [
        {
          month: 'Q1 (Mar-May)',
          cash: allData.slice(0, 3).reduce((sum, m) => sum + m.cash, 0),
          bank: allData.slice(0, 3).reduce((sum, m) => sum + m.bank, 0),
        },
        {
          month: 'Q2 (Jun-Aug)',
          cash: allData.slice(3, 6).reduce((sum, m) => sum + m.cash, 0),
          bank: allData.slice(3, 6).reduce((sum, m) => sum + m.bank, 0),
        },
        {
          month: 'Q3 (Sep-Nov)',
          cash: allData.slice(6, 9).reduce((sum, m) => sum + m.cash, 0),
          bank: allData.slice(6, 9).reduce((sum, m) => sum + m.bank, 0),
        },
        {
          month: 'Q4 (Dec-Feb)',
          cash: allData.slice(9, 12).reduce((sum, m) => sum + m.cash, 0),
          bank: allData.slice(9, 12).reduce((sum, m) => sum + m.bank, 0),
        }
      ].map(q => ({
        ...q,
        generated: q.cash + q.bank,
        target: target / 4
      }));
    } else if (viewMode === 'full') {
      const cash = allData.reduce((sum, m) => sum + m.cash, 0);
      const bank = allData.reduce((sum, m) => sum + m.bank, 0);
      finalData = [{
        month: `${currentYear}-${currentYear + 1}`,
        cash,
        bank,
        generated: cash + bank,
        target
      }];
    }

    setMonthlyData(finalData);
    setLoading(false);
  }, [target, currentYear, viewMode, fromDate, toDate]);

  useEffect(() => {
    loadTarget();
  }, [loadTarget]);

  useEffect(() => {
    fetchMonthlyRevenue();
  }, [target, currentYear, viewMode, fromDate, toDate, fetchMonthlyRevenue]);

  const handleTargetChange = async (e) => {
    const newTarget = Number(e.target.value);
    setTarget(newTarget);
    await saveTarget(newTarget);
  };

  const totalGenerated = monthlyData.reduce((sum, m) => sum + m.generated, 0);
  const totalCash = monthlyData.reduce((sum, m) => sum + m.cash, 0);
  const totalBank = monthlyData.reduce((sum, m) => sum + m.bank, 0);
  const remaining = target - totalGenerated;

  return (
    <div className="stats-container">
      <div style={{ marginBottom: '30px' }}>
        <BackButton />
      </div>
      <h2>📊 Business Stats Dashboard ({currentYear}-{currentYear + 1})</h2>

      <div className="control-section">
        {/* View Mode + Year Selector */}
        <div className="target-input-group">
          <label>📊 View Mode:</label>
          <select value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="full">Full Year</option>
          </select>

          <label>📅 FY Start Year:</label>
          <select value={currentYear} onChange={(e) => setCurrentYear(Number(e.target.value))}>
            {Array.from({ length: 100 }, (_, i) => {
              const year = 2000 + i;
              return <option key={year} value={year}>{year}</option>;
            })}
          </select>
        </div>

        {/* Date Range Filter */}
        <div className="target-input-group">
          <label>📆 From:</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />

          <label>To:</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />

          {(fromDate || toDate) && (
            <button className="clear-btn" onClick={() => {
              setFromDate('');
              setToDate('');
            }}>
              ❌ Clear Filter
            </button>
          )}
        </div>

        {/* Target Input */}
        <div className="target-input-group">
          <label>🎯 Yearly Target (₹):</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="\d*"
            value={target}
            onChange={(e) => handleTargetChange(e.target.value.replace(/\D/g, ""))}
          />
        </div>

      </div>

      {loading ? (
        <p className="loading-text">Loading stats...</p>
      ) : (
        <>
          {/* Bar Chart */}
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} />
              <Bar dataKey="cash" stackId="a" fill="#4CAF50" name="Cash" />
              <Bar dataKey="bank" stackId="a" fill="#2196F3" name="Bank" />
              <Bar dataKey="target" fill="#FFA500" name="Target" />
            </BarChart>
          </ResponsiveContainer>

          {/* Month Cards */}
          <div className="month-grid">
            {monthlyData.map((item, index) => (
              <div key={index} className="month-card">
                <strong>{item.month}: </strong>
                <span> ₹{item.generated.toLocaleString()}</span>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="summary-row">
            <div><strong>💰 Cash Total:</strong> ₹{totalCash.toLocaleString()}</div>
            <div><strong>🏦 Bank Total:</strong> ₹{totalBank.toLocaleString()}</div>
            <div><strong>✅ Total Generated:</strong> ₹{totalGenerated.toLocaleString()}</div>
            <div><strong>🕒 Remaining:</strong> ₹{remaining > 0 ? remaining.toLocaleString() : 0}</div>
          </div>
        </>
      )}
    </div>
  );
};

export default StatsPage;