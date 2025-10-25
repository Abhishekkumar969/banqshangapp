import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import "../styles/StatsPage.css";
import BackButton from "../components/BackButton";
import { getAuth } from "firebase/auth";
import BottomNavigationBar from "../components/BottomNavigationBar";
import { useNavigate } from "react-router-dom";

const StatsPage = () => {
  const navigate = useNavigate();
  const [target, setTarget] = useState(1000000);
  const [monthlyData, setMonthlyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [viewMode, setViewMode] = useState("monthly");
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [userAppType, setUserAppType] = useState(null);
  const [allTransactions, setAllTransactions] = useState([]); // store all transactions

  // Convert a date string to IST formatted string
const formatDateIST = (dateString) => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata' // IST timezone
    });
  } catch {
    return dateString;
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
    try {
      const snapshot = await getDocs(collection(db, 'prebookings'));
      const monthMap = {};
      const transactionsArr = [];

      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const bookingId = docSnap.id;

        Object.values(data).forEach(subData => {
          const payments = subData.advancePayments || [];

          payments.forEach(p => {
            const date = new Date(p.receiptDate);
            if (isNaN(date)) return;

            const applyRange = fromDate && toDate;
            const from = new Date(fromDate);
            const to = new Date(toDate);
            const fyStart = new Date(currentYear, 3, 1);
            const fyEnd = new Date(currentYear + 1, 2, 31);

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

            transactionsArr.push({
              bookingId,
              date: p.receiptDate,
              amount: Number(p.amount || 0),
              mode: p.mode,
              source: subData.customerName || '-'
            });
          });
        });
      });

      const months = [
        'April', 'May', 'June', 'July', 'August',
        'September', 'October', 'November', 'December',
        'January', 'February', 'March'
      ];

      const allData = months.map((month, idx) => {
        const actualIndex = (idx + 3) % 12;
        const cash = monthMap[actualIndex]?.cash || 0;
        const bank = monthMap[actualIndex]?.bank || 0;
        return {
          month,
          cash,
          bank,
          generated: cash + bank,
          target: target / 12
        };
      });

      let finalData = allData;

      if (viewMode === 'quarterly') {
        finalData = [
          { month: 'Q1 (Apr-Jun)', cash: allData.slice(0, 3).reduce((sum, m) => sum + m.cash, 0), bank: allData.slice(0, 3).reduce((sum, m) => sum + m.bank, 0) },
          { month: 'Q2 (Jul-Sep)', cash: allData.slice(3, 6).reduce((sum, m) => sum + m.cash, 0), bank: allData.slice(3, 6).reduce((sum, m) => sum + m.bank, 0) },
          { month: 'Q3 (Oct-Dec)', cash: allData.slice(6, 9).reduce((sum, m) => sum + m.cash, 0), bank: allData.slice(6, 9).reduce((sum, m) => sum + m.bank, 0) },
          { month: 'Q4 (Jan-Mar)', cash: allData.slice(9, 12).reduce((sum, m) => sum + m.cash, 0), bank: allData.slice(9, 12).reduce((sum, m) => sum + m.bank, 0) }
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
      setAllTransactions(transactionsArr);
    } catch (err) {
      console.error("Error fetching monthly revenue:", err);
    } finally {
      setLoading(false);
    }
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
    <>
      <div className="stats-container">
        <div style={{ marginBottom: '30px' }}>
          <BackButton />
        </div>
        <h2>📊 Business Stats Dashboard ({currentYear}-{currentYear + 1})</h2>

        <div className="control-section">
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

          <div className="target-input-group">
            <label>📆 From:</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            <label>To:</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            {(fromDate || toDate) && (
              <button className="clear-btn" onClick={() => { setFromDate(''); setToDate(''); }}>
                ❌ Clear Filter
              </button>
            )}
          </div>

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

            <div className="month-grid">
              {monthlyData.map((item, index) => (
                <div key={index} className="month-card">
                  <strong>{item.month}: </strong>
                  <span> ₹{item.generated.toLocaleString()}</span>
                </div>
              ))}
            </div>

            <div className="summary-row">
              <div><strong>💰 Cash Total:</strong> ₹{totalCash.toLocaleString()}</div>
              <div><strong>🏦 Bank Total:</strong> ₹{totalBank.toLocaleString()}</div>
              <div><strong>✅ Total Generated:</strong> ₹{totalGenerated.toLocaleString()}</div>
              <div><strong>🕒 Remaining:</strong> ₹{remaining > 0 ? remaining.toLocaleString() : 0}</div>
            </div>

            <div className="transaction-table-container">
              <h3>📋 Detailed Payments (IST)</h3>
              <table className="transaction-table">
                <thead>
                  <tr>
                    <th>Date (IST)</th>
                    <th>Mode</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {allTransactions
                    .sort((a, b) => new Date(a.date) - new Date(b.date))
                    .map((t, idx) => (
                      <tr key={idx}>
                        <td>{formatDateIST(t.date)}</td>
                        <td>{t.mode}</td>
                        <td>₹{t.amount.toLocaleString()}</td>
                      </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div style={{ marginBottom: "50px" }}></div>
      <BottomNavigationBar navigate={navigate} userAppType={userAppType} />
    </>
  );
};

export default StatsPage;
