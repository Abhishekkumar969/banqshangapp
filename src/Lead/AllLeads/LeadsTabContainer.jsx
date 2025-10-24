import React, { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import EnquiryDetails from "../../Enquiry/EnquiryDetails";
import BookingLeadsTable from "./BookingLeadsTable";
import AllBookings from "../../Book/AllLeads/BookingLeadsTable";
import "../../styles/LeadsTabContainer.css";
import BackButton from "../../components/BackButton";

const LeadsTabContainer = () => {
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const tabFromURL = queryParams.get("tab");

    const [activeTab, setActiveTab] = useState(null);
    const [panelAccess, setPanelAccess] = useState({});
    const [userAppType, setUserAppType] = useState(null);
    const [loading, setLoading] = useState(true);

    // ✅ Wait for auth user before loading access data
    useEffect(() => {
        const auth = getAuth();
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            if (!user) {
                setLoading(false);
                return;
            }

            const userRef = doc(db, "usersAccess", user.email);
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
        });

        return () => unsubscribeAuth();
    }, []);

    const hasAccess = useCallback(
        (recordType) => {
            if (userAppType === "A") return true; // Admin full access
            if (!userAppType || !panelAccess) return false;
            const arr = panelAccess[recordType] || [];
            return Array.isArray(arr) && arr.includes(userAppType);
        },
        [userAppType, panelAccess]
    );

    // ✅ Once data is loaded, pick the default tab properly
    useEffect(() => {
        if (loading) return;
        if (!userAppType || Object.keys(panelAccess).length === 0) return;

        const accessibleTabs = [];

        if (hasAccess("Lead Record")) accessibleTabs.push("booking");
        if (hasAccess("Book Record")) accessibleTabs.push("all");
        if (hasAccess("Enquiry Record")) accessibleTabs.push("EnquiryDetails");

        if (accessibleTabs.length === 0) {
            setActiveTab(null);
            return;
        }

        let defaultTab = null;

        if (tabFromURL === "leads" && hasAccess("Lead Record")) defaultTab = "booking";
        else if (tabFromURL === "bookings" && hasAccess("Book Record")) defaultTab = "all";
        else if (tabFromURL === "enquiry" && hasAccess("Enquiry Record")) defaultTab = "EnquiryDetails";
        else defaultTab = accessibleTabs[0]; // fallback to first allowed

        // Avoid wrong default
        if (defaultTab === "EnquiryDetails" && !hasAccess("Enquiry Record")) {
            defaultTab = accessibleTabs.find((tab) => tab !== "EnquiryDetails") || null;
        }

        if (!activeTab || !accessibleTabs.includes(activeTab)) {
            setActiveTab(defaultTab);
            const urlParam =
                defaultTab === "booking"
                    ? "leads"
                    : defaultTab === "all"
                        ? "bookings"
                        : defaultTab === "EnquiryDetails"
                            ? "enquiry"
                            : "";
            if (urlParam) window.history.replaceState(null, "", `?tab=${urlParam}`);
        }
    }, [activeTab, tabFromURL, hasAccess, loading, panelAccess, userAppType]);


    const renderActiveComponent = () => {
        if (!activeTab) return <p style={{ textAlign: "center" }}>No access to any tabs</p>;

        switch (activeTab) {
            case "EnquiryDetails":
                return hasAccess("Enquiry Record") ? <EnquiryDetails /> : <p>No access to Enquiry</p>;
            case "booking":
                return hasAccess("Lead Record") ? <BookingLeadsTable /> : <p>No access to Leads</p>;
            case "all":
                return hasAccess("Book Record") ? <AllBookings /> : <p>No access to Bookings</p>;
            default:
                return <p>No access to any tabs</p>;
        }
    };

    const handleTabClick = (tabKey, urlParam) => {
        if (activeTab === tabKey) return;
        setActiveTab(tabKey);
        window.history.replaceState(null, "", `?tab=${urlParam}`);
    };

    if (loading) return <p style={{ textAlign: "center" }}>Loading...</p>;

    return (
        <div className="leads-tab-wrapper">
            <BackButton setActiveTab={setActiveTab} />
            <div>{renderActiveComponent()}</div>

            <div className="tab-buttons">
                {hasAccess("Enquiry Record") && (
                    <button
                        onClick={() => handleTabClick("EnquiryDetails", "enquiry")}
                        className={activeTab === "EnquiryDetails" ? "active" : ""}
                    >
                        Enquiry
                    </button>
                )}
                {hasAccess("Lead Record") && (
                    <button
                        onClick={() => handleTabClick("booking", "leads")}
                        className={activeTab === "booking" ? "active" : ""}
                    >
                        Leads
                    </button>
                )}
                {hasAccess("Book Record") && (
                    <button
                        onClick={() => handleTabClick("all", "bookings")}
                        className={activeTab === "all" ? "active" : ""}
                    >
                        Bookings
                    </button>
                )}
            </div>
        </div>
    );
};

export default LeadsTabContainer;
