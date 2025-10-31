import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebaseConfig";

import Prebook from "./components/Prebook";
import InstallPrompt from "./components/InstallPrompt";

import BookingLead from './Lead/BookingLead';
import BookingLeadsTable from './Lead/AllLeads/BookingLeadsTable';
import DroppedLeads from './Lead/AllLeads/LeadsTabs/DroppedLeads';

import Booking from './Book/Booking';
import BookingTable from './Book/AllLeads/BookingLeadsTable';

import GSTSummary from './GSTSummary/GSTSummary';
import MoneyReceipt from './MoneyReceipt/MoneyReceiptForm';
import MoneyReceipts from './MoneyReceipt/MoneyReceipts';
import Receipts from './MoneyReceipt/Receipts';
import LeadsTabContainer from './Lead/AllLeads/LeadsTabContainer';
import PastLeadsTabContainer from './Lead/AllLeads/PastLeadsTabContainer';

import PrivateRoute from "./auth/PrivateRoute";
import ReceiverCollectionsPage from './pages/ReceiverCollectionsPage';

import Accountant from './Accountant/Accountant';
import AccountantForm from './Accountant/AccountantForm';

import VendorProfile from './Vendor/VendorProfile';
import Vendor from './Vendor/Vendor';
import VendorOtherForm from './Vendor/VendorOtherForm';
import VendorTable from './Vendor/VendorTable';
import VendorBookedTable from './Vendor/VendorBookedTable';
import VendorDeoppedTable from './Vendor/VendorDeoppedTable';

import DecorationProfile from './Decoration/DecorationProfile';
import Decoration from './Decoration/Decoration';
import DecorationOtherForm from './Decoration/DecorationOtherForm';
import DecorationTable from './Decoration/DecorationTable';
import DecorationBookedTable from './Decoration/DecorationBookedTable';
import DecorationDeoppedTable from './Decoration/DecorationDeoppedTable';

import LoginPage from "./auth/LoginPage";
import ApprovalPage from './MoneyReceipt/ApprovalPage';

import EnquiryForm from "./Enquiry/EnquiryForm";
import EnquiryDetails from "./Enquiry/EnquiryDetails";
import PastEnquiry from "./Enquiry/pastEnquiry/pastEnquiry";

import CateringAssign from "./Catering/CateringAssign";
import CateringAssigned from "./Catering/CateringAssigned";

import UserAccessPanel from './pages/UserAccessPanel';
import StatsPage from './pages/Stats';

import MenuItems from './pages/MenuItems';
import AdminProfile from './pages/AdminProfile';

import SaveBackup from './SaveBackup/SaveBackup';

function AppRoutes() {
  const navigate = useNavigate();

  useEffect(() => {
    const auth = getAuth();

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const accessRef = doc(db, "usersAccess", user.email);
        const unsubscribeSnapshot = onSnapshot(accessRef, (snap) => {
          const data = snap.data();
          if (!data || data.access !== "enable") {
            // alert("🚫 Your access has been disabled.");
            signOut(auth);
            navigate("/login");
          }
        });

        return () => unsubscribeSnapshot(); // clean up on unmount
      }
    });

    return () => unsubscribeAuth(); // clean up auth listener
  }, [navigate]);

  return (
    <>
      <InstallPrompt />
      <Routes>
        <Route path="/" element={<PrivateRoute><Prebook /></PrivateRoute>} />
        <Route path="/leadstabcontainer" element={<PrivateRoute><LeadsTabContainer /></PrivateRoute>} />
        <Route path="/PastLeadsTabContainer" element={<PrivateRoute><PastLeadsTabContainer /></PrivateRoute>} />

        <Route path="/GSTSummary" element={<PrivateRoute><GSTSummary /></PrivateRoute>} />

        <Route path="/MoneyReceipt" element={<PrivateRoute><MoneyReceipt /></PrivateRoute>} />
        <Route path="/MoneyReceipts" element={<PrivateRoute><MoneyReceipts /></PrivateRoute>} />
        <Route path="/Receipts" element={<PrivateRoute><Receipts /></PrivateRoute>} />
        <Route path="/ApprovalPage" element={<PrivateRoute><ApprovalPage /></PrivateRoute>} />

        <Route path="/bookingLead" element={<PrivateRoute><BookingLead /></PrivateRoute>} />
        <Route path="/leads" element={<PrivateRoute><BookingLeadsTable /></PrivateRoute>} />
        <Route path="/DroppedLeads" element={<PrivateRoute><DroppedLeads /></PrivateRoute>} />

        <Route path="/Booking" element={<PrivateRoute><Booking /></PrivateRoute>} />

        <Route path="/BookingTable" element={<PrivateRoute><BookingTable /></PrivateRoute>} />

        <Route path="/Accountant" element={<PrivateRoute><Accountant /></PrivateRoute>} />
        <Route path="/AccountantForm" element={<PrivateRoute><AccountantForm /></PrivateRoute>} />

        <Route path="/VendorProfile" element={<PrivateRoute><VendorProfile /></PrivateRoute>} />
        <Route path="/Vendor" element={<PrivateRoute><Vendor /></PrivateRoute>} />
        <Route path="/VendorOtherForm" element={<PrivateRoute><VendorOtherForm /></PrivateRoute>} />
        <Route path="/VendorTable" element={<PrivateRoute><VendorTable /></PrivateRoute>} />
        <Route path="/VendorBookedTable" element={<PrivateRoute><VendorBookedTable /></PrivateRoute>} />
        <Route path="/VendorDeoppedTable" element={<PrivateRoute><VendorDeoppedTable /></PrivateRoute>} />

        <Route path="/Decoration" element={<PrivateRoute><Decoration /></PrivateRoute>} />
        <Route path="/DecorationBookedTable" element={<PrivateRoute><DecorationBookedTable /></PrivateRoute>} />
        <Route path="/DecorationDeoppedTable" element={<PrivateRoute><DecorationDeoppedTable /></PrivateRoute>} />
        <Route path="/DecorationOtherForm" element={<PrivateRoute><DecorationOtherForm /></PrivateRoute>} />
        <Route path="/DecorationProfile" element={<PrivateRoute><DecorationProfile /></PrivateRoute>} />
        <Route path="/DecorationTable" element={<PrivateRoute><DecorationTable /></PrivateRoute>} />

        <Route path="/ReceiverCollectionsPage" element={<PrivateRoute><ReceiverCollectionsPage /></PrivateRoute>} />
        <Route path="/UserAccessPanel" element={<PrivateRoute><UserAccessPanel /></PrivateRoute>} />
        <Route path="/StatsPage" element={<PrivateRoute><StatsPage /></PrivateRoute>} />

        <Route path="/EnquiryForm" element={<PrivateRoute><EnquiryForm /></PrivateRoute>} />
        <Route path="/EnquiryDetails" element={<PrivateRoute><EnquiryDetails /></PrivateRoute>} />
        <Route path="/PastEnquiry" element={<PrivateRoute><PastEnquiry /></PrivateRoute>} />

        <Route path="/CateringAssign" element={<PrivateRoute><CateringAssign /></PrivateRoute>} />
        <Route path="/CateringAssigned" element={<PrivateRoute><CateringAssigned /></PrivateRoute>} />

        <Route path="/MenuItems" element={<PrivateRoute><MenuItems /></PrivateRoute>} />
        <Route path="/AdminProfile" element={<PrivateRoute><AdminProfile /></PrivateRoute>} />

        <Route path="/SaveBackup" element={<PrivateRoute><SaveBackup /></PrivateRoute>} />

        <Route path="/login" element={<LoginPage />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}