import React, { useEffect, useState, useRef } from "react";
import { updateDoc, deleteField, doc, setDoc, collection, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import "../../Book/AllLeads/BookingLeadsTable.css";
import { useNavigate } from "react-router-dom";
import BackButton from "../../components/BackButton";

const PastEnquiry = () => {
  const [enquiries, setEnquiries] = useState([]);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("functionDate");
  const [sortAsc, setSortAsc] = useState(false);
  const navigate = useNavigate();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [availableFY, setAvailableFY] = useState([]);
  const [financialYear, setFinancialYear] = useState('');
  const [filteredEnquiries, setFilteredEnquiries] = useState([]);

  useEffect(() => {
    // Reference to the "pastEnquiry" collection
    const pastEnquiryRef = collection(db, "pastEnquiry");

    // Real-time listener
    const unsubscribe = onSnapshot(
      pastEnquiryRef,
      (querySnapshot) => {
        let allEnquiries = [];

        querySnapshot.forEach((docSnap) => {
          const monthData = docSnap.data(); // e.g. { abc123: {...}, xyz456: {...} }

          Object.entries(monthData).forEach(([fieldId, enquiry]) => {
            allEnquiries.push({
              id: fieldId,
              monthYear: docSnap.id, // e.g. "Sep2025"
              ...enquiry,
            });
          });
        });

        // Sort by createdAt descending
        allEnquiries.sort((a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
          return dateB - dateA;
        });

        setEnquiries(allEnquiries);
      },
      (error) => {
        console.error("Error listening to past enquiries:", error);
      }
    );

    // Cleanup on unmount
    return () => unsubscribe();
  }, []);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  useEffect(() => {
    let filtered = [...enquiries];

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase().replace(/\D/g, "");
      filtered = filtered.filter(enq => {
        const dateNormalized = enq.functionDate?.replace(/\D/g, "") || "";
        const dateMatch = dateNormalized.includes(searchLower);

        return (
          enq.name?.toLowerCase().includes(searchLower) ||
          enq.mobile1?.toLowerCase().includes(searchLower) ||
          enq.mobile2?.toLowerCase().includes(searchLower) ||
          enq.functionType?.toLowerCase().includes(searchLower) ||
          dateMatch
        );
      });
    }

    // From Date filter
    if (fromDate) {
      filtered = filtered.filter(enq =>
        enq.functionDate && new Date(enq.functionDate) >= new Date(fromDate)
      );
    }

    // To Date filter
    if (toDate) {
      filtered = filtered.filter(enq =>
        enq.functionDate && new Date(enq.functionDate) <= new Date(toDate)
      );
    }

    // Financial Year filter
    if (financialYear && financialYear !== "") {
      const [startYear, endYear] = financialYear.split("-").map(Number);
      const fyStart = new Date(Date.UTC(startYear, 3, 1)); // 1 April
      const fyEnd = new Date(Date.UTC(endYear, 2, 31, 23, 59, 59)); // 31 Mar
      filtered = filtered.filter(enq => {
        const date = new Date(enq.functionDate);
        return date >= fyStart && date <= fyEnd;
      });
    }

    setFilteredEnquiries(filtered);
  }, [search, fromDate, toDate, financialYear, enquiries]);

  const sortedEnquiries = [...filteredEnquiries].sort((a, b) => {
    if (!a[sortField]) return 1;
    if (!b[sortField]) return -1;
    const dateA = new Date(a[sortField]);
    const dateB = new Date(b[sortField]);
    return sortAsc ? dateA - dateB : dateB - dateA;
  });

  const handleShareMedia = async (enquiry) => {
    if (!enquiry.mobile1) {
      alert("No mobile number available to share the link.");
      return;
    }

    const message = `Hello ${enquiry.name}, check out our gallery: https://shangrilapalace.com/`;

    let phone = enquiry.mobile1.trim().replace(/\D/g, "");
    if (!phone.startsWith("91")) {
      phone = phone.length === 10 ? "91" + phone : "91" + phone;
    }

    // 🔹 Open WhatsApp
    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");

    try {
      // 🔹 Determine month doc
      const enquiryDateObj = new Date(enquiry.enquiryDate);
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthYear = `${monthNames[enquiryDateObj.getMonth()]}${enquiryDateObj.getFullYear()}`;
      const monthDocRef = doc(db, "enquiry", monthYear);

      // 🔹 Update shareMedia to true
      await setDoc(
        monthDocRef,
        {
          [enquiry.fieldId]: {
            ...enquiry,
            shareMedia: true,
            updatedAt: serverTimestamp(),
          }
        },
        { merge: true }
      );

      console.log("✅ shareMedia updated to true!");
    } catch (error) {
      console.error("❌ Failed to update shareMedia:", error);
    }
  };
  const rightRef = useRef(null);

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const [year, month, day] = dateStr.split('-');
    return `${day}-${month}-${year}`; // DD-MM-YYYY
  };

  useEffect(() => {
    if (enquiries.length > 0) {
      const fyList = enquiries.map(l => {
        const d = new Date(l.functionDate);
        const y = d.getFullYear();
        const m = d.getMonth();
        return m >= 3 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
      });

      const currentFY = getCurrentFinancialYear();
      const uniqueFY = [...new Set([...fyList, currentFY])].sort();
      setAvailableFY(uniqueFY);
    }
  }, [enquiries]);

  const getCurrentFinancialYear = () => {
    const today = new Date();
    const year = today.getUTCFullYear();
    const month = today.getUTCMonth() + 1;
    if (month >= 4) {
      return `${year}-${year + 1}`;
    } else {
      return `${year - 1}-${year}`;
    }
  };

  useEffect(() => {
    let filtered = [...enquiries]; // was leads

    // From Date filter
    if (fromDate) {
      filtered = filtered.filter(lead =>
        lead.functionDate && new Date(lead.functionDate) >= new Date(fromDate)
      );
    }

    // To Date filter
    if (toDate) {
      filtered = filtered.filter(lead =>
        lead.functionDate && new Date(lead.functionDate) <= new Date(toDate)
      );
    }

    // Financial Year filter
    if (financialYear && financialYear !== "") {
      const [startYear, endYear] = financialYear.split("-").map(Number);
      const fyStart = new Date(Date.UTC(startYear, 3, 1));
      const fyEnd = new Date(Date.UTC(endYear, 2, 31, 23, 59, 59));

      filtered = filtered.filter(lead => {
        const date = new Date(lead.functionDate);
        return date >= fyStart && date <= fyEnd;
      });
    }

    setFilteredEnquiries(filtered); // was setFilteredLeads
  }, [fromDate, toDate, financialYear, enquiries]);

  useEffect(() => {
    if (availableFY.length > 0 && financialYear === null) {
      setFinancialYear(getCurrentFinancialYear());
    }
  }, [availableFY, financialYear]);

  const moveLeadTounDrop = (leadId, removeOriginal = false, reason = '', monthYear) => {
    try {
      const monthRef = doc(db, "pastEnquiry", monthYear);

      // Real-time listener on the pastEnquiry document
      const unsubscribe = onSnapshot(monthRef, async (monthSnap) => {
        if (!monthSnap.exists()) return;

        const monthData = monthSnap.data();
        const leadData = monthData[leadId];
        if (!leadData) return;

        // Determine monthYear for the target 'enquiry' collection
        const enquiryDateObj = new Date(leadData.enquiryDate);
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const targetMonthYear = `${monthNames[enquiryDateObj.getMonth()]}${enquiryDateObj.getFullYear()}`;
        const targetRef = doc(db, "enquiry", targetMonthYear);

        // Move lead to 'enquiry'
        await setDoc(
          targetRef,
          {
            [leadId]: {
              ...leadData,
              droppedAt: new Date(),
              dropReason: reason || "No reason provided"
            }
          },
          { merge: true }
        );

        // Optionally remove original from pastEnquiry
        if (removeOriginal) {
          await updateDoc(monthRef, { [leadId]: deleteField() });
        }

        // Unsubscribe after moving to avoid repeated triggers
        unsubscribe();
      });

    } catch (error) {
      console.error("Error moving lead to enquiry:", error);
    }
  };

  const handleDropClick = async (lead) => {
    const reason = window.prompt("Enter drop reason for this lead:");
    if (!reason) return;

    if (!lead.enquiryDate) {
      alert("Lead has no enquiryDate!");
      return;
    }

    const date = new Date(lead.enquiryDate);
    if (isNaN(date)) {
      alert("Invalid enquiryDate!");
      return;
    }

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthYear = `${monthNames[date.getMonth()]}${date.getFullYear()}`;

    await moveLeadTounDrop(lead.id, true, reason, monthYear);
  };

  return (
    <div className="leads-table-container">
      <div style={{ marginBottom: '30px' }}> <BackButton />  </div>

      <h2 className="leads-header">Dropped Enquiries</h2>

      <input type="text"
        placeholder="Search by name, mobile, function type, date..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="booking-input"
        style={{
          width: "100%",
          marginBottom: "15px",
          padding: "8px",
          border: "1px solid #57a2d9",
          borderRadius: "6px",
        }}
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '10px 0' }}>
        <button
          onClick={() => navigate('/enquiryForm')}
          style={{
            padding: '10px 20px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
        >
          Create New Enquiry
        </button>
      </div>

      <div className="filters-container">
        <div className="date-filters">
          <div className="filter-item">
            <label>From:</label>
            <input className="filterInput" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>

          <div className="filter-item">
            <label>To:</label>
            <input className="filterInput" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>


          <div className="filter-item">
            <label>FY Year:</label>
            <select className="filterInput" value={financialYear} onChange={(e) => setFinancialYear(e.target.value)}>
              <option value="">All</option>
              {availableFY.map(fy => <option key={fy} value={fy}>{fy}</option>)}
            </select>
          </div>

          <button
            className="clear-btnq"
            onClick={() => {
              setFromDate('');
              setToDate('');
              setFinancialYear('');
              setFilteredEnquiries(enquiries);
            }}
          >
            Clear
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '2px' }}>

        {/* Left Table */}
        <div
          style={{ flex: '0 0 80px', overflowY: 'auto' }}
          className="table-scroll-container"
        >
          <table className="leads-table">
            <thead>
              <tr style={{ whiteSpace: "nowrap" }}>
                <th onClick={() => handleSort("functionDate")} style={{ cursor: "pointer", padding: '0px' }}>
                  Event Date {sortField === "functionDate" ? (sortAsc ? "" : "") : ""}
                </th>
                <th>Name</th>
                <th></th>
              </tr>
            </thead>
            <tbody style={{ whiteSpace: "nowrap" }}>
              {sortedEnquiries.length > 0 ? (
                sortedEnquiries.map((enq) => (
                  <tr key={enq.id}>
                    <td style={{ padding: '0px' }}>{formatDate(enq.functionDate)}</td>
                    <td>{enq.name}</td>

                    <td>
                      <button
                        className="booking-btn"
                        onClick={() => navigate("/EnquiryForm", { state: enq })}
                        style={{ color: 'transparent', backgroundColor: 'transparent' }}
                      >
                        Edit
                      </button>
                    </td>

                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" style={{ textAlign: "center" }}>
                    No enquiries found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Right Table */}
        <div
          ref={rightRef}   // ✅ sirf yaha rakha
          style={{ flex: 1, overflowX: "auto", overflowY: "auto" }}
          className="table-scroll-container"
        >
          <table className="leads-table">
            <thead>
              <tr style={{ whiteSpace: "nowrap" }}>
                <th>Sl.</th>
                <th>Name</th>
                <th>Booked On</th>
                <th>Mobile</th>
                <th>Email</th>
                <th>Pax</th>
                <th>Function Type</th>
                <th>Day/Night</th>
                <th>Share Media</th>
                <th>Actions</th>
                <th>ReSotre</th>
              </tr>
            </thead>
            <tbody style={{ whiteSpace: "nowrap" }}>
              {sortedEnquiries.length > 0 ? (
                sortedEnquiries.map((enq, index) => (
                  <tr key={enq.id}>
                    <td style={{ fontWeight: 'bold' }}>{sortedEnquiries.length - index}.</td>
                    <td>{enq.name}</td>
                    <td>{formatDate(enq.enquiryDate)}</td>
                    <td style={{ fontWeight: '700' }}>
                      {enq.mobile1 ? (
                        <a href={`tel:${enq.mobile1}`} style={{ color: 'black', textDecoration: 'none' }}>
                          {enq.mobile1}
                        </a>
                      ) : " "} {`, `}
                      <span style={{ marginTop: '5px' }}>
                        {enq.mobile2 ? (
                          <a href={`tel:${enq.mobile2}`} style={{ color: 'black', textDecoration: 'none' }}>
                            {enq.mobile2}
                          </a>
                        ) : " "}
                      </span>
                    </td>
                    <td>{enq.email}</td>
                    <td>{enq.pax}</td>
                    <td>{enq.functionType}</td>
                    <td>{enq.dayNight}</td>
                    <td style={{ color: enq.shareMedia ? "green" : "red" }}>
                      {enq.shareMedia ? "Shared" : "Not Shared"}
                    </td>
                    <td>
                      <button
                        className="booking-btn"
                        onClick={() => navigate("/EnquiryForm", { state: enq })}
                      >
                        Edit
                      </button>
                      <button
                        className="booking-btn"
                        style={{ backgroundColor: "#4CAF50", marginLeft: "5px", color: "white" }}
                        onClick={() => {
                          // 👉 only navigate, do not delete yet
                          navigate("/BookingLead", { state: { enquiry: enq } });
                        }}
                      >
                        Convert to Lead
                      </button>

                      <button
                        className="booking-btn"
                        style={{ backgroundColor: "#FF9800", marginLeft: "5px", color: "white" }}
                        onClick={() => {
                          // 👉 only navigate, do not delete yet
                          navigate("/booking", { state: { enquiry: enq, sourceDoc: enq.monthYear } });
                        }}
                      >
                        Send to Bookings
                      </button>
                      <button
                        className="booking-btn"
                        style={{ backgroundColor: "#2196F3", marginLeft: "5px", color: "white" }}
                        onClick={() => handleShareMedia(enq)}
                      >
                        Share Media
                      </button>
                    </td>

                    <td>
                      <button
                        style={{
                          backgroundColor: "#fb4747ff",
                          color: "white",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          cursor: "pointer",
                          border: '2px solid white',
                          boxShadow: '2px 2px 4px #030303ff'
                        }}
                        onClick={() => handleDropClick(enq)}
                      >
                        ReSotre
                      </button>
                    </td>

                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" style={{ textAlign: "center" }}>
                    No enquiries found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Left Scroll Button */}
        <button
          onClick={() => rightRef.current?.scrollBy({ left: -300, behavior: "smooth" })}
          style={{
            position: "fixed",
            left: "10px",
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 999,
            background: "rgba(255, 255, 255, 0.33)",
            border: "1px solid #ccc",
            borderRadius: "50%",
            width: "40px",
            height: "40px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
            cursor: "pointer",
            color: "black",
          }}
        >
          ◀
        </button>

        {/* Right Scroll Button */}
        <button
          onClick={() => rightRef.current?.scrollBy({ left: 300, behavior: "smooth" })}
          style={{
            position: "fixed",
            right: "10px",
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 999,
            background: "rgba(255, 255, 255, 0.33)",
            border: "1px solid #ccc",
            borderRadius: "50%",
            width: "40px",
            height: "40px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
            cursor: "pointer",
            color: "black",
          }}
        >
          ▶
        </button>

      </div>

    </div>
  );

};

export default PastEnquiry;
