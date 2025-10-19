import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { getAuth } from 'firebase/auth';
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { useSearchParams } from "react-router-dom";

const BackButton = ({ setActiveTab }) => {
  const scrollRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [userAppType, setUserAppType] = useState(null);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get("tab"); // get ?tab= value

  const handleToggleDropdown = (menu, e) => {
    if (openDropdown === menu) {
      setOpenDropdown(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX
      });
      setOpenDropdown(menu);
    }
  };

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
    backgroundColor: "#98ccf0ff",
    zIndex: 9999,
    padding: "3px 10px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
    boxShadow: "inset -2px -2px 5px #56abe7ff",
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
    gap: "10px",
    overflowX: "auto",
    padding: "4px 0",
    whiteSpace: "nowrap",
    flex: 1,
    scrollbarWidth: "none",
    msOverflowStyle: "none",
  };

  const iconButtonStyle = {
    background: "#ffffffff",
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
    boxShadow: "inset -0 -4px 2.2px #014a85fe",
    transition: "all 0.15s ease-in-out",
    fontSize: "0.9rem",
    position: "relative",
  };

  const activeButtonStyle = {
    ...iconButtonStyle,
    background: "linear-gradient(270deg, #5eb1ecff, #3c80b7ff)",
    color: "#fff",
  };

  const dropdownItemStyle = {
    padding: "8px 14px",
    cursor: "pointer",
    fontWeight: 500,
    display: "flex",
    alignItems: "center",
    gap: "6px",
    whiteSpace: "nowrap",
  };

  const activateOrNavigate = (tabKey, fallbackPath) => {
    if (typeof setActiveTab === "function") setActiveTab(tabKey);
    navigate(fallbackPath);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest(".dropdown-container")) setOpenDropdown(null);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
    if (location.pathname === "/leadstabcontainer" && typeof setActiveTab === "function") {
      setActiveTab("EnquiryDetails");
    }
  }, [location.pathname, setActiveTab]);

  return (
    <div style={containerStyle}>

      {/* Fixed Buttons */}
      <div style={fixedGroupStyle}>
        <button onClick={() => navigate("/")} style={{ ...iconButtonStyle, background: "#f9f9f9", border: "none" }} title="Home">
          <ArrowLeft size={18} />
        </button>
        <button onClick={() => window.location.reload()} style={{ ...iconButtonStyle, background: "#f9f9f9", border: "none" }} title="Refresh">
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Scrollable Menu */}
      <div ref={scrollRef} style={scrollGroupStyle}>

        {/* Dashboard */}
        <button
          onClick={() => activateOrNavigate("Dashboard", "/")}
          style={activeTab === "Dashboard" ? activeButtonStyle : iconButtonStyle}
        >
          🏠 Dashboard
        </button>

        {/* ENQUIRY DROPDOWN */}
        {(userAppType === 'A' || userAppType === 'B' || userAppType === 'D' || userAppType === 'E' || userAppType === 'F' || userAppType === 'G') && (
          <div
            className="dropdown-container"
            style={{ position: "relative" }}
            onClick={(e) => handleToggleDropdown("enquiry", e)}
          >
            <button
              style={
                activeTab === "enquiry" ||
                  ["/EnquiryForm"].includes(location.pathname) ||
                  (["/leadstabcontainer", "/PastLeadsTabContainer"].includes(location.pathname) &&
                    ["enquiry", "PastEnquiry"].includes(tabParam))
                  ? activeButtonStyle
                  : iconButtonStyle
              }
            >
              📨 Enquiry
            </button>

            {openDropdown === "enquiry" && (
              <div
                style={{
                  position: "fixed",
                  // top: dropdownPos.top,
                  top: "45px",
                  left: dropdownPos.left,
                  background: "#fff",
                  border: "1px solid #ccc",
                  borderRadius: "10px",
                  padding: "6px 0",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
                  minWidth: "180px",
                  zIndex: 999999,
                }}
              >
                <div style={dropdownItemStyle} onClick={() => navigate("/EnquiryForm")}>📨 Enquiry Form</div>
                <div style={dropdownItemStyle} onClick={() => navigate("/leadstabcontainer?tab=enquiry")}>🗂️ Records</div>
                <div style={dropdownItemStyle} onClick={() => navigate("/PastLeadsTabContainer?tab=PastEnquiry")}>🗑️ Recycle Bin</div>
              </div>
            )}
          </div>
        )}

        {/* LEADS DROPDOWN */}
        {(userAppType === 'A' || userAppType === 'B' || userAppType === 'D' || userAppType === 'E' || userAppType === 'F' || userAppType === 'G') && (
          <div
            className="dropdown-container"
            style={{ position: "relative" }}
            onClick={(e) => handleToggleDropdown("leads", e)}
          >
            <button
              style={
                activeTab === "leads" ||
                  ["/bookingLead"].includes(location.pathname) ||
                  (["/leadstabcontainer", "/PastLeadsTabContainer"].includes(location.pathname) &&
                    ["leads", "dropped"].includes(tabParam))
                  ? activeButtonStyle
                  : iconButtonStyle
              }

            >
              🚀 Lead
            </button>

            {openDropdown === "leads" && (
              <div
                style={{
                  position: "fixed",
                  top: "45px",
                  left: dropdownPos.left,
                  background: "#fff",
                  border: "1px solid #ccc",
                  borderRadius: "10px",
                  padding: "6px 0",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
                  minWidth: "180px",
                  zIndex: 999999,
                }}
              >
                <div style={dropdownItemStyle} onClick={() => navigate("/bookingLead")}>🚀 Lead</div>
                <div style={dropdownItemStyle} onClick={() => navigate("/leadstabcontainer?tab=leads")}>🗂️ Records</div>
                <div style={dropdownItemStyle} onClick={() => navigate("/PastLeadsTabContainer?tab=dropped")}>🗑️ Recycle Bin</div>

              </div>
            )}
          </div>
        )}

        {/* BookingTable DROPDOWN */}
        {(userAppType === 'A' || userAppType === 'B' || userAppType === 'D' || userAppType === 'E' || userAppType === 'F' || userAppType === 'G') && (
          <div
            className="dropdown-container"
            style={{ position: "relative" }}
            onClick={(e) => handleToggleDropdown("Bookings", e)}
          >
            <button
              style={
                activeTab === "Bookings" ||
                  ["/Booking"].includes(location.pathname) ||
                  (["/leadstabcontainer", "/PastLeadsTabContainer"].includes(location.pathname) &&
                    ["bookings", "cancelled"].includes(tabParam))
                  ? activeButtonStyle
                  : iconButtonStyle
              }

            >
              💒 Booking
            </button>

            {openDropdown === "Bookings" && (
              <div
                style={{
                  position: "fixed",
                  // top: dropdownPos.top,
                  top: "45px",
                  left: dropdownPos.left,
                  background: "#fff",
                  border: "1px solid #ccc",
                  borderRadius: "10px",
                  padding: "6px 0",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
                  minWidth: "180px",
                  zIndex: 999999,
                }}
              >
                <div style={dropdownItemStyle} onClick={() => navigate("/Booking")}>💒 Bookings</div>
                <div style={dropdownItemStyle} onClick={() => navigate("/leadstabcontainer?tab=bookings")}>🗂️ Records</div>
                <div style={dropdownItemStyle} onClick={() => navigate("/PastLeadsTabContainer?tab=cancelled")}>🗑️ Recycle Bin</div>

              </div>
            )}
          </div>
        )}

        {/* RECEIPTS DROPDOWN */}
        {(userAppType === 'A' || userAppType === 'B' || userAppType === 'D' || userAppType === 'E' || userAppType === 'F' || userAppType === 'G') && (
          <div
            className="dropdown-container"
            style={{ position: "relative" }}
            onClick={(e) => handleToggleDropdown("receipts", e)}
          >
            <button
              style={
                activeTab === "MoneyReceipts"
                  || location.pathname === "/MoneyReceipt"
                  || location.pathname === "/Receipts"
                  || location.pathname === "/MoneyReceipts"
                  || location.pathname === "/ApprovalPage"
                  ? activeButtonStyle
                  : iconButtonStyle
              }
            >
              🧾 Receipt
            </button>

            {openDropdown === "receipts" && (
              <div
                style={{
                  position: "fixed",
                  // top: dropdownPos.top,
                  top: "45px",
                  left: dropdownPos.left,
                  background: "#fff",
                  border: "1px solid #ccc",
                  borderRadius: "10px",
                  padding: "6px 0",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
                  minWidth: "180px",
                  zIndex: 999999,
                }}
              >
                <div style={dropdownItemStyle} onClick={() => navigate("/MoneyReceipt")}>🧾 Receipt</div>
                <div style={dropdownItemStyle} onClick={() => navigate("/Receipts")}>🎟️ Voucher</div>
                <div style={dropdownItemStyle} onClick={() => navigate("/MoneyReceipts")}>📚 Records</div>
                <div style={dropdownItemStyle} onClick={() => navigate("/ApprovalPage")}>✅ Approve</div>
              </div>
            )}
          </div>
        )}

        {/* ACCOUNTANT DROPDOWN */}
        {(userAppType === 'A' || userAppType === 'B' || userAppType === 'D' || userAppType === 'E' || userAppType === 'F' || userAppType === 'G') && (
          <div
            className="dropdown-container"
            style={{ position: "relative" }}
            onClick={(e) => handleToggleDropdown("accounts", e)}
          >
            <button
              style={
                activeTab === "Accountant" || location.pathname === "/AccountantForm"
                  ? activeButtonStyle
                  : iconButtonStyle
              }            >
              💸 Accounts
            </button>

            {openDropdown === "accounts" && (
              <div
                style={{
                  position: "fixed",
                  // top: dropdownPos.top,
                  top: "45px",
                  left: dropdownPos.left,
                  background: "#fff",
                  border: "1px solid #ccc",
                  borderRadius: "10px",
                  padding: "6px 0",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
                  minWidth: "180px",
                  zIndex: 999999,
                }}
              >
                <div style={dropdownItemStyle} onClick={() => navigate("/AccountantForm")}>💸 Cashflow</div>
                <div style={dropdownItemStyle} onClick={() => navigate("/Accountant")}>📇 Accounts</div>
              </div>
            )}
          </div>
        )}

        <div style={{ marginRight: "80px" }}></div>
      </div>
    </div>
  );
};

export default BackButton;