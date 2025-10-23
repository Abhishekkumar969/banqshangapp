import React, { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { getAuth } from "firebase/auth"; // <-- import auth
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import EnquiryDetails from '../../Enquiry/EnquiryDetails';
import BookingLeadsTable from './BookingLeadsTable';
import AllBookings from '../../Book/AllLeads/BookingLeadsTable';
import '../../styles/LeadsTabContainer.css';
import BackButton from "../../components/BackButton";

const LeadsTabContainer = () => {
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const tabFromURL = queryParams.get("tab");

    const [activeTab, setActiveTab] = useState(null);
    const [panelAccess, setPanelAccess] = useState({});
    const [userAppType, setUserAppType] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) return; // user not logged in

        const userRef = doc(db, 'usersAccess', user.email);
        const unsubscribeUser = onSnapshot(userRef, (snap) => {
            if (snap.exists()) setUserAppType(snap.data().accessToApp);
        });

        const accessRef = doc(db, "pannelAccess", "Bookings");
        const unsubscribeAccess = onSnapshot(accessRef, (snap) => {
            if (snap.exists()) {
                setPanelAccess(snap.data());
                setLoading(false);
            }
        });

        return () => {
            unsubscribeUser();
            unsubscribeAccess();
        };
    }, []);

    const hasAccess = useCallback(
        (recordType) => {
            if (!userAppType || !panelAccess) return false;
            const arr = panelAccess[recordType] || [];
            return arr.includes(userAppType);
        },
        [userAppType, panelAccess]
    );

    useEffect(() => {
        if (!loading) {
            const accessibleTabs = [];
            if (hasAccess("Enquiry Record")) accessibleTabs.push("EnquiryDetails");
            if (hasAccess("Lead Record")) accessibleTabs.push("booking");
            if (hasAccess("Book Record")) accessibleTabs.push("all");

            let defaultTab = null;
            if (tabFromURL === "enquiry" && accessibleTabs.includes("EnquiryDetails")) defaultTab = "EnquiryDetails";
            else if (tabFromURL === "leads" && accessibleTabs.includes("booking")) defaultTab = "booking";
            else if (tabFromURL === "bookings" && accessibleTabs.includes("all")) defaultTab = "all";
            else defaultTab = accessibleTabs[0] || null;

            setActiveTab(defaultTab);
        }
    }, [tabFromURL, hasAccess, loading]);

    const renderActiveComponent = () => {
        switch (activeTab) {
            case 'EnquiryDetails': return <EnquiryDetails />;
            case 'booking': return <BookingLeadsTable />;
            case 'all': return <AllBookings />;
            default: return <p>No access to any tabs</p>;
        }
    };

    const handleTabClick = (tabKey, urlParam) => {
        setActiveTab(tabKey);
        window.history.replaceState(null, "", `?tab=${urlParam}`);
    };

    if (loading) return <p>Loading...</p>;

    return (
        <div className="leads-tab-wrapper">
            <BackButton setActiveTab={setActiveTab} />

            <div>{renderActiveComponent()}</div>

            <div className="tab-buttons">
                {hasAccess("Enquiry Record") && (
                    <button
                        onClick={() => handleTabClick('EnquiryDetails', 'enquiry')}
                        className={activeTab === 'EnquiryDetails' ? 'active' : ''}
                    >
                        <span>Enquiry</span>
                    </button>
                )}
                {hasAccess("Lead Record") && (
                    <button
                        onClick={() => handleTabClick('booking', 'leads')}
                        className={activeTab === 'booking' ? 'active' : ''}
                    >
                        <span>Leads</span>
                    </button>
                )}
                {hasAccess("Book Record") && (
                    <button
                        onClick={() => handleTabClick('all', 'bookings')}
                        className={activeTab === 'all' ? 'active' : ''}
                    >
                        <span>Bookings</span>
                    </button>
                )}
            </div>
        </div>
    );
};

export default LeadsTabContainer;
