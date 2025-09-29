import React, { useEffect, useState } from "react";
import { getDocs, collection } from "firebase/firestore";
import { db } from "../firebaseConfig";

const AllBookingDatesPopup = ({ isOpen, onClose }) => {
  const [mergedDates, setMergedDates] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  useEffect(() => {
    const fetchDates = async () => {
      let allDatesMap = {};

      const addToMap = (dateStr, type, extra = {}) => {
        if (!dateStr) return;
        const formatted = formatDate(dateStr);
        if (!allDatesMap[formatted]) {
          allDatesMap[formatted] = {
            enquiry: null,
            hold: null,
            bookingHold: null,
            booked: null,
          };
        }
        allDatesMap[formatted][type] = { ...extra, rawDate: dateStr };
      };

      // -------- prebookings ----------
      const preSnap = await getDocs(collection(db, "prebookings"));
      preSnap.forEach((doc) => {
        const fields = doc.data();
        Object.values(fields).forEach((item) => {
          if (item.functionDate) {
            addToMap(item.functionDate, "booked", {
              venueType: item.venueType || "",
            });
          }
        });
      });

      // -------- bookingLeads ----------
      const leadsSnap = await getDocs(collection(db, "bookingLeads"));
      leadsSnap.forEach((doc) => {
        const fields = doc.data();
        Object.values(fields).forEach((item) => {
          if (item.functionDate) {
            addToMap(item.functionDate, "hold", {
              venueType: item.venueType || "",
              winProbability: item.winProbability || "",
            });
          }
          if (item.holdDate) {
            addToMap(item.holdDate, "bookingHold", {
              venueType: item.venueType || "",
              winProbability: item.winProbability || "",
            });
          }
        });
      });

      // -------- enquiry ----------
      const enquiriesSnap = await getDocs(collection(db, "enquiry"));
      enquiriesSnap.forEach((doc) => {
        const fields = doc.data();
        Object.values(fields).forEach((item) => {
          if (item.enquiryDate) {
            addToMap(item.enquiryDate, "enquiry", {
              venueType: item.venueType || "",
            });
          }
        });
      });

      // convert to array and sort (latest first)
      const merged = Object.keys(allDatesMap)
        .map((dateStr) => ({
          date: dateStr,
          ...allDatesMap[dateStr],
        }))
        .sort((a, b) => {
          const [da, ma, ya] = a.date.split("-").map(Number);
          const [db, mb, yb] = b.date.split("-").map(Number);
          return new Date(yb, mb - 1, db) - new Date(ya, ma - 1, da);
        });

      setMergedDates(merged);
    };

    if (isOpen) fetchDates();
  }, [isOpen]);

  if (!isOpen) return null;

  const getBgColor = (venueType) => {
    if (!venueType) return "";
    return venueType === "Hall with Front Lawn"
      ? "lightgreen"
      : venueType === "Pool Side"
        ? "yellow"
        : venueType === "Hall with Front & Back Lawn"
          ? "#bce1ffff"
          : "";
  };

  return (
    <>
      <div className="overlay">
        <div className="popup-container">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "10px",
            }}
          >
            <div style={{ flex: 1, textAlign: "center" }}>
              <h3 className="popup-heading" style={{ margin: 0 }}>
                📅 All Booking Dates
              </h3>
            </div>
            <div style={{ right: "20px" }}>
              <button
                onClick={onClose}
                style={{ color: "red", backgroundColor: "transparent" }}
              >
                X
              </button>
            </div>
          </div>

          {/* Search input */}
          <div style={{ marginBottom: "10px", textAlign: "center" }}>
            <input
              type="text"
              placeholder="Search date (e.g., 17-8-2025)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                padding: "6px 10px",
                width: "80%",
                maxWidth: "300px",
                borderRadius: "5px",
                border: "1px solid #ccc",
              }}
            />
          </div>

          <table className="scrollable-table">
            <thead>
              <tr>
                <th>Enquiry Dates</th>
                <th>Lead Hold Dates</th>
                <th>Lead Dates</th>
                <th>Booked Dates</th>
              </tr>
            </thead>
            <tbody>
              {mergedDates
                .filter((row) => !searchTerm || row.date.includes(searchTerm))
                .map((row, index) => (
                  <tr key={index}>
                    <td style={{ backgroundColor: getBgColor(row.enquiry?.venueType), whiteSpace: 'nowrap' }}>
                      {row.enquiry ? row.date : ""}
                    </td>
                    <td
                      style={{ backgroundColor: getBgColor(row.bookingHold?.venueType), whiteSpace: 'nowrap' }}
                    >
                      {row.bookingHold ? row.date : ""}
                      {row.bookingHold?.winProbability && (
                        <div>({row.bookingHold.winProbability}% prob)</div>
                      )}
                    </td>
                    <td style={{ backgroundColor: getBgColor(row.hold?.venueType), whiteSpace: 'nowrap' }}>
                      {row.hold ? row.date : ""}
                      {row.hold?.winProbability && (
                        <div>{row.hold.winProbability}% prob</div>
                      )}
                    </td>
                    <td style={{ backgroundColor: getBgColor(row.booked?.venueType), whiteSpace: 'nowrap' }}>
                      {row.booked ? row.date : ""}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .popup-container {
          background-color: white;
          padding: 25px;
          border-radius: 10px;
          width: 95%;
          max-width: 1000px;
          max-height: 90vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .scrollable-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        .scrollable-table thead {
          background: linear-gradient(to bottom, #58bfff, #1a9cff);
          position: sticky;
          top: 0;
          z-index: 2;
          border-bottom: 2px solid #0d75cc;     
        }
        
        .scrollable-table th,
        .scrollable-table td {
          padding: 10px;
          border: 2px solid #fafafaff;
          text-align: center;
          word-break: break-word;
          box-shadow: 
              inset 2px 2px 8px rgba(255, 255, 255, 0.6),  
              inset -2px -2px 8px rgba(0, 0, 0, 0.25),    
              6px 6px 12px rgba(0, 0, 0, 0.4);          
        }

        .scrollable-table tbody {
          display: block;
          overflow-y: auto;
          max-height: 300px;
          scrollbar-width: none; 
        }

        .scrollable-table tbody::-webkit-scrollbar {
          width: 0px;
          background: transparent; /* Optional: just hide scrollbar */
        }

        .scrollable-table thead,
        .scrollable-table tbody tr {
          display: table;
          width: 100%;
          table-layout: fixed;
        }

        .close-btn {
          background-color: transparent;
          border: none;
          font-weight: bolder;
          cursor: pointer;
        }
      `}</style>
    </>
  );
};

export default AllBookingDatesPopup;
