import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../firebaseConfig';
import { runTransaction, doc, setDoc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import BackButton from '../components/BackButton';
import { useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import BottomNavigationBar from "../components/BottomNavigationBar";

const Receipts = () => {
  const [type, setType] = useState('Debit');
  const [amount, setAmount] = useState('');
  const [mobile, setMobile] = useState('');
  const [prefix, setPrefix] = useState('Mr.');
  const [myName, setMyName] = useState('');
  const [partyName, setPartyName] = useState('');
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState('Cash');
  const [slNo, setSlNo] = useState(null);
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [particularNature, setParticularNature] = useState('');
  const [customParticularNature, setCustomParticularNature] = useState('');
  const [assignedUsers, setAssignedUsers] = useState([]);
  const [cashTo, setCashTo] = useState('');
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

  // --- IST helper functions ---
  const getISTDate = (date = new Date()) => {
    const utc = date.getTime() + date.getTimezoneOffset() * 60000;
    const istOffset = 5.5 * 60 * 60000; // +5:30 in ms
    const istTime = new Date(utc + istOffset);
    const yyyy = istTime.getFullYear();
    const mm = String(istTime.getMonth() + 1).padStart(2, '0');
    const dd = String(istTime.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const getISTDateTime = () => {
    const utc = new Date().getTime() + new Date().getTimezoneOffset() * 60000;
    const istOffset = 5.5 * 60 * 60000;
    return new Date(utc + istOffset).toISOString();
  };

  const [manualDate, setManualDate] = useState(getISTDate());

  useEffect(() => {
    const fetchAssignedUsers = async () => {
      try {
        const bankSnap = await getDoc(doc(db, "accountant", "AssignBank"));
        let users = [];
        if (bankSnap.exists()) {
          const bankUsers = bankSnap.data().users || [];
          users = bankUsers.map(u => ({ name: u.name, email: u.email, type: "Bank" }));
        }
        const uniqueUsers = Object.values(users.reduce((acc, u) => {
          const key = `${u.email}-${u.type}`;
          acc[key] = u;
          return acc;
        }, {}));
        setAssignedUsers(uniqueUsers);
      } catch (err) {
        console.error("Error fetching assigned users:", err);
      }
    };
    fetchAssignedUsers();
  }, []);

  useEffect(() => {
    const fetchUserName = async () => {
      try {
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) return;
        const userRef = doc(db, "usersAccess", user.email);
        const snap = await getDoc(userRef);
        if (snap.exists()) setMyName(snap.data().name || "");
      } catch (err) {
        console.error("❌ Error fetching user name:", err);
      }
    };
    fetchUserName();
  }, []);

  const convertToWords = (num) => {
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
      'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen',
      'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    if (num === 0) return 'Zero only';
    if (num > 99999999) return 'Overflow';
    const numToWords = (n) => {
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
      const counterRef = doc(db, 'settings', 'slCounter');
      const counterSnap = await getDoc(counterRef);
      const current = counterSnap.exists() ? counterSnap.data().otherMoneyReceipt || 0 : 0;
      setSlNo(current + 1);
    } catch (err) {
      console.error('Error fetching next Sl No:', err);
      setSlNo(null);
    }
  }, []);

  useEffect(() => { fetchNextSlNo(); }, [fetchNextSlNo]);

  const handleSubmit = async () => {
    if (!myName || !partyName || !amount || !mode || !description) {
      alert('Please fill all fields'); return;
    }
    if (mode === 'Cash' && !cashTo) { alert('Please select "Cash To"'); return; }

    setIsSaving(true);
    try {
      const counterRef = doc(db, 'settings', 'slCounter');
      let newSlNo = '';
      await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        const data = counterDoc.exists() ? counterDoc.data() : {};
        const current = data.otherMoneyReceipt || 0;
        newSlNo = `V${current + 1}`;
        transaction.update(counterRef, { otherMoneyReceipt: current + 1 });
      });

      const amountWords = convertToWords(parseInt(amount));
      const finalParticularNature = type === 'Debit' && particularNature === 'Other' ? customParticularNature : particularNature;

      const receiptData = {
        slNo: newSlNo,
        amount: parseFloat(amount),
        amountWords,
        mode,
        cashTo,
        type: 'Voucher',
        paymentFor: type,
        partyPrefix: prefix,
        partyName,
        approval: 'No',
        mobile,
        myName,
        particularNature: finalParticularNature,
        description,
        receiptDate: manualDate,
        createdAt: getISTDateTime(),
      };

      // Month-Year doc ID (IST)
      const jsDate = new Date(manualDate + "T00:00:00");
      const istMonthYear = jsDate.toLocaleString("en-IN", {
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata"
      }).replace(" ", "");
      const docRef = doc(db, "moneyReceipts", istMonthYear);

      const receiptId = crypto.randomUUID();
      await setDoc(docRef, { [receiptId]: receiptData }, { merge: true });

      if (mode === 'Cash' && cashTo) {
        try {
          const accountantRef = doc(db, 'accountant', cashTo);
          const newTransaction = {
            slNo: newSlNo,
            amount: parseFloat(amount),
            approval: 'approved',
            createdAt: getISTDateTime(),
            date: manualDate,
            description,
            type,
            receiver: myName,
            cashTo,
          };
          const accSnap = await getDoc(accountantRef);
          if (accSnap.exists()) {
            await updateDoc(accountantRef, { transactions: arrayUnion(newTransaction) });
          } else {
            await setDoc(accountantRef, {
              slNo: newSlNo,
              name: cashTo.split('-')[0],
              email: '',
              transactions: [newTransaction],
              type: cashTo.includes('Locker') ? 'Locker' : cashTo.includes('Cash') ? 'Cash' : 'Bank',
            });
          }
        } catch (err) { console.error('❌ Error saving in accountant:', err); alert('❌ Error saving in accountant'); }
      }

      alert(`${type} Receipt #${newSlNo} saved successfully.`);
      navigate('/MoneyReceipts');

    } catch (err) {
      console.error('❌ Error saving receipt:', err);
      alert(`❌ Error saving receipt: ${err.message || err}`);
    } finally {
      setIsSaving(false);
      setAmount(''); setMyName(''); setMobile(''); setPartyName(''); setDescription(''); setMode('Cash');
      fetchNextSlNo();
    }
  };
  return (
    <>

      <div>
        <div style={{ marginBottom: '30px' }}> <BackButton /> </div>
        <div className="receipt-container">
          <h2 className="title">Voucher</h2>
          {slNo && <p><strong>Sl No:</strong> V{slNo}</p>}

          <div className="input-row">
            <label>Receipt Type</label>
            <select value={type} onChange={e => setType(e.target.value)}>
              <option value="Debit">Debit</option>
              <option value="Credit">Credit</option>
            </select>
          </div>

          <div className="input-row">
            <label>{type === 'Credit' ? 'Receive From' : 'Pay To'}</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <select value={prefix} onChange={e => setPrefix(e.target.value)} style={{ width: '100px' }}>
                <option value="Mr.">Mr.</option>
                <option value="Miss">Miss</option>
                <option value="Mrs.">Mrs.</option>
                <option value="Dr.">Dr.</option>
                <option value="Md.">Md.</option>
              </select>
              <input type="text" value={partyName} onChange={e => setPartyName(e.target.value.replace(/\b\w/g, c => c.toUpperCase()))} placeholder={type === 'Credit' ? 'From getting money' : 'Giving money to'} />
            </div>
          </div>

          <div className="input-row">
            <label>Mobile No.</label>
            <input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="Enter Mobile No." value={mobile} onChange={e => setMobile(e.target.value.replace(/\D/g, ""))} />
          </div>

          <div className="input-row">
            <label>Payment Mode</label>
            <select value={mode} onChange={e => setMode(e.target.value)}>
              <option value="Cash">Cash</option>
              <option value="BOI">BOI</option>
              <option value="SBI">SBI</option>
              <option value="Card">Card</option>
              <option value="Cheque">Cheque</option>
            </select>
          </div>

          {mode === 'Cash' && (
            <div className="input-row">
              <label>{type === "Debit" ? "Cash From" : "Cash To"}</label>
              <select value={cashTo} onChange={e => setCashTo(e.target.value)}>
                <option value="">-- Select --</option>
                <option value="Cash-Cash">Cash</option>
                {assignedUsers.map(u => <option key={`${u.email}-${u.type}`} value={`${u.name}-${u.type}`}>{u.name} - ({u.type})</option>)}
              </select>
            </div>
          )}

          <div className="input-row">
            <label>Amount</label>
            <input type="text" inputMode="decimal" placeholder="Enter amount" value={amount} onChange={e => {
              let val = e.target.value.replace(/[^0-9.]/g, "");
              if ((val.match(/\./g) || []).length > 1) val = val.slice(0, -1);
              setAmount(val);
            }} />
          </div>

          <div className="input-row" style={{ display: 'none' }}>
            <input type="text" value={myName || "Fetching name..."} />
          </div>

          <div className="input-row">
            <label>Particular Nature</label>
            <select value={particularNature} onChange={e => setParticularNature(e.target.value)}>
              <option value="">-- Select Particular Nature --</option>
              {type === 'Credit' ? <>
                <option value="Banquet Booking">Banquet Booking</option>
                <option value="Vendor Party">Vendor Party</option>
                <option value="Other">Other (Specify Below)</option>
              </> : <>
                <option value="Khana Khazana">Khana Khazana</option>
                <option value="Ravi Catering">Ravi Catering</option>
                <option value="Fuel Expense">Fuel Expense</option>
                <option value="Labour Charges">Labour Charges</option>
                <option value="Repair & Maintenance">Repair & Maintenance</option>
                <option value="Party Expense">Party Expense</option>
                <option value="Office Expense">Office Expense</option>
                <option value="Other">Other (Specify Below)</option>
              </>}
            </select>
            {particularNature === 'Other' && <input type="text" placeholder="Enter custom description" value={customParticularNature} onChange={e => setCustomParticularNature(e.target.value)} style={{ marginTop: '8px' }} />}
          </div>

          <div className="input-row">
            <label>Description</label>
            <input type="text" placeholder='Enter description' value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          <div className="input-row">
            <label>Date</label>
            <input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} />
          </div>

          <div className="submit-row">
            <button onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? '⏳ Saving...' : `💾 Save ${type} Receipt`}
            </button>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: "50px" }}></div>
      <BottomNavigationBar navigate={navigate} userAppType={userAppType} />

    </>
  );
};

export default Receipts;