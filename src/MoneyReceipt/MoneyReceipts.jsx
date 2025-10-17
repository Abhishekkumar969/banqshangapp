import React, { useEffect, useState, useCallback } from 'react';
import { collection, onSnapshot, doc, updateDoc, setDoc, getDoc, getDocs } from "firebase/firestore";
import { db } from '../firebaseConfig';
import '../styles/MoneyReceipts.css';
import { useLocation } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { getAuth } from "firebase/auth";
import BackButton from "../components/BackButton";
import BottomNavigationBar from "../components/BottomNavigationBar";

const MoneyReceipts = () => {
  const navigate = useNavigate();
  const [receipts, setReceipts] = useState([]);
  const [search, setSearch] = useState('');
  const location = useLocation();
  const [typeFilter, setTypeFilter] = useState('All');
  const [modeFilter, setModeFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [financialYears, setFinancialYears] = useState([]);
  const [selectedFY, setSelectedFY] = useState("");
  const [sortKey, setSortKey] = useState("addedAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [showPopup, setShowPopup] = useState(false);
  const [newAmount, setNewAmount] = useState(0);
  const [newDescription, setNewDescription] = useState("");
  const [newDate, setNewDate] = useState("");
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [creditDebitFilter, setCreditDebitFilter] = useState('All');
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
    const q = collection(db, "moneyReceipts");

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let allReceipts = [];

        snapshot.docs.forEach((docSnap) => {
          const monthYear = docSnap.id; // e.g. "Sep2025"
          const data = docSnap.data();

          Object.entries(data).forEach(([receiptId, receipt]) => {
            allReceipts.push({
              id: receiptId,
              monthYear,
              ...receipt,
            });
          });
        });

        const sorted = allReceipts.sort((a, b) => {
          let aTime, bTime;

          if (sortKey === "addedAt") {
            aTime = a.addedAt ? new Date(a.addedAt).getTime() : 0;
            bTime = b.addedAt ? new Date(b.addedAt).getTime() : 0;
          } else if (sortKey === "receiptDate") {
            aTime = a.receiptDate ? new Date(a.receiptDate).getTime() : 0;
            bTime = b.receiptDate ? new Date(b.receiptDate).getTime() : 0;
          } else if (sortKey === "eventDate") {
            aTime = a.eventDate ? new Date(a.eventDate).getTime() : 0;
            bTime = b.eventDate ? new Date(b.eventDate).getTime() : 0;
          } else {
            aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          }

          return sortOrder === "asc" ? aTime - bTime : bTime - aTime;
        });

        setReceipts(sorted);
      },
      (error) => {
        console.error("Error fetching receipts:", error);
      }
    );

    return () => unsubscribe();
  }, [sortKey, sortOrder]);

  useEffect(() => {
    if (receipts.length) {
      const years = new Set();

      receipts.forEach(r => {
        if (r.receiptDate) { // Use receiptDate instead of eventDate
          const date = new Date(r.receiptDate);
          const month = date.getMonth() + 1; // Jan = 0
          // FY calculation: April to March
          const fy = month >= 4
            ? `${date.getFullYear()}-${date.getFullYear() + 1}`
            : `${date.getFullYear() - 1}-${date.getFullYear()}`;
          years.add(fy);
        }
      });

      // Sort descending (latest FY first)
      setFinancialYears([...years].sort((a, b) => {
        const [aStart] = a.split('-').map(Number);
        const [bStart] = b.split('-').map(Number);
        return aStart - bStart;
      }));
    }
  }, [receipts]);

  const filteredReceipts = receipts.filter(r => {
    const matchesSearch =
      r.customerName?.toLowerCase().includes(search.toLowerCase()) ||
      r.mobile?.includes(search) ||
      r.slNo?.toString().toLowerCase().includes(search.toLowerCase()) ||
      r.type?.toLowerCase().includes(search.toLowerCase()) ||
      r.particularNature?.toLowerCase().includes(search.toLowerCase()) ||
      (r.receiptDate || "").toString().toLowerCase().includes(search.toLowerCase());


    const matchesType =
      typeFilter === 'All' ||
      (typeFilter === 'Cash' && r.type === 'Cash') ||
      (typeFilter === 'Bank' && r.type === 'Money Receipt') ||
      (typeFilter === 'Voucher' && r.type === 'Voucher') ||
      (typeFilter === 'Refund' && r.paymentFor === 'Refund') ||
      (typeFilter === 'BankCash' && (r.type === 'Cash' || r.type === 'Money Receipt'));

    const modesType =
      modeFilter === 'All' ||
      (modeFilter === 'BOI' && r.mode === 'BOI') ||
      (modeFilter === 'SBI' && r.mode === 'SBI') ||
      (modeFilter === 'Cash' && r.mode === 'Cash') ||
      (modeFilter === 'Card' && r.mode === 'Card') ||
      (modeFilter === 'Cheque' && r.mode === 'Cheque');

    const matchesDateRange = (!dateFrom || r.receiptDate >= dateFrom) &&
      (!dateTo || r.receiptDate <= dateTo);

    // Financial Year filter
    let matchesFY = true;
    if (selectedFY && r.receiptDate) {
      const [startYear, endYear] = selectedFY.split('-').map(Number);
      const date = new Date(r.receiptDate);
      const fyStart = new Date(`${startYear}-04-01`);
      const fyEnd = new Date(`${endYear}-03-31`);
      matchesFY = date >= fyStart && date <= fyEnd;
    }

    // ✅ Credit/Debit filter
    const matchesCreditDebit =
      creditDebitFilter === 'All' ||
      r.paymentFor === creditDebitFilter;

    return (
      matchesSearch &&
      matchesType &&
      modesType &&
      matchesDateRange &&
      matchesFY &&
      matchesCreditDebit
    );
  });

  const getFinancialYear = (dateStr) => {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    if (month >= 4) {
      return `${year.toString().slice(2)}-${(year + 1).toString().slice(2)}`;
    } else {
      return `${(year - 1).toString().slice(2)}-${year.toString().slice(2)}`;
    }
  };

  const groupedData = {};

  filteredReceipts.forEach(receipt => {
    if (!receipt.receiptDate) return;

    const date = new Date(receipt.receiptDate);
    const fy = getFinancialYear(receipt.receiptDate);
    const month = date.getMonth() + 1;

    const key = `${fy}-${month}`;

    if (!groupedData[key]) {
      groupedData[key] = {
        fy,
        month,
        credit: 0,
        debit: 0,
      };
    }

    if (receipt.paymentFor === 'Credit') {
      groupedData[key].credit += Number(receipt.amount || 0);
    } else if (receipt.paymentFor === 'Debit') {
      groupedData[key].debit += Number(receipt.amount || 0);
    }
  });

  const tableData = Object.values(groupedData).sort((a, b) => {
    const fyA = a.fy.split('-')[0];
    const fyB = b.fy.split('-')[0];
    if (fyA !== fyB) return Number(fyA) - Number(fyB);
    return a.month - b.month;
  });

  let runningBalance = 0;
  const finalTableData = tableData.map(row => {
    runningBalance += row.credit - row.debit;
    return {
      ...row,
      balance: runningBalance,
    };
  });


  const formatDate = (date) => {
    if (!date) return "-";

    const d = new Date(date);

    // Convert to IST by adding 5 hours 30 minutes (in milliseconds)
    const istOffset = 5 * 60 + 30; // in minutes
    const istDate = new Date(d.getTime() + istOffset * 60 * 1000);

    const day = String(istDate.getUTCDate()).padStart(2, "0");
    const month = String(istDate.getUTCMonth() + 1).padStart(2, "0");
    const year = istDate.getUTCFullYear();

    return `${day}-${month}-${year}`; // DD-MM-YYYY in IST
  };


  const getDisplayName = (receipt) => {
    return (receipt.customerPrefix || '') + ' ' +
      (receipt.customerName || receipt.partyName || '-');
  };

  const handlePrint = useCallback((receipt) => {
    const partyName = getDisplayName(receipt).trim();

    const content = `
  <html>
  <head>
    <title>Receipt - #${receipt.slNo}</title>
    <style>
      body {
        font-family: 'Calibri', sans-serif;
        color: #3c0000;
        font-size: 20px;
        padding: 30px 40px;
      }
      .header-title {
        text-align: center;
        font-weight: bold;
        font-size: 19px;
        color: #3c0000;
      }
      .main-title {
        text-align: center;
        font-size: 38px;
        font-weight: bold;
        margin-top: 5px;
        color: maroon;
      }
      .sub-header {
        text-align: center;
        font-size: 15px;
        margin: 1px 0;
      }
      .line-group {
        display: flex;
        justify-content: space-between;
        margin-top: 20px;
      }
      .section {
        margin: 10px 0;
        display: flex;
        gap: 8px;
      }
      .underline {
        flex-grow: 1;
        border-bottom: 1px dotted #000;
        min-width: 150px;
      }
      .short-underline {
        display: inline-block;
        border-bottom: 1px dotted #000;
        min-width: 100px;
      }

      .payment-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 30px;
      }

      .payment-table {
        border: 1px solid maroon;
        border-collapse: collapse;
        font-size: 18px;
      }
      .payment-table th,
      .payment-table td {
        border: 1px solid maroon;
        padding: 2px 8px;
        text-align: center;
        min-width: 80px;
      }

      .rs-combo {
        display: flex;
        align-items: center;
      }

      .circle-rs {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background-color: transparent;
        color: #3c0000;
        font-size: 30px;
        font-weight: bold;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .bramount-box {
        border: 1px solid maroon;
        border: 1px solid maroon;
        padding: 1px 1px;
        font-weight: bold;
        min-width: 100px;
        font-size: 14px;
      }
      .amount-box {
        border: 1px solid maroon;
        border: 1px solid maroon;
        padding: 6px 14px;
        font-weight: bold;
        min-width: 100px;
        font-size: 30px;
      }

      .signature {
        font-weight: bold;
        font-size: 18px;
        text-align: right;
        margin-top: 20px;
      }
          .italic {
    font-style: italic;
  }
    </style>
  </head>
  <body>
   <div style="border: 1px solid maroon; padding: 1px">
    <div style="border: 1px solid maroon; padding: 30px">
    <div class="header-title">MONEY RECEIPT</div>
    <div class="main-title">Shangri-La Palace</div>
    <div class="sub-header">A Unit of the Patli Hospitality LLP</div>
    <div class="sub-header">Opp. CISRO Hospital, Near Saguna More, Naya Tola, Bailey Road, Danapur, Patna - 801 503</div>
    <div class="sub-header">Mob. No. - 7004298385, 9334310274, 9234505587</div>

    <div class="line-group">
      <div>No. <span>${receipt.slNo}</span></div>
      <div>Date <span class="short-underline">${new Date(receipt.receiptDate).toLocaleDateString('en-GB')}</span></div>
    </div>

    <div class="section italic">Received with thanks from <div class="underline">${partyName}</div></div>
    <div class="section italic "><span>Mob.:</span><div class="underline">${receipt.mobile || '-'}</div></div>
    <div class="section italic ">a sum of Rs. <div class="underline">₹${receipt.amountWords || '-'}</div></div>
    <div class="section italic ">
      for event of <div class="underline">${receipt.eventType || '-'}</div>
      <span style="margin-left:auto;">Dated <span class="short-underline">${new Date(receipt.eventDate).toLocaleDateString('en-GB')}</span></span>
    </div>

    <div class="payment-row">
      <!-- LEFT PAYMENT MODE TABLE -->
      <table class="payment-table">
        <tr><th colspan="2">Payment Mode</th></tr>
        <tr>
          <td class="italic ">${receipt.mode === 'Cash' ? '☑️ Cash' : 'Cash'}</td>
          <td className="italic">
            ${['BOI', 'SBI'].includes(receipt.mode) ? '☑️ RTGS/NEFT' : 'RTGS/NEFT'}
          </td>
        </tr>
        <tr>
          <td class="italic ">${receipt.mode === 'Cheque' ? '☑️ Cheque' : 'Cheque'}</td>
          <td class="italic ">${receipt.mode === 'Card' ? '☑️ Card' : 'Card'}</td>
        </tr>
      </table>

      <!-- MIDDLE ₹ SYMBOL + AMOUNT IN BOX -->
      <div class="rs-combo">
        <div class="circle-rs">₹</div>
       <div class="bramount-box"> <div class="amount-box">${receipt.amount.toLocaleString("en-IN")} </div> </div>
      </div>

      <!-- RIGHT SIGNATURE -->
      <div class="signature">
      Issued By: <span class="short-underline">${receipt.receiverd || receipt.senderd || 'Accounts Dept.'}</span>
        </div>
      </div>
     </div>
    </div>
  </body>
  </html>
  `;

    // Check if iframe exists, otherwise create it
    let iframe = document.getElementById("print-frame");
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = "print-frame";
      iframe.style.display = "none";
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(content);
    doc.close();

    iframe.onload = function () {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    };
  }, []);

  const handlePrintCash = useCallback((receipt) => {
    const partyName = getDisplayName(receipt).trim();

    const content = `
  <html>
  <head>
    <title>Receipt - #${receipt.slNo}</title>
    <style>
      body {
        font-family: 'Calibri', sans-serif;
        color: #000e3cff;
        font-size: 20px;
        padding: 30px 40px;
      }
      .header-title {
        text-align: center;
        font-weight: bold;
        font-size: 19px;
        color: #000e3cff;
      }
      .main-title {
        text-align: center;
        font-size: 38px;
        font-weight: bold;
        margin-top: 5px;
        color: maroon;
      }
      .sub-header {
        text-align: center;
        font-size: 15px;
        margin: 1px 0;
      }
      .line-group {
        display: flex;
        justify-content: space-between;
        margin-top: 20px;
      }
      .section {
        margin: 10px 0;
        display: flex;
        gap: 8px;
      }
      .underline {
        flex-grow: 1;
        border-bottom: 1px dotted #000e3cff;
        min-width: 150px;
      }
      .short-underline {
        display: inline-block;
        border-bottom: 1px dotted #000e3cff;
        min-width: 100px;
      }

      .payment-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 30px;
      }

      .payment-table {
        border: 1px solid maroon;
        border-collapse: collapse;
        font-size: 18px;
      }
      .payment-table th,
      .payment-table td {
        border: 1px solid maroon;
        padding: 2px 8px;
        text-align: center;
        min-width: 80px;
      }

      .rs-combo {
        display: flex;
        align-items: center;
      }

      .circle-rs {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background-color: transparent;
        color: #000e3cff;
        font-size: 30px;
        font-weight: bold;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .bramount-box {
        border: 1px solid maroon;
        border: 1px solid maroon;
        padding: 1px 1px;
        font-weight: bold;
        min-width: 100px;
        font-size: 14px;
      }
      .amount-box {
        border: 1px solid maroon;
        border: 1px solid maroon;
        padding: 6px 14px;
        font-weight: bold;
        min-width: 100px;
        font-size: 30px;
      }

      .signature {
        font-weight: bold;
        font-size: 18px;
        text-align: right;
        margin-top: 20px;
      }
          .italic {
    font-style: italic;
  }
    </style>
  </head>
  <body>
   <div style="border: 1px solid maroon; padding: 1px">
    <div style="border: 1px solid maroon; padding: 30px">
    <div class="header-title">MONEY RECEIPT</div>
    

    <div class="line-group">
      <div>No. <span>${receipt.slNo}</span></div>
      <div>Date <span class="short-underline">${new Date(receipt.receiptDate).toLocaleDateString('en-GB')}</span></div>
    </div>

    <div class="section italic">Received with thanks from <div class="underline">${partyName}</div></div>
    <div class="section italic "><span>Mob.:</span><div class="underline">${receipt.mobile || '-'}</div></div>
    <div class="section italic ">a sum of Rs. <div class="underline">₹${receipt.amountWords || '-'}</div></div>
    <div class="section italic ">
      for event of <div class="underline">${receipt.eventType || '-'}</div>
      <span style="margin-left:auto;">Dated <span class="short-underline">${new Date(receipt.eventDate).toLocaleDateString('en-GB')}</span></span>
    </div>

    <div class="payment-row">
      <!-- LEFT PAYMENT MODE TABLE -->
      <table class="payment-table">
        <tr><th colspan="2">Payment Mode</th></tr>
        <tr>
          <td class="italic ">${receipt.mode === 'Cash' ? '☑️ Cash' : 'Cash'}</td>
          <td className="italic">
             ${['BOI', 'SBI'].includes(receipt.mode) ? '☑️ RTGS/NEFT' : 'RTGS/NEFT'}
          </td>        
        </tr>
        <tr>
          <td class="italic ">${receipt.mode === 'Cheque' ? '☑️ Cheque' : 'Cheque'}</td>
          <td class="italic ">${receipt.mode === 'Card' ? '☑️ Card' : 'Card'}</td>
        </tr>
      </table>

      <!-- MIDDLE ₹ SYMBOL + AMOUNT IN BOX -->
      <div class="rs-combo">
        <div class="circle-rs">₹</div>
       <div class="bramount-box"> <div class="amount-box">${receipt.amount !== undefined && receipt.amount !== null
        ? receipt.amount.toLocaleString("en-IN")
        : "-"}</div> </div>
      </div>

      <!-- RIGHT SIGNATURE -->
      <div class="signature">
      <div> Issued By:  </div>

        <span class="short-underline">${receipt.receiverd || receipt.senderd || 'Accounts Dept.'}</span>
      </div>
      </div>
     </div>
    </div>
  </body>
  </html>
  `;

    let iframe = document.getElementById("print-frame");
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = "print-frame";
      iframe.style.display = "none";
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(content);
    doc.close();

    iframe.onload = function () {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    };

  }, []);

  const handlePrintOther = useCallback((receipt) => {
    const label = receipt.paymentFor === 'Credit' ? 'Received with thanks from' : 'Paid to';
    const partyName = getDisplayName(receipt).trim();
    const description = receipt.description || '-';
    const particularNature = receipt.particularNature || '-';
    const receiptDate = receipt.receiptDate ? new Date(receipt.receiptDate).toLocaleDateString('en-GB') : '-';

    const content = `
<html>
  <head>
    <title>Receipt #${receipt.slNo}</title>
    <style>
      body {
        font-family: 'Calibri', sans-serif;
        color: #3c0000;
        font-size: 20px;
        padding: 30px 40px;
      }
      .header-title {
        text-align: center;
        font-weight: bold;
        font-size: 19px;
        color: #3c0000;
      }
      .section {
        margin: 10px 0;
        display: flex;
        gap: 8px;
        font-size: 18px;
      }
      .underline {
        flex-grow: 1;
        border-bottom: 1px dotted #000;
        min-width: 150px;
      }
      .short-underline {
        display: inline-block;
        border-bottom: 1px dotted #000;
        min-width: 100px;
      }
      .italic {
        font-style: italic;
      }
      .payment-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 30px;
      }
      .payment-table {
        border: 1px solid maroon;
        border-collapse: collapse;
        font-size: 18px;
      }
      .payment-table th,
      .payment-table td {
        border: 1px solid maroon;
        padding: 2px 8px;
        text-align: center;
        min-width: 80px;
      }
      .rs-combo {
        display: flex;
        align-items: center;
      }
      .circle-rs {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background-color: transparent;
        color: #3c0000;
        font-size: 30px;
        font-weight: bold;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .bramount-box {
        border: 1px solid maroon;
        padding: 1px 1px;
        font-weight: bold;
        min-width: 100px;
        font-size: 14px;
      }
      .amount-box {
        border: 1px solid maroon;
        padding: 6px 14px;
        font-weight: bold;
        min-width: 100px;
        font-size: 30px;
      }
      .signature {
        font-weight: bold;
        font-size: 18px;
        text-align: right;
        margin-top: 20px;
      }
    </style>
  </head>
  <body>
    <div style="border: 1px solid maroon; padding: 1px">
      <div style="border: 1px solid maroon; padding: 30px">
        <div class="header-title">VOUCHER RECEIPT</div>

        <div class="section">
          Sl No. <span class="short-underline">${receipt.slNo}</span>
          <span style="margin-left:auto;">Date <span class="short-underline">${receiptDate}</span></span>
        </div>

        <div class="section italic">${label} <div class="underline">${partyName}</div></div>
        <div class="section italic">Mobile No. <div class="underline">${receipt.mobile}</div></div>
        <div class="section italic">a sum of Rs. <div class="underline">₹${receipt.amountWords}</div></div>
        <div class="section italic">Purpose/Description: <div class="underline">${particularNature}, ${description}</div></div>

        <div class="payment-row">
          <!-- LEFT TABLE -->
          <table class="payment-table">
            <tr><th colspan="2">Payment Mode</th></tr>
            <tr>
              <td class="italic">${receipt.mode === 'Cash' ? '☑️ Cash' : 'Cash'}</td>
              <td className="italic">
                  ${['BOI', 'SBI'].includes(receipt.mode) ? '☑️ RTGS/NEFT' : 'RTGS/NEFT'}
             </td>            
          </tr>
            <tr>
              <td class="italic">${receipt.mode === 'Cheque' ? '☑️ Cheque' : 'Cheque'}</td>
              <td class="italic">${receipt.mode === 'Card' ? '☑️ Card' : 'Card'}</td>
            </tr>
          </table>

          <!-- MIDDLE ₹ SYMBOL + AMOUNT -->
          <div class="rs-combo">
            <div class="circle-rs">₹</div>
            <div class="bramount-box">
              <div class="amount-box">${parseFloat(receipt.amount).toLocaleString('en-IN')}</div>
            </div>
          </div>

          <!-- RIGHT SIGNATURE -->
          <div class="signature">
             Issued By: <span class="short-underline">${'Accounts Dept.'}</span>

          </div>
        </div>
      </div>
    </div>
  </body>
</html>
  `;

    let iframe = document.getElementById("print-frame");
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = "print-frame";
      iframe.style.display = "none";
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(content);
    doc.close();

    iframe.onload = function () {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    };

  }, []);

  useEffect(() => {
    const receipt = location.state?.printReceipt;
    if (receipt) {
      if (receipt.type === 'Other') {
        handlePrintOther(receipt);
      } else if (receipt.type === 'Cash') {
        handlePrintCash(receipt);
      } else {
        handlePrint(receipt);
      }
    }
  }, [location.state, handlePrint, handlePrintCash, handlePrintOther]);

  const handleImportReceipts = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);

      const batchUpdates = {};

      for (let row of data) {
        let jsDate = null;

        // Convert receiptDate to JS Date
        try {
          if (row.receiptDate) {
            if (typeof row.receiptDate === "number") {
              jsDate = new Date((row.receiptDate - 25569) * 86400 * 1000);
            } else if (typeof row.receiptDate === "string") {
              let parts;
              if (row.receiptDate.includes("-")) parts = row.receiptDate.split("-");
              else if (row.receiptDate.includes("/")) parts = row.receiptDate.split("/");

              if (parts && parts.length === 3) {
                let [first, second, third] = parts;
                if (parseInt(first) > 31) {
                  jsDate = new Date(`${first}-${second}-${third}`);
                } else {
                  let day = first, month = second, year = third;
                  if (parseInt(year) < 100) year = "20" + year;
                  jsDate = new Date(`${year}-${month}-${day}`);
                }
              }
            }
            if (jsDate && isNaN(jsDate)) jsDate = null;
          }
        } catch { jsDate = null; }

        const monthYear = jsDate
          ? jsDate.toLocaleString("en-US", { month: "short", year: "numeric" }).replace(" ", "")
          : "UnknownMonth";

        const receiptId = crypto.randomUUID();

        const receiptData = {
          id: receiptId,
          ...row,
          receiptDate: jsDate ? jsDate.toISOString().split("T")[0] : null,
          mobile: row.mobile ? row.mobile.toString() : "",
          type: row.type || "Unknown",
          createdAt: new Date().toISOString(),
        };

        if (!batchUpdates[monthYear]) batchUpdates[monthYear] = {};
        batchUpdates[monthYear][receiptId] = receiptData;
      }

      // Firestore updates month-wise
      for (const [monthYear, receiptsMap] of Object.entries(batchUpdates)) {
        const docRef = doc(db, "moneyReceipts", monthYear);
        try {
          await updateDoc(docRef, receiptsMap);
        } catch (err) {
          if (err.code === "not-found") {
            await setDoc(docRef, receiptsMap);
          } else console.error(err);
        }
      }

      alert(`✅ Import completed! Total rows processed: ${data.length}`);
    };

    reader.readAsBinaryString(file);
  };

  const handleExportReceipts = async () => {
    try {
      const receiptsCollection = collection(db, "moneyReceipts");
      const snapshot = await getDocs(receiptsCollection);

      let allReceipts = [];

      snapshot.forEach((docSnap) => {
        const monthYear = docSnap.id;
        const receiptsMap = docSnap.data();

        Object.values(receiptsMap).forEach((receipt) => {
          allReceipts.push({
            ...receipt,
            monthYear,
          });
        });
      });

      if (allReceipts.length === 0) {
        alert("⚠️ No receipts found for export.");
        return;
      }

      // Convert receipts array → worksheet
      const worksheet = XLSX.utils.json_to_sheet(allReceipts);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Receipts");

      // Generate Excel file and trigger download
      const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      saveAs(new Blob([wbout], { type: "application/octet-stream" }), "moneyReceipts.xlsx");

      alert(`✅ Export completed! Total receipts exported: ${allReceipts.length}`);
    } catch (error) {
      console.error("Export failed:", error);
      alert("❌ Export failed. Check console for details.");
    }
  };

  const totalCredit = filteredReceipts
    .filter(r => r.paymentFor === "Credit")
    .reduce((sum, r) => sum + Number(r.amount || 0), 0);

  const totalDebit = filteredReceipts
    .filter(r => r.paymentFor === "Debit")
    .reduce((sum, r) => sum + Number(r.amount || 0), 0);

  const balance = totalCredit - totalDebit;

  const findPrebookingDocFor = async (maybeBookingId, slNo) => {
    // First: if bookingId given, try to find doc that contains that bookingId key quickly by scanning docs
    const prebookingsCol = collection(db, "prebookings");
    const snap = await getDocs(prebookingsCol);

    for (const docSnap of snap.docs) {
      const docId = docSnap.id; // e.g. "Aug2025"
      const data = docSnap.data();
      if (maybeBookingId && data[maybeBookingId]) {
        return { docId, bookingId: maybeBookingId, bookingData: data[maybeBookingId] };
      }
      // fallback: search each booking map for advancePayments entry with matching slNo
      for (const [bkId, bkMap] of Object.entries(data)) {
        try {
          const adv = bkMap && bkMap.advancePayments;
          if (Array.isArray(adv) && adv.some(p => String(p.slNo) === String(slNo))) {
            return { docId, bookingId: bkId, bookingData: bkMap };
          }
        } catch (e) {
          // ignore malformed entries
        }
      }
    }

    return null; // not found
  };

  const handleUpdateReceipt = async (updatedReceipt) => {
    try {
      const {
        id,
        monthYear,
        bookingId: givenBookingId,
        amount,
        receiptDate,
        receiver,
        paymentFor,
        slNo,
        ...rest
      } = updatedReceipt;

      // 1) Update moneyReceipts (same document named by monthYear)
      const moneyReceiptRef = doc(db, "moneyReceipts", monthYear);
      await updateDoc(moneyReceiptRef, {
        [`${id}.amount`]: amount,
        [`${id}.receiptDate`]: receiptDate,
        [`${id}.receiver`]: receiver,
        ...Object.fromEntries(Object.entries(rest || {}).map(([k, v]) => [`${id}.${k}`, v])),
      });
      console.log("✅ moneyReceipts updated:", monthYear, id);

      // 2) Update prebookings
      // We need to determine which prebookings document (month) contains the booking map for this receipt.
      // Prefer givenBookingId if provided, otherwise search by slNo.
      let found = null;

      // Quick check: if bookingId provided, check monthYear doc first (common case)
      if (givenBookingId) {
        try {
          const tryRef = doc(db, "prebookings", monthYear);
          const trySnap = await getDoc(tryRef);
          if (trySnap.exists()) {
            const tryData = trySnap.data();
            if (tryData && tryData[givenBookingId]) {
              found = { docId: monthYear, bookingId: givenBookingId, bookingData: tryData[givenBookingId] };
            }
          }
        } catch (e) {
          console.warn("Error checking prebookings month doc:", e);
        }
      }

      try {
        const accountantDocId = updatedReceipt.cashTo;
        if (!accountantDocId) {
          console.warn("❌ No cashTo provided in receipt, skipping accountant update.");
        } else {
          const accountantRef = doc(db, "accountant", accountantDocId);
          const accSnap = await getDoc(accountantRef);

          // Doc-level type
          const docType = accountantDocId.includes("Locker")
            ? "Locker"
            : accountantDocId.includes("Bank")
              ? "Bank"
              : "Cash";

          if (accSnap.exists()) {
            const accData = accSnap.data();
            let txns = Array.isArray(accData.transactions) ? [...accData.transactions] : [];

            const accIdx = txns.findIndex(t => String(t.slNo) === String(slNo));
            if (accIdx !== -1) {
              txns[accIdx] = {
                ...txns[accIdx],
                amount,
                receiver,
                receiptDate,
                ...(updatedReceipt.description && { description: updatedReceipt.description }),
                ...(updatedReceipt.cashTo && { cashTo: updatedReceipt.cashTo }),
                ...(updatedReceipt.mode && { mode: updatedReceipt.mode }),
                updatedAt: new Date().toISOString(),
                // Keep transaction-level type intact (Credit / Debit)
                type: txns[accIdx].type,
              };

              // Update doc-level type separately
              await updateDoc(accountantRef, {
                transactions: txns,
                type: docType,
              });
            } else {
              console.warn("Transaction not found in accountant for slNo:", slNo);
            }
          } else {
            // Create new doc if missing
            await setDoc(accountantRef, {
              slNo,
              name: accountantDocId.split("-")[0],
              email: "",
              transactions: [
                {
                  slNo,
                  amount,
                  receiver,
                  receiptDate,
                  ...(updatedReceipt.description && { description: updatedReceipt.description }),
                  cashTo: updatedReceipt.cashTo,
                  mode: updatedReceipt.mode,
                  createdAt: new Date().toISOString(),
                  type: updatedReceipt.paymentFor === 'Advance' ? 'Credit' : 'Debit', // <-- correct transaction type
                },
              ],
              type: docType, // doc-level type
            });
          }
        }
      } catch (e) {
        console.error("Error updating accountant:", e);
      }

      if (!found) {
        const scanResult = await findPrebookingDocFor(givenBookingId, slNo);
        if (scanResult) found = scanResult;
      }

      if (!found) {
        console.warn("Prebooking entry not found (no booking / payment match). Skipping prebookings update.");
        return; // moneyReceipts already updated — return
      }

      const { docId: prebookingMonthDocId, bookingId: realBookingId, bookingData } = found;

      if (!bookingData) {
        console.warn("Booking map missing inside prebooking doc:", prebookingMonthDocId, realBookingId);
        return;
      }

      const advPayments = Array.isArray(bookingData.advancePayments) ? [...bookingData.advancePayments] : [];

      // find index by slNo (string compare to be safe)
      const idx = advPayments.findIndex(p => String(p.slNo) === String(slNo));
      if (idx === -1) {
        console.warn("Advance payment entry not found for slNo:", slNo, "in booking:", realBookingId);
        return;
      }

      // update the payment object
      const updatedPayment = {
        ...advPayments[idx],
        amount: amount,
        receiver: receiver,
        receiptDate: receiptDate,
        ...(updatedReceipt.description !== undefined && { description: updatedReceipt.description }),
        ...(updatedReceipt.cashTo !== undefined && { cashTo: updatedReceipt.cashTo }),
        ...(updatedReceipt.mode !== undefined && { mode: updatedReceipt.mode }),
        addedAt: new Date().toISOString(),
      };

      advPayments[idx] = updatedPayment;

      // Write back the updated array into the correct prebookings document
      const prebookingRef = doc(db, "prebookings", prebookingMonthDocId);
      await updateDoc(prebookingRef, {
        [`${realBookingId}.advancePayments`]: advPayments,
      });

      console.log("✅ prebookings updated:", prebookingMonthDocId, realBookingId, "slNo:", slNo);
    } catch (err) {
      console.error("Error updating receipt:", err);
      alert("❌ Error updating receipt. See console for details.");
    }
  };

  const openPopup = (receipt) => {
    setSelectedReceipt(receipt);
    setNewAmount(receipt.amount ?? 0);
    setNewDescription(receipt.description ?? "");
    setNewDate(receipt.receiptDate ?? "");
    setShowPopup(true);
  };

  const handleSave = () => {
    if (!selectedReceipt) {
      alert("No receipt selected.");
      return;
    }

    // Build payload for update; bookingId may be undefined — the update fn has fallback scan logic
    const payload = {
      ...selectedReceipt,
      bookingId: selectedReceipt.bookingId, // if available
      amount: Number(newAmount),
      description: newDescription,
      receiptDate: newDate || selectedReceipt.receiptDate,
    };

    // Call the update function that updates both moneyReceipts and prebookings (with fallback)
    handleUpdateReceipt(payload);

    // close popup
    setShowPopup(false);
  };

  return (
    <>
      <div className="receipts-container">
        <div style={{ marginBottom: '0px' }}> <BackButton />  </div>

        <div style={{ marginBottom: '10px' }}>
          <h2 className="title">All Receipts</h2>
        </div>

        <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'right', alignItems: 'center', gap: '10px' }}>
          <input type="text"
            placeholder="🔍 Search by Sl No., Type, name, mobile, event or date"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />

          <button
            onClick={() => setShowFilters(prev => !prev)}
            style={{
              padding: '0px',
              backgroundColor: 'transparent',
              color: '#fff',
              border: 'none',
              borderRadius: '5px',
              fontSize: '30px',
              cursor: 'pointer'
            }}
          >
            {showFilters ? '🔼' : '🔽'}
          </button>
        </div>

        <div
          style={{
            margin: "10px 0",
            padding: "10px",
            border: "1px solid #ccc",
            borderRadius: "6px",
            background: "#f5f5f5",
            overflowX: "auto",
            whiteSpace: "nowrap",
          }}
        >
          {(() => {
            // Group by eventType + particularNature (case-insensitive, trimmed)
            const grouped = {};
            const displayNames = {}; // to preserve first-seen display name

            filteredReceipts.forEach(r => {
              if (
                r.particularNature?.toLowerCase().includes(search.toLowerCase()) ||
                r.eventType?.toLowerCase().includes(search.toLowerCase())
              ) {
                const key =
                  (r.eventType?.trim().toLowerCase() || "No Event") +
                  "|" +
                  (r.particularNature?.trim().toLowerCase() || "No Particular");

                if (!grouped[key]) {
                  grouped[key] = { credit: 0, debit: 0 };
                  displayNames[key] = {
                    eventType: r.eventType?.trim() || "",
                    particularNature: r.particularNature?.trim() || "",
                  };
                }

                if (r.paymentFor === "Credit") {
                  grouped[key].credit += Number(r.amount || 0);
                } else if (r.paymentFor === "Debit") {
                  grouped[key].debit += Number(r.amount || 0);
                }
              }
            });

            return Object.keys(grouped).length > 0 ? (
              Object.entries(grouped).map(([key, totals]) => (
                <div
                  key={key}
                  style={{
                    display: "inline-block",
                    minWidth: "240px",
                    padding: "12px",
                    marginRight: "12px",
                    borderRadius: "8px",
                    background: "#fff",
                    boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
                    textAlign: "center",
                  }}
                >
                  <h4 style={{ marginBottom: "4px", color: "#2e6999" }}>
                    {displayNames[key].eventType
                      ? displayNames[key].eventType
                      : displayNames[key].particularNature}
                  </h4>

                  {/* ✅ Only show if > 0 */}
                  {totals.credit > 0 && (
                    <p style={{ margin: "4px 0", color: "green", fontWeight: "600" }}>
                      Credit: ₹{totals.credit.toLocaleString("en-IN")}
                    </p>
                  )}
                  {totals.debit > 0 && (
                    <p style={{ margin: "4px 0", color: "red", fontWeight: "600" }}>
                      Debit: ₹{totals.debit.toLocaleString("en-IN")}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <p style={{ padding: "8px", color: "#888" }}>
                No Particular Nature or Event Type matched.
              </p>
            );
          })()}
        </div>

        {showFilters && (
          <>
            <div style={{ marginTop: '20px' }}>
              <p style={{ fontWeight: '600', marginBottom: '10px' }}>📆 Filter by Date Range</p>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap'
              }}>

                <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>

                  <button
                    onClick={handleExportReceipts}
                    style={{
                      padding: "8px 14px",
                      background: "#1eb619ff",
                      color: "#fff",
                      border: "none",
                      borderRadius: "5px",
                      cursor: "pointer",
                    }}
                  >
                    Export
                  </button>
                </div>

                <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>

                  <label style={{ padding: "8px 14px", background: "#1eb619ff", color: "#fff", border: "none", borderRadius: "5px", cursor: "pointer" }}>
                    Import
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleImportReceipts}
                      style={{ display: "none" }}
                    />
                  </label>
                </div>


                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontSize: '14px' }}>From</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '4px',
                      border: '1px solid #ccc',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontSize: '14px' }}>To</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '4px',
                      border: '1px solid #ccc',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontSize: '14px' }}>Financial Year</label>
                  <select
                    value={selectedFY}
                    onChange={(e) => setSelectedFY(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '14px' }}
                  >
                    <option value="">All</option>
                    {financialYears.map(fy => (
                      <option key={fy} value={fy}>{fy}</option>
                    ))}
                  </select>
                </div>

                {(dateFrom || dateTo) && (
                  <button
                    onClick={() => {
                      setDateFrom('');
                      setDateTo('');
                    }}
                    style={{
                      padding: '6px 12px',
                      background: '#e74c3c',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '14px',
                      cursor: 'pointer'
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>

            </div>

            <div style={{
              margin: '20px 0',
              padding: '20px',
              border: '1px solid #ddd',
              borderRadius: '8px',
              backgroundColor: '#f9f9f9',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '40px' }}>
                <div>
                  <p style={{ fontWeight: '600', marginBottom: '10px' }}>Receipt Type</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    <button
                      onClick={() => setTypeFilter('All')}
                      style={{
                        background: typeFilter === 'All' ? '#2e6999' : '#b3b3b3',
                        color: '#fff',
                        padding: '8px 12px',
                        border: 'none',
                        borderRadius: '4px'
                      }}>
                      All
                    </button>

                    <button
                      onClick={() => setTypeFilter('BankCash')}
                      style={{
                        background: typeFilter === 'BankCash' ? '#2e6999' : '#b3b3b3',
                        color: '#fff',
                        padding: '8px 12px',
                        border: 'none',
                        borderRadius: '4px'
                      }}>
                      MR Bank + Cash
                    </button>

                    <button
                      onClick={() => setTypeFilter('Bank')}
                      style={{
                        background: typeFilter === 'Bank' ? '#2e6999' : '#b3b3b3',
                        color: '#fff',
                        padding: '8px 12px',
                        border: 'none',
                        borderRadius: '4px'
                      }}>
                      MR Bank
                    </button>
                    <button
                      onClick={() => setTypeFilter('Cash')}
                      style={{
                        background: typeFilter === 'Cash' ? '#2e6999' : '#b3b3b3',
                        color: '#fff',
                        padding: '8px 12px',
                        border: 'none',
                        borderRadius: '4px'
                      }}>
                      MR Cash
                    </button>
                    <button
                      onClick={() => setTypeFilter('Refund')}
                      style={{
                        background: typeFilter === 'Refund' ? '#2e6999' : '#b3b3b3',
                        color: '#fff',
                        padding: '8px 12px',
                        border: 'none',
                        borderRadius: '4px'
                      }}>
                      MR Refund
                    </button>
                    <button
                      onClick={() => setTypeFilter('Voucher')}
                      style={{
                        background: typeFilter === 'Voucher' ? '#2e6999' : '#b3b3b3',
                        color: '#fff',
                        padding: '8px 12px',
                        border: 'none',
                        borderRadius: '4px'
                      }}>
                      Voucher
                    </button>
                  </div>
                </div>

                <div>
                  <p style={{ fontWeight: '600', marginBottom: '10px' }}>➕➖ Credit / Debit</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    <button
                      onClick={() => setCreditDebitFilter('All')}
                      style={{
                        background: creditDebitFilter === 'All' ? '#2e6999' : '#b3b3b3',
                        color: '#fff',
                        padding: '8px 12px',
                        border: 'none',
                        borderRadius: '4px'
                      }}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setCreditDebitFilter('Credit')}
                      style={{
                        background: creditDebitFilter === 'Credit' ? '#2e6999' : '#b3b3b3',
                        color: '#fff',
                        padding: '8px 12px',
                        border: 'none',
                        borderRadius: '4px'
                      }}
                    >
                      Credit
                    </button>
                    <button
                      onClick={() => setCreditDebitFilter('Debit')}
                      style={{
                        background: creditDebitFilter === 'Debit' ? '#2e6999' : '#b3b3b3',
                        color: '#fff',
                        padding: '8px 12px',
                        border: 'none',
                        borderRadius: '4px'
                      }}
                    >
                      Debit
                    </button>
                  </div>
                </div>

                <div>
                  <p style={{ fontWeight: '600', marginBottom: '10px' }}>💳 Payment Modes</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    {['All', 'BOI', 'SBI', 'Cash', 'Card', 'Cheque'].map(mode => (
                      <button
                        key={mode}
                        onClick={() => setModeFilter(mode)}
                        style={{
                          background: modeFilter === mode ? '#2e6999' : '#b3b3b3',
                          color: '#fff',
                          padding: '8px 12px',
                          border: 'none',
                          borderRadius: '4px'
                        }}>
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', maxWidth: '1600px' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '8px', border: '1px solid #ccc', textAlign: 'Center', whiteSpace: 'nowrap' }}>FY-YEAR</th>
                        <th style={{ padding: '8px', border: '1px solid #ccc', textAlign: 'Center', whiteSpace: 'nowrap' }}>MONTH</th>
                        <th style={{ padding: '8px', border: '1px solid #ccc', textAlign: 'Center', whiteSpace: 'nowrap' }}>CREDIT</th>
                        <th style={{ padding: '8px', border: '1px solid #ccc', textAlign: 'Center', whiteSpace: 'nowrap' }}>DEBIT</th>
                        <th style={{ padding: '8px', border: '1px solid #ccc', textAlign: 'Center', whiteSpace: 'nowrap' }}>BALANCE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {finalTableData.map((row, idx) => (
                        <tr key={idx}>
                          <td style={{ padding: '8px', border: '1px solid #00014fff', whiteSpace: 'nowrap' }}>{row.fy}</td>
                          <td style={{ padding: '8px', border: '1px solid #00014fff', whiteSpace: 'nowrap' }}>{row.month}</td>
                          <td style={{ padding: '8px', border: '1px solid #00014fff', whiteSpace: 'nowrap', textAlign: 'left', color: 'green' }}>
                            {row.credit.toLocaleString('en-IN')}
                          </td>
                          <td style={{ padding: '8px', border: '1px solid #00014fff', textAlign: 'left', whiteSpace: 'nowrap', color: 'red' }}>
                            {row.debit.toLocaleString('en-IN')}
                          </td>
                          <td style={{ padding: '8px', border: '1px solid #00014fff', textAlign: 'left', whiteSpace: 'nowrap' }}>
                            {row.balance.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>
            </div>
          </>
        )}

        <div
          style={{
            marginBottom: '10px',
            display: 'flex',
            justifyContent: 'right',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          <button
            onClick={() => navigate('/MoneyReceipt')}
            style={{
              padding: '10px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
            }}
          >
            Money Receipt
          </button>

          <button
            onClick={() => navigate('/Receipts')}
            style={{
              padding: '10px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
            }}
          >
            Voucher
          </button>


        </div>

        <div className="summary-bar">
          <span>Credit: <span > ₹{totalCredit.toLocaleString("en-IN")} </span> </span>
          <span>Debit: <span > ₹{totalDebit.toLocaleString("en-IN")} </span> </span>
          <span>Balance: <span > ₹{balance.toLocaleString("en-IN")} </span> </span>
        </div>

        <div className="tables-container">

          {/* Table 1 */}
          <div className="table-wrapper left" style={{ width: 'fit-content' }}>
            <table className="receipts-table">
              <thead>
                <tr>
                  <th
                    style={{
                      cursor: "pointer",
                      padding: '0px'
                    }}

                    onClick={() => {
                      if (sortKey === "receiptDate") {
                        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                      } else {
                        setSortKey("receiptDate");
                        setSortOrder("desc");
                      }
                    }}>
                    Receipt Date
                    <button
                      style={{
                        margin: "-1px",
                        cursor: "pointer",
                        border: "none",
                        background: "transparent",
                        padding: '0px'
                      }}
                    >
                      {sortKey === "receiptDate" ? (sortOrder === "asc" ? "" : "") : ""}
                    </button>
                  </th>
                  <th>Name</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // Sort/filter receipts if needed
                  const sortedReceipts = [...filteredReceipts];
                  let balance = 0;
                  const runningBalances = [];

                  // Calculate running balances
                  for (let i = sortedReceipts.length - 1; i >= 0; i--) {
                    const r = sortedReceipts[i];
                    const amount = parseFloat(r.amount || 0);
                    const isCredit = r.paymentFor === "Credit";
                    const isDebit = r.paymentFor === "Debit";

                    if (isCredit) balance += amount;
                    else if (isDebit) balance -= amount;

                    runningBalances[i] = balance;
                  }

                  return sortedReceipts.map((r, index) => {
                    const isCredit = r.paymentFor === "Credit";
                    const isDebit = r.paymentFor === "Debit";

                    return (
                      <tr
                        key={r.id + "_" + index}
                        style={{
                          color:
                            r.approval === "Rejected"
                              ? "black"
                              : isCredit
                                ? "green"
                                : isDebit
                                  ? "red"
                                  : "black",
                          fontWeight: '700',

                        }}
                      >

                        <td style={{ padding: '14px 0px' }}>{r.receiptDate ? formatDate(r.receiptDate) : ''}</td>
                        <td>{r.customerName || r.partyName}</td>

                      </tr>
                    );
                  });
                })()}

                {filteredReceipts.length === 0 && (
                  <tr>
                    <td colSpan="10" style={{ textAlign: "center", padding: "20px", color: "#999" }}>
                      No receipts found.
                    </td>
                  </tr>
                )}

              </tbody>
            </table>
          </div>

          {/* Table 2 */}
          <div className="table-wrapper right">
            <table className="receipts-table">
              <thead>
                <tr>
                  <th>SL.</th>
                  <th>SL. No</th>
                  <th>Particular Nature</th>
                  <th>Description</th>
                  <th>MR/VR</th>
                  <th>Credit</th>
                  <th>Debit</th>
                  <th>Name</th>
                  <th>Mobile</th>
                  <th>Amount</th>
                  <th>Balance</th>
                  <th>Print</th>
                  <th>Edit</th>
                  <th>Generated By</th>
                  <th>Approval</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // Sort/filter receipts if needed
                  const sortedReceipts = [...filteredReceipts];
                  let balance = 0;
                  const runningBalances = [];

                  // Calculate running balances
                  for (let i = sortedReceipts.length - 1; i >= 0; i--) {
                    const r = sortedReceipts[i];
                    const amount = parseFloat(r.amount || 0);
                    const isCredit = r.paymentFor === "Credit";
                    const isDebit = r.paymentFor === "Debit";

                    if (isCredit) balance += amount;
                    else if (isDebit) balance -= amount;

                    runningBalances[i] = balance;
                  }

                  return sortedReceipts.map((r, index) => {
                    const isCredit = r.paymentFor === "Credit";
                    const isDebit = r.paymentFor === "Debit";

                    return (
                      <tr
                        key={r.id + "_" + index}
                        style={{
                          color:
                            r.approval === "Rejected"
                              ? "black"
                              : isCredit
                                ? "green"
                                : isDebit
                                  ? "red"
                                  : "black",
                          fontWeight: '700'
                        }}
                      >
                        <td style={{ fontWeight: "bold", color: 'black' }}>
                          {filteredReceipts.length - index}.
                        </td>
                        <td style={{ fontWeight: "bold" }}>#{r.slNo}</td>
                        <td>{r.eventType || r.particularNature}</td>
                        <td>{r.description}</td>
                        <td>
                          {r.type === "Money Receipt"
                            ? "MR"
                            : r.type === "Cash"
                              ? "MR"
                              : r.type === "Voucher"
                                ? "Voucher"
                                : r.type}  {r.mode} {r.cashTo}
                        </td>
                        <td>{r.paymentFor === "Credit" ? r.paymentFor : ""}</td>
                        <td>{r.paymentFor === "Debit" ? r.paymentFor : ""}</td>
                        <td>{r.customerName || r.partyName}</td>
                        <td>{r.mobile}</td>
                        <td>₹{Number(r.amount).toLocaleString("en-IN")}</td>
                        {/* **Balance column added immediately after approval info** */}
                        <td style={{ color: isCredit ? "green" : isDebit ? "red" : "#000" }}>
                          ₹{Number(runningBalances[index].toFixed(2)).toLocaleString("en-IN")}
                        </td>
                        {/* Payment type columns */}


                        {/* Print button */}
                        <td>
                          {r.slNo?.toString().startsWith("C") ? (
                            <button
                              onClick={() => {
                                if (r.approval !== "Accepted") {
                                  alert("❌ Printing not allowed — approval is not granted.");
                                  return;
                                }
                                handlePrintCash(r);
                              }}
                              style={{
                                background: r.approval === "Accepted" ? "#b52e2e" : "#888",
                                color: "#fff",
                                padding: "5px 10px",
                                border: "none",
                                borderRadius: "4px",
                                cursor: r.approval === "Accepted" ? "pointer" : "not-allowed",
                              }}
                              disabled={r.approval !== "Accepted"}
                            >
                              Print
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                if (r.approval !== "Accepted") {
                                  alert("❌ Printing not allowed — approval is not granted.");
                                  return;
                                }
                                r.eventDate ? handlePrint(r) : handlePrintOther(r);
                              }}
                              style={{
                                background: r.approval === "Accepted" ? "#b52e2e" : "#888",
                                color: "#fff",
                                padding: "5px 10px",
                                border: "none",
                                borderRadius: "4px",
                                cursor: r.approval === "Accepted" ? "pointer" : "not-allowed",
                              }}
                              disabled={r.approval !== "Accepted"}
                            >
                              Print
                            </button>
                          )}
                        </td>

                        <td>
                          <button onClick={() => openPopup(r)}>Edit</button>
                        </td>

                        <td>{r.receiver || r.myName || r.receiverName || r.sender}</td>


                        <td>
                          Approval: {r.approval || "Non"}, By: {r.approvedBy || "Default"}
                        </td>

                      </tr>
                    );
                  });
                })()}

                {filteredReceipts.length === 0 && (
                  <tr>
                    <td colSpan="10" style={{ textAlign: "center", padding: "20px", color: "#999" }}>
                      No receipts found.
                    </td>
                  </tr>
                )}

              </tbody>
            </table>
          </div>

        </div>

        {showPopup && (
          <div
            className="popup-overlay"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundColor: "rgba(0,0,0,0.5)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1000,
            }}
          >
            <div
              className="popup-content"
              style={{
                backgroundColor: "#fff",
                padding: "20px",
                borderRadius: "8px",
                width: "320px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <h3 style={{ margin: 0 }}>Edit Receipt</h3>

              <input
                type="text"
                inputMode="decimal"
                placeholder="Amount"
                value={newAmount}
                onChange={(e) => {
                  let val = e.target.value.replace(/[^0-9.]/g, "");
                  if ((val.match(/\./g) || []).length > 1) val = val.slice(0, -1);
                  setNewAmount(val);
                }}
              />

              <input
                type="text"
                placeholder="Description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />

              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <button onClick={handleSave} style={{ padding: "6px 12px" }}>Save</button>
                <button onClick={() => setShowPopup(false)} style={{ padding: "6px 12px" }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

      </div>

      <div style={{ marginBottom: "50px" }}></div>
      <BottomNavigationBar navigate={navigate} userAppType={userAppType} />
    </>
  );
};

export default MoneyReceipts;
