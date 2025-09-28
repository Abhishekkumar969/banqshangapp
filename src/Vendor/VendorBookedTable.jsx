import React, { useEffect, useState, useRef, useMemo } from 'react';
import { collection, getDocs, doc, updateDoc, arrayUnion, serverTimestamp, setDoc, deleteField } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import '../styles/VendorTable.css';
import BackButton from "../components/BackButton";
import { useNavigate } from 'react-router-dom';
import VendorLogPopupCell from './VendorLogPopupCell.jsx';

const VendorTable = () => {
  const [allBookings, setAllBookings] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [amount, setAmount] = useState("");
  const [showPopup, setShowPopup] = useState(false);
  const navigate = useNavigate();
  const [sortOrder, setSortOrder] = useState("desc"); // "asc" ya "desc"

  useEffect(() => {
    const fetchData = async () => {
      try {
        const vendorSnap = await getDocs(collection(db, "vendor"));
        const vendors = vendorSnap.docs.map(docItem => ({
          id: docItem.id,
          source: "vendor",
          ...docItem.data(),
          finalDate: docItem.data().date
        }));

        const merged = [];
        const seenKeys = new Set();
        const makeKey = (name, contact, eventType, date) =>
          `${(name || "").toLowerCase()}|${(contact || "").replace(/\s+/g, "")}|${(eventType || "").toLowerCase()}|${date ? new Date(date).toISOString().split("T")[0] : ""}`;

        vendors.forEach(v => {
          const key = makeKey(v.customerName, v.contactNo, v.eventType || v.typeOfEvent, v.finalDate);
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            merged.push(v);
          }
        });

        merged.sort((a, b) => {
          const dateA = a.finalDate ? new Date(a.finalDate) : new Date(0);
          const dateB = b.finalDate ? new Date(b.finalDate) : new Date(0);

          if (sortOrder === "asc") return dateA - dateB;
          else return dateB - dateA;
        });

        setAllBookings(merged);
      } catch (error) {
        console.error("❌ Error fetching data:", error);
      }
    };
    fetchData();
  }, [sortOrder]);

  const convertTo12Hour = (timeStr) => {
    if (!timeStr) return "-";
    const [hours, minutes] = timeStr.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${String(minutes).padStart(2, '0')} ${ampm}`;
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return "-";
    let date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return "-";
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const parseMoney = (val) => {
    if (val === undefined || val === null || val === '') return 0;
    const n = typeof val === 'string' ? Number(val.replace(/,/g, '')) : Number(val);
    return Number.isNaN(n) ? 0 : n;
  };

  const getGrandTotal = (v) => parseMoney(v?.summary?.grandTotal);
  const getAdvanceTotal = (v) =>
    Array.isArray(v?.advance) ? v.advance.reduce((s, a) => s + parseMoney(a?.amount), 0) : 0;

  const handleAddAmountClick = (vendor) => {
    setSelectedVendor(vendor);
    setShowPopup(true);
  };

  const handleSaveAmount = async () => {
    if (!selectedVendor || !amount) return;
    try {
      const vendorRef = doc(db, "vendor", selectedVendor.id);
      await updateDoc(vendorRef, {
        advance: arrayUnion({
          amount: Number(amount),
          date: new Date().toISOString(),
        }),
      });
      alert("Amount added successfully ✅");
      setAmount("");
      setShowPopup(false);
    } catch (error) {
      console.error("❌ Error updating vendor:", error);
    }
  };

  const normalizeServices = (services) => {
    if (!services) return [];
    if (Array.isArray(services)) return services;
    if (Array.isArray(services?.new)) return services.new;
    if (Array.isArray(services?.old)) return services.old;
    if (typeof services === "object") return Object.values(services);
    return [];
  };

  const filteredBookings = useMemo(() => {
    return allBookings.filter(v => {
      if (v.dropReason) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const dateStr = v.finalDate ? new Date(v.finalDate).toLocaleDateString("en-GB").replace(/\//g, "-") : "";
      return v.customerName?.toLowerCase().includes(q) ||
        v.contactNo?.toLowerCase().includes(q) ||
        v.eventType?.toLowerCase().includes(q) ||
        dateStr.includes(q);
    });
  }, [allBookings, searchQuery]);

  const summary = filteredBookings.reduce((acc, v) => {
    const svcs = normalizeServices(v.services);
    const grand = getGrandTotal(v);
    const adv = getAdvanceTotal(v);
    const rem = grand - adv;
    const royaltyTotal = svcs.reduce((s, srv) => s + (Number(srv.royaltyAmount) || 0), 0);
    const royaltyPercents = svcs.map(srv => Number(srv.royaltyPercent) || 0).filter(p => p > 0);
    const avgRoyalty = royaltyPercents.length ? royaltyPercents.reduce((a, b) => a + b, 0) / royaltyPercents.length : 0;

    acc.grandTotal += grand;
    acc.advanceTotal += adv;
    acc.remainingTotal += rem;
    acc.totalPayOut += royaltyTotal;
    acc.totalAvgRoyalty += avgRoyalty;
    acc.countForAvg += royaltyPercents.length;

    return acc;
  }, { grandTotal: 0, advanceTotal: 0, remainingTotal: 0, totalPayOut: 0, totalAvgRoyalty: 0, countForAvg: 0 });

  const avgPayOutPercent = summary.countForAvg ? (summary.totalAvgRoyalty / summary.countForAvg).toFixed(2) : 0;

  const DottedField = ({ label, value }) => (
    <span style={{ display: "flex", gap: "5px", flex: 1, alignItems: "center" }}>
      {label}
      <span
        style={{
          flex: 1,
          borderBottom: "1px dotted brown",
          minHeight: "18px",
          display: "inline-block",
          fontWeight: 700, // ✅ bold value
        }}
      >
        {value || ""}
      </span>
    </span>
  );

  const DottedFieldRow = ({ fields }) => (
    <p style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
      {fields.map((f, i) => (
        <DottedField key={i} label={f.label} value={f.value} />
      ))}
    </p>
  );

  const getPrintFormat = (v, showRates) => {
    const services = normalizeServices(v?.services);
    return (
      <div
        style={{
          width: "750px",
          margin: "0 auto",
          fontFamily: "Times New Roman, serif",
          color: "brown",
          fontSize: "14px",
          lineHeight: "1.4",
        }}
      >
        {/* HEADER */}
        <h2 style={{ textAlign: "center", margin: 0, fontWeight: "bold", fontSize: "30px", wordSpacing: '5px' }}>
          Global Events & Wedding Planner
        </h2>
        <p style={{ textAlign: "center", fontSize: "15px", margin: "2px 0 10px 0" }}>
          <span style={{ fontWeight: "bold" }}> Bazar Samiti Main Road, Magahdesiya Colony, Patna - 800016 <br />
            Mob: 8084611124 | Email: vishnuldemon4480@gmail.com </span>
        </p>

        {/* CUSTOMER DETAILS */}
        <div style={{ marginTop: "10px", fontSize: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", alignItems: 'center', marginTop: '15px' }}>
            <span>
              No:{" "}
              <span style={{ display: "inline-block", minWidth: "100px", color: 'black' }}>
                {v?.slNo || ""}
              </span>
            </span>
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }} >
              <h3 style={{ textAlign: "center", margin: 0, border: "1px solid brown", display: "inline-block", padding: "4px 15px", fontSize: "15px", borderRadius: '5px' }}>
                EVENT BOOKING ESTIMATE
              </h3>
            </div>
            <span>
              Date:{" "}
              <span style={{ display: "inline-block", borderBottom: "1px dotted brown", minWidth: "120px", fontWeight: 'bold' }}>
                {v?.date ? new Date(v.date).toLocaleDateString("en-GB") : ""}
              </span>
            </span>
          </div>

          <DottedFieldRow fields={[{ label: "Customer’s Name:", value: v?.customerName }]} />
          <DottedFieldRow fields={[{ label: "Address:", value: v?.address }]} />
          <DottedFieldRow
            fields={[
              { label: "Contact No:", value: v?.contactNo },
              { label: "Type of Event:", value: v?.eventType },
            ]}
          />
          <DottedFieldRow
            fields={[
              {
                label: "Date of Event:",
                value: v?.date ? new Date(v.date).toLocaleDateString("en-GB") : "",
              },
              {
                label: "Start Time:",
                value: v?.startTime
                  ? new Date(`1970-01-01T${v.startTime}`).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
                  : "",
              },
              {
                label: "End Time:",
                value: v?.endTime
                  ? new Date(`1970-01-01T${v.endTime}`).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
                  : "",
              },
            ]}
          />

        </div>

        <div style={{ display: "flex", justifyContent: "center", marginBottom: "8px", alignItems: "center", marginTop: "15px" }} >
          <h3 style={{ textAlign: "center", margin: 0, border: "1px solid brown", display: "inline-block", padding: "4px 15px", fontSize: "15px", borderRadius: '5px' }}>
            TOTAL PACKAGE COST
          </h3>
        </div>

        <div style={{ display: "flex", justifyContent: "left", marginBottom: 0, alignItems: "center", marginTop: 0 }} >
          <h3 style={{ textAlign: "center", margin: 0, display: "inline-block", fontSize: "15px", borderRadius: '5px' }}>
            EVENT DESCRIPTIONS
          </h3>
        </div>

        {/* TABLE */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: 0,
            fontSize: "13px",
            border: "1px solid brown",
          }}
        >
          <thead>
            <tr style={{ color: "brown", background: "#fff" }}>
              <th style={{ border: "1px solid brown", padding: "5px" }}>S. No.</th>
              <th style={{ border: "1px solid brown", padding: "5px" }}>SERVICES</th>
              <th style={{ border: "1px solid brown", padding: "5px" }}>REMARKS</th>
              <th style={{ border: "1px solid brown", padding: "5px" }}>QTY</th>
              {showRates && (
                <>
                  <th style={{ border: "1px solid brown", padding: "5px" }}>RATE</th>
                  <th style={{ border: "1px solid brown", padding: "5px" }}>TOTAL</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {services.length > 0 ? (
              services.map((s, i) => (
                <tr key={i}>
                  <td style={{ textAlign: "center", padding: "5px", border: "1px solid brown", color: "brown" }}>{i + 1}</td>
                  <td style={{ padding: "5px", border: "1px solid brown", color: "brown" }}>{s.name}</td>
                  <td style={{ padding: "5px", border: "1px solid brown", color: "brown" }}>{s.remarks}</td>
                  <td style={{ padding: "5px", border: "1px solid brown", color: "brown" }}>{s.qty}</td>
                  {showRates && (
                    <>
                      <td style={{ padding: "5px", border: "1px solid brown", color: "brown" }}>
                        {s.rate ? Number(s.rate).toLocaleString("en-IN") : 0}
                      </td>
                      <td style={{ padding: "5px", border: "1px solid brown", color: "brown" }}>
                        {s.total ? Number(s.total).toLocaleString("en-IN") : 0}
                      </td>
                    </>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={showRates ? 6 : 4}
                  style={{ textAlign: "center", padding: "10px", border: "1px solid brown" }}
                >
                  No services added
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* GST + TOTAL */}
        <div
          style={{
            textAlign: "right",
            marginTop: "10px",
            fontSize: "14px",
            fontWeight: "bold",
          }}
        >
          <p>
            GST 18%:{" "}
            {v?.summary?.gstAmount
              ? Number(v.summary.gstAmount).toLocaleString("en-IN")
              : 0}
          </p>
          <p>
            Grand Total:{" "}
            {v?.summary?.grandTotal
              ? Number(v.summary.grandTotal).toLocaleString("en-IN")
              : 0}
          </p>
        </div>

        {/* TERMS */}
        <h4 style={{ marginTop: "20px", fontSize: "18px", textDecoration: 'underline', marginBottom: 0 }}>
          Terms & Conditions:
        </h4>
        <ol style={{ fontSize: "12px", paddingLeft: "20px", marginTop: 0 }}>
          <li>GST 18% Extra as applicable.</li>
          <li>50% advance & rest 50% before function date (Atleast 1 Week before Function Date).</li>
          <li>DJ & Sound Music will not allowed after 10:00 PM.</li>
          <li>Booking Cancellation / Changing of Date will be acceptable on subject to available / Consideration.</li>
          <li>No amount will be refunded, if booking will be cancel within 1 month from function date.</li>
          <li>Any physical damage will be responsible & paid by customer.</li>
          <li>Security charges will be applicable @Rs. 10,000/- if Required.</li>
        </ol>

        {/* SIGNATURE */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "100px", textAlign: "center" }}>
          <div style={{ flex: 1 }}>
            <div style={{ borderTop: "1px dotted brown", width: "60%", margin: "0 auto 8px auto" }} />
            <p style={{ margin: 0 }}>Event Booked By</p>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ borderTop: "1px dotted brown", width: "60%", margin: "0 auto 8px auto" }} />
            <p style={{ margin: 0 }}>Guest’s Signature</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <BackButton />
      <div style={{ marginTop: '60px' }}>
        <div style={{ textAlign: 'center' }}><h3>📋 All Bookings</h3></div>

        <div style={{ textAlign: "center", margin: "15px 0" }}>
          <input
            type="text"
            placeholder="Search by Name, Contact, Event Type, Date (dd-mm-yyyy)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: "70%", padding: "8px", borderRadius: "8px", border: "1px solid #ccc", fontSize: "14px" }}
          />
        </div>

        <div className="vendor-table-container">
          <table className="main-vendor-table">
            <thead>
              <tr>

                {[
                  '#'
                ].map(header => (
                  <th key={header}>{header}</th>
                ))}

                <th onClick={() => setSortOrder(prev => prev === "asc" ? "desc" : "asc")} style={{ cursor: "pointer" }}>
                  Function Date {sortOrder === "asc" ? "↑" : "↓"}
                </th>

                {[
                  'Name', 'Contact', 'Address', 'Event Type', 'Venue type', 'Time', 'Total', 'Discount',
                  'GST Amt', `Grand Total: ₹${summary.grandTotal.toLocaleString("en-IN")}`, 'Advance Records',
                  `Total Advance: ₹${summary.advanceTotal.toLocaleString("en-IN")}`,
                  `Total Remaining: ₹${summary.remainingTotal.toLocaleString("en-IN")}`,
                  'Services', 'Add Advance', 'Print', 'Update',
                  'Logs', 'Notes', `Avg PayOut % : ${avgPayOutPercent}%`,
                  `To be PayOut: ₹${summary.totalPayOut.toLocaleString("en-IN")}`,
                  'Approval',
                  'PayOut Records',
                  `Total PayOut ₹${filteredBookings.reduce((acc, booking) => {
                    // const sv = normalizeServices(booking.services);
                    const totalPayOut = booking.royalityPayments?.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) || 0;
                    return acc + totalPayOut;
                  }, 0).toLocaleString("en-IN")}`,
                  `Remaining Payout: ₹${filteredBookings.reduce((acc, booking) => {
                    const sv = normalizeServices(booking.services);
                    const totalRoyalty = sv.reduce((sum, srv) => sum + (Number(srv.royaltyAmount) || 0), 0) || 0;
                    const totalPayOut = booking.royalityPayments?.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) || 0;
                    return acc + (totalRoyalty - totalPayOut);
                  }, 0).toLocaleString("en-IN")}`,
                  'Booked on'
                ].map(header => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filteredBookings.map((v, idx) => (
                <BookingRow
                  key={v.id}
                  v={v}
                  idx={idx}
                  filteredCount={filteredBookings.length}
                  convertTo12Hour={convertTo12Hour}
                  formatDateTime={formatDateTime}
                  getAdvanceTotal={getAdvanceTotal}
                  getGrandTotal={getGrandTotal}
                  normalizeServices={normalizeServices}
                  navigate={navigate}
                  getPrintFormat={getPrintFormat}
                  handleAddAmountClick={handleAddAmountClick}
                />
              ))}
            </tbody>
          </table>

          {showPopup && (
            <div className="popup-overlay">
              <div className="popup-box">
                <h3>Add Advance Amount</h3>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  placeholder="Enter amount"
                  onChange={(e) => {
                    let val = e.target.value.replace(/[^0-9.]/g, "");
                    if ((val.match(/\./g) || []).length > 1) val = val.slice(0, -1);
                    setAmount(val);
                  }}
                />
                <div className="popup-actions">
                  <button onClick={handleSaveAmount}>Save</button>
                  <button onClick={() => setShowPopup(false)}>Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function BookingRow({
  v, idx, filteredCount,
  convertTo12Hour, formatDateTime,
  getAdvanceTotal, getGrandTotal, normalizeServices,
  navigate, getPrintFormat, handleAddAmountClick
}) {
  const [showPopupView, setShowPopupView] = useState(false); // ✅ Add here
  const [showRates, setShowRates] = useState(false);

  const printRef = useRef(null); // ✅ per-row ref (legal: inside its own component)
  const iframeRef = useRef(null);

  const handlePrint = () => {
    if (!printRef.current) return;

    // Create a hidden iframe if not exists
    if (!iframeRef.current) {
      const iframe = document.createElement("iframe");
      iframe.style.position = "absolute";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);
      iframeRef.current = iframe;
    }

    const doc = iframeRef.current.contentWindow.document;
    doc.open();
    doc.write("<html><head><title>Print</title></head><body>");
    doc.write(printRef.current.innerHTML);
    doc.write("</body></html>");
    doc.close();

    iframeRef.current.contentWindow.focus();
    iframeRef.current.contentWindow.print();
  };

  const svcs = normalizeServices(v.services);
  const totalRoyalty = svcs.reduce((s, srv) => s + (Number(srv.royaltyAmount) || 0), 0);
  const royaltyPercents = svcs.map(srv => Number(srv.royaltyPercent) || 0).filter(p => p > 0);
  const avgRoyaltyPercent = royaltyPercents.length ? (royaltyPercents.reduce((a, b) => a + b, 0) / royaltyPercents.length).toFixed(2) : 0;
  const advanceTotal = getAdvanceTotal(v);
  const grandTotal = getGrandTotal(v);
  const remaining = grandTotal - advanceTotal;

  const royaltyPayments = v.royalityPayments || [];
  const totalPayOut = royaltyPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const remainingPayout = totalRoyalty - totalPayOut;

  return (
    <tr>
      <td>{filteredCount - idx}</td>
      <td>
        {v.finalDate
          ? (() => {
            const [y, m, d] = v.finalDate.split("-").map(Number);
            return `${String(d).padStart(2, "0")}-${String(m).padStart(2, "0")}-${y}`;
          })()
          : "-"}
      </td>
      <td>{v.customerName}</td>
      <td><a href={`tel:${v.contactNo}`} style={{ color: "black", textDecoration: "none" }}>{v.contactNo}</a></td>
      <td>{v.address}</td>
      <td>{v.eventType}</td>
      <td>{v.venueType}</td>
      <td>{convertTo12Hour(v.startTime)} - {convertTo12Hour(v.endTime)}</td>
      <td>₹{v.summary?.totalPackageCost || 0}</td>
      <td>₹{v.summary?.discount || 0}</td>
      <td>₹{v.summary?.gstAmount || 0}</td>
      <td style={{ backgroundColor: '#d1ff98ff' }}><strong>₹{grandTotal}</strong></td>
      <td>{v.advance?.map((a, i) => <span key={i}>₹{a.amount} ({new Date(a.date).toLocaleDateString()}) - </span>)}</td>
      <td><strong>₹{advanceTotal}</strong></td>
      <td style={{ backgroundColor: '#fdbbb1ff' }}><strong>₹{remaining}</strong></td>

      <td>
        <button
          onClick={() => setShowPopupView(true)}
          style={{
            padding: "5px 10px",
            cursor: "pointer",
            borderRadius: "5px",
            backgroundColor: "#007bff",
            color: "#fff",
            border: "none",
          }}
        >
          View
        </button>

        {showPopupView && (
          <div
            className="modal-overlay"
            onClick={() => setShowPopupView(false)}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1000,
            }}
          >
            <div
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "#fff",
                padding: "20px",
                borderRadius: "8px",
                maxHeight: "80vh",
                overflowY: "auto",
                width: "100vw",
              }}
            >
              <h3>Services</h3>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  marginTop: "10px",
                  fontSize: "14px",
                }}
              >
                <thead>
                  <tr>
                    <th style={{ border: "1px solid #ccc", padding: "6px" }}>#</th>
                    <th style={{ border: "1px solid #ccc", padding: "6px" }}>Service</th>
                    <th style={{ border: "1px solid #ccc", padding: "6px" }}>Remarks</th>
                    <th style={{ border: "1px solid #ccc", padding: "6px" }}>Qty</th>
                    <th style={{ border: "1px solid #ccc", padding: "6px" }}>Rate (₹)</th>
                    <th style={{ border: "1px solid #ccc", padding: "6px" }}>Total (₹)</th>
                    <th style={{ border: "1px solid #ccc", padding: "6px" }}>PayOut %</th>
                    <th style={{ border: "1px solid #ccc", padding: "6px" }}>PayOut Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {svcs.map((srv, i) => (
                    <tr key={i}>
                      <td style={{ border: "1px solid #ccc", padding: "6px", textAlign: "left" }}>{i + 1}</td>
                      <td style={{ border: "1px solid #ccc", padding: "6px" }}>{srv.name}</td>
                      <td style={{ border: "1px solid #ccc", padding: "6px" }}>{srv.remarks || ""}</td>
                      <td style={{ border: "1px solid #ccc", padding: "6px", textAlign: "left" }}>{srv.qty || 0}</td>
                      <td style={{ border: "1px solid #ccc", padding: "6px", textAlign: "left" }}>₹{srv.rate || 0}</td>
                      <td style={{ border: "1px solid #ccc", padding: "6px", textAlign: "left" }}>₹{srv.total || 0}</td>
                      <td style={{ border: "1px solid #ccc", padding: "6px", textAlign: "left" }}>{srv.royaltyPercent || 0}%</td>
                      <td style={{ border: "1px solid #ccc", padding: "6px", textAlign: "left" }}>₹{srv.royaltyAmount || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button
                onClick={() => setShowPopupView(false)}
                style={{
                  marginTop: "10px",
                  padding: "5px 10px",
                  cursor: "pointer",
                  borderRadius: "5px",
                  backgroundColor: "#dc3545",
                  color: "#fff",
                  border: "none",
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </td>

      <td>
        <button style={{ backgroundColor: 'green' }} onClick={() => handleAddAmountClick(v)}>Add Amount</button>
      </td>

      <td style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        cursor: "pointer",
      }}>

        {/* Hidden printable content for THIS row */}
        <div ref={printRef} style={{ display: "none" }}>
          {getPrintFormat(v, showRates)}
        </div>

        {/* ✅ Toggle + Text in one line */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            cursor: "pointer",
          }}
        >
          <div
            onClick={() => setShowRates(!showRates)}
            style={{
              width: "50px",
              height: "24px",
              borderRadius: "20px",
              background: showRates ? "#4caf50" : "#ccc",
              position: "relative",
              cursor: "pointer",
              transition: "background 0.3s",
            }}
          >
            <div
              style={{
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                background: "#fff",
                position: "absolute",
                top: "2px",
                left: showRates ? "26px" : "2px",
                transition: "left 0.3s",
                boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
              }}
            ></div>
          </div>

          {/* ✅ Text change according to toggle */}
          <span style={{ fontWeight: "bold" }}>
            {!showRates && (
              <span style={{ color: "red", textDecoration: "line-through" }}>R&T</span>
            )}
            {showRates && <span style={{ color: "green" }}>R&T</span>}
          </span>
        </label>

        <button
          onClick={handlePrint}
          style={{
            backgroundColor: "#51bc36ff",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
            marginRight: "10px",
          }}
        >
          🖨
        </button>
      </td>

      <td>
        {!v.dropReason && (
          <button
            onClick={() => navigate("/Vendor", { state: { vendorData: v } })}
            style={{ backgroundColor: v.source === 'vendor' ? '#4CAF50' : '#2196F3', color: 'white', padding: '6px 10px', borderRadius: '6px' }}
          >
            {v.source === 'vendor' ? '✏️Update' : '📘 Book'}
          </button>
        )}
        {v.dropReason ? (
          <button
            onClick={async () => {
              try {
                const ref = doc(db, 'vendor', v.id);
                await updateDoc(ref, { dropReason: deleteField(), dropAt: deleteField() });
                alert("✅ Booking restored!");
              } catch (err) {
                console.error(err);
                alert("Failed to restore booking.");
              }
            }}
            style={{ backgroundColor: '#FF9800', color: 'white', padding: '6px 10px', borderRadius: '6px', marginLeft: '5px' }}
          >
            📘 Book Again
          </button>
        ) : (
          <button
            onClick={async () => {
              const reason = prompt("Enter drop reason:");
              if (reason) {
                try {
                  const ref = doc(db, 'vendor', v.id);
                  if (v.source !== 'vendor') {
                    await setDoc(ref, { ...v, source: 'vendor', dropReason: reason, createdAt: serverTimestamp() });
                  } else {
                    await updateDoc(ref, { dropReason: reason, dropAt: serverTimestamp() });
                  }
                  alert("✅ Drop reason saved!");
                } catch (err) {
                  console.error(err);
                  alert("Failed to save drop reason.");
                }
              }
            }}
            style={{ backgroundColor: '#f44336', color: 'white', padding: '6px 10px', borderRadius: '6px', marginLeft: '5px' }}
          >
            ⛔ Drop
          </button>
        )}
      </td>

      <VendorLogPopupCell vendor={v} />

      <td>{v.note || ''}</td>
      <td>{avgRoyaltyPercent > 0 ? `${avgRoyaltyPercent}%` : ''}</td>
      <td>{totalRoyalty > 0 ? `₹${totalRoyalty}` : ''}</td>
      <td>Approval From Admin</td>
      <td>
        {royaltyPayments.map(p => {
          const date = new Date(p.receiptDate);
          const formattedDate = `${date.getDate().toString().padStart(2, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getFullYear()}`;
          return `₹${p.amount} (${formattedDate})`;
        }).join(", ")}
      </td>
      <td>₹{totalPayOut}</td>
      <td>₹{remainingPayout}</td>
      <td>{formatDateTime(new Date(v.bookedOn))}</td>
    </tr>
  );
}

export default VendorTable;
