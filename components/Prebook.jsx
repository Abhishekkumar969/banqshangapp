import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Prebook.css';
import { getAuth, signOut } from 'firebase/auth';
import CalendarPopup from '../pages/CalendarPopup';
import { doc, collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";
import DownloadPopup from '../pages/DownloadPopup'
import BackButton from "../components/BackButton";
import BottomNavigationBar from './BottomNavigationBar';
import DailyReport from "./DailyReport";

const bannerImages = ["/assets/1.jpeg", "/assets/2.jpeg", "/assets/3.jpeg", "/assets/4.jpeg",];

const Prebook = () => {
  const navigate = useNavigate();
  const [showCalendar, setShowCalendar] = useState(false);
  const [showDownload, setShowDownload] = useState(false);
  const [userAppType, setUserAppType] = useState(null);
  const [userName, setUserName] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [vendor, setVendor] = useState(null);
  const [decoration, setDecoration] = useState(null);
  const [panelAccess, setPanelAccess] = useState({});

  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;

    const userRef = doc(db, 'usersAccess', user.email);

    // Listen to all user data at once
    const unsubscribe = onSnapshot(
      userRef,
      (userSnap) => {
        if (userSnap.exists()) {
          const data = userSnap.data();

          // App type
          setUserAppType(data.accessToApp);

          // Name (fallback to email)
          setUserName(data.name || user.email);

          // Vendor / Decoration
          setVendor(data.accessToApp === 'C' ? data : null);
          setDecoration(data.accessToApp === 'E' ? data : null);
        } else {
          // Fallback if document doesn't exist
          setUserName(user.email);
          setUserAppType(null);
          setVendor(null);
          setDecoration(null);
        }
      },
      (err) => console.error("Error listening to user data:", err)
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const accessCollectionRef = collection(db, 'pannelAccess');
    const unsubscribe = onSnapshot(
      accessCollectionRef,
      (accessSnap) => {
        let allAccess = {};
        accessSnap.forEach((docItem) => {
          allAccess[docItem.id] = docItem.data();
        });
        setPanelAccess(allAccess);
      },
      (err) => console.error("Error listening to panel access:", err)
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % bannerImages.length);
    }, 3500); // 3 seconds

    return () => clearInterval(interval);
  }, []);

  const hasAccess = (section, item) => {
    // Admin sees everything
    if (userAppType === 'A') return true;

    // For non-admins, check Firestore access
    if (!userAppType || !panelAccess[section]) return false;
    const allowed = panelAccess[section][item] || [];
    return allowed.includes(userAppType);
  };

  const auth = getAuth();

  const confirmLogout = () => {
    signOut(auth)
      .then(() => {
        console.log("User signed out");
        window.location.href = "/";
      })
      .catch((error) => {
        console.error("Error signing out:", error);
      });
  };

  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;

    if (user) {
      const userRef = doc(db, 'usersAccess', user.email);

      // Listen for real-time updates to the user's document
      const unsubscribe = onSnapshot(
        userRef,
        (userSnap) => {
          if (userSnap.exists()) {
            const data = userSnap.data();
            setUserAppType(data.accessToApp);
          }
        },
        (err) => {
          console.error("Error listening to user app type:", err);
        }
      );

      // Clean up listener on unmount
      return () => unsubscribe();
    }
  }, []);

  return (
    <>
      <div style={{ marginBottom: '55px' }}> <BackButton />  </div>
      <div className="prebook-wrapper">

        {/* LogOut */}
        <div style={{
          position: 'fixed',
          top: 15,
          left: 0,
          right: 0,
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'space-between',
          padding: '0 20px'
        }}>
          <div>
            <div>
              <span className="logout-btn top-bar-header" >👋 Hello, {userName}</span>
            </div>
          </div>

          <div>
            <button
              className="logout-btn top-bar-header"
              onClick={confirmLogout}
            >
              Logout
            </button>
          </div>

        </div>

        <div className="banner">
          <div
            className="banner-track"
            style={{ transform: `translateX(-${currentIndex * 100}%)` }}
          >
            {bannerImages.map((src, idx) => (
              <img key={idx} src={src} alt="Promo" className="banner-image" />
            ))}
          </div>
          <div className="banner-text">
            Simplify Banquet Management
          </div>
        </div>

        <div>

          {/* Daily Report Section */}
          {Object.keys(panelAccess.ReportSection || {}).some(item => hasAccess("ReportSection", item)) && (
            <>
              <div className="service-section">
                <h3 className="service-section-text">Daily Report</h3>
                {hasAccess("ReportSection", "Report") && <DailyReport />}
              </div>
            </>
          )}

          {/* BOOKINGS */}
          {Object.keys(panelAccess.Bookings || {}).some(item => hasAccess("Bookings", item)) && (
            <div className="service-section">
              <h3 className="service-section-text">Bookings</h3>
              <div className="service-grid">
                {hasAccess("Bookings", "Enquiry") && <ServiceBox label="Enquiry" onClick={() => navigate('/EnquiryForm')} icon="📨" />}
                {hasAccess("Bookings", "Lead") && <ServiceBox label="Lead" onClick={() => navigate('/bookingLead')} icon="🚀" />}
                {hasAccess("Bookings", "Book") && <ServiceBox label="Book" onClick={() => navigate('/Booking')} icon="💒" />}

                {(hasAccess("Bookings", "Lead Record") || hasAccess("Bookings", "Enquiry Record") || hasAccess("Bookings", "Book Record")) && (
                  <ServiceBox
                    label="Record"
                    onClick={() => navigate('/leadstabcontainer')}
                    icon="🗂️"
                  />
                )}

                {(hasAccess("Bookings", "Past Enquiry") || hasAccess("Bookings", "Dropped Leads") || hasAccess("Bookings", "Cancelled Bookings")) && (
                  <ServiceBox
                    label="Past Records"
                    onClick={() => navigate('/PastLeadsTabContainer')}
                    icon="🗑️"
                  />
                )}

              </div>
            </div>
          )}

          {/* RECEIPTS */}
          {Object.keys(panelAccess.Receipts || {}).some(item => hasAccess("Receipts", item)) && (
            <div className="service-section">
              <h3 className="service-section-text">Receipts</h3>
              <div className="service-grid">
                {hasAccess("Receipts", "Receipt") && <ServiceBox label="Receipt" onClick={() => navigate('/MoneyReceipt')} icon="🧾" />}
                {hasAccess("Receipts", "Voucher") && <ServiceBox label="Voucher" onClick={() => navigate('/Receipts')} icon="🎟️" />}
                {hasAccess("Receipts", "Record") && <ServiceBox label="Record" onClick={() => navigate('/MoneyReceipts')} icon="📚" />}
                {hasAccess("Receipts", "Approve") && <ServiceBox label="Approve" onClick={() => navigate('/ApprovalPage')} icon="✅" />}
              </div>
            </div>
          )}

          {/* ACCOUNTANT */}
          {Object.keys(panelAccess.Accountant || {}).some(item => hasAccess("Accountant", item)) && (
            <div className="service-section">
              <h3 className="service-section-text">Accountant</h3>
              <div className="service-grid">
                {hasAccess("Accountant", "Cashflow") && <ServiceBox label="Cashflow" onClick={() => navigate('/AccountantForm')} icon="💸" />}
                {hasAccess("Accountant", "Record") && <ServiceBox label="Record" onClick={() => navigate('/Accountant')} icon="📇" />}
              </div>
            </div>
          )}

          {/* UTILITIES */}
          {Object.keys(panelAccess.Utilities || {}).some(item => hasAccess("Utilities", item)) && (
            <div className="service-section">
              <h3 className="service-section-text">Utilities</h3>
              <div className="service-grid">
                {hasAccess("Utilities", "Menu") && <ServiceBox label="Menu" onClick={() => navigate('/MenuItems')} icon="🍽" />}
                {hasAccess("Utilities", "Dates") && <ServiceBox label="Dates" onClick={() => setShowCalendar(true)} icon="📅" />}
                {hasAccess("Utilities", "GST") && <ServiceBox label="GST" onClick={() => navigate('/GSTSummary')} icon="💹" />}
              </div>
            </div>
          )}

          {/* VENDOR */}
          {Object.keys(panelAccess.Vendor || {}).some(item => hasAccess("Vendor", item)) && (
            <div className="service-section">
              <h3 className="service-section-text">Vendor</h3>
              <div className="service-grid">
                {hasAccess("Vendor", "Form") && <ServiceBox label="Form" onClick={() => navigate('/VendorOtherForm')} icon="📝" />}
                {hasAccess("Vendor", "UpComings") && <ServiceBox label="UpComings" onClick={() => navigate('/VendorTable')} icon="🪩" />}
                {hasAccess("Vendor", "Booked") && <ServiceBox label="Booked" onClick={() => navigate('/VendorBookedTable')} icon="🗂️" />}
                {hasAccess("Vendor", "Dropped") && <ServiceBox label="Dropped" onClick={() => navigate('/VendorDeoppedTable')} icon="🗑️" />}
              </div>
            </div>
          )}

          {/* VENDOR */}
          {userAppType === 'C' && (
            <div className="service-section">
              <h3 className="service-section-text">Vendor</h3>
              <div className="service-grid">
                <ServiceBox label="Profile" onClick={() => navigate('/VendorProfile')} icon="🧑‍💼" />
                {vendor?.functionTypes?.length > 0 && (
                  <>
                    <ServiceBox label="Form" onClick={() => navigate('/VendorOtherForm')} icon="📝" />
                    <ServiceBox label="UpComings" onClick={() => navigate('/VendorTable')} icon="🪩" />
                    <ServiceBox label="Booked" onClick={() => navigate('/VendorBookedTable')} icon="🗂️" />
                    <ServiceBox label="Dropped" onClick={() => navigate('/VendorDeoppedTable')} icon="🗑️" />
                  </>
                )}
              </div>
            </div>
          )}

          {/* DECORATION */}
          {Object.keys(panelAccess.Decoration || {}).some(item => hasAccess("Decoration", item)) && (
            <div className="service-section">
              <h3 className="service-section-text">Decoration</h3>
              <div className="service-grid">
                {hasAccess("Decoration", "Form") && <ServiceBox label="Form" onClick={() => navigate('/DecorationOtherForm')} icon="📝" />}
                {hasAccess("Decoration", "UpComings") && <ServiceBox label="UpComings" onClick={() => navigate('/DecorationTable')} icon="🌸" />}
                {hasAccess("Decoration", "Booked") && <ServiceBox label="Booked" onClick={() => navigate('/DecorationBookedTable')} icon="🗂️" />}
                {hasAccess("Decoration", "Dropped") && <ServiceBox label="Dropped" onClick={() => navigate('/DecorationDeoppedTable')} icon="🗑️" />}
              </div>
            </div>
          )}

          {/* DECORATION */}
          {userAppType === 'E' && (
            <div className="service-section">
              <h3 className="service-section-text">Decoration</h3>
              <div className="service-grid">
                <ServiceBox label="Profile" onClick={() => navigate('/DecorationProfile')} icon="👤" />
                {decoration?.functionTypes?.length > 0 && (
                  <>
                    <ServiceBox label="Form" onClick={() => navigate('/DecorationOtherForm')} icon="📝" />
                    <ServiceBox label="UpComings" onClick={() => navigate('/DecorationTable')} icon="🌸" />
                    <ServiceBox label="Booked" onClick={() => navigate('/DecorationBookedTable')} icon="🗂️" />
                    <ServiceBox label="Dropped" onClick={() => navigate('/DecorationDeoppedTable')} icon="🗑️" />
                  </>
                )}
              </div>
            </div>
          )}

          {/* CATERING */}
          {Object.keys(panelAccess.Catering || {}).some(item => hasAccess("Catering", item)) && (
            <div className="service-section">
              <h3 className="service-section-text">Catering</h3>
              <div className="service-grid">
                {hasAccess("Catering", "Assign") && <ServiceBox label="Assign" onClick={() => navigate('/CateringAssign')} icon="👨‍🍳" />}
                {hasAccess("Catering", "Records") && <ServiceBox label="Records" onClick={() => navigate('/CateringAssigned')} icon="🗂️" />}
              </div>
            </div>
          )}

          {/* SETTINGS */}
          {Object.keys(panelAccess.Settings || {}).some(item => hasAccess("Settings", item)) && (
            <div className="service-section">
              <h3 className="service-section-text">Settings</h3>
              <div className="service-grid">
                {hasAccess("Settings", "Business") && <ServiceBox label="Business" onClick={() => navigate('/StatsPage')} icon="📈" />}
                {hasAccess("Settings", "Access") && <ServiceBox label="Access" onClick={() => navigate('/UserAccessPanel')} icon="🔐" />}
                {hasAccess("Settings", "SaveBackup") && <ServiceBox label="Save & BackUp" onClick={() => setShowDownload(true)} icon="📇" />}
              </div>
            </div>
          )}

          <div style={{ marginBottom: "70px" }}></div>
        </div>

        <CalendarPopup isOpen={showCalendar} onClose={() => setShowCalendar(false)} />
        <DownloadPopup isOpen={showDownload} onClose={() => setShowDownload(false)} />

      </div>
      <BottomNavigationBar navigate={navigate} userAppType={userAppType} />
    </>
  );
};

const ServiceBox = ({ label, onClick, icon }) => (
  <div className="service-box" onClick={onClick}>
    <div className="service-icon">{icon}</div>
    <div className="service-label">{label}</div>
  </div>
);

export default Prebook;