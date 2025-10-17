import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Prebook.css';
import { getAuth, signOut } from 'firebase/auth';
import CalendarPopup from '../pages/CalendarPopup';
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import DownloadPopup from '../pages/DownloadPopup'
import BackButton from "../components/BackButton";
import BottomNavigationBar from './BottomNavigationBar';

const bannerImages = ["/assets/1.jpeg", "/assets/2.jpeg", "/assets/3.jpeg", "/assets/4.jpeg",];

const Prebook = () => {
  const navigate = useNavigate();
  const [showCalendar, setShowCalendar] = useState(false);
  const [userAppType, setUserAppType] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userName, setUserName] = useState('');
  const [showDownload, setShowDownload] = useState(false);
  const [vendor, setVendor] = useState(null);
  const [decoration, setDecoration] = useState(null);

  useEffect(() => {
    const fetchUserData = async () => {
      const auth = getAuth();
      const user = auth.currentUser;
      if (user) {
        try {
          const userRef = doc(db, 'usersAccess', user.email);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const data = userSnap.data();
            setUserAppType(data.accessToApp); // set the app type
            if (data.accessToApp === "C") {
              setVendor(data); // store the vendor data for app type C
            }
            if (data.accessToApp === "E") {
              setDecoration(data); // store the vendor data for app type C
            }
          }
        } catch (err) {
          console.error("Error fetching user data:", err);
        }
      }
    };

    fetchUserData();
  }, []);

  useEffect(() => {
    const fetchUserName = async () => {
      const auth = getAuth();
      const user = auth.currentUser;
      if (user) {
        try {
          const userRef = doc(db, 'usersAccess', user.email);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const data = userSnap.data();
            // Agar usersAccess me name hai, use set karo, warna email
            setUserName(data.name || user.email);
          } else {
            setUserName(user.email); // fallback
          }
        } catch (err) {
          console.error("Error fetching user from usersAccess:", err);
          setUserName(user.email);
        }
      }
    };

    fetchUserName();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % bannerImages.length);
    }, 3000); // 3 second
    return () => clearInterval(interval);
  }, []);

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
    <>
      <div style={{ marginBottom: '45px' }}> <BackButton />  </div>
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
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 16px',
              background: 'linear-gradient(90deg, #cb1111ff 30%, #fc6625ff 70%)',
              borderRadius: '25px',
              color: '#fff',
              fontWeight: '400',
              fontSize: '14px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              backdropFilter: 'blur(5px)',
              marginTop: '5px',
            }}>
              <span>👋 Hello, {userName}</span>
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

          {/* BOOKINGS */}
          {(userAppType === 'A' || userAppType === 'D' || userAppType === 'B' || userAppType === 'F' || userAppType === 'G') && (
            <>
              {/* Booking Services */}
              <div className="service-section">
                <h3 className="service-section-text">Bookings</h3>
                <div className="service-grid">
                  <ServiceBox label="Enquiry" onClick={() => navigate('/EnquiryForm')} icon="📨" />
                  <ServiceBox label="Lead" onClick={() => navigate('/bookingLead')} icon="🚀" />
                  <ServiceBox label="Booking" onClick={() => navigate('/Booking')} icon="💒" />
                  <ServiceBox label="Records" onClick={() => navigate('/leadstabcontainer')} icon="🗂️" />
                </div>
              </div>
            </>
          )}

          {/* RECEIPTS */}
          {(userAppType === 'A' || userAppType === 'D' || userAppType === 'B' || userAppType === 'F' || userAppType === 'G') && (
            <>
              {/* Money Receipt */}
              <div className="service-section">
                <h3 className="service-section-text">Receipts</h3>
                <div className="service-grid">
                  <ServiceBox label="Receipt" onClick={() => navigate('/MoneyReceipt')} icon="🧾" />
                  <ServiceBox label="Voucher" onClick={() => navigate('/Receipts')} icon="🎟️" />
                  <ServiceBox label="Records" onClick={() => navigate('/MoneyReceipts')} icon="📚" />
                  <ServiceBox label="Approve" onClick={() => navigate('/ApprovalPage')} icon="✅" />
                </div>
              </div>
            </>
          )}

          {/* ACCOUNTANT */}
          {(userAppType === 'A' || userAppType === 'D' || userAppType === 'B' || userAppType === 'F' || userAppType === 'G') && (
            <>
              {/* Vendor Section */}
              <div className="service-section">
                <h3 className="service-section-text">Accountant</h3>
                <div className="service-grid">
                  <ServiceBox label="Cashflow" onClick={() => navigate('/AccountantForm')} icon="💸" />
                  <ServiceBox label="Accounts" onClick={() => navigate('/Accountant')} icon="📇" />
                </div>
              </div>
            </>
          )}

          {/* UTILITIES */}
          {(userAppType === 'A' || userAppType === 'D' || userAppType === 'B' || userAppType === 'F' || userAppType === 'G') && (
            <>
              {/* Utilities */}
              <div className="service-section">
                <h3 className="service-section-text">Utilities</h3>
                <div className="service-grid">
                  {/* <ServiceBox label="Profile" onClick={() => navigate('/AdminProfile')} icon="👤" /> */}
                  <ServiceBox label="Menu" onClick={() => navigate('/MenuItems')} icon="🍽" />
                  <ServiceBox label="Calendar" onClick={() => setShowCalendar(true)} icon="📅" />
                  <ServiceBox label="GST" onClick={() => navigate('/GSTSummary')} icon="💹" />
                </div>
              </div>
            </>
          )}

          {/* VENDOR */}
          {(userAppType === 'A' || userAppType === 'D') && (
            <>
              <div className="service-section">
                <h3 className="service-section-text">Vendor</h3>
                <div className="service-grid">
                  <ServiceBox label="UpComings" onClick={() => navigate('/VendorTable')} icon="📇" />
                  <ServiceBox label="Booked" onClick={() => navigate('/VendorBookedTable')} icon="🗂️" />
                  <ServiceBox label="Dropped" onClick={() => navigate('/VendorDeoppedTable')} icon="🗑️" />
                </div>
              </div>
            </>
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
                    <ServiceBox label="UpComings" onClick={() => navigate('/VendorTable')} icon="📇" />
                    <ServiceBox label="Booked" onClick={() => navigate('/VendorBookedTable')} icon="🗂️" />
                    <ServiceBox label="Dropped" onClick={() => navigate('/VendorDeoppedTable')} icon="🗑️" />
                  </>
                )}
              </div>
            </div>
          )}

          {/* DECORATION */}
          {(userAppType === 'A' || userAppType === 'D') && (
            <>
              <div className="service-section">
                <h3 className="service-section-text">Decoration</h3>
                <div className="service-grid">
                  <ServiceBox label="UpComings" onClick={() => navigate('/DecorationTable')} icon="📇" />
                  <ServiceBox label="Booked" onClick={() => navigate('/DecorationBookedTable')} icon="🗂️" />
                  <ServiceBox label="Dropped" onClick={() => navigate('/DecorationDeoppedTable')} icon="🗑️" />
                </div>
              </div>
            </>
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
                    <ServiceBox label="UpComings" onClick={() => navigate('/DecorationTable')} icon="📇" />
                    <ServiceBox label="Booked" onClick={() => navigate('/DecorationBookedTable')} icon="🗂️" />
                    <ServiceBox label="Dropped" onClick={() => navigate('/DecorationDeoppedTable')} icon="🗑️" />
                  </>
                )}
              </div>
            </div>
          )}

          {/* Catering */}
          {(userAppType === 'A' || userAppType === 'D' || userAppType === 'B' || userAppType === 'F' || userAppType === 'G') && (
            <>
              <div className="service-section">
                <h3 className="service-section-text">Catering</h3>
                <div className="service-grid">
                  <ServiceBox label="Assign" onClick={() => navigate('/CateringAssign')} icon="📝" />
                  <ServiceBox label="Records" onClick={() => navigate('/CateringAssigned')} icon="🗂️" />
                </div>
              </div>
            </>
          )}

          {/* Settings Sections */}
          {(userAppType === 'A' || userAppType === 'D') && (
            <>
              <div className="service-section" >
                <h3 className="service-section-text">Settings</h3>
                <div className="service-grid">
                  <ServiceBox label="Business" onClick={() => navigate('/StatsPage')} icon="📈" />
                  <ServiceBox label="Access" onClick={() => navigate('/UserAccessPanel')} icon="🔐" />
                  <ServiceBox label="Save/ Delete" onClick={() => setShowDownload(true)} icon="📇" />
                </div>
              </div>
            </>
          )}

          <div style={{ marginBottom: "150px" }}></div>
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