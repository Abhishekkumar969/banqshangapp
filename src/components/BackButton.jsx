import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

import { getAuth } from 'firebase/auth';
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";

const BackButton = ({ setActiveTab }) => {
  const scrollRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [userAppType, setUserAppType] = useState(null);



  const routeToTab = {
    "/": "Dashboard",
    "/EnquiryDetails": "EnquiryDetails",
    "/leads": "Leads",
    "/BookingTable": "Bookings",
    "/MoneyReceipts": "MoneyReceipts",
    "/Accountant": "Accountant",
  };

  const activeTab = routeToTab[location.pathname];

  const containerStyle = {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    backgroundColor: "#ffffff",
    zIndex: 9999,
    padding: "3px 10px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  };

  const fixedGroupStyle = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexShrink: 0,
  };

  const scrollGroupStyle = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    overflowX: "auto",
    padding: "4px 0",
    whiteSpace: "nowrap",
    flex: 1,
    scrollbarWidth: "none",
    msOverflowStyle: "none",
  };

  const iconButtonStyle = {
    background: "#f9f9f9",
    border: "2px solid #d1d1d1",
    borderRadius: "12px",
    color: "#000",
    cursor: "pointer",
    padding: "6px 10px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "0 0 auto",
    whiteSpace: "nowrap",
    fontWeight: 600,
    boxShadow: "0 4px #4b4b4b33",
    transition: "all 0.15s ease-in-out",
    fontSize: "0.9rem",
  };

  const iconButtonStyle1 = {
    background: "transparent",
    borderRadius: "12px",
    color: "#000",
    cursor: "pointer",
    padding: "6px 5px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "0 0 auto",
    whiteSpace: "nowrap",
    fontWeight: 600,
    transition: "all 0.15s ease-in-out",
  };

  const activeButtonStyle = {
    ...iconButtonStyle,
    background: "linear-gradient(180deg, #2e6999, #57a2d9)",
    color: "#fff",
    border: "2px solid #ffffff",
  };

  const handleMouseDown = (e) => {
    e.currentTarget.style.transform = "translateY(2px)";
    e.currentTarget.style.boxShadow = "0 2px #4b4b4b55";
  };

  const handleMouseUp = (e) => {
    e.currentTarget.style.transform = "translateY(0)";
    e.currentTarget.style.boxShadow = "0 4px #4b4b4b55";
  };

  const activateOrNavigate = (tabKey, fallbackPath) => {
    if (typeof setActiveTab === "function") {
      setActiveTab(tabKey);
    }
    navigate(fallbackPath);
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

  return (
    <div style={containerStyle}>
      <div style={fixedGroupStyle}>
        <button
          onClick={() => navigate("/")}
          style={iconButtonStyle1}
          title="Home"
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
        >
          <ArrowLeft size={18} />
        </button>

        <button
          onClick={() => window.location.reload()}
          style={iconButtonStyle1}
          title="Refresh"
        >
          <RefreshCw size={22} />
        </button>
      </div>

      <div ref={scrollRef} style={scrollGroupStyle} className="hide-scrollbar">
        <button
          onClick={() => activateOrNavigate("Dashboard", "/")}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          style={activeTab === "Dashboard" ? activeButtonStyle : iconButtonStyle}
        >
          Dashboard
        </button>

        {(userAppType === 'A' || userAppType === 'D' || userAppType === 'B' || userAppType === 'E' || userAppType === 'F' || userAppType === 'G') && (
          <>
            <button
              onClick={() => activateOrNavigate("EnquiryDetails", "/EnquiryDetails")}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              style={activeTab === "EnquiryDetails" ? activeButtonStyle : iconButtonStyle}
            >
              Enquiry
            </button>
          </>
        )}

        {(userAppType === 'A' || userAppType === 'D' || userAppType === 'B' || userAppType === 'E' || userAppType === 'F' || userAppType === 'G') && (
          <>
            <button
              onClick={() => activateOrNavigate("Leads", "/leads")}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              style={activeTab === "Leads" ? activeButtonStyle : iconButtonStyle}
            >
              Leads
            </button>
          </>
        )}

        {(userAppType === 'A' || userAppType === 'D' || userAppType === 'B' || userAppType === 'E' || userAppType === 'F' || userAppType === 'G') && (
          <>
            <button
              onClick={() => activateOrNavigate("Bookings", "/BookingTable")}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              style={activeTab === "Bookings" ? activeButtonStyle : iconButtonStyle}
            >
              Bookings
            </button>
          </>
        )}

        {(userAppType === 'A' || userAppType === 'D' || userAppType === 'B' || userAppType === 'E' || userAppType === 'F' || userAppType === 'G') && (
          <>
            <button
              onClick={() => activateOrNavigate("MoneyReceipts", "/MoneyReceipts")}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              style={activeTab === "MoneyReceipts" ? activeButtonStyle : iconButtonStyle}
            >
              Receipts
            </button>
          </>
        )}

        {(userAppType === 'A' || userAppType === 'D' || userAppType === 'B' || userAppType === 'E' || userAppType === 'F' || userAppType === 'G') && (
          <>
            <button
              onClick={() => activateOrNavigate("Accountant", "/Accountant")}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              style={activeTab === "Accountant" ? activeButtonStyle : iconButtonStyle}
            >
              Accounts
            </button>
          </>
        )}

      </div>
    </div>
  );
};

export default BackButton;
