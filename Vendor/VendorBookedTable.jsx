import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { getDoc, collection, getDocs, doc, updateDoc, arrayUnion, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import '../styles/VendorTable.css';
import BackButton from "../components/BackButton";
import { useNavigate } from 'react-router-dom';
import VendorLogPopupCell from './VendorLogPopupCell.jsx';
import { query, where } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import BottomNavigationBar from "../components/BottomNavigationBar";

const toIST = (date) => {
  if (!date) return null;
  const d = new Date(date);
  return new Date(d.getTime() + 5.5 * 60 * 60 * 1000); // +5.5 hours
};

const formatDate = (date) => {
  const d = toIST(date);
  if (!d) return "-";
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}-${month}-${year}`;
};

const formatDateTime = (date) => {
  const d = toIST(date);
  if (!d) return "-";
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();

  let hours = d.getUTCHours();
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;

  return `${day}-${month}-${year}, ${hours}:${minutes} ${ampm}`;
};

const convertTo12HourIST = (timeStr) => {
  if (!timeStr) return "-";
  const [hours, minutes] = timeStr.split(":").map(Number);
  const date = new Date();
  date.setUTCHours(hours, minutes);
  const istDate = toIST(date);
  let hrs = istDate.getUTCHours();
  const mins = String(istDate.getUTCMinutes()).padStart(2, "0");
  const ampm = hrs >= 12 ? "PM" : "AM";
  hrs = hrs % 12 || 12;
  return `${hrs}:${mins} ${ampm}`;
};

const VendorTable = () => {
  const [allBookings, setAllBookings] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [amount, setAmount] = useState("");
  const [showPopup, setShowPopup] = useState(false);
  const [sortOrder, setSortOrder] = useState("desc");
  const [vendorProfile, setVendorProfile] = useState(null);
  const navigate = useNavigate();
  const [userAppType, setUserAppType] = useState(null);
  const [currentUserEmail, setCurrentUserEmail] = useState(null);

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
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) return; // No user logged in

    const vendorCollection = collection(db, "vendor");
    const unsubscribe = onSnapshot(
      vendorCollection,
      async (snapshot) => {
        try {
          // ✅ Get user access info from usersAccess collection
          const q = query(collection(db, "usersAccess"), where("email", "==", currentUser.email));
          const userSnap = await getDocs(q);
          const userData = userSnap.empty ? {} : userSnap.docs[0].data();
          const hasFullAccess = userData.accessToApp === "A" || userData.accessToApp === "B";

          const merged = [];
          const seenKeys = new Set();
          let serialCounter = 1;

          const makeKey = (name, contact, eventType, date) =>
            `${(name || "").toLowerCase()}|${(contact || "").replace(/\s+/g, "")}|${(eventType || "").toLowerCase()}|${date ? new Date(date).toISOString().split("T")[0] : ""}`;

          snapshot.docs.forEach((monthDoc) => {
            const monthData = monthDoc.data();
            Object.entries(monthData).forEach(([bookingId, booking]) => {
              // ✅ Filter based on userEmail unless full access
              if (!hasFullAccess && booking.userEmail !== currentUser.email) return;

              const key = makeKey(
                booking.customerName,
                booking.contactNo,
                booking.eventType || booking.typeOfEvent,
                booking.date
              );
              if (!seenKeys.has(key)) {
                seenKeys.add(key);
                merged.push({
                  id: bookingId,
                  slNo: serialCounter++, // sequential
                  source: "vendor",
                  ...booking,
                  finalDate: booking.date,
                  monthYear: monthDoc.id,
                });
              }
            });
          });

          // Sort by date
          merged.sort((a, b) => {
            const dateA = a.finalDate ? new Date(a.finalDate) : new Date(0);
            const dateB = b.finalDate ? new Date(b.finalDate) : new Date(0);
            return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
          });

          setAllBookings(merged);
        } catch (err) {
          console.error("❌ Error processing data:", err);
        }
      },
      (error) => {
        console.error("❌ Error fetching real-time data:", error);
      }
    );

    return () => unsubscribe();
  }, [sortOrder]);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        setCurrentUserEmail(user.email); // ✅ store email
        try {
          const q = query(
            collection(db, "usersAccess"),
            where("email", "==", user.email)
          );
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            const userData = snapshot.docs[0].data();
            setVendorProfile(userData); // ✅ store vendor profile info
            console.log("✅ Vendor profile loaded:", userData);
          } else {
            console.warn("❌ No vendor record found for this user.");
          }
        } catch (error) {
          console.error("🔥 Error fetching vendor profile:", error);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const convertTo12Hour = (timeStr) => {
    if (!timeStr) return "-";
    const [hours, minutes] = timeStr.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${String(minutes).padStart(2, '0')} ${ampm}`;
  };

  const parseMoney = (val) => {
    if (val === undefined || val === null || val === '') return 0;
    const n = typeof val === 'string' ? Number(val.replace(/,/g, '')) : Number(val);
    return Number.isNaN(n) ? 0 : n;
  };

  const getGrandTotal = (v) => parseMoney(v?.summary?.grandTotal);
  const getAdvanceTotal = (v) => Array.isArray(v?.advance) ? v.advance.reduce((s, a) => s + parseMoney(a?.amount), 0) : 0;

  const handleAddAmountClick = (vendor) => {
    setSelectedVendor(vendor);
    setShowPopup(true);
  };

  const handleSaveAmount = async () => {
    if (!selectedVendor || !amount) return;

    if (!selectedVendor.monthYear || !selectedVendor.id) {
      console.error("Selected vendor missing monthYear or id:", selectedVendor);
      alert("Cannot add amount: vendor data incomplete.");
      return;
    }

    try {
      const monthDocRef = doc(db, "vendor", selectedVendor.monthYear);

      await updateDoc(monthDocRef, {
        [`${selectedVendor.id}.advance`]: arrayUnion({
          amount: Number(amount),
          date: new Date().toISOString(),
        }),
      });

      // alert("Amount added successfully ✅");
      setAmount("");
      setShowPopup(false);
    } catch (error) {
      console.error("❌ Error updating vendor:", error);
      alert("❌ Failed to add amount.");
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
    const firm = vendorProfile?.firmName || "Vendor Firm Name";
    const address = vendorProfile?.address || "Vendor Address";
    const contact = vendorProfile?.contactNo || "Contact Number";
    const email = vendorProfile?.email || "Email";
    const termsText = vendorProfile?.termsAndConditions || "";

    const termsList = (() => {
      if (!termsText) return [];
      return termsText
        .split(/\d+\.\s*/g)
        .map(line => line.trim())
        .filter(line => line.length > 0);
    })();

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
        <h2 style={{ textAlign: "center", margin: 0, fontWeight: "bold", fontSize: "30px", wordSpacing: '5px' }}>
          {firm || "Vendor Firm Name"}
        </h2>
        <p style={{ textAlign: "center", fontSize: "15px", margin: "2px 0 10px 0" }}>
          <span style={{ fontWeight: "bold" }}> {address || "Vendor Address"} <br />
            Mob: {contact || "Contact Number"} | Email: {email || "Email"} </span>
        </p>

        {/* CUSTOMER DETAILS */}
        <div style={{ marginTop: "10px", fontSize: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", alignItems: 'center', marginTop: '15px' }}>
            <span>
              No:{" "}
              <span style={{ display: "inline-block", minWidth: "100px", color: 'black' }}>
                {v.slNo || ""}
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
          {/* ✅ Show only if GST > 0 */}
          {parseFloat(v?.summary?.gstAmount) > 0 && (
            <p>
              GST 18%:{" "}
              {Number(v.summary.gstAmount).toLocaleString("en-IN")}
            </p>
          )}

          {/* ✅ Show only if Grand Total > 0 */}
          {parseFloat(v?.summary?.grandTotal) > 0 && (
            <p>
              Grand Total:{" "}
              {Number(v.summary.grandTotal).toLocaleString("en-IN")}
            </p>
          )}
        </div>


        {/* TERMS */}
        {termsList.length > 0 && (
          <>
            <h4
              style={{
                marginTop: "20px",
                fontSize: "18px",
                textDecoration: "underline",
                marginBottom: 0,
              }}
            >
              Terms & Conditions:
            </h4>
            <ol
              style={{
                fontSize: "12px",
                paddingLeft: "20px",
                marginTop: 0,
              }}
            >
              {termsList.map((line, index) => (
                <li key={index}>{line}</li>
              ))}
            </ol>
          </>
        )}

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
    <>
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
                    'GST Amt', `Grand Total: ₹${summary.grandTotal.toLocaleString("en-IN")}`,
                  ].map(header => (
                    <th key={header}>{header}</th>
                  ))}


                  {(summary.userEmail === currentUserEmail) && (
                    <th>Advance Records</th>
                  )}

                  {[`Total Advance: ₹${summary.advanceTotal.toLocaleString("en-IN")}`,
                  `Total Remaining: ₹${summary.remainingTotal.toLocaleString("en-IN")}`,
                    'Services'
                  ].map(header => (
                    <th key={header}>{header}</th>
                  ))}

                  {(summary.userEmail === currentUserEmail) && (
                    <th>Add Advance</th>,
                    <th>Update</th>,
                    <th>Print</th>
                  )}

                  {[
                    'Logs', 'Notes', `Avg PayOut % : ${avgPayOutPercent}%`,
                    `To be PayOut: ₹${summary.totalPayOut.toLocaleString("en-IN")}`,
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
                    'Booked By'
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

      <div style={{ marginBottom: "50px" }}></div>
      <BottomNavigationBar navigate={navigate} userAppType={userAppType} />
    </>
  );
};

function BookingRow({ v, idx, filteredCount, getAdvanceTotal, getGrandTotal, normalizeServices, navigate, getPrintFormat, handleAddAmountClick }) {
  const [showPopupView, setShowPopupView] = useState(false);
  const [showRates, setShowRates] = useState(false);
  const [vendorProfile, setVendorProfile] = useState(null);
  const [appUserName, setAppUserName] = useState("App User");
  const [currentUserEmail, setCurrentUserEmail] = useState(null);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        try {
          const q = query(
            collection(db, "usersAccess"),
            where("email", "==", user.email)
          );
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            const userData = snapshot.docs[0].data();
            setAppUserName(userData.name || user.email || "App User");
            console.log("✅ App user name loaded:", userData.name);
          } else {
            setAppUserName(user.email); // fallback to email if not found
            console.warn("❌ No user record found for this email");
          }
        } catch (err) {
          console.error("🔥 Error fetching app user name:", err);
          setAppUserName(user.email);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        setCurrentUserEmail(user.email); // ✅ store email
        try {
          const q = query(collection(db, "usersAccess"), where("email", "==", user.email));
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            const userData = snapshot.docs[0].data();
            setVendorProfile(userData);
            console.log("✅ Vendor profile loaded:", userData);
          } else {
            console.warn("❌ No vendor record found for this user.");
          }
        } catch (error) {
          console.error("🔥 Error fetching vendor profile:", error);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const printRef = useRef(null);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        try {
          const q = query(collection(db, "usersAccess"), where("email", "==", user.email));
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            setVendorProfile(snapshot.docs[0].data());
          } else {
            console.warn("No vendor record found for this user.");
          }
        } catch (error) {
          console.error("Error fetching vendor profile:", error);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const allAdvances = (v.advance || []).map((adv, index) => ({
    ...adv,
    customerName: v.customerName,
    contactNo: v.contactNo,
    eventType: v.typeOfEvent,
    bookedOn: v.bookedOn,
    slNo: index + 1,
  }));

  const svcs = normalizeServices(v.services || []);
  const totalRoyalty = svcs.reduce((s, srv) => s + (Number(srv.royaltyAmount) || 0), 0);
  const royaltyPercents = svcs.map(srv => Number(srv.royaltyPercent) || 0).filter(p => p > 0);
  const avgRoyaltyPercent = royaltyPercents.length ? (royaltyPercents.reduce((a, b) => a + b, 0) / royaltyPercents.length).toFixed(2) : 0;
  const advanceTotal = getAdvanceTotal(v);
  const grandTotal = getGrandTotal(v);
  const remaining = grandTotal - advanceTotal;

  const royaltyPayments = v.royalityPayments || [];
  const totalPayOut = royaltyPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const remainingPayout = totalRoyalty - totalPayOut;

  const handlePrintPayment = useCallback((receipt, adv) => {
    const firm = vendorProfile?.firmName || "Vendor Firm Name";
    const address = vendorProfile?.address || "Vendor Address";
    const contact = vendorProfile?.contactNo || "Contact Number";
    const email = vendorProfile?.email || "Email";

    const content = `
      <html>
      <head>
        <title>Receipt - #${adv.slNo}</title>
        <style>
          body { font-family: 'Calibri', sans-serif; color: #3c0000; font-size: 20px; padding: 30px 40px; }
          .main-title { text-align: center; font-size: 38px; font-weight: bold; margin-top: 5px; color: maroon; }
          .sub-header { text-align: center; font-size: 15px; margin: 1px 0; }
          .line-group { display: flex; justify-content: space-between; margin-top: 20px; }
          .section { margin: 10px 0; display: flex; gap: 8px; }
          .underline { flex-grow: 1; border-bottom: 1px dotted #000; min-width: 150px; }
          .short-underline { display: inline-block; border-bottom: 1px dotted #000; min-width: 100px; }
          .rs-combo { display: flex; align-items: center; margin-top: 30px; }
          .circle-rs { width: 60px; height: 60px; border-radius: 50%; background-color: transparent; color: #3c0000; font-size: 30px; font-weight: bold; display: flex; align-items: center; justify-content: center; }
          .amount-box { border: 1px solid maroon; padding: 6px 14px; font-weight: bold; min-width: 100px; font-size: 30px; }
          .signature { font-weight: bold; font-size: 18px; text-align: right; margin-top: 40px; }
          .italic { font-style: italic; }
          .payment-row { display: flex; justify-content: space-between; align-items: center; margin-top: 0px; }
        </style>
      </head>
      <body>
        <div style="border: 1px solid maroon; padding: 1px">
          <div style="border: 1px solid maroon; padding: 30px">
            <div class="main-title">${firm}</div>
            <div class="sub-header">${address}</div>
            <div class="sub-header">Mob: ${contact} | Email: ${email}</div>
            <div class="line-group">
              <div>No.<span>${adv.slNo}</span></div>
              <div>Date: <span class="short-underline">${formatDate(adv.date)}</span></div>
            </div>
            <div class="section italic">Received with thanks from: <div class="underline">${adv.customerName}</div></div>
            <div class="section italic"><span>Mob.:</span><div class="underline">${adv.contactNo || '-'}</div></div>
            <div class="section italic">
              for event of: <div class="underline">${adv.eventType || '-'}</div>
              <span style="margin-left:auto;">Event Date: <span class="short-underline">${formatDate(adv.date)}</span></span>
            </div>
            <div class="payment-row">
              <div class="rs-combo">
                <div class="circle-rs">₹</div>
                <div class="amount-box">${adv.amount}/-</div>
              </div>
         
              <div class="signature">
  Issued By: 
  <span style="display:flex; flex-direction:column; align-items:flex-start;">
    <!-- App user name on top -->
    <span style="font-weight:bold; font-size:14px; margin-bottom:2px;">${appUserName}</span>
    <!-- Underline for issued by -->
    <span class="short-underline">${receipt.receiverd || receipt.senderd || ''}</span>
  </span>
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

    iframe.onload = () => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    };
  }, [vendorProfile, appUserName]);

  return (
    <tr>
      <td>{filteredCount - idx}</td>
      <td>{v.finalDate ? (() => {
        const [y, m, d] = v.finalDate.split("-").map(Number);
        return `${String(d).padStart(2, "0")}-${String(m).padStart(2, "0")}-${y}`;
      })() : "-"}</td>
      <td>{v.customerName}</td>
      <td><a href={`tel:${v.contactNo}`} style={{ color: "black", textDecoration: "none" }}>{v.contactNo}</a></td>
      <td>{v.address}</td>
      <td>{v.eventType}</td>
      <td>{v.venueType}</td>
      <td>{convertTo12HourIST(v.startTime)} - {convertTo12HourIST(v.endTime)}</td>
      <td>₹{v.summary?.totalPackageCost || 0}</td>
      <td>₹{v.summary?.discount || 0}</td>
      <td>₹{v.summary?.gstAmount || 0}</td>
      <td style={{ backgroundColor: '#1ce202ff' }}><strong>₹{grandTotal}</strong></td>

      {(v.userEmail === currentUserEmail) && (
        <td >
          <div style={{ display: 'flex' }}>
            {allAdvances.map((a, i) => (
              <span
                key={i}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '7px 10px',
                  margin: '0px 5px',
                  borderRadius: '7px',
                  boxShadow: `
                  2px 2px 5px rgba(158, 156, 156, 0.4),
                  inset -2px -2px 5px rgba(119, 119, 119, 0.6)
                `,
                  fontWeight: 'bold',
                  transition: 'all 0.2s ease-in-out',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = `
                  4px 4px 8px rgba(0,0,0,0.5),
                  inset -2px -2px 5px rgba(202, 202, 202, 0.6)
                `;
                  e.currentTarget.style.backgroundColor = '#e4e4e4ff';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = `
                  2px 2px 5px rgba(158, 156, 156, 0.4),
                  inset -2px -2px 5px rgba(119, 119, 119, 0.6),
                  `;
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <span>₹{a.amount} ({formatDate(a.date)})</span>

                <button
                  onClick={() => handlePrintPayment(v, a)}
                  style={{
                    marginLeft: '10px',
                    background: '#b52e2e',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '12px',
                    padding: '2px 12px',
                    boxShadow: '1px 1px 3px rgba(0,0,0,0.3)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  Print
                </button>
              </span>

            ))}
          </div>
        </td>
      )}

      <td><strong>₹{advanceTotal}</strong></td>
      <td style={{ backgroundColor: '#f80000c1' }}><strong>₹{remaining}</strong></td>

      <td>
        <button onClick={() => setShowPopupView(true)} style={{ padding: "5px 10px", cursor: "pointer", borderRadius: "5px", backgroundColor: "#007bff", color: "#fff", border: "none" }}>View</button>

        {showPopupView && (
          <div onClick={() => setShowPopupView(false)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: "20px", borderRadius: "8px", maxHeight: "80vh", overflowY: "auto", width: "100vw" }}>
              <h3>Services</h3>
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "10px", fontSize: "14px" }}>
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
                      <td style={{ border: "1px solid #ccc", padding: "6px" }}>{i + 1}</td>
                      <td style={{ border: "1px solid #ccc", padding: "6px" }}>{srv.name}</td>
                      <td style={{ border: "1px solid #ccc", padding: "6px" }}>{srv.remarks || ""}</td>
                      <td style={{ border: "1px solid #ccc", padding: "6px" }}>{srv.qty || 0}</td>
                      <td style={{ border: "1px solid #ccc", padding: "6px" }}>₹{srv.rate || 0}</td>
                      <td style={{ border: "1px solid #ccc", padding: "6px" }}>₹{srv.total || 0}</td>
                      <td style={{ border: "1px solid #ccc", padding: "6px" }}>{srv.royaltyPercent || 0}%</td>
                      <td style={{ border: "1px solid #ccc", padding: "6px" }}>₹{srv.royaltyAmount || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={() => setShowPopupView(false)} style={{ marginTop: "10px", padding: "5px 10px", cursor: "pointer", borderRadius: "5px", backgroundColor: "#dc3545", color: "#fff", border: "none" }}>Close</button>
            </div>
          </div>
        )}
      </td>

      {(v.userEmail === currentUserEmail) && (
        <td><button style={{ backgroundColor: 'green' }} onClick={() => handleAddAmountClick(v)}>Add Amount</button></td>
      )}

      {(v.userEmail === currentUserEmail) && (
        <td style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", padding: "11px 8px" }}>
          <div ref={printRef} style={{ display: "none" }}>{getPrintFormat(v, showRates)}</div>

          <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
            <div onClick={() => setShowRates(!showRates)} style={{ width: "50px", height: "24px", borderRadius: "20px", background: showRates ? "#4caf50" : "#ccc", position: "relative", cursor: "pointer", transition: "background 0.3s" }}>
              <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "#fff", position: "absolute", top: "2px", left: showRates ? "26px" : "2px", transition: "left 0.3s", boxShadow: "0 2px 5px rgba(0,0,0,0.2)" }}></div>
            </div>
            <span style={{ fontWeight: "bold" }}>{!showRates ? <span style={{ color: "red", textDecoration: "line-through" }}>R&T</span> : <span style={{ color: "green" }}>R&T</span>}</span>
          </label>

          <button onClick={() => {
            if (!printRef.current) return;
            const iframe = document.createElement("iframe");
            iframe.style.display = "none";
            document.body.appendChild(iframe);
            const doc = iframe.contentWindow.document;
            doc.open();
            doc.write(printRef.current.innerHTML);
            doc.close();
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
          }} style={{ backgroundColor: "#51bc36ff", color: "white", border: "none", borderRadius: "5px", cursor: "pointer", marginRight: "10px" }}>🖨</button>
        </td>
      )}

      {(v.userEmail === currentUserEmail) && (
        <td>
          {!v.dropReason && <button onClick={() => navigate("/Vendor", { state: { vendorData: v } })} style={{ backgroundColor: v.source === 'vendor' ? '#4CAF50' : '#2196F3', color: 'white', padding: '6px 10px', borderRadius: '6px' }}>{v.source === 'vendor' ? '✏️Update' : '📘 Book'}</button>}

          {v.dropReason ? (
            <span style={{ color: 'red', fontWeight: 'bold' }}>Dropped: {v.dropReason}</span>
          ) : (
            <button
              style={{ backgroundColor: '#f44336', color: 'white', padding: '6px 10px', borderRadius: '6px', marginLeft: '5px' }}
              onClick={async () => {
                const reason = prompt("Enter drop reason:");
                if (!reason) return;

                try {
                  const monthDocRef = doc(db, "vendor", v.monthYear);
                  await updateDoc(monthDocRef, {
                    [`${v.id}.dropReason`]: reason
                  });
                  // alert("Vendor marked as dropped ✅");
                } catch (err) {
                  console.error("❌ Error saving drop reason:", err);
                  alert("Failed to mark vendor as dropped ❌");
                }
              }}
            >
              ⛔ Drop
            </button>
          )}
        </td>
      )}

      <VendorLogPopupCell vendor={v} />

      <td>{v.note || ''}</td>
      <td>{avgRoyaltyPercent > 0 ? `${avgRoyaltyPercent}%` : ''}</td>
      <td>{totalRoyalty > 0 ? `₹${totalRoyalty}` : ''}</td>
      <td>{royaltyPayments.map(p => {
        const date = new Date(p.receiptDate);
        const formattedDate = `${date.getDate().toString().padStart(2, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getFullYear()}`;
        return `₹${p.amount} (${formattedDate})`;
      }).join(", ")}</td>
      <td>₹{totalPayOut}</td>
      <td>₹{remainingPayout}</td>
      <td>
        <div>
          {v.userEmail}
        </div>
        {formatDate(new Date(v.bookedOn))}
      </td>
    </tr>
  );
}

export default VendorTable;