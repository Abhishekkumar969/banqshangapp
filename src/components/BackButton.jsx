import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { getAuth } from 'firebase/auth';
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import './BackButton.css';

const BackButton = ({ setActiveTab }) => {
  const scrollRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const [userAppType, setUserAppType] = useState(null);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

  const routeToTab = {
    "/": "Dashboard",
    "/EnquiryDetails": "EnquiryDetails",
    "/leads": "Leads",
    "/BookingTable": "Bookings",
    "/MoneyReceipts": "MoneyReceipts",
    "/Accountant": "Accountant",
    "/MenuItems": "MenuItems",
    "/GSTSummary": "GSTSummary",
  };
  const activeTab = routeToTab[location.pathname];

  const containerStyle = { position: "fixed", top: 0, left: 0, width: "100vw", backgroundColor: "#98ccf0ff", zIndex: 9999, padding: "3px 10px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", boxShadow: "inset -2px -2px 5px #56abe7ff" };
  const fixedGroupStyle = { display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 };
  const scrollGroupStyle = { display: "flex", alignItems: "center", gap: "10px", overflowX: "auto", padding: "4px 0", whiteSpace: "nowrap", flex: 1 };
  const iconButtonStyle = { background: "#fff", borderRadius: "12px", color: "#000", cursor: "pointer", padding: "6px 10px", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", fontWeight: 600, boxShadow: "inset -0 -4px 2.2px #014a85fe", transition: "all 0.15s ease-in-out", fontSize: "0.9rem", position: "relative" };
  const activeButtonStyle = { ...iconButtonStyle, background: "linear-gradient(270deg, #5eb1ecff, #3c80b7ff)", color: "#fff" };
  const dropdownItemStyle = { padding: "8px 14px", cursor: "pointer", fontWeight: 500, display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" };

  const handleToggleDropdown = (menu, e) => {
    if (openDropdown === menu) return setOpenDropdown(null);
    const rect = e.currentTarget.getBoundingClientRect();
    setDropdownPos({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX });
    setOpenDropdown(menu);
  };

  const activateOrNavigate = (tabKey, path) => { if (setActiveTab) setActiveTab(tabKey); navigate(path); };

  useEffect(() => {
    const auth = getAuth();
    const fetchUser = async () => {
      const user = auth.currentUser;
      if (user) {
        const userSnap = await getDoc(doc(db, 'usersAccess', user.email));
        if (userSnap.exists()) setUserAppType(userSnap.data().accessToApp);
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    const handleClickOutside = e => { if (!e.target.closest(".dropdown-container")) setOpenDropdown(null); };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => { if (location.pathname === "/leadstabcontainer" && setActiveTab) setActiveTab("EnquiryDetails"); }, [location.pathname, setActiveTab]);

  const renderDropdown = (menuKey, items) => openDropdown === menuKey && (
    <div style={{ position: "fixed", top: "45px", left: dropdownPos.left, background: "#fff", border: "1px solid #ccc", borderRadius: "10px", padding: "6px 0", boxShadow: "0 2px 8px rgba(0,0,0,0.25)", minWidth: "180px", zIndex: 999999 }}>
      {items.map(({ label, path }) => <div key={label} style={dropdownItemStyle} onClick={() => navigate(path)}>{label}</div>)}
    </div>
  );

  const dropdowns = [
    { key: "enquiry", label: "📨 Enquiry", items: [{ label: "📨 Enquiry Form", path: "/EnquiryForm" }, { label: "🗂️ Records", path: "/leadstabcontainer?tab=enquiry" }, { label: "🗑️ Recycle Bin", path: "/PastLeadsTabContainer?tab=PastEnquiry" }] },
    { key: "leads", label: "🚀 Lead", items: [{ label: "🚀 Lead", path: "/bookingLead" }, { label: "🗂️ Records", path: "/leadstabcontainer?tab=leads" }, { label: "🗑️ Recycle Bin", path: "/PastLeadsTabContainer?tab=dropped" }] },
    { key: "Bookings", label: "💒 Booking", items: [{ label: "💒 Bookings", path: "/Booking" }, { label: "🗂️ Records", path: "/leadstabcontainer?tab=bookings" }, { label: "🗑️ Recycle Bin", path: "/PastLeadsTabContainer?tab=cancelled" }] },
    { key: "receipts", label: "🧾 Receipt", items: [{ label: "🧾 Receipt", path: "/MoneyReceipt" }, { label: "🎟️ Voucher", path: "/Receipts" }, { label: "📚 Records", path: "/MoneyReceipts" }, { label: "✅ Approve", path: "/ApprovalPage" }] },
    { key: "accounts", label: "💸 Accounts", items: [{ label: "💸 Cashflow", path: "/AccountantForm" }, { label: "📇 Accounts", path: "/Accountant" }] },
    { key: "Vendor", label: "🪩 Vendor", items: [{ label: "📝 Form", path: "/VendorOtherForm" }, { label: "🪩 UpComings", path: "/VendorTable" }, { label: "🗂️ Booked", path: "/VendorBookedTable" }, { label: "🗑️ Dropped", path: "/VendorDeoppedTable" }] },
    { key: "Decoration", label: "🌸 Decoration", items: [{ label: "📝 Form", path: "/DecorationOtherForm" }, { label: "🌸 UpComings", path: "/DecorationTable" }, { label: "🗂️ Booked", path: "/DecorationBookedTable" }, { label: "🗑️ Dropped", path: "/DecorationDeoppedTable" }] },
    { key: "Catering", label: "👨‍🍳 Catering", items: [{ label: "📝 Assign", path: "/CateringAssign" }, { label: "🗂️ Records", path: "/CateringAssigned" }] },
  ];

  return (
    <div style={containerStyle}>
      <div style={fixedGroupStyle}>
        <button onClick={() => navigate("/")} style={{ ...iconButtonStyle, background: "#f9f9f9", border: "none" }} title="Home"><ArrowLeft size={18} /></button>
        <button onClick={() => window.location.reload()} style={{ ...iconButtonStyle, background: "#f9f9f9", border: "none" }} title="Refresh"><RefreshCw size={18} /></button>
      </div>
      <div ref={scrollRef} style={scrollGroupStyle} className="scrollable-menu">
        <button onClick={() => activateOrNavigate("Dashboard", "/")} style={activeTab === "Dashboard" ? activeButtonStyle : iconButtonStyle}>🏠 Dashboard</button>

        {userAppType === "A" && dropdowns.map(({ key, label, items }) => (
          <div key={key} className="dropdown-container" style={{ position: "relative" }} onClick={e => handleToggleDropdown(key, e)}>
            <button style={(activeTab || "").toLowerCase() === key.toLowerCase() ? activeButtonStyle : iconButtonStyle}>{label}</button>
            {renderDropdown(key, items)}
          </div>
        ))}


        {userAppType === "A" && <>
          <button onClick={() => navigate("/MenuItems")} style={activeTab === "MenuItems" ? activeButtonStyle : iconButtonStyle}>🍽 Menu</button>
          <button onClick={() => navigate("/GSTSummary")} style={activeTab === "GSTSummary" ? activeButtonStyle : iconButtonStyle}>💹 GST</button>
          <button onClick={() => navigate("/StatsPage")} style={activeTab === "StatsPage" ? activeButtonStyle : iconButtonStyle}>📈 StatsPage</button>
          <button onClick={() => navigate("/UserAccessPanel")} style={activeTab === "UserAccessPanel" ? activeButtonStyle : iconButtonStyle}>🔐 Access</button>
        </>}

        <div style={{ marginRight: "80px" }}></div>
      </div>
    </div>
  );
};

export default BackButton;